# Phase 08 — Surat lamaran, cek ATS, bagikan dan ekspor

| Dikerjakan | Ukuran | Bergantung pada | Perlu dari pemilik |
| ---------- | ------ | --------------- | ------------------ |
| Claude     | Sedang | Phase 07        | —                  |

## Untuk pemilik

**Apa yang dibuat:** pembuat surat lamaran, pemeriksa ATS (unggah CV untuk dicek), serta layar Bagikan dan Ekspor, semuanya dengan tampilan baru. Surat mendapat pilihan pengirim: Profil, sebuah CV, atau isi sendiri.

**Prompt:** `Kerjakan Phase 08 dari .agents/docs/plans/mobile/README.md`

**Yang bisa kamu cek di akhir:** menulis surat dengan bantuan AI, mengekspor PDF dan membagikannya lewat lembar bagikan ponsel, dan membagikan tautan CV publik.

## Untuk agent

### Langkah

1. **Surat (`src/features/letters`):** Write, Design (preset dari paket; hapus `letters/design-presets.ts`), draf AI (`coverLetters.draft`), versi, panjang surat, **From** (`coverLetters.update` dengan `basics`: Profile / CV / sendiri). Memakai kerangka editor Phase 07.
2. **Bagikan (`src/features/share`):** tautan publik, kata sandi tautan, statistik tautan CV (`resume.statistics.*`), halaman web CV, **domain kustom dengan tahap** (`customDomain.get` → `stage`, `problem`, `plan`), teks "Short link"/"Primary resume" disesuaikan dengan keadaan portofolio.
3. **Ekspor:** PDF (Forme native), DOCX dan format lain lewat server seperti sekarang, cetak (`expo-print`), simpan ke Files/Downloads, lembar bagikan sistem. Periksa berkas hasil benar-benar terbuka di app lain.
4. **Cek ATS (`src/features/ats-checker`):** unggah PDF/DOCX, hasil per kategori, halaman asli (modul `pdf-pages`).
5. **Tampilan publik CV di app** (`app/r/[username]/[slug]`): tetap ada, dengan laporan dan blokir yang sudah ada.
6. Hapus layar lama yang sudah diganti.

### Tes dan verifikasi

- Tes komponen: pilihan From, tahap domain, keadaan ekspor (berjalan, gagal, tanpa jaringan).
- Maestro di dua platform: `export` (PDF tersimpan dan bisa dibuka), tulis surat → ekspor, bagikan tautan.
- Daftar cek dua platform; izin penyimpanan Android pada API 24–28.

### Selesai bila

- Surat, ATS, Bagikan, Ekspor setara web di dua platform.
- Butir terkait surat dan domain di "Feature parity exceptions" dihapus.

## Kemajuan

- **2026-11-21, sesi 1:** langkah 1–6 selesai di atas `src/ui`, kecuali kerangka editor surat (bar mode, judul, status simpan), yang ikut Phase 07 langkah 8 karena Phase 07 baru selesai bagian 1. Hasil teknis: `02-teknis.md` 20. Sisa: Maestro dan cek Android (ditunda pemilik), domain kustom dilihat di simulator dengan server yang menyalakan fiturnya.
