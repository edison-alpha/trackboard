"use client";

import { ArrowCounterClockwise, FileText, Trash } from "@/components/icons";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { Button, IconButton } from "@/components/ui/button";
import { askConfirm } from "@/components/ui/prompt";
import { EmptyState } from "@/components/ui/states";
import { timeAgo } from "@/lib/time";
import { Topbar } from "@/modules/shell";
import { descendantCount, displayTitle, pageHref, trashOf, usePageActions, usePages } from "@/modules/workspace";

/** Pages moved to the trash, newest first. Restore brings back the whole subtree. */
export function TrashView() {
  const pages = usePages();
  const actions = usePageActions();
  const list = trashOf(pages);

  const removeForever = async (id: string, title: string) => {
    const kids = descendantCount(pages, id);
    const ok = await askConfirm({
      title: `Delete "${title}" for good?`,
      body: kids ? `This page, the ${kids} pages inside it, and their version history will be gone. This can't be undone.` : "This page and its version history will be gone. This can't be undone.",
      confirmLabel: "Delete for good",
      danger: true,
    });
    if (!ok) return;
    await actions.deleteForever(id);
  };

  const emptyTrash = async () => {
    const ok = await askConfirm({ title: "Empty the trash?", body: `${list.length} ${list.length === 1 ? "page" : "pages"} and everything inside them will be gone. This can't be undone.`, confirmLabel: "Empty trash", danger: true });
    if (!ok) return;
    for (const p of list) {
      await actions.deleteForever(p.id);
    }
  };

  return (
    <>
      <Topbar>
        <h1 className="flex items-center gap-2 px-1.5 text-sm font-medium">
          <Trash size={16} /> Trash
        </h1>
      </Topbar>
      <main className="mx-auto w-full max-w-[760px] px-5 pt-8 pb-16 sm:px-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[26px] font-bold tracking-[-0.02em]">Trash</h2>
            <p className="mt-1 text-sm text-ink-2">Pages here don't show up in search. Restore one to put it back where it was.</p>
          </div>
          {list.length > 0 && (
            <Button variant="danger" size="sm" onClick={emptyTrash}>
              Empty trash
            </Button>
          )}
        </div>

        {list.length === 0 ? (
          <EmptyState title="Trash is empty" body="Pages you delete wait here until you restore them or delete them for good." />
        ) : (
          <ul className="mt-6 divide-y divide-line rounded-(--radius-panel) border border-line">
            <AnimatePresence initial={false}>
              {list.map((p) => (
                <motion.li key={p.id} layout exit={{ opacity: 0, height: 0 }} className="flex items-center gap-3 overflow-hidden px-4 py-3">
                  <span className="flex size-8 shrink-0 items-center justify-center text-lg" aria-hidden="true">
                    {p.icon ?? <FileText size={17} className="text-ink-2" />}
                  </span>
                  <Link href={pageHref(p.id)} className="min-w-0 flex-1 rounded-md">
                    <span className="block truncate text-[15px] font-medium">{displayTitle(p)}</span>
                    <span className="block text-xs text-ink-3">Deleted {timeAgo(p.deletedAt ?? 0)}</span>
                  </Link>
                  <Button size="sm" variant="glass" icon={<ArrowCounterClockwise size={15} />} onClick={() => actions.restore(p.id)}>
                    <span className="hidden sm:inline">Restore</span>
                  </Button>
                  <IconButton label={`Delete ${displayTitle(p)} for good`} onClick={() => removeForever(p.id, displayTitle(p))} className="hover:text-danger">
                    <Trash size={17} />
                  </IconButton>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </main>
    </>
  );
}
