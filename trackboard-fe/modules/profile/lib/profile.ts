import { api, onUnauthorized } from "@/lib/api/client";
import type { Me, MeUpdate, SessionResponse } from "@/lib/api/types";
import { API_URL } from "@/lib/env";
import { createStore } from "@/lib/store";
import { clearLocalCache } from "@/modules/collab/lib/local-cache";

/** The signed-in person. `workspaceId` scopes every document name, so one person's pages never open in another's. */
export type Profile = Omit<Me, "role"> & {
  /** Collected by onboarding; absent until then. */
  role?: string;
};

/** Collaborator colours. White initials on each pass AA (checked: 5.0 to 6.5). */
export const PROFILE_COLORS = ["#0b6fe8", "#b02a2a", "#1d7a45", "#7b3fc4", "#b4530a", "#0f766e", "#be185d", "#4f46e5"] as const;

function toProfile(me: Me): Profile {
  const { role, ...rest } = me;
  return role ? { ...rest, role } : rest;
}

/** Who is signed in. undefined = not read yet, null = signed out (show the sign-in screen). */
export const profileStore = createStore<Profile | null | undefined>(undefined);
/** Set when the server could not be reached while reading the session, so sign-in can say so and offer a retry. */
export const sessionErrorStore = createStore<string | null>(null);

export async function loadProfile(): Promise<void> {
  try {
    const { user } = await api<SessionResponse>("/api/session");
    sessionErrorStore.set(null);
    profileStore.set(user ? toProfile(user) : null);
  } catch (error) {
    sessionErrorStore.set((error as Error).message);
    profileStore.set(null);
  }
}

/** Saves name, colour and the onboarding answers. Resolves with the updated profile. */
export async function saveProfile(patch: MeUpdate): Promise<Profile> {
  const me = await api<Me>("/api/me", { method: "PATCH", body: patch });
  const profile = toProfile(me);
  profileStore.set(profile);
  return profile;
}

/** Sends the browser to Google; the server returns it to the page it left from, signed in. */
export function signIn(): void {
  const back = `${location.pathname}${location.search}`;
  location.assign(`${API_URL}/api/auth/google?returnTo=${encodeURIComponent(back)}`);
}

export async function signOut(): Promise<void> {
  await api("/api/session", { method: "DELETE" }).catch(() => undefined);
  profileStore.set(null);
  await clearLocalCache();
}

// An expired session on any request returns the app to the sign-in screen instead of failing quietly.
if (typeof window !== "undefined") {
  onUnauthorized(() => {
    if (profileStore.get()) profileStore.set(null);
  });
}
