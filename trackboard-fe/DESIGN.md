# Trackboard design direction

Source: owner direction in chat (Muse screenshots as reference, "glass for buttons etc.", "modern rounded", dark and light mode). This file records that direction; it is not a style invented by the agent.

## Identity

Trackboard is a workspace for team documentation: nested pages, a rich editor, live co-editing. People spend hours reading and writing here, so the text owns the screen and the chrome stays quiet until it is needed.

- **Personality:** calm, rounded, quick. Never loud.
- **Design Read:** documentation app for teams, modern rounded with glass accents.
- **Dial:** ENERGY 2 / RHYTHM 1 / MOTION 2
  - ENERGY 2: one confident accent and a rounded voice, nothing shouting.
  - RHYTHM 1 on purpose: a work tool needs every screen to behave the same way.
  - MOTION 2: panels, drawers and menus move so the eye can follow where they came from. Nothing loops except the loader while something is actually loading.

## Palette (2 neutrals + 1 accent)

Reference: the Muse app screenshots the owner shared (flat dark canvas, borderless cards, quiet grey pills, one blue). All pairs checked with the WCAG formula (4.5:1 text, 3:1 UI edges).

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--bg` | `#ffffff` | `#191919` | Page, editor and sidebar canvas: one flat plane like Muse |
| `--surface` | `#ffffff` | `#232323` | Dialogs, popovers |
| `--surface-2` | `#f2f2f2` | `#2a2a2a` | Cards, filled inputs, hover |
| `--ink` | `#141414` | `#f5f5f5` | Body text (18.4 / 16.1) |
| `--ink-2` | `#4a4a4a` | `#b3b3b3` | Secondary text |
| `--ink-3` | `#666666` | `#9a9a9a` | Meta text, placeholders (min 4.76 on cards) |
| `--accent` | `#0b6fe8` | `#0b6fe8` | Primary button fill, white label 4.72 |
| `--accent-ink` | `#0a5ec8` | `#4da3ff` | Accent as text or link (6.1 / 6.7) |

- Why this blue: Muse's blue, nudged a step darker than iOS `#0a84ff` (3.65:1 with white) so the white label passes AA.
- The accent is for the one primary action on a screen, links, the focus ring and the active page. Nowhere else.
- Text and highlight colours inside documents are user content, not part of the UI palette.

## Typography

- **UI and documents:** SF Pro Rounded (self-hosted from the owner's own brand files). Why: the owner asked for "modern rounded", and a rounded sans carries that in every label without extra decoration.
- **Code blocks and inline code:** the system monospace stack. Why: code needs fixed width; it is a function, not an aesthetic.
- Page titles 40px/700 on desktop, 30px on phones. Body 16px with 1.7 line height for long reading.

## Shape

| Element | Radius | Why |
| --- | --- | --- |
| Buttons and icon buttons | full pill / circle | The owner's "modern rounded" signature, kept to controls you press |
| Menus, popovers, palette | 18px | Floating layers read as soft sheets |
| Inputs (filled, hairline edge) | 14px | Clearly a field, not a button |
| Cards, dialogs, panels | 24px | Largest surfaces get the softest corner |
| Rows in lists and the tree | 10px | Tight, so many rows stack cleanly |

## Glass (dose cap, R-10)

Glass is applied to **pill buttons and floating layers only** (bubble menu, slash menu, command palette, dropdowns, toasts). Owner choice "glass terarah".
The sidebar, editor and dialogs stay solid because long text must stay crisp.
Recipe: translucent fill + `backdrop-filter: blur(20px) saturate(160%)` + 1px top-lit edge. Falls back to a solid surface when the user asks for reduced transparency.

## Shadow

Only floating layers (menus, palette, dialogs) are elevated. Everything that sits on the page is flat.

## Identity motif

The logo is a **T built from three board columns**: two short columns form the bar and a tall middle column forms the stem. The column shape returns:
- in the loader, where the three columns rise one after another,
- in empty states, as the illustration,


## Icons

Solar, from Iconify (CC BY 4.0), bundled locally in `lib/icon-data.ts` so icons render offline. Why: its soft, rounded strokes match SF Pro Rounded, and each glyph has a linear and a bold form, so the bold form marks an active state (favorite, selected theme) without adding colour. Headings, sub/superscript and inline math use small typographic glyphs in the UI font, because Solar has no icons for them and text reads clearer there. Same icon source as the owner's sama-frontend.

## Motion

- Panels and drawers slide from the edge they belong to (200 to 260 ms, ease-out).
- Menus scale from 96% with a fade (140 ms) so they read as coming out of their trigger.
- Tree expand/collapse animates height so the rows below don't jump.
- `prefers-reduced-motion`: transitions drop to opacity only.

## Voice

Interface copy is English: short, plain, and direct. Buttons name the action ("New page", "Restore this version", "Delete for good"), never "Get Started" filler. Empty, loading and error states say what happened and what to do next. Destructive confirmations say what will be lost and that it can't be undone.

## Avatars

Default avatars come from `boring-avatars` ("beam"), requested by the owner. Each one is seeded by the person's name and tinted from their cursor colour, so the face in the sidebar, comments and presence matches their caret in the document.

## AI presence

The assistant has one face and one "thinking" signal, both in the accent blue:
- **Bot avatar** (`bot-avatars`, owner's choice): type `square` with plastic shading. The rounded square echoes the logo tile; the gloss matches the Apple-style glass. It idles while waiting and hops while the model works.
- **Thinking orb** (`thinking-orbs`, owner's choice) replaces spinners for AI work only. The animation matches the job: `composing` for writing, `searching` for reading pages, `weaving` for translation, `solving` for summaries, `shaping` for structure, `connecting` for brainstorming. Tinted `#0b6fe8` on light, `#4da3ff` on dark.
- No sparkle or magic icons anywhere (R-04): the entry points say "Ask AI" with a chat-bubble icon.
