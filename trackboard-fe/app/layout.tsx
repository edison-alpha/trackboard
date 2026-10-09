import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "katex/dist/katex.min.css";
import { AppProviders } from "@/components/providers/app-providers";
import "./globals.css";
import { PwaRegister } from "@/components/providers/pwa-register";

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
    <html lang="en" className={rounded.variable} suppressHydrationWarning>
      <body>
        <AppProviders>{children}</AppProviders>
        <PwaRegister />
      </body>
    </html>
  );
}
