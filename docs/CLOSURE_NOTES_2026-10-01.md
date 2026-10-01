# CLOSURE NOTES — 1 October 2026

> **Type:** Closure record (planning record). Not an audit, not a methodology decision.
> **Prepared:** 2026-10-01 · di atas `origin/main` `36c9f5c` · MVP vertical slice = `24c3ac4`.
> **Scope:** penutupan refactor repo tree + penyesuaian dokumentasi setelah MVP vertical slice
> Phase A–E (commit `24c3ac4`).
> **This document changes nothing by itself.** No code, config, test, schema or audit file was
> modified to produce it, and nothing is decided by it.

---

## 1. STATUS SETELAH PENYESUAIAN

### Selesai — boleh ditutup

- **Wave 0** — pemindahan dokumen audit ke `docs/audit/` (commit `9791707`).
- **Wave 1** — `tests/conftest.py` bootstrap path, `tests/test_module_identity.py` (jalur impor
  tunggal), pemindahan `monitoring/telegram_alert.py` → `alerting/telegram_alert.py`.
- **Wave 2 = Phase A–E (MVP vertical slice)** — control plane, kontrak config versioned,
  dashboard deployment, runtime per-deployment, ship gate. Ter-commit `24c3ac4` dan ter-push.
- **Migrasi Phase A + B diterapkan ke Supabase live** — tabel `deployments` +
  `deployment_config_versions`, trigger immutable, RLS owner-only; `deployment_id NOT NULL
  DEFAULT 0` di 6 tabel `paper_*` + `side`/`fill_key`. Jumlah baris lama tidak berubah.
- **Verifikasi environment** — endpoint `/config`, `/status`, dashboard, dan scoping ownership
  diuji terhadap produksi; engine menerima bundle live; token tampil sekali lalu hanya hash
  SHA-256; dua akun uji dibersihkan setelah verifikasi.

### Sengaja ditunda — gerbang, bukan utang

- **Fase 2** (paper run 8 minggu, checkpoint minggu ke-8 ≈ 2026-10-20), **Fase 3** (LLM filter),
  **Fase 4** (live execution) — semua digerakkan decision gate `PLAN.md` §2.
- Semua **open items §9** `docs/2_OCTOBER_CLOSURE_PLAN.md`: entitlement penuh, VPS,
  `monitoring/web → web`, OD-5 rebuild, 3 sub-gate OD-6, 5 konflik OD-7, `repo OD-2.4`,
  `repo OD-2.7`, Phase 2H OD-11/OD-12, Phase 2F kebijakan kredensial managed-VPS.
- **Owner decisions §4**: pin `vectorbt`, `lookback_years`, gating `fetch-bitget-data.yml`,
  `Dockerfile.web`, `db/backup_db.sh`, `test-bitget-api.yml`, penempatan `api-smoke-test.mjs`.
- **Disposisi 7 file audit untracked** — lihat §3 di bawah.
- **Kaki data market e2e** — lihat §6.

### Benar-benar perlu dikerjakan — sudah dikerjakan di penutupan ini

1. Repair drift angka di dokumen hidup (lihat §2).
2. Inventaris Phase A–E yang belum tercatat ditambahkan ke `REPO_MAP.md` dan `TASKS.md`.
3. Cacat reference tracked→untracked direkam (lihat §3) **tanpa menyentuh file OD mana pun**.
4. Tiga temuan integrasi direkam (lihat §5).

---

## 2. DRIFT DOKUMENTASI YANG DIPERBAIKI

| Dokumen | Sebelum | Sesudah |
|---|---|---|
| `AGENTS.md` | 75 test | **224 test di 17 file** |
| `README.md` | `# 75 tests` | `# 224 tests` |
| `PLAN.md` | `10 file pytest + conftest.py, 75 test` | `17 file + conftest.py, 224 test` |
| `REPO_MAP.md` | 64/75 test, 14 route, 19 sumber py, 10 file test, 35 tsx | 224 test, **17 route**, 22 sumber py, 17 file test, 37 tsx |
| `monitoring/web/AGENTS.md` | `API routes (14)` | `API routes (17)` + kontrak Bearer control plane |
| `monitoring/web/README.md` | §API routes menampilkan 14 | + blok **Control plane** (3 route) |
| `TASKS.md` | 0 referensi Phase A–E | seksi terpisah "MVP Vertical Slice — Phase A–E" |

Inventaris yang ditambahkan ke `REPO_MAP.md`: 7 file test (`test_config_source`,
`test_deployment_runtime`, `test_deployment_dashboard`, `test_deployments_contract`,
`test_two_deployments_isolation`, `test_runtime_hardening`, `test_mvp_ship_gate`), 3 route
`deployments*`, 3 migrasi (`20260922120000`, `20260928120000`, `20260929120000`), 3 file sumber
(`alerting/__init__.py`, `paper_trading/config_source.py`, `paper_trading/run_deployment.py`),
3 halaman `app/app/deployments/**`, serta pemetaan implementasi→test di §15.1.

**Sengaja TIDAK diubah:**

- `docs/audit/*`, `OD*.md`, `TREE_REFACTOR_AUDIT.md` — §5.6 `2_OCTOBER_CLOSURE_PLAN.md`:
  *"never rewritten"*.
- `AUDIT.md` — log bertanggal (2026-09-22, "64 passed") dibiarkan sebagai riwayat.
- `docs/2_OCTOBER_CLOSURE_PLAN.md` — kontrak closure yang sudah ada, tidak ditulis ulang.
- `ARCHITECTURE.md` — sudah benar (menyebut "17 API route", §16 utuh).
- Klaim **34 Playwright** dan **lint 2 error / 7 warning** — sudah diverifikasi benar, tidak diubah.

**Dua baris inventaris dihapus dari `REPO_MAP.md` §10.12** karena filenya sudah tidak ada
(0 di disk, 0 di git, 0 referensi kode): `app/app/dashboard/EquityCurveChart.tsx` dan
`app/public/*.svg (5)`. Keduanya dicatat sebagai riwayat di tempat itu sendiri.

---

## 3. KEPUTUSAN ATAS 7 FILE AUDIT UNTRACKED

**Keputusan: TETAP DI TEMPAT.** Tidak dimodifikasi, tidak dipindahkan, tidak di-commit, tidak
dihapus, tidak diarsipkan.

Dasar: `docs/2_OCTOBER_CLOSURE_PLAN.md` §4 (*"Keep | Not deletable, not movable in this
closure"*), §5.7 (*"not modified, moved, committed or deleted"*), dan §9.C (kapan file ini
di-untrack/dipindahkan = keputusan owner, *"only after the OD series closes"*).

**Gerbang §9.C belum terbuka** — seri OD belum ditutup: 3 sub-gate OD-6, 5 konflik OD-7,
`repo OD-2.4`, `repo OD-2.7`, Phase 2H OD-11/OD-12 masih open.

### ⛔ Cacat reference yang DIREKAM, bukan diperbaiki

Repo yang di-clone segar sudah berisi reference rusak, karena seri OD terbelah: sebagian ter-commit,
sebagian tidak.

| File TRACKED | Merujuk ke file UNTRACKED |
|---|---|
| `OD7_REPRODUCIBILITY_DECISION.md` | `OD5_DATA_INTEGRITY_REBUILD_DECISION.md`, `OD6_BENCHMARK_METRICS_STATISTICAL_VALIDITY_DECISION.md`, `OD7_THESIS_REPRODUCIBILITY_RESULT_TRACEABILITY_AUDIT.md`, `TREE_REFACTOR_AUDIT.md` |
| `docs/2_OCTOBER_CLOSURE_PLAN.md` | `OD7_THESIS_REPRODUCIBILITY_RESULT_TRACEABILITY_AUDIT.md`, `TREE_REFACTOR_AUDIT.md` |

Sedangkan `OD2_ENTRY_EXECUTION_STOP_DECISION.md` dan `OD7_REPRODUCIBILITY_DECISION.md`
**sudah ter-commit**, sementara OD3–OD8 + `TREE_REFACTOR_AUDIT.md` belum.

**Direkam, bukan diperbaiki**, karena setiap jalur perbaikan melanggar suatu aturan:

- meng-Commit 7 file → melanggar §5.7 dan instruksi bahwa file itu bukan bagian dari MVP;
- memindah/mengarsipkan → melanggar §5.6 dan §9.C;
- mengedit `OD7_REPRODUCIBILITY_DECISION.md` → mengubah catatan riwayat (§5.6).

Kecacatan ini sengaja ditulis di sini supaya keputusan §9.C nanti diambil **dengan sadar**,
bukan baru ketahuan saat orang lain meng-clone.

---

## 4. SHA-256 7 FILE AUDIT (wajib tetap sama setiap langkah)

```
d48a985b  OD3_EXIT_POSITION_LIFECYCLE_ACCOUNTING_DECISION.md
eba974bc  OD4_RISK_SIZING_PORTFOLIO_ALLOCATION_DECISION.md
7ed1ffbe  OD5_DATA_INTEGRITY_REBUILD_DECISION.md
d6f9a9a4  OD6_BENCHMARK_METRICS_STATISTICAL_VALIDITY_DECISION.md
9c6e7972  OD7_THESIS_REPRODUCIBILITY_RESULT_TRACEABILITY_AUDIT.md
f89d821a  OD8_THESIS_METHODODOLOGY_DECISION_MATRIX.md
22d00ca8  TREE_REFACTOR_AUDIT.md
```

---

## 5. TIGA TEMUAN DARI SESI ENVIRONMENT INTEGRATION

Ketiganya **direkam, bukan diperbaiki** — perbaikannya keputusan terpisah.

1. **Advisor `SECURITY DEFINER` baru dari Phase A.** `get_advisors` memunculkan WARN untuk
   `reject_config_version_update()` — fungsi `SECURITY DEFINER` yang bisa dieksekusi
   `anon`/`authenticated` lewat `/rest/v1/rpc/`. Ini **pola yang sama dengan yang sudah ada**
   (`recalc_discipline_score`), jadi bukan regresi yang dibawa Phase A, tapi Phase A
   menambah satu instance baru.

2. **`deployments.updated_at` tidak ikut ter-update** saat status deployment berubah lewat
   `POST /api/deployments/[id]/status`. Kolom `updated_at` hanya bergerak pada perubahan
   lain, sehingga tidak bisa dipakai sebagai "terakhir kali heartbeat diterima".

3. **Divergensi riwayat migrasi DB vs daftar file repo.** Sebelum Phase A, tabel migrasi Supabase
   berisi **6 entri** sementara repo punya **12 file** — termasuk satu entri
   (`m5_kuesioner_trendsentri`) yang **tidak ada di repo**. Penambahan Phase A/B lewat MCP
   mencatat versi dengan **stempel waktu eksekusi** (`20260930055433`, `20260930055647`),
   bukan versi nama file (`20260928120000`, `20260929120000`), sehingga daftar file repo dan
   riwayat migrasi DB **tidak selaras 1:1**. Jangan menganggap kecocokan nama = kecocokan
   penerapan.

---

## 6. LINGKUNGAN — KAKI DATA MARKET: TERPECAH DUA

Dari sesi ini ketahuan bahwa kaki "data → signal" **tidak sepenuhnya terblokir** — statusnya
tergantung *jalur mana* yang dijalankan dan *dari mana*.

### Sudah terbukti jalan: jalur legacy, harian, di GitHub Actions

`.github/workflows/paper-trading.yml` menjalankan `python paper_trading/live_signal.py` setiap
hari 01:00 UTC di `ubuntu-latest`, diawali `pytest`, lalu `scripts/sync_paper_to_supabase.py`,
lalu commit `db/paper_trading.db` balik ke repo. Run **2026-09-30 berhasil** — commit `36c9f5c`
`[paper-trading] update DB state 2026-09-30` membawa **+10 signal** (315 → 325, `lastRun`
2026-09-30T06:08:59Z).

Artinya: **runner GitHub Actions menjangkau Bitget dan menghitung signal dari data pasar
nyata, setiap hari.** Jalur `config.yaml` legacy sudah tervalidasi environment-nya.

### Yang belum jalan: runtime deployment baru (Phase A–E)

`paper_trading/run_deployment.py` (kontrak env `TREND_SENTRY_*`, `ConfigSource` fail-closed,
satu SQLite per deployment) **tidak dipanggil oleh workflow mana pun** — `grep run_deployment`
di `.github/workflows/` = 0 hit. Satu-satunya percobaan e2e terhadap data pasar nyata dijalankan
dari **mesin ini** dan berhenti di:

```
ssl.SSLCertVerificationError: Hostname mismatch, certificate is not valid for 'api.bitget.com'
```

di `paper_trading/live_signal.py:376`, karena `api.bitget.com` dan `api.binance.com` sama-sama
resolve ke `202.3.218.139` / `internetbaik.telkomsel.com` (filter ISP). Ini **masalah
lingkungan, bukan kode**.

### Pilihan yang ada — keputusan owner, bukan keputusan agent

Runner GitHub Actions sudah terbukti terjangkau Bitget, jadi jalur runtime deployment *bisa*
dijalankan di sana. **Menambah workflow baru = menambah fitur di luar `PLAN.md`**, jadi tidak
dikerjakan tanpa konfirmasi. Alternatif: jalankan dari host lain yang legal terjangkau Bitget.

**Jangan pernah menyiasati filter ISP secara diam-diam.** Selama ini jalur legacy tetap
berjalan tiap hari lewat CI, jadi tidak ada kekosongan data — yang belum ada hanyalah
verifikasi *runtime deployment* terhadap data pasar nyata.

---

## 7. CATATAN TEKNIS PENYESUAIAN INI

- Perubahan murni **dokumentasi** — tidak ada kode, config, test, atau schema yang disentuh,
  sehingga jumlah test tetap 224 dan baseline lint tetap 2 error / 7 warning.
- `git add` dilakukan **eksplisit per file**; tidak pernah `git add .`, supaya 7 file audit
  tetap untracked.
- File ini **ikut di-commit** — kalau dibiarkan untracked, `git status` jadi 8 file dan
  melanggar acceptance §8.1 closure plan yang mensyaratkan tepat 7.
- Artefak cache lokal (Playwright `test-results/`, `supabase/.temp/`, `.pytest_cache`,
  `tsconfig.tsbuildinfo`, `db/deployments/` yang kosong) dibersihkan. `.next`, `node_modules`,
  `venv/`, `.env*`, dan `db/*.db` tidak disentuh.
