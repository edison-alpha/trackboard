import type { PageMeta } from "@/modules/workspace";

export type SearchHit = { page: PageMeta; snippet: string | null; score: number };

/** Title matches rank above body matches; the body match returns a short snippet around the hit. */
export function searchPages(pages: PageMeta[], query: string, limit = 20): SearchHit[] {
  const q = query.toLowerCase().trim();
  if (!q) return pages.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8).map((page) => ({ page, snippet: null, score: 0 }));
  const hits: SearchHit[] = [];
  for (const page of pages) {
    const title = (page.title || "Untitled").toLowerCase();
    const ti = title.indexOf(q);
    const bi = page.text.toLowerCase().indexOf(q);
    if (ti < 0 && bi < 0) continue;
    const score = ti === 0 ? 3 : ti > 0 ? 2 : 1;
    let snippet: string | null = null;
    if (bi >= 0) {
      const start = Math.max(0, bi - 40);
      snippet = (start > 0 ? "…" : "") + page.text.slice(start, bi + q.length + 60).replace(/\s+/g, " ").trim() + "…";
    }
    hits.push({ page, snippet, score });
  }
  return hits.sort((a, b) => b.score - a.score || b.page.updatedAt - a.page.updatedAt).slice(0, limit);
}
