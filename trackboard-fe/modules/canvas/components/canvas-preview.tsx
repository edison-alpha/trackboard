import { useMemo } from "react";
import { boundsOf, parseScene } from "../lib/scene";
import { ShapeView } from "./shape-view";

/** Static, scaled-to-fit picture of a scene, for the block inside the page. */
export function CanvasPreview({ scene }: { scene: string }) {
  const shapes = useMemo(() => parseScene(scene).shapes, [scene]);
  const b = boundsOf(shapes);
  if (!b) return null;
  const pad = 24;
  return (
    <svg viewBox={`${b.x - pad} ${b.y - pad} ${b.w + pad * 2} ${b.h + pad * 2}`} preserveAspectRatio="xMidYMid meet" className="h-full w-full" role="img" aria-label="Canvas drawing">
      {shapes.map((s) => (
        <ShapeView key={s.id} shape={s} />
      ))}
    </svg>
  );
}
