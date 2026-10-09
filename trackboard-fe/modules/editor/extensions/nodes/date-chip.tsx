"use client";

import { mergeAttributes, Node } from "@tiptap/core";
import { parseDate, type CalendarDate } from "@internationalized/date";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { useRef, useState } from "react";
import { DatePicker } from "@/components/base/date-picker/date-picker";
import { DateRangePicker, type DateRangeValue } from "@/components/base/date-picker/date-range-picker";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    dateChip: { insertDate: (iso?: string) => ReturnType; insertDateRange: () => ReturnType };
  }
}

const today = () => new Date().toISOString().slice(0, 10);
const fmt = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" });
const label = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : fmt.format(d);
};
const toCal = (iso: string | null | undefined): CalendarDate | null => {
  try {
    return iso ? parseDate(iso) : null;
  } catch {
    return null;
  }
};
const text = (attrs: { date?: string | null; end?: string | null }) => (attrs.end ? `${label(attrs.date)} → ${label(attrs.end)}` : label(attrs.date));

/**
 * An inline date (or date range). Clicking a single date opens the BoardUI DatePicker anchored to the chip;
 * a range renders BoardUI's DateRangePicker with its presets (Today, Last week, This month, ...).
 */
function DateView({ node, updateAttributes, editor }: ReactNodeViewProps) {
  const chip = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const { date, end } = node.attrs as { date: string | null; end: string | null };

  if (end) {
    const value: DateRangeValue | null = toCal(date) && toCal(end) ? { start: toCal(date)!, end: toCal(end)! } : null;
    return (
      <NodeViewWrapper as="span" className="tb-date tb-date-range" contentEditable={false}>
        <DateRangePicker
          aria-label="Date range"
          value={value}
          isDisabled={!editor.isEditable}
          onChange={(v) => v && updateAttributes({ date: v.start.toString(), end: v.end.toString() })}
          className="tb-date-range-trigger"
        />
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper as="span" className="tb-date" contentEditable={false}>
      <button ref={chip} type="button" disabled={!editor.isEditable} onClick={() => setOpen((o) => !o)} aria-label={`Date ${label(date)}. Change date`} aria-expanded={open} className="tb-date-chip">
        @{label(date ?? today())}
      </button>
      <DatePicker
        aria-label="Date"
        triggerRef={chip}
        isOpen={open}
        onOpenChange={setOpen}
        value={toCal(date ?? today())}
        onChange={(v) => v && updateAttributes({ date: v.toString() })}
      />
    </NodeViewWrapper>
  );
}

export const DateChip = Node.create({
  name: "dateChip",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes: () => ({ date: { default: null }, end: { default: null } }),
  parseHTML: () => [{ tag: 'span[data-type="date"]', getAttrs: (el) => ({ date: (el as HTMLElement).dataset.date, end: (el as HTMLElement).dataset.end ?? null }) }],
  renderHTML: ({ HTMLAttributes, node }) => ["span", mergeAttributes(HTMLAttributes, { "data-type": "date", "data-date": node.attrs.date, "data-end": node.attrs.end }), `@${text(node.attrs)}`],
  renderText: ({ node }) => text(node.attrs),
  renderMarkdown: (node) => text(node.attrs ?? {}),
  addNodeView: () => ReactNodeViewRenderer(DateView, { as: "span" }),
  addCommands() {
    return {
      insertDate:
        (iso) =>
        ({ commands }) =>
          commands.insertContent([{ type: this.name, attrs: { date: iso ?? today() } }, { type: "text", text: " " }]),
      insertDateRange:
        () =>
        ({ commands }) => {
          const start = new Date();
          const finish = new Date(start.getTime() + 6 * 86_400_000);
          return commands.insertContent([{ type: this.name, attrs: { date: start.toISOString().slice(0, 10), end: finish.toISOString().slice(0, 10) } }, { type: "text", text: " " }]);
        },
    };
  },
});
