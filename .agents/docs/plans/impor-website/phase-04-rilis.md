# Phase 04 — Uji nyata dan rilis

| Dikerjakan       | Ukuran | Bergantung pada | Perlu dari pemilik                                          |
| ---------------- | ------ | --------------- | ----------------------------------------------------------- |
| Claude + pemilik | Kecil  | Phase 03        | ±20 menit uji bersama; alamat situs untuk diuji; izin merge |

## Untuk pemilik

**Apa yang dibuat:** uji dengan situs sungguhan, perbaikan yang ditemukan, lalu rilis. **Merge ke `main` = langsung tayang.**

**Prompt:** `Kerjakan Phase 04 dari .agents/docs/plans/impor-website/README.md`

**Yang kamu siapkan:** 2–3 alamat situs portfolio untuk diuji (situsmu sendiri, atau situs teman yang mengizinkan). Kamu akan diminta mencoba onboarding dengan akun uji.

## Untuk agent

### Langkah

1. Uji lokal dengan situs dari pemilik + 3–5 template publik (Framer, Webflow, Notion, Carrd, situs satu halaman). Catat: karya ditemukan vs yang sebenarnya, kualitas ringkasan, gambar yang dipilih, waktu, biaya AI, pemakaian Browser Run. Hapus data uji dari database lokal setelahnya.
2. Perbaiki masalah yang ditemukan (prompt, penemuan halaman, filter gambar). Tulis ringkasan di akhir `02-teknis.md`.
3. Pemeriksaan lengkap: `pnpm lint:agent`, `pnpm format:check`, typecheck dan tes paket yang berubah, `pnpm exec turbo boundaries`, `pnpm check:cloudflare`, `pnpm build`.
4. PR (Conventional Commits, tanpa atribusi AI), tunggu CI, minta izin merge. Migrasi diterapkan oleh workflow deploy.
5. Setelah deploy: satu impor nyata di produksi dengan akun pemilik (impor gratis pertama akun itu), cek `/api/health`, cek ledger kredit menunjukkan 0 untuk impor gratis.

### Selesai bila

- Fitur tayang, satu impor produksi berhasil, laporan biaya per impor diberikan ke pemilik.
