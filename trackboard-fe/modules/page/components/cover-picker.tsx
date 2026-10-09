"use client";

import { UploadSimple } from "@/components/icons";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cx } from "@/lib/cx";
import { pickFile, readImage } from "@/lib/files";
import { COVERS } from "../lib/covers";

/** Choose a tone, upload an image (up to 3 MB), or remove the cover. */
export function CoverPicker({ value, onChange, children }: { value: string | null; onChange: (cover: string | null) => void; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const upload = async () => {
    const file = await pickFile("image/*");
    if (!file) return;
    setBusy(true);
    try {
      onChange(await readImage(file));
      setOpen(false);
    } catch (e) {
      toast.error(`Couldn't set the cover: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <p className="mb-2 text-xs font-medium text-ink-3">Colors</p>
        <div className="grid grid-cols-6 gap-2">
          {COVERS.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-label={c.label}
              aria-pressed={value === c.id}
              title={c.label}
              onClick={() => (onChange(c.id), setOpen(false))}
              className={cx("aspect-square rounded-lg border border-line", value === c.id && "ring-2 ring-accent ring-offset-2 ring-offset-surface")}
              style={{ background: c.css }}
            />
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="glass" icon={<UploadSimple size={15} />} busy={busy} onClick={upload} className="flex-1">
            Upload image
          </Button>
          {value && (
            <Button size="sm" variant="ghost" onClick={() => (onChange(null), setOpen(false))}>
              Remove
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
