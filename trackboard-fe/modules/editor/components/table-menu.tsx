"use client";

import { ArrowsInLineHorizontal, Columns, Rows, SquareSplitHorizontal, Table, Trash } from "@/components/icons";
import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";

/** Row, column and cell actions, shown while the caret is inside a table. */
export function TableMenu({ editor }: { editor: Editor }) {
  const run = (fn: (c: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>) => fn(editor.chain().focus()).run();
  return (
    <BubbleMenu
      editor={editor}
      pluginKey="tableMenu"
      shouldShow={({ editor: e, state }) => e.isEditable && e.isActive("table") && state.selection.empty}
      appendTo={() => document.body}
      options={{ strategy: "fixed", placement: "top-start", offset: 8, shift: { padding: 12 } }}
      getReferencedVirtualElement={() => {
        const { view, state } = editor;
        let dom: HTMLElement | null = null;
        const $pos = state.selection.$from;
        for (let d = $pos.depth; d > 0; d--) {
          if ($pos.node(d).type.name === "table") {
            dom = view.nodeDOM($pos.before(d)) as HTMLElement | null;
            break;
          }
        }
        return dom ? { getBoundingClientRect: () => dom.getBoundingClientRect() } : null;
      }}
      className="floating z-40 flex items-center gap-0.5 rounded-(--radius-menu) p-1"
    >
      <Menu>
        <MenuTrigger className="inline-flex h-8 items-center gap-1.5 rounded-[9px] px-2 text-sm font-medium text-ink-2 hover:bg-surface-2/80 hover:text-ink pointer-coarse:h-10" onMouseDown={(e) => e.preventDefault()}>
          <Rows size={16} /> Row
        </MenuTrigger>
        <MenuContent onCloseAutoFocus={(e) => e.preventDefault()}>
          <MenuItem onSelect={() => run((c) => c.addRowBefore())}>Insert row above</MenuItem>
          <MenuItem onSelect={() => run((c) => c.addRowAfter())}>Insert row below</MenuItem>
          <MenuItem onSelect={() => run((c) => c.toggleHeaderRow())}>Toggle header row</MenuItem>
          <MenuSeparator />
          <MenuItem danger onSelect={() => run((c) => c.deleteRow())}>
            Delete row
          </MenuItem>
        </MenuContent>
      </Menu>
      <Menu>
        <MenuTrigger className="inline-flex h-8 items-center gap-1.5 rounded-[9px] px-2 text-sm font-medium text-ink-2 hover:bg-surface-2/80 hover:text-ink pointer-coarse:h-10" onMouseDown={(e) => e.preventDefault()}>
          <Columns size={16} /> Column
        </MenuTrigger>
        <MenuContent onCloseAutoFocus={(e) => e.preventDefault()}>
          <MenuItem onSelect={() => run((c) => c.addColumnBefore())}>Insert column left</MenuItem>
          <MenuItem onSelect={() => run((c) => c.addColumnAfter())}>Insert column right</MenuItem>
          <MenuItem onSelect={() => run((c) => c.toggleHeaderColumn())}>Toggle header column</MenuItem>
          <MenuSeparator />
          <MenuItem danger onSelect={() => run((c) => c.deleteColumn())}>
            Delete column
          </MenuItem>
        </MenuContent>
      </Menu>
      <Menu>
        <MenuTrigger className="inline-flex h-8 items-center gap-1.5 rounded-[9px] px-2 text-sm font-medium text-ink-2 hover:bg-surface-2/80 hover:text-ink pointer-coarse:h-10" onMouseDown={(e) => e.preventDefault()}>
          <Table size={16} /> Cell
        </MenuTrigger>
        <MenuContent onCloseAutoFocus={(e) => e.preventDefault()}>
          <MenuItem icon={<ArrowsInLineHorizontal size={16} />} onSelect={() => run((c) => c.mergeCells())}>
            Merge selected cells
          </MenuItem>
          <MenuItem icon={<SquareSplitHorizontal size={16} />} onSelect={() => run((c) => c.splitCell())}>
            Split cell
          </MenuItem>
          <MenuSeparator />
          <MenuItem danger icon={<Trash size={16} />} onSelect={() => run((c) => c.deleteTable())}>
            Delete table
          </MenuItem>
        </MenuContent>
      </Menu>
    </BubbleMenu>
  );
}
