"use client";

import type { TableOfContentData } from "@tiptap/extension-table-of-contents";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { ySyncPluginKey } from "@tiptap/y-tiptap";
import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { readFile, readImage } from "@/lib/files";
import { openAi } from "@/modules/ai/lib/ai-store";
import { createStore } from "@/lib/store";
import type { CollabDoc } from "@/modules/collab";
import { buildExtensions, type CollabUser } from "../extensions";
import type { MentionSources } from "../extensions/mention";
import type { EditorContext } from "../lib/slash-items";
import { BlockHandle } from "./block-handle";
import { BubbleMenu } from "./bubble-menu";
import { TableMenu } from "./table-menu";

type Props = {
  collab: CollabDoc;
  user: CollabUser;
  context: Omit<EditorContext, "pickImage" | "pickFile">;
  mentions: MentionSources;
  /** HTML to fill the page with the first time it opens empty. */
  template: string | null;
  onTemplateApplied: () => void;
  /** Plain text after local edits (debounced), for search and "last edited". */
  onLocalChange: (text: string) => void;
  onTocUpdate: (data: TableOfContentData) => void;
  onComment: (editor: Editor) => void;
  onCommentActivate: (threadId: string) => void;
  onReady: (editor: Editor | null) => void;
};

const TEXT_DEBOUNCE_MS = 700;

/** The collaborative page editor: Tiptap bound to the page's Y.Doc, with its menus and handles. */
export function DocEditor(p: Props) {
  const latest = useRef(p);
  latest.current = p;
  const linkRequests = useMemo(() => createStore(0), []);
  const editorRef = useRef<Editor | null>(null);
  const textTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const insertImages = (editor: Editor, files: File[], pos?: number) => {
    for (const file of files) {
      readImage(file).then(
        (src) => {
          const at = pos ?? editor.state.selection.to;
          editor.chain().insertContentAt(at, { type: "image", attrs: { src, alt: file.name } }).focus().run();
        },
        (err: Error) => toast.error(`Couldn't insert the image: ${err.message}`),
      );
    }
  };

  const editor = useEditor(
    {
      immediatelyRender: false,
      shouldRerenderOnTransaction: false,
      extensions: buildExtensions({
        collab: { doc: p.collab.doc, provider: p.collab.provider, user: p.user },
        context: {
          ...p.context,
          pickFile: (e) => {
            const input = Object.assign(document.createElement("input"), { type: "file" });
            input.onchange = () => {
              const file = input.files?.[0];
              if (!file) return;
              readFile(file).then(
                (src) => e.chain().focus().setFileBlock({ src, name: file.name, size: file.size, mime: file.type }).run(),
                (err: Error) => toast.error(`Couldn't attach the file: ${err.message}`),
              );
            };
            input.click();
          },
          pickImage: (e) => {
            const input = Object.assign(document.createElement("input"), { type: "file", accept: "image/*", multiple: true });
            input.onchange = () => insertImages(e, [...(input.files ?? [])]);
            input.click();
          },
        },
        mentions: p.mentions,
        onImageFiles: (files, pos) => editorRef.current && insertImages(editorRef.current, files, pos),
        onTocUpdate: (d) => latest.current.onTocUpdate(d),
        onCommentActivate: (id) => latest.current.onCommentActivate(id),
        onLinkRequest: () => linkRequests.set((n) => n + 1),
        onAiRequest: () => {
          const e = editorRef.current;
          if (!e) return;
          const { from, to, empty } = e.state.selection;
          openAi({ scope: empty ? "write" : "selection", range: { from, to } });
        },
      }),
      editorProps: {
        attributes: { class: "tb-prose", "aria-label": "Page content", spellcheck: "true" },
        // Links open with Ctrl/⌘+click so a plain click keeps editing the text.
        handleClick: (_view, _pos, event) => {
          const a = (event.target as HTMLElement).closest("a[href]");
          if (a && (event.metaKey || event.ctrlKey) && !a.closest("[data-type='mention']")) {
            window.open(a.getAttribute("href") ?? "", "_blank", "noopener");
            return true;
          }
          return false;
        },
      },
      onUpdate: ({ editor: e, transaction }) => {
        const remote = transaction.getMeta(ySyncPluginKey)?.isChangeOrigin;
        if (remote) return;
        clearTimeout(textTimer.current);
        textTimer.current = setTimeout(() => latest.current.onLocalChange(e.getText({ blockSeparator: "\n" }).slice(0, 20000)), TEXT_DEBOUNCE_MS);
      },
    },
    [p.collab],
  );

  editorRef.current = editor;

  useEffect(() => {
    latest.current.onReady(editor);
    return () => latest.current.onReady(null);
  }, [editor]);

  useEffect(() => () => clearTimeout(textTimer.current), []);

  // Fill a brand-new page from its template once, only if nobody has typed into it yet.
  useEffect(() => {
    if (!editor || !p.template) return;
    if (editor.isEmpty) editor.commands.setContent(p.template);
    latest.current.onTemplateApplied();
  }, [editor, p.template]);

  if (!editor) return <div className="tb-prose min-h-[40vh]" aria-busy="true" />;

  return (
    <>
      <EditorContent editor={editor} />
      <BubbleMenu editor={editor} linkRequests={linkRequests} onComment={() => p.onComment(editor)} />
      <TableMenu editor={editor} />
      <BlockHandle editor={editor} />
    </>
  );
}
