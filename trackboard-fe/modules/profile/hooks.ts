"use client";

import { useStore } from "@/lib/store";
import { profilesStore, profileStore, type Profile } from "./lib/profile";

export function useProfile(): Profile | null | undefined {
  return useStore(profileStore, undefined);
}

export function useProfiles(): Profile[] {
  return useStore(profilesStore, []);
}
