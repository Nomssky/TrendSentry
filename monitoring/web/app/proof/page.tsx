// W2 — /proof: full methodology + honest backtest reference + caveats.
// Static constants only; the ongoing record lives at /papertrading.

import Link from "next/link";
import { SiteShell } from "../components/marketing/SiteShell";
import { GlassCard, NeonButton, TechLabel } from "../components/marketing/ui";
import { BACKTEST_REFERENCE } from "@/lib/reference";
import { SITE } from "@/lib/site";

const ROWS: [string, string][] = [
  ["Period", BACKTEST_REFERENCE.period],
  ["Pairs", "10 (BTC, ETH, SOL, BNB, XRP, AVAX, LINK, DOGE, ADA, HYPE) — Bitget spot"],
  ["Entry", "Close > highest high of the previous 20 days"],
  ["Exit", "Close < lowest low of the previous 10 days, or stop loss"],
  ["Stop loss", "Entry − 2×ATR(14), on every order, no exceptions"],
  ["Position sizing", "Risk 1% modal per trade ÷ stop distance"],
  ["Direction", "Long-only"],
  ["Cluster limit", "Max 2 positions per correlation cluster (Cluster-A2)"],
  ["Costs", "Fee 0.1% + slippage asumsi 0.05%"],
  ["Sharpe", "0.82"],
  ["Max drawdown", `${BACKTEST_REFERENCE.maxDrawdownPct}%`],
  ["Total return", `+${BACKTEST_REFERENCE.totalReturnPct}%`],
  ["Trades", `${BACKTEST_REFERENCE.trades} (~${BACKTEST_REFERENCE.tradesPerYear}/tahun)`],
  ["Win rate", `${BACKTEST_REFERENCE.winRatePct}%`],
  ["Avg win / avg loss", `+${BACKTEST_REFERENCE.avgWinR}R / ${BACKTEST_REFERENCE.avgLossR}R`],
  ["Profit factor", String(BACKTEST_REFERENCE.profitFactor)],
];

const CAVEATS = [
  "Survivorship bias: SOL/BNB/XRP and the 7 other pairs are today's survivors, selected with hindsight — the figures are an upper expectation from historical data, not a promise.",
  "Concentration of returns: the top-5 trades contributed ~100% of net PnL; the single largest trade (BTC Oct 2020 → Mar 2021) was ~45% of the total. If no 2020–21-style supertrend recurs, future performance can be far flatter.",
  "Sharpe 0.82 from 94 trades has a wide confidence interval (reality could be ±0.3). The edge is cutting losses fast and letting winners run — not metric precision.",
  "The simulated 5% APY on paper idle cash adds return without changing the strategy — platform risk is not modeled.",
  "Live vs backtest comparison is only valid after ≥10 closed trades (Fase 2 criterion). Before that: monitor operations, not numbers.",
] as const;

export default function Proof() {
  return (
    <SiteShell>
      <main className="px-5 pb-20 pt-32 sm:px-10 sm:pt-40 lg:px-16">
        <TechLabel>[ PROOF // CLUSTER-A2 ]</TechLabel>
        <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-[-0.04em] sm:text-6xl">
          The receipts, <span className="bg-gradient-to-r from-[#ccff00] to-white bg-clip-text italic text-transparent">not the pitch.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-white/60">
          Cluster-A2 is our own system — dogfood, not product. Full parameters, full numbers, full caveats.
          The ongoing live record is at <Link href="/papertrading" className="text-[#ccff00] underline">/papertrading</Link>.
        </p>

        <div className="mt-12 grid grid-cols-12 gap-4">
          <GlassCard className="col-span-12 p-7 lg:col-span-7">
            <TechLabel className="text-white/40">BACKTEST REFERENCE // 6 TAHUN</TechLabel>
            <dl className="mt-5 divide-y divide-white/10">
              {ROWS.map(([k, v]) => (
                <div key={k} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:justify-between">
                  <dt className="tech-label text-white/40">{k}</dt>
                  <dd className="font-mono-tech text-sm font-medium text-right">{v}</dd>
                </div>
              ))}
            </dl>
          </GlassCard>

          <div className="col-span-12 space-y-4 lg:col-span-5">
            <GlassCard className="p-7">
              <TechLabel className="text-white/40">CAVEATS // BACA DULU</TechLabel>
              <ul className="mt-4 space-y-3 text-sm leading-relaxed text-white/65">
                {CAVEATS.map((c) => (
                  <li key={c.slice(0, 24)} className="flex gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#ccff00]" />
                    {c}
                  </li>
                ))}
              </ul>
            </GlassCard>
            <GlassCard className="p-7">
              <TechLabel className="text-white/40">REPRODUCE IT</TechLabel>
              <p className="mt-3 text-sm leading-relaxed text-white/65">
                All scripts, reports, and the decision log are open on GitHub. Don&apos;t trust the numbers — rerun
                them yourself.
              </p>
              <a href={SITE.decisionLog} className="tech-label mt-4 inline-block text-[#ccff00]">
                decision_log.md →
              </a>
            </GlassCard>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap gap-4">
          <NeonButton href="/papertrading">Check the live record →</NeonButton>
        </div>
      </main>
    </SiteShell>
  );
}
