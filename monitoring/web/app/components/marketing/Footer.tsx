// Footer: canvas, watermark text, oversized primary CTA, 3-col links.

import Link from "next/link";
import { SITE } from "@/lib/site";

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-canvas px-5 pb-8 pt-16 sm:px-10 lg:px-16">
      <p
        aria-hidden
        className="pointer-events-none select-none text-center font-bold leading-none tracking-tight text-muted"
        style={{ fontSize: "clamp(4rem, 12vw, 10rem)" }}
      >
        SENTRY
      </p>

      <div className="relative mx-auto -mt-6 max-w-3xl text-center sm:-mt-10">
        <h2 className="font-display text-3xl tracking-tight sm:text-4xl">
          Stop deviating from your plan.
        </h2>
        <a
          href="/start"
          className="btn-primary group relative mt-8 inline-block overflow-hidden px-12 py-5 text-base"
        >
          {/* The wipe slides up over the filled pill on hover. It must be a DIFFERENT
            colour from .btn-primary's own background or the hover is invisible. */}
          <span className="absolute inset-0 translate-y-full bg-accent transition-transform duration-300 group-hover:translate-y-0" />
          <span className="relative">Start tracking →</span>
        </a>
      </div>

      <div className="mx-auto mt-16 grid max-w-6xl grid-cols-1 gap-8 border-t border-line pt-8 text-sm sm:grid-cols-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">PRODUCT</p>
          <div className="mt-3 flex flex-col gap-2 text-secondary">
            <Link href="/start" className="hover:text-accent">Get started</Link>
            <Link href="/proof" className="hover:text-accent">Proof</Link>
            <Link href="/live" className="hover:text-accent">Live account</Link>
            <Link href="/papertrading" className="hover:text-accent">Paper trading</Link>
            <Link href="/app/dashboard" className="hover:text-accent">Dashboard</Link>
            <Link href="/disclaimer" className="hover:text-accent">Risk disclaimer</Link>
          </div>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">SOURCE</p>
          <div className="mt-3 flex flex-col gap-2 text-secondary">
            <Link href={SITE.github} className="hover:text-accent">GitHub ↗</Link>
            <Link href={SITE.decisionLog} className="hover:text-accent">Decision log ↗</Link>
            <span className="text-muted">License: AGPL-3.0</span>
          </div>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">STATUS</p>
          <p className="mt-3 font-mono text-[11px] leading-relaxed text-muted">
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
