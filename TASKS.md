# TASKS.md — Checklist Eksekusi

> Update checkbox tiap task selesai. Urutan wajib sequential per fase — jangan lompat.

## Fase 1 — Backtest Engine

- [x] Setup `venv` + install `ccxt`, `pandas`, `vectorbt` (pandas-ta gagal install di Python 3.14 — numba lama; ATR/Donchian diimplementasikan murni pandas + unit test, lebih transparan)
- [x] Buat `config.yaml` (pair, timeframe, Donchian period, ATR multiplier, risk %)
- [x] Buat script fetch data historis (`backtest/fetch_data.py`) — BTC/USDT & ETH/USDT, 1D, 3 tahun, simpan ke `data/historical/`
- [x] Implementasi `backtest/strategy.py`:
  - [x] Fungsi Donchian channel (highest high / lowest low N-hari, shift 1 = anti look-ahead)
  - [x] Fungsi ATR(14) (Wilder smoothing)
  - [x] Fungsi position sizing berbasis risk % (cap equity, spot no leverage)
  - [x] Entry/exit logic
- [x] Implementasi `backtest/run_backtest.py` (jalankan strategy di data historis, hitung equity curve)
- [x] Hitung & simpan metrik ke `backtest/reports/`: win rate, avg risk-reward, max drawdown, Sharpe/Sortino, return vs buy-and-hold
- [x] Buat unit test untuk position sizing & ATR calculation (`pytest`, 7 test pass)
- [x] Rangkum hasil ke user — **menunggu review user: decision gate BELUM lolos (Sharpe 0.46 < 1)**

## Fase 2 — Paper Trading

- [ ] Buat `paper_trading/live_signal.py` — jalankan signal engine di data real-time (dummy execution, log only)
- [ ] Setup scheduler (cron / APScheduler) untuk cek signal tiap candle close (harian)
- [ ] Buat schema log (`db/schema.sql`) — simpan setiap signal, harga, keputusan, timestamp
- [ ] Jalankan minimal 4-8 minggu, kumpulkan data
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
