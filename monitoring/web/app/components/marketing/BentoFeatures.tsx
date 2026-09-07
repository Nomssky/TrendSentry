// Bento-grid features: 4-col desktop, 2x2 large card, 1x2 tall card,
// solid lime accent card. Hover border → lime/40. Copy mirrors README.

import Link from "next/link";
import { SITE } from "@/lib/site";
import { TechLabel } from "./ui";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`glass noise-overlay rounded-[2.5rem] p-7 transition-colors duration-300 hover:border-[#ccff00]/40 ${className}`}
    >
      {children}
    </div>
  );
}

export function BentoFeatures() {
  return (
    <section className="px-5 py-16 sm:px-10 lg:px-16">
      <TechLabel className="mb-4">[ WHAT IT DOES ]</TechLabel>
      <h2 className="max-w-2xl text-4xl font-bold tracking-[-0.04em] sm:text-5xl">
        Execution you don&apos;t have to babysit.
      </h2>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* large 2x2: paper engine + viz */}
        <Card className="sm:col-span-2 sm:row-span-2">
          <TechLabel className="text-white/40">01 // PAPER ENGINE — LIVE NOW</TechLabel>
          <h3 className="mt-3 text-2xl font-bold">Live market, zero capital risk.</h3>
          <p className="mt-2 max-w-md text-sm text-white/60">
            The signal engine runs daily on 10 pairs after candle close. Every check is logged — HOLD days
            included — so silence is data, not downtime.
          </p>
          <div className="mt-6 flex h-36 items-end gap-2">
            {[35, 55, 42, 70, 58, 82, 66, 90, 74, 100, 86, 95].map((h, i) => (
              <div
                key={i}
                style={{ height: `${h}%` }}
                className={`flex-1 rounded-t-lg ${i % 3 === 2 ? "bg-[#ccff00]/80" : "bg-white/10"}`}
              />
            ))}
          </div>
          <Link href="/papertrading" className="tech-label mt-6 inline-block text-[#ccff00]">
            WATCH IT RUN → /PAPERTRADING
          </Link>
        </Card>

        {/* tall 1x2: risk tokens */}
        <Card className="sm:row-span-2">
          <TechLabel className="text-white/40">02 // RISK TOKENS</TechLabel>
          <h3 className="mt-3 text-2xl font-bold">Rules that can&apos;t be bent.</h3>
          <div className="mt-6 space-y-3">
            {[
              ["RISK", "1% / trade"],
              ["STOP", "2×ATR always"],
              ["CLUSTER", "max 2 / cluster"],
              ["LEVERAGE", "none (spot)"],
              ["MARTINGALE", "never"],
            ].map(([k, v]) => (
              <div
                key={k}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
              >
                <span className="tech-label text-white/40">{k}</span>
                <span className="font-mono-tech text-sm font-bold">{v}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* accent lime card */}
        <div className="noise-overlay rounded-[2.5rem] bg-[#ccff00] p-7 text-black transition-colors duration-300 hover:border-[#ccff00]/40">
          <TechLabel className="text-black/60">03 // ALERTS</TechLabel>
          <h3 className="mt-3 text-2xl font-bold tracking-tight">Telegram the second it matters.</h3>
          <p className="mt-2 text-sm font-medium text-black/70">
            Entry. Exit. Stop. Crash. HOLD days stay silent — no spam, only decisions.
          </p>
        </div>

        {/* dashboard card */}
        <Card>
          <TechLabel className="text-white/40">04 // DASHBOARD</TechLabel>
          <h3 className="mt-3 text-xl font-bold">Every decision, on record.</h3>
          <p className="mt-2 text-sm text-white/60">
            Equity curve, open positions with live PnL, trade history, slippage vs assumption.
          </p>
        </Card>

        {/* discipline benchmark */}
        <Card>
          <TechLabel className="text-white/40">05 // COMING SOON</TechLabel>
          <h3 className="mt-3 text-xl font-bold">Discipline Benchmark.</h3>
          <p className="mt-2 text-sm text-white/60">
            Simulate your own strategy&apos;s execution fidelity vs actual results. The product we sell is
            discipline — not signals.
          </p>
        </Card>

        {/* llm filter */}
        <Card>
          <TechLabel className="text-white/40">06 // FASE 3</TechLabel>
          <h3 className="mt-3 text-xl font-bold">LLM risk filter.</h3>
          <p className="mt-2 text-sm text-white/60">
            AI sanity-checks valid signals for contradictory risk — never generates them.
          </p>
        </Card>

        {/* dogfood note */}
        <Card className="sm:col-span-2">
          <TechLabel className="text-white/40">DOGFOODING</TechLabel>
          <p className="mt-3 text-sm leading-relaxed text-white/60">
            Cluster-A2 is our own 6-year backtested system running live on this site. It&apos;s not for
            sale — it&apos;s our credibility. We eat our own cooking, and we publish the kitchen logs at{" "}
            <Link href={SITE.github} className="text-[#ccff00] underline">
              GitHub
            </Link>
            .
          </p>
        </Card>
      </div>
    </section>
  );
}
