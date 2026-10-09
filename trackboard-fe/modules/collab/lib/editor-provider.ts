import type { Awareness } from "y-protocols/awareness";

type Listener = () => void;

/**
 * The provider object Tiptap extensions receive. CollaborationCaret reads `awareness`;
 * UniqueID subscribes to "synced" so it only assigns block ids once the stored document is loaded.
 * Wraps whichever transport is active (tabs or Hocuspocus) behind that one small interface.
 */
export class EditorProvider {
  private synced = false;
  private readonly listeners = new Map<string, Set<Listener>>();

  constructor(readonly awareness: Awareness) {}

  on(event: string, cb: Listener): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)?.add(cb);
    // Late subscribers to "synced" still get called once, after the editor finishes mounting.
    if (event === "synced" && this.synced) setTimeout(() => this.listeners.get(event)?.has(cb) && cb(), 0);
  }

  off(event: string, cb: Listener): void {
    this.listeners.get(event)?.delete(cb);
  }

  markSynced(): void {
    if (this.synced) return;
    this.synced = true;
    this.listeners.get("synced")?.forEach((cb) => cb());
  }

  destroy(): void {
    this.listeners.clear();
  }
}
