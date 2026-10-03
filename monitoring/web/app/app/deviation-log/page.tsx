import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { EmptyState, PageHeader, StatusBadge } from "@/app/components/ui"

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
      <PageHeader
        title="Activity"
        description="Every time your fills broke your own strategy rules — what was expected, what actually happened, and when."
      />
      {!deviations?.length ? (
        <EmptyState
          title="No rule breaks yet"
          body="Activity appears here after your first synced trades are checked against your strategies. Clean record so far — or nothing synced yet."
          actionHref="/app/dashboard"
          actionLabel="Back to overview"
        />
      ) : (
        <div className="space-y-2">
          {deviations?.map((d) => (
            <div key={d.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge
                  status={d.severity === "critical" ? "error" : d.severity === "info" ? "ready" : "warning"}
                  label={d.severity}
                />
                <span className="font-mono-tech text-xs uppercase text-white/30">{d.rule_key}</span>
              </div>
              <p className="mt-1 text-white/70">
                Expected <span className="text-[#ccff00]">{d.expected}</span> · Actual{" "}
                <span className="text-rose-400">{d.actual}</span>
              </p>
              <p className="mt-1 text-xs text-white/30">{new Date(d.detected_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-white/30">
        New to this? <Link href="/app/strategies" className="text-[#ccff00] hover:underline">Define your rules</Link> and{" "}
        <Link href="/app/settings" className="text-[#ccff00] hover:underline">connect your exchange key</Link> —
        the daily check runs automatically after that.
      </p>
    </div>
  )
}
