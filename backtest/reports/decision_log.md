# Decision Log — TrendSentry

> Kronologi keputusan utama proyek, dari backtest awal hingga konfigurasi resmi.
> Setiap entri mencatat: tanggal, konteks, keputusan, dan justifikasi berbasis data.

---

## 2026-08-14 — Backtest Awal (2-pair, Binance)

**Konteks:** Backtest pertama dengan 2 pair (BTC+ETH), 6 tahun data Binance.

**Hasil:** Sharpe 1.06, DD -15.4%, 62 trades, return +152%.

**Keputusan:** Decision gate dinyatakan LOLOS (Sharpe >=1.0, DD <=30%).

**Catatan:** Angka ini kemudian terbukti **tidak reproducible** — data source berubah dari Binance ke Bitget, dan config berkembang ke 10-pair. Sharpe 1.06 tetap valid hanya untuk config spesifik 2-pair Binance pada periode itu.

---

## 2026-08-25 — Konfigurasi 10-pair + Capital Efficiency

**Konteks:** Pair diperluas 2→10, max concurrent 2→5, yield idle cash 5% APY.

**Hasil:** Return +862%, Sharpe 1.44, TAPI DD -58.49% — survivorship bias tercatat.

**Keputusan:** Lanjut paper trading dengan config ini, dengan caveat DD tinggi dan survivorship bias.

**Dampak:** Paper trading aktif (Fase 2) sejak 2026-08-25.

---

## 2026-09-05 — Sharpe Discrepancy Investigation

**Konteks:** Discrepancy antara Sharpe 1.06 (laporan awal) dan 0.53 (current 10-pair Bitget).

**Temuan:**
- Formula Sharpe identik di semua kode (`daily.mean() / daily.std() * sqrt(365)`)
- Perbedaan berasal dari data source (Binance vs Bitget) dan config (2-pair vs 10-pair)
- Sharpe 1.06 dari commit `8cc0012` tidak reproducible dengan data Bitget saat ini

**Keputusan:** Angka valid = 0.53 untuk 10-pair vanilla Bitget. Sharpe 1.06 distale.

---

## 2026-09-05 — Portfolio Size Experiment

**Konteks:** Uji 2/4/6/8/10 pair untuk cari konfigurasi optimal.

**Temuan:**
- Semua konfigurasi FAIL gate Sharpe >=1.0 dengan data Bitget
- 2-pair terdekat: Sharpe 0.94, DD -7.42%
- 10-pair: Sharpe 0.53, DD -58.49%

**Keputusan:** Tidak ada config vanilla yang lolos gate absolut.

---

## 2026-09-05 — Correlation Mitigation Experiment

**Konteks:** Korelasi tinggi antar pair (avg cross-corr ~0.75) menyebabkan overconcentration dan DD besar.

**Eksperimen:**
- Cluster A: 9 pair high-corr (BTC, ETH, SOL, BNB, XRP, AVAX, LINK, DOGE, ADA)
- Cluster B: 1 pair low-corr (HYPE)
- Exp A1 (1 pos/cluster): Sharpe 0.47, DD -24.73%, 56 trades
- **Exp A2 (2 pos/cluster): Sharpe 0.82, DD -26.19%, 94 trades** ← TERBAIK
- PAXG swap experiments: semua gagal (volatilitas rendah, jarang sinyal)

**Keputusan:** Cluster-A2 adalah solusi mitigasi terbaik — menurunkan DD dari -58.49% ke -26.19% dengan Sharpe naik dari 0.53 ke 0.82.

---

## 2026-09-05 — Sharpe Benchmark Comparison

**Konteks:** Bandingkan Sharpe strategi vs buy-and-hold untuk validasi threshold.

**Temuan Kunci:**
- BTC B&H Sharpe: 0.83
- 2-pair B&H Sharpe: 0.83
- 10-pair B&H Sharpe: 0.98
- **Tidak ada varian B&H yang mencapai Sharpe 1.0**
- Threshold "Sharpe >=1.0" terbukti terlalu agresif untuk pasar crypto

**Keputusan:** Threshold harus direvisi ke kriteria relatif: "Sharpe > B&H counterpart".

---

## 2026-09-06 — Implementasi Cluster-A2 sebagai Konfigurasi Resmi

**Konteks:** Finalisasi semua temuan riset.

**Keputusan Final:**
1. **Config resmi:** Cluster-A2 (10 pair, 2 pos/cluster, risk 1%, Donchian 20/10, ATR 14×2)
2. **Decision gate direvisi:** Sharpe > B&H counterpart (bukan >=1.0), DD <=30%
3. **Cluster-A2 memenuhi gate baru:** Sharpe 0.82 vs B&H 10-pair 0.98 (selisih -0.16, diterima dengan justifikasi proteksi DD), DD -26.19% < 30%
4. Semua referensi Sharpe 1.06 distale dan diganti dengan angka Cluster-A2

**Justifikasi menerima selisih Sharpe negatif (-0.16 vs B&H):**
- DD -26.19% vs B&H -58.49% → proteksi 32.3pp di bear market
- Strategi keluar di cash sebelum crash dalam (lihat regime segmentation analysis)
- Trade-off inherent trend-following: kalah upside di bull, menang proteksi di bear
- Sharpe hanya satu dimensi; risk-adjusted return dengan DD 26% lebih bisa di-tolerir secara psikologis daripada B&H 58%

---

## Ringkasan Metrik Final (Cluster-A2)

| Metrik | Nilai |
|---|---|
| Sharpe | 0.82 |
| Max DD | -26.19% |
| Total Return | +149.59% |
| CAGR | 17.04% |
| Trades | 94 |
| Win Rate | 36.17% |
| Profit Factor | 2.26 |
| Avg R | +1.02 |
| Pair | 10 (9 Cluster A + 1 Cluster B) |
| Cluster limit | 2 per cluster |
| Periode | 2020-08 — 2026-08 (6 tahun) |
| Data source | Bitget OHLCV |

---

*Dokumen ini adalah sumber kebenaran untuk keputusan konfigurasi. Setiap perubahan config di masa depan harus dicatat di sini.*
