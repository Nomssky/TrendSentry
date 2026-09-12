import crypto from "crypto"

// ponytail: allowlist — SATU-SATUNYA endpoint Bitget yang boleh dipanggil
// dengan API key milik user. Semua read-only. Tidak ada endpoint order,
// transfer, atau withdraw di sini — dan tidak boleh ditambah tanpa amendemen PLAN.md §9.
export const USER_KEY_READ_ENDPOINTS = [
  "/api/v2/spot/account/assets", // verifikasi key valid + punya akses read
  "/api/v2/spot/trade/fills", // fills milik user (auto-logging watcher)
] as const

export function signBitget(timestamp: string, method: string, path: string, body: string, secret: string) {
  const prehash = timestamp + method.toUpperCase() + path + body
  return crypto.createHmac("sha256", secret).update(prehash).digest("base64")
}

function authHeaders(apiKey: string, signature: string, timestamp: string, passphrase: string) {
  return {
    "ACCESS-KEY": apiKey,
    "ACCESS-SIGN": signature,
    "ACCESS-TIMESTAMP": timestamp,
    "ACCESS-PASSPHRASE": passphrase,
    "Content-Type": "application/json",
  }
}

/**
 * Verifikasi key user valid + punya akses read spot (endpoint read-only,
 * tidak menyentuh dana).
 *
 * CATATAN KEAMANAN: Bitget tidak menyediakan endpoint untuk membaca daftar
 * permission sebuah API key, dan dokumentasi tidak menjamin endpoint trade
 * (mis. spot/trade/unfilled-orders) menolak key read-only. Karena itu kita
 * TIDAK mengklaim bisa menegakkan read-only di sini — verifikasi ini hanya
 * memastikan key valid & dapat membaca akun. Pemilik key WAJIB membuatnya
 * tanpa izin Trade/Withdraw (lihat UI settings + PLAN.md §9). Key yang
 * tersimpan TIDAK PERNAH dipakai untuk order oleh kode ini.
 */
export async function verifySpotReadAccess(
  apiKey: string,
  apiSecret: string,
  passphrase: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const path = "/api/v2/spot/account/assets"
  const timestamp = Date.now().toString()
  try {
    const res = await fetch(`https://api.bitget.com${path}`, {
      headers: authHeaders(apiKey, signBitget(timestamp, "GET", path, "", apiSecret), timestamp, passphrase),
      signal: AbortSignal.timeout(10_000),
    })
    const data = (await res.json()) as { code?: string; msg?: string }
    if (data.code === "00000") return { ok: true }
    return { ok: false, reason: data.msg ?? `bitget code ${data.code}` }
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "network error" }
  }
}


