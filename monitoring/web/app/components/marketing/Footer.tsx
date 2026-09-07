// Footer: obsidian, watermark text, oversized lime CTA, 3-col links.

import Link from "next/link";
import { SITE } from "@/lib/site";

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-black px-5 pb-8 pt-16 sm:px-10 lg:px-16">
      <p
        aria-hidden
        className="pointer-events-none select-none text-center font-bold leading-none tracking-tight text-white/[0.05]"
        style={{ fontSize: "clamp(4rem, 12vw, 10rem)" }}
      >
        SENTRY
      </p>

      <div className="relative mx-auto -mt-6 max-w-3xl text-center sm:-mt-10">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Stop trading your emotions.
        </h2>
        <a
          href="/pricing#waitlist"
          className="neon-btn group relative mt-8 inline-block overflow-hidden px-12 py-5 text-base"
        >
          <span className="absolute inset-0 translate-y-full bg-white transition-transform duration-300 group-hover:translate-y-0" />
          <span className="relative">Get early access →</span>
        </a>
      </div>

      <div className="mx-auto mt-16 grid max-w-6xl grid-cols-1 gap-8 border-t border-white/10 pt-8 text-sm sm:grid-cols-3">
        <div>
          <p className="font-mono-tech text-[10px] uppercase tracking-[0.2em] text-white/40">PRODUCT</p>
          <div className="mt-3 flex flex-col gap-2 text-white/70">
            <Link href="/proof" className="hover:text-[#ccff00]">Proof</Link>
            <Link href="/live" className="hover:text-[#ccff00]">Live account</Link>
            <Link href="/papertrading" className="hover:text-[#ccff00]">Paper trading</Link>
            <Link href="/pricing" className="hover:text-[#ccff00]">Pricing</Link>
            <Link href="/disclaimer" className="hover:text-[#ccff00]">Risk disclaimer</Link>
          </div>
        </div>
        <div>
          <p className="font-mono-tech text-[10px] uppercase tracking-[0.2em] text-white/40">SOURCE</p>
          <div className="mt-3 flex flex-col gap-2 text-white/70">
            <Link href={SITE.github} className="hover:text-[#ccff00]">GitHub ↗</Link>
            <Link href={SITE.decisionLog} className="hover:text-[#ccff00]">Decision log ↗</Link>
            <span className="text-white/40">License: AGPL-3.0</span>
          </div>
        </div>
        <div>
          <p className="font-mono-tech text-[10px] uppercase tracking-[0.2em] text-white/40">STATUS</p>
          <p className="mt-3 font-mono-tech text-[11px] leading-relaxed text-white/50">
            © 2026 {SITE.name} {"//"} PRIVATE BETA
            <br />
            NOT FINANCIAL ADVICE.
            <br />
            PAST PERFORMANCE ≠ FUTURE RESULTS.
          </p>
        </div>
      </div>
    </footer>
  );
}
