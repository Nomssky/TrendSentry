# PAPER TRADING GATE REPORT — Fase 2

> Tanggal pembuatan: 2026-10-17  
> Status gate: **CONTINUE / INSUFFICIENT SAMPLE**  
> Sumber data: `db/paper_trading.db` (commit lokal, `lastRun` 2026-10-15T05:24:14.916950+00:00)  
> Catatan: database produksi Supabase **tidak** diubah untuk kebutuhan audit ini.

---

## 1. Sumber data & metode

| Item | Nilai |
|---|---|
| Database | `db/paper_trading.db` (SQLite, state engine paper trading) |
| Tabel dibaca | `meta`, `signals`, `positions`, `slippage_log`, `equity_log`, `yield_log`, `sync_state` |
| lastRun engine | 2026-10-15T05:24:14.916950+00:00 |
| Tanggal reset sample (Fase 2) | 2026-08-25 (definisi `TASKS.md` §Fase 2) |
| Rentang candle sinyal | 2026-08-24 .. 2026-10-14 |
| Durasi observasi sejak reset | 51 hari ≈ **7,14 minggu** |
| Durasi observasi sinyal pertama-terakhir | 51 hari ≈ **7,29 minggu** |

Metrik dihitung langsung dari baris database (reproduktibel via `SELECT`), bukan dianggar.

---

## 2. Hasil perhitungan gate

### 2.1 Durasi observasi — BELUM MEMENUHI

Definisi gate (`TASKS.md`): minimal **8 minggu** sejak reset 2026-08-25.

- 8 minggu setelah reset = 2026-10-20.
- Terkini (lastRun / sinyal terakhir) 2026-10-15 → **7,14–7,29 minggu**.
- Kekurangan: ~0,7–0,9 minggu (≈ 5 hari).

**Keputusan: durasi belum memenuhi syarat.**

### 2.2 Jumlah closed trades — BELUM MEMENUHI

Definisi gate: minimal **10 trade tertutup** sebelum evaluasi hasil trading.

| Posisi | Pair | Entry | Exit | Exit reason | PnL | R-multiple |
|---|---|---|---|---|---|---|
| 1 | SOL/USDT | 2026-08-27 | 2026-09-10 | stop_loss | −10,81 | −1,081 |
| 2 | HYPE/USDT | 2026-09-03 | 2026-09-10 | donchian_exit | −7,74 | −0,922 |
| 3 | BNB/USDT | 2026-09-05 | 2026-09-10 | live_stop | −8,14 | −1,077 |
| 4 | HYPE/USDT | 2026-09-18 | 2026-09-29 | donchian_exit | −5,47 | −0,685 |
| 5 | SOL/USDT | 2026-09-18 | 2026-10-07 | donchian_exit | +3,29 | +0,337 |
| 6 | AVAX/USDT | 2026-09-18 | 2026-10-08 | donchian_exit | +13,31 | +1,529 |

- Closed trades: **6** (semuanya status `closed`, 0 posisi open).
- Minimum gate: 10.
- Terpenuhi: **6/10** (belum cukup).

### 2.3 Metrik trading (referensi: canonical snapshot backtest 2026-10-02)

| Metrik | Aktual paper (6 trade) | Referensi backtest 10-pair | Keterangan |
|---|---|---|---|
| Win rate | 33,33% (2/6) | 36,17% | Sampel kecil, arahnya serdekat |
| Avg R | −0,3165 | +1,03 | Di bawah referensi, tapi n=6 belum representatif |
| Avg win R | +0,933 | +4,35 | 2 trade menang |
| Avg loss R | −0,941 | −0,85 | 4 trade kalah |
| Profit per trade (USD) | −0,645 rata-rata | — | Dari `pnl` |
| Total realized PnL | −3,88 USD | — | −10,81−7,74−8,14−5,47+3,29+13,31 |

**Catatan:** `avg R < 0,5` memicu rekomendasi investigasi menurut `TASKS.md`, namun dengan n=6 dan durasi < 8 minggu, ini **bukan dasar penilaian gagal** — cukup ditandai untuk revisi pada checkpoint berikutnya.

### 2.4 Slippage

| Metrik | Nilai | Ambang evaluasi (`TASKS.md`) |
|---|---|---|
| Rata-rata spread | 0,0126% | < 0,10% ✓ |
| Maksimum spread | 0,0936% | < 0,10% ✓ |
| Jumlah sampel | 475 | — |

Slippage riatif nyata berada di bawah asumsi backtest (0,05%) dan jauh di bawah batas evaluasi (0,10%). **Tidak ada tindakan revisi sizing perlu saat ini.**

### 2.5 Konsistensi data

| Pemeriksaan | Hasil |
|---|---|
| Duplikasi `(candle_date, pair)` pada `signals` | 0 duplikat ✓ |
| Duplikasi `date` pada `equity_log` | 0 duplikat ✓ |
| Posisi open | 0 ✓ |
| `last_yield_date` | 2026-10-02 (`yield_log` 38 baris, 2026-08-25 .. 2026-10-02) |
| `equity_log` | 53 baris, 2026-08-24 .. 2026-10-15 |
| `paper_cash` | 988,03 |
| `sync_state` watermark konsisten (signals=475, slippage=475, yield=38, positions=6, equity date=2026-10-15) | ✓ |
| Event/fill/signal duplikat | Tidak ditemukan ✓ |

Equity = cash + MTM, venue tunggal Bitget, tanpa double-count yield (terverifikasi pada `equity_log`).

### 2.6 Heartbeat / downtime / kegagalan job

- `lastRun` 2026-10-15 — engine berjalan terakhir pada tanggal tersebut, tidak ada indikasi crash dalam rentang data tersedia.
- Tidak ada tabel/job heartbeat terpisah di SQLite lokal; keterlambatan run hanya dapat diketahui dari log GitHub Actions (tidak dapat diakses tanpa kredensial CI — catat sebagai keterbatasan).

---

## 3. Kesimpulan & keputusan gate

**Status: `CONTINUE / INSUFFICIENT SAMPLE`**

Alasan:
1. Durasi observasi **7,14 minggu** < 8 minggu yang ditentukan gate.
2. Closed trades **6** < minimum **10** yang ditentukan gate.
3. Metrik trading (win rate, avg R) dihitung dari n=6 — belum cukup untuk menarik kesimpulan statistik terhadap gate Fase 2.

Tidak ada inkonsistensi data material, duplikasi, atau pelanggaran batas slippage yang perlu diperbaiki sebelum lanjut.

---

## 4. Checkpoint berikutnya

- Durasi akan memenuhi 8 minggu pada **2026-10-20** (≈ 3 hari dari pembuatan laporan ini).
- Perlu minimal **4 closed trades tambahan** untuk mencapai ambang 10 trade.
- Rekomendasi: biarkan paper trading berjalan sampai checkpoint minggu ke-8 (2026-10-20) atau sampai ≥10 closed trades, mana yang lebih late, baru evaluasi Fase 2.
- **Jangan** mengubah parameter strategi/risk untuk mempercepat pemenuhan gate (dilarang tanpa persetujuan owner, AGENTS.md aturan 5).

---

## 5. Batasan

- Metrik hanya menghitung data yang tersedia di `db/paper_trading.db` lokal.
- Status CI/GitHub Actions dan log Telegram tidak dapat diverifikasi tanpa kredensial repository; dicatat sebagai keterbatasan, bukan asumsi sukses/gagal.
- Hasil backtest referensi adalah historical snapshot, bukan janji performa masa depan.
