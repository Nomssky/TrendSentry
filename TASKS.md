# TASKS.md — Checklist Eksekusi

> Update checkbox tiap task selesai. Urutan wajib sequential per fase — jangan lompat.

## Fase 1 — Backtest Engine

- [x] Setup `venv` + install `ccxt`, `pandas`, `vectorbt` (pandas-ta gagal install di Python 3.14 — numba lama; ATR/Donchian diimplementasikan murni pandas + unit test, lebih transparan)
- [x] Buat `config.yaml` (pair, timeframe, Donchian period, ATR multiplier, risk %)
- [x] Buat script fetch data historis (`backtest/fetch_data.py`) — BTC/USDT & ETH/USDT, 1D, 6 tahun (2020-08..2026-08, diperluas dari 3 tahun atas instruksi user utk cakup bull-bear-bull), simpan ke `data/historical/`
- [x] Implementasi `backtest/strategy.py`:
  - [x] Fungsi Donchian channel (highest high / lowest low N-hari, shift 1 = anti look-ahead)
  - [x] Fungsi ATR(14) (Wilder smoothing)
  - [x] Fungsi position sizing berbasis risk % (cap equity, spot no leverage)
  - [x] Entry/exit logic
- [x] Implementasi `backtest/run_backtest.py` (jalankan strategy di data historis, hitung equity curve)
- [x] Hitung & simpan metrik ke `backtest/reports/`: win rate, avg risk-reward, max drawdown, Sharpe/Sortino, return vs buy-and-hold
- [x] Buat unit test untuk position sizing & ATR calculation (`pytest`, 7 test pass)
- [x] Rangkum hasil ke user — **menunggu review user: decision gate LOLOS setelah data diperluas ke 6 tahun (Sharpe 1.06, max DD -15.4%)**

## Fase 2 — Paper Trading

> **Kriteria Sukses Fase 2 (didefinisikan 2026-08-14, sebelum run — anti moving-goalpost):**
> Semua item di bawah harus terpenuhi sebelum Fase 2 dianggap lolos:
>
> - [ ] **Run time:** bot jalan kontinu ≥ 8 minggu tanpa crash/restart manual (scheduler aktif, log tidak bolong)
> - [ ] **Sample size:** ≥ 10 sinyal entry tercatat (dengan < 10, statistik tidak bermakna — perpanjang window)
> - [ ] **Win rate:** live dalam toleransi **±15pp** dari backtest (41.9% → rentang 27-57%) selama 2 minggu berturut-turut dengan ≥ 10 trade tertutup. Di luar rentang → pause & investigasi (bukan auto-fail; harus ada penjelasan teknis/market-regime sebelum lanjut)
> - [ ] **Avg R:** live tidak lebih rendah dari **0.5R** (backtest 1.95; deviasi -1.0R dari ekspektasi = flag). Catatan: backtest di-drive 5 trade outlier (top-5 = ~100% net pnl), jadi avg R window pendek secara natural volatile — gunakan rolling ≥ 10 trade, bukan per-trade
> - [ ] **Slippage vs asumsi:** ukur spread order book di tiap signal. Realisasi slippage (half-spread + efek harga) rata-rata ≤ **0.10%** (= 2x asumsi 0.05% di config). Konsisten di atas itu → update asumsi di `config.yaml` + re-run backtest + catat alasan di `PLAN.md`
> - [ ] **Logging:** semua signal tersimpan lengkap di DB (timestamp, harga, alasan, keputusan) — dievaluasi dengan skrip perbandingan, bukan manual
>
> Referensi ekspektasi = statistik backtest 6 tahun (win rate 41.9%, avg win +6.05R, avg loss -1.01R, PF 2.71). Perbandingan "periode yang sama" hanya valid untuk window yang overlap dengan backtest; untuk periode baru gunakan referensi di atas.

- [ ] Buat `paper_trading/live_signal.py` — jalankan signal engine di data real-time (dummy execution, log only)
- [ ] Setup scheduler (cron / APScheduler) untuk cek signal tiap candle close (harian)
- [ ] Buat schema log (`db/schema.sql`) — simpan setiap signal, harga, keputusan, timestamp
- [ ] Ukur slippage real: log bid-ask spread order book di tiap signal (bandingkan dengan asumsi 0.05%)
- [ ] Jalankan minimal 8 minggu, kumpulkan data
- [ ] Buat script perbandingan performa live vs backtest periode yang sama
- [ ] Rangkum hasil ke user, tunggu review sebelum lanjut Fase 3

## Fase 3 — LLM Filter Layer

- [ ] Setup `llm_filter/deepseek_client.py` (API call ke DeepSeek, pakai `.env` untuk API key)
- [ ] Desain prompt template (`llm_filter/prompts/`) — fokus ke risk sanity-check, bukan signal generation
- [ ] Integrasi filter ke pipeline signal (hanya dipanggil saat ada signal valid, bukan tiap candle)
- [ ] Log reasoning LLM per signal
- [ ] Bandingkan win rate dengan vs tanpa filter LLM (butuh data cukup dari Fase 2 + lanjutan)

## Fase 4 — Live Execution

- [ ] Implementasi `risk_manager/position_sizing.py` (Node.js atau reuse Python via subprocess/API internal)
- [ ] Implementasi circuit breaker (auto-pause kalau drawdown > threshold)
- [ ] Implementasi `execution/` — koneksi exchange API via `ccxt`, order dengan SL wajib
- [ ] Unit test untuk risk manager & circuit breaker
- [ ] Setup `monitoring/telegram_bot.py` — notifikasi entry/exit/circuit breaker
- [ ] Dry-run mode dulu (paper tapi pakai infra live) sebelum sentuh modal riil
- [ ] Deploy ke VPS + Docker
- [ ] Mulai modal kecil sesuai `PLAN.md`, monitoring mingguan

---

## Non-Task Reminder

- Decision gate wajib dicek sebelum centang task terakhir tiap fase (lihat `PLAN.md` Section 2)
- Kalau ada task yang butuh ubah parameter strategi → stop, diskusikan dulu, jangan otomatis jalan
