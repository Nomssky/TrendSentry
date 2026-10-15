# Regime Segmentation Analysis — TrendSentry

> Tanggal: 2026-09-05
> Tujuan: Analisis performa strategi per rezim pasar (bear/bull/sideways)
>
> Definisi rezim (berdasarkan BTC rolling 90-day return):
> - **Bear/Crash:** rolling 90d return < -20%
> - **Bull Rally:** rolling 90d return > 40%
> - **Sideways:** sisanya

---

## 1. Identifikasi Rezim Pasar

| Rezim | Start | End | Durasi (hari) | BTC Return % |
|---|---|---|---|---|
| Bear/Crash | 2021-05-19 | 2021-05-25 | 6 | 4.7 |
| Bear/Crash | 2021-09-19 | 2021-09-29 | 10 | -12.1 |
| Bear/Crash | 2022-01-06 | 2022-03-08 | 61 | -10.1 |
| Bear/Crash | 2022-03-11 | 2022-03-12 | 1 | 0.2 |
| Bear/Crash | 2022-07-02 | 2022-09-29 | 89 | 1.8 |
| Bear/Crash | 2022-11-08 | 2022-11-23 | 15 | -10.4 |
| Bear/Crash | 2022-12-09 | 2022-12-11 | 2 | -0.2 |
| Bear/Crash | 2024-07-07 | 2024-07-07 | 0 | 0.0 |
| Bear/Crash | 2024-09-06 | 2024-09-08 | 2 | 1.7 |
| Bear/Crash | 2025-03-16 | 2025-03-17 | 1 | 1.7 |
| Bear/Crash | 2025-04-06 | 2025-04-06 | 0 | 0.0 |
| Bear/Crash | 2025-11-20 | 2025-11-25 | 5 | 0.8 |
| Bear/Crash | 2025-12-01 | 2025-12-01 | 0 | 0.0 |
| Bear/Crash | 2025-12-10 | 2026-01-07 | 28 | -0.7 |
| Bear/Crash | 2026-01-10 | 2026-01-11 | 1 | 0.6 |
| Bear/Crash | 2026-01-24 | 2026-01-26 | 2 | -1.0 |
| Bear/Crash | 2026-01-29 | 2026-03-13 | 43 | -16.2 |
| Bear/Crash | 2026-03-19 | 2026-03-22 | 3 | -2.9 |
| Bear/Crash | 2026-03-26 | 2026-04-09 | 14 | 4.3 |
| Bear/Crash | 2026-04-12 | 2026-04-16 | 4 | 6.2 |
| Bear/Crash | 2026-04-19 | 2026-04-19 | 0 | 0.0 |
| Bear/Crash | 2026-07-31 | 2026-08-04 | 4 | 1.9 |
| Bear/Crash | 2026-08-08 | 2026-08-12 | 4 | -2.3 |
| Bull Rally | 2021-02-07 | 2021-05-08 | 90 | 51.8 |
| Bull Rally | 2021-11-25 | 2021-12-02 | 7 | -4.2 |
| Bull Rally | 2023-02-08 | 2023-02-08 | 0 | 0.0 |
| Bull Rally | 2023-02-15 | 2023-02-28 | 13 | -4.9 |
| Bull Rally | 2023-03-13 | 2023-03-13 | 0 | 0.0 |
| Bull Rally | 2023-03-16 | 2023-04-18 | 33 | 21.5 |
| Bull Rally | 2023-11-17 | 2023-11-27 | 10 | 1.7 |
| Bull Rally | 2023-11-30 | 2024-01-19 | 50 | 10.4 |
| Bull Rally | 2024-02-14 | 2024-02-16 | 2 | 0.6 |
| Bull Rally | 2024-02-19 | 2024-02-19 | 0 | 0.0 |
| Bull Rally | 2024-02-26 | 2024-04-30 | 64 | 11.4 |
| Bull Rally | 2024-05-03 | 2024-05-07 | 4 | -0.9 |
| Bull Rally | 2024-11-11 | 2025-02-03 | 84 | 14.3 |
| Bull Rally | 2025-07-07 | 2025-07-07 | 0 | 0.0 |
| Bull Rally | 2025-07-10 | 2025-07-17 | 7 | 2.8 |
| Sideways | 2020-11-09 | 2021-02-06 | 89 | 155.8 |
| Sideways | 2021-05-09 | 2021-05-18 | 9 | -26.4 |
| Sideways | 2021-05-26 | 2021-05-27 | 1 | -1.9 |
| Sideways | 2021-09-05 | 2021-09-18 | 13 | -6.7 |
| Sideways | 2021-09-30 | 2021-11-26 | 57 | 22.6 |
| Sideways | 2021-12-03 | 2022-01-05 | 33 | -19.0 |
| Sideways | 2022-03-09 | 2022-03-10 | 1 | -6.0 |
| Sideways | 2022-03-13 | 2022-03-23 | 10 | 13.6 |
| Sideways | 2022-09-30 | 2022-11-07 | 38 | 6.0 |
| Sideways | 2022-11-17 | 2022-11-17 | 0 | 0.0 |
| Sideways | 2022-11-24 | 2022-12-08 | 14 | 3.7 |
| Sideways | 2022-12-12 | 2023-02-14 | 64 | 29.0 |
| Sideways | 2023-03-01 | 2023-03-15 | 14 | 2.8 |
| Sideways | 2023-04-17 | 2023-11-16 | 213 | 22.9 |
| Sideways | 2023-11-21 | 2023-11-21 | 0 | 0.0 |
| Sideways | 2023-11-28 | 2023-11-29 | 1 | 0.1 |
| Sideways | 2024-01-20 | 2024-02-13 | 24 | 19.2 |
| Sideways | 2024-02-17 | 2024-02-25 | 8 | 0.2 |
| Sideways | 2024-05-01 | 2024-05-02 | 1 | 1.2 |
| Sideways | 2024-05-08 | 2024-09-05 | 120 | -8.2 |
| Sideways | 2024-09-09 | 2024-11-10 | 62 | 40.9 |
| Sideways | 2025-02-04 | 2025-03-15 | 39 | -13.8 |
| Sideways | 2025-03-18 | 2025-07-08 | 112 | 31.7 |
| Sideways | 2025-07-12 | 2025-07-12 | 0 | 0.0 |
| Sideways | 2025-07-18 | 2025-11-19 | 124 | -22.4 |
| Sideways | 2025-11-26 | 2025-12-09 | 13 | 2.4 |
| Sideways | 2025-12-24 | 2025-12-24 | 0 | 0.0 |
| Sideways | 2026-01-08 | 2026-01-09 | 1 | -0.5 |
| Sideways | 2026-01-12 | 2026-01-23 | 11 | -1.9 |
| Sideways | 2026-01-27 | 2026-01-28 | 1 | 0.1 |
| Sideways | 2026-02-20 | 2026-02-20 | 0 | 0.0 |
| Sideways | 2026-03-14 | 2026-03-18 | 4 | 0.0 |
| Sideways | 2026-03-23 | 2026-03-25 | 2 | 0.6 |
| Sideways | 2026-04-10 | 2026-04-11 | 1 | 0.1 |
| Sideways | 2026-04-17 | 2026-07-30 | 104 | -15.9 |
| Sideways | 2026-08-05 | 2026-08-07 | 2 | 0.4 |
| Sideways | 2026-08-11 | 2026-09-02 | 22 | 20.7 |

## 2. Performa per Rezim — Semua Config

### Bear/Crash

| Periode | BTC% | BH2 Ret% | BH2 DD% | BH2 Sharpe | BH2 VaRSR | BH10 Ret% | BH10 DD% | BH10 Sharpe | BH10 VaRSR | 2-pair (BTC+ETH, max_conc Ret% | 2-pair (BTC+ETH, max_conc DD% | 2-pair (BTC+ETH, max_conc Sharpe | 2-pair (BTC+ETH, max_conc VaRSR | 10-pair vanilla (max_conc Ret% | 10-pair vanilla (max_conc DD% | 10-pair vanilla (max_conc Sharpe | 10-pair vanilla (max_conc VaRSR | 10-pair cluster-A2 (2pos/ Ret% | 10-pair cluster-A2 (2pos/ DD% | 10-pair cluster-A2 (2pos/ Sharpe | 10-pair cluster-A2 (2pos/ VaRSR | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2021-05-19..2021-05-25 | 4.7 | 9.21 | -21.43 | 3.18 | -0.6583 | 3.35 | -25.62 | 1.81 | -0.7487 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| 2021-09-19..2021-09-29 | -12.1 | -13.68 | -16.07 | -4.15 | -0.9091 | -12.71 | -16.91 | -3.27 | -0.8773 | 0.0 | 0.0 | 0.0 | 0.0 | -2.7 | -2.7 | -6.04 | -0.6741 | -2.7 | -2.7 | -6.04 | -0.6741 |
| 2022-01-06..2022-03-08 | -10.1 | -20.55 | -26.36 | -1.3 | -0.3238 | -29.54 | -31.01 | -2.4 | -0.3819 | -0.8 | -0.95 | -1.94 | -0.3212 | 0.57 | -3.69 | 0.32 | -0.2279 | -3.79 | -4.38 | -3.1 | -0.3817 |
| 2022-03-11..2022-03-12 | 0.2 | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| 2022-07-02..2022-09-29 | 1.8 | 17.17 | -33.83 | 1.19 | -0.1459 | 2.63 | -24.51 | 0.51 | -0.1827 | -1.85 | -2.63 | -2.35 | -0.307 | -3.45 | -9.7 | -1.02 | -0.2583 | 0.19 | -5.06 | 0.13 | -0.2017 |
| 2022-11-08..2022-11-23 | -10.4 | -10.99 | -16.48 | -1.67 | -0.6167 | -7.61 | -12.83 | -1.5 | -0.6055 | 0.0 | 0.0 | 0.0 | 0.0 | -2.17 | -2.17 | -4.93 | -0.537 | 0.0 | 0.0 | 0.0 | 0.0 |
| 2022-12-09..2022-12-11 | -0.2 | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| 2024-07-07..2024-07-07 | 0.0 | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| 2024-09-06..2024-09-08 | 1.7 | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| 2025-03-16..2025-03-17 | 1.7 | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| 2025-04-06..2025-04-06 | 0.0 | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| 2025-11-20..2025-11-25 | 0.8 | 2.74 | -2.22 | 4.89 | -0.6839 | 3.86 | -3.91 | 4.54 | -0.6994 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| 2025-12-01..2025-12-01 | 0.0 | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| 2025-12-10..2026-01-07 | -0.7 | -2.91 | -11.42 | -0.94 | -0.4263 | -0.02 | -11.92 | 0.2 | -0.3656 | -1.34 | -1.34 | -5.38 | -0.6608 | -0.4 | -2.28 | -0.36 | -0.3987 | -0.82 | -1.28 | -2.64 | -0.5211 |
| 2026-01-10..2026-01-11 | 0.6 | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| 2026-01-24..2026-01-26 | -1.0 | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| 2026-01-29..2026-03-13 | -16.2 | -21.37 | -30.82 | -2.05 | -0.4126 | -20.56 | -29.69 | -1.96 | -0.4066 | -0.25 | -0.92 | -1.11 | -0.3567 | -0.68 | -4.16 | -0.73 | -0.3471 | -0.68 | -4.16 | -0.73 | -0.3471 |
| 2026-03-19..2026-03-22 | -2.9 | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| 2026-03-26..2026-04-09 | 4.3 | 5.32 | -3.88 | 3.28 | -0.3582 | 1.1 | -4.11 | 0.9 | -0.4874 | 0.0 | 0.0 | 0.0 | 0.0 | -1.11 | -1.11 | -10.03 | -0.9677 | -0.76 | -0.83 | -9.22 | -0.9841 |
| 2026-04-12..2026-04-16 | 6.2 | 6.69 | -1.19 | 9.22 | -0.3374 | 7.95 | -1.44 | 12.7 | -0.5343 | 0.75 | -0.22 | 7.66 | -0.4874 | 1.56 | -0.46 | 7.98 | -0.5202 | 1.56 | -0.46 | 7.98 | -0.5197 |
| 2026-04-19..2026-04-19 | 0.0 | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| 2026-07-31..2026-08-04 | 1.9 | 1.16 | -0.7 | 5.01 | -0.7725 | 1.67 | -0.66 | 6.88 | -0.5968 | 0.3 | -0.01 | 13.88 | -0.0561 | 0.52 | -0.73 | 3.31 | -0.9221 | 0.32 | -0.15 | 9.72 | -1.1299 |
| 2026-08-08..2026-08-12 | -2.3 | -2.09 | -2.09 | -12.8 | -1.3375 | -1.34 | -1.43 | -11.24 | -2.1617 | -0.35 | -0.35 | -17.76 | -1.6923 | -0.36 | -0.75 | -2.2 | -1.3702 | -1.22 | -1.22 | -79.25 | -8.8928 |

### Sideways

| Periode | BTC% | BH2 Ret% | BH2 DD% | BH2 Sharpe | BH2 VaRSR | BH10 Ret% | BH10 DD% | BH10 Sharpe | BH10 VaRSR | 2-pair (BTC+ETH, max_conc Ret% | 2-pair (BTC+ETH, max_conc DD% | 2-pair (BTC+ETH, max_conc Sharpe | 2-pair (BTC+ETH, max_conc VaRSR | 10-pair vanilla (max_conc Ret% | 10-pair vanilla (max_conc DD% | 10-pair vanilla (max_conc Sharpe | 10-pair vanilla (max_conc VaRSR | 10-pair cluster-A2 (2pos/ Ret% | 10-pair cluster-A2 (2pos/ DD% | 10-pair cluster-A2 (2pos/ Sharpe | 10-pair cluster-A2 (2pos/ VaRSR | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2020-11-09..2021-02-06 | 155.8 | 216.58 | -17.75 | 5.61 | 0.0586 | 169.99 | -27.95 | 4.09 | -0.0041 | 9.08 | -4.33 | 3.48 | -0.0362 | 22.38 | -5.46 | 4.01 | -0.0228 | 22.39 | -5.46 | 4.0 | -0.024 |
| 2021-05-09..2021-05-18 | -26.4 | -17.72 | -21.91 | -6.33 | -1.0339 | -11.8 | -14.58 | -3.71 | -0.8668 | -2.52 | -3.45 | -5.21 | -0.9978 | -3.61 | -4.39 | -4.54 | -0.9249 | -1.88 | -3.06 | -2.65 | -0.8113 |
| 2021-05-26..2021-05-27 | -1.9 | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| 2021-09-05..2021-09-18 | -6.7 | -11.31 | -17.29 | -3.37 | -0.6881 | -7.53 | -15.15 | -2.34 | -0.658 | 0.0 | 0.0 | 0.0 | 0.0 | 1.72 | -5.5 | 1.82 | -0.438 | 1.72 | -5.5 | 1.82 | -0.4379 |
| 2021-09-30..2021-11-26 | 22.6 | 31.21 | -17.18 | 2.8 | -0.1194 | 27.21 | -11.58 | 2.99 | -0.1004 | 1.1 | -1.71 | 1.41 | -0.1873 | -8.25 | -12.29 | -2.68 | -0.3489 | 0.09 | -3.65 | 0.12 | -0.2562 |
| 2021-12-03..2022-01-05 | -19.0 | -17.0 | -18.71 | -3.01 | -0.4862 | -11.18 | -11.18 | -2.63 | -0.473 | 0.0 | 0.0 | 0.0 | 0.0 | -1.17 | -1.17 | -5.08 | -0.4691 | -1.17 | -1.17 | -5.08 | -0.4693 |
| 2022-03-09..2022-03-10 | -6.0 | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| 2022-03-13..2022-03-23 | 13.6 | 18.53 | -2.81 | 14.15 | -0.0772 | 23.52 | -2.9 | 14.65 | 0.0359 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| 2022-09-30..2022-11-07 | 6.0 | 14.42 | -6.33 | 2.86 | -0.1481 | 8.21 | -6.17 | 2.11 | -0.2004 | 0.82 | -0.78 | 1.63 | -0.2166 | 5.95 | -4.63 | 1.99 | -0.1966 | 0.43 | -2.19 | 0.42 | -0.2956 |
| 2022-11-17..2022-11-17 | 0.0 | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| 2022-11-24..2022-12-08 | 3.7 | 5.62 | -4.07 | 3.05 | -0.3626 | -6.9 | -13.53 | -2.82 | -0.6414 | 0.0 | 0.0 | 0.0 | 0.0 | -0.6 | -0.7 | -6.37 | -0.8435 | -0.6 | -0.7 | -6.37 | -0.844 |
| 2022-12-12..2023-02-14 | 29.0 | 23.96 | -10.45 | 2.87 | -0.1005 | 18.23 | -12.73 | 2.12 | -0.1398 | 6.72 | -3.1 | 3.04 | -0.075 | 16.57 | -53.32 | 1.47 | -0.1289 | 3.18 | -16.02 | 0.59 | -0.2111 |
| 2023-03-01..2023-03-15 | 2.8 | 0.16 | -14.44 | 0.39 | -0.52 | -3.45 | -12.8 | -1.22 | -0.6195 | -1.02 | -1.02 | -7.1 | -0.6362 | -2.02 | -2.02 | -8.52 | -0.7454 | -1.35 | -1.35 | -8.07 | -0.7173 |
| 2023-04-17..2023-11-16 | 22.9 | 2.82 | -23.54 | 0.31 | -0.1177 | 13.72 | -27.9 | 0.7 | -0.0933 | -1.54 | -3.25 | -0.73 | -0.1733 | 12.27 | -47.7 | 0.68 | -0.0815 | 20.8 | -19.53 | 1.04 | -0.0754 |
| 2023-11-21..2023-11-21 | 0.0 | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| 2023-11-28..2023-11-29 | 0.1 | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| 2024-01-20..2024-02-13 | 19.2 | 10.87 | -8.25 | 4.1 | -0.2194 | 10.38 | -7.9 | 3.81 | -0.2396 | 1.9 | -0.08 | 8.0 | 0.1865 | 0.23 | -3.58 | 0.3 | -0.3993 | 0.41 | -2.66 | 0.63 | -0.392 |
| 2024-02-17..2024-02-25 | 0.2 | 7.69 | -3.01 | 10.49 | -0.2989 | 2.95 | -4.03 | 4.4 | -0.5061 | 0.03 | -0.53 | 0.38 | -0.7188 | -0.55 | -1.95 | -2.2 | -0.8412 | -0.92 | -1.47 | -7.86 | -1.2026 |
| 2024-05-01..2024-05-02 | 1.2 | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| 2024-05-08..2024-09-05 | -8.2 | -15.81 | -33.51 | -0.58 | -0.2136 | -13.16 | -29.49 | -0.42 | -0.203 | -2.41 | -3.29 | -2.14 | -0.2989 | -10.74 | -12.85 | -2.64 | -0.3179 | -3.62 | -5.63 | -1.72 | -0.2759 |
| 2024-09-09..2024-11-10 | 40.9 | 37.38 | -10.64 | 4.15 | -0.017 | 41.1 | -12.12 | 4.38 | -0.0115 | 2.78 | -1.17 | 3.0 | -0.0632 | 12.92 | -7.67 | 3.01 | -0.0693 | 11.96 | -2.66 | 4.22 | 0.0384 |
| 2025-02-04..2025-03-15 | -13.8 | -21.27 | -26.12 | -2.74 | -0.4636 | -19.01 | -29.74 | -1.41 | -0.4041 | 0.0 | 0.0 | 0.0 | 0.0 | -2.78 | -3.57 | -3.07 | -0.3587 | -2.77 | -3.56 | -3.06 | -0.3582 |
| 2025-03-18..2025-07-08 | 31.7 | 33.34 | -20.16 | 1.97 | -0.0754 | 19.45 | -23.52 | 1.26 | -0.1161 | 0.43 | -2.17 | 0.47 | -0.1587 | 3.73 | -6.0 | 0.86 | -0.1386 | 4.35 | -4.11 | 1.46 | -0.1009 |
| 2025-07-12..2025-07-12 | 0.0 | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| 2025-07-18..2025-11-19 | -22.4 | -18.47 | -31.77 | -0.86 | -0.2217 | -24.2 | -32.8 | -0.99 | -0.2272 | -1.56 | -2.85 | -0.69 | -0.2127 | -10.28 | -15.89 | -1.13 | -0.2283 | -6.16 | -10.6 | -1.07 | -0.2319 |
| 2025-11-26..2025-12-09 | 2.4 | 6.29 | -6.46 | 3.06 | -0.404 | -0.55 | -8.47 | 0.04 | -0.5635 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| 2025-12-24..2025-12-24 | 0.0 | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| 2026-01-08..2026-01-09 | -0.5 | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| 2026-01-12..2026-01-23 | -1.9 | -3.29 | -10.72 | -1.71 | -0.7168 | -5.11 | -11.72 | -2.92 | -0.7972 | -0.61 | -1.74 | -2.51 | -0.7681 | -2.16 | -5.84 | -2.27 | -0.8019 | -0.71 | -2.26 | -1.81 | -0.7545 |
| 2026-01-27..2026-01-28 | 0.1 | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| 2026-02-20..2026-02-20 | 0.0 | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| 2026-03-14..2026-03-18 | 0.0 | 2.58 | -5.64 | 3.09 | -0.9763 | 3.22 | -4.89 | 4.01 | -0.9065 | 0.0 | -0.49 | 0.08 | -1.1285 | -0.47 | -1.84 | -2.12 | -1.2365 | 0.73 | -0.66 | 5.3 | -0.7429 |
| 2026-03-23..2026-03-25 | 0.6 | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| 2026-04-10..2026-04-11 | 0.1 | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| 2026-04-17..2026-07-30 | -15.9 | -18.41 | -31.18 | -1.62 | -0.2761 | -16.19 | -24.06 | -1.27 | -0.2583 | -1.02 | -1.27 | -1.48 | -0.2653 | -3.06 | -7.43 | -0.7 | -0.23 | -3.81 | -6.51 | -1.4 | -0.2615 |
| 2026-08-05..2026-08-07 | 0.4 | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| 2026-08-11..2026-09-02 | 20.7 | 23.6 | -4.78 | 5.71 | -0.0127 | 26.99 | -6.46 | 6.12 | -0.0117 | 3.2 | -0.8 | 6.23 | -0.0256 | 13.2 | -4.0 | 5.57 | -0.0718 | 10.26 | -2.68 | 5.84 | -0.0383 |

### Bull Rally

| Periode | BTC% | BH2 Ret% | BH2 DD% | BH2 Sharpe | BH2 VaRSR | BH10 Ret% | BH10 DD% | BH10 Sharpe | BH10 VaRSR | 2-pair (BTC+ETH, max_conc Ret% | 2-pair (BTC+ETH, max_conc DD% | 2-pair (BTC+ETH, max_conc Sharpe | 2-pair (BTC+ETH, max_conc VaRSR | 10-pair vanilla (max_conc Ret% | 10-pair vanilla (max_conc DD% | 10-pair vanilla (max_conc Sharpe | 10-pair vanilla (max_conc VaRSR | 10-pair cluster-A2 (2pos/ Ret% | 10-pair cluster-A2 (2pos/ DD% | 10-pair cluster-A2 (2pos/ Sharpe | 10-pair cluster-A2 (2pos/ VaRSR | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2021-02-07..2021-05-08 | 51.8 | 105.3 | -24.2 | 3.97 | 0.0037 | 188.07 | -25.96 | 4.81 | 0.0507 | 14.37 | -4.86 | 3.71 | -0.0045 | 21.06 | -9.95 | 2.97 | -0.0527 | 24.11 | -9.19 | 3.2 | -0.0366 |
| 2021-11-25..2021-12-02 | -4.2 | -1.31 | -10.09 | -0.32 | -0.8057 | -2.31 | -7.28 | -1.59 | -0.8256 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| 2023-02-08..2023-02-08 | 0.0 | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| 2023-02-15..2023-02-28 | -4.9 | -4.38 | -6.5 | -3.18 | -0.7735 | -5.87 | -7.56 | -3.98 | -0.8072 | -0.77 | -1.07 | -3.4 | -0.7879 | -3.87 | -3.87 | -7.78 | -0.9771 | -1.97 | -1.97 | -5.04 | -0.8551 |
| 2023-03-13..2023-03-13 | 0.0 | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| 2023-03-16..2023-04-18 | 21.5 | 24.42 | -5.02 | 5.35 | -0.0527 | 26.7 | -4.84 | 5.5 | -0.0518 | 2.36 | -0.5 | 4.42 | -0.0825 | 8.52 | -2.42 | 4.38 | -0.1324 | 5.08 | -1.11 | 5.19 | -0.06 |
| 2023-11-17..2023-11-27 | 1.7 | 2.82 | -4.43 | 2.22 | -0.5195 | -0.36 | -7.32 | 0.07 | -0.6493 | 0.28 | -0.74 | 1.44 | -0.5855 | -1.12 | -7.62 | -0.45 | -0.6731 | -0.43 | -5.06 | -0.26 | -0.6678 |
| 2023-11-30..2024-01-19 | 10.4 | 17.61 | -7.38 | 2.56 | -0.149 | 20.41 | -10.95 | 2.73 | -0.144 | 1.53 | -2.37 | 1.22 | -0.2199 | 13.63 | -10.66 | 2.14 | -0.1738 | 9.15 | -10.26 | 1.9 | -0.1793 |
| 2024-02-14..2024-02-16 | 0.6 | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| 2024-02-19..2024-02-19 | 0.0 | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| 2024-02-26..2024-04-30 | 11.4 | 0.38 | -22.64 | 0.37 | -0.2276 | 3.85 | -23.7 | 0.66 | -0.2138 | 1.35 | -4.81 | 0.75 | -0.2078 | 12.49 | -37.01 | 1.14 | -0.179 | 0.15 | -9.13 | 0.13 | -0.2402 |
| 2024-05-03..2024-05-07 | -0.9 | -2.29 | -3.59 | -7.5 | -1.4603 | -0.74 | -2.36 | -2.23 | -1.1551 | 0.0 | 0.0 | 0.0 | 0.0 | -0.47 | -0.69 | -6.78 | -1.5438 | 0.0 | 0.0 | 0.0 | 0.0 |
| 2024-11-11..2025-02-03 | 14.3 | -2.08 | -19.23 | 0.09 | -0.2105 | 30.72 | -17.43 | 2.15 | -0.1064 | 1.95 | -2.86 | 0.96 | -0.1661 | -0.31 | -15.9 | 0.13 | -0.2091 | 1.77 | -7.11 | 0.48 | -0.1921 |
| 2025-07-07..2025-07-07 | 0.0 | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| 2025-07-10..2025-07-17 | 2.8 | 9.78 | -0.28 | 19.78 | 0.2521 | 16.68 | -0.27 | 21.17 | 0.3141 | 0.54 | -0.37 | 6.61 | -0.7049 | 7.33 | -18.98 | 2.54 | -0.6514 | 3.09 | -8.56 | 2.0 | -0.6971 |

## 3. Overall (seluruh periode)

| Config | Return% | Sharpe | MaxDD% | Trades |
|---|---|---|---|---|
| 2-pair (BTC+ETH, max_conc=1) | 38.65 | 0.95 | -7.42 | 32 |
| 10-pair vanilla (max_conc=5) | 158.46 | 0.53 | -58.64 | 171 |
| 10-pair cluster-A2 (2pos/cluster) | 152.0 | 0.82 | -26.45 | 94 |

| BH 2-pair | 418.32 | 0.79 | — | — |
| BH 10-pair | 155.03 | 0.89 | — | — |

## 4. Analisis: Apakah Strategi Melindungi Modal Saat Bear?

**Periode bear yang teridentifikasi:**
- 2021-05-19..2021-05-25 (BTC 4.7%):
  - 2-pair (BTC+ETH, max_conc=1): return 0.0%, maxDD 0.0% (vs BH: 3.35%, -25.62%)
  - 10-pair vanilla (max_conc=5): return 0.0%, maxDD 0.0% (vs BH: 3.35%, -25.62%)
  - 10-pair cluster-A2 (2pos/cluster): return 0.0%, maxDD 0.0% (vs BH: 3.35%, -25.62%)
- 2021-09-19..2021-09-29 (BTC -12.1%):
  - 2-pair (BTC+ETH, max_conc=1): return 0.0%, maxDD 0.0% (vs BH: -12.71%, -16.91%)
  - 10-pair vanilla (max_conc=5): return -2.7%, maxDD -2.7% (vs BH: -12.71%, -16.91%)
  - 10-pair cluster-A2 (2pos/cluster): return -2.7%, maxDD -2.7% (vs BH: -12.71%, -16.91%)
- 2022-01-06..2022-03-08 (BTC -10.1%):
  - 2-pair (BTC+ETH, max_conc=1): return -0.8%, maxDD -0.95% (vs BH: -29.54%, -31.01%)
  - 10-pair vanilla (max_conc=5): return 0.57%, maxDD -3.69% (vs BH: -29.54%, -31.01%)
  - 10-pair cluster-A2 (2pos/cluster): return -3.79%, maxDD -4.38% (vs BH: -29.54%, -31.01%)
- 2022-03-11..2022-03-12 (BTC 0.2%):
  - 2-pair (BTC+ETH, max_conc=1): return N/A%, maxDD N/A% (vs BH: N/A%, N/A%)
  - 10-pair vanilla (max_conc=5): return N/A%, maxDD N/A% (vs BH: N/A%, N/A%)
  - 10-pair cluster-A2 (2pos/cluster): return N/A%, maxDD N/A% (vs BH: N/A%, N/A%)
- 2022-07-02..2022-09-29 (BTC 1.8%):
  - 2-pair (BTC+ETH, max_conc=1): return -1.85%, maxDD -2.63% (vs BH: 2.63%, -24.51%)
  - 10-pair vanilla (max_conc=5): return -3.45%, maxDD -9.7% (vs BH: 2.63%, -24.51%)
  - 10-pair cluster-A2 (2pos/cluster): return 0.19%, maxDD -5.06% (vs BH: 2.63%, -24.51%)
- 2022-11-08..2022-11-23 (BTC -10.4%):
  - 2-pair (BTC+ETH, max_conc=1): return 0.0%, maxDD 0.0% (vs BH: -7.61%, -12.83%)
  - 10-pair vanilla (max_conc=5): return -2.17%, maxDD -2.17% (vs BH: -7.61%, -12.83%)
  - 10-pair cluster-A2 (2pos/cluster): return 0.0%, maxDD 0.0% (vs BH: -7.61%, -12.83%)
- 2022-12-09..2022-12-11 (BTC -0.2%):
  - 2-pair (BTC+ETH, max_conc=1): return N/A%, maxDD N/A% (vs BH: N/A%, N/A%)
  - 10-pair vanilla (max_conc=5): return N/A%, maxDD N/A% (vs BH: N/A%, N/A%)
  - 10-pair cluster-A2 (2pos/cluster): return N/A%, maxDD N/A% (vs BH: N/A%, N/A%)
- 2024-07-07..2024-07-07 (BTC 0.0%):
  - 2-pair (BTC+ETH, max_conc=1): return N/A%, maxDD N/A% (vs BH: N/A%, N/A%)
  - 10-pair vanilla (max_conc=5): return N/A%, maxDD N/A% (vs BH: N/A%, N/A%)
  - 10-pair cluster-A2 (2pos/cluster): return N/A%, maxDD N/A% (vs BH: N/A%, N/A%)
- 2024-09-06..2024-09-08 (BTC 1.7%):
  - 2-pair (BTC+ETH, max_conc=1): return N/A%, maxDD N/A% (vs BH: N/A%, N/A%)
  - 10-pair vanilla (max_conc=5): return N/A%, maxDD N/A% (vs BH: N/A%, N/A%)
  - 10-pair cluster-A2 (2pos/cluster): return N/A%, maxDD N/A% (vs BH: N/A%, N/A%)
- 2025-03-16..2025-03-17 (BTC 1.7%):
  - 2-pair (BTC+ETH, max_conc=1): return N/A%, maxDD N/A% (vs BH: N/A%, N/A%)
  - 10-pair vanilla (max_conc=5): return N/A%, maxDD N/A% (vs BH: N/A%, N/A%)
  - 10-pair cluster-A2 (2pos/cluster): return N/A%, maxDD N/A% (vs BH: N/A%, N/A%)
- 2025-04-06..2025-04-06 (BTC 0.0%):
  - 2-pair (BTC+ETH, max_conc=1): return N/A%, maxDD N/A% (vs BH: N/A%, N/A%)
  - 10-pair vanilla (max_conc=5): return N/A%, maxDD N/A% (vs BH: N/A%, N/A%)
  - 10-pair cluster-A2 (2pos/cluster): return N/A%, maxDD N/A% (vs BH: N/A%, N/A%)
- 2025-11-20..2025-11-25 (BTC 0.8%):
  - 2-pair (BTC+ETH, max_conc=1): return 0.0%, maxDD 0.0% (vs BH: 3.86%, -3.91%)
  - 10-pair vanilla (max_conc=5): return 0.0%, maxDD 0.0% (vs BH: 3.86%, -3.91%)
  - 10-pair cluster-A2 (2pos/cluster): return 0.0%, maxDD 0.0% (vs BH: 3.86%, -3.91%)
- 2025-12-01..2025-12-01 (BTC 0.0%):
  - 2-pair (BTC+ETH, max_conc=1): return N/A%, maxDD N/A% (vs BH: N/A%, N/A%)
  - 10-pair vanilla (max_conc=5): return N/A%, maxDD N/A% (vs BH: N/A%, N/A%)
  - 10-pair cluster-A2 (2pos/cluster): return N/A%, maxDD N/A% (vs BH: N/A%, N/A%)
- 2025-12-10..2026-01-07 (BTC -0.7%):
  - 2-pair (BTC+ETH, max_conc=1): return -1.34%, maxDD -1.34% (vs BH: -0.02%, -11.92%)
  - 10-pair vanilla (max_conc=5): return -0.4%, maxDD -2.28% (vs BH: -0.02%, -11.92%)
  - 10-pair cluster-A2 (2pos/cluster): return -0.82%, maxDD -1.28% (vs BH: -0.02%, -11.92%)
- 2026-01-10..2026-01-11 (BTC 0.6%):
  - 2-pair (BTC+ETH, max_conc=1): return N/A%, maxDD N/A% (vs BH: N/A%, N/A%)
  - 10-pair vanilla (max_conc=5): return N/A%, maxDD N/A% (vs BH: N/A%, N/A%)
  - 10-pair cluster-A2 (2pos/cluster): return N/A%, maxDD N/A% (vs BH: N/A%, N/A%)
- 2026-01-24..2026-01-26 (BTC -1.0%):
  - 2-pair (BTC+ETH, max_conc=1): return N/A%, maxDD N/A% (vs BH: N/A%, N/A%)
  - 10-pair vanilla (max_conc=5): return N/A%, maxDD N/A% (vs BH: N/A%, N/A%)
  - 10-pair cluster-A2 (2pos/cluster): return N/A%, maxDD N/A% (vs BH: N/A%, N/A%)
- 2026-01-29..2026-03-13 (BTC -16.2%):
  - 2-pair (BTC+ETH, max_conc=1): return -0.25%, maxDD -0.92% (vs BH: -20.56%, -29.69%)
  - 10-pair vanilla (max_conc=5): return -0.68%, maxDD -4.16% (vs BH: -20.56%, -29.69%)
  - 10-pair cluster-A2 (2pos/cluster): return -0.68%, maxDD -4.16% (vs BH: -20.56%, -29.69%)
- 2026-03-19..2026-03-22 (BTC -2.9%):
  - 2-pair (BTC+ETH, max_conc=1): return N/A%, maxDD N/A% (vs BH: N/A%, N/A%)
  - 10-pair vanilla (max_conc=5): return N/A%, maxDD N/A% (vs BH: N/A%, N/A%)
  - 10-pair cluster-A2 (2pos/cluster): return N/A%, maxDD N/A% (vs BH: N/A%, N/A%)
- 2026-03-26..2026-04-09 (BTC 4.3%):
  - 2-pair (BTC+ETH, max_conc=1): return 0.0%, maxDD 0.0% (vs BH: 1.1%, -4.11%)
  - 10-pair vanilla (max_conc=5): return -1.11%, maxDD -1.11% (vs BH: 1.1%, -4.11%)
  - 10-pair cluster-A2 (2pos/cluster): return -0.76%, maxDD -0.83% (vs BH: 1.1%, -4.11%)
- 2026-04-12..2026-04-16 (BTC 6.2%):
  - 2-pair (BTC+ETH, max_conc=1): return 0.75%, maxDD -0.22% (vs BH: 7.95%, -1.44%)
  - 10-pair vanilla (max_conc=5): return 1.56%, maxDD -0.46% (vs BH: 7.95%, -1.44%)
  - 10-pair cluster-A2 (2pos/cluster): return 1.56%, maxDD -0.46% (vs BH: 7.95%, -1.44%)
- 2026-04-19..2026-04-19 (BTC 0.0%):
  - 2-pair (BTC+ETH, max_conc=1): return N/A%, maxDD N/A% (vs BH: N/A%, N/A%)
  - 10-pair vanilla (max_conc=5): return N/A%, maxDD N/A% (vs BH: N/A%, N/A%)
  - 10-pair cluster-A2 (2pos/cluster): return N/A%, maxDD N/A% (vs BH: N/A%, N/A%)
- 2026-07-31..2026-08-04 (BTC 1.9%):
  - 2-pair (BTC+ETH, max_conc=1): return 0.3%, maxDD -0.01% (vs BH: 1.67%, -0.66%)
  - 10-pair vanilla (max_conc=5): return 0.52%, maxDD -0.73% (vs BH: 1.67%, -0.66%)
  - 10-pair cluster-A2 (2pos/cluster): return 0.32%, maxDD -0.15% (vs BH: 1.67%, -0.66%)
- 2026-08-08..2026-08-12 (BTC -2.3%):
  - 2-pair (BTC+ETH, max_conc=1): return -0.35%, maxDD -0.35% (vs BH: -1.34%, -1.43%)
  - 10-pair vanilla (max_conc=5): return -0.36%, maxDD -0.75% (vs BH: -1.34%, -1.43%)
  - 10-pair cluster-A2 (2pos/cluster): return -1.22%, maxDD -1.22% (vs BH: -1.34%, -1.43%)

**Kesimpulan perlindungan bear:**
- Strategi **unggul** dibanding buy-and-hold di beberapa periode bear berikut:
  - 2-pair (BTC+ETH, max_conc=1) pada 2021-09-19: strategi 0.0% vs BH -12.71%
  - 10-pair vanilla (max_conc=5) pada 2021-09-19: strategi -2.7% vs BH -12.71%
  - 10-pair cluster-A2 (2pos/cluster) pada 2021-09-19: strategi -2.7% vs BH -12.71%
  - 2-pair (BTC+ETH, max_conc=1) pada 2022-01-06: strategi -0.8% vs BH -29.54%
  - 10-pair vanilla (max_conc=5) pada 2022-01-06: strategi 0.57% vs BH -29.54%
  - 10-pair cluster-A2 (2pos/cluster) pada 2022-01-06: strategi -3.79% vs BH -29.54%
  - 2-pair (BTC+ETH, max_conc=1) pada 2022-11-08: strategi 0.0% vs BH -7.61%
  - 10-pair vanilla (max_conc=5) pada 2022-11-08: strategi -2.17% vs BH -7.61%
  - 10-pair cluster-A2 (2pos/cluster) pada 2022-11-08: strategi 0.0% vs BH -7.61%
  - 2-pair (BTC+ETH, max_conc=1) pada 2026-01-29: strategi -0.25% vs BH -20.56%
  - 10-pair vanilla (max_conc=5) pada 2026-01-29: strategi -0.68% vs BH -20.56%
  - 10-pair cluster-A2 (2pos/cluster) pada 2026-01-29: strategi -0.68% vs BH -20.56%
  - 2-pair (BTC+ETH, max_conc=1) pada 2026-08-08: strategi -0.35% vs BH -1.34%
  - 10-pair vanilla (max_conc=5) pada 2026-08-08: strategi -0.36% vs BH -1.34%
  - 10-pair cluster-A2 (2pos/cluster) pada 2026-08-08: strategi -1.22% vs BH -1.34%

**Perlindungan terbatas yang TETAP ada:**
- ATR stop loss membatasi loss per trade (stop di entry - 2x ATR), jadi trade individu tidak akan hancur total
- Gap stop (exit di open jika harga langsung gap di bawah stop) membantu untuk flash crash
- Cluster limit (Exp A2) membatasi jumlah posisi terbuka simultan, mengurangi correlated drawdown

## 5. Tabel: Di Rezim Mana Strategi Unggul/Kalah?

| Config | Bull | Bear | Sideways | Kesimpulan |
|---|---|---|---|---|
| 2-pair (BTC+ETH, max_conc=1) | ❌ Bull (6 segmen kalah) | ❌ Bear (7 segmen kalah) | ❌ Sideways (12 segmen kalah) | Aman di bull, riskan di bear |
| 10-pair vanilla (max_conc=5) | ❌ Bull (6 segmen kalah) | ❌ Bear (7 segmen kalah) | ❌ Sideways (12 segmen kalah) | Aman di bull, riskan di bear |
| 10-pair cluster-A2 (2pos/cluster) | ❌ Bull (7 segmen kalah) | ❌ Bear (7 segmen kalah) | ✅ Sideways (12 segmen unggul) | Aman di bull, riskan di bear |

![Regime Segmentation Chart](regime_segmentation.png)

---
*Definisi rezim kuantitatif: rolling 90-day return BTC. Bear <-20%, Bull >+40%, sisanya sideways. Data: Bitget, 2020-11-09 s.d. 2026-09-02.*