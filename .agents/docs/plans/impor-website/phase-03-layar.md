# Phase 03 — Layar: onboarding, Isi Profil, editor portfolio

| Dikerjakan              | Ukuran | Bergantung pada | Perlu dari pemilik                          |
| ----------------------- | ------ | --------------- | ------------------------------------------- |
| Claude + review pemilik | Besar  | Phase 02        | Melihat screenshot; menyetujui teks privasi |

## Untuk pemilik

**Apa yang dibuat:** yang dilihat pengguna. Centang "Ini situs saya sendiri" di kolom Website, progres "Membaca karya 3 dari 8…", bagian review "Karya dari situsmu" dengan semua karya sudah dicentang, dan tombol "Impor dari website" di editor portfolio. Teks kebijakan privasi diperbarui.

**Prompt:** `Kerjakan Phase 03 dari .agents/docs/plans/impor-website/README.md`

**Yang bisa kamu cek di akhir:** screenshot desktop dan ponsel, terang dan gelap, Inggris dan Indonesia. Usulan teks privasi untuk kamu setujui sebelum di-commit.

## Untuk agent

### Langkah

1. Baca `01-desain.md` seluruhnya dan `02-teknis.md` bagian 2, 6, 8, 9.
2. **Input:** `SourceInputs` di `packages/resume/src/profile-sources.ts` dapat `websiteOwn: boolean`; `source-fields.tsx` menampilkan centang, label harga (gratis pertama / 5 kredit; dari server, bukan ditebak di klien), dan pesan untuk Behance/Dribbble/LinkedIn (W6).
3. **Run:** `use-source-runs.ts` memanggil `websiteImport` (streaming) bila `websiteOwn`, prosedur lama bila tidak. Progres per tahap di `source-progress.tsx`. Simpan `runId` di state onboarding supaya reload bisa memakai `websiteImportResult`.
4. **Review:** bagian "Karya dari situsmu" di `source-review.tsx` (kartu, centang, batas kuota Gratis dengan ajakan upgrade, catatan halaman gagal / lebih dari 10).
5. **Simpan:** setelah Profil tersimpan, panggil `importSiteWorks` dengan progres salin gambar dan catatan hasil. Layar akhir onboarding: tautan "Lihat portfoliomu (belum tayang)".
6. **Isi Profil** (`apps/web/src/features/profile/fill.tsx`) memakai alur yang sama.
7. **Editor portfolio:** tombol "Impor dari website" di keadaan kosong daftar Works dan di menu tambah work → dialog (alamat, centang, harga, progres, review works saja, simpan). Tandai "Sudah ada".
8. **Teks:** Lingui, `pnpm lingui:extract`, terjemahan id-ID lengkap. Warna lewat token.
9. **Privasi:** usulan teks (Indonesia + Inggris) sesuai `02-teknis.md` bagian 8; tunjukkan ke pemilik dulu.
10. **Panduan produk** sesuai tabel "Keep product guides current" di `.agents/docs/contributing/career-platform.mdx` (panduan isi Profil dan portfolio works), dengan screenshot fiktif.
11. Catatan mobile di `.agents/docs/plans/mobile/README.md` (bagian 9).

### Tes dan verifikasi

- Tes web untuk logika input dan review (kuota, centang).
- Satu spec Playwright alur onboarding dengan situs tiruan dan AI stub (pola `tests/e2e`), bila memungkinkan tanpa jaringan.
- Cek dengan mata: semua kombinasi di `01-desain.md` "Cek tampilan" dan setiap keadaan khusus.

### Selesai bila

- Pengguna bisa mengimpor dari onboarding, Isi Profil, dan editor portfolio sampai karya tersimpan.
- Pemilik sudah melihat screenshot dan menyetujui teks privasi.
