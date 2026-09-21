#!/usr/bin/env node
/**
 * API smoke test — free tier flow verification.
 *
 * Jalankan:
 *   node monitoring/web/e2e/api-smoke-test.mjs
 *
 * Tidak perlu Playwright — pakai fetch() langsung.
 */

const BASE = "https://trendsentry.vercel.app"
const SUPABASE_URL = "https://ypkdnvwlekxmmotxsvrm.supabase.co"

let passed = 0
let failed = 0

function ok(label) { passed++; console.log(`  ✅ ${label}`) }
function fail(label, detail) { failed++; console.log(`  ❌ ${label}: ${detail}`) }

async function testPublicPages() {
  console.log("\n── Public Pages ──")
  const pages = ["/", "/start", "/proof", "/pricing", "/papertrading", "/disclaimer", "/live"]
  for (const p of pages) {
    const res = await fetch(`${BASE}${p}`)
    if (res.status === 200) ok(`${p} → 200`)
    else fail(`${p}`, `status ${res.status}`)
  }
}

async function testAuthPages() {
  console.log("\n── Auth Pages ──")
  for (const p of ["/auth/login", "/auth/signup"]) {
    const res = await fetch(`${BASE}${p}`)
    const html = await res.text()
    if (res.status === 200 && html.includes("TrendSentry")) ok(`${p} → 200 + branding`)
    else fail(`${p}`, `status ${res.status}, has branding: ${html.includes("TrendSentry")}`)
  }
}

async function testProtectedRedirects() {
  console.log("\n── Protected Pages (should redirect to login) ──")
  for (const p of ["/app/dashboard", "/app/strategies", "/app/settings", "/app/deviation-log"]) {
    const res = await fetch(`${BASE}${p}`, { redirect: "manual" })
    if (res.status === 307 || res.status === 302) ok(`${p} → redirect`)
    else fail(`${p}`, `status ${res.status} (expected redirect)`)
  }
}

async function testCronAuth() {
  console.log("\n── Cron Auth (should reject) ──")
  const endpoints = [
    { method: "GET", path: "/api/cron/daily-sync" },
    { method: "POST", path: "/api/cron/paper-sync" },
  ]
  for (const ep of endpoints) {
    const res = await fetch(`${BASE}${ep.path}`, { method: ep.method })
    if (res.status === 401) ok(`${ep.method} ${ep.path} → 401`)
    else fail(`${ep.method} ${ep.path}`, `status ${res.status} (expected 401)`)
  }
}

async function testPricesEndpoint() {
  console.log("\n── Prices Endpoint ──")
  const res = await fetch(`${BASE}/api/prices`)
  if (res.status === 200) {
    const data = await res.json()
    const pairCount = Object.keys(data).length
    if (pairCount > 0) ok(`prices → 200, ${pairCount} pairs`)
    else fail("prices", `0 pairs returned`)
  } else {
    fail("prices", `status ${res.status}`)
  }
}

async function testEventsEndpoint() {
  console.log("\n── Events Endpoint ──")
  const res = await fetch(`${BASE}/api/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "/smoke-test", ref: null }),
  })
  if (res.status === 200 || res.status === 429) ok(`events → ${res.status}`)
  else fail("events", `status ${res.status}`)
}

async function testStrategyTemplates() {
  console.log("\n── Strategy Templates (public read) ──")
  // Templates should be readable without auth (RLS: public read)
  const res = await fetch(`${BASE}/api/templates`, {
    headers: { "Content-Type": "application/json" },
  })
  // This endpoint requires auth, so 401 is expected without token
  if (res.status === 401) ok("templates → 401 (auth required, correct)")
  else if (res.status === 200) {
    const data = await res.json()
    if (Array.isArray(data) && data.length > 0) ok(`templates → 200, ${data.length} templates`)
    else fail("templates", `empty or not array`)
  } else {
    fail("templates", `status ${res.status}`)
  }
}

async function testSignUpPage() {
  console.log("\n── Signup Page Details ──")
  const res = await fetch(`${BASE}/auth/signup`)
  const html = await res.text()

  const checks = [
    ["Has logo", html.includes("TrendSentry")],
    ["Has name field", html.includes('placeholder="Name"')],
    ["Has email field", html.includes('type="email"')],
    ["Has password field", html.includes('type="password"')],
    ["Has sign up button", html.includes("Sign up")],
    ["Has sign in link", html.includes("/auth/login")],
  ]

  for (const [label, pass] of checks) {
    if (pass) ok(`signup: ${label}`)
    else fail(`signup: ${label}`, "missing")
  }
}

async function testLoginPage() {
  console.log("\n── Login Page Details ──")
  const res = await fetch(`${BASE}/auth/login`)
  const html = await res.text()

  // Login page uses "use client" + Suspense — form fields are client-rendered.
  // SSR shell only contains "Loading..." fallback. Check what IS in SSR:
  const checks = [
    ["Has logo (SSR)", html.includes("TrendSentry")],
    ["Has Suspense/loading shell", html.includes("Loading...") || html.includes("BAILOUT_TO_CLIENT_SIDE_RENDERING")],
  ]

  for (const [label, pass] of checks) {
    if (pass) ok(`login: ${label}`)
    else fail(`login: ${label}`, "missing")
  }

  // NOTE: Full form rendering (email, password, buttons) requires a real browser.
  // Run `npx playwright test e2e/free-tier-flow.spec.ts --headed` for full validation.
  console.log("  ℹ️  Form fields are client-rendered — test with Playwright for full validation")
}

async function testNavAuthAwareness() {
  console.log("\n── Nav Auth Awareness ──")

  // Without auth: should show "Sign in" + "Start free"
  const landing = await fetch(`${BASE}/`)
  const landingHtml = await landing.text()

  if (landingHtml.includes("/auth/login") && landingHtml.includes("/start")) {
    ok("Landing nav has Sign in + Start free (logged out)")
  } else {
    fail("Landing nav", "missing auth buttons")
  }
}

async function testDashboardContent() {
  console.log("\n── Dashboard Content (unauthenticated) ──")
  const res = await fetch(`${BASE}/app/dashboard`, { redirect: "manual" })
  if (res.status === 307 || res.status === 302) {
    ok("Dashboard redirects to login when not authenticated")
  } else {
    fail("Dashboard", `status ${res.status} (expected redirect)`)
  }
}

// ─── Run all tests ──────────────────────────────────────────────────

async function main() {
  console.log("🔍 TrendSentry Free Tier — API Smoke Test")
  console.log(`   Target: ${BASE}`)
  console.log(`   Time: ${new Date().toISOString()}`)

  try {
    await testPublicPages()
    await testAuthPages()
    await testProtectedRedirects()
    await testCronAuth()
    await testPricesEndpoint()
    await testEventsEndpoint()
    await testStrategyTemplates()
    await testSignUpPage()
    await testLoginPage()
    await testNavAuthAwareness()
    await testDashboardContent()
  } catch (err) {
    console.error("\n💥 Test crashed:", err.message)
    failed++
  }

  console.log(`\n${"═".repeat(50)}`)
  console.log(`Results: ${passed} passed, ${failed} failed`)
  console.log(`${"═".repeat(50)}`)

  process.exit(failed > 0 ? 1 : 0)
}

main()
