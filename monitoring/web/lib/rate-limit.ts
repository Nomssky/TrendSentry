// Rate limiter in-memory sederhana untuk route publik.
//
// Keterbatasan yang disadari: Map ini per-instance serverless, jadi bukan
// pengaman kuat lintas-instance. Cukup untuk menahan spam dasar; untuk
// penegakan sejati pakai Vercel WAF. IP diambil dari header yang diset
// platform (`x-real-ip`) — JANGAN percaya `x-forwarded-for` mentah karena
// bisa dipalsukan klien.

type Entry = { count: number; resetAt: number }

const stores = new Map<string, Map<string, Entry>>()

function getStore(name: string): Map<string, Entry> {
  let s = stores.get(name)
  if (!s) {
    s = new Map()
    stores.set(name, s)
  }
  return s
}

/** IP klien tepercaya. `x-real-ip` diset Vercel; fallback ke hop pertama XFF. */
export function clientIp(request: Request): string {
  const real = request.headers.get("x-real-ip")
  if (real) return real.trim()
  const xff = request.headers.get("x-forwarded-for")
  if (xff) return xff.split(",")[0].trim()
  return "unknown"
}

/**
 * Return true kalau request melewati batas. `key` biasanya `${name}:${ip}`.
 * `limit` request per `windowMs`.
 */
export function isRateLimited(name: string, ip: string, limit: number, windowMs: number): boolean {
  const store = getStore(name)
  const now = Date.now()

  // Prune ringan tiap panggilan: buang entri kedaluwarsa tanpa setInterval
  // (setInterval tidak dijamin hidup di serverless).
  if (store.size > 1000) {
    for (const [k, e] of store) {
      if (now > e.resetAt) store.delete(k)
    }
  }

  const entry = store.get(ip)
  if (entry && now < entry.resetAt) {
    if (entry.count >= limit) return true
    entry.count++
    return false
  }
  store.set(ip, { count: 1, resetAt: now + windowMs })
  return false
}
