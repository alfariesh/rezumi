# Phase 03 — Halaman Cari lowongan

| Dikerjakan              | Ukuran | Bergantung pada | Perlu dari pemilik             |
| ----------------------- | ------ | --------------- | ------------------------------ |
| Claude + review pemilik | Besar  | Phase 02        | Jawaban K5; melihat screenshot |

## Untuk pemilik

**Apa yang dibuat:** halaman baru **Lowongan** (lihat `01-desain.md`): kotak cari yang terisi dari Profil, filter, kartu lowongan dengan tombol Lacak, Sesuaikan CV, dan Lihat posting asli, panel detail, sisa kuota hari ini. Pencarian lama di dialog Tambah lamaran diganti tautan ke halaman ini. **Setelah merge, pengguna melihat fitur ini.**

**Prompt:** `Kerjakan Phase 03 dari .agents/docs/plans/lowongan/README.md`

**Yang bisa kamu cek di akhir:** screenshot halaman (laptop dan ponsel, terang dan gelap, Inggris dan Indonesia) di laporan; kamu juga bisa mencobanya di server lokal yang dijalankan Claude.

## Untuk agent

### Langkah

1. Konfirmasi K5 (letak menu) dan catat. Baca memori/aturan navigasi yang ada (urutan sidebar) sebelum menambah menu.
2. **Route** `apps/web/src/routes/dashboard/jobs.tsx` (file-based; jangan edit `routeTree.gen.ts`), fitur di `apps/web/src/features/jobs/`. Pakai komponen HeroUI (MCP `heroui-pro`) dan pola halaman dashboard yang ada.
3. **Pencarian:** isi awal dari Profil (`careerService.profile`: posisi, lokasi, `searchRegions`), negara bisa diganti, filter sesuai `01-desain.md` 1 dan K11 (gaji dengan "sertakan tanpa gaji", sponsor visa, remote di mana saja / di negara ini), status kuota dari `jobs.quota`, "Muat lebih banyak" dengan `cursor`.
4. **Kartu dan detail:** sesuai `01-desain.md`. Link posting asli selalu ada, buka di tab baru dengan `rel="noopener noreferrer"`. Teks penyedia dirender sebagai teks, bukan HTML. Label "lewat <sumber>".
5. **`jobs.track`:** membuat lamaran lewat layanan Applications yang ada (posisi, perusahaan, lokasi, deskripsi, link, sumber), mengembalikan id; kartu jadi "Dilacak ✓". **Sesuaikan CV** membuka alur tailor yang ada setelah melacak.
6. **Keadaan khusus** `01-desain.md` 2, termasuk kuota habis (pesan netral + tautan paket khusus web) dan anggaran server.
7. **Dialog Tambah lamaran:** hapus pencarian (`searchPostings`) dan ganti tautan "Cari lowongan". Hapus prosedur `applications.ai.searchPostings` dan sesuaikan `packages/mcp/src/parity.ts` serta tes `application-workflows.test.tsx`.
8. **Server/SEO:** halaman di dalam dashboard (perlu login) → tidak perlu fallback SEO; pastikan route ada di daftar SPA yang dilayani.
9. String Lingui + `pnpm lingui:extract`, terjemahan id-ID.
10. Panduan: tambah/ubah panduan di `docs/` (mis. halaman baru "Mencari lowongan" atau perluas `tracking-job-applications`) sesuai tabel career-platform; screenshot fiktif.

### Tes dan verifikasi

- Unit komponen untuk keadaan khusus dan filter (gaji, visa, remote).
- Playwright: cari (penyedia ditiru di server tes), lacak satu lowongan → muncul di Applications, kuota habis → pesan.
- Screenshot untuk pemilik: desktop + 375 px, terang + gelap, en + id.

### Selesai bila

- Pengguna bisa mencari, melihat detail, melacak, dan membuka posting asli tanpa setup apa pun.
- Pencarian lama di dialog hilang; tidak ada tautan ke Settings → Web access untuk pencarian lowongan.
