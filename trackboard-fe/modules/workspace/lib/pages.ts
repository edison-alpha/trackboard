import * as Y from "yjs";
import { createId } from "@/lib/id";
import type { PageMap, PageMeta, Person } from "./types";

/* All page mutations live here. Each page is its own Y.Map so two people editing different
   fields of the same page (title vs. icon) never overwrite each other. */

type PageYMap = Y.Map<unknown>;

export const pagesOf = (doc: Y.Doc) => doc.getMap<PageYMap>("pages");

export function readPage(y: PageYMap): PageMeta {
  const storedWidth = y.get("pageWidth");
  const pageWidth: PageMeta["pageWidth"] =
    storedWidth === "normal" || storedWidth === "center" || storedWidth === "full" ? storedWidth : Boolean(y.get("fullWidth")) ? "full" : "normal";
  return {
    id: y.get("id") as string,
    parentId: (y.get("parentId") as string | null) ?? null,
    title: (y.get("title") as string) ?? "",
    icon: (y.get("icon") as string | null) ?? null,
    cover: (y.get("cover") as string | null) ?? null,
    coverY: (y.get("coverY") as number | undefined) ?? 50,
    position: (y.get("position") as number) ?? 0,
    favorite: Boolean(y.get("favorite")),
    fullWidth: Boolean(y.get("fullWidth")),
    pageWidth,
    createdAt: (y.get("createdAt") as number) ?? 0,
    createdBy: (y.get("createdBy") as string) ?? "",
    updatedAt: (y.get("updatedAt") as number) ?? 0,
    deletedAt: (y.get("deletedAt") as number | null) ?? null,
    text: (y.get("text") as string) ?? "",
    template: (y.get("template") as string | null) ?? null,
    editors: (y.get("editors") as Y.Map<number> | undefined)?.toJSON() ?? {},
    linkedTickets: (y.get("linkedTickets") as PageMeta["linkedTickets"] | undefined) ?? [],
  };
}

export function readAll(doc: Y.Doc): Map<string, PageMeta> {
  const out = new Map<string, PageMeta>();
  pagesOf(doc).forEach((y, id) => out.set(id, readPage(y)));
  return out;
}

/* ---------- selectors ---------- */

/** Live children of a parent, in sidebar order. */
export function childrenOf(pages: PageMap, parentId: string | null): PageMeta[] {
  return [...pages.values()].filter((p) => p.parentId === parentId && p.deletedAt === null).sort((a, b) => a.position - b.position);
}

/** True when the page or any ancestor is in the trash. */
export function isTrashed(pages: PageMap, id: string): boolean {
  let p = pages.get(id);
  const seen = new Set<string>();
  while (p && !seen.has(p.id)) {
    if (p.deletedAt !== null) return true;
    seen.add(p.id);
    p = p.parentId ? pages.get(p.parentId) : undefined;
  }
  return false;
}

export function ancestorsOf(pages: PageMap, id: string): PageMeta[] {
  const chain: PageMeta[] = [];
  let p = pages.get(id);
  while (p?.parentId) {
    const parent = pages.get(p.parentId);
    if (!parent || chain.includes(parent)) break;
    chain.unshift(parent);
    p = parent;
  }
  return chain;
}

export function descendantIds(pages: PageMap, id: string): string[] {
  const out: string[] = [];
  const walk = (pid: string) => {
    for (const p of pages.values()) {
      if (p.parentId === pid) {
        out.push(p.id);
        walk(p.id);
      }
    }
  };
  walk(id);
  return out;
}

export const livePages = (pages: PageMap) => [...pages.values()].filter((p) => !isTrashed(pages, p.id));
export const favoritesOf = (pages: PageMap) => livePages(pages).filter((p) => p.favorite).sort((a, b) => a.title.localeCompare(b.title));
export const recentOf = (pages: PageMap, limit = 8) => livePages(pages).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, limit);
export const trashOf = (pages: PageMap) => [...pages.values()].filter((p) => p.deletedAt !== null).sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));

export const displayTitle = (p: Pick<PageMeta, "title"> | undefined) => p?.title.trim() || "Untitled";

/* ---------- mutations ---------- */

function positionAt(siblings: PageMeta[], index: number): number {
  const before = siblings[index - 1]?.position;
  const after = siblings[index]?.position;
  if (before === undefined && after === undefined) return 1;
  if (before === undefined) return (after as number) - 1;
  if (after === undefined) return before + 1;
  return (before + after) / 2;
}

export function createPage(
  doc: Y.Doc,
  input: { parentId: string | null; by: string; title?: string; icon?: string | null; template?: string | null; index?: number },
): string {
  const pages = readAll(doc);
  const siblings = childrenOf(pages, input.parentId);
  const id = createId();
  const now = Date.now();
  const y = new Y.Map<unknown>();
  const meta: PageMeta = {
    id,
    parentId: input.parentId,
    title: input.title ?? "",
    icon: input.icon ?? null,
    cover: null,
    coverY: 50,
    position: positionAt(siblings, input.index ?? siblings.length),
    favorite: false,
    fullWidth: false,
    pageWidth: "center",
    createdAt: now,
    createdBy: input.by,
    updatedAt: now,
    deletedAt: null,
    text: "",
    template: input.template ?? null,
    editors: {},
    linkedTickets: [],
  };
  doc.transact(() => {
    for (const [k, v] of Object.entries(meta)) if (k !== "editors") y.set(k, v);
    const editors = new Y.Map<number>();
    editors.set(input.by, now);
    y.set("editors", editors);
    pagesOf(doc).set(id, y);
  });
  return id;
}

/** Applies a patch. `by` marks a content edit: it bumps "last updated" and adds the person to the contributors. */
export function updatePage(doc: Y.Doc, id: string, patch: Partial<Omit<PageMeta, "id" | "editors">>, by?: string): void {
  const y = pagesOf(doc).get(id);
  if (!y) return;
  doc.transact(() => {
    for (const [k, v] of Object.entries(patch)) if (y.get(k) !== v) y.set(k, v);
    if (!by) return;
    const now = Date.now();
    y.set("updatedAt", now);
    let editors = y.get("editors") as Y.Map<number> | undefined;
    if (!(editors instanceof Y.Map)) {
      editors = new Y.Map<number>();
      y.set("editors", editors);
    }
    editors.set(by, now);
  });
}

/* ---------- people ---------- */

export const peopleOf = (doc: Y.Doc) => doc.getMap<Person>("people");

/** Keeps a name and colour for everyone who has opened the workspace, so contributors show even when offline. */
export function rememberPerson(doc: Y.Doc, p: Person): void {
  const cur = peopleOf(doc).get(p.id);
  if (!cur || cur.name !== p.name || cur.color !== p.color) peopleOf(doc).set(p.id, { id: p.id, name: p.name, color: p.color });
}

/** Moves a page under `parentId` at `index` among its new siblings. Refuses to move a page into its own subtree. */
export function movePage(doc: Y.Doc, id: string, parentId: string | null, index: number): boolean {
  const pages = readAll(doc);
  if (parentId === id || (parentId && descendantIds(pages, id).includes(parentId))) return false;
  const siblings = childrenOf(pages, parentId).filter((p) => p.id !== id);
  updatePage(doc, id, { parentId, position: positionAt(siblings, Math.max(0, Math.min(index, siblings.length))) });
  return true;
}

/** Moves a page one step up or down among its siblings (keyboard alternative to drag). */
export function nudgePage(doc: Y.Doc, id: string, delta: -1 | 1): void {
  const pages = readAll(doc);
  const page = pages.get(id);
  if (!page) return;
  const siblings = childrenOf(pages, page.parentId);
  const i = siblings.findIndex((p) => p.id === id);
  const target = i + delta;
  if (target < 0 || target >= siblings.length) return;
  movePage(doc, id, page.parentId, delta === 1 ? target + 1 : target);
}

/** Indent under the previous sibling, or outdent to the grandparent (keyboard alternative to drag). */
export function indentPage(doc: Y.Doc, id: string, direction: "in" | "out"): void {
  const pages = readAll(doc);
  const page = pages.get(id);
  if (!page) return;
  if (direction === "in") {
    const siblings = childrenOf(pages, page.parentId);
    const prev = siblings[siblings.findIndex((p) => p.id === id) - 1];
    if (prev) movePage(doc, id, prev.id, childrenOf(pages, prev.id).length);
  } else if (page.parentId) {
    const parent = pages.get(page.parentId);
    const uncles = childrenOf(pages, parent?.parentId ?? null);
    movePage(doc, id, parent?.parentId ?? null, uncles.findIndex((p) => p.id === page.parentId) + 1);
  }
}

export function trashPage(doc: Y.Doc, id: string): void {
  updatePage(doc, id, { deletedAt: Date.now() });
}

/** Restores a page; if its parent is gone or still in the trash, it lands at the top level. */
export function restorePage(doc: Y.Doc, id: string): void {
  const pages = readAll(doc);
  const page = pages.get(id);
  if (!page) return;
  const parentOk = page.parentId && pages.has(page.parentId) && !isTrashed(pages, page.parentId);
  updatePage(doc, id, { deletedAt: null, ...(parentOk ? {} : { parentId: null }) });
}

/** Removes a page and its subtree from the workspace. Returns removed ids so their documents can be deleted. */
export function deletePageForever(doc: Y.Doc, id: string): string[] {
  const ids = [id, ...descendantIds(readAll(doc), id)];
  doc.transact(() => ids.forEach((pid) => pagesOf(doc).delete(pid)));
  return ids;
}

export const descendantCount = (pages: PageMap, id: string) => descendantIds(pages, id).length;
