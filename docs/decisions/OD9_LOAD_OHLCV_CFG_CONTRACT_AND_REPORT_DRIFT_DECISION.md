# OD-9 — `load_ohlcv` Kontrak Wajib `cfg` & Rekonsiliasi Drift Angka Laporan Riset

> **Repo:** `Nomssky/TrendSentry` · **HEAD saat audit:** `03f9575`
> **Status:** `CLOSED` — cacat `KeyError 'donchian_entry_period'` sudah diperbaiki
> **Menutup:** OD-6 §29/§469/§41, OD-7 audit D9, OD-7 reproducibility §424 (ketiganya
> mendaftarkan crash ini sebagai reproducibility defect **terbuka**)
> **Upgrade bukti:** OD-6 §41 downgrade "divergensi −58.49 → −58.64" dari `INFERRED`
> (tanpa bisect) menjadi `VERIFIED` — lihat §4 di bawah
> **Bukan keputusan strategi.** Tidak ada parameter strategi yang diubah
> (Hard Rule #1 tidak tersentuh) dan tidak ada hasil backtest yang disetujui/ditolak.

---

## 1. Executive Summary

1. **Cacat (VERIFIED, direproduksi):** commit `0ad6cc6` (2026-09-12) mengganti indikator
   hardcode (`donchian_high(df, 20)`) dengan pembacaan dari cfg, **tanpa menghapus default
   `cfg: dict | None = None`**. Akibatnya `cfg=None` → `strat = {}` → `strat["donchian_entry_period"]`
   meledak. Laporan sebelumnya menyebut "3 skrip / 8 call site".
2. **Blast radius sebenarnya lebih luas (VERIFIED): 10 call site di 5 skrip.** Dua skrip
   tambahan — `run_capital_efficiency.py:68,77` dan `run_longshort_backtest.py:175` — tidak
   terdeteksi audit sebelumnya karena crash-nya **latent**: default `config.yaml` (Donchian
   20/10, ATR 14) kebetulan cocok dengan param hardcode, jadi hanya crash begitu
   `PRESET=` aktif. Lihat §3.
3. **Perbaikan: `cfg` jadi parameter positional wajib.** Default `None` dihapus, sehingga
   pemanggil yang lupa cfg gagal `TypeError` **di titik pemanggilan**, bukan `KeyError`
   3 baris di dalam fungsi dengan pesan yang menyesatkan. 10 pemanggil diperbarui
   (masing-masing mengoper `cfg` yang **sudah ada** di scope — tidak ada plumbing baru).
4. **Angka drift sudah dibisect per-commit (VERIFIED):** `029a311` ("Wilder seed") adalah
   **penyebab tunggal**; `c22ad1c` dan `0ad6cc6` menghasilkan **nol** perubahan metrik untuk
   config yang diuji. Lihat §4.
5. **Laporan `.md` sengaja TIDAK diregenerasi.** Regenerasi terbukti **merusak**: ketiga
   laporan membawa post-processing manual yang tidak dapat direproduksi skrip, dan
   regenerasi menghapusnya. Angka drift instead dicatat di sini. Lihat §5.
6. **Engine utama tidak terpengaruh (VERIFIED):** `backtest/reports/metrics.md`,
   `trades.csv`, `equity_curve.csv` **tidak berubah satu byte** setelah perbaikan
   (`git status` bersih untuk ketiga file). Fix bersifat behavior-neutral pada jalur produksi.

---

## 2. Akar masalah & keputusan

### 2.1 Akar masalah

```python
# sebelum (0ad6cc6, masih di HEAD sebelum OD-9)
def load_ohlcv(symbol: str, timeframe: str, cfg: dict | None = None) -> pd.DataFrame:
    strat = (cfg or {}).get("strategy", {}) if cfg else {}   # cfg=None -> strat={}
    ...
    df["don_hi"] = donchian_high(df, strat["donchian_entry_period"])   # KeyError
```

`atr_period` tetap aman karena ditulis `strat.get("atr_period", 14)` — itulah kenapa pesan
errornya spesifik ke `donchian_entry_period`, bukan `atr_period`: itu **call pertama** yang
menggunakan `strat[...]` (bukan `.get`).

### 2.2 Keputusan

`cfg` menjadi **positional wajib**; `strat = cfg["strategy"]` langsung.

Alasan memilih-parameter-wajib, bukan quarterly patch call site saja:
- Tujuh ruli dari call site yang sudah diperbaiki **tidak mencegah** call site berikutnya
  lupa cfg — python tidak akan mengeluh selama default masih ada. Tanpa perubahan
  signature, cacat yang sama bisa berulang pada skrip riset berikutnya.
- Dua dari lima skrip sudah terbukti rusak **tanpa terlihat** selama 3 minggu karena
  default `config.yaml` kebetulan cocok. Kebetulan adalah pembelaorstektur yang buruk.
- Alternatif "default ke `load_config()`" **ditolak**: skrip riset memakai parameter beku
  sendiri (20/10/ATR 14) yang harus reproducibility-nya, dan `load_config()` membaca
  `PRESET` dari environment — diam-diam mengubah angka riset sesuai env pemanggil.

**Tidak ada dependency baru, tidak ada perubahan schema, tidak ada perubahan parameter strategi.**

### 2.3 Perubahan

| File | Perubahan |
|---|---|
| `backtest/run_backtest.py:61` | `cfg` positional wajib; `strat = cfg["strategy"]`; docstring kontrak |
| `backtest/research/sharpe_benchmark.py:121,134` | oper `cfg2` / `cfg10` |
| `backtest/research/portfolio_size_experiment.py:73` | oper `cfg` |
| `backtest/research/run_capital_efficiency.py:68,77` | oper `cfg` |
| `backtest/research/run_longshort_backtest.py:175` | oper `cfg` + guard model donchian (lihat §6) |
| `backtest/research/regime_segmentation.py` | oper `cfg`; hapus dead code (lihat §7) |
| `tests/test_load_ohlcv_cfg_contract.py` | **baru** — penjaga kontrak (lihat §8) |

---

## 3. Blast radius: 10 call site di 5 skrip (VERIFIED)

Audit sebelumnya (OD-6 §29, OD-7 D9) mencatat 3 skrip. Dua lagi terlewat karena **latent**:

| Skrip | Call site | Status sebelum OD-9 |
|---|---|---|
| `sharpe_benchmark.py` | 121, 134 | crash selalu |
| `portfolio_size_experiment.py` | 73 | crash selalu |
| `regime_segmentation.py` | 163, 168, 175 (+2 mati) | crash selalu |
| `run_capital_efficiency.py` | 68, 77 | **crash hanya bila `PRESET=` aktif** |
| `run_longshort_backtest.py` | 175 | **crash hanya bila `PRESET=` aktif** |

Reproduksi (VERIFIED, kedua skrip latent):

```
$ PRESET=presets/sma_crossover.yaml python backtest/research/run_capital_efficiency.py
KeyError: 'donchian_entry_period'
$ PRESET=presets/sma_crossover.yaml python backtest/research/run_longshort_backtest.py
KeyError: 'donchian_entry_period'
```

Keduanya lolos pemeriksaan karena `load_config()` mengembalikan Donchian 20/10 + ATR 14 dari
`config.yaml`, persis sama dengan angka yang sebelumnya di-hardcode di dalam `load_ohlcv`.
Tanpa `PRESET`, keduanya tidak pernah salah.

---

## 4. Drift angka: karakterisasi per-commit (VERIFIED, upgrade dari `INFERRED`)

OD-6 §41 mencatat divergensi `−58.49 → −58.64` dan `155.82 → 158.46` sebagai `INFERRED`
dengan catatan *"tanpa bisect per-commit"*. Audit ini melakukan bisect. Metrik yang diukur:
config 4-pair max_conc=2 (Sharpe / MaxDD), data identik (10 CSV pair core tidak berubah
sejak `45c42f3`), call site di-patch agar meneruskan cfg.

| Code state | Sharpe | MaxDD | Perubahan |
|---|---|---|---|
| `45c42f3` (2026-09-02, engine saat laporan ditulis 5 Sep) | 0.56 | −39.44% | baseline report |
| `0ad6cc6` (SMA refactor) | 0.56 | −39.44% | **nol** |
| `c22ad1c` (cash fix) | 0.56 | −39.44% | **nol** |
| **`029a311` (Wilder seed)** | **0.57** | **−39.66%** | **penyebab tunggal** |
| `9769a0c` / `cb33c7e` / HEAD | 0.57 | −39.66% | nol (ikut `029a311`) |

**Penyebab:** `029a311` memperbaiki seeding ATR Wilder. ATR berubah → jarak stop berubah →
posisi dan equity berubah. Ini **koreksi implementasi, bukan perubahan parameter strategi**:
`atr_stop_multiplier` tetap 2.0, `donchian_entry_period` tetap 20, `atr_period` tetap 14.
Hard Rule #1 tidak dilanggar.

**Verifikasi bahwa sinyal tidak berubah:** jumlah trade dan win rate **identik** di seluruh
enam config (32 / 57 / 72 / 104 / 137 / 171 trade; WR 34.38 / 38.6 / 36.11 / 34.62 / 35.04 / 33.33).
Yang bergeser hanya equity, MaxDD, CAGR, dan PF — konsekuensi downstream dari ATR.

Tabel drift lengkap (angka report → angka re-run engine HEAD):

| Config | Sharpe | Return% | MaxDD% | Trades |
|---|---|---|---|---|
| 2-pair max_conc=1 | 0.94 → **0.95** | 38.05 → 38.65 | −7.42 → −7.42 | 32 → 32 |
| 2-pair max_conc=2 | 0.81 → 0.81 | 54.68 → 55.32 | −12.89 → −12.89 | 57 → 57 |
| 4-pair max_conc=2 | 0.56 → **0.57** | 116.61 → 119.04 | −39.44 → −39.66 | 72 → 72 |
| 6-pair max_conc=3 | 0.48 → 0.48 | 124.97 → 127.48 | −58.19 → −58.34 | 104 → 104 |
| 8-pair max_conc=4 | 0.52 → **0.53** | 157.67 → 160.75 | −57.62 → −57.77 | 137 → 137 |
| 10-pair max_conc=5 | 0.53 → 0.53 | 155.82 → 158.46 | −58.49 → −58.64 | 171 → 171 |

**Gate `Sharpe ≥ 1.0 AND |MaxDD| ≤ 30%` tetap FAIL untuk keenam config** — kesimpulan riset
tidak berubah, hanya presisinya. Gate tidak pernah lolos pada angka lama maupun baru.

---

## 5. Keputusan: laporan `.md` TIDAK diregenerasi (VERIFIED destruktif)

OD-9 menemukan bahwa regenerasi laporan **merusak isi**, sehingga ketiga laporan ditolak.
Bukti (`regime_segmentation_analysis.md`):

| | Versi committed (5 Sep) | Hasil regenerasi |
|---|---|---|
| Baris tabel segmen | **5** (tersaring) | **60** (mentah) |
| Skema tabel | Kolom naratif: `**Bear 2026**`, `Sideways turun` | Kolom teknis polos |
| Judul bagian | `### Bull Rally — Strategi KALAH dari B&H` (memuat kesimpulan) | `### Bull Rally` (netral) |
| Sampah | — | `\| 2022-03-11..2022-03-12 \| 0.2 \| N/A \| N/A \| …` + pipe nyasar |

Post-processing manual yang dihapus regenerasi:

1. `sharpe_benchmark_comparison.md` — **caveat metodologis**: paired t-test membandingkan
   return harian pada SEMUA tanggal, sementara strategi trend-following sengaja di luar pasar
   pada ~90% hari sehingga return 0 pada hari-hari itu. Ini menekan mean return strategi
   secara artifisial; perbandingan yang adil adalah Sharpe ratio. **Peringatan metodologis,
   bukan angka** — justru yang paling tidak boleh hilang diam-diam.
2. `portfolio_size_experiment.md` — catatan bahwa Sharpe 1.06 dari commit `8cc0012`
   (data Binance) **tidak reproducible** dengan data Bitget sekarang.
3. `regime_segmentation_analysis.md` — catatan bahwa segmen pendek (0–5 hari) hasil
   rolling window yang fluktuatif **dihilangkan dari tabel** demi kejelasan.

Logika saringan segmen tersebut **tidak ada di skrip** —-filtering dilakukan manual setelah
generate. Regenerasi tidak akan pernah menghasilkannya kembali.

**Implikasi:** file `.md` di `backtest/reports/` adalah artefak **hybrid** (output skrip +
kurasi manual), bukan output reproducible murni. Siapa pun yang menjalankan ulang skrip riset
akan kehilangan kurasi itu tanpa disadari. Angka drift pada §4 adalah catatan, bukan pembaruan
tabel.

Ukuran diff jika diregenerasi: `portfolio_size_experiment.md` 25 baris,
`sharpe_benchmark_comparison.md` 12 baris, `regime_segmentation_analysis.md` 361 baris.

---

## 6. Temuan sampingan: `run_longshort_backtest.py` donchian-only (VERIFIED)

Perbaikan ini **memunculkan** cacat kedua yang sebelumnya tertutup: `run_longshort_backtest.py`
memiliki implementasi sendiri `run_two_sided()` yang mengakses kolom `don_hi`/`don_lo`
secara langsung (`:85, :90, :111, :112`) dan **tidak punya cabang SMA/RSI**. Sebelumnya
`PRESET=sma` mati lebih dulu di `KeyError`, sehingga inkompatibilitas ini tidak terlihat.
Setelah diperbaiki, `PRESET=sma` berjalan sampai ketemu `KeyError: 'don_hi'`.

**Keputusan: guard, bukan implementasi.** Skrip ini adalah artefak riset long-short
(25 Agu 2026; `direction: long_short` dicoret dari `config.yaml`). Menambah cabang
SMA/RSI = membangun eksperimen yang tidak diminta. Guard 5 baris di `main()` menolak preset
non-donchian dengan pesan jujur **sebelum** menyentuh satu pun file laporan.

---

## 7. Dead code dihapus dari `regime_segmentation.py` (verified via `ast` scan)

- `run_cluster_config()` — tidak pernah dipanggil; mode `"cluster"` masuk ke `elif` yang
  memanggil `run_corr_aware` secara langsung.
- `elif mode == "risk0.5_cluster"` — mode ini tidak ada di daftar `configs`.
- `CLUSTERS` (lokal) — **duplikat basi** dari `correlation_mitigation.py:45` (canonical),
  tidak pernah dipakai. Duplikasi seperti ini justru sumber drift.
- `load_config` di import `:20` — tidak pernah dipakai.

Efek sampingnya: pemanggilan `compute_metrics` di `:175` sebelumnya membaca ulang
seluruh CSV + menghitung ulang seluruh indikator per config; sekarang memakai `dfs` yang
sudah ada di scope.

---

## 8. Penjaga kontrak (1 test)

`tests/test_load_ohlcv_cfg_contract.py` — 3 test:

1. `test_load_ohlcv_cfg_is_mandatory_in_signature` — `cfg` tidak boleh punya default lagi.
2. `test_no_research_script_calls_load_ohlcv_without_cfg` — `ast`-parse seluruh
   `backtest/**/*.py`, setiap call `load_ohlcv` pada file yang mengimpor loader engine
   harus punya cfg (positional **atau** keyword). Gagal dengan pesan `file:line` + nama fungsi.
3. `test_self_defined_loader_is_still_independent` — `correlation_mitigation.load_ohlcv`
   (loader sendiri, parameter beku 14/20/10) **tidak** ikut berubah; dikecualikan secara
   eksplisit, bukan ikut "dibetulkan".

Test 2 menangkap apa yang tidak tertangkap python: pemanggilan via keyword yang di-refactor
sampai kehilangan argumen, dan skrip riset baru yang lupa mengoper cfg.
Diverifikasi menangkap regresi: dengan satu call site di-revert, test gagal dengan
`backtest/research/portfolio_size_experiment.py:73 (dalam run_single())`.

---

## 9. Verifikasi

| Cek | Hasil |
|---|---|
| `python -m pytest tests/` | **227 passed** |
| `python backtest/run_backtest.py` | Sharpe 0.82, DD −26.45%, 94 trades — `metrics.md`/`trades.csv`/`equity_curve.csv` **tidak berubah** (`git status` bersih) |
| 3 skrip riset (default) | exit 0 |
| `PRESET=sma` `run_capital_efficiency.py` | exit 0 (sebelumnya crash) |
| `PRESET=sma` `run_longshort_backtest.py` | exit 1 dengan pesan guard yang jelas (sebelumnya crash `KeyError`) |
| `git diff --check` | bersih |

## 10. Yang TIDAK dilakukan (sengaja)

- **Tidak meregenerasi** `backtest/reports/*.md` (§5).
- **Tidak mengubah** angka di `PLAN.md`, `RULES.md`, `TASKS.md`, `REPO_MAP.md`, `OD2`, `OD4`,
  `OD6`, `OD7`, `OD8`, `PHASE2G`, `PHASE2H`, `correlation_mitigation_experiment.md`,
  `decision_log.md` yang mengutip angka report lama. Dokumen ini tetap berlaku sebagai
  rujukan frozen artifact: angka report adalah artefak beku, drift-nya tercatat di §4.
- **Tidak mengubah** `correlation_mitigation.py` — loader-nya punya parameter beku sendiri
  dan menghasilkan angka yang konsisten dengan config cfg.
- **Tidak menambah** dukungan SMA/RSI untuk long-short (§6).
- **Tidak mengubah** parameter strategi mana pun.