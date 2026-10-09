"use client";

import { mergeAttributes, Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { useState } from "react";
import { ArrowsHorizontal, LinkSimple } from "@/components/icons";
import { cx } from "@/lib/cx";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    embed: { setEmbed: (attrs: { src: string; url: string; provider: string }) => ReturnType };
  }
}

/** A framed page from another service (Figma, Loom, Google Docs, ...), with the original link under it. */
function EmbedView({ node, selected, updateAttributes, editor }: ReactNodeViewProps) {
  const { src, url, provider, height } = node.attrs as { src: string; url: string; provider: string; height: number };
  const [loaded, setLoaded] = useState(false);
  return (
    <NodeViewWrapper className={cx("tb-embed", selected && "is-selected")} data-drag-handle>
      <div className="tb-embed-frame" style={{ height }}>
        {!loaded && <p className="tb-embed-loading">Loading {provider}…</p>}
        <iframe
          src={src}
          title={`${provider} embed`}
          loading="lazy"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
          onLoad={() => setLoaded(true)}
        />
      </div>
      <div className="tb-embed-bar" contentEditable={false}>
        <LinkSimple size={14} />
        <a href={url} target="_blank" rel="noopener noreferrer" className="truncate">
          {provider} · open original
        </a>
        {editor.isEditable && (
          <button type="button" title="Make taller" aria-label="Make the embed taller" onClick={() => updateAttributes({ height: height >= 900 ? 360 : height + 180 })}>
            <ArrowsHorizontal size={14} className="rotate-90" />
          </button>
        )}
      </div>
    </NodeViewWrapper>
  );
}

export const Embed = Node.create({
  name: "embed",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes: () => ({
    src: { default: "" },
    url: { default: "" },
    provider: { default: "Embed" },
    height: { default: 420 },
  }),
  parseHTML: () => [{ tag: 'div[data-type="embed"]', getAttrs: (el) => ({ src: (el as HTMLElement).dataset.src, url: (el as HTMLElement).dataset.url, provider: (el as HTMLElement).dataset.provider }) }],
  renderHTML: ({ HTMLAttributes, node }) => ["div", mergeAttributes(HTMLAttributes, { "data-type": "embed", "data-src": node.attrs.src, "data-url": node.attrs.url, "data-provider": node.attrs.provider })],
  renderMarkdown: (node) => `[${node.attrs?.provider ?? "Embed"}](${node.attrs?.url ?? ""})\n`,
  addNodeView: () => ReactNodeViewRenderer(EmbedView),
  addCommands() {
    return {
      setEmbed:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});
