import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DONCHIAN_TEMPLATE_NAME } from "@/lib/deployment-config"
import { EmptyState, PageHeader, StatusBadge } from "@/app/components/ui"

export default async function StrategiesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const [{ data: strategies }, { data: templates }, { data: deployments }] = await Promise.all([
    supabase
      .from("user_strategies")
      .select("id, name, is_active, created_at, template_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("strategy_templates").select("id, name, description"),
    supabase.from("deployments").select("id, user_strategy_id").eq("user_id", user.id),
  ])

  const templateById = new Map((templates ?? []).map((t) => [t.id, t]))
  const botsByStrategy = new Map<number, number>()
  for (const d of deployments ?? []) {
    botsByStrategy.set(d.user_strategy_id, (botsByStrategy.get(d.user_strategy_id) ?? 0) + 1)
  }
  const hasDonchian = (strategies ?? []).some(
    (s) => templateById.get(s.template_id)?.name === DONCHIAN_TEMPLATE_NAME,
  )
  const deployedCount = (deployments ?? []).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Strategies"
        description="Your trading rules. TrendSentry checks your fills against them and flags deviations."
        action={
          <Link
            href="/app/strategies/new"
            className="rounded-full bg-[#ccff00] px-5 py-2 text-sm font-semibold text-black transition hover:bg-[#aadd00]"
          >
            + New strategy
          </Link>
        }
      />

      {!strategies?.length ? (
        <EmptyState
          title="No strategies yet"
          body="Define your entry and exit rules once. TrendSentry will check every fill against them and flag deviations — or run a Donchian strategy automatically as a bot."
          actionHref="/app/strategies/new"
          actionLabel="Create your first strategy"
        />
      ) : (
        <>
          {hasDonchian && deployedCount === 0 && (
            <div className="rounded-2xl border border-[#ccff00]/20 bg-[#ccff00]/[0.04] p-5">
              <p className="text-sm text-white/80">
                Your Donchian strategy can run automatically as an isolated paper-trading bot.{" "}
                <Link href="/app/deployments" className="font-medium text-[#ccff00] hover:underline">
                  Start a bot →
                </Link>
              </p>
              <p className="mt-1 text-xs text-white/40">
                Other templates are discipline-tracking only — only Donchian can run.
              </p>
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {strategies?.map((s) => {
              const template = templateById.get(s.template_id)
              const executable = template?.name === DONCHIAN_TEMPLATE_NAME
              const bots = botsByStrategy.get(s.id) ?? 0
              return (
                <div key={s.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="truncate font-semibold text-white">{s.name}</h2>
                    <div className="flex shrink-0 items-center gap-2">
                      {executable && <StatusBadge status="paper" label="Can run" />}
                      {!executable && <StatusBadge status="backtest_only" label="Tracking only" />}
                      <StatusBadge status={s.is_active ? "active" : "paused"} />
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-white/40">
                    {template?.name ?? "Custom"} ·{" "}
                    {bots > 0
                      ? `Running in ${bots} bot${bots === 1 ? "" : "s"}`
                      : executable
                        ? "Not running in any bot"
                        : "Discipline tracking only"}
                  </p>
                  <p className="mt-2 text-xs text-white/30">
                    Created {new Date(s.created_at).toLocaleDateString()}
                  </p>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
