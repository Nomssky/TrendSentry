// W2 — /pricing: private beta, no fake prices. Waitlist anchor section.

import Link from "next/link";
import { SiteShell } from "../components/marketing/SiteShell";
import { GlassCard, NeonButton, TechLabel } from "../components/marketing/ui";
import { SITE } from "@/lib/site";

const TIERS = [
  {
    name: "Watcher",
    price: "Free",
    state: "OPEN NOW",
    hot: false,
    features: ["Paper dashboard (/papertrading)", "Open-source code (AGPL-3.0)", "Decision log & backtest reports"],
  },
  {
    name: "Paper Beta",
    price: "Invite only",
    state: "AFTER FASE 2",
    hot: true,
    features: [
      "Your own paper account",
      "Telegram entry/exit/stop alerts",
      "Discipline Benchmark (coming soon)",
      "Weekly review summaries",
    ],
  },
  {
    name: "Live Assist",
    price: "TBD",
    state: "FASE 4+",
    hot: false,
    features: [
      "Risk manager + circuit breaker",
      "Exchange-side stop orders",
      "Small-capital start ($50–100)",
      "No leverage, no martingale — ever",
    ],
  },
] as const;

export default function Pricing() {
  return (
    <SiteShell>
      <main className="px-5 pb-20 pt-32 sm:px-10 sm:pt-40 lg:px-16">
        <TechLabel>[ PRICING // PRIVATE BETA ]</TechLabel>
        <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-[-0.04em] sm:text-6xl">
          Free to watch. <span className="bg-gradient-to-r from-[#ccff00] to-white bg-clip-text italic text-transparent">Invite to trade.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-white/60">
          No price games before the proof is in. User accounts open after Fase 2 validation — 8 weeks of
          paper trading plus ≥10 closed trades. Until then: watch, read, verify.
        </p>

        <div className="mt-12 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {TIERS.map((t) => (
            <div
              key={t.name}
              className={
                t.hot
                  ? "noise-overlay rounded-[2.5rem] bg-[#ccff00] p-8 text-black"
                  : "glass noise-overlay rounded-[2.5rem] p-8 transition-colors duration-300 hover:border-[#ccff00]/40"
              }
            >
              <p className={`tech-label ${t.hot ? "text-black/60" : "text-white/40"}`}>{t.state}</p>
              <h2 className="mt-3 text-2xl font-bold">{t.name}</h2>
              <p className={`mt-1 font-mono-tech text-3xl font-bold ${t.hot ? "" : "text-[#ccff00]"}`}>{t.price}</p>
              <ul className={`mt-6 space-y-2.5 text-sm ${t.hot ? "text-black/75" : "text-white/65"}`}>
                {t.features.map((f) => (
                  <li key={f} className="flex gap-2.5">
                    <span>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <GlassCard className="mt-8 p-8 sm:p-10" >
          <div id="waitlist" className="scroll-mt-32">
            <TechLabel>[ WAITLIST ]</TechLabel>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">Get notified when Paper Beta opens.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
              No forms that go nowhere yet — while we finish validation, the waitlist runs through GitHub.
              Open an issue or start a discussion with subject <span className="font-mono-tech text-[#ccff00]">[WAITLIST]</span>,
              tell us what you trade and what breaks your discipline, and you&apos;ll be first in line when
              accounts open. (A proper signup form ships with W3.)
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <NeonButton href={SITE.github}>Join via GitHub →</NeonButton>
              <Link
                href="/disclaimer"
                className="inline-block rounded-full border border-white/15 bg-white/5 px-8 py-4 text-sm font-medium text-white/80 backdrop-blur transition hover:border-[#ccff00]/40 hover:text-white"
              >
                Read the risks first
              </Link>
            </div>
          </div>
        </GlassCard>
      </main>
    </SiteShell>
  );
}
