import Link from "next/link"
import { SiteShell } from "../components/marketing/SiteShell"
import { GlassCard, TechLabel } from "../components/marketing/ui"
import { SITE } from "@/lib/site"
import { CheckoutButton } from "./CheckoutButton"

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
    ],
  },
  {
    name: "Live Assist",
    price: "$49/mo",
    state: "COMING SOON",
    hot: false,
    plan: null,
    comingSoon: true,
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
  return (
    <SiteShell>
      <main className="px-5 pb-20 pt-32 sm:px-10 sm:pt-40 lg:px-16">
        <TechLabel>[ PRICING // PRIVATE BETA ]</TechLabel>
        <h1 className="font-display mt-4 max-w-3xl text-4xl tracking-[-0.02em] sm:text-6xl">
          Free to log.{" "}
          <span className="bg-gradient-to-r from-accent to-primary bg-clip-text italic text-transparent">
            Subscribe to stay honest.
          </span>
        </h1>
        <p className="mt-6 max-w-2xl text-secondary">
          The Watcher tier is open now — connect your exchange and start logging your discipline for
          free. Premium tiers unlock real-time alerts and the Discipline Benchmark.
        </p>

        <div className="mt-12 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {TIERS.map((t) => (
            <div
              key={t.name}
              className={
                t.hot
                  ? "noise-overlay rounded-3xl bg-action p-8 text-on-action"
                  : "glass noise-overlay rounded-3xl p-8 transition-colors duration-300 hover:border-accent/35"
              }
            >
              <p className={`tech-label ${t.hot ? "text-on-action/65" : "text-muted"}`}>{t.state}</p>
              <h2 className="font-display mt-3 text-2xl">{t.name}</h2>
              <p className={`mt-1 font-display text-3xl ${t.hot ? "" : "text-accent"}`}>{t.price}</p>
              <ul className={`mt-6 space-y-2.5 text-sm ${t.hot ? "text-on-action/80" : "text-muted"}`}>
                {t.features.map((f) => (
                  <li key={f} className="flex gap-2.5">
                    <span>{t.hot ? "→" : "✓"}</span>
                    {f}
                  </li>
                ))}
              </ul>
              {"comingSoon" in t && t.comingSoon ? (
                <span className="mt-8 block w-full cursor-not-allowed rounded-full bg-surface px-6 py-3 text-center font-semibold text-muted">
                  Coming soon
                </span>
              ) : t.plan ? (
                <CheckoutButton plan={t.plan} hot={t.hot} />
              ) : (
                <Link
                  href="/auth/signup"
                  className="mt-8 block w-full rounded-full bg-elevated px-6 py-3 text-center font-semibold text-primary transition hover:bg-elevated"
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
            <h2 className="font-display mt-3 text-3xl tracking-tight">Paper Beta is invite-only for now.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-secondary">
              While we finish validation, the waitlist runs through GitHub. Open an issue or start a
              discussion with subject{" "}
              <span className="font-mono text-accent">[WAITLIST]</span> — you&apos;ll be first
              in line when accounts open. In the meantime, start with Watcher.
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <a href={SITE.github} target="_blank" rel="noopener noreferrer" className="inline-block rounded-full bg-action px-8 py-4 text-sm font-semibold text-on-action transition hover:bg-accent-hover">
                Join waitlist on GitHub →
              </a>
              <Link
                href="/start"
                className="inline-block rounded-full border border-control-border bg-surface px-8 py-4 text-sm font-medium text-secondary backdrop-blur transition hover:border-accent/35 hover:text-primary"
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
