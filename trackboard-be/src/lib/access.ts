import { atLeast, computeAccess, type Access, type Permission, type Visibility, type WorkspaceRole } from "@trackboard/shared";
import { db } from "./db/client.ts";
import { ForbiddenError, NotFoundError } from "./errors.ts";

/** The columns of a page that decide who may see it, plus where it lives. */
export type PageRow = {
  id: string;
  workspace_id: string;
  parent_id: string | null;
  visibility: Visibility;
  workspace_permission: Permission;
  created_by: string;
  deleted_at: number | null;
  public_token: string | null;
};

export async function roleIn(userId: string, workspaceId: string): Promise<WorkspaceRole | null> {
  const rows = await (await db()).query<{ role: WorkspaceRole }>("select role from workspace_members where user_id = $1 and workspace_id = $2", [userId, workspaceId]);
  return rows[0]?.role ?? null;
}

export async function requireMember(userId: string, workspaceId: string): Promise<WorkspaceRole> {
  const role = await roleIn(userId, workspaceId);
  if (!role) throw new NotFoundError("Workspace not found.");
  return role;
}

export async function getPage(pageId: string): Promise<PageRow | undefined> {
  const rows = await (await db()).query<PageRow>(
    "select id, workspace_id, parent_id, visibility, workspace_permission, created_by, deleted_at, public_token from pages where id = $1",
    [pageId],
  );
  return rows[0];
}

/** What this person may do with the page. Anonymous visitors (null) never have access; public links are a separate path. */
export async function accessTo(userId: string | null, pageId: string): Promise<{ page: PageRow; access: Access } | { page: undefined; access: "none" }> {
  const page = await getPage(pageId);
  if (!page || !userId) return { page: undefined, access: "none" };
  const d = await db();
  const [share, member] = await Promise.all([
    d.query<{ permission: Permission }>("select permission from page_shares where page_id = $1 and user_id = $2", [pageId, userId]),
    d.query<{ role: WorkspaceRole }>("select role from workspace_members where workspace_id = $1 and user_id = $2", [page.workspace_id, userId]),
  ]);
  const access = computeAccess({
    userId,
    createdBy: page.created_by,
    visibility: page.visibility,
    workspacePermission: page.workspace_permission,
    share: share[0]?.permission ?? null,
    role: member[0]?.role ?? null,
  });
  return access === "none" ? { page: undefined, access: "none" } : { page, access };
}

/**
 * Loads the page if the person has at least `need` on it. A page they cannot see at all is "not found", so the answer
 * never confirms that a private page exists; one they can see but not change is "forbidden".
 */
export async function requireAccess(userId: string, pageId: string, need: Exclude<Access, "none">): Promise<{ page: PageRow; access: Exclude<Access, "none"> }> {
  const found = await accessTo(userId, pageId);
  if (found.access === "none") throw new NotFoundError("Page not found.");
  if (!atLeast(found.access, need)) throw new ForbiddenError(need === "manage" ? "Only people who manage this page can do that." : "You have view-only access to this page.");
  return { page: found.page, access: found.access };
}

/** Which of these pages the person can open, with what access. One query for a whole list (inbox, search). */
export async function accessibleAmong(userId: string, pageIds: string[]): Promise<Map<string, Exclude<Access, "none">>> {
  const out = new Map<string, Exclude<Access, "none">>();
  if (!pageIds.length) return out;
  const rows = await (await db()).query<PageRow & { share: Permission | null; role: WorkspaceRole | null }>(
    `select p.id, p.workspace_id, p.parent_id, p.visibility, p.workspace_permission, p.created_by, p.deleted_at, p.public_token,
            s.permission as share, m.role as role
       from pages p
       left join page_shares s on s.page_id = p.id and s.user_id = $1
       left join workspace_members m on m.workspace_id = p.workspace_id and m.user_id = $1
      where p.id = any($2::text[])`,
    [userId, pageIds],
  );
  for (const r of rows) {
    const access = computeAccess({ userId, createdBy: r.created_by, visibility: r.visibility, workspacePermission: r.workspace_permission, share: r.share, role: r.role });
    if (access !== "none") out.set(r.id, access);
  }
  return out;
}
