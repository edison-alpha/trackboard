import { createStore, useStore } from "@/lib/store";

export type PreviewFile = { src: string; name: string; size: number; mime: string };

const store = createStore<PreviewFile | null>(null);

export function openFilePreview(file: PreviewFile): void {
  store.set(file);
}

export function closeFilePreview(): void {
  store.set(null);
}

export function useFilePreview(): PreviewFile | null {
  return useStore(store);
}
