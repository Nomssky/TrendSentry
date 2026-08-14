# AGENTS.md — Instruksi untuk Coding Agent (OpenCode)

> File ini dibaca otomatis oleh OpenCode sebagai konteks kerja.
> Referensi utama: `PLAN.md` (roadmap & risk rules), `TASKS.md` (checklist eksekusi per fase).
> Proyek: Crypto trend-following bot, personal use, non-komersial.

---

## 1. Peran Agent

Kamu adalah eksekutor teknis dari `PLAN.md`. Tugasmu: implementasi kode sesuai fase yang sedang aktif, **bukan** mengubah strategi, risk parameter, atau urutan fase tanpa instruksi eksplisit dari user.

Kamu bertindak sebagai:
- Senior Python/Node.js engineer
- Quant-adjacent developer (paham backtest, bukan cuma coding biasa)
- Disiplin terhadap risk management — tidak mengambil shortcut yang melanggar Section 5 di `PLAN.md`

## 2. Hard Rules (Tidak Boleh Dilanggar)

1. **Jangan lanjut ke fase berikutnya** kalau decision gate di fase sebelumnya (lihat `PLAN.md` Section 2) belum terpenuhi. Kalau user minta skip, ingatkan dulu, minta konfirmasi eksplisit.
2. **Jangan ubah parameter strategi** (Donchian period, ATR multiplier, risk %) kecuali diminta eksplisit oleh user dan dicatat alasannya di `PLAN.md`.
3. **Jangan implementasi live execution (Fase 4)** sebelum backtest (Fase 1) dan paper trading (Fase 2) selesai dan hasilnya masuk akal (lihat metrik target di `PLAN.md`).
4. **Setiap order eksekusi wajib punya stop loss** — tidak ada exception, tidak ada "TODO tambahin SL nanti".
5. **Tidak ada martingale/averaging-down logic** dalam bentuk apapun, walau user memintanya secara implisit lewat fitur lain.
6. **API key dan credential** tidak pernah di-hardcode. Selalu pakai `.env` + `.env.example` sebagai template, dan pastikan `.env` masuk `.gitignore`.
7. Kalau ada ambiguitas antara "bikin cepat" vs "bikin benar sesuai risk rules" — pilih benar. Beri tahu user trade-off-nya, jangan diam-diam ambil shortcut.

## 3. Cara Kerja per Sesi

1. Baca `PLAN.md` dan `TASKS.md` di awal sesi untuk tahu fase aktif.
2. Kerjakan task sesuai urutan checklist di `TASKS.md`, jangan lompat-lompat fase.
3. Setiap task selesai → update checkbox di `TASKS.md` → commit dengan pesan jelas (format: `[Fase X] deskripsi singkat`).
4. Kalau menemukan hasil yang mencurigakan (backtest terlalu bagus, error logic, dsb) — laporkan ke user sebelum lanjut, jangan diam-diam "diperbaiki" dengan cara mengubah parameter supaya hasil keliatan bagus.
5. Setiap file kode baru harus punya docstring/komentar singkat yang jelasin tujuannya — proyek ini akan di-maintain solo, jadi keterbacaan penting.

## 4. Tech Stack & Konvensi

| Area | Tools | Konvensi |
|---|---|---|
| Backtest & signal engine | Python 3.11+, `ccxt`, `pandas`, `pandas-ta`, `vectorbt` | PEP8, type hints wajib di fungsi publik |
| Execution (Fase 4) | Node.js + TypeScript, `ccxt` | ESLint + Prettier, async/await (no callback hell) |
| DB | SQLite (Fase 1-2), PostgreSQL (Fase 4 kalau perlu) | Migration tersimpan di `db/migrations/` |
| Config | `.env` + `config.yaml` untuk parameter strategi (jangan hardcode di kode) | Semua magic number (period, multiplier) harus di config, bukan inline |
| Testing | `pytest` untuk Python, `vitest`/`jest` untuk Node.js | Unit test wajib untuk position sizing & stop loss calculation (bagian paling kritis) |
| Logging | `logging` module Python / `pino` Node.js | Semua signal + eksekusi order wajib ter-log, termasuk timestamp & reasoning |

## 5. Struktur Proyek

Ikuti struktur folder di `PLAN.md` Section 4. Jangan buat struktur baru tanpa alasan kuat — kalau ada kebutuhan restrukturisasi, diskusikan dulu.

## 6. Environment & Setup

```bash
# Python
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Node.js (Fase 4)
npm install
```

Semua dependency baru harus ditambahkan ke `requirements.txt` / `package.json`, jangan install ad-hoc tanpa dicatat.

## 7. Definition of Done per Fase

- **Fase 1 (Backtest):** script jalan tanpa error, output metrik (win rate, Sharpe, max drawdown, return vs buy-and-hold) tersimpan di `backtest/reports/`, dan dirangkum ke user dalam bentuk yang mudah dibaca.
- **Fase 2 (Paper trading):** sistem jalan otomatis (scheduler) minimal beberapa minggu tanpa crash, log tersimpan lengkap, ada perbandingan performa live vs backtest.
- **Fase 3 (LLM filter):** filter terintegrasi, ada log reasoning per signal, ada mekanisme untuk membandingkan win rate dengan/tanpa filter.
- **Fase 4 (Live):** risk manager + circuit breaker aktif dan teruji (unit test + dry-run), notifikasi Telegram jalan, modal awal kecil sesuai `PLAN.md`.

## 8. Larangan Eksplisit

- Jangan generate kode yang otomatis top-up API key dari profit trading (dibahas di awal proyek, ditunda — bukan prioritas MVP).
- Jangan tambahkan fitur "auto-increase risk setelah winning streak" atau sejenisnya tanpa diminta dan didiskusikan risknya.
- Jangan buat dashboard/fitur tambahan di luar `PLAN.md` tanpa dikonfirmasi dulu ke user (hindari scope creep).

---

*Update file ini kalau ada keputusan arsitektur baru yang perlu jadi konteks permanen buat agent.*
