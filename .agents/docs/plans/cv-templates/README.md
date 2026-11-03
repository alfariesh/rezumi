# Revamp template CV Rezumi — mulai di sini

Rencana mengganti 18 template lama (nama Pokémon) dengan 16 template baru yang elegan, modern, dan kuat di ATS, plus sistem ikon Hugeicons tiga gaya dan logo. Satu phase dikerjakan dalam satu sesi Claude.

- Keputusan produk (lineup, nama, ikon, paket): [00-keputusan.md](00-keputusan.md)
- Bahasa desain dan spesifikasi tiap template: [01-desain.md](01-desain.md)
- Rancangan teknis (untuk agent): [02-teknis.md](02-teknis.md)

## Cara memakai (untuk pemilik)

1. Buka **sesi Claude baru** untuk setiap phase, lalu tempel (ganti nomornya):

   ```text
   Kerjakan Phase 02 dari .agents/docs/plans/cv-templates/README.md
   ```

2. Claude membaca dokumen, bertanya bila ada keputusan yang kurang, lalu mengerjakan.
3. Di akhir sesi Claude memberi laporan berbahasa awam plus gambar contoh template, lalu menawarkan commit dan Pull Request.
4. **Merge ke `main` = langsung tayang.** Lihat dulu gambar contohnya.

| Kebutuhan                   | Prompt                                                                                    |
| --------------------------- | ----------------------------------------------------------------------------------------- |
| Melanjutkan phase terpotong | `Lanjutkan Phase 02 dari .agents/docs/plans/cv-templates/README.md`                       |
| Mengubah satu desain        | `Ubah template Senja: blok warnanya terlalu besar. Ikuti .agents/docs/plans/cv-templates` |
| Mengganti nama template     | `Ganti nama template Atlas jadi Garis. Ikuti .agents/docs/plans/cv-templates`             |
| Menanyakan posisi rencana   | `Apa status revamp template? Baca .agents/docs/plans/cv-templates/README.md`              |

## Urutan phase dan status

Status: ⬜ belum mulai · 🟡 berjalan/sebagian · ✅ selesai · ⛔ diblokir.

| Phase | Judul                                                | Bergantung pada | Status |
| ----- | ---------------------------------------------------- | --------------- | ------ |
| 01    | Fondasi: ikon Hugeicons 3 gaya, skema, token desain  | —               | ✅     |
| 02    | Sepuluh template satu kolom                          | 01              | ✅     |
| 03    | Enam template dua kolom, hapus template lama         | 02              | 🟡     |
| 04    | Builder web dan mobile: kontrol ikon, galeri, preset | 01, 03          | 🟡     |
| 05    | Paket: template gratis baru, fitur logo tools        | 03              | 🟡     |
| 06    | Contoh galeri, dokumentasi, DOCX, halaman web publik | 03              | 🟡     |
| 07    | QA akhir: ATS, matriks visual, mobile                | 04, 05, 06      | ⬜     |

### Phase 01 — Fondasi

Ikon PDF dari Hugeicons dengan tiga gaya; `design.icons` menggantikan `page.hideIcons`/`hideSectionIcons`; label untuk kolom kustom; chip kata kunci; logo otomatis untuk Profil; token desain dan dekorasi judul bagian; margin bawaan baru; alat render contoh `tooling/templates/preview.ts`. Template lama tetap jalan dengan ikon baru. Detail: `02-teknis.md` bagian 2–4.

Selesai bila: semua template lama merender dengan ikon Hugeicons di ketiga gaya; tes `@rezumi/pdf`, `@rezumi/schema`, `@rezumi/resume` lulus; typecheck paket terdampak lulus.

### Phase 02 — Sepuluh template satu kolom

Meridian, Sterling, Aksara, Atlas, Tunas, Summit, Cendekia, Wibawa, Tenun, Vector (spesifikasi `01-desain.md`). ID baru ditambahkan di samping ID lama; setiap template punya `semantic.ts`, entri galeri web dan mobile (nama, deskripsi Lingui, tag), entri DOCX, dan preset. Cek matriks visual (`02-teknis.md` bagian 6) untuk tiap template dan simpan gambarnya untuk laporan.

### Phase 03 — Enam template dua kolom, hapus yang lama

Kirana, Linen, Horizon, Jejak, Purnama, Senja. Lalu hapus 18 template lama beserta tesnya, pasang `legacyTemplateIds`, jadikan Meridian template default (`default.ts`, `.catch`), dan pindahkan contoh CSS kustom di dokumentasi ke ID baru.

### Phase 04 — Builder web dan mobile

Design → Ikon: saklar utama, gaya (Standar/Rounded/Sharp), kontak, judul bagian, item, logo tools (terkunci untuk Gratis). Pemilih ikon memakai Hugeicons per kategori. Galeri: nama baru, filter (satu kolom, dua kolom, ATS aman, bidang), tombol "Pakai gaya bawaan template". Keahlian: tampilan chip. Data Pribadi: label di kolom kustom. Semua di web **dan** mobile.

### Phase 05 — Paket

`FREE_TEMPLATES` = Meridian, Sterling, Tunas, Wibawa, Kirana; fitur paket `brandLogos` untuk logo tools (server menolak menyalakan `icons.logos` tanpa fitur; nilai tersimpan tetap dirender). Naikkan `BILLING_CATALOG_VERSION`; perbarui pesan, halaman paket web/mobile, dan dokumen legal/harga yang menyebut template gratis.

### Phase 06 — Contoh, dokumentasi, ekspor

PDF contoh dan gambar galeri (`apps/web/public/templates/{pdf,jpg,thumb}`) dari `tooling/templates/preview.ts` dengan persona fiktif (versi Indonesia untuk lokal `id`). Perbarui `docs/guides/choosing-a-template.mdx` dan halaman lain yang menyebut template, beranda, DOCX tiap template, dan cek halaman web publik.

### Phase 07 — QA akhir

Ekstraksi teks ATS per template, matriks visual lengkap, uji mobile (simulator), dan bersih-bersih sisa Phosphor.

## Aturan wajib untuk setiap sesi agent

1. **Baca dulu:** `CLAUDE.md`, README ini, `00-keputusan.md`, `01-desain.md`, `02-teknis.md`.
2. **Keputusan pemilik tidak diubah diam-diam.** Tanyakan, lalu catat di log `00-keputusan.md`.
3. **Git:** `git status --short` sebelum mengedit; sesi lain bisa sedang bekerja di checkout yang sama, jadi stage hanya path milik sesi ini. Branch `feat/cv-templates-NN-<slug>`. Conventional Commits. Jangan merge ke `main` tanpa persetujuan pemilik.
4. **Desain dicek dengan mata**, bukan hanya tes: render, lihat gambarnya, perbaiki, ulangi. Sertakan gambar di laporan.
5. **Parity web–mobile** sesuai `CLAUDE.md`.
6. **Kualitas:** string baru lewat Lingui lalu `pnpm lingui:extract`; typecheck dan tes paket yang berubah; `pnpm exec turbo boundaries`; `pnpm exec vp lint --fix <path>` dan `pnpm exec vp fmt <path>`; akhiri dengan `pnpm lint:agent` dan `pnpm format:check`. Laporkan yang gagal atau dilewati.
7. **Akhir sesi:** perbarui Status di tabel dan tambahkan baris di "Catatan sesi". Bila konteks hampir habis, berhenti di titik aman, set 🟡, dan tulis langkah lanjutan yang konkret.

Format laporan akhir untuk pemilik:

```text
Phase NN — <judul>: selesai / sebagian
Yang berubah: …
Gambar contoh: …
Tes yang dijalankan: … (lulus/gagal)
Belum dikerjakan / risiko: …
Tugasmu: …
```

## Saran lanjutan (di luar phase)

- Rekomendasi template dari isi CV (ada publikasi → Cendekia; banyak skill teknis → Vector) dan filter bidang di galeri.
- Palet warna kurasi 4–5 pilihan per template, supaya pengguna Gratis tetap dapat kombinasi yang cantik.
- Surat lamaran dengan kop yang serasi untuk setiap template.
- Analitik pemakaian template (dipilih, diekspor) untuk memangkas yang kurang diminati.
- Panduan foto: perusahaan lokal sering minta foto, perusahaan multinasional dan ATS lebih suka tanpa foto. Tampilkan saran ini di Design.

## Catatan sesi

| Tanggal    | Phase                                               | Hasil                                                                                                                                                                                                                                                                  | Sisa / tugas pemilik                                                                                                                                                                                                                                                                                                                                                    |
| ---------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-03 | —                                                   | Audit 18 template, keputusan pemilik, rencana ini; uji Forme untuk ikon stroke Hugeicons                                                                                                                                                                               | —                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-11-03 | 01, 02, 03 (sebagian), 05 (sebagian), 06 (sebagian) | Ikon Hugeicons 3 gaya di PDF + `design.icons`; 16 template baru (`lineup-page.tsx`, `tokens.ts`); galeri web/mobile hanya menampilkan lineup; default CV baru = Meridian; 5 template gratis baru; gambar contoh galeri; chip keahlian + logo tools; label kolom kustom | Phase 03: hapus 18 template lama + tesnya, pasang `legacyTemplateIds`. Phase 04: grup "Ikon" lengkap di Design (gaya, judul bagian, logo) web+mobile, pemilih ikon per kategori, tombol gaya bawaan. Phase 05: fitur paket `brandLogos`. Phase 06: persona contoh, DOCX, dokumentasi. Owner: opsional sinkron kategori ikon hobi (travel, media, food) via `icons:sync` |
| 2026-11-03 | 01 (lanjutan), 04 (sebagian)                        | Set ikon CV 2.491 ikon dari ekspor Hugeicons Pro (format padat); grup Ikon di Design web + mobile; normalisasi template/ikon di setiap tulis; resource MCP `resume://_meta/design` + skill agent diperbarui; contoh resume memakai Meridian                            | Phase 04 sisa: pemilih ikon per kategori, tombol gaya bawaan template, label kolom kustom di form. Phase 05: kunci logo tools untuk Gratis. Phase 03: hapus kode 18 template lama (sudah tidak pernah dipakai: semua ID lama dipetakan)                                                                                                                                 |
