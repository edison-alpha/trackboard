import type * as Y from "yjs";
import { createStore, type Store } from "@/lib/store";
import { readAll } from "./pages";
import type { PageMeta } from "./types";

/** Immutable snapshot of the page map, rebuilt whenever the workspace doc changes (any tab, any person). */
export function createPagesStore(doc: Y.Doc): { store: Store<ReadonlyMap<string, PageMeta>>; dispose: () => void } {
  const store = createStore<ReadonlyMap<string, PageMeta>>(readAll(doc));
  const map = doc.getMap("pages");
  const refresh = () => store.set(readAll(doc));
  map.observeDeep(refresh);
  return { store, dispose: () => map.unobserveDeep(refresh) };
}
