import { createId } from "@/lib/id";
import { createStore, safeStorage } from "@/lib/store";

export type Profile = {
  id: string;
  name: string;
  color: string;
  /** Collected by onboarding; absent on profiles made before it existed. */
  role?: string;
  focus?: string[];
};

/** Collaborator colours. White initials on each pass AA (checked: 5.0 to 6.5). */
export const PROFILE_COLORS = ["#0b6fe8", "#b02a2a", "#1d7a45", "#7b3fc4", "#b4530a", "#0f766e", "#be185d", "#4f46e5"] as const;

/*
 * Local identities until trackdocs-be adds accounts.
 * The list of people is shared by every tab (localStorage); who is signed in is per tab (sessionStorage),
 * so two tabs of one browser can be two different collaborators.
 */
const PROFILES_KEY = "tb:profiles";
const ACTIVE_KEY = "tb:active-profile";
const LEGACY_KEY = "tb:profile";

const session = {
  get(): string | null {
    try {
      return sessionStorage.getItem(ACTIVE_KEY);
    } catch {
      return null;
    }
  },
  set(id: string | null): void {
    try {
      if (id) sessionStorage.setItem(ACTIVE_KEY, id);
      else sessionStorage.removeItem(ACTIVE_KEY);
    } catch {
      /* storage unavailable: the choice lasts until reload */
    }
  },
};

function isProfile(p: unknown): p is Profile {
  const x = p as Partial<Profile> | null;
  return !!x && typeof x.id === "string" && typeof x.name === "string" && typeof x.color === "string";
}

function readProfiles(): Profile[] {
  try {
    const list = JSON.parse(safeStorage.get(PROFILES_KEY) ?? "[]") as unknown[];
    const out = list.filter(isProfile);
    // One-time move from the single-profile format.
    const legacy = JSON.parse(safeStorage.get(LEGACY_KEY) ?? "null") as unknown;
    if (isProfile(legacy) && !out.some((p) => p.id === legacy.id)) out.push(legacy);
    return out;
  } catch {
    return [];
  }
}

function writeProfiles(list: Profile[]): void {
  safeStorage.set(PROFILES_KEY, JSON.stringify(list));
}

/** Everyone who has used Trackdocs in this browser. */
export const profilesStore = createStore<Profile[]>([]);
/** Who this tab is signed in as. undefined = not read yet, null = choose or create one. */
export const profileStore = createStore<Profile | null | undefined>(undefined);

export function loadProfile(): void {
  const list = readProfiles();
  profilesStore.set(list);
  const activeId = session.get();
  profileStore.set(list.find((p) => p.id === activeId) ?? null);
}

/** Creates a new person (no id) or edits the signed-in one, and signs this tab in as them. */
export function saveProfile(input: { id?: string; name: string; color: string; role?: string; focus?: string[] }): Profile {
  const all = readProfiles();
  const prev = all.find((p) => p.id === input.id);
  // Editing name/colour must not wipe the role and focus areas chosen during onboarding.
  const profile: Profile = {
    ...prev,
    id: input.id ?? createId(),
    name: input.name.trim(),
    color: input.color,
    ...(input.role !== undefined && { role: input.role }),
    ...(input.focus !== undefined && { focus: input.focus }),
  };
  const list = all.filter((p) => p.id !== profile.id);
  list.push(profile);
  writeProfiles(list);
  profilesStore.set(list);
  session.set(profile.id);
  profileStore.set(profile);
  return profile;
}

export function signInAs(id: string): void {
  const p = readProfiles().find((x) => x.id === id);
  if (!p) return;
  session.set(p.id);
  profileStore.set(p);
}

/** Back to the "who's writing?" screen in this tab only. */
export function signOut(): void {
  session.set(null);
  profileStore.set(null);
}

export function forgetProfile(id: string): void {
  const list = readProfiles().filter((p) => p.id !== id);
  writeProfiles(list);
  profilesStore.set(list);
}

/** Another tab added or renamed someone: refresh the list, and this tab's identity if it was edited. */
export function watchProfileAcrossTabs(): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key !== PROFILES_KEY) return;
    const list = readProfiles();
    profilesStore.set(list);
    const current = profileStore.get();
    if (current) profileStore.set(list.find((p) => p.id === current.id) ?? current);
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}
