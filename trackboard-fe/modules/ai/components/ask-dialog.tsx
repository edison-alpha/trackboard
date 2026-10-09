"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowRight, FileText, Restart, Stop } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MarkdownView } from "@/components/ui/markdown-view";
import { livePages, pageHref, usePages } from "@/modules/workspace";
import { useAiRun } from "../hooks/use-ai-run";
import { pickContext, type ContextPage } from "../lib/context";
import { AiAvatar, AiThinking } from "./ai-presence";

/** Ask a question about the workspace. The answer only uses the pages listed under it, and links to them. */
export function AskDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const pages = usePages();
  const { state, run, stop, retry, reset } = useAiRun();
  const [question, setQuestion] = useState("");
  const [sources, setSources] = useState<ContextPage[]>([]);

  const ask = (e?: FormEvent) => {
    e?.preventDefault();
    const q = question.trim();
    if (!q) return;
    const ctx = pickContext(livePages(pages), q);
    setSources(ctx);
    void run({ action: "ask", instruction: q, pages: ctx.map(({ id, title, text }) => ({ id, title, text })) });
  };

  const close = (o: boolean) => {
    if (!o) {
      stop();
      reset();
      setQuestion("");
      setSources([]);
    }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={close} title="Ask your pages" description="Answers come only from pages in this workspace, with links to where each point came from." className="sm:max-w-2xl">
      <form onSubmit={ask} className="flex gap-2 px-5 pb-4">
        <Input autoFocus value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="What did we decide about the launch date?" aria-label="Your question" />
        <Button type="submit" variant="primary" icon={<ArrowRight size={16} />} disabled={!question.trim() || state.status === "streaming"}>
          Ask
        </Button>
      </form>

      {state.status !== "idle" && (
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto border-t border-line px-5 py-4" aria-live="polite">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-ink-3">
            <AiAvatar thinking={state.status === "streaming"} size={24} />
            {state.status === "streaming" ? `Reading ${sources.length} ${sources.length === 1 ? "page" : "pages"}` : "Answer"}
            {state.status === "streaming" && <AiThinking state="searching" size={20} label="Searching your pages" />}
          </div>
          {state.text ? <MarkdownView markdown={state.text} /> : null}
          {state.status === "error" && (
            <p role="alert" className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
              {state.message}
            </p>
          )}
          {sources.length > 0 && state.status !== "streaming" && (
            <div className="mt-5">
              <p className="mb-1.5 text-xs font-medium text-ink-3">Based on</p>
              <ul className="flex flex-wrap gap-1.5">
                {sources.map((s) => (
                  <li key={s.id}>
                    <Link href={pageHref(s.id)} onClick={() => close(false)} className="inline-flex max-w-60 items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs text-ink-2 hover:text-ink">
                      <FileText size={13} />
                      <span className="truncate">{s.title}</span>
                      {s.partial && <span className="text-ink-3">(first part)</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {sources.length === 0 && state.status === "done" && <p className="mt-3 text-sm text-ink-3">There are no pages with text yet, so there was nothing to read.</p>}
        </div>
      )}

      {state.status !== "idle" && (
        <div className="flex gap-2 border-t border-line px-5 py-3">
          {state.status === "streaming" ? (
            <Button size="sm" variant="glass" icon={<Stop size={16} />} onClick={stop}>
              Stop
            </Button>
          ) : (
            <Button size="sm" variant="ghost" icon={<Restart size={15} />} onClick={retry}>
              Ask again
            </Button>
          )}
          <p className="ml-auto self-center text-[11px] text-ink-3">Sends the question and these pages to the AI service.</p>
        </div>
      )}
    </Dialog>
  );
}
