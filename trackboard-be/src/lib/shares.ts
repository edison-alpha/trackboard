import type { NewShare, PageShare, PublicPage, ShareResult, ShareState } from "@trackboard/api-types";
import { docName, pageDocName, type Permission, type Visibility } from "@trackboard/shared";
import { requireAccess } from "./access.ts";
import { db } from "./db/client.ts";
import { InputError, NotFoundError } from "./errors.ts";
import { closeDocument, publishPages } from "./events.ts";
import { createId } from "./id.ts";
import { createPageInvite, listPageInvites, normalizeEmail } from "./invites.ts";
import { notify } from "./notifications.ts";

const isPermission = (p: unknown): p is Permission => p === "view" || p === "edit";

/** Who can open this page and how: the sharing dialog's whole state. Only people who manage the page may see it. */
export async function getShareState(userId: string, pageId: string): Promise<ShareState> {
  const { page } = await requireAccess(userId, pageId, "manage");
  const d = await db();
  const [row] = await d.query<{ visibility: Visibility; workspace_permission: Permission; public_token: string | null }>("select visibility, workspace_permission, public_token from pages where id = $1", [pageId]);
  const shares = await d.query<{ id: string; name: string; color: string; email: string; permission: Permission }>(
    "select u.id, u.name, u.color, u.email, s.permission from page_shares s join users u on u.id = s.user_id where s.page_id = $1 order by u.name",
    [pageId],
  );
  void page;
  return {
    visibility: row!.visibility,
    workspacePermission: row!.workspace_permission,
    publicToken: row!.public_token,
    shares: shares.map((s): PageShare => ({ user: { id: s.id, name: s.name, color: s.color, email: s.email }, permission: s.permission })),
    invites: await listPageInvites(pageId),
  };
}

/**
 * Gives someone access. An existing account gets the share at once (and a notification); an email with no account gets
 * an invite link that only that Google account can use, because the server has no way to send email itself.
 */
export async function shareWithPerson(userId: string, pageId: string, input: NewShare): Promise<ShareResult> {
  const { page } = await requireAccess(userId, pageId, "manage");
  if (!isPermission(input.permission)) throw new InputError("Permission must be view or edit.");
  const d = await db();
  let target: { id: string; name: string; color: string } | undefined;
  if (input.userId) {
    [target] = await d.query<{ id: string; name: string; color: string }>("select id, name, color from users where id = $1", [input.userId]);
    if (!target) throw new NotFoundError("That person doesn't have an account.");
  } else {
    const email = normalizeEmail(input.email);
    [target] = await d.query<{ id: string; name: string; color: string }>("select id, name, color from users where lower(email) = $1", [email]);
    if (!target) return { kind: "invited", invite: await createPageInvite(userId, pageId, { email, permission: input.permission }) };
  }
  if (target.id === userId) throw new InputError("You already have access to this page.");
  if (target.id === page.created_by) throw new InputError("That person owns this page.");
  await d.query(
    "insert into page_shares (page_id, user_id, permission, created_at) values ($1, $2, $3, $4) on conflict (page_id, user_id) do update set permission = excluded.permission",
    [pageId, target.id, input.permission, Date.now()],
  );
  await notify({ userIds: [target.id], kind: "share", pageId, actorId: userId });
  void publishPages(pageId, page.workspace_id);
  return { kind: "shared", person: { id: target.id, name: target.name, color: target.color } };
}

/** Takes someone's access away (or lets a person drop their own). Their open editor is closed so it takes effect now. */
export async function removeShare(userId: string, pageId: string, targetId: string): Promise<void> {
  const { page } = await requireAccess(userId, pageId, userId === targetId ? "view" : "manage");
  await (await db()).query("delete from page_shares where page_id = $1 and user_id = $2", [pageId, targetId]);
  closeDocument(docName(page.workspace_id, pageDocName(pageId)));
  void publishPages(pageId, page.workspace_id);
}

/** Turns the public link on or off. Turning it on twice keeps the same link; off then on makes a new one. */
export async function setPublic(userId: string, pageId: string, on: boolean): Promise<string | null> {
  const { page } = await requireAccess(userId, pageId, "manage");
  const d = await db();
  const [row] = await d.query<{ public_token: string | null }>("select public_token from pages where id = $1", [pageId]);
  const token = on ? (row!.public_token ?? createId(24)) : null;
  await d.query("update pages set public_token = $2 where id = $1", [pageId, token]);
  void publishPages(pageId, page.workspace_id);
  return token;
}

/** The read-only copy anyone with the link may open, signed in or not. Trashed pages are not served. */
export async function getPublicPage(token: string): Promise<PublicPage> {
  const [r] = await (await db()).query<{ title: string; icon: string | null; cover: string | null; cover_y: number; page_width: "normal" | "center" | "full"; content_json: unknown }>(
    `select p.title, p.icon, p.cover, p.cover_y, p.page_width, d.content_json
       from pages p left join documents d on d.name = p.workspace_id || '/page:' || p.id
      where p.public_token = $1 and p.deleted_at is null`,
    [String(token).slice(0, 64)],
  );
  if (!r) throw new NotFoundError("This link isn't available.");
  const content = typeof r.content_json === "string" ? JSON.parse(r.content_json) : (r.content_json ?? { type: "doc" });
  return { title: r.title, icon: r.icon, cover: r.cover, coverY: Number(r.cover_y), pageWidth: r.page_width, content };
}

/** True when a file belongs to a page that has a public link, so it may be served to anyone. */
export async function isPublicPage(pageId: string): Promise<boolean> {
  return (await (await db()).query("select 1 as ok from pages where id = $1 and public_token is not null and deleted_at is null", [pageId])).length > 0;
}
