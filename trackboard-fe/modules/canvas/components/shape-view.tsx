import { ORIGIN, penPath, shapeBox, textSize, type Shape } from "../lib/scene";

function arrowHead(s: Shape): string | null {
  if (s.type !== "arrow" || !s.points || s.points.length < 2) return null;
  const a = s.points[s.points.length - 2] ?? ORIGIN;
  const b = s.points[s.points.length - 1] ?? ORIGIN;
  const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const size = 10 + s.strokeWidth * 2.5;
  const p = (da: number): string => `${s.x + b[0] - size * Math.cos(angle + da)} ${s.y + b[1] - size * Math.sin(angle + da)}`;
  return `M${p(0.45)}L${s.x + b[0]} ${s.y + b[1]}L${p(-0.45)}`;
}

/** One shape as SVG, in scene coordinates. Used by the board, the inline preview and PNG export. */
export function ShapeView({ shape: s }: { shape: Shape }) {
  const common = {
    stroke: s.stroke,
    strokeWidth: s.strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeDasharray: s.dashed ? `${s.strokeWidth * 3} ${s.strokeWidth * 3}` : undefined,
    fill: s.fill === "transparent" ? "none" : s.fill,
  };
  const b = shapeBox(s);
  switch (s.type) {
    case "rect":
      return <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={Math.min(12, b.w / 6, b.h / 6)} {...common} />;
    case "ellipse":
      return <ellipse cx={b.x + b.w / 2} cy={b.y + b.h / 2} rx={b.w / 2} ry={b.h / 2} {...common} />;
    case "diamond":
      return <polygon points={`${b.x + b.w / 2},${b.y} ${b.x + b.w},${b.y + b.h / 2} ${b.x + b.w / 2},${b.y + b.h} ${b.x},${b.y + b.h / 2}`} {...common} />;
    case "line":
    case "arrow": {
      const pts = s.points ?? [];
      const head = arrowHead(s);
      return (
        <g {...common} fill="none">
          <polyline points={pts.map((p) => `${s.x + p[0]},${s.y + p[1]}`).join(" ")} />
          {head && <path d={head} strokeDasharray={undefined} />}
        </g>
      );
    }
    case "pen":
      return <path d={penPath((s.points ?? []).map((p) => [s.x + p[0], s.y + p[1]]))} {...common} fill="none" />;
    case "text": {
      const size = s.fontSize ?? 20;
      const lines = (s.text ?? "").split("\n");
      return (
        <text x={s.x} y={s.y} fill={s.stroke} fontSize={size} fontFamily="ui-sans-serif, system-ui, sans-serif" dominantBaseline="hanging" style={{ whiteSpace: "pre" }}>
          {lines.map((line, i) => (
            <tspan key={i} x={s.x} dy={i === 0 ? 0 : size * 1.25}>
              {line || " "}
            </tspan>
          ))}
        </text>
      );
    }
  }
}

/** Box a text shape occupies, since its w and h are derived from the content. */
export function withTextSize(s: Shape): Shape {
  if (s.type !== "text") return s;
  const t = textSize(s);
  return { ...s, w: t.w, h: t.h };
}
