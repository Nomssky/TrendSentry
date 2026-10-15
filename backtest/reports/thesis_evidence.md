# Bukti Eksplorasi Internal — Tabel 1.1 Skripsi

> Dihasilkan otomatis oleh `backtest/research/thesis_evidence.py`.
> Data: OHLCV harian Bitget, 2120 bar, 2020-11-09 s.d. 2026-09-02.
> Formula identik `backtest/run_backtest.py`: `sharpe = mean(daily)/std(daily)*sqrt(365)` (rf=0),
> `dd = equity/equity.cummax() - 1`. Harga pada hari tanpa data diisi dengan harga penutupan
> sebelumnya (forward-fill); tanpa perlakuan ini portofolio 10 aset memunculkan artefak
> Maximum Drawdown -96,69% yang kelihatan seperti risiko padahal hanya efek data kosong.

## 1. Tabel 1.1 — baris siap kutip

| No | Indikator | Nilai | Dasar perhitungan |
|---|---|---|---|
| 1 | Sharpe ratio buy-and-hold, BTC | 0.79 | seri harga penutupan BTC, normalisasi modal awal $1.000 |
| 2 | Sharpe ratio buy-and-hold, 2 aset (BTC+ETH) | 0.79 | equal-weight, tanpa rebalancing |
| 3 | Sharpe ratio buy-and-hold, 10 aset | 0.91 | equal-weight, tanpa rebalancing |
| 4 | Maximum Drawdown, BTC | -76.63% | puncak 2021-11-08 → lembah 2022-11-21, pulih 2024-03-04 |
| 5 | Maximum Drawdown, 2 aset | -76.89% | puncak 2021-11-08 → lembah 2022-11-09, pulih 2024-12-06 |
| 6 | Maximum Drawdown, 10 aset | -77.54% | puncak 2021-10-25 → lembah 2022-12-30, pulih 2024-11-21 |
| 7 | Korelasi harian BTC–ETH | 0.843 | Pearson atas return harian; matriks 10 aset |
| 8 | Korelasi rerata HYPE vs 9 aset | 0.52 | rerata baris HYPE pada matriks korelasi |

## 2. Ringkasan nilainya vs laporan lama

| Besaran | Skripsi ini | Laporan lama | Sumber laporan lama |
|---|---|---|---|
| Sharpe B&H BTC | 0.7887 | 0,83 | `sharpe_benchmark_comparison.md` |
| Sharpe B&H 2 aset | 0.7908 | 0,83 | `sharpe_benchmark_comparison.md` |
| Sharpe B&H 10 aset | 0.9103 | 0,98 | `sharpe_benchmark_comparison.md` |
| MDD B&H BTC | -76.63% | -76,63% | `bh_max_drawdown.md` |
| MDD B&H 2 aset | -76.89% | -76,89% | `bh_max_drawdown.md` |
| MDD B&H 10 aset | -77.54% | -77,63% | `bh_max_drawdown.md` (**tidak terverifikasi, tidak ada generator**) |
| Korelasi BTC–ETH | 0.8425 | 0,843 | `portfolio_size_experiment.md` |
| Korelasi rerata HYPE | 0.5173 | 0,52 | `portfolio_size_experiment.md` |

## 3. Detail per portofolio

| Konfigurasi | Puncak | Nilai puncak ($) | Lembah | Nilai lembah ($) | MDD | Nilai akhir ($) |
|---|---|---|---|---|---|---|
| BTC | 2021-11-08 | 44,053.97 | 2022-11-21 | 10,296.80 | -76.63% | 50,106.85 |
| 2 aset | 2021-11-08 | 76,122.72 | 2022-11-09 | 17,592.10 | -76.89% | 51,832.47 |
| 10 aset | 2021-10-25 | 95,531.43 | 2022-12-30 | 21,454.47 | -77.54% | 94,799.10 |

## 4. Empat metrik disesuaikan risiko, strategi aktif vs pasif (basis Tabel Hasil H1)

Dihitung dengan fungsi `varsh()` yang sama dengan `compute_metrics()` di engine utama, γ = 1,96,
return harian, rf = 0. VaRSR dilaporkan pada basis harian — tidak di-annualisasi (√365), karena
Deng dkk. (2013) Eq. (12) tidak menetapkan konvensi tersebut.

| Portofolio | Sharpe ratio | VaRSR | Volatilitas (%) | Maximum Drawdown (%) | skewness | kurtosis |
|---|---|---|---|---|---|---|
| **Strategi Donchian 10 aset (aktif)** | **0.82** | **0.0015** | **22.33** | **-26.45** | 2.41 | 123.90 |
| Buy-and-hold 10 aset | 0.91 | 0.0043 | 70.57 | -77.54 | -0.58 | 14.19 |
| Buy-and-hold 2 aset | 0.79 | -0.0031 | 68.83 | -76.89 | -1.67 | 55.66 |
| Buy-and-hold Bitcoin | 0.79 | -0.0034 | 59.40 | -76.63 | -1.79 | 59.27 |

> Baris strategi diambil dari `backtest/reports/metrics.md` (canonical run, 2.119 observasi harian).
> Kurtosis keempat portofolio jauh di atas 3, sehingga return tidak berdistribusi normal.
> Sifat matematis konstruksi (bukan temuan empiris): untuk γ > 0, VaRSR selalu lebih kecil dari
> Sharpe ratio karena VaRSR = SR − γ·σ̂(SR) dengan σ̂(SR) ≥ 0.

## 5. Perintah untuk mereplikasi

```sh
cd /home/kresna/project
source venv/bin/activate && PYTHONPATH=. python backtest/research/thesis_evidence.py --check
```
