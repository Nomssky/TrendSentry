"use client";

import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Point = { date: string; equity: number };
type Range = "7D" | "30D" | "ALL";

export default function EquityChart({
  data,
  cash,
  positionsMTM,
  yieldTotal,
  liveEquity = null,
}: {
  data: Point[];
  cash: number;
  positionsMTM: number;
  yieldTotal: number;
  liveEquity?: number | null;
}) {
  const [range, setRange] = useState<Range>("ALL");

  const windowed = range === "ALL" ? data : data.slice(range === "30D" ? -30 : -7);
  // The last (today) point moves with live MTM; history stays daily.
  const shown =
    liveEquity != null && windowed.length > 0
      ? [...windowed.slice(0, -1), { ...windowed[windowed.length - 1], equity: liveEquity }]
      : windowed;

  const first = shown[0]?.equity ?? 1000;
  const last = shown[shown.length - 1]?.equity ?? 1000;
  const up = last >= first;
  const color = up ? "#ccff00" : "#fb7185";

  return (
    <div className="glass noise-overlay rounded-[2rem] p-5 sm:p-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-mono-tech text-[10px] uppercase tracking-[0.2em] text-white/40">Equity Curve (paper)</h2>
        <div className="flex gap-1.5">
          {(["7D", "30D", "ALL"] as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`rounded-full px-3 py-1 font-mono-tech text-[11px] transition ${
                range === r
                  ? "bg-[#ccff00]/15 text-[#ccff00]"
                  : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        {/* Last visible point — follows the 7D/30D/ALL window (incl. live tail) */}
        <span className="font-mono-tech text-lg font-bold" style={{ color }}>
          ${last.toLocaleString("en-US", { maximumFractionDigits: 2 })}
        </span>
      </div>
      <div className="mb-2 flex flex-wrap gap-4 font-mono-tech text-[11px] text-white/40">
        <span>Cash: <span className="text-white/70">${cash.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span></span>
        <span>Positions: <span className="text-white/70">${positionsMTM.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span></span>
        <span>Yield: <span className="text-[#ccff00]">+${yieldTotal.toLocaleString("en-US", { maximumFractionDigits: 2 })} (in cash)</span></span>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={shown} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: "#8f8f8f", fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}
              tickLine={false}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              minTickGap={40}
            />
            <YAxis
              tick={{ fill: "#8f8f8f", fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}
              tickLine={false}
              axisLine={false}
              domain={["auto", "auto"]}
              tickFormatter={(v: number) => `$${v}`}
              width={70}
            />
            <Tooltip
              contentStyle={{ background: "#0c0c0c", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 16, color: "#ebebeb", fontFamily: "JetBrains Mono, monospace" }}
              formatter={(v) => [`$${Number(v).toLocaleString("en-US")}`, "Equity"]}
              labelStyle={{ color: "#8f8f8f" }}
            />
            <Area type="monotone" dataKey="equity" stroke={color} strokeWidth={2} fill="url(#eq)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
