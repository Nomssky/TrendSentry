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
- [x] Rangkum hasil ke user — **menunggu review user: decision gate diperdebatkan (Sharpe 1.06 dari 2-pair Binance stale). Cluster-A2 final: Sharpe 0.82, DD -26.19%, 94 trades. Gate direvisi: Sharpe > B&H (terpenuhi), DD < 30% (terpenuhi). Lihat decision_log.md.**

## Fase 2 — Paper Trading

> **Kriteria Sukses Fase 2 — v2 (didefinisikan 2026-08-14, diamendemen 2026-08-25: konfigurasi diubah 2→5 pair + max 5 posisi + simulasi yield 5% APY; sample paper di-RESET 2026-08-25, run time dihitung dari tanggal ini):**
>
> - [ ] **Durasi:** minimal 8 minggu berjalan tanpa crash/downtime signifikan (sejak reset 2026-08-25). Kalau di minggu ke-8 jumlah trade tertutup < 10, run LANJUT (bukan gagal/sukses) sampai sample ≥ 10 trade, dengan checkpoint review tiap 4 minggu
> - [ ] **Frekuensi signal:** jumlah signal live vs ekspektasi historis Cluster-A2 (~15.7 trade/tahun ≈ 1 sinyal per 23 hari lintas pair; direvisi 2026-09-10 dari angka vanilla 28.7/tahun). Signal jauh lebih sering dari itu = curigai bug
> - [ ] **Slippage realita:** dicatat per trade (order book Bitget), dibandingkan asumsi backtest (0.05%). Rata-rata > 2x asumsi (0.10%) → position sizing perlu direvisi (update `config.yaml` + re-run backtest + catat alasan di `PLAN.md`)
> - [ ] **R-multiple realized:** trade closed dibandingkan distribusi backtest 10-pair (win rate 33.72%, avg win +3.59R, avg loss -0.89R, PF 1.68, avg R 0.62). Deviasi besar (avg R < 0.5) = investigasi, bukan otomatis gagal
> - [ ] **Anti look-ahead di real-time:** cek log tiap signal — breakout terdeteksi tepat 1 hari setelah candle close (sama seperti backtest)
> - [ ] **Tidak ada keputusan "strategi gagal" hanya karena flat beberapa minggu** — itu karakteristik yang sudah diverifikasi di backtest (frekuensi trade rendah, periode tanpa entry normal)
> - [ ] **Evaluasi win rate/avg R HANYA setelah ≥ 10 trade tertutup.** Sebelum itu cukup pantau: sistem jalan tanpa crash, logging lengkap, slippage per-signal tercatat
> - [ ] **Checkpoint:** review di minggu ke-4 (≈ 22 Sep, cek operasional saja) dan minggu ke-8 (≈ 20 Okt, final), lalu tiap 4 minggu selama window diperpanjang
>
> Referensi ekspektasi = **statistik backtest 10-pair 6 tahun** (win rate 33.72%, avg win +3.59R, avg loss -0.89R, PF 1.68, ~28.7 trade/tahun; laporan: backtest reports + monitoring/web/lib/reference.ts). **Caveat tercatat:** konfigurasi 10-pair mengandung survivorship bias (SOL/BNB/XRP dipilih sebagai survivor, + 7 pair lainnya) & DD backtest -58.49% — angka referensi adalah expectation atas basis historical data, bukan janji. Perbandingan "periode yang sama" hanya valid untuk window yang overlap dengan backtest; untuk periode baru gunakan referensi di atas.

- [x] Buat `paper_trading/live_signal.py` — jalankan signal engine di data real-time (dummy execution, log only)
- [x] Alerting: Telegram — crash/fetch gagal (setelah retry) **+ ENTER/EXIT** (dimajukan dari Fase 4; `monitoring/telegram_alert.py`, secrets di repo GitHub). HOLD tidak dinotifikasi (anti-spam harian)
- [x] Web monitoring dashboard (`monitoring/web/`, Next.js static export → Vercel gratis; request eksplisit user 2026-08-25, lihat PLAN.md Section 8): health/gap, live ticker + unrealized PnL realtime (WebSocket), equity curve, trade log, slippage vs asumsi, win rate/avg R vs backtest. **Deploy: import repo di Vercel, Root Directory = `monitoring/web`**
- [x] Retry fetch Binance 3x (delay 5/10s) sebelum dianggap gagal — hiccup jaringan tidak jadi "missed day"
- [x] Backup DB harian (`db/backup_db.sh`, SQLite .backup, simpan 14 hari)
- [x] Setup scheduler — **GitHub Actions** (`.github/workflows/paper-trading.yml`, cron `0 1 * * *` UTC native, trigger manual tersedia). Crontab lokal dibatalkan: laptop tidak always-on. State DB dipersistenkan via commit balik `db/paper_trading.db` ke repo tiap run = sekaligus backup off-disk harian
- [x] Fix geo-block 451 (GitHub runner IP US diblokir api.binance.com): live signal pakai mirror `data-api.binance.vision` (data Binance sama persis, endpoint publik) + `fetchMarkets: ['spot']` (fapi futures keblokir terpisah)
- [x] Buat schema log (`db/schema.sql`) — simpan setiap signal, harga, keputusan, timestamp
- [x] Equity snapshot harian (`equity_log`, 2026-09-08): engine tulis total=cash+MTM tiap run + backfill dari data lokal — kurva web tanpa fetch harga saat build, venue tunggal Bitget, fix double-count yield di total web
- [x] Ukur slippage real: log bid-ask spread order book di tiap signal (bandingkan dengan asumsi 0.05%) — **pipeline live 2026-09-10**: 125 sampel tersync ke Supabase, avg 0.011% (dalam batas), tampil di dashboard. Evaluasi final tetap di checkpoint minggu ke-8.
- [ ] Jalankan minimal 8 minggu, kumpulkan data
- [x] Buat script perbandingan performa live vs backtest periode yang sama (`scripts/compare_live_vs_backtest.py`, 2026-09-10 + unit test) — **evaluasi dikunci sampai ≥10 trade tertutup** (sekarang 1/10); script hanya cetak snapshot sebelum itu.
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

## SaaS — CLI + Filter + Preset Pack (dikunci 2026-09-11, lihat `PLAN.md` Section 9)

> Batas: tidak jual sinyal, tidak pegang dana/key user. CLI gratis; uang hanya dari filter API.

- [ ] Refactor engine → library + CLI Rich (`backtest | paper | live --dry-run | live | watcher | doctor`), tanpa ubah perilaku; DB SQLite lokal per-mesin
- [ ] Kunci guardrail di kode (SL exchange-side wajib, long-only spot, cap risk/posisi/cluster, circuit breaker, gate paper-sebelum-live)
- [ ] Preset 1: Donchian/Cluster-A2 (bungkus config + laporan yang ada)
- [ ] Preset 2: SMA crossover (indikator + logic + test anti-look-ahead + backtest + laporan)
- [ ] Preset 3: RSI mean-reversion long-only (indikator + logic + test anti-look-ahead + backtest + laporan)
- [ ] Kontrak filter API + eval harness dengan/tanpa filter → dogfood gratis → publikasi perbandingan
- [ ] Nyalakan API key berbayar verdict-live HANYA setelah Fase 3 terbukti (trial 5 verdict, harga = median 1R dihindari ÷ 10)
