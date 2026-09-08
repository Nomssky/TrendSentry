// /start — Watcher tier onboarding: connect exchange, pick strategy, start logging.

import Link from "next/link";
import { SiteShell } from "../components/marketing/SiteShell";
import { GlassCard, NeonButton, TechLabel } from "../components/marketing/ui";
import { SITE } from "@/lib/site";

const STEPS = [
  {
    n: "01",
    title: "Connect your Bitget account",
    body: "Generate a read-only API key on Bitget — no withdrawal or trading permissions needed. TrendSentry never sees your funds.",
    note: "Bitget first. Binance, Bybit, and others coming after Fase 2 validation.",
  },
  {
    n: "02",
    title: "Define your strategy",
    body: "Pick a template (Donchian breakout, SMA crossover, RSI mean-reversion) or write your own rules: entry conditions, exit rules, position sizing, stop loss. Your strategy, your parameters.",
  },
  {
    n: "03",
    title: "Trade normally — we watch",
    body: "Execute your trades on Bitget as you usually do. TrendSentry logs every fill, compares it against your plan, and flags deviations. A dashboard shows your discipline score over time.",
  },
  {
    n: "04",
    title: "Upgrade for real-time alerts",
    body: "Watcher is free forever. Paper Beta adds Telegram deviation alerts and the Discipline Benchmark — a simulation of what your portfolio would look like at 100% plan adherence.",
  },
] as const;

const TEMPLATES = [
  { name: "Donchian Breakout", params: "Entry period, exit period, ATR stop multiplier" },
  { name: "SMA Crossover", params: "Fast period, slow period" },
  { name: "RSI Mean-Reversion", params: "RSI period, oversold/overbought thresholds" },
  { name: "Custom", params: "Define your own entry, exit, sizing, and SL rules" },
] as const;

export default function Start() {
  return (
    <SiteShell>
      <main className="px-5 pb-20 pt-32 sm:px-10 sm:pt-40 lg:px-16">
        <TechLabel>[ GET STARTED // WATCHER TIER ]</TechLabel>
        <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-[-0.04em] sm:text-6xl">
          Free to start.{" "}
          <span className="bg-gradient-to-r from-[#ccff00] to-white bg-clip-text italic text-transparent">
            Disciplined forever.
          </span>
        </h1>
        <p className="mt-6 max-w-2xl text-white/60">
          No credit card. No signal selling. Connect your Bitget read-only API, define your strategy
          rules, and TrendSentry starts tracking your execution fidelity — free, no time limit.
        </p>

        {/* Steps */}
        <div className="mt-12 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {STEPS.map((s) => (
            <GlassCard key={s.n} className="p-7">
              <p className="tech-label text-white/40">STEP {s.n}</p>
              <h2 className="mt-2 text-2xl font-bold">{s.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/60">{s.body}</p>
              {"note" in s && (
                <p className="mt-3 font-mono-tech text-[10px] uppercase tracking-[0.2em] text-white/30">
                  {s.note}
                </p>
              )}
            </GlassCard>
          ))}
        </div>

        {/* Templates */}
        <GlassCard className="mt-6 p-7">
          <TechLabel className="text-white/40">STRATEGY TEMPLATES</TechLabel>
          <p className="mt-2 text-sm text-white/60">
            Start from a proven framework and fill in your own parameters. Each template comes with
            validation rules to prevent common mistakes.
          </p>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {TEMPLATES.map((t) => (
              <div
                key={t.name}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4"
              >
                <p className="font-mono-tech text-sm font-bold text-[#ccff00]">{t.name}</p>
                <p className="mt-1 text-xs text-white/50">{t.params}</p>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* CTA */}
        <div className="mt-10 flex flex-wrap gap-4">
          <NeonButton href={SITE.github}>
            Open an issue to get started →
          </NeonButton>
          <Link
            href="/pricing"
            className="inline-block rounded-full border border-white/15 bg-white/5 px-8 py-4 text-sm font-medium text-white/80 backdrop-blur transition hover:border-[#ccff00]/40 hover:text-white"
          >
            Compare tiers
          </Link>
        </div>

        <p className="mt-8 max-w-2xl text-xs leading-relaxed text-white/40">
          While the Watcher onboarding is manual during private beta (GitHub issue → we set up your
          account), the actual logging is automated. A self-serve signup form ships when Paper Beta opens.
        </p>
      </main>
    </SiteShell>
  );
}
