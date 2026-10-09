import * as Y from "yjs";
import { createId } from "@/lib/id";

export type CommentAuthor = { id: string; name: string; color: string };
export type CommentMessage = { id: string; body: string; at: number; author: CommentAuthor };
export type Thread = {
  id: string;
  pageId: string;
  /** The text that was selected when the thread started, shown even if the text is later edited away. */
  quote: string;
  resolved: boolean;
  createdAt: number;
  messages: CommentMessage[];
};

/* Threads live in the workspace doc so the comment count per page is known without opening the page.
   Messages are a Y.Array so two replies at the same moment both survive. */

const threadsOf = (doc: Y.Doc) => doc.getMap<Y.Map<unknown>>("threads");

function read(y: Y.Map<unknown>): Thread {
  return {
    id: y.get("id") as string,
    pageId: y.get("pageId") as string,
    quote: (y.get("quote") as string) ?? "",
    resolved: Boolean(y.get("resolved")),
    createdAt: (y.get("createdAt") as number) ?? 0,
    messages: ((y.get("messages") as Y.Array<CommentMessage> | undefined)?.toArray() ?? []).slice(),
  };
}

export function threadsForPage(doc: Y.Doc, pageId: string): Thread[] {
  const out: Thread[] = [];
  threadsOf(doc).forEach((y) => {
    if (y.get("pageId") === pageId) out.push(read(y));
  });
  return out.sort((a, b) => a.createdAt - b.createdAt);
}

export function allThreads(doc: Y.Doc): Thread[] {
  const out: Thread[] = [];
  threadsOf(doc).forEach((y) => out.push(read(y)));
  return out;
}

export function observeThreads(doc: Y.Doc, cb: () => void): () => void {
  const map = threadsOf(doc);
  map.observeDeep(cb);
  return () => map.unobserveDeep(cb);
}

export function startThread(doc: Y.Doc, input: { id: string; pageId: string; quote: string; body: string; author: CommentAuthor }): void {
  const y = new Y.Map<unknown>();
  const messages = new Y.Array<CommentMessage>();
  messages.push([{ id: createId(), body: input.body, at: Date.now(), author: input.author }]);
  doc.transact(() => {
    y.set("id", input.id);
    y.set("pageId", input.pageId);
    y.set("quote", input.quote.slice(0, 280));
    y.set("resolved", false);
    y.set("createdAt", Date.now());
    y.set("messages", messages);
    threadsOf(doc).set(input.id, y);
  });
}

export function reply(doc: Y.Doc, threadId: string, body: string, author: CommentAuthor): void {
  const messages = threadsOf(doc).get(threadId)?.get("messages") as Y.Array<CommentMessage> | undefined;
  messages?.push([{ id: createId(), body, at: Date.now(), author }]);
}

export function setResolved(doc: Y.Doc, threadId: string, resolved: boolean): void {
  threadsOf(doc).get(threadId)?.set("resolved", resolved);
}

export function deleteThread(doc: Y.Doc, threadId: string): void {
  threadsOf(doc).delete(threadId);
}

export function deleteMessage(doc: Y.Doc, threadId: string, messageId: string): void {
  const messages = threadsOf(doc).get(threadId)?.get("messages") as Y.Array<CommentMessage> | undefined;
  if (!messages) return;
  const i = messages.toArray().findIndex((m) => m.id === messageId);
  if (i >= 0) messages.delete(i, 1);
}
