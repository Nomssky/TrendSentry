# Investigasi Discrepancy Sharpe Ratio — TrendSentry

> Tanggal: 2026-09-05
> Status: Selesai

---

## Kesimpulan Utama

**Sharpe Ratio yang valid dan reproducible dari kode saat ini: 0.53**

---

## 1. Formula yang Dipakai

`backtest/run_backtest.py:142`:

```python
daily = curve["equity"].pct_change().dropna()
sharpe = daily.mean() / daily.std() * (365**0.5) if daily.std() > 0 else 0.0
```

- Risk-free rate = 0 (tidak dikurangkan)
- Annualized dengan `sqrt(365)` (bukan 252)
- Pakai daily return dari equity curve pct_change()
- **Formula identik di semua commit — tidak ada perubahan formula.**

---

## 2. History Sharpe Ratio per Config

| Commit | Config | Sharpe | Return | Trades | Max DD |
|---|---|---|---|---|---|
| `2af4322` (original) | 2 pair, 2 concurrent, 3 tahun | **0.46** | 12.51% | 34 | -12.75% |
| `8cc0012` (6 tahun, 2 pair) | BTC+ETH only, 2 concurrent | **1.06** | 141.17% | 62 | -15.36% |
| `45c42f3` (10 pair, 5 concurrent) | 10 pair, 5 concurrent | **0.53** | 155.56% | 172 | -58.49% |
| **HEAD (fresh run 2026-09-05)** | 10 pair, 5 concurrent | **0.53** | 155.82% | 171 | -58.49% |

### Penjelasan Kenapa Sharpe Turun dari 1.06 ke 0.53

Config berubah dari commit `8cc0012` ke `45c42f3`:

```diff
  pairs:
    - "BTC/USDT"
    - "ETH/USDT"
+   - "SOL/USDT"
+   - "BNB/USDT"
+   - "XRP/USDT"
+   - "AVAX/LINK/USDT"
+   - "DOGE/USDT"
+   - "ADA/USDT"
+   - "HYPE/USDT"
- max_concurrent_positions: 2
+ max_concurrent_positions: 5
```

- **Lebih banyak false signals** dari 10 pair → frekuensi trading naik 3x (62 → 172 trades)
- **Max DD melebar** dari -15.36% ke -58.49% karena lebih banyak posisi overlap
- **Return naik tipis** (141% → 155%) tapi volatilitas naik jauh lebih banyak

---

## 3. Apakah 1.06 Pernah Muncul di Codebase?

**Ya**, tapi hanya di documentation (bukan di kode/pipeline aktual):

| Lokasi | Teks | Status |
|---|---|---|
| `backtest/reports/metrics.md` (commit `8cc0012`) | `sharpe \| 1.06` | ✅ Benar — config lama (2 pair, 2 concurrent) |
| `backtest/DESIGN.md:176` | `Sharpe \| ~1.06` | ⚠️ STALE — metrik di sekitarnya adalah milik config 10-pair sekarang |
| `PLAN.md:178` | `decision gate LOLOS (Sharpe 1.06, max DD -15.4%)` | ✅ Benar untuk config lama |
| `RULES.md:135` | `Sharpe 1.06 punya confidence interval lebar` | ⚠️ STALE — sudah tidak relevan |

### Bukti CODECANON

```bash
# Commit yang menghasilkan Sharpe 1.06:
git show 8cc0012:backtest/reports/metrics.md

# Output:
| sharpe | 1.06 |
| total_return_pct | 141.17 |
| max_drawdown_pct | -15.36 |
| n_trades | 62 |

# Config saat itu: 2 pair (BTC+ETH), max_concurrent=2
```

---

## 4. Rekomendasi Decision Gate Fase 1

| Gate | Threshold | Current | Status |
|---|---|---|---|
| Sharpe ≥ 1.0 | 1.0 | **0.53** | ❌ FAIL |
| Max DD ≤ 30% | 30% | **-58.49%** | ❌ FAIL |
| Return > B&H | >154.85% | 155.82% | ✅ PASS |

**Verdict: TIDAK LOLOS**

Strategi dengan config 10-pair/5-concurrent (yang akan dipakai di live) tidak lolos decision gate. Perlu:
1. Revisi strategi (misal: filter pair lebih ketat, kurangi max concurrent, atau tambah confirmation filter)
2. Atau revert ke config 2-pair/2-concurrent yang lolos gate

---

## 5. Dokumentasi yang Perlu Diupdate

| File | Issue | Rekomendasi |
|---|---|---|
| `backtest/DESIGN.md:176` | Sharpe ~1.06 tapi metrik sekitarnya = config 10-pair | Update Sharpe ke 0.53, atau ganti label menjadi "Config 10-pair" |
| `RULES.md:135` | Referensi ke Sharpe 1.06 | Update atau hapus reference karena config sudah berubah |
| `PLAN.md:178` | Decision gate LOLOS (Sharpe 1.06) | Tandai bahwa ini untuk config LAMA, bukan config saat ini |
| `TASKS.md:18` | Decision gate LOLOS (Sharpe 1.06) | Perlu review ulang — config saat ini tidak lolos |
