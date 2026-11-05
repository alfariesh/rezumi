# Phase 01 — Fondasi: data, API, saklar

| Dikerjakan | Ukuran | Bergantung pada    | Perlu dari pemilik |
| ---------- | ------ | ------------------ | ------------------ |
| Claude     | Besar  | Phase 00 (ID tema) | —                  |

## Untuk pemilik

**Apa yang dibuat:** dasar teknis yang belum terlihat: tempat menyimpan portfolio di database, aturan isinya, perintah untuk membuat/mengubah/menerbitkan portfolio, dan saklar `PORTFOLIO_MODE` (bawaan `off`). Belum ada tampilan.

**Siapkan:** tidak ada.

**Prompt:** `Kerjakan Phase 01 dari .agents/docs/plans/portfolio/README.md`

**Yang bisa kamu cek di akhir:** laporan tes. Aplikasi di produksi tidak berubah sama sekali setelah merge.

## Untuk agent

### Langkah

1. **Saklar** (`02-teknis.md` bagian 3): env `PORTFOLIO_MODE`, `.env.example`, `turbo.json` (`globalPassThroughEnv` dan `env` tugas tes), `wrangler.jsonc` (`"off"`), `mode.ts` dengan `isPortfolioEnabledFor`, flag publik `portfolio`.
2. **Skema** (`02-teknis.md` 4.2, 16, 17, 21): `packages/schema/src/portfolio/*` dengan ekspor eksplisit di `package.json`. Seluruh bentuk data dibuat sekarang, walau editornya menyusul: data dasar khusus portfolio, angka pencapaian, karya dengan semua jenis blok (teks, gambar, metrik, video, PDF, tautan), metrik, layanan, testimoni (`consent` wajib), klien, lokasi (bagian 24), dan efek serta latar intro (bagian 23; ID efek sesuai keputusan Phase 00). Isi `themes.ts` dengan ID final dari Phase 00 (`portfolioThemeLineup`, `defaultPortfolioTheme`, metadata tiap tema: varian yang didukung termasuk varian metrik, mode bawaan, pasangan font, warna aksen kurasi). `default.ts` untuk portfolio baru. `limits.ts` untuk batas teknis. Parser tautan video (bagian 18) boleh dibuat di sini karena dipakai validasi skema.
3. **Tabel** `portfolio` dan `portfolio_file` (`02-teknis.md` 4.1) → `pnpm db:generate`. Baca SQL yang dihasilkan. Jangan reset database atau menghapus volume.
4. **Modul API** `packages/api/src/features/portfolio/`:
   - service: `get`, `create` (isi awal dari CV, atau dari `basics` bila tanpa CV, 4.3), `update` (validasi Zod per jenis blok, sanitasi teks kaya dengan sanitizer CV, cek URL dan nomor WhatsApp, rujukan file harus milik pemilik dan tercatat di `portfolio_file`, batas ukuran JSON, `expectedUpdatedAt` untuk konflik), `setPublic` (butuh email terverifikasi; isi `publishedAt` pertama kali), `updateSettings` (CV sumber milik akun dan tidak di Trash, atau `null`), `delete`.
   - router dengan `protectedProcedure`, tag `Internal`, dipasang di agregat `@rezumi/api/routers`; batas laju untuk tulis.
   - semua prosedur menolak bila `isPortfolioEnabledFor` salah; `get` mengembalikan `enabled: false`.
5. **`buildPortfolioView`** (4.3): fungsi murni. Taruh di tempat yang membuat Phase 02 paling mudah (idealnya paket `packages/portfolio` yang dibuat Phase 02; bila paket belum ada, buat kerangka paketnya sekarang) dan catat pilihannya di `02-teknis.md`.
6. **Hapus akun**: portfolio terhapus lewat FK cascade; file gambar ikut terhapus (ikuti cara penghapusan unggahan akun yang sudah ada).

### Aturan yang wajib dijaga

- Satu portfolio per akun dijamin database (indeks unik `user_id`), bukan hanya kode.
- `isPublic`, `showInSearchEngines`, dan penangguhan tidak bisa diubah lewat `update(data)`.
- Mode `off` tidak mengubah perilaku apa pun yang sudah ada.
- Spec OpenAPI publik tidak berubah (tag `Internal`); jalankan `pnpm docs:gen` dan pastikan `docs/spec.json` tidak berubah.

### Tes dan verifikasi

- Unit: skema (bawaan, `.catch` untuk data rusak, batas, blok tak dikenal dibuang, metrik unggulan menunjuk metrik yang ada, testimoni tanpa `consent` ditolak), parser tautan video, isi awal dari CV (ringkasan → Tentang saya, proyek → karya dengan blok Teks dan Tautan, aksen/font ikut CV), portfolio tanpa CV, sanitasi (`<script>`, `onerror`, `javascript:` dibuang).
- Integrasi DB nyata: `create` dua kali paralel → tepat satu berhasil; `update` dari akun lain ditolak; CV sumber milik akun lain atau di Trash ditolak; data terlalu besar ditolak; konflik `expectedUpdatedAt` terdeteksi; `setPublic` tanpa email terverifikasi ditolak; mode `off`/`admins` dihormati.
- Typecheck `@rezumi/schema`, `@rezumi/db`, `@rezumi/api`, `server`, `web`, `mobile` (mobile cukup tetap terkompilasi); `pnpm exec turbo boundaries`; lint; format.

### Selesai bila

- Prosedur bertanda Phase 01 di `02-teknis.md` bagian 7 ada dan teruji.
- Laporan menyebut jumlah tes yang berjalan dan konfirmasi bahwa mode `off` tidak mengubah apa pun.
