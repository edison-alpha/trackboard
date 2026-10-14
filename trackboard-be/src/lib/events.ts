import type { ServerEvent } from "@trackboard/api-types";
import { db } from "./db/client.ts";

/*
 * Live updates. The app keeps its data in a query cache; when something changes here, the people it concerns get a
 * small event naming what to refetch, and the refetch goes through the normal permission checks. Events carry no data,
 * so a stale or over-broad audience can never leak a private page.
 */

type Listener = (event: ServerEvent) => void;
const listeners = new Map<string, Set<Listener>>();

export function subscribe(userId: string, fn: Listener): () => void {
  let set = listeners.get(userId);
  if (!set) listeners.set(userId, (set = new Set()));
  set.add(fn);
  return () => {
    set!.delete(fn);
    if (set!.size === 0) listeners.delete(userId);
  };
}

export function publish(userIds: Iterable<string>, event: ServerEvent): void {
  for (const id of new Set(userIds)) listeners.get(id)?.forEach((fn) => fn(event));
}

/** Everyone who could be affected by a change to this page: its creator, the people it is shared with, and, when the page is shared with the workspace, every member. */
export async function pageAudience(pageId: string): Promise<string[]> {
  const rows = await (await db()).query<{ id: string }>(
    `select created_by as id from pages where id = $1
     union select user_id from page_shares where page_id = $1
     union select m.user_id from workspace_members m join pages p on p.workspace_id = m.workspace_id where p.id = $1 and p.visibility = 'workspace'`,
    [pageId],
  );
  return rows.map((r) => r.id);
}

export async function workspaceMembers(workspaceId: string): Promise<string[]> {
  return (await (await db()).query<{ user_id: string }>("select user_id from workspace_members where workspace_id = $1", [workspaceId])).map((r) => r.user_id);
}

/** The page list changed for everyone who can see this page. */
export async function publishPages(pageId: string, workspaceId: string): Promise<void> {
  publish(await pageAudience(pageId), { type: "pages", workspaceId });
}

export async function publishComments(pageId: string): Promise<void> {
  publish(await pageAudience(pageId), { type: "comments", pageId });
}

/* The collab server registers how to drop the live sessions of one document, so access changes take effect at once. */
let closer: ((documentName: string) => void) | undefined;
export const onCloseDocument = (fn: (documentName: string) => void) => void (closer = fn);
export const closeDocument = (documentName: string) => closer?.(documentName);

const KEEP_ALIVE_MS = 25_000;

/** A text/event-stream for one person, closed when they leave. */
export function eventStream(userId: string, signal: AbortSignal): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let cleanup = () => {};
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };
      const unsubscribe = subscribe(userId, (event) => send(`data: ${JSON.stringify(event)}\n\n`));
      // A comment line keeps proxies from closing a quiet connection.
      const timer = setInterval(() => send(": keep-alive\n\n"), KEEP_ALIVE_MS);
      cleanup = () => {
        clearInterval(timer);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      signal.addEventListener("abort", cleanup, { once: true });
      send("retry: 3000\n\n");
    },
    cancel() {
      cleanup();
    },
  });
}
