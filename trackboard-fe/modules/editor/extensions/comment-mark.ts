import { Mark, mergeAttributes } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    comment: {
      setComment: (threadId: string) => ReturnType;
      unsetCommentThread: (threadId: string) => ReturnType;
      setCommentResolved: (threadId: string, resolved: boolean) => ReturnType;
    };
  }
}

type CommentOptions = { onActivate: (threadId: string) => void };

/**
 * Anchors a comment thread to a text range. Thread contents live in the workspace doc
 * (modules/comments); the mark only stores the thread id so it travels with the text when edited.
 */
export const CommentMark = Mark.create<CommentOptions>({
  name: "comment",
  inclusive: false,
  excludes: "",

  addOptions() {
    return { onActivate: () => {} };
  },

  addAttributes() {
    return {
      threadId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-thread"),
        renderHTML: (attrs) => ({ "data-thread": attrs.threadId }),
      },
      resolved: {
        default: false,
        parseHTML: (el) => el.getAttribute("data-resolved") === "true",
        renderHTML: (attrs) => ({ "data-resolved": String(attrs.resolved) }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-thread]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { class: "tb-comment" }), 0];
  },

  addCommands() {
    return {
      setComment:
        (threadId) =>
        ({ commands }) =>
          commands.setMark(this.name, { threadId }),
      unsetCommentThread:
        (threadId) =>
        ({ tr, dispatch }) => {
          const type = this.type;
          tr.doc.descendants((node, pos) => {
            const mark = node.marks.find((m) => m.type === type && m.attrs.threadId === threadId);
            if (mark) tr.removeMark(pos, pos + node.nodeSize, mark);
          });
          dispatch?.(tr);
          return true;
        },
      setCommentResolved:
        (threadId, resolved) =>
        ({ tr, dispatch }) => {
          const type = this.type;
          tr.doc.descendants((node, pos) => {
            const mark = node.marks.find((m) => m.type === type && m.attrs.threadId === threadId);
            if (mark && mark.attrs.resolved !== resolved) {
              tr.removeMark(pos, pos + node.nodeSize, mark);
              tr.addMark(pos, pos + node.nodeSize, type.create({ threadId, resolved }));
            }
          });
          dispatch?.(tr);
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const onActivate = this.options.onActivate;
    return [
      new Plugin({
        props: {
          handleClick(_view: unknown, _pos: number, event: MouseEvent) {
            const el = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-thread]");
            const id = el?.dataset.thread;
            if (id) onActivate(id);
            return false;
          },
        },
      }),
    ];
  },
});
