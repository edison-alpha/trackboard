import { mergeAttributes, Node } from "@tiptap/core";

export type CalloutTone = "info" | "warn" | "ok";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (tone?: CalloutTone) => ReturnType;
      setCalloutTone: (tone: CalloutTone) => ReturnType;
    };
  }
}

/** Highlighted block for notes, warnings and confirmations. The tone is text + icon, not colour alone. */
export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      tone: {
        default: "info" as CalloutTone,
        parseHTML: (el) => (el.getAttribute("data-tone") as CalloutTone) || "info",
        renderHTML: (attrs) => ({ "data-tone": attrs.tone }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const label = { info: "Note", warn: "Warning", ok: "Success" }[node.attrs.tone as CalloutTone] ?? "Note";
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "callout", role: "note", "aria-label": label }), 0];
  },

  addCommands() {
    return {
      setCallout:
        (tone = "info") =>
        ({ commands }) =>
          commands.wrapIn(this.name, { tone }),
      setCalloutTone:
        (tone) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, { tone }),
    };
  },

  renderMarkdown: (node, h) => `> **${{ info: "Note", warn: "Warning", ok: "Success" }[node.attrs?.tone as CalloutTone] ?? "Note"}**\n>\n> ${h.renderChildren(node.content ?? [], "\n").replace(/\n/g, "\n> ")}\n`,
});
