"use client";

import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";
import { DownloadSimple, X } from "@/components/icons";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { formatBytes } from "@/lib/files";
import { fileExt, fileIcon, fileLabel, filePreviewKind } from "@/lib/file-type";
import { closeFilePreview, useFilePreview } from "../lib/file-preview-store";

/** The body for text, code and Markdown: fetched from the server with the session, since the file is no longer inside the document. */
function TextPreview({ src }: { src: string }) {
  const [text, setText] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    setText(undefined);
    fetch(src, { credentials: "include" })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((t) => alive && setText(t))
      .catch(() => alive && setText(null));
    return () => {
      alive = false;
    };
  }, [src]);
  if (text === undefined) return <p className="p-4 text-sm text-ink-3">Loading…</p>;
  if (text === null) return <Unsupported reason="This file couldn't be read as text." />;
  return <pre className="thin-scroll h-full overflow-auto rounded-(--radius-card) bg-surface-2 p-4 text-[13px] leading-relaxed whitespace-pre-wrap text-ink">{text}</pre>;
}

function Unsupported({ reason }: { reason: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 text-center text-ink-3">
      <p className="text-sm">{reason}</p>
      <p className="text-sm">Download it to open it in its own app.</p>
    </div>
  );
}

/**
 * Full-page preview for an attached file. Recognises every common file family (PDF, Office, image, audio,
 * video, text/code/Markdown) and renders what the browser can actually show; anything else falls back to a
 * clear "download to open" state instead of pretending to preview it.
 */
export function FilePreviewDialog() {
  const file = useFilePreview();
  const open = !!file;

  const kind = file ? filePreviewKind(file.name, file.mime) : "other";
  const label = file ? fileLabel(file.name, file.mime) : "";
  const icon = file ? fileIcon(file.name, file.mime) : "";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && closeFilePreview()}
      title={file?.name ?? "File preview"}
      bare
      className="h-[100dvh] max-h-[100dvh] w-full rounded-none sm:h-[92dvh] sm:max-h-[92dvh] sm:max-w-5xl sm:rounded-(--radius-panel)"
    >
      {file && (
        <div className="flex min-h-0 flex-1 flex-col">
          <header className="flex shrink-0 items-center gap-3 border-b border-line px-5 py-3.5">
            <Icon icon={icon} width={26} height={26} className="shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-ink">{file.name}</p>
              <p className="text-xs text-ink-3">
                {label} · {formatBytes(file.size)}
              </p>
            </div>
            <a href={file.src} download={file.name}>
              <Button variant="ghost" size="sm" icon={<DownloadSimple size={16} />}>
                Download
              </Button>
            </a>
            <IconButton label="Close" size="sm" onClick={closeFilePreview}>
              <X size={16} />
            </IconButton>
          </header>

          <div className="min-h-0 flex-1 overflow-auto bg-surface-2 p-3 sm:p-5">
            {kind === "pdf" && <iframe src={file.src} title={file.name} className="h-full min-h-[70vh] w-full rounded-(--radius-card) border border-line bg-white" />}
            {kind === "image" && (
              <div className="flex h-full min-h-[70vh] items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={file.src} alt={file.name} decoding="async" className="max-h-full max-w-full rounded-(--radius-card) object-contain" />
              </div>
            )}
            {kind === "audio" && (
              <div className="flex h-full min-h-[40vh] items-center justify-center">
                <audio controls src={file.src} className="w-full max-w-md" />
              </div>
            )}
            {kind === "video" && (
              <div className="flex h-full min-h-[70vh] items-center justify-center">
                <video controls src={file.src} className="max-h-full max-w-full rounded-(--radius-card)" />
              </div>
            )}
            {kind === "text" && (
              <div className="h-full min-h-[70vh]">
                <TextPreview src={file.src} />
              </div>
            )}
            {(kind === "office" || kind === "archive" || kind === "other") && (
              <div className="flex h-full min-h-[70vh] flex-col items-center justify-center gap-4">
                <Icon icon={icon} width={72} height={72} />
                <Unsupported reason={kind === "archive" ? "Archives can't be previewed in the browser." : `${label} files can't be previewed in the browser${fileExt(file.name) ? ` (.${fileExt(file.name)})` : ""}.`} />
              </div>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}
