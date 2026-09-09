"use client"

import Link from "next/link";
import { useState } from "react";
import { NAV_LINKS, SITE } from "@/lib/site";
import { StatusTag } from "./ui";

export function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="absolute inset-x-0 top-0 z-50 flex items-center justify-between gap-4 px-5 pt-5 sm:px-10 sm:pt-7">
      <Link href="/" className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ccff00] font-mono-tech text-lg font-bold text-black">
          T
        </span>
        <span className="text-lg font-semibold tracking-tight">{SITE.name}</span>
      </Link>

      <nav className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1.5 backdrop-blur md:flex">
        {NAV_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-full px-4 py-1.5 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            {l.label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-3">
        <span className="hidden lg:inline">
          <StatusTag text="WATCHER // FREE" />
        </span>
        <Link
          href="/auth/login"
          className="hidden rounded-full border border-white/20 px-5 py-2.5 text-sm text-white/80 transition hover:border-[#ccff00]/50 hover:text-[#ccff00] sm:inline-block"
        >
          Sign in
        </Link>
        <Link
          href="/start"
          className="hidden rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-[#ccff00] sm:inline-block"
        >
          Start free
        </Link>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 backdrop-blur md:hidden"
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
        <div className="absolute inset-x-0 top-full z-50 mt-2 rounded-2xl border border-white/10 bg-black/95 p-4 backdrop-blur-xl md:hidden">
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-4 py-3 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex gap-3 border-t border-white/10 pt-3">
            <Link
              href="/auth/login"
              onClick={() => setMobileOpen(false)}
              className="flex-1 rounded-full border border-white/20 px-5 py-2.5 text-center text-sm text-white/80 transition hover:border-[#ccff00]/50 hover:text-[#ccff00]"
            >
              Sign in
            </Link>
            <Link
              href="/start"
              onClick={() => setMobileOpen(false)}
              className="flex-1 rounded-full bg-white px-5 py-2.5 text-center text-sm font-semibold text-black transition hover:bg-[#ccff00]"
            >
              Start free
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
