import { NextResponse } from "next/server"
import { PAIRS } from "@/lib/constants"
import { clientIp, isRateLimited } from "@/lib/rate-limit"

const BITGET_PAIRS = PAIRS.map((p) => p.replace("/", ""))
const BITGET_URL = "https://api.bitget.com/api/v2/spot/market/tickers"

let cache: { data: Record<string, { price: number; changePct: number | null }>; timestamp: number } | null = null
const CACHE_TTL = 30_000

const RATE_LIMIT = 60
const RATE_WINDOW_MS = 60_000

export async function GET(request: Request) {
  if (isRateLimited("prices", clientIp(request), RATE_LIMIT, RATE_WINDOW_MS)) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 })
  }

  try {
    if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
      return NextResponse.json(cache.data)
    }

    const res = await fetch(BITGET_URL, { cache: "no-store" })
    if (!res.ok) return NextResponse.json({ error: "upstream error" }, { status: 502 })
    const json = await res.json()
    const prices: Record<string, { price: number; changePct: number | null }> = {}
    for (const r of json.data ?? []) {
      if (!BITGET_PAIRS.includes(r.symbol)) continue
      const pair = r.symbol.replace("USDT", "/USDT")
      const last = Number(r.lastPr)
      const open24 = Number(r.open)
      const changePct = open24 > 0 ? ((last - open24) / open24) * 100 : null
      prices[pair] = { price: last, changePct }
    }

    cache = { data: prices, timestamp: Date.now() }
    return NextResponse.json(prices)
  } catch {
    return NextResponse.json({ error: "upstream error" }, { status: 502 })
  }
}
