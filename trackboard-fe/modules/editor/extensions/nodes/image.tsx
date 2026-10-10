"use client";

import { Image as ImageExtension } from "@tiptap/extension-image";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { ResizableMedia } from "../../components/resizable-media";

function ImageView({ node, selected, updateAttributes }: ReactNodeViewProps) {
  const { src, alt, title, width } = node.attrs as { src: string; alt: string | null; title: string | null; width?: number };
  return (
    <NodeViewWrapper className="tb-media-node" data-drag-handle>
      <ResizableMedia widthPct={typeof width === "number" ? width : 100} onResize={(pct) => updateAttributes({ width: pct })} selected={selected}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt ?? ""} title={title ?? undefined} className="tb-image" draggable={false} />
      </ResizableMedia>
    </NodeViewWrapper>
  );
}

/** Adds a resizable width (percent of the column, dragged from either edge) on top of the stock Image node. */
export const Image = ImageExtension.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: 100,
        parseHTML: (el) => {
          const value = el.getAttribute("data-width");
          return value ? Number(value) : 100;
        },
        renderHTML: (attrs) => (attrs.width && attrs.width !== 100 ? { "data-width": attrs.width } : {}),
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },
});
