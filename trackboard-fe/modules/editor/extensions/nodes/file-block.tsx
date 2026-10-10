"use client";

import { Icon } from "@iconify/react";
import { mergeAttributes, Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { DownloadSimple } from "@/components/icons";
import { cx } from "@/lib/cx";
import { fileIcon, fileLabel } from "@/lib/file-type";
import { formatBytes } from "@/lib/files";
import { openFilePreview } from "../../lib/file-preview-store";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fileBlock: { setFileBlock: (attrs: { src: string; name: string; size: number; mime: string }) => ReturnType };
  }
}

/** An attached file: a type-matched icon (PDF, Word, Excel, image, …), name and size. Click opens the full
 * preview; the download link sits to the side so it doesn't fight that click. */
function FileView({ node, selected }: ReactNodeViewProps) {
  const { src, name, size, mime } = node.attrs as { src: string; name: string; size: number; mime: string };
  return (
    <NodeViewWrapper className={cx("tb-file", selected && "is-selected")} data-drag-handle>
      <button type="button" className="tb-file-open" onClick={() => openFilePreview({ src, name, size, mime })} contentEditable={false}>
        <span className="tb-file-icon" aria-hidden="true">
          <Icon icon={fileIcon(name, mime)} width={22} height={22} />
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate font-medium">{name}</span>
          <span className="block text-xs text-ink-3">
            {fileLabel(name, mime)} · {formatBytes(size)}
          </span>
        </span>
      </button>
      <a href={src} download={name} className="tb-file-download" aria-label={`Download ${name}`} title="Download" contentEditable={false} onClick={(e) => e.stopPropagation()}>
        <DownloadSimple size={16} />
      </a>
    </NodeViewWrapper>
  );
}

export const FileBlock = Node.create({
  name: "fileBlock",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes: () => ({ src: { default: "" }, name: { default: "file" }, size: { default: 0 }, mime: { default: "" } }),
  parseHTML: () => [{ tag: 'div[data-type="file"]' }],
  renderHTML: ({ HTMLAttributes, node }) => ["div", mergeAttributes(HTMLAttributes, { "data-type": "file", "data-name": node.attrs.name }), node.attrs.name],
  renderMarkdown: (node) => `[File: ${node.attrs?.name ?? "file"}]\n`,
  addNodeView: () => ReactNodeViewRenderer(FileView),
  addCommands() {
    return {
      setFileBlock:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});
