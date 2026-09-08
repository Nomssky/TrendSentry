// Fixed header: lime logo box, pill nav, status + CTA.

import Link from "next/link";
import { NAV_LINKS, SITE } from "@/lib/site";
import { StatusTag } from "./ui";

export function Nav() {
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
          className="rounded-full border border-white/20 px-5 py-2.5 text-sm text-white/80 transition hover:border-[#ccff00]/50 hover:text-[#ccff00]"
        >
          Sign in
        </Link>
        <Link
          href="/start"
          className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-[#ccff00]"
        >
          Start free
        </Link>
      </div>
    </header>
  );
}
