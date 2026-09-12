# Audit Menyeluruh — TrendSentry

Tanggal: 2026-09-12
Cakupan: Python engine (backtest, paper, risk, llm, scripts), web Next.js (API, lib, auth, UI), Supabase migrations + RLS (via MCP), GitHub Actions, deploy scripts/Docker.
Metode: pembacaan penuh file + `git log` untuk kebocoran secret + Supabase security advisor + `pytest` (54 passed).
Status per 2026-09-12: **P0 selesai & terverifikasi; P1 selesai kecuali rotasi secret yang butuh dashboard (lihat bagian "Status Perbaikan").** Temuan P2/P3 masih terbuka.

Legenda: **P0** = wajib segera (uang/keamanan), **P1** = tinggi, **P2** = sedang, **P3** = rendah/hygiene.

---

## Status Perbaikan

### P0 — SELESAI ✅
- **P0-1** cron auth bypass: kedua route fail-closed (500) bila `CRON_SECRET` kosong. Diverifikasi live: valid→200, `Bearer undefined`→401, salah→401.
- **P0-2** RLS `profiles`: policy `profiles_self` (FOR ALL) diganti `profiles_select_self` (SELECT saja). Diterapkan ke remote; tulis billing hanya service role.
- **P0-3** kas negatif backtest: `cost` dihitung ulang setelah clamp `units`. Test regresi `tests/test_backtest_cash.py` (terbukti gagal tanpa fix). Angka backtest resmi tidak berubah.
- Sinkronisasi env: `CRON_SECRET` (lokal=Vercel=GitHub), `ENCRYPTION_KEY`/`SERVICE_ROLE_KEY` disamakan ke Vercel. Deploy Ready.

### P1 — SELESAI (kecuali rotasi) 
- **P1-1** `.dockerignore` ditambahkan (secret, `node_modules`, `.next`, DB tidak masuk image).
- **P1-2** query kolom hantu dibuang (`user_trades.exit_price`, `profiles.equity`); `dailyTrades` dihitung dari DB; tidak ada lagi `accountEquity ?? 1000`.
- **P1-3** webhook Stripe: tolak `payment_status=unpaid`, handle `invoice.paid` + `customer.subscription.updated` (renewal), metadata diteruskan ke subscription. Idempotency key palsu (`Date.now()`) dihapus.
- **P1-4** `daily-sync` tidak lagi menautkan semua fill ke `strategies[0]`; atribusi hanya bila tepat 1 strategi aktif.
- **P1-5** `listUsers()` dipaginasi (1000/halaman) sampai habis.
- **P1-6** verifikasi izin API key: Bitget tidak menyediakan endpoint permission & dokumentasi tidak menjamin endpoint trade menolak key read-only. Karena itu klaim "read-only enforced" dihapus dan diganti instruksi eksplisit di UI. **Enforcement sejati tidak mungkin tanpa key nyata** — jangan tambahkan probe yang bisa false-reject.
- **P1-7** Rotasi secret: `CRON_SECRET` + `ENCRYPTION_KEY` **sudah dirotasi** (lokal + Vercel + GitHub untuk CRON; Vercel untuk ENCRYPTION), terverifikasi. Password policy naik ke min 10 + huruf besar/kecil/angka. `SUPABASE_SERVICE_ROLE_KEY` **tidak bisa** diganti `sb_secret_` (project ini menolak key new-style di data plane — sudah diuji; legacy `service_role` tetap dipakai). Token Telegram & rotasi service_role legacy: manual via Dashboard/@BotFather. Key uji/`__probe__` sudah dibersihkan.

### Sisa manual (dashboard, tidak bisa via CLI/MCP)
> Panduan langkah-demi-langkah + perintah verifikasi: lihat **`SECURITY-ACTIONS.md`**.
1. **Leaked Password Protection**: TIDAK BISA di plan Free (HTTP 402, butuh Pro) — menu sengaja tak muncul. Mitigasi pengganti sudah aktif: `password_min_length=10` + wajib huruf besar/kecil/angka (via Management API).
2. **Rotasi `SUPABASE_SERVICE_ROLE_KEY`**: project menolak `sb_secret_` new-style (sudah diuji: REST/Auth → 401, padahal publishable new-style → 200). Satu-satunya cara = rotate **JWT secret** di Dashboard → Settings → API (mengubah anon+service_role legacy, memaksa semua user logout). Detail di `SECURITY-ACTIONS.md` §4.
3. **Rotasi token Telegram**: @BotFather → `/mybots` → API Token → Revoke, update GitHub Secrets + `.env`. Verifikasi: `./venv/bin/python monitoring/telegram_alert.py`.
4. **Rotasi `ENCRYPTION_KEY`**: sudah dilakukan; jangan ulangi setelah ada `user_api_keys` terenkripsi tanpa re-enkripsi.

---

## Ringkasan Eksekutif

Sistem ini secara desain sudah disiplin (stop-loss wajib, long-only, tidak ada martingale, idempotensi candle, capex read-only Bitget). Tapi ada **3 hal yang bisa langsung merugikan**:

1. **Auth bypass cron lewat `CRON_SECRET` kosong** → string `"Bearer undefined"` valid. Endpoint `daily-sync` mendekripsi API key semua user; `paper-sync` menulis ulang data publik.
2. **Privilege escalation via RLS `profiles`** → user login bisa `UPDATE profiles SET plan='live_assist'` langsung pakai publishable key, melewati Stripe.
3. **Bug kas negatif di backtest** (`cash -= cost` pakai `cost` basi) → equity curve & metrik yang jadi dasar seluruh keputusan strategi tidak valid.

Ditambah temuan P1: tidak ada `.dockerignore` (secret bisa ikut ter-bake ke image), kolom yang di-query tidak ada di schema (`user_trades.exit_price`, `profiles.equity`) sehingga cek deviasi tidak pernah jalan, dan webhook Stripe tidak aman untuk renewal.

---

## P0 — Kritis

### P0-1. Cron auth bypass saat `CRON_SECRET` tidak diset
- `monitoring/web/app/api/cron/daily-sync/route.ts:79-83`
- `monitoring/web/app/api/cron/paper-sync/route.ts:21-25`

```ts
const expected = `Bearer ${process.env.CRON_SECRET}`
```

Kalau env tidak ada, string literal menjadi `Bearer undefined`. Penyerang (source publik/hafal route) cukup mengirim `Authorization: Bearer undefined` → lolos `timingSafeEqual`.

Dampak:
- `daily-sync`: dekripsi `api_key_enc` semua user, panggil Bitget, insert trade + deviasi. Kebocoran tak langsung + biaya API.
- `paper-sync`: upsert `paper_positions`/`paper_signals`/`paper_meta` **tanpa batas** (service role), bisa mengubah data publik yang dipakai marketing/proof.

Fix: fail-fast kalau `CRON_SECRET` kosong sebelum membentuk `expected`.
```ts
const secret = process.env.CRON_SECRET
if (!secret) return NextResponse.json({ error: "server misconfigured" }, { status: 500 })
```

### P0-2. RLS `profiles` bisa dipakai naikkan plan sendiri
- `supabase/migrations/20260909120000_remote_schema.sql:178-180`

```sql
create policy "profiles_self" on public.profiles
  for all to authenticated
  using ((select auth.uid()) = id);
```

`FOR ALL` tanpa `WITH CHECK` → klausa `USING` dipakai juga sebagai `WITH CHECK`. User yang login (publishable key yang sama tertanam di web) bisa langsung:
`PATCH /rest/v1/profiles?id=eq.<uid>` body `{ "plan": "live_assist" }`.

Dampak: bypass billing penuh; juga bisa memalsukan `stripe_customer_id`. (`live_assist` memang belum dibuka, tapi tetap eskalasi hak akses.)

Fix: user hanya boleh baca; kolom billing hanya boleh diubah service role.
```sql
drop policy "profiles_self" on public.profiles;
create policy "profiles_select_self" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
-- tidak ada policy update/insert untuk authenticated; service role bypass RLS
```
Kalau butuh user update profil non-billing, batasi kolom via trigger/`WITH CHECK` + cegah perubahan `plan`, `stripe_customer_id`, `plan_expires_at`.

### P0-3. Bug kas negatif di backtest (metrik strategi tidak valid)
- `backtest/run_backtest.py:132-136`

```python
cost = units * entry_price * (1 + fee)
if cost > cash:
    units = (cash / (entry_price * (1 + fee))) if entry_price > 0 else 0.0
if units > 0:
    cash -= cost          # <-- cost BELUM dihitung ulang
```

Setelah `units` di-clamp, `cost` masih nilai lama (lebih besar) → `cash` bisa jadi negatif. Ini terjadi saat modal sebagian besar sudah ter-deploy (realistis di multi-posisi). `equity` berikutnya ikut terdistorsi → position sizing & seluruh metrik (`total_return`, `CAGR`, Sharpe, max DD) yang dipublikasikan di `backtest/reports/` **tidak bisa dipercaya**.

Bukti inkonsistensi: versi live sudah benar (`paper_trading/live_signal.py:471-474` menghitung ulang `cost`). Backtest tidak.

Fix:
```python
if cost > cash:
    units = cash / (entry_price * (1 + fee)) if entry_price > 0 else 0.0
    cost = units * entry_price * (1 + fee)
```

Catatan: angka referensi `monitoring/web/lib/reference.ts` & `scripts/compare_live_vs_backtest.py` berasal dari backtest ini — kalau angka lama sudah dipakai untuk keputusan Fase 2, harus di-re-run setelah fix.

---

## P1 — Tinggi

### P1-1. Tidak ada `.dockerignore` → secret ter-bake ke image build
- `deploy/Dockerfile.web:6` (`COPY monitoring/web/ ./`)
- `deploy/Dockerfile.engine:7-10`
- Konfirmasi: tidak ada file `.dockerignore` di repo.

`monitoring/web/.env.local` (berisi `SUPABASE_SERVICE_ROLE_KEY`, `ENCRYPTION_KEY`, `CRON_SECRET`, `VERCEL_OIDC_TOKEN`) dan `.env` ikut dikirim ke Docker daemon dan masuk layer build stage. Walau layer final hanya menyalin `standalone`, image build/cache yang di-push ke registry memuat secret. Juga `node_modules` host bisa menimpa hasil `npm ci` (`COPY` setelah `RUN npm ci`).

Fix: buat `.dockerignore` di root (dan/atau `monitoring/web/`):
```
.git
**/.env
**/.env.*
!**/.env.example
**/node_modules
**/.next
db/*.db*
```
Dan tambahkan `npm ci` setelah COPY bila perlu, atau pisahkan COPY.

### P1-2. Query ke kolom yang tidak ada → cek konteks deviasi selalu gagal
- `monitoring/web/app/api/trades/route.ts:93-98`

```ts
supabase.from("user_trades").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("exit_price", null),
supabase.from("profiles").select("equity").eq("id", user.id).single(),
```

Schema `user_trades` (`20260909120000_remote_schema.sql:60-73`) **tidak punya `exit_price`**; `profiles` (`:19-23` + stripe migration) **tidak punya `equity`**. Keduanya error → `openCount` null dan `accountEquity` fallback `1000` selamanya.

Akibat: rule `max_concurrent` tidak pernah terpicu; rule `position_sizing` selalu dihitung terhadap equity 1000 (salah kalau user beda modal); discipline score jadi tidak akurat.

Fix: tentukan model data posisi/equity yang benar (kolom baru atau tabel `user_positions`), atau hapus rule yang tidak punya data. Jangan biarkan fallback diam-diam.

### P1-3. Webhook Stripe tidak menangani renewal/expiry, dan grant plan tanpa cek `payment_status`
- `monitoring/web/app/api/webhooks/stripe/route.ts:28-61`

- Hanya `checkout.session.completed` dan `subscription.deleted`. Tidak ada `invoice.paid`/`customer.subscription.updated` → `plan_expires_at` tidak pernah diperbarui saat renewal, dan plan tetap aktif walau pembayaran gagal.
- `checkout.session.completed` bisa datang dengan `payment_status = "unpaid"` (metode async). Kode langsung set plan tanpa cek.

Fix: handle `invoice.paid` + `customer.subscription.updated`; pada `checkout` cek `session.payment_status === "paid"` (atau tunggu `invoice.paid`).

### P1-4. `daily-sync` asal menggantung semua trade ke strategi pertama
- `monitoring/web/app/api/cron/daily-sync/route.ts:142-160`

```ts
const strategyId = strategies?.[0]?.id ?? null
...
strategy_id: strategyId,
```

Setiap fill Bitget user ditautkan ke strategi pertama saja, padahal deviasi dievaluasi terhadap **semua** strategi. Trade→strategy mapping salah → discipline score per strategi menyesatkan.

Fix: hentikan auto-attach ke `strategies[0]`; biarkan `strategy_id = null` sampai ada mekanisme pemetaan, atau buat aturan eksplisit.

### P1-5. `daily-sync` tidak paginasi `listUsers()`
- `monitoring/web/app/api/cron/daily-sync/route.ts:87`

`supabase.auth.admin.listUsers()` default hanya halaman pertama (50 user). User ke-51+ tidak pernah disinkronkan tanpa error.

Fix: loop `listUsers({ page, perPage: 1000 })` sampai habis.

### P1-6. API key Bitget diverifikasi "read" tapi tidak dijamin read-only
- `monitoring/web/lib/bitget.ts:26-45`

Verifikasi hanya memanggil endpoint read (`/spot/account/assets`). Key dengan izin **trade/withdraw** juga lolos. Komentar/pesan UI mengklaim "read-only", padahal tidak ada yang menegakkan. Key ini tersimpan terenkripsi lalu dipakai `daily-sync`.

Fix: verifikasi izin via endpoint permissions Bitget, atau dokumentasikan bahwa user wajib membuat key read-only dan jangan mengklaim enforced. Minimal: tolak dengan pesan tidak menyesatkan.

### P1-7. Secret plaintext di working tree
- `.env:13-14` (token Telegram asli), `.env.local` root & `monitoring/web/.env.local:3-5` (service role key, `ENCRYPTION_KEY`, `CRON_SECRET`).

Tidak ditemukan di git history (`git log --all -- .env` kosong; `monitoring/web/.env` yang pernah ter-commit hanya berisi publishable key lalu di-revert). Tapi token/key valid ada di disk dan salah satu file pernah nyaris ter-track. Karena sudah terekspos selama audit, **rotasi**: Telegram bot token, `ENCRYPTION_KEY`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`. Pindahkan ke secret manager.
Catatan: `.gitignore` sudah benar (`.env*` + pengecualian `.env.example`).

---

## P2 — Sedang

### P2-1. `position_size` discipline score bisa dimanipulasi user
- `monitoring/web/app/api/strategies/route.ts:19-50` menerima `params`/`rules_json` bebas (`z.record(z.string(), z.unknown())`).
- `monitoring/web/lib/deviation.ts:109-120` memakai `risk_per_trade_pct` dari params user.

User bisa menyetel `risk_per_trade_pct` besar / `max_concurrent` besar sehingga tidak pernah "melanggar", menaikkan discipline score. Guardrail seed (`20260911120000_seed_strategy_templates.sql`) hanya di UI. Bukan risiko finansial langsung, tapi metrik SaaS jadi tidak bermakna.
Fix: validasi server-side terhadap envelope guardrail (long-only, risk ≤1%, max concurrent ≤5) di route POST/PUT.

### P2-2. `/api/events` tanpa auth, rate limit, atau origin check
- `monitoring/web/app/api/events/route.ts:10-26`

Siapa pun bisa spam `analytics_events` (service role), mengotori metrik referral/retention, dan menghabiskan storage. Tidak ada CSRF/origin/rate limit.
Fix: rate limit per IP + validasi Origin, atau pindahkan insert ke client langsung dengan policy RLS anon (sudah ada `events_insert`).

### P2-3. CSRF mengandalkan allowlist Origin yang kaku & fallback Host
- `monitoring/web/lib/csrf.ts:3-30`

- Origin hardcoded `trendsentry.vercel.app` + localhost → kalau dipasang di domain kustom, **semua mutasi 403**; kalau lupa hapus localhost, tidak berbahaya tapi tidak rapi.
- Tanpa Origin, validasi pindah ke header `Host` (bukan CSRF token). Ini pertahanan lebih lemah dari token sesi.
Fix: pakai SameSite=Lax/Strict pada cookie sesi Supabase + token CSRF eksplisit untuk mutasi sensitif; konfigurasikan domain lewat env.

### P2-4. Rate limiter `prices` bisa dilewati & tidak andal di serverless
- `monitoring/web/app/api/prices/route.ts:10-38`

`x-forwarded-for` diambil apa adanya (bisa dipalsukan rotasi) → bypass. `setInterval` prune tidak dijamin jalan di lingkungan serverless/Vercel, memori bisa tumbuh.
Fix: rate limit di edge/upstream (Vercel WAF) atau pakai store eksternal; percayai hanya hop pertama dari proxy tepercaya.

### P2-5. `PaperSyncSchema` cap akan mematahkan sync secara permanen
- `monitoring/web/lib/validations.ts:44-53` (`signals` max 2000)

Saat `signals` SQLite > 2000 baris (~200 hari @10/hari), validasi gagal terus → sync mati permanen, bukan sekadar kehilangan baris.
Fix: kirim inkremental (cukup baris baru sejak sync terakhir) atau naikkan/streaming.

### P2-6. `backfill_equity` / replay bisa drift & salah tanggal
- `paper_trading/live_signal.py:214-294`

- Replay kas dari `initial_capital` mengabaikan fee/slippage persis dan mengandalkan `yield_log` sebagai anchor; kalau `yield_log` bolong, drift.
- `mark_at` bergantung pada urutan `signals` per pair (saat ini aman karena ORDER BY, tapi rapuh).
- Live-stop exit memakai `datetime.now().date()` (`:334`) sementara pemrosesan candle memakai `d`; posisi bisa tercatat exit di tanggal yang belum close.
Fix: turunkan kas dari ledger event, dan pakai `d` konsisten untuk `exit_date`.

### P2-7. ATR & RSI tidak di-seed sesuai klaim (Wilder)
- `backtest/strategy.py:48-53` (ATR) dan `:120-131` (RSI)

Komentar mengklaim seed SMA, tapi `ewm(adjust=False)` sudah rekur dari TR/delta pertama; hanya nilai di indeks `period-1` yang ditimpa SMA, sehingga rekur berikutnya memakai seed yang berbeda. Nilai warmup berbeda dari Wilder standar (dan dari banyak platform). Test lolos karena memakai data konstan/trend.
Fix: seed eksplisit: hitung SMA periode pertama, lalu rekur manual, atau gunakan `ewm` dengan nilai awal yang benar.

### P2-8. Duplikasi sumber angka referensi
- `monitoring/web/lib/reference.ts:5-16` vs `scripts/compare_live_vs_backtest.py:23-29`

Dua salinan angka backtest yang harus sinkron. Drift → dashboard dan gate evaluasi berbeda pendapat.
Fix: satu sumber (JSON) dibaca keduanya.

### P2-9. Backup pakai AES-CBC tanpa autentikasi
- `deploy/backup.sh:13`, `deploy/restore.sh:14`

`openssl enc -aes-256-cbc -pbkdf2` tidak authenticated (bisa dimodifikasi tanpa terdeteksi). Untuk backup DB, gunakan AES-256-GCM atau age.
Juga `restore.sh:13` menulis ke `/tmp/$FILE` dengan `$FILE` dari argumen — validasi basename untuk cegah path traversal.

### P2-10. Session/password hygiene
- `monitoring/web/app/api/account/password/route.ts:44-47`: ganti password tidak mencabut sesi lain.
- Advisor Supabase: **Leaked Password Protection disabled** (HaveIBeenPwned). Aktifkan di dashboard Auth.
- `new_password` minimum 6 karakter tanpa cek kekuatan.

---

## P3 — Rendah / Hygiene

- **P3-1. Missing CSP/HSTS** di `monitoring/web/next.config.ts:8-20`. Ada X-Frame-Options/nosniff/Referrer-Policy/Permissions-Policy, tapi tanpa `Content-Security-Policy` dan `Strict-Transport-Security`.
- **P3-2. `account/delete` cleanup salah kolom** (`app/api/account/delete/route.ts:41`): `profiles` tidak punya `user_id` → error ter-log; sebenarnya aman karena FK `on delete cascade`, loop-nya mubazir. Rapikan atau hapus loop.
- **P3-3. `GET /api/templates` butuh auth padahal RLS `strategy_templates` public read** (`app/api/templates/route.ts:6-7`) — tidak konsisten, tidak berbahaya.
- **P3-4. `checkDeviation` heuristik `tradeValue > riskAmount * 10`** (`lib/deviation.ts:112`) — ambang arbitrer, dilabeli "critical" bisa menyesatkan.
- **P3-5. `calculateDisciplineScore` skor bisa basi** jika deviasi dihapus/diubah tanpa recompute (`lib/deviation.ts:178-211`).
- **P3-6. Repo menyimpan `db/paper_trading.db` (commit balik oleh CI)** — file biner yang cepat membengkak & rawan konflik rebase (`paper-trading.yml:56-59`). Bukan secret (paper), tapi pertimbangkan artifact/Storage, bukan git.
- **P3-7. `ApiKeyPostSchema` tanpa batas panjang** (`lib/validations.ts:34-38`) — bisa menyimpan string raksasa.
- **P3-8. `x-forwarded-for` & fallback IP "unknown"** (`prices/route.ts:14-18`) — semua tanpa header berbagi bucket yang sama.
- **P3-9. `live_signal` `log_slippage` setiap pair setiap run** (`:378`) → tabel `slippage_log` tumbuh cepat; cap sync 2000 juga terancam.
- **P3-10. `fetch_bitget_data.py` tidak menangani gap candle** dengan benar saat exchange mengembalikan jendela tak lengkap; `drop_duplicates` menyembunyikan gap. `data/historical` menjadi basis backtest.
- **P3-11. `config.yaml` `max_concurrent_positions: 5` tidak pernah mengikat** karena cluster limit 2 (A) + 1 (B) efektif maksimum 3. Bukan bug, tapi konfigurasi menyesatkan.
- **P3-12. Tidak ada TypeScript `typecheck` script** di `package.json`; `lint` = `eslint` tanpa path. Pertimbangkan `tsc --noEmit`.

---

## Yang Sudah Benar (jangan diubah tanpa alasan)

- Stop-loss wajib & tidak ada martingale/averaging-down: `backtest/strategy.py:66-78`, `live_signal.py:465`.
- Anti look-ahead: Donchian di-`shift(1)` (`strategy.py:56-63`), eksekusi open berikutnya (`run_backtest.py:117-130`).
- Idempotensi candle: `UNIQUE(candle_date,pair)` + cek sebelum insert (`live_signal.py:367`).
- Timing-safe compare dengan guard panjang (`daily-sync:8-11`, `paper-sync:23`).
- Enkripsi API key AES-GCM + IV acak per nilai (`lib/encryption.ts`), dan user API key tidak pernah dikembalikan plaintext (`api-keys/route.ts:11-16`).
- RLS diaktifkan + event trigger auto-enable untuk tabel baru (`20260909120000_remote_schema.sql:165-176, 279-281`).
- Sizing & stop loss punya unit test (`tests/test_strategy.py`, `tests/test_risk.py`); anti-drift test `position_size is strat_size`.
- Notifikasi kegagalan workflow CI (`paper-trading.yml:64-72`).
- `llm_filter` sengaja hanya boleh veto/flag, tidak pernah "buy/sell" (`llm_filter/filter.py:1-9`).

---

## Prioritas Perbaikan

| Urutan | Item | Alasan |
|---|---|---|
| 1 | P0-1 fail-fast `CRON_SECRET` | auth bypass aktif, bisa tulis data & dekripsi key |
| 2 | P0-2 perketat RLS `profiles` | eskalasi plan / bypass billing |
| 3 | P0-3 fix kas backtest + re-run metrik | semua keputusan strategi berdasar angka ini |
| 4 | P1-1 `.dockerignore` | secret bocor ke image/registry |
| 5 | P1-2 perbaiki query `exit_price`/`equity` | fitur discipline saat ini tidak berfungsi |
| 6 | P1-3 webhook Stripe renewal | pendapatan bocor / plan salah |
| 7 | P1-6 verifikasi izin API key | klaim read-only menyesatkan |
| 8 | Rotasi secret (P1-7) + aktifkan leaked-password protection | higiene kredensial |

## Catatan Verifikasi

- `pytest tests/ -q` → **54 passed**. Suite tidak menangkap P0-3 (tidak ada test kas negatif), P1-2 (tidak menyentuh query DB web), atau isu RLS.
- Supabase security advisor → 1 warning: Leaked Password Protection disabled.
- Tidak ditemukan secret di git history. Secret plaintext ada di working tree.
