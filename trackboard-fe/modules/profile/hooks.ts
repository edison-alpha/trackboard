"use client";

import { useStore } from "@/lib/store";
import { profileStore, sessionErrorStore, type Profile } from "./lib/profile";

export function useProfile(): Profile | null | undefined {
  return useStore(profileStore, undefined);
}

export function useSessionError(): string | null {
  return useStore(sessionErrorStore, null);
}
