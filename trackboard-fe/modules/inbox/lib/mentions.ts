import type * as Y from "yjs";

/* Who was mentioned where. Mentions live in the page text as "@Name" nodes, which can't answer "was I mentioned
   anywhere?" across pages, so each new mention is also written here, in the shared workspace doc. */

export type MentionRecord = { pageId: string; userId: string; by: string; at: number };

const mentionsOf = (doc: Y.Doc) => doc.getMap<MentionRecord>("mentions");

/** The same person mentioned again by the same author within this window is one notification, not many. */
const RENOTIFY_MS = 60 * 60 * 1000;

export function recordMention(doc: Y.Doc, m: { pageId: string; userId: string; by: string }): void {
  if (m.userId === m.by) return;
  const map = mentionsOf(doc);
  const key = `${m.pageId}:${m.userId}`;
  const current = map.get(key);
  const now = Date.now();
  if (current && current.by === m.by && now - current.at < RENOTIFY_MS) return;
  map.set(key, { pageId: m.pageId, userId: m.userId, by: m.by, at: now });
}

export const allMentions = (doc: Y.Doc): MentionRecord[] => [...mentionsOf(doc).values()];

export function observeMentions(doc: Y.Doc, cb: () => void): () => void {
  const map = mentionsOf(doc);
  map.observe(cb);
  return () => map.unobserve(cb);
}
