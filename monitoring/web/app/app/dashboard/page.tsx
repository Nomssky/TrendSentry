import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ScoreTrendChart } from "./ScoreTrendChart"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const [scores, deviations, strategies, trades, totalDeviations, apiKeys] = await Promise.all([
    supabase.from("discipline_scores").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(30),
    supabase.from("deviation_log").select("*").eq("user_id", user.id).order("detected_at", { ascending: false }).limit(10),
    supabase.from("user_strategies").select("id, name, is_active").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("user_trades").select("id, pair, side, price, amount, executed_at").eq("user_id", user.id).order("executed_at", { ascending: false }).limit(100),
    supabase.from("deviation_log").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("user_api_keys").select("id").eq("user_id", user.id).limit(1),
  ])

  const avgScore = scores.data?.length
    ? Math.round(scores.data.reduce((s, r) => s + r.score, 0) / scores.data.length)
    : null

  // user_trades is a fill log (no pnl/exit_price columns) — show total fills instead.
  const totalTrades = trades.data?.length ?? 0
  const hasApiKey = (apiKeys.data?.length ?? 0) > 0
  const hasStrategy = (strategies.data?.length ?? 0) > 0
  const hasFills = totalTrades > 0
  const isSetupComplete = hasApiKey && hasStrategy && hasFills

  const scoreData = scores.data
    ? [...scores.data].reverse().map((s) => ({ date: s.date, score: s.score }))
    : []

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-white">Dashboard</h1>

      {/* ── Onboarding checklist (new users) ─────────────────── */}
      {!isSetupComplete && (
        <div className="rounded-2xl border border-[#ccff00]/20 bg-[#ccff00]/5 p-6">
          <p className="tech-label mb-1 text-[#ccff00]">SETUP CHECKLIST</p>
          <p className="mb-5 text-sm text-white/60">
            Complete these steps to start tracking your trading discipline.
          </p>
          <ol className="space-y-3">
            <li className="flex items-start gap-3">
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${hasApiKey ? "bg-[#ccff00] text-black" : "border border-white/20 text-white/40"}`}>
                {hasApiKey ? "✓" : "1"}
              </span>
              <div>
                <p className={`text-sm font-medium ${hasApiKey ? "text-white/40 line-through" : "text-white"}`}>Connect Bitget API key</p>
                {!hasApiKey && <p className="mt-0.5 text-xs text-white/40">A read-only key — no trade or withdraw permission.</p>}
                {!hasApiKey && <Link href="/app/settings" className="mt-1 inline-block text-xs font-medium text-[#ccff00] hover:underline">Go to Settings →</Link>}
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${hasStrategy ? "bg-[#ccff00] text-black" : "border border-white/20 text-white/40"}`}>
                {hasStrategy ? "✓" : "2"}
              </span>
              <div>
                <p className={`text-sm font-medium ${hasStrategy ? "text-white/40 line-through" : "text-white"}`}>Create a strategy</p>
                {!hasStrategy && <p className="mt-0.5 text-xs text-white/40">Pick a template (Donchian, SMA, RSI) and set your parameters.</p>}
                {!hasStrategy && <Link href="/app/strategies/new" className="mt-1 inline-block text-xs font-medium text-[#ccff00] hover:underline">Create strategy →</Link>}
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${hasFills ? "bg-[#ccff00] text-black" : hasApiKey && hasStrategy ? "border border-[#ccff00]/40 text-[#ccff00]" : "border border-white/20 text-white/40"}`}>
                {hasFills ? "✓" : "3"}
              </span>
              <div>
                <p className={`text-sm font-medium ${hasFills ? "text-white/40 line-through" : hasApiKey && hasStrategy ? "text-white" : "text-white/40"}`}>Wait for first sync</p>
                {!hasFills && <p className="mt-0.5 text-xs text-white/40">{hasApiKey && hasStrategy ? "The daily sync runs at 09:00 WIB. Your trades will appear here after the next run." : "Complete steps 1 and 2 first."}</p>}
              </div>
            </li>
          </ol>
        </div>
      )}

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
          <p className="text-xs text-white/40">Total Fills Logged</p>
          <p className="mt-1 font-mono-tech text-4xl font-bold text-white">{totalTrades}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs text-white/40">Deviations Detected</p>
          <p className={`mt-1 font-mono-tech text-4xl font-bold ${(totalDeviations.count ?? 0) > 0 ? "text-rose-400" : "text-[#ccff00]"}`}>{totalDeviations.count ?? 0}</p>
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
