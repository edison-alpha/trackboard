"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createId } from "@/lib/id";
import { safeStorage } from "@/lib/store";
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

const KEEP = 40;
const keyFor = (pageId: string) => `tb:ai-chat:${pageId}`;

function load(pageId: string): ChatEntry[] {
  try {
    const list = JSON.parse(safeStorage.get(keyFor(pageId)) ?? "[]") as ChatEntry[];
    return list.filter((m) => m.status !== "streaming");
  } catch {
    return [];
  }
}

/** A conversation per page, kept in this browser. Streams replies and can be stopped or cleared. */
export function useAiChat(pageId: string) {
  const [messages, setMessages] = useState<ChatEntry[]>(() => load(pageId));
  const controller = useRef<AbortController | null>(null);

  useEffect(() => setMessages(load(pageId)), [pageId]);
  useEffect(() => {
    if (messages.every((m) => m.status !== "streaming")) safeStorage.set(keyFor(pageId), JSON.stringify(messages.slice(-KEEP)));
  }, [messages, pageId]);
  useEffect(() => () => controller.current?.abort(), []);

  const busy = messages.some((m) => m.status === "streaming");

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
      setMessages((list) => [...list, user, reply]);

      const update = (patch: Partial<ChatEntry>) => setMessages((list) => list.map((m) => (m.id === reply.id ? { ...m, ...patch } : m)));
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
      }
    },
    [busy, messages],
  );

  const stop = useCallback(() => controller.current?.abort(), []);
  const clear = useCallback(() => {
    controller.current?.abort();
    setMessages([]);
  }, []);

  return { messages, busy, send, stop, clear };
}
