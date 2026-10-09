import type * as Y from "yjs";
import { createPage } from "./pages";

/** First run only: one guide page so the workspace opens on something useful instead of a blank screen. */
export function seedWorkspace(doc: Y.Doc, by: string): void {
  const meta = doc.getMap<unknown>("meta");
  if (meta.get("seeded")) return;
  doc.transact(() => {
    meta.set("seeded", true);
    createPage(doc, { parentId: null, by, title: "Trackdocs guide", icon: "🧭", template: "guide" });
  });
}
