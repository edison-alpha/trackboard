import { Extension, type Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";

type Options = { onLinkRequest: () => void; onAiRequest: () => void };

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    blockActions: {
      /** Moves the top-level block at `pos` (default: the caret's block) up or down one place. */
      moveBlock: (dir: -1 | 1, pos?: number) => ReturnType;
      duplicateBlock: (pos?: number) => ReturnType;
      deleteBlock: (pos?: number) => ReturnType;
    };
  }
}

/** The top-level block at a document position, with its start offset. */
export function topBlockAt(editor: Editor, pos?: number): { node: PMNode; start: number; index: number } | null {
  const { doc, selection } = editor.state;
  const $pos = doc.resolve(pos === undefined ? selection.from : Math.min(pos + 1, doc.content.size));
  if ($pos.depth < 1 && pos === undefined) return null;
  const index = $pos.depth >= 1 ? $pos.index(0) : $pos.index(0);
  const node = doc.maybeChild(index);
  if (!node) return null;
  let start = 0;
  for (let i = 0; i < index; i++) start += doc.child(i).nodeSize;
  return { node, start, index };
}

/**
 * Block-level commands on top of Tiptap's defaults, shared by the keyboard, the slash menu and the block menu:
 * Mod+Shift+↑/↓ move a block, Mod+D duplicates it, Mod+K with a selection, or the caret in a link, edits the link, Mod+J opens AI.
 */
export const BlockActions = Extension.create<Options>({
  name: "blockActions",

  addOptions() {
    return { onLinkRequest: () => {}, onAiRequest: () => {} };
  },

  addCommands() {
    return {
      moveBlock:
        (dir, pos) =>
        ({ editor, state, dispatch }) => {
          const block = topBlockAt(editor, pos);
          if (!block) return false;
          const target = block.index + dir;
          if (target < 0 || target >= state.doc.childCount) return false;
          const neighbour = state.doc.child(target);
          const caret = state.selection.from - block.start;
          const tr = state.tr.delete(block.start, block.start + block.node.nodeSize);
          const insertAt = dir === -1 ? block.start - neighbour.nodeSize : block.start + neighbour.nodeSize;
          tr.insert(insertAt, block.node);
          const inside = Math.max(1, Math.min(caret, block.node.nodeSize - 1));
          tr.setSelection(TextSelection.near(tr.doc.resolve(insertAt + inside)));
          dispatch?.(tr.scrollIntoView());
          return true;
        },
      duplicateBlock:
        (pos) =>
        ({ editor, state, dispatch }) => {
          const block = topBlockAt(editor, pos);
          if (!block) return false;
          dispatch?.(state.tr.insert(block.start + block.node.nodeSize, block.node.copy(block.node.content)).scrollIntoView());
          return true;
        },
      deleteBlock:
        (pos) =>
        ({ editor, state, dispatch }) => {
          const block = topBlockAt(editor, pos);
          if (!block) return false;
          dispatch?.(state.tr.delete(block.start, block.start + block.node.nodeSize));
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Shift-ArrowUp": () => this.editor.commands.moveBlock(-1),
      "Mod-Shift-ArrowDown": () => this.editor.commands.moveBlock(1),
      "Mod-d": () => this.editor.commands.duplicateBlock(),
      "Mod-j": () => {
        this.options.onAiRequest();
        return true;
      },
      "Mod-k": () => {
        if (this.editor.state.selection.empty) {
          // A caret inside a link edits that link; anywhere else Mod+K belongs to the command palette.
          if (!this.editor.isActive("link")) return false;
          this.editor.commands.extendMarkRange("link");
        }
        this.options.onLinkRequest();
        return true;
      },
    };
  },
});
