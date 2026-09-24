# Buy-and-Hold Drawdown & BTC-ETH Correlation

## Maximum Drawdown — Buy-and-Hold

| Konfigurasi | Periode | MDD |
|---|---|---|
| BTC-only | 2020-11-09 s.d. 2026-09-02 (2120 hari) | -76.63% |
| 2-pair equal-weight (BTC + ETH) | 2020-11-09 s.d. 2026-09-02 (2120 hari) | -76.89% |
| 10-pair equal-weight | 2024-12-18 s.d. 2026-09-02 (620 hari) | -58.44% |

> Catatan: 10-pair hanya menggunakan periode di mana semua pair tersedia (HYPE mulai 2024-12-18).

## Korelasi Harian BTC-ETH

| Metric | Nilai |
|---|---|
| Korelasi harian BTC-ETH (return) | 0.843 |
| Periode | 2020-11-09 s.d. 2026-09-02 (data harian penuh) |
| Sumber | Matriks korelasi lengkap di `portfolio_size_experiment.md` |

> Catatan: Angka 0.843 diambil dari matriks korelasi resmi di portfolio_size_experiment.md sebagai satu-satunya sumber kebenaran. Perhitungan independent (Pearson pada full period) menghasilkan 0.838 — kemungkinan berbeda karena window/spesifikasi yang sedikit berbeda.

## Sumber Data

- Harga close harian: Bitget OHLCV (`data/historical/*_USDT_1d.csv`)
- Buy-and-hold: normalisasi harga ke 1 di hari pertama, hitung peak-to-trough
- Korelasi: Pearson correlation pada daily return (% perubahan harga)
