# Desain — portfolio web

Untuk pemilik dan agent. Bagian 5 (empat tema awal), 6 (token), 16 (widget metrik), dan 18 (efek intro) berisi keputusan final Phase 00 (2026-11-05); acuan visualnya ada di `mockups/`.

## 1. Prinsip

- **Isi dulu, tema menjaga tampilan.** Pengguna tidak pernah menata piksel. Setiap kombinasi pengaturan yang mungkin harus tetap rapi.
- **HP dulu.** Kebanyakan tautan portfolio dibuka dari WhatsApp atau LinkedIn di HP. Desain mulai dari lebar 360–390 px, lalu melebar.
- **Cepat dan ringan.** Halaman HTML jadi dari server, CSS kecil, JavaScript hanya untuk hal kecil (menu HP, galeri, pemutar video, form, hitungan klik).
- **Terbaca semua orang:** kontras WCAG AA, fokus keyboard terlihat, `prefers-reduced-motion` dihormati, teks alternatif gambar, urutan heading benar.
- **Satu set dengan CV:** bawaan warna aksen dan font mengikuti CV sumber, jadi CV dan portfolio terlihat serasi.
- **Hasil kerja terbaca cepat:** karya menonjolkan gambar dan angka hasil (widget metrik), bukan hanya teks.
- **Pasar Indonesia:** tombol WhatsApp, label "Open to work", layanan dengan harga mulai, contoh dan teks bawaan dalam bahasa Indonesia yang wajar.

## 2. Alur pengguna

1. Dashboard → menu **Portfolio** (setelah Dokumen). Belum punya: kartu kosong "Ubah CV-mu jadi website portfolio" dan tombol **Buat portfolio**.
2. Dialog buat (tiga langkah; dua terakhir bisa dilewati):
   1. **CV sumber**: daftar CV aktif, CV utama terpilih, atau **Tanpa CV** (isi nama, headline, foto sendiri).
   2. **Tema**: galeri gambar tema; tema Plus berlabel "Plus" untuk akun Gratis (Phase 07).
   3. **Mulai dengan AI** (Phase 10): "Tulis intro, Tentang saya, dan cerita karya dari CV-mu", dengan label biaya kredit dan pilihan sumber AI.
3. Editor terbuka dengan isi sudah terisi: data karier dari CV, Tentang saya dari ringkasan CV, Karya dari Proyek CV.
4. Pengguna menambah karya (bagian 15), angka pencapaian, layanan, testimoni, dan klien sesuai kebutuhan.
5. **Terbitkan**: dialog berisi alamat (`rezumi.app/<username>`), saklar "Tampil di mesin pencari" dengan penjelasan, dan, bila alamat pendek sebelumnya membuka CV utama yang publik: "Mulai sekarang alamat ini membuka portfolio. CV-mu tetap di rezumi.app/<username>/<slug>."
6. **Bagikan**: salin tautan, QR, pratinjau kartu WhatsApp/LinkedIn, tombol bagikan bawaan perangkat.
7. Setelah terbit, halaman Portfolio di dashboard menampilkan status, alamat, statistik singkat, pesan masuk, dan domain.

## 3. Halaman publik

Satu halaman dengan navigasi jangkar. ID jangkar tetap dalam bahasa Inggris agar tautan bisa dibagikan apa pun bahasa halamannya: `#about`, `#work`, `#work-<slug>`, `#services`, `#testimonials`, `#clients`, `#experience`, `#education`, `#skills`, `#contact`, dan seterusnya.

| Bagian                                                                       | Sumber                          | Isi                                                                                                                                                                                                                | Varian                                                                   | Bila kosong                    |
| ---------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ | ------------------------------ |
| Navigasi                                                                     | otomatis                        | Nama atau inisial, tautan ke bagian yang tampil, tombol utama                                                                                                                                                      | menempel di atas / biasa                                                 | —                              |
| Intro (hero)                                                                 | CV + portfolio                  | Selalu ada dan selalu paling atas. Nama, headline, sapaan singkat (≤160 karakter), foto, lokasi, label "Open to work", angka pencapaian (2–4, bagian 16), 1–3 tombol, efek intro opsional (bagian 18), latar intro | foto kiri / foto kanan / tanpa foto / nama besar di tengah (sesuai tema) | Tanpa foto → varian tanpa foto |
| Tentang saya                                                                 | portfolio (awal dari ringkasan) | Teks kaya pendek                                                                                                                                                                                                   | —                                                                        | Bagian disembunyikan           |
| Karya                                                                        | portfolio (awal dari Proyek CV) | Kartu: sampul, judul, ringkasan, peran, tahun, tag, metrik unggulan. Detail: blok (bagian 15)                                                                                                                      | grid 2 kolom / grid 3 kolom / daftar / unggulan + grid                   | Bagian disembunyikan           |
| Layanan                                                                      | portfolio                       | Nama layanan, deskripsi, harga mulai (opsional), tombol pesan (bagian 17)                                                                                                                                          | kartu / daftar                                                           | Bagian disembunyikan           |
| Testimoni                                                                    | portfolio                       | Kutipan, nama, jabatan, foto (bagian 17)                                                                                                                                                                           | kartu / geser                                                            | Bagian disembunyikan           |
| Klien/perusahaan                                                             | portfolio (+ nama dari CV)      | Deret logo atau nama (bagian 17)                                                                                                                                                                                   | abu-abu / berwarna                                                       | Bagian disembunyikan           |
| Pengalaman                                                                   | CV                              | Jabatan, perusahaan, periode, lokasi, uraian                                                                                                                                                                       | timeline / ringkas                                                       | Bagian disembunyikan           |
| Pendidikan                                                                   | CV                              | Institusi, gelar, periode, nilai, uraian                                                                                                                                                                           | timeline / ringkas                                                       | Bagian disembunyikan           |
| Keahlian                                                                     | CV                              | Nama keahlian + kata kunci; logo tools bila dinyalakan (aturan turunan #4)                                                                                                                                         | chip / grup                                                              | Bagian disembunyikan           |
| Bahasa, Sertifikat, Penghargaan, Publikasi, Relawan, Minat, bagian kustom CV | CV                              | Daftar ringkas                                                                                                                                                                                                     | —                                                                        | Bagian disembunyikan           |
| Bagian bebas (≤10)                                                           | portfolio                       | Judul, teks kaya, satu gambar opsional, satu tombol opsional                                                                                                                                                       | teks / teks + gambar                                                     | —                              |
| Kontak                                                                       | CV + portfolio                  | Kalimat ajakan, tombol email, WhatsApp, tautan profil, form kontak, kartu Lokasi dengan peta dan preferensi kerja (bagian 19)                                                                                      | —                                                                        | Hanya tautan profil            |
| Kaki                                                                         | otomatis                        | © tahun dan nama, badge "Made with Rezumi" (wajib di Gratis), tautan "Laporkan"                                                                                                                                    | —                                                                        | —                              |

Aturan halaman:

- Detail karya dibuka di halaman yang sama: dialog layar penuh di HP, panel besar di desktop. Detail punya jangkar `#work-<slug>` sehingga satu karya bisa dibagikan. Tanpa JavaScript, detail tetap terbaca (misalnya lewat `:target` atau bagian di bawah kartu).
- Tombol yang tersedia: Lihat CV (halaman web CV), Unduh PDF (bila CV mengizinkan unduh), Kirim pesan (ke `#contact`), WhatsApp (`https://wa.me/<nomor>`), Email (`mailto:`), satu profil (LinkedIn, GitHub, dll.), tautan bebas.
- Tautan keluar dibuka di tab baru.
- Sampul karya memakai rasio tetap per tema (misalnya 4:3 atau 16:10) dengan titik fokus pilihan pengguna; galeri menampilkan gambar utuh.
- Teks antarmuka (judul bawaan bagian, tombol, label) mengikuti bahasa halaman; bawaan = bahasa CV sumber.
- Isi yang kosong tidak pernah menyisakan judul tanpa isi.

## 4. Kustomisasi

| Kontrol                     | Pilihan                                                                                                                            | Bawaan                   |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Tema                        | Lugas, Prima (gratis); Kanvas, Mozaik, Paper, Brutal (Plus) — bagian 5                                                             | Lugas                    |
| Mode warna                  | Terang, Gelap, Ikuti perangkat                                                                                                     | Sesuai tema              |
| Warna aksen                 | Ikut CV, 8 warna kurasi, warna bebas (hex)                                                                                         | Ikut CV                  |
| Font                        | Ikut CV, 5–6 pasangan font kurasi per tema                                                                                         | Pasangan bawaan tema     |
| Urutan bagian               | Seret untuk mengurutkan                                                                                                            | Urutan bawaan tema       |
| Tampil/sembunyi bagian      | Per bagian                                                                                                                         | Bagian berisi tampil     |
| Judul bagian                | Teks sendiri (≤60 karakter)                                                                                                        | Judul bawaan per bahasa  |
| Item dari CV                | Sembunyikan per item                                                                                                               | Semua tampil             |
| Varian per bagian           | Sesuai tabel bagian 3, hanya yang didukung tema                                                                                    | Bawaan tema              |
| Varian widget metrik        | Kartu KPI, Angka besar, Sebelum → sesudah (bagian 16)                                                                              | Bawaan tema              |
| Data dasar khusus portfolio | Foto, headline, nama tampilan, lokasi (kosong = ikut CV)                                                                           | Ikut CV                  |
| Intro                       | Sapaan, foto tampil/tidak, Open to work + teks, angka pencapaian, tombol                                                           | Dari CV                  |
| Efek intro                  | Tanpa efek, Muncul halus, Kilau, Gradien hidup, Ketik berganti, Acak teknologi, Garis vektor (hanya yang didukung tema, bagian 18) | Bawaan tema              |
| Latar intro                 | Polos, gradien lembut dari aksen, pola halus, gambar (lapisan kontras otomatis)                                                    | Polos                    |
| Lokasi                      | Label kota, peta tampil/tidak, presisi Kota/Provinsi/Negara, Remote/Hybrid/On-site, bersedia relokasi, jam lokal                   | Label dari CV, peta mati |
| Kontak                      | Email, WhatsApp (nomor), form kontak, tautan profil, kalimat ajakan                                                                | Email + profil menyala   |
| SEO                         | Judul, deskripsi, tampil di mesin pencari                                                                                          | Otomatis dari isi        |
| Bahasa halaman              | Bahasa yang didukung aplikasi                                                                                                      | Bahasa CV sumber         |
| Badge                       | Tampil/sembunyi (Plus)                                                                                                             | Tampil                   |

Sengaja tidak ada di rilis pertama: CSS sendiri, font unggahan, ukuran atau posisi bebas, pilihan animasi, beberapa halaman, beberapa portfolio, unggah file video. Lihat `backlog-lanjutan.md`.

## 5. Tema rilis (final Phase 00)

Disetujui pemilik 2026-11-05 dari enam mockup. Dua arah lain (Sintaks, Warta) pindah ke `backlog-lanjutan.md` B1. Acuan visual: `mockups/<id>.html` (persona fiktif, panel "Coba pengaturan" untuk aksen, mode, font, efek, varian metrik, dan uji ketahanan). Angka di bawah diambil dari CSS mockup; Phase 02 dan 06 boleh menyesuaikan sedikit asal tampilannya sama.

### Ringkasan

| ID       | Nama   | Paket  | Untuk siapa                                               | Mode bawaan | Efek bawaan   | Metrik bawaan | Persona mockup  |
| -------- | ------ | ------ | --------------------------------------------------------- | ----------- | ------------- | ------------- | --------------- |
| `lugas`  | Lugas  | Gratis | Semua bidang; tema bawaan akun baru                       | Terang      | Muncul halus  | Angka besar   | Nadia Rahmawati |
| `prima`  | Prima  | Gratis | Keuangan, konsultan, BUMN, manajer, fresh graduate formal | Terang      | Tanpa efek    | Kartu KPI     | Anindya Dewi    |
| `kanvas` | Kanvas | Plus   | Desainer, fotografer, arsitek, kreator konten             | Gelap       | Garis vektor  | Angka besar   | Bayu Saputra    |
| `mozaik` | Mozaik | Plus   | Kreator, freelancer, mahasiswa                            | Terang      | Gradien hidup | Kartu KPI     | Citra Maharani  |

Semua tema mendukung ketiga varian metrik (bagian 16). Efek yang didukung per tema ada di bagian 18. Batas lebar: HP ≤640 px, tablet 641–1023 px, desktop ≥1024 px; menu navigasi berubah jadi tombol "Menu" (`<details>`, tanpa JavaScript) di ≤760 px.

### Warna netral per tema

Aksen bawaan semua tema = "Ikut CV" (bagian 6). Netral (hex):

| Tema   | Mode   | `--pf-bg` | `--pf-surface` | `--pf-text` | `--pf-muted` | `--pf-border` |
| ------ | ------ | --------- | -------------- | ----------- | ------------ | ------------- |
| Lugas  | Terang | `#FFFFFF` | `#F3F4F6`      | `#111318`   | `#596070`    | `#E4E6EA`     |
| Lugas  | Gelap  | `#0F1115` | `#191C21`      | `#ECEEF1`   | `#9BA2AD`    | `#272B32`     |
| Prima  | Terang | `#F5F6F8` | `#FFFFFF`      | `#0E1726`   | `#4D596B`    | `#D9DEE6`     |
| Prima  | Gelap  | `#0B101A` | `#121A28`      | `#E7EBF2`   | `#9BA6B7`    | `#243147`     |
| Kanvas | Terang | `#FFFFFF` | `#F1F1EF`      | `#121212`   | `#5B5B58`    | `#E3E3E0`     |
| Kanvas | Gelap  | `#0F0F10` | `#1A1A1B`      | `#F2F0EB`   | `#A8A49C`    | `#2C2B2A`     |
| Mozaik | Terang | `#EEF1EF` | `#FFFFFF`      | `#14201E`   | `#52605C`    | `#DBE2DF`     |
| Mozaik | Gelap  | `#0B1110` | `#141C1B`      | `#E7EFED`   | `#9BADA9`    | `#24302E`     |

### Pasangan font (pertama = bawaan tema)

Semua ada di `packages/fonts/src/webfontlist.json` dan berlisensi bebas (Google Fonts, OFL). "Ikut CV" tetap tersedia (bagian 6).

| Tema   | Pasangan (judul + isi)                                                                                                                                                 |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lugas  | Plus Jakarta Sans · Lora + Figtree · Manrope · DM Sans · Source Serif 4 + Source Sans 3 · Atkinson Hyperlegible                                                        |
| Prima  | Source Serif 4 + IBM Plex Sans · Manrope · Libre Caslon Text + Public Sans · IBM Plex Serif + IBM Plex Sans · Literata + Work Sans                                     |
| Kanvas | Archivo (lebar 72%, nama kapital) · Bodoni Moda + Work Sans (nama tidak kapital) · Syne + DM Sans · Instrument Serif + Instrument Sans · Bricolage Grotesque + DM Sans |
| Mozaik | Bricolage Grotesque + Onest · Unbounded + Albert Sans · Outfit · Sora + DM Sans · Rethink Sans · Red Hat Display + Albert Sans                                         |

Font mono (`--pf-font-mono`) semua tema: IBM Plex Mono.

### Lugas (`lugas`, gratis)

- **Bentuk:** `--pf-max-width: 680px` di semua lebar, `--pf-radius: 14px`, tombol pil. Jarak antarbagian `clamp(72px, 9vw, 112px)`; judul bagian 24–30 px, tebal 800, tracking −0,025em.
- **Navigasi:** biasa (tidak menempel); monogram inisial dalam lingkaran + nama, tautan jangkar abu-abu.
- **Intro (varian bawaan "foto di atas"):** foto bulat 88 px; nama tebal 800, `clamp(2.6rem, 1.4rem + 5.2vw, 4.4rem)`, tracking −0,035em, tinggi baris 1; headline 20 px abu-abu; sapaan 18–21 px, maks. 36ch; chip lokasi + Open to work; angka pencapaian varian Angka besar di bawah garis tipis (HP: tetap 3 kolom, nilai 27 px); 1–3 tombol. Tanpa foto: foto hilang, sisanya sama.
- **Karya (varian bawaan "daftar"):** baris bergaris dengan sampul kecil 120 px (HP 84 px) rasio 4:3 radius 10 px, judul 20 px tebal 700, ringkasan abu-abu, baris meta (peran · tahun) + chip metrik unggulan. Hover: garis bawah aksen pada judul. Tanpa gambar: baris teks saja.
- **Bagian lain:** Layanan sebagai daftar (nama, harga di kanan, deskripsi, tautan pesan); Testimoni bertumpuk dengan tanda kutip aksen; Klien sebagai deret logo abu-abu; Pengalaman dan Pendidikan ringkas; Keahlian sebagai grup chip; Sertifikat/Bahasa/Penghargaan dalam 2 kolom; bagian bebas sebagai kartu `--pf-surface`; Kontak: kalimat ajakan besar (24–36 px, 800), tombol Email/WhatsApp, daftar kontak, form, kartu Lokasi (maks. 420 px).
- **Urutan bawaan:** Tentang, Karya, Layanan, Testimoni, Klien, Pengalaman, Pendidikan, Keahlian, Sertifikat/Bahasa, bagian bebas, Kontak.
- **Detail karya:** panel maks. 820 px.
- **Dibangun di Phase 02:** navigasi memuat 4 bagian pertama + Kontak (sisanya lewat gulir); Bahasa, Sertifikat, Penghargaan, Publikasi, dan Minat yang berurutan tampil dalam satu blok 2 kolom; angka pencapaian intro selalu gaya Angka besar; nomor WhatsApp Indonesia ditulis "+62 812 5550 1824". Varian yang tersedia: intro foto di atas / foto kiri; karya daftar / grid 2 kolom / unggulan + grid; layanan daftar / kartu; testimoni bertumpuk / geser; klien abu-abu / berwarna; pengalaman dan pendidikan ringkas / timeline; keahlian grup / chip; metrik ketiganya.

### Prima (`prima`, gratis)

- **Bentuk:** `--pf-max-width: 1160px`, `--pf-radius: 6px` (kecil 4 px); tombol dan chip bersudut 6 px, bukan pil; kartu putih `--pf-surface` di atas latar abu sangat muda.
- **Navigasi:** menempel di atas, latar setengah transparan + blur, garis bawah 1 px, tombol "Kirim pesan" kecil.
- **Intro (varian bawaan "foto kanan"):** grid `1.35fr / 0.65fr`, jarak `clamp(32px, 6vw, 88px)`. Headline di atas nama: 13 px kapital, tracking 0,12em, warna `--pf-accent-text`. Nama serif tebal 600, `clamp(2.6rem, 1.6rem + 4vw, 4.4rem)`, tracking −0,025em. Sapaan 20 px, maks. 40ch. Foto rasio 4:5 maks. 360 px dengan garis tepi tipis dan keterangan kredensial (garis aksen 2 px di kiri). ≤820 px: satu kolom, foto di atas maks. 200 px. Tanpa foto: satu kolom.
- **Angka pencapaian:** strip Kartu KPI bersambung (4 kolom, garis pemisah 1 px; ≤900 px 2 kolom), nilai 28–36 px.
- **Bagian:** baris dua kolom (judul 220 px | isi), garis atas 1 px, jarak `clamp(36px, 5vw, 64px)`; ≤820 px satu kolom. Judul bagian serif 26 px.
- **Pengalaman (varian bawaan "timeline", menonjol):** kolom periode 150 px, titik 16 px (posisi terbaru terisi aksen), garis vertikal 2 px; HP: periode di atas jabatan.
- **Karya (varian bawaan "grid 2 kolom", judul bagian bawaan "Studi kasus"):** kartu bergaris, sampul 16:10, meta (tahun · peran), judul serif 20 px, ringkasan, chip metrik bersudut.
- **Bagian lain:** Layanan dan Testimoni sebagai kartu (kutipan serif miring); Klien sebagai deret logo; bagian bebas cocok untuk daftar bernomor (contoh "Prinsip kerja"); Kontak dua kolom (form | kartu Lokasi).
- **Urutan bawaan:** Tentang, Pengalaman, Karya, Layanan, Testimoni, Klien, Pendidikan, Sertifikat & penghargaan, Keahlian, bagian bebas, Kontak.
- **Dibangun di Phase 06:** keterangan foto berisi dua sertifikat pertama (data tidak punya kolom kredensial); tombol "Kirim pesan" di navigasi hilang ≤960 px; strip KPI mengikuti jumlah angka (1–4); daftar pendek berurutan berbagi satu baris; judul Karya bawaan "Studi kasus".

### Kanvas (`kanvas`, Plus)

- **Bentuk:** `--pf-max-width: 1400px`, `--pf-radius: 4px`; tombol bersudut 4 px. Gambar menjadi isi utama; teks di sekitarnya kecil dan tenang.
- **Intro (varian bawaan "nama besar"):** nama kapital, Archivo lebar 72% (`--pf-name-stretch`), tebal 800, `clamp(3.2rem, 0.6rem + 11.5vw, 11rem)`, tinggi baris 0,86. Di bawah garis tipis: tiga kolom (foto bulat 56 px + headline | sapaan 20 px | chip + tombol), satu kolom di ≤900 px; angka pencapaian Angka besar 3 sejajar dengan label kecil.
- **Karya (varian bawaan "unggulan + grid"):** langsung setelah intro, hampir selebar layar. Desktop: grid 6 kolom, tinggi baris `clamp(200px, 17vw, 280px)`, jarak 12 px; karya pertama 4×2 sel, lainnya 2×1. Keterangan (judul, tahun · tag, chip metrik) muncul saat hover atau fokus di atas gradien gelap. Tablet: 2 kolom, karya pertama 2×2. HP dan layar sentuh: satu kolom, gambar 4:3 dengan keterangan selalu tampil di bawah. Tanpa gambar: ubin `--pf-surface` berisi judul.
- **Bagian lain:** dua kolom (label kecil kapital 1fr | isi 3fr, maks. 980 px), garis atas tipis. Layanan sebagai baris 3 kolom (nama + harga | deskripsi | tautan); Testimoni sebagai kutipan besar 20–28 px; Kontak dibuka kalimat ajakan kapital besar.
- **Detail karya:** layar penuh dengan latar halaman (bukan panel di atas bayangan), lebar maks. 1200 px, judul kapital besar, galeri satu kolom rasio 3:2.
- **Urutan bawaan:** Karya, Tentang, Layanan, Testimoni, Klien, Pengalaman, Pendidikan, Keahlian, Penghargaan & bahasa, bagian bebas, Kontak.
- **Dibangun di Phase 06:** font Archivo yang tersedia tidak punya sumbu lebar, jadi "lebar 72%" diganti jarak huruf rapat; tablet layar sentuh 2 kolom (karya pertama selebar dua kolom); galeri detail menampilkan gambar utuh (tidak dipotong 3:2); ajakan, judul detail, dan judul keterangan ikut huruf kapital nama (hanya pasangan Archivo).

### Mozaik (`mozaik`, Plus)

- **Bentuk:** `--pf-max-width: 1200px`; ubin `--pf-surface` dengan radius 26 px (elemen dalam 14–20 px), jarak antarubin 14 px; tombol dan chip pil.
- **Intro (bento):** desktop 4 kolom, area `"intro intro photo s1" "intro intro photo s2" "about about loc links"`. Tablet (≤900 px) 2 kolom: `"intro intro" "photo s1" "photo s2" "about about" "loc links"`; HP (≤560 px) lokasi dan tautan masing-masing selebar layar. Ubin intro: chip Open to work, nama tebal 800 `clamp(2.4rem, 1.3rem + 4.2vw, 4.4rem)` tracking −0,035em, headline 20 px warna `--pf-accent-text`, sapaan, tombol. Ubin angka: pertama latar aksen penuh (teks `--pf-on-accent`), kedua latar `--pf-accent-soft`. Tentang saya dan kartu Lokasi tampil sebagai ubin di intro (bagian 19 mengizinkan). Ubin tautan profil berisi daftar tombol. Tanpa foto: ubin intro melebar 3 kolom.
- **Karya (varian bawaan "bento"):** 4 kolom, tinggi baris `clamp(180px, 19vw, 250px)`; karya pertama 2×2, karya keenam 2×1, ditutup ubin "Lebih banyak di …" 2×1 (tautan profil utama); keterangan sebagai pil `--pf-surface` di dalam gambar. Tablet 2 kolom; HP satu kolom rasio 4:3. Tanpa gambar: ubin `--pf-accent-soft` dengan pil judul.
- **Bagian lain:** Layanan sebagai ubin dengan harga berbentuk pil; Testimoni dalam ubin geser (CSS scroll-snap) di samping ubin Klien (logo 2 kolom); Pengalaman (ubin tinggi), Keahlian, Pendidikan, dan ubin Sertifikat/Penghargaan/Bahasa selebar penuh; bagian bebas cocok untuk langkah bernomor; Kontak: ubin ajakan (`--pf-accent-soft`) + ubin form.
- **Urutan bawaan:** intro bento (dengan Tentang dan Lokasi), Karya, Layanan, Testimoni + Klien, Pengalaman/Keahlian/Pendidikan/Lainnya, bagian bebas, Kontak.
- **Dibangun di Phase 06:** angka ke-3 dan ke-4 bertumpuk di ubin angka kedua; satu angka = satu ubin setinggi dua baris; tanpa angka kolomnya hilang; lokasi tanpa peta, mode kerja, relokasi, atau jam lokal tampil sebagai chip di ubin intro; ubin penutup karya menaut ke profil karya (Behance, Dribbble, GitHub, …) lalu situs.

### Aturan untuk semua tema

Setiap tema wajib mendukung: semua bagian di bagian 3; semua jenis blok karya (bagian 15) dan ketiga varian widget metrik (bagian 16); terang dan gelap (satu jadi bawaan); semua warna aksen dengan koreksi kontras; semua pasangan font yang ditawarkan tema itu; isi sangat sedikit dan sangat banyak; nama sangat panjang; `dir="rtl"`; lebar 360–1920 px tanpa geser horizontal.

- **Nama sangat panjang:** ukuran nama dibatasi panjang kata terpanjangnya (`--name-word`, dihitung server dari nama tampilan), misalnya `font-size: min(<ukuran tema>, calc(<lebar kolom> / (var(--name-word) * 0.6)))`, ditambah `overflow-wrap: anywhere`. Dicek di mockup dengan nama 4–5 kata dan kata 19 huruf.
- **RTL:** tata letak memakai properti logis (`margin-inline`, `inset-inline`, `border-inline-start`); ikon panah dibalik; lapisan efek per huruf memakai `dir="auto"` agar nama Latin tidak terbalik.
- **Tanpa foto, tanpa gambar karya, isi sedikit:** perilaku per tema tertulis di atas; judul bagian kosong tidak pernah tampil.
- **Detail karya** dibuka lewat `:target` (bagian 3), dengan bilah atas menempel (Tutup, Sebelumnya, Berikutnya). Di HP selalu layar penuh. Sejak hardening 2026-11-07 (`02-teknis.md` bagian 32): selama detail atau lightbox terbuka, sisa halaman `inert`.
- **Teks kaya dan daftar** (hardening 2026-11-07): judul H2/H3 di teks kaya selalu berada di bawah judul bagian (diturunkan satu tingkat bila perlu), dan setiap daftar punya kelas sendiri sehingga tidak pernah tampil sebagai daftar polos.

## 6. Token desain bersama

Setiap tema hanya membaca token ini (CSS custom properties), sehingga kustomisasi berlaku sama di semua tema:

- Warna: `--pf-accent`; `--pf-accent-text` (aksen yang aman sebagai teks: digeser terang/gelap sampai kontras ≥4,5:1 untuk teks kecil dan ≥3:1 untuk teks besar dan ikon); `--pf-on-accent` (teks di atas blok aksen); `--pf-accent-soft` (latar chip dan ubin, `color-mix(in oklab, aksen 11%, --pf-bg)`); `--pf-bg`, `--pf-surface`, `--pf-text`, `--pf-muted`, `--pf-border`; `--pf-positive` dan `--pf-negative` (chip tren metrik, kontras aman); `--pf-chart` (garis grafik mini, bawaan = `--pf-accent-text`). Dua set: terang dan gelap.
- Huruf: `--pf-font-heading`, `--pf-font-body`, `--pf-font-mono`, `--pf-name-stretch` (lebar huruf nama, misalnya 72% untuk Archivo di Kanvas); skala `--pf-text-xs` 13 px, `--pf-text-sm` 15 px, `--pf-text-md` 17 px, `--pf-text-lg` 20 px, `--pf-text-xl` 26 px, `--pf-text-2xl` 30–40 px, `--pf-text-name` (ditimpa tema); `--pf-leading-tight` 1,08 dan `--pf-leading-body` 1,6. Angka metrik memakai `font-variant-numeric: tabular-nums`.
- Bentuk dan jarak: `--pf-radius`, `--pf-radius-sm`, `--pf-max-width`, skala `--pf-space-1`…`--pf-space-9` (4, 8, 12, 16, 24, 32, 48, 72, 112 px), `--pf-gutter` (min. 16 px plus area aman layar).
- Mode dipasang sebagai `data-pf-scheme="light" | "dark"` di `<html>`; "Ikuti perangkat" diselesaikan dengan `prefers-color-scheme`. Tema hanya menimpa nilai netral per mode (tabel bagian 5).
- Berkas acuan: `mockups/tokens.css` (token) dan `mockups/shared.css` (widget metrik, blok karya, detail, Lokasi, form, kaki, efek).

**Koreksi kontras aksen.** `--pf-accent-text` dihitung dari aksen dan `--pf-bg` mode aktif: geser kecerahan (lebih gelap di latar terang, lebih terang di latar gelap) sampai kontras ≥4,5:1. `--pf-on-accent` = putih atau `#111111`, mana yang kontrasnya lebih tinggi terhadap aksen. Contoh di mockup: kuning terang `#FFD60A` tetap jadi latar tombol (dengan teks gelap), tetapi sebagai teks di latar putih otomatis menjadi zaitun tua. Produk boleh memakai OKLCH untuk menggeser kecerahan agar rona lebih terjaga.

**Warna aksen kurasi (disetujui Phase 00).** Selain "Ikut CV" dan warna bebas:

| ID        | Nama    | Hex       |
| --------- | ------- | --------- |
| `samudra` | Samudra | `#1D4ED8` |
| `toska`   | Toska   | `#0F766E` |
| `daun`    | Daun    | `#15803D` |
| `kunyit`  | Kunyit  | `#EAB308` |
| `jingga`  | Jingga  | `#EA580C` |
| `cabai`   | Cabai   | `#DC2626` |
| `anggrek` | Anggrek | `#7C3AED` |
| `grafit`  | Grafit  | `#334155` |

"Ikut CV" untuk aksen mengambil `metadata.design.colors.primary` CV sumber (format `rgba(...)`, diubah ke hex). "Ikut CV" untuk font mengambil tipografi CV; bila font CV adalah font unggahan atau tidak tersedia untuk web, pakai pasangan bawaan tema.

## 7. Editor

- Rute layar penuh `/builder/portfolio`, seperti builder CV. Kiri: panel dengan tab **Isi**, **Desain**, **Terbitkan**. Kanan: pratinjau langsung dengan pilihan **Desktop / HP** dan tombol "Buka halaman".
- Tab **Isi**: daftar bagian (seret untuk mengurutkan, ikon mata untuk menyembunyikan, pensil untuk mengganti judul). Klik bagian membuka formnya: Intro (data dasar khusus portfolio, sapaan, Open to work, angka pencapaian, tombol), Tentang saya, Karya (bagian 15), Layanan, Testimoni, Klien (bagian 17), bagian dari CV (item dengan saklar tampil + "Ubah di CV" yang membuka builder CV di tab baru), bagian bebas, Kontak.
- Semua kolom teks kaya portfolio (Tentang saya, blok Teks, bagian bebas) memakai **Rich Text Editor HeroUI Pro** dengan toolbar terbatas pada format yang didukung halaman publik.
- Tab **Desain**: tema (galeri), mode, aksen, font, varian per bagian, varian widget metrik.
- Tab **Terbitkan**: saklar terbit, alamat + salin + QR, mesin pencari, SEO, bahasa halaman, badge, CV sumber, domain sendiri (Phase 09).
- Simpan otomatis dengan indikator "Tersimpan"; perubahan langsung tayang bila sudah terbit. Bila portfolio diubah di tab lain, editor memberi tahu dan memuat ulang, bukan menimpa diam-diam.
- Pesan galat jelas di samping kolom (tautan tidak valid, gambar atau PDF terlalu besar, situs menolak dibaca, batas paket).
- Web di HP (≤768 px): panel dan pratinjau bergantian lewat tombol "Pratinjau".
- **Dibangun di Phase 03:** bingkai editor CV dipakai ulang (bar 56 px, panel 400 px, pratinjau di kanan; laci di tablet). Tab Isi · Desain · Terbitkan memakai sakelar mode editor CV (ikon, label hanya untuk tab aktif). Bar atas: kembali ke halaman Portfolio, status simpan (ikon awan; galat dengan "Coba lagi"), Urungkan/Ulangi, "Buka halaman" bila terbit. Pratinjau: pilihan Komputer/HP seperti Share CV. Di HP, tab bawah Isi · Pratinjau · Desain · Terbitkan. Tab Isi: kelompok Intro lalu kelompok Bagian (baris dengan pegangan seret, ikon bagian, chip "Dari CV" dan "Kosong", mata, pensil ganti nama, panah naik/turun; baris terbuka menampilkan formnya), tombol "Tambah bagian". Item daftar (tombol intro, layanan, testimoni, klien, karya) berupa kartu abu-abu dengan tombol naik/turun/hapus. Testimoni baru ditambah lewat dialog dengan centang pernyataan; tombol "Tambahkan" baru aktif setelah dicentang. Tab Desain: kartu tema (hanya Lugas sampai Phase 06), Mode (Terang/Gelap/Ikuti perangkat), lingkaran warna aksen (Sama dengan CV, 8 kurasi, pemilih warna sendiri) dengan catatan bila warna dikoreksi untuk teks, Latar intro, pasangan font, dan daftar tata letak per bagian (bawaan tema ditandai). Bila portfolio diubah di tab lain, dialog "Portofolio Anda diubah di tempat lain" meminta muat ulang. **Hardening 2026-11-07:** status simpan menyebut alasan dan tempatnya dengan tombol "Tunjukkan"; dialog konflik menawarkan Muat ulang atau "Pertahankan versi saya"; dialog "Portofolio Anda tidak bisa disimpan" bila portfolio terhapus atau dimatikan; meninggalkan editor dengan perubahan yang belum tersimpan bertanya dulu; galeri tema, warna aksen, dan kartu efek berupa radio group (satu Tab, panah).

## 8. Halaman Portfolio di dashboard

`/dashboard/portfolio`: kartu status (Terbit/Belum terbit, alamat, Salin, Buka, Edit), statistik 30 hari (Phase 08), pesan masuk (Phase 08), domain (Phase 09). Menu "Portfolio" hanya tampil bila `PORTFOLIO_MODE` mengizinkan akun itu. Phase 03 membangun kartu kosong (ikon, judul, penjelasan, "Buat portfolio") dan kartu status dengan chip Terbit/Belum terbit, alamat + salin, "Ubah portofolio", "Buka halaman" (bila terbit), dan "Hapus portofolio" (tahan untuk konfirmasi). Hardening 2026-11-07: chip "Diturunkan" bila portfolio ditangguhkan admin. Dialog buat: dua langkah (Dibuat dari apa → Tampilannya), pilihan CV berupa kartu radio.

## 9. Form kontak (Phase 08)

- Kolom: nama, email, pesan (≤2.000 karakter). Teks kecil di bawah form: pesan dikirim ke pemilik portfolio dan email pengirim terlihat olehnya agar bisa membalas.
- Anti-spam: Cloudflare Turnstile, kolom jebakan tersembunyi, batas per pengunjung dan per portfolio.
- Setelah kirim: pesan sukses di tempat. Turnstile butuh JavaScript, jadi tanpa JavaScript form disembunyikan dan catatan mengarahkan ke pilihan kontak lain di halaman itu (keputusan 2026-11-09; mengizinkan kirim tanpa token membuka celah spam). Server tetap menerima POST biasa dan kembali dengan tanda terkirim atau gagal, untuk peramban yang mengirim form tanpa skrip penanganan.
- Tombol layanan "Pesan lewat form" mengisi pesan awal dengan nama layanan.
- Pemilik portfolio menerima email notifikasi (membalas email = membalas pengirim) dan melihat pesan di dashboard; bisa menandai dibaca, menghapus, dan mematikan form.

## 10. Statistik (Phase 08)

Hanya pemilik yang melihat: kunjungan 30 hari (grafik harian), klik tombol (Lihat CV, Unduh PDF CV, WhatsApp, Email, tautan, layanan), karya yang paling sering dibuka, PDF karya yang dibuka, video yang diputar, jumlah pesan, sumber kunjungan (LinkedIn, WhatsApp, Google, langsung, lainnya), negara pengunjung pada peta HeroUI, dan jenis perangkat (HP/desktop). Rincian negara, perangkat, dan perujuk berasal dari Cloudflare Analytics Engine dan ditandai "perkiraan". Dashboard boleh memakai `KPI`/`KPIGroup` HeroUI Pro untuk menampilkannya. Tanpa cookie pelacak; kunjungan pemilik dan bot tidak dihitung; satu pengunjung dihitung sekali per jam, sama seperti CV.

## 11. Domain sendiri (Phase 09)

Di tab Terbitkan dan halaman dashboard: masukkan domain → tampilkan record DNS (CNAME + TXT) dengan tombol salin → "Cek DNS" → status bertahap: DNS ✓ → kepemilikan ✓ → sertifikat HTTPS ✓ → Aktif. Untuk domain utama tanpa `www`, sarankan `www.` atau subdomain dan pengalihan domain utama di registrar. Akun Gratis melihat kontrol terkunci berlabel Plus. Tampilan akhir: empat langkah (DNS mengarah ke Rezumi, kepemilikan terbukti, sertifikat HTTPS, aktif) yang diperbarui sendiri saat Cloudflare bekerja; satu kontrol yang sama di tab Terbitkan, dashboard Portfolio, dan Share CV. Saat paket berakhir tampil peringatan dengan tanggal berhenti, lalu keterangan bahwa domain kini mengarah ke alamat Rezumi. Masalah (DNS berubah, CAA, sertifikat gagal, kuota, domain ditolak) dijelaskan dengan kalimat dan langkah perbaikan.

## 12. AI (Phase 10)

- Saat membuat portfolio: "Tulis draf dengan AI" (intro, Tentang saya, ringkasan dan blok Teks cerita setiap karya) dari CV sumber. Hasil masuk ke editor sebagai perubahan yang bisa di-Urungkan.
- Di kolom teks panjang dan blok Teks: tombol AI kecil (lebih singkat, lebih profesional, terjemahkan ke bahasa halaman).
- **Temukan angka**: AI membaca uraian pengalaman dan proyek di CV, lalu menyarankan metrik ("meningkatkan konversi 35%" → metrik "+35% konversi"). Pengguna memilih mana yang dipakai. AI tidak pernah menambah angka yang tidak tertulis.
- Label biaya kredit, pilihan sumber AI (Rezumi AI atau koneksi sendiri), dan dialog kredit kurang mengikuti pola AI yang sudah ada.
- AI tidak boleh mengarang fakta (angka, nama klien, hasil) yang tidak ada di CV atau catatan pengguna.
- Hasil Phase 10: langkah AI hanya muncul untuk portfolio dari CV dan bila ada sumber AI; tombol **Tulis draf dengan AI** juga ada di atas tab Isi (memilih karya, maksimal 12). Tombol AI kecil ada di Salam pembuka, Ringkasan karya, Deskripsi layanan, Tentang saya, blok Teks, dan bagian bebas; **Testimoni sengaja tidak punya tombol AI** karena itu kata-kata orang lain. Bagian yang belum tersedia datanya ditulis AI sebagai `[tambahkan hasil]`; dialog Terbitkan mengingatkan bila masih ada.

## 13. Teks antarmuka halaman publik

Judul bawaan bagian (Tentang saya, Karya, Layanan, Testimoni, Klien, Pengalaman, Pendidikan, Keahlian, …), tombol (Lihat CV, Unduh PDF, Kirim pesan, WhatsApp, Email, Pesan layanan ini, Putar video, Buka PDF, Kunjungi, Tutup, Sebelumnya, Berikutnya, Menu), label (Open to work, Peran, Tahun, Mulai dari, naik/turun untuk metrik, jumlah halaman PDF), form (Nama, Email, Pesan, Kirim, Terkirim, galat), kaki (Made with Rezumi, Laporkan halaman ini), halaman tidak tersedia, halaman laporan. Semua lewat katalog terjemahan halaman publik (`02-teknis.md` 5.5), wajib ada versi Indonesia.

## 14. Persona dan gambar contoh

Mockup, gambar galeri tema, matriks visual, dan tangkapan layar dokumen memakai persona fiktif dari `tooling/templates/personas/` (nama dan isi fiktif). Gambar karya, logo klien, foto testimoni, dan PDF contoh dibuat sendiri oleh agent (komposisi abstrak, mockup layar buatan sendiri, logo rekaan) atau foto Unsplash dengan sumber dan lisensi dicatat di `.agents/docs/template-showcase-sources.json`. Jangan memakai karya, logo merek, atau testimoni orang sungguhan sebagai milik persona.

## 15. Input karya

### Cara menambah karya (dialog "Tambah karya")

1. **Kosong**: isi kartu, lalu tambah blok.
2. **Dari CV**: pilih satu atau beberapa proyek CV; judul, ringkasan, tanggal, dan tautan terisi.
3. **Tempel tautan**: tempel satu tautan (Behance, Dribbble, GitHub, Figma, Medium, YouTube, situs apa pun) → judul, ringkasan, sampul, tautan utama, dan blok yang sesuai (Tautan atau Video) terisi otomatis. Pengguna mengonfirmasi gambar sampul sebelum disalin ke penyimpanannya.
4. **Unggah gambar**: pilih atau seret banyak gambar sekaligus → satu karya dengan blok Gambar, atau satu karya per gambar (pilihan di dialog). Cocok untuk fotografer dan ilustrator.
5. **Dengan AI** (Phase 10): draf dari proyek atau pengalaman di CV.

### Kartu karya

Sampul (gambar dengan titik fokus yang bisa dipilih), judul ≤100, ringkasan ≤240, peran ≤80, tahun ≤40 (teks bebas: "2024", "Jan–Mar 2025"), tag ≤12, **metrik unggulan** (pilih satu metrik dari blok Metrik karya ini; tampil sebagai chip di kartu), tautan utama, unggulan (featured), sembunyikan.

### Detail karya: blok

| Blok   | Isi                                                                                                                    | Batas                        | Tampil di halaman                                                       |
| ------ | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------- |
| Teks   | Rich Text Editor HeroUI Pro: paragraf, judul kecil (H2/H3), tebal, miring, garis bawah, coret, tautan, daftar, kutipan | ≤10.000 karakter per blok    | Teks dengan tipografi tema                                              |
| Gambar | 1–12 gambar, keterangan per gambar, teks alternatif wajib, tata letak penuh / grid / geser                             | Ukuran per aturan turunan #9 | Galeri; klik membuka layar penuh                                        |
| Metrik | 1–4 metrik (bagian 16)                                                                                                 | —                            | Widget metrik                                                           |
| Video  | Tautan YouTube atau Vimeo, judul opsional                                                                              | 1 video per blok             | Gambar mini + tombol putar; pemutar baru dimuat setelah diklik          |
| PDF    | Satu file PDF, judul, gambar halaman pertama dibuat otomatis                                                           | ≤10 MB, tanpa password       | Kartu: gambar halaman pertama, judul, jumlah halaman, tombol "Buka PDF" |
| Tautan | Tempel URL → judul, deskripsi, gambar, nama situs terisi otomatis (semua bisa diubah)                                  | 1 tautan per blok            | Kartu tautan dengan logo situs (Behance, GitHub, …) bila dikenal        |

- Maks. 30 blok per karya (batas teknis).
- Menambah blok: tombol "+ Tambah blok" di antara blok, atau ketik "/" di blok Teks untuk membuka menu (Teks, Gambar, Metrik, Video, PDF, Tautan).
- Mengurutkan: seret atau tombol naik/turun. Menghapus blok bisa di-Urungkan.
- **Mulai dari kerangka studi kasus**: mengisi blok Teks berjudul Masalah, Peran saya, Proses, Hasil, ditambah satu blok Metrik kosong.
- Galat yang jelas: tautan video tidak dikenali, PDF terlalu besar atau berpassword, situs menolak dibaca (isi manual), gambar terlalu besar.

- **Dibangun di Phase 04:** bagian Karya di tab Isi berupa daftar kartu (sampul kecil, judul, chip Unggulan/Tersembunyi, jumlah blok, mata, naik/turun, hapus dengan konfirmasi) dan tombol "Tambah karya" (dialog berisi kartu pilihan: Kosong, Dari CV saya, Unggah gambar, Tempel tautan bertanda "Segera hadir"). Mengklik karya mengganti isi panel dengan editor karya ("← Semua bagian"), sementara pratinjau membuka detail karya itu. Editor karya: grup **Kartu** (sampul dengan pemilih titik fokus dan dua bingkai contoh potongan 4:3 dan 16:9, judul dengan alamat `…#work-<slug>` di bawahnya, ringkasan, peran, tahun, tag, "Metrik di kartu", tautan utama + teksnya, Unggulan, Sembunyikan) dan grup **Detail** (blok berupa kartu abu-abu: pegangan seret, ikon + nama jenis, naik/turun, hapus dengan toast "Urungkan"; "+ Tambah blok" kecil di antara blok dan tombol penuh di bawah; karya kosong menawarkan "Mulai dari kerangka studi kasus"). Kolom gambar: area seret-lepas ringkas dengan tombol "Pilih gambar" (tempel lewat Ctrl/⌘+V saat area fokus), progres per gambar, pesan galat per file, lalu pratinjau + "Jelaskan gambar" (wajib, ditandai merah bila kosong setelah disentuh) + "Ganti gambar"/"Hapus gambar". Foto Intro berupa pilihan radio: foto di CV, foto khusus portofolio, tanpa foto.

## 16. Metrik (widget)

Tujuan: hasil kerja terbaca dalam dua detik oleh perekrut ("+35% konversi"), seperti widget KPI di dashboard. Anatomi mengikuti `KPI` HeroUI Pro; halaman publik menggambarnya dengan HTML, CSS, dan SVG milik tema (tanpa HeroUI atau Recharts, agar ringan).

### Anatomi

- **Ikon** (opsional): dari set ikon Hugeicons yang sama dengan CV.
- **Label**: "Konversi checkout".
- **Nilai besar**: diformat sesuai bahasa halaman ("2,8%", "Rp1,2 M", "12 rb").
- **Chip perubahan** (opsional): arah ↑/↓/→, teks ("+35%"), dan apakah perubahan itu baik, karena turun bisa baik ("−40% waktu muat").
- **Sebelum → sesudah** (opsional): "2,1% → 2,8%" dengan dua batang pembanding.
- **Grafik mini / sparkline** (opsional; aturan turunan #10): 3–12 angka berurutan, digambar sebagai SVG.
- **Progres** (opsional): 0–100, misalnya "92% kepuasan".
- **Konteks** (opsional): "3 bulan setelah peluncuran", atau sumber data.

### Isian di editor

| Kolom             | Isi                                                                                                                        | Wajib                   |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Nilai             | Angka (boleh desimal), atau teks pendek ≤12 karakter untuk nilai non-angka ("Top 3", "#1")                                 | Ya                      |
| Format            | Angka biasa, persen, rupiah, dolar, ringkas (1,2 jt / 12 rb), kali lipat (3×), durasi (jam/hari/minggu/bulan), rating (/5) | Ya (bawaan angka biasa) |
| Awalan/akhiran    | Misalnya "+", "/bulan"                                                                                                     | Tidak                   |
| Label             | ≤60 karakter                                                                                                               | Ya                      |
| Perubahan         | Arah + teks + baik/buruk                                                                                                   | Tidak                   |
| Sebelum → sesudah | Dua angka dengan format yang sama                                                                                          | Tidak                   |
| Grafik mini       | 3–12 angka                                                                                                                 | Tidak (aturan #10)      |
| Progres           | 0–100                                                                                                                      | Tidak                   |
| Konteks           | ≤80 karakter                                                                                                               | Tidak                   |
| Ikon              | Dari pemilih ikon CV                                                                                                       | Tidak                   |

Form metrik menampilkan pratinjau kecil memakai `KPI`, `TrendChip`, dan `NumberValue` HeroUI Pro; pratinjau halaman di kanan tetap yang menjadi acuan.

### Tempat pakai

1. **Blok Metrik** di detail karya: 1–4 metrik per blok, tampil sebagai grup (seperti `KPIGroup`).
2. **Metrik unggulan** di kartu karya: satu metrik tampil sebagai chip di kartu.
3. **Angka pencapaian** di intro: 2–4 metrik ringkas (nilai + label saja).

### Varian tampilan (final Phase 00)

Keputusan pemilik 2026-11-05: **ketiga varian tersedia sebagai pilihan pengguna** (tab Desain → Varian widget metrik), dengan bawaan per tema (Lugas dan Kanvas: Angka besar; Prima dan Mozaik: Kartu KPI). **Grafik mini ikut rilis pertama** sebagai isian opsional per metrik; bila kosong, grafik tidak tampil. Acuan: `mockups/metrik.html` (terang/gelap, dengan/tanpa grafik mini, tampilan HP).

- **Kartu KPI** (`kpi`): setiap metrik dalam kartu bergaris (`--pf-radius`, padding 18 px): label 15 px abu-abu, nilai 32 px tebal 700, chip perubahan di samping nilai, lalu grafik mini (tinggi 44 px) atau progres, lalu konteks 13 px. Grup memakai grid `auto-fit, minmax(210px, 1fr)`. Batang sebelum → sesudah tidak tampil di varian ini.
- **Angka besar sederet** (`big`): tanpa kartu; nilai `clamp(2.25rem, 1.7rem + 2.2vw, 3.25rem)` berwarna `--pf-accent-text`, chip perubahan di bawah nilai, label di bawahnya dalam warna teks, grafik mini kecil (maks. 160 × 28 px), konteks. Grid `auto-fit, minmax(180px, 1fr)`, jarak 32 px.
- **Sebelum → sesudah** (`ba`): label, nilai (85% ukuran KPI) + chip, lalu dua batang mendatar: "sebelum X" (abu-abu) dan "sesudah Y" (aksen), panjang sebanding nilai (min. 4%); grafik mini opsional di bawahnya. Bila metrik tidak punya isian sebelum/sesudah, kartu tetap tampil tanpa batang.
- **Di tempat lain:** chip metrik unggulan di kartu karya = pil `--pf-accent-soft` berisi nilai tebal (warna `--pf-accent-text`) + label; angka pencapaian di intro selalu nilai + label saja, dengan gaya tema (Lugas dan Kanvas angka besar, Prima strip KPI, Mozaik ubin).
- **Grafik mini:** SVG `polyline` + area dengan gradien `currentColor` 22% → 0%, garis 2 px `non-scaling-stroke`, titik akhir menonjol, warna `--pf-chart`; dihitung di server, `aria-hidden`.
- **Chip perubahan:** panah SVG + teks; warna dan latar 13% dari `--pf-positive`/`--pf-negative` sesuai "baik"/"buruk", abu-abu untuk netral. Teks pembaca layar: "naik, baik: +6,5 poin".

### Aturan

- Nilai selalu tertulis di HTML, bukan hanya di grafik. Pembaca layar membaca misalnya "Konversi checkout: 2,8 persen, naik 35 persen".
- Warna perubahan memakai `--pf-positive`/`--pf-negative`, selalu dengan panah dan teks; tidak hanya warna.
- Animasi hitung naik opsional per tema, hanya bila `prefers-reduced-motion` tidak aktif; tanpa JavaScript nilai akhir tetap tampil.
- Petunjuk di editor: "Pakai angka yang bisa kamu jelaskan saat wawancara." Kolom konteks/sumber dianjurkan.
- AI hanya menyarankan metrik dari angka yang tertulis di CV (bagian 12).

- **Dibangun di Phase 04:** form metrik berisi Label, pilihan Angka/Teks pendek, Nilai (diketik sesuai bahasa aplikasi: "2,8" di Indonesia), "Ditulis sebagai" (angka, persen, rupiah, dolar, ringkas, kali lipat, durasi + satuan, rating), teks sebelum/sesudah nilai, lalu tombol "Perubahan, sebelum → sesudah, grafik, konteks" yang membuka sisanya (saklar perubahan + arah + teks + kabar baik/buruk, nilai sebelumnya, grafik mini dari 3–12 angka, progres, konteks/sumber, ikon). Di bawahnya pratinjau kecil `KPI` + `TrendChip` HeroUI Pro (warna chip mengikuti baik/buruk, panah mengikuti arah; dimuat lazy, `recharts` sudah ada di bundel web karena halaman wawasan lamaran). Angka pencapaian Intro memakai form yang sama, maks. 4. Metrik tanpa label tidak tampil di halaman sampai diisi.

## 17. Layanan, Testimoni, Klien

### Layanan/jasa

- Item: nama ≤60, deskripsi ≤300 (teks biasa), harga opsional (teks bebas ≤40, misalnya "Mulai Rp1,5 jt"), ikon opsional, tombol: WhatsApp dengan pesan otomatis ("Halo, saya tertarik dengan layanan <nama>"), form kontak, atau tautan. Maks. 12.
- Tampil sebagai kartu atau daftar, sesuai tema.

### Testimoni

- Item: kutipan ≤500, nama ≤60, jabatan dan perusahaan ≤80, foto opsional, tautan sumber opsional (misalnya rekomendasi LinkedIn). Maks. 12.
- Saat menambah, pengguna mencentang pernyataan bahwa testimoni itu asli dan pemberinya setuju ditampilkan (aturan turunan #12).
- Tampil sebagai kartu atau geser (CSS scroll-snap, tanpa JavaScript).

### Klien/perusahaan

- Item: nama (wajib; juga dipakai sebagai teks alternatif), logo opsional (PNG/WebP, transparan dianjurkan; SVG tidak diterima), tautan opsional. Maks. 24.
- "Ambil dari Pengalaman" mengisi nama perusahaan dari CV. Logo merek yang sudah ada di set ikon (misalnya Google, Microsoft) bisa dipakai otomatis; selain itu pengguna mengunggah sendiri.
- Saat menambah logo, pengguna menyatakan berhak menampilkannya (aturan turunan #11).
- Tampil sebagai deret logo, abu-abu bawaan dan berwarna saat diarahkan; tanpa logo, nama tampil sebagai teks.

## 18. Intro dan efek teks

### Apakah intro perlu?

Ya, dan wajib. Intro adalah satu-satunya bagian yang **selalu ada dan selalu paling atas** (tidak bisa disembunyikan atau dipindah). Perekrut memutuskan lanjut membaca atau tidak dalam beberapa detik pertama, jadi intro harus langsung menjawab: siapa kamu, apa keahlianmu, dan apa langkah berikutnya (tombol). Tidak ada layar pembuka/splash atau loading animasi sebelum isi: itu memperlambat halaman, buruk untuk Google, dan membuat pengunjung pergi. Intro itu sendiri adalah pembukanya.

### Isi intro

Nama, headline, sapaan singkat, foto, chip lokasi, label Open to work, angka pencapaian (2–4), 1–3 tombol, dan latar intro (polos, gradien lembut dari aksen, pola halus, atau gambar dengan lapisan kontras otomatis).

### Efek teks (opsional)

Efek membuat intro lebih ekspresif, tapi dipakai untuk **satu elemen saja**: nama (bawaan) atau headline. Teks panjang tidak pernah dianimasikan.

| Efek           | Kesan                                                                                                    | Cocok untuk                        |
| -------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Tanpa efek     | Tenang, formal                                                                                           | Keuangan, BUMN, akademik           |
| Muncul halus   | Rapi, modern; kata muncul berurutan sekali                                                               | Semua bidang (aman sebagai bawaan) |
| Kilau          | Kilau warna aksen menyapu nama beberapa kali lalu berhenti                                               | Kreatif, pemasaran                 |
| Gradien hidup  | Warna aksen bergerak pelan di nama, lalu berhenti                                                        | Desainer, kreator                  |
| Ketik berganti | Headline mengetik bergantian 2–3 peran                                                                   | Multi-peran, freelancer            |
| Acak teknologi | Huruf acak tersusun menjadi nama                                                                         | Developer, data, IT                |
| Garis vektor   | Huruf berubah jadi garis tepi putus-putus saat disentuh kursor, dengan kotak seleksi ala aplikasi desain | Desainer UI/grafis (desktop)       |

Aturan:

- Teks asli selalu terbaca tanpa menunggu animasi (Google, pembaca layar, HP lambat).
- Menghormati pengaturan "kurangi gerakan" di perangkat: efek dimatikan otomatis.
- Animasi berhenti sendiri dalam ±5 detik; tidak ada kedip atau gerak tanpa henti.
- Kontras warna tetap aman selama animasi; tata letak tidak bergeser.
- Di HP, efek yang butuh kursor (Garis vektor) diganti Muncul halus.
- Efek dibuat sendiri oleh Rezumi (bukan salinan React Bits; `02-teknis.md` bagian 23), ringan, tanpa library animasi besar.
- Pemilihan di tab Desain → Intro dengan demo mini dan tombol "Putar ulang" di pratinjau.
- Pembagian gratis/Plus dikonfirmasi di Phase 07 (aturan turunan #14).

### Daftar final (Phase 00)

Keputusan pemilik 2026-11-05: **keenam efek masuk rilis pertama**, ditambah "Tanpa efek". Acuan gerak: `mockups/efek-intro.html` (putar ulang, kurangi gerakan, layar sentuh, HP, gelap).

| Efek           | Durasi di mockup                                                        | Lugas      | Prima      | Kanvas     | Mozaik     |
| -------------- | ----------------------------------------------------------------------- | ---------- | ---------- | ---------- | ---------- |
| Tanpa efek     | —                                                                       | ✓          | ✓ (bawaan) | ✓          | ✓          |
| Muncul halus   | ±1,2 detik: tiap kata 0,7 detik, jeda 90 ms antarkata                   | ✓ (bawaan) | ✓          | ✓          | ✓          |
| Kilau          | 3 × 1,6 detik, lalu teks kembali polos                                  | ✓          | ✓          | ✓          | ✓          |
| Gradien hidup  | 5 detik sekali, lalu gradien diam                                       | ✓          | —          | ✓          | ✓ (bawaan) |
| Ketik berganti | ±4,8 detik untuk 3 frasa, berhenti di frasa pertama                     | ✓          | ✓          | ✓          | ✓          |
| Acak teknologi | ±1,1 detik, huruf tersusun dari kiri                                    | ✓          | —          | —          | ✓          |
| Garis vektor   | Saat kursor di atas huruf; garis hilang 0,65 detik setelah kursor pergi | ✓          | —          | ✓ (bawaan) | ✓          |

- **Ketik berganti** dibatasi **maks. 3 frasa** (bukan 4) agar satu putaran selesai dalam ±5 detik. Frasa pertama tampil sejak awal, jadi teks tidak pernah kosong.
- **Garis vektor:** huruf di bawah kursor menjadi garis tepi putus-putus (SVG `stroke-dasharray`) dengan kotak seleksi bergagang empat dan label ukuran (misalnya "51 × 58") ala aplikasi desain. Di layar sentuh dan HP jatuh ke Muncul halus.
- **Gradien hidup** memakai `--pf-accent-text` dan dua warna turunannya (rona ±35–38°) yang masing-masing dikoreksi kontras terhadap latar.
- Prima menolak efek yang terlalu ramai (Gradien hidup, Acak teknologi, Garis vektor) agar tetap formal; Kanvas menolak Acak teknologi (tidak cocok dengan nama raksasa).
- **Dibangun di Phase 06:** Ketik berganti selalu memakai headline sebagai frasa pertama dan terakhir, ditambah ≤2 peran pengguna; tanpa frasa kedua efek tidak berjalan. Acak teknologi dilewati untuk nama beraksara Arab/Ibrani dan bila font belum siap 1,2 detik setelah dimuat. Pratinjau editor diam selama mengedit; efek diputar saat dipilih atau lewat "Putar ulang intro". Demo mini di tab Desain → Intro memakai CSS dan skrip yang sama dengan halaman.

## 19. Lokasi dan peta

- **Tempat:** chip lokasi (teks) di Intro, dan kartu **Lokasi** di bagian Kontak. Tema boleh memindahkan kartu (Mozaik menaruhnya sebagai ubin di intro bento).
- **Isi kartu:** kota/wilayah, peta kecil (opsional), mode kerja (Remote, Hybrid, On-site), "Bersedia relokasi", jam lokal (opsional, misalnya "14.05 WIB di Bandung" untuk perekrut di zona lain).
- **Privasi:** peta mati sebagai bawaan; presisi bawaan tingkat kota; penanda di pusat kota, bukan alamat; saat penanda digeser muncul peringatan "jangan tunjukkan alamat rumah"; tidak ada "gunakan lokasi saya".
- **Editor:** peta interaktif **HeroUI Map** untuk memilih kota (cari dari daftar kota), menggeser penanda, dan memilih presisi Kota/Provinsi/Negara.
- **Halaman publik:** gambar peta (versi terang dan gelap) yang dibuat editor saat menyimpan, penanda berwarna aksen, atribusi OpenStreetMap, dan tautan "Buka di peta". Tidak ada peta interaktif di halaman publik agar tetap cepat dan pengunjung tidak dilacak penyedia peta (peta interaktif ada di backlog).
- **Dashboard:** HeroUI Map juga menampilkan negara asal pengunjung (bagian 10).

## 20. Tema Paper (tambahan 2026-11-07)

Permintaan pemilik: menambah tema **Paper** di builder Rezumi, dengan acuan implementasi portfolio pribadi di `/Users/salmanalfariesh/Documents/Portofolio`. README, catatan desain, token, komponen Home/Grid/Hero/WorkRow dan gaya responsif proyek itu dibaca lebih dulu. Mockup Paper “Portfolio — Salman” tercatat tertinggal dari kode; kode portfolio saat ini menjadi acuan visual.

- ID `paper`, nama **Paper**, pilihan kelima di dialog buat dan Desain. Label **Plus** mengikuti tema kreatif Kanvas/Mozaik; dua tema gratis dan tema bawaan tetap sama. Penegakan paket tetap pekerjaan Phase 07.
- Kertas terang `#FEFEFC`, permukaan `#F6F7F3`, tinta `#23251D`, teks sekunder `#65675E`, garis `#D8DAD1`. Padanan gelap: `#191B16`, `#22251E`, `#F3F4EC`, `#ADB0A3`, `#3B3F34`. Aksen tetap mengikuti CV/pilihan pengguna; tanpa CV atau warna CV yang sah, bawaan Paper `#F54E00`, dikoreksi kontras untuk teks.
- Huruf bawaan **Google Sans**, angka/tanggal **JetBrains Mono**. Pilihan lain: Plus Jakarta Sans, Manrope, DM Sans, Source Serif 4 + Source Sans 3. Efek bawaan **Tanpa efek**, keenam efek yang ada tetap tersedia.
- Navigasi lebar 1321 px, isi 1082 px. Intro dua kolom: bawaan foto kecil di atas teks + ilustrasi lembar kertas isometrik SVG orisinal di kanan; alternatif foto besar kanan/kiri. Tanpa foto, ilustrasi dekoratif tetap tampil di desktop. HP menjadi satu kolom dan menyembunyikan ilustrasi dekoratif; foto pengguna tetap opsional.
- Angka intro dalam strip bersambung. Isi berupa sel bergaris tipis, tanda silang kecil di pertemuan sudut, tekstur serat dari aset asli portfolio pemilik (`paper-texture.webp`, hasil render PaperFibre), dan sudut lipatan. Tidak ada grid latar berulang atau runtime WebGL.
- Tentang dua kolom, bagian karier berpasangan (bagian terakhir yang tidak punya pasangan melebar), Karya berupa gambar/cerita berselang atau grid 2/3 kolom, Layanan daftar/kartu, Testimoni kartu/geser, Kontak di atas permukaan kertas yang lebih gelap. Urutan dan judul bagian tetap milik pengguna; semua bagian dan media memakai primitif bersama.
- Galeri memakai persona fiktif Nadia Rahmawati, bukan konten pribadi pemilik. Monogram mengambil inisial pengguna; logo Paper, isi studi kasus pribadi, ilustrasi dan shader proyek acuan tidak disalin.
- Nama mengikuti lebar kolom dengan batas bawah 28 px; teks panjang tanpa spasi boleh membungkus. Satu kartu karya adalah satu tautan dengan judul sebagai nama aksesibel. Di HP, tiga angka intro sejajar; empat angka menjadi dua baris berimbang. Sel isi berlatar solid agar teks kecil tetap kontras, sementara tekstur asli terlihat di latar dan footer.

### Koreksi tekstur Paper (2026-11-07)

Pemilik menegaskan bahwa tekstur kertas acuan harus ikut. Grain SVG beropasitas 3,5% pada versi awal terlalu tipis dan bukan padanan serat PaperFibre. Tema kini memakai byte asli `Portofolio/src/assets/paper-texture.webp` (21.594 byte), yang proyek acuan sendiri pakai sebagai hasil render statis shader pada deretan tools. Opasitas latar 55% mengikuti `.backdrop__paper`; footer 100%. Mode gelap membalik luminansinya dan memakai `screen`. Lapisan berada di belakang isi, tidak menyaring gambar karya, foto, atau teks. Tidak ada runtime WebGL baru.

## 21. Tema Brutal (tambahan 2026-11-07)

Permintaan pemilik: tema tambahan bergaya neobrutalism, mengacu ke [Neubrutalism](https://neubrutalism.com/) dan [Attachment — Neobrutalism components](https://www.neobrutalism.dev/docs/attachment). Kedua halaman dibaca dan tampilannya dilihat sebelum implementasi. Implementasi memakai primitif Rezumi; tidak memasang Shadcn/Base UI atau menyalin komponen situs acuan.

- ID `brutal`, nama **Brutal**, pilihan keenam di dialog buat dan Desain; label **Plus**, mengikuti tema kreatif. Tema bawaan dan dua tema gratis tetap sama.
- Kesan utama: latar krem, kartu putih, outline tinta 3 px (2 px di HP), radius 3–4 px, bayangan keras 4–8 px tanpa blur, huruf judul besar dan kapital, bentuk bintang dekoratif dan kartu foto sedikit miring. Isi panjang tetap memakai huruf isi yang tenang. Palet terang: `#FFFDF5` / `#FFFFFF` / `#171717` / `#545454` / `#171717`; gelap: `#171717` / `#242424` / `#FAFAF5` / `#C0C0B7` / `#FAFAF5` (latar, kartu, teks, sekunder, garis). Mode gelap merupakan adaptasi Rezumi; situs komponen acuan saat ini hanya menawarkan palet terang.
- Aksen mengikuti CV atau pilihan pengguna; tanpa warna CV yang sah bawaan kuning `#FFD23F`. Teks di atas aksen memakai token kontras, dan teks aksen dikoreksi terhadap latar/kartu. Tidak ada gradien atau blur pada gaya bawaan. Pengaturan latar intro yang sudah ada tetap dihormati bila dipilih pengguna.
- Font bawaan **Space Grotesk + Inter**; alternatif Syne + DM Sans, Plus Jakarta Sans, Archivo dan Outfit. Efek bawaan **Tanpa efek**; pilihan Muncul halus, Ketik berganti, Acak teknologi dan Garis vektor tersedia. Kilau dan Gradien hidup tidak ditawarkan oleh tema ini.
- Intro dua kolom: nama besar, headline, sapaan, chip lokasi/ketersediaan dan tombol; foto berupa kartu berbingkai dengan bar kecil di atasnya, bayangan keras, aksen di sekeliling foto dan bintang dekoratif. Foto ditampilkan hitam-putih. Tanpa foto: inisial pengguna. Varian foto kiri dan nama besar tersedia; HP menjadi satu kolom. Angka pencapaian berupa kartu berjajar dengan aksen pada setiap kartu kedua.
- Karya berada setelah Intro secara bawaan, dengan kartu bergaris dan keterangan selalu terlihat. Varian grid 2/3 kolom, unggulan + grid, dan daftar; kartu bergeser ke arah bayangannya saat hover/fokus. Bagian lain berbentuk panel dengan judul, nomor dekoratif dan isi. Semua bagian, metrik dan media tetap tersedia.
- PDF, video dan tautan mengikuti gaya kartu attachment: outline tebal, sudut kecil, bayangan keras, informasi file dan tombol yang tetap terbaca. Perilaku video/PDF, detail, lightbox, navigasi keyboard, privasi dan sanitasi memakai jalur bersama.
- Galeri Inggris/Indonesia memakai persona fiktif **Citra Maharani**. Tidak menyalin contoh isi, logo, kode atau ilustrasi dari situs acuan. Semua perubahan hanya untuk web dan paket bersama.
- Angka dan tanggal memuat **IBM Plex Mono**. Nama dibatasi minimal 28 px; teks tanpa spasi membungkus, termasuk saat memakai Syne. Judul kartu karya berupa heading dan menjadi nama aksesibel satu tautan kartu.

## 22. Tampilan paket (Phase 07, 2026-11-09)

- Label paket (Gratis, Plus) hanya tampil bila paket berlaku untuk akun; dengan `BILLING_MODE=off` tidak ada label.
- Tema dan efek intro yang terkunci tetap bisa dilihat, dengan gembok di label Plus. Menekannya membuka dialog paket, bukan memilihnya. Tema atau efek yang sudah dipakai tetap bisa dipilih dan tidak bergembok.
- Saklar badge ada di Desain → Lencana. Di paket Gratis saklarnya selalu menyala, dan menekannya membuka dialog paket.
- Tombol Tambah karya saat batas paket tercapai tetap aktif dan membuka dialog paket. Saat batas teknis 50 tercapai tombolnya nonaktif, karena tidak ada paket yang lebih besar.
- Meteran penyimpanan ada di bawah daftar Karya: "Gambar dan PDF, 1 MB dari 100 MB". File yang dihapus dalam 24 jam terakhir masih terhitung.
- Domain sendiri: label Plus di kolom domain, tombol Hubungkan membuka dialog paket, dan tawaran membeli domain `.cv` tidak ditampilkan pada akun yang belum bisa menghubungkan domain.
