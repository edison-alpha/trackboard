"use client";

import { addCollection, Icon as Iconify } from "@iconify/react";
import type { ComponentType } from "react";
import { cx } from "@/lib/cx";
import { FLUENT, SOLAR } from "@/lib/icon-data";

/*
 * Trackboard's icon set: Solar (Iconify). Its soft, rounded strokes match SF Pro Rounded, and every glyph has a
 * linear and a bold form, so `weight="fill"` gives the active state (favorite star, selected theme) without a
 * second colour. Icon data is bundled in lib/icon-data.ts (bun scripts/build-icons.ts), so nothing loads at runtime.
 */
addCollection(SOLAR);
/* Icons never take pointer events: Iconify swaps the <svg> contents on re-render, and a click whose mousedown
   landed on a swapped-out <path> is dropped by the browser. With this, the button itself is always the target. */
addCollection(FLUENT);

export type IconProps = {
  size?: number;
  /** "fill" switches to Solar's bold form. Other weights keep the linear form, which already reads at small sizes. */
  weight?: "regular" | "bold" | "fill";
  className?: string;
  color?: string;
};

export type Icon = ComponentType<IconProps>;

function solar(name: string): Icon {
  function SolarIcon({ size = 18, weight, className, color }: IconProps) {
    return <Iconify icon={`solar:${name}-${weight === "fill" ? "bold" : "linear"}`} width={size} height={size} className={cx("pointer-events-none shrink-0", className)} color={color} aria-hidden="true" />;
  }
  SolarIcon.displayName = `Icon(${name})`;
  return SolarIcon;
}

/** Fluent glyph with an explicit regular and filled form (carets and the plain plus, which Solar lacks). */
function fluent(regular: string, filled: string): Icon {
  function FluentIcon({ size = 18, weight, className, color }: IconProps) {
    return <Iconify icon={`fluent:${weight === "fill" ? filled : regular}`} width={size} height={size} className={cx("pointer-events-none shrink-0", className)} color={color} aria-hidden="true" />;
  }
  FluentIcon.displayName = `Icon(fluent:${regular})`;
  return FluentIcon;
}

/** Text formats Solar has no glyph for (headings, sub/superscript, inline math) are set in the UI font instead. */
function glyph(text: string, label: string): Icon {
  function Glyph({ size = 18, className }: IconProps) {
    return (
      <span
        aria-hidden="true"
        title={label}
        className={cx("inline-flex shrink-0 items-center justify-center font-sans leading-none font-semibold tracking-[-0.02em]", className)}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.68) }}
      >
        {text}
      </span>
    );
  }
  Glyph.displayName = `Glyph(${label})`;
  return Glyph;
}

// Navigation and layout
export const SidebarSimple = solar("panel-left-close");
export const SidebarOpen = solar("panel-left-open");
export const List = solar("hamburger-menu");
export const MagnifyingGlass = solar("magnifier");
export const Keyboard = solar("keyboard");
export const CaretRight = fluent("caret-right-16-filled", "caret-right-16-filled");
export const CaretDown = fluent("caret-down-16-filled", "caret-down-16-filled");
export const CaretLeft = fluent("caret-left-16-filled", "caret-left-16-filled");
export const CaretUp = fluent("caret-up-16-filled", "caret-up-16-filled");
export const CaretCircleRight = solar("round-alt-arrow-right");
export const ArrowUp = solar("arrow-up");
export const ArrowDown = solar("arrow-down");
export const ArrowLeft = solar("arrow-left");
export const ArrowRight = solar("arrow-right");
export const ArrowsHorizontal = solar("full-screen");
export const DotsThree = solar("menu-dots");
export const DotsSixVertical = solar("hamburger-menu");
export const X = fluent("dismiss-20-regular", "dismiss-20-filled");
export const Check = solar("check");

// Pages and actions
export const FileText = solar("document-text");
export const FilePlus = solar("document-add");
export const Plus = fluent("add-20-regular", "add-20-filled");
export const PencilSimple = solar("pen");
export const Copy = solar("copy");
export const Trash = solar("trash-bin-minimalistic");
export const Star = solar("star");
export const BookmarkSimple = solar("bookmark");
export const ClockCounterClockwise = solar("history");
export const ArrowCounterClockwise = solar("undo-left-round");
export const DownloadSimple = solar("download-minimalistic");
export const UploadSimple = solar("upload-minimalistic");
export const Printer = solar("printer-minimalistic");
export const Paragraph = solar("paragraph-spacing");
export const ImageSquare = solar("gallery-wide");
export const Smiley = solar("smile-circle");
export const ChatCircleText = solar("chat-round-line");
/** The AI entry point: a chat bubble, not a sparkle (antislop R-04). */
export const ChatDots = solar("chat-round-dots");
export const Stop = solar("stop-circle");
export const Restart = solar("restart");

// People, theme, sync
export const UserCircle = solar("user-circle");
export const UserSwitch = solar("users-group-two-rounded");
export const Sun = solar("sun");
export const Moon = solar("moon");
export const Desktop = solar("monitor");
export const HardDrives = solar("server-minimalistic");
export const CloudArrowUp = solar("cloud-upload");
export const CloudCheck = solar("cloud-check");
export const CloudSlash = solar("cloud-cross");

// Editor blocks and formatting
export const TextT = solar("text-square");
export const TextB = solar("text-bold");
export const TextItalic = solar("text-italic");
export const TextUnderline = solar("text-underline");
export const TextStrikethrough = solar("text-cross");
export const TextAlignLeft = solar("align-left");
export const TextAlignCenter = solar("align-horizontal-center");
export const TextAlignRight = solar("align-right");
export const Code = solar("code");
export const LinkSimple = solar("link");
export const LinkBreak = solar("unlink");
export const Quotes = solar("quote");
export const Minus = solar("minus");
export const Info = solar("info-circle");
export const Warning = solar("danger-triangle");
export const CheckCircle = solar("check-circle");
export const CheckSquare = solar("check-square");
export const ListBullets = solar("list");
export const ListNumbers = solar("list-ordered");
export const Image = solar("gallery");
export const YoutubeLogo = solar("video-frame-play-horizontal");
export const Table = solar("table");
export const Rows = solar("table-rows-split");
export const Columns = solar("table-columns-split");
export const ArrowsInLineHorizontal = solar("table-cells-merge");
export const SquareSplitHorizontal = solar("table-cells-split");
export const MathOperations = solar("calculator-minimalistic");
export const Inbox = solar("inbox");
export const Paperclip = solar("paperclip");
export const Calendar = solar("calendar");
export const Mention = solar("mention-circle");
export const Palette = solar("palette");
export const Eraser = solar("eraser");
export const WindowFrame = solar("window-frame");
export const Contents = solar("list-arrow-down");
export const BookmarkCard = solar("bookmark-square");
export const LinkRound = solar("link-round");
export const ColumnsLayout = solar("widget-2");
export const UserRounded = solar("user-rounded");
export const TextHFour = glyph("H4", "Heading 4");
export const TextHOne = glyph("H1", "Heading 1");
export const TextHTwo = glyph("H2", "Heading 2");
export const TextHThree = glyph("H3", "Heading 3");
export const TextSubscript = glyph("x₂", "Subscript");
export const TextSuperscript = glyph("x²", "Superscript");
export const Function = glyph("ƒx", "Inline equation");

/**
 * Any icon from the installed Solar or Fluent sets by name, e.g. <AppIcon icon="solar:calendar-linear" />.
 * Run `bun run icons` after adding one so it is bundled; until then Iconify loads it from its API.
 */
export function AppIcon({ icon, size = 18, className, color }: IconProps & { icon: `solar:${string}` | `fluent:${string}` }) {
  return <Iconify icon={icon} width={size} height={size} className={cx("pointer-events-none shrink-0", className)} color={color} aria-hidden="true" />;
}
