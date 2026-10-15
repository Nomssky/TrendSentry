"use client"

import Link from "next/link";
import { useState } from "react";
import { SITE } from "@/lib/site";
import LogoMark from "../LogoMark";
import { ThemeToggle } from "../ThemeToggle";
import { StatusTag } from "./ui";

type NavProps = {
  isLoggedIn: boolean;
};

const publicLinks = [
  { href: "/start", label: "Start" },
  { href: "/proof", label: "Proof" },
  { href: "/papertrading", label: "Paper" },
  { href: "/pricing", label: "Pricing" },
] as const;

const authLinks = [
  { href: "/app/dashboard", label: "Dashboard" },
  { href: "/papertrading", label: "Paper" },
  { href: "/proof", label: "Proof" },
] as const;

export function Nav({ isLoggedIn }: NavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const links = isLoggedIn ? authLinks : publicLinks;

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between gap-4 border-b border-line bg-canvas/70 px-5 py-4 backdrop-blur-xl sm:px-10">
      <Link href="/" className="flex items-center gap-2.5">
        <LogoMark className="h-9 w-9" />
        <span className="text-lg font-semibold tracking-tight text-primary">{SITE.name}</span>
      </Link>

      <nav className="hidden items-center gap-1 rounded-full border border-line bg-surface px-2 py-1.5 backdrop-blur md:flex">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-full px-4 py-1.5 text-sm text-secondary transition hover:bg-elevated hover:text-primary"
          >
            {l.label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-3">
        <ThemeToggle />
        <span className="hidden lg:inline">
          <StatusTag text={isLoggedIn ? "WATCHER // ACTIVE" : "WATCHER // FREE"} />
        </span>
        {isLoggedIn ? (
          <Link
            href="/app/dashboard"
            className="hidden rounded-full bg-action px-5 py-2.5 text-sm font-semibold text-on-action transition hover:bg-accent-hover sm:inline-block"
          >
            Dashboard
          </Link>
        ) : (
          <>
            <Link
              href="/auth/login"
              className="hidden shrink-0 whitespace-nowrap rounded-full border border-control-border px-5 py-2.5 text-sm text-secondary transition hover:border-accent/40 hover:text-accent sm:inline-block"
            >
              Sign in
            </Link>
            <Link
              href="/start"
              className="hidden shrink-0 whitespace-nowrap rounded-full bg-action px-5 py-2.5 text-sm font-semibold text-on-action transition hover:bg-accent sm:inline-block"
            >
              Start free
            </Link>
          </>
        )}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-control-border bg-surface text-secondary backdrop-blur md:hidden"
          aria-label="Toggle menu"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {mobileOpen && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 rounded-2xl border border-line bg-surface p-4 backdrop-blur-xl md:hidden">
          <nav className="flex flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-4 py-3 text-sm text-secondary transition hover:bg-elevated hover:text-primary"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex gap-3 border-t border-line pt-3">
            {isLoggedIn ? (
              <Link
                href="/app/dashboard"
                onClick={() => setMobileOpen(false)}
                className="flex-1 rounded-full bg-action px-5 py-2.5 text-center text-sm font-semibold text-on-action transition hover:bg-accent-hover"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  onClick={() => setMobileOpen(false)}
                  className="flex-1 rounded-full border border-control-border px-5 py-2.5 text-center text-sm text-secondary transition hover:border-accent/40 hover:text-accent"
                >
                  Sign in
                </Link>
                <Link
                  href="/start"
                  onClick={() => setMobileOpen(false)}
                  className="flex-1 rounded-full bg-action px-5 py-2.5 text-center text-sm font-semibold text-on-action transition hover:bg-accent"
                >
                  Start free
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
