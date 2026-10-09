"use client";

import { mergeAttributes, Node } from "@tiptap/core";
import type { TableOfContentDataItem } from "@tiptap/extension-table-of-contents";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { useEffect, useState } from "react";
import { cx } from "@/lib/cx";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    tocBlock: { insertTableOfContents: () => ReturnType };
  }
}

type TocStorage = { tableOfContents?: { content?: TableOfContentDataItem[] } };

/** The page's headings, kept up to date as people write. Click a heading to jump to it. */
function TocView({ editor, selected }: ReactNodeViewProps) {
  const read = () => ((editor.storage as unknown as TocStorage).tableOfContents?.content ?? []).slice();
  const [items, setItems] = useState<TableOfContentDataItem[]>(read);
  useEffect(() => {
    const update = () => setItems(read());
    update();
    editor.on("update", update);
    return () => void editor.off("update", update);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  return (
    <NodeViewWrapper className={cx("tb-toc", selected && "is-selected")} data-drag-handle>
      <nav aria-label="Table of contents" contentEditable={false}>
        <p className="tb-toc-title">Contents</p>
        {items.length === 0 ? (
          <p className="text-sm text-ink-3">Add headings to the page and they will be listed here.</p>
        ) : (
          <ol>
            {items.map((item) => (
              <li key={item.id} style={{ paddingLeft: (item.level - 1) * 16 }}>
                <button
                  type="button"
                  onClick={() => editor.view.dom.querySelector(`[data-toc-id="${item.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                >
                  {item.textContent || "Empty heading"}
                </button>
              </li>
            ))}
          </ol>
        )}
      </nav>
    </NodeViewWrapper>
  );
}

export const TocBlock = Node.create({
  name: "tocBlock",
  group: "block",
  atom: true,
  draggable: true,
  parseHTML: () => [{ tag: 'div[data-type="toc"]' }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-type": "toc" })],
  renderMarkdown: () => "",
  addNodeView: () => ReactNodeViewRenderer(TocView),
  addCommands() {
    return {
      insertTableOfContents:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name }),
    };
  },
});
