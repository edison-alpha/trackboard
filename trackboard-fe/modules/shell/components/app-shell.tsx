"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { AskDialog, toggleDock } from "@/modules/ai";
import { CommandPalette } from "@/modules/command";
import { ProfileDialog } from "@/modules/profile";
import { MembersDialog } from "@/modules/sharing";
import { ShortcutsDialog, useGlobalShortcuts } from "@/modules/shortcuts";
import { Sidebar } from "@/modules/sidebar";
import { TemplateDialog } from "@/modules/templates";
import { useToggleTheme } from "@/modules/theme";
import { usePageActions } from "@/modules/workspace";
import { cx } from "@/lib/cx";
import { useMediaQuery } from "@/lib/use-media-query";
import { setUi, togglePanel, useUi } from "../lib/ui-store";

const SIDEBAR_W = 272;

/** Workspace frame: sidebar (column on desktop, drawer on phones), page area, and app-wide dialogs. */
export function AppShell({ children }: { children: ReactNode }) {
  const state = useUi();
  const desktop = useMediaQuery("(min-width: 768px)");
  const pathname = usePathname();
  const actions = usePageActions();
  const toggleTheme = useToggleTheme();
  const currentId = pathname.startsWith("/p/") ? pathname.slice(3) : null;

  // Leaving a page closes its panels; navigating on a phone closes the drawer.
  useEffect(() => setUi({ drawer: false, panel: null }), [pathname]);

  useGlobalShortcuts({
    palette: () => setUi({ palette: !state.palette }),
    shortcuts: () => setUi({ shortcuts: !state.shortcuts }),
    sidebar: () => (desktop ? setUi({ sidebar: !state.sidebar }) : setUi({ drawer: !state.drawer })),
    theme: toggleTheme,
    "new-page": () => actions.create(),
    favorite: () => currentId && actions.toggleFavorite(currentId),
    comments: () => currentId && togglePanel("comments"),
    history: () => currentId && togglePanel("history"),
    "ai-dock": () => currentId && toggleDock(),
  });

  return (
    <div className="flex h-dvh bg-sidebar">
      {/* Desktop: the sidebar is fixed to the viewport; the spacer reserves its width in the layout
          so both animate together and the page never scrolls the sidebar away. */}
      <motion.div
        aria-hidden="true"
        className="hidden shrink-0 md:block"
        initial={false}
        animate={{ width: state.sidebar ? SIDEBAR_W : 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 40 }}
      />
      <motion.aside
        aria-label="Sidebar"
        data-print-hide
        className="fixed inset-y-0 left-0 z-30 hidden overflow-hidden bg-sidebar md:block"
        initial={false}
        animate={{ width: state.sidebar ? SIDEBAR_W : 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 40 }}
      >
        <div style={{ width: SIDEBAR_W }} className="h-full" inert={!state.sidebar || undefined}>
          <Sidebar onCollapse={() => setUi({ sidebar: false })} />
        </div>
      </motion.aside>

      {/* Phone drawer */}
      <AnimatePresence>
        {!desktop && state.drawer && (
          <>
            <motion.div
              key="drawer-scrim"
              className="fixed inset-0 z-40 bg-scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setUi({ drawer: false })}
              aria-hidden="true"
            />
            <motion.aside
              key="drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              className="fixed inset-y-0 left-0 z-50 w-[86vw] max-w-[320px] bg-sidebar shadow-elev"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 420, damping: 42 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={{ left: 0.4, right: 0 }}
              onDragEnd={(_, info) => info.offset.x < -80 && setUi({ drawer: false })}
              onKeyDown={(e) => e.key === "Escape" && setUi({ drawer: false })}
              style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
            >
              <Sidebar onNavigate={() => setUi({ drawer: false })} onCollapse={() => setUi({ drawer: false })} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* The page sits on the sidebar-coloured frame as a rounded panel and scrolls inside itself,
          so the sidebar and frame never move. #tb-scroll is the scroll parent for the table of contents. */}
      <div
        id="tb-scroll"
        className={cx(
          "thin-scroll relative min-w-0 flex-1 overflow-y-auto overscroll-contain bg-bg md:my-2 md:mr-2 md:rounded-[20px] md:border md:border-line",
          !state.sidebar && "md:ml-2",
        )}
      >
        {children}
      </div>

      <CommandPalette open={state.palette} onOpenChange={(o) => setUi({ palette: o })} />
      <ShortcutsDialog open={state.shortcuts} onOpenChange={(o) => setUi({ shortcuts: o })} />
      <TemplateDialog open={state.templates} onOpenChange={(o) => setUi({ templates: o })} parentId={currentId} />
      <ProfileDialog open={state.profile} onOpenChange={(o) => setUi({ profile: o })} />
      <AskDialog open={state.ask} onOpenChange={(o) => setUi({ ask: o })} />
      <MembersDialog open={state.members} onOpenChange={(o) => setUi({ members: o })} />
    </div>
  );
}
