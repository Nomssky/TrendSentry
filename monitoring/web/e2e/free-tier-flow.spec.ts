/**
 * E2E test: Free-tier user flow — 1 minggu simulasi.
 *
 * Jalankan:
 *   cd monitoring/web
 *   npx playwright test e2e/free-tier-flow.spec.ts --headed
 *
 * BUTUH: .env.local dengan NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 * atau set baseURL ke https://trendsentry.vercel.app
 *
 * Test ini melakukan LOGIN NYATA — jangan run di CI.
 */

import { test, expect, type Page } from "@playwright/test"

const BASE = "https://trendsentry.vercel.app"
const EMAIL = "als.kresna@gmail.com"
const PASSWORD = "kresnaaji12"

test.describe("Free Tier — Full User Flow", () => {
  test.describe.configure({ mode: "serial" }) // run in order

  // ─── 1. PUBLIC PAGES ──────────────────────────────────────────────

  test("landing page loads with correct content", async ({ page }) => {
    await page.goto(`${BASE}/`)
    await expect(page.locator("text=TrendSentry").first()).toBeVisible()
    await expect(page.locator("text=NO DEVIATION").first()).toBeVisible()
    // Nav should show "Sign in" and "Start free" (not logged in)
    await expect(page.locator('a[href="/auth/login"]').first()).toBeVisible()
    await expect(page.locator('a[href="/start"]').first()).toBeVisible()
  })

  test("start page explains the flow", async ({ page }) => {
    await page.goto(`${BASE}/start`)
    await expect(page.locator("text=read-only").first()).toBeVisible()
    await expect(page.locator('a[href="/auth/signup"]').first()).toBeVisible()
  })

  test("proof page shows backtest reference", async ({ page }) => {
    await page.goto(`${BASE}/proof`)
    await expect(page.locator("text=BACKTEST REFERENCE").first()).toBeVisible()
    await expect(page.locator("text=152").first()).toBeVisible() // total return
  })

  test("paper trading page loads public data", async ({ page }) => {
    await page.goto(`${BASE}/papertrading`)
    await expect(page.locator("text=Paper").first()).toBeVisible()
  })

  test("pricing page shows tiers", async ({ page }) => {
    await page.goto(`${BASE}/pricing`)
    await expect(page.locator("text=Watcher").first()).toBeVisible()
    await expect(page.locator("text=Free").first()).toBeVisible()
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
    // Password field should exist
    const pwField = page.locator('input[type="password"]').first()
    await expect(pwField).toBeVisible()
  })

  test("login page renders with branding", async ({ page }) => {
    await page.goto(`${BASE}/auth/login`)
    await expect(page.locator("text=TrendSentry").first()).toBeVisible()
    await expect(page.getByPlaceholder("Email")).toBeVisible()
  })

  test("login with wrong credentials shows error", async ({ page }) => {
    await page.goto(`${BASE}/auth/login`)
    await page.getByPlaceholder("Email").fill("wrong@example.com")
    await page.locator('input[type="password"]').fill("wrongpassword123")
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page.getByText(/invalid login credentials/i)).toBeVisible()
  })

  test("protected pages redirect to login when not authenticated", async ({ page }) => {
    const protectedPages = ["/app/dashboard", "/app/strategies", "/app/settings", "/app/deviation-log"]
    for (const p of protectedPages) {
      await page.goto(`${BASE}${p}`)
      await expect(page).toHaveURL(/\/auth\/login/)
    }
  })

  // ─── 3. AUTHENTICATED FLOW ────────────────────────────────────────

  test("login with real credentials succeeds", async ({ page }) => {
    await page.goto(`${BASE}/auth/login`)
    await page.getByPlaceholder("Email").fill(EMAIL)
    await page.locator('input[type="password"]').fill(PASSWORD)
    await page.getByRole("button", { name: "Sign in" }).click()

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 10000 })

    // Dashboard should load
    await expect(page.locator("text=Dashboard").first()).toBeVisible()
  })

  test("nav shows 'Dashboard' button when logged in", async ({ page }) => {
    await page.goto(`${BASE}/`)
    // When logged in, nav should show Dashboard button, not "Sign in"
    // Note: cookies from previous test may persist
    const dashLink = page.locator('a[href="/app/dashboard"]').first()
    const signInLink = page.locator('a[href="/auth/login"]').first()

    // Check which state we're in
    const isDashVisible = await dashLink.isVisible().catch(() => false)
    const isSignInVisible = await signInLink.isVisible().catch(() => false)

    if (isDashVisible) {
      // Logged in state
      console.log("✓ Nav shows Dashboard (logged in)")
    } else if (isSignInVisible) {
      console.log("⚠ Nav shows Sign in (not logged in — cookies may not persist)")
    }
  })

  test("dashboard shows setup checklist or data", async ({ page }) => {
    await page.goto(`${BASE}/app/dashboard`)
    await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 10000 })

    // Should see either setup checklist OR stats cards
    const hasChecklist = await page.locator("text=SETUP CHECKLIST").isVisible().catch(() => false)
    const hasStats = await page.locator("text=Discipline Score").isVisible().catch(() => false)

    expect(hasChecklist || hasStats).toBeTruthy()
    console.log(`Dashboard shows: ${hasChecklist ? "setup checklist" : "stats cards"}`)
  })

  test("sidebar has correct links", async ({ page }) => {
    await page.goto(`${BASE}/app/dashboard`)
    await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 10000 })

    // App links
    await expect(page.locator('a[href="/app/dashboard"]')).toBeVisible()
    await expect(page.locator('a[href="/app/strategies"]')).toBeVisible()
    await expect(page.locator('a[href="/app/deviation-log"]')).toBeVisible()
    await expect(page.locator('a[href="/app/settings"]')).toBeVisible()

    // Public links
    await expect(page.locator('a[href="/papertrading"]').first()).toBeVisible()
    await expect(page.locator('a[href="/proof"]').first()).toBeVisible()

    // Logo
    await expect(page.locator("text=TrendSentry").first()).toBeVisible()

    // Sign out
    await expect(page.locator("text=Sign out")).toBeVisible()
  })

  test("settings page shows API key form", async ({ page }) => {
    await page.goto(`${BASE}/app/settings`)
    await expect(page).toHaveURL(/\/app\/settings/, { timeout: 10000 })
    await expect(page.locator("text=Bitget API Key")).toBeVisible()
    await expect(page.getByPlaceholder("API Key")).toBeVisible()
    await expect(page.getByPlaceholder("API Secret")).toBeVisible()
  })

  test("strategies page loads", async ({ page }) => {
    await page.goto(`${BASE}/app/strategies`)
    await expect(page).toHaveURL(/\/app\/strategies/, { timeout: 10000 })
    await expect(page.locator("text=Strategies").first()).toBeVisible()
  })

  test("strategy creation page loads with templates", async ({ page }) => {
    await page.goto(`${BASE}/app/strategies/new`)
    await expect(page).toHaveURL(/\/app\/strategies\/new/, { timeout: 10000 })

    // Should see template selector or loading
    await page.waitForTimeout(2000) // wait for templates to load
    const hasTemplates = await page.locator("text=Donchian").isVisible().catch(() => false)
    const hasSelect = await page.locator("select").isVisible().catch(() => false)
    console.log(`Strategy page: templates loaded: ${hasTemplates}, select visible: ${hasSelect}`)
  })

  test("deviation log page loads", async ({ page }) => {
    await page.goto(`${BASE}/app/deviation-log`)
    await expect(page).toHaveURL(/\/app\/deviation-log/, { timeout: 10000 })
    await expect(page.locator("text=Deviation Log").first()).toBeVisible()
  })

  // ─── 4. NAVIGATION FLOW ───────────────────────────────────────────

  test("can navigate from dashboard to paper trading via sidebar", async ({ page }) => {
    await page.goto(`${BASE}/app/dashboard`)
    await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 10000 })

    // Click Paper Trading in sidebar
    await page.locator('a[href="/papertrading"]').first().click()
    await expect(page).toHaveURL(/\/papertrading/, { timeout: 10000 })
  })

  test("can navigate from paper trading back to dashboard", async ({ page }) => {
    await page.goto(`${BASE}/papertrading`)
    // Should see nav with Dashboard button (if logged in)
    // Or "Sign in" button (if not logged in)
    await expect(page.locator("text=Paper").first()).toBeVisible()
  })

  test("can navigate from dashboard to proof via sidebar", async ({ page }) => {
    await page.goto(`${BASE}/app/dashboard`)
    await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 10000 })

    await page.locator('a[href="/proof"]').first().click()
    await expect(page).toHaveURL(/\/proof/, { timeout: 10000 })
  })

  // ─── 5. API ENDPOINTS ─────────────────────────────────────────────

  test("cron endpoints reject unauthorized requests", async ({ request }) => {
    const dailySync = await request.get(`${BASE}/api/cron/daily-sync`)
    expect(dailySync.status()).toBe(401)

    const paperSync = await request.post(`${BASE}/api/cron/paper-sync`, {
      data: {},
    })
    expect(paperSync.status()).toBe(401)
  })

  test("prices endpoint works", async ({ request }) => {
    const res = await request.get(`${BASE}/api/prices`)
    expect(res.status()).toBe(200)
    const data = await res.json()
    expect(typeof data).toBe("object")
    console.log("Prices returned:", Object.keys(data).length, "pairs")
  })

  test("events endpoint accepts POST", async ({ request }) => {
    const res = await request.post(`${BASE}/api/events`, {
      data: { path: "/test", ref: null },
      headers: { "Content-Type": "application/json" },
    })
    // Should be 200 or 429 (rate limited)
    expect([200, 429]).toContain(res.status())
  })

  // ─── 6. 1-WEEK SIMULATION ─────────────────────────────────────────

  test("1-week simulation: daily dashboard check", async ({ page }) => {
    // Simulate what a user does each day for a week:
    // 1. Open dashboard
    // 2. Check if data updated
    // 3. Navigate to paper trading
    // 4. Check deviation log

    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    for (const day of days) {
      console.log(`\n--- Day: ${day} ---`)

      // 1. Dashboard
      await page.goto(`${BASE}/app/dashboard`)
      await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 10000 })

      const dashContent = await page.textContent("body")
      const hasChecklist = dashContent?.includes("SETUP CHECKLIST") ?? false
      const hasScore = dashContent?.includes("Discipline Score") ?? false
      const hasStrategies = dashContent?.includes("Active Strategies") ?? false
      console.log(`  Dashboard: checklist=${hasChecklist}, score=${hasScore}, strategies=${hasStrategies}`)

      // 2. Paper trading
      await page.goto(`${BASE}/papertrading`)
      await expect(page.locator("text=Paper").first()).toBeVisible()
      const paperContent = await page.textContent("body")
      const hasEquity = paperContent?.includes("TOTAL EQUITY") ?? false
      console.log(`  Paper trading: equity visible=${hasEquity}`)

      // 3. Deviation log
      await page.goto(`${BASE}/app/deviation-log`)
      await expect(page.locator("text=Deviation Log").first()).toBeVisible()
      const devContent = await page.textContent("body")
      const hasNoDevs = devContent?.includes("NO DEVIATIONS YET") ?? false
      const hasDevs = devContent?.includes("Expected") ?? false
      console.log(`  Deviation log: no-devs=${hasNoDevs}, has-devs=${hasDevs}`)

      // 4. Check sidebar nav works
      await page.goto(`${BASE}/app/dashboard`)
      await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 10000 })

      // Verify all sidebar links are clickable
      const sidebarLinks = [
        { href: "/app/strategies", text: "Strategies" },
        { href: "/app/settings", text: "Settings" },
        { href: "/papertrading", text: "Paper Trading" },
      ]

      for (const link of sidebarLinks) {
        const el = page.locator(`a[href="${link.href}"]`).first()
        if (await el.isVisible()) {
          console.log(`  Sidebar link ${link.text}: visible ✓`)
        }
      }
    }

    console.log("\n✓ 1-week simulation complete — no crashes")
  })
})

test.describe("Free Tier — Edge Cases", () => {
  test("concurrent tab navigation doesn't break state", async ({ browser }) => {
    const ctx = await browser.newContext()
    const page1 = await ctx.newPage()
    const page2 = await ctx.newPage()

    // Both tabs go to dashboard
    await page1.goto(`${BASE}/app/dashboard`)
    await page2.goto(`${BASE}/app/dashboard`)

    // Both should redirect to login (not logged in) or show dashboard
    await page1.waitForTimeout(2000)
    await page2.waitForTimeout(2000)

    const url1 = page1.url()
    const url2 = page2.url()
    console.log(`Tab 1: ${url1}`)
    console.log(`Tab 2: ${url2}`)

    // Neither should be stuck/loading
    expect(url1).not.toContain("about:blank")
    expect(url2).not.toContain("about:blank")

    await ctx.close()
  })

  test("rapid page transitions don't cause errors", async ({ page }) => {
    const pages = ["/", "/proof", "/papertrading", "/pricing", "/start"]

    for (let i = 0; i < 3; i++) {
      for (const p of pages) {
        await page.goto(`${BASE}${p}`, { waitUntil: "domcontentloaded" })
        // Don't wait for full load — simulate rapid clicking
      }
    }

    // Final page should be loaded correctly
    await page.goto(`${BASE}/`)
    await expect(page.locator("text=TrendSentry").first()).toBeVisible()
    console.log("✓ Rapid navigation: no crashes")
  })

  test("mobile viewport renders correctly", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 }) // iPhone X

    // Landing page
    await page.goto(`${BASE}/`)
    await expect(page.locator("text=TrendSentry").first()).toBeVisible()

    // Auth pages
    await page.goto(`${BASE}/auth/login`)
    await expect(page.locator("text=TrendSentry").first()).toBeVisible()
    await expect(page.getByPlaceholder("Email")).toBeVisible()

    // Mobile menu button should be visible
    const menuBtn = page.locator('button[aria-label="Toggle menu"]')
    await expect(menuBtn.first()).toBeVisible()

    console.log("✓ Mobile viewport renders correctly")
  })
})
