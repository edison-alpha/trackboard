"use client";

import { useEffect, useState, type ReactNode } from "react";
import { List, SidebarOpen } from "@/components/icons";
import { Button, IconButton } from "@/components/ui/button";
import { cx } from "@/lib/cx";
import { setUi, useUi } from "../lib/ui-store";

/** How far the page scrolls before a bar that floats over a cover turns solid. */
const SOLID_AFTER = 120;

/**
 * Top bar of the page area: navigation toggle, a title slot, and page actions.
 * `overCover`: the bar floats transparent over the page cover, with its controls on glass pills so they stay
 * readable on any image, and turns solid once the cover has scrolled away.
 */
export function Topbar({ children, actions, overCover }: { children?: ReactNode; actions?: ReactNode; overCover?: boolean }) {
  const { sidebar } = useUi();
  const [solid, setSolid] = useState(!overCover);

  useEffect(() => {
    if (!overCover) return setSolid(true);
    const scroller = document.getElementById("tb-scroll");
    const update = () => setSolid((scroller?.scrollTop ?? 0) > SOLID_AFTER);
    update();
    scroller?.addEventListener("scroll", update, { passive: true });
    return () => scroller?.removeEventListener("scroll", update);
  }, [overCover]);

  const floating = overCover && !solid;
  const pill = floating ? "glass-strong rounded-full px-1.5 py-1" : "";

  return (
    <header
      data-print-hide
      className={cx("progressive-blur sticky top-0 z-20 flex h-14 items-center gap-2 px-3 sm:px-5", floating && "progressive-blur-clear")}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      {/* Phones: labelled menu button so the drawer is discoverable. */}
      <Button variant="ghost" size="sm" icon={<List size={18} />} onClick={() => setUi({ drawer: true })} className={cx("-ml-1 px-2.5 md:hidden", floating && "glass-strong")}>
        Menu
      </Button>
      {!sidebar && (
        <IconButton label="Open sidebar (Ctrl/⌘ \)" onClick={() => setUi({ sidebar: true })} className={cx("hidden md:inline-flex", floating && "glass-strong")}>
          <SidebarOpen size={18} />
        </IconButton>
      )}
      <div className="flex min-w-0 flex-1 items-center">{children && <div className={cx("flex min-w-0 items-center", pill || "flex-1")}>{children}</div>}</div>
      {actions && <div className={cx("flex shrink-0 items-center gap-1", pill)}>{actions}</div>}
    </header>
  );
}
