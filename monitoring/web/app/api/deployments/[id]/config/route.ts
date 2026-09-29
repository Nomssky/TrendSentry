import { NextResponse } from "next/server"
import crypto from "crypto"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * GET /api/deployments/[id]/config — jalur baca config bundle untuk execution
 * plane (Phase B), TANPA session.
 *
 * Autentikasi: header `Authorization: Bearer <token>` yang hanya dibawa runtime.
 *   - Token = 256 bit dari crypto.randomBytes(32), dibuat saat POST /api/deployments
 *     dan dikembalikan SEKALI kepada pemilik deployment.
 *   - Yang tersimpan di `deployments.config_token_hash` adalah SHA-256 hex-nya,
 *     jadi baris deployment tidak pernah memuat secret yang bisa dipakai ulang.
 *   - Verifikasi memakai perbandingan TIMING-SAFE — pola yang sama dengan
 *     CRON_SECRET di app/api/cron/daily-sync dan app/api/cron/paper-sync.
 *
 * Kenapa per-deployment, bukan CRON_SECRET global: token ini dibawa runtime
 * milik user (self-hosted). Menyebarkan CRON_SECRET berarti memberi setiap user
 * secret yang membuka sinkronisasi seluruh install; token per-deployment
 * membatasi blast radius ke satu deployment.
 *
 * Kepemilikan: token di-hash per-deployment, jadi token milik deployment A tidak
 * pernah cocok dengan hash deployment B — user login pun tidak bisa memakai
 * session-nya untuk membaca config user lain (endpoint ini tidak membaca session
 * sama sekali). Kegagalan apa pun dijawab 401 sehingga keberadaan id tidak bisa
 * ditebak dari beda kode respons.
 *
 * Mengembalikan HANYA config version saat ini — tidak ada riwayat versi, tidak
 * ada data user lain (nama, email, strategi, status).
 */

// Pola identik dengan helper di app/api/cron/daily-sync/route.ts.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await ctx.params
  const deploymentId = Number(rawId)
  // Cek sebelum menyentuh DB: id format salah tidak mungkin ada, jawab 404.
  if (!Number.isInteger(deploymentId) || deploymentId <= 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }

  const header = request.headers.get("authorization") ?? ""
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : ""
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const admin = createAdminClient()

  const { data: deployment } = await admin
    .from("deployments")
    .select("id, current_config_version, config_token_hash")
    .eq("id", deploymentId)
    .maybeSingle()
  // Id tidak dikenal dijawab 401 (bukan 404) supaya id enumeration tidak bisa.
  if (!deployment) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const presented = crypto.createHash("sha256").update(token).digest("hex")
  if (!timingSafeEqual(presented, deployment.config_token_hash)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  // Selalu resolve ke versi saat ini; versi lama tidak pernah tersedia di endpoint ini.
  const { data: version } = await admin
    .from("deployment_config_versions")
    .select("version, config")
    .eq("deployment_id", deployment.id)
    .eq("version", deployment.current_config_version)
    .maybeSingle()
  if (!version) return NextResponse.json({ error: "not found" }, { status: 404 })

  return NextResponse.json({
    deployment_id: deployment.id,
    config_version: version.version,
    config: version.config,
  })
}
