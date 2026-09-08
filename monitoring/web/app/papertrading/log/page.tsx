// /papertrading/log — full trade history + daily signal log.
// Static server page (build-time DB read), same design system.

import Link from "next/link";
import { SiteShell } from "../../components/marketing/SiteShell";
import { TechLabel } from "../../components/marketing/ui";
import { getDashboardData } from "@/lib/db-supabase";
import { Badge, Card, fmtUsd } from "../ui";

export const dynamic = "force-dynamic";

export default async function PaperLog() {
  let d;
  try {
    d = await getDashboardData();
  } catch {
    return <SiteShell><main className="mx-auto max-w-6xl px-5 pb-16 pt-28 sm:px-10 sm:pt-32 lg:px-16"><p className="text-sm text-white/40">Paper trading data not available (local DB only).</p></main></SiteShell>;
  }

  return (
    <SiteShell>
      <main className="mx-auto max-w-6xl space-y-6 px-5 pb-16 pt-28 sm:px-10 sm:pt-32 lg:px-16">
        <div>
          <Link href="/papertrading" className="tech-label text-white/40 hover:text-[#ccff00]">
            ← PAPER TRADING
          </Link>
          <h1 className="mt-3 text-3xl font-bold tracking-[-0.03em] sm:text-5xl">
            Paper<span className="text-[#ccff00]">Logs</span>
          </h1>
          <p className="mt-2 font-mono-tech text-[11px] uppercase tracking-[0.2em] text-white/40">
            {d.closedTrades.length} closed trades · {d.nSignals} daily records · since {d.startDate}
          </p>
        </div>

        <Card title={`Trade history (${d.closedTrades.length} closed)`}>
          {d.closedTrades.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center">
              <p className="tech-label text-white/40">NO CLOSED TRADES YET</p>
              <p className="mt-2 text-sm text-white/50">
                The first entry/exit will appear here (and via Telegram alert).
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left font-mono-tech text-[10px] uppercase tracking-[0.2em] text-white/40">
                    <th className="pb-3 pr-4">Pair</th>
                    <th className="pb-3 pr-4">Entry</th>
                    <th className="pb-3 pr-4">Exit</th>
                    <th className="pb-3 pr-4">Exit reason</th>
                    <th className="pb-3 pr-4 text-right">PnL</th>
                    <th className="pb-3 text-right">R</th>
                  </tr>
                </thead>
                <tbody className="font-mono-tech">
                  {d.closedTrades.map((t) => {
                    const up = (t.pnl ?? 0) >= 0;
                    return (
                      <tr key={t.id} className="border-t border-white/10 transition-colors hover:bg-white/[0.03]">
                        <td className="py-2.5 pr-4 font-bold">{t.pair}</td>
                        <td className="py-2.5 pr-4 text-white/50">
                          {t.entry_date} @ {fmtUsd(t.entry_price)}
                        </td>
                        <td className="py-2.5 pr-4 text-white/50">
                          {t.exit_date} @ {fmtUsd(Number(t.exit_price ?? 0))}
                        </td>
                        <td className="py-2.5 pr-4 text-xs text-white/40">{t.exit_reason}</td>
                        <td className={`py-2.5 pr-4 text-right ${up ? "text-[#ccff00]" : "text-rose-400"}`}>
                          {up ? "+" : ""}
                          {fmtUsd(t.pnl ?? 0)}
                        </td>
                        <td className={`py-2.5 text-right ${up ? "text-[#ccff00]" : "text-rose-400"}`}>
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

        <Card title={`Daily check history (${d.nSignals} records)`}>
          <p className="mb-4 text-xs leading-relaxed text-white/40">
            Every day the bot checks {new Set(d.recentSignals.map((s) => s.pair)).size || 5} pairs after candle
            close. <b className="text-white/60">HOLD</b> = no breakout that day → no trade → no PnL yet (this is
            normal, expected ~1 signal per 15 days across pairs). Trades and PnL only appear when close breaks
            the 20-day high (ENTRY) or hits the stop / 10-day low (EXIT).
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left font-mono-tech text-[10px] uppercase tracking-[0.2em] text-white/40">
                  <th className="pb-3 pr-4">Candle</th>
                  <th className="pb-3 pr-4">Pair</th>
                  <th className="pb-3 pr-4 text-right">Close</th>
                  <th className="pb-3 pr-4">Signal</th>
                  <th className="pb-3">Reason</th>
                </tr>
              </thead>
              <tbody className="font-mono-tech text-xs">
                {d.recentSignals.map((s) => (
                  <tr key={`${s.candle_date}-${s.pair}`} className="border-t border-white/10 transition-colors hover:bg-white/[0.03]">
                    <td className="py-2.5 pr-4 text-white/50">{s.candle_date}</td>
                    <td className="py-2.5 pr-4">{s.pair}</td>
                    <td className="py-2.5 pr-4 text-right">{fmtUsd(s.close_price)}</td>
                    <td className="py-2.5 pr-4">
                      <Badge tone={s.signal === "LONG_ENTRY" ? "ok" : s.signal === "LONG_EXIT" ? "warn" : "neutral"}>
                        {s.signal}
                      </Badge>
                    </td>
                    <td className="py-2.5 text-white/40">{s.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="pb-2 text-center">
          <TechLabel className="text-white/30">
            SNAPSHOT BAKED AT BUILD FROM DAILY DB COMMIT (08:00 WIB, BITGET)
          </TechLabel>
        </div>
      </main>
    </SiteShell>
  );
}
