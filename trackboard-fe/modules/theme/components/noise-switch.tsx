"use client";

import { useEffect, useState } from "react";
import { cx } from "@/lib/cx";

const STORAGE_KEY = "trackdocs-noise";

function applyNoise(enabled: boolean) {
  document.documentElement.dataset.noise = enabled ? "on" : "off";
}

export function NoiseSwitch({ className }: { className?: string }) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const next = stored === "on";
    setEnabled(next);
    applyNoise(next);
  }, []);

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    window.localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
    applyNoise(next);
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label="Background texture"
      title={enabled ? "Turn off background texture" : "Turn on background texture"}
      onClick={toggle}
      className={cx("flex h-8 items-center gap-2 rounded-full px-2.5 text-xs font-medium text-ink-2 transition-colors hover:bg-(--sidebar-hover) hover:text-ink pointer-coarse:h-10", className)}
    >
      <span aria-hidden="true" className={cx("h-3 w-3 rounded-full border border-current transition-colors", enabled && "border-accent bg-accent")} />
      Texture
    </button>
  );
}
