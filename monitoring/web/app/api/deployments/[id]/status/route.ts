import { NextResponse } from "next/server"
import crypto from "crypto"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * POST /api/deployments/[id]/status — heartbeat + lifecycle runtime (Phase B).
 *
 * Satu-satunya tulisan yang dilakukan execution plane ke control plane. Sama
 * session-free-nya dengan [id]/config: autentikasi = `Authorization: Bearer
 * <token per-deployment>`, diverifikasi timing-safe terhadap SHA-256 hash yang
 * tersimpan. Token tidak pernah masuk URL, log, maupun response.
 *
 * Body opsional: `{}` = heartbeat saja; `{ "status": "running" | "stopped" |
 * "failed" }` = heartbeat sekaligus pindah state.
 *
 * `created` TIDAK bisa dilaporkan runtime — state awal ditetapkan control plane
 * saat POST /api/deployments, dan daftar state sengaja tetap 4 (CHECK di
 * migration Phase A). Kolom yang disentuh hanya `last_heartbeat` + `status`;
 * tidak ada tabel monitoring/queue tambahan.
 *
 * Kenapa tidak pakai session: runtime tidak punya cookie user. Kenapa bukan
 * CRON_SECRET: itu secret global untuk sync pipeline — memakainya berarti
 * memberi tiap user secret yang membuka semua deployment.
 */

const BodySchema = z.object({
  status: z.enum(["running", "stopped", "failed"]).optional(),
})

// Pola identik dengan app/api/deployments/[id]/config/route.ts.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await ctx.params
  const deploymentId = Number(rawId)
  if (!Number.isInteger(deploymentId) || deploymentId <= 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }

  const header = request.headers.get("authorization") ?? ""
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : ""
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const admin = createAdminClient()

  const { data: deployment } = await admin
    .from("deployments")
    .select("id, status, config_token_hash")
    .eq("id", deploymentId)
    .maybeSingle()
  // Id tidak dikenal tetap 401 (bukan 404) — keberadaan id tidak boleh bocor.
  if (!deployment) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const presented = crypto.createHash("sha256").update(token).digest("hex")
  if (!timingSafeEqual(presented, deployment.config_token_hash)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  // Body kosong = heartbeat saja (runtime boleh tidak mengirim status).
  let body: unknown = {}
  const text = await request.text()
  if (text.trim()) {
    try {
      body = JSON.parse(text)
    } catch {
      return NextResponse.json({ error: "invalid JSON" }, { status: 400 })
    }
  }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid payload", details: parsed.error.flatten() }, { status: 400 })
  }

  const now = new Date().toISOString()
  const patch: { last_heartbeat: string; status?: "running" | "stopped" | "failed" } = { last_heartbeat: now }
  if (parsed.data.status) patch.status = parsed.data.status

  // RLS tidak punya policy UPDATE (default deny) -> tulisan hanya lewat service
  // role, persis seperti POST /api/deployments. Token pemilik cukup karena memang
  // hanya token deployment itu yang bisa lolos verifikasi di atas.
  const { error } = await admin.from("deployments").update(patch).eq("id", deployment.id)
  if (error) {
    console.error("Deployment status update error:", error)
    return NextResponse.json({ error: "update failed" }, { status: 500 })
  }

  return NextResponse.json({ status: patch.status ?? deployment.status, last_heartbeat: now })
}
