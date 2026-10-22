"use client";

import { Dialog } from "@/components/ui/dialog";
import { parseScene, serializeScene, type Shape } from "../lib/scene";
import { CanvasBoard } from "./canvas-board";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The stored scene (JSON text). */
  scene: string;
  /** Called with the new scene text after each finished change. */
  onChange: (scene: string) => void;
  readOnly?: boolean;
};

/** The canvas at full size. The board starts from the stored scene when it opens and writes back after every change. */
export function CanvasDialog({ open, onOpenChange, scene, onChange, readOnly }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={readOnly ? "Canvas (view only)" : "Canvas"} bare className="h-[92dvh] max-h-[92dvh] sm:max-w-[min(1500px,96vw)] rounded-none sm:rounded-(--radius-panel)">
      <div className="min-h-0 flex-1">
        <CanvasBoard
          shapes={parseScene(scene).shapes}
          readOnly={readOnly}
          onChange={(shapes: Shape[]) => onChange(serializeScene({ v: 1, shapes }))}
          actions={
            <button type="button" onClick={() => onOpenChange(false)} className="h-9 rounded-xl bg-[#0b6fe8] px-4 text-sm font-medium text-white shadow-lg hover:bg-[#0a62cf]">
              Done
            </button>
          }
        />
      </div>
    </Dialog>
  );
}
