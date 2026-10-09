import { createStore, safeStorage, useStore } from "@/lib/store";

export type Panel = "comments" | "history" | null;

type UiState = {
  /** Desktop sidebar expanded. Remembered per browser. */
  sidebar: boolean;
  /** Phone drawer open. Never remembered. */
  drawer: boolean;
  palette: boolean;
  shortcuts: boolean;
  templates: boolean;
  ask: boolean;
  profile: boolean;
  panel: Panel;
};

const SIDEBAR_KEY = "tb:sidebar";

export const ui = createStore<UiState>({ sidebar: true, drawer: false, palette: false, shortcuts: false, templates: false, ask: false, profile: false, panel: null });

export function loadUiPrefs(): void {
  if (safeStorage.get(SIDEBAR_KEY) === "closed") ui.set((s) => ({ ...s, sidebar: false }));
}

export function setUi(patch: Partial<UiState>): void {
  ui.set((s) => ({ ...s, ...patch }));
  if ("sidebar" in patch) safeStorage.set(SIDEBAR_KEY, patch.sidebar ? "open" : "closed");
}

export function togglePanel(panel: Exclude<Panel, null>): void {
  ui.set((s) => ({ ...s, panel: s.panel === panel ? null : panel }));
}

export function useUi(): UiState {
  return useStore(ui);
}
