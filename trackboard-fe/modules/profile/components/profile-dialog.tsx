"use client";

import { Dialog } from "@/components/ui/dialog";
import { useProfile } from "../hooks";
import { ProfileForm } from "./profile-form";

export function ProfileDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const profile = useProfile();
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Your profile" description="Shown on your cursor, your comments, and in version history.">
      <div className="px-5 pb-5">
        <ProfileForm key={String(open)} initial={profile} submitLabel="Save" onDone={() => onOpenChange(false)} />
      </div>
    </Dialog>
  );
}
