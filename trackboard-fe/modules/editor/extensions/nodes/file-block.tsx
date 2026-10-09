"use client";

import { mergeAttributes, Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { DownloadSimple, FileText } from "@/components/icons";
import { cx } from "@/lib/cx";
import { formatBytes } from "@/lib/files";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fileBlock: { setFileBlock: (attrs: { src: string; name: string; size: number; mime: string }) => ReturnType };
  }
}

/** An attached file: name, type and size, with a download link. */
function FileView({ node, selected }: ReactNodeViewProps) {
  const { src, name, size, mime } = node.attrs as { src: string; name: string; size: number; mime: string };
  const ext = name.includes(".") ? name.split(".").pop()?.toUpperCase() : (mime.split("/")[1] ?? "FILE").toUpperCase();
  return (
    <NodeViewWrapper className={cx("tb-file", selected && "is-selected")} data-drag-handle>
      <div className="tb-file-icon" aria-hidden="true">
        <FileText size={20} />
      </div>
      <div className="min-w-0 flex-1" contentEditable={false}>
        <p className="truncate font-medium">{name}</p>
        <p className="text-xs text-ink-3">
          {ext} · {formatBytes(size)}
        </p>
      </div>
      <a href={src} download={name} className="tb-file-download" aria-label={`Download ${name}`} title="Download" contentEditable={false}>
        <DownloadSimple size={17} />
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
