"use client";

import { AppShell } from "@/modules/shell";
import { WorkspaceProvider } from "@/modules/workspace";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider>
      <AppShell>{children}</AppShell>
    </WorkspaceProvider>
  );
}
