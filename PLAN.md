# PLAN.md — Crypto Trend-Following Bot

> Status: Fase 2 — Paper Trading aktif (sejak 2026-08-25; snapshot 2026-09-22 = hari ke-28/56, minggu ke-4).
> Tujuan: Capital growth jangka panjang, modal kecil, bukan sumber income rutin.
> Prinsip: Business first, risk-managed, no overengineering, MVP-driven.

> **Legenda dokumen (diperjelas 2026-09-22, Phase 1 Documentation Reset):**
> - **CURRENT IMPLEMENTATION** — yang benar-benar berjalan sekarang → dokumentasi fakta di
>   [`ARCHITECTURE.md`](ARCHITECTURE.md) & [`REPO_MAP.md`](REPO_MAP.md).
> - **FUTURE PLAN** — roadmap & desain yang digated (Fase 3 LLM filter, Fase 4 live) → §2, §3 (envelope), §9.
> - **HISTORICAL DECISION** — catatan keputusan & alasan (jangan dihapus, jangan dianggap status saat ini) → §6, §7, catatan bertanggal.
> Struktur folder usulan di §4 sudah diganti struktur aktual; klaim teknis basi (static export,
> Node.js) sudah diperbaiki — riwayatnya di `REPO_MAP.md` §12.

---

## 0. Konteks & Prinsip Dasar

- Dimulai sebagai personal project, berkembang ke arah SaaS. TrendSentry menjual **disiplin eksekusi** — Cluster-A2 adalah bukti kredibilitas (dogfooding), bukan produk yang dijual.
- Strategi berbasis **Turtle Trading (trend-following)**, bukan LLM-prediction. LLM dipakai sebagai **filter/reasoning layer**, bukan signal generator utama.
- Framing yang benar: capital growth project dengan variance tinggi (bisa naik bisa turun), bukan gaji/income pasti.
- Tidak ada shortcut ke Fase live trading sebelum backtest + paper trading menunjukkan angka yang masuk akal.
- Kalau ada dorongan untuk "gas modal gede karena udah yakin" atau nambah leverage/martingale — itu red flag, harus direm.

---

## 1. Strategi (Fixed untuk MVP)

| Parameter | Value |
|---|---|
| Pair | BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT, XRP/USDT, AVAX/USDT, LINK/USDT, DOGE/USDT, ADA/USDT, HYPE/USDT (dinaikkan 2→10 pada 2026-08-25, lihat catatan di bawah) |
| Timeframe | 1D (daily candle close) |
| Entry signal | Donchian Channel breakout 20-hari (harga close > highest high 20 hari = long signal) |
| Stop loss | Entry price − (2 × ATR(14)) untuk long |
| Exit / trailing | Breakout arah berlawanan 10-hari, atau trailing stop berbasis ATR |
| Position sizing | Risk 1% dari modal per trade → size = (1% × modal) / stop_distance |
| Direction | Long-only (short & leverage dicoret berbasis riset 2026-08-25: short-only -14%/6th, long-short Sharpe 0.88 < long-only 1.12; laporan `backtest/reports/research/longshort/`) |
| Max concurrent position | 5 (dikombinasikan cluster-limit 2/cluster — efektif maks 2 per cluster korelasi; lihat Cluster-A2 di decision_log.md) |
| Yield idle cash | Simulasi 5% APY di paper cash (config `paper_trading.yield_apy_idle_cash`); risiko platform tidak dimodelkan |

Catatan perubahan 2026-08-25 (berdasarkan riset `backtest/reports/research/capital_efficiency/`, keputusan eksplisit user):
- Pair 2→10 & max concurrent 2→5: return backtest +152%→+862%, Sharpe 1.12→1.44, TAPI DD -15.3%→-58.49% dan mengandung **survivorship bias** (SOL/BNB/XRP dipilih sebagai survivor hari ini + 7 pair lainnya) — angka adalah ekspektasi atas, bukan janji.
- Venue Fase 4: **Bitget Exchange** (API automation + exchange-side stop order; user tidak ingin intervensi manual). Bitget Wallet (self-custody) di-shelve karena tidak mendukung otomasi penuh. Data source paper trading: API publik Bitget (lolos tes dari CI runner 2026-08-25; catatan: api.bitget.com keblokir ISP di jaringan lokal user — jalankan via CI).
- Simulasi yield 5% APY masuk ke paper engine (temuan riset: +58..93pp return dengan nol perubahan strategi).

Catatan: parameter ini **tidak boleh diutak-atik berdasarkan feeling** selama fase backtest awal. Kalau mau tuning, harus berbasis hasil backtest, dicatat alasannya, dan dites ulang.

---

## 2. Fase Eksekusi

### Fase 1 — Backtest Engine (Target: 1-2 minggu)
**Tujuan:** Validasi strategi secara statistik sebelum sentuh uang beneran.

- [ ] Setup environment Python (`ccxt`, `pandas`, `pandas-ta` atau `ta-lib`, `vectorbt` atau `backtrader`)
- [ ] Fetch data historis BTC/USDT & ETH/USDT harian, minimal 3 tahun (kena fase bull, bear, sideways)
- [ ] Implementasi logic: Donchian breakout + ATR stop + position sizing
- [ ] Jalankan backtest, catat metrik:
  - Win rate
  - Risk-reward ratio rata-rata
  - Max drawdown
  - Sharpe / Sortino ratio
  - Total return vs buy-and-hold (benchmark wajib, biar tau strategi ini beneran nambah value atau kalah sama HODL doang)
- [ ] **Decision gate:** kalau Sharpe < threshold (Cluster-A2: 0.82, lihat RULES.md revisi) atau max drawdown > 30%, strategi perlu direvisi/parameter di-tuning ulang sebelum lanjut ke Fase 2. Jangan lanjut kalau angka tidak masuk akal. Riwayat: threshold 1.0 diganti ke > B&H setelah investigasi (lihat decision_log.md).

**Output:** laporan backtest (bisa markdown/notebook) dengan equity curve, drawdown chart, dan tabel metrik.

### Fase 2 — Paper Trading (Target: 4-8 minggu, live market)
**Tujuan:** Validasi bahwa signal engine bekerja di kondisi real-time, bukan cuma di data historis (cek overfitting & slippage assumption).

- [ ] Jalankan signal engine live tapi eksekusi **dummy/log only** (tidak eksekusi order beneran)
- [ ] Bandingkan performa live-paper vs hasil backtest di periode yang sama
- [ ] **Decision gate:** kalau performa live meleset jauh dari backtest (misal win rate turun drastis), investigasi dulu — kemungkinan overfitting, look-ahead bias, atau asumsi fee/slippage yang tidak realistis.

### Fase 3 — LLM Filter Layer (Setelah Fase 2 lolos)
**Tujuan:** Tambahkan reasoning layer untuk mengurangi false positive, bukan generate signal baru.

- [ ] Integrasi DeepSeek API sebagai filter: dipanggil hanya saat ada signal valid dari quant engine (bukan tiap candle, hemat cost)
- [ ] Prompt design: berikan signal + headline/berita terkini + kondisi market, minta DeepSeek identifikasi apakah ada faktor risiko yang kontradiktif (bukan "should I buy?")
- [ ] Log semua reasoning LLM untuk evaluasi berkala apakah filter ini benar-benar menambah value (bandingkan win rate dengan-tanpa filter LLM)

### Fase 4 — Live Execution (Modal kecil, bertahap)
**Tujuan:** Live trading dengan modal riil setelah Fase 1-3 menunjukkan hasil yang konsisten.

- [ ] Mulai dengan modal kecil (contoh: $50-100), bukan seluruh modal yang tersedia
- [ ] Risk manager wajib aktif: max 1% risk per trade, hard stop loss di setiap order (bukan mental stop loss)
- [ ] Circuit breaker: kalau drawdown menyentuh threshold tertentu (misal -15% dari modal awal), sistem auto-pause dan kirim notifikasi, tidak auto-lanjut tanpa review manual
- [ ] Evaluasi mingguan/bulanan: bandingkan performa live vs backtest vs paper trading

---

## 3. Arsitektur Teknis

> **Catatan pembaca (2026-09-22):** diagram di bawah adalah **target end-state seluruh fase**
> (termasuk Fase 3/4 yang belum ada). Yang **berjalan hari ini** hanya:
> Data → Signal Engine → Risk Manager → Logger+DB → Monitoring (tanpa LLM filter, tanpa
> execution engine) + jalur produk web. Diagram fakta sistem aktual ada di
> [`ARCHITECTURE.md`](ARCHITECTURE.md).

```
┌─────────────────┐
│  Data Ingestion  │  ← ccxt (harga OHLCV Bitget, publik tanpa API key)
└────────┬─────────┘
         │
┌────────▼─────────┐
│  Signal Engine    │  ← Python: Donchian breakout, ATR calc, position sizing
│  (Python)         │
└────────┬─────────┘
         │ raw signal (BUY/SELL/HOLD + confidence)
┌────────▼─────────┐
│  LLM Filter Layer │  ← DeepSeek API — FASE 3, NONAKTIF (skeleton di llm_filter/filter.py)
└────────┬─────────┘
         │ approved signal (saat ini: signal apa adanya, filter dilewati)
┌────────▼─────────┐
│  Risk Manager      │  ← position sizing, max drawdown limit, SL wajib
└────────┬─────────┘
         │
┌────────▼─────────┐
│  Execution Engine  │  ← Python + ccxt → exchange API  (FASE 4, GATED — belum ada kode)
│  (belum ada)       │     idempotent order, retry logic
└────────┬─────────┘
         │
┌────────▼─────────┐
│  Logger + DB        │  ← SQLite (paper, AKTIF) + PostgreSQL via Supabase (web produk, AKTIF)
└────────┬─────────┘
         │
┌────────▼─────────┐
│  Monitoring         │  ← Telegram alert (entry/exit/crash) + web dashboard Next.js
└─────────────────────┘
```

### Stack per Fase
| Fase | Tools |
|---|---|
| Fase 1 (backtest) | Python, `ccxt`, `pandas` — **aktual: indikator murni pandas**; `vectorbt`/`backtrader` tidak pernah dipakai |
| Fase 2 (paper trading) | Python (sama seperti fase 1) + scheduler GitHub Actions + SQLite untuk log — **aktif** |
| Fase 3 (LLM filter) | DeepSeek API, prompt template terpisah dari signal logic — **belum dikerjakan** |
| Fase 4 (live) | **Python** + `ccxt` (eksekusi — amendemen 2026-09-11 di bawah), SQLite; PostgreSQL via Supabase sudah dipakai produk web; Redis (kalau perlu decouple signal→execution), Telegram Bot API (notifikasi) |
| Deployment | **Aktual:** Vercel (web) + Supabase cloud (DB) + GitHub Actions (scheduler). **Rencana cutover:** VPS kecil (Contabo/DigitalOcean, ~$10-20/bulan), Docker untuk isolasi environment — file ada di `deploy/`, belum pernah dijalankan (`deploy/RUNBOOK.md`) |

**Amendemen 2026-09-11 (riset stack Fase 4, persetujuan owner):** eksekusi live **tetap Python** (`ccxt` sama, API identik di semua bahasa; rewrite Node/TS menambah runtime + risiko drift sizing/SL tanpa menambah kemampuan). Baris "Node.js" di atas diganti Python. Ini amendemen stack, BUKAN izin implementasi — kode order riil tetap dilarang sebelum gate Fase 2 lolos (AGENTS.md aturan 3–4).

### Envelope desain Fase 4 (dikunci, implementasi menyusul gate)

- Paritas paper/live: engine sama (`paper_trading/live_signal.py`), flip = `execution.mode`; reconciler 15 menit sebagai service terpisah dari sinyal harian.
- Stop berlapis: exchange-side (WAJIB verifikasi programatik `featureValue(...,"stopLossPrice")` + uji dust saat dry-run; klaim tidak boleh jadi asumsi — riset 2026-09-11: stop spot Bitget memakai plan/trigger order dengan aturan param sendiri) + reconciler market-exit sebagai fallback. Reconciler tracking via `fetchOpenOrders` (ID stop baru saat terpicu).
- Circuit breaker 15% → auto-pause + Telegram, resume manual; kill-switch global.
- Dry-run = jalur kode live penuh + paper money; uji dust hanya untuk verifikasi stop spot.
- Modal sendiri $50–100, spot only; key trade-no-withdraw + whitelist IP VPS.
- Stop menjamin exit attempt, bukan harga — slippage gap tetap ada (masuk disclaimer produk).

---

## 4. Struktur Folder (AKTUAL — diperbarui 2026-09-22; usulan lama di repo history & `REPO_MAP.md` §12)

```
TrendSentry/
├── PLAN.md AGENTS.md RULES.md TASKS.md AUDIT.md          # governance
├── ARCHITECTURE.md REPO_MAP.md README.md                 # fakta arsitektur & audit
├── config.yaml                    # SOURCE OF TRUTH parameter strategi + risk + paper
├── requirements.txt / requirements-engine.txt
├── cli.py                         # CLI lokal: backtest|paper|live --dry-run|watcher|doctor
├── backtest/
│   ├── strategy.py                # Donchian/ATR/SMA/RSI + position_size + cluster limit
│   ├── run_backtest.py            # simulasi portfolio + metrics + report
│   ├── DESIGN.md                  # desain backtest
│   ├── research/                  # 7 script riset (manual, di luar CI)
│   └── reports/                   # metrics.md, decision_log.md, presets/, research/
├── paper_trading/
│   └── live_signal.py             # engine paper harian
├── risk_manager/
│   └── guards.py                  # validate_config + CircuitBreaker (+ re-export sizing)
├── llm_filter/
│   └── filter.py                  # kontrak Fase 3 (skeleton, nonaktif)
├── monitoring/
│   ├── telegram_alert.py          # alert Telegram (Python)
│   └── web/                       # produk web Next.js 16 + Supabase (lihat monitoring/web/README.md)
├── scripts/                       # fetch_bitget_data, sync_paper_to_supabase, compare_live_vs_backtest
├── presets/                       # 3 preset beku (donchian/sma/rsi)
├── db/                            # schema.sql + paper_trading.db (di-commit) + backup_db.sh
├── supabase/                      # config.toml + migrations/ = SOURCE OF TRUTH skema Postgres
├── deploy/                        # persiapan VPS/Coolify (belum pernah dijalankan)
├── .github/workflows/             # paper-trading, trendsentry-daily-sync, fetch-bitget-data, test-bitget-api
├── data/historical/ (10 pair + sisa riset)  data/funding/ (riset)
└── tests/                         # 8 file pytest, 64 test
```

> Struktur lama (`execution/`, `llm_filter/deepseek_client.py`, `risk_manager/position_sizing.py`,
> `monitoring/telegram_bot.py`) **tidak pernah ada di kode** — jangan dipakai sebagai referensi path.

---

## 5. Risk Rules (Non-negotiable)

1. Risk per trade **maksimal 1%** dari modal — tidak boleh dinaikkan tanpa hasil backtest yang mendukung.
2. Stop loss **wajib** di setiap order, tidak ada "mental stop loss".
3. Tidak ada martingale / averaging down untuk menutupi loss.
4. Tidak ada leverage tinggi di Fase 4 awal — spot atau leverage rendah (max 2x) kalau pakai futures.
5. Circuit breaker wajib aktif sebelum live trading dengan modal riil.
6. Setiap perubahan parameter strategi harus dicatat alasan + hasil backtest ulang, tidak berdasarkan feeling setelah beberapa trade loss/win.
7. Evaluasi berkala (mingguan) wajib — kalau performa live jauh di bawah ekspektasi backtest 2-3 minggu berturut-turut, pause dan investigasi, jangan terus jalan berharap "membaik sendiri".

---

## 6. Next Immediate Action

- [x] Setup environment lokal (Python + `ccxt` + `pandas` + `vectorbt`)
- [x] Fetch data historis BTC/USDT & ETH/USDT (6 tahun, daily)
- [x] Implementasi `backtest/strategy.py` (Donchian breakout + ATR sizing)
- [x] Jalankan backtest pertama, bandingkan dengan buy-and-hold benchmark
- [x] Review hasil — **decision gate diperdebatkan (Sharpe 1.06 config 2-pair Binance — TIDAK reproducible dengan Bitget 10-pair). Cluster-A2 final: Sharpe 0.82, DD -26.19% — gate: Sharpe > B&H terpenuhi, DD < 30% terpenuhi. Lihat decision_log.md.**
- [x] Jalankan paper trading (Fase 2 aktif sejak 2026-08-25)
- [ ] **Saat ini:** Tunggu 8 minggu paper trading + ≥10 trade tertutup → evaluasi Fase 2
- [x] **Keputusan 2026-09-10 (dicatat atas persetujuan owner):** Fase 2 tetap evaluasi **harian** — tidak ada cek stop intraday/per-jam di paper. Window ~24 jam tanpa proteksi diterima sadar (modal riil Rp 0; exit telat = data slippage, bukan kerugian). Proteksi realtime (**exchange-side stop order** + circuit breaker) disyaratkan sebagai **syarat masuk Fase 4**, bukan dibangun di paper. Sizing (risk 1%, maks 5 posisi, cluster limit) adalah satu-satunya pelindung dari gap risk.

---

## 7. Catatan Jujur

- Tidak ada strategi yang pasti profit. Turtle-style trend-following punya track record panjang, tapi tetap ada periode losing streak panjang yang normal secara statistik.
- Tujuan proyek ini: sistem yang **terukur dan bisa di-debug**, bukan black-box yang "kelihatan pintar".
- Kalau backtest menunjukkan hasil yang terlalu bagus (win rate >70%, drawdown minim) — curigai overfitting/look-ahead bias sebelum senang duluan.
- **Concentration of returns (dictatat 2026-08-14, hasil backtest 6 tahun):** top-5 trade = ~100% dari net pnl; trade #1 (BTC Okt 2020→Mar 2021) = 45% dari total. Ini normal untuk trend-following (distribusi fat-tailed, sedikit winner gede yang carry semua), tapi konsekuensinya: Sharpe 0.82 Cluster-A2 dari 94 trade punya confidence interval lebar (real-nya bisa 0.5-1.1), dan kalau supertrend seperti 2020-21 tidak terjadi di masa depan, performa bisa jauh lebih flat. Jangan overconfident dari angka Sharpe — edge-nya terletak pada potong loss cepat + biarkan winner jalan, bukan pada presisi metrik. Riwayat: Sharpe 1.06 dari 2-pair Binance (commit 8cc0012) tidak reproducible — valid data sekarang adalah Bitget 10-pair Cluster-A2 dengan Sharpe 0.82.
- **Starting-drawdown context (dictatat 2026-08-14):** paper trading dimulai Aug 2026, kondisi market saat start tidak diketahui di depan. Kalau beberapa minggu pertama flat/loss, itu bisa jadi normal (frekuensi trade rendah, periode tanpa entry lama, atau sedang downtrend). Jangan menilai strategi dari window awal — ikuti kriteria sukses Fase 2 di `TASKS.md`, evaluasi hanya setelah ≥10 trade tertutup. Sebaliknya, kalau profit besar di awal — itu juga belum membuktikan apa-apa secara statistik.

---

## 8. Web Monitoring Dashboard (tambahan 2026-08-25, request eksplisit user)

- **Status:** tambahan di luar scope PLAN awal — diminta user untuk monitoring visual.
  Murni display layer, TIDAK menyentuh signal engine. **Sudah berkembang** menjadi produk
  web (auth, strategi user, API key read-only, deviasi, discipline score) — lihat amendemen §9.
- **Stack (AKTUAL, diperbarui 2026-09-22):** Next.js **16 App Router, server-rendered** di
  Vercel Hobby + Tailwind + Recharts + **Supabase (Auth + Postgres)**, di `monitoring/web/`.
  **Bukan static export** — tidak ada `output: export`, semua route data `ƒ dynamic`.
- **Data flow (AKTUAL):** engine CI commit `db/paper_trading.db` (persistensi state +
  backup off-disk) → `scripts/sync_paper_to_supabase.py` POST inkremental ke
  `/api/cron/paper-sync` (Bearer CRON_SECRET, watermark) → tabel `paper_*` di Supabase →
  **web membaca Supabase saat request** (bukan saat build; web tidak pernah membaca SQLite).
  Equity curve dari `paper_equity_log` (total=cash+MTM, venue tunggal Bitget).
  Harga realtime & unrealized PnL via proxy Bitget `/api/prices` — **REST polling 3 detik
  dari browser (bukan WebSocket)**.
- **Isi:** health/gap detection (kriteria checkpoint), open positions + live PnL, equity curve, trade history, slippage real vs asumsi, win rate/avg R vs referensi backtest (dengan gate "evaluasi setelah ≥10 trade").
- Detail route & batas keamanan: `monitoring/web/README.md` + `monitoring/web/AGENTS.md`;
  diagram penuh: `ARCHITECTURE.md` §8-§9.

---

## 9. Model Bisnis & Produk (dikunci 2026-09-11, persetujuan owner)

Tiga batas keras (non-negotiable, sejajar Section 5):

1. **Tidak jual sinyal** — tidak ada sinyal keluar dari server TrendSentry. Semua dihitung lokal di mesin user dari config yang dia pilih sendiri. (Alasan: risiko kasus hukum.)
2. **Tidak pegang dana/key user** — API key exchange hanya hidup di `.env` mesin user, tidak pernah transit ke server kita. Dana tidak transit, withdrawal tidak pernah diminta.
3. **User memakai sistem dengan membayar** — yang dijual = penggunaan sistem, bukan sinyal, bukan pengelolaan dana.

Bentuk produk (gaya OpenCode: inti gratis, uang dari layanan terukur):

- **CLI gratis penuh** (`trendsentry backtest | paper | live --dry-run | live | watcher | doctor`), UI Rich bertahap → TUI penuh menyusul. Engine headless-testable. Watcher-lokal ikut v1. Tidak ada license-lock.
- **Satu-satunya yang berbayar: LLM filter API** (Fase 3) — proprietary server-side (prompt/model/threshold berversi, tanpa endpoint custom). Kontrak sempit: terima konteks sinyal non-rahasia → kembalikan veto/flag + faktor risiko + reasoning, tidak pernah "buy/sell". Opt-in, bypassable — live-runner tetap jalan penuh tanpanya.
- **Preset pack gratis** (config contoh + artefak backtest publik, label edukasi/bukan rekomendasi): ① Donchian/Cluster-A2 (ada) ② SMA crossover ③ RSI mean-reversion (adaptasi long-only). Semua preset: long-only spot 1D + SL wajib. Syarat tayang per preset = backtest 6 thn Bitget 10 pair + metrik penuh + ≥30 trade + gate (Sharpe > B&H, DD < 30%); preset gagal dipublikasikan sebagai "tidak lolos".
- **Harga filter:** langganan akses + fair use (bukan per-call — sinyal ≈1/23 hari lintas pair). Patokan dari data dogfood: median 1R yang dihindari ÷ 10. Trial 5 verdict live gratis; paper + filter-di-paper gratis selamanya. Bayar dinyalakan HANYA setelah Fase 3 membuktikan value (dengan vs tanpa filter, dipublikasikan); netral/negatif = hipotesis gugur.
- Dibuang eksplisit: data API, alert relay, cloud sync, preset berbayar, eksekusi cloud kustodian (trade-key di server kita = dicoret).

**Amendemen 2026-09-11 (dual-path web/CLI, persetujuan owner):**
- **Web = logging + deviasi saja.** Server boleh menyimpan API key **read-only** user (terenkripsi) untuk fetch fills + deteksi deviasi + dashboard. Web tidak punya dan tidak akan pernah punya jalur order (terverifikasi audit 2026-09-11).
- **CLI = logging + deviasi + otomasi.** Live-runner hanya didistribusikan sebagai CLI; key trade hanya hidup di mesin user. Tanggung jawab eksekusi di user.
- Syarat mutlak sebelum user eksternal masuk: validasi read-only saat submit key (tolak key berizin trade/withdraw) + kode server hanya boleh memanggil endpoint read (fills/assets).
