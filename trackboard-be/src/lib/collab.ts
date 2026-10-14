import { Hocuspocus, type Configuration } from "@hocuspocus/server";
import * as Y from "yjs";
import { ydocToJson, ydocToText } from "@trackboard/doc-model";
import { docName, parseDocName } from "@trackboard/shared";
import { accessTo } from "./access.ts";
import { recordActivity } from "./activity.ts";
import { db } from "./db/client.ts";
import { env } from "./env.ts";
import { log } from "./log.ts";
import { recordEdit } from "./pages.ts";
import { readToken, sessionFromCookie } from "./session.ts";

/** What each connection carries after it authenticates. */
type Ctx = { userId: string };

const COLLAB_TOKEN_TTL_SEC = 300;
export { COLLAB_TOKEN_TTL_SEC };

/** Who is on this socket: the short-lived token the app fetched, or else the session cookie from the handshake. */
async function userFor(token: string | undefined, cookie: string | null): Promise<string | undefined> {
  if (token) {
    const claims = await readToken<{ userId?: string }>("collab", token);
    if (claims?.userId) return claims.userId;
  }
  return (await sessionFromCookie(cookie))?.userId;
}

/** The stored Yjs state of a document, or undefined when it was never saved. */
export async function loadState(name: string): Promise<Uint8Array | undefined> {
  const rows = await (await db()).query<{ ydoc: Uint8Array }>("select ydoc from documents where name = $1", [name]);
  return rows[0] ? new Uint8Array(rows[0].ydoc) : undefined;
}

/** Writes the Yjs state (the source of truth for editing) and a read copy as ProseMirror JSON plus plain text. */
export async function storeDocument(name: string, doc: Y.Doc): Promise<void> {
  const parsed = parseDocName(name);
  if (!parsed) return;
  await (await db()).query(
    `insert into documents (name, workspace_id, ydoc, content_json, text, updated_at) values ($1, $2, $3, $4::jsonb, $5, $6)
     on conflict (name) do update set ydoc = excluded.ydoc, content_json = excluded.content_json, text = excluded.text, updated_at = excluded.updated_at`,
    [name, parsed.workspaceId, Y.encodeStateAsUpdate(doc), JSON.stringify(ydocToJson(doc)), ydocToText(doc), Date.now()],
  );
}

export type CollabServer = { hocuspocus: Hocuspocus<Ctx>; listen(): void; destroy(): Promise<void>; closeDocument(name: string): void };

type SocketData = { request: Request; connection?: ReturnType<Hocuspocus<Ctx>["handleConnection"]> };

const MAX_MESSAGE_BYTES = 16 * 1024 * 1024;

/**
 * Hocuspocus on its own port, nginx sends the socket host here. Hocuspocus's bundled `Server` runs on crossws's Node
 * adapter, which refuses to start under Bun, so the sockets are Bun's own and are handed to Hocuspocus's connection API.
 */
export function createCollabServer(port: number = env().port + 1): CollabServer {
  const hocuspocus = new Hocuspocus<Ctx>(collabConfiguration());
  let server: ReturnType<typeof Bun.serve<SocketData>> | undefined;
  return {
    hocuspocus,
    closeDocument: (name) => hocuspocus.closeConnections(name),
    listen() {
      server = Bun.serve<SocketData>({
        port,
        hostname: "127.0.0.1",
        fetch(request, srv) {
          if (srv.upgrade(request, { data: { request } })) return undefined;
          return new Response("This is the Trackboard collaboration socket.", { status: 426 });
        },
        websocket: {
          maxPayloadLength: MAX_MESSAGE_BYTES,
          idleTimeout: 120,
          open(ws) {
            ws.data.connection = hocuspocus.handleConnection(ws, ws.data.request);
          },
          message(ws, message) {
            if (typeof message !== "string") ws.data.connection?.handleMessage(new Uint8Array(message.buffer, message.byteOffset, message.byteLength));
          },
          close(ws, code, reason) {
            ws.data.connection?.handleClose({ code, reason } as CloseEvent);
          },
        },
      });
    },
    async destroy() {
      hocuspocus.flushPendingStores();
      // Give the flush a moment to reach the database before the process lets go of it.
      await new Promise((r) => setTimeout(r, 500));
      await server?.stop(true);
    },
  };
}

function collabConfiguration(): Partial<Configuration<Ctx>> {
  return {
    quiet: true,
    // Edits are batched: a burst of typing is one write, and nothing waits longer than maxDebounce to reach the database.
    debounce: 2_000,
    maxDebounce: 10_000,

    /**
     * Who may open a page, and how. People with `view` get a read-only connection: the server drops anything they send.
     * A page that does not exist, is in another workspace, or is not theirs is "forbidden", the same answer for all three.
     */
    async onAuthenticate(data) {
      const parsed = parseDocName(data.documentName);
      if (!parsed) throw new Error("forbidden");
      const userId = await userFor(data.token, data.requestHeaders.get("cookie"));
      if (!userId) throw new Error("unauthorized");
      const found = await accessTo(userId, parsed.pageId);
      if (found.access === "none" || found.page.workspace_id !== parsed.workspaceId) throw new Error("forbidden");
      if (found.access === "view") data.connectionConfig.readOnly = true;
      return { userId };
    },

    async onLoadDocument({ document, documentName }) {
      const state = await loadState(documentName);
      if (state) Y.applyUpdate(document, state);
      return document;
    },

    /** Someone typing: counted toward their writing activity (once per five-minute window). */
    async onChange({ context }) {
      if (context?.userId) await recordActivity(context.userId).catch(() => undefined);
    },

    async onStoreDocument({ document, documentName, lastContext }) {
      try {
        await storeDocument(documentName, document);
        const parsed = parseDocName(documentName);
        // Stored text is what search and the contributors row read, so keep "last edited" in step with it.
        if (parsed && lastContext?.userId) await recordEdit(parsed.pageId, lastContext.userId);
      } catch (error) {
        // Throwing here would only be swallowed by the debouncer; log it loudly so a failing disk or database is seen.
        log("collab.store_failed", { document: documentName, error: (error as Error).message.split("\n")[0] }, "error");
        throw error;
      }
    },
  };
}

export { docName };
