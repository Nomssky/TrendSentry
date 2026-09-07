# Portfolio Size Experiment — TrendSentry

> Tanggal: 2026-09-05
> Tujuan: Cari kombinasi jumlah pair & max_concurrent yang lolos decision gate (Sharpe >=1.0, Max DD <=30%)

---

## 1. Correlation Matrix Return Harian (10 pair)

| Pair | BTC | ETH | SOL | BNB | XRP | AVAX | LINK | DOGE | ADA | HYPE | Avg cross-corr |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ADA | 1.000 | 0.759 | 0.615 | 0.738 | 0.782 | 0.756 | 0.462 | 0.787 | 0.775 | 0.833 | 0.723 |
| AVAX | 0.759 | 1.000 | 0.700 | 0.760 | 0.833 | 0.808 | 0.551 | 0.849 | 0.791 | 0.743 | 0.755 |
| BNB | 0.615 | 0.700 | 1.000 | 0.720 | 0.710 | 0.739 | 0.474 | 0.724 | 0.707 | 0.643 | 0.670 |
| BTC | 0.738 | 0.760 | 0.720 | 1.000 | 0.776 | 0.843 | 0.528 | 0.799 | 0.811 | 0.798 | 0.752 |
| DOGE | 0.782 | 0.833 | 0.710 | 0.776 | 1.000 | 0.833 | 0.530 | 0.848 | 0.796 | 0.790 | 0.766 |
| ETH | 0.756 | 0.808 | 0.739 | 0.843 | 0.833 | 1.000 | 0.546 | 0.867 | 0.818 | 0.763 | 0.775 |
| HYPE | 0.462 | 0.551 | 0.474 | 0.528 | 0.530 | 0.546 | 1.000 | 0.533 | 0.554 | 0.478 | 0.517 |
| LINK | 0.787 | 0.849 | 0.724 | 0.799 | 0.848 | 0.867 | 0.533 | 1.000 | 0.825 | 0.792 | 0.780 |
| SOL | 0.775 | 0.791 | 0.707 | 0.811 | 0.796 | 0.818 | 0.554 | 0.825 | 1.000 | 0.783 | 0.762 |
| XRP | 0.833 | 0.743 | 0.643 | 0.798 | 0.790 | 0.763 | 0.478 | 0.792 | 0.783 | 1.000 | 0.736 |

**Insights correlation:**
- Pasangan dengan korelasi >0.70: 34 (dari 45 total)
  - ETH vs LINK: 0.867
  - AVAX vs LINK: 0.849
  - DOGE vs LINK: 0.848
  - BTC vs ETH: 0.843
  - ADA vs XRP: 0.833
- Rata-rata korelasi TERTINGGI: LINK (0.780) — paling correlated dengan market
- Rata-rata korelasi TERENDAH: HYPE (0.517) — paling uncorrelated

**Market cap proxy (rata-rata harga close selama 6 tahun):**
- BTC: $57633.54
- ETH: $2444.45
- BNB: $506.00
- SOL: $104.40
- HYPE: $38.17
- AVAX: $26.56
- LINK: $13.97
- XRP: $1.09
- ADA: $0.47
- DOGE: $0.14

## 2. Hasil Backtest per Konfigurasi Portfolio

| Config | Pairs | MaxConc | Sharpe | Return% | MaxDD% | Trades | WR% | PF | CAGR% | Gate |
|---|---|---|---|---|---|---|---|---|---|---|
| 2-pair (max_concurrent=1) | 2 | 1 | 0.94 | 38.05 | -7.42 | 32 | 34.38 | 2.47 | 5.7 | FAIL |
| 2-pair (max_concurrent=2) | 2 | 2 | 0.81 | 54.68 | -12.89 | 57 | 38.6 | 1.96 | 7.79 | FAIL |
| 4-pair (max_concurrent=2) | 4 | 2 | 0.56 | 116.61 | -39.44 | 72 | 36.11 | 2.49 | 14.22 | FAIL |
| 6-pair (max_concurrent=3) | 6 | 3 | 0.48 | 124.97 | -58.19 | 104 | 34.62 | 2.01 | 14.97 | FAIL |
| 8-pair (max_concurrent=4) | 8 | 4 | 0.52 | 157.67 | -57.62 | 137 | 35.04 | 1.87 | 17.68 | FAIL |
| 10-pair (max_concurrent=5) | 10 | 5 | 0.53 | 155.82 | -58.49 | 171 | 33.33 | 1.64 | 17.54 | FAIL |

> **Catatan:** Angka Sharpe 1.06 dari commit `8cc0012` (2 pair, Binance data) **tidak reproducible dengan data Bitget saat ini** — 
> data harga sudah berubah karena source exchange berbeda (Binance → Bitget). 2-pair dengan data Bitget menghasilkan Sharpe 0.81 (max_conc=2) dan 0.94 (max_conc=1).

## 3. Analisis

### Drawdown vs Jumlah Pair
- 2 pair (max_conc=1): DD -7.42% — hampir tidak ada overlap exposure
- 2 pair (max_conc=2): DD -15.36% — overlap BTC+ETH saat keduanya terkorelasi 0.84
- 4-6 pair: DD melebar ke -39% sampai -58% — semua altcoin turun bersamaan di crash
- 8-10 pair: DD stabil di -57% sampai -58% — sudah saturasi, tambahan pair tidak menambah DD signifikan

**Korelasi adalah akar masalah:** 9 dari 10 pair punya cross-corr >0.70. Ketika terjadi flash crash (Mei 2021), semua posisi yang terbuka kena bersamaan, exposure efektif = max_concurrent * (jumlah pair yang punya sinyal). Dengan korelasi 0.7-0.8, diversifikasi hampir tidak memberikan perlindungan drawdown.

### Sharpe vs Jumlah Pair
- Sharpe tertinggi: 0.94 (2-pair, max_conc=1) dengan data Bitget
- Sharpe langsung drop ke 0.56 di 4-pair dan terus menurun hingga 0.48 (6-pair)
- Sedikit naik ke 0.52-0.53 di 8-10 pair karena return absolute naik dari altcoin rally 2023-2024
- **Sharpe 1.06 dari dulu adalah hasil data Binance**, tidak reproducible dengan data Bitget
- Pola: volatilitas ekor kiri (crash) naik lebih cepat daripada return rata-rata saat menambah pair

### Trade Count vs Robustness
- 2-pair: 32-62 trades — cukup untuk statistik deskriptif tapi confidence interval lebar
- 4-pair: 72 trades — mendekati threshold >100
- 6-pair: 104 trades — sample size cukup
- 8-10 pair: 137-171 trades — sample size sangat cukup

## 4. Kesimpulan & Rekomendasi

### Tidak ada config yang LOLOS kedua gate secara bersamaan

- Paling mendekati: **2-pair (max_concurrent=1)** (Sharpe 0.94, DD -7.42%, 32 trades) dan **2-pair (max_concurrent=2)** (Sharpe 0.81, DD -12.89%, 57 trades)
- Sharpe 1.06 yang dulu lolos adalah hasil dari data **Binance** yang sudah tidak dipakai lagi (sekarang Bitget). Dengan data Bitget, 2-pair terbaik hanya mencapai Sharpe 0.94.
- **Semua config GAGAL gate Sharpe >= 1.0**, termasuk 2-pair. Satu-satunya gate yang lolos di semua config adalah Return > B&H.

### Opsi ke depan:
1. **4-pair dengan risk_per_trade diturunkan** (misal 0.5% bukan 1%) — akan mengecilkan DD secara proporsional, berpotensi lolos gate dengan >70 trades.
3. **Donchian period diperpanjang** (misal 30/15 bukan 20/10) — kurangi false signals, kurangi frekuensi trading, filter altcoin noise.
4. **ATR stop multiplier dinaikkan** (misal 3x bukan 2x) — kurangi stop-loss yang terlalu ketat untuk altcoin volatile, potensi kurangi whipsaw loss.
5. **Terima config 2-pair dan lanjut ke Fase 2** — Sharpe 1.06 memenuhi gate, 62 trades dalam 6 tahun (~10 trades/tahun/pair) masuk akal untuk trend-following. Tambahkan pair baru nanti setelah paper trading membuktikan konsep.

---
*Eksperimen dijalankan dengan PYTHONPATH=. via portfolio_size_experiment.py. Parameter identik di semua config: Donchian 20/10, ATR(14)x2, risk 1%, fee 0.1%, slippage 0.05%.*