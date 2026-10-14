"use client";

import { MotionConfig } from "motion/react";
import { ThemeProvider, useTheme } from "next-themes";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";
import { PromptHost } from "@/components/ui/prompt";
import { loadDock } from "@/modules/ai/lib/dock-store";
import { FilePreviewDialog } from "@/modules/editor/components/file-preview-dialog";
import { loadProfile } from "@/modules/profile";
import { loadUiPrefs } from "@/modules/shell";
import { loadExpanded } from "@/modules/sidebar";

/** App-wide providers, the session read, and the one-time reads of per-browser preferences. */
export function AppProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    void loadProfile();
    loadUiPrefs();
    loadExpanded();
    loadDock();
  }, []);

  return (
    <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem disableTransitionOnChange>
      <MotionConfig reducedMotion="user">
        {children}
        <PromptHost />
        <FilePreviewDialog />
        <ThemedToaster />
      </MotionConfig>
    </ThemeProvider>
  );
}

/** Toasts follow the active theme so their text keeps its contrast in dark mode. */
function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      position="bottom-center"
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      toastOptions={{
        classNames: {
          toast: "!rounded-[18px] !border-0 !bg-surface !text-ink !shadow-elev !font-sans",
          description: "!text-ink-2",
          actionButton: "!bg-accent !text-on-accent !rounded-full",
        },
      }}
    />
  );
}
