"use client";

import { Desktop, Moon, Sun } from "@/components/icons";
import { motion } from "motion/react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cx } from "@/lib/cx";

const OPTIONS = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "Match device", Icon: Desktop },
] as const;

/** Three-way theme control. The selected pill slides between options. */
export function ThemeSwitch({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const current = mounted ? (theme ?? "system") : "system";

  return (
    <div role="radiogroup" aria-label="Theme" className={cx("flex rounded-full bg-(--sidebar-active) p-0.5", className)}>
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = current === value;
        return (
          <button
            key={value}
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cx("relative flex h-7 flex-1 items-center justify-center rounded-full transition-colors pointer-coarse:h-10", active ? "text-ink" : "text-ink-3 hover:text-ink")}
          >
            {active && <motion.span layoutId="theme-pill" className="absolute inset-0 rounded-full bg-surface shadow-sm" transition={{ type: "spring", stiffness: 500, damping: 35 }} />}
            <Icon size={15} className="relative" weight={active ? "fill" : "regular"} />
          </button>
        );
      })}
    </div>
  );
}

/** Flips between light and dark (Alt+T). */
export function useToggleTheme(): () => void {
  const { resolvedTheme, setTheme } = useTheme();
  return () => setTheme(resolvedTheme === "dark" ? "light" : "dark");
}
