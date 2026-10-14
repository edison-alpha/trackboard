import type { Editor } from "@tiptap/core";

const TONES: Record<string, "info" | "warn" | "ok"> = { Note: "info", Warning: "warn", Success: "ok" };

/**
 * Callouts export as a quote that opens with a bold label ("> **Warning**"). Markdown has no callout block, so an
 * imported file arrives as plain quotes; this turns the ones with that label back into callouts.
 */
export function restoreCallouts(editor: Editor): number {
  const { doc, tr, schema } = editor.state;
  const callout = schema.nodes.callout;
  if (!callout) return 0;
  const found: { pos: number; size: number; tone: "info" | "warn" | "ok"; body: ReturnType<typeof doc.child>[] }[] = [];

  doc.descendants((node, pos) => {
    if (node.type.name !== "blockquote") return;
    const first = node.firstChild;
    const label = first?.textContent.trim() ?? "";
    const tone = TONES[label];
    const bold = first?.firstChild?.marks.some((m) => m.type.name === "bold");
    if (!first || !tone || !bold || first.childCount !== 1) return;
    const body: typeof found[number]["body"] = [];
    node.forEach((child, _o, i) => i > 0 && body.push(child));
    found.push({ pos, size: node.nodeSize, tone, body: body.length ? body : [schema.nodes.paragraph!.create()] });
    return false;
  });

  for (const f of found.reverse()) tr.replaceWith(f.pos, f.pos + f.size, callout.create({ tone: f.tone }, f.body));
  if (found.length) editor.view.dispatch(tr);
  return found.length;
}
