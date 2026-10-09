import { Calendar } from "@/components/icons";

/** BoardUI's date pickers use Remix's calendar glyph; Trackboard maps it to its own icon set. */
export function RiCalendarLine({ className }: { className?: string; "aria-hidden"?: boolean }) {
  return <Calendar size={20} className={className} />;
}
