"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { signIn, useProfile } from "@/modules/profile";
import { useAcceptInvite } from "../hooks";
import { invitePreviewQuery } from "../queries";

/** What an invite link leads to: who invited you to what, and one button to accept it (after signing in with Google). */
export function InvitePage({ code }: { code: string }) {
  const profile = useProfile();
  const preview = useQuery(invitePreviewQuery(code));
  const accept = useAcceptInvite();
  const router = useRouter();

  const p = preview.data;
  const target = p ? (p.kind === "page" ? `"${p.pageTitle}"` : p.workspaceName) : "";
  const level = p ? (p.kind === "page" ? (p.level === "edit" ? "edit" : "view") : p.level === "admin" ? "as an admin" : "as a member") : "";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <section className="w-full max-w-md" aria-labelledby="invite-title">
        <Logo />
        {preview.isPending && <p className="mt-8 text-ink-2">Checking the invite…</p>}
        {preview.isError && (
          <>
            <h1 id="invite-title" className="mt-8 text-[28px] leading-tight font-bold tracking-[-0.02em] text-ink">
              This invite isn&apos;t valid any more
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">It may have been cancelled or used already. Ask the person who invited you for a new link.</p>
            <Button variant="glass" className="mt-6" onClick={() => router.push("/")}>
              Go to Trackdocs
            </Button>
          </>
        )}
        {p && (
          <>
            <h1 id="invite-title" className="mt-8 text-[28px] leading-tight font-bold tracking-[-0.02em] text-ink sm:text-[32px]">
              {p.inviter} invited you to {target}
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
              {p.kind === "page" ? `You will be able to ${level} this page.` : `You will join ${level}.`}
              {p.email && ` This invite is for ${p.email}.`}
            </p>
            {p.expired ? (
              <p role="alert" className="mt-6 text-sm text-danger">
                This invite has expired. Ask for a new one.
              </p>
            ) : profile === undefined ? null : profile === null ? (
              <Button variant="primary" className="mt-6" onClick={signIn}>
                Continue with Google
              </Button>
            ) : (
              <>
                <Button
                  variant="primary"
                  className="mt-6"
                  busy={accept.isPending}
                  onClick={() => accept.mutate(code, { onSuccess: (r) => router.push(r.pageId ? `/p/${r.pageId}` : "/") })}
                >
                  {p.kind === "page" ? "Open the page" : "Join workspace"}
                </Button>
                <p className="mt-3 text-xs text-ink-3">Signed in as {profile.email}</p>
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}
