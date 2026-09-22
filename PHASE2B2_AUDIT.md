# Phase 2B-2 Audit

> Tanggal: 2026-09-22 · Baseline: `6148317` `[Phase 2B-1] remove confirmed dead artifacts`
> **Audit-only** — tidak ada kode/deps yang dihapus atau diubah pada fase ini.
> Klasifikasi: `DELETE` · `KEEP` · `REFACTOR` · `INVESTIGATE` · `DECISION` (+ turunan: `DELETE CANDIDATE`, `DEPRECATE CANDIDATE`, `SAFE CLEANUP`, `BEHAVIOR RISK`).

## Executive Summary

| Candidate | Classification | Confidence | Action |
|---|---|---|---|
| 1. `REPORTS` (`run_backtest.py:33`) | **DELETE** | HIGH — 0 pembacaan di luar shadowing lokal | Hapus di fase cleanup terpisah |
| 2. `can_open_position` (`guards.py:75`) | **REFACTOR / DECISION** | HIGH — teruji, tak dipanggil engine | Owner putuskan: wire ke engine vs document |
| 3. `vectorbt` (`requirements.txt:5`) | **DELETE CANDIDATE** | HIGH — 0 import repo-wide, CI tak pernah install | Hapus setelah sign-off owner (§3) |
| 4. Lint (2 error + 7 warning) | 7 × **SAFE CLEANUP**, 2 × **BEHAVIOR RISK** | HIGH | Fase cleanup lint terpisah |
| 5. `yfinance`/`scipy` (riset, tak ada di requirements) | **DECISION** (dependency gap) | HIGH — 2 import persis, 0 di CI/produksi | Pisah `requirements-research.txt` nanti |
| 6. `strategy_templates` seed | **DECISION** (reproducibility gap) | HIGH — schema ada, INSERT tak ada di repo | Owner: tambah seed migration |
| 7. `test-bitget-api.yml` | **DEPRECATE CANDIDATE** | MEDIUM — tujuan one-off tampak terjawab | Opsional: delete / biarkan (manual, murah) |
| 8. `bh_*.md` (2 file untracked) | **DECISION** | HIGH — artefak riset manual | Commit ke folder riset / ignore |

---

## 1. REPORTS

### Evidence

- **Definisi:** `backtest/run_backtest.py:33` — `REPORTS = Path(__file__).resolve().parent / "reports"` (global module-level).
- **Semua referensi repo-wide** (grep `REPORTS` di `*.py`, `*.md`, `*.yml`, `*.yaml`; kecuali `venv/`, `node_modules/`, artefak riset):
  - `backtest/run_backtest.py:33` — definisi.
  - `backtest/run_backtest.py:249` — `def save_report(...)`: `REPORTS = reports_dir()` → **variabel lokal yang men-shadow global**.
  - `backtest/run_backtest.py:251,252,268,277` — pembacaan `REPORTS / ...` → **semuanya di dalam `save_report()`**, jadi membaca lokal, bukan global.
  - Dokumentasi audit saja: `PHASE2_SOURCE_OF_TRUTH.md:116` (menyatakan temuan yang sama).
- **Nol impor lintas-modul:** tidak ada `from run_backtest import ... REPORTS` (semua import hanya `run_backtest`, `compute_metrics`, `load_config`, `load_ohlcv` — 10 lokasi di `backtest/research/*` + `tests/test_backtest_cash.py:19`).
- **Tidak ada `.ipynb`** di repo; tidak ada `importlib`/`__import__`/`exec(` dinamis di `backtest/`, `risk_manager/`, `tests/`.
- **Runtime/report:** semua tulisan laporan lewat `reports_dir()` (`run_backtest.py:231-232`, membaca env `REPORT_SUBDIR`) — global `REPORTS` tidak pernah jadi jalur tulis. Menghapusnya **tidak mengubah output apa pun**.
- **Tests:** `tests/` nol referensi ke `REPORTS` atau konstanta itu (grep kosong).
- **Docs:** hanya `PHASE2_SOURCE_OF_TRUTH.md:116` yang menyebutnya (sebagai kandidat hapus).

### Classification

**DELETE** — bukti repo-wide lengkap: satu-satunya pembacaan berada di fungsi yang men-shadow-nya dengan `reports_dir()`; tidak ada pembacaan eksternal, tidak ada test, tidak ada dampak perilaku.

### Recommended future action

Hapus baris `run_backtest.py:33` di **fase cleanup terpisah** (bukan fase ini), verifikasi `pytest` + satu re-run backtest menghasilkan artefak identik. Tidak perlu menyentuh `save_report()`.

---

## 2. can_open_position

### Evidence

- **Definisi:** `risk_manager/guards.py:75-77` — `def can_open_position(n_open: int, max_concurrent: int) -> bool: return n_open < max_concurrent`; di-export via `__all__` (`guards.py:13`).
- **Semua referensi:**
  - `risk_manager/guards.py:13,75` — deklarasi/export.
  - `tests/test_risk.py:6,15-17` — **dipanggil langsung oleh 1 test** (`assert can_open_position(4,5) is True`, `(5,5) is False`).
  - `PHASE2_SOURCE_OF_TRUTH.md:49,63,68,117,222` — dokumentasi audit.
- **Callers produksi/paper: NOL.** Kedua engine meng-inline semantik identik:
  - `backtest/run_backtest.py:128` — `if entry_hit and len(pos) < risk["max_concurrent_positions"]`.
  - Paper/scan live: inline serupa di jalur `live_signal.py:476` (audit 2A) + riset `backtest/research/run_longshort_backtest.py:109`, `correlation_mitigation.py:84`.
- **Duplikasi:** ya — helper = kebenaran tunggal `n_open < max`; engine membandingkan dict risk secara inline. Semantik sama, tidak ditemukan bug.
- **Maksud perilaku:** defense-in-depth untuk batas `max_concurrent_positions` (1..5, divalidasi `validate_config`, `guards.py:41-43`).

### Safety implications

Ini **kode kontrol-risiko**. Menghapusnya:
- menghapus 1 export publik + 1 unit test (`test_can_open_position`);
- **tidak** menurunkan pengendalian risiko apapun saat ini (engine tidak memanggilnya — proteksi datang dari inline check);
- tetapi menghilangkan helper yang diduga menjadi tujuan akhir arsitektur (satu-satunya lokasi kebenihan batas), memaksa re-wire nanti dengan diff lebih besar.

### Classification

**REFACTOR / DECISION** — bukan dead code biasa. Dua opsi untuk owner:
1. **Wire:** ganti kedua inline check engine dengan `can_open_position(...)` → satu sumber kebenihan (perubahan perilaku: tidak ada, semantik identik — tapi menyentuh backtest/paper → butuh fase sendiri + verifikasi metrik identik);
2. **Document:** terima duplikasi + komentar silang di 3 lokasi.

### Recommended future action

Jangan hapus. Masuk daftar keputusan owner (§9). Jika dipilih opsi 1 → fase terpisah dengan re-run backtest wajib (perbandingan `backtest-reference.json`).

---

## 3. vectorbt

### Evidence

- **Deklarasi:** `requirements.txt:5` — `vectorbt>=1.0,<2`.
- **Referensi repo-wide** (case-insensitive, semua file, kecuali `.git/`, `venv/`, `node_modules/`):
  - **0 import Python** — grep `import vectorbt|from vectorbt|vbt` di `*.py` → nol.
  - **0 `.ipynb`** di repo (find kosong) → tidak ada notebook riset yang memakainya.
  - **0 dinamis** — tidak ada `importlib`/`__import__`/`exec(` di kode backtest/tests.
  - **0 via dependensi lain** — tidak ada wrapper repo (`strategy/` murni pandas; `AGENTS.md:40`, `RULES.md:110`, `PLAN.md:135` semuanya menyatakan "tidak dipakai").
  - Dokumentasi/workflow: `requirements.txt:5` (satu-satunya *penggunaan teknis*); semua penyebutan lain (`REPO_MAP.md:79,445,727,763,902,922,1016,876`, `AGENTS.md:40`, `PLAN.md:55,135,207`, `RULES.md:110`, `TASKS.md:7`) = dokumentasi yang **menyatakan itu tidak dipakai** (sisa entri).
- **Tidak ada workflow/dokumen yang mengajarkan pengguna memakai vectorbt** — sebaliknya, docs konsisten bilang "murni pandas".

### Production usage

Nol. Engine backtest (`run_backtest.py` + `strategy/`), paper-trading (`live_signal.py`), risk (`guards.py`) tidak mengimpornya.

### Research usage

Nol. 7 skrip di `backtest/research/` mengimpor hanya `pandas`, `numpy`, `matplotlib`, `requests`, `yaml`, `yfinance`, `scipy` + modul repo (`run_backtest`, `strategy`).

### CI usage

Nol — **CI tidak pernah memakai `requirements.txt`**:
- `.github/workflows/fetch-bitget-data.yml:27` → `pip install ccxt pandas pyyaml`
- `.github/workflows/paper-trading.yml:33` → `pip install ccxt pandas pyyaml pytest rich` (komentar `:32` eksplisit: requirements.txt ada tapi baris ini tidak memakainya)
- `.github/workflows/test-bitget-api.yml:16` → `pip install ccxt requests`

### Classification

**DELETE CANDIDATE** — production-unused **dan** repository-unused dengan bukti lengkap (0 import termasuk notebook/dinamis/riset/CI).

### Removal prerequisites

1. Sign-off owner (aturan 2A: `requirements.txt` jangan disentuh tanpa instruksi).
2. Verifikasi instalasi bersih tetap valid: `vectorbt` bukan transitive-dependency pandas/numpy/ccxt (tidak ada yang bergantung padanya — cukup cek `pip install -r requirements.txt` tanpa baris itu di venv baru / dry-run).
3. Rapikan anotasi docs yang menunjuk "sisa di requirements" (`REPO_MAP.md`, `AGENTS.md`, `RULES.md`, `TASKS.md`, `PLAN.md`) **di commit yang sama** supaya tidak jadi referensi basi.

---

## 4. Lint Issues

Output `npm run lint` (baseline tak berubah: **9 problems — 2 errors, 7 warnings**):

| File | Line | Rule | Symbol | Classification | Notes |
|---|---:|---|---|---|---|
| `app/app/AppSidebar.tsx` | 24 | `react-hooks/set-state-in-effect` | `setOpen(false)` dalam `useEffect(..., [pathname])` | **BEHAVIOR RISK** | Reset menu saat navigasi — mengubahnya ke pola lain (mis. key/reset saat render) mengubah kapan menu menutup; butuh verifikasi manual UI |
| `app/app/strategies/new/page.tsx` | 107 | `react-hooks/set-state-in-effect` | `setParams(defaults)` dalam `useEffect(..., [selectedTemplate])` | **BEHAVIOR RISK** | Isi default params saat ganti template — logika turunan; pindah ke event handler ganti-template = perubahan alur perilaku, wajib uji manual |
| `app/app/strategies/new/page.tsx` | 3 | `@typescript-eslint/no-unused-vars` | `createClient` (import `@/lib/supabase/client`) | **SAFE CLEANUP** | Impor mati; komponen "use client" ini memakai `useState/useEffect` saja |
| `app/components/marketing/Hero.tsx` | 5 | `@typescript-eslint/no-unused-vars` | `SITE` (import `@/lib/site`) | **SAFE CLEANUP** | Hanya impor, nol pemakaian di file |
| `app/components/marketing/PricingTeaser.tsx` | 4 | `@typescript-eslint/no-unused-vars` | `SITE` | **SAFE CLEANUP** | idem |
| `app/start/page.tsx` | 6 | `@typescript-eslint/no-unused-vars` | `SITE` | **SAFE CLEANUP** | idem |
| `e2e/api-smoke-test.mjs` | 12 | `@typescript-eslint/no-unused-vars` | `SUPABASE_URL` (const proyek) | **SAFE CLEANUP** | Const murni, tanpa side effect; hanya dokumentasi proyek yang tak terbaca. Bukan artefak generate |
| `e2e/free-tier-flow.spec.ts` | 12 | `@typescript-eslint/no-unused-vars` | `fs` (import node) | **SAFE CLEANUP** | Impor mati — terkait Phase 2B-1 (auth state tak lagi dibaca/ditulis manual). Bukan artefak generate |
| `lib/db-supabase.ts` | 85 | `@typescript-eslint/no-unused-vars` | `lastRunDate` (lokal) | **SAFE CLEANUP** | `lastRun` (baris 84) **masih dipakai** di baris 125 (return objek) — hanya `lastRunDate` mati; ekspresi `lastRun.slice(0,10)` tanpa side effect |

- **Artefak generate/config?** Tidak ada — semua 9 di source/test yang diedit tangan. (`next build` tidak punya artefak lint.)
- **Catatan observasi (di luar scope cleanup):** `e2e/free-tier-flow.spec.ts:10-14` memuat kredensial login nyata hardcoded — layak jadi keputusan terpisah (rotasi/secret), bukan bagian fase lint.

### Classification

7 `SAFE CLEANUP` (hapus impor/lokal mati — nol perubahan perilaku), 2 `BEHAVIOR RISK` (efek `setState-in-effect` = perilaku UI aktual, harus diubah hati-hati + verifikasi manual).

### Recommended future action

Fase "lint cleanup" terpisah: (a) 7 warning satu commit aman; (b) 2 error dibahas sebagai perubahan perilaku UI — tidak boleh dicampur.

---

## 5. Research Dependencies

### Evidence

- **Importer:**
  - `backtest/research/correlation_mitigation.py:11` → `import yfinance as yf`
  - `backtest/research/sharpe_benchmark.py:17` → `from scipy import stats`
  - Nol importer lain di `*.py` (grep `import yfinance|from yfinance|import scipy|from scipy`).
- **Masih terdokumentasi/usable:** ya — keduanya punya docstring usage (`sharpe_benchmark.py:1-10`: `PYTHONPATH=. python backtest/research/...`), laporan keluarannya ter-commit (`REPO_MAP.md:419,425,511,514`), dan dikutip dokumen desain (`DESIGN.md` §6.1 memakai angka Sharpe B&H 0.98 dari `sharpe_benchmark`).
- **Produksi/backtest/paper:** tidak dipakai — `run_backtest.py`, `live_signal.py`, `guards.py`, `strategy/`, API web: 0 referensi.
- **GitHub Actions:** 0 — tidak ada workflow menyebut `yfinance`/`scipy`/`backtest/research/*` (grep `.github/workflows/` kosong).
- **Dependensi riset lain yang tak terdeclarasi:** dari seluruh impor `backtest/research/*.py`: `pandas`, `numpy`, `matplotlib`, `requests`, `yaml` (semua sudah di `requirements.txt`) + `yfinance`, `scipy` (tidak). Tidak ada lagi.

### Current dependency gap

`yfinance` dan `scipy` dibutuhkan skrip riset yang **ter-dokumentasi dan ter--reproduce** (`correlation_mitigation_experiment.md`, `sharpe_benchmark_comparison.md`), tetapi absen dari `requirements.txt` → instalasi bersih = `ImportError`. CI tak terpengaruh (tak menjalankan riset). Reproducibility gap riset, bukan production risk.

### Classification

**DECISION** — organisasi dependensi (owner memutuskan bentuknya); bukan dead code.

### Recommended future architecture

Buat **`requirements-research.txt`** berisi `yfinance`, `scipy` (+ `pip install -r requirements.txt -r requirements-research.txt` di docstring skrip riset), **tanpa** menyentuh `requirements.txt` produksi. Dampak CI/runtime: nol (CI tidak membaca requirements.txt; riset = manual). Jangan diimplementasikan sebelum sign-off — aturan 2A melarang mengubah dependency di fase audit.

---

## 6. strategy_templates

### Evidence

- **Definisi tabel:** `supabase/migrations/20260909120000_remote_schema.sql:26-30` (`create table public.strategy_templates`), RLS `:166` + policy public-read `:182-183`; FK dari `user_strategies.template_id` (`:38`).
- **Semua referensi migration:** hanya 2 file — `remote_schema.sql` (schema) dan `20260911120000_seed_strategy_templates.sql` yang **hanya `UPDATE`** 8 nama template (`where name in ('Donchian Breakout', ... 'VWAP Strategy')`) dengan komentar `:3`: *"(Seed awal 8 template sudah ada — file ini hanya mengencangkan batasnya.)"`.
- **INSERT seed di repo: NOL** — grep `INSERT INTO.*strategy_templates|insert into.*strategy_templates` di seluruh `supabase/migrations/` → kosong. (Sesuai temuan 2A.)
- **Application code baca/tulis:**
  - Baca: `monitoring/web/app/api/templates/route.ts:13` — `.from("strategy_templates").select("*")` (setelah auth).
  - Tulis: **tidak ada** — app hanya membaca (tabel read-only by design, policy `strategy_templates_read`).
  - Referensi semantik: `lib/validations.ts:30` (komentar guardrail selaras seed), `app/start/page.tsx:33` (hardcoded marketing list, bukan DB).
- **Seed data di repo:** hanya *daftar nama* di migration UPDATE + komentar; **payload `params_schema` lengkap tidak ada di file mana pun**.
- **Tests:** 
  - `e2e/free-tier-flow.spec.ts:155-165` — asumsi halaman memuat template (cek substring `"Donchian"`; `console.log`, bukan assert keras — tetapi halaman kosong = jelek).
  - `e2e/api-smoke-test.mjs:89-99` — **assert keras**: `templates → 200` dan **`Array.length > 0`** (`:96`) → fail jika tabel kosong.
- **Deploy Supabase baru = state ekuivalen?** **TIDAK** — migration baru membuat tabel kosong; migration seed hanya UPDATE (0 baris kena di DB kosong) → `/api/templates` → `[]` → smoke test gagal. Data 8 template hanya hidup di remote DB saat ini.

### Reproducibility implications

**Source-of-truth gap nyata:** payload template (JSON `params_schema`) hanya ada di remote database — tidak bisa direproduksi dari repo, tidak bisa di-review di PR, tidak bisa dipindah ke project/staging baru. Jika remote DB hilang/refresh, data tak terkunci di kode mana pun.

### Classification

**DECISION** — arsitektur/reproducibility (bukan dead code). Keputusan owner: bikin **seed migration** berisi `INSERT` 8 template (dump `params_schema` dari remote) supaya state = kode.

### Recommended future action

Fase sendiri: dump 8 baris dari remote → tulis migration INSERT idempoten (atau `on conflict do nothing`) → verifikasi di branch Supabase / local stack → smoke test lolos di DB segar. **Jangan sentuh migration yang sudah ada** (aturan: Supabase migration = read-only fase ini).

---

## 7. test-bitget-api.yml

### Evidence

- **Apa yang dilakukan:** probe konektivitas API publik Bitget dari runner GitHub (IP AS) — 2 step: (1) raw HTTP `GET /api/v2/spot/market/tickers?symbol=BTCUSDT` ke `api.bitget.com` + `.app`; (2) `ccxt.bitget.fetch_ohlcv("BTC/USDT","1d")`. Timeout 5 menit.
- **Trigger:** **`workflow_dispatch` saja** (`:8`) — manual, tidak cron, tidak PR.
- **Script/test yang dipanggil:** tidak ada file repo — inline heredoc Python (`:19-28`, `:31-40`). Tidak menyentuh `tests/`.
- **Secrets:** **tidak ada** — endpoint publik (tanpa API key), `pip install ccxt requests` saja (`:16`).
- **API surface masih valid?** Ya — memakai v2 spot publik + ccxt stable; workflow ini menanyakan hal yang kini terjawab oleh keberadaan `fetch-bitget-data.yml` + `paper-trading.yml` (paper sudah jalan harian dengan Bitget sebagai venue — lihat komentar `:5` "Kalau lolos, data source paper trading bisa pindah ke Bitget").
- **Overlap CI/tests lain:** nol tumpang tindih coverage test (ini probe jaringan, bukan test logika); CI utama = pytest (paper-trading.yml) — tidak memprobing venue.
- **Jika dinonaktifkan/dihapus:** kehilangan ability manual re-probe (mis. IP runner diblokir lagi / venue ganti host) — murah dan tanpa biaya maintenance selain file exist.

### Classification

**DEPRECATE CANDIDATE** (dengan **KEEP** sementara) — tujuan one-off-nya tampak tercapai (paper trading kini pakai Bitget), tapi ia manual, tanpa secret, tanpa overlap → menghapus = menutup kemampuan verifikasi venue yang masih relevan. Risiko salah-kecil di kedua arah.

### Recommended future action

Opsional: hapus di fase kebersihan CI **atau** biarkan (biaya ~0). Jangan di fase ini. Jika dipertahankan, tambahkan komentar status "probed OK 20xx-xx-xx" agar konteksnya jelas.

---

## 8. bh_*.md

Files: `backtest/reports/bh_drawdown_and_btc_eth_corr.md`, `backtest/reports/bh_max_drawdown.md` (**untracked**).

### Evidence

- **Isi:**
  - `bh_max_drawdown.md` — laporan MDD buy-and-hold 10 pair (periode 2020-11-09..2026-09-02, modal $10k), eksplisit menyatakan formula identik `run_backtest.py:194-196` (`dd = equity / cummax(equity) - 1`), tabel tanggal data per pair.
  - `bh_drawdown_and_btc_eth_corr.md` — MDD B&H (BTC-only / 2-pair / 10-pair) + korelasi harian BTC-ETH 0.843, merujuk `portfolio_size_experiment.md` sebagai sumber.
- **Direferensikan docs?** Ya — hanya dokumen audit: `REPO_MAP.md:517-518,892-893,1014` dan `PHASE2_SOURCE_OF_TRUTH.md:122,158` (keduanya menandai "untracked / keputusan owner"). Tidak ada doc riset lain yang menautkannya.
- **Digenerate skrip?** **Tidak ditemukan** — tidak ada `.py` yang menulis nama `bh_*.md` (grep `bh_` di `*.py` hanya menemukan variabel internal B&H di `run_backtest.py`/riset, bukan penulisan file ini). Keduanya output **analisis manual** (angka diketik, ada catatan prose).
- **Reproducible?** Sebagian — formula dan periode dideklarasikan; angka bisa dihitung ulang dari `load_ohlcv` + `compute_metrics`/pandas, tapi **tidak ada satu-perintah generator** → re-derivation = kerja manual.
- ** berguna?** Ya — evidence riset portofolio (MDD benchmark & korelasi, dasar pertimbangan cluster/pair count); angka serupa dikutip di laporan riset lain.

### Classification

**DECISION** (state git-nya) — konten = artefak riset sah, bukan dead code; status untracked = masalah penyimpanan, bukan masalah relevansi.

### Recommended future action

Pilih salah satu (owner): **(a)** commit ke `backtest/reports/research/` (konsisten dengan artefak riset ter-commit lain), **(b)** tambahkan ignore rule bila dianggap scratch. **(a) direkomendasikan** — mereka evidence yang dirujuk audit. Jangan hapus.

---

## 9. Decisions Required

Hanya isu yang **tidak bisa diselesaikan oleh bukti kode saja**:

1. **Canonical metric A/B** — `metrics.md` (+149.59%) vs `backtest-reference.json` (+152.0%): pilih canonical → regenerate yang satunya + perbaiki sitasi campur (PHASE2 §7.1). **Di luar scope fase ini** (larangan eksplisit).
2. **`can_open_position`** — wire ke 2 engine (satu sumber kebenihan, verifikasi metrik identik) vs terima duplikasi + document (§2).
3. **`vectorbt` removal** — sign-off hapus dari `requirements.txt` + sinkronkan 6 anotasi docs yang menyebut "sisa" (§3).
4. **`requirements-research.txt`** — setujui pemisahan `yfinance`/`scipy` (§5).
5. **`strategy_templates` seed migration** — dump 8 template dari remote → migration INSERT agar state segar = kode (§6); ini **reproducibility risk** tertinggi di daftar ini.
6. **`bh_*.md`** — commit ke folder riset vs ignore (§8).
7. **`test-bitget-api.yml`** — pertahankan (re-probe venue murah) vs deprecate (§7).
8. **Lint 2 error** — pendekatan refactor `setState-in-effect` (perilaku UI) — bukan sekadar hapus warning (§4); plus observasi kredensial hardcoded di `free-tier-flow.spec.ts:10-14` (rotasi/secret — keputusan keamanan terpisah).

## 10. Proposed Next Phases

Diurutkan risiko & dependensi:

1. **Phase 2B-3 — Lint safe cleanup** (7 warning `SAFE CLEANUP` saja; risiko nol, verifikasi = lint turun ke 2 error + baseline typecheck/build/pytest). Sengaja **tidak** menyentuh 2 error.
2. **Phase 2B-4 — Dead constant cleanup** (`REPORTS` `run_backtest.py:33` + `vectorbt` dari `requirements.txt` jika sign-off §9.3 sudah ada — 1 baris, bukti lengkap; verifikasi pytest + install bersih).
3. **Phase 2B-5 — R&D dependency split** (`requirements-research.txt`; butuh keputusan §9.4) — dapat digabung dengan 2B-4 bila owner mau.
4. **Phase 2B-6 — `strategy_templates` seed migration** (keputusan §9.5 — **prioritas arsitektur tertinggi**; butuh akses dump remote + branch Supabase; verifikasi smoke test di DB segar).
5. **Phase 2B-7 — `can_open_position` wiring / document** (keputusan §9.2; jika wire → wajib re-run backtest & bandingkan `backtest-reference.json`).
6. **Lint 2 error UI refactor** (perilaku, verifikasi manual) + nasib `test-bitget-api.yml` & `bh_*.md` (§9.6-9.7) — terakhir, paling rendah urgensi.
7. **Canonical metric ruling** (§9.1) — kapanpun owner siap; semua fase di atas tidak bergantung padanya, tetapi jangan menunda terlalu lama (makin banyak dokumen mengutip angka campuran).

---

*Verifikasi fase ini: audit-only — `git status/diff` menunjukkan hanya file ini (baru); pytest/typecheck/build/lint = baseline identik (64 pass / 0 / 0 / 2 errors + 7 warnings).*
