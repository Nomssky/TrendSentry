"use client"

import { useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { Suspense } from "react"

// ponytail: beacon first-party minimal untuk metrik Milestone 4
// (klik Start, connect, retensi buka dashboard, sumber referral).
// Tanpa cookie, tanpa fingerprint — hanya path + ?ref=, 1 hit per halaman.
function BeaconInner() {
  const path = usePathname()
  const search = useSearchParams()
  useEffect(() => {
    const ref = search.get("ref")
    if (ref) {
      try { localStorage.setItem("ts_ref", ref.slice(0, 100)) } catch { /* abaikan */ }
    }
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, ref }),
    }).catch(() => {})
  }, [path, search])
  return null
}

export function AnalyticsBeacon() {
  return (
    <Suspense fallback={null}>
      <BeaconInner />
    </Suspense>
  )
}

export function storedReferral(): string | null {
  try { return localStorage.getItem("ts_ref") } catch { return null }
}
