# Phase 10 — Benchmark biaya AI dan kalibrasi kredit

| Dikerjakan       | Ukuran | Bergantung pada | Perlu dari pemilik                                                    |
| ---------------- | ------ | --------------- | --------------------------------------------------------------------- |
| Claude + pemilik | Sedang | Phase 05        | API key provider AI (yang akan dipakai produksi) + batas anggaran uji |

## Untuk pemilik

**Kenapa penting:** harga Pro AI Rp79.000 berisi 100 kredit. Kita perlu bukti bahwa 100 kredit yang **dipakai penuh** tetap muat dalam anggaran AI (target awal Rp15.000 per pembelian) dan hasilnya bagus untuk CV Indonesia/Inggris. Phase ini mengukur biaya nyata per tindakan, membandingkan model, lalu menyetel bobot kredit sebelum menjual.

**Siapkan:**

1. API key provider AI di `.env.local` (seperti Phase 05). Bila ingin membandingkan dua model, siapkan keduanya.
2. Pasang batas pengeluaran di dashboard provider, misalnya **US$10–20** untuk seluruh uji.
3. Sisihkan ±30–60 menit untuk menilai sekitar 20 contoh hasil (Claude menyiapkan lembar penilaian).

**Prompt:** `Kerjakan Phase 10 dari .agents/docs/plans/membership/README.md`

**Hasil:** laporan berisi biaya rata-rata dan biaya terburuk per tindakan, rekomendasi model, bobot kredit baru, dan apakah harga Rp79.000 masih aman.

## Untuk agent

### Tujuan

Mengukur biaya (P50/P95) dan kualitas Rezumi AI per `actionKey` dengan data fiktif, lalu menetapkan `CREDIT_COSTS`, batas kerja per tindakan, dan model — sebelum go-live.

### Langkah

1. **Data uji fiktif** — siapkan ±20 CV fiktif (fresh graduate, 1–5 tahun, pindah karier; Bahasa Indonesia dan Inggris; termasuk CV panjang) dan ±20 lowongan fiktif. Tidak boleh memakai data pengguna sungguhan. Simpan di `tooling/benchmark/fixtures/` (dev-only, tidak dibundel).
2. **Skrip** — `tooling/benchmark/rezumi-ai.mjs` (atau `.ts` sesuai pola `tooling/`): buat akun uji di database lokal yang sudah dimigrasi, beri kredit besar lewat layanan admin, jalankan ±100 tugas yang mencakup semua `actionKey` (termasuk konteks panjang dan Coach beberapa giliran) memakai jalur kode produksi (`aiSource: "rezumi"`), lalu baca `ai_credit_usage` untuk token dan `cost_usd_micros`.
3. **Hitung** — per `actionKey`: jumlah sampel, P50, P95, maksimum (USD dan Rupiah dengan kurs perencanaan yang dicatat di laporan), tingkat gagal, dan waktu tunggu.
4. **Kualitas** — pilih ±20 hasil acak, buat lembar penilaian sederhana untuk pemilik (fakta tidak dikarang, bahasa wajar, format benar, berguna untuk lowongan). Gabungkan dengan pemeriksaan otomatis yang masuk akal (misalnya output JSON valid).
5. **Simulasi paket** — skenario 100 kredit dipakai penuh dengan campuran tindakan realistis dan campuran "berat" (semua tindakan termahal). Bandingkan dengan anggaran Rp15.000 dan margin di `00-keputusan-produk.md` bagian 7.
6. **Usulan** — bobot `CREDIT_COSTS` baru, batas kerja per tindakan (`maxOutputTokens`, langkah agent, ukuran input), model yang dipilih, dan apakah harga/kuota perlu diubah. **Tanyakan pemilik** sebelum mengubah harga atau jumlah kredit; perubahan bobot dan batas kerja boleh diterapkan bila masih sesuai prinsip produk.
7. **Terapkan** — perbarui katalog (naikkan `BILLING_CATALOG_VERSION`), konstanta batas kerja, `00-keputusan-produk.md` (bagian 5 dan log keputusan), dan tulis laporan di `.agents/docs/research/benchmark-rezumi-ai-<tanggal>.md`.

### Aturan

- Jangan melewati batas anggaran yang ditetapkan pemilik; hentikan skrip bila biaya kumulatif mendekati batas.
- Jangan mencetak API key; jangan menyimpan output yang memuat data sungguhan.

### Selesai bila

- Laporan benchmark tersimpan, bobot dan batas kerja diperbarui dengan persetujuan pemilik untuk hal yang mengubah harga/kuota, dan anggaran 100 kredit pada P95 terbukti muat (atau keputusan perbaikan sudah diambil).
