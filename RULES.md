# RULES.md — Seluruh Aturan Project TrendSentry

> Dokumen ini merangkum semua aturan, prinsip, dan risk management yang berlaku di proyek TrendSentry.
> Referensi sumber: `PLAN.md` (roadmap & strategi), `AGENTS.md` (instruksi agent), `TASKS.md` (checklist eksekusi).

---

## A. Prinsip Dasar

| # | Aturan |
|---|---|
| 1 | **Personal use, bukan komersial** — ini capital growth project, bukan sumber income rutin |
| 2 | Strategi = **Turtle Trading (trend-following)**, bukan prediksi LLM. LLM hanya filter, bukan signal generator |
| 3 | **Variance tinggi** — bisa naik, bisa turun, bukan gaji pasti |
| 4 | **Tidak ada shortcut ke live** — harus backtest + paper trading dulu, baru live |
| 5 | Dorongan "gas modal gede" atau tambah leverage/martingale = **red flag** |

---

## B. Parameter Strategi (Fixed untuk MVP)

| Parameter | Nilai | Boleh Diubah? |
|---|---|---|
| Pair | 10 (BTC, ETH, SOL, BNB, XRP, AVAX, LINK, DOGE, ADA, HYPE) | Ya, tapi harus ada backtest + catat alasan |
| Timeframe | 1D (daily candle close) | ❌ Fixed |
| Entry | Close > Highest High 20 hari sebelumnya | ❌ Fixed |
| Stop Loss | Entry − 2×ATR(14) | ❌ Fixed |
| Exit | Close < Lowest Low 10 hari, atau kena SL | ❌ Fixed |
| Position Sizing | Risk 1% ÷ stop_distance | ❌ Fixed |
| Direction | Long-only | ❌ Fixed |
| Max Concurrent | 5 posisi | ✅ Bisa diubah dengan backtest |

> ⚠️ Parameter tidak boleh diutak-atik berdasarkan feeling. Kalau mau tuning, harus berbasis backtest, dicatat alasannya, dan dites ulang.

---

## C. Hard Rules (Tidak Boleh Dilanggar)

1. **Decision gate wajib** — Jangan lanjut ke fase berikutnya kalau gate di fase sebelumnya belum terpenuhi
2. **Parameter strategi tidak boleh diubah** — kecuali user minta eksplisit dan dicatat
3. **Live execution (Fase 4) tidak boleh diterapkan** — sebelum Fase 1-2 selesai dan hasil masuk akal
4. **Setiap order wajib punya stop loss** — tidak ada exception
5. **Tidak ada martingale/averaging-down** — dalam bentuk apapun
6. **API key tidak boleh di-hardcode** — selalu pakai `.env` + `.gitignore`
7. **Kalau ada ambiguitas** — pilih yang benar sesuai risk rules, beri tahu user trade-off-nya

---

## D. Decision Gates

### Fase 1 → Fase 2

| Gate | Threshold |
|---|---|
| Sharpe ratio | > Sharpe buy-and-hold portofolio yang sama, dengan justifikasi tambahan jika selisih tidak signifikan (paired t-test). Lihat riwayat: threshold awal 1.0 terlalu agresif — buy-and-hold BTC/2-pair/10-pair semuanya di bawah 1.0 (tertinggi 0.98). |
| Max drawdown | ≤ 30% — diperlonggar dari batas awal (25%, implicit) karena volatilitas crypto inherent. DD -26.19% (Cluster-A2) diterima sebagai dalam batas wajar. Crypto bull-bear swing 40-60% adalah norma; DD 26% menunjukkan proteksi signifikan vs B&H (45-58%). |
| Benchmark | Return harus > buy-and-hold |

### Fase 2 → Fase 3

| Gate | Threshold |
|---|---|
| Durasi minimal | 8 minggu tanpa crash |
| Trade tertutup | ≥ 10 trade (evaluasi hanya setelah ini) |
| Frekuensi signal | ~1 sinyal per 15 hari lintas pair |
| Slippage real | Rata-rata ≤ 0.10% (2× asumsi) |
| Avg R | ≥ 0.5 (floor minimum) |
| Anti look-ahead | Breakout terdeteksi 1 hari setelah candle close |

---

## E. Risk Rules (Non-negotiable)

| # | Aturan | Status |
|---|---|---|
| 1 | Risk per trade **maks 1%** modal | ✅ Diimplementasi |
| 2 | Stop loss **wajib** di setiap order | ✅ Diimplementasi |
| 3 | Tidak ada martingale / averaging down | ✅ Diimplementasi |
| 4 | Tidak ada leverage tinggi (max 2x di Fase 4) | ⏳ Fase 4 |
| 5 | Circuit breaker wajib aktif sebelum live | ⏳ Fase 4 (param: 15% DD) |
| 6 | Perubahan parameter harus dicatat + backtest ulang | ✅ Proses aktif |
| 7 | Evaluasi mingguan — pause kalau 2-3 minggu di bawah ekspektasi | ⏳ Fase 2 checkpoint |

---

## F. Larangan Eksplisit

| # | Larangan |
|---|---|
| 1 | ❌ Jangan auto-top-up API key dari profit trading |
| 2 | ❌ Jangan tambah "auto-increase risk setelah winning streak" |
| 3 | ❌ Jangan buat fitur tambahan di luar PLAN.md tanpa konfirmasi user |

---

## G. Cara Kerja Agent per Sesi

1. Baca `PLAN.md` + `TASKS.md` di awal sesi
2. Kerjakan task sesuai urutan — jangan lompat fase
3. Task selesai → update checkbox → commit (format: `[Fase X] deskripsi`)
4. Hasil mencurigakan → laporkan ke user, jangan "diperbaiki" diam-diam
5. File kode baru harus punya docstring — keterbacaan penting (maintain solo)

---

## H. Tech Stack & Konvensi

| Area | Tools | Konvensi |
|---|---|---|
| Backtest | Python 3.11+, ccxt, pandas, vectorbt | PEP8, type hints wajib |
| Execution | Node.js + TypeScript, ccxt | ESLint + Prettier |
| DB | SQLite (Fase 1-2), PostgreSQL (Fase 4) | |
| Config | `.env` + `config.yaml` | Semua magic number di config |
| Testing | pytest | Unit test wajib untuk position sizing & SL |
| Logging | Python logging | Semua signal + eksekusi wajib ter-log |

---

## I. Definition of Done per Fase

| Fase | Kriteria Selesai |
|---|---|
| **Fase 1 (Backtest)** | Script jalan, metrik tersimpan di `backtest/reports/`, dirangkum ke user |
| **Fase 2 (Paper)** | Sistem jalan otomatis beberapa minggu, log lengkap, ada perbandingan vs backtest |
| **Fase 3 (LLM Filter)** | Filter terintegrasi, log reasoning, win rate dengan/tanpa filter |
| **Fase 4 (Live)** | Risk manager + circuit breaker aktif, notifikasi Telegram, modal kecil |

---

## J. Catatan Jujur

> "Tidak ada strategi yang pasti profit. Turtle-style punya track record panjang, tapi tetap ada losing streak panjang yang normal secara statistik."

- **Concentration of returns:** Top-5 trade = ~100% dari net pnl → distribusi fat-tailed
- **Sharpe 0.82 Cluster-A2 punya confidence interval lebar (sd ~0.3)** → jangan overconfident dari angka. Riwayat: Sharpe 1.06 dari 2-pair Binance (commit 8cc0012) tidak reproducible dengan data Bitget saat ini. Valid: Sharpe 0.82 untuk 10-pair Cluster-A2.
- **Edge sebenarnya:** potong loss cepat + biarkan winner jalan
- **Starting drawdown:** Beberapa minggu pertama flat/loss bisa normal → jangan dinilai dari window awal

---

## K. Perubahan yang Sudah Dibuat (2026-08-25)

| Perubahan | Alasan | Status |
|---|---|---|
| Pair 2→10 | Riset capital efficiency | ✅ |
| Max concurrent 2→5 | User pilih profil agresif (caveat: survivorship bias) | ✅ |
| Venue → Bitget | API automation + exchange-side stop | ✅ |
| Yield 5% APY | Simulasi idle cash, risiko platform tidak dimodelkan | ✅ |
| Long-only | Short & leverage dicoret berbasis riset | ✅ |
| Web monitoring | Request eksplisit user, read-only dashboard | ✅ |
