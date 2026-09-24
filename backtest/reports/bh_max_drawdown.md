# Buy-and-Hold Maximum Drawdown Report

> Periode: 2020-11-09 s.d. 2026-09-02
> Modal awal: $10,000
> Formula MDD identik dengan `run_backtest.py:194-196`: `dd = equity / cummax(equity) - 1`

---

## 0. Tanggal Data per Pair

| Pair | Tanggal Data Pertama |
|---|---|
| BTC/USDT | 2020-11-09 |
| ETH/USDT | 2020-11-09 |
| SOL/USDT | 2021-06-22 |
| BNB/USDT | 2021-06-01 |
| XRP/USDT | 2020-11-09 |
| AVAX/USDT | 2021-11-18 |
| LINK/USDT | 2021-04-15 |
| DOGE/USDT | 2021-04-25 |
| ADA/USDT | 2022-03-23 |
| HYPE/USDT | 2024-12-18 |

**Catatan:** HYPE baru listing 2024-12-18, ADA 2022-03-23, AVAX 2021-11-18, LINK 2021-04-15, DOGE 2021-04-25, SOL 2021-06-22, BNB 2021-06-01.

---

## 1. Akar Masalah (Bug di Versi Sebelumnya)

Versi sebelumnya menghitung MDD 10-pair = **-96.69%** (Mei-Juni 2021). Ini **SALAH**.

**Penyebab:** Kode sebelumnya melakukan `alloc * (c / c.iloc[0])` untuk setiap pair —
normalisasi ke $1,000 berdasarkan tanggal *pertama pair itu sendiri*, bukan tanggal masuk portofolio.
Karena `DataFrame.sum(axis=1)` skip NaN, pair yang belum ada tidak dihitung.

Akibatnya:
- 2020-11-09: hanya BTC+ETH+XRP aktif → portfolio = $3,000 (bukan $10,000)
- Mei 2021: BTC+ETH sudah naik drastis → portfolio = $22,548 (hanya 2 pair)
- Juni 2021: BTC+ETH turun ~65% → portfolio = $747 (artefak, bukan drawdown nyata)

**Kesimpulan:** -96.69% bukan MDD portofolio 10-pair — itu artifact dari normalisasi yang salah.

---

## 2. Metodologi Perbaikan: Staggered Entry + Rebalancing

**Pendekatan:** Staggered entry dengan rebalancing.

- Setiap pair masuk portofolio pada tanggal data pertamanya.
- Saat pair baru masuk, seluruh portfolio di-rebalance ke equal-weight.
- Pair yang belum ada data tidak dihitung dalam equity (bukan forward-fill).
- Tidak ada fee/slippage untuk rebalancing (B&H baseline).

**Alasan memilih ini (bukan alternatif):**
- Bukan *period-limited*: membuang 4 tahun data jika hanya mulai HYPE listing.
- Bukan *forward-fill*: harga crypto tidak bisa di-interpolate secara meaningful.
- *Staggered entry* paling realistis untuk backtest multi-aset berbeda listing date.

---

## 3. Hasil Perhitungan Ulang

| Konfigurasi | MDD (%) | Peak Date | Trough Date | Peak Value ($) | Trough Value ($) | Recovery Date |
|---|---|---|---|---|---|---|
| BTC only | -76.63% | 2021-11-08 | 2022-11-21 | 44053.97 | 10296.8 | 2024-03-04 |
| 2-pair EQW (BTC+ETH) | -76.89% | 2021-11-08 | 2022-11-09 | 76122.72 | 17592.1 | 2024-12-06 |
| 10-pair EQW (all, fixed) | -77.63% | 2021-10-25 | 2022-12-30 | 95417.32 | 21340.15 | 2024-11-21 |

**BTC-only dan 2-pair tidak berubah** — metodologi sudah benar untuk kasus di mana semua pair tersedia sejak awal periode.

---

## 4. Detail: 10-pair EQW (Fixed)

- **Maximum Drawdown:** -77.63%
- **Peak:** 2021-10-25 @ $95,417.32
- **Trough:** 2022-12-30 @ $21,340.15
- **Recovery:** 2024-11-21

### Validasi Silang dengan Pasar Riil

Drawdown terjadi di **crypto winter 2022**, sesuai ekspektasi:
- **Peak 2021-10-25:** Portofolio mencapai ATH — altcoin (DOGE, LINK, dll) peaked sekitar ini, sedikit sebelum BTC ATH (2021-11-08).
- **Trough 2022-12-30:** Bottom bear market — BTC ~$16.5K, ETH ~$1.2K, altcoin jauh lebih rendah.
- Konsisten dengan bear market 2022 yang dialami seluruh aset crypto.
- **TIDAK ada anomali** di Mei-Juni 2021 seperti versi sebelumnya.

---

## 5. Equity Curve 10-pair (Fixed) di Tanggal Kunci

| Tanggal | Equity ($) | Pairs Aktif | Keterangan |
|---|---|---|---|
| 2020-11-09 | 10,000.00 | 3 | Awal — BTC, ETH, XRP (3 pair) |
| 2021-06-22 | 42,388.99 | 7 | SOL masuk → rebalance ke 7 pair |
| 2021-10-25 | 95,417.32 | 7 | Peak portfolio (sebelum crypto winter) |
| 2022-12-30 | 21,340.15 | 9 | Trough crypto winter (MDD terbesar) |
| 2024-12-18 | 108,332.88 | 10 | HYPE masuk → 10 pair lengkap |
| 2026-09-02 | 86,714.42 | 10 | Akhir periode |

---

*Data: Bitget daily OHLCV, periode 2020-11-09 s.d. 2026-09-02. Buy-and-hold = equal-weight, staggered entry per tanggal listing, rebalance saat pair baru masuk. Formula MDD identik dengan run_backtest.py:194-196.*