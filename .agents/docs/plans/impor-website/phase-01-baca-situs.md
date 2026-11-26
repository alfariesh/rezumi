# Phase 01 — Membaca situs: halaman karya, AI, kredit

| Dikerjakan | Ukuran | Bergantung pada | Perlu dari pemilik |
| ---------- | ------ | --------------- | ------------------ |
| Claude     | Besar  | —               | —                  |

## Untuk pemilik

**Apa yang dibuat:** mesin di belakang layar. Server bisa membaca situs pribadi sampai 11 halaman, menemukan halaman karya, lalu AI mengubahnya menjadi draf Profil dan draf karya (judul, ringkasan, peran, tahun, angka, link, pilihan gambar). Impor pertama gratis, berikutnya 5 kredit. Belum ada yang terlihat oleh pengguna.

**Prompt:** `Kerjakan Phase 01 dari .agents/docs/plans/impor-website/README.md`

**Yang bisa kamu cek di akhir:** laporan Claude berisi contoh hasil dari beberapa situs uji (berapa karya ditemukan, berapa detik, perkiraan biaya AI per impor).

## Untuk agent

### Langkah

1. Baca `02-teknis.md` bagian 1–5, 7, 8, 10.
2. **Pembaca:** `readPageDocument` di `features/web` (bagian 3): teks + link + gambar + embed + sitemap, memakai jalur keamanan `readPage`. Opsi untuk tidak menghitung ke `BROWSER_READS_PER_DAY` saat dipanggil dari impor.
3. **Skema:** `WorkDraft`, hasil run, event progres (Zod, ekspor eksplisit di `package.json` paket schema).
4. **AI:** AI #1 dan AI #2 (bagian 4), batas token aksi baru di `metered-ai.ts`, validasi URL dari AI.
5. **Kredit:** aksi `profile-website-import: 5`, opsi biaya nol di `runWithAiSource`, aturan gratis pertama (bagian 5).
6. **Tabel** `website_import` (bagian 7), `pnpm db:generate`, baca SQL, migrasi lokal. Pengosongan `result` setelah 24 jam di pemeliharaan harian yang ada.
7. **Prosedur** `profile.sources.websiteImport` (streaming, tag Internal, non-tamu, `own: true` wajib) dan `profile.sources.websiteImportResult({ runId })`. Batas 3/hari di `limits.ts`. Prosedur lama tidak berubah.
8. **Ukur:** jalankan dengan skrip dev di `tooling/` (mis. `pnpm --filter @rezumi/tooling website:probe <url>`) terhadap 3–5 situs portfolio publik. Catat waktu total, waktu per halaman, pemakaian Browser Run, token AI, CPU. Tulis hasil di akhir `02-teknis.md` (bagian baru "Pengukuran Phase 01"). Bila p95 > 120 detik atau CPU mendekati 30 detik: berhenti dan tanyakan pemilik (bagian 2).

### Tes dan verifikasi

- Semua kasus di `02-teknis.md` bagian 10 yang menyangkut membaca, AI, kredit, batas harian.
- `pnpm --filter @rezumi/api test src/features/profile/sources`, `src/features/web`, typecheck paket yang berubah, `pnpm exec turbo boundaries`, `pnpm check:cloudflare`.

### Selesai bila

- Satu panggilan streaming mengembalikan draf Profil + draf works yang valid dari fixtures dan dari situs nyata.
- Gratis pertama, potongan 5 kredit, pengembalian kredit, dan batas harian teruji.
- Pengukuran tercatat.
