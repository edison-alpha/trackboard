"use client";

import { Heading as HeadingExtension } from "@tiptap/extension-heading";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { cx } from "@/lib/cx";

type HeadingAttrs = { level: 1 | 2 | 3 | 4; folded: boolean };
type HeadingTag = "h1" | "h2" | "h3" | "h4";

/** A block right after a heading counts as foldable content unless it's itself a heading at the same level or shallower. */
function isFoldStop(node: PMNode, level: number): boolean {
  return node.type.name === "heading" && (node.attrs.level as number) <= level;
}

export function hasFoldableContent(parent: PMNode, index: number, level: number): boolean {
  const next = parent.maybeChild(index + 1);
  return !!next && !isFoldStop(next, level);
}

function HeadingView({ node }: ReactNodeViewProps) {
  const { level, folded } = node.attrs as HeadingAttrs;
  const Tag = `h${level}` as HeadingTag;

  return (
    <NodeViewWrapper as={Tag} className={cx("tb-heading", folded && "is-folded")} data-drag-handle>
      <NodeViewContent<"span"> as="span" className="tb-heading-text" />
    </NodeViewWrapper>
  );
}

const foldPluginKey = new PluginKey("headingFold");

/** Positions decorations for every block hidden under a folded heading: the heading's following siblings,
 * at whatever depth they live (blockquote, callout, columns, …), up to the next heading of the same or a
 * shallower level. */
function foldDecorations(doc: PMNode): DecorationSet {
  const decorations: Decoration[] = [];

  function walk(parent: PMNode, contentStart: number) {
    const children: { node: PMNode; pos: number }[] = [];
    parent.forEach((node, offset) => children.push({ node, pos: contentStart + offset }));

    for (let i = 0; i < children.length; i++) {
      const { node, pos } = children[i]!;
      if (node.type.name === "heading" && node.attrs.folded) {
        const level = node.attrs.level as number;
        let end = i + 1;
        while (end < children.length && !isFoldStop(children[end]!.node, level)) end++;
        for (let k = i + 1; k < end; k++) {
          const hidden = children[k]!;
          decorations.push(Decoration.node(hidden.pos, hidden.pos + hidden.node.nodeSize, { class: "tb-folded-hidden" }));
        }
      }
      if (node.isBlock && !node.isTextblock && !node.isAtom && node.content.size > 0) walk(node, pos + 1);
    }
  }

  walk(doc, 0);
  return DecorationSet.create(doc, decorations);
}

/**
 * Notion-style collapsible headings. Hovering the block handle of a heading that has content under it turns
 * the grip into a caret (see BlockHandle); clicking it folds everything up to the next heading of the same or a shallower level. Folded
 * state is a node attribute, so it round-trips through collaboration and survives reloads.
 */
export const Heading = HeadingExtension.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      folded: {
        default: false,
        parseHTML: (el) => el.getAttribute("data-folded") === "true",
        renderHTML: (attrs) => (attrs.folded ? { "data-folded": "true" } : {}),
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(HeadingView);
  },
  addProseMirrorPlugins() {
    return [
      ...(this.parent?.() ?? []),
      new Plugin({
        key: foldPluginKey,
        props: { decorations: (state) => foldDecorations(state.doc) },
      }),
    ];
  },
});
