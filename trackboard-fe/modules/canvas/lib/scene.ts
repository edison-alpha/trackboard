/** A canvas scene: a flat list of shapes in paint order. It is stored as JSON in the canvas block, so it syncs like any text. */

export type Tool = "select" | "hand" | "rect" | "ellipse" | "diamond" | "line" | "arrow" | "pen" | "text" | "eraser";

export type Pt = [number, number];
export const ORIGIN: Pt = [0, 0];

export type Shape = {
  id: string;
  type: "rect" | "ellipse" | "diamond" | "line" | "arrow" | "pen" | "text";
  x: number;
  y: number;
  /** Size of the bounding box. For line, arrow and pen the points are relative to x and y. */
  w: number;
  h: number;
  stroke: string;
  fill: string;
  strokeWidth: number;
  dashed?: boolean;
  /** Line, arrow and pen: points relative to (x, y). */
  points?: Pt[];
  text?: string;
  fontSize?: number;
};

export type Scene = { v: 1; shapes: Shape[] };

export const EMPTY_SCENE: Scene = { v: 1, shapes: [] };

export const STROKES = ["#1e1e1e", "#e03131", "#2f9e44", "#1971c2", "#f08c00", "#9c36b5"] as const;
export const FILLS = ["transparent", "#ffc9c9", "#b2f2bb", "#a5d8ff", "#ffec99", "#eebefa"] as const;
export const WIDTHS = [1.5, 3, 5] as const;

export function parseScene(raw: unknown): Scene {
  if (typeof raw !== "string" || !raw) return EMPTY_SCENE;
  try {
    const s = JSON.parse(raw) as Scene;
    return s && Array.isArray(s.shapes) ? { v: 1, shapes: s.shapes } : EMPTY_SCENE;
  } catch {
    return EMPTY_SCENE;
  }
}

export const serializeScene = (s: Scene) => JSON.stringify(s);

export type Box = { x: number; y: number; w: number; h: number };

export function boundsOf(shapes: Shape[]): Box | null {
  if (!shapes.length) return null;
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const s of shapes) {
    const b = shapeBox(s);
    x1 = Math.min(x1, b.x);
    y1 = Math.min(y1, b.y);
    x2 = Math.max(x2, b.x + b.w);
    y2 = Math.max(y2, b.y + b.h);
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/** Normalized box: width and height are never negative. */
export function shapeBox(s: Shape): Box {
  if (s.points?.length) {
    const xs = s.points.map((p) => p[0]);
    const ys = s.points.map((p) => p[1]);
    const x = s.x + Math.min(...xs);
    const y = s.y + Math.min(...ys);
    return { x, y, w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  }
  return { x: Math.min(s.x, s.x + s.w), y: Math.min(s.y, s.y + s.h), w: Math.abs(s.w), h: Math.abs(s.h) };
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Whether a scene point lands on a shape (outline for hollow shapes, the inside for filled ones). */
export function hitShape(s: Shape, px: number, py: number, tolerance: number): boolean {
  const pad = tolerance + s.strokeWidth / 2;
  if (s.points) {
    for (let i = 0; i < s.points.length - 1; i++) {
      const [ax, ay] = s.points[i] ?? ORIGIN;
      const [bx, by] = s.points[i + 1] ?? ORIGIN;
      if (distToSegment(px, py, s.x + ax, s.y + ay, s.x + bx, s.y + by) <= pad) return true;
    }
    const [fx, fy] = s.points[0] ?? ORIGIN;
    return s.points.length === 1 && Math.hypot(px - s.x - fx, py - s.y - fy) <= pad;
  }
  const b = shapeBox(s);
  const filled = s.fill !== "transparent";
  if (s.type === "text") return px >= b.x - pad && px <= b.x + b.w + pad && py >= b.y - pad && py <= b.y + b.h + pad;
  const inside = px >= b.x - pad && px <= b.x + b.w + pad && py >= b.y - pad && py <= b.y + b.h + pad;
  if (!inside) return false;
  if (filled) return true;
  if (s.type === "rect") return px <= b.x + pad || px >= b.x + b.w - pad || py <= b.y + pad || py >= b.y + b.h - pad;
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  if (s.type === "ellipse") {
    const rx = b.w / 2 || 1;
    const ry = b.h / 2 || 1;
    const d = Math.hypot((px - cx) / rx, (py - cy) / ry);
    return Math.abs(d - 1) <= pad / Math.min(rx, ry) + 0.05;
  }
  // diamond
  const d = Math.abs(px - cx) / (b.w / 2 || 1) + Math.abs(py - cy) / (b.h / 2 || 1);
  return Math.abs(d - 1) <= pad / Math.min(b.w / 2 || 1, b.h / 2 || 1) + 0.05;
}

export function moveShape(s: Shape, dx: number, dy: number): Shape {
  return { ...s, x: s.x + dx, y: s.y + dy };
}

/** Rotates nothing; scales a shape from one box to another (used by the corner handle). */
export function resizeShape(s: Shape, from: Box, to: Box): Shape {
  const sx = from.w ? to.w / from.w : 1;
  const sy = from.h ? to.h / from.h : 1;
  const next: Shape = { ...s, x: to.x + (s.x - from.x) * sx, y: to.y + (s.y - from.y) * sy };
  if (s.points) next.points = s.points.map(([px, py]) => [px * sx, py * sy] as [number, number]);
  else {
    next.w = s.w * sx;
    next.h = s.h * sy;
  }
  if (s.type === "text" && s.fontSize) next.fontSize = Math.max(8, s.fontSize * Math.max(sx, sy));
  return next;
}

/** Smooth path through freehand points (midpoint quadratic curves). */
export function penPath(points: Pt[]): string {
  const [x0, y0] = points[0] ?? ORIGIN;
  if (points.length === 1) return `M${x0} ${y0}l0.01 0`;
  let d = `M${x0} ${y0}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i] ?? ORIGIN;
    const [nx, ny] = points[i + 1] ?? ORIGIN;
    d += `Q${px} ${py} ${(px + nx) / 2} ${(py + ny) / 2}`;
  }
  const [lx, ly] = points[points.length - 1] ?? ORIGIN;
  return `${d}L${lx} ${ly}`;
}

export function textSize(s: Shape): { w: number; h: number } {
  const size = s.fontSize ?? 20;
  const lines = (s.text ?? "").split("\n");
  const longest = Math.max(1, ...lines.map((l) => l.length));
  return { w: longest * size * 0.58, h: lines.length * size * 1.25 };
}
