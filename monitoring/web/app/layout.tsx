import type { Metadata, Viewport } from "next";
import { Fraunces, IBM_Plex_Mono, Inter } from "next/font/google";
import "./globals.css";
import { AnalyticsBeacon } from "./components/AnalyticsBeacon";
import { ThemeScript } from "./components/ThemeScript";

// Display serif — headings, numerals, the discipline score.
// Italic is loaded explicitly: the landing hero sets "NO DEVIATION." in italic
// by design, and next/font loads style:"normal" only unless asked, which would
// leave the browser synthesising a slanted face instead of the real italic.
const display = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
  style: ["normal", "italic"],
});

// UI sans — body copy, labels, controls.
const ui = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Mono — data, timestamps, tabular numbers, tech labels.
const mono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "TrendSentry — Your Strategy, No Deviation",
  description:
    "TrendSentry auto-logs your trades, detects when you deviate from your plan, and shows what discipline is worth — in your own data.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${ui.variable} ${mono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies the saved theme before first paint so there is no flash of
            the wrong surface. Runs before hydration on purpose. */}
        <ThemeScript />
      </head>
      <body className="flex min-h-full flex-col bg-canvas font-ui text-primary">
        <AnalyticsBeacon />
        {children}
      </body>
    </html>
  );
}