# SECURITY ACTIONS — Panduan Manual & Status (TrendSentry)

Dokumen ini mencatat tindakan keamanan/rotasi secret: mana yang sudah dikerjakan otomatis,
mana yang butuh Dashboard/akun yang hanya kamu miliki.

> Project: `ypkdnvwlekxmmotxsvrm` (TrendSentry), org "Nomssky's", **plan: free**.
> Dashboard: https://supabase.com/dashboard/project/ypkdnvwlekxmmotxsvrm

---

## Ringkasan status

| # | Item | Bisa otomatis? | Status |
|---|------|----------------|--------|
| 1 | `CRON_SECRET` | ✅ Ya | **Sudah dirotasi** (lokal + Vercel + GitHub) |
| 2 | `ENCRYPTION_KEY` | ✅ Ya | **Sudah dirotasi** (lokal + Vercel) |
| 3 | Password policy (min 10 + karakter) | ✅ Ya | **Sudah diaktifkan** |
| 4 | `SUPABASE_SERVICE_ROLE_KEY` | ❌ Tidak | **Tidak kompatibel** — tutorial di bawah |
| 5 | Token Telegram | ❌ Tidak | Butuh @BotFather — tutorial di bawah |
| 6 | Leaked Password Protection | ❌ Tidak | Butuh plan Pro — dijelaskan di bawah |

---

## 1. `CRON_SECRET` — SELESAI ✅

Dirotasi ke nilai 64-hex baru, disinkronkan ke **lokal (`.env` + `.env.local`) + Vercel
(Production & Preview) + GitHub Secrets**, lalu redeploy.
Verifikasi live: secret valid → `200`, `Bearer undefined` → `401`, secret lama → `401`.
Workflow GitHub `trendsentry-daily-sync` dijalankan → success.

---

## 2. `ENCRYPTION_KEY` — SELESAI ✅

Dirotasi (0 API key tersimpan saat itu, jadi aman). Nilai baru 64-hex dipasang di
**lokal (`.env` + `.env.local`) + Vercel (Production & Preview)**, redeploy.
Round-trip enkripsi/dekripsi dengan key baru diverifikasi berhasil.

Catatan: **jangan** rotasi ini lagi setelah ada user menyimpan API key exchange, kecuali
data lama di-re-enkripsi.

---

## 3. Password policy — SELESAI ✅

Dikonfigurasi via Management API (bisa di free plan):
- `password_min_length` = **10**
- `password_required_characters` = **huruf kecil + huruf besar + angka**

UI signup & change-password + `supabase/config.toml` sudah diselaraskan (min 10).
User lama tetap bisa login dengan password lamanya.

---

## 4. `SUPABASE_SERVICE_ROLE_KEY` — TIDAK BISA dirotasi otomatis

### Yang saya temukan (sudah diuji, bukan asumsi)
Project ini punya **dua sistem key**:
- **Legacy** (`anon`, `service_role`) — JWT panjang `eyJ...`
- **New-style** (`sb_publishable_...`, `sb_secret_...`) — string pendek

Saya coba rotasi ke **secret key baru** (`sb_secret_...`, dibuat via Management API,
dengan `secret_jwt_template: {role: service_role}`). Hasilnya:

```
REST  apikey-only : HTTP 401  {"message":"Invalid API key"}
Auth admin        : HTTP 401  {"message":"Invalid API key"}
```

Sementara **publishable key new-style justru bekerja** (REST → `200`). Artinya project ini
belum menerima `sb_secret_` di data plane-nya (kemungkinan rollout fitur belum aktif untuk
project ini). **Konsekuensinya: `service_role` legacy tidak bisa diganti `sb_secret_` sekarang.**

Saya sudah **membatalkan** percobaan (kembali ke key legacy yang bekerja) dan menghapus semua
key uji, jadi tidak ada downtime. Key nyasar `__probe__` juga sudah dihapus.

### Cara rotate `service_role` legacy (butuh Dashboard)
Rotasi legacy key = **rotate JWT secret** (kedua key legacy diturunkan dari situ).

1. Buka **Settings → API** → bagian **JWT Settings**:
   https://supabase.com/dashboard/project/ypkdnvwlekxmmotxsvrm/settings/api
2. Klik **Generate new JWT secret** (atau **Rotate**).
   ⚠️ Ini mengubah `anon` + `service_role` legacy, dan **membuat semua sesi user logout**.
   Publishable key (`sb_publishable_...`) **tidak** berubah.
3. Salin `service_role` JWT yang baru (muncul di halaman itu).
4. Pasang di **Vercel** (Production + Preview):
   ```bash
   cd /home/kresna/project/monitoring/web
   vercel env add SUPABASE_SERVICE_ROLE_KEY production --value "eyJ...baru..." --sensitive --force -y
   vercel env add SUPABASE_SERVICE_ROLE_KEY preview    --value "eyJ...baru..." --sensitive --force -y
   ```
5. Update `.env.local` lokal: `SUPABASE_SERVICE_ROLE_KEY=eyJ...baru...`
6. Redeploy & verifikasi:
   ```bash
   cd /home/kresna/project && vercel --prod --yes --project trendsentry
   CRON=$(grep '^CRON_SECRET=' monitoring/web/.env.local | cut -d= -f2-)
   curl -s -o /dev/null -w "daily-sync: HTTP %{http_code}\n" \
     "https://trendsentry.vercel.app/api/cron/daily-sync" -H "Authorization: Bearer $CRON"
   ```
   Harus `200`.
7. User harus login ulang (sesi lama invalid).

### Catatan
- **Jangan** pakai `sb_secret_` untuk `SUPABASE_SERVICE_ROLE_KEY` sampai project ini
  terbukti menerimanya (uji: REST dengan header `apikey` → harus 200).
- Karena audit tidak menemukan bukti key ini bocor ke luar, rotasi ini **opsional** —
  lakukan hanya kalau kamu ingin higiene penuh.

---

## 5. Token Telegram — butuh @BotFather

Dipakai di: `monitoring/telegram_alert.py`, `monitoring/web/lib/telegram.ts`,
workflow `paper-trading.yml`, `deploy/docker-compose.yml`, `.env` lokal.

1. Telegram → chat **@BotFather**.
2. `/mybots` → pilih bot → **API Token** → **Revoke current token**.
   (atau `/revoke` lalu pilih bot.)
3. Salin token baru (`123456:ABC...`).
4. Update:
   ```bash
   cd /home/kresna/project
   gh secret set TELEGRAM_BOT_TOKEN --body "123456:ABC..."
   # lalu edit .env → TELEGRAM_BOT_TOKEN=123456:ABC...
   # (opsional, kalau web kirim alert) set juga di Vercel:
   # cd monitoring/web && vercel env add TELEGRAM_BOT_TOKEN production --value "..." --sensitive --force -y
   ```
5. Verifikasi kirim pesan:
   ```bash
   ./venv/bin/python monitoring/telegram_alert.py
   ```
   Pesan test harus masuk ke HP, log `telegram alert terkirim`.
6. `TELEGRAM_CHAT_ID` tidak perlu diubah.

---

## 6. Leaked Password Protection — butuh plan Pro

Fitur ini **hanya tersedia di Supabase Pro ke atas**. Dibuktikan lewat Management API:

```
HTTP 402
{"message":"Configuring leaked password protection via HaveIBeenPwned.org is available on Pro Plans and up."}
```

Plan org = `free`, jadi menunya memang tidak muncul (bukan salah cari).

- **Mau aktifkan?** Upgrade ke Pro, lalu buka
  https://supabase.com/dashboard/project/ypkdnvwlekxmmotxsvrm/auth/providers?provider=Email
  → **Password Strength** → aktifkan **Prevent use of leaked passwords**.
- **Tetap Free?** Lewati. Mitigasi pengganti (min 10 + huruf besar/kecil/angka) sudah aktif.

Verifikasi:
```bash
TOKEN=$(cat ~/.supabase/access-token)
curl -s "https://api.supabase.com/v1/projects/ypkdnvwlekxmmotxsvrm/config/auth" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json;print(json.load(sys.stdin)['password_hibp_enabled'])"
```

---

## Checklist akhir

- [x] `CRON_SECRET` dirotasi + tersinkron + terverifikasi.
- [x] `ENCRYPTION_KEY` dirotasi + terverifikasi.
- [x] Password policy min 10 + karakter aktif.
- [x] Key uji / `__probe__` dibersihkan.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` dirotasi (opsional, via Dashboard → JWT secret).
- [ ] Token Telegram dirotasi (via @BotFather).
- [ ] Leaked Password Protection (butuh Pro).
