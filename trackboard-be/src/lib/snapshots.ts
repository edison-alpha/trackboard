import * as Y from "yjs";
import type { NewSnapshot, Snapshot, SnapshotMeta } from "@trackboard/api-types";
import { ID_PATTERN, MAX_AUTO_SNAPSHOTS } from "@trackboard/shared";
import { db } from "./db/client.ts";
import { InputError, NotFoundError, TooLargeError } from "./errors.ts";
import { createId } from "./id.ts";

const MAX_UPDATE_BYTES = 8 * 1024 * 1024;

type Row = { id: string; label: string | null; author_name: string; author_color: string; created_at: string | number; ydoc?: Uint8Array };

const meta = (r: Row): SnapshotMeta => ({ id: r.id, at: Number(r.created_at), label: r.label, author: { name: r.author_name, color: r.author_color } });

function assertPage(pageId: string) {
  if (!ID_PATTERN.test(pageId)) throw new InputError("Invalid page id.");
}

export async function listSnapshots(workspaceId: string, pageId: string): Promise<SnapshotMeta[]> {
  assertPage(pageId);
  const rows = await (await db()).query<Row>("select id, label, author_name, author_color, created_at from snapshots where workspace_id = $1 and page_id = $2 order by created_at desc", [workspaceId, pageId]);
  return rows.map(meta);
}

export async function getSnapshot(workspaceId: string, pageId: string, id: string): Promise<Snapshot> {
  assertPage(pageId);
  const rows = await (await db()).query<Row>("select id, label, author_name, author_color, created_at, ydoc from snapshots where workspace_id = $1 and page_id = $2 and id = $3", [workspaceId, pageId, id]);
  const r = rows[0];
  if (!r) throw new NotFoundError("That version no longer exists.");
  return { ...meta(r), update: Buffer.from(r.ydoc!).toString("base64") };
}

/** Stores a Yjs state sent by the editor. The bytes are checked by applying them to a scratch doc, so junk never lands. */
export async function saveSnapshot(workspaceId: string, pageId: string, input: NewSnapshot): Promise<SnapshotMeta> {
  assertPage(pageId);
  if (typeof input.update !== "string" || !input.update) throw new InputError("update is required.");
  const bytes = Buffer.from(input.update, "base64");
  if (bytes.length > MAX_UPDATE_BYTES) throw new TooLargeError("This page is too large to save a version of.");
  try {
    Y.applyUpdate(new Y.Doc(), bytes);
  } catch {
    throw new InputError("update is not a valid document state.");
  }
  const label = input.label === null || input.label === undefined ? null : String(input.label).trim().slice(0, 80) || null;
  const name = String(input.author?.name ?? "").slice(0, 40) || "Someone";
  const color = /^#[0-9a-fA-F]{6}$/.test(input.author?.color ?? "") ? input.author.color : "#0b6fe8";
  const id = createId();
  const at = Date.now();
  const d = await db();
  await d.tx(async (t) => {
    await t.query("insert into snapshots (id, workspace_id, page_id, label, author_name, author_color, ydoc, created_at) values ($1, $2, $3, $4, $5, $6, $7, $8)", [id, workspaceId, pageId, label, name, color, bytes, at]);
    // Named versions are never pruned; only automatic ones beyond the newest MAX_AUTO_SNAPSHOTS go.
    await t.query(
      `delete from snapshots where workspace_id = $1 and page_id = $2 and label is null
       and id not in (select id from snapshots where workspace_id = $1 and page_id = $2 and label is null order by created_at desc limit $3)`,
      [workspaceId, pageId, MAX_AUTO_SNAPSHOTS],
    );
  });
  return { id, at, label, author: { name, color } };
}

export async function deleteSnapshots(workspaceId: string, pageIds: string[]): Promise<void> {
  if (!pageIds.length) return;
  await (await db()).query("delete from snapshots where workspace_id = $1 and page_id = any($2::text[])", [workspaceId, pageIds]);
}
