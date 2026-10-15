// /live — the real-money account. Honest state: NOT LIVE yet.
// Fase 4 has a decision gate (paper validation first). No fake numbers here —
// the running record is paper trading at /papertrading.

import Link from "next/link";
import { SiteShell } from "../components/marketing/SiteShell";
import { GlassCard, PrimaryButton, StatusTag, TechLabel } from "../components/marketing/ui";
import { SITE } from "@/lib/site";

const GATES = [
  {
    n: "01",
    title: "Paper validation",
    body: "8 weeks of paper trading plus ≥10 closed trades, live win rate and avg R inside backtest tolerance. Status: in progress — track it at /papertrading.",
    done: false,
  },
  {
    n: "02",
    title: "Risk manager + circuit breaker",
    body: "Max 1% risk per trade, mandatory stop on every order, auto-pause past −15% drawdown from starting capital. Must pass unit tests plus a dry run before touching real money.",
    done: false,
  },
  {
    n: "03",
    title: "Small-capital start",
    body: "$50–100 of real capital, spot only, no leverage. Weekly reviews against paper and backtest. Two to three weeks trailing expectations means pause and investigate.",
    done: false,
  },
] as const;

export default function LiveAccount() {
  return (
    <SiteShell>
      <main className="mx-auto max-w-4xl px-5 pb-20 pt-32 sm:px-10 sm:pt-40">
        <StatusTag text="REAL ACCOUNT // NOT LIVE" />
        <h1 className="font-display mt-4 text-4xl tracking-[-0.02em] sm:text-6xl">
          Real money comes{" "}
          <span className="bg-gradient-to-r from-accent to-primary bg-clip-text italic text-transparent">
            after proof.
          </span>
        </h1>
        <p className="mt-6 max-w-2xl text-secondary">
          This is where the real account will live. It is deliberately empty: Fase 4 has a decision gate and
          paper trading hasn&apos;t cleared it yet. Anything shown here before then would be marketing, not
          evidence.
        </p>

        <div className="mt-12 space-y-4">
          {GATES.map((g) => (
            <GlassCard key={g.n} className="p-7">
              <div className="flex items-start gap-5">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line-strong font-mono text-sm font-bold">
                  {g.n}
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-bold">{g.title}</h2>
                    <span className="rounded-full bg-elevated px-2.5 py-0.5 font-mono text-[11px] text-muted">
                      {g.done ? "CLEARED" : "PENDING"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{g.body}</p>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>

        <GlassCard className="mt-4 p-7">
          <TechLabel className="text-muted">MEANWHILE</TechLabel>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            The paper engine runs daily on real market data with zero capital risk — every HOLD, entry, exit,
            and slippage sample logged. That&apos;s the record to judge us by.
          </p>
          <div className="mt-6 flex flex-wrap gap-4">
            <PrimaryButton href={SITE.liveDashboard}>Watch paper trading →</PrimaryButton>
            <Link
              href={SITE.waitlistAnchor}
              className="inline-block rounded-full border border-control-border bg-surface px-8 py-4 text-sm font-medium text-secondary backdrop-blur transition hover:border-accent/35 hover:text-primary"
            >
              Get notified at launch
            </Link>
          </div>
        </GlassCard>
      </main>
    </SiteShell>
  );
}
