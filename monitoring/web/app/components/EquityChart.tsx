"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Point = { date: string; equity: number };

export default function EquityChart({ data }: { data: Point[] }) {
  const first = data[0]?.equity ?? 1000;
  const last = data[data.length - 1]?.equity ?? 1000;
  const up = last >= first;
  const color = up ? "#34d399" : "#fb7185";

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-neutral-300">Equity Curve (paper)</h2>
        <span className="font-mono text-lg" style={{ color }}>
          ${last.toLocaleString("en-US", { maximumFractionDigits: 2 })}
        </span>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#262626" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: "#737373", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "#262626" }}
              minTickGap={40}
            />
            <YAxis
              tick={{ fill: "#737373", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              domain={["auto", "auto"]}
              tickFormatter={(v: number) => `$${v}`}
              width={70}
            />
            <Tooltip
              contentStyle={{ background: "#171717", border: "1px solid #262626", borderRadius: 12, color: "#e5e5e5" }}
              formatter={(v) => [`$${Number(v).toLocaleString("en-US")}`, "Equity"]}
              labelStyle={{ color: "#a3a3a3" }}
            />
            <Area type="monotone" dataKey="equity" stroke={color} strokeWidth={2} fill="url(#eq)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
