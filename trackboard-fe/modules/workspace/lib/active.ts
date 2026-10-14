import { createStore, safeStorage, useStore } from "@/lib/store";

/*
 * Which workspace is open. A person can belong to several; the choice is a per-device preference, so it stays in this
 * browser. When it names a workspace they have left, the app falls back to their own.
 */
const KEY = "tb:workspace";

const activeStore = createStore<string | null>(null);

export function loadActiveWorkspace(): void {
  activeStore.set(safeStorage.get(KEY));
}

export function setActiveWorkspace(id: string | null): void {
  activeStore.set(id);
  safeStorage.set(KEY, id ?? "");
}

export function useActiveWorkspaceId(): string | null {
  return useStore(activeStore, null) || null;
}
