/** Local name of a page document. Every document is a page; the page tree and everything else lives in the database. */
export const pageDocName = (id: string) => `page:${id}`;

/** Name of the Y.XmlFragment the Tiptap Collaboration extension writes into. */
export const EDITOR_FIELD = "default";

/** Automatic versions kept per page; named versions are never pruned. */
export const MAX_AUTO_SNAPSHOTS = 40;

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Collaborator colours. White initials on each pass AA (checked: 5.0 to 6.5). */
export const PROFILE_COLORS = ["#0b6fe8", "#b02a2a", "#1d7a45", "#7b3fc4", "#b4530a", "#0f766e", "#be185d", "#4f46e5"] as const;

/** Ids are url-safe and short enough to sit in a path. */
export const ID_PATTERN = /^[A-Za-z0-9_-]{6,64}$/;

/** The name a client opens on the collab socket: `<workspaceId>/<local name>`, so a document never crosses workspaces. */
export const docName = (workspaceId: string, local: string) => `${workspaceId}/${local}`;

export type ParsedDocName = { workspaceId: string; local: string; pageId: string };

/** Splits a collab document name, or returns null when it is not one a client may open. */
export function parseDocName(name: string): ParsedDocName | null {
  const slash = name.indexOf("/");
  if (slash < 0) return null;
  const workspaceId = name.slice(0, slash);
  const local = name.slice(slash + 1);
  if (!ID_PATTERN.test(workspaceId)) return null;
  if (local.startsWith("page:") && ID_PATTERN.test(local.slice(5))) return { workspaceId, local, pageId: local.slice(5) };
  return null;
}

/* ---------- access ---------- */

export type Visibility = "private" | "workspace";
/** What can be granted to a person, or to the whole workspace. */
export type Permission = "view" | "edit";
/** What a person effectively has on a page. `manage` = change who has access, delete. */
export type Access = "none" | "view" | "edit" | "manage";
export type WorkspaceRole = "owner" | "admin" | "member";

const RANK: Record<Access, number> = { none: 0, view: 1, edit: 2, manage: 3 };
export const accessRank = (a: Access) => RANK[a];
export const atLeast = (have: Access, need: Exclude<Access, "none">) => RANK[have] >= RANK[need];
export const maxAccess = (...list: Access[]): Access => list.reduce((best, a) => (RANK[a] > RANK[best] ? a : best), "none" as Access);

/**
 * The one rule for who may do what to a page. The creator manages it; a share grants what it says; the whole workspace
 * gets the page's workspace permission when it is shared with the workspace (owners and admins manage those). A private
 * page is invisible to everyone else, including owners and admins.
 */
export function computeAccess(input: {
  userId: string;
  createdBy: string;
  visibility: Visibility;
  workspacePermission: Permission;
  /** Permission from a direct share, if any. */
  share: Permission | null;
  /** The person's role in the page's workspace; null when they are not a member (a guest). */
  role: WorkspaceRole | null;
}): Access {
  const granted: Access[] = [];
  if (input.createdBy === input.userId) granted.push("manage");
  if (input.share) granted.push(input.share);
  if (input.role && input.visibility === "workspace") granted.push(input.role === "member" ? input.workspacePermission : "manage");
  return maxAccess(...granted);
}

/** Invites expire after this many days unless the creator picks another. */
export const INVITE_DAYS = 7;
