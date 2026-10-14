"use client";

import { DragHandle } from "@tiptap/extension-drag-handle-react";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  CaretDown,
  CaretRight,
  ChatDots,
  Copy,
  DotsSixVertical,
  Palette,
  Plus,
  TextT,
  Trash,
} from "@/components/icons";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuSub, MenuSubContent, MenuSubTrigger, MenuTrigger } from "@/components/ui/menu";
import { openAi } from "@/modules/ai/lib/ai-store";
import { hasFoldableContent } from "../extensions/nodes/heading";
import { BLOCK_TYPES } from "../lib/block-types";
import { HIGHLIGHTS, TEXT_COLORS } from "../lib/colors";

/** Blocks with no editable text of their own (image, embed, file, bookmark, contents): nothing to convert or colour. */
const isStatic = (node: PMNode) => node.isAtom;

/**
 * Left-margin handle on hover. "+" opens the block menu on a new line below; the grip drags the block,
 * and a click on it (without dragging) opens the block menu: turn into, colour, AI, duplicate, move, delete.
 * Keyboard users have the same actions in the slash menu and Mod+Shift+↑/↓, Mod+D.
 */
export function BlockHandle({ editor }: { editor: Editor }) {
  const current = useRef<{ node: PMNode | null; pos: number }>({ node: null, pos: -1 });
  const [menu, setMenu] = useState<{ node: PMNode; pos: number } | null>(null);
  const down = useRef<{ x: number; y: number } | null>(null);
  const [fold, setFold] = useState<{ pos: number; folded: boolean } | null>(null);

  // A heading with content beneath it turns its grip into a fold caret on hover.
  const readFold = (node: PMNode | null, pos: number) => {
    if (!node || pos < 0 || node.type.name !== "heading") return null;
    const $pos = editor.state.doc.resolve(pos);
    if (!hasFoldableContent($pos.parent, $pos.index(), node.attrs.level as number)) return null;
    return { pos, folded: !!node.attrs.folded };
  };

  const toggleFold = () => {
    if (!fold) return;
    const folded = !fold.folded;
    editor.chain().command(({ tr }) => (tr.setNodeAttribute(fold.pos, "folded", folded), true)).run();
    setFold({ pos: fold.pos, folded });
  };

  const addBelow = () => {
    const { node, pos } = current.current;
    if (!node || pos < 0) return;
    const end = pos + node.nodeSize;
    editor.chain().insertContentAt(end, { type: "paragraph", content: [{ type: "text", text: "/" }] }).setTextSelection(end + 2).focus().run();
  };

  const color = (kind: "text" | "background", value: string | null) => {
    if (!menu) return;
    const range = { from: menu.pos + 1, to: menu.pos + menu.node.nodeSize - 1 };
    const c = editor.chain().focus().setTextSelection(range);
    if (kind === "text") (value ? c.setColor(value) : c.unsetColor()).setTextSelection(range.to).run();
    else (value ? c.setHighlight({ color: value }) : c.unsetHighlight()).setTextSelection(range.to).run();
  };

  const copyMarkdown = () => {
    if (!menu) return;
    const md = editor.markdown?.serialize({ type: "doc", content: [menu.node.toJSON()] }) ?? menu.node.textContent;
    navigator.clipboard.writeText(md).then(
      () => toast.success("Block copied as Markdown"),
      () => toast.error("Couldn't copy"),
    );
  };

  return (
    <DragHandle editor={editor} onNodeChange={({ node, pos }) => {
        current.current = { node, pos };
        setFold(readFold(node, pos));
      }} className="tb-handle hidden md:flex">
      <div className="relative flex items-center gap-0.5 pr-1.5">
        <button type="button" aria-label="Add a block below" title="Add a block below" onClick={addBelow} className="flex size-6 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink">
          <Plus size={15} />
        </button>
        <span
          role="button"
          tabIndex={-1}
          title={fold ? (fold.folded ? "Expand section" : "Collapse section") : "Drag to move, click for options"}
          aria-label={fold ? (fold.folded ? "Expand section" : "Collapse section") : "Block options"}
          onMouseDown={(e) => (down.current = { x: e.clientX, y: e.clientY })}
          onClick={(e) => {
            // A drag also ends in a click; only open the menu when the pointer barely moved.
            const d = down.current;
            if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return;
            if (fold) return toggleFold();
            const { node, pos } = current.current;
            if (node && pos >= 0) setMenu({ node, pos });
          }}
          onContextMenu={(e) => {
            const { node, pos } = current.current;
            if (!fold || !node || pos < 0) return;
            e.preventDefault();
            setMenu({ node, pos });
          }}
          className="group/grip flex h-6 w-5 cursor-grab items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink active:cursor-grabbing"
        >
          {fold ? (
            <>
              <DotsSixVertical size={16} weight="bold" className="group-hover/grip:hidden" />
              <span className="hidden group-hover/grip:block">
                {fold.folded ? <CaretRight size={14} weight="fill" /> : <CaretDown size={14} weight="fill" />}
              </span>
            </>
          ) : (
            <DotsSixVertical size={16} weight="bold" />
          )}
        </span>

        <Menu open={!!menu} onOpenChange={(o) => !o && setMenu(null)}>
          {/* Invisible anchor over the grip: the menu opens on click, so dragging the grip stays free. */}
          <MenuTrigger asChild>
            <span aria-hidden="true" tabIndex={-1} className="pointer-events-none absolute right-1.5 bottom-0 h-6 w-5" />
          </MenuTrigger>
          <MenuContent side="left" align="start" className="w-60">
            {menu && !isStatic(menu.node) && (
              <>
            <MenuSub>
              <MenuSubTrigger icon={<TextT size={16} />}>Turn into</MenuSubTrigger>
              <MenuSubContent className="w-52">
                {BLOCK_TYPES.map((t) => (
                  <MenuItem key={t.label} icon={t.icon} onSelect={() => t.apply(editor.chain().focus().setTextSelection(menu.pos + 1).clearNodes()).run()}>
                    {t.label}
                  </MenuItem>
                ))}
              </MenuSubContent>
            </MenuSub>
            <MenuSub>
              <MenuSubTrigger icon={<Palette size={16} />}>Color</MenuSubTrigger>
              <MenuSubContent className="w-56">
                <MenuLabel>Text</MenuLabel>
                {TEXT_COLORS.map((c) => (
                  <MenuItem key={`t-${c.name}`} onSelect={() => color("text", c.value)} icon={<span className="w-4 text-center text-[15px] font-bold" style={{ color: c.value ?? "var(--ink)" }}>A</span>}>
                    {c.name}
                  </MenuItem>
                ))}
                <MenuSeparator />
                <MenuLabel>Background</MenuLabel>
                {HIGHLIGHTS.map((c) => (
                  <MenuItem key={`b-${c.name}`} onSelect={() => color("background", c.value)} icon={<span className="size-4 rounded border border-line-strong" style={{ background: c.value ?? "transparent" }} />}>
                    {c.name}
                  </MenuItem>
                ))}
              </MenuSubContent>
            </MenuSub>
            <MenuItem icon={<ChatDots size={16} />} shortcut="Mod+J" onSelect={() => menu && openAi({ scope: "selection", range: { from: menu.pos + 1, to: menu.pos + menu.node.nodeSize - 1 } })}>
              Ask AI about this block
            </MenuItem>
              </>
            )}
            <MenuSeparator />
            <MenuItem icon={<Copy size={16} />} shortcut="Mod+D" onSelect={() => menu && editor.chain().focus().duplicateBlock(menu.pos).run()}>
              Duplicate
            </MenuItem>
            <MenuItem icon={<ArrowUp size={16} />} onSelect={() => menu && editor.chain().focus().moveBlock(-1, menu.pos).run()}>
              Move up
            </MenuItem>
            <MenuItem icon={<ArrowDown size={16} />} onSelect={() => menu && editor.chain().focus().moveBlock(1, menu.pos).run()}>
              Move down
            </MenuItem>
            <MenuItem icon={<Copy size={16} />} onSelect={copyMarkdown}>
              Copy as Markdown
            </MenuItem>
            <MenuSeparator />
            <MenuItem danger icon={<Trash size={16} />} onSelect={() => menu && editor.chain().focus().deleteBlock(menu.pos).run()}>
              Delete
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
    </DragHandle>
  );
}
