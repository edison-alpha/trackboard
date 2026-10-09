export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

export class FileTooLargeError extends Error {
  constructor(public readonly bytes: number) {
    super(`File ${(bytes / 1024 / 1024).toFixed(1)} MB, the limit is ${MAX_IMAGE_BYTES / 1024 / 1024} MB`);
  }
}

/** Reads an image into a data URL. Images live inside the document until trackboard-be adds file storage. */
export function readImage(file: File): Promise<string> {
  if (file.size > MAX_IMAGE_BYTES) return Promise.reject(new FileTooLargeError(file.size));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Couldn't read the file"));
    reader.readAsDataURL(file);
  });
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

export const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Reads any file into a data URL for an attachment block (kept in the document until trackboard-be adds storage). */
export function readFile(file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) return Promise.reject(new Error(`File ${(file.size / 1024 / 1024).toFixed(1)} MB, the limit is ${MAX_FILE_BYTES / 1024 / 1024} MB`));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Couldn't read the file"));
    reader.readAsDataURL(file);
  });
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
