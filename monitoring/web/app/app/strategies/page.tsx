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
            className="rounded-full bg-action px-5 py-2 text-sm font-semibold text-on-action transition hover:bg-accent-hover"
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
            <div className="rounded-2xl border border-accent/20 bg-accent/[0.05] p-5">
              <p className="text-sm text-secondary">
                Your Donchian strategy can run automatically as an isolated paper-trading bot.{" "}
                <Link href="/app/deployments" className="font-medium text-accent hover:underline">
                  Set up a bot →
                </Link>
              </p>
              <p className="mt-1 text-xs text-muted">
                Other templates are discipline-tracking only — only Donchian can run.
              </p>
            </div>
          )}
          <div className="overflow-hidden rounded-2xl border border-line">
            <div className="hidden grid-cols-[1fr_auto] items-center gap-4 border-b border-line bg-surface px-5 py-2.5 text-[11px] uppercase tracking-wider text-muted sm:grid sm:grid-cols-[1fr_220px_130px]">
              <span>Strategy</span>
              <span>Status</span>
              <span className="text-right">Running in</span>
            </div>
            {strategies?.map((s) => {
              const template = templateById.get(s.template_id)
              const executable = template?.name === DONCHIAN_TEMPLATE_NAME
              const bots = botsByStrategy.get(s.id) ?? 0
              return (
                <div
                  key={s.id}
                  className="grid grid-cols-1 gap-2 border-b border-line px-5 py-4 transition-colors last:border-0 hover:bg-surface sm:grid-cols-[1fr_220px_130px] sm:items-center sm:gap-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-primary">{s.name}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {template?.name ?? "Custom"} · Created{" "}
                      {new Date(s.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={s.is_active ? "active" : "paused"} />
                    {executable ? (
                      <StatusBadge status="paper" label="Can run" />
                    ) : (
                      <StatusBadge status="backtest_only" label="Tracking only" />
                    )}
                  </div>
                  <p className="text-xs text-muted sm:text-right">
                    {bots > 0 ? (
                      <span className="text-accent">
                        {bots} bot{bots === 1 ? "" : "s"}
                      </span>
                    ) : executable ? (
                      "Not running"
                    ) : (
                      "—"
                    )}
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
