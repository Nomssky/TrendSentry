# SECURITY AUDIT REPORT — TrendSentry (repository publik)

> Tanggal pembuatan: 2026-10-17  
> Cakupan: tracked files, riwayat Git (terbatas), konfigurasi, kode autentikasi/otorisasi.  
> Tidak dilakukan pentest destruktif, tidak digunakan akun pengguna lain, tidak dicetak nilai secret.  
> Catatan: "Tidak ditemukan secret dalam pemeriksaan terbuka" **tidak sama dengan** "aman secara absolut."

---

## 1. Ringkasan temukan

| Severity | Jumlah |
|---|---|
| Critical | 0 |
| High | 0 |
| Medium | 1 |
| Low | 2 |
| Informational | 2 |

---

## 2. Temuan detail

### M1 — Medium | Riwayat Git masih memuat kredensial E2E lama | Perlu rotasi oleh owner

- **Location:** riwayat Git (commit sebelum `de3f7eb` "[Phase 2C-1] remove hardcoded E2E credentials"), file `monitoring/web/e2e/free-tier-flow.spec.ts`.
- **Evidence:** `git log --all -p -S'@gmail.com'` menunjukkan commit `de3f7eb` menghapus hardcoded E2E credentials. Commit saat ini `e2e/free-tier-flow.spec.ts` sudah fail-closed (baca dari `process.env.E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD`, tidak ada default/dummy, gagal dengan pesan jelas bila belum di-export).
- **Impact:** Kredensial lama **belum dihapus dari riwayat Git** (tidak dilakukan force-push, sesuai aturan). Jika kredensial tersebut pernah nyata dan masih aktif, risiko eksposur tetap melalui `git log`/`git clone --depth` riwayat penuh.
- **Remediation:** (owner) Jika kredensial lama nyata dan aktif → rotasi melalui penyedia terkait (Supabase Auth / email test). Tidak melakukan force-push untuk membersihkan riwayat tanpa persetujuan eksplisit owner.
- **Verification:** `git log --all -p -S'@gmail.com'` menunjukkan penghapusan sudah ada di HEAD; file saat ini tidak mencetak nilai secret dan fail-closed tanpa env.

### L2 — Low | `.env` lokal ada di working tree tetapi tidak ter-commit | Terlindungi

- **Location:** `.env` (root) dan `.env.local` (monitoring/web), keduanya gitignored.
- **Evidence:** `git check-ignore -v .env .env.local` cocok pola `.gitignore` baris 8–9 dan 45 (web). `.env` **tidak** ter-track (`git ls-files --error-unmatch .env` gagal). `.env.example` (ter-track) hanya berisi placeholder/kunci nama variabel, tanpa nilai sebenarnya.
- **Impact:** Rendah selama `.env` tetap tidak di-commit. Jika seseorang secara tidak sengaja `git add -f .env`, secret akan masuk riwayat.
- **Remediation:** Tidak perlu perubahan kode. Pertahankan `.gitignore`. Saat menambah secret baru, pastikan pola `.env.*` sudah cakup.
- **Verification:** `git status` bersih, `.env` tidak ter-track.

### L1 — Low | Informasi penggunaan GitHub Actions secrets tidak dapat diverifikasi langsung | Keterbatasan akses

- **Location:** `.github/workflows/paper-trading.yml`, `run-deployment.yml`, `trendsentry-daily-sync.yml`.
- **Evidence:** Workflow mengacu pada secrets `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `CRON_SECRET`, `TREND_SENTRY_CONFIG_TOKENS`, dan vars `TREND_SENTRY_DEPLOYMENT_IDS`, `TREND_SENTRY_HOST`. Nilai secret **tidak bisa** ditelusuli tanpa akses GitHub repository settings.
- **Impact:** Tidak dapat memastikan secret tidak bocor lewat log workflow. `paper-trading.yml` dan `run-deployment.yml` masing-masing punya step "Notify Telegram on failure" (`if: failure()`) yang *tidak* mencetak token, hanya `run_id`.
- **Remediation:** Owner memastikan secret disimpan di GitHub Secrets (bukan dalam workflow/file), dan menambahkan step notifikasi yang tidak menyalin secret ke log.
- **Verification:** Kode workflow tidak mencetak secret ke stdout/log. Akses nilai secret memerlukan login GitHub owner (diluar cakupan agen).

### I1 — Informational | E2E spec fail-closed dan dokumentasi peringatan riwayat | Baik

- **Location:** `monitoring/web/e2e/free-tier-flow.spec.ts`.
- **Evidence:** Header file menekankan kredensial **TIDAK boleh ada di source**, baca dari `process.env`, fungsi `authCredentials()` melempar bila env belum di-set, pesan error hanya menyebut **nama variabel** (tidak nilainya). Komentar mencatat histori git lama masih memuat kredensial (lihat audit PHASE2C).
- **Verification:** Dikonfirmasi fail-closed; tidak ada nilai dummy/diproses.

### I2 — Informational | GitHub Actions `git pull --rebase --autostash` + push DB state | Pola operasi, risiko race

- **Location:** `.github/workflows/paper-trading.yml` step "Commit DB state".
- **Evidence:** Setiap run paper-trading melakukan `git pull --rebase --autostash origin main`, `git add -f db/paper_trading.db`, commit, `git push`. Workflow menggunakan `concurrency: group: paper-trading, cancel-in-progress: false`.
- **Impact:** `cancel-in-progress: false` berarti run yang salang-timpa (overlapping) tidak dibatalkan — dua commit DB berturut-turut bisa menimpa satu sama lain jika schedule dan `workflow_dispatch` bertemu pada waktu yang sama. Risiko state tidak konsisten (commit DB yang lebih lama menimpa yang lebih baru).
- **Remediation:** Pertimbangkan `cancel-in-progress: true` atau mutex, atau verifikasi bahwa cron 01:00 UTC dan dispatch tidak bentrok. Ini adalah rekomendasi operasi, bukan bug terkonfirmasi.
- **Verification:** Konfigurasi concurrency terlihat dalam file workflow; tidak ada overlap yang tercatat dalam data lokal.

---

## 3. Area yang diverifikasi (tidak menemukan masalah)

| Area | Hasil verifikasi |
|---|---|
| Hardcoded credentials/secrets dalam tracked files | Tidak ditemukan (hanya `env(...)` referensi dan fixture uji jelas seperti `"token-salah"`, `"contoh-token-plaintext"`) |
| `.env`, `.env.local`, file database sensitif di-commit | `.env`/`.env.local` gitignored & tidak ter-track; `db/*.db` gitignored (kecuali `db/paper_trading.db` yang di-commit sengaja sebagai backup — diketahui dan accepted risk per ARCHITECTURE.md) |
| GitHub Actions secrets dalam kode | Tidak ada nilai secret hardcode di workflow, hanya referensi `${{ secrets.X }}` |
| Endpoint exchange produk web (read-only) | `lib/bitget.ts` allowlist tepat 2 endpoint read-only (`/api/v2/spot/account/assets`, `/api/v2/spot/trade/fills`); tidak ada order/transfer/withdraw |
| API key user (enkripsi) | AES-GCM + IV acak, PBKDF2 100k, decode server-side only di cron/verify route |
| Supabase RLS | Semua tabel (termasuk `deployments`, `deployment_config_versions`) aktif RLS + kebijakan pemilik; `getDashboardData(id)` kunci `user_id` sebelum ambil data; 404 identik untuk "tidak ada" vs "bukan milikmu" |
| Deployment token | SHA-256 hash disimpan, plaintext keluar sekali via `POST /api/deployments`, `Authorization: Bearer` timing-safe compare, id tidak dikenal → 401 (anti-enumeration) |
| Logging error tidak bocorkan secret | `crypto.timingEqual`, hash tidak meninggalkan server, token tidak di URL/query/log/localStorage |
| Akses lintas-user strategi/deployment/trade | RLS + `eq(user_id, ...)` dua lapis; deployment/config version dilindungi service role tanpa policy INSERT langsung dari browser |

---

## 4. Risiko yang belum terselesaikan & tindakan owner

| # | Tindakan | Pemilik | Prioritas |
|---|---|---|---|
| 1 | Rotasi kredensial E2E lama jika masih aktif (riwayat Git tidak dibersihkan paksa) | Owner | Medium |
| 2 | Verifikasi nilai GitHub Secrets tidak bocor ke log workflow (tidak dapat diverifikasi agen tanpa akses) | Owner | Medium |
| 3 (rekomendasi) | Evaluasi `cancel-in-progress` pada `paper-trading.yml` untuk menghindari overlap commit DB | Owner | Low |

---

## 5. Pernyataan

Tidak ada kredensial produksi yang dicetak, diputar, atau dihapus dalam audit ini. Temuan M1 memerlukan perhatian owner terkait rotasi jika kredensial riwayat masih aktif. Semua temuan lain dalam batas risiko yang diterima atau telah terlindungi oleh kontrol kode.
