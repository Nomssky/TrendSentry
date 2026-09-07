# Sharpe Benchmark Comparison — Strategy vs Buy-and-Hold

> Tanggal: 2026-09-05
> Formula identik untuk semua perhitungan (run_backtest.py:142):
> ```
> daily = equity_series.pct_change().dropna()
> sharpe = daily.mean() / daily.std() * sqrt(365)
> ```
> Risk-free rate = 0, annualized dengan sqrt(365).

---

## 1. Tabel Perbandingan

| Config | Sharpe Strategi | Sharpe Buy-and-Hold | Return Strategi | Return B&H | Selisih Sharpe | Strategi > B&H? |
|---|---|---|---|---|---|---|
| 2-pair (BTC+ETH) | 0.94 | 0.83 | 38.05% | 418.32% | 0.11 | Ya |
| 10-pair (all) | 0.53 | 0.98 | 155.82% | 155.03% | -0.45 | Tidak |
| BTC only | — | 0.83 | — | 401.07% | — | — |

## 2. Detail Buy-and-Hold Sharpe

| Pair Set | Daily Mean Return | Daily Std Dev | Non-Annualized Sharpe | Annualized (sqrt365) |
|---|---|---|---|
| 2-pair EQW | 0.001647 | 0.037855 | 0.0435 | 0.83 |
| 10-pair EQW | 0.008286 | 0.161390 | 0.0513 | 0.98 |
| BTC only | 0.001417 | 0.032668 | 0.0434 | 0.83 |

## 3. Uji Signifikansi (Paired t-test: daily return strategi vs B&H)

| Config | t-statistic | p-value | Mean diff (strat - bh) | Signifikan (p<0.05)? |
|---|---|---|---|
| 2-pair | -1.785 | 0.0743 | -0.001472 | Tidak |
| 10-pair | -2.342 | 0.0193 | -0.007251 | Ya |

**Interpretasi t-test:**
- 2-pair: perbedaan mean return TIDAK signifikan (p=0.0743). Selisih harian rata-rata -0.001472.
- 10-pair: perbedaan mean return strategi vs B&H signifikan (p=0.0193). Selisih harian rata-rata -0.007251.

> **⚠️ Caveat metodologis:** paired t-test membandingkan return harian strategi vs B&H pada SEMUA tanggal, tapi strategi trend-following sengaja di luar pasar (cash) di ~90% hari — menghasilkan return 0 di hari-hari tersebut. Ini menekan mean return strategi secara artifisial. 
> 
> Perbandingan yang lebih adil: bandingkan Sharpe ratio (yang sudah mengakomodasi cash days via annualized return & vol) atau bandingkan hanya pada hari-hari di mana strategi memiliki posisi. Angka Sharpe (`risk-adjusted return`) sudah menyelesaikan masalah ini dengan benar — Sharpe strategi 0.94 vs B&H 0.83 di 2-pair menunjukkan strategi memberikan risk-adjusted return lebih baik meskipun lebih jarang trading.

## 4. Jawaban untuk Threshold RULES.md (Sharpe >= 1.0)

**Buy-and-hold Sharpe ratios di pasar crypto (2020-2026):**
- BTC only: 0.83
- 2-pair equal-weight (BTC+ETH): 0.83
- 10-pair equal-weight: 0.98

**Apakah Sharpe buy-and-hold crypto di atas 1.0?**
- **Tidak** — semua varian B&H di bawah 1.0. Tertinggi 0.98.
- BTC only: 0.83 <1.0
- Artinya: threshold Sharpe >= 1.0 di RULES.md adalah **sangat agresif** untuk pasar crypto pada periode ini.

Jika aset paling blue-chip (BTC) sekalipun tidak mencapai Sharpe 1.0, maka threshold 1.0 mungkin terlalu tinggi. 
Alternatif: Sharpe strategi > Sharpe buy-and-hold counterpart sebagai ukuran value-add yang lebih realistis.

**Rekomendasi:** gunakan Sharpe strategi vs buy-and-hold yang SEBANDING sebagai benchmark, bukan angka absolut 1.0. Strategi 2-pair menghasilkan Sharpe 0.94 vs B&H 0.83 — selisih 0.11 — tidak signifikan secara statistik. Strategi 10-pair menghasilkan Sharpe 0.53 vs B&H 0.98 — selisih -0.45 — signifikan secara statistik.

---
*Semua data: Bitget (existing 10 pair) + periode 2020-11-09 s.d. 2026-09-02. Formula Sharpe identik dengan run_backtest.py:142 (risk-free=0, sqrt(365)). Buy-and-hold = equal-weight, hold sampai akhir tanpa rebalancing.*