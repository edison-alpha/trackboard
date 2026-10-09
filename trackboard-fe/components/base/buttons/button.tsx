"use client";

import type { ButtonHTMLAttributes } from "react";
import { Button as TbButton } from "@/components/ui/button";

/**
 * BoardUI's Button API, rendered with Trackdocs's buttons so imported BoardUI components
 * (date pickers) match the rest of the app: "secondary" is the glass pill, everything else primary.
 */
export function Button({ variant = "primary", size, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "tertiary" | "ghost" | "destructive"; size?: "medium" | "small" }) {
  const v = variant === "secondary" || variant === "tertiary" ? "glass" : variant === "ghost" ? "ghost" : variant === "destructive" ? "danger" : "primary";
  return <TbButton variant={v} size={size === "small" ? "sm" : "md"} {...rest} />;
}
