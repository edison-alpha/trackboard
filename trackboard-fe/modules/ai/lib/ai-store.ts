import { createStore, useStore } from "@/lib/store";
import type { AiActionId } from "./actions";
import type { Range } from "./apply";

/** Which AI surface is open in the editor. `preset` starts an action right away (page menu, slash quick start). */
export type AiOpen = { scope: "selection" | "write" | "page"; range: Range; preset?: AiActionId; key: number } | null;

export const aiStore = createStore<AiOpen>(null);
let counter = 0;

export function openAi(o: Omit<NonNullable<AiOpen>, "key">): void {
  aiStore.set({ ...o, key: ++counter });
}

export function closeAi(): void {
  aiStore.set(null);
}

export function useAiOpen(): AiOpen {
  return useStore(aiStore, null);
}
