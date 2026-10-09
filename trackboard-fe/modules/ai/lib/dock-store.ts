import { createStore, safeStorage, useStore } from "@/lib/store";

/** expanded: the conversation is open · minimized: a slim bar · hidden: only the round AI button. */
export type DockMode = "expanded" | "minimized" | "hidden";

const KEY = "tb:ai-dock";
const read = (): DockMode => {
  const v = safeStorage.get(KEY);
  return v === "expanded" || v === "hidden" ? v : "minimized";
};

export const dockStore = createStore<DockMode>("minimized");

export function loadDock(): void {
  dockStore.set(read());
}

export function setDock(mode: DockMode): void {
  dockStore.set(mode);
  safeStorage.set(KEY, mode);
}

/** Alt+A: open the conversation, or put it away if it is already open. */
export function toggleDock(): void {
  setDock(dockStore.get() === "expanded" ? "minimized" : "expanded");
}

export function useDock(): DockMode {
  return useStore(dockStore, "minimized");
}
