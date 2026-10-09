import { HocuspocusProvider } from "@hocuspocus/provider";
import { IndexeddbPersistence } from "y-indexeddb";
import { Awareness } from "y-protocols/awareness";
import * as Y from "yjs";
import { COLLAB_URL } from "@/lib/env";
import { createStore, type Store } from "@/lib/store";
import { BroadcastProvider } from "./broadcast-provider";
import { EditorProvider } from "./editor-provider";

/** local: IndexedDB + other tabs. connecting / online / offline: state of the trackdocs-be WebSocket. */
export type SyncStatus = "local" | "connecting" | "online" | "offline";

export type CollabDoc = {
  name: string;
  doc: Y.Doc;
  awareness: Awareness;
  /** Passed to Tiptap's collaboration extensions (awareness + "synced" event). */
  provider: EditorProvider;
  status: Store<SyncStatus>;
  /** Resolves once the stored copy is loaded, so the editor never starts from an empty doc by mistake. */
  ready: Promise<void>;
  destroy: () => void;
};

/**
 * Opens a shared document. Always persisted to IndexedDB (works offline, opens instantly);
 * synced through Hocuspocus when NEXT_PUBLIC_COLLAB_URL is set, otherwise between tabs.
 */
export function openDoc(name: string): CollabDoc {
  const doc = new Y.Doc();
  const awareness = new Awareness(doc);
  const persistence = new IndexeddbPersistence(`tb:${name}`, doc);
  const status = createStore<SyncStatus>(COLLAB_URL ? "connecting" : "local");

  let remote: { destroy: () => void };
  if (COLLAB_URL) {
    const hp = new HocuspocusProvider({ url: COLLAB_URL, name, document: doc, awareness });
    hp.on("status", ({ status: s }: { status: string }) => status.set(s === "connected" ? "online" : s === "connecting" ? "connecting" : "offline"));
    remote = hp;
  } else {
    remote = new BroadcastProvider(name, doc, awareness);
  }

  const provider = new EditorProvider(awareness);
  const ready = persistence.whenSynced.then(() => provider.markSynced());

  return {
    name,
    doc,
    awareness,
    provider,
    status,
    ready,
    destroy() {
      remote.destroy();
      provider.destroy();
      awareness.destroy();
      void persistence.destroy();
      doc.destroy();
    },
  };
}

/** Reads a stored doc once without joining live sync (duplicate page). */
export async function readStoredDoc(name: string): Promise<Uint8Array> {
  const doc = new Y.Doc();
  const persistence = new IndexeddbPersistence(`tb:${name}`, doc);
  await persistence.whenSynced;
  const update = Y.encodeStateAsUpdate(doc);
  await persistence.destroy();
  doc.destroy();
  return update;
}

/** Writes an update into a stored doc that may not be open anywhere yet. */
export async function writeStoredDoc(name: string, update: Uint8Array): Promise<void> {
  const doc = new Y.Doc();
  const persistence = new IndexeddbPersistence(`tb:${name}`, doc);
  await persistence.whenSynced;
  Y.applyUpdate(doc, update);
  // y-indexeddb stores updates asynchronously; let the write land before closing.
  await new Promise((r) => setTimeout(r, 80));
  await persistence.destroy();
  doc.destroy();
}

/** Removes a doc's stored copy (permanent delete from trash). */
export async function deleteStoredDoc(name: string): Promise<void> {
  const doc = new Y.Doc();
  const persistence = new IndexeddbPersistence(`tb:${name}`, doc);
  await persistence.whenSynced;
  await persistence.clearData();
  doc.destroy();
}
