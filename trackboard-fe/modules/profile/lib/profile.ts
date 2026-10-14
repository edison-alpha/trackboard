import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/api/keys";
import type { Me, SessionResponse } from "@/lib/api/types";
import { API_URL } from "@/lib/env";

/** The signed-in person. `workspaceId` is their own workspace, the one that opens by default. */
export type Profile = Omit<Me, "role"> & {
  /** Collected by onboarding; absent until then. */
  role?: string;
};

/** Collaborator colours. White initials on each pass AA (checked: 5.0 to 6.5). */
export const PROFILE_COLORS = ["#0b6fe8", "#b02a2a", "#1d7a45", "#7b3fc4", "#b4530a", "#0f766e", "#be185d", "#4f46e5"] as const;

export function toProfile(me: Me): Profile {
  const { role, ...rest } = me;
  return role ? { ...rest, role } : rest;
}

/** Who is signed in: a profile, or null when nobody is. Not retried, so an unreachable server shows its error at once. */
export const sessionQuery = queryOptions({
  queryKey: keys.session,
  queryFn: async (): Promise<Profile | null> => {
    const { user } = await api<SessionResponse>("/api/session");
    return user ? toProfile(user) : null;
  },
  staleTime: 5 * 60_000,
  retry: false,
});

/** Sends the browser to Google; the server returns it to the page it left from, signed in. */
export function signIn(): void {
  const back = `${location.pathname}${location.search}`;
  location.assign(`${API_URL}/api/auth/google?returnTo=${encodeURIComponent(back)}`);
}
