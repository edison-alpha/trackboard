import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { ShapeView } from "../components/shape-view";
import { boundsOf, type Shape } from "./scene";

const PAD = 24;

/** Standalone SVG markup of a scene, cropped to its content on white. */
export function sceneToSvg(shapes: Shape[]): { svg: string; w: number; h: number } {
  const b = boundsOf(shapes) ?? { x: 0, y: 0, w: 1, h: 1 };
  const x = b.x - PAD;
  const y = b.y - PAD;
  const w = Math.ceil(b.w + PAD * 2);
  const h = Math.ceil(b.h + PAD * 2);
  // Render into a detached <svg> with the browser's React, then read the markup back (react-dom/server is not for client code).
  const host = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const root = createRoot(host);
  flushSync(() => root.render(createElement("g", null, ...shapes.map((s) => createElement(ShapeView, { key: s.id, shape: s })))));
  const body = host.innerHTML;
  root.unmount();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff"/>${body}</svg>`;
  return { svg, w, h };
}

/** Downloads the scene as a 2x PNG. */
export function exportPng(shapes: Shape[]) {
  const { svg, w, h } = sceneToSvg(shapes);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = w * 2;
    canvas.height = h * 2;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "canvas.png";
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }, "image/png");
    }
    URL.revokeObjectURL(url);
  };
  img.onerror = () => URL.revokeObjectURL(url);
  img.src = url;
}
