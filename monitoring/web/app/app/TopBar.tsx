// TopBar konteks workspace: mode paper + status bot keseluruhan + akun.
// Server component — data diambil di layout, tanpa JavaScript client.
// Tidak ada state "live/production": mode selalu Paper (Fase 4 belum ada).

import Link from "next/link"
import LogoMark from "../components/LogoMark"
import { ThemeToggle } from "../components/ThemeToggle"

export type DeploymentStatus = "created" | "running" | "stopped" | "failed"

function overallStatus(statuses: DeploymentStatus[]): { label: string; dot: string } {
  if (statuses.includes("failed"))
    return { label: "Attention needed", dot: "bg-danger" }
  if (statuses.includes("running")) return { label: "Running", dot: "bg-success" }
  if (statuses.length > 0) return { label: "Stopped", dot: "bg-elevated" }
  return { label: "No bots yet", dot: "bg-muted" }
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
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-canvas/80 px-4 py-3 backdrop-blur-xl md:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <Link href="/app/dashboard" className="flex items-center gap-2 md:hidden" aria-label="TrendSentry home">
          <LogoMark className="h-7 w-7" />
        </Link>
        <span className="hidden rounded-full border border-line bg-surface px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-secondary sm:inline">
          Paper
        </span>
        <span className="flex items-center gap-2 text-sm text-secondary">
          <span aria-hidden className={`inline-block h-2 w-2 rounded-full ${overall.dot}`} />
          <span className="truncate">
            {overall.label}
            {botCount > 0 && (
              <span className="text-muted">
                {" "}
                · {botCount} bot{botCount === 1 ? "" : "s"}
              </span>
            )}
          </span>
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden max-w-48 truncate text-xs text-muted sm:inline" title={email ?? ""}>
          {email ?? ""}
        </span>
        <form action="/auth/signout" method="post">
          <button className="rounded-lg px-3 py-1.5 text-xs text-muted transition-colors hover:text-primary">
            Sign out
          </button>
        </form>
        <ThemeToggle className="h-9 w-9" />
      </div>
    </header>
  )
}
