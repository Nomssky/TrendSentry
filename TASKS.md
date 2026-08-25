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

> **Kriteria Sukses Fase 2 (didefinisikan 2026-08-14, sebelum run — anti moving-goalpost; diamendemen 2026-08-14: 8 minggu = minimum runtime, bukan deadline keras):**
>
> - [ ] **Durasi:** minimal 8 minggu berjalan tanpa crash/downtime signifikan. Kalau di minggu ke-8 jumlah trade tertutup < 10, run LANJUT (bukan gagal/sukses) sampai sample ≥ 10 trade, dengan checkpoint review tiap 4 minggu
> - [ ] **Frekuensi signal:** jumlah signal live vs ekspektasi historis (~62 trade / 6 tahun / 2 pair ≈ 5 trade/pair/tahun ≈ 1 signal per 2-3 minggu per pair). Signal jauh lebih sering dari itu = curigai bug
> - [ ] **Slippage realita:** dicatat per trade, dibandingkan asumsi backtest (0.05%). Rata-rata > 2x asumsi (0.10%) → position sizing perlu direvisi (update `config.yaml` + re-run backtest + catat alasan di `PLAN.md`)
> - [ ] **R-multiple realized:** trade closed selama paper trading dibandingkan distribusi backtest (avg win +6.05R, avg loss -1.01R). Deviasi besar (avg R < 0.5) = investigasi, bukan otomatis gagal
> - [ ] **Anti look-ahead di real-time:** cek log tiap signal — breakout terdeteksi tepat 1 hari setelah candle close (sama seperti backtest)
> - [ ] **Tidak ada keputusan "strategi gagal" hanya karena flat beberapa minggu** — itu karakteristik yang sudah diverifikasi di backtest (frekuensi trade rendah, periode tanpa entry normal)
> - [ ] **Evaluasi win rate/avg R HANYA setelah ≥ 10 trade tertutup.** Sebelum itu cukup pantau: sistem jalan tanpa crash, logging lengkap, slippage per-signal tercatat
> - [ ] **Checkpoint:** review di minggu ke-4 (tengah) dan minggu ke-8 (final), lalu tiap 4 minggu selama window diperpanjang
>
> Referensi ekspektasi = statistik backtest 6 tahun (win rate 41.9%, avg win +6.05R, avg loss -1.01R, PF 2.71, ~5 trade/pair/tahun). Perbandingan "periode yang sama" hanya valid untuk window yang overlap dengan backtest; untuk periode baru gunakan referensi di atas.

- [x] Buat `paper_trading/live_signal.py` — jalankan signal engine di data real-time (dummy execution, log only)
- [x] Alerting: Telegram — crash/fetch gagal (setelah retry) **+ ENTER/EXIT** (dimajukan dari Fase 4; `monitoring/telegram_alert.py`, secrets di repo GitHub). HOLD tidak dinotifikasi (anti-spam harian)
- [x] Web monitoring dashboard (`monitoring/web/`, Next.js static export → Vercel gratis; request eksplisit user 2026-08-25, lihat PLAN.md Section 8): health/gap, live ticker + unrealized PnL realtime (WebSocket), equity curve, trade log, slippage vs asumsi, win rate/avg R vs backtest. **Deploy: import repo di Vercel, Root Directory = `monitoring/web`**
- [x] Retry fetch Binance 3x (delay 5/10s) sebelum dianggap gagal — hiccup jaringan tidak jadi "missed day"
- [x] Backup DB harian (`db/backup_db.sh`, SQLite .backup, simpan 14 hari)
- [x] Setup scheduler — **GitHub Actions** (`.github/workflows/paper-trading.yml`, cron `0 1 * * *` UTC native, trigger manual tersedia). Crontab lokal dibatalkan: laptop tidak always-on. State DB dipersistenkan via commit balik `db/paper_trading.db` ke repo tiap run = sekaligus backup off-disk harian
- [x] Fix geo-block 451 (GitHub runner IP US diblokir api.binance.com): live signal pakai mirror `data-api.binance.vision` (data Binance sama persis, endpoint publik) + `fetchMarkets: ['spot']` (fapi futures keblokir terpisah)
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
