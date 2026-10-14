import type { Member, WorkspaceRole, WorkspaceSummary } from "@trackboard/api-types";
import { requireMember, roleIn } from "./access.ts";
import { db } from "./db/client.ts";
import { ConflictError, ForbiddenError, InputError, NotFoundError } from "./errors.ts";
import { publish, workspaceMembers } from "./events.ts";
import { createId } from "./id.ts";

type WsRow = { id: string; name: string; personal: boolean; role: WorkspaceRole | null };

/** "Personal" means the viewer's own space; someone else's personal workspace they joined is just a team to them. */
const summary = (r: WsRow): WorkspaceSummary => ({ id: r.id, name: r.name, personal: r.personal && r.role === "owner", role: r.role ?? "guest" });

/** Workspaces the person belongs to, then the ones where they only have shared pages (as a guest). */
export async function listWorkspaces(userId: string): Promise<WorkspaceSummary[]> {
  const d = await db();
  const member = await d.query<WsRow>(
    "select w.id, w.name, w.personal, m.role from workspaces w join workspace_members m on m.workspace_id = w.id where m.user_id = $1 order by (w.personal and m.role = 'owner') desc, w.created_at",
    [userId],
  );
  const guest = await d.query<WsRow>(
    `select distinct w.id, w.name, w.personal, null as role from workspaces w
       join pages p on p.workspace_id = w.id join page_shares s on s.page_id = p.id
      where s.user_id = $1 and w.id not in (select workspace_id from workspace_members where user_id = $1)`,
    [userId],
  );
  return [...member, ...guest].map(summary);
}

/** One workspace as this person sees it: as a member, or as a guest with shared pages in it. */
export async function workspaceFor(userId: string, workspaceId: string): Promise<WorkspaceSummary> {
  const all = await listWorkspaces(userId);
  const found = all.find((w) => w.id === workspaceId);
  if (!found) throw new NotFoundError("Workspace not found.");
  return found;
}

const cleanName = (name: unknown) => {
  const n = String(name ?? "").trim();
  if (n.length < 2 || n.length > 60) throw new InputError("A workspace name is 2 to 60 characters.");
  return n;
};

export async function createWorkspace(userId: string, name: string): Promise<WorkspaceSummary> {
  const id = createId();
  const now = Date.now();
  const clean = cleanName(name);
  await (await db()).tx(async (t) => {
    await t.query("insert into workspaces (id, name, personal, created_at) values ($1, $2, false, $3)", [id, clean, now]);
    await t.query("insert into workspace_members (workspace_id, user_id, role) values ($1, $2, 'owner')", [id, userId]);
  });
  return { id, name: clean, personal: false, role: "owner" };
}

export async function renameWorkspace(userId: string, workspaceId: string, name: string): Promise<WorkspaceSummary> {
  const role = await requireMember(userId, workspaceId);
  if (role === "member") throw new ForbiddenError("Only owners and admins can rename the workspace.");
  await (await db()).query("update workspaces set name = $2 where id = $1", [workspaceId, cleanName(name)]);
  publish(await workspaceMembers(workspaceId), { type: "members", workspaceId });
  return workspaceFor(userId, workspaceId);
}

export async function listMembers(userId: string, workspaceId: string): Promise<Member[]> {
  await requireMember(userId, workspaceId);
  return (
    await (await db()).query<{ id: string; name: string; color: string; email: string; role: WorkspaceRole }>(
      "select u.id, u.name, u.color, u.email, m.role from workspace_members m join users u on u.id = m.user_id where m.workspace_id = $1 order by m.role = 'owner' desc, m.role = 'admin' desc, u.name",
      [workspaceId],
    )
  ).map((r) => ({ id: r.id, name: r.name, color: r.color, email: r.email, role: r.role }));
}

export async function setMemberRole(actorId: string, workspaceId: string, targetId: string, role: Exclude<WorkspaceRole, "owner">): Promise<void> {
  if (role !== "admin" && role !== "member") throw new InputError("Role must be admin or member.");
  const actor = await requireMember(actorId, workspaceId);
  if (actor === "member") throw new ForbiddenError("Only owners and admins can change roles.");
  const target = await roleIn(targetId, workspaceId);
  if (!target) throw new NotFoundError("That person is not in this workspace.");
  if (target === "owner") throw new ForbiddenError("The owner's role can't be changed.");
  await (await db()).query("update workspace_members set role = $3 where workspace_id = $1 and user_id = $2", [workspaceId, targetId, role]);
  publish(await workspaceMembers(workspaceId), { type: "members", workspaceId });
}

/** Removes a member, or lets someone leave. The owner cannot be removed and a personal workspace cannot be left. */
export async function removeMember(actorId: string, workspaceId: string, targetId: string): Promise<void> {
  const actor = await requireMember(actorId, workspaceId);
  const target = await roleIn(targetId, workspaceId);
  if (!target) throw new NotFoundError("That person is not in this workspace.");
  if (target === "owner") throw new ConflictError("The owner can't be removed from their workspace.");
  if (actorId !== targetId && actor === "member") throw new ForbiddenError("Only owners and admins can remove people.");
  const audience = await workspaceMembers(workspaceId);
  await (await db()).query("delete from workspace_members where workspace_id = $1 and user_id = $2", [workspaceId, targetId]);
  publish(audience, { type: "members", workspaceId });
  publish([targetId], { type: "pages", workspaceId });
}
