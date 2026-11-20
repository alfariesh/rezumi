# Phase 09 — Lowongan

| Dikerjakan              | Ukuran | Bergantung pada | Perlu dari pemilik                        |
| ----------------------- | ------ | --------------- | ----------------------------------------- |
| Claude + review pemilik | Sedang | Phase 06        | Saldo treg cukup untuk uji nyata (±$0.10) |

## Untuk pemilik

**Apa yang dibuat:** pencarian lowongan di app, sama dengan web: cari berdasarkan peran, kota, negara; filter; kartu lowongan dengan chip kecocokan; detail dengan **Your fit**, **Track**, **Tailor resume**, **View original**, **Hide**; pencarian terakhir; sisa kuota; simpan sebagai notifikasi lowongan.

**Prompt:** `Kerjakan Phase 09 dari .agents/docs/plans/mobile/README.md`

**Yang bisa kamu cek di akhir:** mencari lowongan di iPhone dan Android, melacak satu, dan melihatnya muncul di Lamaran.

## Untuk agent

### Langkah

1. Baca `.agents/docs/plans/lowongan/README.md`, `01-desain.md`, `02-teknis.md` (aturan data penyedia bagian 13 berlaku juga di app) dan web `apps/web/src/features/jobs`.
2. **Pindahkan logika** ke paket (`02-teknis.md` bagian 5): `toSearchRequest`, `fromCriteria`, `startingSearch`, `sameSearch`, `salaryLabel`, `placeLabel`; web memakai dari paket.
3. **Layar (`src/features/jobs`)** di dalam tab Applications (segmen Jobs): kotak cari terisi dari `jobs.defaults`; filter sebagai lembar (tanggal posting, pengaturan kerja, level, gaji minimum dengan "sertakan tanpa gaji", sponsor visa, remote di mana saja / di negara ini); hasil `jobs.search` dengan "muat lebih banyak" (`cursor`); kartu dengan chip kecocokan (`matches`); lembar detail (`jobs.listing`): Your fit (`jobs.fit`, `jobs.checkFit` — 4 kredit, tampilkan biaya sebelum jalan), Track (`jobs.track`), Tailor resume (alur tailor yang ada setelah melacak), View original (browser sistem), Hide (`jobs.hide`, dengan Undo); pencarian terakhir (`jobs.recent/forgetRecent/clearRecent`); kuota (`jobs.quota`); simpan sebagai notifikasi (`career.saveSchedule` dengan `search`).
4. **Aturan penyedia:** tautan posting asli selalu tampil; teks penyedia dirender sebagai teks; label "via <sumber>"; tidak ada ekspor atau salin massal.
5. **Keadaan khusus:** kuota habis dan anggaran server habis (pesan netral, tanpa ajakan membeli), tanpa hasil, penyedia galat, offline (hasil terakhir).
6. Logo perusahaan: `applications.saveLogo` seperti web; warna latar logo tanpa canvas (pakai warna netral).
7. Tablet: daftar dan detail berdampingan.

### Tes dan verifikasi

- Tes logika di paket (pindahan dari web).
- Tes komponen: filter, keadaan khusus, kartu terlacak.
- Maestro dengan stub treg lokal: cari → buka → lacak → muncul di Lamaran; kuota habis.
- Satu uji nyata dengan izin pemilik (sebutkan perkiraan biaya dulu, laporkan biaya sebenarnya).
- Daftar cek dua platform.

### Selesai bila

- Pengguna bisa mencari, menilai kecocokan, melacak, dan membuka posting asli di dua platform.
- Butir "Jobs" dan "Job fit" (bagian pencarian) di "Feature parity exceptions" dihapus.
