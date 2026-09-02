import LiveSection from "./components/LiveSection";
import EquityChart from "./components/EquityChart";
import { getDashboardData } from "@/lib/db";
import {
  AVG_R_FLOOR,
  BACKTEST_REFERENCE,
  EVAL_MIN_TRADES,
  SLIPPAGE_ALERT_MULT,
  SLIPPAGE_ASSUMPTION_PCT,
  WIN_RATE_TOLERANCE_PP,
} from "@/lib/reference";

export const dynamic = "force-static";

function fmtUsd(n: number, digits = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 ${className}`}>
      <h2 className="mb-3 text-sm font-medium text-neutral-300">{title}</h2>
      {children}
    </div>
  );
}

function Badge({ tone, children }: { tone: "ok" | "warn" | "neutral"; children: React.ReactNode }) {
  const tones = {
    ok: "bg-emerald-500/10 text-emerald-400",
    warn: "bg-rose-500/10 text-rose-400",
    neutral: "bg-neutral-800 text-neutral-400",
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export default async function Home() {
  const d = await getDashboardData();
  const evaluated = d.realized.nClosed >= EVAL_MIN_TRADES;
  const wrOk =
    d.realized.winRatePct != null &&
    Math.abs(d.realized.winRatePct - BACKTEST_REFERENCE.winRatePct) <= WIN_RATE_TOLERANCE_PP;
  const slippageOver = d.slippage.avgPct != null && d.slippage.avgPct > SLIPPAGE_ASSUMPTION_PCT * SLIPPAGE_ALERT_MULT;
  const lastRunDate = d.lastRun ? new Date(d.lastRun).toISOString().replace("T", " ").slice(0, 16) + " UTC" : "—";

  // Compute positions MTM and total equity for breakdown
  const totalPositionsMTM = d.openPositions.reduce((sum, p) => {
    // Note: we don't have live prices at build time, use entry_price as fallback
    // LiveSection will use real-time prices
    return sum + p.units * p.entry_price;
  }, 0);
  const totalEquity = d.cash + totalPositionsMTM + d.yieldInfo.total;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            Trend<span className="text-emerald-400">Sentry</span>
            <span className="ml-2 text-sm font-normal text-neutral-400">Paper Trading Monitor</span>
          </h1>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-neutral-300">
            <span className="rounded-full bg-neutral-800/70 px-2 py-0.5">Donchian 20/10 + ATR(14)×2</span>
            <span className="rounded-full bg-neutral-800/70 px-2 py-0.5">Long-only</span>
            <span className="rounded-full bg-neutral-800/70 px-2 py-0.5">Risk 1%</span>
            <span className="rounded-full bg-neutral-800/70 px-2 py-0.5">
              {d.pairs.length} pair: <span className="font-mono">{d.pairs.join(" ")}</span>
            </span>
            <span className="rounded-full bg-neutral-800/70 px-2 py-0.5">Yield idle {d.yieldInfo.apyAssumed}% APY</span>
            <span className="rounded-full bg-neutral-800/70 px-2 py-0.5">
              Mulai {d.startDate} · hari ke-{d.daysRunning}
            </span>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-400">
              Last run {lastRunDate}
            </span>
          </div>
        </div>
      </header>

      {/* Gap warning */}
      {d.gaps.length > 0 && (
        <div className="rounded-2xl border border-rose-900/50 bg-rose-500/5 p-4 text-sm text-rose-300">
          ⚠ Downtime terdeteksi: {d.gaps.length} hari tanpa record ({d.gaps[0]} .. {d.gaps[d.gaps.length - 1]}).
          Sinyal stale sengaja tidak dikejar — ini representasi jujur downtime.
        </div>
      )}

      <LiveSection
        openPositions={d.openPositions.map((p) => ({
          pair: p.pair,
          units: p.units,
          entry_price: p.entry_price,
          stop_price: p.stop_price,
          entry_date: p.entry_date,
        }))}
        fallbackPrices={{}}
        cash={d.cash}
        totalEquity={totalEquity}
        yieldTotal={d.yieldInfo.total}
      />

      <EquityChart data={d.equityCurve} totalEquity={totalEquity} cash={d.cash} positionsMTM={totalPositionsMTM} yieldTotal={d.yieldInfo.total} />
      {!d.priceFetchOk && (
        <p className="-mt-4 text-xs text-neutral-500">
          Catatan: chart menampilkan realized cash saja (harga historis tidak tersedia saat build).
        </p>
      )}

      {/* Kriteria sukses Fase 2 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card title="Modal & yield idle">
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between text-xs text-neutral-400">
              <span>Cash idle</span>
              <span className="font-mono">${fmtUsd(d.cash)}</span>
            </div>
            <div className="flex items-baseline justify-between text-xs text-neutral-400">
              <span>Posisi open (MTM)</span>
              <span className="font-mono">${fmtUsd(totalPositionsMTM)}</span>
            </div>
            <div className="flex items-baseline justify-between text-xs text-neutral-400 border-t border-neutral-800 pt-1.5">
              <span>Yield earned</span>
              <span className="font-mono text-emerald-400">+${fmtUsd(d.yieldInfo.total)}</span>
            </div>
            <div className="flex items-baseline justify-between text-base font-medium pt-1">
              <span>Total Equity</span>
              <span className="font-mono">${fmtUsd(totalEquity)}</span>
            </div>
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            Modal awal $1000. Cash idle dikreditkan bunga {d.yieldInfo.apyAssumed}% APY per hari (simulasi
            earn/DeFi — risiko platform tidak dimodelkan). Sudah {d.yieldInfo.days} hari kredit.
          </p>
        </Card>

        <Card title="Win rate vs backtest">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-2xl">
              {d.realized.winRatePct != null ? `${d.realized.winRatePct.toFixed(1)}%` : "—"}
            </span>
            {!evaluated ? (
              <Badge tone="neutral">belum dievaluasi</Badge>
            ) : wrOk ? (
              <Badge tone="ok">dalam toleransi</Badge>
            ) : (
              <Badge tone="warn">di luar toleransi</Badge>
            )}
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            Referensi backtest: {BACKTEST_REFERENCE.winRatePct}% ±{WIN_RATE_TOLERANCE_PP}pp. Evaluasi setelah ≥
            {EVAL_MIN_TRADES} trade tertutup (saat ini: {d.realized.nClosed}).
          </p>
        </Card>

        <Card title="Avg R vs backtest">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-2xl">
              {d.realized.avgR != null ? `${d.realized.avgR >= 0 ? "+" : ""}${d.realized.avgR.toFixed(2)}R` : "—"}
            </span>
            {!evaluated ? (
              <Badge tone="neutral">belum dievaluasi</Badge>
            ) : (d.realized.avgR ?? 0) >= AVG_R_FLOOR ? (
              <Badge tone="ok">di atas floor</Badge>
            ) : (
              <Badge tone="warn">flag investigasi</Badge>
            )}
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            Referensi: avg win {BACKTEST_REFERENCE.avgWinR}R / avg loss {BACKTEST_REFERENCE.avgLossR}R (PF{" "}
            {BACKTEST_REFERENCE.profitFactor}). Floor live: {AVG_R_FLOOR}R.
          </p>
        </Card>

        <Card title="Slippage real vs asumsi">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-2xl">
              {d.slippage.avgPct != null ? `${d.slippage.avgPct.toFixed(4)}%` : "—"}
            </span>
            {slippageOver ? <Badge tone="warn">revisi sizing</Badge> : <Badge tone="ok">dalam batas</Badge>}
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            Asumsi backtest {SLIPPAGE_ASSUMPTION_PCT}%; batas {SLIPPAGE_ASSUMPTION_PCT * SLIPPAGE_ALERT_MULT}% (2x).
            Diukur dari spread order book tiap sinyal ({d.slippage.n} sampel).
          </p>
        </Card>
      </div>

      {/* Trade history */}
      <Card title={`Trade history (${d.closedTrades.length} closed)`}>
        {d.closedTrades.length === 0 ? (
          <p className="text-sm text-neutral-400">
            Belum ada trade tertutup. Entry/exit pertama akan muncul di sini (dan notif Telegram).
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-neutral-500">
                  <th className="pb-2 pr-4">Pair</th>
                  <th className="pb-2 pr-4">Entry</th>
                  <th className="pb-2 pr-4">Exit</th>
                  <th className="pb-2 pr-4">Alasan keluar</th>
                  <th className="pb-2 pr-4 text-right">PnL</th>
                  <th className="pb-2 text-right">R</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {d.closedTrades.map((t) => {
                  const up = (t.pnl ?? 0) >= 0;
                  return (
                    <tr key={t.id} className="border-t border-neutral-800/60">
                      <td className="py-2 pr-4">{t.pair}</td>
                      <td className="py-2 pr-4 text-neutral-400">
                        {t.entry_date} @ {fmtUsd(t.entry_price)}
                      </td>
                      <td className="py-2 pr-4 text-neutral-400">
                        {t.exit_date} @ {fmtUsd(t.exit_price ?? 0)}
                      </td>
                      <td className="py-2 pr-4 text-xs text-neutral-500">{t.exit_reason}</td>
                      <td className={`py-2 pr-4 text-right ${up ? "text-emerald-400" : "text-rose-400"}`}>
                        {up ? "+" : ""}
                        {fmtUsd(t.pnl ?? 0)}
                      </td>
                      <td className={`py-2 text-right ${up ? "text-emerald-400" : "text-rose-400"}`}>
                        {(t.r_multiple ?? 0) >= 0 ? "+" : ""}
                        {(t.r_multiple ?? 0).toFixed(2)}R
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Sinyal terakhir */}
      <Card title={`Riwayat cek harian (${d.nSignals} record)`}>
        <p className="mb-3 text-xs text-neutral-500">
          Setiap hari bot mengecek {new Set(d.recentSignals.map((s) => s.pair)).size || 5} pair setelah candle close.{" "}
          <b className="text-neutral-400">HOLD</b> = tidak ada breakout hari itu → tidak ada trade → belum ada PnL (itu
          normal, ekspektasi ~1 sinyal per 15 hari lintas pair). Trade dan PnL baru muncul kalau close menembus high
          20-hari (ENTRY) atau kena stop / low 10-hari (EXIT).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-neutral-500">
                <th className="pb-2 pr-4">Candle</th>
                <th className="pb-2 pr-4">Pair</th>
                <th className="pb-2 pr-4 text-right">Close</th>
                <th className="pb-2 pr-4">Signal</th>
                <th className="pb-2">Alasan</th>
              </tr>
            </thead>
            <tbody className="font-mono text-xs">
              {d.recentSignals.slice(0, 10).map((s, i) => (
                <tr key={`${s.candle_date}-${s.pair}`} className="border-t border-neutral-800/60">
                  <td className="py-2 pr-4 text-neutral-400">{s.candle_date}</td>
                  <td className="py-2 pr-4">{s.pair}</td>
                  <td className="py-2 pr-4 text-right">{fmtUsd(s.close_price)}</td>
                  <td className="py-2 pr-4">
                    <Badge tone={s.signal === "LONG_ENTRY" ? "ok" : s.signal === "LONG_EXIT" ? "warn" : "neutral"}>
                      {s.signal}
                    </Badge>
                  </td>
                  <td className="py-2 text-neutral-500">{s.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <footer className="pb-4 text-center text-xs text-neutral-600">
        Data strategi di-bake saat build dari DB yang di-commit bot harian jam 08:00 WIB (data: Bitget) · harga
        realtime: Bitget via Vercel proxy (polling 10s) ·{" "}
        <a href="https://github.com/Nomssky/TrendSentry" className="underline hover:text-neutral-400">
          github.com/Nomssky/TrendSentry
        </a>
      </footer>
    </main>
  );
}


