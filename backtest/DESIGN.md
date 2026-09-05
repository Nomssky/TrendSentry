# DESAIN BACKTEST — TrendSentry

> Rancangan desain backtest engine yang dipakai di proyek ini.
> Referensi kode: `backtest/strategy.py` (single source of truth), `backtest/run_backtest.py` (simulator).

---

## 1. Arsitektur Inti

```
backtest/
├── strategy.py              # Single source of truth (reused backtest + paper trading)
├── run_backtest.py          # Portfolio simulation engine
├── fetch_data.py            # Data fetcher (Binance mirror)
├── research/                # Research scripts (long-short, capital efficiency)
├── reports/                 # Output: equity curve, trades, metrics, charts
│   ├── metrics.md
│   ├── equity_curve.csv
│   ├── equity_drawdown.png
│   ├── trades.csv
│   └── research/
│       ├── longshort/
│       └── capital_efficiency/
└── tests/                   # Unit tests (position sizing, ATR, Donchian)
```

---

## 2. Strategi — Donchian 20/10 + ATR(14)×2

| Komponen | Detail |
|---|---|
| **Pair** | BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT, XRP/USDT, AVAX/USDT, LINK/USDT, DOGE/USDT, ADA/USDT, HYPE/USDT |
| **Timeframe** | 1D (daily candle close) |
| **Entry** | Close > Highest High 20 hari SEBELUMNYA (Donchian di-shift 1, anti look-ahead) |
| **Exit** | Close < Lowest Low 10 hari sebelumnya, atau Close ≤ Stop Loss |
| **Stop Loss** | Entry − 2× ATR(14) |
| **Position Sizing** | Risk 1% equity ÷ (Entry − Stop), capped di equity/entry (spot, no leverage) |
| **Direction** | Long-only (short & leverage dicoret berbasis riset 2026-08-25) |
| **Max Concurrent Positions** | 5 |
| **Fee** | 0.1% taker |
| **Slippage** | 0.05% |

---

## 3. Anti Look-Ahead — Cara Kerja

```python
# strategy.py — Donchian di-shift(1), exclude hari ini
def donchian_high(df, period):
    return df["high"].rolling(period).max().shift(1)

def donchian_low(df, period):
    return df["low"].rolling(period).min().shift(1)
```

Prinsip: breakout dicek terhadap data **20 hari sebelumnya**, bukan hari ini. Eksekusi dilakukan di **open hari berikutnya** (backtest) atau **live price saat script jalan** (paper trading) — keduanya tidak pakai data yang belum tersedia.

```python
# run_backtest.py — Entry dicek dari close KEMARIN, eksekusi di OPEN hari ini
prev = df.iloc[i - 1]
if prev["close"] > prev["don_hi"]:                        # sinyal dari candle kemarin
    entry_price = df["open"].iloc[i] * (1 + slip)         # eksekusi di open besok
    stop = prev["close"] - atr_stop_multiplier * prev["atr"]
```

---

## 4. Simulasi Portfolio — run_backtest.py

### 4.1 Alur Utama

```
Untuk setiap tanggal (sorted union semua pair):
  │
  ├─ Untuk setiap pair:
  │   ├─ Jika ada posisi terbuka → cek EXIT
  │   │   ├─ Close ≤ Stop → exit di close, fee + slippage
  │   │   ├─ Close < DonLow(10) → exit di close
  │   │   └─ Open ≤ Stop (gap) → exit di open
  │   │
  │   └─ Jika tidak ada posisi → cek ENTRY
  │       └─ Close kemarin > DonHigh(20) → entry di open, hitung sizing
  │
  └─ Hitung mark-to-market equity
      equity = cash + Σ(units × close) untuk semua posisi terbuka
```

### 4.2 Tiga Path Exit

| Path | Trigger | Harga Exit | Keterangan |
|---|---|---|---|
| Normal exit | Close ≤ Stop ATAU Close < DonLow(10) | Close hari itu | Konsisten dengan backtest awal |
| Entry | Close kemarin > DonHigh(20) | Open hari ini | Anti look-ahead |
| Gap stop | Open ≤ Stop | Open hari ini | Gap down langsung exit |

### 4.3 Fee & Slippage Model

```python
# Entry
entry_price = df["open"].iloc[i] * (1 + slip)
cost = units * entry_price * (1 + fee)

# Exit (normal)
proceeds = p["units"] * close * (1 - fee - slip)

# Exit (gap stop)
proceeds = p["units"] * df["open"].iloc[i] * (1 - fee - slip)

# PnL
pnl = proceeds - p["units"] * p["entry"]
r_multiple = pnl / p["risk_amount"]
```

- Fee: 0.1% taker (configurable via `config.yaml`)
- Slippage: 0.05% (configurable)
- Keduanya dibebankan di **setiap transaksi** (entry + exit)
- Slippage real diukur terpisah via order book spread → tabel `slippage_log`

### 4.4 Position Sizing

```python
def position_size(equity, entry_price, stop_price, risk_pct):
    risk_amount = equity * risk_pct / 100.0
    stop_distance = entry_price - stop_price
    units = risk_amount / stop_distance
    max_units = equity / entry_price          # spot, no leverage
    return min(units, max_units)              # capped by equity
```

- Risk per trade: **maksimal 1%** dari modal
- Stop distance: `entry - (2 × ATR(14))`
- Max units dibatasi oleh equity (spot, tidak bisa beli lebih dari yang dimiliki)

---

## 5. Multi-Pair Portfolio

- **10 pair**: BTC, ETH, SOL, BNB, XRP, AVAX, LINK, DOGE, ADA, HYPE
- **Max 5 concurrent positions**
- Cash alokasi per posisi: `risk 1% × equity ÷ stop_distance`
- Sisa cash idle (di paper trading: kredit yield 5% APY per hari)
- Setiap pair independen, tidak ada rebalancing

---

## 6. Metrik yang Dihitung

| Metrik | Formula/Notes |
|---|---|
| Win rate | `% trade dengan PnL > 0` |
| Avg R multiple | `PnL ÷ risk_amount`, rata-rata semua trade |
| Avg win R | `PnL ÷ risk_amount` rata-rata untuk trade menang |
| Avg loss R | `PnL ÷ risk_amount` rata-rata untuk trade kalah |
| Profit factor | `Total win ÷ abs(total loss)` |
| Max drawdown | Peak-to-trough equity (% dari peak) |
| Sharpe ratio | `daily_mean / daily_std × √365` |
| Sortino ratio | `daily_mean / downside_std × √365` |
| CAGR | `(final_equity / initial) ^ (1/years) - 1` |
| Buy-and-hold benchmark | Equal-weight allocation, same pairs, same period |
| Return vs B&H | Delta antara strategy dan benchmark |

### 6.1 Referensi Backtest (10-pair, 6 tahun)

| Metrik | Nilai |
|---|---|
| Win rate | 33.72% |
| Avg win R | +3.59 |
| Avg loss R | -0.89 |
| Avg R | +0.62 |
| Profit factor | 1.68 |
| Max drawdown | -58.49% |
| Total return | +155.56% |
| Trades | 172 |
| Trades/year | ~28.7 |
| Sharpe | ~1.06 |

---

## 7. Data

| Parameter | Value |
|---|---|
| Timeframe | 1D (daily candle close) |
| Lookback | 6 tahun (2020-08 → 2026-08) |
| Source | Bitget OHLCV via `scripts/fetch_bitget_data.py` |
| Buffer | 60 candles minimum (inisialisasi ATR(14) + Donchian(20) + margin) |
| Format | CSV per pair di `data/historical/` |

---

## 8. Backtest vs Paper Trading — Inkonsistensi yang Diketahui

| Aspek | Backtest | Paper Trading | Catatan |
|---|---|---|---|
| Entry price | Open hari setelah sinyal | Live price saat script jalan | Paper lebih konservatif (gap bisa lebih besar) |
| Stop distance | Close kemarin − 2×ATR | Close candle − 2×ATR | Sama |
| Slippage model | 1× fee + slip di proceeds | 1× fee + slip (setelah fix 2026-09-04) | Sudah konsisten |
| Data source | Bitget historical CSV | Bitget API real-time | Sama venue |

---

## 9. Unit Test Coverage

| Test | Path Kritis |
|---|---|
| `test_basic_risk_based` | Position sizing: 1% × equity ÷ stop_distance |
| `test_capped_by_equity` | Max units = equity/entry (spot, no leverage) |
| `test_invalid_stop_raises` | Stop ≥ entry → ValueError |
| `test_constant_range` | ATR Wilder smoothing, seed dengan SMA |
| `test_tracks_volatility` | ATR naik saat volatilitas naik |
| `test_no_lookahead` | Donchian exclude hari ini (shift 1) |
| `test_donchian_low` | Lowest low correctness |

---

## 10. Guardrails

- **Parameter tidak boleh diutak-atik berdasarkan feeling** — harus berbasis backtest, dicatat alasannya
- **Benchmark wajib** — strategi harus dikomparasi dengan buy-and-hold
- **Decision gate**: Sharpe < 1 atau max DD > 30% → revisi sebelum lanjut Fase 2
- **No overfitting**: kalau hasil terlalu bagus (win rate >70%, drawdown minim) → curigai look-ahead/overfitting
- **Concentration of returns**: top-5 trade ≈ 100% dari net pnl — normal untuk trend-following
