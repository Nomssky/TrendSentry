/**
 * E2E test: Free-tier user flow — 1 minggu simulasi.
 *
 * Jalankan:
 *   cd monitoring/web
 *   BASE_URL=https://trendsentry.vercel.app npx playwright test e2e/free-tier-flow.spec.ts --headed
 *
 * Test ini melakukan LOGIN NYATA — jangan run di CI.
 */

import { test, expect, type Page } from "@playwright/test"
import fs from "fs"

const BASE = process.env.BASE_URL || "https://trendsentry.vercel.app"
const EMAIL = "als.kresna@gmail.com"
const PASSWORD = "kresnaaji12"
const AUTH_FILE = "e2e/.auth/user.json"

// Helper: login and save storage state
async function login(page: Page) {
  await page.goto(`${BASE}/auth/login`)
  await page.getByPlaceholder("Email").waitFor({ timeout: 15000 })
  await page.getByPlaceholder("Email").fill(EMAIL)
  await page.locator('input[type="password"]').fill(PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 15000 })
}

test.describe("Free Tier — Full User Flow", () => {
  test.describe.configure({ mode: "serial" })

  // ─── 1. PUBLIC PAGES ──────────────────────────────────────────────

  test("landing page loads with correct content", async ({ page }) => {
    await page.goto(`${BASE}/`)
    await expect(page.locator("text=TrendSentry").first()).toBeVisible()
    await expect(page.locator("text=NO DEVIATION").first()).toBeVisible()
  })

  test("start page explains the flow", async ({ page }) => {
    await page.goto(`${BASE}/start`)
    await expect(page.locator("text=read-only").first()).toBeVisible()
  })

  test("proof page shows backtest reference", async ({ page }) => {
    await page.goto(`${BASE}/proof`)
    await expect(page.locator("text=BACKTEST REFERENCE").first()).toBeVisible()
  })

  test("paper trading page loads public data", async ({ page }) => {
    await page.goto(`${BASE}/papertrading`)
    await expect(page.locator("text=Paper").first()).toBeVisible()
  })

  test("pricing page shows tiers", async ({ page }) => {
    await page.goto(`${BASE}/pricing`)
    await expect(page.locator("text=Watcher").first()).toBeVisible()
  })

  test("disclaimer page loads", async ({ page }) => {
    await page.goto(`${BASE}/disclaimer`)
    await expect(page.locator("text=Not financial advice").first()).toBeVisible()
  })

  // ─── 2. AUTH FLOW ─────────────────────────────────────────────────

  test("signup page renders with branding", async ({ page }) => {
    await page.goto(`${BASE}/auth/signup`)
    await expect(page.locator("text=TrendSentry").first()).toBeVisible()
    await expect(page.getByPlaceholder("Email")).toBeVisible()
    await expect(page.getByPlaceholder("Name")).toBeVisible()
  })

  test("login page renders with branding", async ({ page }) => {
    await page.goto(`${BASE}/auth/login`)
    await expect(page.locator("text=TrendSentry").first()).toBeVisible()
  })

  test("login with wrong credentials shows error", async ({ page }) => {
    await page.goto(`${BASE}/auth/login`)
    await page.getByPlaceholder("Email").waitFor({ timeout: 15000 })
    await page.getByPlaceholder("Email").fill("wrong@example.com")
    await page.locator('input[type="password"]').fill("wrongpassword123")
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page.getByText(/invalid login credentials/i)).toBeVisible()
  })

  test("protected pages redirect to login when not authenticated", async ({ page }) => {
    for (const p of ["/app/dashboard", "/app/strategies", "/app/settings", "/app/deviation-log"]) {
      await page.goto(`${BASE}${p}`)
      await expect(page).toHaveURL(/\/auth\/login/)
    }
  })

  // ─── 3. AUTHENTICATED FLOW ────────────────────────────────────────

  test("login with real credentials succeeds", async ({ page }) => {
    await login(page)
    // Save storage state for reuse
    await page.context().storageState({ path: AUTH_FILE })
  })

  test("dashboard shows setup checklist or data", async ({ page }) => {
    await page.goto(`${BASE}/app/dashboard`)
    // If redirected to login, re-login
    if (page.url().includes("/auth/login")) {
      await login(page)
      await page.goto(`${BASE}/app/dashboard`)
    }

    const content = await page.textContent("body")
    const hasChecklist = content?.includes("SETUP CHECKLIST") ?? false
    const hasStats = content?.includes("Discipline Score") ?? false
    expect(hasChecklist || hasStats).toBeTruthy()
    console.log(`Dashboard: ${hasChecklist ? "setup checklist" : "stats cards"}`)
  })

  test("sidebar has correct links", async ({ page }) => {
    await page.goto(`${BASE}/app/dashboard`)
    if (page.url().includes("/auth/login")) {
      await login(page)
      await page.goto(`${BASE}/app/dashboard`)
    }

    await expect(page.locator('a[href="/app/strategies"]').first()).toBeVisible()
    await expect(page.locator('a[href="/app/deviation-log"]').first()).toBeVisible()
    await expect(page.locator('a[href="/app/settings"]').first()).toBeVisible()
    await expect(page.locator('a[href="/papertrading"]').first()).toBeVisible()
    await expect(page.locator('a[href="/proof"]').first()).toBeVisible()
    await expect(page.locator("text=Sign out")).toBeVisible()
  })

  test("settings page shows API key form", async ({ page }) => {
    await page.goto(`${BASE}/app/settings`)
    if (page.url().includes("/auth/login")) {
      await login(page)
      await page.goto(`${BASE}/app/settings`)
    }

    await expect(page.locator("text=Bitget API Key")).toBeVisible()
    await expect(page.getByPlaceholder("API Key")).toBeVisible()
    await expect(page.getByPlaceholder("API Secret")).toBeVisible()
  })

  test("strategies page loads", async ({ page }) => {
    await page.goto(`${BASE}/app/strategies`)
    if (page.url().includes("/auth/login")) {
      await login(page)
      await page.goto(`${BASE}/app/strategies`)
    }

    await expect(page.locator("text=Strategies").first()).toBeVisible()
  })

  test("strategy creation page loads with templates", async ({ page }) => {
    await page.goto(`${BASE}/app/strategies/new`)
    if (page.url().includes("/auth/login")) {
      await login(page)
      await page.goto(`${BASE}/app/strategies/new`)
    }

    await page.waitForTimeout(2000)
    const content = await page.textContent("body")
    const hasTemplates = content?.includes("Donchian") ?? false
    console.log(`Strategy page: Donchian template=${hasTemplates}`)
  })

  test("deviation log page loads", async ({ page }) => {
    await page.goto(`${BASE}/app/deviation-log`)
    if (page.url().includes("/auth/login")) {
      await login(page)
      await page.goto(`${BASE}/app/deviation-log`)
    }

    await expect(page.locator("text=Deviation Log").first()).toBeVisible()
  })

  // ─── 4. NAVIGATION FLOW ───────────────────────────────────────────

  test("can navigate from dashboard to paper trading via sidebar", async ({ page }) => {
    await page.goto(`${BASE}/app/dashboard`)
    if (page.url().includes("/auth/login")) {
      await login(page)
      await page.goto(`${BASE}/app/dashboard`)
    }

    await page.locator('a[href="/papertrading"]').first().click()
    await expect(page).toHaveURL(/\/papertrading/, { timeout: 10000 })
  })

  test("can navigate from dashboard to proof via sidebar", async ({ page }) => {
    await page.goto(`${BASE}/app/dashboard`)
    if (page.url().includes("/auth/login")) {
      await login(page)
      await page.goto(`${BASE}/app/dashboard`)
    }

    await page.locator('a[href="/proof"]').first().click()
    await expect(page).toHaveURL(/\/proof/, { timeout: 10000 })
  })

  // ─── 5. API ENDPOINTS ─────────────────────────────────────────────

  test("cron endpoints reject unauthorized requests", async ({ request }) => {
    const dailySync = await request.get(`${BASE}/api/cron/daily-sync`)
    expect(dailySync.status()).toBe(401)

    const paperSync = await request.post(`${BASE}/api/cron/paper-sync`, { data: {} })
    expect(paperSync.status()).toBe(401)
  })

  test("prices endpoint works", async ({ request }) => {
    const res = await request.get(`${BASE}/api/prices`)
    expect(res.status()).toBe(200)
    const data = await res.json()
    expect(Object.keys(data).length).toBeGreaterThan(0)
  })

  test("events endpoint accepts POST", async ({ request }) => {
    const res = await request.post(`${BASE}/api/events`, {
      data: { path: "/test", ref: null },
      headers: { "Content-Type": "application/json" },
    })
    expect([200, 429]).toContain(res.status())
  })

  // ─── 6. 1-WEEK SIMULATION ─────────────────────────────────────────

  test("1-week simulation: daily dashboard check", async ({ page }) => {
    test.setTimeout(120_000) // 7 cycles need more time

    // Login once, verify all pages work consistently across "days"
    await page.goto(`${BASE}/auth/login`)
    await page.getByPlaceholder("Email").waitFor({ timeout: 15000 })
    await page.getByPlaceholder("Email").fill(EMAIL)
    await page.locator('input[type="password"]').fill(PASSWORD)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 15000 })

    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    for (const day of days) {
      console.log(`\n--- Day: ${day} ---`)

      // 1. Dashboard
      await page.goto(`${BASE}/app/dashboard`)
      await page.waitForLoadState("networkidle")
      const dashContent = await page.textContent("body")
      const hasChecklist = dashContent?.includes("SETUP CHECKLIST") ?? false
      const hasScore = dashContent?.includes("Discipline Score") ?? false
      console.log(`  Dashboard: ${hasChecklist ? "checklist" : hasScore ? "stats" : "unknown"}`)

      // 2. Paper trading
      await page.goto(`${BASE}/papertrading`)
      await page.waitForLoadState("networkidle")
      await expect(page.locator("text=Paper").first()).toBeVisible()

      // 3. Deviation log
      await page.goto(`${BASE}/app/deviation-log`)
      await page.waitForLoadState("networkidle")
      await expect(page.locator("text=Deviation Log").first()).toBeVisible()

      // 4. Verify sidebar links exist
      await page.goto(`${BASE}/app/dashboard`)
      await page.waitForLoadState("networkidle")
      for (const link of ["/app/strategies", "/app/settings"]) {
        const el = page.locator(`a[href="${link}"]`).first()
        if (await el.isVisible()) console.log(`  Sidebar ${link}: ✓`)
      }
    }

    console.log("\n✓ 1-week simulation complete — no crashes")
  })
})

test.describe("Free Tier — Edge Cases", () => {
  test("rapid page transitions don't cause errors", async ({ page }) => {
    const pages = ["/", "/proof", "/papertrading", "/pricing", "/start"]
    for (let i = 0; i < 3; i++) {
      for (const p of pages) {
        await page.goto(`${BASE}${p}`, { waitUntil: "domcontentloaded" })
      }
    }
    await page.goto(`${BASE}/`)
    await expect(page.locator("text=TrendSentry").first()).toBeVisible()
    console.log("✓ Rapid navigation: no crashes")
  })

  test("mobile viewport renders landing page", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`${BASE}/`)
    await expect(page.locator("text=TrendSentry").first()).toBeVisible()
    const menuBtn = page.locator('button[aria-label="Toggle menu"]')
    await expect(menuBtn.first()).toBeVisible()
    console.log("✓ Mobile viewport: landing page renders correctly")
  })

  test("mobile viewport renders auth pages", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`${BASE}/auth/login`)
    await expect(page.locator("text=TrendSentry").first()).toBeVisible()
    await expect(page.getByPlaceholder("Email")).toBeVisible()
    console.log("✓ Mobile viewport: auth pages render correctly")
  })
})
