import Link from "next/link";
import PaperLiveBoard from "./PaperLiveBoard";
import { SiteShell } from "../components/marketing/SiteShell";
import { getDashboardData } from "@/lib/db-supabase";
import {
  AVG_R_FLOOR,
  BACKTEST_REFERENCE,
  EVAL_MIN_TRADES,
  SLIPPAGE_ALERT_MULT,
  SLIPPAGE_ASSUMPTION_PCT,
  WIN_RATE_TOLERANCE_PP,
} from "@/lib/reference";
import { Badge, Card, Meter, SectionHead } from "./ui";



export const dynamic = "force-dynamic";

async function getData() {
  try {
    return await getDashboardData();
  } catch {
    return null;
  }
}

export default async function PaperTrading() {
  const d = await getData();
  if (!d) return <SiteShell><main className="mx-auto max-w-6xl px-5 pb-16 pt-28 sm:px-10 sm:pt-32"><p className="text-sm text-muted">Paper trading data not available (local DB only).</p></main></SiteShell>;
  const evaluated = d.realized.nClosed >= EVAL_MIN_TRADES;
  const wrOk =
    d.realized.winRatePct != null &&
    Math.abs(d.realized.winRatePct - BACKTEST_REFERENCE.winRatePct) <= WIN_RATE_TOLERANCE_PP;
  const slippageOver = d.slippage.avgPct != null && d.slippage.avgPct > SLIPPAGE_ASSUMPTION_PCT * SLIPPAGE_ALERT_MULT;

  // Stale check: > 30h sejak lastRun = kemungkinan cron skip
  const lastRunAt = d.lastRun ? new Date(d.lastRun) : null;
  const now = new Date();
  const isStale = lastRunAt != null && (now.getTime() - lastRunAt.getTime()) > 30 * 60 * 60 * 1000;

  // Sharpe/DD dari equity curve (kalau sudah ada cukup data) — O(n) single-pass.
  const eqReturns = d.equityCurve.length > 1
    ? d.equityCurve.slice(1).map((p, i) => (p.equity - d.equityCurve[i].equity) / d.equityCurve[i].equity)
    : []
  let sharpeLive: number | null = null
  let maxDDLive: number | null = null
  if (eqReturns.length > 5) {
    const n = eqReturns.length
    const mean = eqReturns.reduce((s, r) => s + r, 0) / n
    const variance = eqReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / n
    sharpeLive = (mean / (Math.sqrt(variance) || 1)) * Math.sqrt(365)
  }
  if (d.equityCurve.length > 1) {
    let peak = d.equityCurve[0].equity
    let worstDD = 0
    for (const p of d.equityCurve) {
      if (p.equity > peak) peak = p.equity
      const dd = (p.equity - peak) / peak * 100
      if (dd < worstDD) worstDD = dd
    }
    maxDDLive = Math.round(worstDD * 100) / 100
  }

  return (
    <SiteShell>
      <main className="mx-auto max-w-6xl space-y-10 px-5 pb-16 pt-28 sm:px-10 sm:pt-32 lg:px-16">
        {/* Gap warning */}
        {d.gaps.length > 0 && (
          <div className="rounded-[2rem] border border-danger/30 bg-danger/5 p-5 text-sm text-danger">
            ⚠ Downtime detected: {d.gaps.length} day(s) with no record ({d.gaps[0]} .. {d.gaps[d.gaps.length - 1]}).
            Stale signals are deliberately not chased — this is an honest representation of downtime.
          </div>
        )}

        {/* Stale data warning */}
        {isStale && (
          <div className="rounded-[2rem] border border-warning/30 bg-warning/5 p-5 text-sm text-warning">
            ⚠ Data mungkin stale — sync terakhir {lastRunAt?.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) ?? "?"} WIB.
            Pastikan cron GitHub Actions berjalan (cek Actions tab).
          </div>
        )}

        <PaperLiveBoard
          cash={d.cash}
          yieldTotal={d.yieldInfo.total}
          startDate={d.startDate}
          daysRunning={d.daysRunning}
          openPositions={d.openPositions.map((p) => ({
            id: p.id,
            pair: p.pair,
            units: p.units,
            entry_price: p.entry_price,
            stop_price: p.stop_price,
            entry_date: p.entry_date,
          }))}
          equityData={d.equityCurve}
          hasSnapshots={d.hasSnapshots}
        />

        {/* ── 03 Fase 2 scoreboard ─────────────────────────── */}
        <section className="space-y-4">
          <SectionHead
            n="03"
            title="Fase 2 scoreboard"
            right={
              <span className="rounded-full bg-elevated px-3 py-1 font-mono text-[11px] text-muted">
                {d.realized.nClosed}/{EVAL_MIN_TRADES} TRADES TO EVALUATION
              </span>
            }
          />
          <div className="grid gap-4 md:grid-cols-3">
            <Card title="Win rate vs backtest">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-4xl font-bold tracking-tight">
                  {d.realized.winRatePct != null ? `${d.realized.winRatePct.toFixed(1)}%` : "—"}
                </span>
                {!evaluated ? (
                  <Badge tone="neutral">not evaluated yet</Badge>
                ) : wrOk ? (
                  <Badge tone="ok">within tolerance</Badge>
                ) : (
                  <Badge tone="warn">outside tolerance</Badge>
                )}
              </div>
              <div className="mt-4">
                <Meter pct={evaluated ? (d.realized.winRatePct ?? 0) : 0} markerPct={BACKTEST_REFERENCE.winRatePct} tone={evaluated && !wrOk ? "danger" : "accent"} />
                <div className="mt-1.5 flex justify-between font-mono text-[10px] text-muted">
                  <span>0%</span>
                  <span>REF {BACKTEST_REFERENCE.winRatePct}%</span>
                  <span>100%</span>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted">
                Reference ±{WIN_RATE_TOLERANCE_PP}pp. Evaluated after ≥{EVAL_MIN_TRADES} closed trades (current:{" "}
                {d.realized.nClosed}).
              </p>
            </Card>

            <Card title="Avg R vs backtest">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-4xl font-bold tracking-tight">
                  {d.realized.avgR != null ? `${d.realized.avgR >= 0 ? "+" : ""}${d.realized.avgR.toFixed(2)}R` : "—"}
                </span>
                {!evaluated ? (
                  <Badge tone="neutral">not evaluated yet</Badge>
                ) : (d.realized.avgR ?? 0) >= AVG_R_FLOOR ? (
                  <Badge tone="ok">above floor</Badge>
                ) : (
                  <Badge tone="warn">needs investigation</Badge>
                )}
              </div>
              <div className="mt-4">
                <Meter
                  pct={evaluated ? (((d.realized.avgR ?? 0) + 1) * 20) : 0}
                  markerPct={(AVG_R_FLOOR + 1) * 20}
                  tone={evaluated && (d.realized.avgR ?? 0) < AVG_R_FLOOR ? "danger" : "accent"}
                />
                <div className="mt-1.5 flex justify-between font-mono text-[10px] text-muted">
                  <span>−1R</span>
                  <span>FLOOR {AVG_R_FLOOR}R</span>
                  <span>+4R</span>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted">
                Reference: avg win +{BACKTEST_REFERENCE.avgWinR}R / avg loss {BACKTEST_REFERENCE.avgLossR}R (PF{" "}
                {BACKTEST_REFERENCE.profitFactor}).
              </p>
            </Card>

            <Card title="Real slippage vs assumption">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-4xl font-bold tracking-tight">
                  {d.slippage.avgPct != null ? `${d.slippage.avgPct.toFixed(4)}%` : "—"}
                </span>
                {slippageOver ? <Badge tone="warn">revise sizing</Badge> : <Badge tone="ok">within limits</Badge>}
              </div>
              <div className="mt-4">
                <Meter
                  pct={d.slippage.avgPct != null ? (d.slippage.avgPct / (SLIPPAGE_ASSUMPTION_PCT * SLIPPAGE_ALERT_MULT)) * 100 : 0}
                  markerPct={50}
                  tone={slippageOver ? "danger" : "accent"}
                />
                <div className="mt-1.5 flex justify-between font-mono text-[10px] text-muted">
                  <span>0%</span>
                  <span>ASSUMPTION {SLIPPAGE_ASSUMPTION_PCT}%</span>
                  <span>LIMIT {(SLIPPAGE_ASSUMPTION_PCT * SLIPPAGE_ALERT_MULT).toFixed(2)}%</span>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted">
                Measured from order-book spread on each signal ({d.slippage.n} samples).
              </p>
            </Card>

            <Card title="Sharpe / Max DD">
              <div className="flex flex-col gap-3">
                <div>
                  <span className="font-mono text-4xl font-bold tracking-tight">
                    {sharpeLive != null ? sharpeLive.toFixed(2) : "—"}
                  </span>
                  <span className="ml-2 font-mono text-[11px] text-muted">vs ref {BACKTEST_REFERENCE.sharpeRatio}</span>
                </div>
                <div>
                  <span className={`font-mono text-4xl font-bold tracking-tight ${maxDDLive != null && maxDDLive < -20 ? "text-danger" : ""}`}>
                    {maxDDLive != null ? `${maxDDLive.toFixed(1)}%` : "—"}
                  </span>
                  <span className="ml-2 font-mono text-[11px] text-muted">vs ref {BACKTEST_REFERENCE.maxDrawdownPct}%</span>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted">
                Annualised Sharpe & peak-to-trough drawdown from equity curve ({d.equityCurve.length} points).
                Not evaluated until sufficient data.
              </p>
            </Card>
          </div>
        </section>

        {/* ── 04 Full logs ─────────────────────────────────── */}
        <section className="space-y-4">
          <SectionHead
            n="04"
            title="Logs"
            right={
              <span className="tech-label text-muted">
                {d.closedTrades.length} CLOSED · {d.nSignals} RECORDS
              </span>
            }
          />
          <div className="glass noise-overlay flex flex-col items-start justify-between gap-6 rounded-[2rem] p-7 sm:flex-row sm:items-center">
            <div>
              <p className="tech-label text-muted">TRADE HISTORY + SIGNAL LOG</p>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-secondary">
                Every closed trade with PnL and R-multiple, plus the full daily check history — HOLD days
                included. Nothing hidden, nothing backfilled.
              </p>
            </div>
            <Link
              href="/papertrading/log"
              className="inline-block shrink-0 rounded-full border border-control-border bg-surface px-8 py-3.5 text-sm font-medium text-secondary backdrop-blur transition hover:border-accent/40 hover:text-accent"
            >
              Open full logs →
            </Link>
          </div>
        </section>

        <p className="pb-2 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
          DATA LIVE DARI SUPABASE PER REQUEST (SYNC HARIAN 08:00 WIB, BITGET) · TICKER POLLS /API/PRICES EVERY 3S
        </p>
      </main>
    </SiteShell>
  );
}
