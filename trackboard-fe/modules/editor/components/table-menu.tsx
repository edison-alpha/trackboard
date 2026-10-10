"use client";

import { ArrowsInLineHorizontal, Columns, DotsThree, Plus, Rows, SquareSplitHorizontal, Table, Trash } from "@/components/icons";
import { CellSelection } from "@tiptap/pm/tables";
import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { useEffect, useRef, useState } from "react";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";

/** Row, column and cell actions, shown while the caret is inside a table — including while a block of cells
 * is selected, which is exactly when "delete column/row" is wanted; the selection isn't empty then, so this
 * also has to accept a CellSelection and not just a plain caret. */
export function TableMenu({ editor }: { editor: Editor }) {
  const run = (fn: (c: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>) => fn(editor.chain().focus()).run();
  return (
    <>
      <BubbleMenu
        editor={editor}
        pluginKey="tableMenu"
        shouldShow={({ editor: e, state }) => e.isEditable && e.isActive("table") && (state.selection.empty || state.selection instanceof CellSelection)}
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
      <TableInsertControls editor={editor} />
    </>
  );
}

type TableTarget = {
  table: HTMLElement;
  wrapper: HTMLElement;
  cell: HTMLElement;
  rect: DOMRect;
};

/**
 * Lightweight table controls matching the editor's direct manipulation model:
 * the lower control adds a row after the hovered row, and the right control adds
 * a column after the hovered column.
 */
function TableInsertControls({ editor }: { editor: Editor }) {
  const [target, setTarget] = useState<TableTarget | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClear = () => {
    if (clearTimer.current) {
      clearTimeout(clearTimer.current);
      clearTimer.current = null;
    }
  };

  const scheduleClear = () => {
    cancelClear();
    clearTimer.current = setTimeout(() => setTarget(null), 180);
  };

  useEffect(() => {
    const dom = editor.view.dom;
    const update = (event: PointerEvent) => {
      const element = event.target instanceof HTMLElement ? event.target : null;
      if (element?.closest("[data-table-control]")) {
        cancelClear();
        return;
      }

      const cell = element?.closest<HTMLElement>("td, th");
      const table = cell?.closest<HTMLElement>("table");
      const wrapper = table?.closest<HTMLElement>(".tableWrapper");
      if (!cell || !table || !wrapper || !dom.contains(table)) {
        scheduleClear();
        return;
      }
      cancelClear();
      setTarget((current) =>
        current?.cell === cell && current.table === table
          ? current
          : { table, wrapper, cell, rect: table.getBoundingClientRect() },
      );
    };
    const refresh = () =>
      setTarget((current) =>
        current
          ? { ...current, rect: current.table.getBoundingClientRect() }
          : null,
      );

    document.addEventListener("pointermove", update);
    window.addEventListener("scroll", refresh, true);
    window.addEventListener("resize", refresh);
    return () => {
      document.removeEventListener("pointermove", update);
      window.removeEventListener("scroll", refresh, true);
      window.removeEventListener("resize", refresh);
      cancelClear();
    };
  }, [editor]);

  if (!target) return null;

  const wrapperRect = target.wrapper.getBoundingClientRect();

  const run = (command: "addRowAfter" | "addColumnAfter") => {
    const position = editor.view.posAtDOM(target.cell, 0);
    editor.chain().focus().setTextSelection(position)[command]().run();
    setTarget(null);
  };

  const focusTable = () => {
    const firstCell = target.table.querySelector<HTMLElement>("td, th");
    if (!firstCell) return;
    const position = editor.view.posAtDOM(firstCell, 0);
    editor.chain().focus().setTextSelection(position).run();
  };

  const buttonClass =
    "floating fixed z-40 grid size-7 place-items-center rounded-lg text-ink-2 transition-colors hover:bg-accent hover:text-on-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent pointer-coarse:size-10";
  const handleClass =
    "floating fixed z-40 grid place-items-center rounded-lg text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent pointer-coarse:size-10";

  return (
    <>
      <button
        type="button"
        aria-label="Table options"
        title="Table options"
        className={`${handleClass} h-6 w-24`}
        data-table-control
        style={{ left: wrapperRect.left + wrapperRect.width / 2 - 48, top: wrapperRect.top - 30 }}
        onMouseEnter={cancelClear}
        onMouseLeave={scheduleClear}
        onMouseDown={(event) => event.preventDefault()}
        onClick={focusTable}
      >
        <DotsThree size={18} weight="bold" />
      </button>
      <button
        type="button"
        aria-label="Table options"
        title="Table options"
        className={`${handleClass} h-8 w-6`}
        data-table-control
        style={{ left: wrapperRect.left - 30, top: wrapperRect.top + wrapperRect.height / 2 - 16 }}
        onMouseEnter={cancelClear}
        onMouseLeave={scheduleClear}
        onMouseDown={(event) => event.preventDefault()}
        onClick={focusTable}
      >
        <DotsThree size={18} weight="bold" />
      </button>
      <button
        type="button"
        aria-label="Add row below"
        title="Add row below"
        className={buttonClass}
        data-table-control
        style={{ left: wrapperRect.left + wrapperRect.width / 2 - 14, top: wrapperRect.bottom + 4 }}
        onMouseEnter={cancelClear}
        onMouseLeave={scheduleClear}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => run("addRowAfter")}
      >
        <Plus size={16} weight="bold" />
      </button>
      <button
        type="button"
        aria-label="Add column to the right"
        title="Add column to the right"
        className={buttonClass}
        data-table-control
        style={{ left: wrapperRect.right - 4, top: wrapperRect.top + wrapperRect.height / 2 - 14 }}
        onMouseEnter={cancelClear}
        onMouseLeave={scheduleClear}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => run("addColumnAfter")}
      >
        <Plus size={16} weight="bold" />
      </button>
    </>
  );
}
