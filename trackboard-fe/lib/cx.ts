import { twMerge } from "tailwind-merge";

type ClassValue = string | false | null | undefined;

/** Joins conditional class names and lets the last conflicting Tailwind utility win. */
export function cx(...classes: ClassValue[]): string {
  return twMerge(classes.filter(Boolean).join(" "));
}
