"use client";

import type { Editor } from "@tiptap/react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ArrowUp, CaretDown, CaretUp, Copy, FilePlus, Restart, Stop, X } from "@/components/icons";
import { Button, IconButton } from "@/components/ui/button";
import { KeyHint } from "@/components/ui/kbd";
import { MarkdownView } from "@/components/ui/markdown-view";
import { cx } from "@/lib/cx";
import { useAiChat, type ChatContext, type ChatEntry } from "../hooks/use-ai-chat";
import { useAiOpen } from "../lib/ai-store";
import { applyResult, pageMarkdown, selectionText } from "../lib/apply";
import { setDock, useDock } from "../lib/dock-store";
import { AiAvatar, AiThinking } from "./ai-presence";

const STARTERS = ["Summarize this page", "What is missing from this page?", "List the open questions", "Draft an introduction for this page"];

type Props = { editor: Editor | null; pageId: string; pageTitle: string };

/**
 * The AI dock: a conversation about the open page, floating at the bottom of the document.
 * Expanded shows the chat, minimized is a slim bar, hidden leaves a round button in the corner.
 * Every reply can go into the page: at the cursor, or in place of the text that was selected when asking.
 */
export function AiDock({ editor, pageId, pageTitle }: Props) {
  const mode = useDock();
  const inlineOpen = useAiOpen();
  const { messages, busy, send, stop, clear } = useAiChat(pageId);
  const [input, setInput] = useState("");
  const [usePage, setUsePage] = useState(true);
  const [selection, setSelection] = useState<ChatContext["selection"]>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Track the editor selection, so a question can be about the highlighted text.
  useEffect(() => {
    if (!editor) return;
    const read = () => {
      const { from, to, empty } = editor.state.selection;
      if (empty) return; // keep the last real selection while the person types in the dock
      setSelection({ text: selectionText(editor, { from, to }).slice(0, 8000), range: { from, to } });
    };
    editor.on("selectionUpdate", read);
    return () => void editor.off("selectionUpdate", read);
  }, [editor]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (mode === "expanded") requestAnimationFrame(() => inputRef.current?.focus());
  }, [mode]);

  const submit = (text = input, e?: FormEvent) => {
    e?.preventDefault();
    if (!text.trim() || busy) return;
    setDock("expanded");
    void send(text, { title: pageTitle, page: usePage && editor ? pageMarkdown(editor) : null, selection });
    setInput("");
  };

  const insert = (m: ChatEntry, how: "cursor" | "replace") => {
    if (!editor) return;
    if (how === "replace" && m.selection) applyResult(editor, "replace", m.content, m.selection);
    else {
      const { from } = editor.state.selection;
      applyResult(editor, "at-cursor", m.content, { from, to: from });
    }
    toast.success(how === "replace" ? "Selection replaced" : "Inserted into the page");
  };

  // The inline AI panel (Ctrl/⌘ J, toolbar) has the stage while it is open.
  if (inlineOpen) return null;

  if (mode === "hidden") {
    return (
      <div className="pointer-events-none sticky bottom-0 z-20 mt-auto flex justify-end px-4 pb-4" data-print-hide>
        <motion.button
          type="button"
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          onClick={() => setDock("expanded")}
          aria-label="Open AI (Alt+A)"
          title="Open AI (Alt+A)"
          className="pointer-events-auto flex size-14 items-center justify-center rounded-full transition-transform hover:scale-105 active:scale-95"
        >
          <AiAvatar size={48} />
        </motion.button>
      </div>
    );
  }

  const expanded = mode === "expanded";

  return (
    <div className="pointer-events-none sticky bottom-0 z-20 mt-auto px-4 pb-4" data-print-hide>
      <motion.section
        layout
        aria-label="AI assistant"
        transition={{ type: "spring", stiffness: 420, damping: 38 }}
        className="floating pointer-events-auto mx-auto flex w-full max-w-[680px] flex-col overflow-hidden rounded-(--radius-card)"
      >
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div key="chat" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: "easeOut" }}>
              <header className="flex items-center gap-2 border-b border-line px-4 py-2.5">
                <AiAvatar thinking={busy} size={26} />
                <p className="flex-1 text-sm font-semibold">Trackboard AI</p>
                {messages.length > 0 && (
                  <IconButton label="New conversation" size="sm" onClick={clear}>
                    <Restart size={16} />
                  </IconButton>
                )}
                <IconButton label="Minimize" size="sm" onClick={() => setDock("minimized")}>
                  <CaretDown size={14} />
                </IconButton>
                <IconButton label="Hide AI (Alt+A to bring it back)" size="sm" onClick={() => setDock("hidden")}>
                  <X size={16} />
                </IconButton>
              </header>

              <div ref={listRef} className="thin-scroll max-h-[min(48dvh,440px)] overflow-y-auto px-4 py-3" aria-live="polite">
                {messages.length === 0 ? (
                  <div className="py-2">
                    <p className="text-sm text-ink-2">Ask about this page, or have AI write something for it. Replies can go straight into the page.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {STARTERS.map((s) => (
                        <button key={s} type="button" onClick={() => submit(s)} className="rounded-full bg-surface-2 px-3 py-1.5 text-[13px] text-ink-2 transition-colors hover:bg-surface-3 hover:text-ink pointer-coarse:py-2.5">
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <ol className="grid gap-4">
                    {messages.map((m) => (
                      <li key={m.id} className={cx("flex", m.role === "user" && "justify-end")}>
                        {m.role === "user" ? (
                          <p className="max-w-[85%] rounded-[18px] rounded-br-md bg-accent px-3.5 py-2 text-[15px] whitespace-pre-wrap text-on-accent">{m.content}</p>
                        ) : (
                          <div className="min-w-0 flex-1">
                            {m.content ? (
                              <MarkdownView markdown={m.content} />
                            ) : m.status === "streaming" ? (
                              <span className="flex items-center gap-2 text-sm text-ink-3">
                                <AiThinking state="composing" size={20} label="AI is thinking" /> Thinking…
                              </span>
                            ) : null}
                            {m.status === "error" && (
                              <p role="alert" className="mt-2 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
                                {m.error}
                              </p>
                            )}
                            {m.status === "done" && m.content && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                <Button size="sm" variant="glass" icon={<FilePlus size={15} />} onClick={() => insert(m, "cursor")} disabled={!editor}>
                                  Insert at cursor
                                </Button>
                                {m.selection && (
                                  <Button size="sm" variant="glass" onClick={() => insert(m, "replace")} disabled={!editor}>
                                    Replace selection
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  icon={<Copy size={15} />}
                                  onClick={() => navigator.clipboard.writeText(m.content).then(() => toast.success("Copied"), () => toast.error("Couldn't copy"))}
                                >
                                  Copy
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {expanded && (
          <div className="flex flex-wrap items-center gap-1.5 px-4 pt-2">
            <button
              type="button"
              aria-pressed={usePage}
              onClick={() => setUsePage((v) => !v)}
              className={cx("rounded-full px-2.5 py-1 text-xs font-medium transition-colors", usePage ? "bg-accent-soft text-accent-ink" : "bg-surface-2 text-ink-3 line-through")}
              title={usePage ? "The page is sent with your message" : "The page is not sent"}
            >
              This page
            </button>
            {selection && (
              <span className="inline-flex max-w-72 items-center gap-1 rounded-full bg-surface-2 py-1 pr-1 pl-2.5 text-xs text-ink-2">
                <span className="truncate">Selection: “{selection.text.slice(0, 60)}”</span>
                <button type="button" aria-label="Don't send the selection" onClick={() => setSelection(null)} className="flex size-5 items-center justify-center rounded-full hover:bg-surface-3">
                  <X size={12} />
                </button>
              </span>
            )}
          </div>
        )}

        <form onSubmit={(e) => submit(input, e)} className="flex items-end gap-2 px-3 py-2.5">
          {!expanded && <AiAvatar thinking={busy} size={26} className="mb-1" />}
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
              if (e.key === "Escape") setDock("minimized");
            }}
            placeholder={expanded ? "Ask anything, or describe what to write" : "Ask AI about this page"}
            aria-label="Message to AI"
            className="max-h-40 min-h-9 flex-1 resize-none bg-transparent py-1.5 pl-1 text-[15px] leading-6 text-ink outline-none placeholder:text-ink-3"
          />
          {!expanded && <KeyHint keys="Alt+A" className="mb-2.5 hidden sm:inline" />}
          {busy ? (
            <IconButton label="Stop" onClick={stop} className="mb-0.5">
              <Stop size={18} />
            </IconButton>
          ) : (
            <button type="submit" aria-label="Send" disabled={!input.trim()} className="mb-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent transition-opacity disabled:opacity-35 pointer-coarse:size-11">
              <ArrowUp size={18} />
            </button>
          )}
          {!expanded && (
            <>
              <IconButton label="Open conversation" onClick={() => setDock("expanded")} className="mb-0.5">
                <CaretUp size={14} />
              </IconButton>
              <IconButton label="Hide AI (Alt+A to bring it back)" onClick={() => setDock("hidden")} className="mb-0.5">
                <X size={16} />
              </IconButton>
            </>
          )}
        </form>
        {expanded && <p className="px-4 pb-2.5 text-[11px] text-ink-3">Sends your messages{usePage ? ", this page" : ""}{selection ? " and the selection" : ""} to the AI service.</p>}
      </motion.section>
    </div>
  );
}
