import { createStore, safeStorage, useStore } from "@/lib/store";

const KEY = "tb:expanded";

function read(): Set<string> {
  try {
    return new Set(JSON.parse(safeStorage.get(KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

/** Which tree rows are open. Per browser, so each person keeps their own view of a shared tree. */
export const expanded = createStore<ReadonlySet<string>>(new Set());

export function loadExpanded(): void {
  expanded.set(read());
}

export function setExpanded(id: string, open: boolean): void {
  if (expanded.get().has(id) === open) return;
  expanded.set((prev) => {
    const next = new Set(prev);
    if (open) next.add(id);
    else next.delete(id);
    safeStorage.set(KEY, JSON.stringify([...next]));
    return next;
  });
}

export function useExpanded(): ReadonlySet<string> {
  return useStore(expanded);
}
