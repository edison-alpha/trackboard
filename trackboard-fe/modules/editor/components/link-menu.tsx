"use client";

import { ArrowSquareOut, LinkBreak, PencilSimple } from "@/components/icons";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import type { Store } from "@/lib/store";

/** Small card under a link while the caret sits inside it: where it goes, open it, change it, remove it. */
export function LinkMenu({ editor, linkRequests }: { editor: Editor; linkRequests: Store<number> }) {
  const href = useEditorState({ editor, selector: ({ editor: e }) => (e.isActive("link") ? String(e.getAttributes("link").href ?? "") : "") });

  const edit = () => {
    // The selection toolbar owns the link form, so select the whole link and ask it to open in link mode.
    editor.chain().focus().extendMarkRange("link").run();
    linkRequests.set((n) => n + 1);
  };

  const button = "inline-flex size-8 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-surface-2/80 hover:text-ink pointer-coarse:size-10";

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="linkMenu"
      appendTo={() => document.body}
      options={{ strategy: "fixed", placement: "bottom-start", offset: 8, flip: true, shift: { padding: 12 } }}
      shouldShow={({ editor: e, state }) => e.isEditable && state.selection.empty && e.isActive("link")}
      className="floating z-40 flex max-w-[calc(100vw-24px)] items-center gap-0.5 rounded-(--radius-menu) p-1"
    >
      <span className="max-w-64 truncate px-2 text-sm text-ink-2" title={href}>
        {href}
      </span>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open link"
        title="Open link"
        className={button}
        onMouseDown={(e) => e.preventDefault()}
      >
        <ArrowSquareOut size={16} />
      </a>
      <button type="button" aria-label="Edit link" title="Edit link (Ctrl/⌘ K)" className={button} onMouseDown={(e) => e.preventDefault()} onClick={edit}>
        <PencilSimple size={16} />
      </button>
      <button
        type="button"
        aria-label="Remove link"
        title="Remove link"
        className={button}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().extendMarkRange("link").unsetLink().run()}
      >
        <LinkBreak size={16} />
      </button>
    </BubbleMenu>
  );
}
