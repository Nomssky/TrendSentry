// Shared primitives: glass card, primary button, status tag, labels.
// Server components only — pure display, no trading logic.

import Link from "next/link";
import type { ReactNode } from "react";

export function TechLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`tech-label text-accent ${className}`}>{children}</p>;
}

export function StatusTag({ text = "SYSTEM // ONLINE" }: { text?: string }) {
  return (
    <span className="tech-label flex items-center gap-2 text-secondary">
      <span className="pulse-dot inline-block h-[6px] w-[6px] rounded-full bg-accent" />
      {text}
    </span>
  );
}

export function PrimaryButton({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={`btn-primary inline-block px-8 py-4 text-sm ${className}`}>
      {children}
    </Link>
  );
}

export function GhostButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-block rounded-full border border-control-border bg-surface px-8 py-4 text-sm font-medium text-secondary backdrop-blur transition hover:border-accent/35 hover:text-primary"
    >
      {children}
    </Link>
  );
}

export function GlassCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`glass noise-overlay rounded-3xl ${className}`}>{children}</div>;
}
