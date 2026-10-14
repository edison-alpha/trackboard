"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ySyncPluginKey } from "@tiptap/y-tiptap";
import { useEffect, useRef } from "react";
import type * as Y from "yjs";
import { keys } from "@/lib/api/keys";
import { docFromSnapshot, getSnapshot, listSnapshots, saveSnapshot, type SnapshotMeta } from "./lib/snapshots";

const AUTO_EVERY_MS = 5 * 60 * 1000;

/** Saves an automatic version every few minutes while this tab has made local edits. Pass null to save none (readers). */
export function useAutoSnapshot(pageId: string, doc: Y.Doc | null, author: SnapshotMeta["author"]): void {
  const queryClient = useQueryClient();
  const dirty = useRef(false);
  const authorRef = useRef(author);
  authorRef.current = author;

  useEffect(() => {
    if (!doc) return;
    // Only edits typed in this tab count (origin = the editor binding), not remote or stored updates,
    // so two open tabs never save the same version twice.
    const onUpdate = (_u: Uint8Array, origin: unknown) => {
      if (origin === ySyncPluginKey) dirty.current = true;
    };
    doc.on("update", onUpdate);
    const flush = () => {
      if (!dirty.current) return;
      dirty.current = false;
      void saveSnapshot(pageId, doc, { label: null, author: authorRef.current }).then(() => queryClient.invalidateQueries({ queryKey: keys.snapshots(pageId) }));
    };
    const timer = setInterval(flush, AUTO_EVERY_MS);
    return () => {
      flush();
      clearInterval(timer);
      doc.off("update", onUpdate);
    };
  }, [pageId, doc, queryClient]);
}

/** The saved versions of a page, loaded while the history panel is open. */
export function useSnapshots(pageId: string, open: boolean) {
  return useQuery({ queryKey: keys.snapshots(pageId), queryFn: () => listSnapshots(pageId), enabled: open });
}

/** One version, rebuilt into a document for the read-only preview. A saved version never changes, so it is cached for good. */
export function useSnapshotDoc(pageId: string, id: string | null) {
  return useQuery({
    queryKey: keys.snapshot(pageId, id ?? ""),
    queryFn: () => getSnapshot(pageId, id!),
    select: docFromSnapshot,
    enabled: id !== null,
    staleTime: Infinity,
  });
}

/** Saves a named version of the page as it is now. */
export function useSaveVersion(pageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (v: { doc: Y.Doc; label: string; author: SnapshotMeta["author"] }) => saveSnapshot(pageId, v.doc, { label: v.label, author: v.author }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.snapshots(pageId) }),
  });
}
