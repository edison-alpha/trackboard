"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "@/modules/workspace";
import { observeThreads, threadsForPage, type Thread } from "./lib/threads";

/** Threads of one page, live across tabs and collaborators. */
export function useThreads(pageId: string): Thread[] {
  const { doc } = useWorkspace();
  const [threads, setThreads] = useState<Thread[]>(() => threadsForPage(doc, pageId));
  useEffect(() => {
    const refresh = () => setThreads(threadsForPage(doc, pageId));
    refresh();
    return observeThreads(doc, refresh);
  }, [doc, pageId]);
  return threads;
}
