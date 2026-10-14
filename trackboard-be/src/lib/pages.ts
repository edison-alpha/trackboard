import type { ExportFormat, MovePage, NewPage, PageMeta, PagePatch, PagesIndex, Person, TicketLink } from "@trackboard/api-types";
import { computeAccess, docName, ID_PATTERN, pageDocName, type Permission, type Visibility, type WorkspaceRole } from "@trackboard/shared";
import { getPage, requireAccess, requireMember } from "./access.ts";
import { db } from "./db/client.ts";
import { ConflictError, InputError, NotFoundError } from "./errors.ts";
import { closeDocument, publishPages } from "./events.ts";
import { workspaceFor } from "./workspaces.ts";
import { deleteSnapshots } from "./snapshots.ts";
import { deleteTickets } from "./tickets.ts";

type Row = {
  id: string; workspace_id: string; parent_id: string | null; title: string; icon: string | null; cover: string | null; cover_y: number;
  position: number; page_width: "normal" | "center" | "full"; full_width: boolean; template: string | null; visibility: Visibility;
  workspace_permission: Permission; public_token: string | null; created_by: string; created_at: string | number; updated_at: string | number;
  deleted_at: string | number | null; share: Permission | null; role: WorkspaceRole | null; favorite: boolean; preview: string | null;
};

/** Pages the viewer may see: their own, ones shared with them, and (for members) ones shared with the workspace. */
const VISIBLE = `select p.id, p.workspace_id, p.parent_id, p.title, p.icon, p.cover, p.cover_y, p.position, p.page_width, p.full_width, p.template,
       p.visibility, p.workspace_permission, p.public_token, p.created_by, p.created_at, p.updated_at, p.deleted_at,
       s.permission as share, m.role as role, (f.user_id is not null) as favorite, left(d.text, 200) as preview
  from pages p
  left join documents d on d.name = p.workspace_id || '/page:' || p.id
  left join page_shares s on s.page_id = p.id and s.user_id = $1
  left join workspace_members m on m.workspace_id = p.workspace_id and m.user_id = $1
  left join page_favorites f on f.page_id = p.id and f.user_id = $1
 where (p.created_by = $1 or s.user_id is not null or (m.user_id is not null and p.visibility = 'workspace'))`;

async function loadMetas(userId: string, extraWhere: string, params: unknown[]): Promise<PageMeta[]> {
  const d = await db();
  const rows = await d.query<Row>(`${VISIBLE} ${extraWhere} order by p.position, p.created_at`, [userId, ...params]);
  const visible = rows
    .map((r) => ({ r, access: computeAccess({ userId, createdBy: r.created_by, visibility: r.visibility, workspacePermission: r.workspace_permission, share: r.share, role: r.role }) }))
    .filter((x) => x.access !== "none");
  if (!visible.length) return [];
  const ids = visible.map((x) => x.r.id);
  const [editorRows, ticketRows] = await Promise.all([
    d.query<{ page_id: string; user_id: string; last_at: string | number }>("select page_id, user_id, last_at from page_editors where page_id = any($1::text[])", [ids]),
    d.query<{ page_id: string; ticket_ref: string; title: string; url: string | null; linked_at: string | number }>("select page_id, ticket_ref, title, url, linked_at from tickets where page_id = any($1::text[]) order by linked_at", [ids]),
  ]);
  const editors = new Map<string, Record<string, number>>();
  for (const e of editorRows) (editors.get(e.page_id) ?? editors.set(e.page_id, {}).get(e.page_id)!)[e.user_id] = Number(e.last_at);
  const tickets = new Map<string, TicketLink[]>();
  for (const t of ticketRows) (tickets.get(t.page_id) ?? tickets.set(t.page_id, []).get(t.page_id)!).push({ id: t.ticket_ref, title: t.title, url: t.url, provider: "trackdocs", linkedAt: Number(t.linked_at) });
  return visible.map(({ r, access }) => ({
    id: r.id,
    workspaceId: r.workspace_id,
    parentId: r.parent_id,
    title: r.title,
    icon: r.icon,
    cover: r.cover,
    coverY: Number(r.cover_y),
    position: Number(r.position),
    pageWidth: r.page_width,
    fullWidth: r.full_width,
    template: r.template,
    visibility: r.visibility,
    workspacePermission: r.workspace_permission,
    publicToken: access === "manage" ? r.public_token : null,
    createdAt: Number(r.created_at),
    createdBy: r.created_by,
    updatedAt: Number(r.updated_at),
    deletedAt: r.deleted_at === null ? null : Number(r.deleted_at),
    preview: (r.preview ?? "").replace(/s+/g, " ").trim(),
    favorite: r.favorite,
    access: access as Exclude<typeof access, "none">,
    editors: editors.get(r.id) ?? {},
    linkedTickets: tickets.get(r.id) ?? [],
  }));
}

export async function pageMeta(userId: string, pageId: string): Promise<PageMeta> {
  const [meta] = await loadMetas(userId, "and p.id = $2", [pageId]);
  if (!meta) throw new NotFoundError("Page not found.");
  return meta;
}

/** Everything the page list needs for one workspace, already filtered to what this person may see. */
export async function listPages(userId: string, workspaceId: string): Promise<PagesIndex> {
  const workspace = await workspaceFor(userId, workspaceId);
  const pages = await loadMetas(userId, "and p.workspace_id = $2", [workspaceId]);
  const ids = new Set<string>();
  pages.forEach((p) => {
    ids.add(p.createdBy);
    Object.keys(p.editors).forEach((id) => ids.add(id));
  });
  const d = await db();
  const members = await d.query<Person>("select u.id, u.name, u.color from workspace_members m join users u on u.id = m.user_id where m.workspace_id = $1", [workspaceId]);
  members.forEach((m) => ids.delete(m.id));
  const others = ids.size ? await d.query<Person>("select id, name, color from users where id = any($1::text[])", [[...ids]]) : [];
  return { workspace, pages, people: [...members, ...others].map((p) => ({ id: p.id, name: p.name, color: p.color })) };
}

/* ---------- validation ---------- */

const text = (v: unknown, max: number, what: string): string => {
  if (typeof v !== "string") throw new InputError(`${what} must be text.`);
  if (v.length > max) throw new InputError(`${what} is too long.`);
  return v;
};
const nullableText = (v: unknown, max: number, what: string): string | null => (v === null ? null : text(v, max, what));
const finite = (v: unknown, what: string): number => {
  if (typeof v !== "number" || !Number.isFinite(v)) throw new InputError(`${what} must be a number.`);
  return v;
};
const pageId = (id: unknown): string => {
  if (typeof id !== "string" || !ID_PATTERN.test(id)) throw new InputError("Invalid page id.");
  return id;
};

async function nextPosition(workspaceId: string, parentId: string | null): Promise<number> {
  const rows = await (await db()).query<{ max: number | null }>("select max(position) as max from pages where workspace_id = $1 and parent_id is not distinct from $2", [workspaceId, parentId]);
  return (rows[0]?.max ?? 0) + 1;
}

/* ---------- mutations ---------- */

export async function createPage(userId: string, input: NewPage): Promise<PageMeta> {
  const id = pageId(input.id);
  await requireMember(userId, input.workspaceId);
  let visibility: Visibility = "private";
  let workspacePermission: Permission = "edit";
  const parentId = input.parentId ?? null;
  if (parentId) {
    const { page: parent } = await requireAccess(userId, parentId, "edit");
    if (parent.workspace_id !== input.workspaceId) throw new InputError("The parent page is in another workspace.");
    // A subpage starts with the visibility of the page it is created in.
    visibility = parent.visibility;
    workspacePermission = parent.workspace_permission;
  } else if (input.visibility === "workspace") visibility = "workspace";
  if (await getPage(id)) throw new ConflictError("That page id is already taken.");
  const now = Date.now();
  const position = input.position !== undefined ? finite(input.position, "position") : await nextPosition(input.workspaceId, parentId);
  await (await db()).tx(async (t) => {
    await t.query(
      `insert into pages (id, workspace_id, parent_id, title, icon, template, position, visibility, workspace_permission, created_by, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)`,
      [id, input.workspaceId, parentId, text(input.title ?? "", 200, "Title"), nullableText(input.icon ?? null, 16, "Icon"), nullableText(input.template ?? null, 40, "Template"), position, visibility, workspacePermission, userId, now],
    );
    await t.query("insert into page_editors (page_id, user_id, last_at) values ($1, $2, $3)", [id, userId, now]);
  });
  void publishPages(id, input.workspaceId);
  return pageMeta(userId, id);
}

const COLUMNS: Record<string, string> = { title: "title", icon: "icon", cover: "cover", coverY: "cover_y", pageWidth: "page_width", fullWidth: "full_width", template: "template", visibility: "visibility", workspacePermission: "workspace_permission" };
/** Changing these counts as writing the page: it moves up in "recent" and the person joins the contributors. */
const CONTENT = new Set(["title", "icon", "cover"]);

export async function updatePage(userId: string, id: string, patch: PagePatch): Promise<PageMeta> {
  const wantsAccessChange = patch.visibility !== undefined || patch.workspacePermission !== undefined;
  const { page } = await requireAccess(userId, id, wantsAccessChange ? "manage" : "edit");
  const sets: string[] = [];
  const params: unknown[] = [id];
  const set = (key: string, value: unknown) => {
    params.push(value);
    sets.push(`${COLUMNS[key]} = $${params.length}`);
  };
  const p = patch as Record<string, unknown>;
  for (const key of Object.keys(p)) {
    if (!(key in COLUMNS)) throw new InputError(`Unknown field: ${key}`);
    const v = p[key];
    switch (key) {
      case "title": set(key, text(v, 200, "Title")); break;
      case "icon": set(key, nullableText(v, 16, "Icon")); break;
      case "cover": set(key, nullableText(v, 2000, "Cover")); break;
      case "template": set(key, nullableText(v, 40, "Template")); break;
      case "coverY": set(key, Math.round(Math.max(0, Math.min(100, finite(v, "coverY"))))); break;
      case "pageWidth": if (v !== "normal" && v !== "center" && v !== "full") throw new InputError("Unknown page width."); set(key, v); break;
      case "fullWidth": set(key, Boolean(v)); break;
      case "visibility": if (v !== "private" && v !== "workspace") throw new InputError("Unknown visibility."); set(key, v); break;
      case "workspacePermission": if (v !== "view" && v !== "edit") throw new InputError("Unknown permission."); set(key, v); break;
    }
  }
  if (!sets.length) return pageMeta(userId, id);
  const now = Date.now();
  const writes = Object.keys(p).some((k) => CONTENT.has(k));
  if (writes) {
    params.push(now);
    sets.push(`updated_at = $${params.length}`);
  }
  const d = await db();
  await d.query(`update pages set ${sets.join(", ")} where id = $1`, params);
  if (writes) await recordEdit(id, userId, now);
  void publishPages(id, page.workspace_id);
  // Hiding a page from the workspace ends the live sessions of the people who no longer have it.
  if (patch.visibility === "private") closeDocument(docName(page.workspace_id, pageDocName(id)));
  return pageMeta(userId, id);
}

/** Notes that someone wrote the page: "last edited" and the contributors row. */
export async function recordEdit(id: string, userId: string, at = Date.now()): Promise<void> {
  const d = await db();
  await d.query("update pages set updated_at = $2 where id = $1", [id, at]);
  await d.query("insert into page_editors (page_id, user_id, last_at) values ($1, $2, $3) on conflict (page_id, user_id) do update set last_at = excluded.last_at", [id, userId, at]);
}

export async function movePage(userId: string, id: string, to: MovePage): Promise<PageMeta> {
  const { page } = await requireAccess(userId, id, "edit");
  const parentId = to.parentId ?? null;
  const position = finite(to.position, "position");
  if (parentId) {
    const { page: parent } = await requireAccess(userId, parentId, "edit");
    if (parent.workspace_id !== page.workspace_id) throw new InputError("Pages can't move to another workspace.");
    // Refuse to move a page into its own subtree.
    const loop = await (await db()).query<{ id: string }>(
      "with recursive up(id, parent_id) as (select id, parent_id from pages where id = $1 union select p.id, p.parent_id from pages p join up on p.id = up.parent_id) select id from up where id = $2",
      [parentId, id],
    );
    if (loop.length) throw new InputError("A page can't be moved into itself.");
  }
  await (await db()).query("update pages set parent_id = $2, position = $3 where id = $1", [id, parentId, position]);
  void publishPages(id, page.workspace_id);
  return pageMeta(userId, id);
}

export async function trashPage(userId: string, id: string): Promise<PageMeta> {
  const { page } = await requireAccess(userId, id, "edit");
  await (await db()).query("update pages set deleted_at = $2 where id = $1", [id, Date.now()]);
  void publishPages(id, page.workspace_id);
  return pageMeta(userId, id);
}

/** Restores a page; if its parent is gone or still in the trash, it lands at the top level. */
export async function restorePage(userId: string, id: string): Promise<PageMeta> {
  const { page } = await requireAccess(userId, id, "edit");
  const d = await db();
  const parent = page.parent_id ? (await d.query<{ deleted_at: number | null }>("select deleted_at from pages where id = $1", [page.parent_id]))[0] : undefined;
  const parentOk = parent && parent.deleted_at === null;
  await d.query(`update pages set deleted_at = null${page.parent_id && !parentOk ? ", parent_id = null" : ""} where id = $1`, [id]);
  void publishPages(id, page.workspace_id);
  return pageMeta(userId, id);
}

/**
 * Removes pages and everything inside them for good: documents, versions, tickets, comments, shares. Needs `manage` on
 * each page named. Returns the document names so open sessions can be closed.
 */
export async function purgePages(userId: string, ids: string[]): Promise<string[]> {
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500) throw new InputError("ids must be a list of page ids.");
  ids.forEach(pageId);
  const pages = new Map<string, string>();
  for (const id of ids) pages.set(id, (await requireAccess(userId, id, "manage")).page.workspace_id);
  const d = await db();
  const tree = await d.query<{ id: string; workspace_id: string }>(
    "with recursive t(id, workspace_id) as (select id, workspace_id from pages where id = any($1::text[]) union select c.id, c.workspace_id from pages c join t on c.parent_id = t.id) select id, workspace_id from t",
    [[...pages.keys()]],
  );
  const names = tree.map((p) => docName(p.workspace_id, pageDocName(p.id)));
  const byWorkspace = new Map<string, string[]>();
  tree.forEach((p) => (byWorkspace.get(p.workspace_id) ?? byWorkspace.set(p.workspace_id, []).get(p.workspace_id)!).push(p.id));
  await d.tx(async (t) => {
    await t.query("delete from documents where name = any($1::text[])", [names]);
    await t.query("delete from pages where id = any($1::text[])", [[...pages.keys()]]);
  });
  for (const [workspaceId, list] of byWorkspace) {
    await deleteSnapshots(workspaceId, list);
    await deleteTickets(workspaceId, list);
  }
  return names;
}

export async function setFavorite(userId: string, id: string, on: boolean): Promise<void> {
  await requireAccess(userId, id, "view");
  const d = await db();
  if (on) await d.query("insert into page_favorites (user_id, page_id) values ($1, $2) on conflict do nothing", [userId, id]);
  else await d.query("delete from page_favorites where user_id = $1 and page_id = $2", [userId, id]);
}

/**
 * Copies a page, right after the original, with its content. `live` is the in-memory state when someone has the page
 * open, which is newer than the database by up to the store debounce.
 */
export async function duplicatePage(userId: string, fromId: string, toId: string, live?: Uint8Array): Promise<PageMeta> {
  const to = pageId(toId);
  const { page: from } = await requireAccess(userId, fromId, "view");
  await requireMember(userId, from.workspace_id);
  if (await getPage(to)) throw new ConflictError("That page id is already taken.");
  const d = await db();
  const [src] = await d.query<{ title: string; icon: string | null; cover: string | null; cover_y: number; page_width: string; full_width: boolean; position: number }>(
    "select title, icon, cover, cover_y, page_width, full_width, position from pages where id = $1",
    [fromId],
  );
  const next = await d.query<{ position: number }>("select min(position) as position from pages where workspace_id = $1 and parent_id is not distinct from $2 and position > $3", [from.workspace_id, from.parent_id, src!.position]);
  const position = next[0]?.position == null ? Number(src!.position) + 1 : (Number(src!.position) + Number(next[0].position)) / 2;
  const now = Date.now();
  const title = `${src!.title.trim() || "Untitled"} (copy)`;
  await d.tx(async (t) => {
    await t.query(
      `insert into pages (id, workspace_id, parent_id, title, icon, cover, cover_y, page_width, full_width, position, visibility, workspace_permission, created_by, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)`,
      [to, from.workspace_id, from.parent_id, title, src!.icon, src!.cover, src!.cover_y, src!.page_width, src!.full_width, position, from.visibility, from.workspace_permission, userId, now],
    );
    await t.query("insert into page_editors (page_id, user_id, last_at) values ($1, $2, $3)", [to, userId, now]);
    const fromName = docName(from.workspace_id, pageDocName(fromId));
    const toName = docName(from.workspace_id, pageDocName(to));
    await t.query(
      `insert into documents (name, workspace_id, ydoc, content_json, text, updated_at)
       select $2, workspace_id, ${live ? "$4" : "ydoc"}, content_json, text, $3 from documents where name = $1`,
      live ? [fromName, toName, now, live] : [fromName, toName, now],
    );
  });
  void publishPages(to, from.workspace_id);
  return pageMeta(userId, to);
}

/** The stored read copy of a page: ProseMirror JSON or plain text. Access is checked by the caller. */
export async function exportPage(workspaceId: string, id: string, format: ExportFormat): Promise<{ body: string; type: string }> {
  const rows = await (await db()).query<{ content_json: unknown; text: string }>("select content_json, text from documents where name = $1", [docName(workspaceId, pageDocName(pageId(id)))]);
  const r = rows[0];
  if (!r) throw new NotFoundError("This page has no saved content yet.");
  if (format === "text") return { body: r.text, type: "text/plain; charset=utf-8" };
  const json = typeof r.content_json === "string" ? r.content_json : JSON.stringify(r.content_json ?? { type: "doc" });
  return { body: json, type: "application/json" };
}
