"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { ProfilePicker, useProfiles } from "@/modules/profile";
import { OnboardingWizard } from "./onboarding-wizard";

/**
 * Shown when this tab has no signed-in person. A first visit gets the guided setup;
 * returning people pick their profile, or start the setup again for someone new.
 */
export function Onboarding() {
  const profiles = useProfiles();
  const [wizard, setWizard] = useState(profiles.length === 0);

  if (wizard) return <OnboardingWizard onCancel={profiles.length > 0 ? () => setWizard(false) : undefined} />;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, ease: "easeOut" }} className="w-full max-w-md" aria-labelledby="onboarding-title">
        <Logo />
        <h1 id="onboarding-title" className="mt-8 text-[28px] leading-tight font-bold tracking-[-0.02em] text-ink sm:text-[32px]">
          Welcome back
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-2">Each tab can use a different profile. Open a second tab as someone else to try writing together.</p>
        <div className="mt-8 grid gap-3">
          <ProfilePicker />
          <Button variant="ghost" className="justify-self-start" onClick={() => setWizard(true)}>
            Set up a new profile
          </Button>
        </div>
      </motion.section>
    </main>
  );
}
