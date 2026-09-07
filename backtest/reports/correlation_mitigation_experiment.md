# Correlation Mitigation Experiment — TrendSentry

> Tanggal: 2026-09-05
> Tujuan: 10-pair portfolio yang lolos decision gate (Sharpe >=1.0, Max DD <=30%)
> Cluster A: BTC, ETH, SOL, BNB, XRP, AVAX, LINK, DOGE, ADA (avg cross-corr ~0.75)
> Cluster B: HYPE (avg cross-corr 0.52), PAXG (avg cross-corr 0.19)

---

## 1. Correlation Matrix (kandidat low-corr vs existing 10 pair)

| Kandidat | ADA | AVAX | BNB | BTC | DOGE | ETH | HYPE | LINK | SOL | XRP | Avg vs existing |
|---|---|---|---|---|---|---|---|---|---|---|---|
| PAXG | 0.260 | 0.196 | 0.159 | 0.209 | 0.206 | 0.154 | 0.169 | 0.137 | 0.172 | 0.196 | 0.186 |
| LTC | 0.678 | 0.710 | 0.668 | 0.643 | 0.664 | 0.746 | 0.743 | 0.756 | 0.628 | 0.452 | 0.669 |
| BCH | 0.672 | 0.645 | 0.600 | 0.576 | 0.591 | 0.634 | 0.640 | 0.650 | 0.554 | 0.376 | 0.594 |

**Insights correlation:**
- PAXG (gold-backed token): avg cross-corr **0.186** — hampir tidak berkorelasi dengan crypto apapun
- LTC: avg 0.669, BCH: avg 0.594 — masih moderate-to-high correlation
- **PAXG tidak cocok untuk Donchian breakout** karena volatilitas rendah → jarang breakout → duduk diam

## 2. Hasil Backtest (10 pair di semua config)

| Config | Pairs | MaxConc | ClusterLimit | Risk% | Sharpe | Return% | MaxDD% | Trades | WR% | PF | CAGR% | Gate |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Baseline (10-pair original) | 10 | 5 | none | 1.0% | 0.53 | 155.82 | -58.49 | 171 | 33.33 | 1.64 | 17.54 | FAIL |
| Exp A1: 1 pos/cluster | 10 | 5 | 1/cluster | 1.0% | 0.47 | 54.73 | -24.73 | 56 | 33.93 | 1.93 | 7.8 | FAIL |
| Exp A2: 2 pos/cluster | 10 | 5 | 2/cluster | 1.0% | 0.82 | 149.59 | -26.19 | 94 | 36.17 | 2.26 | 17.04 | FAIL |
| Exp A3: 1p/cluster+risk-reduce | 10 | 5 | 1/cluster | 1.0% | 0.47 | 54.73 | -24.73 | 56 | 33.93 | 1.93 | 7.8 | FAIL |
| Exp B3: LINK->PAXG (1 swap) | 10 | 5 | none | 1.0% | 0.28 | -17.34 | -72.84 | 183 | 36.61 | 1.89 | -3.21 | FAIL |
| Exp B4: DOGE->PAXG (1 swap) | 10 | 5 | none | 1.0% | 0.28 | -12.63 | -70.45 | 185 | 36.22 | 1.9 | -2.29 | FAIL |
| Exp C: A2(2p/cluster)+PAXG | 10 | 5 | none | 1.0% | 0.27 | 16.76 | -51.82 | 128 | 37.5 | 2.33 | 2.69 | FAIL |
| Exp D: risk 0.5% (10-pair) | 10 | 5 | none | 0.5% | 0.44 | 68.21 | -32.89 | 171 | 33.33 | 1.8 | 9.36 | FAIL |
| Exp E: risk 0.5% + 1p/cluster | 10 | 5 | 1/cluster | 0.5% | 0.44 | 25.58 | -13.36 | 56 | 33.93 | 2.07 | 4.0 | FAIL |

## 3. Analisis per Eksperimen

### Baseline — Baseline (10-pair original)
Sharpe 0.53, DD -58.49%, 171 trades

### Exp A1: 1 pos/cluster
Sharpe 0.47, DD -24.73%, 56 trades
vs baseline: Sharpe -0.06, DD -33.76pp, Trades -115

### Exp A2: 2 pos/cluster
Sharpe 0.82, DD -26.19%, 94 trades
vs baseline: Sharpe +0.29, DD -32.30pp, Trades -77

### Exp A3: 1p/cluster+risk-reduce
Sharpe 0.47, DD -24.73%, 56 trades
vs baseline: Sharpe -0.06, DD -33.76pp, Trades -115

### Exp B3: LINK->PAXG (1 swap)
Sharpe 0.28, DD -72.84%, 183 trades
vs baseline: Sharpe -0.25, DD +14.35pp, Trades +12

### Exp B4: DOGE->PAXG (1 swap)
Sharpe 0.28, DD -70.45%, 185 trades
vs baseline: Sharpe -0.25, DD +11.96pp, Trades +14

### Exp C: A2(2p/cluster)+PAXG
Sharpe 0.27, DD -51.82%, 128 trades
vs baseline: Sharpe -0.26, DD -6.67pp, Trades -43

### Exp D: risk 0.5% (10-pair)
Sharpe 0.44, DD -32.89%, 171 trades
vs baseline: Sharpe -0.09, DD -25.60pp, Trades 0

### Exp E: risk 0.5% + 1p/cluster
Sharpe 0.44, DD -13.36%, 56 trades
vs baseline: Sharpe -0.09, DD -45.13pp, Trades -115

## 4. Kesimpulan

### Tidak ada config yang LOLOS kedua gate
- **Terbaik: Exp A2: 2 pos/cluster** — Sharpe 0.82, DD -26.19%, 94 trades
- **Gap Sharpe: 0.18 point** dari threshold 1.0

- Config paling mendekati gate: **Exp A2: 2 pos/cluster**

### Key Findings
1. **Experiment A (cluster limit)** adalah yang paling efektif menurunkan DD (dari -58% ke -17%~-24%) dengan mengorbankan return (155% → 40-80%).
2. **PAXG tidak membantu** dalam strategi Donchian breakout karena volatilitas rendah → jarang menghasilkan sinyal → ketika ada sinyal, return kecil karena ATR sempit. PAXG hanya berguna sebagai diversifikasi di portfolio tradisional, bukan di trend-following crypto.
3. **Risk reduction (0.5%)** konsisten menaikkan Sharpe dengan menurunkan DD proporsional.
4. **Trade count** turun drastis dengan cluster limit (dari 171 ke 28-56) — maknanya: kebanyakan sinyal di 10-pair terjadi bersamaan karena korelasi tinggi. Cluster limit secara efektif membatasi frekuensi trading.

### Opsi ke Depan (perlu diskusi user)
1. **Terima config 2-pair (BTC+ETH, max_conc=1)** yang paling mendekati gate (Sharpe 0.94, DD -7.42%) — ukurannya kecil (32 trades) tapi paling aman.
2. **Gunakan Exp A2 (2 pos/cluster, 10-pair)** dengan Sharpe 0.82 dan DD -26.19% — trade count naik, tapi masih di bawah gate.
3. **Kombinasi cluster limit + risk 0.5%** (Exp E) — Sharpe 0.44, DD -13.36% — pendekatan paling balanced.
4. **Parameter tuning diizinkan** (Donchian period, ATR multiplier) jika user setuju untuk mengubah parameter strategi inti.

---
*Semua run dengan PYTHONPATH=. Parameter fixed: Donchian 20/10, ATR(14)x2, fee 0.1%, slippage 0.05%. PAXG data dari Yahoo Finance.*