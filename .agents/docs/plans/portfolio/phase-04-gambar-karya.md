# Phase 04 — Gambar, karya, dan metrik

| Dikerjakan | Ukuran | Bergantung pada | Perlu dari pemilik |
| ---------- | ------ | --------------- | ------------------ |
| Claude     | Besar  | Phase 03        | —                  |

## Untuk pemilik

**Apa yang dibuat:**

- **Unggah gambar** yang otomatis dikecilkan di browser (cepat, hemat kuota, data lokasi foto terhapus), dipakai untuk foto khusus portfolio, sampul dan galeri karya, gambar bagian bebas, foto testimoni, dan logo klien.
- **Editor Karya** lengkap: tambah karya kosong, dari proyek CV, atau dari banyak gambar sekaligus; kartu karya (sampul dengan titik fokus, judul, ringkasan, peran, tahun, tag, metrik unggulan); dan detail berupa **blok**: Teks (Rich Text Editor HeroUI Pro), Gambar, dan **Metrik**. Ketik "/" di blok Teks untuk menambah blok. Ada tombol "Mulai dari kerangka studi kasus".
- **Widget metrik** (angka hasil kerja seperti "+35% konversi") di detail karya, di kartu karya, dan sebagai angka pencapaian di intro.

**Siapkan:** tidak ada.

**Prompt:** `Kerjakan Phase 04 dari .agents/docs/plans/portfolio/README.md`

**Yang bisa kamu cek di akhir:** screenshot karya berblok dengan galeri dan widget metrik di HP dan desktop, serta contoh foto ±10 MB yang tersimpan sebagai ±300 KB.

## Untuk agent

### Langkah

1. **Unggah gambar** (`02-teknis.md` bagian 8):
   - browser: `apps/web/src/features/portfolio/images/*` (kanvas → WebP 2.000 px + 800 px, logo 600 px dengan transparansi, fallback JPEG, tolak SVG dan GIF animasi, banyak file berurutan dengan progres, seret-lepas dan tempel dari clipboard);
   - server: `portfolio.uploadImage` / `portfolio.deleteFile`, cek tanda tangan file, ukuran, dan dimensi dari header; simpan di `uploads/<userId>/pictures/portfolio/`; catat di `portfolio_file`;
   - teks alternatif wajib, dengan saran awal dari judul karya atau nama klien;
   - pemilih titik fokus untuk sampul.
2. **Semua kolom gambar**: foto khusus portfolio (Intro, termasuk opsi tanpa foto), gambar bagian bebas, foto testimoni, logo klien.
3. **Editor Karya** (`01-desain.md` bagian 15, `02-teknis.md` bagian 16):
   - dialog "Tambah karya": Kosong, Dari CV (`portfolio.importWorks`), Unggah gambar (satu karya dengan blok Gambar, atau satu karya per gambar). Pilihan "Tempel tautan" disiapkan tempatnya; isinya dibuat di Phase 05;
   - kartu: sampul + titik fokus, judul, ringkasan, peran, tahun, tag, metrik unggulan, tautan utama, unggulan, sembunyikan; slug otomatis dari judul (unik, ASCII);
   - blok: Teks (komponen teks kaya dari Phase 03), Gambar (1–12, keterangan, tata letak), Metrik; tombol "+ Tambah blok" di antara blok, menu slash `/` di blok Teks (`SuggestionMenu` HeroUI), seret + tombol naik/turun, hapus dengan Urungkan, "Mulai dari kerangka studi kasus";
   - daftar karya: urutan, unggulan, sembunyikan, hapus dengan konfirmasi.
4. **Metrik** (`01-desain.md` bagian 16, `02-teknis.md` bagian 17):
   - `formatMetric` di `packages/portfolio` + tes `id-ID`, `en-US`, `ar-SA`;
   - form metrik di `apps/web/src/features/portfolio/metrics/*` dengan pratinjau kecil (`KPI`, `TrendChip`, `NumberValue` HeroUI Pro dimuat lazy; cek ukuran bundel karena `recharts`; bila tidak sepadan, pakai komponen metrik portfolio sendiri) dan petunjuk "Pakai angka yang bisa kamu jelaskan saat wawancara";
   - dipakai di blok Metrik, pilihan metrik unggulan kartu, dan angka pencapaian Intro (2–4).
5. **Render tema pertama**: lengkapi dan rapikan render blok Teks/Gambar/Metrik, kartu dengan chip metrik, angka pencapaian, foto testimoni, deret logo klien, dan detail karya (dialog, galeri layar penuh dengan keyboard dan geser, fokus kembali ke kartu saat ditutup). Varian metrik sesuai keputusan Phase 00.
6. **Kebersihan file**: hapus file saat gambar/karya/portfolio dihapus; job mingguan untuk file yatim (scheduler Node + Workers `scheduled()`), aman dijalankan ulang.
7. **Batas teknis** (50 karya, 30 blok per karya, 12 gambar per blok, 4 metrik per blok) dengan pesan jelas. Batas paket dan kuota menyusul Phase 07.

### Aturan yang wajib dijaga

- File asli tidak pernah diunggah; server tetap memeriksa jenis, ukuran, dan dimensi.
- Portfolio hanya boleh merujuk file milik pemiliknya sendiri yang tercatat di `portfolio_file` (cek di server saat `update`).
- Metrik unggulan harus menunjuk metrik yang ada di blok Metrik karya itu; bila metriknya dihapus, kartu kembali tanpa chip.
- Nilai metrik selalu tertulis di HTML; warna bukan satu-satunya penanda arah perubahan.

### Tes dan verifikasi

- Server: jenis salah, file terlalu besar, dimensi terlalu besar, kunci milik akun lain, rujukan file akun lain di `update` → semua ditolak; hapus menghapus file; job yatim idempoten; validasi blok dan metrik (batas, blok tak dikenal dibuang).
- Unit: `formatMetric`, slug unik, urutan blok, kerangka studi kasus, pemilihan metrik unggulan.
- Browser pane lokal: unggah JPG besar (foto fiktif), PNG transparan untuk logo, file palsu berekstensi `.jpg`, banyak gambar sekaligus; buat karya berblok dengan metrik; cek ukuran tersimpan; screenshot karya, detail, galeri, dan metrik di 390 dan 1440 px, terang dan gelap.

### Selesai bila

- Karya berblok dengan galeri dan widget metrik tampil bagus di tema pertama di HP dan desktop.
- Semua kolom gambar portfolio bekerja dan file yatim dibersihkan.
