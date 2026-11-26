# Phase 02 — Menyimpan karya ke portfolio dan Profil

| Dikerjakan | Ukuran | Bergantung pada | Perlu dari pemilik |
| ---------- | ------ | --------------- | ------------------ |
| Claude     | Sedang | Phase 01        | —                  |

## Untuk pemilik

**Apa yang dibuat:** karya yang dipilih pengguna disimpan ke portfolio (dibuat dalam keadaan belum tayang bila belum ada) lengkap dengan gambar yang disalin ke penyimpanan Rezumi, blok teks, angka, video atau Figma, dan link. Karya juga masuk ke Profil sebagai Proyek supaya CV ikut terisi. Belum ada tombol untuk pengguna.

**Prompt:** `Kerjakan Phase 02 dari .agents/docs/plans/impor-website/README.md`

**Yang bisa kamu cek di akhir:** screenshot portfolio lokal hasil impor dari satu situs uji (daftar karya dan satu halaman karya).

## Untuk agent

### Langkah

1. Baca `02-teknis.md` bagian 1, 6, 7, 8, 10 dan catatan Phase 01 di akhir dokumen itu.
2. Pastikan pemroses gambar server (Images di Workers, sharp di Node) bisa dipakai untuk gambar dari URL, bukan hanya upload browser. Bila tidak, rancang jalur kecil yang aman dan catat di `02-teknis.md`.
3. Prosedur streaming `portfolio.importSiteWorks({ runId, workIds })` (bagian 6, langkah 1–7). Rate limit mutasi portfolio yang ada.
4. Penanda "Sudah ada" untuk impor ulang (bagian 6 langkah 6): pilih cara paling kecil yang tetap kompatibel dengan data lama.
5. Pastikan file gambar yang tidak jadi dipakai dibersihkan job yang ada.

### Tes dan verifikasi

- Kasus `02-teknis.md` bagian 10 untuk simpan: portfolio dibuat tidak tayang, kuota works Gratis, kuota penyimpanan habis di tengah, gambar gagal sebagian, impor ulang, sumber portfolio = resume, proyek Profil tidak dobel.
- Tes integrasi database dengan pola yang ada di fitur portfolio.
- Uji lokal sampai portfolio tampil (editor dan halaman publik setelah dipublikasikan manual di lokal).

### Selesai bila

- Works tersimpan dengan sampul, galeri, blok, dan link yang benar; Profil punya proyek yang cocok.
- Kuota works dan penyimpanan dihormati; tidak ada gambar yang dimuat dari situs asli.
