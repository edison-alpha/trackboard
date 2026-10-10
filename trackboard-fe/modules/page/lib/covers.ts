/* Page covers: quiet tones mixed into the canvas colour, so they adapt to light and dark on their own. */

export const COVERS = [
  { id: "sky", label: "Sky", css: "radial-gradient(circle at 18% 18%, color-mix(in srgb, var(--doc-blue) 34%, transparent), transparent 46%), linear-gradient(135deg, color-mix(in srgb, var(--doc-blue) 26%, var(--bg)), var(--bg))" },
  { id: "sage", label: "Sage", css: "radial-gradient(circle at 78% 24%, color-mix(in srgb, var(--doc-green) 30%, transparent), transparent 44%), linear-gradient(135deg, color-mix(in srgb, var(--doc-green) 24%, var(--bg)), var(--bg))" },
  { id: "sand", label: "Sand", css: "radial-gradient(circle at 22% 72%, color-mix(in srgb, var(--doc-orange) 28%, transparent), transparent 45%), linear-gradient(135deg, color-mix(in srgb, var(--doc-orange) 22%, var(--bg)), var(--bg))" },
  { id: "rose", label: "Rose", css: "radial-gradient(circle at 78% 76%, color-mix(in srgb, var(--doc-red) 26%, transparent), transparent 45%), linear-gradient(135deg, color-mix(in srgb, var(--doc-red) 20%, var(--bg)), var(--bg))" },
  { id: "plum", label: "Plum", css: "radial-gradient(circle at 30% 25%, color-mix(in srgb, var(--doc-purple) 30%, transparent), transparent 45%), linear-gradient(135deg, color-mix(in srgb, var(--doc-purple) 22%, var(--bg)), var(--bg))" },
  { id: "stone", label: "Stone", css: "radial-gradient(circle at 70% 30%, color-mix(in srgb, var(--ink) 8%, transparent), transparent 48%), linear-gradient(135deg, var(--surface-3), var(--bg))" },
] as const;

/** CSS background for a stored cover value (preset id or image data URL). */
export function coverBackground(cover: string, y = 50): string {
  const preset = COVERS.find((c) => c.id === cover);
  if (preset) return preset.css;
  return `center ${y}% / cover no-repeat url("${cover.replace(/"/g, "%22")}")`;
}

export const isImageCover = (cover: string | null) => !!cover && !COVERS.some((c) => c.id === cover);
