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
    body: "1% of equity per trade, stop distance from 2×ATR(14), max 2 positions per correlation cluster. Idle cash earns simulated 5% APY in paper — tracked openly, platform risk disclosed.",
  },
  {
    n: "03",
    title: "Account for everything",
    body: "Every signal, fill, slippage sample and yield credit lands in SQLite, committed daily by CI, rendered on /papertrading. Weekly reviews; if live trails the backtest 2–3 weeks running, we pause and investigate.",
  },
] as const;

export function Methodology() {
  return (
    <section className="mt-8 rounded-t-[4rem] bg-[#e5e5e5] px-5 py-16 text-black sm:px-10 lg:px-16">
      <p className="font-mono-tech text-[10px] uppercase tracking-[0.2em] text-black/50">
        [ METHODOLOGY // TURTLE-STYLE TREND FOLLOWING ]
      </p>
      <h2 className="mt-4 max-w-2xl text-4xl font-bold tracking-[-0.04em] sm:text-5xl">
        Boring rules. Relentlessly followed.
      </h2>

      <div className="mt-12 grid grid-cols-12 gap-10">
        <ol className="col-span-12 space-y-8 lg:col-span-7">
          {STEPS.map((s) => (
            <li key={s.n} className="flex gap-5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-black/20 font-mono-tech text-sm font-bold">
                {s.n}
              </span>
              <div>
                <h3 className="text-xl font-bold">{s.title}</h3>
                <p className="mt-1 max-w-xl text-sm leading-relaxed text-black/65">{s.body}</p>
              </div>
            </li>
          ))}
          <li>
            <Link
              href="/proof"
              className="ml-[68px] font-mono-tech text-[11px] font-bold uppercase tracking-[0.2em] underline underline-offset-4"
            >
              Read the full proof →
            </Link>
          </li>
        </ol>

        <div className="col-span-12 lg:col-span-5">
          <div className="relative overflow-hidden rounded-[2rem] bg-black">
            {/* greyscale visual: stylized drawdown/equity field */}
            <div className="grid-bg h-80 opacity-70 grayscale" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <div className="absolute inset-x-5 bottom-5 rounded-3xl border border-white/15 bg-white/[0.07] p-5 backdrop-blur-2xl">
              <p className="font-mono-tech text-[10px] uppercase tracking-[0.2em] text-white/50">
                FIELD NOTE // DECISION LOG
              </p>
              <p className="mt-2 text-sm leading-relaxed text-white/85">
                “Top-5 trades carried ~100% of net PnL. That&apos;s normal for trend-following — the edge is
                cutting losses fast and letting winners run, not precision.”
              </p>
              <Link
                href={SITE.decisionLog}
                className="mt-3 inline-block font-mono-tech text-[10px] uppercase tracking-[0.2em] text-[#ccff00]"
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
