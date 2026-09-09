"use client";

// One shared tick: LiveSection polls /api/prices every 3s and reports up here,
// so the hero equity, position cards, and chart tail all move off the SAME numbers.

import { useCallback, useState } from "react";
import EquityChart from "../components/EquityChart";
import LiveSection from "../components/LiveSection";
import type { BoardPosition, LiveMode, LivePriceMap } from "../components/LiveSection";
import { StatusTag, TechLabel } from "../components/marketing/ui";
import { SectionHead, fmtUsd } from "./ui";
import { STARTING_CASH } from "@/lib/constants";

type EquityPoint = { date: string; equity: number };

export default function PaperLiveBoard({
  cash,
  yieldTotal,
  apyAssumed,
  startDate,
  daysRunning,
  openPositions,
  equityData,
  hasSnapshots,
}: {
  cash: number;
  yieldTotal: number;
  apyAssumed: number;
  startDate: string;
  daysRunning: number;
  openPositions: BoardPosition[];
  equityData: EquityPoint[];
  hasSnapshots: boolean;
}) {
  const [prices, setPrices] = useState<LivePriceMap>({});
  const [mode, setMode] = useState<LiveMode>("loading");

  const handleTick = useCallback((p: LivePriceMap, m: LiveMode) => {
    setPrices(p);
    setMode(m);
  }, []);

  const live = (pair: string, fallback: number) => prices[pair]?.price ?? fallback;
  const positionsMTM = openPositions.reduce((s, p) => s + p.units * live(p.pair, p.entry_price), 0);
  // Definisi tunggal (sama dengan engine): total = cash + MTM. Yield sudah di
  // dalam cash — jangan ditambah lagi (dulu double-count sebesar yield total).
  const liveTotal = cash + positionsMTM;
  const chg = liveTotal - STARTING_CASH;
  const up = chg >= 0;
  const fresh = mode === "live";

  const cashPct = liveTotal > 0 ? (cash / liveTotal) * 100 : 0;
  const posPct = liveTotal > 0 ? (positionsMTM / liveTotal) * 100 : 0;

  return (
    <>
      {/* ── Hero: live equity ─────────────────────────────── */}
      <header className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/[0.02] p-7 backdrop-blur-xl sm:p-10">
        <div className="glow-sphere left-[10%] top-[-60%] h-[320px] w-[320px] bg-[#ccff00]/10" />
        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TechLabel>[ PAPER // LIVE MARKET, ZERO CAPITAL RISK ]</TechLabel>
            <StatusTag text="PAPER // RUNNING" />
          </div>
          <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-[-0.03em] sm:text-5xl">
                Paper<span className="text-[#ccff00]">Trading</span>
              </h1>
              <p className="mt-2 font-mono-tech text-[11px] uppercase tracking-[0.2em] text-white/40">
                Cluster-A2 · 10 pairs · since {startDate} · day {daysRunning}
              </p>
            </div>
            <div className="lg:text-right">
              <p className="tech-label flex items-center gap-2 text-white/40 lg:justify-end">
                <span className={`inline-block h-[6px] w-[6px] rounded-full ${fresh ? "pulse-dot bg-[#ccff00]" : "bg-amber-400"}`} />
                TOTAL EQUITY // {fresh ? "LIVE" : mode.toUpperCase()}
              </p>
              <p className="font-mono-tech text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
                ${fmtUsd(liveTotal, 0)}
              </p>
              <p className={`mt-1 font-mono-tech text-sm font-bold ${up ? "text-[#ccff00]" : "text-rose-400"}`}>
                {up ? "+" : ""}${fmtUsd(chg)} ({up ? "+" : ""}
                {((chg / STARTING_CASH) * 100).toFixed(1)}% vs $1,000 start)
              </p>
            </div>
          </div>
          {/* live equity composition */}
          <div className="mt-7">
            <div className="flex h-2.5 overflow-hidden rounded-full bg-white/10">
              <div className="bg-white/40 transition-all duration-500" style={{ width: `${cashPct}%` }} title="cash (incl. yield)" />
              <div className="bg-[#ccff00]/70 transition-all duration-500" style={{ width: `${posPct}%` }} title="positions" />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono-tech text-[10px] uppercase tracking-[0.15em] text-white/40">
              <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-white/40" />Cash ${fmtUsd(cash, 0)} (incl. +${fmtUsd(yieldTotal)} yield @ {apyAssumed}% APY sim)</span>
              <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#ccff00]/70" />Positions ${fmtUsd(positionsMTM, 0)}</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── 01 Board ──────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionHead
          n="01"
          title="Board"
          right={
            <span className="tech-label text-white/30">
              TICKER // 3S VIA PROXY{openPositions.length > 0 ? ` · ${openPositions.length} OPEN` : ""}
            </span>
          }
        />
        <LiveSection openPositions={openPositions} liveTotal={liveTotal} onTick={handleTick} />
      </section>

      {/* ── 02 Equity ─────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionHead n="02" title="Equity curve" right={<TechLabel className="text-white/30">DAILY HISTORY · LIVE TAIL</TechLabel>} />
        <EquityChart
          data={equityData}
          cash={cash}
          positionsMTM={positionsMTM}
          yieldTotal={yieldTotal}
          liveEquity={fresh ? liveTotal : null}
        />
        {!hasSnapshots && (
          <p className="font-mono-tech text-[11px] uppercase tracking-[0.15em] text-white/30">
            EQUITY HISTORY APPEARS AFTER THE FIRST ENGINE SNAPSHOT (NEXT DAILY RUN)
          </p>
        )}
      </section>
    </>
  );
}
