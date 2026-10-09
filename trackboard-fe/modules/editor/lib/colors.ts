/* Document colours reference CSS variables, so the same text stays readable after a theme switch. */

export const TEXT_COLORS = [
  { name: "Default", value: null },
  { name: "Gray", value: "var(--doc-gray)" },
  { name: "Red", value: "var(--doc-red)" },
  { name: "Orange", value: "var(--doc-orange)" },
  { name: "Green", value: "var(--doc-green)" },
  { name: "Blue", value: "var(--doc-blue)" },
  { name: "Purple", value: "var(--doc-purple)" },
] as const;

export const HIGHLIGHTS = [
  { name: "No highlight", value: null },
  { name: "Yellow", value: "var(--mark-yellow)" },
  { name: "Green", value: "var(--mark-green)" },
  { name: "Blue", value: "var(--mark-blue)" },
  { name: "Pink", value: "var(--mark-pink)" },
  { name: "Gray", value: "var(--mark-gray)" },
] as const;
