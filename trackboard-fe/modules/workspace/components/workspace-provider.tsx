"use client";

import { useQuery } from "@tanstack/react-query";
import { AnimatePresence } from "motion/react";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { LoadingScreen } from "@/components/brand/loading-screen";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
import { ApiError } from "@/lib/api/client";
import { useServerEvents } from "@/lib/api/use-server-events";
import { useProfile, type Profile } from "@/modules/profile";
import { setActiveWorkspace, useActiveWorkspaceId } from "../lib/active";
import type { WorkspaceSummary } from "../lib/types";
import { pagesQuery, workspacesQuery } from "../queries";
import { SignInScreen } from "./onboarding";
import { OnboardingWizard } from "./onboarding-wizard";

type WorkspaceContextValue = {
  workspaceId: string;
  /** Role and name of the open workspace for this person. */
  workspace: WorkspaceSummary | undefined;
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
 * Signs the person in, runs first-time setup, opens the workspace they chose (their own by default), starts the live
 * update stream, and shows the loading screen only while that is actually happening.
 */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const profile = useProfile();
  const needsSetup = !!profile && !profile.onboardingDone;
  const ready = !!profile && !needsSetup;
  useServerEvents(ready);

  const workspaces = useQuery({ ...workspacesQuery, enabled: ready });
  const chosen = useActiveWorkspaceId();
  // A choice that names a workspace this person left falls back to their own.
  const workspaceId = chosen && workspaces.data?.some((w) => w.id === chosen) ? chosen : (profile?.workspaceId ?? "");
  const pages = useQuery({ ...pagesQuery(workspaceId), enabled: ready && workspaceId !== "" && !workspaces.isPending });

  const [floorPassed, setFloorPassed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFloorPassed(true), MIN_BOOT_MS);
    return () => clearTimeout(t);
  }, []);

  const value = useMemo<WorkspaceContextValue | null>(
    () => (ready && profile && pages.data ? { workspaceId, workspace: workspaces.data?.find((w) => w.id === workspaceId), profile } : null),
    [ready, profile, pages.data, workspaceId, workspaces.data],
  );

  const booting = !floorPassed || profile === undefined || (ready && !pages.isError && !pages.data);

  return (
    <>
      <AnimatePresence>{booting && <LoadingScreen key="boot" status={profile === undefined ? "Getting ready" : "Opening your workspace"} />}</AnimatePresence>
      {!booting && profile === null && <SignInScreen />}
      {!booting && needsSetup && <OnboardingWizard />}
      {!booting && ready && pages.isError && (
        <ErrorState
          title="Couldn't open the workspace"
          body={pages.error.message}
          action={
            <>
              {pages.error instanceof ApiError && pages.error.status === 404 && chosen && (
                <Button variant="glass" onClick={() => setActiveWorkspace(null)}>
                  Open my own workspace
                </Button>
              )}
              <Button variant="primary" onClick={() => void pages.refetch()}>
                Try again
              </Button>
            </>
          }
        />
      )}
      {value && <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>}
    </>
  );
}
