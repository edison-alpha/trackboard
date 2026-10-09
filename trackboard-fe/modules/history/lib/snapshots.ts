import { createStore as createIdbStore, get, set, update } from "idb-keyval";
import * as Y from "yjs";
import { createId } from "@/lib/id";

export type Snapshot = {
  id: string;
  at: number;
  /** Set for versions saved by hand; automatic ones have no label. */
  label: string | null;
  author: { name: string; color: string };
  update: Uint8Array;
};

/** Automatic versions kept per page; named versions are never pruned. */
const MAX_AUTO = 40;

const store = typeof indexedDB === "undefined" ? undefined : createIdbStore("tb-history", "snapshots");

export async function listSnapshots(pageId: string): Promise<Snapshot[]> {
  const all = (await get<Snapshot[]>(pageId, store)) ?? [];
  return all.sort((a, b) => b.at - a.at);
}

export async function saveSnapshot(pageId: string, doc: Y.Doc, input: { label: string | null; author: Snapshot["author"] }): Promise<Snapshot> {
  const snap: Snapshot = { id: createId(), at: Date.now(), label: input.label, author: input.author, update: Y.encodeStateAsUpdate(doc) };
  await update<Snapshot[]>(
    pageId,
    (prev = []) => {
      const next = [snap, ...prev];
      const autos = next.filter((s) => !s.label);
      const drop = new Set(autos.slice(MAX_AUTO).map((s) => s.id));
      return next.filter((s) => !drop.has(s.id));
    },
    store,
  );
  return snap;
}

export async function deleteSnapshots(pageId: string): Promise<void> {
  await set(pageId, [], store);
}

/** Rebuilds a standalone Y.Doc from a snapshot, for read-only preview. */
export function docFromSnapshot(snap: Snapshot): Y.Doc {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, snap.update);
  return doc;
}
