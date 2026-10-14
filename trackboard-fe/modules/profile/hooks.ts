"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/api/keys";
import type { Me, MeUpdate } from "@/lib/api/types";
import { clearLocalCache } from "@/modules/collab/lib/local-cache";
import { sessionQuery, toProfile, type Profile } from "./lib/profile";

/** undefined = still reading the session, null = signed out (or the server could not be reached). */
export function useProfile(): Profile | null | undefined {
  const session = useQuery(sessionQuery);
  if (session.isPending) return undefined;
  return session.data ?? null;
}

/** The message to show on the sign-in screen when the session could not be read, and how to try again. */
export function useSessionStatus(): { error: string | null; retry: () => void } {
  const session = useQuery(sessionQuery);
  return { error: session.isError ? session.error.message : null, retry: () => void session.refetch() };
}

/** Saves name, colour and the onboarding answers; the signed-in profile updates when the server confirms. */
export function useSaveProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: MeUpdate) => api<Me>("/api/me", { method: "PATCH", body: patch }),
    onSuccess: (me) => queryClient.setQueryData(keys.session, toProfile(me)),
  });
}

/** Ends the session, forgets everything cached for this person, and clears the offline copies of their pages. */
export function useSignOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api("/api/session", { method: "DELETE" }),
    onSettled: async () => {
      queryClient.setQueryData(keys.session, null);
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== keys.session[0] });
      await clearLocalCache();
    },
  });
}
