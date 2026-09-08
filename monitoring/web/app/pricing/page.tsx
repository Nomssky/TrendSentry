"use client"

import Link from "next/link"
import { SiteShell } from "../components/marketing/SiteShell"
import { GlassCard, TechLabel } from "../components/marketing/ui"
import { SITE } from "@/lib/site"

const TIERS = [
  {
    name: "Watcher",
    price: "Free",
    state: "OPEN NOW",
    hot: false,
    plan: null,
    features: [
      "Connect Bitget read-only API",
      "Strategy templates (Donchian, SMA, RSI)",
      "Custom rule builder",
      "Auto-logging of every trade",
      "Deviation history dashboard",
      "No time limit",
    ],
  },
  {
    name: "Paper Beta",
    price: "$19/mo",
    state: "SUBSCRIBE",
    hot: true,
    plan: "paper_beta",
    features: [
      "Everything in Watcher, plus:",
      "Real-time deviation alerts (Telegram)",
      "Discipline Benchmark simulator",
      "Weekly review summaries",
    ],
  },
  {
    name: "Live Assist",
    price: "$49/mo",
    state: "COMING SOON",
    hot: false,
    plan: "live_assist",
    features: [
      "Everything in Paper Beta, plus:",
      "Risk manager + circuit breaker",
      "Exchange-side stop orders",
      "Small-capital start ($50–100)",
      "No leverage, no martingale — ever",
    ],
  },
] as const

export default function Pricing() {
  async function handleCheckout(plan: string) {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    })
    const { url } = await res.json()
    if (url) window.location.href = url
  }

  return (
    <SiteShell>
      <main className="px-5 pb-20 pt-32 sm:px-10 sm:pt-40 lg:px-16">
        <TechLabel>[ PRICING // PRIVATE BETA ]</TechLabel>
        <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-[-0.04em] sm:text-6xl">
          Free to log.{" "}
          <span className="bg-gradient-to-r from-[#ccff00] to-white bg-clip-text italic text-transparent">
            Subscribe to stay honest.
          </span>
        </h1>
        <p className="mt-6 max-w-2xl text-white/60">
          The Watcher tier is open now — connect your exchange and start logging your discipline for
          free. Premium tiers unlock real-time alerts and the Discipline Benchmark.
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
                    <span>{t.hot ? "→" : "✓"}</span>
                    {f}
                  </li>
                ))}
              </ul>
              {t.plan && (
                <button
                  onClick={() => handleCheckout(t.plan)}
                  className={`mt-8 w-full rounded-full px-6 py-3 font-semibold transition ${
                    t.hot
                      ? "bg-black text-[#ccff00] hover:bg-black/80"
                      : "bg-[#ccff00] text-black hover:bg-[#aadd00]"
                  }`}
                >
                  {t.state === "COMING SOON" ? "Coming soon" : "Subscribe"}
                </button>
              )}
              {!t.plan && (
                <Link
                  href="/auth/signup"
                  className="mt-8 block w-full rounded-full bg-white/10 px-6 py-3 text-center font-semibold text-white transition hover:bg-white/20"
                >
                  Start free
                </Link>
              )}
            </div>
          ))}
        </div>

        <GlassCard className="mt-8 p-8 sm:p-10">
          <div id="waitlist" className="scroll-mt-32">
            <TechLabel>[ WAITLIST ]</TechLabel>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">Paper Beta is invite-only for now.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
              While we finish validation, the waitlist runs through GitHub. Open an issue or start a
              discussion with subject{" "}
              <span className="font-mono-tech text-[#ccff00]">[WAITLIST]</span> — you&apos;ll be first
              in line when accounts open. In the meantime, start with Watcher.
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <a href={SITE.github} target="_blank" rel="noopener noreferrer" className="inline-block rounded-full bg-[#ccff00] px-8 py-4 text-sm font-semibold text-black transition hover:bg-[#aadd00]">
                Join waitlist on GitHub →
              </a>
              <Link
                href="/start"
                className="inline-block rounded-full border border-white/15 bg-white/5 px-8 py-4 text-sm font-medium text-white/80 backdrop-blur transition hover:border-[#ccff00]/40 hover:text-white"
              >
                Start Watcher for free
              </Link>
            </div>
          </div>
        </GlassCard>
      </main>
    </SiteShell>
  )
}
