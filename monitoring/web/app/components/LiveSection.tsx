"use client";

// Realtime prices from Bitget via Next.js API route proxy (browser -> Vercel -> Bitget).
// Polls every 3s, flashes on change, and reports the fresh snapshot up via onTick
// so hero + chart move off the SAME numbers (single poller, no drift).

import { useEffect, useRef, useState } from "react";
import { PAIRS, fmt, MS_PER_DAY } from "@/lib/constants";

export type LivePriceMap = Record<string, { price: number; changePct: number | null }>;
export type LiveMode = "loading" | "live" | "delayed" | "offline";
type FlashDir = "up" | "down" | null;

export type BoardPosition = {
  id: number;
  pair: string;
  units: number;
  entry_price: number;
  stop_price: number;
  entry_date: string;
};

export default function LiveSection({
  openPositions,
  liveTotal,
  onTick,
}: {
  openPositions: BoardPosition[];
  liveTotal: number;
  onTick?: (prices: LivePriceMap, mode: LiveMode) => void;
}) {
  const [prices, setPrices] = useState<LivePriceMap>({});
  const [mode, setMode] = useState<LiveMode>("loading");
  const [flashes, setFlashes] = useState<Record<string, FlashDir>>({});
  const [now, setNow] = useState<number | null>(null); // refreshed on each poll tick
  const [detail, setDetail] = useState<BoardPosition | null>(null);
  const prevPrices = useRef<LivePriceMap>({});
  const modeRef = useRef<LiveMode>("loading");
  const polling = useRef(false);

  useEffect(() => {
    let closed = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    let flashTimer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      if (polling.current) return;
      polling.current = true;
      try {
        const res = await fetch("/api/prices", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as LivePriceMap;
        if (!closed) {
          const newFlashes: Record<string, FlashDir> = {};
          for (const pair of PAIRS) {
            const prev = prevPrices.current[pair]?.price;
            const next = data[pair]?.price;
            if (prev != null && next != null && prev !== next) {
              newFlashes[pair] = next > prev ? "up" : "down";
            }
          }
          prevPrices.current = data;
          setPrices(data);
          setNow(Date.now());
          modeRef.current = "live";
          setMode("live");
          onTick?.(data, "live");
          if (Object.keys(newFlashes).length > 0) {
            setFlashes(newFlashes);
            if (flashTimer) clearTimeout(flashTimer);
            flashTimer = setTimeout(() => {
              if (!closed) setFlashes({});
            }, 3000);
          }
        }
      } catch {
        if (!closed) {
          const next: LiveMode = modeRef.current === "live" ? "delayed" : "offline";
          modeRef.current = next;
          setNow(Date.now());
          setMode(next);
          onTick?.(prevPrices.current, next);
        }
      } finally {
        polling.current = false;
      }
    };

    void poll();
    timer = setInterval(poll, 3_000);

    return () => {
      closed = true;
      if (timer) clearInterval(timer);
      if (flashTimer) clearTimeout(flashTimer);
    };
  }, [onTick]);

  // Close detail popup on Escape
  useEffect(() => {
    if (!detail) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDetail(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detail]);

  const badge =
    mode === "live"
      ? { cls: "bg-[#ccff00]/10 text-[#ccff00]", dot: "pulse-dot bg-[#ccff00]", text: "LIVE" }
      : mode === "delayed"
        ? { cls: "bg-amber-500/10 text-amber-400", dot: "bg-amber-400", text: "DELAYED" }
        : mode === "offline"
          ? { cls: "bg-rose-500/10 text-rose-400", dot: "bg-rose-400", text: "OFFLINE" }
          : { cls: "bg-white/10 text-white/50", dot: "bg-white/40", text: "LOADING" };

  const calc = (pos: BoardPosition) => {
    const price = prices[pos.pair]?.price ?? pos.entry_price;
    const invested = pos.units * pos.entry_price;
    const marketValue = pos.units * price;
    const unreal = marketValue - invested;
    const up = unreal >= 0;
    const pnlPct = invested > 0 ? (unreal / invested) * 100 : 0;
    const portfolioPct = liveTotal > 0 ? (marketValue / liveTotal) * 100 : 0;
    const daysOpen =
      pos.entry_date && now !== null ? Math.floor((now - new Date(pos.entry_date).getTime()) / MS_PER_DAY) : null;
    return { price, invested, marketValue, unreal, up, pnlPct, portfolioPct, daysOpen };
  };

  const d = detail ? calc(detail) : null;

  return (
    <section className="space-y-4">
      {/* Live ticker */}
      <div className="space-y-3">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono-tech text-[11px] font-medium ${badge.cls}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
          {badge.text}
        </span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-5">
          {PAIRS.map((pair) => {
            const p = prices[pair];
            const flash = flashes[pair];
            const flashCls = flash === "up" ? "animate-flash-up" : flash === "down" ? "animate-flash-down" : "";
            const up = (p?.changePct ?? 0) >= 0;
            return (
              <div key={pair} className="glass rounded-2xl px-3 py-2 sm:px-4">
                <div className="font-mono-tech text-[10px] uppercase tracking-[0.2em] text-white/40">{pair}</div>
                <div className="font-mono-tech text-base sm:text-lg">
                  <span className={flashCls}>{p ? `$${fmt(p.price)}` : "—"}</span>
                  {p?.changePct != null && (
                    <span className={`ml-1.5 text-xs sm:ml-2 sm:text-sm ${up ? "text-[#ccff00]" : "text-rose-400"}`}>
                      {up ? "+" : ""}
                      {p.changePct.toFixed(2)}%
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Open positions — compact cards + detail popup */}
      {openPositions.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-white/15 bg-white/[0.02] p-6 text-sm text-white/50 backdrop-blur">
          No open positions — the bot is waiting for a 20-day breakout. Normal for this strategy
          (expected ~1 signal per 15 days across pairs), not a dead system.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {openPositions.map((pos) => {
            const c = calc(pos);
            const flash = flashes[pos.pair];
            const flashCls = flash === "up" ? "animate-flash-up" : flash === "down" ? "animate-flash-down" : "";
            return (
              <div key={pos.id} className="glass noise-overlay rounded-[2rem] p-5">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold tracking-tight">{pos.pair}</span>
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-mono-tech text-[11px] text-amber-400">OPEN</span>
                </div>
                <p className="mt-1 font-mono-tech text-[11px] text-white/40">
                  {c.daysOpen !== null ? `DAY ${c.daysOpen} SINCE ENTRY (${pos.entry_date})` : `SINCE ${pos.entry_date}`}
                </p>
                <p className="tech-label mt-4 text-white/40">UNREALIZED PNL</p>
                <p className={`font-mono-tech text-2xl font-bold tracking-tight sm:text-3xl ${flashCls} ${c.up ? "text-[#ccff00]" : "text-rose-400"}`}>
                  {c.up ? "+" : ""}{fmt(c.unreal)} <span className="text-base">USD</span>
                </p>
                <div className="mt-1.5 flex items-baseline justify-between font-mono-tech text-xs">
                  <span className={c.up ? "text-[#ccff00]" : "text-rose-400"}>
                    {c.pnlPct >= 0 ? "+" : ""}{c.pnlPct.toFixed(2)}%
                  </span>
                  <span className="text-white/40">MKT ${fmt(c.marketValue)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setDetail(pos)}
                  className="mt-4 w-full rounded-full border border-white/15 bg-white/5 px-6 py-2.5 text-sm font-medium text-white/80 transition hover:border-[#ccff00]/50 hover:text-[#ccff00]"
                >
                  Details
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail popup */}
      {detail && d && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setDetail(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${detail.pair} position details`}
            className="glass noise-overlay w-full max-w-sm rounded-[2rem] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-xl font-bold tracking-tight">{detail.pair}</span>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-mono-tech text-[11px] text-amber-400">OPEN</span>
                <button
                  type="button"
                  aria-label="Close details"
                  onClick={() => setDetail(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-white/60 transition hover:border-[#ccff00]/50 hover:text-[#ccff00]"
                >
                  ✕
                </button>
              </div>
            </div>
            {d.daysOpen !== null && (
              <p className="mt-1 font-mono-tech text-[11px] text-white/40">
                DAY {d.daysOpen} SINCE ENTRY ({detail.entry_date})
              </p>
            )}
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <span className="text-white/50">Entry</span>
              <span className="text-right font-mono-tech">{fmt(detail.entry_price)}</span>
              <span className="text-white/50">Stop (2×ATR)</span>
              <span className="text-right font-mono-tech text-rose-400">{fmt(detail.stop_price)}</span>
              <span className="text-white/50">Units</span>
              <span className="text-right font-mono-tech">{detail.units.toFixed(4)}</span>
              <span className="text-white/50">Invested</span>
              <span className="text-right font-mono-tech">${fmt(d.invested)}</span>
              <span className="text-white/50">Market Value</span>
              <span className="text-right font-mono-tech">${fmt(d.marketValue)}</span>
              <span className="text-white/50">Unrealized PnL</span>
              <span className={`text-right font-mono-tech font-bold ${d.up ? "text-[#ccff00]" : "text-rose-400"}`}>
                {d.up ? "+" : ""}${fmt(d.unreal)}
              </span>
              <span className="text-white/50">PnL %</span>
              <span className={`text-right font-mono-tech ${d.up ? "text-[#ccff00]" : "text-rose-400"}`}>
                {d.pnlPct >= 0 ? "+" : ""}{d.pnlPct.toFixed(2)}%
              </span>
              <span className="text-white/50">% Portfolio</span>
              <span className="text-right font-mono-tech">{d.portfolioPct.toFixed(1)}%</span>
            </div>
            <p className="mt-4 font-mono-tech text-[10px] uppercase tracking-[0.2em] text-white/30">
              PRICES TICK EVERY 3S // ESC TO CLOSE
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
