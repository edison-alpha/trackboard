import { createStore, safeStorage } from "@/lib/store";

/*
 * Which notifications this person has seen, kept in this browser per profile.
 * `since` is when they first opened the workspace: anything older is history, shown but never counted as unread,
 * so a new member isn't greeted by a badge for every comment ever written.
 */

type ReadState = { profileId: string | null; since: number; read: ReadonlySet<string> };

const readKey = (id: string) => `tb:inbox-read:${id}`;
const sinceKey = (id: string) => `tb:inbox-since:${id}`;
const KEEP = 1000;

/** Nothing counts as unread until the state for the signed-in profile has loaded (since = Infinity). */
export const readStore = createStore<ReadState>({ profileId: null, since: Infinity, read: new Set() });

export function loadReadState(profileId: string): void {
  let since = Number(safeStorage.get(sinceKey(profileId)));
  if (!since) {
    since = Date.now();
    safeStorage.set(sinceKey(profileId), String(since));
  }
  let read: string[] = [];
  try {
    read = JSON.parse(safeStorage.get(readKey(profileId)) ?? "[]") as string[];
  } catch {
    /* unreadable list: start with none read */
  }
  readStore.set({ profileId, since, read: new Set(read) });
}

export function markRead(ids: string[]): void {
  const s = readStore.get();
  if (!s.profileId || ids.length === 0) return;
  const next = new Set(s.read);
  ids.forEach((id) => next.add(id));
  const list = [...next].slice(-KEEP);
  safeStorage.set(readKey(s.profileId), JSON.stringify(list));
  readStore.set({ ...s, read: new Set(list) });
}

export const readKeyFor = readKey;
