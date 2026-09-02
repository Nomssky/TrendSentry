"use client";

// Harga realtime SEMUA dari Bitget (konsisten dengan venue eksekusi Fase 4).
// 1. WebSocket Bitget (primary)  2. REST polling api.bitget.com tiap 10 detik (fallback).

import { useEffect, useRef, useState } from "react";

type OpenPos = { pair: string; units: number; entry_price: number; stop_price: number; entry_date?: string };
type PriceMap = Record<string, { price: number; changePct: number | null }>;
type Mode = "connecting" | "live" | "delayed" | "offline";

const PAIRS = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "XRP/USDT", "AVAX/USDT", "LINK/USDT", "DOGE/USDT", "ADA/USDT", "HYPE/USDT"];
const SYMBOL_TO_PAIR: Record<string, string> = {
  BTCUSDT: "BTC/USDT",
  ETHUSDT: "ETH/USDT",
  SOLUSDT: "SOL/USDT",
  BNBUSDT: "BNB/USDT",
  XRPUSDT: "XRP/USDT",
  AVAXUSDT: "AVAX/USDT",
  LINKUSDT: "LINK/USDT",
  DOGEUSDT: "DOGE/USDT",
  ADAUSDT: "ADA/USDT",
  HYPEUSDT: "HYPE/USDT",
};
const BITGET_WS = "wss://ws.bitget.com/v2/ws/public";
const BITGET_REST = "https://api.bitget.com/api/v2/spot/market/tickers";

function applyPrice(setPrices: React.Dispatch<React.SetStateAction<PriceMap>>, pair: string, price: number, open24: number | null) {
  const changePct = open24 && open24 > 0 ? ((price - open24) / open24) * 100 : null;
  setPrices((prev) => ({ ...prev, [pair]: { price, changePct } }));
}

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
  const [mode, setMode] = useState<Mode>("connecting");
  const modeRef = useRef<Mode>("connecting");

  useEffect(() => {
    let closed = false;
    let activeSocket: WebSocket | null = null;
    let openTimer: ReturnType<typeof setTimeout> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const setModeSafe = (m: Mode) => {
      modeRef.current = m;
      if (!closed) setMode(m);
    };

    const stopAll = () => {
      if (openTimer) clearTimeout(openTimer);
      openTimer = null;
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
      if (activeSocket) {
        activeSocket.onopen = null;
        activeSocket.onclose = null;
        activeSocket.onerror = null;
        activeSocket.onmessage = null;
        try { activeSocket.close(); } catch { /* noop */ }
        activeSocket = null;
      }
    };

    // Sumber 2: REST polling Bitget (fallback kalau WS gagal)
    const startPolling = () => {
      if (closed || pollTimer) return;
      setModeSafe("delayed");
      const poll = async () => {
        try {
          const res = await fetch(BITGET_REST, { cache: "no-store" });
          if (!res.ok) throw new Error(String(res.status));
          const json = (await res.json()) as { data?: { symbol: string; lastPr: string; change24h: string; open24h: string }[] };
          for (const r of json.data ?? []) {
            // Bitget symbol format: BTCUSDT (no slash)
            const pair = SYMBOL_TO_PAIR[r.symbol];
            if (pair) {
              const last = Number(r.lastPr);
              const open24 = Number(r.open24h);
              applyPrice(setPrices, pair, last, open24 > 0 ? open24 : null);
            }
          }
          if (!closed) setModeSafe("delayed");
        } catch {
          if (!closed) setModeSafe("offline");
        }
      };
      void poll();
      pollTimer = setInterval(poll, 10_000);
    };

    // Sumber 1 & 2: WebSocket — tiap percobaan SELF-CONTAINED (socket & timer lokal).
    // Dulu socket & timer dibagi bersama -> timer percobaan lama bisa menutup koneksi
    // percobaan berikutnya (race bug) -> sebagian harga tidak pernah terisi.
    const tryWebSocket = (
      url: string,
      onFrame: (raw: string) => void,
      onSubscribe: ((socket: WebSocket) => void) | null,
      next: () => void,
    ) => {
      if (closed) return;
      let opened = false;
      let done = false;
      let socket: WebSocket | null = null;
      let openTimer: ReturnType<typeof setTimeout> | null = null;

      const detach = () => {
        if (openTimer) clearTimeout(openTimer);
        openTimer = null;
        if (socket) {
          socket.onopen = null;
          socket.onclose = null;
          socket.onerror = null;
          socket.onmessage = null;
          try { socket.close(); } catch { /* noop */ }
          if (activeSocket === socket) activeSocket = null;
          socket = null;
        }
      };
      const finish = () => {
        if (done) return;
        done = true;
        detach();
        next();
      };

      try {
        socket = new WebSocket(url);
      } catch {
        finish();
        return;
      }
      activeSocket = socket;
      openTimer = setTimeout(() => {
        if (!opened) finish();  // tidak konek dalam 6 detik -> sumber berikutnya
      }, 6000);
      socket.onopen = () => {
        if (done || !socket) return;
        opened = true;
        if (openTimer) clearTimeout(openTimer);
        openTimer = null;
        setModeSafe("live");
        if (onSubscribe) onSubscribe(socket);
      };
      socket.onmessage = (ev) => {
        if (opened && !done) onFrame(String(ev.data));
      };
      socket.onclose = () => {
        if (done || closed) return;
        if (opened) {
          // koneksi hidup lalu putus -> coba seluruh rantai dari awal
          done = true;
          detach();
          setModeSafe("connecting");
          retryTimer = setTimeout(start, 5000);
        } else {
          finish();
        }
      };
      socket.onerror = () => {
        if (!opened) finish();
      };
    };

    const onBitgetFrame = (raw: string) => {
      try {
        const msg = JSON.parse(raw) as { arg?: { symbol?: string }; data?: { lastPrice?: string; openPrice24h?: string }[] };
        const symbol = msg.arg?.symbol;
        const d = msg.data?.[0];
        if (!symbol || !d?.lastPrice) return;
        const pair = SYMBOL_TO_PAIR[symbol];
        if (pair) applyPrice(setPrices, pair, Number(d.lastPrice), d.openPrice24h ? Number(d.openPrice24h) : null);
      } catch { /* ignore */ }
    };

    const start = () => {
      stopAll();
      if (closed) return;
      setModeSafe("connecting");
      tryWebSocket(
        BITGET_WS,
        onBitgetFrame,
        (socket) => socket.send(JSON.stringify({
          op: "subscribe",
          args: PAIRS.map((p) => ({ instType: "SPOT", channel: "ticker", instId: p.replace("/", "") })),
        })),
        startPolling,
      );
    };

    start();
    return () => {
      closed = true;
      stopAll();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, []);

  const badge =
    mode === "live"
      ? { cls: "bg-emerald-500/10 text-emerald-400", dot: "animate-pulse bg-emerald-400", text: "LIVE" }
      : mode === "delayed"
        ? { cls: "bg-amber-500/10 text-amber-400", dot: "bg-amber-400", text: "DELAYED (poll 10s)" }
        : mode === "offline"
          ? { cls: "bg-rose-500/10 text-rose-400", dot: "bg-rose-400", text: "OFFLINE" }
          : { cls: "bg-neutral-800 text-neutral-400", dot: "bg-neutral-500", text: "menghubungkan..." };

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
            const up = (p?.changePct ?? 0) >= 0;
            return (
              <div key={pair} className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-3 py-2 sm:px-4">
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
