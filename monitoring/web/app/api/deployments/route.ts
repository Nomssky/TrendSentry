import { NextResponse } from "next/server"
import crypto from "crypto"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { validateOrigin } from "@/lib/csrf"
import { DeploymentPostSchema, checkStrategyGuardrails } from "@/lib/validations"
import { DONCHIAN_TEMPLATE_NAME, ConfigBundleSchema, buildDonchianBundle } from "@/lib/deployment-config"

// Kolom yang boleh terlihat client. `config_token_hash` TIDAK pernah ikut —
// hash secret tidak boleh meninggalkan server (lihat [id]/config/route.ts).
const COLUMNS =
  "id, user_strategy_id, name, status, current_config_version, last_heartbeat, created_at, updated_at"

/** GET /api/deployments — daftar deployment milik user yang sedang login. */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  // RLS `deployments_select_self` sudah membatasi ke pemilik; `eq(user_id, ...)`
  // dipertahankan sebagai dua lapis (pola sama dengan /api/strategies).
  const { data: deployments } = await supabase
    .from("deployments")
    .select(COLUMNS)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  const rows = deployments ?? []
  const strategyIds = [...new Set(rows.map((d) => d.user_strategy_id))]
  const strategyNames = new Map<number, string>()
  if (strategyIds.length > 0) {
    const { data: strategies } = await supabase.from("user_strategies").select("id, name").in("id", strategyIds)
    for (const s of strategies ?? []) strategyNames.set(s.id, s.name)
  }

  return NextResponse.json(
    rows.map((d) => ({ ...d, strategy_name: strategyNames.get(d.user_strategy_id) ?? null }))
  )
}

/**
 * POST /api/deployments — buat deployment untuk satu user_strategies Donchian,
 * lalu tulis config version 1 yang immutable.
 *
 * Hanya menulis kontrol-eksekusi: TIDAK menyalakan engine, TIDAK memanggil
 * Bitget, TIDAK membuat scheduler, TIDAK menyentuh SQLite.
 */
export async function POST(request: Request) {
  const csrf = validateOrigin(request)
  if (csrf) return csrf

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 })
  }

  const parsed = DeploymentPostSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid payload", details: parsed.error.flatten() }, { status: 400 })
  }
  const { name, user_strategy_id } = parsed.data

  // Kepemilikan strategi: RLS `user_strategies_self` + eq(user_id, ...).
  // Strategi milik user lain -> 0 baris -> 404, tanpa membocorkan keberadaannya.
  const { data: strategy } = await supabase
    .from("user_strategies")
    .select("id, params, rules_json, template_id")
    .eq("id", user_strategy_id)
    .eq("user_id", user.id)
    .maybeSingle()
  if (!strategy) return NextResponse.json({ error: "strategy not found" }, { status: 404 })

  // Guardrail kebijakan yang sudah ada — input user dicek di sini, bukan di tempat baru.
  const guardrailError = checkStrategyGuardrails(strategy.params ?? {}, strategy.rules_json)
  if (guardrailError) return NextResponse.json({ error: guardrailError }, { status: 400 })

  // MVP Phase A hanya mengeksekusi Donchian (8 template ≠ 8 strategi eksekusi).
  if (strategy.template_id == null) {
    return NextResponse.json({ error: "hanya template Donchian yang bisa dideploy" }, { status: 400 })
  }
  const { data: template } = await supabase
    .from("strategy_templates")
    .select("name, params_schema")
    .eq("id", strategy.template_id)
    .maybeSingle()
  if (!template || template.name !== DONCHIAN_TEMPLATE_NAME) {
    return NextResponse.json({ error: "hanya template 'Donchian Breakout' yang bisa dideploy (MVP Phase A)" }, { status: 400 })
  }

  // Token baca config: plaintext hanya hidup di response ini. Yang disimpan hash-nya.
  const configToken = crypto.randomBytes(32).toString("base64url")
  const configTokenHash = crypto.createHash("sha256").update(configToken).digest("hex")

  // Tulis deployment + config version pakai service role: RLS sengaja TIDAK punya
  // policy INSERT, sehingga user tidak bisa membuat keduanya langsung dari browser.
  const admin = createAdminClient()
  const { data: deployment, error: deployErr } = await admin
    .from("deployments")
    .insert({
      user_id: user.id,
      user_strategy_id: strategy.id,
      name,
      status: "created",
      current_config_version: 1,
      config_token_hash: configTokenHash,
    })
    .select(COLUMNS)
    .single()
  if (deployErr || !deployment) {
    console.error("Deployment insert error:", deployErr)
    return NextResponse.json({ error: "create failed" }, { status: 500 })
  }

  // Kompensasi: kalau config version gagal dibuat, baris deployment ikut dibuang
  // supaya tidak menyisakan deployment yang mengaku current_config_version = 1
  // padahal snapshot-nya tidak ada. (Dua insert tidak bisa dalam satu transaksi
  // lewat PostgREST — ponytail: cukup kompensasi sederhana di skala MVP.)
  const discard = () => admin.from("deployments").delete().eq("id", deployment.id)

  const bundleParsed = ConfigBundleSchema.safeParse(
    buildDonchianBundle({
      deploymentId: deployment.id,
      userStrategyId: strategy.id,
      configVersion: 1,
      params: strategy.params ?? {},
      paramsSchema: template.params_schema ?? {},
    })
  )
  if (!bundleParsed.success) {
    await discard()
    return NextResponse.json({ error: "invalid config bundle", details: bundleParsed.error.flatten() }, { status: 400 })
  }

  const { error: versionErr } = await admin.from("deployment_config_versions").insert({
    deployment_id: deployment.id,
    version: 1,
    config: bundleParsed.data,
  })
  if (versionErr) {
    console.error("Config version insert error:", versionErr)
    await discard()
    return NextResponse.json({ error: "create failed" }, { status: 500 })
  }

  // Satu-satunya kali config_token meninggalkan server.
  return NextResponse.json({ ...deployment, config_token: configToken })
}
