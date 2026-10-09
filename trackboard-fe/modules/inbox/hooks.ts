"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { allThreads, observeThreads } from "@/modules/comments";
import { usePages, usePeople, useWorkspace } from "@/modules/workspace";
import { useStore } from "@/lib/store";
import { buildFeed, type InboxItem } from "./lib/feed";
import { allMentions, observeMentions } from "./lib/mentions";
import { loadReadState, markRead, readKeyFor, readStore } from "./lib/read-state";

export type InboxEntry = InboxItem & { unread: boolean };

/** The signed-in person's notifications, with unread state. Live across tabs and collaborators. */
export function useInbox() {
  const { doc, profile } = useWorkspace();
  const pages = usePages();
  const people = usePeople();
  const [threads, setThreads] = useState(() => allThreads(doc));
  const [mentions, setMentions] = useState(() => allMentions(doc));
  const read = useStore(readStore);

  useEffect(() => {
    const refresh = () => setThreads(allThreads(doc));
    refresh();
    return observeThreads(doc, refresh);
  }, [doc]);

  useEffect(() => {
    const refresh = () => setMentions(allMentions(doc));
    refresh();
    return observeMentions(doc, refresh);
  }, [doc]);

  // Load this profile's read state, and follow it when another tab of the same person marks things read.
  useEffect(() => {
    loadReadState(profile.id);
    const onStorage = (e: StorageEvent) => e.key === readKeyFor(profile.id) && loadReadState(profile.id);
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [profile.id]);

  const items = useMemo<InboxEntry[]>(
    () => buildFeed({ me: profile.id, pages, threads, mentions, people }).map((i) => ({ ...i, unread: i.at >= read.since && !read.read.has(i.id) })),
    [profile.id, pages, threads, mentions, people, read],
  );
  const unread = useMemo(() => items.filter((i) => i.unread).length, [items]);
  const markAllRead = useCallback(() => markRead(items.filter((i) => i.unread).map((i) => i.id)), [items]);

  return { items, unread, markRead, markAllRead };
}
