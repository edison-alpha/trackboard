import type { Thread } from "@/modules/comments";
import { displayTitle, isTrashed, type PageMap, type Person } from "@/modules/workspace";
import type { MentionRecord } from "./mentions";

export type InboxKind = "mention" | "comment" | "reply";

export type InboxItem = {
  /** Stable, so "read" survives reloads: message id for comments, page + person + time for mentions. */
  id: string;
  kind: InboxKind;
  at: number;
  pageId: string;
  pageTitle: string;
  pageIcon: string | null;
  threadId?: string;
  by: { id: string; name: string; color: string };
  preview: string;
  /** The text the thread is anchored to. */
  quote?: string;
};

const MAX_ITEMS = 200;
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s);

/**
 * What the signed-in person should hear about, from data that already exists in the workspace:
 * - a new comment from someone else on a page you created, or a reply in a thread you took part in,
 * - someone else mentioning you in a page.
 * Your own actions never appear, and neither does anything on a page in the trash.
 */
export function buildFeed(input: { me: string; pages: PageMap; threads: Thread[]; mentions: MentionRecord[]; people: ReadonlyMap<string, Person> }): InboxItem[] {
  const { me, pages, threads, mentions, people } = input;
  const items: InboxItem[] = [];

  for (const thread of threads) {
    const page = pages.get(thread.pageId);
    if (!page || isTrashed(pages, page.id)) continue;
    const involved = page.createdBy === me || thread.messages.some((m) => m.author.id === me);
    if (!involved) continue;
    thread.messages.forEach((m, i) => {
      if (m.author.id === me) return;
      items.push({
        id: `msg:${m.id}`,
        kind: i === 0 ? "comment" : "reply",
        at: m.at,
        pageId: page.id,
        pageTitle: displayTitle(page),
        pageIcon: page.icon,
        threadId: thread.id,
        by: m.author,
        preview: clip(m.body, 180),
        quote: thread.quote ? clip(thread.quote, 100) : undefined,
      });
    });
  }

  for (const m of mentions) {
    if (m.userId !== me || m.by === me) continue;
    const page = pages.get(m.pageId);
    if (!page || isTrashed(pages, page.id)) continue;
    const by = people.get(m.by);
    items.push({
      id: `mention:${m.pageId}:${m.userId}:${m.at}`,
      kind: "mention",
      at: m.at,
      pageId: page.id,
      pageTitle: displayTitle(page),
      pageIcon: page.icon,
      by: { id: m.by, name: by?.name ?? "Someone", color: by?.color ?? "#666666" },
      preview: "",
    });
  }

  return items.sort((a, b) => b.at - a.at).slice(0, MAX_ITEMS);
}
