# BUSINESS VALIDATION PLAN — Rencana Eksperimen Manual

> Tanggal pembuatan: 2026-10-17  
> Tujuan: memvalidasi demand & penggunaan sebelum membangun fitur bisnis baru.  
> Prinsip: **tidak mengarang** jumlah pengguna, konversi, pendapatan, atau hasil wawancara.  
> Status data: **belum cukup** untuk menyimpulkan demand (instrumentasi terbatas; data produksi tidak diakses untuk audit ini).  
> Tabel kosong **bukan** bukti sistem rusak dan **bukan** bukti tidak ada demand.

---

## 1. Instrumentasi yang sudah ada (diverifikasi dari kode)

| Yang terukur | Mekanisme | Dapat dipakai untuk |
|---|---|---|
| Page-view first-party | `AnalyticsBeacon` → `POST /api/events` → tabel `analytics_events` (`path`, `ref`, `created_at`) | Melihat halaman mana yang dikunjungi, sumber referral |
| Sumber referral | `?ref=` disimpan di `localStorage` (`ts_ref`) + `profiles.referral_source` saat signup | Atribusi kasar sumber akuisisi |
| Strategi user | `user_strategies` | Apakah user membuat strategi |
| API key read-only | `user_api_keys` | Apakah user menyelesaikan koneksi exchange |
| Fills user | `user_trades` (via daily-sync) | Aktivasi teknis (key valid + fill tertarik) |
| Deviasi | `deviation_log` | Apakah fitur inti (deteksi deviasi) benar-benar menghasilkan nilai |
| Discipline score | `discipline_scores` | Aktivasi fitur inti |
| Deployment (bot) | `deployments`, `deployment_config_versions` | Apakah user mencoba alur bot |
| Checkout | `checkout` (gated `PAYMENTS_ENABLED`) | Konversi berbayar **jika** diaktifkan |

### Yang belum terinstrumentasi dengan baik

| Metrik yang diminta | Status | Keterangan |
|---|---|---|
| Onboarding completion | ⚠️ Parsial | Bisa disimpulkan dari keberadaan baris `user_strategies`/`user_api_keys`, tapi tidak ada event eksplisit "selesai onboarding" |
| Keberhasilan setup | ⚠️ Parsial | Keberhasilan verifikasi API key read-only tidak tercatat sebagai event terpisah |
| Penggunaan berulang | ❌ | Tidak ada event harian terstruktur per user (beacon hanya page-view tanpa identitas) |
| Aktivasi fitur inti | ⚠️ Parsial | Bisa diganti dari `user_trades`/`deviation_log`/`discipline_scores` |
| Retensi | ❌ | Tidak ada kohort login berulang yang tercatat |
| Filter dengan vs tanpa LLM | ❌ | LLM filter nonaktif (Fase 3, digated) — belum ada datanya, memang belum bisa diukur |
| Konversi pilot berbayar | ❌ | `PAYMENTS_ENABLED` gated; belum ada mekanisme pembayaran aktif |

**Kesimpulan:** instrumentasi saat ini cukup untuk **menghitung** aktivasi dasar (strategi dibuat, key terhubung), tetapi **tidak cukup** untuk menarik kesimpulan retensi, penggunaan berulang, atau willingness-to-pay. Karena itu rencana ini memakai eksperimen manual.

---

## 2. Hipotesis masalah (yang akan diuji)

Bukan asumsi "produk butuh fitur X", melainkan dugaan yang bisa dipatahkan:

- **H1:** Trader retail yang disiplin (punya aturan tertulis) tetap melanggar aturannya sendiri karena tidak ada umpan balik objektif → mereka butuh *deteksi deviasi*, bukan sinyal baru.
- **H2:** Trader enggan memasukkan API key read-only karena takut dana/key disalahgunakan → trust/gating adalah hambatan onboarding utama, bukan kekurangan fitur.
- **H3:** Pengguna yang berhasil menghubungkan key + punya ≥1 strategi akan kembali membuka dashboard saat pasar bergerak (retensi berbasis kebutuhan, bukan notifikasi).
- **H4:** Sebagian trader bersedia membayar untuk *penggunaan sistem* (bukan sinyal) jika terbukti mengurangi pelanggaran aturan mereka sendiri.

Setiap hipotesis dinyatakan dengan **cara mematahkannya** (lihat §7).

---

## 3. Kriteria pemilihan responden (10–15 trader)

Segmen yang benar (bukan "semua orang yang tertarik crypto"):

- Trader individual yang **trading manual** di exchange (spot/futures) dalam 3 bulan terakhir.
- **Punya aturan yang bisa dinyatakan** (mis. "long-only, stop 2ATR, maks 3 posisi") — walau tidak tertulis.
- Ukuran akun: kecil–menengah (modal yang rela dirisikokan, bukan akun institusi).
- Bersedia menghubungkan key **read-only** ATAU bersedia menjalani wawancara berbasis screenshot/riwayat tanpa koneksi.
- Tersebar di ≥2 tingkat pengalaman (pemula yang punya aturan sederhana vs yang sudah pernah pakai bot/journal).

**Kriteria eksklusi:** tidak pernah trading manual; mencari "sinyal gratis" sebagai nilai utama; tidak bersedia diamati perilakunya.

Rekrutmen: komunitas trading lokal/online, jaringan pribadi, referral `?ref=` yang sudah ada di sistem. **Jangan** mengarang angka responden — target = 10–15 yang benar-benar ikut.

---

## 4. Pertanyaan berbasis perilaku nyata (bukan opini/hipotetis)

Wawancara harus menggali **apa yang sudah dilakukan**, bukan "apakah kamu akan pakai fitur X".

1. "Ceritakan trade terakhir yang kamu tutup. Apa yang membuatmu masuk dan keluar?" (menggali aturan aktual)
2. "Buka history-mu 30 hari terakhir. Trade mana yang melanggar aturan yang baru saja kamu sebutkan?" (deviasi nyata — menguji H1)
3. "Apa yang kamu lakukan mencatat aturan itu? (jurnal/spreadsheet/ingatan)" (menggali pain point)
4. "Kapan terakhir kamu menyerahkan API key ke layanan pihak ketiga? Apa yang membuatmu percaya/tidak?" (menguji H2)
5. "Dalam seminggu terakhir, berapa kali kamu membuka dashboard/monitoring trading? Kenapa saat itu?" (menguji H3)
6. "Kalau ada tool yang menunjukkan 'kamu melanggar aturanmu 3× bulan ini', apa reaksimu? Sudah pernah pakai yang mirip?" (perilaku, bukan niat)
7. (Untuk yang sudah pakai TrendSentry) "Halaman apa yang terakhir kamu buka dan untuk apa?" (retensi nyata)

**Larangan:** jangan tanyakan "maukah kamu bayar $X?" sebagai pertanyaan pertama; jangan memancing jawaban sosial yang diinginkan.

---

## 5. Workflow yang akan diamati (per responden, 2–4 minggu)

1. **Baseline (tanpa TrendSentry):** responden menyerahkan riwayat trade 30 hari terakhir + aturan yang mereka klaim.
2. **Hitung deviasi manual** terhadap aturan mereka sendiri (oleh fasilitator), tanpa sistem.
3. **Onboarding:** responden mencoba TrendSentry (signup → strategi → key read-only), fasilitator mencatat **titik drop-off** (di halaman mana berhenti, pesan apa yang membingungkan).
4. **Pengamatan pemakaian:** apakah responden kembali membuka fitur inti (deviasi/skor) tanpa diingatkan; catat frekuensi & pemicu.
5. **Exit interview:** bandingkan persepsi sebelum/sesudah; uji willingness to pay dengan penawaran nyata (lihat §6).

Yang diamati (bukan ditanyakan): jumlah sesi, halaman yang dibuka, apakah setup key selesai, apakah deviasi terbaca.

---

## 6. Definisi aktivasi, penggunaan berulang, willingness-to-pay

- **Aktivasi (per user):** menyelesaikan ≥1 dari: (a) membuat strategi dengan aturan, (b) menghubungkan key read-only yang tervalidasi read-only. (Instrumentasi: `user_strategies`, `user_api_keys`.)
- **Aktivasi fitur inti:** `deviation_log` atau `discipline_scores` menghasilkan ≥1 baris bermakna untuk user tersebut.
- **Penggunaan berulang:** membuka dashboard/fitur inti pada ≥2 minggu berturut-turut **tanpa diingatkan** (bukan sekadar email blast).
- **Willingness-to-pay (uji nyata, bukan survei):** tawarkan harga konkret (mis. paket filter API sesuai `PLAN.md` §9) dan minta **komitmen nyata** — pembayaran/deposit kecil, atau surat niat untuk pilot berbayar. Kata "mungkin mau" tidak dihitung.

---

## 7. Success & kill criteria

| Hipotesis | Success criteria | Kill criteria (patahkan) |
|---|---|---|
| H1 (butuh deteksi deviasi) | ≥60% responden menemukan ≥1 pelanggaran aturan nyata mereka yang sebelumnya tidak disadari | Mayoritas responden sudah tahu pelanggarannya dan tidak menganggapnya masalah |
| H2 (trust = hambatan utama) | ≥50% yang menolak key menyebut trust/alasan keamanan sebagai penyebab, dan setuju ketika read-only dibuktikan | Penolakan karena alasan lain (tidak relevan/lupa) mendominasi |
| H3 (retensi berbasis kebutuhan) | ≥40% responden kembali ke fitur inti ≥2 minggu berturut-turut tanpa diingatkan | Kembali hanya 1× setelah onboarding lalu tidak lagi |
| H4 (mau bayar) | ≥3 dari 10–15 membuat komitmen pembayaran/pilot nyata dengan harga yang ditawarkan | 0 komitmen nyata setelah penawaran konkret |

**Aturan keputusan:** jika H1/H2 gagal → jangan bangun fitur bisnis baru; fokus perbaikan onboarding/kepercayaan. Jika H1/H2 lulus tapi H4 gagal → validasi nilai dulu lebih lama (paper/free), jangan duru berbayar. Semua keputusan butuh persetujuan owner.

---

## 8. Batasan & larangan

- Data produksi (jumlah user, event) **tidak** dibaca/diubah untuk audit ini. Angka yang tidak dapat diverifikasi dari artifact lokal tidak dicantumkan.
- LLM filter belum aktif (Fase 3, digated) → perbandingan dengan/tanpa LLM **belum** dapat diukur; jangan diklaim.
- Pembayaran belum aktif (`PAYMENTS_ENABLED` gated) → "konversi pilot berbayar" hanya bisa diuji via komitmen manual.
- Rencana ini **tidak** membangun fitur bisnis baru dan **tidak** mengaktifkan live trading.