# OD-5 — Data Integrity, Missing Bars & Dataset Rebuild Decision Audit

> **Mode: FORENSIC DATA AUDIT ONLY.** Audit ini tidak mengubah data, CSV, konfigurasi,
> strategi, laporan, atau hasil resmi apa pun. Tidak ada treatment data (ffill, imputasi,
> timestamp/OHLC edit) yang dipilih atas nama owner. Semua kandidat diagnostic dijalankan
> hanya di `/tmp` terhadap engine copy/import read-only. Satu-satunya file repo baru adalah
> dokumen ini. **Tidak ada commit, tidak ada push, tidak ada eksekusi OD-6.**
>
> | Field | Nilai |
> |---|---|
> | Tanggal audit | 2026-09-25 |
> | HEAD saat audit | `d728ec891036a62f142d98ade8913a0e86176370` (main, synced) |
> | Scope data | `data/historical/*.csv` (13 file) + `data/funding/*.csv` (2 file) |
> | Status register | OD-5.1 – OD-5.10 semuanya `OWNER DECISION REQUIRED` |
> | Keputusan baru di luar register | Tidak ada (keputusan canonical-metric A/B sudah terdaftar pending di `ARCHITECTURE.md` §16 — tidak diduplikasi di sini) |
>
> **Label evidence (dipakai konsisten di seluruh dokumen):**
> `VERIFIED` (dibuktikan langsung di repo/data saat audit) · `STRONGLY SUPPORTED` (bukti
> kuat multi-sumber, belum deductif) · `INFERRED` (penalaran dari bukti tidak langsung) ·
> `UNKNOWN` (tidak dapat ditentukan dari artefak yang tersedia) ·
> `OWNER DECISION REQUIRED` · `NOT SPECIFIED IN APPROVED PPT` ·
> `PROVENANCE UNKNOWN` · `CAUSE UNKNOWN` ·
> `FORENSIC SENSITIVITY — NOT CANONICAL THESIS RESULT` (label wajib untuk setiap run alternatif).

---

## 1. Executive Summary

Temuan utama (semua divalidasi ulang secara independen selama audit ini, bukan salinan
hasil audit sebelumnya):

1. **Total missing bar interior pada 10 pair thesis = 1.635** — reproduksi eksak dari
   temuan Phase 2H F1 (`VERIFIED`). Distribusi: 5 pair × 204, 2 pair × 203, 2 pair × 104,
   HYPE × 1. Semua adalah **DATA GAP interior** (berada di dalam rentang data aset itu).
2. **Gap tersinkronisasi dalam 3 grup + 1 kasus tunggal**, dan setiap grup berangkatan
   persis `since + 300 hari` dari parameter request fetch (`VERIFIED`, §10):
   - G1 {BTC, ETH, XRP, LINK, DOGE}: hole 2021-05-28..09-04 & 2022-03-24..07-01 (100 hari) + 4 single-day
   - G2 {SOL, BNB}: hole 2021-10-28..2022-02-04 & 2022-08-24..12-01 + 3 single-day
   - G3 {AVAX, ADA}: hole 2022-03-28..07-05 + 4 single-day (selalu +4 hari setelah single G1)
   - HYPE: 1 single-day (2025-03-29)
3. **Signature-nya menunjuk ke jalur ekstraksi, bukan kalender venue** (`STRONGLY SUPPORTED`):
   lubang terkunci pada timestamp request kita (parameter `since`), bukan pada kejadian
   venue. Kandidat penyebab terkuat = perilaku window API/ccxt pada request deep-history
   **tanpa sanity-check `candles[0]`** di `scripts/fetch_bitget_data.py:43`. Lapisan pasti
   yang menghasilkan lubang **tidak dapat dibuktikan tanpa refetch → `CAUSE UNKNOWN`**;
   kandidat lain (venue outage, korupsi storage/git) terbantah secara logika/empiris (§10).
4. **Integritas OHLCV bersih**: 0 NaN/inf, 0 pelanggaran invariant (high≥max(o,c), low≤min(o,c), high≥low, harga>0, volume≥0), 0 tanggal duplikat, 0 baris duplikat, urutan naik unik — di semua 13 file (`VERIFIED`, §11).
5. **4 hari tanpa aset apa pun** (2021-05-28..31) → hari itu tidak muncul sama sekali di
   equity curve (2.124 hari span → 2.120 baris curve) (`VERIFIED`, §8/§14).
6. **Terdapat aritmatika tak wajar pada hari gap**: drawdown terburuk baseline
   (−26,45%) tepat jatuh pada hari gap 2023-01-22, dan ada hari return equity ±16–20%
   yang hanya ada karena nilai posisi hilang saat bar simbolnya absen
   (`VERIFIED`, §14/§15) — ini **fakta mekanis**, bukan penilaian strategi.
7. **Sensitivity carry-forward (diagnostic, terlabel)**: −26,45% → **−18,10%**, Sharpe
   0,82 → **1,10**, trade 94 → 95, artefak hari-hari besar hilang — konsisten dengan
   angka Phase 2H (−18,10/1,10) (`VERIFIED` vs `FORENSIC SENSITIVITY — NOT CANONICAL
   THESIS RESULT`). **Angka ini BUKAN alasan memilih treatment**; pemilihan treatment
   tetap keputusan owner (OD-5.3).
8. **Label periode `2020-08..2026-08` tidak cocok dengan data aktual**
   `2020-11-09..2026-09-02` (start meleset 100 hari; data berakhir 1 bulan setelah label)
   (`VERIFIED`, §18).
9. **Provenance separuh lengkap**: generator, parameter, dan commit teridentifikasi;
   tetapi file tidak menyimpan metadata sumber, timestamp mentah dibuang
   (`fetch_bitget_data.py:92`), log fetch asli tidak disimpan, versi ccxt di CI tidak
   dipin → detail tertentu `PROVENANCE UNKNOWN` (§5).
10. **Dataset tidak dapat direproduksi byte-per-byte saat ini** (`NOT FULLY
    REPRODUCIBLE`, §25). Verifikasi sumber eksternal **diblokir jaringan audit ini** (DNS
    exchange di-hijack filter ISP, §26) → penyebab tidak dapat dipastikan dari sisi venue
    dalam sesi ini.
11. **Tidak ada treatment/rebuild yang dipilih di dokumen ini.** Empat opsi (A–D)
    dievaluasi tanpa dipilih (§22), spesifikasi rebuild disusun tapi tidak diimplementasi
    (§23), 12 acceptance test disusun (§24), dan **OD-5.1–OD-5.10 didaftarkan untuk
    keputusan owner** (§27).

---

## 2. Scope & Mandate

**Masuk scope:** inventaris & provenance dataset; kalender global; audit missing bar
(termasuk reproduksi 1.635 Phase 2H); audit OHLC/timestamp/kalender; analisis gap
tersinkronisasi dan signature source-code-nya; audit outlier; semantics hari-gap;
alignment lintas-aset dan mekanika engine terkait data; sensitivity historis diagnostic
(labeled); listing/warm-up/lookback; audit periode studi; kasus HYPE; survivorship;
look-ahead availability (bukti saja); evaluasi opsi rebuild A–D; draft spesifikasi
rebuild; acceptance tests; status reproducibility; verifikasi sumber eksternal (bila
memungkinkan); registrasi keputusan OD-5.1–OD-5.10.

**Keluar scope (dibatasi secara mengikat):** mengubah apapun di `data/`, `config.yaml`,
strategi, engine, laporan resmi; memilih treatment data; mengganti hasil canonical;
memberikan verdict strategi; commit/push; OD-6.

**Pemisahan wajib yang dipertahankan di seluruh dokumen:**
- **Integritas data** (apakah bar ada/lengkap/konsisten) — §4–§14.
- **Pilihan metodologis** (apa yang boleh dilakukan terhadap gap/periode/universe) — §16–§24, §27 (hanya mengajukan, tidak memilih).
- **Sensitivitas historis** (angka apa yang berubah jika asumsi berbeda) — §15, terlabel.

---

## 3. Source Hierarchy Applied

Urutan hierarki yang dipakai (paling mengikat → paling rujukan):

1. **PPT persetujuan** (kutipan L1 dari `/tmp/opencode/od2_ppt.txt`):
   - PPT:181 — `Sumber Data: Bitget — 10 cryptocurrency: BTC, ETH, SOL, BNB, XRP, AVAX, LINK, DOGE, ADA, HYPE`
   - PPT:183 — `Timeframe: 1D (daily candle close)`
   - PPT:89 — `Eksplorasi awal data Bitget 2020–2026`
   - PPT:294 — `Mohon saran batasan jumlah/kriteria pemilihan cryptocurrency untuk meminimalkan potensi survivorship bias.`
   - PPT **TIDAK** menentukan: tanggal mulai fetch, kebijakan missing bar, definisi
     kalender/hari-hilang, timezone/boundary candle, kebijakan rebuild, kriteria
     acceptance dataset → status: **`NOT SPECIFIED IN APPROVED PPT`** →
     **`OWNER DECISION REQUIRED`**.
2. **Keputusan owner eksplisit** (OD-1 s/d OD-4; tidak ada yang membahas treatment gap
   data → tidak ada yang bisa dipakai di sini). Keputusan OD-4 yang masih pending tetap
   binding dan tidak disubstitusi oleh OD-5.
3. **Phase 2G** (`PHASE2G_RESEARCH_THESIS_FORENSIC_AUDIT.md` §5, D1–D4) — inventaris
   data, staggered history, bukti data frozen.
4. **Phase 2H** (`PHASE2H_THESIS_METHODOLOGY_AND_BACKTEST_VALIDITY_AUDIT.md` F1, §13,
   §15, §20) — tabel gap 1.635 dan sensitivity carry-forward (target reproduksi).
5. **OD-2 → OD-3 → OD-4** — audit sebelumnya (mekanika MTM, sizing); tidak mengikat
   keputusan data.
6. **Repo data + scripts** (`data/historical/`, `scripts/fetch_bitget_data.py`,
   `backtest/run_backtest.py`, `config.yaml`, git history) — bukti primer audit ini.
7. **Dokumen sumber eksternal** — hanya untuk provenance/verifikasi (§26), bukan
   penentu metodologi.

---

## 4. Dataset Inventory

### 4.1 File OHLCV (13 file, semua git-tracked — `VERIFIED` via `git ls-files`)

| # | File | Rows | First | Last | Kolom (header) | Peran | Sumber (generator) | Commit pertama / terakhir |
|---|---|---|---|---|---|---|---|---|
| 1 | `BTC_USDT_1d.csv` | 1920 | 2020-11-09 | 2026-09-02 | `open,high,low,close,volume,date` | thesis (config) | Bitget spot via `scripts/fetch_bitget_data.py` (ccxt) | `90886b7` / `3e5caae` (2026-09-02) |
| 2 | `ETH_USDT_1d.csv` | 1920 | 2020-11-09 | 2026-09-02 | idem | thesis | idem | idem |
| 3 | `XRP_USDT_1d.csv` | 1920 | 2020-11-09 | 2026-09-02 | idem | thesis | idem | idem |
| 4 | `LINK_USDT_1d.csv` | 1763 | 2021-04-15 | 2026-09-02 | idem | thesis | idem | `90886b7` / `3e5caae` |
| 5 | `DOGE_USDT_1d.csv` | 1753 | 2021-04-25 | 2026-09-02 | idem | thesis | idem | `90886b7` / `3e5caae` |
| 6 | `SOL_USDT_1d.csv` | 1696 | 2021-06-22 | 2026-09-02 | idem | thesis | idem (setelah retry-fix `9db5464`) | `4549867` / `3e5caae` |
| 7 | `BNB_USDT_1d.csv` | 1717 | 2021-06-01 | 2026-09-02 | idem | thesis | idem | `4549867` / `3e5caae` |
| 8 | `AVAX_USDT_1d.csv` | 1646 | 2021-11-18 | 2026-09-02 | idem | thesis | idem | `4549867` / `3e5caae` |
| 9 | `ADA_USDT_1d.csv` | 1521 | 2022-03-23 | 2026-09-02 | idem | thesis | idem | `4549867` / `3e5caae` |
| 10 | `HYPE_USDT_1d.csv` | 623 | 2024-12-18 | 2026-09-02 | idem | thesis | idem (retry 2024/2025, `bd64337`) | `84ebc5d` / `3e5caae` |
| 11 | `BCH_USDT_1d.csv` | 2134 | 2020-11-01 | 2026-09-04 | `date,close,high,low,open,volume` | **riset saja** (REPO_MAP:178; D2 Phase 2G) | yfinance (`INFERRED` — pipeline `fetch_yf` di `correlation_mitigation.py:125-134`; pemanggilan BCH tidak ada di git → sebagian `UNKNOWN`) | `c42a478` (2026-09-07) |
| 12 | `LTC_USDT_1d.csv` | 2134 | 2020-11-01 | 2026-09-04 | idem | riset saja | idem | `c42a478` |
| 13 | `PAXG_USDT_1d.csv` | 2134 | 2020-11-01 | 2026-09-04 | idem | riset saja (`correlation_mitigation.py:157` → `yf.download("PAXG-USD")`, `VERIFIED`) | yfinance | `c42a478` |

Timeframe: `1d` (nama file + `config.yaml:16 timeframe: "1d"` + PPT:183) — `VERIFIED`.
**Metadata sumber di dalam file: tidak ada** (tidak ada kolom venue/symbol/tz/fetch-date/
tool-version) → klaim provenance per-file `PROVENANCE UNKNOWN` di tingkat file; sumber
luar-file hanya bisa diimputasi dari script + workflow + commit (`§5`).

### 4.2 File funding (2 file, git-tracked)

| File | Rows | First | Last | Kolom | Peran | Sumber |
|---|---|---|---|---|---|---|
| `data/funding/BTCUSDT_daily.csv` | 2191 | 2020-08-01 | 2026-07-31 | `date,daily_rate` | riset long-short saja (TIDAK dipakai backtest thesis) | `data.binance.vision` via `backtest/research/fetch_funding.py` (`VERIFIED` Phase 2G:71) |
| `data/funding/ETHUSDT_daily.csv` | 2191 | 2020-08-01 | 2026-07-31 | idem | idem | idem |

Catatan: script funding mendokumentasikan pengisian bulan yang dump-nya belum tersedia
dengan **trailing average** (`fetch_funding.py` docstring) → apakah ada baris sintetis di
file (`longest identical-consecutive run = 22` ditemukan) → **`UNKNOWN`** (log tidak
disimpan); di luar inti audit karena funding bukan input thesis.

### 4.3 Dua skema dalam satu folder (`VERIFIED`)

Thesis-10 memakai `open,high,low,close,volume,date`; riset-3 memakai
`date,close,high,low,open,volume`. Konsumen aktif: `run_backtest` **hanya** membaca
thesis-10 (REPO_MAP:117; `load_ohlcv` per symbol config); `BCH/LTC/PAXG` hanya oleh
`correlation_mitigation.py:250-259` (kandidat korelasi, kesimpulan riset "tidak cocok").
Kelas pemakaian berbeda → perbedaan skema **mencatat** fakta, bukan pelanggaran (T01
harus mengunci per-kelas, §24).

### 4.4 Checksum (dihitung saat audit ini — `VERIFIED`; TIDAK ada checksum generasi)

```text
f0cc1dc6231ce3525d5edf663846ce996a9b40016fef841f086b3819fcb7353e  ADA_USDT_1d.csv
2c808bdeea27c2b46fab108348de43553572a191a0171255e3c6610315cd70d7  AVAX_USDT_1d.csv
68d550d2338f95004d764f2705e54f97ad5764e5e0ee7b62b6c12a176f6674f2  BCH_USDT_1d.csv
0a5466dad91bff64b0d075b9eff363622e97535268cb86b4e4262dcae616ca0f  BNB_USDT_1d.csv
1285c34fb0e040e53dd17453c0c6b96e5d395d243878fcd4fa203fb5ef8ea28c  BTC_USDT_1d.csv
48b22aaeb0d8294e0770bbd814e6d1b8a3a040f3c152366f67f8afe654f2e28a  DOGE_USDT_1d.csv
f5b7acf74dd708d91e607c50e1b39b900679beee1137873f6390367f313b5207  ETH_USDT_1d.csv
dd9fec730673722a4b2fb2f662f2e683c906e21953dd60e82e6e5bdbe1073c5c  HYPE_USDT_1d.csv
cb8a00e9c645d6f2500955a430724986d057e533c9eea25bf84bba7126796c2a  LINK_USDT_1d.csv
425e97fb3e9a4ea63b4d0592ce4bb1bb3da60517e7feb1b4917a46832fd44954  LTC_USDT_1d.csv
f0852d05abc34cd6ca674bdb052d55e05dc058e4eeff949ee6c97cd6ac8d7443  PAXG_USDT_1d.csv
da3e4e0a571779b305596a53cc0a8a71f3682c760ea22f5343c95194c2e0738f  SOL_USDT_1d.csv
9c9c3b8c61c06d672c531648a3c3961645276581fa503a6bff487ab262325671  XRP_USDT_1d.csv
1164ef2cf90c20a889ed299984b7cf8fe435b8c01c4c7a34e4064f7e449877dd  funding/BTCUSDT_daily.csv
22ffc84f8fbe2877df8dba0538eaf4f03ca7aa5f638962ec6aa2ec744b15ae12  funding/ETHUSDT_daily.csv
```

---

## 5. Provenance Audit

### 5.1 Pipeline (raw → file → angka) — `VERIFIED` kecuali ditandai lain

```text
Bitget public API (spot, 1d)
  └─ scripts/fetch_bitget_data.py (ccxt.bitget, enableRateLimit)
       :38  start_ms = 2020-08-01 00:00 UTC
       :43  fetch_ohlcv(since=current_ms, limit=1000)   [pagination manual]
       :44-46  exception → break  (hanya memotong EKOR, tidak membuat lubang interior)
       :48-71  empty di awal → retry dari [2021-01-01, 2021-06-01, 2022-01-01,
                2023-01-01] (+ 2024-01-01, 2024-06-01, 2025-01-01 setelah bd64337)
       :84  current_ms = last_ts + 86_400_000
       :90-92  ts → kolom date (UTC calendar) ; **ts mentah DIBUANG**
       :94-111  deteksi gap (WARN) — kode ini ditambahkan belakangan (b96decc, 2026-09-12)
       :112  drop_duplicates keep-first + sort ascending
  └─ .github/workflows/fetch-bitget-data.yml (workflow_dispatch; ubuntu-latest;
       `pip install ccxt pandas pyyaml` TANPA versi pin; commit fixed message;
       push) — log fetch CI TIDAK disimpan di repo
  └─ data/historical/*.csv (frozen 2026-09-02 12:09 UTC, commit 3e5caae)
  └─ backtest/run_backtest.py::load_ohlcv (:52-68) → indikator → engine → reports/
```

### 5.2 Timeline generasi dataset (jam = UTC, dari git — `VERIFIED`)

| Waktu (2026-09-02) | Commit | Peristiwa |
|---|---|---|
| 10:43:40 | `9b5b06a` | script fetch + workflow ditambahkan |
| 10:51:29 | `6ff3c1d` | config → 9 pair (tambah AVAX, LINK, DOGE, ADA) |
| 10:57:51 | `90886b7` | run pertama: **BTC, ETH, XRP, LINK, DOGE** dibuat (grup G1 — satu-satunya yang sukses dari `since=2020-08-01`) |
| 11:01:44 | `03d85e3` | refetch 5 file → **hanya candle final (in-progress) berubah; seluruh riwayat byte-identik termasuk lubangnya** |
| 11:04:10 | `9db5464` | fix retry-from-later-date ("Bitget kosong dari 2020") |
| 11:07:12 | `4549867` | **SOL, BNB, AVAX, ADA** dibuat (grup G2+G3, lewat retry) |
| 11:14:34 | `730ee09` | HYPE masuk config → 10 pair |
| 11:16:40 | `bd64337` | retry 2024/2025 ditambahkan |
| 11:17:44 | `84ebc5d` | **HYPE** dibuat |
| 12:09:30 | `3e5caae` | refresh semua 10 pair — **data frozen sejak sini** |
| 2026-09-06 | `e6188de` | Snapshot A (`metrics.md`) ter-commit |
| 2026-09-07 | `c42a478` | BCH/LTC/PAXG + funding masuk |
| 2026-09-12 | `b96decc` | deteksi-gap WARN ditambahkan ke script; **data tidak pernah di-refetch** |

### 5.3 Signature dalam source code (`VERIFIED`)

- **Tidak ada sanity-check `candles[0]`**: loop hanya memeriksa `last_ts > current_ms`
  (progress). Bila API mengembalikan candle mulai lebih akhir dari `since`, hari di
  antaranya **dilewati diam-diam** → dapat menghasilkan lubang interior.
- `break` pada exception/empty = **truncasi ekor saja** → tidak bisa menjelaskan lubang
  interior (penalaran kode `VERIFIED`).
- `drop(columns=["ts"])` (:92) → **timestamp mentah & zona tidak tersimpan** → boundary
  candle tidak bisa diverifikasi dari file (§7).
- Tidak ada kolom metadata/checksum/log unduhan di file → **`PROVENANCE UNKNOWN`** untuk
  tanggal unduhan per file (hanya bisa diimputasi dari commit), versi ccxt saat fetch
  (workflow unpinned), dan perilaku API saat itu.

### 5.4 Status penyebab gap → **`CAUSE UNKNOWN`** (klasifikasi kandidat, §10)

---

## 6. Asset Universe & Instrument Mapping

- Universe thesis = **10 pasangan persis seperti PPT:181** (`config.yaml:5-15 pairs`) —
  daftar ini ex-ante di PPT (`VERIFIED`).
- Mapping simbol: `{SYM}/USDT` ↔ file `{SYM}_USDT_1d.csv` ↔ `timeframe "1d"`
  (`VERIFIED` semua 10 cocok).
- Quote currency USDT; **spot** `STRONGLY SUPPORTED` (header script "Bitget spot markets",
  filter `markets[...].get("spot")`, seluruh jalur eksekusi repo memakai endpoint spot
  `monitoring/web/lib/bitget.ts:7,43`; PPT tidak menyebut tipe produk). Jenis produk
  candle yang persis diambil tidak bisa diverifikasi dari artefak tersimpan (log tidak
  ada) → detail `UNKNOWN` tapi tidak material untuk OHLC harian (kandidat perhatian kecil).
- **Tanggal listing per aset: `UNKNOWN`** — verifikasi eksternal diblokir (§26). Akibatnya
  klasifikasi "sebelum bar pertama" tidak bisa dijamin PRE-LISTING (§9).
- Fakta penting: start BTC/ETH/XRP = `2020-08-01 + 100 hari` (2020-11-09) — apakah
  kedalaman historis venue memang mulai di situ atau 100 hari pertama ikut terlewat saat
  fetch → **`UNKNOWN`** (kandidat keduanya terbuka; hanya refetch bisa membedakan).

---

## 7. Timeframe & Timestamp Audit

| Pemeriksaan | Hasil | Label |
|---|---|---|
| Format tanggal semua file | cocok regex `YYYY-MM-DD` (date-only, tanpa waktu/tz) | `VERIFIED` |
| Monoton naik / unik / urut | True/True/True di semua 13 file | `VERIFIED` |
| Boundary hari | tersimpan sebagai tanggal kalender; dihasilkan dari konversi ms → UTC date (`fetch:91`) → **boundary = 00:00 UTC diinferensikan dari kode, TIDAK dapat diverifikasi dari file** (ts dibuang :92) | `INFERRED` / `PROVENANCE UNKNOWN` |
| 7 hari/minggu (crypto 24/7) | 604 baris weekend teramati di union → pasar 7 hari terkonfirmasi → kalender ekspektasi = semua hari kalender | `VERIFIED` |
| Pola weekday pada missing | tersebar merata (Sen–Min: 226–246 kejadian) → **tidak ada bias hari kerja/weekend** pada lubang | `VERIFIED` |
| Kalender exchange spesifik (libur/maintenance resmi) | tidak dapat diperiksa tanpa metadata venue | `UNKNOWN` |
| Duplikat timestamp | 0 di semua file | `VERIFIED` |

---

## 8. Global Calendar

**Kalender kanonik** (untuk audit ini) = setiap hari kalender `2020-11-09 .. 2026-09-02`
= **2.124 hari** (dibuktikan: pasar 7 hari, §7; span = min first .. max last dari
thesis-10 — `VERIFIED`).

| Aset | First | Last | Span (hari) | Observed | Interior missing | Pre-span (hari, di luar seri) | Post-span |
|---|---|---|---|---|---|---|---|
| BTC | 2020-11-09 | 2026-09-02 | 2124 | 1920 | **204** | 0 | 0 |
| ETH | 2020-11-09 | 2026-09-02 | 2124 | 1920 | **204** | 0 | 0 |
| XRP | 2020-11-09 | 2026-09-02 | 2124 | 1920 | **204** | 0 | 0 |
| LINK | 2021-04-15 | 2026-09-02 | 1967 | 1763 | **204** | 157 | 0 |
| DOGE | 2021-04-25 | 2026-09-02 | 1957 | 1753 | **204** | 167 | 0 |
| SOL | 2021-06-22 | 2026-09-02 | 1899 | 1696 | **203** | 225 | 0 |
| BNB | 2021-06-01 | 2026-09-02 | 1920 | 1717 | **203** | 204 | 0 |
| AVAX | 2021-11-18 | 2026-09-02 | 1750 | 1646 | **104** | 374 | 0 |
| ADA | 2022-03-23 | 2026-09-02 | 1625 | 1521 | **104** | 499 | 0 |
| HYPE | 2024-12-18 | 2026-09-02 | 624 | 623 | **1** | 1500 | 0 |
| **Total** | | | | | **1.635** | 3.126 | **0** |

- Interior missing = **DATA GAP** (di dalam rentang aset itu sendiri).
- Pre-span = absensi **di luar seri** aset (bukan "missing bar"); penyebabnya tidak bisa
  dipastikan (kandidat: listing venue / kedalaman historis source / jendela retry fetch —
  bukti lemah ke arah parameter fetch: start BNB `2021-06-01` **persis** sama dengan
  tanggal retry di script) → klasifikasi §9: `UNKNOWN (pre-history)`.
- Post-span = **0** → tidak ada klasifikasi `POST-LISTING` sama sekali pada thesis-10.

---

## 9. Missing-Bar Inventory & Classification

Reproduksi independen: **`MISSING_TOTAL_INTERIOR = 1.635`** — cocok eksak dengan Phase 2H
F1/§13 (`VERIFIED`; 5×204 + 2×203 + 2×104 + 1×1 = 1635).

| Gap ID | Start | End | Durasi | Aset terdampak | Klasifikasi |
|---|---|---|---|---|---|
| G01 | 2021-05-28 | 2021-09-04 | 100 hari | BTC, ETH, XRP, LINK, DOGE | **DATA GAP** |
| G02 | 2021-10-28 | 2022-02-04 | 100 hari | SOL, BNB | **DATA GAP** |
| G03 | 2022-03-24 | 2022-07-01 | 100 hari | BTC, ETH, XRP, LINK, DOGE | **DATA GAP** |
| G04 | 2022-03-28 | 2022-07-05 | 100 hari | AVAX, ADA | **DATA GAP** |
| G05 | 2022-08-24 | 2022-12-01 | 100 hari | SOL, BNB | **DATA GAP** |
| S01 | 2023-01-18 | 2023-01-18 | 1 hari | BTC, ETH, XRP, LINK, DOGE | **DATA GAP** |
| S02 | 2023-01-22 | 2023-01-22 | 1 hari | AVAX, ADA | **DATA GAP** |
| S03 | 2023-06-20 | 2023-06-20 | 1 hari | SOL, BNB | **DATA GAP** |
| S04 | 2023-11-15 | 2023-11-15 | 1 hari | BTC, ETH, XRP, LINK, DOGE | **DATA GAP** |
| S05 | 2023-11-19 | 2023-11-19 | 1 hari | AVAX, ADA | **DATA GAP** |
| S06 | 2024-04-16 | 2024-04-16 | 1 hari | SOL, BNB | **DATA GAP** |
| S07 | 2024-09-11 | 2024-09-11 | 1 hari | BTC, ETH, XRP, LINK, DOGE | **DATA GAP** |
| S08 | 2024-09-15 | 2024-09-15 | 1 hari | AVAX, ADA | **DATA GAP** |
| S09 | 2025-02-11 | 2025-02-11 | 1 hari | SOL, BNB | **DATA GAP** |
| S10 | 2025-03-29 | 2025-03-29 | 1 hari | HYPE | **DATA GAP** |
| S11 | 2025-07-09 | 2025-07-09 | 1 hari | BTC, ETH, XRP, LINK, DOGE | **DATA GAP** |
| S12 | 2025-07-13 | 2025-07-13 | 1 hari | AVAX, ADA | **DATA GAP** |
| P01 | 2020-11-09 | sebelum bar pertama (per-aset: 157–1500 hari, lihat §8) | — | LINK, DOGE, SOL, BNB, AVAX, ADA, HYPE | **`UNKNOWN (pre-history)`** — kandidat PRE-LISTING/vedor-availability/fetch-retry; listing venue tak terverifikasi (§26) |

**Hari tanpa aset apa pun (portfolio-level):** 2021-05-28, 2021-05-29, 2021-05-30,
2021-05-31 (4 hari, seluruhnya di dalam G01, saat hanya G1 yang "aktif" dan G2/G3/HYPE
belum mulai) — `VERIFIED`. Hari-hari ini **tidak muncul di equity curve** (2.124 span →
2.120 baris; dicek vs `backtest/reports/equity_curve.csv`).

Kehadiran gap sejak commit pertama tiap file (G1 di `90886b7`, G2/G3 di `4549867`,
HYPE di `84ebc5d`) + refetch 4 menit kemudian yang byte-identik → **gap bukan hasil
korupsi storage/git** (`VERIFIED`, §5.2).

---

## 10. Synchronized Gap Analysis (signature & status penyebab)

### 10.1 Struktur grup (`VERIFIED`)

Semua gap **terkunci kalender absolut per grup**, bukan per-aset (offset dari bar-pertama
aset berbeda-beda: BTC 200d, LINK 43d, DOGE 33d; SOL 128d, BNB 149d; AVAX 130d, ADA 5d).
Keanggotaan grup = **batch `since` yang sama saat fetch**:

| Grup | Aset | `since` fetch (hari-H request) | Bukti |
|---|---|---|---|
| G1 | BTC, ETH, XRP, LINK, DOGE | `2020-08-01` (start_ms, `fetch:38`) | file dibuat pada run pertama (`90886b7`) |
| G2 | SOL, BNB | `2021-01-01` (retry pertama) | `INFERRED`/`STRONGLY SUPPORTED` — angka di bawah; file dibuat setelah retry-fix (`4549867`) |
| G3 | AVAX, ADA | `2021-06-01` (retry kedua) | idem |

### 10.2 Signature aritmetika (`VERIFIED`, dihitung ulang di audit ini)

**Hole pertama tiap grup = `since + 300 hari` — persis, tiga kali:**

- `2020-08-01 + 300 = 2021-05-28` (G01) ✓
- `2021-01-01 + 300 = 2021-10-28` (G02) ✓
- `2021-06-01 + 300 = 2022-03-28` (G04) ✓

**Peristiwa berikutnya jatuh pada grid ~300/301 hari dari `since`** (offset dari base grup):

- G1: `0, 99, 300, 399, 600, 901, 1202, 1503` → delta `99, 201, 99, 201, 301, 301, 301`
- G2: `0, 99, 300, 399, 600, 901, 1202` → delta `99, 201, 99, 201, 301, 301`
- G3: `0, 99, 300, 601, 902, 1203` → delta `99, 201, 301, 301, 301`

Artinya: slot grid ke-1 dan ke-2 = **hole 100 hari** (G1/G2) atau hole + single (G3),
kemudian **single-day murni berjarak tepat 301 hari**. Single G3 selalu **+4 hari** dari
single G1 (2023-01-18→01-22, 2023-11-15→11-19, 2024-09-11→09-15, 2025-07-09→07-13) —
konsisten dengan `since` G3 yang +304 hari dari `since` G1 di grid yang sama.

### 10.3 Evaluasi kandidat penyebab

| Kandidat | Status | Alasan |
|---|---|---|
| Korupsi storage/git | **Dibuktikan salah** | Gap sudah ada sejak commit pertama tiap file; refetch 4 menit kemudian byte-identik (§5.2) |
| Venue outage / candle hilang di venue | **Ditunjukkan lemah** (`STRONGLY SUPPORTED` terhadap) | Lubang terkunci pada `since` milik kita (3×300 hari persis + grid 301 hari) — venue tidak mengetahui parameter request kita |
| Bug loop `break`/empty pada fetch | **Dibuktikan salah untuk lubang interior** | `break` (`:44-46`, `:48-71`) hanya memotong ekor; penalaran kode `VERIFIED` |
| Perilaku window API/deep-history **tanpa sanity-check `candles[0]`** (`fetch:43`) | **Kandidat tersisa** (`STRONGLY SUPPORTED` sebagai kelas) | Selaras dengan signature `since`+300/301; kode memang tidak pernah memverifikasi candle pertama = hari yang diminta |
| Filter tanggal/simbol salah | **Dibuktikan salah** | Tidak ada filter harga/return/tanggal di jalur fetch (`VERIFIED` dari kode) |

**Kesimpulan status: `CAUSE UNKNOWN`.** Kelas "jalur ekstraksi (request-window +
missing sanity-check)" didukung kuat, tetapi lapisan pasti (perilaku API vs ccxt vs
interaksi keduanya) **tidak dapat dibuktikan tanpa refetch** — dan refetch tidak bisa
dijalankan dari lingkungan audit ini (§26). Tidak ada penyebab dinyatakan tanpa bukti.

---

## 11. OHLC Integrity Checks

Pemeriksaan otomatis penuh (semua baris, semua 13 file — `VERIFIED`):

| Pemeriksaan | Hasil |
|---|---|
| NaN/inf pada open/high/low/close/volume | **0** |
| `high ≥ max(open,close)` | **0 pelanggaran** |
| `low ≤ min(open,close)` | **0 pelanggaran** |
| `high ≥ low` | **0 pelanggaran** |
| harga ≤ 0 | **0** |
| volume < 0 / NaN / == 0 | **0** |
| tanggal duplikat | **0** |
| baris duplikat | **0** |
| urutan ascending + unik | **True di semua file** |

Tidak ditemukan malformed/impossible candle; tidak ada outlier struktural yang perlu
ditindaklanjuti sebagai kerusakan data.

---

## 12. Price Jump & Outlier Audit

Metode (tanpa z-score arbitrer): return baris-ke-baris (close-to-close) + `gap_days`
(jarak ke baris teramati sebelumnya) + konsistensi invariant OHLC. Threshold hitung
dipakai hanya untuk kuantifikasi: `|ret|>10% = 625`, `>20% = 80`, `>30% = 30`,
`>50% = 10` (total 19.785 baris thesis-10).

**20 return terbesar** (wajib lihat `gap_days` — nilai setelah hole = kumulatif seluruh
periode hilang, **bukan** pergerakan sehari):

| # | Aset | Tanggal | ret | gap_days | Catatan |
|---|---|---|---|---|---|
| 1 | AVAX | 2022-07-06 | −78,70% | 100 | resume G04 (kumulatif) |
| 2 | XRP | 2023-07-13 | **+73,20%** | 0 | single-day; range 56,9% — koinsiden dengan putusan perkara SEC v. Ripple (`INFERRED`) |
| 3 | ADA | 2025-03-02 | **+72,15%** | 0 | single-day; range 44,1% — koinsiden pengumuman reserve kripto AS (`INFERRED`) |
| 4 | ETH | 2022-07-02 | −64,86% | 100 | resume G03 (kumulatif; ETH 3035 → 1066 selama hole = koreksi kripto 2022) |
| 5 | XRP | 2022-07-02 | −62,42% | 100 | resume G03 |
| 6 | SOL | 2022-12-02 | −61,50% | 100 | resume G05 |
| 7 | ADA | 2022-07-06 | −61,03% | 100 | resume G04 |
| 8 | LINK | 2022-07-02 | −60,71% | 100 | resume G03 |
| 9 | XRP | 2021-01-30 | +56,85% | 0 | single-day |
| 10 | BTC | 2022-07-02 | −55,11% | 100 | resume G03 (42889 → 19251) |
| 11 | DOGE | 2022-07-02 | −48,61% | 100 | resume G03 |
| 12 | DOGE | 2022-10-29 | +45,22% | 0 | single-day; koinsiden akuisisi Twitter (`INFERRED`) |
| 13 | ETH | 2021-09-05 | +44,13% | 100 | resume G01 |
| 14 | XRP | 2021-04-05 | +44,00% | 0 | single-day |
| 15 | XRP | 2020-12-23 | **−41,81%** | 0 | range 89,7% — koinsiden gugatan SEC (`INFERRED`) |
| 16 | XRP | 2020-11-21 | +40,28% | 0 | single-day |
| 17 | SOL | 2022-02-05 | −38,31% | 100 | resume G02 |
| 18 | LINK | 2021-05-19 | −38,20% | 0 | range 87,2% — koinsiden crash 19 Mei 2021 (`INFERRED`) |
| 19 | XRP | 2020-11-23 | +38,13% | 0 | single-day |
| 20 | XRP | 2021-04-10 | +34,68% | 0 | single-day |

Klasifikasi (bukan vonis):
- **16 baris `gap_days>0`**: return kumulatif resume setelah hole — **sengaja tidak
  dibaca sebagai volatilitas harian**; level resume-nya konsisten dengan kelanjutan
  harga (invariant OHLC lulus, tidak ada lompatan skala harga).
- **609 baris `gap_days=0`** (`609 = 625 − 16`): pergerakan single-day; semuanya lulus
  invariant OHLC; yang terbesar koinsiden dengan peristiwa pasar yang dikenal
  (`INFERRED` — pengetahuan umum, **bukan** verifikasi harga venue; verifikasi eksternal
  diblokir, §26).
- **Tidak ditemukan anomali yang mengarah ke korupsi nilai.** Max |ret| per aset:
  BTC 55,1% · ETH 64,9% · SOL 61,5% · BNB 20,1% · XRP 73,2% · AVAX 78,7% · LINK 60,7% ·
  DOGE 48,6% · ADA 72,2% · HYPE 23,4%.

---

## 13. Gap-Day Semantics

Semua 51 instance resume (17 window × aset terdampak) diukur: prev close → next open →
next close (`VERIFIED`).

- `|open_gap|`: **median 4,01%, maks 79,91%** (AVAX, hole G04).
- `|close_gap|`: **median 5,82%, maks 78,70%** (AVAX resume).
- Contoh hole 100 hari: BTC 2022-03-24..07-01 → open −55,04% / close −55,11%;
  ETH 2021-05-28..09-04 → open +41,78% / close +44,13%; SOL G02 → open −38,91%.
- `open_in_prev_range`: **False** pada hampir semua resume hole (open jatuh di luar
  rentang candle terakhir sebelum hole — secara ekspektasi untuk jeda 100 hari);
  True hanya pada sebagian single-day (contoh: BTC 2024-09-11 open −0,53% masih di
  dalam range).

**Jawaban terhadap pertanyaan "bisakah candle berikutnya merekonstruksi path di dalam
hole?": TIDAK.** Dataset hanya menyimpan level sebelum dan sesudah; path intra-hole
tidak ada di mana pun di repo. Satu-satunya rekonstruksi yang sah = refetch dari sumber
(§22 Option B/C). Selama posisi terbuka melintasi hole, engine **membekukan** evaluasi
exit/stop untuk simbol itu (§14) → perlakuan terhadap hari-gap = pilihan metodologis di
tangan owner (OD-5.3), bukan sesuatu yang bisa disimpulkan dari angka (§15).

---

## 14. Cross-Asset Alignment & Engine Mechanics

### 14.1 Sebaran kehadiran bar per hari kalender (`VERIFIED`, 2.124 hari)

| aset hadir | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| jumlah hari | 4 | 21 | 171 | 157 | 17 | 55 | 79 | 162 | 48 | 790 | 620 |

- Hari dengan **≥1 aset aktif tapi bar-nya hilang**: **416 hari** (kandidat hari MTM-
  terkecuali bila posisi simbol itu sedang held).
- Hari dengan **hanya HYPE**: **0** — HYPE tidak pernah jadi satu-satunya pasar.
- 353 hari (k≤3) = awal periode portofolio efektif hanya 1–3 pasang (konsisten temuan
  staggered D1 Phase 2G).

### 14.2 Mekanika engine terhadap bar hilang (`VERIFIED` dari kode)

- `run_backtest.py:79` — loop hari = **union** indeks semua simbol → hari tanpa aset
  (4 hari di §9) tidak punya baris sama sekali.
- `:86-87` — `if d not in df.index: continue` → **exit/stop/entry tidak dievaluasi**
  untuk simbol yang bar-nya absen hari itu; posisi held **dibekukan**.
- `:121` — `prev = df.iloc[i-1]` → **prev bar berbasis baris**, melompati hole (sinyal
  hari-resume memakai candle pra-hole).
- `:171-175` — MTM: `if d in dfs[symbol].index` → nilai posisi hanya dihitung bila bar
  simbol ada; jika tidak, hari itu equity = cash + posisi lain (nilai posisi hilang,
  **bukan** nol-atas-harga) — konsisten dengan temuan OD-3.
- Indikator (`strategy.py:37-68`: ATR Wilder, Donchian `rolling().shift(1)`) berbasis
  baris → **window melompati hole tanpa sinyal** (fakta implementasi).

### 14.3 Dampak terukur pada curve baseline (`VERIFIED`)

- Curve resmi 2.120 baris (2020-11-09..2026-09-02; `equity_curve.csv`).
- 4 hari all-absent tidak ada di curve.
- 3 pasang (date, symbol) nilai posisi terkecuali dari MTM: (2023-01-22, ADA),
  (2023-11-15, LINK), (2025-07-13, AVAX).
- Hari return equity besar yang hanya ada karena mekanika ini: **2023-01-22 −15,85%**,
  **2023-01-23 +19,62%**, **2023-11-15 −16,79%**, **2023-11-16 +20,42%**
  (posisi terbuka saat itu: 01-22/23 = ADA+BNB; 11-15/16 = LINK+SOL).
- Drawdown terburuk baseline (**−26,45%**) tepat pada **2023-01-22** — tanggal yang
  kebetulan = single-day gap S02 untuk ADA/AVAX. Ini **fakta integritas/timing data**,
  bukan penilaian strategi.

---

## 15. Data-Gap Historical Sensitivity

> **LABEL WAJIB UNTUK SEMUA ANGKA MODE B:**
> `FORENSIC SENSITIVITY — NOT CANONICAL THESIS RESULT`.
> Baseline canonical tidak diganti. Selisih angka **bukan** dasar memilih treatment —
> keputusan treatment hanya boleh berasal dari owner (OD-5.3) berdasarkan justifikasi
> metodologis, bukan karena Sharpe naik atau drawdown turun.

Konfigurasi run: engine repo **tidak dimodifikasi** (import read-only), config asli,
data asli; hanya input `dfs` yang dibangun berbeda. Semua output ditulis ke `/tmp`.
Mode A = perilaku dataset saat ini (loader engine sendiri). Mode B = **carry-forward
diagnostic**: tiap aset `reindex(daily).ffill()` **hanya di dalam rentang aset itu
sendiri** (interior hole terisi; masa pra-listing tetap absen; tanpa imputasi eksternal).

### 15.1 Metrik (`VERIFIED` Mode A; Mode B = `FORENSIC SENSITIVITY — NOT CANONICAL THESIS RESULT`)

| Metrik | Mode A — baseline (dataset saat ini) | Mode B — carry-forward (diagnostic) |
|---|---|---|
| Total return | **+152,00%** | +151,52% |
| CAGR | 17,24% | 17,20% |
| Sharpe | **0,82** | 1,10 |
| Sortino | 0,85 | 1,29 |
| Max drawdown | **−26,45%** | −18,10% |
| Tanggal trough DD | **2023-01-22** | 2023-01-07 |
| Trades | **94** | 95 |
| Win rate | 36,17% | 35,79% |
| Avg R / avg win / avg loss | 1,03 / 4,35 / −0,85 | 1,02 / 4,38 / −0,85 |
| Profit factor | 2,27 | 2,24 |
| Buy & hold | 155,03% | 155,03% |
| Final equity | 2.520,02 | 2.515,16 |
| Baris curve | 2.120 (4 hari absen) | 2.124 (tanpa hari absen) |
| Hari artefak \|r\|>10% | **4** (01-22 −15,85, 01-23 +19,62, 11-15 −16,79, 11-16 +20,42) | **0** |
| Trade terekspos bar hilang | **3/94** (ADA 2023-01-07..02-09 ✗2023-01-22; LINK 2023-09-19..2024-01-03 ✗2023-11-15; AVAX 2025-07-10..08-01 ✗2025-07-13) | 0/95 |
| MTM-excluded (date,symbol) | 3 pasang (§14.3) | 0 |
| Entry dengan prev-bar basi (jarak>1 hari) | **0/94** | 0/95 |
| Max posisi terbuka | 3 | 3 |

- Mode A **mereproduksi eksak** Snapshot B (`backtest-reference.json`: 152,0 / −26,45 /
  94 trade) dan baseline OD-4 §21 (`VERIFIED`).
- Mode B **cocok dengan angka Phase 2H §15** (−18,10 / 1,10) (`VERIFIED` terhadap
  dokument Phase 2H; prompt menyebut ~−18,08 — nilai terukur di sini **−18,10**).

### 15.2 Diff trade A↔B (`VERIFIED`)

- Common: 93 trade.
- Hanya di A: LINK 2023-07-02..2023-08-03 (donchian_exit).
- Hanya di B: SOL 2023-07-01..2023-07-24 (donchian_exit); XRP 2021-09-07..2021-09-08 (stop_loss) — masing-masing dekat boundary hole (G03/G01).

### 15.3 Status

Mode B adalah **satu dari sekian mungkin perlakuan** (alternatif lain: refetch,
eksklusi hari-gap, halt-on-gap — §22). Tidak ada yang dipilih di sini. Angka Mode B
**tidak** menggantikan baseline canonical **+152,00% / 0,82 / −26,45% / 94 / 2.520,02**.

---

## 16. Listing, Warm-Up & Strategy-Ready

Ambang kebutuhan bar (dihitung dari kode: ATR14 valid di baris ke-14; don_lo exit
(baris ke-11); don_hi entry (baris ke-21); eksekusi pertama mungkin di baris ke-22 = **22
bar minimum**) — `VERIFIED`.

| Aset | Bar pertama | ATR valid pertama | Donchian-HI valid | Sinyal entry pertama | Eksekusi pertama | Rows |
|---|---|---|---|---|---|---|
| BTC | 2020-11-09 | 2020-11-22 (row 13) | 2020-11-29 (row 20) | 2020-11-30 | **2020-12-01** | 1920 |
| ETH | 2020-11-09 | 2020-11-22 | 2020-11-29 | 2020-12-16 | 2020-12-17 | 1920 |
| XRP | 2020-11-09 | 2020-11-22 | 2020-11-29 | 2021-01-30 | 2021-01-31 | 1920 |
| LINK | 2021-04-15 | 2021-04-28 | 2021-05-05 | 2021-05-05 | 2021-05-06 | 1763 |
| DOGE | 2021-04-25 | 2021-05-08 | 2021-05-15 | 2021-10-24 | 2021-10-25 | 1753 |
| BNB | 2021-06-01 | 2021-06-14 | 2021-06-21 | 2021-08-07 | 2021-08-08 | 1717 |
| SOL | 2021-06-22 | 2021-07-05 | 2021-07-12 | 2021-07-31 | 2021-08-01 | 1696 |
| AVAX | 2021-11-18 | 2021-12-01 | 2021-12-08 | 2022-02-16 | 2022-02-17 | 1646 |
| ADA | 2022-03-23 | **2022-07-14** (row 13) | 2022-07-21 | 2022-08-13 | 2022-08-14 | 1521 |
| HYPE | 2024-12-18 | 2024-12-31 | 2025-01-07 | 2025-01-30 | 2025-01-31 | 623 |

- Eksekusi pertama portofolio = **2020-12-01** (BTC) — cocok dengan `first_entry` trade
  resmi (`trades.csv`: first 2020-12-01, last exit 2026-08-14, n=94) (`VERIFIED`).
- **Fakta penting:** ADA ATR-valid tertunda ke 2022-07-14 karena 5 bar pertamanya
  (2022-03-23..27) langsung diikuti hole 100 hari — warm-up **berbasis baris** melompati
  hole (`VERIFIED`). Ini berlaku umum: seluruh warm-up/indikator dihitung dalam satuan
  bar, bukan hari kalender.
- Classifikasi "pre-listing vs data gap" untuk absensi sebelum bar pertama tetap
  `UNKNOWN` (§9 P01) — tanggal listing tidak terverifikasi (§26).

---

## 17. Lookback Sufficiency

- Minimum teoritis untuk sinyal pertama yang sah: **22 bar** per aset (§16).
- Aset terkecil = HYPE **623 bar** → **semua aset punya lookback cukup** (`VERIFIED`).
- Catatan fakta (bukan vonis): kelengkapan ini dihitung dalam bar; karena bar melompati
  hole (§16), "warm-up 22 bar" pada aset ber-hole bisa menjangkau rentang kalender jauh
  lebih panjang (kasus ADA: 14 bar pertama = 113 hari kalender).
- `lookback_years: 6` (`config.yaml:37`) adalah label periode, bukan jumlah bar — lihat §18.

---

## 18. Study Period Audit

| Aspek | Nilai | Sumber / label |
|---|---|---|
| Periode **didasarkan** (label) | `2020-08 .. 2026-08` | `config.yaml:37`, `backtest/DESIGN.md:209`, `backtest-reference.json` ("period"), PPT:89 ("2020–2026") — `VERIFIED` |
| Titik mulai fetch (niat) | 2020-08-01 UTC | `fetch:38` — `VERIFIED` |
| Data **tersedia** (mulai) | **2020-11-09** (BTC/ETH/XRP) | §8 — `VERIFIED`; **selisih 100 hari** vs label |
| Data tersedia (per-aset) | 2020-11-09 .. 2024-12-18 (baris pertama; lihat §8) | `VERIFIED` |
| **Backtest aktual** | **2020-11-09 .. 2026-09-02**, union 2.120 hari, span 2.124 hari (≈5,81 tahun), `period_days` metrik 2.123 | `equity_curve.csv` + Mode A — `VERIFIED` |
| Akhir data vs label | data berakhir **2026-09-02**, label berhenti `2026-08` → data melampaui label ~1 bulan | `VERIFIED` |

**Ketidaksesuaian label vs aktual = `VERIFIED`.** Apakah label yang dikoreksi, fetch yang
diperluas, atau periode studi yang dipotong ke window berbeda = keputusan owner
(**OD-5.5**, `NOT SPECIFIED IN APPROVED PPT` — PPT hanya menyebut "2020–2026" umum).
Phase 2G D1 juga mencatat konsekuensi: tahun-tahun awal efektif portofolio 3–6 pasang.

---

## 19. HYPE Special Case

| Fakta | Nilai | Label |
|---|---|---|
| Baris / rentang | 623 bar, 2024-12-18 .. 2026-09-02 | `VERIFIED` |
| Absensi sebelum listing (di luar seri) | 1.500 hari **absen, bukan nol** — engine tidak pernah mengisi harga 0 (jalur `:86-87` skip; tidak ada zero-fill di kode) | `VERIFIED` |
| Interior missing | 1 hari (2025-03-29, S10) | `VERIFIED` |
| Hari curve tertutup HYPE | 623; hari "hanya HYPE" = 0 | `VERIFIED` |
| Klaster | Cluster B sendiri, maks 2 posisi/klaster (`config.yaml:22`; `strategy.py:14`) | `VERIFIED` |
| Korelasi ~0,52 (argumen diversifikasi) | klaim repo dari riset korelasi — **bukan** dihitung ulang di OD-5 | `INFERRED` (klaim pihak ketiga di repo) |
| Benchmark B&H | `run_backtest.py:206-211`: kontribusi = `(init/10) × (close_last/close_first)` — jadi slice HYPE hanya "berjalan" di atas window-nya sendiri (sebelum listing = setara tunai diam, formula-level) | `VERIFIED` (formula) |
| PPT tentang B&H untuk aset staggered | tidak ada | `NOT SPECIFIED IN APPROVED PPT` |

- Absensi pra-listing **sudah ditangani benar secara struktural** (absen ≠ nol) — `VERIFIED`.
- Apakah 1.500 hari absensi HYPE (vs aset lain 0–499 hari) memerlukan perlakuan portofolio
  khusus (shared calendar, exclusion window, dsb.) = keputusan owner (**OD-5.7**), terkait
  juga dengan pertanyaan definisi benchmark yang sudah masuk temuan Phase 2H F2 (tidak
  diduplikasi keputusannya di sini).

---

## 20. Survivorship & Universe Construction

Bukti (`VERIFIED`):

- PPT:181 sudah **menamai** 10 aset (ex-ante di dokumen persetujuan).
- PPT:294 justru **meminta** mentor: "Mohon saran batasan jumlah/kriteria pemilihan
  cryptocurrency untuk meminimalkan potensi survivorship bias" → **kriteria seleksi tidak
  pernah ditetapkan di PPT** → `NOT SPECIFIED IN APPROVED PPT`.
- Repo mengakui pemilihannya post-hoc: `PLAN.md:42` (pair dipilih "sebagai survivor hari
  ini"), `TASKS.md:33`, `decision_log.md:24`, Phase 2H §20 — tidak ada aturan seleksi
  ex-ante yang terdokumentasi.
- Timeline: daftar pair config diselesaikan **2026-09-02** (`6ff3c1d`, `730ee09`) —
  setelah seluruh histori 2020–2026 tersedia.

Status: **aturan kontrol survivorship = `UNKNOWN` / `OWNER DECISION REQUIRED`
(OD-5.6)**. Fakta ini dicatat apa adanya; tidak ada vonis terhadap hasil mana pun.

---

## 21. Data Availability Look-Ahead (bukti saja)

- Universe dipilih 2026 dengan akses penuh ke histori 2020–2026 (§20) — `VERIFIED`.
- Dataset diambil dari API **saat ini** (2026-09-02): candle historis venue boleh jadi
  pernah di-revisi/backfill oleh source sejak periode keputusan; **tanpa arsip copy
  lama, hal ini tidak terdeteksi** → `PROVENANCE UNKNOWN` (tidak bisa dipastikan ada/tidak
  ada revisi).
- Pembersihan yang dilakukan kode **hanya** dedupe keep-first + sort (`fetch:112`);
  tidak ada filter harga/return/outcome di jalur fetch (`VERIFIED`) → tidak ada bukti
  seleksi baris berbasis outcome di sisi data.
- Bar terakhir (2026-09-02) diambil **saat hari masih berjalan** (perubahan close antar
  commit 10:57→12:09 UTC: 76575 → 76638 → 76790) → **candle final in-progress**
  (`VERIFIED` dari diff antar-commit). Dampak: nilai indikator hari terakhir pakai
  sebagian hari; tidak ada trade dieksekusi pada 2026-09-02 (exit terakhir 2026-08-14) →
  dampaknya terbatas pada baris terakhir curve/indikator (`VERIFIED`).

---

## 22. Rebuild Options (A–D) — dievaluasi, **tidak dipilih**

> Status semua opsi: `OWNER DECISION REQUIRED` via **OD-5.2**. Audit ini tidak memilih.

| Dimensi | **Option A** — perbaiki/treat dataset saat ini | **Option B** — re-download sumber yang sama (Bitget) | **Option C** — downloader reproduktif baru (spesifikasi §23) | **Option D** — sumber alternatif (venue/agregator lain) |
|---|---|---|---|---|
| Integritas data | Menyelesaikan klasifikasi; **tidak** menambah bar riil (imputasi = membuat harga) | Bisa mengisi hole bila source punya candle-nya | Sama seperti B, plus jaminan kelengkapan teruji | Bisa jadi lebih lengkap / bisa beda harga |
| Provenance | Tetap `PROVENANCE UNKNOWN` untuk metadata lama | +1 sumber, tapi log & metadata harus disimpan kali ini | **Menyelesaikan** metadata/checksum/log (§25, T10–T12) | Sumber baru = provenance baru; perlu justifikasi |
| Reproduktif | Tidak memperbaiki `NOT FULLY REPRODUCIBLE` | Bergantung API publik yang berubah | **Tujuan utamanya**: env pinned, byte-reproducible | Tergantung stabilitas sumber alternatif |
| Dampak metodologis | Perlakuan gap = pilihan metodologis murni (OD-5.3) | Bar riil → sensitivity jadi "data benar vs data rusak" | idem B | **Mengubah instrument definition** (PPT:181 menyebut Bitget) → bentrok dengan PPT kecuali owner mengubah PPT |
| Upaya implementasi | Terendah (klasifikasi + keputusan) | Sedang (perlu jaringan tak terfilter + pin env) | Tertinggi | Tertinggi + riset sumber |
| Kepatuhan PPT | Netral | **Sesuai** (PPT:181 Bitget) | **Sesuai** | Perlu amandemen PPT |
| Komparabilitas historis | Sepenuhnya mempertahankan snapshot lama | Bar baru bisa beda dari snapshot (perubahan perlu didokumentasikan) | idem B + manifest perubahan | Harga lintas-venue beda; perbandingan historis jadi tidak apples-to-apples |
| Catatan kritis | Tidak membuktikan kelengkapan source | **Ini juga discriminating test untuk `CAUSE UNKNOWN` §10** | Butuh keputusan periode (OD-5.5) & acceptance (OD-5.8) lebih dulu | Hanya sah bila ada justifikasi sumber (mis. cross-check), bukan drop-in |

**Tidak ada opsi yang dipilih.** Bila owner memilih jalur rebuild, spesifikasi draft §23
dan acceptance §24 menjadi input eksekusinya.

---

## 23. Draft Rebuild Specification (disusun, **tidak diimplementasikan**)

Untuk Option B/C (Option D butuh spesifikasi sumber baru):

1. **Sumber & instrumen**: Bitget spot, pasangan `{SYM}/USDT` persis 10 pair config;
   timeframe `1d`; API versi dicatat (endpoint + ccxt version **dipin** di requirements
   workflow).
2. **Periode**: mengikuti keputusan **OD-5.5** (mulai–akhir final); default teknis =
   `start = keputusan owner` sampai tanggal fetch; setiap aset dicatat `source_first_date`.
3. **Timezone & boundary**: candle timestamp mentah **disimpan** (ms + ISO UTC); tanggal
   turunan = UTC calendar date; boundary didokumentasikan eksplisit (00:00 UTC).
4. **Pagination**: request window eksplisit `since`+`endTime`; **assert
   `candles[0]` ≥ since dan `candles[-1]` ≤ endTime**; gap antar-page = error, bukan
   diam-diam dilewati; retry terbatas + backoff, gagal = **berhenti dan laporkan** (jangan
   `break` senyap); audit ini mencatat signature `since+300` sebagai regresi yang harus
   dicegah (§10).
5. **Validasi per bar**: invariant §11; NaN/inf; volume ≥ 0; tanggal duplikat → error;
   tanggal tak-berurutan → error.
6. **Klasifikasi absensi**: setiap hari dalam rentang total harus berstatus
   `PRESENT` / `DATA GAP (diklasifikasi)` / `PRE-LISTING (dengan tanggal listing
   tercatat)`; hari tak terklasifikasi = **gagal** (T04/T06).
7. **Output schema**: kolom `open,high,low,close,volume,date` + sidecar metadata per file:
   venue, symbol, timeframe, timezone, period, fetch timestamp, tool+version, source
   endpoint, listing-date source.
8. **Manifest**: sha256 per file ditulis saat **generasi** (bukan saat audit) + jumlah bar
   per file + total missing bar = 0 atau terdaftar dengan approval.
9. **Determinisme**: urut ascending, unik, stable sorting; run kedua pada env sama =
   byte-identical (T10).
10. **Logging**: simpan stdout fetch (atau structured log) sebagai artefak repo/CI.
11. **Tidak ada perlakuan implisit**: tanpa ffill/interpolasi kecuali keputusan owner
    OD-5.3 yang tercatat.

---

## 24. Dataset Acceptance Tests (T01–T12)

Status saat ini diacu ke bukti audit ini. Semua test = kandidat penerimaan resmi via
**OD-5.8**.

| ID | Test | Kriteria lulus | Status dataset saat ini |
|---|---|---|---|
| T01 | Format & skema konsisten per kelas file | header persis seperti yang dikunci (thesis vs riset, §4.3) | **PASS** (dua skema terdefinisi & stabil) |
| T02 | Tanpa null/NaN/inf pada OHLCV | count = 0 | **PASS** (§11) |
| T03 | Invariant OHLC valid | high≥max(o,c), low≤min(o,c), high≥low, harga>0, volume≥0 → 0 pelanggaran | **PASS** (§11) |
| T04 | Kontinuitas timestamp | setiap hari kalender dalam rentang total punya bar **atau** terklasifikasi & di-approve | **FAIL** — 1.635 bar tak tertangani (§9), 4 hari all-absent |
| T05 | Tanpa tanggal duplikat | count = 0 | **PASS** (§11) |
| T06 | Missing bar terklasifikasi | semua absensi punya status PRE-LISTING/POST-LISTING/DATA GAP/UNKNOWN + total tercatat | **PARTIAL** — terklasifikasi di §9; treatment & pre-history masih `UNKNOWN`/pending OD-5.3 |
| T07 | Batas kalender UTC valid & terdokumentasi | tanggal = UTC date candle; boundary didokumentasikan di metadata | **FAIL** — ts dibuang (`fetch:92`), boundary hanya `INFERRED` (§7) |
| T08 | Warm-up cukup untuk tiap aset | ≥22 bar valid sebelum sinyal eksekusi pertama | **PASS** (§16/§17; catatan bar melompati hole) |
| T09 | Tidak ada look-ahead availability | setiap bar tersedia pada tanggal keputusan pemakaian; tanpa baris masa depan | **PASS untuk baris** (data ≤ tanggal fetch); bagian universe-selection masuk OD-5.6 (§20–21) |
| T10 | Generasi dapat direproduksi | rerun di env pinned → byte-identical | **FAIL** — `NOT FULLY REPRODUCIBLE` (§25) |
| T11 | Source metadata terdokumentasi | venue, symbol, timeframe, tz, periode, fetch date, versi tool ada di artefak | **FAIL** — `PROVENANCE UNKNOWN` (§4/§5) |
| T12 | Checksum tercatat & cocok | sha256 ditulis saat generasi dan diverifikasi saat commit/load | **FAIL untuk generasi** (checksum baru dihitung di audit §4.4) |

**Dua kandidat test tambahan** yang lahir dari bukti audit ini (dicatat di sini, penomoran
T13/T14 menunggu keputusan acceptance OD-5.8): (a) bar terakhir bukan candle
in-progress saat di-freeze (bukti §21); (b) tidak ada hari all-absent di level portofolio
(bukti §9/§14).

---

## 25. Reproducibility

**Status: `NOT FULLY REPRODUCIBLE`.**

| Dimen | Status | Bukti |
|---|---|---|
| Byte file saat ini | **TERKUNCI** — semua 15 file git-tracked, frozen (config-pair sejak 2026-09-02 `3e5caae`; riset sejak `c42a478`) | `VERIFIED` §4/§5.2 |
| Generator + parameter | **TERDOKUMENTASI sebagian** (start 2020-08-01, retry dates, limit, tz, dedupe) tapi jalur retry yang dipakai per pair hanya bisa diimputasi dari signature (§10) | `VERIFIED`/`INFERRED` |
| Checksum saat generasi | **TIDAK ADA** (baru dihitung audit ini) | §4.4 |
| Metadata sumber in-file | **TIDAK ADA** → `PROVENANCE UNKNOWN` | §4.1 |
| Log fetch | **TIDAK DISIMPAN** (stdout CI tidak di-commit; `PROVENANCE UNKNOWN`) | §5.1 |
| Environment generasi | **TIDAK DIPIN** — `pip install ccxt pandas pyyaml` di workflow; versi ccxt saat fetch `UNKNOWN` (lokal saat audit: ccxt 4.5.73, tidak tentu sama) | `VERIFIED` |
| Refetch byte-identity | **TIDAK DIUJI** — butuh jaringan tak terfilter + API history yang bisa berubah | §26 |
| Angka baseline dari HEAD | **REPRODUCIBLE** — run Mode A menghasilkan eksak Snapshot B (152,00/0,82/−26,45/94/2.520,02) | `VERIFIED` §15 |
| Dua snapshot metrik (A/B) | Keputusan canonical **sudah terdaftar pending** di `ARCHITECTURE.md` §16 (A = `metrics.md` +149,59%/−26,19% dari era `e6188de`; B = `backtest-reference.json` +152,0%/−26,45% pasca-fix Wilder seed) — **tidak diduplikasi** sebagai OD-5.x; data kedua snapshot identik (Phase 2G D4) → selisih = engine version, bukan data version | `VERIFIED` (rujuk) |
| Laporan curve/trades | `backtest/reports/*.csv` **gitignored** (`.gitignore:15`) — curve Snapshot A hanya on-disk (mtime 2026-09-06) | `VERIFIED` |

---

## 26. External Source Verification (dilakukan, **diblokir lingkungan**)

| Percobaan | Hasil | Interpretasi |
|---|---|---|
| `GET https://api.bitget.com/api/v2/time` | HTTP `000` (0,055s) | gagal konek |
| `GET https://api.binance.com/api/v3/klines?...` (jendela hole) | kosong | gagal |
| DNS `api.bitget.com`, `api.binance.com` | `202.3.218.139 internetbaik.telkomsel.com` | **di-redirect ke halaman filter ISP** (kedua domain exchange) |
| `https://www.google.com` | 200 | jaringan umum hidup → masalahnya khusus domain exchange |
| `https://api.coingecko.com`, `min-api.cryptocompare.com`, `data-api.binance.vision`, `https://data.binance.vision/...` | 404 root / 401 / 404 / **200** | sebagian host terjangkau; halaman root bukan verifikasi data |

**Kesimpulan verifikasi eksternal: TIDAK BERHASIL dijalankan** — tidak ada harga/ikon
instrument/listing-date/source-availability yang dikonfirmasi dari luar dalam sesi ini.
Konsekuensi: (a) penyebab gap tidak bisa dicek langsung ke venue (memperkuat status
`CAUSE UNKNOWN`, §10); (b) identitas spot & tanggal listing tetap `UNKNOWN` (§6/§9);
(c) **Option B/C harus dijalankan dari jaringan tanpa filter** — tercatat sebagai
prasyarat eksekusi, bukan keputusan. **Tidak ada data eksternal yang disubstitusikan ke
repo.** Upaya tidak dilanjutkan dengan cara menyiasati filter jaringan (di luar batas
audit ini).

---

## 27. Owner Decision Register — OD-5.1 … OD-5.10

| ID | Keputusan yang dibutuhkan | Evidence utama | Status |
|---|---|---|---|
| **OD-5.1** | Sumber data primer thesis: tetap Bitget spot (PPT:181) atau sumber lain; jika tetap, endpoint+versi+retensi log apa yang diwajibkan | §4–§6, §25, PPT:181 | `OWNER DECISION REQUIRED` |
| **OD-5.2** | Kebijakan rebuild dataset: pilih **Option A/B/C/D** (§22) beserta prasyarat jaringan/env pinned | §10 (`CAUSE UNKNOWN`), §22, §25, §26 | `OWNER DECISION REQUIRED` |
| **OD-5.3** | Kebijakan treatment 1.635 missing bar + 4 hari all-absent (refetch vs eksklusi vs halt vs treatment lain; **dilarang memilih berdasarkan angka Sharpe/DD**) | §9, §13, §14, §15 | `OWNER DECISION REQUIRED` |
| **OD-5.4** | Definisi kalender & timestamp: boundary UTC, aturan hari 7-minggu, status hari tanpa bar di level portofolio | §7, §8, §14 | `OWNER DECISION REQUIRED` |
| **OD-5.5** | Periode studi final: koreksi label `2020-08..2026-08` vs data aktual `2020-11-09..2026-09-02` (atau kebalikannya via re-fetch/periode berbeda) | §18, PPT:89, `config.yaml:37` | `OWNER DECISION REQUIRED` |
| **OD-5.6** | Seleksi universe & kontrol survivorship (kriteria yang diminta PPT:294 tak pernah ada) | §20, PPT:181/:294, `PLAN.md:42` | `OWNER DECISION REQUIRED` |
| **OD-5.7** | Penanganan HYPE/aset staggered: absensi 1.500 hari, shared calendar vs window, konsekuensi benchmark | §16, §19, Phase 2H F2 (rujuk, tidak diduplikasi) | `OWNER DECISION REQUIRED` |
| **OD-5.8** | Kriteria acceptance dataset: sahkan T01–T12 (+ kandidat T13/T14) sebagai gate freeze | §24 | `OWNER DECISION REQUIRED` |
| **OD-5.9** | Kebijakan provenance & checksum: metadata sidecar + manifest checksum saat generasi + retensi log fetch | §4.4, §5, §25 (T10–T12) | `OWNER DECISION REQUIRED` |
| **OD-5.10** | Status freeze baseline: apakah Snapshot B (152,00%/0,82/−26,45%/94) boleh difreeze **sebelum** OD-5.1–5.9 selesai, atau menunggu seluruh sequence §29 (termasuk proses canonical-metric yang sudah ada di `ARCHITECTURE.md` §16) | §15, §24, §25, §29 | `OWNER DECISION REQUIRED` |

Catatan register: **tidak ada OD-5.11+ yang ditambahkan** — keputusan canonical-metric
A/B sudah terdaftar pending di `ARCHITECTURE.md` §16 (dikutip di §25, tidak diduplikasi);
audit ini tidak menemukan keputusan baru di luar 10 butir di atas.

---

## 28. Findings by Evidence Strength

**`VERIFIED`** (dibuktikan langsung di audit ini):
1.635 missing bar interior + rincian 17 window (§9) · 4 hari all-absent (2021-05-28..31) ·
hole pertama tiap grup = `since + 300 hari` persis (3×) dan grid single 301 hari (§10) ·
break pada fetch hanya memotong ekor (§10.3) · refetch jam yang sama byte-identik, kecuali
candle in-progress (§5.2) · semua pemeriksaan OHLC/duplikat/urutan lulus (§11) · sebaran
kehadiran aset & 416 hari partial (§14.1) · mekanika skip/MTM/prev-baris (§14.2) ·
artefak 4 hari return ±16–20% dan DD trough 2023-01-22 (§14.3, §15) · 3/94 trade
terekspos, 0/94 prev-bar basi (§15) · Mode B = −18,10%/1,10 (§15) · Mode A = Snapshot B
eksak (§15) · label periode tak cocok (§18) · warm-up per aset + kasus ADA (§16) ·
HYPE absen-bukan-nol (§19) · semua file tracked + checksum (§4) · verifikasi eksternal
gagal karena filter ISP (§26) · `NOT FULLY REPRODUCIBLE` (§25).

**`STRONGLY SUPPORTED`**: gap berasal dari jalur ekstraksi (request-window + absennya
sanity-check `candles[0]`), bukan venue/storage (§10.3) · instrument = spot (§6).

**`INFERRED`**: `since` grup G2/G3 = tanggal retry 2021-01-01/2021-06-01 · boundary
00:00 UTC · pipeline yfinance untuk BCH/LTC · koinsiden outlier dengan peristiwa pasar
dikenal · G1 "first data = start+100" bisa venue-depth atau skip fetch.

**`UNKNOWN` / `PROVENANCE UNKNOWN` / `CAUSE UNKNOWN`**: penyebab pasti lubang (§10) ·
tanggal listing tiap aset (§6/§9-P01) · versi ccxt & log fetch saat generasi (§5) ·
apakah source pernah merevisi candle historis (§21) · apakah funding punya baris padded
(§4.2) · perilaku API pada window deep-history.

**`OWNER DECISION REQUIRED`**: seluruh OD-5.1–OD-5.10 (§27).

---

## 29. Recommended Freeze Sequence

Urutan yang disarankan (dependensi; menghormati decision gate & keputusan OD-2/OD-3/OD-4
yang masih pending — tidak ada lompatan fase):

1. **OD-2 → OD-3 → OD-4** diselesaikan lebih dulu (keputusan risk/exit/sizing sudah
   terdaftar pending; data decision tidak boleh dipakai menyelak urutan itu).
2. **OD-5.1** (sumber) → **OD-5.2** (rebuild A–D; prasyarat: jaringan tan filter §26).
3. Bila rebuild: eksekusi **spesifikasi §23** dari lingkungan bersih → jalankan
   **T01–T12** (setelah **OD-5.8** mengesahkannya) → bila lulus, dataset baru = kandidat
   freeze (manifest §23 poin 8).
4. **OD-5.5** (periode final) — menentukan jendela run kanonik.
5. **OD-5.3** (treatment gap) + **OD-5.4** (kalender) — harus selesai sebelum run
   kanonik; keputusan wajib berbasis justifikasi metodologis, **bukan** angka §15.
6. **OD-5.6 + OD-5.7** (universe & HYPE).
7. **OD-5.9** (provenance/checksum policy) → pasang T10–T12 sebagai gate berkelanjutan.
8. **Full re-run** kanonik sekali (tanpa interupsi), lalu selesaikan proses
   canonical-metric yang sudah ada (`ARCHITECTURE.md` §16) berdasarkan run itu.
9. **OD-5.10** (status freeze resmi) → selaraskan dokumen (config label, DESIGN,
   backtest-reference, laporan) ke snapshot tunggal → setelah itu OD-6 layak dibuka.

---

## 30. Limitations

1. **Verifikasi sumber eksternal gagal** (filter ISP, §26) → tidak ada konfirmasi harga/
   listing/availability dari venue; beberapa `UNKNOWN` tidak bisa diselesaikan di sesi ini.
2. **Refetch tidak dijalankan** → penyebab gap tetap `CAUSE UNKNOWN` (§10); diskriminating
   test hanya tersedia lewat Option B/C.
3. **Log fetch & versi env generasi tidak ada** → rekonstruksi perilaku API saat 2026-09-02
   parsial.
4. **Arsip snapshot lama tidak ada** → deteksi revisi historis oleh source mustahil (§21).
5. **Sensitivity dibatasi satu metode diagnostic** (carry-forward); metode lain (eksklusi
   hari-gap, halt) tidak dijalankan — bukan karena tidak relevan, tapi mandate membatasi
   ke minimal dua run; itu juga sebabnya angka §15 tidak boleh dipakai memilih treatment.
6. **Koinsiden peristiwa pasar pada outlier bersifat `INFERRED`** (pengetahuan umum),
   bukan verifikasi harga lintas venue.
7. **Snapshot A tidak dijalankan ulang** di audit ini (atribusinya mengikuti Phase 2H §23 /
   `ARCHITECTURE.md` §16); OD-5 hanya memastikan Mode A = Snapshot B.
8. **Funding CSV** hanya diinventarisasi; kemungkinan baris padded tidak ditelusuri (di
   luar inti thesis).
9. Audit ini **tidak mengubah apa pun** selain satu file dokumen ini; semua script
   diagnostic berada di `/tmp`; tidak ada commit/push; OD-6 tidak disentuh.

---

### Final Answers

**Q1 — Apakah dataset 10 pair thesis sahih menjadi basis angka backtest?**
**Belum.** Secara **integritas nilai** bersih (§11: 0 NaN/inv/dup), tetapi secara
**kelengkapan kalender** memiliki **1.635 bar interior hilang + 4 hari tanpa aset apa
pun** (§9) yang belum ditangani kebijakan apa pun. Selama `CAUSE UNKNOWN` (§10) dan
OD-5.1–5.5 belum diputuskan, dataset **layak dipakai untuk audit, belum layak difreeze**
sebagai basis final. *(Status data, bukan vonis strategi.)*

**Q2 — Dari mana dataset ini dan seberapa lengkap provenansinya?**
Bitget spot 1d via `scripts/fetch_bitget_data.py` (ccxt) + workflow CI, frozen di
`3e5caae` (2026-09-02) — generator, parameter, dan commit **terverifikasi** (§5). Lengkap?
**Tidak**: tanpa metadata in-file, tanpa log fetch, tanpa versi env, tanpa checksum
generasi, ts mentah dibuang → sebagian `PROVENANCE UNKNOWN` (§4/§5/§25).

**Q3 — Berapa missing bar dan bagaimana distribusinya?**
**1.635 bar interior** (reproduksi eksak Phase 2H): 5 hole 100-hari (G01–G05) + 12
single-day (S01–S12) pada 4 grup (G1 5 aset ×204, G2 2 aset ×203, G3 2 aset ×104,
HYPE ×1) + 3.126 hari pre-history di luar seri 7 aset + **0 post-listing** (§8/§9).

**Q4 — Apakah gap tersinkronisasi dan apa penyebabnya?**
Ya, tersinkronisasi dalam grup yang **kunci pada parameter fetch kita**: hole pertama
tiap grup = `since + 300 hari` persis, lanjutan pada grid ~301 hari (§10.2) → sangat
mendukung asal-usul **jalur ekstraksi**, dan melemahkan hipotesis venue outage. Lapisan
pasti pemicunya tidak terbukti → **`CAUSE UNKNOWN`** (kandidat tersisa: window API tanpa
sanity-check `candles[0]`); discriminating test = refetch (Option B/C).

**Q5 — Ada kerusakan OHLC/timestamp/struktur?**
**Tidak.** 13 file: 0 NaN/inf, 0 pelanggaran invariant, 0 duplikat, urutan naik unik,
format tanggal valid, weekend ada, missing merata antar weekday (§7/§11).

**Q6 — Ada harga outlier mencurigakan?**
625 return |ret|>10%: **16 di antaranya resume hole** (kumulatif 100 hari — wajib tidak
dibaca sebagai harian), **609 single-day** yang semuanya lulus invariant OHLC dan
koinsiden peristiwa pasar yang dikenal (`INFERRED`). **Tidak ada indikasi korupsi nilai**
(§12); verifikasi harga eksternal tidak bisa dijalankan (§26).

**Q7 — Bagaimana gap memengaruhi backtest secara mekanis?**
Hari gap: exit/stop simbol tidak dievaluasi (posisi dibekukan), prev-bar lompati hole,
dan **nilai posisi held dikecualikan dari MTM** (§14.2) → muncul 4 hari artefak return
±16–20% dan drawdown terburuk jatuh tepat di hari gap 2023-01-22 (§14.3); 3/94 trade
terekspos; 0 entry dengan prev-bar basi (§15).

**Q8 — Apa hasil sensitivity carry-forward dan statusnya?**
Mode B: **−18,10% DD, Sharpe 1,10, 95 trade, tanpa artefak** (Mode A: −26,45%/0,82/94)
— konsisten dengan Phase 2H (−18,10/1,10). Status: **`FORENSIC SENSITIVITY — NOT
CANONICAL THESIS RESULT`**; **bukan** dasar memilih treatment (OD-5.3); baseline
canonical tidak berubah (§15).

**Q9 — Apakah label periode `2020-08..2026-08` akurat?**
**Tidak.** Data aktual `2020-11-09..2026-09-02` (start +100 hari dari label; akhir
melampaui label ~1 bulan); backtest berjalan 2.120 bar union hari (§18). Koreksi label =
OD-5.5.

**Q10 — Apakah HYPE/staggered listing tertangani benar dan warm-up cukup?**
Absensi pra-listing HYPE **absen, bukan nol** — perlakuan strukturalnya benar (`VERIFIED`,
§19); 1 bar hilang (2025-03-29). Warm-up **cukup untuk semua aset** (min. 22 bar; HYPE
623) dengan catatan warm-up berbasis baris melompati hole (kasus ADA, §16). Perlakuan
portofolio/benchmark untuk staggered = OD-5.7.

**Q11 — Ada look-ahead availability dari sisi data?**
Baris: tidak (semua data ≤ tanggal fetch; tanpa filter outcome, §21). Namun **universe
dipilih 2026 dengan hindsight penuh** dan data diambil dari API saat ini tanpa arsip
banding → bagian pemilihan = `UNKNOWN`/OD-5.6, bagian revisi source = `PROVENANCE
UNKNOWN` (§20–21).

**Q12 — Bisakah dataset direproduksi/direbuild ulang saat ini?**
**Tidak penuh — `NOT FULLY REPRODUCIBLE`** (env tak dipin, tanpa checksum/log/metadata
generasi, refetch tak teruji); namun **angka baseline dari HEAD reproducible eksak**
(Mode A = Snapshot B, §25). Rebuild teknis mungkin via Option B/C dengan spesifikasi §23
(OD-5.2).

**Q13 — Berhasilkah verifikasi sumber eksternal?**
**Tidak.** Semua domain exchange di-hijack filter ISP (`internetbaik.telkomsel.com`,
HTTP 000) → tidak ada verifikasi venue/listing/harga yang bisa diklaim; upaya dicatat
apa adanya dan tidak disiasati (§26). Prasyarat Option B/C: jaringan tanpa filter.

**Q14 — Keputusan apa yang dibutuhkan owner sebelum freeze baseline?**
Sepuluh: **OD-5.1** sumber · **OD-5.2** rebuild A–D · **OD-5.3** treatment gap ·
**OD-5.4** kalender/timestamp · **OD-5.5** periode studi · **OD-5.6** universe/
survivorship · **OD-5.7** HYPE/staggered · **OD-5.8** acceptance T01–T12 ·
**OD-5.9** provenance/checksum · **OD-5.10** status freeze — semuanya
`OWNER DECISION REQUIRED` (§27), dieksekusi berurutan sesuai §29, bersama proses
canonical-metric yang sudah ada di `ARCHITECTURE.md` §16. Audit ini **tidak memilih
apapun** dan **tidak mengubah apapun** di luar dokumen ini.
