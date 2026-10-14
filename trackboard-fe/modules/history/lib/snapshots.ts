import * as Y from "yjs";
import { api } from "@/lib/api/client";
import type { NewSnapshot, Snapshot, SnapshotMeta } from "@/lib/api/types";

export type { Snapshot, SnapshotMeta };

/* Versions live on the server, next to the page, so they follow the page to every device and every collaborator. */

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

const fromBase64 = (b64: string): Uint8Array => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

const base = (pageId: string) => `/api/pages/${encodeURIComponent(pageId)}/snapshots`;

export async function listSnapshots(pageId: string): Promise<SnapshotMeta[]> {
  return (await api<{ snapshots: SnapshotMeta[] }>(base(pageId))).snapshots;
}

export function getSnapshot(pageId: string, id: string): Promise<Snapshot> {
  return api<Snapshot>(`${base(pageId)}/${encodeURIComponent(id)}`);
}

export function saveSnapshot(pageId: string, doc: Y.Doc, input: { label: string | null; author: SnapshotMeta["author"] }): Promise<SnapshotMeta> {
  const body: NewSnapshot = { label: input.label, author: input.author, update: toBase64(Y.encodeStateAsUpdate(doc)) };
  return api<SnapshotMeta>(base(pageId), { body });
}

/** Rebuilds a standalone Y.Doc from a snapshot, for read-only preview. */
export function docFromSnapshot(snap: Snapshot): Y.Doc {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, fromBase64(snap.update));
  return doc;
}
