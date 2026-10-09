"use client";

import { ArrowCounterClockwise, BookmarkSimple, X } from "@/components/icons";
import type { Editor } from "@tiptap/react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type * as Y from "yjs";
import { InlineLoader } from "@/components/brand/loading-screen";
import { Avatar } from "@/components/ui/avatar";
import { Button, IconButton } from "@/components/ui/button";
import { askText } from "@/components/ui/prompt";
import { SidePanel } from "@/components/ui/side-panel";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { cx } from "@/lib/cx";
import { formatDateTime, timeAgo } from "@/lib/time";
import { PreviewEditor } from "@/modules/editor";
import { useSnapshots } from "../hooks";
import { docFromSnapshot, saveSnapshot, type Snapshot } from "../lib/snapshots";

type Props = { open: boolean; onClose: () => void; pageId: string; doc: Y.Doc; editor: Editor | null; author: Snapshot["author"] };

/** Saved versions of the page: preview any of them and restore it as a new edit everyone sees. */
export function HistoryPanel({ open, onClose, pageId, doc, editor, author }: Props) {
  const { state, reload } = useSnapshots(pageId, open);
  const [selected, setSelected] = useState<Snapshot | null>(null);
  const [saving, setSaving] = useState(false);

  const saveNamed = async () => {
    const label = await askText({ title: "Name this version", placeholder: "For example: before client review", confirmLabel: "Save version" });
    if (!label) return;
    setSaving(true);
    try {
      await saveSnapshot(pageId, doc, { label, author });
      reload();
      toast.success(`Saved version "${label}"`);
    } catch {
      toast.error("Couldn't save the version. Browser storage may be full.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SidePanel
        open={open}
        onClose={onClose}
        title="Version history"
        actions={
          <Button size="sm" variant="glass" icon={<BookmarkSimple size={15} />} busy={saving} onClick={saveNamed}>
            Save version
          </Button>
        }
      >
        {state.status === "loading" && <InlineLoader label="Loading history" />}
        {state.status === "error" && (
          <ErrorState
            title="Couldn't read the history"
            body="The browser blocked access to its storage."
            action={
              <Button variant="glass" onClick={reload}>
                Try again
              </Button>
            }
          />
        )}
        {state.status === "ready" && state.list.length === 0 && (
          <EmptyState title="No saved versions yet" body="A version is saved every 5 minutes while you type. Save a named version before a big change." />
        )}
        {state.status === "ready" && state.list.length > 0 && (
          <ol className="grid gap-0.5 p-2">
            {state.list.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setSelected(s)}
                  className={cx("flex w-full items-center gap-3 rounded-(--radius-row) px-3 py-2.5 text-left hover:bg-surface-2", selected?.id === s.id && "bg-surface-2")}
                >
                  <Avatar name={s.author.name} color={s.author.color} size={26} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{s.label ?? "Autosave"}</span>
                    <span className="block text-xs text-ink-3" title={formatDateTime(s.at)}>
                      {s.author.name} · {timeAgo(s.at)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </SidePanel>
      <VersionPreview snapshot={selected} onClose={() => setSelected(null)} liveEditor={editor} onRestored={onClose} />
    </>
  );
}

function VersionPreview({ snapshot, onClose, liveEditor, onRestored }: { snapshot: Snapshot | null; onClose: () => void; liveEditor: Editor | null; onRestored: () => void }) {
  const doc = useMemo(() => (snapshot ? docFromSnapshot(snapshot) : null), [snapshot]);
  const [preview, setPreview] = useState<Editor | null>(null);

  const restore = () => {
    if (!preview || !liveEditor) return;
    // Restoring writes the old content as a normal edit, so collaborators receive it and it can be undone.
    liveEditor.commands.setContent(preview.getJSON());
    toast.success("Version restored");
    onClose();
    onRestored();
  };

  return (
    <AnimatePresence>
      {snapshot && doc && (
        <motion.div
          key={snapshot.id}
          role="dialog"
          aria-modal="true"
          aria-label={`Preview of ${snapshot.label ?? formatDateTime(snapshot.at)}`}
          className="fixed inset-0 z-50 flex flex-col bg-bg"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.18 }}
          onKeyDown={(e) => e.key === "Escape" && onClose()}
        >
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4">
            <IconButton label="Close preview" onClick={onClose} autoFocus>
              <X size={18} />
            </IconButton>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{snapshot.label ?? "Autosave"}</p>
              <p className="truncate text-xs text-ink-3">
                {snapshot.author.name} · {formatDateTime(snapshot.at)}
              </p>
            </div>
            <Button variant="primary" icon={<ArrowCounterClockwise size={16} />} onClick={restore} disabled={!preview}>
              <span className="hidden sm:inline">Restore this version</span>
              <span className="sm:hidden">Restore</span>
            </Button>
          </header>
          <div className="thin-scroll flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[720px] px-5 py-10 sm:px-8">
              <PreviewEditor doc={doc} onReady={setPreview} />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
