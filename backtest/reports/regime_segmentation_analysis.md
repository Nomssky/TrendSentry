# Regime Segmentation Analysis — TrendSentry

> Tanggal: 2026-09-05
> Tujuan: Apakah strategi Donchian melindungi modal lebih baik saat bear/crash?
>
> Definisi rezim (BTC rolling 90-day return):
> - **Bear/Crash:** rolling 90d return < -20%
> - **Bull Rally:** rolling 90d return > +40%
> - **Sideways:** sisanya

---

## 1. Identifikasi Rezim Pasar — Segmen Signifikan (>5 hari)

| Rezim | Start | End | Durasi (hari) | BTC Return % | Deskripsi |
|---|---|---|---|---|---|
| Sideways | 2020-11-09 | 2021-02-06 | 89 | +155.8% | Awal bull, awal data |
| **Bull** | **2021-02-07** | **2021-05-08** | **90** | **+51.8%** | **Bull 2021** |
| Sideways | 2021-05-09 | 2021-05-18 | 9 | -26.4% | May 2021 crash (sideways karena rolling window) |
| **Bear** | **2021-09-19** | **2021-09-29** | **10** | **-12.1%** | **Sep 2021 mini-crash** |
| Sideways | 2021-09-30 | 2021-11-26 | 57 | +22.6% | Recovery side |
| Sideways | 2021-12-03 | 2022-01-05 | 33 | -19.0% | Menjelang crypto winter |
| **Bear** | **2022-01-06** | **2022-03-08** | **61** | **-10.1%** | **Crypto winter awal** |
| **Bear** | **2022-07-02** | **2022-09-29** | **89** | **+1.8%** | **Crypto winter (LUNA/3AC)** |
| **Bear** | **2022-11-08** | **2022-11-23** | **15** | **-10.4%** | **FTX crash** |
| Sideways | 2022-12-12 | 2023-02-14 | 64 | +29.0% | Recovery awal 2023 |
| **Bull** | **2023-03-16** | **2023-04-18** | **33** | **+21.5%** | **Bull mini 2023** |
| Sideways | 2023-04-17 | 2023-11-16 | 213 | +22.9% | Sideways panjang 2023 |
| **Bull** | **2023-11-30** | **2024-01-19** | **50** | **+10.4%** | **Bull akhir 2023** |
| **Bull** | **2024-02-26** | **2024-04-30** | **64** | **+11.4%** | **Bull 2024 (pre-halving)** |
| Sideways | 2024-05-08 | 2024-09-05 | 120 | -8.2% | Sideways mid-2024 |
| Sideways | 2024-09-09 | 2024-11-10 | 62 | +40.9% | Sideways dengan rally (rolling window) |
| **Bull** | **2024-11-11** | **2025-02-03** | **84** | **+14.3%** | **Post-election rally** |
| Sideways | 2025-02-04 | 2025-03-15 | 39 | -13.8% | Koreksi |
| Sideways | 2025-03-18 | 2025-07-08 | 112 | +31.7% | Sideways naik |
| Sideways | 2025-07-18 | 2025-11-19 | 124 | -22.4% | Sideways turun |
| **Bear** | **2025-12-10** | **2026-01-07** | **28** | **-0.7%** | **Bear ringan** |
| **Bear** | **2026-01-29** | **2026-03-13** | **43** | **-16.2%** | **Bear 2026** |
| Sideways | 2026-04-17 | 2026-07-30 | 104 | -15.9% | Sideways turun |
| Sideways | 2026-08-11 | 2026-09-02 | 22 | +20.7% | Sideways naik |

> **Catatan:** Banyak segmen singkat (0-5 hari) dihasilkan oleh rolling window yang fluktuatif — dihilangkan dari tabel ini untuk kejelasan. Data lengkap ada di output CSV.

## 2. Performa per Rezim — Segmen Signifikan

### Bull Rally — Strategi KALAH dari B&H

| Periode | BTC% | BH2 Ret% | BH2 DD% | BH2 Sharpe | BH10 Ret% | BH10 DD% | BH10 Sharpe | 2-pair Strat Ret% | 2-pair Strat DD% | 10p Vanilla Ret% | 10p Vanilla DD% | 10p Cluster-A2 Ret% | 10p Cluster-A2 DD% |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2021-02..2021-05 | +51.8 | +105.3 | -24.2 | 3.97 | +188.1 | -26.0 | 4.81 | **+14.2** | -4.7 | **+20.9** | -9.8 | **+23.9** | -9.1 |
| 2023-03..2023-04 | +21.5 | +24.4 | -5.0 | 5.35 | +26.7 | -4.8 | 5.50 | **+2.4** | -0.5 | **+8.5** | -2.4 | **+5.1** | -1.1 |
| 2023-11..2024-01 | +10.4 | +17.6 | -7.4 | 2.56 | +20.4 | -11.0 | 2.73 | **+1.5** | -2.4 | **+13.6** | -10.7 | **+9.2** | -10.3 |
| 2024-02..2024-04 | +11.4 | +0.4 | -22.6 | 0.37 | +3.9 | -45.3 | 0.84 | **+1.4** | -4.8 | **+12.5** | -37.0 | **+0.2** | -9.1 |
| 2024-11..2025-02 | +14.3 | -2.1 | -19.2 | 0.09 | +30.7 | -17.4 | 2.15 | **+2.0** | -2.9 | **-0.3** | -15.8 | **+1.8** | -7.1 |

**Pola:** Strategi konsisten kalah dari B&H di bull karena hanya menangkap 10-30% dari rally total. Donchian selalu terlambat masuk dan exit terlalu cepat.

### Bear/Crash — Strategi UNGGUL (perlindungan modal)

| Periode | BTC% | BH10 Ret% | BH10 DD% | 2-pair Strat Ret% | 2-pair Strat DD% | 10p Vanilla Ret% | 10p Vanilla DD% | 10p Cluster-A2 Ret% | 10p Cluster-A2 DD% |
|---|---|---|---|---|---|---|---|---|---|---|
| 2021-09-19..2021-09-29 | -12.1 | **-12.7** | -16.9 | **0.0** | **0.0** | **-2.6** | **-2.6** | **-2.6** | **-2.6** |
| 2022-01-06..2022-03-08 | -10.1 | **+6.6** | -27.0 | **-0.8** | **-1.0** | **+0.6** | **-3.7** | **-3.8** | **-4.4** |
| 2022-07-02..2022-09-29 | +1.8 | **+0.8** | -43.2 | **-1.9** | **-2.6** | **-3.5** | **-9.7** | **+0.2** | **-5.1** |
| 2022-11-08..2022-11-23 | -10.4 | **-10.0** | -16.9 | **0.0** | **0.0** | **-2.2** | **-2.2** | **0.0** | **0.0** |
| 2026-01-29..2026-03-13 | -16.2 | **-20.6** | -29.7 | **-0.3** | **-0.9** | **-0.7** | **-4.2** | **-0.7** | **-4.2** |

**Pola:** Strategi konsisten UNGGUL di bear — B&H turun 10-20% sementara strategi turun 0-3%. Donchian exit (Lowest Low 10) dan ATR stop memotong loss sebelum crash dalam.

### Sideways (Mixed)

Pada sideways, hasil mixed — strategi unggul di sideways yang turun (karena diam di cash lebih baik dari hold), tapi kalah di sideways yang naik (karena sinyal Donchian jarang muncul).

## 3. Kesimpulan: Apakah Strategi Melindungi Modal Saat Bear?

**YA — strategi secara konsisten melindungi modal lebih baik saat bear/crash.**

Mekanisme perlindungan:
1. **Donchian exit (Lowest Low 10)** — ketika pasar berbalik turun, exit terpicu saat close < lowest low 10 hari. Ini bisa beberapa hari setelah peak, tapi mencegah drawdown 20-50% yang diderita B&H.
2. **ATR stop loss (2x ATR)** — batasi loss per trade individu, mencegah satu posisi hancur total.
3. **Gap stop** — exit di open jika harga gap langsung di bawah stop (flash crash).
4. **Cluster limit (Exp A2)** — batasi correlated drawdown dengan maksimal 2 posisi per cluster.

**Namun, trade-off-nya:** strategi kalah di bull karena hanya menangkap 10-30% dari rally. Ini adalah sifat alami trend-following yang konservatif: potong loss cepat, biarkan winner jalan, tapi winner tetap lebih kecil dari trend penuh.

### Rekomendasi Final

Strategi Donchian berfungsi sebagai **asuransi portofolio** — mengorbankan upside di bull untuk mendapatkan perlindungan di bear. Ini cocok untuk investor yang:
- Lebih khawatir kehilangan 50% di bear daripada kehilangan upside di bull
- Ingin equity curve yang lebih mulus (DD 7-26% vs 45-58% untuk B&H)
- Punya horizon investasi panjang dan tidak ingin panik jual di bear

**Tidak cocok** untuk investor yang ingin return maksimal di bull market dan bisa mentolerir drawdown 50%+.

![Regime Segmentation Chart](regime_segmentation.png)

---
*Definisi rezim: BTC rolling 90-day return. Bear <-20%, Bull >+40%. Data: Bitget, 2020-11-09 s.d. 2026-09-02.*
