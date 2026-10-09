import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "katex/dist/katex.min.css";
import { AppProviders } from "@/components/providers/app-providers";
import "./globals.css";

/** SF Pro Rounded from the owner's brand files: the "modern rounded" voice (DESIGN.md). */
const rounded = localFont({
  src: [
    { path: "../components/font/SF-Pro-Rounded-Regular.otf", weight: "400", style: "normal" },
    { path: "../components/font/SF-Pro-Rounded-Medium.otf", weight: "500", style: "normal" },
    { path: "../components/font/SF-Pro-Rounded-Semibold.otf", weight: "600", style: "normal" },
    { path: "../components/font/SF-Pro-Rounded-Bold.otf", weight: "700", style: "normal" },
  ],
  variable: "--font-rounded",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Trackboard", template: "%s · Trackboard" },
  description: "Team documentation you write together, live.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#191919" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={rounded.variable} suppressHydrationWarning>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
