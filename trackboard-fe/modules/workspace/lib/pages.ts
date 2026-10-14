import type { PageMap, PageMeta } from "./types";

/* Pure helpers over the page list the server returned. Nothing here writes: every change goes through the API. */

/**
 * Live children of a parent, in sidebar order. `null` gives the top level: pages with no parent, and pages whose
 * parent this person cannot see (a page shared on its own sits at the top of "Shared with me").
 */
export function childrenOf(pages: PageMap, parentId: string | null): PageMeta[] {
  return [...pages.values()]
    .filter((p) => p.deletedAt === null && (parentId === null ? p.parentId === null || !pages.has(p.parentId) : p.parentId === parentId))
    .sort((a, b) => a.position - b.position);
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

export const descendantCount = (pages: PageMap, id: string) => descendantIds(pages, id).length;

/** Which part of the sidebar a top-level page belongs to: workspace-wide, only mine, or shared with me by someone else. */
export type Section = "workspace" | "private" | "shared";

export function sectionOf(page: PageMeta, me: string): Section {
  if (page.visibility === "workspace") return "workspace";
  return page.createdBy === me ? "private" : "shared";
}

/** Top-level live pages of one sidebar section. */
export const rootsOf = (pages: PageMap, me: string, section: Section) => childrenOf(pages, null).filter((p) => sectionOf(p, me) === section);

/** Sort key for inserting at `index` among `siblings`: between its neighbours, so one page is rewritten and no other moves. */
export function positionAt(siblings: PageMeta[], index: number): number {
  const before = siblings[index - 1]?.position;
  const after = siblings[index]?.position;
  if (before === undefined && after === undefined) return 1;
  if (before === undefined) return (after as number) - 1;
  if (after === undefined) return before + 1;
  return (before + after) / 2;
}
