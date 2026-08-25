"use client";

// Komponen live: harga BTC/ETH realtime via Binance public WebSocket (client-side,
// tanpa backend) + unrealized PnL posisi open yang ngetik seiring harga.
// Kalau WebSocket gagal (jaringan blokir), fallback tampil pesan + harga terakhir dari build.

import { useEffect, useRef, useState } from "react";

type OpenPos = { pair: string; units: number; entry_price: number; stop_price: number };
type PriceMap = Record<string, { price: number; changePct: number | null }>;

const WS_URL = "wss://stream.binance.com:9443/stream?streams=btcusdt@miniTicker/ethusdt@miniTicker";
const STREAM_TO_PAIR: Record<string, string> = { BTCUSDT: "BTC/USDT", ETHUSDT: "ETH/USDT" };

function fmtUsd(n: number, digits = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export default function LiveSection({ openPositions, fallbackPrices }: { openPositions: OpenPos[]; fallbackPrices: PriceMap }) {
  const [prices, setPrices] = useState<PriceMap>(fallbackPrices);
  const [live, setLive] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let closed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const connect = () => {
      if (closed) return;
      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;
        ws.onopen = () => setLive(true);
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data as string) as { data?: { s: string; c: string; o: string } };
            const d = msg.data;
            const pair = d && STREAM_TO_PAIR[d.s];
            if (!d || !pair) return;
            const price = Number(d.c);
            const changePct = Number(d.o) > 0 ? ((price - Number(d.o)) / Number(d.o)) * 100 : null;
            setPrices((prev) => ({ ...prev, [pair]: { price, changePct } }));
          } catch {
            /* ignore malformed frame */
          }
        };
        ws.onclose = () => {
          setLive(false);
          if (!closed) retry = setTimeout(connect, 5000); // auto-reconnect
        };
        ws.onerror = () => ws.close();
      } catch {
        setLive(false);
      }
    };
    connect();
    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      wsRef.current?.close();
    };
  }, []);

  const pairs = ["BTC/USDT", "ETH/USDT"];

  return (
    <section className="space-y-4">
      {/* Live ticker */}
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            live ? "bg-emerald-500/10 text-emerald-400" : "bg-neutral-800 text-neutral-400"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${live ? "animate-pulse bg-emerald-400" : "bg-neutral-500"}`} />
          {live ? "LIVE" : "menghubungkan..."}
        </span>
        {pairs.map((pair) => {
          const p = prices[pair];
          const up = (p?.changePct ?? 0) >= 0;
          return (
            <div key={pair} className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-2">
              <div className="text-xs text-neutral-400">{pair}</div>
              <div className="font-mono text-lg">
                {p ? `$${fmtUsd(p.price)}` : "—"}
                {p?.changePct != null && (
                  <span className={`ml-2 text-sm ${up ? "text-emerald-400" : "text-rose-400"}`}>
                    {up ? "+" : ""}
                    {p.changePct.toFixed(2)}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Open positions + unrealized PnL realtime */}
      {openPositions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/40 p-6 text-sm text-neutral-400">
          Tidak ada posisi open — bot menunggu breakout 20 hari. Normal untuk strategi ini
          (~1 sinyal per 2-3 minggu per pair), bukan sistem mati.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {openPositions.map((pos) => {
            const p = prices[pos.pair];
            const price = p?.price ?? pos.entry_price;
            const unreal = pos.units * (price - pos.entry_price);
            const up = unreal >= 0;
            return (
              <div key={pos.pair} className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{pos.pair}</span>
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">OPEN</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <span className="text-neutral-400">Entry</span>
                  <span className="text-right font-mono">{fmtUsd(pos.entry_price)}</span>
                  <span className="text-neutral-400">Stop (2xATR)</span>
                  <span className="text-right font-mono text-rose-400">{fmtUsd(pos.stop_price)}</span>
                  <span className="text-neutral-400">Units</span>
                  <span className="text-right font-mono">{pos.units.toFixed(4)}</span>
                  <span className="text-neutral-400">Unrealized PnL</span>
                  <span className={`text-right font-mono text-lg ${up ? "text-emerald-400" : "text-rose-400"}`}>
                    {up ? "+" : ""}
                    {fmtUsd(unreal)} USD
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
