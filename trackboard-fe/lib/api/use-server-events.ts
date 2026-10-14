"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { API_URL } from "@/lib/env";
import type { ServerEvent } from "./types";
import { keys } from "./keys";

/**
 * Live updates. The server sends a small event naming what changed; this only marks that data stale, and the query
 * cache refetches it through the normal permission checks. Mounted once, while someone is signed in.
 */
export function useServerEvents(enabled: boolean): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    // EventSource reconnects by itself after a drop, and the next event (or the focus refetch) catches up.
    const source = new EventSource(`${API_URL}/api/events`, { withCredentials: true });
    source.onmessage = (message) => {
      const event = JSON.parse(message.data) as ServerEvent;
      switch (event.type) {
        case "pages":
          void queryClient.invalidateQueries({ queryKey: keys.pages(event.workspaceId) });
          void queryClient.invalidateQueries({ queryKey: keys.workspaces });
          // Access changes (a share added, a page made private) also change what the sharing dialog shows.
          void queryClient.invalidateQueries({ queryKey: ["share"] });
          break;
        case "comments":
          void queryClient.invalidateQueries({ queryKey: keys.threads(event.pageId) });
          break;
        case "notifications":
          void queryClient.invalidateQueries({ queryKey: keys.notifications });
          break;
        case "members":
          void queryClient.invalidateQueries({ queryKey: keys.members(event.workspaceId) });
          void queryClient.invalidateQueries({ queryKey: keys.workspaceInvites(event.workspaceId) });
          void queryClient.invalidateQueries({ queryKey: keys.workspaces });
          break;
      }
    };
    return () => source.close();
  }, [enabled, queryClient]);
}
