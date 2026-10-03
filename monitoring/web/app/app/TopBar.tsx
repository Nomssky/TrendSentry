// TopBar konteks workspace: mode paper + status bot keseluruhan + akun.
// Server component — data diambil di layout, tanpa JavaScript client.
// Tidak ada state "live/production": mode selalu Paper (Fase 4 belum ada).

import Link from "next/link"
import LogoMark from "../components/LogoMark"

export type DeploymentStatus = "created" | "running" | "stopped" | "failed"

function overallStatus(statuses: DeploymentStatus[]): { label: string; dot: string } {
  if (statuses.includes("failed"))
    return { label: "Attention needed", dot: "bg-rose-400" }
  if (statuses.includes("running")) return { label: "Running", dot: "bg-emerald-400" }
  if (statuses.length > 0) return { label: "Stopped", dot: "bg-white/40" }
  return { label: "No bots yet", dot: "bg-white/25" }
}

export function TopBar({
  email,
  statuses,
  botCount,
}: {
  email: string | null
  statuses: DeploymentStatus[]
  botCount: number
}) {
  const overall = overallStatus(statuses)
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/10 bg-black/80 px-4 py-3 backdrop-blur-xl md:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <Link href="/app/dashboard" className="flex items-center gap-2 md:hidden" aria-label="TrendSentry home">
          <LogoMark tone="light" className="h-7 w-7" />
        </Link>
        <span className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono-tech text-[10px] uppercase tracking-[0.15em] text-white/60 sm:inline">
          Paper
        </span>
        <span className="flex items-center gap-2 text-sm text-white/70">
          <span aria-hidden className={`inline-block h-2 w-2 rounded-full ${overall.dot}`} />
          <span className="truncate">
            {overall.label}
            {botCount > 0 && (
              <span className="text-white/40">
                {" "}
                · {botCount} bot{botCount === 1 ? "" : "s"}
              </span>
            )}
          </span>
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden max-w-48 truncate text-xs text-white/40 sm:inline" title={email ?? ""}>
          {email ?? ""}
        </span>
        <form action="/auth/signout" method="post">
          <button className="rounded-lg px-3 py-1.5 text-xs text-white/50 transition-colors hover:text-white">
            Sign out
          </button>
        </form>
      </div>
    </header>
  )
}
