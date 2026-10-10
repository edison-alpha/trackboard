"use client";

import { useRef, type ReactNode } from "react";
import { cx } from "@/lib/cx";

const MIN_PCT = 20;
const MAX_PCT = 100;

/**
 * Notion-style media resize: handles on both edges, dragging either one grows or shrinks the box from its
 * centre (so the media stays centred in the column instead of drifting). Width is a percentage of the
 * column, stored on the node so it persists and scales with the page.
 */
export function ResizableMedia({
  widthPct,
  onResize,
  selected,
  className,
  children,
}: {
  widthPct: number;
  onResize: (pct: number) => void;
  selected?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  const startDrag = (edge: "left" | "right") => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const track = trackRef.current;
    if (!track) return;
    const trackWidth = track.clientWidth;
    if (!trackWidth) return;
    const startWidthPx = (widthPct / 100) * trackWidth;
    const startX = e.clientX;
    const sign = edge === "right" ? 1 : -1;
    const min = (MIN_PCT / 100) * trackWidth;
    const max = (MAX_PCT / 100) * trackWidth;

    const move = (ev: PointerEvent) => {
      const next = Math.min(max, Math.max(min, startWidthPx + (ev.clientX - startX) * sign * 2));
      onResize(Math.round((next / trackWidth) * 100));
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  };

  return (
    <div ref={trackRef} className="tb-media-track" contentEditable={false}>
      <div className={cx("tb-resizable", selected && "is-selected", className)} style={{ width: `${Math.min(MAX_PCT, Math.max(MIN_PCT, widthPct))}%` }}>
        {children}
        <span className="tb-resizable-handle tb-resizable-handle-left" role="presentation" onPointerDown={startDrag("left")} />
        <span className="tb-resizable-handle tb-resizable-handle-right" role="presentation" onPointerDown={startDrag("right")} />
      </div>
    </div>
  );
}
