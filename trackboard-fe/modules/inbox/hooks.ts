"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/api/keys";
import type { MentionResult, Notification, NotificationList } from "@/lib/api/types";

export type InboxEntry = Notification & { unread: boolean };

/** The signed-in person's notifications and which are unread. The server keeps both, so every device agrees. */
export function useInbox() {
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: keys.notifications, queryFn: () => api<NotificationList>("/api/notifications") });

  const read = useMutation({
    mutationFn: (v: { ids?: string[]; all?: boolean }) => api("/api/notifications/read", { body: v }),
    onMutate: async (v) => {
      await queryClient.cancelQueries({ queryKey: keys.notifications });
      const previous = queryClient.getQueryData<NotificationList>(keys.notifications);
      if (previous) {
        const items = previous.items.map((i) => (v.all || v.ids?.includes(i.id) ? { ...i, read: true } : i));
        queryClient.setQueryData<NotificationList>(keys.notifications, { items, unread: items.filter((i) => !i.read).length });
      }
      return { previous };
    },
    onError: (_e, _v, ctx) => ctx?.previous && queryClient.setQueryData(keys.notifications, ctx.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.notifications }),
  });

  const items = useMemo<InboxEntry[]>(() => (list.data?.items ?? []).map((i) => ({ ...i, unread: !i.read })), [list.data]);
  return {
    items,
    unread: list.data?.unread ?? 0,
    markRead: (ids: string[]) => read.mutate({ ids }),
    markAllRead: () => read.mutate({ all: true }),
  };
}

/** Tells the people named with @ that they were mentioned. The result lists anyone who cannot open the page yet. */
export function useAnnounceMentions(pageId: string) {
  return useMutation({
    mutationFn: (userIds: string[]) => api<MentionResult>(`/api/pages/${pageId}/mentions`, { body: { userIds } }),
  });
}
