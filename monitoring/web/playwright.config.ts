import { defineConfig } from "@playwright/test"

// E2E melawan server lokal (DB Supabase produksi — spec HANYA boleh
// aksi tanpa efek samping: render, redirect, login gagal, resend kosong.
// DILARANG: signup submit / connect key / tulis data user nyata).
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:3000",
  },
  webServer: {
    command: "npm run start",
    port: 3000,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
