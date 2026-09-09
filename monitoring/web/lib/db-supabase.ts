// Supabase data layer for paper trading dashboard
import { createAdminClient } from "./supabase/admin"

export type Position = {
  id: number
  pair: string
  entry_date: string
  entry_price: number
  units: number
  stop_price: number
  risk_amount: number
  status: string
  exit_date: string | null
  exit_price: string | null
  exit_reason: string | null
  pnl: number | null
  r_multiple: number | null
}

export type Signal = {
  candle_date: string
  pair: string
  close_price: number
  signal: string
  decision: string
  reason: string | null
  processed_at: string
}

export type EquityPoint = { date: string; equity: number }

export type DashboardData = {
  cash: number
  startDate: string
  lastCandleDate: string
  lastRun: string
  daysRunning: number
  gaps: string[]
  openPositions: Position[]
  closedTrades: Position[]
  recentSignals: Signal[]
  nSignals: number
  pairs: string[]
  realized: {
    nClosed: number
    wins: number
    winRatePct: number | null
    avgR: number | null
    avgWinR: number | null
    avgLossR: number | null
  }
  slippage: { avgPct: number | null; maxPct: number | null; n: number }
  yieldInfo: { total: number; days: number; apyAssumed: number }
  yieldDaily: { date: string; amount: number }[]
  equityCurve: EquityPoint[]
  hasSnapshots: boolean
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = createAdminClient()

  const [signalsRes, positionsRes, equityRes, metaRes] = await Promise.all([
    supabase.from("paper_signals").select("*").order("candle_date", { ascending: false }),
    supabase.from("paper_positions").select("*").order("id", { ascending: false }),
    supabase.from("paper_equity_log").select("*").order("date"),
    supabase.from("paper_meta").select("*"),
  ])

  if (signalsRes.error) console.error("paper_signals query error:", signalsRes.error)
  if (positionsRes.error) console.error("paper_positions query error:", positionsRes.error)
  if (equityRes.error) console.error("paper_equity_log query error:", equityRes.error)
  if (metaRes.error) console.error("paper_meta query error:", metaRes.error)

  const signals = (signalsRes.data ?? []) as Signal[]
  const positions = (positionsRes.data ?? []) as Position[]
  const equityLog = (equityRes.data ?? []) as { date: string; total_equity: number }[]
  const meta = Object.fromEntries((metaRes.data ?? []).map((r) => [r.key, r.value]))

  const cash = Number(meta.paper_cash ?? 1000)
  const dates = [...new Set(signals.map((s) => s.candle_date))].sort()
  const startDate = dates[0] ?? new Date().toISOString().slice(0, 10)
  const lastCandleDate = dates[dates.length - 1] ?? startDate

  const gaps: string[] = []
  let cur = new Date(startDate + "T00:00:00Z")
  const end = new Date(lastCandleDate + "T00:00:00Z")
  while (cur <= end) {
    const d = cur.toISOString().slice(0, 10)
    if (!dates.includes(d)) gaps.push(d)
    cur = new Date(cur.getTime() + 86_400_000)
  }

  const openPositions = positions.filter((p) => p.status === "open")
  const closedTrades = positions
    .filter((p) => p.status === "closed")
    .sort((a, b) => (a.exit_date ?? "").localeCompare(b.exit_date ?? ""))
    .reverse()

  const wins = closedTrades.filter((t) => (t.pnl ?? 0) > 0)
  const rs = closedTrades.map((t) => t.r_multiple ?? 0)
  const winRs = wins.map((t) => t.r_multiple ?? 0)
  const lossRs = closedTrades.filter((t) => (t.pnl ?? 0) < 0).map((t) => t.r_multiple ?? 0)
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null)

  const daysRunning =
    Math.floor((Date.now() - new Date(startDate + "T00:00:00Z").getTime()) / 86_400_000) + 1

  return {
    cash,
    startDate,
    lastCandleDate,
    lastRun: signals[0]?.processed_at ?? "",
    daysRunning,
    gaps,
    openPositions,
    closedTrades,
    recentSignals: signals.slice(0, 30),
    nSignals: signals.length,
    pairs: [...new Set(signals.map((s) => s.pair))].sort(),
    realized: {
      nClosed: closedTrades.length,
      wins: wins.length,
      winRatePct: closedTrades.length ? (wins.length / closedTrades.length) * 100 : null,
      avgR: avg(rs),
      avgWinR: avg(winRs),
      avgLossR: avg(lossRs),
    },
    slippage: { avgPct: null, maxPct: null, n: 0 },
    yieldInfo: { total: 0, days: 0, apyAssumed: 5 },
    yieldDaily: [],
    equityCurve: equityLog.map((r) => ({ date: r.date, equity: Math.round(r.total_equity * 100) / 100 })),
    hasSnapshots: equityLog.length > 0,
  }
}
