"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { signIn, useSessionStatus } from "@/modules/profile";

const SIGNIN_ERRORS: Record<string, string> = {
  cancelled: "Sign-in was cancelled. Try again when you're ready.",
  expired: "That sign-in attempt expired. Start it again.",
  failed: "Google sign-in didn't complete. Try again.",
};

/** Shown when nobody is signed in: one button, Google does the rest. */
export function SignInScreen() {
  const { error: serverError, retry } = useSessionStatus();
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The server sends a failed sign-in back with ?signin_error=<reason>; show it once, then tidy the address bar.
  useEffect(() => {
    const url = new URL(location.href);
    const reason = url.searchParams.get("signin_error");
    if (!reason) return;
    setNotice(SIGNIN_ERRORS[reason] ?? SIGNIN_ERRORS.failed!);
    url.searchParams.delete("signin_error");
    history.replaceState(null, "", url);
  }, []);

  const problem = serverError ?? notice;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, ease: "easeOut" }} className="w-full max-w-md" aria-labelledby="signin-title">
        <Logo />
        <h1 id="signin-title" className="mt-8 text-[28px] leading-tight font-bold tracking-[-0.02em] text-ink sm:text-[32px]">
          Sign in to Trackdocs
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-2">Your pages are saved to your account, so they follow you to any device.</p>
        {problem && (
          <p role="alert" className="mt-5 text-sm text-danger">
            {problem}
          </p>
        )}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            busy={busy}
            onClick={() => {
              setBusy(true);
              signIn();
            }}
          >
            Continue with Google
          </Button>
          {serverError && (
            <Button variant="ghost" onClick={retry}>
              Try again
            </Button>
          )}
        </div>
      </motion.section>
    </main>
  );
}
