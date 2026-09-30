"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

type Row = { id: number; name: string }

/** Daftar deployment milik user yang sedang login (sudah di-scope server-side
 *  oleh RLS + GET /api/deployments). Di luar komponen agar effect cukup
 *  memanggilnya lewat `.then(...)` — pola yang sama dengan halaman list. */
async function fetchOwnDeployments(): Promise<Row[]> {
  try {
    const res = await fetch("/api/deployments")
    return res.ok ? ((await res.json()) as Row[]) : []
  } catch {
    return []
  }
}

/**
 * Selector tipis: hanya MENAVIGASI ke `/app/deployments/<id>`.
 *
 * Filtering data tidak pernah terjadi di sini — halaman tujuan yang membaca
 * `getDashboardData(id)` setelah verifikasi kepemilikan di server. Dengan begitu
 * tidak ada jalur di mana user bisa memilih id milik orang lain dan tetap
 * mendapat data (server tetap menjawab 404).
 */
export function DeploymentSelector({ currentId }: { currentId: number }) {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    fetchOwnDeployments().then(setRows)
  }, [])

  if (rows.length === 0) return null

  return (
    <label className="flex items-center gap-2 text-sm text-white/50">
      <span className="tech-label text-white/40">DEPLOYMENT</span>
      <select
        value={currentId}
        onChange={(e) => router.push(`/app/deployments/${e.target.value}`)}
        className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-[#ccff00]/50"
      >
        {rows.map((r) => (
          <option key={r.id} value={r.id}>
            #{r.id} · {r.name}
          </option>
        ))}
      </select>
    </label>
  )
}
