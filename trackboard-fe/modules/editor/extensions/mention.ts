import { Mention } from "@tiptap/extension-mention";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { MentionMenu, type MentionItem } from "../components/mention-menu";
import { MentionView } from "../components/mention-view";
import { suggestionRenderer } from "../lib/suggestion-renderer";

export type MentionSources = {
  pages: () => { id: string; title: string; icon: string | null }[];
  people: () => { id: string; name: string; color: string }[];
};

type MentionKind = "person" | "page";

/** Set by the slash menu so "Mention person" / "Link to page" list only that kind; cleared when the popup closes. */
const onlyKind = new WeakMap<object, MentionKind>();
export const limitMentionsTo = (editor: object, kind: MentionKind) => void onlyKind.set(editor, kind);

/** "@" links to another page or names a collaborator. Ids are prefixed "page:" / "user:". */
export function createMention(sources: MentionSources) {
  return Mention.extend({
    addNodeView() {
      return ReactNodeViewRenderer(MentionView, { as: "span" });
    },
  }).configure({
    deleteTriggerWithBackspace: true,
    renderText: ({ node }) => `@${node.attrs.label ?? ""}`,
    renderHTML: ({ node, options }) => {
      const id = String(node.attrs.id ?? "");
      const tag = id.startsWith("page:") ? "a" : "span";
      return [tag, { ...options.HTMLAttributes, "data-type": "mention", "data-id": id, ...(tag === "a" && { href: `/p/${id.slice(5)}` }) }, `@${node.attrs.label ?? ""}`];
    },
    suggestion: {
      char: "@",
      items: ({ query, editor }): MentionItem[] => {
        const q = query.toLowerCase();
        const kind = onlyKind.get(editor);
        const people = (kind === "page" ? [] : sources.people())
          .filter((p) => p.name.toLowerCase().includes(q))
          .slice(0, 5)
          .map((p) => ({ id: `user:${p.id}`, label: p.name, kind: "person" as const, color: p.color }));
        const pages = (kind === "person" ? [] : sources.pages())
          .filter((p) => (p.title || "Untitled").toLowerCase().includes(q))
          .slice(0, 8)
          .map((p) => ({ id: `page:${p.id}`, label: p.title || "Untitled", kind: "page" as const, icon: p.icon }));
        return [...people, ...pages];
      },
      render: () => {
        const inner = suggestionRenderer(MentionMenu)!();
        return {
          ...inner,
          onExit(props) {
            onlyKind.delete(props.editor);
            inner.onExit?.(props);
          },
        };
      },
    },
  });
}
