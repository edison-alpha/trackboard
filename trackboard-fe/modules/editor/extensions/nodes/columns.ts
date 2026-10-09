import { mergeAttributes, Node } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    columns: {
      /** Inserts a row of 2 to 4 columns, each starting with an empty paragraph. */
      insertColumns: (count: 2 | 3 | 4) => ReturnType;
    };
  }
}

/** One column inside a Columns row. Holds any blocks. */
export const Column = Node.create({
  name: "column",
  content: "block+",
  isolating: true,
  defining: true,
  parseHTML: () => [{ tag: 'div[data-type="column"]' }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-type": "column" }), 0],
  renderMarkdown: (node, h) => h.renderChildren(node.content ?? [], "\n\n"),
});

/** Side-by-side layout. Columns stack on narrow screens (editor.css). */
export const Columns = Node.create({
  name: "columns",
  group: "block",
  content: "column{2,4}",
  defining: true,
  parseHTML: () => [{ tag: 'div[data-type="columns"]' }],
  renderHTML: ({ HTMLAttributes, node }) => ["div", mergeAttributes(HTMLAttributes, { "data-type": "columns", style: `--cols:${node.childCount}` }), 0],
  renderMarkdown: (node, h) => h.renderChildren(node.content ?? [], "\n\n"),

  addCommands() {
    return {
      insertColumns:
        (count) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            content: Array.from({ length: count }, () => ({ type: "column", content: [{ type: "paragraph" }] })),
          }),
    };
  },
});
