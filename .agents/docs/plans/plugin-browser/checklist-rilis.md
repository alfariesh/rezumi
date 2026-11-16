# Checklist rilis — plugin browser Rezumi (Phase 07)

Untuk pemilik dan Claude. Isi kolom "Hasil" saat mencoba (✅ / ❌ + catatan). Temuan ❌ diperbaiki di branch yang sama sebelum
plugin dikirim ke toko.

## 0. Sebelum mulai

| Siap? | Yang dibutuhkan                                                                                                                               |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| ⬜    | Chrome dan Microsoft Edge versi 116 atau lebih baru di komputer                                                                               |
| ⬜    | Dua akun uji di rezumi.app: satu **Gratis** (baru dibuat, kredit 0) dan satu **berbayar atau admin** (punya kredit Rezumi AI)                 |
| ⬜    | Akses dasbor **Chrome Web Store** dan **Edge Add-ons**                                                                                        |
| ⬜    | Chrome Web Store: email kontak penayang `hi@rezumi.app` sudah **diverifikasi** (Dasbor → Setelan → Akun). Tanpa ini review tidak bisa dikirim |
| ⬜    | Satu lowongan nyata di tiap situs: LinkedIn, Indeed, JobStreet, Glints, dan satu situs lain (mis. halaman karier perusahaan)                  |

### Memasang versi uji

Claude membangun **release candidate**: build toko (`https://rezumi.app`) yang juga membawa kunci toko, sehingga ID-nya sama
dengan ID di toko dan masuk ke rezumi.app diterima sebagai aplikasi resmi. Folder: `apps/extension/dist` di worktree
`rezumi-extension` (Claude menyebut alamat lengkapnya).

1. Chrome: buka `chrome://extensions` → nyalakan **Developer mode** → **Load unpacked** → pilih folder `dist`.
   Edge: `edge://extensions` → **Developer mode** → **Load unpacked** → folder yang sama.
2. Sematkan ikon Rezumi di toolbar.
3. Setelah Claude membangun ulang: tekan ikon muat ulang di kartu plugin, lalu muat ulang tab lowongan.

Folder ini **bukan** paket toko: paket toko adalah zip dari build tanpa kunci (`pnpm --filter extension zip`).

## 1. Uji bersama

Jalankan seluruh daftar untuk: **Chrome + akun Gratis**, **Chrome + akun berbayar**, **Edge + akun Gratis**. Untuk Edge dengan akun
berbayar cukup bagian 1.5 dan 1.7.

### 1.1 Hubungkan dan keluar

| #     | Langkah                                                                                           | Harapan                                                                              | Chrome | Edge |
| ----- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------ | ---- |
| 1.1.1 | Buka panel (klik ikon) → **Hubungkan ke Rezumi**                                                  | Jendela Rezumi terbuka; setelah masuk dan **Allow access** panel menampilkan beranda | ⬜     | ⬜   |
| 1.1.2 | Pengaturan (ikon gir)                                                                             | Nama, email, dan paket akun benar                                                    | ⬜     | ⬜   |
| 1.1.3 | **Keluar**, lalu hubungkan lagi                                                                   | Kembali ke layar "Hubungkan"; hubungkan lagi berjalan (consent tidak diminta lagi)   | ⬜     | ⬜   |
| 1.1.4 | Hubungkan, lalu di Rezumi buka Pengaturan → Aplikasi yang terhubung → **Cabut akses** pada plugin | Panel menampilkan "Sambungan ke Rezumi berakhir" + tombol hubungkan lagi             | ⬜     | ⬜   |

### 1.2 Tombol dan penanda di empat situs

Untuk **LinkedIn, Indeed, JobStreet, Glints** (satu lowongan masing-masing):

| #     | Langkah                                           | Harapan                                                                                                   | Hasil |
| ----- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----- |
| 1.2.1 | Buka lowongan                                     | Tombol **Simpan ke Rezumi** tampil dekat tombol situs, tidak menutupi isi, tidak membuat halaman lambat   | ⬜    |
| 1.2.2 | Klik tombol                                       | Panel samping terbuka dengan pratinjau; posisi, perusahaan, lokasi terisi benar (gaji dan jenis bila ada) | ⬜    |
| 1.2.3 | Ganti ke lowongan lain tanpa memuat ulang halaman | Pratinjau mengikuti lowongan yang dibuka                                                                  | ⬜    |
| 1.2.4 | Tutup panel lalu buka lagi di tab yang sama       | Ubahan yang belum disimpan masih ada                                                                      | ⬜    |

### 1.3 Simpan

| #     | Langkah                                                                    | Harapan                                                                                             | Hasil |
| ----- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----- |
| 1.3.1 | Ubah posisi, pilih **Disimpan**, tekan **Simpan ke Rezumi**                | Selesai dalam < 3 detik; panel "Tersimpan di Rezumi"; tombol di halaman jadi tanda **Tersimpan**    | ⬜    |
| 1.3.2 | Buka rezumi.app → Lamaran                                                  | Lamaran ada, ada alamat lowongan, tulisan "Disimpan dari plugin", logo perusahaan (atau inisial)    | ⬜    |
| 1.3.3 | Buka lagi lowongan yang sama                                               | Tanda **Tersimpan** tampil di halaman dan ikon toolbar bercentang hijau; panel menampilkan yang ada | ⬜    |
| 1.3.4 | Simpan lowongan yang sama dari situs lain (posisi + perusahaan sama)       | Panel memperingatkan lowongan serupa tanpa memblokir                                                | ⬜    |
| 1.3.5 | Pilih **Sudah dilamar**                                                    | Tanggal tampil (bawaan hari ini); lamaran tersimpan dengan tahap Applied                            | ⬜    |
| 1.3.6 | Lowongan yang deskripsinya memuat email/telepon HR: centang kontak, simpan | Hanya kontak yang dicentang masuk ke lamaran                                                        | ⬜    |
| 1.3.7 | Putuskan internet (mode pesawat) lalu simpan                               | Pesan offline, isian tetap ada; setelah online, **Coba lagi** berhasil                              | ⬜    |

### 1.4 Situs lain dan teks terpilih

| #     | Langkah                                                                          | Harapan                                                                                        | Hasil |
| ----- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----- |
| 1.4.1 | Di halaman karier perusahaan (situs lain): **tidak** klik apa pun, lihat halaman | Tidak ada tombol atau perubahan di halaman                                                     | ⬜    |
| 1.4.2 | Klik ikon toolbar di halaman itu                                                 | Panel membaca lowongan (atau menawarkan tempel deskripsi bila tidak terbaca)                   | ⬜    |
| 1.4.3 | Blok teks deskripsi → klik kanan → **Simpan teks terpilih ke Rezumi**            | Panel terbuka dengan teks terpilih sebagai deskripsi                                           | ⬜    |
| 1.4.4 | Tekan `Alt+Shift+S` (bila pintasan bentrok, atur di halaman pintasan browser)    | Panel terbuka                                                                                  | ⬜    |
| 1.4.5 | Halaman yang bukan lowongan (mis. beranda berita)                                | "Kami tidak menemukan lowongan"; **Laporkan halaman ini** terkirim, ucapan terima kasih tampil | ⬜    |

### 1.5 Ubah status, catatan, kecocokan

| #     | Langkah                                                 | Harapan                                                                    | Hasil |
| ----- | ------------------------------------------------------- | -------------------------------------------------------------------------- | ----- |
| 1.5.1 | Di panel lamaran tersimpan: ubah status; tambah catatan | Status dan catatan terlihat di rezumi.app; tanda di halaman ikut berubah   | ⬜    |
| 1.5.2 | Bagian **Kecocokan**: pilih CV lain                     | Persentase dan daftar kata kunci berubah; pilihan diingat saat dibuka lagi | ⬜    |

### 1.6 AI dan kredit (butuh akun berbayar; akun Gratis untuk pesan "kredit habis")

| #     | Langkah                                                                 | Harapan                                                                   | Hasil |
| ----- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----- |
| 1.6.1 | Nyalakan **Baca dengan AI** (1 kredit) di lowongan yang kolomnya kurang | Biaya dan saldo tampil sebelum menyala; kolom terisi; saldo berkurang 1   | ⬜    |
| 1.6.2 | Akun Gratis tanpa kredit: nyalakan Baca dengan AI                       | "Kreditmu habis" + **Lihat paket** + **Simpan tanpa AI**; isian tetap ada | ⬜    |
| 1.6.3 | Lamaran tersimpan → **Skor AI** (4 kredit)                              | Skor dan alasan tampil; skor yang sama terlihat di rezumi.app             | ⬜    |

### 1.7 Persiapan dan pengingat

| #     | Langkah                                                                                  | Harapan                                                                                                   | Hasil |
| ----- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----- |
| 1.7.1 | **Sesuaikan CV**                                                                         | Rezumi terbuka di tab baru dengan dialog "salin CV untuk lamaran ini"                                     | ⬜    |
| 1.7.2 | **Tulis surat lamaran**                                                                  | Surat terbuat dan editor terbuka; tombol berubah jadi "Buka surat lamaran"                                | ⬜    |
| 1.7.3 | Pasang pengingat hari ini lalu simpan                                                    | Beranda panel: **Jatuh tempo** menampilkannya; ikon toolbar berangka merah di tab lain                    | ⬜    |
| 1.7.4 | **Selesai** pada pengingat                                                               | Hilang dari daftar; angka di ikon hilang                                                                  | ⬜    |
| 1.7.5 | Pengaturan → nyalakan **Pengingat desktop**, izinkan di browser; atur pengingat hari ini | Setelah pukul 09.00 muncul satu notifikasi "Tindak lanjut hari ini"; klik membuka lamaran; tidak berulang | ⬜    |

### 1.8 Tampilan, bahasa, privasi

| #     | Langkah                                                                               | Harapan                                                                                  | Hasil |
| ----- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----- |
| 1.8.1 | Pengaturan → bahasa Indonesia / English                                               | Panel dan tombol di halaman berganti langsung                                            | ⬜    |
| 1.8.2 | Tema terang dan gelap di browser                                                      | Panel terbaca, kontras baik                                                              | ⬜    |
| 1.8.3 | Pengaturan → matikan **Tombol di situs loker**                                        | Tombol hilang; ikon dan pintasan tetap jalan                                             | ⬜    |
| 1.8.4 | Buka DevTools (F12) → tab Network di halaman LinkedIn, lihat saat menelusuri lowongan | Tidak ada permintaan ke rezumi.app per halaman yang dikunjungi (hanya saat panel/simpan) | ⬜    |
| 1.8.5 | Lihat halaman `chrome://extensions` → Rincian plugin                                  | Izin yang tercantum sama dengan `izin.md`; tidak ada "baca riwayat penjelajahan"         | ⬜    |

### 1.9 Dicopot

| #     | Langkah                   | Harapan                                                                                 | Hasil |
| ----- | ------------------------- | --------------------------------------------------------------------------------------- | ----- |
| 1.9.1 | Hapus plugin dari browser | Tab baru terbuka ke rezumi.app/extension/removed dalam bahasa plugin; lamaran tetap ada | ⬜    |

## 2. Urutan rilis

1. Semua tes otomatis hijau; server Phase 02–06 sudah di `main` dan ter-deploy (dicek Claude, dicatat di README).
2. **Backfill kunci loker** di produksi, hanya dengan izin pemilik (`pnpm --filter @rezumi/tooling extension:backfill-keys`;
   mulai dengan `--dry-run`). Jumlah baris dicatat.
3. Versi rilis di `apps/extension/package.json` (1.0.0), `pnpm --filter extension zip` → `apps/extension/release/rezumi-extension-1.0.0.zip`.
4. Uji bersama (bagian 1) dengan release candidate; perbaiki temuan; bangun ulang zip.
5. Pemilik mengunggah zip ke **Chrome Web Store** (item `fiogmglhgeiaaeajahbpmmehgmojbjjo`) dan **Edge Add-ons**, mengisi
   listing, gambar, alasan izin, privasi (dari `materi-toko/`), lalu **mengirim untuk review** sendiri. Claude memandu, tidak
   mengklik kirim.
6. Review (beberapa hari sampai ±2 minggu). Bila ditolak: kirim alasannya ke Claude.
7. Setelah terbit di kedua toko: Claude mengisi `EXTENSION_STORE_URLS` di web, menyetel tanggal berlaku kebijakan privasi,
   mencatat versi dan tanggal di `02-teknis.md` §15; PR ini di-merge.
8. Pengumuman sesuai keinginan pemilik.

## 3. Pemantauan minggu pertama

- Email ringkasan **laporan halaman gagal** (ke `BILLING_ALERT_EMAIL`, paling sering sekali per jam): situs mana yang gagal, kolom apa.
- Galat API dengan header `x-rezumi-extension` (log Worker): lonjakan 4xx/5xx, `EXTENSION_OUTDATED`.
- Ulasan dan pertanyaan di kedua toko; email `hi@rezumi.app`.
- Pemantauan produksi yang ada (`monitor-production.yml`, halaman status).
- Catat temuan dan perbaikan di "Catatan sesi" README.

## 4. Rencana mundur

| Masalah             | Tindakan                                                                                                                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server              | Revert PR server atau matikan prosedur baru; plugin menampilkan galat "Rezumi sedang bermasalah" tanpa kehilangan isian                                                                                                                                 |
| Plugin rusak        | Unggah perbaikan dengan **nomor versi lebih tinggi** (toko tidak menerima versi turun). Bila berbahaya: sembunyikan item di toko dan set `EXTENSION_MIN_VERSION` di Worker agar versi rusak berhenti memanggil API (pengguna melihat "Perbarui plugin") |
| Situs loker berubah | Perbaiki pembaca + fixture, rilis versi baru (±1 minggu); cara umum dan teks terpilih tetap jalan                                                                                                                                                       |
| Ajakan di web       | Kosongkan `EXTENSION_STORE_URLS` (satu PR kecil)                                                                                                                                                                                                        |
| Akses bocor / token | Cabut klien lewat Pengaturan → Aplikasi yang terhubung; di server, hapus consent klien plugin                                                                                                                                                           |

## 5. Hasil uji bersama (diisi saat uji)

| Tanggal | Peserta | Browser + akun | Temuan | Status perbaikan |
| ------- | ------- | -------------- | ------ | ---------------- |
|         |         |                |        |                  |
