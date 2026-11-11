# Phase 07 — Uji menyeluruh dan rilis

| Dikerjakan       | Ukuran | Bergantung pada | Perlu dari pemilik                                                                     |
| ---------------- | ------ | --------------- | -------------------------------------------------------------------------------------- |
| Claude + pemilik | Sedang | Semua phase     | ±1 jam uji bersama, akses dasbor dua toko, izin menjalankan skrip backfill di produksi |

## Untuk pemilik

**Apa yang terjadi:**

1. Claude menyiapkan **daftar uji** dan menjalankan semua tes otomatis.
2. Kamu memasang plugin versi rilis di **Chrome dan Edge-mu** (terhubung ke rezumi.app) dan mencoba daftar uji bersama Claude, termasuk dengan akun Gratis uji.
3. Claude meminta izin untuk mengisi **kunci loker** lamaran lama di produksi (supaya lamaran yang dulu disimpan lewat web juga dikenali plugin).
4. Kamu **mengirim plugin untuk review** di kedua toko, dipandu langkah demi langkah (listing, gambar, jawaban privasi dari Phase 06).
5. Review bisa beberapa hari sampai ±2 minggu. Bila ditolak, kirim alasannya ke Claude.
6. Setelah terbit: Claude mengisi alamat toko di web, sehingga ajakan "Pasang plugin" tampil, lalu memantau laporan halaman gagal.

**Siapkan:** waktu uji ±1 jam, Chrome dan Edge, akses kedua dasbor toko.

**Prompt:** `Kerjakan Phase 07 dari .agents/docs/plans/plugin-browser/README.md`

**Yang bisa kamu cek di akhir:** plugin bisa dipasang dari Chrome Web Store dan Edge Add-ons, dan tombol "Pasang plugin" tampil di halaman Lamaran Rezumi.

## Untuk agent

### Langkah

1. **`checklist-rilis.md`** di folder ini: daftar uji pemilik (Chrome dan Edge × akun Gratis/berbayar × empat situs + satu situs umum: hubungkan, simpan, tersimpan, ubah status, kecocokan, AI dengan kredit, persiapan, pengingat, notifikasi, laporan, keluar, putus dari web), urutan rilis, pemantauan, rencana mundur.
2. **Semua tes otomatis** (unit, API dengan basis data nyata, Playwright plugin, E2E web yang tersentuh), `check:cloudflare`, `lint:agent`, `format:check`. Laporkan angka sebenarnya.
3. **Server di produksi:** pastikan semua perubahan server dari Phase 02–06 sudah di `main` dan ter-deploy (cek `/api/health` dan revisi). Jalankan skrip backfill `source_key` di produksi hanya setelah pemilik mengizinkan secara eksplisit; catat jumlah baris yang diisi.
4. **Build rilis:** versi `1.0.0` (atau sesuai yang disepakati), `REZUMI_URL=https://rezumi.app`, tanpa `key` dev, zip. Muat zip itu (unpacked dari isi zip) dan jalankan ulang uji asap.
5. **Uji bersama pemilik** sesuai checklist di browser pemilik; perbaiki temuan di branch yang sama sebelum mengirim review.
6. **Kirim review:** pandu pemilik mengisi listing, gambar, alasan izin, formulir privasi, URL Kebijakan Privasi, dan mengunggah zip rilis di kedua toko. Claude tidak mengklik tombol kirim di dasbor pemilik.
7. **Setelah terbit:** isi konstanta URL toko di web (Phase 06), tambahkan versi rilis dan tanggal di `02-teknis.md` bagian 15, terbitkan panduan dan legal (hapus tanda draf bila pemilik sudah setuju), umumkan sesuai keinginan pemilik.
8. **Pemantauan minggu pertama:** email laporan halaman, galat API dengan header `x-rezumi-extension`, ulasan toko. Catat temuan dan perbaikan di "Catatan sesi".

### Rencana mundur

- Masalah server: revert PR server atau matikan prosedur baru; plugin menampilkan galat 3.7 tanpa kehilangan isian.
- Masalah plugin: unggah perbaikan dengan nomor versi lebih tinggi; bila berbahaya, sembunyikan item di toko dan set `EXTENSION_MIN_VERSION` agar versi rusak berhenti memanggil API.
- Ajakan di web: kosongkan konstanta URL toko.

### Selesai bila

- Plugin terbit di Chrome Web Store dan Edge Add-ons.
- Ajakan pasang tampil di web; panduan dan legal terbit.
- Checklist rilis lengkap dan dicatat.
