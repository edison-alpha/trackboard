"use client";

import { DragHandle } from "@tiptap/extension-drag-handle-react";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  CaretCircleRight,
  ChatDots,
  CheckSquare,
  Code,
  Copy,
  DotsSixVertical,
  Info,
  ListBullets,
  ListNumbers,
  Palette,
  Plus,
  Quotes,
  TextHFour,
  TextHOne,
  TextHThree,
  TextHTwo,
  TextT,
  Trash,
} from "@/components/icons";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuSub, MenuSubContent, MenuSubTrigger, MenuTrigger } from "@/components/ui/menu";
import { openAi } from "@/modules/ai/lib/ai-store";
import { HIGHLIGHTS, TEXT_COLORS } from "../lib/colors";

type Turn = { label: string; icon: React.ReactNode; run: (e: Editor, inside: number) => void };

const TURN_INTO: Turn[] = [
  { label: "Text", icon: <TextT size={16} />, run: (e, p) => e.chain().focus().setTextSelection(p).clearNodes().setParagraph().run() },
  { label: "Heading 1", icon: <TextHOne size={16} />, run: (e, p) => e.chain().focus().setTextSelection(p).clearNodes().setHeading({ level: 1 }).run() },
  { label: "Heading 2", icon: <TextHTwo size={16} />, run: (e, p) => e.chain().focus().setTextSelection(p).clearNodes().setHeading({ level: 2 }).run() },
  { label: "Heading 3", icon: <TextHThree size={16} />, run: (e, p) => e.chain().focus().setTextSelection(p).clearNodes().setHeading({ level: 3 }).run() },
  { label: "Heading 4", icon: <TextHFour size={16} />, run: (e, p) => e.chain().focus().setTextSelection(p).clearNodes().setHeading({ level: 4 }).run() },
  { label: "Bulleted list", icon: <ListBullets size={16} />, run: (e, p) => e.chain().focus().setTextSelection(p).clearNodes().toggleBulletList().run() },
  { label: "Numbered list", icon: <ListNumbers size={16} />, run: (e, p) => e.chain().focus().setTextSelection(p).clearNodes().toggleOrderedList().run() },
  { label: "To-do list", icon: <CheckSquare size={16} />, run: (e, p) => e.chain().focus().setTextSelection(p).clearNodes().toggleTaskList().run() },
  { label: "Quote", icon: <Quotes size={16} />, run: (e, p) => e.chain().focus().setTextSelection(p).clearNodes().toggleBlockquote().run() },
  { label: "Code block", icon: <Code size={16} />, run: (e, p) => e.chain().focus().setTextSelection(p).clearNodes().setCodeBlock().run() },
  { label: "Callout", icon: <Info size={16} />, run: (e, p) => e.chain().focus().setTextSelection(p).setCallout("info").run() },
  { label: "Toggle", icon: <CaretCircleRight size={16} />, run: (e, p) => e.chain().focus().setTextSelection(p).setDetails().run() },
];

/**
 * Left-margin handle on hover. "+" opens the block menu on a new line below; the grip drags the block,
 * and a click on it (without dragging) opens the block menu: turn into, colour, AI, duplicate, move, delete.
 * Keyboard users have the same actions in the slash menu and Mod+Shift+↑/↓, Mod+D.
 */
export function BlockHandle({ editor }: { editor: Editor }) {
  const current = useRef<{ node: PMNode | null; pos: number }>({ node: null, pos: -1 });
  const [menu, setMenu] = useState<{ node: PMNode; pos: number } | null>(null);
  const down = useRef<{ x: number; y: number } | null>(null);

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
    <DragHandle editor={editor} onNodeChange={({ node, pos }) => (current.current = { node, pos })} className="tb-handle hidden md:flex">
      <div className="relative flex items-center gap-0.5 pr-1.5">
        <button type="button" aria-label="Add a block below" title="Add a block below" onClick={addBelow} className="flex size-6 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink">
          <Plus size={15} />
        </button>
        <span
          role="button"
          tabIndex={-1}
          title="Drag to move, click for options"
          aria-label="Block options"
          onMouseDown={(e) => (down.current = { x: e.clientX, y: e.clientY })}
          onClick={(e) => {
            // A drag also ends in a click; only open the menu when the pointer barely moved.
            const d = down.current;
            if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return;
            const { node, pos } = current.current;
            if (node && pos >= 0) setMenu({ node, pos });
          }}
          className="flex h-6 w-5 cursor-grab items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink active:cursor-grabbing"
        >
          <DotsSixVertical size={16} weight="bold" />
        </span>

        <Menu open={!!menu} onOpenChange={(o) => !o && setMenu(null)}>
          {/* Invisible anchor over the grip: the menu opens on click, so dragging the grip stays free. */}
          <MenuTrigger asChild>
            <span aria-hidden="true" tabIndex={-1} className="pointer-events-none absolute right-1.5 bottom-0 h-6 w-5" />
          </MenuTrigger>
          <MenuContent side="left" align="start" className="w-60">
            <MenuSub>
              <MenuSubTrigger icon={<TextT size={16} />}>Turn into</MenuSubTrigger>
              <MenuSubContent className="w-52">
                {TURN_INTO.map((t) => (
                  <MenuItem key={t.label} icon={t.icon} onSelect={() => menu && t.run(editor, menu.pos + 1)}>
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
