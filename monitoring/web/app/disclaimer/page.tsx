// W2 — /disclaimer: risk disclosure. Required reading before waitlist.

import Link from "next/link";
import { SiteShell } from "../components/marketing/SiteShell";
import { GlassCard, TechLabel } from "../components/marketing/ui";

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "Not financial advice",
    body: [
      "Everything on this site — backtest figures, paper-trading logs, alerts — is engineering output for education and validation. It is not a recommendation to buy, sell, or hold any asset.",
      "TrendSentry sells discipline of execution, not signals. Cluster-A2 is our own system shown as proof of process, not a product. Watcher tier users define their own strategies; TrendSentry only logs and detects deviation.",
    ],
  },
  {
    title: "High variance, real losses",
    body: [
      "Crypto trend-following has long flat stretches and deep drawdowns. The backtest reference shows max drawdown −26.19% over 6 years; live drawdowns can exceed backtested ones.",
      "Only capital you can afford to lose belongs anywhere near systematic trading. Never trade with rent money, and never add leverage or martingale logic to recover losses.",
    ],
  },
  {
    title: "Past performance proves nothing",
    body: [
      "The 6-year reference (+152%, Sharpe 0.82, 94 trades) contains survivorship bias and a wide confidence interval. Top-5 trades carried ~100% of net PnL — if no 2020–21-style supertrend recurs, future returns can be far flatter.",
      "Paper trading omits real-world frictions: slippage beyond the 0.05% assumption, exchange outages, API failures, and (in paper) platform risk on the simulated 5% APY idle yield.",
    ],
  },
  {
    title: "How we stay honest",
    body: [
      "Every signal — including HOLD days — is logged with timestamp and reasoning, committed daily, and rendered on /papertrading. Downtime is shown as gaps, never backfilled.",
      "Live performance is only evaluated after ≥10 closed trades. If live trails the backtest 2–3 weeks running, the system pauses for review.",
      "Strategy parameters change only on backtested evidence, recorded with reasons — never on feeling after a few wins or losses.",
    ],
  },
  {
    title: "Data privacy",
    body: [
      "Watcher tier connects to your Bitget account via a read-only API key. TrendSentry never stores, transmits, or requests withdrawal or trading permissions.",
      "Your trade data is yours. It is not used to train models, sold to third parties, or shared beyond your own account dashboard.",
    ],
  },
  {
    title: "License",
    body: [
      "Source code is available under AGPL-3.0: read, learn, self-host. Commercial SaaS use requires a separate license.",
    ],
  },
];

export default function Disclaimer() {
  return (
    <SiteShell>
      <main className="mx-auto max-w-4xl px-5 pb-20 pt-32 sm:px-10 sm:pt-40">
        <TechLabel>[ RISK DISCLAIMER ]</TechLabel>
        <h1 className="mt-4 text-4xl font-bold tracking-[-0.04em] sm:text-6xl">
          Read this <span className="bg-gradient-to-r from-[#ccff00] to-white bg-clip-text italic text-transparent">before anything else.</span>
        </h1>

        <div className="mt-12 space-y-4">
          {SECTIONS.map((s, i) => (
            <GlassCard key={s.title} className="p-7">
              <p className="tech-label text-white/40">
                {String(i + 1).padStart(2, "0")} {"//"} {s.title.toUpperCase()}
              </p>
              {s.body.map((p) => (
                <p key={p.slice(0, 32)} className="mt-3 text-sm leading-relaxed text-white/65">
                  {p}
                </p>
              ))}
            </GlassCard>
          ))}
        </div>

        <p className="mt-10 text-center text-sm text-white/40">
          Understood?{" "}
          <Link href="/start" className="text-[#ccff00] underline">
            Start free
          </Link>{" "}
          or{" "}
          <Link href="/proof" className="text-[#ccff00] underline">
            see the proof
          </Link>
          .
        </p>
      </main>
    </SiteShell>
  );
}
