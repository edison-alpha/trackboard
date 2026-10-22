import type { ReactNode } from "react";
import type { Tool } from "../lib/scene";

const PATHS: Record<Tool, ReactNode> = {
  select: <path d="M5 3l14 7-6 2-2 6z" />,
  hand: <path d="M8 13V6a1.5 1.5 0 013 0v5m0-6a1.5 1.5 0 013 0v6m0-4.5a1.5 1.5 0 013 0V15a6 6 0 01-6 6h-1a6 6 0 01-4.6-2.2L4 15a1.5 1.5 0 012.2-2L8 14.5" />,
  rect: <rect x="4" y="5" width="16" height="14" rx="2" />,
  ellipse: <ellipse cx="12" cy="12" rx="8.5" ry="7" />,
  diamond: <path d="M12 3l9 9-9 9-9-9z" />,
  line: <path d="M5 19L19 5" />,
  arrow: <path d="M5 19L19 5m0 0h-7m7 0v7" />,
  pen: <path d="M4 20l1-4L16.5 4.5a2 2 0 013 3L8 19z" />,
  text: <path d="M6 6V4h12v2M12 4v16m-3 0h6" />,
  eraser: <path d="M8 20h12M5.5 15.5l9-9a2 2 0 012.8 0l1.2 1.2a2 2 0 010 2.8L11 18H8l-2.5-2.5a1 1 0 010-1z" />,
};

export function ToolIcon({ tool, size = 18 }: { tool: Tool; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="pointer-events-none">
      {PATHS[tool]}
    </svg>
  );
}

const SMALL = {
  undo: <path d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3" />,
  redo: <path d="M15 14l5-5-5-5m5 5H10a6 6 0 000 12h3" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  fit: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5m11-5v5h-5" />,
  download: <path d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14" />,
  trash: <path d="M5 7h14M10 7V4h4v3m-7 0l1 13h8l1-13" />,
  canvas: <path d="M4 5h16v14H4zM8 15l3-4 2 2 3-4 2 3" />,
};

export function SmallIcon({ name, size = 18 }: { name: keyof typeof SMALL; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="pointer-events-none">
      {SMALL[name]}
    </svg>
  );
}
