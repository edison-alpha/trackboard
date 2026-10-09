"use client";

import type { Editor } from "@tiptap/react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Restart, Stop } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { MarkdownView } from "@/components/ui/markdown-view";
import { cx } from "@/lib/cx";
import { useAiRun } from "../hooks/use-ai-run";
import { AI_ACTIONS, CUSTOM_ACTION, MAX_INPUT_CHARS, actionsFor, type AiAction, type AiApply, type AiRequest } from "../lib/actions";
import { closeAi, useAiOpen } from "../lib/ai-store";
import { AiAvatar, AiThinking, orbStateFor } from "./ai-presence";
import { applyResult, pageMarkdown, selectionText, textBefore, type Range } from "../lib/apply";

type Props = { editor: Editor; pageTitle: string; onTitle: (title: string) => void };

const PANEL_W = 560;

const PLACEHOLDER = {
  selection: "Tell AI what to do with the selection",
  write: "Ask AI to write something",
  page: "Tell AI what to change",
} as const;

const APPLY_LABEL: Record<AiApply, string> = {
  replace: "Replace selection",
  "insert-below": "Insert below",
  "at-cursor": "Insert",
  "page-top": "Add to top of page",
  "page-end": "Add to end of page",
  "replace-page": "Replace page content",
  title: "Use this title",
  none: "Close",
};

/** Where the panel sits: under the selection or caret, or docked at the bottom for page actions. */
function usePanelPosition(editor: Editor, range: Range | null, docked: boolean) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const measure = useCallback(() => {
    if (!range || docked) return setPos(null);
    try {
      const start = editor.view.coordsAtPos(range.from);
      const end = editor.view.coordsAtPos(range.to);
      const left = Math.min(Math.max(12, start.left - 8), window.innerWidth - Math.min(PANEL_W, window.innerWidth - 24) - 12);
      setPos({ top: end.bottom + 10, left });
    } catch {
      setPos(null);
    }
  }, [editor, range, docked]);

  useLayoutEffect(() => {
    measure();
    const scroller = document.getElementById("tb-scroll");
    scroller?.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      scroller?.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [measure]);
  return pos;
}

/**
 * The AI panel for one editor. Opened from the bubble menu ("Ask AI"), the slash menu, Ctrl/⌘ + J,
 * or the page menu. Nothing changes in the document until the person accepts a result.
 */
export function AiComposer({ editor, pageTitle, onTitle }: Props) {
  const open = useAiOpen();
  const { state, run, stop, retry, reset } = useAiRun();
  const [input, setInput] = useState("");
  const [active, setActive] = useState(0);
  const [current, setCurrent] = useState<AiAction | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const range = open?.range ?? null;
  const docked = open?.scope === "page";
  const pos = usePanelPosition(editor, range, docked);

  const actions = useMemo(() => {
    if (!open) return [];
    const list = actionsFor(open.scope);
    const q = input.trim().toLowerCase();
    return q ? list.filter((a) => a.label.toLowerCase().includes(q)) : list;
  }, [open, input]);

  const buildRequest = useCallback(
    (action: AiAction, instruction?: string, refineFrom?: string): AiRequest | string => {
      if (!open) return "Nothing is open.";
      const r = open.range;
      if (refineFrom !== undefined) return { action: "custom-edit", text: refineFrom, instruction };
      switch (action.scope) {
        case "selection": {
          const text = selectionText(editor, r);
          if (!text.trim()) return "Select some text first.";
          return { action: action.id, text, instruction };
        }
        case "write":
          return { action: action.id, instruction, title: pageTitle, before: textBefore(editor, r.from) };
        case "page": {
          const text = pageMarkdown(editor);
          if (!text.trim() && action.id !== "suggest-title") return "This page is empty, so there is nothing to work with yet.";
          return { action: action.id, text, title: pageTitle };
        }
        default:
          return "This action isn't available here.";
      }
    },
    [open, editor, pageTitle],
  );

  const [localError, setLocalError] = useState("");
  const start = useCallback(
    (action: AiAction, instruction?: string, refineFrom?: string) => {
      const req = buildRequest(action, instruction, refineFrom);
      if (typeof req === "string") return setLocalError(req);
      const size = (req.text?.length ?? 0) + (req.before?.length ?? 0) + (req.instruction?.length ?? 0);
      if (size > MAX_INPUT_CHARS) return setLocalError("That's too much text for one AI request. Select a smaller part and try again.");
      setLocalError("");
      // A refinement keeps the original action, so the result still lands where it was meant to.
      if (refineFrom === undefined) setCurrent(action);
      setInput("");
      void run(req);
    },
    [buildRequest, run],
  );

  // Fresh state for each opening; presets start immediately.
  useEffect(() => {
    if (!open) return;
    reset();
    setInput("");
    setActive(0);
    setCurrent(null);
    setLocalError("");
    if (open.preset) {
      const preset = AI_ACTIONS.find((a) => a.id === open.preset);
      if (preset) start(preset);
    } else {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open?.key]);

  const close = useCallback(() => {
    stop();
    reset();
    closeAi();
    editor.commands.focus();
  }, [stop, reset, editor]);

  // Escape closes the panel wherever focus is (editor, panel, or nowhere yet).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  const accept = () => {
    if (!open || !current || state.status !== "done") return;
    if (current.apply === "title") onTitle(state.text.split("\n")[0]?.replace(/^#+\s*/, "").trim() ?? "");
    else applyResult(editor, current.apply, state.text, open.range);
    reset();
    closeAi();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") return (e.preventDefault(), close());
    const listVisible = state.status === "idle";
    if (listVisible && e.key === "ArrowDown") return (e.preventDefault(), setActive((a) => Math.min(a + 1, actions.length - 1)));
    if (listVisible && e.key === "ArrowUp") return (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)));
    if (e.key !== "Enter") return;
    e.preventDefault();
    const typed = input.trim();
    if (state.status === "done" && typed) return start(current ?? CUSTOM_ACTION.selection, typed, state.text);
    if (!open) return;
    // Typed text that isn't an action name is a free instruction; otherwise run the highlighted action.
    const exact = actions.find((a) => a.label.toLowerCase() === typed.toLowerCase());
    if (typed && !exact && open.scope !== "page") return start(CUSTOM_ACTION[open.scope], typed);
    const pick = exact ?? actions[active];
    if (pick) start(pick);
  };

  if (typeof document === "undefined") return null;

  const busy = state.status === "streaming";
  const hasResult = state.status !== "idle";
  const title = current?.label ?? (open?.scope === "write" ? "Write with AI" : "Ask AI");

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="ai-composer"
          role="dialog"
          aria-label="Ask AI"
          initial={{ opacity: 0, y: 6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.98 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          className={cx(
            "floating fixed z-50 flex max-h-[min(70dvh,560px)] w-[min(560px,calc(100vw-24px))] flex-col overflow-hidden rounded-(--radius-card) text-ink",
            (docked || !pos) && "inset-x-0 bottom-6 mx-auto",
          )}
          style={!docked && pos ? { top: Math.min(pos.top, window.innerHeight - 260), left: pos.left } : undefined}
          data-print-hide
        >
          <AnimatePresence initial={false} mode="wait">
          {hasResult && (
            <motion.div
              key="ai-result"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="thin-scroll min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-2"
              aria-live="polite"
            >
              <p className="mb-2 flex items-center gap-2 text-xs font-medium text-ink-3">
                <AiAvatar thinking={busy} size={22} />
                {title}
                {busy && <AiThinking state={orbStateFor(current?.id)} size={20} label="AI is working" />}
              </p>
              {state.text ? (
                <MarkdownView markdown={state.text} />
              ) : busy ? (
                <div className="flex items-center gap-3 py-2 text-sm text-ink-3">
                  <AiThinking state={orbStateFor(current?.id)} size={32} label="AI is thinking" />
                  Thinking…
                </div>
              ) : null}
              {state.status === "error" && (
                <p role="alert" className="mt-2 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
                  {state.message}
                </p>
              )}
              {state.status === "done" && state.cut && <p className="mt-2 text-xs text-ink-3">Stopped before the end. Insert what's there, or try again.</p>}
            </motion.div>
          )}

          {hasResult && (
            <motion.div
              key="ai-result-actions"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, delay: 0.04, ease: "easeOut" }}
              className="flex flex-wrap items-center gap-2 border-t border-line px-3 py-2.5"
            >
              {busy ? (
                <Button size="sm" variant="glass" icon={<Stop size={16} />} onClick={stop}>
                  Stop
                </Button>
              ) : state.status === "done" ? (
                <>
                  {current?.apply !== "none" && (
                    <Button size="sm" variant="primary" onClick={accept} disabled={!state.text}>
                      {current ? APPLY_LABEL[current.apply] : "Insert"}
                    </Button>
                  )}
                  {current?.apply === "replace" && (
                    <Button size="sm" variant="glass" onClick={() => (applyResult(editor, "insert-below", state.text, open.range), reset(), closeAi())}>
                      Insert below
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" icon={<Restart size={15} />} onClick={retry}>
                    Try again
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="glass" icon={<Restart size={15} />} onClick={retry}>
                  Try again
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={close} className="ml-auto">
                Discard
              </Button>
            </motion.div>
          )}
          </AnimatePresence>

          {!busy && (
            <div className={cx("flex items-center gap-2 px-4", hasResult ? "border-t border-line py-2" : "py-3")}>
              <AiAvatar size={24} />
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onKeyDown}
                placeholder={state.status === "done" ? "Tell AI what to change in this result" : open.scope === "page" ? "Choose an action below" : PLACEHOLDER[open.scope]}
                aria-label="Instruction for AI"
                className="h-9 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
              />
              {input.trim() && (
                <button
                  type="button"
                  aria-label="Send to AI"
                  onClick={() => onKeyDown({ key: "Enter", preventDefault() {} } as KeyboardEvent<HTMLInputElement>)}
                  className="flex size-8 items-center justify-center rounded-full bg-accent text-on-accent pointer-coarse:size-10"
                >
                  <ArrowRight size={16} />
                </button>
              )}
            </div>
          )}

          {localError && (
            <p role="alert" className="mx-4 mb-3 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
              {localError}
            </p>
          )}

          {state.status === "idle" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="thin-scroll max-h-72 overflow-y-auto border-t border-line p-1.5"
              role="listbox"
              aria-label="AI actions"
            >
              {actions.length === 0 && <p className="px-3 py-2.5 text-sm text-ink-3">Press Enter to send your instruction.</p>}
              {actions.map((a, i) => {
                const showGroup = i === 0 || actions[i - 1]?.group !== a.group;
                return (
                  <div key={a.id}>
                    {showGroup && <p className="px-3 pt-2 pb-1 text-xs font-medium text-ink-3">{a.group}</p>}
                    <button
                      type="button"
                      role="option"
                      aria-selected={i === active}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => start(a)}
                      className={cx("flex h-9 w-full items-center rounded-(--radius-row) px-3 text-left text-sm pointer-coarse:h-11", i === active && "bg-surface-2/90")}
                    >
                      {a.label}
                    </button>
                  </div>
                );
              })}
            </motion.div>
          )}

          <p className="border-t border-line px-4 py-2 text-[11px] text-ink-3">
            {open.scope === "page" ? "Sends this page" : open.scope === "write" ? "Sends the page title and the text above the cursor" : "Sends the selected text"} to the AI service. Nothing changes until you accept.
          </p>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
