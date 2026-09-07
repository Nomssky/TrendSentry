// Proof strip: honest backtest reference numbers + link to the live dashboard.
// Cluster-A2 is dogfooding/credibility, not the product being sold.

import Link from "next/link";
import { BACKTEST_REFERENCE } from "@/lib/reference";
import { SITE } from "@/lib/site";
import { StatusTag } from "./ui";

const STATS = [
  { label: "SHARPE (6Y)", value: "0.82" },
  { label: "MAX DRAWDOWN", value: `${BACKTEST_REFERENCE.maxDrawdownPct}%` },
  { label: "TOTAL RETURN", value: `+${BACKTEST_REFERENCE.totalReturnPct}%` },
  { label: "TRADES", value: String(BACKTEST_REFERENCE.trades) },
  { label: "WIN RATE", value: `${BACKTEST_REFERENCE.winRatePct}%` },
  { label: "PROFIT FACTOR", value: String(BACKTEST_REFERENCE.profitFactor) },
] as const;

export function ProofStrip() {
  return (
    <section className="px-5 sm:px-10 lg:px-16">
      <div className="glass noise-overlay rounded-[2rem] p-6 sm:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <StatusTag text="CLUSTER-A2 // OUR OWN DOGFOOD — NOT FOR SALE" />
          <Link href="/proof" className="tech-label text-white/50 underline-offset-4 hover:text-[#ccff00] hover:underline">
            FULL METHODOLOGY →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
          {STATS.map((s) => (
            <div key={s.label}>
              <p className="tech-label mb-2 text-white/40">{s.label}</p>
              <p className="font-mono-tech text-2xl font-bold sm:text-3xl">{s.value}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 max-w-3xl text-xs leading-relaxed text-white/40">
          Backtest 2020-08 → 2026-08, 10 pairs, Donchian 20/10 + ATR(14)×2, long-only, risk 1%. Reference
          figures contain survivorship bias and a wide confidence interval — they are an upper expectation
          from historical data, not a promise.           The live paper dashboard at{" "}
          <Link href={SITE.liveDashboard} className="text-[#ccff00] underline">
            /papertrading
          </Link>{" "}
          is the honest, ongoing record.
        </p>
      </div>
    </section>
  );
}
