import * as Y from "yjs";
import { createApp } from "./app.ts";
import { createCollabServer } from "./lib/collab.ts";
import { db } from "./lib/db/client.ts";
import { onCloseDocument } from "./lib/events.ts";
import { env } from "./lib/env.ts";
import { log } from "./lib/log.ts";

const e = env();
await db();

const collab = createCollabServer();
collab.listen();
// Revoking access (a removed share, a page made private) must end the live sessions of the people who lost it.
onCloseDocument((name) => collab.closeDocument(name));

const app = createApp({
  liveState: (name) => {
    const doc = collab.hocuspocus.documents.get(name);
    return doc ? Y.encodeStateAsUpdate(doc) : undefined;
  },
  closeDocuments: (names) => names.forEach((n) => collab.hocuspocus.closeConnections(n)),
}).listen(e.port);

log("server.started", { port: e.port, collabPort: e.port + 1, origins: e.allowedOrigins, google: Boolean(e.googleClientId), ai: Boolean(e.aiApiKey) });

/** Edits still waiting on the store debounce are written before the process exits, so a deploy never drops typing. */
let stopping = false;
async function stop(signal: string) {
  if (stopping) return;
  stopping = true;
  log("server.stopping", { signal });
  try {
    await collab.destroy();
    await app.stop();
    await (await db()).close();
  } finally {
    process.exit(0);
  }
}
process.on("SIGTERM", () => void stop("SIGTERM"));
process.on("SIGINT", () => void stop("SIGINT"));

export type App = typeof app;
