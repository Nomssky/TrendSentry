"use client"

// Deployments = bot paper-trading terisolasi (satu strategi Donchian per bot).
// Bahasa produk: "bot", bukan "deployment record". Token config hanya hidup
// di state React ini — tidak localStorage/sessionStorage, tidak URL, tidak log.

import Link from "next/link"
import { useEffect, useState } from "react"
import { DONCHIAN_TEMPLATE_NAME } from "@/lib/deployment-config"
import {
  Alert,
  EmptyState,
  FormField,
  PageHeader,
  StatusBadge,
} from "@/app/components/ui"

type Deployment = {
  id: number
  name: string
  strategy_name: string | null
  status: "created" | "running" | "stopped" | "failed"
  current_config_version: number
  last_heartbeat: string | null
  created_at: string
}

type Strategy = { id: number; name: string; template_id: number | null }

/** Token config hanya hidup di state React ini — ditutup = hilang permanen. */
type IssuedToken = { id: number; token: string; configUrl: string }

async function fetchDeployments(): Promise<Deployment[]> {
  try {
    const res = await fetch("/api/deployments")
    return res.ok ? ((await res.json()) as Deployment[]) : []
  } catch {
    return []
  }
}

/** Waktu relatif yang mudah dibaca ("3 min ago") — bukan timestamp mentah. */
function relativeTime(iso: string | null): string {
  if (!iso) return "Never checked in"
  const diffMs = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(diffMs) || diffMs < 0) return "Just now"
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? "" : "s"} ago`
}

/** Blok env yang di-copy user untuk runtime (paper_trading/run_deployment.py). */
function runtimeEnvBlock(issued: IssuedToken): string {
  return [
    `TREND_SENTRY_DEPLOYMENT_ID=${issued.id}`,
    `TREND_SENTRY_CONFIG_URL=${issued.configUrl}`,
    `TREND_SENTRY_CONFIG_TOKEN=${issued.token}`,
  ].join("\n")
}

export default function DeploymentsPage() {
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [donchianId, setDonchianId] = useState<number | null>(null)
  const [name, setName] = useState("")
  const [strategyId, setStrategyId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [issued, setIssued] = useState<IssuedToken | null>(null)
  const [copied, setCopied] = useState(false)
  const [tested, setTested] = useState<"ok" | "fail" | null>(null)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    fetchDeployments().then(setDeployments)
    // Hanya strategi Donchian yang bisa berjalan sebagai bot.
    Promise.all([fetch("/api/templates").then((r) => r.json()), fetch("/api/strategies").then((r) => r.json())])
      .then(([templates, strategyRows]) => {
        const donchian = (templates as { id: number; name: string }[]).find(
          (t) => t.name === DONCHIAN_TEMPLATE_NAME,
        )
        setDonchianId(donchian?.id ?? null)
        setStrategies(strategyRows as Strategy[])
      })
      .catch(() => setStrategies([]))
  }, [])

  const donchianStrategies = strategies.filter((s) => s.template_id === donchianId)
  const formValid = strategyId != null && name.trim().length > 0

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!formValid) {
      setError("Choose a Donchian strategy and name your bot first.")
      return
    }
    setBusy(true)
    setError(null)
    let res: Response
    try {
      res = await fetch("/api/deployments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), user_strategy_id: strategyId }),
      })
    } catch {
      setBusy(false)
      setError("Network problem — check your connection and try again.")
      return
    }
    try {
      if (!res.ok) {
        let msg = `Could not start the bot (HTTP ${res.status}).`
        try {
          const j = await res.json()
          if (j && typeof j.error === "string" && j.error) msg = j.error
        } catch { /* non-JSON — pakai pesan default */ }
        setError(msg)
        return
      }
      // Token plaintext hanya hidup di sini — sekali panel ditutup/halaman
      // ditinggalkan, ia hilang dan tidak bisa dibaca lagi.
      const created = (await res.json()) as { id: number; config_token?: string }
      setName("")
      setCopied(false)
      setTested(null)
      if (created.config_token) {
        setIssued({
          id: created.id,
          token: created.config_token,
          configUrl: `${window.location.origin}/api/deployments/${created.id}/config`,
        })
      }
      setDeployments(await fetchDeployments())
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Deployments"
        description="A bot runs one Donchian strategy automatically as paper trading — isolated, versioned, and monitored here."
        action={
          <Link
            href="/app/strategies"
            className="rounded-full border border-white/15 px-5 py-2 text-sm text-white/60 hover:text-white"
          >
            ← Strategies
          </Link>
        }
      />

      {error && (
        <p className="text-sm text-rose-400" role="alert">
          {error}
        </p>
      )}

      {issued && (
        <section aria-label="One-time setup token" className="space-y-3 rounded-2xl border border-[#ccff00]/40 bg-[#ccff00]/[0.06] p-5">
          <h2 className="font-medium text-[#ccff00]">Bot access token — shown once</h2>
          <p className="text-sm text-white/70">
            Save it now. This token will <span className="text-white">never be shown again</span> —
            only its fingerprint is stored on the server. Closing this panel or leaving the page
            erases it from this browser for good. Creating the bot did not start it — follow the
            steps below to connect your runner.
          </p>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-white/70">
            <li>Copy the settings block below into your bot runner (self-hosted machine or CI).</li>
            <li>
              Run <span className="font-mono-tech text-xs">python paper_trading/run_deployment.py</span>{" "}
              with those three values set.
            </li>
            <li>Click Test connection below to confirm the token works.</li>
          </ol>
          <p className="text-xs text-white/40">
            Lost the token? It cannot be recovered — create a new bot (the old one will never run
            without it).
          </p>
          <pre className="overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-4 text-xs text-white/80">
            {runtimeEnvBlock(issued)}
          </pre>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(runtimeEnvBlock(issued))
                  setCopied(true)
                } catch {
                  setCopied(false)
                }
              }}
              className="rounded-full border border-[#ccff00]/50 px-5 py-2 text-sm text-[#ccff00] hover:bg-[#ccff00]/10"
            >
              {copied ? "Copied ✓" : "Copy settings"}
            </button>
            <button
              type="button"
              disabled={testing}
              onClick={async () => {
                setTesting(true)
                setTested(null)
                try {
                  const res = await fetch(issued.configUrl, {
                    headers: { Authorization: `Bearer ${issued.token}` },
                  })
                  setTested(res.ok ? "ok" : "fail")
                } catch {
                  setTested("fail")
                } finally {
                  setTesting(false)
                }
              }}
              className="rounded-full border border-white/15 px-5 py-2 text-sm text-white/70 hover:text-white disabled:opacity-40"
            >
              {testing ? "Testing…" : "Test connection"}
            </button>
            {tested === "ok" && <span className="text-sm text-emerald-400">Token works ✓</span>}
            {tested === "fail" && <span className="text-sm text-rose-400">Token not accepted — double-check.</span>}
            <button
              type="button"
              onClick={() => {
                setIssued(null)
                setCopied(false)
                setTested(null)
              }}
              className="rounded-full border border-white/15 px-5 py-2 text-sm text-white/60 hover:text-white"
            >
              I saved it — close
            </button>
          </div>
        </section>
      )}

      {!deployments.length ? (
        <EmptyState
          title="No bots yet"
          body="Set one up below: pick a Donchian strategy, give the bot a name, then run it from your runner to paper-trade on its own. Other strategy types are discipline-tracking only."
        />
      ) : (
        <div className="space-y-3">
          {deployments.map((d) => (
            <Link
              key={d.id}
              href={`/app/deployments/${d.id}`}
              className="block rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-white/20"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="truncate font-semibold text-white">{d.name}</h2>
                <StatusBadge status={d.status} />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-white/40">
                <span>{d.strategy_name ?? "Donchian strategy"}</span>
                <span>Paper · Bitget</span>
                <span>Last activity {relativeTime(d.last_heartbeat)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <form onSubmit={handleCreate} className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
        <div>
          <h2 className="font-medium text-white">Set up a new bot</h2>
          <p className="mt-1 text-xs text-white/40">
            Only Donchian Breakout strategies can run — other templates are discipline-tracking only.
            Creating the bot only prepares its configuration — run the command from the setup token
            below (or connect your runner) to actually start it.
          </p>
        </div>
        {donchianStrategies.length === 0 ? (
          <Alert tone="info">
            No Donchian strategy yet.{" "}
            <Link href="/app/strategies/new" className="font-medium text-[#ccff00] hover:underline">
              Create one first →
            </Link>
          </Alert>
        ) : (
          <>
            <FormField label="Bot name" help="Anything recognizable — e.g. Donchian BTC daily.">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My bot"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/40 outline-none focus:border-[#ccff00]/50"
              />
            </FormField>
            <FormField label="Strategy" help="Donchian strategies you own.">
              <select
                value={strategyId ?? ""}
                onChange={(e) => setStrategyId(Number(e.target.value) || null)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-[#ccff00]/50"
              >
                <option value="">Choose a Donchian strategy…</option>
                {donchianStrategies.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </FormField>
            <button
              type="submit"
              disabled={busy || !formValid}
              className="w-full rounded-full bg-[#ccff00] px-6 py-3 font-semibold text-black transition hover:bg-[#aadd00] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "Creating…" : "Create bot"}
            </button>
            {!formValid && (
              <p className="text-center text-xs text-white/30">Choose a strategy and name the bot to continue.</p>
            )}
          </>
        )}
      </form>
    </div>
  )
}
