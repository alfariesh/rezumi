# Phase 04 — Lowongan baru otomatis dan notifikasi

| Dikerjakan | Ukuran | Bergantung pada | Perlu dari pemilik |
| ---------- | ------ | --------------- | ------------------ |
| Claude     | Sedang | Phase 02        | —                  |

## Untuk pemilik

**Apa yang dibuat:** tombol **Simpan sebagai notifikasi** di halaman Lowongan. Server lalu mengecek lowongan baru setiap hari (atau minggu) untuk pencarian itu dan memasukkannya ke daftar Peluang di Home, plus email ringkasan bila dipilih. Hanya lowongan baru yang dibayar; cek tanpa hasil gratis. Fitur "temukan lowongan otomatis" lama yang membuka halaman satu per satu diganti.

**Prompt:** `Kerjakan Phase 04 dari .agents/docs/plans/lowongan/README.md`

**Yang bisa kamu cek di akhir:** laporan Claude menunjukkan jadwal yang berjalan di server lokal, lowongan baru yang muncul di Home, dan biaya per jalan.

## Untuk agent

### Langkah

1. Baca `02-teknis.md` bagian 9 dan kode `packages/api/src/features/career/jobs.ts` (`discover`, `execute`, `careerJobs.save`), `scheduling.ts`, `notices.ts`, dan UI `apps/web/src/features/career/schedule-sheet.tsx`, `today.tsx`.
2. **Skema jadwal:** simpan input pencarian lengkap (kolom jsonb baru bila perlu) dan state penyedia (`delta_cursor` JobsPipe, waktu jalan terakhir untuk `ingested_after` Hirebase). Migrasi.
3. **`career_opportunity.listingId`** (FK `job_listing`, `on delete set null`). Peluang menampilkan data dari `job_listing`; kolom teks lama tetap diisi untuk jaga-jaga lowongan terhapus.
4. **Tulis ulang `discover()`** memakai adaptor penyedia (bagian 9): `jobspipe.jobs.new` / `hirebase.jobs.search` dengan `ingested_after`, upsert, buat peluang untuk yang belum terlihat/disembunyikan/dilacak, notice dan email lewat jalur yang ada. Hapus pembacaan halaman satu per satu di discovery.
5. **Hapus** `searchJobPostings`, `postingQueryFor`, dan kode discovery yang tidak terpakai; pertahankan `readOpenPosting`/`fetchJobPosting` (dipakai link tempel dan extension).
6. **UI:** "Simpan sebagai notifikasi" di halaman Lowongan membuka `schedule-sheet` terisi; sheet tidak lagi menyebut Web access/API key; pertimbangkan batas jadwal discovery per paket (catat di `00-keputusan.md` bila ditambah, tanya pemilik).
7. Panduan `finding-roles-automatically` dan screenshot `discovery-schedule.jpg`, `new-roles.png` diperbarui.

### Tes dan verifikasi

- Integrasi (pola `jobs.integration.test.ts` yang ada): jadwal jalan → peluang baru dari fixtures; jalan kedua tanpa lowongan baru → tidak ada peluang ganda, cursor maju; lowongan disembunyikan/dilacak tidak muncul lagi.
- Biaya jadwal masuk anggaran server; anggaran habis → jadwal ditunda, tidak gagal permanen.

### Selesai bila

- Notifikasi lowongan baru bekerja tanpa membuka halaman lowongan satu per satu dan tanpa API key pengguna.
- Kode web search untuk lowongan sudah tidak dipakai di mana pun.
