"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import LogoMark from "../components/LogoMark"

// IA produk (§8): Overview, Strategies, Deployments, Activity, Settings.
// Label bahasa produk — bukan istilah internal. Rute tidak berubah.
const primaryLinks = [
  { href: "/app/dashboard", label: "Overview" },
  { href: "/app/strategies", label: "Strategies" },
  { href: "/app/deployments", label: "Deployments" },
  { href: "/app/deviation-log", label: "Activity" },
  { href: "/app/settings", label: "Settings" },
]

const secondaryLinks = [{ href: "/papertrading", label: "Paper Trading" }]

function isActive(pathname: string, href: string) {
  // Prefix match supaya /app/strategies/new tetap menyorot Strategies,
  // dan /app/deployments/2 tetap menyorot Deployments.
  return pathname === href || pathname.startsWith(href + "/")
}

export function AppSidebar() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Tutup menu saat navigasi (render-time adjustment — tanpa effect).
  const [prevPathname, setPrevPathname] = useState(pathname)
  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    setOpen(false)
  }

  const linkClass = (href: string) =>
    `flex items-center gap-2.5 rounded-lg px-3 py-[7px] text-[13px] transition-colors ${
      isActive(pathname, href)
        ? "bg-white/[0.07] text-white"
        : "text-white/55 hover:bg-white/5 hover:text-white"
    }`

  const ActiveDot = ({ href }: { href: string }) =>
    isActive(pathname, href) ? (
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#ccff00]" />
    ) : (
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-transparent" />
    )

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false)
        }}
        className="fixed left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 backdrop-blur md:hidden"
        aria-label="Toggle menu"
        aria-expanded={open}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          {open ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <nav
        aria-label="Product"
        className={`fixed inset-y-0 left-0 z-40 flex w-56 flex-col border-r border-white/10 bg-black p-4 pt-20 text-sm transition-transform duration-200 md:static md:translate-x-0 md:p-4 md:pt-6 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <Link href="/app/dashboard" className="mb-5 flex items-center gap-2.5 px-1" aria-label="TrendSentry overview">
          <LogoMark tone="light" className="h-7 w-7" />
          <span className="text-sm font-semibold tracking-tight text-white">TrendSentry</span>
        </Link>

        <p className="mb-1 px-3 font-mono-tech text-[10px] uppercase tracking-[0.15em] text-white/30">
          Workspace
        </p>
        <div className="flex flex-col gap-0.5" role="list">
          {primaryLinks.map((l) => (
            <Link key={l.href} href={l.href} className={linkClass(l.href)} aria-current={isActive(pathname, l.href) ? "page" : undefined}>
              <ActiveDot href={l.href} />
              {l.label}
            </Link>
          ))}
        </div>

        <div className="my-4 border-t border-white/10" />

        <div className="flex flex-col gap-0.5">
          <p className="mb-1 px-3 font-mono-tech text-[10px] uppercase tracking-[0.15em] text-white/30">
            Public proof
          </p>
          {secondaryLinks.map((l) => (
            <Link key={l.href} href={l.href} className={linkClass(l.href)}>
              <ActiveDot href={l.href} />
              {l.label}
            </Link>
          ))}
        </div>

        <div className="mt-auto border-t border-white/10 pt-4">
          <p className="px-3 text-[11px] leading-relaxed text-white/30">
            Paper mode — no real orders, no real capital.
          </p>
        </div>
      </nav>
    </>
  )
}
