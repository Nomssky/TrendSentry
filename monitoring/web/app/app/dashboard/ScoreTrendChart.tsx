"use client"

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"

type DataPoint = { date: string; score: number }

export function ScoreTrendChart({ data }: { data: DataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data}>
        <XAxis
          dataKey="date"
          tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "rgba(0,0,0,0.8)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "8px",
            fontSize: "12px",
          }}
          labelStyle={{ color: "rgba(255,255,255,0.5)" }}
        />
        <Line
          type="monotone"
          dataKey="score"
          stroke="#ccff00"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
