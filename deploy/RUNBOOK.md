# RUNBOOK — Migrasi ke VPS (Coolify) + kesiapan Fase 4

> Prinsip: persiapan 100% sebagai kode (repo ini); D-day hanya provisioning + DNS + verifikasi.
> Fase 2 paper di cloud JALAN TERUS sampai cutover selesai dan terverifikasi.

## 0. Prasyarat (kamu)

- [ ] VPS Contabo VPS 6 (12GB), Singapore, Ubuntu 24.04 + akses root via SSH key
- [ ] Domain TrendSentry.com (akses DNS)
- [ ] Password manager berisi: JWT secret, anon/service keys (baru, generate sekali),
      `ENCRYPTION_KEY` **SAMA PERSIS dengan cloud** (kunci user terenkripsi!), `BACKUP_PASSPHRASE`,
      Brevo SMTP key, Telegram token/chat, GitHub token (push-to-deploy)

## 1. Hardening OS (sekali, ~15 mnt)

```bash
adduser deploy --disabled-password && usermod -aG sudo,docker deploy
# /etc/ssh/sshd_config: PasswordAuthentication no, PermitRootLogin prohibit-password
ufw allow 22,80,443/tcp && ufw enable
apt install unattended-upgrades && dpkg-reconfigure -plow unattended-upgrades
```

## 2. Coolify + Supabase one-click

- [ ] Install Coolify (`curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash`), buat admin
- [ ] One-click **Supabase**: catat JWT secret + anon/service keys ke password manager
- [ ] Aktifkan backup terjadwal Coolify (harian) + notifikasi Telegram
- [ ] GoTrue env (di service Supabase): `SITE_URL=https://trendsentry.com`,
      `URI_ALLOW_LIST=https://trendsentry.com/**`, SMTP Brevo (host/port/user/key,
      sender `TrendSentry`), template email = versi repo (sudah token_hash)

## 3. Migrasi data

```bash
./deploy/migrate.sh            # DATABASE_URL = Postgres Coolify (service key network internal)
./deploy/export-cloud.sh       # CLOUD_DATABASE_URL = connection string Supabase cloud
psql $DATABASE_URL -f /tmp/trendsentry-export/paper_tables.sql
# Verifikasi: bandingkan count paper_signals/positions/equity vs dashboard cloud.
# Tabel user_* di cloud KOSONG (penanda 2026-09-11) — tidak ada yang perlu dipindah.
```

## 4. Deploy web + engine

- [ ] Web: konek repo GitHub ke Coolify (Dockerfile `deploy/Dockerfile.web`),
      build-arg `NEXT_PUBLIC_*` = URL Supabase Coolify, domain `trendsentry.com` (TLS otomatis)
- [ ] Image Docker (`Dockerfile.*`) WAJIB lolos build di VPS — belum pernah dibuild
      (daemon tidak tersedia saat paket ini ditulis); gagal build = stop, perbaiki, ulang
- [ ] Engine: deploy `Dockerfile.engine` + systemd timer host:
      `01:05 UTC paper (docker exec engine python paper_trading/live_signal.py)`,
      `01:35 UTC watcher (curl localhost:3000/api/cron/daily-sync + Bearer CRON_SECRET)`,
      `03:00 UTC backup (deploy/backup.sh)`
- [ ] Adaptasi: `scripts/sync_paper_to_supabase.py` target → Postgres Coolify (bukan cloud)

## 5. Verifikasi end-to-end (sebelum cutover)

- [ ] Signup akun tes → email dari TrendSentry → confirm → **dashboard** (token_hash flow)
- [ ] Connect read-only key dummy → validasi read-only menolak key trade
- [ ] Engine manual run → sinyal/deviasi/skor muncul di dashboard
- [ ] **Uji restore**: `restore.sh` ke database scratch → count cocok → hapus scratch
      (backup yang belum pernah di-restore = bukan backup)

## 6. Cutover

- [ ] DNS A `trendsentry.com` → IP VPS (TTL rendah 1 jam sebelumnya)
- [ ] **Matikan scheduler lama**: `paper-trading.yml`, `trendsentry-daily-sync.yml`
      (dan pemicu `paper-sync`) → `on: workflow_dispatch` saja — cegah double-run
- [ ] `trendsentry.vercel.app` jadi redirect ke domain baru (masa rollback)
- [ ] Pantau 48 jam: engine log, backup pertama, Telegram alert, TTFB dashboard

## 7. Rollback (kriteria: auth rusak >4 jam / data menyimpang / restore gagal)

1. DNS kembali ke Vercel; 2. Nyalakan kembali workflow GitHub;
3. Cloud Supabase + Vercel dipertahankan **2 minggu** pasca-cutover, baru dihapus.

## 8. Pasca-cutover = kesiapan Fase 4 (BUKAN izin live)

Flip paper→live = `execution.mode` + key trade-no-withdraw + IP whitelist + risk manager
Fase 4 — dan **tetap dilarang sebelum gate Fase 2 lolos** (8 minggu + ≥10 trade tertutup,
AGENTS.md aturan 3–4). Tidak ada kode order di repo ini sampai saat itu.
