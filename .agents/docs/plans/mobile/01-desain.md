# Desain — navigasi, alur, dan tampilan app

Sumber kebenaran tampilan adalah `apps/web/DESIGN.md` (web) dan, setelah Phase 02, `apps/mobile/DESIGN.md` (turunan untuk app). Dokumen ini menjelaskan **apa yang dilihat pengguna** di app baru. Nama menu ditulis dalam bahasa Inggris seperti di app; terjemahan Indonesia mengikuti katalog web.

## 1. Prinsip

1. **Satu produk, dua layar.** Warna, font, ikon, istilah, dan urutan menu sama dengan web. Yang berbeda hanya cara menyentuhnya.
2. **Terasa asli di tiap platform.** iOS: judul besar yang mengecil saat digulir, lembar bawah dengan pegangan, geser dari tepi untuk kembali. Android: tombol/gestur kembali selalu bekerja dan bisa ditebak, layar sampai ke tepi (edge-to-edge), riak sentuh. Komponen sistem dipakai untuk pemilih tanggal, sakelar, dan lembar bagikan.
3. **Satu aksi utama per layar.** Aksen biru hanya untuk aksi, pilihan, dan progres.
4. **Ibu jari dulu.** Aksi utama di bawah (tombol menempel di atas keyboard atau di kaki lembar); target sentuh minimal 44 pt; isian minimal 16 pt supaya iOS tidak memperbesar layar.
5. **Selalu ada keadaan.** Setiap layar punya memuat (kerangka), kosong (satu kalimat + aksi), gagal (pesan + coba lagi), dan offline (isi terakhir + penanda).
6. **Batalkan, bukan konfirmasi.** Aksi yang bisa dibalik langsung jalan dengan toast "Undo". Konfirmasi hanya untuk yang permanen.
7. **Aksesibel.** Label pembaca layar di semua kontrol, urutan fokus masuk akal, teks besar tidak memotong isi, gerak dikurangi bila sistem memintanya, kontras lolos di terang dan gelap.

## 2. Navigasi

### 2.1 Ponsel

```text
Tab bawah (5)
├ Home         Recent documents · Needs you · New roles · Coming up · Schedules
├ Documents    All · Resumes · Letters · Trash          (segmen di atas daftar)
├ Applications All (List | Board | Calendar) · Jobs · Insights · Offers
├ Portfolio    ringkasan, statistik, pesan; tombol Edit membuka editor   (disembunyikan bila akun belum mendapat Portofolio)
└ Profile      Details · Career · Facts · Stories · Preferences

Bar atas di setiap tab: judul · Coach (ikon kilau) · Search · avatar
Avatar → Account, Plan, App settings, Help & legal, Sign out
Tombol Baru (mengambang) di Home dan Documents → New resume · New letter · Import · Save a job
```

Editor layar penuh (tanpa tab bawah): pembuat CV, pembuat surat, editor Portofolio, ruang kerja lamaran, Coach layar penuh.

### 2.2 Tablet, iPad, ponsel lipat terbuka (lebar ≥ 700)

Sidebar kiri dengan urutan yang sama dengan web (Home, Portfolio, Documents, Profile, Applications), tombol New di kaki sidebar, Coach sebagai panel kanan. Daftar + detail berdampingan di Documents, Applications, Jobs, dan pesan Portofolio. Editor: isian di kiri, pratinjau di kanan.

### 2.3 Tautan

Tautan `https://rezumi.app/dashboard/...`, `/builder/...`, dan tautan notifikasi lama (`/dashboard/career…`) membuka layar yang sepadan di app. Peta lengkap: `02-teknis.md` bagian 7.

## 3. Alur pertama kali

```text
Buka app pertama kali
→ Perkenalan (3 layar, bisa dilewati): Buat CV dalam hitungan menit · Lacak lamaran dan cari lowongan · Portofolio dan Coach
→ Masuk / Daftar
   [Continue with Apple]   (iOS)
   [Continue with Google]
   Email + kata sandi  ·  Create account  ·  Forgot password?
   More options → GitHub, LinkedIn, Passkey (lembar browser di dalam app)
   Try without an account (tamu, bila server mengizinkan)
→ Daftar: nama, email, kata sandi → "Cek emailmu" (kode/tautan verifikasi) → masuk
→ Akun baru tanpa Profil dan tanpa dokumen → Onboarding
   1. Bawa yang kamu punya: LinkedIn · GitHub · situs · file CV · atau mulai kosong
   2. Dua pertanyaan: peran yang dicari, lokasi/negara
   3. Tinjau hasil (bisa diedit)
   4. Pilih template → CV pertama terbuka di pembuat CV
→ Home
```

Akun lama yang masuk di perangkat baru langsung ke Home. Izin notifikasi diminta saat pengguna pertama kali membuat pengingat atau notifikasi lowongan, dengan satu layar penjelasan sebelum dialog sistem.

## 4. Layar per area

| Area          | Layar utama                                                                                                                                                                                                                                           | Catatan desain                                                                                                                                |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Home          | Baris geser dokumen terbaru (gambar halaman pertama) · Needs you (termasuk "Posting closed") · New roles dari notifikasi lowongan · Coming up · Schedules                                                                                             | Tarik untuk menyegarkan. Lencana tab = notifikasi belum dibaca.                                                                               |
| Documents     | Daftar/kisi dengan pratinjau, cari, urut, tag · menu dokumen (ganti nama, kunci, duplikat, salin untuk lowongan, buang) · Trash                                                                                                                       | Tekan lama = menu; geser baris = aksi cepat.                                                                                                  |
| Pembuat CV    | Mode **Write · Design · Check** di bar bawah editor; pratinjau PDF asli satu ketukan; asisten AI sebagai lembar; History; Share & export                                                                                                              | Penanda "beda dari Profil" dengan Use Profile's / Save to Profile. Template: galeri bergambar dengan filter bidang karier, preset, gaya ikon. |
| Pembuat surat | Write · Design · asisten · export; pilihan From (Profile, sebuah CV, atau isi sendiri)                                                                                                                                                                | Bentuk sama dengan pembuat CV.                                                                                                                |
| Profile       | Details · Career (isian yang sama dengan Write) · Facts · Stories · Preferences · Bring what you have                                                                                                                                                 | Kata "Knowledge" diganti "Profile" di seluruh app.                                                                                            |
| Jobs          | Kotak cari (peran, kota, negara) terisi dari Profil · filter sebagai lembar · kartu lowongan dengan chip kecocokan · lembar detail: Your fit, Track, Tailor resume, View original, Hide · pencarian terakhir · sisa kuota · simpan sebagai notifikasi | "View original" selalu ada dan membuka browser. Teks dari penyedia tampil sebagai teks biasa.                                                 |
| Applications  | List, Board (geser antar tahap), Calendar (hari/minggu) · Insights · Offers · lembar detail · ruang kerja 7 bagian: Fit, Apply, Prepare, Practice, Debrief, Messages, Saved                                                                           | Board di ponsel: satu kolom per layar, geser ke samping. Latihan suara meminta izin mikrofon saat dipakai.                                    |
| Coach         | Lembar dari bar atas di tab mana pun; bisa dibesarkan ke layar penuh; daftar percakapan; lampiran                                                                                                                                                     | Persetujuan AI per operasi tetap muncul sebelum data dikirim.                                                                                 |
| Portfolio     | Tab: status (terbit/draf), alamat + salin/bagikan, kartu QR, statistik 7/30/90 hari, pesan masuk · Editor: Content · Work · Design · Publish dengan tombol Preview · asisten AI                                                                       | Pratinjau = halaman asli dari server. Kartu Lokasi dan lembar cetak: baris "Atur di web".                                                     |
| Account       | Account · Plan (nama paket, kredit, riwayat; tanpa harga) · App settings (tema, bahasa, zona waktu, AI providers, MCP) · Help & legal · Report an issue · Sign out · Delete account                                                                   | Dua halaman pengaturan seperti web, ditambah baris khusus app (notifikasi, lisensi).                                                          |
| Search        | Satu kotak: dokumen, lamaran, percakapan, pindah halaman, tanya Coach                                                                                                                                                                                 | Padanan command palette web.                                                                                                                  |

## 5. Design system (ringkas; nilai persis di `02-teknis.md` bagian 3)

- **Warna:** latar abu sangat muda, permukaan putih, teks hampir hitam, aksen biru; gelap: latar hampir hitam, permukaan abu tua. Warna tahap lamaran tetap (saved, applied, screening, interview, offer, closed). Kertas CV selalu putih.
- **Font:** Google Sans (400–700) untuk antarmuka, Google Sans Code untuk kode. Judul halaman 30, bagian 20, kartu 16, isi 14, keterangan 12. Tanpa huruf kapital semua.
- **Bentuk:** radius 8 (kartu 12–16, isian 12), bayangan tipis di terang, tanpa bayangan di gelap. Isian berisi warna, tanpa garis tepi.
- **Jarak:** kelipatan 4 (4, 8, 12, 16, 24, 32, 48, 64); tepi halaman ponsel 16.
- **Ikon:** Hugeicons dari `packages/icons`, garis untuk normal dan duotone untuk yang terpilih; 24 di target sentuh, 16 di chip.
- **Gerak:** 120 / 200 / 320 ms dengan kurva yang sama dengan web; keluar lebih cepat dari masuk; haptik ringan pada pilihan, sedang pada sukses, peringatan pada galat.
- **Keadaan kosong:** judul pendek, satu kalimat, aksi berdampingan; tidak mengulang judul halaman.

## 6. Yang sengaja berbeda dari web

| Hal                     | Web                          | App                                                         |
| ----------------------- | ---------------------------- | ----------------------------------------------------------- |
| Menu utama              | Sidebar                      | Tab bawah (ponsel), sidebar (tablet)                        |
| Menu bagian             | Menu teks di samping halaman | Segmen yang bisa digulir di bawah judul                     |
| Dialog                  | Dialog di tengah             | Lembar bawah; layar penuh untuk form panjang                |
| Beli paket              | Ada                          | Tidak ada (K6)                                              |
| Kartu Lokasi portofolio | Peta interaktif              | "Atur di web" (K7)                                          |
| CSV lamaran             | Ada                          | Tidak ada (D6)                                              |
| Admin                   | Ada                          | Tidak ada (K16)                                             |
| Pintasan keyboard       | ⌘K dan lain-lain             | Hanya dengan keyboard fisik (modul `key-commands` yang ada) |
