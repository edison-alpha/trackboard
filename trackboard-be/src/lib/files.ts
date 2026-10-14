import { createHash } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { FileRecord } from "@trackboard/api-types";
import { MAX_FILE_BYTES } from "@trackboard/shared";
import { accessTo, requireAccess, requireMember, roleIn } from "./access.ts";
import { db } from "./db/client.ts";
import { env } from "./env.ts";
import { InputError, NotFoundError, TooLargeError } from "./errors.ts";
import { createId } from "./id.ts";
import { isPublicPage } from "./shares.ts";

type Row = { id: string; name: string; mime: string; size: string | number; workspace_id: string };

const root = () => resolve(process.cwd(), env().filesDir);
const pathFor = (workspaceId: string, id: string) => join(root(), workspaceId, id);
const urlFor = (id: string) => `${env().publicUrl}/api/files/${id}`;

/**
 * Shown in the page itself: images, and the PDF/audio/video the file preview plays. Everything else (HTML, SVG, scripts)
 * is a download, so an uploaded file can never run as a page on this origin.
 */
const INLINE = /^(image\/(png|jpeg|gif|webp|avif)|application\/pdf|audio\/(mpeg|mp4|ogg|wav|webm|aac)|video\/(mp4|webm|ogg))$/;

/** Uploads belong to a page when the editor says which (so the page's access rules apply to the file), else to the workspace. */
export async function saveFile(input: { workspaceId?: string; pageId?: string; userId: string; file: File }): Promise<FileRecord> {
  const { file } = input;
  let workspaceId: string;
  if (input.pageId) workspaceId = (await requireAccess(input.userId, input.pageId, "edit")).page.workspace_id;
  else if (input.workspaceId) {
    await requireMember(input.userId, input.workspaceId);
    workspaceId = input.workspaceId;
  } else throw new InputError("Say which page or workspace this file is for.");
  if (!(file instanceof File) || !file.name) throw new InputError("Attach a file to upload.");
  if (file.size > MAX_FILE_BYTES) throw new TooLargeError(`File ${(file.size / 1024 / 1024).toFixed(1)} MB, the limit is ${MAX_FILE_BYTES / 1024 / 1024} MB.`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const id = createId(16);
  const name = file.name.replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 200);
  const mime = file.type || "application/octet-stream";
  await mkdir(join(root(), workspaceId), { recursive: true });
  await writeFile(pathFor(workspaceId, id), bytes, { mode: 0o600 });
  try {
    await (await db()).query("insert into files (id, workspace_id, page_id, name, mime, size, sha256, created_by, created_at) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)", [
      id, workspaceId, input.pageId ?? null, name, mime, bytes.length, createHash("sha256").update(bytes).digest("hex"), input.userId, Date.now(),
    ]);
  } catch (error) {
    await unlink(pathFor(workspaceId, id)).catch(() => undefined);
    throw error;
  }
  return { id, name, mime, size: bytes.length, url: urlFor(id) };
}

/** The file's bytes and the headers to serve it with, or NotFound when it is not in one of the caller's workspaces. */
export async function readStoredFile(fileId: string, workspaceId: string): Promise<{ body: Uint8Array; headers: Record<string, string> }> {
  const rows = await (await db()).query<Row>("select id, name, mime, size, workspace_id from files where id = $1 and workspace_id = $2", [fileId, workspaceId]);
  const r = rows[0];
  if (!r) throw new NotFoundError("File not found.");
  const body = new Uint8Array(await readFile(pathFor(r.workspace_id, r.id)).catch(() => { throw new NotFoundError("File not found."); }));
  const inline = INLINE.test(r.mime);
  return {
    body,
    headers: {
      "content-type": inline ? r.mime : "application/octet-stream",
      "content-disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(r.name)}`,
      "x-content-type-options": "nosniff",
      // A sandboxed PDF is refused by the browser's viewer, and PDFs run in the viewer's own sandbox anyway.
      ...(r.mime === "application/pdf" && inline ? {} : { "content-security-policy": "sandbox; default-src 'none'" }),
      "cache-control": "private, max-age=86400",
    },
  };
}

/**
 * Whether this visitor may read the file, and the workspace it lives in. A file on a page follows that page's access
 * (or its public link, which needs no sign-in); a file with no page is for workspace members. Anything else is "not found".
 */
export async function authorizeFileRead(userId: string | null, fileId: string): Promise<string> {
  const [r] = await (await db()).query<{ workspace_id: string; page_id: string | null }>("select workspace_id, page_id from files where id = $1", [fileId]);
  if (!r) throw new NotFoundError("File not found.");
  if (r.page_id) {
    if (await isPublicPage(r.page_id)) return r.workspace_id;
    if (userId && (await accessTo(userId, r.page_id)).access !== "none") return r.workspace_id;
  } else if (userId && (await roleIn(userId, r.workspace_id))) return r.workspace_id;
  throw new NotFoundError("File not found.");
}
