"use client";

import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { useEffect } from "react";
import type * as Y from "yjs";
import { buildExtensions } from "../extensions";

/** Read-only render of a stored document (version history preview). */
export function PreviewEditor({ doc, onReady }: { doc: Y.Doc; onReady?: (editor: Editor | null) => void }) {
  const editor = useEditor({ immediatelyRender: false, editable: false, extensions: buildExtensions({ previewDoc: doc }), editorProps: { attributes: { class: "tb-prose" } } }, [doc]);
  useEffect(() => {
    onReady?.(editor);
    return () => onReady?.(null);
  }, [editor, onReady]);
  return <EditorContent editor={editor} />;
}
