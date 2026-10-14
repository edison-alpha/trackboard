import type * as Y from "yjs";
import { EDITOR_FIELD } from "@trackboard/shared";

/*
 * Types only from "yjs": the backend and this package each install their own copy, and `instanceof` across two copies
 * is false. Nodes are told apart by shape instead, so a Y.Doc from either copy reads the same.
 */
const isText = (n: unknown): n is Y.XmlText => typeof (n as Y.XmlText).toDelta === "function";
const isElement = (n: unknown): n is Y.XmlElement => typeof (n as Y.XmlElement).nodeName === "string";

/** ProseMirror node in its JSON form (what `editor.getJSON()` returns). */
export type PmNode = { type: string; attrs?: Record<string, unknown>; content?: PmNode[]; marks?: { type: string; attrs?: Record<string, unknown> }[]; text?: string };

const hasKeys = (o: object) => Object.keys(o).length > 0;

function textNodes(text: Y.XmlText): PmNode[] {
  const out: PmNode[] = [];
  for (const op of text.toDelta() as { insert: unknown; attributes?: Record<string, unknown> }[]) {
    if (typeof op.insert !== "string" || op.insert === "") continue;
    const marks = Object.entries(op.attributes ?? {}).map(([type, attrs]) => {
      const a = attrs && typeof attrs === "object" ? (attrs as Record<string, unknown>) : {};
      return hasKeys(a) ? { type, attrs: a } : { type };
    });
    out.push({ type: "text", text: op.insert, ...(marks.length && { marks }) });
  }
  return out;
}

function children(parent: Y.XmlFragment | Y.XmlElement): PmNode[] {
  const out: PmNode[] = [];
  for (const child of parent.toArray()) {
    if (isText(child)) out.push(...textNodes(child));
    else if (isElement(child)) out.push(element(child));
  }
  return out;
}

function element(el: Y.XmlElement): PmNode {
  const attrs = el.getAttributes() as Record<string, unknown>;
  const content = children(el);
  return { type: el.nodeName, ...(hasKeys(attrs) && { attrs }), ...(content.length && { content }) };
}

/**
 * The page content as ProseMirror JSON, read straight from the Yjs fragment so the server needs no editor schema.
 * Same shape as `editor.getJSON()`: the read copy that search, export and previews work from.
 */
export function ydocToJson(doc: Y.Doc, field = EDITOR_FIELD): PmNode {
  const content = children(doc.getXmlFragment(field));
  return { type: "doc", ...(content.length && { content }) };
}

/** Plain text of a document, one line per block, for search and "last edited". */
export function jsonToText(node: PmNode): string {
  const lines: string[] = [];
  const walk = (n: PmNode, line: { text: string }) => {
    if (n.type === "text") {
      line.text += n.text ?? "";
      return;
    }
    const blockLevel = n.content?.some((c) => c.type !== "text") === false;
    if (blockLevel && n.type !== "doc") {
      const own = { text: "" };
      n.content?.forEach((c) => walk(c, own));
      lines.push(own.text);
      return;
    }
    n.content?.forEach((c) => walk(c, line));
  };
  walk(node, { text: "" });
  return lines.join("\n").trim();
}

export const MAX_TEXT_CHARS = 20_000;

export function ydocToText(doc: Y.Doc, field = EDITOR_FIELD): string {
  return jsonToText(ydocToJson(doc, field)).slice(0, MAX_TEXT_CHARS);
}

/** True when two Yjs states describe the same content. Used to skip pointless snapshots. */
export function sameState(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
