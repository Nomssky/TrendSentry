"use client"

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { useThemeTokens } from "@/app/lib/useThemeTokens"

type DataPoint = { date: string; score: number }

// Recharts takes colours as inline style objects and SVG attributes, neither of
// which resolves `var()` — so the palette comes through useThemeTokens rather
// than a hex that would drift out of sync with globals.css.
const TOKENS = ["accent", "muted", "surface", "line", "primary"] as const

export function ScoreTrendChart({ data }: { data: DataPoint[] }) {
  const t = useThemeTokens([...TOKENS])

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data}>
        <XAxis
          dataKey="date"
          tick={{ fill: t.muted, fontSize: 10 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: t.muted, fontSize: 10 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: t.surface,
            border: `1px solid ${t.line}`,
            borderRadius: "8px",
            fontSize: "12px",
            color: t.primary,
          }}
          labelStyle={{ color: t.muted }}
        />
        <Line
          type="monotone"
          dataKey="score"
          stroke={t.accent}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}