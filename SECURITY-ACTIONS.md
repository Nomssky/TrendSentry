# SECURITY ACTIONS — Panduan Manual (TrendSentry)

Dokumen ini berisi langkah-langkah manual yang **tidak bisa** dilakukan otomatis oleh agent
(butuh akses Dashboard/akun yang hanya kamu miliki). Setiap langkah disertai cara verifikasi.

> Status project: `ypkdnvwlekxmmotxsvrm` (TrendSentry), organisasi "Nomssky's", **plan: free**.
> URL dashboard: https://supabase.com/dashboard/project/ypkdnvwlekxmmotxsvrm

---

## Ringkasan status

| # | Item | Bisa di free plan? | Status |
|---|------|--------------------|--------|
| 1 | Leaked Password Protection | ❌ **Tidak** (butuh Pro) | Dijelaskan di bawah |
| 2 | Password policy (min length + karakter) | ✅ Ya | **Sudah dilakukan** via API |
| 3 | Rotasi `SUPABASE_SERVICE_ROLE_KEY` | ✅ Ya | Belum — tutorial di bawah |
| 4 | Rotasi token Telegram | ✅ Ya | Belum — tutorial di bawah |
| 5 | Rotasi `ENCRYPTION_KEY` | ✅ Ya | Belum — tutorial di bawah |

---

## 1. Leaked Password Protection — TIDAK BISA di plan Free

### Kenapa menunya tidak ada
Ini bukan karena salah cari. Fitur ini **hanya tersedia di Supabase Pro plan ke atas**.
Saya sudah mencoba mengaktifkannya lewat Management API dan ditolak:

```
HTTP 402
{"message":"Configuring leaked password protection via HaveIBeenPwned.org is available on Pro Plans and up."}
```

Plan organisasi kamu saat ini `free`, jadi menunya disembunyikan.

### Pilihan
- **A. Upgrade ke Pro** (berbayar, ~$25/bulan): setelah upgrade, buka
  https://supabase.com/dashboard/project/ypkdnvwlekxmmotxsvrm/auth/providers?provider=Email
  → bagian **Password Strength** → aktifkan **"Prevent use of leaked passwords"**.
- **B. Tetap Free**: lewati fitur ini. Mitigasi yang sudah aktif (lihat nomor 2) cukup
  menutup sebagian besar risiko. Risiko sisa: user bisa memakai password yang sudah
  bocor di situs lain (credential stuffing).

### Verifikasi
```bash
TOKEN=$(cat ~/.supabase/access-token)
curl -s "https://api.supabase.com/v1/projects/ypkdnvwlekxmmotxsvrm/config/auth" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json;print(json.load(sys.stdin)['password_hibp_enabled'])"
```
`False` = belum aktif. Kalau Pro + sudah diaktifkan, harusnya `True`.

---

## 2. Password policy — SUDAH DIAKTIFKAN ✅

Saya sudah mengubah konfigurasi auth cloud (bisa di free plan):
- `password_min_length` = **10**
- `password_required_characters` = **huruf kecil + huruf besar + angka**

Sebelumnya: min 6 karakter, tanpa syarat karakter. UI signup & change-password juga
sudah saya samakan (min 10). `supabase/config.toml` juga sudah diselaraskan.

### Verifikasi
```bash
TOKEN=$(cat ~/.supabase/access-token)
curl -s "https://api.supabase.com/v1/projects/ypkdnvwlekxmmotxsvrm/config/auth" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['password_min_length'], d['password_required_characters'])"
```
Harus keluar: `10 abcdefghijklmnopqrstuvwxyz:ABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789`

### Kalau mau ubah lagi
```bash
TOKEN=$(cat ~/.supabase/access-token)
curl -s -X PATCH "https://api.supabase.com/v1/projects/ypkdnvwlekxmmotxsvrm/config/auth" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"password_min_length": 12, "password_required_characters": "abcdefghijklmnopqrstuvwxyz:ABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789"}'
```

Catatan: user lama tetap bisa login dengan password lamanya. Syarat baru berlaku saat
ganti password / daftar baru.

---

## 3. Rotasi `SUPABASE_SERVICE_ROLE_KEY`

### Konteks penting
Project ini masih memakai **legacy key** (`service_role` berupa JWT `eyJ...`).
Supabase menyarankan pindah ke **secret key baru** (`sb_secret_...`). Saat ini project
sudah punya satu secret key: nama `default`, id `0f675bc4-...`.

Kode membaca key dari env `SUPABASE_SERVICE_ROLE_KEY` (server-only, di
`monitoring/web/lib/supabase/admin.ts`). Nilainya bisa diisi key baru `sb_secret_...`
tanpa ubah kode.

### Langkah aman (zero-downtime, cara Supabase)
1. Buka **Settings → API Keys**:
   https://supabase.com/dashboard/project/ypkdnvwlekxmmotxsvrm/settings/api-keys/
2. Klik **Create new API key** → pilih tipe **Secret** → beri nama, mis. `vercel-prod`.
   Salin nilai `sb_secret_...` (hanya tampil sekali).
3. Pasang di **Vercel** (project `trendsentry`), environment **Production** dan **Preview**:
   ```bash
   cd /home/kresna/project/monitoring/web
   vercel env add SUPABASE_SERVICE_ROLE_KEY production --value "sb_secret_xxx" --sensitive --force -y
   vercel env add SUPABASE_SERVICE_ROLE_KEY preview    --value "sb_secret_xxx" --sensitive --force -y
   ```
4. Update `.env.local` (lokal):
   ```bash
   # edit monitoring/web/.env.local → SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx
   ```
5. Redeploy & verifikasi:
   ```bash
   cd /home/kresna/project && vercel --prod --yes --project trendsentry
   CRON=$(grep '^CRON_SECRET=' monitoring/web/.env.local | cut -d= -f2-)
   curl -s -o /dev/null -w "daily-sync: HTTP %{http_code}\n" \
     "https://trendsentry.vercel.app/api/cron/daily-sync" -H "Authorization: Bearer $CRON"
   ```
   Harus `200`.
6. **Setelah** semua komponen terbukti jalan, baru **deactivate** key `service_role`
   lama di halaman API Keys yang sama (tombol disable). Jangan hapus dulu — deaktivasi
   bisa dibatalkan kalau ada klien yang terlewat.

### Jangan lakukan ini
- Jangan rotate **JWT secret** kalau tidak perlu — itu juga mengubah `anon`/publishable
  lama dan bisa memutus sesi/login. Cukup buat secret key baru + deactivate yang lama.

---

## 4. Rotasi token Telegram

Dipakai di: `monitoring/telegram_alert.py`, `monitoring/web/lib/telegram.ts`,
workflow `paper-trading.yml`, `deploy/docker-compose.yml`, `.env` lokal.

1. Buka Telegram, chat dengan **@BotFather**.
2. Kirim `/mybots` → pilih bot kamu → **API Token** → **Revoke current token**.
   (Atau `/revoke` lalu pilih bot.)
3. Salin token baru (`123456:ABC...`).
4. Update di 2 tempat:
   - **GitHub Secrets**:
     ```bash
     cd /home/kresna/project
     gh secret set TELEGRAM_BOT_TOKEN --body "123456:ABC..."
     ```
   - **`.env` lokal**: `TELEGRAM_BOT_TOKEN=123456:ABC...`
   - Kalau pakai Vercel untuk alert web, set juga:
     ```bash
     cd monitoring/web
     vercel env add TELEGRAM_BOT_TOKEN production --value "123456:ABC..." --sensitive --force -y
     vercel env add TELEGRAM_BOT_TOKEN preview    --value "123456:ABC..." --sensitive --force -y
     ```
5. Verifikasi kirim pesan:
   ```bash
   cd /home/kresna/project
   ./venv/bin/python monitoring/telegram_alert.py
   ```
   Harus ada pesan test masuk ke HP, dan log `telegram alert terkirim`.
6. `TELEGRAM_CHAT_ID` tidak perlu diubah (itu id chat kamu, bukan rahasia).

---

## 5. Rotasi `ENCRYPTION_KEY`

Dipakai untuk enkripsi API key exchange di database (`monitoring/web/lib/encryption.ts`).
**Aman dirotasi sekarang** karena saat ini **0 API key tersimpan** (sudah dicek).

⚠️ Jangan rotasi setelah ada user menyimpan API key, kecuali kamu re-enkripsi data lama —
kalau tidak, key lama tidak bisa didekripsi.

1. Generate nilai baru (64 karakter hex = 32 byte):
   ```bash
   openssl rand -hex 32
   ```
2. Pasang di **Vercel** (Production + Preview):
   ```bash
   cd /home/kresna/project/monitoring/web
   vercel env add ENCRYPTION_KEY production --value "<hex-baru>" --sensitive --force -y
   vercel env add ENCRYPTION_KEY preview    --value "<hex-baru>" --sensitive --force -y
   ```
3. Update `.env.local` dan `monitoring/web/.env` lokal.
4. Redeploy:
   ```bash
   cd /home/kresna/project && vercel --prod --yes --project trendsentry
   ```
5. Verifikasi API key baru bisa disimpan: buka `/app/settings`, simpan API key read-only,
   harus sukses (tidak ada error `decryption failed`).

---

## Checklist verifikasi akhir

- [ ] Leaked Password Protection: diputuskan (upgrade Pro, atau skip sadar).
- [ ] Password policy min 10 + karakter: aktif (sudah).
- [ ] `SUPABASE_SERVICE_ROLE_KEY`: key baru dipasang di Vercel + lokal, cron 200, key lama di-deactivate.
- [ ] Token Telegram: token baru di GitHub + lokal + Vercel, test alert masuk.
- [ ] `ENCRYPTION_KEY`: nilai baru di Vercel + lokal, redeploy, simpan API key test sukses.
- [ ] Setelah semua: cek tidak ada secret baru yang ter-commit:
      `git status` dan `git log --all -- .env` harus bersih.
