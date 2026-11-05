# Phase 06 — Tema lengkap, efek intro, galeri tema, cek visual

| Dikerjakan               | Ukuran | Bergantung pada | Perlu dari pemilik          |
| ------------------------ | ------ | --------------- | --------------------------- |
| Claude + pemilik menilai | Besar  | Phase 05, 00    | Waktu menilai lembar contoh |

## Untuk pemilik

**Apa yang dibuat:** tiga tema lain yang kamu pilih di Phase 00, **efek intro** yang kamu pilih (misalnya kilau, ketik berganti, huruf acak, garis vektor) beserta pemilihnya di editor, galeri tema dengan gambar contoh (Inggris dan Indonesia), dan pemeriksaan visual besar: setiap tema di HP dan desktop, terang dan gelap, isi sedikit dan banyak, serta bahasa Arab. Kamu menilai hasil akhirnya dari gambar.

**Siapkan:** waktu menilai lembar contoh di akhir sesi.

**Prompt:** `Kerjakan Phase 06 dari .agents/docs/plans/portfolio/README.md`

**Yang bisa kamu cek di akhir:** lembar contoh per tema (Artifact privat atau gambar).

## Untuk agent

### Langkah

1. **Tiga tema** sesuai `01-desain.md` bagian 5 dan mockup di `mockups/`, lengkap dengan semua jenis blok karya, varian widget metrik yang dipilih di Phase 00, Layanan, Testimoni, dan Klien. Pakai primitif bersama; bila primitif perlu diperluas, pastikan tema pertama tidak berubah (bandingkan render sebelum/sesudah).
2. **Gambar galeri tema**: `tooling/portfolio/previews.ts` (skrip `portfolio:previews`) merender persona → screenshot Chrome sistem 2× → `apps/web/public/portfolio-themes/{jpg,thumb}/<tema>.{jpg,webp}` dan versi Indonesia di `id/`.
3. **Efek intro** (`02-teknis.md` bagian 23, `01-desain.md` bagian 18): modul efek yang dipilih di Phase 00 (aturan turunan #13), dibuat dari nol (jangan menyalin kode React Bits), CSS dulu lalu skrip kecil bila perlu; halaman hanya memuat efek yang dipakai; `prefers-reduced-motion`, berhenti ≤5 detik, teks asli di HTML, tanpa CLS; fallback HP untuk Garis vektor; pemilih di tab Desain → Intro dengan demo mini + "Putar ulang" di pratinjau; efek bawaan per tema. Latar intro (polos, gradien lembut, pola, gambar dengan lapisan kontras) di semua tema.
4. **Galeri tema** di dialog buat dan tab Desain: gambar, nama, deskripsi (Lingui), untuk siapa; label Plus disiapkan untuk Phase 07.
5. **Matriks visual**: `tooling/portfolio/matrix.ts` (skrip `portfolio:matrix`): 4 tema × 3 persona × terang/gelap × 390/1440 px × varian A (isi lengkap: semua jenis blok, metrik dengan perubahan dan grafik mini, layanan, testimoni, klien dengan dan tanpa logo), B (minimal: tanpa foto, tanpa gambar karya, satu blok Teks), C (sangat banyak, nama sangat panjang, judul karya panjang), D (RTL `ar-SA`). Tambahkan rekaman singkat atau beberapa bingkai untuk setiap efek intro (awal, tengah, akhir) dan versi "kurangi gerakan". Buat lembar kontak per tema. Lihat semuanya dengan mata, perbaiki, ulangi. Catat temuan yang belum diperbaiki di laporan.
6. **Kontras dan kinerja**: cek otomatis aksen ekstrem (kuning terang, hampir hitam) di terang dan gelap; Lighthouse atau skill `web-perf` per tema.
7. **Penilaian pemilik**: tunjukkan lembar kontak; terapkan revisi yang diminta; catat persetujuan di log `00-keputusan.md`.

### Aturan yang wajib dijaga

- Setiap tema memenuhi daftar wajib di `01-desain.md` bagian 5 (semua bagian, semua jenis blok, varian metrik, terang/gelap, semua aksen, semua pasangan font tema itu, isi ekstrem, RTL, 360–1920 px tanpa geser horizontal).
- Teks gambar galeri memakai persona fiktif saja.

### Tes dan verifikasi

- Tes struktur render untuk setiap tema × varian × mode.
- Efek intro: teks asli ada di HTML sebelum skrip jalan, lapisan animasi `aria-hidden`, mode kurangi gerakan statis, animasi berhenti ≤5 detik, ukuran skrip efek ≤3 KB, CLS 0.
- Matriks visual dan Lighthouse seperti di atas; jumlah gambar yang dicek disebut di laporan.

### Selesai bila

- Empat tema lolos matriks visual dan pemilik menyetujui tampilannya.
- Galeri tema memakai gambar baru (Inggris dan Indonesia).
