# Phase 05 — Media karya dan lokasi: video, PDF, tempel tautan, peta

| Dikerjakan | Ukuran | Bergantung pada | Perlu dari pemilik         |
| ---------- | ------ | --------------- | -------------------------- |
| Claude     | Besar  | Phase 04        | Jawaban aturan turunan #15 |

## Untuk pemilik

**Apa yang dibuat:** tiga jenis blok karya tambahan, ditambah peta lokasi:

- **Video**: tempel tautan YouTube atau Vimeo. Di halaman tampil gambar mini dengan tombol putar; pemutarnya baru dimuat setelah diklik, jadi halaman tetap cepat dan pengunjung tidak dilacak sebelum memutar.
- **PDF**: unggah PDF (maks. 10 MB) seperti portfolio desain, laporan, atau tulisan. Di halaman tampil gambar halaman pertama, judul, jumlah halaman, dan tombol "Buka PDF".
- **Tautan otomatis**: tempel tautan Behance, Dribbble, GitHub, Figma, Medium, atau situs lain → judul, deskripsi, dan gambar terisi sendiri. Satu tautan juga bisa langsung menjadi karya baru.
- **Peta lokasi**: di editor kamu memilih kota pada peta interaktif HeroUI, mengatur presisi (kota/provinsi/negara), dan mengisi preferensi kerja (Remote/Hybrid/On-site, bersedia relokasi). Di halaman publik tampil kartu Lokasi berisi gambar peta (tanpa memuat peta interaktif, jadi tetap cepat dan privat).

**Siapkan:** jawab satu pertanyaan tentang aturan peta (aturan turunan #15).

**Prompt:** `Kerjakan Phase 05 dari .agents/docs/plans/portfolio/README.md`

**Yang bisa kamu cek di akhir:** screenshot karya dengan video, PDF, dan kartu tautan di HP dan desktop; video yang baru dimuat setelah diklik; kartu Lokasi dengan peta di mode terang dan gelap.

## Untuk agent

### Langkah

1. **Video** (`02-teknis.md` bagian 18):
   - parser tautan murni + tes (semua bentuk URL yang didukung, ID tidak sah, domain lain ditolak);
   - gambar mini YouTube dari pola URL, Vimeo lewat oEmbed saat menempel (fetch aman dari langkah 3);
   - `VideoFacade` di `packages/portfolio` + penanganan klik di skrip halaman; tanpa JavaScript menjadi tautan;
   - CSP halaman portfolio: `frame-src` untuk `https://www.youtube-nocookie.com` dan `https://player.vimeo.com` saja;
   - UI blok Video di editor (tempel tautan, judul opsional, pratinjau gambar mini).
2. **PDF** (`02-teknis.md` bagian 19):
   - browser: cek `%PDF-`, ≤10 MB, gambar halaman pertama dan jumlah halaman dengan PDF.js (pakai ulang pemuat PDF.js yang ada di web; perbarui baris kepemilikan PDF.js di `CLAUDE.md` bila menambah pemakai), tolak PDF berpassword;
   - server: `portfolio.uploadPdf`, simpan di `uploads/<userId>/documents/portfolio/`, catat di `portfolio_file`;
   - perluas `apps/server/src/static/uploads.ts` untuk melayani PDF portfolio publik dengan header terkunci (`Content-Disposition: inline`, `nosniff`, `Content-Security-Policy: sandbox`, cache 1 jam, ETag), pemilik dilarang → 404, dan lolos di domain sendiri;
   - `PdfCard` di `packages/portfolio`; UI blok PDF di editor (unggah, judul, ganti file).
3. **Tautan otomatis** (`02-teknis.md` bagian 20):
   - `portfolio.unfurl` dengan fetch aman (`fetchPublic`), batas waktu/ukuran/pengalihan, parsing meta tanpa DOM, oEmbed YouTube/Vimeo (menghasilkan blok Video), `brandIcon` untuk domain dikenal, cache 24 jam, batas laju per akun;
   - `portfolio.importRemoteImage` untuk menyalin gambar yang disetujui pengguna ke penyimpanannya;
   - `LinkCard` di `packages/portfolio`; UI blok Tautan (tempel → hasil bisa diubah → setujui gambar);
   - isi pilihan "Tempel tautan" di dialog "Tambah karya" (Phase 04 menyiapkan tempatnya): hasil unfurl mengisi kartu dan satu blok Tautan atau Video.
4. **Lokasi dan peta** (`02-teknis.md` bagian 24, `01-desain.md` bagian 19; konfirmasi aturan turunan #15 dulu):
   - form Lokasi di tab Isi → Kontak: label kota, presisi, peta tampil/tidak, mode kerja, bersedia relokasi, jam lokal;
   - peta editor memakai `Map` HeroUI Pro (ambil dokumentasi lewat MCP `heroui-pro`, komponen `map`), gaya OpenFreeMap terang/gelap, worker MapLibre dari aset sendiri, dimuat lazy; penanda bisa digeser dengan peringatan alamat rumah;
   - pencarian kota dari daftar GeoNames yang dibundel (lazy, dengan atribusi CC BY 4.0), nilai awal dari lokasi CV;
   - potret peta terang dan gelap saat menyimpan → unggah lewat jalur gambar → `location.map`;
   - render kartu Lokasi dan chip lokasi di tema pertama (gambar peta, penanda aksen dari CSS, atribusi OpenStreetMap, tautan "Buka di peta").
5. **Render tema pertama**: rapikan tampilan ketiga blok di kartu dan detail karya, terang dan gelap, HP dan desktop.
6. **Statistik**: siapkan atribut data untuk klik putar video dan buka PDF agar Phase 08 tinggal menghitungnya.

### Aturan yang wajib dijaga

- Halaman publik tidak pernah memuat iframe video sebelum diklik, dan tidak pernah menautkan gambar langsung dari situs lain.
- Halaman publik tidak pernah memuat peta interaktif atau meminta ubin peta; lokasi tingkat kota sebagai bawaan; tidak ada "gunakan lokasi saya".
- Fetch tautan tidak pernah menjangkau alamat privat atau loopback, juga lewat pengalihan; tidak mengirim cookie atau data pengguna.
- PDF tidak pernah dilayani sebagai HTML atau tipe lain; header terkunci diuji.
- File PDF dan gambar hasil tempel tautan dihitung ke kuota (Phase 07 menetapkan angkanya).

### Tes dan verifikasi

- Unit: parser video; parser meta dari berkas HTML contoh (tanpa jaringan); pemetaan `brandIcon`.
- Server: unfurl ke server palsu lokal (alamat privat ditolak, pengalihan ke alamat privat ditolak, HTML terlalu besar dipotong, waktu habis, bukan HTML); `importRemoteImage` (bukan gambar, terlalu besar); `uploadPdf` (bukan PDF, terlalu besar, milik akun lain); header respons PDF publik; CSP `frame-src` hanya di halaman portfolio.
- Browser pane lokal: blok Video (YouTube dan Vimeo), PDF contoh fiktif 2–3 halaman, tempel tautan GitHub dan Behance (bila situs menolak, pastikan pesan "isi manual" muncul); cek di tab Network bahwa pemutar video belum dimuat sebelum klik; screenshot 390 dan 1440 px.
- Lokasi: pencarian kota (nama ganda seperti "Bandung" di beberapa negara), presisi mengubah zoom, potret peta terang/gelap tersimpan dan terhapus saat peta dimatikan, atribusi tampil, halaman publik tanpa permintaan ke `tiles.openfreemap.org` (cek tab Network).
- Lighthouse halaman contoh dengan video dan PDF: LCP dan ukuran JS tetap dalam target.

### Selesai bila

- Ketiga jenis blok dan kartu Lokasi bisa diisi di editor dan tampil benar di tema pertama.
- Tinjauan keamanan singkat (PDF publik, fetch tautan) tertulis di laporan untuk dicek ulang di Phase 11.
