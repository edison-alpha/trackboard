"use client";

import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import { Markdown } from "@tiptap/markdown";
import { EditorContent, useEditor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { cx } from "@/lib/cx";

/**
 * Renders Markdown with the editor's own typography, read-only. Used for AI previews and answers,
 * so what you see is what lands in the page. Links to /p/... navigate inside the app.
 */
export function MarkdownView({ markdown, className }: { markdown: string; className?: string }) {
  const router = useRouter();
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: [StarterKit.configure({ link: { openOnClick: false } }), TaskList, TaskItem.configure({ nested: true }), TableKit, Markdown],
    editorProps: { attributes: { class: "tb-prose tb-prose-compact" } },
  });

  // Streaming updates arrive per token; render at most once per frame.
  const frame = useRef(0);
  useEffect(() => {
    if (!editor) return;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => editor.commands.setContent(markdown, { contentType: "markdown", emitUpdate: false }));
    return () => cancelAnimationFrame(frame.current);
  }, [editor, markdown]);

  return (
    <div
      className={cx("min-w-0", className)}
      onClick={(e) => {
        const a = (e.target as HTMLElement).closest("a[href]");
        const href = a?.getAttribute("href");
        if (!href) return;
        e.preventDefault();
        if (href.startsWith("/")) router.push(href);
        else window.open(href, "_blank", "noopener");
      }}
    >
      <EditorContent editor={editor} />
    </div>
  );
}
