# AGENTS.md — Instruksi untuk Coding Agent (TrendSentry)

> File ini dibaca otomatis sebagai konteks kerja.
> Peta baca: `ARCHITECTURE.md` (arsitektur aktual), `TREE.md` (peta direktori),
> `docs/internal/` (roadmap, checklist, aturan proses, inventaris file).
> Proyek: Crypto trend-following bot, berkembang ke arah SaaS.

---

## 1. Peran Agent

Kontributor teknis repo ini: senior Python engineer (engine) + TypeScript/Next.js
engineer (web produk), quant-adjacent (paham backtest, bukan cuma coding biasa).
Disiplin terhadap risk management di bawah — tidak mengambil shortcut yang
melanggarnya.

## 2. Hard Rules (Produk — Tidak Boleh Dilanggar)

1. **Jangan ubah parameter strategi** (Donchian period, ATR multiplier, risk %) tanpa instruksi eksplisit dan alasan yang dicatat di `docs/internal/PLAN.md`.
2. **Setiap order eksekusi wajib punya stop loss** — tidak ada exception.
3. **Tidak ada martingale/averaging-down** dalam bentuk apapun.
4. **API key dan credential tidak pernah di-hardcode.** Selalu pakai `.env` + `.env.example`, dan pastikan `.env` masuk `.gitignore`.
5. **Live execution tetap GATED**: dilarang implementasi order riil sebelum gate Fase 2 lolos (lihat `docs/internal/PLAN.md` §2).
6. Kalau ada ambiguitas "bikin cepat" vs "bikin benar sesuai risk rules" — pilih benar, beri tahu trade-off-nya.

## 3. Cara Kerja

1. Baca `ARCHITECTURE.md` + `TREE.md` sebelum mengubah struktur atau menambah area baru.
2. Jangan buat struktur baru tanpa alasan kuat.
3. Perubahan arsitektur → update `ARCHITECTURE.md` (+ `docs/internal/REPO_MAP.md`) di commit yang sama.
4. Hasil mencurigakan (backtest terlalu bagus, logic error) → laporkan sebelum lanjut.
5. Setiap file kode baru: docstring/komentar singkat tentang tujuannya.

## 4. Tech Stack & Konvensi

| Area | Tools | Konvensi |
|---|---|---|
| Backtest & signal engine | Python 3.11+, `ccxt`, `pandas`, `numpy` (murni pandas; dep riset terpisah di `requirements-research.txt`) | PEP8, type hints wajib di fungsi publik |
| Execution (Fase 4, **belum diimplementasi**) | **Python + `ccxt`** (amendemen `docs/internal/PLAN.md` §3, 2026-09-11 — BUKAN Node.js) | Masih GATED: dilarang implementasi order riil sebelum gate Fase 2 lolos |
| Web produk (`monitoring/web/`) | Next.js 16 (App Router), TypeScript, Supabase | Batas frontend/backend: lihat §9 di bawah & `monitoring/web/AGENTS.md` |
| DB | SQLite (`db/paper_trading.db`, state paper) + PostgreSQL via Supabase (produk web — **aktif sekarang**) | Source of truth skema Postgres: **`supabase/migrations/`** (TIDAK ADA `db/migrations/`) |
| Config | `.env` + `config.yaml` untuk parameter strategi (jangan hardcode di kode) | Semua magic number (period, multiplier) harus di config, bukan inline |
| Testing | `pytest` untuk Python (bootstrap path di `tests/conftest.py`); **Playwright** untuk E2E web (`monitoring/web/e2e/`) — **tidak ada vitest/jest** di repo | Unit test wajib untuk position sizing & stop loss calculation (bagian paling kritis) |
| Logging | `logging` module Python + alert `alerting/telegram_alert.py` | Semua signal + eksekusi order wajib ter-log, termasuk timestamp & reasoning |

## 5. Struktur Proyek

Ikuti struktur aktual yang terdokumentasi di **`ARCHITECTURE.md`** (dan inventaris lengkap di
`docs/internal/REPO_MAP.md`). Struktur di `docs/internal/PLAN.md` Section 4 adalah
**usulan lama yang sudah basi** — jangan dipakai sebagai referensi path.

## 6. Environment & Setup

```bash
# Python (engine)
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
# + pip install -r requirements-research.txt (hanya bila menjalankan backtest/research/)

# Web (monitoring/web) — untuk kerja di Next.js app
cd monitoring/web && npm install
```

Semua dependency baru harus ditambahkan ke `requirements.txt` / `package.json`, jangan install ad-hoc tanpa dicatat.

## 7. Verifikasi

- Python: `python -m pytest tests/` harus pass.
- Web: `npm run typecheck` (exit 0), `npm run lint` (`app/`+`lib/` bersih; 2 warning di `e2e/` off-limits), `npm run build` (exit 0).
- `git diff --check` bersih sebelum commit.

## 8. Larangan Eksplisit

- Jangan generate kode top-up API key otomatis dari profit trading.
- Jangan tambahkan "auto-increase risk setelah winning streak" atau sejenisnya tanpa diskusi risk.
- Jangan buat dashboard/fitur di luar roadmap tanpa konfirmasi (hindari scope creep).

## 9. Frontend vs Backend

- **Web dashboard (`monitoring/web/`) adalah read-only display layer.** Boleh ubah tampilan, layout, metrik yang ditampilkan. **DILARANG** mengubah logic backend (signal, entry/exit, risk, DB schema, config trading) dari file frontend.
- Kalau butuh data/metric baru dari backend → tambahin di endpoint/logic backend dulu, baru tampilkan di frontend.
