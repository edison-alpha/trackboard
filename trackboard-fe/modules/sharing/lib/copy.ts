import { toast } from "sonner";

/** Copies text to the clipboard and says so; falls back to a message with the text when the browser refuses. */
export async function copyText(text: string, what = "Link"): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied`);
  } catch {
    toast(`Copy this ${what.toLowerCase()}: ${text}`, { duration: 12_000 });
  }
}
