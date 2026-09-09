import { NextResponse } from "next/server"

const PAIRS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "AVAXUSDT", "LINKUSDT", "DOGEUSDT", "ADAUSDT", "HYPEUSDT"]
const BITGET_URL = "https://api.bitget.com/api/v2/spot/market/tickers"

let cache: { data: Record<string, { price: number; changePct: number | null }>; timestamp: number } | null = null
const CACHE_TTL = 30_000

const rateLimit = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 30
const RATE_WINDOW = 60_000

export async function GET() {
  const ip = "global"
  const now = Date.now()
  const entry = rateLimit.get(ip)
  if (entry && now < entry.resetAt) {
    if (entry.count >= RATE_LIMIT) {
      return NextResponse.json({ error: "rate limited" }, { status: 429 })
    }
    entry.count++
  } else {
    rateLimit.set(ip, { count: 1, resetAt: now + RATE_WINDOW })
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
      if (!PAIRS.includes(r.symbol)) continue
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
