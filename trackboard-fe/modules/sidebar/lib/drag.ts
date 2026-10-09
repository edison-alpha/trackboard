import { createStore } from "@/lib/store";

export type DropZone = "before" | "inside" | "after";
export type DragState = { dragId: string | null; overId: string | null; zone: DropZone | null };

/** Shared drag state so every row can draw the drop indicator for the row being hovered. */
export const drag = createStore<DragState>({ dragId: null, overId: null, zone: null });

/** Top quarter drops before, bottom quarter after, the middle nests inside. */
export function zoneFor(e: React.DragEvent, el: HTMLElement): DropZone {
  const r = el.getBoundingClientRect();
  const y = (e.clientY - r.top) / r.height;
  return y < 0.28 ? "before" : y > 0.72 ? "after" : "inside";
}
