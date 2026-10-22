"use client";

import { mergeAttributes, Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { useState } from "react";
import { PencilSimple } from "@/components/icons";
import { cx } from "@/lib/cx";
import { CanvasDialog, CanvasPreview, parseScene } from "@/modules/canvas";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    canvas: { setCanvas: () => ReturnType };
  }
}

/** A drawing board inside the page: a picture of the scene here, the full editor in a dialog. */
function CanvasView({ node, selected, updateAttributes, editor }: ReactNodeViewProps) {
  const scene = (node.attrs.scene as string) ?? "";
  const [open, setOpen] = useState(false);
  const empty = parseScene(scene).shapes.length === 0;
  const editable = editor.isEditable;
  return (
    <NodeViewWrapper className={cx("tb-canvas", selected && "is-selected")} data-drag-handle>
      <div className="tb-canvas-frame" contentEditable={false}>
        <button type="button" className="tb-canvas-open" onClick={() => setOpen(true)} aria-label={editable ? "Edit canvas" : "Open canvas"}>
          {empty ? <span className="tb-canvas-empty">{editable ? "Empty canvas. Click to start drawing." : "Empty canvas."}</span> : <CanvasPreview scene={scene} />}
        </button>
        <div className="tb-canvas-bar">
          <span>Canvas</span>
          <button type="button" onClick={() => setOpen(true)}>
            <PencilSimple size={14} />
            {editable ? "Edit" : "Open"}
          </button>
        </div>
      </div>
      {open && <CanvasDialog open={open} onOpenChange={setOpen} scene={scene} readOnly={!editable} onChange={(next) => updateAttributes({ scene: next })} />}
    </NodeViewWrapper>
  );
}

export const CanvasBlock = Node.create({
  name: "canvas",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes: () => ({
    scene: { default: "", rendered: false },
  }),
  parseHTML: () => [{ tag: 'div[data-type="canvas"]', getAttrs: (el) => ({ scene: (el as HTMLElement).dataset.scene ?? "" }) }],
  renderHTML: ({ HTMLAttributes, node }) => ["div", mergeAttributes(HTMLAttributes, { "data-type": "canvas", "data-scene": node.attrs.scene })],
  renderMarkdown: () => "[Canvas drawing]\n",
  addNodeView: () => ReactNodeViewRenderer(CanvasView),
  addCommands() {
    return {
      setCanvas:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name }),
    };
  },
});
