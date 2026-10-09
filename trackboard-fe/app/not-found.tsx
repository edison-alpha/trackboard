import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <LogoMark size={44} />
      <h1 className="text-xl font-bold">This address doesn't exist in Trackdocs</h1>
      <p className="max-w-sm text-sm text-ink-2">Check the link, or go back to your workspace home.</p>
      <Link href="/" className="inline-flex h-10 items-center rounded-full bg-accent px-5 text-[15px] font-medium text-on-accent hover:bg-accent-strong">
        Go to home
      </Link>
    </main>
  );
}
