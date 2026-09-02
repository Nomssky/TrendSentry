"use client";

// Harga realtime dari Bitget via Next.js API route proxy (browser -> Vercel -> Bitget).
// Flash merah/hijau saat harga berubah dibanding poll sebelumnya.

import { useEffect, useRef, useState } from "react";

type OpenPos = { pair: string; units: number; entry_price: number; stop_price: number; entry_date?: string };
type PriceMap = Record<string, { price: number; changePct: number | null }>;
type Mode = "loading" | "live" | "delayed" | "offline";
type FlashDir = "up" | "down" | null;

const PAIRS = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "XRP/USDT", "AVAX/USDT", "LINK/USDT", "DOGE/USDT", "ADA/USDT", "HYPE/USDT"];

export default function LiveSection({
  openPositions,
  fallbackPrices,
  cash = 0,
  totalEquity = 0,
  yieldTotal = 0,
}: {
  openPositions: OpenPos[];
  fallbackPrices: PriceMap;
  cash?: number;
  totalEquity?: number;
  yieldTotal?: number;
}) {
  const [prices, setPrices] = useState<PriceMap>(fallbackPrices);
  const [mode, setMode] = useState<Mode>("loading");
  const [flashes, setFlashes] = useState<Record<string, FlashDir>>({});
  const prevPrices = useRef<PriceMap>(fallbackPrices);

  useEffect(() => {
    let closed = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    let flashTimer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const res = await fetch("/api/prices", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as PriceMap;
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
          setMode("live");
          if (Object.keys(newFlashes).length > 0) {
            setFlashes(newFlashes);
            if (flashTimer) clearTimeout(flashTimer);
            flashTimer = setTimeout(() => {
              if (!closed) setFlashes({});
            }, 800);
          }
        }
      } catch {
        if (!closed) setMode((prev) => (prev === "live" ? "delayed" : "offline"));
      }
    };

    void poll();
    timer = setInterval(poll, 10_000);

    return () => {
      closed = true;
      if (timer) clearInterval(timer);
      if (flashTimer) clearTimeout(flashTimer);
    };
  }, []);

  const badge =
    mode === "live"
      ? { cls: "bg-emerald-500/10 text-emerald-400", dot: "animate-pulse bg-emerald-400", text: "LIVE" }
      : mode === "delayed"
        ? { cls: "bg-amber-500/10 text-amber-400", dot: "bg-amber-400", text: "DELAYED" }
        : mode === "offline"
          ? { cls: "bg-rose-500/10 text-rose-400", dot: "bg-rose-400", text: "OFFLINE" }
          : { cls: "bg-neutral-800 text-neutral-400", dot: "bg-neutral-500", text: "memuat..." };

  return (
    <section className="space-y-4">
      {/* Live ticker */}
      <div className="space-y-3">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${badge.cls}`}>
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
              <div key={pair} className={`rounded-xl border border-neutral-800 bg-neutral-900/60 px-3 py-2 sm:px-4 ${flashCls}`}>
                <div className="text-xs text-neutral-400">{pair}</div>
                <div className="font-mono text-base sm:text-lg">
                  {p ? `$${p.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                  {p?.changePct != null && (
                    <span className={`ml-1.5 text-xs sm:ml-2 sm:text-sm ${up ? "text-emerald-400" : "text-rose-400"}`}>
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

      {/* Open positions + unrealized PnL realtime */}
      {openPositions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/40 p-6 text-sm text-neutral-400">
          Tidak ada posisi open — bot menunggu breakout 20 hari. Normal untuk strategi ini
          (ekspektasi ~1 sinyal per 15 hari lintas 5 pair), bukan sistem mati.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {openPositions.map((pos) => {
            const p = prices[pos.pair];
            const price = p?.price ?? pos.entry_price;
            const invested = pos.units * pos.entry_price;
            const marketValue = pos.units * price;
            const unreal = marketValue - invested;
            const up = unreal >= 0;
            const pnlPct = invested > 0 ? (unreal / invested) * 100 : 0;
            const portfolioPct = totalEquity > 0 ? (marketValue / totalEquity) * 100 : 0;
            const daysOpen = pos.entry_date ? Math.floor((Date.now() - new Date(pos.entry_date).getTime()) / 86400000) : null;
            return (
              <div key={pos.pair} className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{pos.pair}</span>
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">OPEN</span>
                </div>
                {daysOpen !== null && (
                  <div className="mt-1 text-xs text-neutral-500">Hari ke-{daysOpen} sejak entry ({pos.entry_date})</div>
                )}
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <span className="text-neutral-400">Entry</span>
                  <span className="text-right font-mono">{pos.entry_price.toLocaleString("en-US")}</span>
                  <span className="text-neutral-400">Stop (2xATR)</span>
                  <span className="text-right font-mono text-rose-400">{pos.stop_price.toLocaleString("en-US")}</span>
                  <span className="text-neutral-400">Units</span>
                  <span className="text-right font-mono">{pos.units.toFixed(4)}</span>
                  <span className="text-neutral-400">Invested</span>
                  <span className="text-right font-mono">${invested.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <span className="text-neutral-400">Market Value</span>
                  <span className="text-right font-mono">${marketValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <span className="text-neutral-400">Unrealized PnL</span>
                  <span className={`text-right font-mono text-lg ${up ? "text-emerald-400" : "text-rose-400"}`}>
                    {up ? "+" : ""}
                    {unreal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                  </span>
                  <span className="text-neutral-400">PnL %</span>
                  <span className={`text-right font-mono ${up ? "text-emerald-400" : "text-rose-400"}`}>
                    {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
                  </span>
                  <span className="text-neutral-400">% Portfolio</span>
                  <span className="text-right font-mono">{portfolioPct.toFixed(1)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
