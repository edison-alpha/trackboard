import { randomBytes } from "node:crypto";
import type { AcceptedInvite, InviteSummary, InvitePreview } from "@trackboard/api-types";
import { INVITE_DAYS, type Permission, type WorkspaceRole } from "@trackboard/shared";
import { requireAccess, requireMember } from "./access.ts";
import { db } from "./db/client.ts";
import { env } from "./env.ts";
import { ConflictError, ForbiddenError, InputError, NotFoundError } from "./errors.ts";
import { publish, publishPages, workspaceMembers } from "./events.ts";
import { createId } from "./id.ts";

const DAY = 86_400_000;
const MAX_DAYS = 30;

export const normalizeEmail = (email: unknown): string => {
  const e = String(email ?? "").trim().toLowerCase();
  if (e.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new InputError("Enter a valid email address.");
  return e;
};

type Row = { id: string; code: string; kind: "workspace" | "page"; workspace_id: string; page_id: string | null; level: WorkspaceRole | Permission; email: string | null; created_by: string; expires_at: string | number; accepted_by: string | null; revoked_at: string | number | null };

const url = (code: string) => `${env().appOrigin}/invite/${code}`;
const summary = (r: Row): InviteSummary => ({ id: r.id, code: r.code, kind: r.kind, level: r.level, email: r.email, expiresAt: Number(r.expires_at), url: url(r.code) });

/** An unguessable code: it is the whole credential for a link that has no email attached. */
const newCode = () => randomBytes(18).toString("base64url");

async function insert(input: { kind: "workspace" | "page"; workspaceId: string; pageId: string | null; level: string; email: string | null; createdBy: string; days?: number | undefined }): Promise<InviteSummary> {
  const days = Math.max(1, Math.min(MAX_DAYS, Math.round(input.days ?? INVITE_DAYS)));
  const now = Date.now();
  const row: Row = { id: createId(), code: newCode(), kind: input.kind, workspace_id: input.workspaceId, page_id: input.pageId, level: input.level as Row["level"], email: input.email, created_by: input.createdBy, expires_at: now + days * DAY, accepted_by: null, revoked_at: null };
  await (await db()).query("insert into invites (id, code, kind, workspace_id, page_id, level, email, created_by, created_at, expires_at) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)", [
    row.id, row.code, row.kind, row.workspace_id, row.page_id, row.level, row.email, row.created_by, now, row.expires_at,
  ]);
  return summary(row);
}

/** Owners and admins invite people to the workspace as admins or members, optionally locked to one Google account. */
export async function createWorkspaceInvite(userId: string, workspaceId: string, input: { role: Exclude<WorkspaceRole, "owner">; email?: string; days?: number }): Promise<InviteSummary> {
  const role = await requireMember(userId, workspaceId);
  if (role === "member") throw new ForbiddenError("Only owners and admins can invite people to the workspace.");
  if (input.role !== "admin" && input.role !== "member") throw new InputError("Role must be admin or member.");
  return insert({ kind: "workspace", workspaceId, pageId: null, level: input.role, email: input.email ? normalizeEmail(input.email) : null, createdBy: userId, days: input.days });
}

/** An invite to one page for someone who has no account yet; it only works for that email. */
export async function createPageInvite(userId: string, pageId: string, input: { email: string; permission: Permission }): Promise<InviteSummary> {
  const { page } = await requireAccess(userId, pageId, "manage");
  if (input.permission !== "view" && input.permission !== "edit") throw new InputError("Permission must be view or edit.");
  return insert({ kind: "page", workspaceId: page.workspace_id, pageId, level: input.permission, email: normalizeEmail(input.email), createdBy: userId });
}

const PENDING = "revoked_at is null and expires_at > $2 and (email is null or accepted_by is null)";

export async function listWorkspaceInvites(userId: string, workspaceId: string): Promise<InviteSummary[]> {
  const role = await requireMember(userId, workspaceId);
  if (role === "member") return [];
  return (await (await db()).query<Row>(`select * from invites where workspace_id = $1 and kind = 'workspace' and ${PENDING} order by created_at desc`, [workspaceId, Date.now()])).map(summary);
}

export async function listPageInvites(pageId: string): Promise<InviteSummary[]> {
  return (await (await db()).query<Row>(`select * from invites where page_id = $1 and ${PENDING} order by created_at desc`, [pageId, Date.now()])).map(summary);
}

export async function revokeInvite(userId: string, code: string): Promise<void> {
  const d = await db();
  const [inv] = await d.query<Row>("select * from invites where code = $1", [String(code)]);
  if (!inv) throw new NotFoundError("Invite not found.");
  if (inv.created_by !== userId) {
    const role = await requireMember(userId, inv.workspace_id);
    if (role === "member") throw new ForbiddenError("Only the person who made an invite, or an admin, can cancel it.");
  }
  await d.query("update invites set revoked_at = $2 where id = $1 and revoked_at is null", [inv.id, Date.now()]);
}

/** What the invite page shows before anyone signs in: who invited you, to what. Reveals nothing for a bad code. */
export async function previewInvite(code: string): Promise<InvitePreview> {
  const [r] = await (await db()).query<Row & { workspace_name: string; page_title: string | null; inviter: string }>(
    `select i.*, w.name as workspace_name, p.title as page_title, u.name as inviter
       from invites i join workspaces w on w.id = i.workspace_id left join pages p on p.id = i.page_id join users u on u.id = i.created_by
      where i.code = $1 and i.revoked_at is null`,
    [String(code)],
  );
  if (!r) throw new NotFoundError("This invite link isn't valid any more.");
  return { kind: r.kind, workspaceName: r.workspace_name, pageTitle: r.page_title === null ? null : r.page_title.trim() || "Untitled", inviter: r.inviter, level: r.level, email: r.email, expired: Number(r.expires_at) <= Date.now() };
}

/** Joins the workspace or opens the page, as the invite says. A link locked to an email works only for that Google account. */
export async function acceptInvite(userId: string, code: string): Promise<AcceptedInvite> {
  const d = await db();
  const [inv] = await d.query<Row>("select * from invites where code = $1 and revoked_at is null", [String(code)]);
  if (!inv) throw new NotFoundError("This invite link isn't valid any more.");
  if (Number(inv.expires_at) <= Date.now()) throw new ConflictError("This invite has expired. Ask for a new one.");
  const [me] = await d.query<{ email: string }>("select email from users where id = $1", [userId]);
  if (inv.email && me!.email.toLowerCase() !== inv.email) throw new ForbiddenError(`This invite is for ${inv.email}. Sign in with that Google account.`);
  if (inv.email && inv.accepted_by && inv.accepted_by !== userId) throw new ConflictError("This invite has already been used.");

  if (inv.kind === "workspace") {
    // Joining never lowers a role the person already has.
    await d.query("insert into workspace_members (workspace_id, user_id, role) values ($1, $2, $3) on conflict (workspace_id, user_id) do nothing", [inv.workspace_id, userId, inv.level]);
  } else if (inv.page_id) {
    const [page] = await d.query<{ created_by: string }>("select created_by from pages where id = $1", [inv.page_id]);
    if (!page) throw new NotFoundError("The page was deleted.");
    if (page.created_by !== userId) {
      await d.query(
        `insert into page_shares (page_id, user_id, permission, created_at) values ($1, $2, $3, $4)
         on conflict (page_id, user_id) do update set permission = case when page_shares.permission = 'edit' then 'edit' else excluded.permission end`,
        [inv.page_id, userId, inv.level, Date.now()],
      );
    }
  }
  if (inv.email) await d.query("update invites set accepted_by = $2, accepted_at = $3 where id = $1", [inv.id, userId, Date.now()]);

  publish(await workspaceMembers(inv.workspace_id), { type: "members", workspaceId: inv.workspace_id });
  publish([userId], { type: "pages", workspaceId: inv.workspace_id });
  if (inv.page_id) void publishPages(inv.page_id, inv.workspace_id);
  return { kind: inv.kind, workspaceId: inv.workspace_id, pageId: inv.page_id };
}
