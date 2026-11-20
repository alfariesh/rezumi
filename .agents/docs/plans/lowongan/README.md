# Cari lowongan tanpa setup — mulai di sini

Rencana mengganti pencarian lowongan Rezumi. Sekarang pencarian memakai web search umum (Firecrawl, Tavily, Exa dengan API key milik pengguna, atau SearXNG milik server), hanya memberi 5 link, membuka tiap halaman satu per satu, dan mati bila pengguna belum memasang key. Gantinya: **data lowongan terstruktur dari Hirebase dan JobsPipe lewat treg**, dikelola Rezumi sendiri (pengguna tidak perlu setup apa pun), dengan cache bersama di database supaya cepat dan hemat, kuota per paket, notifikasi lowongan baru, dan penanda lowongan yang sudah tutup. Satu phase dikerjakan dalam satu sesi Claude.

- Keputusan produk dan usulan yang perlu disetujui: [00-keputusan.md](00-keputusan.md)
- Alur dan layar: [01-desain.md](01-desain.md)
- Rancangan teknis (untuk agent), termasuk layanan Cloudflare yang dipakai: [02-teknis.md](02-teknis.md)
- Ide setelah rilis: [backlog-lanjutan.md](backlog-lanjutan.md)

## Cara memakai (untuk pemilik)

1. Kerjakan dulu **Phase 00** (persiapan akun dan keputusan). Bagian ini kamu kerjakan sendiri dengan dipandu Claude.
2. Untuk setiap phase berikutnya, buka **sesi Claude baru** lalu tempel prompt ini (ganti nomornya):

   ```text
   Kerjakan Phase 01 dari .agents/docs/plans/lowongan/README.md
   ```

3. Claude membaca dokumen, mengecek yang perlu kamu siapkan, dan bertanya bila ada keputusan yang kurang. Jawab saja di chat.
4. Di akhir sesi Claude memberi laporan berbahasa awam lalu menawarkan commit dan Pull Request.
5. **Merge ke `main` = langsung tayang di produksi.** Phase 01–02 hanya menambah kode di belakang layar. Pengguna baru melihat perubahan mulai Phase 03. Fitur lama (web search dengan key) baru dihapus di Phase 06.

Prompt lain yang bisa dipakai:

| Kebutuhan                          | Prompt                                                                                       |
| ---------------------------------- | -------------------------------------------------------------------------------------------- |
| Melanjutkan phase yang terpotong   | `Lanjutkan Phase 02 dari .agents/docs/plans/lowongan/README.md`                              |
| Dibantu tugas non-kode (akun, dll) | `Bantu saya mengerjakan Phase 00 dari .agents/docs/plans/lowongan/README.md`                 |
| Biaya treg naik tidak wajar        | `Biaya pencarian lowongan naik. Cek dashboard biaya dan ikuti .agents/docs/plans/lowongan`   |
| Hasil di satu negara kurang bagus  | `Hasil lowongan di <negara> untuk "<kata kunci>" kurang bagus. Selidiki, ikuti 02-teknis.md` |
| Menanyakan posisi rencana          | `Apa status rencana lowongan? Baca .agents/docs/plans/lowongan/README.md`                    |

## Urutan phase dan status

Status: ⬜ belum mulai · 🟡 berjalan/sebagian · ✅ selesai · ⛔ diblokir (lihat catatan) · ⏸️ ditunda (keputusan pemilik).

| Phase | Judul                                                                        | Dikerjakan               | Perlu dari pemilik sebelum mulai                                                                | Bergantung pada | Status |
| ----- | ---------------------------------------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------- | --------------- | ------ |
| 00    | [Persiapan pemilik: akun, rahasia, keputusan](phase-00-persiapan-pemilik.md) | Pemilik + Claude memandu | ±30 menit; top-up treg dan spend cap, rahasia produksi, email JobsPipe (K1–K11 sudah disetujui) | —               | ✅     |
| 01    | [Fondasi: klien treg, data lowongan, tabel](phase-01-fondasi.md)             | Claude                   | `TREG_API_KEY` di `.env.local` (sudah ada)                                                      | 00              | ✅     |
| 02    | [Pencarian: cache, kuota, pilihan penyedia](phase-02-pencarian.md)           | Claude                   | Jawaban K2, K3, K7                                                                              | 01              | ✅     |
| 03    | [Halaman Cari lowongan](phase-03-halaman-cari.md)                            | Claude + review pemilik  | Jawaban K5; melihat screenshot                                                                  | 02              | ✅     |
| 04    | [Lowongan baru otomatis dan notifikasi](phase-04-lowongan-baru.md)           | Claude                   | —                                                                                               | 02              | ⬜     |
| 05    | [Lowongan tutup dan kecocokan](phase-05-tutup-kecocokan.md)                  | Claude                   | Jawaban K8                                                                                      | 04              | ⬜     |
| 06    | [Tanpa API key: baca link dan web search asisten](phase-06-tanpa-api-key.md) | Claude                   | Token Cloudflare Browser Run (dari Phase 00); jawaban K4                                        | 03, 04          | ⬜     |
| 07    | [MCP, dashboard biaya, panduan, rilis](phase-07-rilis.md)                    | Claude + pemilik         | ±30 menit uji bersama; izin deploy                                                              | Semua           | ⬜     |

Phase 03 dan 04 boleh dikerjakan dalam urutan apa pun setelah Phase 02, tetapi **satu per satu** di checkout yang sama. Phase 06 menunggu 03 dan 04 karena menghapus kode web search yang masih dipakai keduanya sampai saat itu.

## Aturan wajib untuk setiap sesi agent

Bagian ini untuk Claude. Pemilik tidak perlu menghafalnya.

1. **Baca dulu:** `CLAUDE.md` di root repo, README ini, `00-keputusan.md`, `01-desain.md`, `02-teknis.md`, lalu dokumen phase. Refresh graph (`index_repository`) di awal sesi; cari titik kode dengan graph + grep. Path di dokumen ini dari eksplorasi 2026-11-20: cek ulang sebelum mengandalkannya.
2. **Parameter dan harga penyedia dibaca dari katalog treg, bukan dari ingatan.** `GET https://treg.to/catalog/endpoints/<tool-id>` gratis dan tanpa token; pakai untuk skema input, contoh respons, dan harga terbaru. Endpoint `*.count` gratis untuk mengukur tanpa biaya.
3. **Biaya nyata hanya seizin pemilik.** Panggilan berbayar ke treg di sesi agent (selain endpoint gratis) dibatasi: sebutkan perkiraan totalnya dulu, pakai header `X-Treg-Route-Max-Cost`, dan laporkan biaya sebenarnya (`X-Treg-Cost-Micro`). Tes otomatis memakai fixtures, tidak pernah memanggil treg.
4. **Cek prasyarat.** Bila ada yang belum disiapkan pemilik (kolom tabel dan bagian "Untuk pemilik" di phase), berhenti dan sebutkan persis apa yang dibutuhkan serta cara menyiapkannya, langkah demi langkah. Jangan menebak ID, kunci, atau keputusan bisnis.
5. **Keputusan bisnis tidak diubah diam-diam.** Bila sebuah keputusan di `00-keputusan.md` tidak bisa atau tidak sebaiknya dipakai, jelaskan pilihannya dan tanya pemilik. Catat jawaban di log keputusan.
6. **Git:** `git status --short` sebelum mengedit; stage hanya path milik sesi ini. Buat branch `feat/jobs-NN-<slug>` dari `main` terbaru. Conventional Commits. Jangan merge ke `main` tanpa persetujuan pemilik.
7. **Rahasia:** jangan pernah menulis `TREG_API_KEY`, token Cloudflare, atau kunci lain di kode, dokumen, tes, log, atau chat. Baca dari environment. Saat menguji, jangan mencetak nilainya.
8. **Aturan data penyedia (`02-teknis.md` bagian 13) tidak ditawar:** link ke posting asli selalu tampil; tidak ada ekspor massal, halaman SEO publik berisi lowongan, atau API yang membagikan data mentah; kontak perekrut tidak disimpan; data setiap penyedia bisa dihapus per penyedia.
9. **Web dulu; app mobile belum dikerjakan** (aturan `CLAUDE.md`). Logika bersama di `packages/api` dan `packages/schema`, bukan di `apps/web`.
10. **Kualitas:** string lewat Lingui lalu `pnpm lingui:extract` (terjemahkan id-ID); typecheck dan tes paket yang berubah; `pnpm db:generate` untuk tabel baru dan baca SQL-nya; env var baru di `packages/env/src/server.ts`, `.env.example`, dan `turbo.json` (`globalPassThroughEnv` dan `env` tugas tes yang relevan); binding baru di `wrangler.jsonc` dan tipe Worker; `pnpm exec turbo boundaries` bila ekspor antarpaket berubah; `pnpm exec vp lint --fix <path>` dan `pnpm exec vp fmt <path>`; akhiri dengan `pnpm lint:agent` dan `pnpm format:check`; `pnpm check:cloudflare` bila kode server berubah; `pnpm docs:gen` bila spesifikasi API berubah. Laporkan jumlah tes yang benar-benar berjalan.
11. **Tampilan dicek dengan mata:** screenshot desktop dan ponsel, terang dan gelap, Inggris dan Indonesia. Sertakan di laporan.
12. **Panduan produk ikut diperbarui** sesuai tabel "Keep product guides current" di `.agents/docs/contributing/career-platform.mdx` (terutama `finding-roles-automatically`, `tracking-job-applications`, `career-workspace-reference`).
13. **Dokumen ikut diperbarui:** bila rancangan berubah, perbarui `02-teknis.md` (dan `01-desain.md` untuk tampilan). Bagian baru ditambahkan di akhir.
14. **Akhir sesi:** perbarui kolom Status di tabel atas dan tambahkan satu baris di "Catatan sesi". Lalu beri laporan dengan format di bawah.
15. **Bila konteks hampir habis:** berhenti di titik aman, set status 🟡, tulis langkah lanjutan di "Catatan sesi", minta pemilik membuka sesi baru dengan "Lanjutkan Phase NN".

Format laporan akhir untuk pemilik (bahasa awam, singkat):

```text
Phase NN — <judul>: selesai / sebagian
Yang berubah: …
Gambar / cara mengecek sendiri: …
Tes yang dijalankan: … (jumlah lulus/gagal/dilewati)
Biaya treg yang terpakai di sesi ini: …
Belum dikerjakan / risiko: …
Tugasmu sebelum phase berikutnya: …
```

## Catatan sesi

| Tanggal    | Phase | Hasil                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Sisa / tugas pemilik                                                                    |
| ---------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 2026-11-20 | —     | Rencana ditulis. Uji cakupan lewat treg (±$0.05). Pemilik: target global (D6). Global: ribuan lowongan per posisi di AS/Inggris/India/Kanada, ratusan di pasar kecil; Hirebase cukup sebagai utama, JobsPipe menambah. Detail: `02-teknis.md` 14                                                                                                                                                                                                                                                            | K1–K11 disetujui. Sisa: Phase 00 langkah 1–3 (treg, token Cloudflare, email JobsPipe)   |
| 2026-11-20 | 00    | Rahasia produksi `TREG_API_KEY` dan `CLOUDFLARE_BROWSER_TOKEN` terpasang (dicek `wrangler secret list`). Token Cloudflare `rezumi-browser-run`: Browser Run Edit.                                                                                                                                                                                                                                                                                                                                           | Belum dikonfirmasi: top-up + spend cap treg, email JobsPipe                             |
| 2026-11-20 | 01    | Klien treg, skema `JobListing`, adaptor Hirebase/JobsPipe, tabel `job_listing` + `job_search_cache`, `purgeProvider`, binding `JOB_EVENTS`, `pnpm jobs:probe`. 35 tes jobs + seluruh tes API lulus; uji nyata 18 lowongan $0.0292. Temuan untuk Phase 02: `02-teknis.md` 15                                                                                                                                                                                                                                 | Merge PR. Phase 02 butuh K2, K3, K7 (sudah disetujui)                                   |
| 2026-11-20 | 02    | `JobSearchService` + oRPC `jobs.search/listing/hide/quota`: cache bersama 6 jam, single-flight, kuota paket (3/15/40), anggaran $1/hari, router Hirebase → JobsPipe, tabel `job_listing_hidden`, operasi `add` di Coordination, binding `JOB_SEARCH_LIMITER`. Ukur gratis 525 count: judul jauh lebih tepat dari kata kunci/deskripsi. Uji nyata: 1,8 detik $0.03 lalu 9 ms $0 dari cache. Detail: `02-teknis.md` 16                                                                                        | Merge PR Phase 01 lalu Phase 02 (branch bertumpuk). Phase 03 butuh K5 (sudah disetujui) |
| 2026-11-20 | 03    | Halaman **Lowongan** `/dashboard/jobs` (menu di atas Lamaran, K5): isian dari Profil, filter K11, kartu + panel detail, Lacak / Sesuaikan CV / Lihat posting asli / Sembunyikan, sisa kuota, keadaan khusus. Server: `jobs.track`, `jobs.defaults`, tanda "Dilacak" lewat `sourceKey`. `applications.ai.searchPostings` dan pencarian di dialog Simpan lowongan dihapus. Panduan `searching-for-jobs`. Tes browser memakai treg tiruan (`TREG_BASE_URL`). Biaya treg sesi ini $0. Detail: `02-teknis.md` 17 | Review screenshot; merge PR 01 → 02 → 03 (bertumpuk). Phase 04 tidak butuh apa-apa      |
