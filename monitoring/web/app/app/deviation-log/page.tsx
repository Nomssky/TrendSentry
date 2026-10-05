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
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-white/[0.02] text-[11px] uppercase tracking-wider text-white/35">
              <tr>
                <th className="px-4 py-2.5 font-medium">Severity</th>
                <th className="px-4 py-2.5 font-medium">Rule</th>
                <th className="px-4 py-2.5 font-medium">Expected</th>
                <th className="px-4 py-2.5 font-medium">Actual</th>
                <th className="px-4 py-2.5 text-right font-medium">Detected</th>
              </tr>
            </thead>
            <tbody>
              {deviations?.map((d) => (
                <tr key={d.id} className="border-t border-white/[0.06] transition-colors hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <StatusBadge
                      status={d.severity === "critical" ? "error" : d.severity === "info" ? "ready" : "warning"}
                      label={d.severity}
                    />
                  </td>
                  <td className="px-4 py-3 font-mono-tech text-xs uppercase text-white/50">{d.rule_key}</td>
                  <td className="px-4 py-3 text-[#ccff00]">{d.expected}</td>
                  <td className="px-4 py-3 text-rose-400">{d.actual}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-xs tabular-nums text-white/40">
                    {new Date(d.detected_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
