# Phase 05 — Lowongan tutup dan kecocokan

| Dikerjakan | Ukuran | Bergantung pada | Perlu dari pemilik |
| ---------- | ------ | --------------- | ------------------ |
| Claude     | Sedang | Phase 04        | Jawaban K8         |

## Untuk pemilik

**Apa yang dibuat:**

- Setiap malam server menandai lowongan yang sudah ditutup perusahaan, menyembunyikannya dari hasil, dan memberi tahu pengguna bila lowongan yang mereka lacak sudah tutup. Data lama dibersihkan otomatis (aturan penyedia).
- Kartu lowongan menampilkan **chip kecocokan** dengan Profil (gratis, tanpa AI), dan tombol **Analisis kecocokan** dengan AI di panel detail (memakai kredit AI).

**Prompt:** `Kerjakan Phase 05 dari .agents/docs/plans/lowongan/README.md`

**Yang bisa kamu cek di akhir:** screenshot kartu dengan chip kecocokan, panel analisis AI, dan tanda "Lowongan sudah ditutup" di lamaran.

## Untuk agent

### Langkah

1. Konfirmasi K8 dan catat.
2. **Pemeliharaan harian** sesuai `02-teknis.md` bagian 10, dijalankan lewat Cron + Queue yang ada, sekali per hari (penanda jalan). Catat temuan soal pengecekan status JobsPipe di bagian 10.
3. **Notice lowongan tutup** di workspace lamaran yang dilacak dari `job_listing` (sekali per lamaran), lewat `notices.ts`.
4. **Chip kecocokan gratis:** `matchOpportunity` (`career/matching.ts`) terhadap frasa preferensi Profil; tampil "Cocok: n dari m" + daftar frasa di detail. Hitung di server saat menyusun kartu (murah) atau di klien bila frasa sudah ada di konteks; pilih dan catat.
5. **Analisis AI:** pakai alur kecocokan yang ada (panduan `checking-job-fit`) dengan teks lowongan sebagai `dataBlock`; kredit sesuai tabel biaya AI yang ada; hasil disimpan per pengguna + lowongan supaya tidak dibayar dua kali.
6. Panduan `checking-job-fit` dan `career-workspace-reference` diperbarui.

### Tes dan verifikasi

- Integrasi: feed expired (fixture) → `closedAt` terisi → hilang dari hasil dan cache; lamaran terkait dapat notice sekali.
- Pembersihan: cache kedaluwarsa dan lowongan yatim terhapus; yang dirujuk peluang aktif tetap.
- Unit chip kecocokan (bahasa Indonesia dan Inggris), analisis AI memakai kredit sekali.

### Selesai bila

- Lowongan tutup tidak tampil lagi dalam ±1 hari, pengguna diberi tahu, data lama terhapus sesuai K3.
- Chip kecocokan dan analisis AI berjalan.
