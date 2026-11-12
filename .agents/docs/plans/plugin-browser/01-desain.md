# Desain — plugin browser

Alur dan layar plugin. Nomor bagian dirujuk dokumen phase; bagian baru ditambahkan di akhir.

## 1. Prinsip

- **Terasa seperti Rezumi.** Panel memakai komponen HeroUI dan token warna yang sama dengan web (`@rezumi/ui`, `packages/ui/src/styles/globals.css`), ikon dari `packages/icons`. Terang/gelap mengikuti browser.
- **Ringkas.** Panel samping lebarnya ±360–420 px. Satu tindakan utama per layar: "Simpan ke Rezumi" sebelum tersimpan, "Buka di Rezumi" sesudahnya.
- **Tidak mengganggu situs loker.** Tombol di halaman kecil, mengikuti letak tombol situs, tidak menutupi isi, dan bisa dimatikan.
- **Isian tidak pernah hilang.** Pratinjau yang sudah diubah tetap ada sampai tersimpan atau dibuang pengguna, juga saat panel ditutup lalu dibuka lagi di tab yang sama.
- **Bisa dipakai dengan keyboard** dan pembaca layar: urutan fokus jelas, hasil simpan diumumkan (`aria-live`), kontras AA.

## 2. Titik masuk

1. **Ikon toolbar** → membuka panel samping untuk tab yang sedang aktif.
2. **Tombol di halaman** (LinkedIn, Indeed, JobStreet, Glints) di dekat tombol Lamar/Simpan milik situs: "Simpan ke Rezumi". Bila loker sudah tersimpan, tombol berubah menjadi chip "Tersimpan · Dilamar" yang membuka panel. Bila tempat yang biasa tidak ditemukan, tombol kecil melayang di pojok kanan bawah (bisa ditutup per situs).
3. **Pintasan keyboard** `Alt+Shift+S` (bisa diubah pengguna di pengaturan pintasan browser).
4. **Menu klik kanan** "Simpan teks terpilih ke Rezumi" saat ada teks yang diblok, untuk situs yang tidak terbaca.

## 3. Layar panel

### 3.1 Belum terhubung

Logo, satu kalimat ("Simpan lowongan dari situs mana pun ke pelacak lamaranmu"), tombol utama **Hubungkan ke Rezumi**, tautan "Belum punya akun? Daftar gratis". Setelah login, panel kembali ke tab yang sama dan langsung membaca lowongannya.

### 3.2 Beranda (tab bukan halaman loker)

- Teks kosong: "Buka halaman lowongan untuk menyimpannya."
- **Jatuh tempo:** lamaran dengan tanggal tindak lanjut hari ini atau lewat (posisi, perusahaan, tanggal, tombol "Selesai" yang mengosongkan pengingat).
- **Terakhir disimpan:** lima lamaran terbaru (posisi, perusahaan, status). Klik → buka di Rezumi.
- Tombol "Buka pelacak lamaran".

### 3.3 Loker terdeteksi, belum tersimpan

Dari atas ke bawah:

1. **Kartu pratinjau:** ikon situs, posisi, perusahaan, lokasi, gaji. Semua kolom bisa diubah langsung. Peringatan kecil bila deskripsi terpotong atau tidak lengkap.
2. **Deskripsi dan syarat** (terlipat bawaan; bisa dibuka dan diubah).
3. **Kecocokan:** pemilih CV, persentase istilah yang cocok, chip kata kunci "ada" dan "belum ada" (paling banyak 12, sisanya "+N").
4. **Form simpan:** status bersegmen **Disimpan / Sudah dilamar** (bila Sudah dilamar, muncul tanggal); tag; pengingat (tanggal + catatan singkat).
5. Saklar **Baca dengan AI** dengan biaya ("1 kredit") dan saldo kredit; mati bila tidak ada AI yang bisa dipakai, dengan alasannya.
6. Tombol utama **Simpan ke Rezumi**. Setelah berhasil, layar berganti ke 3.4 dan tombol di halaman berubah menjadi chip.

### 3.4 Sudah tersimpan

- Kepala: "Tersimpan di Rezumi · 3 hari lalu" + status (dropdown, langsung tersimpan).
- **Kecocokan** seperti 3.3, ditambah tombol **Skor AI (4 kredit)** yang menampilkan skor dan ringkasan alasan.
- **Persiapan:** Sesuaikan CV · Tulis surat lamaran · Buka di Rezumi (masing-masing membuka tab web di bagian yang tepat).
- **Pengingat** (ubah tanggal/catatan) dan **Tambah catatan**.
- Tautan kecil "Simpan sebagai lamaran baru" (aturan turunan #4).

### 3.5 Bukan halaman loker, atau gagal dibaca

"Kami tidak menemukan lowongan di halaman ini." Pilihan:

- **Pakai teks yang saya blok** (aktif bila ada teks terpilih di halaman).
- **Tempel deskripsi** (kotak teks).
- **Laporkan halaman ini** (aturan turunan #8) → "Terima kasih, kami akan memeriksanya."

### 3.6 Halaman hasil pencarian

Bila situs menampilkan daftar tanpa lowongan terpilih: "Pilih satu lowongan untuk menyimpannya." Bila daftar dengan panel detail (LinkedIn, Indeed, JobStreet), panel plugin mengikuti lowongan yang sedang dibuka di panel detail situs.

### 3.7 Galat

Isian tetap ada di setiap galat. Pesan singkat + satu tindakan:

| Keadaan                    | Pesan dan tindakan                                              |
| -------------------------- | --------------------------------------------------------------- |
| Tidak ada internet         | "Kamu sedang offline. Kami simpan isianmu di sini." · Coba lagi |
| Sesi berakhir / diputus    | "Sambungan ke Rezumi berakhir." · Hubungkan lagi                |
| Terlalu banyak permintaan  | "Tunggu sebentar lalu coba lagi."                               |
| Kredit habis / butuh paket | "Kreditmu habis." · Lihat paket (tab web) · Simpan tanpa AI     |
| Plugin terlalu lama        | "Perbarui plugin untuk lanjut." · Cara memperbarui              |
| Server bermasalah          | "Rezumi sedang bermasalah." · Coba lagi · Status layanan        |

### 3.8 Pengaturan plugin

Akun yang terhubung (nama, email, paket), bahasa (ikuti browser / Inggris / Indonesia), CV bawaan untuk skor, tombol di halaman situs (nyala/mati), notifikasi desktop (nyala/mati), pintasan keyboard (tautan ke pengaturan browser), Keluar.

## 4. Tombol dan chip di halaman

- Dirender dalam Shadow DOM tertutup supaya gaya situs tidak bocor ke tombol dan sebaliknya.
- Ukuran dan sudut menyesuaikan tombol situs di sebelahnya; warna aksen Rezumi; teks pendek; ikon logo kecil.
- Keadaan: **Simpan ke Rezumi** → **Menyimpan…** → **Tersimpan · <status>** (chip) · gagal → "Coba lagi" + buka panel.
- Klik tombol: membuka panel dengan pratinjau. Bila browser tidak mengizinkan panel dibuka dari tombol di halaman (dicek di Phase 04), klik langsung menyimpan dengan pengaturan bawaan, lalu chip menawarkan "Ubah di panel" lewat ikon toolbar.
- Tidak tampil di halaman yang bukan loker, dan hilang bila pengguna mematikannya di pengaturan.

## 5. Ikon toolbar

- Centang hijau di tab yang berisi loker tersimpan.
- Angka merah = jumlah lamaran jatuh tempo, di tab lain.
- Judul ikon (tooltip) menjelaskan keadaan: "Rezumi — loker ini sudah tersimpan".

## 6. Notifikasi desktop

"Tindak lanjut hari ini: <posisi> di <perusahaan>". Klik → membuka lamaran di Rezumi. Aturan frekuensi: aturan turunan #7.

## 7. Teks dan nada

Bahasa Indonesia sehari-hari, kalimat pendek, sapaan "kamu", istilah Rezumi yang sama dengan web ("Lamaran", "Disimpan", "Sudah dilamar"). Contoh tombol: "Simpan ke Rezumi", "Hubungkan ke Rezumi", "Buka di Rezumi". Hindari istilah teknis ("token", "API", "JSON").

## 8. Materi toko

Disiapkan di Phase 06 dengan persona fiktif:

- Ikon 128×128 (plus 16, 32, 48 untuk browser).
- Lima tangkapan layar 1280×800: tombol di LinkedIn, panel pratinjau, kecocokan + kata kunci, tersimpan + persiapan, pengingat. Masing-masing versi Inggris dan Indonesia.
- Ubin promosi kecil 440×280.
- Deskripsi singkat (≤132 karakter) dan panjang, Inggris dan Indonesia.
