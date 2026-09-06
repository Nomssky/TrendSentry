# PLAN.md — Crypto Trend-Following Bot (Personal Use)

> Status: Fase 2 — Paper Trading aktif (sejak 2026-08-25, hari ke-11/56).
> Tujuan: Capital growth jangka panjang, modal kecil, bukan sumber income rutin.
> Prinsip: Business first, risk-managed, no overengineering, MVP-driven.

---

## 0. Konteks & Prinsip Dasar

- Ini **bukan** proyek untuk dijual/dikomersialkan. Pure personal use.
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

```
┌─────────────────┐
│  Data Ingestion  │  ← ccxt (harga OHLCV), RSS/news API (untuk LLM filter)
└────────┬─────────┘
         │
┌────────▼─────────┐
│  Signal Engine    │  ← Python: Donchian breakout, ATR calc, position sizing
│  (Python)         │
└────────┬─────────┘
         │ raw signal (BUY/SELL/HOLD + confidence)
┌────────▼─────────┐
│  LLM Filter Layer │  ← DeepSeek API (Fase 3+), sanity-check risiko
└────────┬─────────┘
         │ approved signal
┌────────▼─────────┐
│  Risk Manager      │  ← position sizing, max drawdown limit, SL wajib
└────────┬─────────┘
         │
┌────────▼─────────┐
│  Execution Engine  │  ← Node.js + ccxt → exchange API
│  (Node.js, Fase 4)  │     idempotent order, retry logic
└────────┬─────────┘
         │
┌────────▼─────────┐
│  Logger + DB        │  ← PostgreSQL/SQLite: setiap trade, signal, reasoning
└────────┬─────────┘
         │
┌────────▼─────────┐
│  Monitoring         │  ← Telegram bot alert (entry/exit/circuit breaker)
└─────────────────────┘
```

### Stack per Fase
| Fase | Tools |
|---|---|
| Fase 1 (backtest) | Python, `ccxt`, `pandas`, `vectorbt`/`backtrader`, Jupyter/script |
| Fase 2 (paper trading) | Python (sama seperti fase 1) + scheduler (cron/APScheduler) + SQLite untuk log |
| Fase 3 (LLM filter) | DeepSeek API, prompt template terpisah dari signal logic |
| Fase 4 (live) | Node.js + `ccxt` (eksekusi), PostgreSQL (kalau butuh lebih robust dari SQLite), Redis (kalau perlu decouple signal→execution), Telegram Bot API (notifikasi) |
| Deployment | VPS kecil (Contabo/DigitalOcean, ~$10-20/bulan), Docker untuk isolasi environment |

---

## 4. Struktur Folder (usulan)

```
crypto-trend-bot/
├── PLAN.md
├── AGENTS.md                 # instruksi eksekusi untuk coding agent
├── data/
│   └── historical/           # cache data OHLCV hasil fetch
├── backtest/
│   ├── strategy.py           # logic Donchian + ATR
│   ├── run_backtest.py
│   └── reports/              # output equity curve, metrik
├── paper_trading/
│   ├── live_signal.py
│   └── logs/
├── llm_filter/
│   ├── deepseek_client.py
│   └── prompts/
├── execution/                 # Fase 4, Node.js
│   ├── src/
│   └── package.json
├── risk_manager/
│   └── position_sizing.py
├── db/
│   └── schema.sql
└── monitoring/
    └── telegram_bot.py
```

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

---

## 7. Catatan Jujur

- Tidak ada strategi yang pasti profit. Turtle-style trend-following punya track record panjang, tapi tetap ada periode losing streak panjang yang normal secara statistik.
- Tujuan proyek ini: sistem yang **terukur dan bisa di-debug**, bukan black-box yang "kelihatan pintar".
- Kalau backtest menunjukkan hasil yang terlalu bagus (win rate >70%, drawdown minim) — curigai overfitting/look-ahead bias sebelum senang duluan.
- **Concentration of returns (dictatat 2026-08-14, hasil backtest 6 tahun):** top-5 trade = ~100% dari net pnl; trade #1 (BTC Okt 2020→Mar 2021) = 45% dari total. Ini normal untuk trend-following (distribusi fat-tailed, sedikit winner gede yang carry semua), tapi konsekuensinya: Sharpe 0.82 Cluster-A2 dari 94 trade punya confidence interval lebar (real-nya bisa 0.5-1.1), dan kalau supertrend seperti 2020-21 tidak terjadi di masa depan, performa bisa jauh lebih flat. Jangan overconfident dari angka Sharpe — edge-nya terletak pada potong loss cepat + biarkan winner jalan, bukan pada presisi metrik. Riwayat: Sharpe 1.06 dari 2-pair Binance (commit 8cc0012) tidak reproducible — valid data sekarang adalah Bitget 10-pair Cluster-A2 dengan Sharpe 0.82.
- **Starting-drawdown context (dictatat 2026-08-14):** paper trading dimulai Aug 2026, kondisi market saat start tidak diketahui di depan. Kalau beberapa minggu pertama flat/loss, itu bisa jadi normal (frekuensi trade rendah, periode tanpa entry lama, atau sedang downtrend). Jangan menilai strategi dari window awal — ikuti kriteria sukses Fase 2 di `TASKS.md`, evaluasi hanya setelah ≥10 trade tertutup. Sebaliknya, kalau profit besar di awal — itu juga belum membuktikan apa-apa secara statistik.

---

## 8. Web Monitoring Dashboard (tambahan 2026-08-25, request eksplisit user)

- **Status:** tambahan di luar scope PLAN awal — diminta user untuk monitoring visual. Murni read-only, TIDAK menyentuh signal engine.
- **Stack:** Next.js 16 static export + Tailwind + Recharts, di `monitoring/web/`, deploy ke Vercel Hobby (gratis).
- **Data flow:** bot CI commit `db/paper_trading.db` harian → Vercel auto-redeploy → DB dibaca saat build (bukan runtime). Harga BTC/ETH & unrealized PnL = realtime via Binance public WebSocket dari browser.
- **Isi:** health/gap detection (kriteria checkpoint), open positions + live PnL, equity curve, trade history, slippage real vs asumsi, win rate/avg R vs referensi backtest (dengan gate "evaluasi setelah ≥10 trade").
