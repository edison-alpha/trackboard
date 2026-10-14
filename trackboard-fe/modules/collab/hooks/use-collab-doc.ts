"use client";

import { useEffect, useState } from "react";
import { openDoc, type CollabDoc } from "../lib/open-doc";

export type CollabDocState = { status: "idle" } | { status: "loading" } | { status: "ready"; collab: CollabDoc } | { status: "error"; error: Error };

/** Opens a shared doc for the lifetime of the component and closes it on unmount or name change. A null name opens nothing. */
export function useCollabDoc(name: string | null): CollabDocState {
  const [state, setState] = useState<CollabDocState>(name ? { status: "loading" } : { status: "idle" });

  useEffect(() => {
    if (!name) {
      setState({ status: "idle" });
      return;
    }
    let alive = true;
    setState({ status: "loading" });
    let collab: CollabDoc;
    try {
      collab = openDoc(name);
    } catch (error) {
      setState({ status: "error", error: error as Error });
      return;
    }
    collab.ready.then(
      () => alive && setState({ status: "ready", collab }),
      (error: Error) => alive && setState({ status: "error", error }),
    );
    return () => {
      alive = false;
      collab.destroy();
    };
  }, [name]);

  return state;
}
