// Pricing teaser + FAQ. No fake prices: Watcher tier is live, Paper Beta waitlist.

import Link from "next/link";
import { SITE } from "@/lib/site";
import { NeonButton, TechLabel } from "./ui";

const FAQS = [
  {
    q: "Is this financial advice or a signal-selling service?",
    a: "No. TrendSentry sells discipline of execution, not signals. Cluster-A2 is our own system running live as proof — it is not for sale, and nothing here is financial advice. See /disclaimer.",
  },
  {
    q: "Can I open an account today?",
    a: "Yes — the Watcher tier is open now. Connect your Bitget read-only API key, set your strategy rules (or start from a template), and TrendSentry starts logging. Free, no time limit.",
  },
  {
    q: "What does the live dashboard prove?",
    a: "That the engine runs daily without human touch: every HOLD, entry, exit, slippage sample and yield credit is logged and committed. Compare live win rate and avg R against the backtest reference — after ≥10 closed trades, not before.",
  },
  {
    q: "What happens in a losing streak?",
    a: "Trend-following has long flat and losing stretches by design. Risk stays 1% per trade with a mandatory stop; if live trails expectations 2–3 weeks running, the system pauses for review instead of hoping it recovers.",
  },
  {
    q: "Is the code open source?",
    a: "Yes — AGPL-3.0, source-available. Read, learn, and self-host. Commercial SaaS use requires a separate license.",
  },
] as const;

export function PricingTeaser() {
  return (
    <section className="bg-[#e5e5e5] px-5 pb-20 text-black sm:px-10 lg:px-16">
      <div className="noise-overlay rounded-[2.5rem] bg-black p-8 text-[#ebebeb] sm:p-12">
        <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
          <div>
            <TechLabel>[ PRICING // PRIVATE BETA ]</TechLabel>
            <h2 className="mt-4 max-w-xl text-4xl font-bold tracking-[-0.04em] sm:text-5xl">
              Start free. Upgrade when you need alerts.
            </h2>
            <p className="mt-4 max-w-xl text-white/60">
              Watcher tier is open now — connect your exchange, set your rules, and TrendSentry logs
              your discipline. Premium unlocks real-time deviation alerts.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <NeonButton href="/start">Start tracking →</NeonButton>
            <Link
              href="/pricing"
              className="text-center font-mono-tech text-[10px] uppercase tracking-[0.2em] text-white/50 hover:text-[#ccff00]"
            >
              See full pricing →
            </Link>
          </div>
        </div>
      </div>

      <div id="faq" className="mx-auto mt-16 max-w-3xl">
        <TechLabel className="text-black/50">[ FAQ ]</TechLabel>
        <div className="mt-6 divide-y divide-black/10">
          {FAQS.map((f) => (
            <div key={f.q} className="py-5">
              <h3 className="font-bold">{f.q}</h3>
              <p className="mt-1 text-sm leading-relaxed text-black/65">{f.a}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-xs text-black/50">
          Still deciding? Start with the{" "}
          <Link href="/proof" className="underline">
            proof
          </Link>
          , then{" "}
          <Link href="/start" className="underline">
            connect your exchange
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
