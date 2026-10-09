/* Page covers: quiet tones mixed into the canvas colour, so they adapt to light and dark on their own. */

export const COVERS = [
  { id: "sky", label: "Sky", css: "color-mix(in srgb, var(--doc-blue) 26%, var(--bg))" },
  { id: "sage", label: "Sage", css: "color-mix(in srgb, var(--doc-green) 24%, var(--bg))" },
  { id: "sand", label: "Sand", css: "color-mix(in srgb, var(--doc-orange) 22%, var(--bg))" },
  { id: "rose", label: "Rose", css: "color-mix(in srgb, var(--doc-red) 20%, var(--bg))" },
  { id: "plum", label: "Plum", css: "color-mix(in srgb, var(--doc-purple) 22%, var(--bg))" },
  { id: "stone", label: "Stone", css: "var(--surface-3)" },
] as const;

/** CSS background for a stored cover value (preset id or image data URL). */
export function coverBackground(cover: string, y = 50): string {
  const preset = COVERS.find((c) => c.id === cover);
  if (preset) return preset.css;
  return `center ${y}% / cover no-repeat url("${cover.replace(/"/g, "%22")}")`;
}

export const isImageCover = (cover: string | null) => !!cover && !COVERS.some((c) => c.id === cover);
