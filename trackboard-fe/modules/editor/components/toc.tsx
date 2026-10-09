"use client";

import type { TableOfContentDataItem } from "@tiptap/extension-table-of-contents";
import type { Editor } from "@tiptap/react";
import { cx } from "@/lib/cx";

/** Outline of the page's headings. The heading in view is marked; clicking jumps to it. */
export function TableOfContents({ items, editor }: { items: TableOfContentDataItem[]; editor: Editor | null }) {
  if (items.length < 2) return null;

  const jump = (item: TableOfContentDataItem) => {
    if (!editor) return;
    const el = editor.view.dom.querySelector(`[data-toc-id="${item.id}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    editor.chain().setTextSelection(item.pos + 1).run();
  };

  return (
    <nav aria-label="Table of contents" className="text-[13px]">
      <p className="mb-2 px-2 font-semibold text-ink-3">On this page</p>
      <ul className="grid gap-0.5">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => jump(item)}
              className={cx(
                "w-full truncate rounded-lg py-1 pr-2 text-left transition-colors hover:bg-surface-2 hover:text-ink",
                item.isActive && !item.isScrolledOver ? "font-medium text-accent-ink" : "text-ink-2",
              )}
              style={{ paddingLeft: 8 + (item.level - 1) * 12 }}
            >
              {item.textContent || "Empty heading"}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
