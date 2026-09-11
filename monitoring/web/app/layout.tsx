import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { AnalyticsBeacon } from "./components/AnalyticsBeacon";

const display = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono-tech",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
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
    <html lang="en" className={`${display.variable} ${mono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-black font-display text-[#ebebeb]"><AnalyticsBeacon />{children}</body>
    </html>
  );
}
