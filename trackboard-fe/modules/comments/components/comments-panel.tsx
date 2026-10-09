"use client";

import { ArrowCounterClockwise, CheckCircle, DotsThree, Trash } from "@/components/icons";
import type { Editor } from "@tiptap/react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button, IconButton } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { SidePanel } from "@/components/ui/side-panel";
import { EmptyState } from "@/components/ui/states";
import { cx } from "@/lib/cx";
import { hasMod } from "@/lib/platform";
import { timeAgo } from "@/lib/time";
import { useWorkspace } from "@/modules/workspace";
import { useThreads } from "../hooks";
import * as threads from "../lib/threads";

export type CommentDraft = { threadId: string; quote: string };

type Props = {
  open: boolean;
  onClose: () => void;
  pageId: string;
  editor: Editor | null;
  draft: CommentDraft | null;
  onDraftDone: () => void;
  activeId: string | null;
  onActivate: (id: string | null) => void;
};

function Composer({ placeholder, submitLabel, autoFocus, onSubmit, onCancel }: { placeholder: string; submitLabel: string; autoFocus?: boolean; onSubmit: (body: string) => void; onCancel?: () => void }) {
  const [body, setBody] = useState("");
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!body.trim()) return;
    onSubmit(body.trim());
    setBody("");
  };
  return (
    <form onSubmit={submit} className="grid gap-2">
      <Textarea
        autoFocus={autoFocus}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && hasMod(e)) submit();
          if (e.key === "Escape" && onCancel) {
            e.preventDefault();
            onCancel();
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        rows={2}
      />
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button size="sm" type="submit" variant="primary" disabled={!body.trim()}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

/** Discussion threads anchored to text in this page. */
export function CommentsPanel({ open, onClose, pageId, editor, draft, onDraftDone, activeId, onActivate }: Props) {
  const { doc, profile } = useWorkspace();
  const list = useThreads(pageId);
  const [showResolved, setShowResolved] = useState(false);
  const activeRef = useRef<HTMLLIElement>(null);
  const author = { id: profile.id, name: profile.name, color: profile.color };

  const openThreads = list.filter((t) => !t.resolved);
  const resolved = list.filter((t) => t.resolved);
  const visible = showResolved ? resolved : openThreads;

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeId]);

  // Highlight the anchored text of the active thread.
  useEffect(() => {
    const root = editor?.view.dom;
    if (!root) return;
    root.querySelectorAll(".tb-comment.is-active").forEach((el) => el.classList.remove("is-active"));
    if (activeId) root.querySelectorAll(`[data-thread="${activeId}"]`).forEach((el) => el.classList.add("is-active"));
  }, [activeId, editor, list]);

  const cancelDraft = () => {
    if (draft) editor?.commands.unsetCommentThread(draft.threadId);
    onDraftDone();
  };

  const resolve = (id: string, value: boolean) => {
    threads.setResolved(doc, id, value);
    editor?.commands.setCommentResolved(id, value);
  };

  const remove = (id: string) => {
    threads.deleteThread(doc, id);
    editor?.commands.unsetCommentThread(id);
    if (activeId === id) onActivate(null);
  };

  return (
    <SidePanel
      open={open}
      onClose={() => {
        if (draft) cancelDraft();
        onClose();
      }}
      title="Comments"
      actions={
        <div className="flex rounded-full bg-surface-2 p-0.5 text-xs font-medium" role="tablist" aria-label="Filter comments">
          {[
            { v: false, label: `Open ${openThreads.length}` },
            { v: true, label: `Resolved ${resolved.length}` },
          ].map((t) => (
            <button
              key={t.label}
              role="tab"
              aria-selected={showResolved === t.v}
              onClick={() => setShowResolved(t.v)}
              className={cx("h-7 rounded-full px-3 transition-colors pointer-coarse:h-9", showResolved === t.v ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink")}
            >
              {t.label}
            </button>
          ))}
        </div>
      }
    >
      {draft && !showResolved && (
        <div className="border-b border-line p-4">
          <blockquote className="mb-3 line-clamp-3 border-l-2 border-line-strong pl-3 text-sm text-ink-2">{draft.quote}</blockquote>
          <Composer
            autoFocus
            placeholder="Write a comment"
            submitLabel="Send"
            onCancel={cancelDraft}
            onSubmit={(body) => {
              threads.startThread(doc, { id: draft.threadId, pageId, quote: draft.quote, body, author });
              onActivate(draft.threadId);
              onDraftDone();
            }}
          />
        </div>
      )}

      {visible.length === 0 && !draft ? (
        <EmptyState
          title={showResolved ? "No resolved threads" : "No comments yet"}
          body={showResolved ? "Threads you mark as resolved move here." : "Select text on the page, then press the comment icon in the toolbar to start a thread on it."}
        />
      ) : (
        <ul className="divide-y divide-line">
          <AnimatePresence initial={false}>
            {visible.map((t) => (
              <motion.li
                key={t.id}
                ref={t.id === activeId ? activeRef : undefined}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className={cx("overflow-hidden", t.id === activeId && "bg-accent-soft/40")}
              >
                <div className="cursor-pointer p-4" onClick={() => onActivate(t.id)}>
                  <div className="flex items-start gap-2">
                    <blockquote className="line-clamp-2 flex-1 border-l-2 border-line-strong pl-3 text-sm text-ink-2">{t.quote || "The commented text was deleted"}</blockquote>
                    <IconButton size="sm" label={t.resolved ? "Reopen" : "Resolve"} onClick={() => resolve(t.id, !t.resolved)}>
                      {t.resolved ? <ArrowCounterClockwise size={16} /> : <CheckCircle size={16} />}
                    </IconButton>
                    <Menu>
                      <MenuTrigger asChild>
                        <IconButton size="sm" label="Thread options">
                          <DotsThree size={18} weight="bold" />
                        </IconButton>
                      </MenuTrigger>
                      <MenuContent align="end">
                        <MenuItem danger icon={<Trash size={16} />} onSelect={() => remove(t.id)}>
                          Delete thread
                        </MenuItem>
                      </MenuContent>
                    </Menu>
                  </div>
                  <ol className="mt-3 grid gap-3">
                    {t.messages.map((m) => (
                      <li key={m.id} className="group flex gap-2.5">
                        <Avatar name={m.author.name} color={m.author.color} size={26} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px]">
                            <span className="font-semibold text-ink">{m.author.name}</span>
                            <span className="ml-2 text-ink-3">{timeAgo(m.at)}</span>
                          </p>
                          <p className="mt-0.5 text-sm leading-relaxed whitespace-pre-wrap text-ink">{m.body}</p>
                        </div>
                        {m.author.id === profile.id && t.messages.length > 1 && (
                          <IconButton
                            size="sm"
                            label="Delete reply"
                            className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
                            onClick={() => threads.deleteMessage(doc, t.id, m.id)}
                          >
                            <Trash size={14} />
                          </IconButton>
                        )}
                      </li>
                    ))}
                  </ol>
                  {!t.resolved && t.id === activeId && (
                    <div className="mt-3">
                      <Composer placeholder="Reply" submitLabel="Reply" onSubmit={(body) => threads.reply(doc, t.id, body, author)} />
                    </div>
                  )}
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </SidePanel>
  );
}
