import { createClient } from "@/lib/supabase/server"
import { EquityCurveChart } from "./EquityCurveChart"
import { ScoreTrendChart } from "./ScoreTrendChart"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [scores, deviations, strategies, trades] = await Promise.all([
    supabase.from("discipline_scores").select("*").eq("user_id", user?.id).order("date", { ascending: false }).limit(30),
    supabase.from("deviation_log").select("*").eq("user_id", user?.id).order("detected_at", { ascending: false }).limit(10),
    supabase.from("user_strategies").select("id, name, is_active").eq("user_id", user?.id).order("created_at", { ascending: false }),
    supabase.from("user_trades").select("id, pair, side, price, amount, pnl, r_multiple, executed_at").eq("user_id", user?.id).order("executed_at", { ascending: false }).limit(100),
  ])

  const avgScore = scores.data?.length
    ? Math.round(scores.data.reduce((s, r) => s + r.score, 0) / scores.data.length)
    : null

  const totalPnl = trades.data?.reduce((sum, t) => sum + (t.pnl ?? 0), 0) ?? 0
  const wins = trades.data?.filter((t) => (t.pnl ?? 0) > 0).length ?? 0
  const totalTrades = trades.data?.length ?? 0
  const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : null

  const scoreData = scores.data
    ? [...scores.data].reverse().map((s) => ({ date: s.date, score: s.score }))
    : []

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-white">Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs text-white/40">Discipline Score (avg)</p>
          <p className="mt-1 font-mono-tech text-4xl font-bold text-[#ccff00]">{avgScore ?? "—"}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs text-white/40">Active Strategies</p>
          <p className="mt-1 font-mono-tech text-4xl font-bold text-white">{strategies.data?.filter((s) => s.is_active).length ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs text-white/40">Total PnL</p>
          <p className={`mt-1 font-mono-tech text-4xl font-bold ${totalPnl >= 0 ? "text-[#ccff00]" : "text-rose-400"}`}>{totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(2)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs text-white/40">Win Rate</p>
          <p className="mt-1 font-mono-tech text-4xl font-bold text-white">{winRate !== null ? `${winRate}%` : "—"}</p>
        </div>
      </div>

      {scoreData.length > 1 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-white">Score Trend</h2>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <ScoreTrendChart data={scoreData} />
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">Latest Deviations</h2>
        <div className="space-y-2">
          {!deviations.data?.length && <p className="text-sm text-white/40">No deviations detected. Keep it up!</p>}
          {deviations.data?.slice(0, 5).map((d) => (
            <div key={d.id} className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
              <span className="font-mono-tech text-xs uppercase text-white/30">{d.rule_key}</span>
              <p className="mt-1 text-white/70">Expected <span className="text-[#ccff00]">{d.expected}</span> · Actual <span className="text-rose-400">{d.actual}</span></p>
              <p className="text-xs text-white/30">{new Date(d.detected_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
