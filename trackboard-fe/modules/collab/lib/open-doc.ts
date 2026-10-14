import { HocuspocusProvider } from "@hocuspocus/provider";
import { IndexeddbPersistence } from "y-indexeddb";
import { Awareness } from "y-protocols/awareness";
import * as Y from "yjs";
import { api } from "@/lib/api/client";
import { COLLAB_URL } from "@/lib/env";
import { createStore, type Store } from "@/lib/store";
import { EditorProvider } from "./editor-provider";
import { LOCAL_DB_PREFIX } from "./local-cache";

/** State of the WebSocket to trackboard-be. While it is down, edits are kept on this device and sent on reconnect. */
export type SyncStatus = "connecting" | "online" | "offline";

export type CollabDoc = {
  /** `<workspaceId>/<local name>`: what the server stores the document under. */
  name: string;
  doc: Y.Doc;
  awareness: Awareness;
  /** Passed to Tiptap's collaboration extensions (awareness + "synced" event). */
  provider: EditorProvider;
  status: Store<SyncStatus>;
  /** Resolves once there is real content to show, so the editor never starts from an empty doc by mistake. */
  ready: Promise<void>;
  destroy: () => void;
};

/** How long a device with no offline copy waits for the server before giving up and opening what it has. */
const FIRST_LOAD_WAIT_MS = 10_000;

/**
 * Opens a shared document. The server (trackboard-be) is the source of truth; IndexedDB keeps an offline copy so a
 * page opens instantly and keeps working without a connection, and the two merge when the socket comes back.
 */
export function openDoc(name: string): CollabDoc {
  const doc = new Y.Doc();
  const awareness = new Awareness(doc);
  const persistence = new IndexeddbPersistence(`${LOCAL_DB_PREFIX}${name}`, doc);
  const status = createStore<SyncStatus>("connecting");

  let serverSynced!: () => void;
  let serverRefused!: (e: Error) => void;
  const fromServer = new Promise<void>((resolve, reject) => {
    serverSynced = resolve;
    serverRefused = reject;
  });
  fromServer.catch(() => undefined);

  const remote = new HocuspocusProvider({
    url: COLLAB_URL,
    name,
    document: doc,
    awareness,
    // Fetched on every (re)connect: a token lives five minutes, the session behind it thirty days.
    token: async () => (await api<{ token: string }>("/api/collab-token")).token,
    onStatus: ({ status: s }: { status: string }) => status.set(s === "connected" ? "online" : s === "connecting" ? "connecting" : "offline"),
    onSynced: () => serverSynced(),
    onAuthenticationFailed: () => {
      status.set("offline");
      serverRefused(new Error("You don't have access to this page."));
    },
  });

  const provider = new EditorProvider(awareness);
  const ready = persistence.whenSynced.then(async () => {
    // Content already on this device is real content: show it now and let the server's changes merge in. A device that
    // has never opened this page waits for the server, or the editor would start empty and seed a second copy.
    const hasOfflineCopy = Y.encodeStateAsUpdate(doc).length > 2;
    if (!hasOfflineCopy) {
      await Promise.race([fromServer, new Promise<void>((resolve) => setTimeout(resolve, FIRST_LOAD_WAIT_MS))]);
    }
    provider.markSynced();
  });

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
