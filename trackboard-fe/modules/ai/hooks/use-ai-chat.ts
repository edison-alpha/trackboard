"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/api/keys";
import { createId } from "@/lib/id";
import { CHAT_HISTORY, MAX_INPUT_CHARS, type ChatMessage } from "../lib/actions";
import type { Range } from "../lib/apply";
import { AiError, streamAi } from "../lib/stream";

export type ChatEntry = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "streaming" | "done" | "error";
  error?: string;
  /** The selection the question was about, so "Replace selection" knows where to write. */
  selection?: Range;
};

export type ChatContext = { title: string; page: string | null; selection: { text: string; range: Range } | null };

const NONE: ChatEntry[] = [];

/**
 * A conversation per person and page, kept on the server so it follows them to any device. The query cache is the one
 * place the messages live: a reply streams into it, and when it finishes the whole conversation is saved.
 */
export function useAiChat(pageId: string) {
  const queryClient = useQueryClient();
  const key = keys.chat(pageId);
  const controller = useRef<AbortController | null>(null);

  const saved = useQuery({
    queryKey: key,
    queryFn: async () => (await api<{ messages: ChatEntry[] }>(`/api/pages/${pageId}/chat`)).messages.filter((m) => m.status !== "streaming"),
    // The cache is edited while a reply streams, so a background refetch must never replace it.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const messages = saved.data ?? NONE;
  const busy = messages.some((m) => m.status === "streaming");

  const edit = useCallback((change: (list: ChatEntry[]) => ChatEntry[]) => queryClient.setQueryData<ChatEntry[]>(key, (list = NONE) => change(list)), [queryClient, key]);

  const save = useMutation({
    mutationFn: (list: ChatEntry[]) => api(`/api/pages/${pageId}/chat`, { method: "PUT", body: { messages: list } }),
    // Losing a saved conversation is a nuisance, not an error worth interrupting the writer for.
    onError: () => undefined,
  });
  const wipe = useMutation({ mutationFn: () => api(`/api/pages/${pageId}/chat`, { method: "DELETE" }) });

  // Leaving the page stops a reply that is still coming in.
  useEffect(() => () => controller.current?.abort(), []);

  const send = useCallback(
    async (content: string, ctx: ChatContext) => {
      const text = content.trim();
      if (!text || busy) return;
      const user: ChatEntry = { id: createId(), role: "user", content: text, status: "done", selection: ctx.selection?.range };
      const reply: ChatEntry = { id: createId(), role: "assistant", content: "", status: "streaming", selection: ctx.selection?.range };
      const history: ChatMessage[] = [...messages, user]
        .filter((m) => m.status === "done" && m.content)
        .slice(-CHAT_HISTORY)
        .map(({ role, content: c }) => ({ role, content: c }));
      edit((list) => [...list, user, reply]);

      const update = (patch: Partial<ChatEntry>) => edit((list) => list.map((m) => (m.id === reply.id ? { ...m, ...patch } : m)));
      const page = ctx.page && ctx.page.length > MAX_INPUT_CHARS / 2 ? ctx.page.slice(0, MAX_INPUT_CHARS / 2) : ctx.page;

      controller.current?.abort();
      const ac = new AbortController();
      controller.current = ac;
      let acc = "";
      try {
        for await (const e of streamAi({ action: "chat", messages: history, title: ctx.title, text: page ?? undefined, before: ctx.selection?.text }, ac.signal)) {
          if (e.t === "delta") update({ content: (acc += e.v) });
          else if (e.t === "done") update({ content: acc.trim(), status: "done" });
          else update({ status: "error", error: e.message });
        }
      } catch (err) {
        if (!ac.signal.aborted) update({ status: "error", error: err instanceof AiError ? err.message : "Something went wrong. Try again." });
      } finally {
        if (ac.signal.aborted) update({ status: "done", content: acc.trim() });
        if (controller.current === ac) controller.current = null;
        // The conversation is saved once the reply is finished, whichever way it ended.
        save.mutate((queryClient.getQueryData<ChatEntry[]>(key) ?? NONE).filter((m) => m.status !== "streaming"));
      }
    },
    [busy, messages, edit, save, queryClient, key],
  );

  const stop = useCallback(() => controller.current?.abort(), []);
  const clear = useCallback(() => {
    controller.current?.abort();
    queryClient.setQueryData<ChatEntry[]>(key, []);
    wipe.mutate();
  }, [queryClient, key, wipe]);

  return { messages, busy, send, stop, clear };
}
