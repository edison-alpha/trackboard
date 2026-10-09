"use client";

import { mergeAttributes, Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { LinkSimple } from "@/components/icons";
import { cx } from "@/lib/cx";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    bookmark: { setBookmark: (attrs: { url: string; title?: string }) => ReturnType };
  }
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** A link shown as a card: site, title (editable by the writer), full address. No preview is fetched. */
function BookmarkView({ node, selected, updateAttributes, editor }: ReactNodeViewProps) {
  const { url, title } = node.attrs as { url: string; title: string };
  return (
    <NodeViewWrapper className={cx("tb-bookmark", selected && "is-selected")} data-drag-handle>
      <div className="tb-bookmark-icon" aria-hidden="true">
        <LinkSimple size={18} />
      </div>
      <div className="min-w-0 flex-1" contentEditable={false}>
        {editor.isEditable ? (
          <input value={title} onChange={(e) => updateAttributes({ title: e.target.value })} placeholder={hostOf(url)} aria-label="Bookmark title" className="tb-bookmark-title" />
        ) : (
          <p className="tb-bookmark-title">{title || hostOf(url)}</p>
        )}
        <a href={url} target="_blank" rel="noopener noreferrer" className="tb-bookmark-url">
          {url}
        </a>
      </div>
    </NodeViewWrapper>
  );
}

export const Bookmark = Node.create({
  name: "bookmark",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes: () => ({ url: { default: "" }, title: { default: "" } }),
  parseHTML: () => [{ tag: 'div[data-type="bookmark"]', getAttrs: (el) => ({ url: (el as HTMLElement).dataset.url, title: (el as HTMLElement).dataset.title }) }],
  renderHTML: ({ HTMLAttributes, node }) => ["div", mergeAttributes(HTMLAttributes, { "data-type": "bookmark", "data-url": node.attrs.url, "data-title": node.attrs.title })],
  renderMarkdown: (node) => `[${node.attrs?.title || node.attrs?.url}](${node.attrs?.url ?? ""})\n`,
  addNodeView: () => ReactNodeViewRenderer(BookmarkView),
  addCommands() {
    return {
      setBookmark:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { url: attrs.url, title: attrs.title ?? "" } }),
    };
  },
});
