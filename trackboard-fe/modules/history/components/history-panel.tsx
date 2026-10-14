"use client";

import { ArrowCounterClockwise, BookmarkSimple, X } from "@/components/icons";
import type { Editor } from "@tiptap/react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
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
import { useSaveVersion, useSnapshotDoc, useSnapshots } from "../hooks";
import type { SnapshotMeta } from "../lib/snapshots";

type Props = { open: boolean; onClose: () => void; pageId: string; doc: Y.Doc; editor: Editor | null; author: SnapshotMeta["author"] };

/** Saved versions of the page: preview any of them and restore it as a new edit everyone sees. */
export function HistoryPanel({ open, onClose, pageId, doc, editor, author }: Props) {
  const versions = useSnapshots(pageId, open);
  const save = useSaveVersion(pageId);
  const [selected, setSelected] = useState<SnapshotMeta | null>(null);

  const saveNamed = async () => {
    const label = await askText({ title: "Name this version", placeholder: "For example: before client review", confirmLabel: "Save version" });
    if (label) save.mutate({ doc, label, author }, { onSuccess: () => toast.success(`Saved version "${label}"`) });
  };

  return (
    <>
      <SidePanel
        open={open}
        onClose={onClose}
        title="Version history"
        actions={
          <Button size="sm" variant="glass" icon={<BookmarkSimple size={15} />} busy={save.isPending} onClick={saveNamed}>
            Save version
          </Button>
        }
      >
        {versions.isPending && <InlineLoader label="Loading history" />}
        {versions.isError && (
          <ErrorState
            title="Couldn't read the history"
            body="Trackdocs couldn't reach the server. Check your connection and try again."
            action={
              <Button variant="glass" onClick={() => void versions.refetch()}>
                Try again
              </Button>
            }
          />
        )}
        {versions.data && versions.data.length === 0 && (
          <EmptyState title="No saved versions yet" body="A version is saved every 5 minutes while you type. Save a named version before a big change." />
        )}
        {versions.data && versions.data.length > 0 && (
          <ol className="grid gap-0.5 p-2">
            {versions.data?.map((s) => (
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
      <VersionPreview pageId={pageId} snapshot={selected} onClose={() => setSelected(null)} liveEditor={editor} onRestored={onClose} />
    </>
  );
}

function VersionPreview({ pageId, snapshot, onClose, liveEditor, onRestored }: { pageId: string; snapshot: SnapshotMeta | null; onClose: () => void; liveEditor: Editor | null; onRestored: () => void }) {
  // The list carries no document bytes; the chosen version is fetched (and kept) when it is opened.
  const version = useSnapshotDoc(pageId, snapshot?.id ?? null);
  const doc = version.data ?? null;
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
      {snapshot && (
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
              {doc ? <PreviewEditor doc={doc} onReady={setPreview} /> : version.isError ? <ErrorState title="Couldn't open this version" body={version.error.message} /> : <InlineLoader label="Opening version" />}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
