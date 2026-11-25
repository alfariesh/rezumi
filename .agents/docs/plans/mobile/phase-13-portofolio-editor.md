# Phase 13 — Portofolio II: editor dan AI

| Dikerjakan              | Ukuran                 | Bergantung pada | Perlu dari pemilik |
| ----------------------- | ---------------------- | --------------- | ------------------ |
| Claude + review pemilik | Besar (2–3 sesi wajar) | Phase 11, 12    | —                  |

## Untuk pemilik

**Apa yang dibuat:** mengedit portofolio dari ponsel: isi halaman (intro, tentang, pencapaian, testimoni, klien), **karya** dengan blok (teks, gambar, metrik, video, tautan, embed, PDF), tema dan efek intro, dan asisten AI portofolio yang bisa langsung mengubah isi dengan tombol urungkan.

**Prompt:** `Kerjakan Phase 13 dari .agents/docs/plans/mobile/README.md`

**Yang bisa kamu cek di akhir:** menambah satu karya dengan foto dari kamera, mengganti tema, dan meminta AI merapikan teks, lalu melihat hasilnya di pratinjau, di iPhone dan Android.

## Untuk agent

Urutan disarankan: (a) logika editor ke paket, (b) Content, (c) Work, (d) Design, (e) AI.

### Langkah

1. **Pindahkan logika** ke `@rezumi/portfolio` (`02-teknis.md` bagian 5): store editor (autosave `portfolio.update` dengan `expectedUpdatedAt`, konflik, undo), `works/works.ts`, `blocks/blocks.ts`, penerapan AI (`ai/apply.ts`, `assistant/apply.ts`); web memakai dari paket tanpa perubahan perilaku (tes web dan Playwright portofolio hijau).
2. **Kerangka editor:** segmen Content · Work · Design · Publish (Publish = layar Phase 12), tombol Preview, status simpan, undo/redo, penjaga keluar; tablet: isian dan pratinjau berdampingan.
3. **Content:** intro (nama, peran, Open to work dengan peran dan jenis kerja, tombol kontak), tentang, angka pencapaian, testimoni (foto), logo klien, urutan dan tampil/sembunyi bagian. Kartu Lokasi: tampil baca-saja + "Atur di web" (K7).
4. **Gambar:** kamera/galeri (`expo-image-picker`) → kecilkan dan encode ulang di perangkat (`expo-image-manipulator`, batas ukuran sama dengan `images/compress.ts` web) → `portfolio.uploadImage`; titik fokus sampul dengan ketuk.
5. **Work:** daftar karya (urut dengan seret + menu), tambah karya (kosong, dari proyek CV `portfolio.importWorks`, dari banyak gambar, tempel tautan `portfolio.unfurl`), kartu karya (sampul, metrik unggulan, alamat `slug`), editor blok: Text, Pictures, Metrics, Video (YouTube/Vimeo; thumbnail `fetchRemoteImage` + `uploadImage`), Link, Embed (`@rezumi/schema/portfolio/embed`), PDF (pilih file → hitung halaman dan gambar halaman 1 dengan `modules/pdf-pages` → `uploadImage` + `uploadPdf`). Menu tambah blok sebagai lembar. Kerangka studi kasus.
6. **Design:** galeri tema bergambar (8 tema; gambar dari server, Inggris dan Indonesia), latar intro, pemilih efek intro dengan gambar diam, "Replay intro" di pratinjau.
7. **AI:** menu AI pada isian teks panjang (`portfolio.ai.rewrite`), "Find numbers" (`portfolio.ai.findMetrics`), draf (`portfolio.ai.draft`), dan **asisten portofolio** dengan komponen percakapan Phase 11 (`portfolio.aiView`, `applyEdits`, `addImage`, thread `agent.*`): perubahan langsung diterapkan dengan Undo; fokus pada karya yang sedang dibuka; biaya kredit ditampilkan.
8. Persetujuan AI per operasi berlaku untuk semua panggilan AI portofolio.
9. **Dari web (PR #115):** segmen Publish menampilkan Page check (`@rezumi/portfolio/checkup`; tiap baris membuka tempat yang perlu diperbaiki, tidak menghalangi terbit). Daftar karya punya Duplicate (pindahkan `duplicateWork` ke paket bersama `works.ts`; salinan mulai tersembunyi).
10. **Dari web (unggahan di latar belakang):** unggahan dan pembacaan tautan untuk satu tempat di portofolio (gambar blok, sampul, PDF, gambar video/embed/tautan) berjalan sebagai tugas latar per tempat (web: `apps/web/src/features/portfolio/editor/tasks.ts`). Pindah karya atau segmen tidak menghentikannya; hasilnya masuk lewat id, tempat itu menampilkan progresnya lagi saat dibuka, galat untuk tempat yang tak terlihat jadi toast, bar menampilkan "Uploading…", dan keluar editor bertanya dulu. App meniru perilaku ini (store tugas di luar layar, dibatalkan saat editor menutup portofolio).

### Tes dan verifikasi

- Tes logika editor di paket (autosave, konflik, undo, penerapan edit AI); tes web tetap hijau.
- Tes komponen: editor blok tiap jenis, tambah karya tiap cara, unggah gagal/terlalu besar.
- Maestro di dua platform: tambah karya dengan gambar → blok teks + metrik → pratinjau → terbit; ganti tema; AI rewrite → undo.
- Bandingkan hasil dengan web: portofolio yang diedit di app terbuka dan tersimpan benar di editor web, dan sebaliknya.
- Daftar cek dua platform; izin kamera/foto ditolak tidak mematikan fitur lain.

### Selesai bila

- Semua yang di K7 bisa dikerjakan dari app di dua platform.
- Logika editor portofolio satu sumber untuk web dan app.
- Butir "Portfolio" di "Feature parity exceptions" tinggal tiga pengecualian K7.
