"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { createId } from "@/lib/id";
import { boundsOf, FILLS, hitShape, moveShape, ORIGIN, resizeShape, shapeBox, STROKES, textSize, WIDTHS, type Box, type Shape, type Tool } from "../lib/scene";
import { exportPng } from "../lib/export";
import { ShapeView, withTextSize } from "./shape-view";
import { SmallIcon, ToolIcon } from "./tool-icons";

type View = { x: number; y: number; z: number };

type Style = { stroke: string; fill: string; strokeWidth: number; dashed: boolean };

type Gesture =
  | { kind: "pan"; sx: number; sy: number; view: View }
  | { kind: "move"; start: [number, number]; before: Shape[]; ids: Set<string> }
  | { kind: "resize"; box: Box; before: Shape[]; ids: Set<string> }
  | { kind: "draw"; before: Shape[]; id: string; start: [number, number] }
  | { kind: "marquee"; start: [number, number]; base: Set<string> }
  | { kind: "erase"; before: Shape[]; hit: boolean };

type Editing = { id: string | null; x: number; y: number; value: string; fontSize: number; stroke: string };

const TOOLS: { tool: Tool; label: string; key: string }[] = [
  { tool: "select", label: "Select", key: "V" },
  { tool: "hand", label: "Pan", key: "H" },
  { tool: "rect", label: "Rectangle", key: "R" },
  { tool: "diamond", label: "Diamond", key: "D" },
  { tool: "ellipse", label: "Ellipse", key: "O" },
  { tool: "arrow", label: "Arrow", key: "A" },
  { tool: "line", label: "Line", key: "L" },
  { tool: "pen", label: "Draw", key: "P" },
  { tool: "text", label: "Text", key: "T" },
  { tool: "eraser", label: "Eraser", key: "E" },
];
const KEY_TOOL: Record<string, Tool> = { v: "select", h: "hand", r: "rect", d: "diamond", o: "ellipse", a: "arrow", l: "line", p: "pen", t: "text", e: "eraser", "1": "select", "2": "rect", "3": "diamond", "4": "ellipse", "5": "arrow", "6": "line", "7": "pen", "8": "text", "9": "hand", "0": "eraser" };
const SHAPE_TOOLS = new Set<Tool>(["rect", "ellipse", "diamond", "line", "arrow", "pen"]);
const MIN_Z = 0.1;
const MAX_Z = 8;
const HISTORY_LIMIT = 100;

const clampZ = (z: number) => Math.min(MAX_Z, Math.max(MIN_Z, z));
const same = (a: Shape[], b: Shape[]) => a === b || (a.length === b.length && a.every((s, i) => s === b[i]));

type Props = {
  shapes: Shape[];
  /** Called with the full shape list after each finished change (not while a stroke is being dragged). */
  onChange: (shapes: Shape[]) => void;
  readOnly?: boolean;
  /** Rendered at the top right, next to the export button (the dialog's Done button). */
  actions?: ReactNode;
};

/** The drawing surface: tools, selection, pan and zoom, undo. Shapes live in scene space; `view` maps them to the screen. */
export function CanvasBoard({ shapes: initial, onChange, readOnly, actions }: Props) {
  const [shapes, setShapesState] = useState<Shape[]>(initial);
  const shapesRef = useRef(shapes);
  const [view, setView] = useState<View>({ x: 0, y: 0, z: 1 });
  const viewRef = useRef(view);
  const [tool, setTool] = useState<Tool>(readOnly ? "hand" : "select");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [style, setStyle] = useState<Style>({ stroke: "#1e1e1e", fill: "transparent", strokeWidth: 3, dashed: false });
  const [marquee, setMarquee] = useState<Box | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [size, setSize] = useState({ w: 800, h: 500 });
  const [spaceDown, setSpaceDown] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const past = useRef<Shape[][]>([]);
  const future = useRef<Shape[][]>([]);
  const hostRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const fitted = useRef(false);

  const setShapes = useCallback((next: Shape[]) => {
    shapesRef.current = next;
    setShapesState(next);
  }, []);
  const setViewBoth = useCallback((next: View) => {
    viewRef.current = next;
    setView(next);
  }, []);

  /** Keeps the state before a change so Ctrl+Z can restore it, then reports the new state. */
  const commit = useCallback(
    (before: Shape[], after: Shape[]) => {
      if (same(before, after)) return;
      past.current.push(before);
      if (past.current.length > HISTORY_LIMIT) past.current.shift();
      future.current = [];
      setShapes(after);
      onChange(after);
    },
    [onChange, setShapes],
  );

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(shapesRef.current);
    setShapes(prev);
    setSelected(new Set());
    onChange(prev);
  }, [onChange, setShapes]);
  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(shapesRef.current);
    setShapes(next);
    setSelected(new Set());
    onChange(next);
  }, [onChange, setShapes]);

  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = useCallback(
    (list: Shape[] = shapesRef.current) => {
      const b = boundsOf(list);
      if (!b) return setViewBoth({ x: size.w / 2, y: size.h / 2, z: 1 });
      const pad = 60;
      const z = clampZ(Math.min((size.w - pad * 2) / Math.max(b.w, 1), (size.h - pad * 2) / Math.max(b.h, 1), 1.5));
      setViewBoth({ z, x: size.w / 2 - (b.x + b.w / 2) * z, y: size.h / 2 - (b.y + b.h / 2) * z });
    },
    [setViewBoth, size.h, size.w],
  );
  useEffect(() => {
    if (fitted.current || size.w < 50) return;
    fitted.current = true;
    fit();
  }, [fit, size.w]);

  const zoomAt = useCallback(
    (cx0: number, cy0: number, factor: number) => {
      const v = viewRef.current;
      const z = clampZ(v.z * factor);
      const k = z / v.z;
      setViewBoth({ z, x: cx0 - (cx0 - v.x) * k, y: cy0 - (cy0 - v.y) * k });
    },
    [setViewBoth],
  );

  // React attaches wheel listeners as passive, which would make preventDefault (stopping the page from scrolling) fail.
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.01));
      else {
        const v = viewRef.current;
        setViewBoth({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [setViewBoth, zoomAt]);

  const toScene = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = svgRef.current!.getBoundingClientRect();
    const v = viewRef.current;
    return [(e.clientX - r.left - v.x) / v.z, (e.clientY - r.top - v.y) / v.z];
  };

  const selectionBox = useMemo(() => boundsOf(shapes.filter((s) => selected.has(s.id))), [shapes, selected]);
  const topHit = (p: [number, number]) => {
    const tol = 6 / viewRef.current.z;
    for (let i = shapesRef.current.length - 1; i >= 0; i--) {
      const s = shapesRef.current[i];
      if (s && hitShape(s, p[0], p[1], tol)) return s;
    }
    return null;
  };

  const applyStyle = (patch: Partial<Style>) => {
    setStyle((s) => ({ ...s, ...patch }));
    if (!selected.size) return;
    const before = shapesRef.current;
    commit(before, before.map((s) => (selected.has(s.id) ? { ...s, ...patch, ...(s.type === "text" ? { fill: "transparent" } : {}) } : s)));
  };

  const startText = (x: number, y: number, existing?: Shape) =>
    setEditing({ id: existing?.id ?? null, x: existing?.x ?? x, y: existing?.y ?? y, value: existing?.text ?? "", fontSize: existing?.fontSize ?? 20, stroke: existing?.stroke ?? style.stroke });

  const finishText = () => {
    if (!editing) return;
    const e = editing;
    setEditing(null);
    const before = shapesRef.current;
    const value = e.value.replace(/\s+$/, "");
    if (e.id) {
      commit(before, value ? before.map((s) => (s.id === e.id ? withTextSize({ ...s, text: value }) : s)) : before.filter((s) => s.id !== e.id));
      return;
    }
    if (!value) return;
    const shape = withTextSize({ id: createId(), type: "text", x: e.x, y: e.y, w: 0, h: 0, stroke: e.stroke, fill: "transparent", strokeWidth: 1, text: value, fontSize: e.fontSize });
    commit(before, [...before, shape]);
    setSelected(new Set([shape.id]));
    setTool("select");
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    hostRef.current?.focus();
    if (editing) return;
    if (e.button === 2) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const p = toScene(e);
    if (e.button === 1 || tool === "hand" || spaceDown || readOnly) {
      gesture.current = { kind: "pan", sx: e.clientX, sy: e.clientY, view: viewRef.current };
      return;
    }
    const before = shapesRef.current;

    if (tool === "text") {
      startText(p[0], p[1]);
      return;
    }
    if (tool === "eraser") {
      gesture.current = { kind: "erase", before, hit: false };
      eraseAt(p);
      return;
    }
    if (SHAPE_TOOLS.has(tool)) {
      const id = createId();
      const base = { id, x: p[0], y: p[1], w: 0, h: 0, stroke: style.stroke, fill: tool === "line" || tool === "arrow" || tool === "pen" ? "transparent" : style.fill, strokeWidth: style.strokeWidth, dashed: style.dashed };
      const draft: Shape =
        tool === "pen" ? { ...base, type: "pen", points: [[0, 0]] } : tool === "line" || tool === "arrow" ? { ...base, type: tool, points: [[0, 0], [0, 0]] } : { ...base, type: tool as "rect" | "ellipse" | "diamond" };
      gesture.current = { kind: "draw", before, id, start: p };
      setSelected(new Set());
      setShapes([...before, draft]);
      return;
    }

    // select tool
    if (selectionBox && !readOnly) {
      const h = 10 / viewRef.current.z;
      if (Math.abs(p[0] - (selectionBox.x + selectionBox.w)) <= h && Math.abs(p[1] - (selectionBox.y + selectionBox.h)) <= h) {
        gesture.current = { kind: "resize", box: selectionBox, before, ids: new Set(selected) };
        return;
      }
    }
    const hit = topHit(p);
    if (hit) {
      let ids = selected;
      if (e.shiftKey) {
        ids = new Set(selected);
        if (ids.has(hit.id)) ids.delete(hit.id);
        else ids.add(hit.id);
      } else if (!selected.has(hit.id)) ids = new Set([hit.id]);
      setSelected(ids);
      gesture.current = { kind: "move", start: p, before, ids };
    } else {
      const base = e.shiftKey ? new Set(selected) : new Set<string>();
      setSelected(base);
      gesture.current = { kind: "marquee", start: p, base };
    }
  };

  const eraseAt = (p: [number, number]) => {
    const g = gesture.current;
    if (!g || g.kind !== "erase") return;
    const hit = topHit(p);
    if (!hit) return;
    g.hit = true;
    setShapes(shapesRef.current.filter((s) => s.id !== hit.id));
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g) return;
    if (g.kind === "pan") {
      setViewBoth({ ...g.view, x: g.view.x + e.clientX - g.sx, y: g.view.y + e.clientY - g.sy });
      return;
    }
    const p = toScene(e);
    if (g.kind === "erase") return eraseAt(p);
    if (g.kind === "move") {
      const dx = p[0] - g.start[0];
      const dy = p[1] - g.start[1];
      setShapes(g.before.map((s) => (g.ids.has(s.id) ? moveShape(s, dx, dy) : s)));
    } else if (g.kind === "resize") {
      const to: Box = { x: g.box.x, y: g.box.y, w: Math.max(8, p[0] - g.box.x), h: Math.max(8, p[1] - g.box.y) };
      if (e.shiftKey && g.box.w && g.box.h) to.h = (to.w * g.box.h) / g.box.w;
      setShapes(g.before.map((s) => (g.ids.has(s.id) ? resizeShape(s, g.box, to) : s)));
    } else if (g.kind === "marquee") {
      const box: Box = { x: Math.min(g.start[0], p[0]), y: Math.min(g.start[1], p[1]), w: Math.abs(p[0] - g.start[0]), h: Math.abs(p[1] - g.start[1]) };
      setMarquee(box);
      const next = new Set(g.base);
      for (const s of shapesRef.current) {
        const b = shapeBox(s);
        if (b.x < box.x + box.w && b.x + b.w > box.x && b.y < box.y + box.h && b.y + b.h > box.y) next.add(s.id);
      }
      setSelected(next);
    } else if (g.kind === "draw") {
      const dx = p[0] - g.start[0];
      const dy = p[1] - g.start[1];
      setShapes(
        shapesRef.current.map((s) => {
          if (s.id !== g.id) return s;
          if (s.type === "pen") return { ...s, points: [...(s.points ?? []), [dx, dy] as [number, number]] };
          if (s.type === "line" || s.type === "arrow") {
            let ex = dx;
            let ey = dy;
            if (e.shiftKey) {
              const step = Math.PI / 4;
              const a = Math.round(Math.atan2(dy, dx) / step) * step;
              const len = Math.hypot(dx, dy);
              ex = Math.cos(a) * len;
              ey = Math.sin(a) * len;
            }
            return { ...s, points: [[0, 0], [ex, ey]] as [number, number][] };
          }
          const square = e.shiftKey ? Math.max(Math.abs(dx), Math.abs(dy)) : null;
          return { ...s, w: square ? Math.sign(dx || 1) * square : dx, h: square ? Math.sign(dy || 1) * square : dy };
        }),
      );
    }
  };

  const onPointerUp = () => {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    if (g.kind === "marquee") return setMarquee(null);
    if (g.kind === "pan") return;
    const now = shapesRef.current;
    if (g.kind === "draw") {
      const s = now.find((x) => x.id === g.id);
      const tiny = !s || (!s.points && Math.abs(s.w) < 4 && Math.abs(s.h) < 4) || ((s.type === "line" || s.type === "arrow") && Math.hypot(...(s.points?.[1] ?? ORIGIN)) < 4);
      if (tiny) {
        setShapes(g.before);
        return;
      }
      past.current.push(g.before);
      future.current = [];
      onChange(now);
      if (s.type !== "pen") {
        setSelected(new Set([s.id]));
        setTool("select");
      }
      return;
    }
    if (g.kind === "erase" && !g.hit) return;
    // Move, resize and erase were applied live; record them once, now that the gesture is over.
    past.current.push(g.before);
    future.current = [];
    if (past.current.length > HISTORY_LIMIT) past.current.shift();
    onChange(now);
  };

  const onDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly || tool !== "select") return;
    const p = toScene(e);
    const hit = topHit(p);
    if (hit?.type === "text") startText(hit.x, hit.y, hit);
    else if (!hit) startText(p[0], p[1]);
  };

  const setSpaceHeld = setSpaceDown;

  // Focus after the pointer's own focus change has run, or the host would take focus back and close the editor.
  const isEditing = !!editing;
  useEffect(() => {
    if (!isEditing) return;
    const t = setTimeout(() => textRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [isEditing]);

  const removeSelected = () => {
    if (!selected.size) return;
    const before = shapesRef.current;
    commit(before, before.filter((s) => !selected.has(s.id)));
    setSelected(new Set());
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (editing || (e.target as HTMLElement).tagName === "TEXTAREA") return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (e.key === " ") {
      e.preventDefault();
      setSpaceHeld(true);
      return;
    }
    if (mod && k === "z") {
      e.preventDefault();
      if (!readOnly) (e.shiftKey ? redo : undo)();
      return;
    }
    if (mod && k === "y") {
      e.preventDefault();
      if (!readOnly) redo();
      return;
    }
    if (mod && k === "a") {
      e.preventDefault();
      setSelected(new Set(shapesRef.current.map((s) => s.id)));
      return;
    }
    if (readOnly) return;
    if (mod && k === "d" && selected.size) {
      e.preventDefault();
      const before = shapesRef.current;
      const copies = before.filter((s) => selected.has(s.id)).map((s) => ({ ...moveShape(s, 16, 16), id: createId() }));
      commit(before, [...before, ...copies]);
      setSelected(new Set(copies.map((s) => s.id)));
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      removeSelected();
      return;
    }
    if (e.key === "Escape") {
      setSelected(new Set());
      setTool("select");
      return;
    }
    if (e.key.startsWith("Arrow") && selected.size) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
      const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
      const before = shapesRef.current;
      commit(before, before.map((s) => (selected.has(s.id) ? moveShape(s, dx, dy) : s)));
      return;
    }
    if (!mod && !e.altKey && KEY_TOOL[k]) setTool(KEY_TOOL[k]);
  };

  const raise = (toFront: boolean) => {
    const before = shapesRef.current;
    const picked = before.filter((s) => selected.has(s.id));
    const rest = before.filter((s) => !selected.has(s.id));
    commit(before, toFront ? [...rest, ...picked] : [...picked, ...rest]);
  };

  const cursor = readOnly || tool === "hand" || spaceDown ? (gesture.current ? "grabbing" : "grab") : tool === "select" ? "default" : tool === "text" ? "text" : "crosshair";
  const showStyle = !readOnly && (SHAPE_TOOLS.has(tool) || tool === "text" || selected.size > 0);
  const firstSelected = shapes.find((s) => selected.has(s.id));
  const active: Style = firstSelected && selected.size ? { stroke: firstSelected.stroke, fill: firstSelected.fill, strokeWidth: firstSelected.strokeWidth, dashed: !!firstSelected.dashed } : style;
  const onlyText = selected.size > 0 && shapes.filter((s) => selected.has(s.id)).every((s) => s.type === "text");
  const z = view.z;
  const box = selectionBox;

  return (
    <div
      ref={hostRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onKeyUp={(e) => e.key === " " && setSpaceHeld(false)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
      className="relative h-full w-full touch-none overflow-hidden bg-white text-[#1e1e1e] outline-none select-none"
      style={{ cursor, backgroundImage: "radial-gradient(#d4d4d4 1px, transparent 1px)", backgroundSize: `${24 * z}px ${24 * z}px`, backgroundPosition: `${view.x}px ${view.y}px` }}
    >
      <svg ref={svgRef} className="absolute inset-0 h-full w-full" data-canvas-surface>
        <g transform={`translate(${view.x} ${view.y}) scale(${z})`}>
          {shapes.map((s) => (
            <ShapeView key={s.id} shape={s} />
          ))}
          {box && !readOnly && (
            <g pointerEvents="none">
              <rect x={box.x - 6 / z} y={box.y - 6 / z} width={box.w + 12 / z} height={box.h + 12 / z} fill="none" stroke="#0b6fe8" strokeWidth={1.5 / z} strokeDasharray={`${5 / z} ${4 / z}`} rx={4 / z} />
              <rect x={box.x + box.w - 5 / z} y={box.y + box.h - 5 / z} width={10 / z} height={10 / z} fill="#fff" stroke="#0b6fe8" strokeWidth={1.5 / z} rx={2 / z} />
            </g>
          )}
          {marquee && <rect x={marquee.x} y={marquee.y} width={marquee.w} height={marquee.h} fill="#0b6fe8" fillOpacity={0.08} stroke="#0b6fe8" strokeWidth={1 / z} />}
        </g>
      </svg>

      {editing && (
        <textarea
          ref={textRef}
          value={editing.value}
          placeholder="Type…"
          onChange={(e) => setEditing({ ...editing, value: e.target.value })}
          onBlur={finishText}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Escape") e.currentTarget.blur();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          rows={Math.max(1, editing.value.split("\n").length)}
          className="absolute resize-none overflow-hidden border-0 bg-transparent p-0 leading-[1.25] whitespace-pre outline-none"
          style={{
            left: view.x + editing.x * z,
            top: view.y + editing.y * z,
            fontSize: editing.fontSize * z,
            color: editing.stroke,
            minWidth: 40 * z,
            width: `${Math.max(textSize({ id: "", type: "text", x: 0, y: 0, w: 0, h: 0, stroke: "", fill: "", strokeWidth: 1, text: editing.value || "Type…", fontSize: editing.fontSize }).w * z + 12, 40)}px`,
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
          }}
        />
      )}

      {!readOnly && (
        <div className="absolute top-3 left-1/2 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-0.5 overflow-x-auto rounded-2xl border border-[#e2e2e2] bg-white p-1 shadow-lg" onPointerDown={(e) => e.stopPropagation()}>
          {TOOLS.map((t) => (
            <button
              key={t.tool}
              type="button"
              title={`${t.label} (${t.key})`}
              aria-label={t.label}
              aria-pressed={tool === t.tool}
              onClick={() => {
                setTool(t.tool);
                if (t.tool !== "select") setSelected(new Set());
                hostRef.current?.focus();
              }}
              className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#3d3d3d] hover:bg-[#f0f0f0]", tool === t.tool && "bg-[#e0edff] text-[#0b6fe8] hover:bg-[#e0edff]")}
            >
              <ToolIcon tool={t.tool} />
            </button>
          ))}
        </div>
      )}

      {showStyle && (
        <div className="absolute top-16 left-3 flex w-44 flex-col gap-3 rounded-2xl border border-[#e2e2e2] bg-white p-3 text-xs text-[#555] shadow-lg" onPointerDown={(e) => e.stopPropagation()}>
          <Swatches label={onlyText || tool === "text" ? "Color" : "Stroke"} colors={STROKES} value={active.stroke} onPick={(c) => applyStyle({ stroke: c })} />
          {!onlyText && tool !== "text" && tool !== "line" && tool !== "arrow" && tool !== "pen" && <Swatches label="Fill" colors={FILLS} value={active.fill} onPick={(c) => applyStyle({ fill: c })} />}
          {!onlyText && tool !== "text" && (
            <>
              <div>
                <p className="mb-1.5 font-medium">Stroke width</p>
                <div className="flex gap-1.5">
                  {WIDTHS.map((w) => (
                    <button key={w} type="button" aria-label={`Width ${w}`} aria-pressed={active.strokeWidth === w} onClick={() => applyStyle({ strokeWidth: w })} className={cx("flex h-8 flex-1 items-center justify-center rounded-lg bg-[#f2f2f2]", active.strokeWidth === w && "bg-[#e0edff] ring-1 ring-[#0b6fe8]")}>
                      <span className="block w-5 rounded-full bg-[#1e1e1e]" style={{ height: w }} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 font-medium">Stroke style</p>
                <div className="flex gap-1.5">
                  {[false, true].map((d) => (
                    <button key={String(d)} type="button" aria-label={d ? "Dashed" : "Solid"} aria-pressed={active.dashed === d} onClick={() => applyStyle({ dashed: d })} className={cx("flex h-8 flex-1 items-center justify-center rounded-lg bg-[#f2f2f2]", active.dashed === d && "bg-[#e0edff] ring-1 ring-[#0b6fe8]")}>
                      <svg width="24" height="4" aria-hidden="true">
                        <line x1="1" y1="2" x2="23" y2="2" stroke="#1e1e1e" strokeWidth="2" strokeDasharray={d ? "4 3" : undefined} strokeLinecap="round" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          {selected.size > 0 && (
            <div className="flex gap-1.5">
              <button type="button" onClick={() => raise(false)} className="h-8 flex-1 rounded-lg bg-[#f2f2f2] hover:bg-[#e8e8e8]">
                Send back
              </button>
              <button type="button" onClick={() => raise(true)} className="h-8 flex-1 rounded-lg bg-[#f2f2f2] hover:bg-[#e8e8e8]">
                Bring front
              </button>
              <button type="button" aria-label="Delete" title="Delete (Del)" onClick={removeSelected} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#ffe3e3] text-[#c92a2a] hover:bg-[#ffc9c9]">
                <SmallIcon name="trash" size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-2xl border border-[#e2e2e2] bg-white p-1 text-[#3d3d3d] shadow-lg" onPointerDown={(e) => e.stopPropagation()}>
        <Mini label="Zoom out" onClick={() => zoomAt(size.w / 2, size.h / 2, 1 / 1.25)}>
          <SmallIcon name="minus" size={16} />
        </Mini>
        <button type="button" title="Reset zoom" onClick={() => zoomAt(size.w / 2, size.h / 2, 1 / viewRef.current.z)} className="h-8 min-w-12 rounded-xl px-1 text-xs tabular-nums hover:bg-[#f0f0f0]">
          {Math.round(z * 100)}%
        </button>
        <Mini label="Zoom in" onClick={() => zoomAt(size.w / 2, size.h / 2, 1.25)}>
          <SmallIcon name="plus" size={16} />
        </Mini>
        <Mini label="Fit to content" onClick={() => fit()}>
          <SmallIcon name="fit" size={16} />
        </Mini>
        {!readOnly && (
          <>
            <span className="mx-0.5 h-5 w-px bg-[#e2e2e2]" />
            <Mini label="Undo (Ctrl+Z)" onClick={undo}>
              <SmallIcon name="undo" size={16} />
            </Mini>
            <Mini label="Redo (Ctrl+Shift+Z)" onClick={redo}>
              <SmallIcon name="redo" size={16} />
            </Mini>
          </>
        )}
      </div>

      <div className="absolute top-3 right-3 flex items-center gap-2" onPointerDown={(e) => e.stopPropagation()}>
        <button
          type="button"
          title="Export as PNG"
          disabled={!shapes.length}
          onClick={() => exportPng(shapes)}
          className="flex h-9 items-center gap-1.5 rounded-xl border border-[#e2e2e2] bg-white px-3 text-sm text-[#3d3d3d] shadow-lg hover:bg-[#f0f0f0] disabled:opacity-50"
        >
          <SmallIcon name="download" size={16} />
          PNG
        </button>
        {actions}
      </div>

      {!shapes.length && !readOnly && !editing && (
        <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-[#999]">Pick a tool above and drag to draw. Double-click to type.</p>
      )}
    </div>
  );
}

function Mini({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick} className="flex h-8 w-8 items-center justify-center rounded-xl hover:bg-[#f0f0f0]">
      {children}
    </button>
  );
}

function Swatches({ label, colors, value, onPick }: { label: string; colors: readonly string[]; value: string; onPick: (c: string) => void }) {
  return (
    <div>
      <p className="mb-1.5 font-medium">{label}</p>
      <div className="grid grid-cols-6 gap-1.5">
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={c === "transparent" ? "No fill" : c}
            aria-pressed={value === c}
            onClick={() => onPick(c)}
            className={cx("h-5 w-5 rounded-md border border-[#d0d0d0]", value === c && "ring-2 ring-[#0b6fe8] ring-offset-1")}
            style={c === "transparent" ? { backgroundImage: "linear-gradient(45deg,#fff 45%,#e03131 45% 55%,#fff 55%)" } : { background: c }}
          />
        ))}
      </div>
    </div>
  );
}
