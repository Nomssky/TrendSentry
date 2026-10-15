import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ScoreTrendChart } from "./ScoreTrendChart"
import {
  Alert,
  EmptyState,
  PageHeader,
  SectionHeader,
  StatusBadge,
} from "@/app/components/ui"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const [scores, deviations, strategies, trades, totalDeviations, apiKeys, deployments] =
    await Promise.all([
      supabase.from("discipline_scores").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(30),
      supabase.from("deviation_log").select("*").eq("user_id", user.id).order("detected_at", { ascending: false }).limit(10),
      supabase.from("user_strategies").select("id, name, is_active").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("user_trades").select("id, pair, side, price, amount, executed_at").eq("user_id", user.id).order("executed_at", { ascending: false }).limit(100),
      supabase.from("deviation_log").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("user_api_keys").select("id").eq("user_id", user.id).limit(1),
      supabase.from("deployments").select("id, name, status, last_heartbeat").eq("user_id", user.id).order("created_at", { ascending: false }),
    ])

  const avgScore = scores.data?.length
    ? Math.round(scores.data.reduce((s, r) => s + r.score, 0) / scores.data.length)
    : null

  // user_trades is a fill log (no pnl/exit_price columns) — show total fills instead.
  // Never display P&L: it cannot be reliably calculated from fills alone.
  const totalTrades = trades.data?.length ?? 0
  const hasApiKey = (apiKeys.data?.length ?? 0) > 0
  const hasStrategy = (strategies.data?.length ?? 0) > 0
  const hasFills = totalTrades > 0
  const bots = deployments.data ?? []
  const hasBot = bots.length > 0
  // Setup = configuration (key + strategy + bot). Fills are trading activity,
  // not setup — shown separately below, never as an incomplete setup step.
  const isSetupComplete = hasApiKey && hasStrategy && hasBot
  const runningBots = bots.filter((b) => b.status === "running")
  const failedBots = bots.filter((b) => b.status === "failed")

  const scoreData = scores.data
    ? [...scores.data].reverse().map((s) => ({ date: s.date, score: s.score }))
    : []

  return (
    <div className="space-y-8">
      <PageHeader
        title="Overview"
        description="Bot health, your discipline, and recent activity — one screen."
      />

      {/* ── Level 1: Health ─────────────────────────────────── */}
      <section aria-label="Bot health">
        <SectionHeader
          title="Bot health"
          action={
            bots.length > 0 ? (
              <Link href="/app/deployments" className="text-xs font-medium text-accent hover:underline">
                Manage bots →
              </Link>
            ) : undefined
          }
        />
        {bots.length === 0 ? (
          <EmptyState
            title="No bots running"
            body="A bot runs one of your Donchian strategies automatically as paper trading. Nothing runs until you start one."
            actionHref="/app/deployments"
            actionLabel="Set up your first bot"
          />
        ) : (
          <div className="space-y-2">
            {failedBots.length > 0 && (
              <Alert tone="error">
                {failedBots.length} bot{failedBots.length === 1 ? "" : "s"} stopped unexpectedly
                {failedBots.map((b) => ` (${b.name})`).join("")}. Open it to inspect, then run it
                again from your runner — nothing starts on its own.
              </Alert>
            )}
            {bots.slice(0, 3).map((b) => (
              <Link
                key={b.id}
                href={`/app/deployments/${b.id}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line-strong"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <StatusBadge status={b.status} />
                  <span className="truncate font-medium text-primary">{b.name}</span>
                </span>
                <span className="shrink-0 text-xs text-muted">
                  {b.last_heartbeat
                    ? `Active ${new Date(b.last_heartbeat).toLocaleString()}`
                    : "Never checked in"}
                </span>
              </Link>
            ))}
          </div>
        )}
        {bots.length > 0 && runningBots.length === 0 && failedBots.length === 0 && (
          <p className="mt-2 text-xs text-muted">
            No bot is currently running. Stopped bots keep their history — run one again from
            your runner when ready.
          </p>
        )}
      </section>

      {/* ── Onboarding checklist (new users) ─────────────────── */}
      {!isSetupComplete && (
        <section aria-label="Setup checklist">
          <SectionHeader title="Setup checklist" />
          <ol className="space-y-3 rounded-2xl border border-accent/20 bg-accent/[0.05] p-6">
            <li className="flex items-start gap-3">
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${hasApiKey ? "bg-action text-on-action" : "border border-line-strong text-muted"}`}>
                {hasApiKey ? "✓" : "1"}
              </span>
              <div>
                <p className={`text-sm font-medium ${hasApiKey ? "text-muted line-through" : "text-primary"}`}>Connect Bitget API key</p>
                {!hasApiKey && <p className="mt-0.5 text-xs text-muted">A read-only key — no trade or withdraw permission.</p>}
                {!hasApiKey && <Link href="/app/settings" className="mt-1 inline-block text-xs font-medium text-accent hover:underline">Go to Settings →</Link>}
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${hasStrategy ? "bg-action text-on-action" : "border border-line-strong text-muted"}`}>
                {hasStrategy ? "✓" : "2"}
              </span>
              <div>
                <p className={`text-sm font-medium ${hasStrategy ? "text-muted line-through" : "text-primary"}`}>Create a strategy</p>
                {!hasStrategy && <p className="mt-0.5 text-xs text-muted">Pick a template (Donchian, SMA, RSI) and set your parameters.</p>}
                {!hasStrategy && <Link href="/app/strategies/new" className="mt-1 inline-block text-xs font-medium text-accent hover:underline">Create strategy →</Link>}
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${hasBot ? "bg-action text-on-action" : hasApiKey && hasStrategy ? "border border-accent/35 text-accent" : "border border-line-strong text-muted"}`}>
                {hasBot ? "✓" : "3"}
              </span>
              <div>
                <p className={`text-sm font-medium ${hasBot ? "text-muted line-through" : hasApiKey && hasStrategy ? "text-primary" : "text-muted"}`}>Set up a bot</p>
                {!hasBot && <p className="mt-0.5 text-xs text-muted">{hasApiKey && hasStrategy ? "Creates the versioned configuration — you run it from your runner." : "Complete steps 1 and 2 first."}</p>}
                {!hasBot && hasApiKey && hasStrategy && <Link href="/app/deployments" className="mt-1 inline-block text-xs font-medium text-accent hover:underline">Set up a bot →</Link>}
              </div>
            </li>
          </ol>
        </section>
      )}
      {hasApiKey && hasStrategy && !hasFills && (
        <p className="rounded-2xl border border-line bg-surface p-4 text-xs text-muted">
          No trading activity yet — fills appear here after your first synced trades (daily sync)
          or your bot&apos;s first run.
        </p>
      )}

      {/* ── Level 2: Performance (only what the backend actually has) ── */}
      <section aria-label="Performance">
        <SectionHeader title="Performance" />
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="rounded-2xl border border-line bg-surface p-6 lg:col-span-2">
            <p className="text-xs text-muted">Discipline Score (avg)</p>
            {/* No giant em dash for "no value": at 72px an em dash reads as a
                solid bar and looks like a rendering fault, not an empty state.
                The design has no display-size placeholder glyph — the caption
                below carries the message instead. */}
            {avgScore != null && (
              <p className="mt-2 font-mono text-6xl font-bold tabular-nums tracking-tight text-primary sm:text-7xl">
                {avgScore}
              </p>
            )}
            <p className="mt-2 text-xs text-muted">
              {avgScore != null
                ? "Average of your last 30 daily scores. Higher means fewer rule breaks."
                : "Not available yet — needs logged trades."}
            </p>
          </div>
          <div className="divide-y divide-line rounded-2xl border border-line bg-surface px-6 lg:col-span-3">
            <div className="flex items-baseline justify-between gap-4 py-4">
              <p className="text-xs text-muted">Active strategies</p>
              <p className="font-mono text-2xl font-bold tabular-nums text-primary">
                {strategies.data?.filter((s) => s.is_active).length ?? 0}
              </p>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-4">
              <p className="text-xs text-muted">
                Fills logged <span className="text-muted">· fills, not P&amp;L</span>
              </p>
              <p className="font-mono text-2xl font-bold tabular-nums text-primary">{totalTrades}</p>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-4">
              <p className="text-xs text-muted">Deviations</p>
              <p className={`font-mono text-2xl font-bold tabular-nums ${(totalDeviations.count ?? 0) > 0 ? "text-danger" : "text-success"}`}>
                {totalDeviations.count ?? 0}
              </p>
            </div>
          </div>
        </div>
      </section>

      {scoreData.length > 1 && (
        <section aria-label="Score trend">
          <SectionHeader title="Score trend" />
          <div className="rounded-2xl border border-line bg-surface p-5">
            <ScoreTrendChart data={scoreData} />
          </div>
        </section>
      )}

      {/* ── Level 3: Activity ─────────────────────────────── */}
      <section aria-label="Latest activity">
        <SectionHeader
          title="Latest activity"
          action={
            <Link href="/app/deviation-log" className="text-xs font-medium text-accent hover:underline">
              View all →
            </Link>
          }
        />
        <div className="space-y-2">
          {!deviations.data?.length && (
            <p className="text-sm text-muted">
              No deviations detected. {hasFills ? "Keep it up!" : "Activity appears after your first synced trades."}
            </p>
          )}
          {deviations.data?.slice(0, 5).map((d) => (
            <div key={d.id} className="rounded-xl border border-line bg-surface p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={d.severity === "critical" ? "error" : "warning"} label={d.severity} />
                <span className="font-mono text-xs uppercase text-muted">{d.rule_key}</span>
              </div>
              <p className="mt-1 text-secondary">
                Expected <span className="text-accent">{d.expected}</span> · Actual{" "}
                <span className="text-danger">{d.actual}</span>
              </p>
              <p className="text-xs text-muted">{new Date(d.detected_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
