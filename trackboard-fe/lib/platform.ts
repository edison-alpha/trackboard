/** True on macOS / iOS, where shortcuts use ⌘ instead of Ctrl. Safe to call on the server (returns false). */
export function isApple(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
}

/** True when the event carries the platform's primary modifier (⌘ on Apple, Ctrl elsewhere). */
export function hasMod(e: KeyboardEvent | React.KeyboardEvent): boolean {
  return isApple() ? e.metaKey : e.ctrlKey;
}

/** True when focus is in a field where typing must not trigger app shortcuts. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}
