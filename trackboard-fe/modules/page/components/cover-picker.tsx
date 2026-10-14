"use client";

import { UploadSimple } from "@/components/icons";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cx } from "@/lib/cx";
import { pickFile, uploadFile } from "@/lib/files";
import { COVERS } from "../lib/covers";

/** Choose a tone, upload an image (up to 10 MB), or remove the cover. */
export function CoverPicker({ value, onChange, children }: { value: string | null; onChange: (cover: string | null) => void; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const upload = async () => {
    const file = await pickFile("image/*");
    if (!file) return;
    setBusy(true);
    try {
      onChange((await uploadFile(file)).url);
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
      <PopoverContent
        align="end"
        className="w-72 overflow-hidden border-line bg-surface/95 shadow-lg backdrop-blur-xl"
        style={{
          backgroundImage:
            "radial-gradient(circle at 12% 0%, color-mix(in srgb, var(--accent) 10%, transparent), transparent 42%), radial-gradient(circle at 100% 100%, color-mix(in srgb, var(--ink) 5%, transparent), transparent 46%)",
        }}
      >
        <p className="mb-2 text-xs font-medium text-ink-2">Colors</p>
        <div className="grid grid-cols-6 gap-2">
          {COVERS.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-label={c.label}
              aria-pressed={value === c.id}
              title={c.label}
              onClick={() => (onChange(c.id), setOpen(false))}
              className={cx(
                "aspect-square rounded-lg border border-line-strong shadow-sm transition-transform hover:scale-[1.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                value === c.id && "ring-2 ring-accent ring-offset-2 ring-offset-surface",
              )}
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
