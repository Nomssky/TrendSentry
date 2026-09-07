import type { Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "TrendSentry — Discipline Execution for Systematic Crypto Trading",
  description:
    "TrendSentry is a discipline execution layer for systematic crypto trading. It runs your strategy, logs every decision, and holds you accountable — no emotion, no deviation, no FOMO.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-black font-display text-[#ebebeb]">{children}</body>
    </html>
  );
}
