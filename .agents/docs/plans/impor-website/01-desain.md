# Desain — alur dan layar

Untuk pemilik dan agent. Teks UI di bawah adalah arah, bukan teks final; teks final lewat Lingui (Inggris + Indonesia).

## Alur pengguna (onboarding)

1. **Bawa data (`bring`)** — kolom Website sudah ada. Di bawahnya muncul centang baru: **"Ini situs saya sendiri — impor juga karya saya ke portfolio"** (D1). Bila alamatnya Behance, Dribbble, atau LinkedIn: pesan "Belum bisa membaca Behance/Dribbble. Pakai alamat situs pribadimu, atau tambahkan karya nanti di portfolio." (LinkedIn diarahkan ke kolom LinkedIn.) Label harga di samping kolom: "Gratis untuk impor pertama" atau "5 kredit" (W2, W3).
2. **Pertanyaan (`questions`)** — pengguna lanjut menjawab seperti biasa. Impor berjalan di belakang dengan progres yang sudah ada (`source-progress`), diperluas:
   - "Membaca situsmu…"
   - "Menemukan 8 halaman karya"
   - "Membaca karya 3 dari 8…"
   - "Selesai: 7 karya ditemukan"
3. **Review (`review`)** — bagian Profil seperti sekarang, ditambah bagian baru **"Karya dari situsmu"**:
   - Kartu per work: gambar sampul kecil, judul, ringkasan satu baris, tahun, peran, tag, jumlah gambar, link sumber (halaman asli).
   - Semua dicentang (W1). Pengguna bisa membuang centang. Klik kartu → detail ringkas (ringkasan lengkap, galeri kecil) tanpa mengedit; pengeditan di editor portfolio.
   - Paket Gratis: bila works ditemukan > sisa kuota (6 dikurangi works yang sudah ada), centang dibatasi ke sisa kuota, kartu lain abu-abu dengan teks "Paket Gratis memuat 6 karya. Upgrade untuk menambah semuanya." (W4).
   - Teks kecil: "Karya disimpan ke portfolio yang belum tayang. Kamu yang memutuskan kapan mempublikasikannya." (D4) dan "Gambar disalin ke penyimpanan portfoliomu (dihitung ke kuota)." (W5)
4. **Simpan** — Profil disimpan seperti sekarang (proyek ikut masuk, D3). Lalu works disimpan ke portfolio. Progres: "Menyalin gambar 12 dari 30…". Bila sebagian gambar gagal atau kuota habis: works tetap tersimpan, pesan "3 gambar tidak bisa disalin" atau "Penyimpanan penuh: karya disimpan tanpa gambar".
5. **CV (`resume`)** — tidak berubah. Di layar akhir onboarding tambahkan tautan "Lihat portfoliomu (belum tayang)" bila works tersimpan.

## Di luar onboarding

- **Profil → Isi dari sumber** (`apps/web/src/features/profile/fill.tsx`): alur yang sama (kolom, centang, progres, review).
- **Editor portfolio → daftar Works**: tombol **"Impor dari website"** di keadaan kosong dan di menu tambah work. Membuka dialog: kolom alamat + centang + harga → progres → review works saja (tanpa bagian Profil) → simpan. Works yang sudah pernah diimpor dari halaman yang sama ditandai "Sudah ada" dan tidak dicentang.

## Keadaan khusus

| Keadaan                                  | Yang tampil                                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Situs tidak bisa dibaca                  | Pesan yang sudah ada (pembaca website), tanpa potong kredit.                                                 |
| Profil terbaca, tidak ada halaman karya  | Review Profil saja + teks "Tidak ada karya yang ditemukan di situs ini." Tetap dihitung berhasil (W2).       |
| Situs satu halaman (karya di beranda)    | Works diambil dari beranda itu sendiri.                                                                      |
| Beberapa halaman karya gagal dibaca      | Works lain tetap tampil + catatan "2 halaman tidak bisa dibaca."                                             |
| Lebih dari 10 kandidat                   | 10 teratas; catatan "Situsmu punya lebih banyak karya. Tambahkan sisanya dari editor portfolio."             |
| Batas harian (D2)                        | "Kamu sudah mengimpor 3 website hari ini. Coba lagi besok."                                                  |
| Pengguna menutup tab saat impor berjalan | Hasil hilang tanpa potong kredit bila AI belum selesai (cara kerja sumber sekarang). Lihat `02-teknis.md` 6. |
| Tamu (akun anonim)                       | Kolom Website tidak tersedia, seperti sekarang.                                                              |

## Cek tampilan

Desktop dan ponsel, terang dan gelap, Inggris dan Indonesia. Warna lewat token, bukan warna tetap (aturan pemilik).

## Hasil Phase 03 (2026-11-27)

- Centang di bawah kolom Website: "Ini situs saya sendiri. Impor juga karya saya ke portfolio." Label AI di kolom berubah jadi "Rezumi AI · gratis kali ini" untuk impor gratis, atau "5 kredit".
- Progres: "Membaca situs Anda…", "Menemukan 8 halaman karya", "Membaca karya 3 dari 8…", "Menyusun karya Anda…"; selesai: temuan Profil + "Dan 8 karya untuk portfolio Anda".
- Review "Karya dari situs Anda": kartu dengan sampul, judul, peran · tahun, ringkasan satu baris, jumlah gambar; panah membuka ringkasan lengkap, tag, deretan gambar, dan link halaman asli (baca saja). Kotak Upgrade muncul bila karya baru lebih banyak dari sisa kuota.
- Tombol simpan onboarding: "Simpan ke Profil & portfolio" (dipendekkan supaya muat di ponsel), lalu "Menyalin gambar 12 dari 30…". Langkah CV menampilkan "6 karya dari situs Anda sudah ada di portfolio Anda" + "Lihat portfolio Anda (belum tayang)".
- Editor portfolio: kartu "Impor dari website" di dialog Tambah work, dan tombol yang sama di bawah "Add your first work" saat daftar kosong.
- Sapaan Indonesia mengikuti aplikasi: "Anda", bukan "kamu".
