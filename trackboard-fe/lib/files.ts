import { api } from "@/lib/api/client";
import type { FileRecord } from "@/lib/api/types";

/** Same limit as the server, checked first so a too-large file fails before it is sent. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Uploads a file to the server and returns where it lives. Images and attachments keep that URL, not the bytes. */
export async function uploadFile(file: File): Promise<FileRecord> {
  if (file.size > MAX_FILE_BYTES) throw new Error(`File ${(file.size / 1024 / 1024).toFixed(1)} MB, the limit is ${MAX_FILE_BYTES / 1024 / 1024} MB`);
  const form = new FormData();
  form.set("file", file);
  return api<FileRecord>("/api/files", { form });
}

/** Triggers a browser download for generated text (Markdown export). */
export function downloadText(filename: string, text: string, type = "text/markdown"): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

/** Opens the OS file picker and resolves with the chosen file, or null when cancelled. */
export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = Object.assign(document.createElement("input"), { type: "file", accept });
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_]+/g, "-")
      .slice(0, 60) || "page"
  );
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
