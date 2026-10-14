"use client";

import { ySyncPluginKey } from "@tiptap/y-tiptap";
import { useCallback, useEffect, useRef, useState } from "react";
import type * as Y from "yjs";
import { listSnapshots, saveSnapshot, type SnapshotMeta } from "./lib/snapshots";

const AUTO_EVERY_MS = 5 * 60 * 1000;

/** Saves an automatic version every few minutes while this tab has made local edits. */
export function useAutoSnapshot(pageId: string, doc: Y.Doc | null, author: SnapshotMeta["author"]): void {
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
      void saveSnapshot(pageId, doc, { label: null, author: authorRef.current });
    };
    const timer = setInterval(flush, AUTO_EVERY_MS);
    return () => {
      flush();
      clearInterval(timer);
      doc.off("update", onUpdate);
    };
  }, [pageId, doc]);
}

export function useSnapshots(pageId: string, open: boolean) {
  const [state, setState] = useState<{ status: "loading" } | { status: "ready"; list: SnapshotMeta[] } | { status: "error" }>({ status: "loading" });
  const reload = useCallback(() => {
    listSnapshots(pageId).then(
      (list) => setState({ status: "ready", list }),
      () => setState({ status: "error" }),
    );
  }, [pageId]);
  useEffect(() => {
    if (open) reload();
  }, [open, reload]);
  return { state, reload };
}
