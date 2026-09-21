"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

const appLinks = [
  { href: "/app/dashboard", label: "Dashboard" },
  { href: "/app/strategies", label: "Strategies" },
  { href: "/app/deviation-log", label: "Deviation Log" },
  { href: "/app/settings", label: "Settings" },
]

const publicLinks = [
  { href: "/papertrading", label: "Paper Trading" },
  { href: "/proof", label: "Proof" },
]

export function AppSidebar() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Tutup menu saat navigasi.
  useEffect(() => { setOpen(false) }, [pathname])

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 backdrop-blur md:hidden"
        aria-label="Toggle menu"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
        className={`fixed inset-y-0 left-0 z-40 flex w-56 flex-col border-r border-white/10 bg-black p-5 pt-20 text-sm transition-transform duration-200 md:static md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Logo / Home */}
        <Link href="/" className="mb-6 flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ccff00] font-mono-tech text-sm font-bold text-black">
            T
          </span>
          <span className="text-sm font-semibold tracking-tight text-white">TrendSentry</span>
        </Link>

        {/* App links */}
        <div className="flex flex-col gap-1">
          {appLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-2 transition-colors ${pathname === l.href ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"}`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Divider */}
        <div className="my-4 border-t border-white/10" />

        {/* Public links */}
        <div className="flex flex-col gap-1">
          <p className="mb-1 px-3 font-mono-tech text-[10px] uppercase tracking-[0.15em] text-white/30">Public</p>
          {publicLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-2 transition-colors ${pathname === l.href ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"}`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Sign out */}
        <div className="mt-auto border-t border-white/10 pt-4">
          <form action="/auth/signout" method="post">
            <button className="rounded-lg px-3 py-2 text-left text-white/40 hover:text-white">Sign out</button>
          </form>
        </div>
      </nav>
    </>
  )
}
