import type { Editor } from "@tiptap/react";
import type { AiApply } from "./actions";

export type Range = { from: number; to: number };

/* Reading from and writing to the editor for AI runs. Every write is one transaction, so a single
   undo reverts it and collaborators receive it like any other edit. */

const BLOCK_SYNTAX = /^(#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s|\||```|- \[[ x]\])/m;

/** A one-line answer without Markdown blocks goes in as plain text, so it stays inside the current paragraph. */
const isInline = (text: string) => !text.includes("\n") && !BLOCK_SYNTAX.test(text);

export const selectionText = (editor: Editor, r: Range) => editor.state.doc.textBetween(r.from, r.to, "\n");

/** Text above a position, last few thousand characters only (enough context for "continue"). */
export const textBefore = (editor: Editor, pos: number, limit = 4000) => editor.state.doc.textBetween(0, pos, "\n").slice(-limit);

export const pageMarkdown = (editor: Editor) => editor.getMarkdown();

/** End of the top-level block that contains `pos`. */
function blockEnd(editor: Editor, pos: number): number {
  const $pos = editor.state.doc.resolve(Math.min(pos, editor.state.doc.content.size));
  return $pos.depth >= 1 ? $pos.after(1) : editor.state.doc.content.size;
}

/**
 * A triple-click or drag that ends at the very start of the next block would pull that block into the
 * replacement. Pull the end back to the last character of the block the selection really covers.
 */
function trimRange(editor: Editor, r: Range): Range {
  let to = r.to;
  const $to = editor.state.doc.resolve(to);
  if (to > r.from && $to.parentOffset === 0 && $to.depth >= 1) to = Math.max(r.from, $to.before() - 1);
  return { from: r.from, to };
}

export function applyResult(editor: Editor, mode: AiApply, text: string, rawRange: Range): void {
  const range = trimRange(editor, rawRange);
  const md = text.trim();
  if (!md) return;
  const asMarkdown = { contentType: "markdown" as const };
  const chain = editor.chain().focus();

  switch (mode) {
    case "replace":
      if (isInline(md)) chain.insertContentAt(range, md).run();
      else chain.insertContentAt(range, md, asMarkdown).run();
      return;
    case "insert-below":
      chain.insertContentAt(blockEnd(editor, range.to), md, asMarkdown).run();
      return;
    case "at-cursor": {
      const $from = editor.state.doc.resolve(range.from);
      const block = $from.depth >= 1 ? $from.node(1) : null;
      // On an empty line the result takes the line's place; otherwise it goes below the current block.
      if (block && block.textContent.trim() === "" && $from.depth >= 1) chain.insertContentAt({ from: $from.before(1), to: $from.after(1) }, md, asMarkdown).run();
      else chain.insertContentAt(blockEnd(editor, range.from), md, asMarkdown).run();
      return;
    }
    case "page-top": {
      // The summary goes in as one Note callout built from the parsed Markdown, so lists inside it stay lists.
      const parsed = editor.markdown?.parse(md);
      const blocks = parsed?.content?.length ? parsed.content : [{ type: "paragraph", content: [{ type: "text", text: md }] }];
      editor.chain().focus().insertContentAt(0, { type: "callout", attrs: { tone: "info" }, content: blocks }).setTextSelection(1).run();
      return;
    }
    case "page-end":
      chain.insertContentAt(editor.state.doc.content.size, md, asMarkdown).run();
      return;
    case "replace-page":
      editor.chain().focus().setContent(md, asMarkdown).run();
      return;
    case "title":
    case "none":
      return;
  }
}
