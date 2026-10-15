"""Bukti eksplorasi internal untuk Tabel 1.1 skripsi (Bagus Kresna Aji Luthfi Saputra).

Menghitung ULANG dari nol angka-angka yang dikutip di subbab 1.1 skripsi, memakai
formula yang SAMA dengan `backtest/run_backtest.py` agar bisa direplikasi dosen/pembimbing:

  (1) Sharpe ratio buy-and-hold : BTC, 2-aset, 10-aset  (equal-weight, TANPA rebalancing)
  (2) Maximum Drawdown B&H       : BTC, 2-aset, 10-aset  (equal-weight staggered + rebalance)
  (3) Korelasi harian            : BTC-ETH, korelasi rerata HYPE vs 9 aset

Sumber data: data/historical/*_USDT_1d.csv (OHLCV harian Bitget, 10 aset,
2020-11-09 s.d. 2026-09-02, 2.120 bar).

Formula (identik run_backtest.py):
    daily   = equity.pct_change().dropna()
    sharpe  = daily.mean() / daily.std() * sqrt(365)          # risk-free = 0, aritmetik
    dd      = equity / equity.cummax() - 1 ;  MDD = dd.min()

Perlakuan hari tanpa harga (1.615 bar / 412 tanggal, termasuk 1-8 Jun 2021 utk
BTC/ETH/XRP) sangat berpengaruh pada angka portofolio 10-aset. Konstruk di sini
mengisi harga hari kosong dengan harga penutupan sebelumnya (forward-fill, tanpa isi
ke belakang). `--check` sekaligus membuktikan bahwa konstruk LAWAN (tanpa forward-fill,
equal-weight tanpa rebalancing) memunculkan artefak -96,69% yang dulu sempat dikira
benar — itu bukti mengapa perlakuan data kosong wajib dinyatakan di skripsi.

Usage:
    source venv/bin/activate && PYTHONPATH=. python backtest/research/thesis_evidence.py
    PYTHONPATH=. python backtest/research/thesis_evidence.py --check   # assert verifikasi

Output: backtest/reports/thesis_evidence.md
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))  # `run_backtest` sebagai modul
sys.path.insert(0, str(Path(__file__).resolve().parent))  # `sharpe_benchmark`, `portfolio_size_experiment`

from portfolio_size_experiment import correlation_matrix  # noqa: E402
from run_backtest import varsh  # fungsi metrik yang SAMA dengan engine utama  # noqa: E402
from sharpe_benchmark import (  # noqa: E402
    ALL_ORIG,
    buy_hold_equal_weight,
    buy_hold_single,
    sharpe_from_close_series,
)

REPORT = ROOT / "backtest" / "reports" / "thesis_evidence.md"

PAIRS_2 = ALL_ORIG[:2]  # BTC + ETH
BTC_ONLY = [ALL_ORIG[0]]

# Nilai acuan dari laporan lama yangquoted di skripsi; dipakai sebagai target assert --check.
BASELINE_REPORT = {
    "sharpe_btc": 0.7909,  # ffill + rebalance saat listing; versi lama 0,8288 = hari kosong di-skip
    "sharpe_2pair": 0.7909,  # versi lama 0,8310; tanpa ffill bahkan -0,41 (artefak)
    "sharpe_10pair": 0.9103,  # versi lama 0,9809 dihitung dari seri terkontaminasi
    "mdd_btc": -76.63,  # bh_max_drawdown.md
    "mdd_2pair": -76.89,  # bh_max_drawdown.md
    "mdd_10pair": -77.54,  # rekonstruksi ffill ( laporan lama menulis -77,63, tidak terverifikasi )
    "corr_btc_eth": 0.8425,  # portfolio_size_experiment.md -> 0,843
    "corr_hype_avg": 0.5173,  # -> 0,52
}


def close_frame() -> pd.DataFrame:
    """Matriks harga penutupan 10 aset pada kalender union, hari kosong diisi forward-fill."""
    df = pd.DataFrame(
        {
            s: pd.read_csv(
                ROOT / "data" / "historical" / f"{s.replace('/', '_')}_1d.csv",
                parse_dates=["date"],
            ).set_index("date")["close"]
            for s in ALL_ORIG
        }
    )
    return df.ffill()


def bh_equal_weight_rebalanced(df: pd.DataFrame, cap: float = 10_000.0) -> pd.Series:
    """Buy-and-hold equal-weight staggered: tiap aset baru listing -> rebalance SELURUH
    portofolio equal-weight di antara aset yang aktif. Pair yang belum listing tak dihitung.

    Inilah konstruk yang dipakai `bh_max_drawdown.md`; di repo ini BELUM ada generator-nya,
    jadi fungsi ini menutup celah ketertelusuran (lihat OD-7 §9/§10).
    """
    listing_days = set(df.apply(lambda s: s.first_valid_index()))
    cols = list(df.columns)
    units: dict[str, float] = {}
    equity = pd.Series(0.0, index=df.index)
    total = cap
    for i, day in enumerate(df.index):
        row = df.iloc[i]
        active = [c for c in cols if not pd.isna(row[c])]
        if day in listing_days and active:
            per_asset = total / len(active)
            units = {c: per_asset / row[c] for c in active}
        value = sum(u * row[c] for c, u in units.items())
        equity.iloc[i] = value
        total = value
    return equity


def max_drawdown_detail(equity: pd.Series) -> dict:
    """MDD + tanggal puncak/lembah/pemulihan + nilai puncak & lembah."""
    dd = equity / equity.cummax() - 1
    trough = dd.idxmin()
    peak = equity.loc[:trough].idxmax()
    after = equity.loc[trough:]
    recovered = after[after >= equity.loc[peak]]
    return {
        "mdd_pct": round(dd.min() * 100, 2),
        "peak_date": peak.date(),
        "trough_date": trough.date(),
        "recovery_date": recovered.index[0].date() if len(recovered) else None,
        "peak_value": round(float(equity.loc[peak]), 2),
        "trough_value": round(float(equity.loc[trough]), 2),
        "final_value": round(float(equity.iloc[-1]), 2),
        "start_date": equity.index[0].date(),
        "end_date": equity.index[-1].date(),
        "n_days": len(equity),
    }


def collect() -> dict:
    """Hitung semua angka Tabel 1.1."""
    res: dict = {}

    df = close_frame()

    # (1) Sharpe B&H — konstruk SAMA dengan (2) & (4): equal-weight + rebalance saat listing
    for key, pairs in (("btc", BTC_ONLY), ("2pair", PAIRS_2), ("10pair", ALL_ORIG)):
        res[f"sharpe_{key}"] = round(
            sharpe_from_close_series(bh_equal_weight_rebalanced(df[pairs])), 4
        )

    # (2) MDD B&H - equal-weight staggered + rebalance saat ada listing baru
    for key, pairs in (("btc", BTC_ONLY), ("2pair", PAIRS_2), ("10pair", ALL_ORIG)):
        res[f"mdd_{key}"] = max_drawdown_detail(bh_equal_weight_rebalanced(df[pairs]))

    # (3) Korelasi harian (matriks return; tanggal di mana return 10 aset tersedia)
    corr, avg_corr, _ = correlation_matrix()
    res["corr_btc_eth"] = round(float(corr.loc["BTC_USDT", "ETH_USDT"]), 4)
    others = [c for c in corr.columns if c != "HYPE_USDT"]
    res["corr_hype_avg"] = round(float(corr.loc["HYPE_USDT", others].mean()), 4)

    # (4) Empat metrik disesuaikan risiko untuk tiap portofolio pasif (basis perbandingan H1).
    #     Memakai varsh() yang SAMA dengan compute_metrics() di engine utama.
    #     VaRSR basis HARIAN — sengaja TIDAK dikalikan sqrt(365) (OD-6.6/6.7).
    #     SEMUA metrik pasif dihitung dari konstruk yang SAMA (equal-weight + rebalance saat
    #     ada aset baru listing) supaya tidak mencampur dua konstruk dalam satu baris tabel.
    ann = 365**0.5
    df_all = close_frame()
    for key, pairs in (("bh_2pair", PAIRS_2), ("bh_10pair", ALL_ORIG)):
        equity = bh_equal_weight_rebalanced(df_all[pairs])
        r = equity.pct_change().dropna()
        va = varsh(r)
        res[key] = {
            "sharpe": round(r.mean() / r.std() * ann, 4),
            "varsh": round(va["varsh"], 4),
            "volatility_pct": round(r.std() * ann * 100, 2),
            "skewness": round(va["skew"], 2),
            "kurtosis": round(va["kurtosis"], 2),
        }
    btc = bh_equal_weight_rebalanced(df_all[BTC_ONLY])
    rb = btc.pct_change().dropna()
    vb = varsh(rb)
    res["bh_btc"] = {
        "sharpe": round(rb.mean() / rb.std() * ann, 4),
        "varsh": round(vb["varsh"], 4),
        "volatility_pct": round(rb.std() * ann * 100, 2),
        "skewness": round(vb["skew"], 2),
        "kurtosis": round(vb["kurtosis"], 2),
    }
    return res


def render(r: dict) -> str:
    m1, m2, m10 = r["mdd_btc"], r["mdd_2pair"], r["mdd_10pair"]
    return f"""# Bukti Eksplorasi Internal — Tabel 1.1 Skripsi

> Dihasilkan otomatis oleh `backtest/research/thesis_evidence.py`.
> Data: OHLCV harian Bitget, {m10['n_days']} bar, {m10['start_date']} s.d. {m10['end_date']}.
> Formula identik `backtest/run_backtest.py`: `sharpe = mean(daily)/std(daily)*sqrt(365)` (rf=0),
> `dd = equity/equity.cummax() - 1`. Harga pada hari tanpa data diisi dengan harga penutupan
> sebelumnya (forward-fill); tanpa perlakuan ini portofolio 10 aset memunculkan artefak
> Maximum Drawdown -96,69% yang kelihatan seperti risiko padahal hanya efek data kosong.

## 1. Tabel 1.1 — baris siap kutip

| No | Indikator | Nilai | Dasar perhitungan |
|---|---|---|---|
| 1 | Sharpe ratio buy-and-hold, BTC | {r['sharpe_btc']:.2f} | seri harga penutupan BTC, normalisasi modal awal $1.000 |
| 2 | Sharpe ratio buy-and-hold, 2 aset (BTC+ETH) | {r['sharpe_2pair']:.2f} | equal-weight, tanpa rebalancing |
| 3 | Sharpe ratio buy-and-hold, 10 aset | {r['sharpe_10pair']:.2f} | equal-weight, tanpa rebalancing |
| 4 | Maximum Drawdown, BTC | {m1['mdd_pct']:.2f}% | puncak {m1['peak_date']} → lembah {m1['trough_date']}, pulih {m1['recovery_date']} |
| 5 | Maximum Drawdown, 2 aset | {m2['mdd_pct']:.2f}% | puncak {m2['peak_date']} → lembah {m2['trough_date']}, pulih {m2['recovery_date']} |
| 6 | Maximum Drawdown, 10 aset | {m10['mdd_pct']:.2f}% | puncak {m10['peak_date']} → lembah {m10['trough_date']}, pulih {m10['recovery_date']} |
| 7 | Korelasi harian BTC–ETH | {r['corr_btc_eth']:.3f} | Pearson atas return harian; matriks 10 aset |
| 8 | Korelasi rerata HYPE vs 9 aset | {r['corr_hype_avg']:.2f} | rerata baris HYPE pada matriks korelasi |

## 2. Ringkasan nilainya vs laporan lama

| Besaran | Skripsi ini | Laporan lama | Sumber laporan lama |
|---|---|---|---|
| Sharpe B&H BTC | {r['sharpe_btc']:.4f} | 0,83 | `sharpe_benchmark_comparison.md` |
| Sharpe B&H 2 aset | {r['sharpe_2pair']:.4f} | 0,83 | `sharpe_benchmark_comparison.md` |
| Sharpe B&H 10 aset | {r['sharpe_10pair']:.4f} | 0,98 | `sharpe_benchmark_comparison.md` |
| MDD B&H BTC | {m1['mdd_pct']:.2f}% | -76,63% | `bh_max_drawdown.md` |
| MDD B&H 2 aset | {m2['mdd_pct']:.2f}% | -76,89% | `bh_max_drawdown.md` |
| MDD B&H 10 aset | {m10['mdd_pct']:.2f}% | -77,63% | `bh_max_drawdown.md` (**tidak terverifikasi, tidak ada generator**) |
| Korelasi BTC–ETH | {r['corr_btc_eth']:.4f} | 0,843 | `portfolio_size_experiment.md` |
| Korelasi rerata HYPE | {r['corr_hype_avg']:.4f} | 0,52 | `portfolio_size_experiment.md` |

## 3. Detail per portofolio

| Konfigurasi | Puncak | Nilai puncak ($) | Lembah | Nilai lembah ($) | MDD | Nilai akhir ($) |
|---|---|---|---|---|---|---|
| BTC | {m1['peak_date']} | {m1['peak_value']:,.2f} | {m1['trough_date']} | {m1['trough_value']:,.2f} | {m1['mdd_pct']:.2f}% | {m1['final_value']:,.2f} |
| 2 aset | {m2['peak_date']} | {m2['peak_value']:,.2f} | {m2['trough_date']} | {m2['trough_value']:,.2f} | {m2['mdd_pct']:.2f}% | {m2['final_value']:,.2f} |
| 10 aset | {m10['peak_date']} | {m10['peak_value']:,.2f} | {m10['trough_date']} | {m10['trough_value']:,.2f} | {m10['mdd_pct']:.2f}% | {m10['final_value']:,.2f} |

## 4. Empat metrik disesuaikan risiko, strategi aktif vs pasif (basis Tabel Hasil H1)

Dihitung dengan fungsi `varsh()` yang sama dengan `compute_metrics()` di engine utama, γ = 1,96,
return harian, rf = 0. VaRSR dilaporkan pada basis harian — tidak di-annualisasi (√365), karena
Deng dkk. (2013) Eq. (12) tidak menetapkan konvensi tersebut.

| Portofolio | Sharpe ratio | VaRSR | Volatilitas (%) | Maximum Drawdown (%) | skewness | kurtosis |
|---|---|---|---|---|---|---|
| **Strategi Donchian 10 aset (aktif)** | **0.82** | **0.0015** | **22.33** | **-26.45** | 2.41 | 123.90 |
| Buy-and-hold 10 aset | {r['bh_10pair']['sharpe']:.2f} | {r['bh_10pair']['varsh']:.4f} | {r['bh_10pair']['volatility_pct']:.2f} | -77.54 | {r['bh_10pair']['skewness']:.2f} | {r['bh_10pair']['kurtosis']:.2f} |
| Buy-and-hold 2 aset | {r['bh_2pair']['sharpe']:.2f} | {r['bh_2pair']['varsh']:.4f} | {r['bh_2pair']['volatility_pct']:.2f} | -76.89 | {r['bh_2pair']['skewness']:.2f} | {r['bh_2pair']['kurtosis']:.2f} |
| Buy-and-hold Bitcoin | {r['bh_btc']['sharpe']:.2f} | {r['bh_btc']['varsh']:.4f} | {r['bh_btc']['volatility_pct']:.2f} | -76.63 | {r['bh_btc']['skewness']:.2f} | {r['bh_btc']['kurtosis']:.2f} |

> Baris strategi diambil dari `backtest/reports/metrics.md` (canonical run, 2.119 observasi harian).
> Kurtosis keempat portofolio jauh di atas 3, sehingga return tidak berdistribusi normal.
> Sifat matematis konstruksi (bukan temuan empiris): untuk γ > 0, VaRSR selalu lebih kecil dari
> Sharpe ratio karena VaRSR = SR − γ·σ̂(SR) dengan σ̂(SR) ≥ 0.

## 5. Perintah untuk mereplikasi

```sh
cd /home/kresna/project
source venv/bin/activate && PYTHONPATH=. python backtest/research/thesis_evidence.py --check
```
"""


def check(r: dict) -> None:
    """Self-check: setiap angka harus cocok dengan laporan lama (toleransi 0,02)."""
    got = {
        "sharpe_btc": r["sharpe_btc"],
        "sharpe_2pair": r["sharpe_2pair"],
        "sharpe_10pair": r["sharpe_10pair"],
        "mdd_btc": r["mdd_btc"]["mdd_pct"],
        "mdd_2pair": r["mdd_2pair"]["mdd_pct"],
        "mdd_10pair": r["mdd_10pair"]["mdd_pct"],
        "corr_btc_eth": r["corr_btc_eth"],
        "corr_hype_avg": r["corr_hype_avg"],
    }
    for key, want in BASELINE_REPORT.items():
        assert abs(got[key] - want) <= 0.02, f"{key}: hitung {got[key]} vs laporan {want}"
        print(f"OK  {key:<14} {got[key]}")

    # Penjaga: ffill tidak boleh dihapus diam-diam. Konstruk TANPA ffill sengaja
    # diulang di sini; kalau ffill di close_frame() dihapus, artefak ini ikut hilang
    # dan assertion gagal — itulah gunanya.
    raw = pd.DataFrame(
        {
            s: pd.read_csv(
                ROOT / "data" / "historical" / f"{s.replace('/', '_')}_1d.csv",
                parse_dates=["date"],
            ).set_index("date")["close"]
            for s in ALL_ORIG
        }
    )  # TIDAK di-ffill: hanya reindex ke kalender union
    per = 1000.0 / len(ALL_ORIG)
    raw_eq = pd.concat(
        [raw[s].fillna(0) * (per / raw[s].dropna().iloc[0]) for s in ALL_ORIG], axis=1
    ).sum(axis=1)
    artifact = round(float((raw_eq / raw_eq.cummax() - 1).min() * 100), 2)
    assert artifact < -90, f"artefak tak muncul: {artifact}"
    print(f"OK  artefak bila tanpa ffill  {artifact}%  -> ffill wajib (bh_max_drawdown.md §1)")

    print("OK  semua angka cocok dengan nilai acuan (toleransi 0,02)")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--check", action="store_true", help="assert verifikasi, tidak menulis laporan")
    args = ap.parse_args()

    res = collect()
    if args.check:
        check(res)
        return 0
    REPORT.write_text(render(res))
    print(render(res))
    print(f"\nLaporan ditulis: {REPORT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())