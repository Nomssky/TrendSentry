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
        The discipline layer for your strategy.
      </h2>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 01 large 2x2: deviation detection — inti value prop */}
        <Card className="sm:col-span-2 sm:row-span-2">
          <TechLabel className="text-white/40">01 // DEVIATION DETECTION — LIVE NOW</TechLabel>
          <h3 className="mt-3 text-2xl font-bold">Did you stick to the plan today?</h3>
          <p className="mt-2 max-w-md text-sm text-white/60">
            Connect your Bitget account with a read-only API key. TrendSentry logs every trade, 
            compares it against your rules, and flags the moment you deviate — before a small 
            mistake becomes a blown account.
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
          <Link href="/start" className="tech-label mt-6 inline-block text-[#ccff00]">
            CONNECT YOUR EXCHANGE → /START
          </Link>
        </Card>

        {/* 02 tall 1x2: auto-logging */}
        <Card className="sm:row-span-2">
          <TechLabel className="text-white/40">02 // AUTO-LOGGING</TechLabel>
          <h3 className="mt-3 text-2xl font-bold">Every trade, on record.</h3>
          <div className="mt-6 space-y-3">
            {[
              ["ENTRY", "logged with reason"],
              ["EXIT", "PnL + R-multiple"],
              ["DEVIATION", "flagged in real-time"],
              ["HOLD", "silence = data"],
              ["ACCOUNT", "read-only API"],
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

        {/* 03 accent lime card: alerts */}
        <div className="noise-overlay rounded-[2.5rem] bg-[#ccff00] p-7 text-black transition-colors duration-300 hover:border-[#ccff00]/40">
          <TechLabel className="text-black/60">03 // ALERTS</TechLabel>
          <h3 className="mt-3 text-2xl font-bold tracking-tight">Real-time deviation alerts.</h3>
          <p className="mt-2 text-sm font-medium text-black/70">
            Premium: Telegram the second you step outside your plan. HOLD days stay silent.
          </p>
        </div>

        {/* 04 discipline benchmark */}
        <Card>
          <TechLabel className="text-white/40">04 // COMING SOON</TechLabel>
          <h3 className="mt-3 text-xl font-bold">Discipline Benchmark.</h3>
          <p className="mt-2 text-sm text-white/60">
            Simulate what your portfolio would look like if you followed your own rules 100% of the time. The gap between actual and benchmark is the cost of deviation.
          </p>
        </Card>

        {/* 05 strategy templates */}
        <Card>
          <TechLabel className="text-white/40">05 // TEMPLATES</TechLabel>
          <h3 className="mt-3 text-xl font-bold">Start from a template.</h3>
          <p className="mt-2 text-sm text-white/60">
            Donchian breakout, SMA crossover, RSI mean-reversion — or define your own. Fill in your parameters, TrendSentry handles the rest.
          </p>
        </Card>

        {/* 06 LLM filter */}
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
