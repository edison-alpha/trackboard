"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { ThemeProvider, useTheme } from "next-themes";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { makeQueryClient } from "@/lib/api/query-client";
import { PromptHost } from "@/components/ui/prompt";
import { loadDock } from "@/modules/ai/lib/dock-store";
import { FilePreviewDialog } from "@/modules/editor/components/file-preview-dialog";
import { loadUiPrefs } from "@/modules/shell";
import { loadExpanded } from "@/modules/sidebar";
import { loadActiveWorkspace } from "@/modules/workspace/lib/active";

/** App-wide providers: the data cache, the theme, and the one-time reads of per-browser preferences. */
export function AppProviders({ children }: { children: ReactNode }) {
  // One cache per browser tab; created once so a re-render never throws away what was fetched.
  const [queryClient] = useState(makeQueryClient);
  useEffect(() => {
    loadUiPrefs();
    loadExpanded();
    loadDock();
    loadActiveWorkspace();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem disableTransitionOnChange>
        <MotionConfig reducedMotion="user">
          {children}
          <PromptHost />
          <FilePreviewDialog />
          <ThemedToaster />
        </MotionConfig>
      </ThemeProvider>
    </QueryClientProvider>
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
