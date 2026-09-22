# TASKS.md — Checklist Eksekusi

> Update checkbox tiap task selesai. Urutan wajib sequential per fase — jangan lompat.

## Fase 1 — Backtest Engine

- [x] Setup `venv` + install `ccxt`, `pandas`, `vectorbt` (pandas-ta gagal install di Python 3.14 — numba lama; ATR/Donchian diimplementasikan murni pandas + unit test, lebih transparan. **Catatan 2026-09-22:** `vectorbt` akhirnya **tidak dipakai oleh kode mana pun** — tetap tercatat di `requirements.txt` sebagai sisa, lihat `REPO_MAP.md` §13)
- [x] Buat `config.yaml` (pair, timeframe, Donchian period, ATR multiplier, risk %)
- [x] Buat script fetch data historis (**aktual: `scripts/fetch_bitget_data.py`** — nama lama `backtest/fetch_data.py` tidak pernah ada di kode, tercantum basi sebelumnya) — BTC/USDT & ETH/USDT, 1D, 6 tahun (2020-08..2026-08, diperluas dari 3 tahun atas instruksi user utk cakup bull-bear-bull), simpan ke `data/historical/`
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
> - [ ] **R-multiple realized:** trade closed dibandingkan distribusi backtest 10-pair (win rate 36.17%, avg win +4.35R, avg loss -0.85R, PF 2.27, avg R 1.03). Deviasi besar (avg R < 0.5) = investigasi, bukan otomatis gagal
> - [ ] **Anti look-ahead di real-time:** cek log tiap signal — breakout terdeteksi tepat 1 hari setelah candle close (sama seperti backtest)
> - [ ] **Tidak ada keputusan "strategi gagal" hanya karena flat beberapa minggu** — itu karakteristik yang sudah diverifikasi di backtest (frekuensi trade rendah, periode tanpa entry normal)
> - [ ] **Evaluasi win rate/avg R HANYA setelah ≥ 10 trade tertutup.** Sebelum itu cukup pantau: sistem jalan tanpa crash, logging lengkap, slippage per-signal tercatat
> - [ ] **Checkpoint:** review di minggu ke-4 (≈ 22 Sep, cek operasional saja) dan minggu ke-8 (≈ 20 Okt, final), lalu tiap 4 minggu selama window diperpanjang
>
> Referensi ekspektasi = **statistik backtest 10-pair 6 tahun** (win rate 36.17%, avg win +4.35R, avg loss -0.85R, PF 2.27, ~15.7 trade/tahun; laporan: backtest reports + monitoring/web/lib/reference.ts). **Catatan 2026-09-22:** angka R-multiple/PF di paragraf ini = snapshot `backtest-reference.json`; ada snapshot kedua yang sedikit berbeda (`backtest/reports/metrics.md`: +4.31/−0.84, PF 2.26, return +149.59% vs +152.0%) — **keputusan canonical metric masih pending** (lihat `ARCHITECTURE.md` §16); jangan "menyamakan" angka tanpa keputusan owner + re-run. **Caveat tercatat:** konfigurasi 10-pair mengandung survivorship bias (SOL/BNB/XRP dipilih sebagai survivor, + 7 pair lainnya) & DD backtest -26.45% (snapshot B; snapshot A: -26.19%) — angka referensi adalah expectation atas basis historical data, bukan janji. Perbandingan "periode yang sama" hanya valid untuk window yang overlap dengan backtest; untuk periode baru gunakan referensi di atas.

> **Snapshot status (2026-09-22, dari `db/paper_trading.db` commit `754e6f7`, `lastRun` 2026-09-22T05:35 UTC):**
>
> - Hari ke-28 sejak reset 2026-08-25 (minggu ke-4) — checkpoint review minggu ke-4 jatuh ≈ 22 Sep 2026.
> - Signal tercatat: **245** (rentang 2026-08-24 .. 2026-09-21). Posisi: 6 (3 open, **3 tertutup = 3/10** gate).
> - Trade tertutup: SOL/USDT −1.08R (`stop_loss`), HYPE/USDT −0.92R (`donchian_exit`), BNB/USDT −1.08R (`live_stop`) — ketiganya exit 2026-09-10.
> - Slippage: **245 sampel, avg 0.0126%, max 0.0936%** (masih di bawah batas evaluasi 0.10%).
> - `equity_log` 30 hari (2026-08-24 .. 2026-09-22), `yield_log` 28 hari, `paper_cash` 723.10.
>
> Angka di blok ini adalah **snapshot operasional bertanggal** — perbarui saat snapshot berganti; jangan dianggap gate criteria.

- [x] Buat `paper_trading/live_signal.py` — jalankan signal engine di data real-time (dummy execution, log only)
- [x] Alerting: Telegram — crash/fetch gagal (setelah retry) **+ ENTER/EXIT** (dimajukan dari Fase 4; `monitoring/telegram_alert.py`, secrets di repo GitHub). HOLD tidak dinotifikasi (anti-spam harian)
- [x] Web monitoring dashboard (`monitoring/web/`, **Next.js 16 App Router server-rendered → Vercel + Supabase** — diperbarui 2026-09-22: **bukan static export**, tidak ada build-time SQLite, data dibaca dari Supabase saat request; request eksplisit user 2026-08-25, lihat PLAN.md Section 8): health/gap, live ticker + unrealized PnL via **REST polling `/api/prices` tiap 3 detik (bukan WebSocket)**, equity curve, trade log, slippage vs asumsi, win rate/avg R vs backtest. **Deploy: import repo di Vercel, Root Directory = `monitoring/web`**
- [x] Retry fetch 3x (delay 5/10s) sebelum dianggap gagal — hiccup jaringan tidak jadi "missed day" (historis: jalur mirror Binance `data-api.binance.vision` untuk geo-block 451; **sejak venue pindah ke Bitget 2026-08-25 engine memakai API publik Bitget**, jalur Binance tidak dipakai lagi)
- [x] Backup DB harian (`db/backup_db.sh`, SQLite .backup, simpan 14 hari)
- [x] Setup scheduler — **GitHub Actions** (`.github/workflows/paper-trading.yml`, cron `0 1 * * *` UTC native, trigger manual tersedia). Crontab lokal dibatalkan: laptop tidak always-on. State DB dipersistenkan via commit balik `db/paper_trading.db` ke repo tiap run = sekaligus backup off-disk harian
- [x] Fix geo-block 451 (GitHub runner IP US diblokir api.binance.com): live signal pakai mirror `data-api.binance.vision` (data Binance sama persis, endpoint publik) + `fetchMarkets: ['spot']` (fapi futures keblokir terpisah)
- [x] Buat schema log (`db/schema.sql`) — simpan setiap signal, harga, keputusan, timestamp
- [x] Equity snapshot harian (`equity_log`, 2026-09-08): engine tulis total=cash+MTM tiap run + backfill dari data lokal — kurva web tanpa fetch harga saat build, venue tunggal Bitget, fix double-count yield di total web
- [x] Ukur slippage real: log bid-ask spread order book di tiap signal (bandingkan dengan asumsi 0.05%) — **pipeline live 2026-09-10**: 125 sampel tersync, avg 0.011% (dalam batas), tampil di dashboard. **Snapshot 2026-09-22** (lihat blok di atas): 245 sampel, avg 0.0126%. Evaluasi final tetap di checkpoint minggu ke-8.
- [ ] Jalankan minimal 8 minggu, kumpulkan data
- [x] Buat script perbandingan performa live vs backtest periode yang sama (`scripts/compare_live_vs_backtest.py`, 2026-09-10 + unit test) — **evaluasi dikunci sampai ≥10 trade tertutup** (snapshot 2026-09-22: **3/10**); script hanya cetak snapshot sebelum itu.
- [ ] Rangkum hasil ke user, tunggu review sebelum lanjut Fase 3

## Fase 3 — LLM Filter Layer

- [ ] Setup `llm_filter/deepseek_client.py` (API call ke DeepSeek, pakai `.env` untuk API key) — **file belum ada** (baru `llm_filter/filter.py` skeleton nonaktif)
- [ ] Desain prompt template (`llm_filter/prompts/`) — **direktori belum ada** — fokus ke risk sanity-check, bukan signal generation
- [ ] Integrasi filter ke pipeline signal (hanya dipanggil saat ada signal valid, bukan tiap candle)
- [ ] Log reasoning LLM per signal
- [ ] Bandingkan win rate dengan vs tanpa filter LLM (butuh data cukup dari Fase 2 + lanjutan)

## Fase 4 — Live Execution

> **Status 2026-09-11:** desain dikunci (lihat `PLAN.md` Section 3 amendemen + envelope), stack = Python (amendemen riset).
> **DILARANG implementasi order riil** sebelum gate Fase 2 lolos (AGENTS.md aturan 3–4). Item di bawah = persiapan yang boleh dikerjakan sekarang (bertanda [PREP]) vs dilarang (bertanda [GATED]).

- [x] [PREP] Desain envelope: paritas engine, reconciler 15 mnt, stop berlapis + verifikasi programatik, breaker 15%, dry-run = live-infra + paper money, modal $50–100 spot, key trade-no-withdraw + IP whitelist
- [x] [PREP] `risk_manager/` Python: reuse `position_size` + circuit breaker pure logic + unit test (**tanpa satu pun `createOrder`**)
- [ ] [GATED] Implementasi `execution/` — koneksi exchange API via `ccxt`, order dengan SL wajib
- [ ] Implementasi circuit breaker (auto-pause kalau drawdown > threshold)
- [ ] Unit test untuk risk manager & circuit breaker
- [ ] Setup notifikasi circuit breaker — **file yang ada saat ini: `monitoring/telegram_alert.py`** (nama lama `monitoring/telegram_bot.py` tidak pernah ada); tinggal menambah event breaker saat Fase 4
- [ ] Dry-run mode dulu (paper tapi pakai infra live) sebelum sentuh modal riil
- [ ] Deploy ke VPS + Docker
- [ ] Mulai modal kecil sesuai `PLAN.md`, monitoring mingguan

---

## Non-Task Reminder

- Decision gate wajib dicek sebelum centang task terakhir tiap fase (lihat `PLAN.md` Section 2)
- Kalau ada task yang butuh ubah parameter strategi → stop, diskusikan dulu, jangan otomatis jalan

## SaaS — CLI + Filter + Preset Pack (dikunci 2026-09-11, lihat `PLAN.md` Section 9)

> Batas: tidak jual sinyal, tidak pegang dana/key user. CLI gratis; uang hanya dari filter API.

- [x] Refactor engine → library + CLI Rich (`backtest | paper | live --dry-run | live | watcher | doctor`), tanpa ubah perilaku; DB SQLite lokal per-mesin (`cli.py` + `tests/test_cli.py`, 2026-09-11)
- [ ] Kunci guardrail di kode (SL exchange-side wajib, long-only spot, cap risk/posisi/cluster, circuit breaker, gate paper-sebelum-live)
- [x] Preset 1: Donchian/Cluster-A2 (bungkus config + laporan yang ada) (`presets/donchian_cluster_a2.yaml`, 2026-09-11)
- [x] Preset 2: SMA crossover — **TIDAK LOLOS** (Sharpe 0.35, DD -53.21% > 30%, return +41% << B&H +155%, n=58; tanpa tuning, parameter beku; laporan `backtest/reports/presets/sma/`, 2026-09-12)
- [x] Preset 3: RSI mean-reversion long-only — **TIDAK LOLOS** (Sharpe 0.15, return +5.99% << B&H +155%, n=56; tanpa tuning, parameter beku; laporan `backtest/reports/presets/rsi/`, 2026-09-12)
- [x] Aturan beku parameter terkunci mekanis (`tests/test_presets.py::test_parameter_beku` — nilai preset berubah = suite merah)
- [x] Kontrak filter API + eval harness dengan/tanpa filter → dogfood gratis → publikasi perbandingan (`llm_filter/filter.py` skeleton veto+reasoning, 2026-09-11)
- [x] Audit loop watcher web selesai 2026-09-11: daily-sync pakai fills user (bukan market trades) + kabel deviasi + skor; verifikasi read-only saat submit key; guardrail 8 template dikunci; metrik M4 (beacon + referral) terpasang
- [x] Verifikasi kontaminasi data 2026-09-11: tabel user kosong (0 profiles/key/strategy/trade) — bug market-trades tidak pernah menyentuh data user nyata, tidak ada yang perlu dihapus
- [ ] Nyalakan API key berbayar verdict-live HANYA setelah Fase 3 terbukti (trial 5 verdict, harga = median 1R dihindari ÷ 10)
