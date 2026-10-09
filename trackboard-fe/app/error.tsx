"use client";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-dvh items-center justify-center">
      <ErrorState
        title="This screen ran into an error"
        body={`${error.message || "Unexpected error"}. Your pages are safe in this browser's storage. Try loading the screen again.`}
        action={
          <Button variant="primary" onClick={reset}>
            Try again
          </Button>
        }
      />
    </main>
  );
}
