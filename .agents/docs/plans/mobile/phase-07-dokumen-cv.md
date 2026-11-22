# Phase 07 — Dokumen dan pembuat CV

| Dikerjakan              | Ukuran                 | Bergantung pada | Perlu dari pemilik |
| ----------------------- | ---------------------- | --------------- | ------------------ |
| Claude + review pemilik | Besar (2–3 sesi wajar) | Phase 06        | —                  |

## Untuk pemilik

**Apa yang dibuat:** jantung app: daftar dokumen dan pembuat CV (Write, Design, Check, History) ditulis ulang dengan tampilan baru, ditambah yang sudah ada di web: 36 template dengan galeri dan filter, preset template, pemilih ikon per kategori dan gaya, label isian kustom, chip keahlian, dan penanda "beda dari Profil".

**Prompt:** `Kerjakan Phase 07 dari .agents/docs/plans/mobile/README.md` (bila terpotong: `Lanjutkan Phase 07 …`)

**Yang bisa kamu cek di akhir:** membuat CV dari awal sampai pratinjau PDF di iPhone dan Android; mengganti template; mematikan jaringan, mengedit, menyalakan lagi, dan melihat perubahan tersimpan.

## Untuk agent

Urutan kerja disarankan: (a) inti draf ke paket + tes, (b) Documents, (c) Write, (d) Design, (e) Check + History. Tiap bagian meninggalkan app yang bisa di-build, supaya phase bisa dipotong antar-sesi.

### Langkah

1. **Inti draf** (`02-teknis.md` bagian 5): ekstrak mesin dari `src/draft/store.ts` dan `draft.ts` web ke `@rezumi/resume` (`./draft`): antrean simpan dengan debounce, undo/redo, replay offline, deteksi konflik; adaptor penyimpanan (SQLite di app, yang dipakai web di web) tetap di masing-masing app. **Tulis tes dulu** untuk perilaku sekarang (konflik 3 arah, offline lalu sambung, ganti akun, tutup paksa), baru memecah closure. Tangani event `mutation: "profile"`.
2. **Model Write dan preset desain** ke `@rezumi/resume`; hapus salinan di app (`features/write/model.ts`, `design/presets.ts`); web memakai paket yang sama.
3. **Documents (`src/features/documents`):** daftar/kisi dengan gambar halaman pertama (antrean thumbnail yang ada), segmen All/Resumes/Letters/Trash, cari, urut, tag, menu dokumen, geser baris, impor (PDF/DOCX/JSON), dokumen baru. Prosedur: `documents.*`, `resume.{create,import,duplicate}`, `coverLetters.{create,import,duplicate}`.
4. **Write:** garis besar bagian (urut dengan seret, sembunyikan, ganti nama), layar isian per bagian memakai komponen isian Phase 06, teks kaya, tanggal, foto, tombol Improve (AI), **penanda Profil** (Use Profile's, Save to Profile lewat `profile.savePart`, Add from Profile), label isian kustom, chip keahlian.
5. **Design:** galeri template (`templateLineup`, `templatePresets`, `templateCareerFields`; gambar dari `apps/web/public/templates` dimuat dari server), preset, warna, font (termasuk font unggahan paket berbayar: baca saja, unggah tetap di web bila belum ada di app), tata letak halaman, **ikon per kategori dan gaya** (`@rezumi/schema/icons`, `metadata.design.icons.style`), pengaturan lanjutan. Editor CSS tidak dibawa.
6. **Pratinjau:** pipeline yang ada; ketuk untuk layar penuh, cubit untuk perbesar; tablet: berdampingan.
7. **Check dan History:** tulis ulang tampilan di atas `src/ui`; logika cek memakai paket yang sama dengan web.
8. **Kerangka editor (`src/shell/builder-chrome`)**: bar mode di bawah, judul yang bisa diubah, undo/redo, status simpan (Tersimpan / Menyimpan / Offline), penjaga keluar.
9. Hapus layar lama `features/{documents,document-menu,write,design,check,history}` yang sudah diganti.

### Tes dan verifikasi

- Tes inti draf di paket (wajib, lihat langkah 1); tes web yang memakai draf tetap hijau.
- Tes komponen: garis besar, layar isian, galeri template, pemilih ikon.
- Maestro di dua platform: buat → edit → pratinjau → ganti template; `offline-and-reconnect`; `edit-and-save` dengan tutup paksa; konflik (ubah di web saat app offline).
- Bandingkan PDF dari app dan web untuk CV yang sama pada 3 template (halaman pertama sebagai gambar).
- Daftar cek dua platform; daftar 300 dokumen mulus; RTL (CV berbahasa Arab) tampil benar.

### Selesai bila

- Pembuat CV setara web untuk Write, Design, Check, History (kecuali editor CSS).
- Inti draf satu sumber untuk web dan app, dengan tes.
- Butir template revamp dan penanda Profil di "Feature parity exceptions" dihapus.

## Kemajuan

- **2026-11-21, sesi 1:** langkah 1 (inti draf ke `@rezumi/resume/draft`, 27 tes) dan 2 (model Write dan preset desain ke `@rezumi/resume/write` dan `./design-presets`; web dan app memakai paket) selesai, kecuali web yang belum memakai `createDraftStore` (lihat `02-teknis.md` 19). Berikutnya: langkah 3 Documents, lalu Write, Design, pratinjau, Check/History, kerangka editor, hapus layar lama; dan menyatukan draf web.
