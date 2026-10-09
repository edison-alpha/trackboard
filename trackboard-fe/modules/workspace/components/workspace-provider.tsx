"use client";

import { AnimatePresence } from "motion/react";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type * as Y from "yjs";
import { LoadingScreen } from "@/components/brand/loading-screen";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
import { useCollabDoc, type CollabDoc } from "@/modules/collab";
import { useProfile, type Profile } from "@/modules/profile";
import type { Store } from "@/lib/store";
import { createPagesStore } from "../lib/workspace-store";
import { WORKSPACE_DOC, type PageMeta } from "../lib/types";
import { seedWorkspace } from "../lib/seed";
import { rememberPerson } from "../lib/pages";
import { Onboarding } from "./onboarding";

type WorkspaceContextValue = {
  collab: CollabDoc;
  doc: Y.Doc;
  pages: Store<ReadonlyMap<string, PageMeta>>;
  profile: Profile;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  return ctx;
}

/** A short floor on the boot screen so a fast load doesn't flash it for a single frame. */
const MIN_BOOT_MS = 450;

/**
 * Opens the workspace doc, asks for a profile on the first visit, and shows the loading screen
 * only while that is actually happening.
 */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const profile = useProfile();
  const state = useCollabDoc(WORKSPACE_DOC);
  const [floorPassed, setFloorPassed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setFloorPassed(true), MIN_BOOT_MS);
    return () => clearTimeout(t);
  }, []);

  const collab = state.status === "ready" ? state.collab : null;
  // Created inside the effect so StrictMode's mount/unmount/mount re-subscribes instead of leaving a dead store.
  const [pagesStore, setPagesStore] = useState<ReturnType<typeof createPagesStore> | null>(null);
  useEffect(() => {
    if (!collab) return;
    const s = createPagesStore(collab.doc);
    setPagesStore(s);
    return () => {
      s.dispose();
      setPagesStore(null);
    };
  }, [collab]);

  // Every open tab announces who is here, so the workspace doc's awareness can show presence too.
  useEffect(() => {
    if (collab && profile) collab.awareness.setLocalStateField("user", { id: profile.id, name: profile.name, color: profile.color });
  }, [collab, profile]);

  useEffect(() => {
    if (collab && profile) rememberPerson(collab.doc, profile);
  }, [collab, profile]);

  useEffect(() => {
    if (collab && profile) seedWorkspace(collab.doc, profile.id);
  }, [collab, profile]);

  const value = useMemo(
    () => (collab && pagesStore && profile ? { collab, doc: collab.doc, pages: pagesStore.store, profile } : null),
    [collab, pagesStore, profile],
  );

  const booting = !floorPassed || profile === undefined || (profile !== null && state.status === "loading");

  return (
    <>
      <AnimatePresence>{booting && <LoadingScreen key="boot" status={profile === undefined ? "Getting ready" : "Opening your workspace"} />}</AnimatePresence>
      {!booting && profile === null && <Onboarding />}
      {!booting && state.status === "error" && (
        <ErrorState
          title="Couldn't open the workspace"
          body={`The browser blocked access to its storage (${state.error.message}). Leave private browsing or allow storage for this site, then reload.`}
          action={
            <Button variant="primary" onClick={() => location.reload()}>
              Reload
            </Button>
          }
        />
      )}
      {value && <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>}
    </>
  );
}
