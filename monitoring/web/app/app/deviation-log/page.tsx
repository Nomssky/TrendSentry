import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function DeviationLogPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: deviations } = await supabase
    .from("deviation_log")
    .select("id, rule_key, expected, actual, severity, detected_at")
    .eq("user_id", user.id)
    .order("detected_at", { ascending: false })
    .limit(200)

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">Deviation Log</h1>
      {!deviations?.length ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center">
          <p className="tech-label text-white/40">NO DEVIATIONS YET</p>
          <p className="mt-2 text-sm text-white/50">
            Deviations appear here when your trades break your strategy rules. Make sure you&apos;ve
            connected your API key and created a strategy — the daily sync will start checking automatically.
          </p>
        </div>
      ) : (
      <div className="space-y-2">
        {deviations?.map((d) => (
          <div key={d.id} className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
            <div className="flex items-center gap-2">
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                d.severity === "critical" ? "bg-rose-500/20 text-rose-400" :
                d.severity === "warning" ? "bg-amber-500/20 text-amber-400" :
                "bg-blue-500/20 text-blue-400"
              }`}>{d.severity}</span>
              <span className="font-mono-tech text-xs uppercase text-white/30">{d.rule_key}</span>
            </div>
            <p className="mt-1 text-white/70">Expected <span className="text-[#ccff00]">{d.expected}</span> · Actual <span className="text-rose-400">{d.actual}</span></p>
            <p className="mt-1 text-xs text-white/30">{new Date(d.detected_at).toLocaleString()}</p>
          </div>
        ))}
      </div>
      )}
    </div>
  )
}
