# Impor website ke Profil dan portfolio — mulai di sini

Rencana membuat onboarding lebih mulus: saat pengguna mengisi alamat situs pribadinya, Rezumi tidak hanya mengisi Profil (CV) dari satu halaman seperti sekarang, tetapi juga **menemukan halaman karya di situs itu dan menyiapkan works portfolio lengkap**: judul, ringkasan, peran, tahun, angka hasil, link, video atau Figma, dan gambar yang disalin ke penyimpanan Rezumi. Pengguna mereview dulu (semua sudah dicentang) sebelum disimpan. Impor pertama gratis. Cukup memakai Cloudflare (Browser Run yang sudah terpasang), tanpa Firecrawl. Satu phase dikerjakan dalam satu sesi Claude.

- Keputusan pemilik dan default: [00-keputusan.md](00-keputusan.md)
- Alur dan layar: [01-desain.md](01-desain.md)
- Rancangan teknis (untuk agent): [02-teknis.md](02-teknis.md)
- Ide setelah rilis (Behance, Dribbble, dll.): [backlog-lanjutan.md](backlog-lanjutan.md)

## Cara memakai (untuk pemilik)

1. Tidak ada persiapan akun. Token Cloudflare Browser Run sudah terpasang sejak rencana lowongan.
2. Untuk setiap phase, buka **sesi Claude baru** lalu tempel prompt ini (ganti nomornya):

   ```text
   Kerjakan Phase 01 dari .agents/docs/plans/impor-website/README.md
   ```

3. Claude membaca dokumen, bertanya bila ada keputusan yang kurang. Jawab saja di chat.
4. Di akhir sesi Claude memberi laporan berbahasa awam lalu menawarkan commit dan Pull Request.
5. **Merge ke `main` = langsung tayang di produksi.** Phase 01–02 hanya menambah kode di belakang layar. Pengguna baru melihat perubahan setelah Phase 03 di-merge.

Prompt lain:

| Kebutuhan                        | Prompt                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------ |
| Melanjutkan phase yang terpotong | `Lanjutkan Phase 02 dari .agents/docs/plans/impor-website/README.md`                             |
| Hasil impor satu situs jelek     | `Impor website <alamat> hasilnya kurang bagus. Selidiki, ikuti .agents/docs/plans/impor-website` |
| Menanyakan posisi rencana        | `Apa status rencana impor website? Baca .agents/docs/plans/impor-website/README.md`              |

## Urutan phase dan status

Status: ⬜ belum mulai · 🟡 berjalan/sebagian · ✅ selesai · ⛔ diblokir · ⏸️ ditunda.

| Phase | Judul                                                                   | Dikerjakan              | Perlu dari pemilik sebelum mulai         | Bergantung pada | Status |
| ----- | ----------------------------------------------------------------------- | ----------------------- | ---------------------------------------- | --------------- | ------ |
| 01    | [Membaca situs: halaman karya, AI, kredit](phase-01-baca-situs.md)      | Claude                  | —                                        | —               | ✅     |
| 02    | [Menyimpan karya ke portfolio dan Profil](phase-02-simpan-portfolio.md) | Claude                  | —                                        | 01              | ⬜     |
| 03    | [Layar: onboarding, Isi Profil, editor portfolio](phase-03-layar.md)    | Claude + review pemilik | Melihat screenshot; setujui teks privasi | 02              | ⬜     |
| 04    | [Uji nyata dan rilis](phase-04-rilis.md)                                | Claude + pemilik        | Alamat situs untuk diuji; izin merge     | 03              | ⬜     |

Phase dikerjakan **berurutan, satu per satu** di checkout yang sama.

## Aturan wajib untuk setiap sesi agent

Bagian ini untuk Claude. Pemilik tidak perlu menghafalnya.

1. **Baca dulu:** `CLAUDE.md` di root repo, README ini, `00-keputusan.md`, `01-desain.md`, `02-teknis.md`, lalu dokumen phase. Refresh graph (`index_repository`) di awal sesi; cari titik kode dengan graph + grep. Path di dokumen ini dari eksplorasi 2026-11-26: cek ulang sebelum mengandalkannya.
2. **Cek prasyarat.** Bila ada yang belum disiapkan pemilik, berhenti dan sebutkan persis apa yang dibutuhkan, langkah demi langkah. Jangan menebak keputusan bisnis.
3. **Keputusan bisnis tidak diubah diam-diam.** Bila keputusan di `00-keputusan.md` tidak bisa atau tidak sebaiknya dipakai, jelaskan pilihannya dan tanya pemilik. Catat jawabannya di sana.
4. **Biaya nyata hanya seizin pemilik.** Uji dengan Rezumi AI atau Browser Run di sesi agent: sebutkan perkiraan biaya dulu, laporkan biaya sebenarnya. Tes otomatis memakai fixtures dan AI tiruan, tidak pernah memanggil jaringan.
5. **Git:** `git status --short` sebelum mengedit; stage hanya path milik sesi ini (checkout ini sering berisi perubahan lain milik pemilik). Branch `feat/website-import-NN-<slug>` dari `main` terbaru. Conventional Commits, **tanpa atribusi AI** di commit dan PR. Jangan merge ke `main` tanpa persetujuan pemilik.
6. **Rahasia:** jangan pernah menulis token atau kunci di kode, dokumen, tes, log, atau chat.
7. **Kompatibilitas:** prosedur lama `profile.sources.website` tidak berubah perilakunya (app mobile versi lama memakainya). Data portfolio lama harus tetap valid (kolom baru opsional).
8. **Web dulu.** Logika di `packages/*`, bukan di `apps/web`. Kebutuhan mobile dicatat di `.agents/docs/plans/mobile/README.md`.
9. **Kualitas:** string lewat Lingui lalu `pnpm lingui:extract` (terjemahkan id-ID); typecheck dan tes paket yang berubah; `pnpm db:generate` untuk tabel baru dan baca SQL-nya; env var baru (bila ada) di `packages/env/src/server.ts`, `.env.example`, dan `turbo.json`; `pnpm exec turbo boundaries` bila ekspor antarpaket berubah; `pnpm exec vp lint --fix <path>` dan `pnpm exec vp fmt <path>`; akhiri dengan `pnpm lint:agent` dan `pnpm format:check`; `pnpm check:cloudflare` bila kode server berubah; `pnpm docs:gen` bila spesifikasi API berubah. Laporkan jumlah tes yang benar-benar berjalan.
10. **Tampilan dicek dengan mata** (Phase 03–04): desktop dan ponsel, terang dan gelap, Inggris dan Indonesia. Warna lewat token. Sertakan screenshot di laporan.
11. **Dokumen ikut diperbarui:** rancangan berubah → perbarui `02-teknis.md` (dan `01-desain.md` untuk tampilan). Bagian baru ditambahkan di akhir.
12. **Akhir sesi:** perbarui kolom Status di tabel atas dan tambahkan satu baris di "Catatan sesi". Lalu beri laporan dengan format di bawah.
13. **Bila konteks hampir habis:** berhenti di titik aman, set status 🟡, tulis langkah lanjutan di "Catatan sesi", minta pemilik membuka sesi baru dengan "Lanjutkan Phase NN".

Format laporan akhir untuk pemilik (bahasa awam, singkat):

```text
Phase NN — <judul>: selesai / sebagian
Yang berubah: …
Gambar / cara mengecek sendiri: …
Tes yang dijalankan: … (jumlah lulus/gagal/dilewati)
Biaya AI / Browser Run yang terpakai di sesi ini: …
Belum dikerjakan / risiko: …
Tugasmu sebelum phase berikutnya: …
```

## Catatan sesi

| Tanggal    | Phase | Hasil                                                                                                                                                                                                                                                                                                                                                                                                                   | Sisa / tugas pemilik                              |
| ---------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 2026-11-26 | —     | Rencana ditulis. Pemilik: review dulu, impor pertama gratis, maks 10 works, gambar ke R2, Behance nanti.                                                                                                                                                                                                                                                                                                                | Mulai Phase 01                                    |
| 2026-11-26 | 01    | Server membaca situs sampai 11 halaman (beranda, sitemap, halaman karya) dan mengembalikan draf Profil + draf works lewat endpoint streaming baru. Impor pertama gratis (jatah dijaga index unik), berikutnya 5 kredit, 3 impor per hari. Tabel `website_import`, pemeliharaan harian, skrip `pnpm website:probe`. Uji nyata: 3 situs, 4–8 karya per situs, 37–78 detik, ±$0,01 AI per impor. Detail: `02-teknis.md` 11 | Review dan merge PR. Phase 02 tidak butuh apa-apa |
