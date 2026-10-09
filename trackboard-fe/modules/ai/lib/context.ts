import { displayTitle, type PageMeta } from "@/modules/workspace";

export type ContextPage = { id: string; title: string; text: string; partial: boolean };

const PER_PAGE = 8000;
const TOTAL = 60_000;
const MAX_PAGES = 6;

const words = (s: string) => s.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [];

/**
 * Picks the pages most likely to answer a question: keyword hits in the title count triple.
 * Falls back to the most recently edited pages when nothing matches. Long pages are cut and flagged,
 * so the UI can say what the answer was based on.
 */
export function pickContext(pages: PageMeta[], question: string): ContextPage[] {
  const terms = [...new Set(words(question))];
  const scored = pages
    .map((p) => {
      const title = displayTitle(p).toLowerCase();
      const body = p.text.toLowerCase();
      const score = terms.reduce((n, t) => n + (title.includes(t) ? 3 : 0) + Math.min(body.split(t).length - 1, 10), 0);
      return { p, score };
    })
    .filter((x) => x.p.text.trim() || displayTitle(x.p) !== "Untitled");

  const ranked = scored.some((x) => x.score > 0)
    ? scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score)
    : scored.sort((a, b) => b.p.updatedAt - a.p.updatedAt);

  const out: ContextPage[] = [];
  let used = 0;
  for (const { p } of ranked.slice(0, MAX_PAGES)) {
    const room = Math.min(PER_PAGE, TOTAL - used);
    if (room <= 200) break;
    const text = p.text.slice(0, room);
    used += text.length;
    out.push({ id: p.id, title: displayTitle(p), text, partial: p.text.length > text.length });
  }
  return out;
}
