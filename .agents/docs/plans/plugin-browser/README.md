# Plugin browser Rezumi — mulai di sini

Rencana **plugin Chrome dan Edge** untuk menyimpan lowongan kerja dari situs loker (LinkedIn, Indeed, JobStreet, Glints, dan situs lain lewat cara umum) langsung ke pelacak lamaran Rezumi. Satu klik menyimpan posisi, perusahaan, lokasi, gaji, dan deskripsi; plugin menandai loker yang sudah disimpan, menghitung kecocokan dengan CV, membuka alat persiapan Rezumi (sesuaikan CV, surat lamaran), dan mengingatkan tindak lanjut. Plugin hanya "tangan"; semua data dan AI ada di server Rezumi yang sudah ada. Satu phase dikerjakan dalam satu sesi Claude.

- Keputusan produk (paket, situs, browser, cakupan rilis, privasi): [00-keputusan.md](00-keputusan.md)
- Alur dan layar plugin: [01-desain.md](01-desain.md)
- Rancangan teknis (untuk agent): [02-teknis.md](02-teknis.md)
- Ide setelah rilis: [backlog-lanjutan.md](backlog-lanjutan.md)

## Cara memakai (untuk pemilik)

1. Buka **sesi Claude baru** untuk setiap phase, lalu tempel prompt ini (ganti nomornya):

   ```text
   Kerjakan Phase 01 dari .agents/docs/plans/plugin-browser/README.md
   ```

2. Claude membaca dokumen, mengecek apa yang perlu kamu siapkan, dan bertanya bila ada keputusan yang kurang. Jawab saja di chat.
3. Di akhir sesi Claude memberi laporan berbahasa awam plus gambar, lalu menawarkan commit dan Pull Request.
4. **Merge ke `main` = perubahan server langsung tayang di produksi.** Itu aman: perubahan server untuk plugin hanya menambah, dan ajakan memasang plugin di web baru tampil setelah plugin terbit di toko (Phase 07). Plugin sendiri baru sampai ke pengguna setelah kamu mengunggahnya ke toko.
5. Lanjut ke phase berikutnya sesuai urutan di bawah.

Prompt lain yang bisa dipakai:

| Kebutuhan                              | Prompt                                                                                                    |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Melanjutkan phase yang terpotong       | `Lanjutkan Phase 03 dari .agents/docs/plans/plugin-browser/README.md`                                     |
| Dibantu tugas non-kode (toko, akun)    | `Bantu saya mengerjakan bagian "Untuk pemilik" Phase 00 dari .agents/docs/plans/plugin-browser/README.md` |
| Situs berubah dan plugin gagal membaca | `Plugin gagal membaca lowongan di JobStreet. Perbaiki mengikuti .agents/docs/plans/plugin-browser`        |
| Menambah situs loker                   | `Tambahkan pembaca khusus Kalibrr ke plugin. Ikuti .agents/docs/plans/plugin-browser/02-teknis.md`        |
| Review toko ditolak                    | `Chrome Web Store menolak plugin dengan alasan berikut: … Bantu perbaiki, ikuti Phase 07`                 |
| Menanyakan posisi rencana              | `Apa status rencana plugin browser? Baca .agents/docs/plans/plugin-browser/README.md`                     |

## Urutan phase dan status

Status: ⬜ belum mulai · 🟡 berjalan/sebagian · ✅ selesai · ⛔ diblokir (lihat catatan) · ⏸️ ditunda (keputusan pemilik).

| Phase | Judul                                                                          | Dikerjakan               | Perlu dari pemilik sebelum mulai                                            | Bergantung pada          | Status |
| ----- | ------------------------------------------------------------------------------ | ------------------------ | --------------------------------------------------------------------------- | ------------------------ | ------ |
| 00    | [Persiapan pemilik: akun toko](phase-00-persiapan-pemilik.md)                  | Pemilik + Claude memandu | ±45 menit, US$5 untuk akun Chrome Web Store, jawaban aturan turunan #1, #12 | —                        | ⬜     |
| 01    | [Fondasi plugin dan pengenal situs loker](phase-01-fondasi.md)                 | Claude + pemilik         | Chrome dan Edge terpasang; di akhir: unggah draf ke dua toko                | — (00 untuk akhir phase) | ⬜     |
| 02    | [Masuk akun dan API server](phase-02-login-api.md)                             | Claude                   | ID item Chrome dan Edge + public key Chrome (dari akhir Phase 01)           | 01                       | ⬜     |
| 03    | [Pembaca situs loker](phase-03-pembaca-situs.md)                               | Claude                   | Opsional: izin Claude membaca LinkedIn lewat Chrome-mu; jawaban #8          | 01                       | ⬜     |
| 04    | [Panel samping dan simpan satu klik](phase-04-panel-simpan.md)                 | Claude                   | Jawaban aturan turunan #2–#5                                                | 02, 03                   | ⬜     |
| 05    | [Kecocokan, AI, persiapan lamaran, pengingat](phase-05-kecocokan-pengingat.md) | Claude                   | Jawaban aturan turunan #6, #7, #11                                          | 04                       | ⬜     |
| 06    | [Web Rezumi, panduan, privasi, materi toko](phase-06-web-panduan-toko.md)      | Claude + review pemilik  | Menyetujui teks privasi dan toko; jawaban #10                               | 05                       | ⬜     |
| 07    | [Uji menyeluruh dan rilis](phase-07-rilis.md)                                  | Claude + pemilik         | ±1 jam uji bersama, akses dasbor toko, izin menjalankan skrip produksi      | Semua                    | ⬜     |

Phase 02 dan 03 boleh dikerjakan dalam urutan apa pun setelah Phase 01, tetapi **satu per satu** di checkout yang sama. Rilis (Phase 07) menunggu semuanya: keputusan pemilik 2026-11-11 menetapkan semua fitur (kecuali isi formulir otomatis) keluar di rilis pertama.

## Aturan wajib untuk setiap sesi agent

Bagian ini untuk Claude. Pemilik tidak perlu menghafalnya.

1. **Baca dulu:** `CLAUDE.md` di root repo, README ini, `00-keputusan.md`, `01-desain.md`, `02-teknis.md`, lalu dokumen phase. Refresh graph (`index_repository`) di awal sesi; cari titik kode dengan graph + grep. Path di dokumen ini dari eksplorasi 2026-11-11: cek ulang sebelum mengandalkannya. Untuk API Chrome/Edge, baca dokumentasi resmi (developer.chrome.com/docs/extensions, learn.microsoft.com/microsoft-edge/extensions) untuk versi saat ini; jangan mengandalkan ingatan. Untuk komponen HeroUI, pakai MCP `heroui-pro`.
2. **Cek prasyarat.** Bila ada yang belum disiapkan pemilik (kolom tabel dan bagian "Untuk pemilik" di phase), berhenti dan sebutkan persis apa yang dibutuhkan serta cara menyiapkannya, langkah demi langkah. Jangan menebak ID, kunci, URL, atau keputusan bisnis.
3. **Keputusan bisnis tidak diubah diam-diam.** Bila implementasi menunjukkan satu keputusan di `00-keputusan.md` tidak bisa atau tidak sebaiknya dipakai, jelaskan pilihannya dan tanya pemilik. Catat jawaban di log keputusan. Aturan turunan (bagian 7) dikonfirmasi di phase yang disebut di tabelnya.
4. **Git:** `git status --short` sebelum mengedit; sesi lain bisa bekerja di checkout yang sama, jadi stage hanya path milik sesi ini. Buat branch `feat/extension-NN-<slug>` dari `main` terbaru. Commit memakai Conventional Commits. Jangan merge ke `main` tanpa persetujuan pemilik.
5. **Server tetap kompatibel.** Perubahan server untuk plugin hanya menambah (prosedur baru, kolom baru, nilai enum baru) dan tidak mengubah perilaku web, mobile, REST, atau MCP yang ada. Buktikan dengan tes yang ada tetap lulus. Ajakan memasang plugin di web tersembunyi sampai URL toko diisi di Phase 07.
6. **Rahasia:** jangan pernah menulis token, password, atau kunci rahasia di kode, dokumen, tes, log, atau chat. ID item toko dan public key Chrome **bukan** rahasia dan boleh ditulis di kode. Pemilik mengunggah ke toko dan membayar sendiri; Claude tidak mengisi formulir pembayaran atau identitas.
7. **Web dulu; app mobile belum dikerjakan** (aturan `CLAUDE.md`). Jangan mengubah, build, atau menjalankan `apps/mobile` kecuali menjaga agar tetap terkompilasi. Logika bersama (kunci loker, JSON-LD, skema capture) ada di `@rezumi/job-sites`.
8. **Privasi (`00-keputusan.md` bagian 6) tidak ditawar:** baca halaman hanya saat diminta, penanda tersimpan dihitung lokal, tanpa analitik pihak ketiga, tanpa kode jarak jauh, tanpa menekan tombol di situs loker, izin seminimal mungkin. Setiap izin baru di manifest harus punya alasan di `02-teknis.md` bagian 12.
9. **Desain dicek dengan mata,** bukan hanya tes: screenshot panel (lebar 360 dan 420 px, terang dan gelap, Inggris dan Indonesia) dan tombol di halaman fixtures empat situs, lewat Playwright dengan plugin dimuat. Sertakan gambar di laporan (SendUserFile, atau Artifact privat untuk banyak gambar).
10. **Kualitas:** string lewat Lingui lalu `pnpm lingui:extract` (terjemahkan id-ID); typecheck dan tes paket yang berubah; `pnpm exec turbo boundaries` bila ekspor/impor antarpaket berubah; `pnpm exec vp lint --fix <path>` dan `pnpm exec vp fmt <path>`; akhiri dengan `pnpm lint:agent` dan `pnpm format:check`; `pnpm check:cloudflare` bila kode server berubah; `pnpm docs:gen` bila spesifikasi API berubah. Laporkan jumlah tes yang benar-benar berjalan; jangan mengaku lulus bila dilewati.
11. **Dokumen ikut diperbarui:** bila rancangan berubah saat implementasi, perbarui `02-teknis.md` (dan `01-desain.md` untuk tampilan). Nomor bagian dirujuk phase lain: tambahkan bagian baru di akhir.
12. **Akhir sesi:** perbarui kolom Status di tabel atas dan tambahkan satu baris di "Catatan sesi" (tanggal, phase, hasil, sisa pekerjaan, tugas pemilik). Lalu beri laporan dengan format di bawah.
13. **Bila konteks sesi hampir habis:** berhenti di titik aman (tes lulus, tidak ada perubahan setengah jadi), set status 🟡, tulis langkah lanjutan yang konkret di "Catatan sesi", dan minta pemilik membuka sesi baru dengan prompt "Lanjutkan Phase NN".

Format laporan akhir untuk pemilik (bahasa awam, singkat):

```text
Phase NN — <judul>: selesai / sebagian
Yang berubah: …
Gambar / cara mengecek sendiri: …
Tes yang dijalankan: … (jumlah lulus/gagal/dilewati)
Belum dikerjakan / risiko: …
Tugasmu sebelum phase berikutnya: …
```

## Isi folder

| File                    | Isi                                                                                                       |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| `00-keputusan.md`       | Keputusan pemilik, cakupan rilis, prinsip privasi, aturan turunan yang menunggu konfirmasi, log keputusan |
| `01-desain.md`          | Titik masuk, layar panel, tombol di halaman, ikon, notifikasi, nada teks, materi toko                     |
| `02-teknis.md`          | Arsitektur, kode yang dipakai ulang, build, login, API server, pembaca halaman, izin, tes, rilis          |
| `phase-00` … `phase-07` | Instruksi tiap phase                                                                                      |
| `backlog-lanjutan.md`   | Ide setelah rilis                                                                                         |
| `materi-toko/`          | Dibuat di Phase 06: teks listing, alasan izin, jawaban privasi, gambar toko                               |
| `checklist-rilis.md`    | Dibuat di Phase 07: daftar uji pemilik, urutan rilis, pemantauan, rencana mundur                          |

## Catatan sesi

| Tanggal    | Phase | Hasil                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Sisa / tugas pemilik                    |
| ---------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 2026-11-11 | —     | Rencana dibuat. Eksplorasi kode: pembaca loker `parsePosting` dan JSON-LD sudah ada, server tidak bisa membaca halaman yang butuh login (alasan utama plugin), OAuth + PKCE seperti app mobile bisa dipakai, plugin perlu didaftarkan sebagai aplikasi resmi supaya tidak terkena gerbang paket "Automation API", tidak ada pencarian lamaran berdasarkan URL (perlu kunci loker baru), skor istilah tanpa AI sudah ada. Keputusan pemilik: gratis untuk semua, empat situs, lengkap sekaligus, Chrome + Edge | Mulai Phase 00 (akun toko) dan Phase 01 |
