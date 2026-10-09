"use client";

import { X } from "@/components/icons";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button, IconButton } from "@/components/ui/button";
import { useProfiles } from "../hooks";
import { forgetProfile, signInAs } from "../lib/profile";
import { ProfileForm } from "./profile-form";

/**
 * "Who is writing in this tab?" Pick someone who already used this browser, or add a new person.
 * Each tab keeps its own choice, so two tabs can be two collaborators.
 */
export function ProfilePicker() {
  const profiles = useProfiles();
  const [creating, setCreating] = useState(profiles.length === 0);

  if (creating || profiles.length === 0) {
    return (
      <div className="grid gap-4">
        <ProfileForm submitLabel="Open workspace" />
        {profiles.length > 0 && (
          <Button variant="ghost" size="sm" className="justify-self-start" onClick={() => setCreating(false)}>
            Back to profiles
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <ul className="grid gap-1.5" aria-label="Profiles in this browser">
        {profiles.map((p) => (
          <li key={p.id} className="group flex items-center gap-1">
            <button
              type="button"
              onClick={() => signInAs(p.id)}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-(--radius-row) border border-line px-3 py-2.5 text-left transition-colors hover:border-line-strong hover:bg-surface-2"
            >
              <Avatar name={p.name} color={p.color} size={34} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium text-ink">{p.name}</span>
                <span className="block text-xs text-ink-3">Write in this tab as {p.name.split(" ")[0]}</span>
              </span>
            </button>
            <IconButton label={`Remove ${p.name} from this browser`} size="sm" onClick={() => forgetProfile(p.id)} className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100">
              <X size={14} />
            </IconButton>
          </li>
        ))}
      </ul>
      <Button variant="glass" className="justify-self-start" onClick={() => setCreating(true)}>
        Add someone else
      </Button>
    </div>
  );
}
