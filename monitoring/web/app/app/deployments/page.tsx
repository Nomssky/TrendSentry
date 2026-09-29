"use client"

// Halaman minimal Phase A: hanya memaparkan konsep deployment supaya alur
// kontrol-eksekusi bisa diverifikasi (buat -> config version 1 -> daftar).
// Dashboard deployment (status detail, riwayat versi, grafik) = tahap lanjut;
// jangan tambah panel/visual di sini tanpa keputusan produk.

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

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

const STATUS_STYLES: Record<Deployment["status"], string> = {
  created: "bg-white/10 text-white/60",
  running: "bg-emerald-500/20 text-emerald-400",
  stopped: "bg-white/10 text-white/40",
  failed: "bg-rose-500/20 text-rose-400",
}

// Di luar komponen agar effect cukup memanggilnya lewat `.then(setDeployments)` —
// eslint react-hooks melaporkan pemanggilan fungsi lokal yang berisi setState
// langsung dari dalam useEffect.
async function fetchDeployments(): Promise<Deployment[]> {
  try {
    const res = await fetch("/api/deployments")
    return res.ok ? ((await res.json()) as Deployment[]) : []
  } catch {
    return []
  }
}

export default function DeploymentsPage() {
  const router = useRouter()
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [donchianId, setDonchianId] = useState<number | null>(null)
  const [name, setName] = useState("")
  const [strategyId, setStrategyId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetchDeployments().then(setDeployments)
    // Hanya strategi Donchian yang bisa dideploy (8 template ≠ 8 strategi eksekusi).
    Promise.all([fetch("/api/templates").then((r) => r.json()), fetch("/api/strategies").then((r) => r.json())])
      .then(([templates, strategyRows]) => {
        const donchian = (templates as { id: number; name: string }[]).find((t) => t.name === "Donchian Breakout")
        setDonchianId(donchian?.id ?? null)
        setStrategies(strategyRows as Strategy[])
      })
      .catch(() => setStrategies([]))
  }, [])

  const donchianStrategies = strategies.filter((s) => s.template_id === donchianId)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!strategyId || !name) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/deployments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, user_strategy_id: strategyId }),
      })
      if (!res.ok) {
        const { error: msg } = await res.json()
        setError(msg)
        return
      }
      setName("")
      setDeployments(await fetchDeployments())
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Deployments</h1>
        <button onClick={() => router.push("/app/strategies")} className="rounded-full border border-white/15 px-5 py-2 text-sm text-white/60 hover:text-white">
          ← Strategies
        </button>
      </div>

      {error && <p className="text-sm text-rose-400">{error}</p>}

      {!deployments.length ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center">
          <p className="tech-label text-white/40">NO DEPLOYMENTS YET</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wider text-white/40">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Strategy</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Config</th>
                <th className="px-4 py-3">Heartbeat</th>
              </tr>
            </thead>
            <tbody>
              {deployments.map((d) => (
                <tr key={d.id} className="border-t border-white/10">
                  <td className="px-4 py-3 text-white">{d.name}</td>
                  <td className="px-4 py-3 text-white/60">{d.strategy_name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${STATUS_STYLES[d.status] ?? STATUS_STYLES.created}`}>
                      {d.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/60">v{d.current_config_version}</td>
                  <td className="px-4 py-3 text-white/40">{d.last_heartbeat ? new Date(d.last_heartbeat).toLocaleString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={handleCreate} className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="font-medium text-white">New deployment</h2>
        {donchianStrategies.length === 0 ? (
          <p className="text-sm text-white/50">
            Belum ada strategi <span className="text-white/80">Donchian Breakout</span> — buat dulu di halaman Strategies.
          </p>
        ) : (
          <>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Deployment name"
              required
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/40 outline-none focus:border-[#ccff00]/50"
            />
            <select
              value={strategyId ?? ""}
              onChange={(e) => setStrategyId(Number(e.target.value) || null)}
              required
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-[#ccff00]/50"
            >
              <option value="">Pilih strategi Donchian…</option>
              {donchianStrategies.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={busy || !strategyId || !name}
              className="w-full rounded-full bg-[#ccff00] px-6 py-3 font-semibold text-black transition hover:bg-[#aadd00] disabled:opacity-40"
            >
              Create deployment
            </button>
          </>
        )}
      </form>
    </div>
  )
}
