// Shared Obsidian & Lime primitives: glass card, neon button, status tag, labels.
// Server components only — pure display, no trading logic.

import Link from "next/link";
import type { ReactNode } from "react";

export function TechLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`tech-label text-[#ccff00] ${className}`}>{children}</p>;
}

export function StatusTag({ text = "SYSTEM // ONLINE" }: { text?: string }) {
  return (
    <span className="tech-label flex items-center gap-2 text-white/70">
      <span className="pulse-dot inline-block h-[6px] w-[6px] rounded-full bg-[#ccff00]" />
      {text}
    </span>
  );
}

export function NeonButton({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={`neon-btn inline-block px-8 py-4 text-sm ${className}`}>
      {children}
    </Link>
  );
}

export function GhostButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-block rounded-full border border-white/15 bg-white/5 px-8 py-4 text-sm font-medium text-white/80 backdrop-blur transition hover:border-[#ccff00]/40 hover:text-white"
    >
      {children}
    </Link>
  );
}

export function GlassCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`glass noise-overlay rounded-3xl ${className}`}>{children}</div>;
}
