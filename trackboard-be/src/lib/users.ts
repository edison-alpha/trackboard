import type { Me, MeUpdate } from "@trackboard/api-types";
import { PROFILE_COLORS } from "@trackboard/shared";
import { db, type Row } from "./db/client.ts";
import { InputError, NotFoundError } from "./errors.ts";
import { createId } from "./id.ts";

type UserRow = Row & { id: string; email: string; name: string; color: string; role: string | null; focus: unknown; onboarding_done: boolean; workspace_id: string };

/** The default workspace is the person's own; joining a team never changes where they land. */
const SELECT = `select u.id, u.email, u.name, u.color, u.role, u.focus, u.onboarding_done,
  (select m.workspace_id from workspace_members m join workspaces w on w.id = m.workspace_id where m.user_id = u.id order by (w.personal and m.role = 'owner') desc, w.created_at limit 1) as workspace_id
  from users u`;

function toMe(r: UserRow): Me {
  const focus = typeof r.focus === "string" ? (JSON.parse(r.focus) as string[]) : (r.focus as string[]);
  return { id: r.id, workspaceId: r.workspace_id, email: r.email, name: r.name, color: r.color, role: r.role, focus, onboardingDone: r.onboarding_done };
}

export async function getMe(userId: string): Promise<Me> {
  const rows = await (await db()).query<UserRow>(`${SELECT} where u.id = $1`, [userId]);
  if (!rows[0]) throw new NotFoundError("Account not found.");
  return toMe(rows[0]);
}

/** Cursor colour that stays the same for one person, so their caret does not change between visits. */
const colorFor = (seed: string) => PROFILE_COLORS[[...seed].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7) % PROFILE_COLORS.length]!;

/** Finds the person by their Google account, or creates them with a workspace of their own on the first sign-in. */
export async function upsertGoogleUser(input: { sub: string; email: string; name: string }): Promise<Me> {
  const d = await db();
  const existing = await d.query<{ id: string }>("select id from users where google_sub = $1", [input.sub]);
  if (existing[0]) {
    await d.query("update users set email = $2 where id = $1", [existing[0].id, input.email]);
    return getMe(existing[0].id);
  }
  const id = createId();
  const workspaceId = createId();
  const now = Date.now();
  const name = input.name.trim().slice(0, 40) || input.email.split("@")[0]!;
  await d.tx(async (t) => {
    await t.query("insert into users (id, google_sub, email, name, color, created_at) values ($1, $2, $3, $4, $5, $6)", [id, input.sub, input.email, name, colorFor(input.sub), now]);
    await t.query("insert into workspaces (id, name, personal, created_at) values ($1, $2, true, $3)", [workspaceId, `${name}'s workspace`, now]);
    await t.query("insert into workspace_members (workspace_id, user_id, role) values ($1, $2, 'owner')", [workspaceId, id]);
  });
  return getMe(id);
}

export async function updateMe(userId: string, patch: MeUpdate): Promise<Me> {
  const sets: string[] = [];
  const params: unknown[] = [userId];
  const set = (column: string, value: unknown) => {
    params.push(value);
    sets.push(`${column} = $${params.length}`);
  };
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (name.length < 2 || name.length > 40) throw new InputError("Name must be 2 to 40 characters.");
    set("name", name);
  }
  if (patch.color !== undefined) {
    if (!(PROFILE_COLORS as readonly string[]).includes(patch.color)) throw new InputError("Unknown colour.");
    set("color", patch.color);
  }
  if (patch.role !== undefined) set("role", patch.role === null ? null : String(patch.role).slice(0, 40));
  if (patch.focus !== undefined) {
    if (!Array.isArray(patch.focus) || patch.focus.length > 6 || patch.focus.some((f) => typeof f !== "string" || f.length > 40)) throw new InputError("Invalid focus areas.");
    set("focus", JSON.stringify(patch.focus));
  }
  if (patch.onboardingDone !== undefined) set("onboarding_done", Boolean(patch.onboardingDone));
  if (sets.length) await (await db()).query(`update users set ${sets.join(", ")} where id = $1`, params);
  return getMe(userId);
}

export async function isMember(userId: string, workspaceId: string): Promise<boolean> {
  const rows = await (await db()).query("select 1 as ok from workspace_members where user_id = $1 and workspace_id = $2", [userId, workspaceId]);
  return rows.length > 0;
}
