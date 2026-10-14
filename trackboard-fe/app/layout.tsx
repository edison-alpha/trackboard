import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "katex/dist/katex.min.css";
import { AppProviders } from "@/components/providers/app-providers";
import "./globals.css";
import { PwaRegister } from "@/components/providers/pwa-register";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

/** SF Pro Rounded from the owner's brand files: the "modern rounded" voice (DESIGN.md). */
const rounded = localFont({
  src: [
    { path: "../components/font/SF-Pro-Rounded-Regular.woff2", weight: "400", style: "normal" },
    { path: "../components/font/SF-Pro-Rounded-Medium.woff2", weight: "500", style: "normal" },
    { path: "../components/font/SF-Pro-Rounded-Semibold.woff2", weight: "600", style: "normal" },
    { path: "../components/font/SF-Pro-Rounded-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-rounded",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Trackdocs", template: "%s · Trackdocs" },
  description: "Team documentation you write together, live.",
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png", sizes: "32x32" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
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
    <html lang="en" className={cn("font-sans", geist.variable)} suppressHydrationWarning>
      <body>
        <AppProviders>{children}</AppProviders>
        <PwaRegister />
      </body>
    </html>
  );
}
