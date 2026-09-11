import { test, expect } from "@playwright/test"

// Alur confirm-email (bug 2026-09-11): tanpa code / code basi harus
// mendarat di login dengan pesan jelas — bukan halaman mati.
test("callback tanpa code redirect ke login dengan pesan", async ({ page }) => {
  await page.goto("/auth/callback")
  await expect(page).toHaveURL(/\/auth\/login\?error=/)
  await expect(page.getByText(/belum dikonfirmasi|confirmation|confirm/i).first()).toBeVisible()
})

test("callback code basi redirect ke login dengan pesan", async ({ page }) => {
  await page.goto("/auth/callback?code=bogus-code-yang-tidak-valid")
  await expect(page).toHaveURL(/\/auth\/login\?error=/)
})

test("halaman proteksi tanpa login redirect ke login", async ({ page }) => {
  await page.goto("/app/dashboard")
  await expect(page).toHaveURL(/\/auth\/login/)
})

test("signup render + field wajib", async ({ page }) => {
  await page.goto("/auth/signup")
  await expect(page.getByPlaceholder("Email")).toBeVisible()
  await expect(page.getByPlaceholder("Password (min 6)")).toBeVisible()
  // Submit kosong diblokir browser (required) — TIDAK submit data nyata.
  const emailRequired = await page.getByPlaceholder("Email").getAttribute("required")
  expect(emailRequired).not.toBeNull()
})

test("login kredensial salah tampilkan error (tanpa efek samping)", async ({ page }) => {
  await page.goto("/auth/login")
  await page.getByPlaceholder("Email").fill("tidak-ada-@example.com")
  await page.getByPlaceholder("Password").fill("salah-salah-123")
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page.getByText(/invalid login credentials/i)).toBeVisible()
})

test("kirim ulang tanpa email tampilkan panduan", async ({ page }) => {
  await page.goto("/auth/login")
  await page.getByRole("button", { name: "Kirim ulang email konfirmasi" }).click()
  await expect(page.getByText(/isi email dulu/i)).toBeVisible()
})

test("halaman start jelaskan tier read-only", async ({ page }) => {
  await page.goto("/start")
  await expect(page.getByText(/read-only/i).first()).toBeVisible()
})
