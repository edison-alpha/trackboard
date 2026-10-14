"use client";

import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/api/keys";
import type { CommentMessage, Thread } from "@/lib/api/types";

export type { CommentMessage, Thread };

export const threadsQuery = (pageId: string) =>
  queryOptions({
    queryKey: keys.threads(pageId),
    queryFn: async (): Promise<Thread[]> => (await api<{ threads: Thread[] }>(`/api/pages/${pageId}/threads`)).threads,
  });

const NONE: Thread[] = [];

/** Threads of one page. Collaborators' comments arrive through the live event stream. */
export function useThreads(pageId: string): Thread[] {
  return useQuery(threadsQuery(pageId)).data ?? NONE;
}

/** Everything a person can do to the comments of one page; each refetches the thread list when it settles. */
export function useThreadActions(pageId: string) {
  const queryClient = useQueryClient();
  const key = keys.threads(pageId);
  const settle = () => queryClient.invalidateQueries({ queryKey: key });
  const adopt = (thread: Thread) => queryClient.setQueryData<Thread[]>(key, (list = []) => [...list.filter((t) => t.id !== thread.id), thread]);

  const start = useMutation({
    mutationFn: (v: { id: string; quote: string; body: string }) => api<Thread>(`/api/pages/${pageId}/threads`, { body: v }),
    onSuccess: adopt,
    onSettled: settle,
  });
  const reply = useMutation({
    mutationFn: (v: { threadId: string; body: string }) => api<CommentMessage>(`/api/threads/${v.threadId}/replies`, { body: { body: v.body } }),
    onSettled: settle,
  });
  const resolve = useMutation({
    mutationFn: (v: { threadId: string; resolved: boolean }) => api(`/api/threads/${v.threadId}`, { method: "PATCH", body: { resolved: v.resolved } }),
    onMutate: async (v) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Thread[]>(key);
      queryClient.setQueryData<Thread[]>(key, (list = []) => list.map((t) => (t.id === v.threadId ? { ...t, resolved: v.resolved } : t)));
      return { previous };
    },
    onError: (_e, _v, ctx) => ctx?.previous && queryClient.setQueryData(key, ctx.previous),
    onSettled: settle,
  });
  const removeThread = useMutation({
    mutationFn: (threadId: string) => api(`/api/threads/${threadId}`, { method: "DELETE" }),
    onMutate: async (threadId) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Thread[]>(key);
      queryClient.setQueryData<Thread[]>(key, (list = []) => list.filter((t) => t.id !== threadId));
      return { previous };
    },
    onError: (_e, _v, ctx) => ctx?.previous && queryClient.setQueryData(key, ctx.previous),
    onSettled: settle,
  });
  const removeMessage = useMutation({
    mutationFn: (messageId: string) => api(`/api/messages/${messageId}`, { method: "DELETE" }),
    onSettled: settle,
  });

  return { start, reply, resolve, removeThread, removeMessage };
}
