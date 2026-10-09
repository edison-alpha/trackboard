import { createStore } from "@/lib/store";

/**
 * "Open this thread when the page is ready". The inbox sets it before navigating; the page reads it once its
 * document has loaded (it cannot open the comments panel earlier, the shell closes panels on every navigation).
 */
export const threadRequest = createStore<{ pageId: string; threadId: string } | null>(null);

export function requestThread(pageId: string, threadId: string): void {
  threadRequest.set({ pageId, threadId });
}
