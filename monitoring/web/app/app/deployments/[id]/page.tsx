import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getDashboardData, type DashboardData } from "@/lib/db-supabase"
import PaperLiveBoard from "@/app/papertrading/PaperLiveBoard"
import { DeploymentSelector } from "./DeploymentSelector"
import { Alert, StatusBadge } from "@/app/components/ui"

export const dynamic = "force-dynamic"

/**
 * Dashboard per-deployment (Phase C).
 *
 * Satu-satunya sumber data paper di halaman ini adalah `getDashboardData(id)`,
 * yang men-filter SEMUA tabel `paper_*` dengan `deployment_id = id`. Tidak ada
 * fallback ke 0: id 0 = stream legacy global, bukan deployment user, jadi
 * `id <= 0` dijawab 404.
 *
 * Kepemilikan diverifikasi di server SEBELUM data diambil, memakai session
 * client (RLS `deployments_select_self`) + `.eq("user_id", user.id)` sebagai
 * dua lapis. Deployment yang tidak ada dan deployment milik user lain sama-sama
 * `notFound()` -> 404 identik, sehingga keberadaan id tidak bisa ditebak.
 */

/** Kolom yang aman ditampilkan — `config_token_hash` tidak pernah ikut. */
const COLUMNS =
  "id, user_strategy_id, name, status, current_config_version, last_heartbeat, created_at"

/**
 * Ambang stale heartbeat (30 jam) = aturan yang SAMA dengan stale `lastRun`
 * di /papertrading (asumsi cron harian). Ini bukan skor kesehatan: angka
 * heartbeat ditampilkan apa adanya, flag hanya menandai "masih `running`
 * tapi sudah lama tidak menyentuh baris".
 */
const HEARTBEAT_STALE_MS = 30 * 60 * 60 * 1000

/** Bentuk config snapshot yang cukup untuk ditampilkan (hanya metadata aman). */
type ConfigView = {
  strategy?: {
    model?: string
    pairs?: string[]
    timeframe?: string
    donchian_entry_period?: number
    donchian_exit_period?: number
    atr_period?: number
    atr_stop_multiplier?: number
  }
  risk?: {
    risk_per_trade_pct?: number
    max_concurrent_positions?: number
    max_drawdown_circuit_breaker_pct?: number
  }
  execution?: { mode?: string; exchange?: string }
}

/**
 * Umur heartbeat dalam milidetik dari timestamp ISO.
 *
 * Sengaja dihitung di helper murni, bukan di badan komponen: render server
 * component tidak boleh memanggil `Date.now()` langsung (react-hooks impure),
 * sedangkan umur heartbeat memang butuh "sekarang" — jadi waktu dibaca sekali
 * di sini.
 */
function heartbeatAgeMs(iso: string): number {
  return Date.now() - Date.parse(iso)
}

function ageText(ageMs: number): string {
  const mins = Math.max(0, Math.round(ageMs / 60000))
  if (mins < 60) return `${mins}m ago`
  if (mins < 60 * 48) return `${Math.round(mins / 60)}h ago`
  return `${Math.round(mins / (60 * 24))}d ago`
}

export default async function DeploymentDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // Urutan penting (anti-enumeration): auth dulu, baru id, baru kepemilikan.
  // Sebaliknya, user belum login akan dapat 404 untuk id valid tapi ada —
  // itu membocorkan keberadaan deployment.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { id: rawId } = await params
  const id = Number(rawId)
  if (!Number.isInteger(id) || id <= 0) notFound()

  // RLS `deployments_select_self` sudah membatasi ke pemilik; `eq(user_id, ...)`
  // dipertahankan sebagai dua lapis (pola sama dengan GET /api/deployments).
  const { data: deployment } = await supabase
    .from("deployments")
    .select(COLUMNS)
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle()
  if (!deployment) notFound()

  const [{ data: version }, { data: strategy }, data] = await Promise.all([
    // Kepemilikan config version diwarisi dari induknya lewat RLS.
    supabase
      .from("deployment_config_versions")
      .select("version, config")
      .eq("deployment_id", id)
      .eq("version", deployment.current_config_version)
      .maybeSingle(),
    supabase
      .from("user_strategies")
      .select("name")
      .eq("id", deployment.user_strategy_id)
      .eq("user_id", user.id)
      .maybeSingle(),
    getDashboardData(id),
  ])

  const cfg = (version?.config ?? null) as ConfigView | null
  const hb = deployment.last_heartbeat
  const hbAge = hb ? heartbeatAgeMs(hb) : null
  const stale = deployment.status === "running" && hbAge != null && hbAge > HEARTBEAT_STALE_MS

  return (
    <div className="space-y-6">
      {/* ── Identitas + lifecycle ─────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="tech-label text-muted">BOT #{deployment.id}</p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl text-primary sm:text-3xl">{deployment.name}</h1>
            <StatusBadge status={deployment.status} />
          </div>
          <p className="text-sm text-muted">{strategy?.name ?? "—"}</p>
        </div>
        <DeploymentSelector currentId={deployment.id} />
      </div>

      {deployment.status === "failed" && (
        <Alert tone="error">
          This bot stopped unexpectedly. Its history below is preserved. To run again, run it
          again from your runner with the same settings — nothing restarts on its own.
        </Alert>
      )}
      {deployment.status === "created" && hbAge == null && (
        <Alert tone="info">
          This bot hasn&apos;t run yet. Run it from your runner — status, heartbeat, and paper
          data will appear here after the first run.
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-y border-line py-4">
        <div>
          <p className="text-xs text-muted">Status</p>
          <p className="mt-1">
            <StatusBadge status={deployment.status} />
          </p>
        </div>
        <div>
          <p className="text-xs text-muted">Last check-in</p>
          <p className="mt-1 font-mono text-sm text-primary">
            {hbAge != null ? ageText(hbAge) : "—"}
          </p>
          <p className="text-[11px] text-muted">{hb ? new Date(hb).toISOString() : "not yet"}</p>
          {stale && (
            <p className="mt-1 text-[11px] text-warning">
              Running but quiet for over 30 hours — the status may be outdated.
            </p>
          )}
        </div>
        <div>
          <p className="text-xs text-muted">Configuration</p>
          <p className="mt-1 font-mono text-sm text-primary">v{deployment.current_config_version}</p>
          <p className="text-[11px] text-muted">created {new Date(deployment.created_at).toISOString().slice(0, 10)}</p>
        </div>
      </div>

      {/* ── Config yang sedang berjalan (metadata aman saja) ─ */}
      {cfg && (
        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
            Active configuration
          </h2>
          <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Strategy</dt>
              <dd className="text-primary">{cfg.strategy?.model ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Pairs</dt>
              <dd className="text-right text-primary">{cfg.strategy?.pairs?.join(", ") ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Timeframe</dt>
              <dd className="text-primary">{cfg.strategy?.timeframe ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Risk / trade</dt>
              <dd className="text-primary">{cfg.risk?.risk_per_trade_pct ?? "—"}%</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Max concurrent</dt>
              <dd className="text-primary">{cfg.risk?.max_concurrent_positions ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Mode</dt>
              <dd className="text-primary">
                {cfg.execution?.mode ?? "—"} · {cfg.execution?.exchange ?? "—"}
              </dd>
            </div>
          </dl>
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-muted hover:text-primary">
              Technical details (exact configuration snapshot)
            </summary>
            <pre className="mt-2 overflow-x-auto rounded-lg border border-line bg-canvas/40 p-3 font-mono text-[11px] text-secondary">
              {JSON.stringify(cfg, null, 2)}
            </pre>
          </details>
        </section>
      )}

      {/* ── Data paper milik deployment ini saja ───────────── */}
      <PaperLiveBoard
        cash={data.cash}
        yieldTotal={data.yieldInfo.total}
        startDate={data.startDate}
        daysRunning={data.daysRunning}
        openPositions={data.openPositions.map((p) => ({
          id: p.id,
          pair: p.pair,
          units: p.units,
          entry_price: p.entry_price,
          stop_price: p.stop_price,
          entry_date: p.entry_date,
        }))}
        equityData={data.equityCurve}
        hasSnapshots={data.hasSnapshots}
      />

      <MetricsGrid data={data} />

      <SignalsTable data={data} />

      <p className="text-center">
        <Link href="/app/deployments" className="text-sm text-muted hover:text-accent">
          ← All deployments
        </Link>
      </p>
    </div>
  )
}

function MetricsGrid({ data }: { data: DashboardData }) {
  const items: [string, string][] = [
    ["Signals", String(data.nSignals)],
    ["Closed trades", String(data.realized.nClosed)],
    ["Win rate", data.realized.winRatePct != null ? `${data.realized.winRatePct.toFixed(1)}%` : "—"],
    ["Avg R", data.realized.avgR != null ? `${data.realized.avgR >= 0 ? "+" : ""}${data.realized.avgR.toFixed(2)}R` : "—"],
    ["Avg slippage", data.slippage.avgPct != null ? `${data.slippage.avgPct.toFixed(4)}%` : "—"],
    ["Yield earned (sim off)", `$${data.yieldInfo.total.toFixed(2)}`],
  ]
  return (
    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-xs text-muted">{label}</p>
          <p className="mt-1 font-mono text-lg font-bold text-primary">{value}</p>
        </div>
      ))}
    </div>
  )
}

function SignalsTable({ data }: { data: DashboardData }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-line">
      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3">
        <h2 className="text-sm font-semibold text-primary">Recent signals</h2>
        <span className="tech-label text-muted">
          {data.closedTrades.length} CLOSED · {data.nSignals} RECORDS
        </span>
      </div>
      {data.recentSignals.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted">
          No signals for this bot yet — run it from your runner first. Signals appear here after
          the first run.
        </p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="bg-surface text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Pair</th>
              <th className="px-4 py-2">Signal</th>
              <th className="px-4 py-2">Decision</th>
              <th className="px-4 py-2">Close</th>
            </tr>
          </thead>
          <tbody>
            {data.recentSignals.slice(0, 15).map((s) => (
              <tr key={`${s.candle_date}-${s.pair}`} className="border-t border-line">
                <td className="px-4 py-2 text-secondary">{s.candle_date}</td>
                <td className="px-4 py-2 text-primary">{s.pair}</td>
                <td className="px-4 py-2 text-secondary">{s.signal}</td>
                <td className="px-4 py-2 text-secondary">{s.decision}</td>
                <td className="px-4 py-2 text-secondary">{s.close_price}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
