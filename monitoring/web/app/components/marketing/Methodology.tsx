// Contrast methodology section: light grey, dark text, rounded top 4rem.
// Numbered 01-03 mono circles + greyscale visual with glass testimonial overlay.

import Link from "next/link";
import { SITE } from "@/lib/site";

const STEPS = [
  {
    n: "01",
    title: "Execute the rule",
    body: "Donchian 20-day breakout for entry, 10-day counter-breakout or ATR stop for exit. Detected exactly one day after candle close — the same bar the backtest used. No look-ahead, no repainting.",
  },
  {
    n: "02",
    title: "Size the risk",
    body: "1% of equity per trade, stop distance from 2×ATR(14), max 2 positions per correlation cluster. Cash yield simulation is off since 2026-10-02 — past credited yield stays in cash, no new accrual.",
  },
  {
    n: "03",
    title: "Account for everything",
    body: "Every signal, fill and slippage sample lands in SQLite, committed daily by CI, rendered on /papertrading. Weekly reviews; if live trails the backtest 2–3 weeks running, we pause and investigate.",
  },
] as const;

export function Methodology() {
  return (
    <section className="mt-8 rounded-t-[4rem] bg-ink px-5 py-16 text-on-dark sm:px-10 lg:px-16">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-on-dark/60">
        [ METHODOLOGY // TURTLE-STYLE TREND FOLLOWING ]
      </p>
      <h2 className="font-display mt-4 max-w-2xl text-4xl tracking-[-0.02em] sm:text-5xl">
        Boring rules. Relentlessly followed.
      </h2>

      <div className="mt-12 grid grid-cols-12 gap-10">
        <ol className="col-span-12 space-y-8 lg:col-span-7">
          {STEPS.map((s) => (
            <li key={s.n} className="flex gap-5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-on-dark/25 font-mono text-sm font-bold">
                {s.n}
              </span>
              <div>
                <h3 className="text-xl font-bold">{s.title}</h3>
                <p className="mt-1 max-w-xl text-sm leading-relaxed text-on-dark/70">{s.body}</p>
              </div>
            </li>
          ))}
          <li>
            <Link
              href="/proof"
              className="ml-[68px] font-mono text-[11px] font-bold uppercase tracking-[0.2em] underline underline-offset-4"
            >
              Read the full proof →
            </Link>
          </li>
        </ol>

        <div className="col-span-12 lg:col-span-5">
          <div className="relative overflow-hidden rounded-[2rem] bg-canvas">
            {/* greyscale visual: stylized drawdown/equity field */}
            <div className="field-grid h-80 opacity-70" />
            <div className="absolute inset-0 bg-gradient-to-t from-canvas/80 via-transparent to-transparent" />
            <div className="absolute inset-x-5 bottom-5 rounded-3xl border border-line bg-surface p-5 backdrop-blur-2xl">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                FIELD NOTE // DECISION LOG
              </p>
              <p className="mt-2 text-sm leading-relaxed text-secondary">
                “Top-5 trades carried ~100% of net PnL. That&apos;s normal for trend-following — the edge is
                cutting losses fast and letting winners run, not precision.”
              </p>
              <Link
                href={SITE.decisionLog}
                className="mt-3 inline-block font-mono text-[10px] uppercase tracking-[0.2em] text-accent"
              >
                decision_log.md →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
