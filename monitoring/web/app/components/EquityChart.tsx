"use client";

import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useThemeTokens } from "@/app/lib/useThemeTokens";

// Axis ticks are SVG text, so the family has to be a real value, not var().
const MONO = "IBM Plex Mono, ui-monospace, monospace";

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

  // Chart colours resolve from CSS custom properties, not hardcoded hex —
  // Recharts takes them as inline styles / SVG attributes, which ignore var().
  const t = useThemeTokens(["success", "danger", "surface", "line", "primary", "muted"]);
  const color = up ? t.success : t.danger;

  return (
    <div className="glass noise-overlay rounded-[2rem] p-5 sm:p-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Equity Curve (paper)</h2>
        <div className="flex gap-1.5">
          {(["7D", "30D", "ALL"] as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`rounded-full px-3 py-1 font-mono text-[11px] transition ${
                range === r
                  ? "bg-accent/15 text-accent"
                  : "bg-surface text-muted hover:bg-elevated hover:text-primary"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        {/* Last visible point — follows the 7D/30D/ALL window (incl. live tail) */}
        <span className="font-mono text-lg font-bold" style={{ color }}>
          ${last.toLocaleString("en-US", { maximumFractionDigits: 2 })}
        </span>
      </div>
      <div className="mb-2 flex flex-wrap gap-4 font-mono text-[11px] text-muted">
        <span>Cash: <span className="text-secondary">${cash.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span></span>
        <span>Positions: <span className="text-secondary">${positionsMTM.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span></span>
        <span>Yield: <span className="text-accent">+${yieldTotal.toLocaleString("en-US", { maximumFractionDigits: 2 })} (in cash)</span></span>
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
            <CartesianGrid stroke={t.line} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: t.muted, fontSize: 11, fontFamily: MONO }}
              tickLine={false}
              axisLine={{ stroke: t.line }}
              minTickGap={40}
            />
            <YAxis
              tick={{ fill: t.muted, fontSize: 11, fontFamily: MONO }}
              tickLine={false}
              axisLine={false}
              domain={["auto", "auto"]}
              tickFormatter={(v: number) => `$${v}`}
              width={70}
            />
            <Tooltip
              contentStyle={{ background: t.surface, border: `1px solid ${t.line}`, borderRadius: 16, color: t.primary }}
              formatter={(v) => [`$${Number(v).toLocaleString("en-US")}`, "Equity"]}
              labelStyle={{ color: t.muted }}
            />
            <Area type="monotone" dataKey="equity" stroke={color} strokeWidth={2} fill="url(#eq)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
