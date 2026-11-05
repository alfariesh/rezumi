# Keputusan produk — revamp template CV

Keputusan pemilik yang berlaku untuk semua phase. Agent tidak mengubahnya diam-diam: bila implementasi menunjukkan satu keputusan tidak bisa dipakai, jelaskan pilihannya, tanya pemilik, lalu catat di log di bawah.

## 1. Lineup

- **Semua 18 template lama (nama Pokémon) diganti**, bukan diarsip. Belum ada pengguna sungguhan, jadi CV lama boleh berubah tampilan. Nama Pokémon adalah merek dagang Nintendo dan tidak dipakai lagi di produk berbayar ini.
- ID lama tetap **dibaca** (file impor Reactive Resume, data uji, JSON lama) dan dipetakan ke penggantinya. ID lama tidak pernah ditulis lagi.
- Lineup baru 16 template, 7 nama global + 9 nama Indonesia:

| #   | Nama     | Kolom | Untuk siapa                                                         | Menggantikan       | Paket   |
| --- | -------- | ----- | ------------------------------------------------------------------- | ------------------ | ------- |
| 1   | Meridian | 1     | Default; modern bersih untuk semua bidang                           | Onyx, Rhyhorn      | Gratis  |
| 2   | Sterling | 1     | Klasik serif; keuangan, hukum, konsultan                            | Persian            | Gratis  |
| 3   | Aksara   | 1     | Editorial ala majalah; penulis, desainer, komunikasi                | Smeargle           | Premium |
| 4   | Atlas    | 1     | Label bagian di kolom kiri, gaya Swiss                              | Bronzor            | Premium |
| 5   | Tunas    | 1     | Padat satu halaman; fresh graduate dan magang                       | Kakuna             | Gratis  |
| 6   | Summit   | 1     | Eksekutif dan manajer senior                                        | Scizor, Lapras     | Premium |
| 7   | Cendekia | 1     | Akademik, riset, beasiswa (LPDP dan sejenisnya)                     | baru               | Premium |
| 8   | Wibawa   | 1     | Formal Indonesia: foto + Data Pribadi; BUMN, CPNS, perusahaan lokal | Meowth             | Gratis  |
| 9   | Tenun    | 1     | Grid bergaris ala DRH/rirekisho                                     | Porygon            | Premium |
| 10  | Vector   | 1     | Developer dan data; stack sebagai chip + logo                       | baru               | Premium |
| 11  | Kirana   | 2     | Sidebar kiri lembut, foto bulat                                     | Glalie, Gengar     | Gratis  |
| 12  | Linen    | 2     | Sidebar kanan putih bergaris tipis, minimalis                       | Leafish, Chikorita | Premium |
| 13  | Horizon  | 2     | Pita header penuh + dua kolom                                       | Ditto, Pikachu     | Premium |
| 14  | Jejak    | 2     | Timeline garis dan titik untuk perjalanan karier                    | Azurill            | Premium |
| 15  | Purnama  | 2     | Sidebar gelap elegan                                                | Ditgar             | Premium |
| 16  | Senja    | 2     | Kreatif, nama besar, blok warna asimetris                           | baru               | Premium |

ID teknis = nama dalam huruf kecil (`meridian`, `sterling`, …). Template default untuk CV baru: **Meridian**.

**Perluasan 2026-11-05: 20 template baru (total 36)**. Cerah, Teras dan Lintasan masuk paket Gratis (`BILLING_CATALOG_VERSION` 4); 17 lainnya Premium. Spesifikasi di `01-desain.md` → "Perluasan 2026-11-05".

| Nama     | Kolom | Untuk siapa                                     | Nama     | Kolom | Untuk siapa                                 |
| -------- | ----- | ----------------------------------------------- | -------- | ----- | ------------------------------------------- |
| Anggrek  | 1     | Mewah rata tengah; perhotelan, PR, private bank | Graphite | 2     | Sidebar arang kanan; tech lead, keuangan    |
| Ivory    | 1     | Minimalis Nordik; desainer, produk              | Awan     | 2     | Panel bulat kiri berisi nama; kreatif, muda |
| Pilar    | 1     | Rel aksen di margin; perbankan, audit, BUMN     | Menara   | 2     | Blok aksen di atas sidebar; keuangan, BUMN  |
| Bingkai  | 1     | Bingkai ganda klasik; akademik, kebijakan       | Tepi     | 2     | Garis aksen di tepi kertas; riset, tech     |
| Cerah    | 1     | Pita judul lembut; fresh graduate, tech         | Sekar    | 2     | Header serif tengah + kartu; kreatif        |
| Mozaik   | 1     | Kartu bento; desainer, produk                   | Marquee  | 2     | Nama sangat besar + kartu; kreatif          |
| Nusa     | 1     | Label judul solid; pemasaran, kreatif muda      | Fajar    | 2     | Pita header lembut; fresh graduate          |
| Selaras  | 1     | Header terbelah; konsultan, produk, fintech     | Cahaya   | 2     | Garis aksen kolom; cloud, data, fintech     |
| Teras    | 1     | Bilah kontak berwarna; fresh graduate, CPNS     |          |       |                                             |
| Cobalt   | 1     | Batang aksen di nama; pemerintahan, keuangan    |          |       |                                             |
| Kontras  | 1     | Tipografi poster; art director, kreatif         |          |       |                                             |
| Lintasan | 1     | Timeline satu kolom; fresh graduate, tech       |          |       |                                             |

## 2. Ikon dan logo

- Ikon PDF pindah dari Phosphor ke **Hugeicons** (sudah ada di `packages/icons`), dengan **tiga gaya: Standar, Rounded, Sharp**. Gaya berlaku untuk seluruh CV.
- Ikon bisa **dimatikan semua** dengan satu saklar, atau per kelompok: kontak, judul bagian (Pendidikan, Keahlian, Sertifikasi, …), dan ikon item (keahlian, minat, profil).
- **Logo profil** (LinkedIn, GitHub, Behance, Dribbble, X, …) dipilih otomatis dari nama jaringan. Username/URL tetap dicetak sebagai teks.
- **Logo tools/stack di Keahlian** (React, Python, Figma, Excel, …): opsional, default mati, satu warna, kecil, selalu di samping teks nama. Tidak pernah logo saja, karena ATS tidak membaca gambar.
- Logo perusahaan di Pengalaman **tidak** dibuat (butuh layanan logo pihak ketiga, lisensi dan privasi). Bisa dipertimbangkan nanti.

## 3. Paket (membership)

- **Gratis:** Meridian, Sterling, Tunas, Wibawa, Kirana, dan sejak 2026-11-05 Cerah, Teras, Lintasan; semua gaya ikon; logo profil.
- **Plus dan Pro AI:** 11 template lain; logo tools/stack di Keahlian.
- Aturan lama tetap: dokumen yang sudah memakai template premium tetap memakainya; batas hanya menghalangi memilih template premium baru. Font sendiri, Custom Styles, Word/ODT, API/MCP tidak berubah.
- Mengubah daftar template gratis = mengubah isi paket: naikkan `BILLING_CATALOG_VERSION` dan perbarui halaman legal/harga yang menyebut template gratis.

## 4. Mutu yang dijanjikan

- Semua template: teks asli (bukan gambar), satu urutan baca, judul bagian standar, kontak di badan dokumen. Satu kolom = "ATS aman"; dua kolom = "visual" (tetap terbaca ATS modern, ditandai jujur di galeri).
- Setiap template harus tetap rapi **dengan dan tanpa foto**, A4 dan Letter, 1–3 halaman, bahasa RTL, serta warna aksen apa pun yang dipilih pengguna.
- Fitur dibuat di web dulu. App mobile belum dikerjakan (keputusan 2026-11-04) dan menyusul sebelum rilis toko pertama (aturan di `CLAUDE.md`).

## Log keputusan

| Tanggal    | Keputusan                                                                                                                           | Oleh    |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 2026-11-03 | Ganti semua 18 template (belum ada pengguna sungguhan); 16 nama di atas disetujui                                                   | Pemilik |
| 2026-11-03 | 5 template gratis (Meridian, Sterling, Tunas, Wibawa, Kirana); semua gaya ikon gratis; logo tools Plus                              | Pemilik |
| 2026-11-03 | Dikerjakan di checkout yang sama dengan sesi custom font (sesi itu hampir selesai)                                                  | Pemilik |
| 2026-11-04 | Kirana: urutan baca teks diperbaiki di mesin PDF (Forme `row-reverse`), tampilan tetap; bukan memindahkan header ke lebar penuh     | Pemilik |
| 2026-11-04 | Web dulu: app mobile belum dikerjakan; bagian mobile tiap phase ditunda sampai pemilik memintanya                                   | Pemilik |
| 2026-11-04 | Foto persona contoh galeri dari Unsplash (nama dan isi CV fiktif); sumber dan lisensi tiap foto di `template-showcase-sources.json` | Pemilik |
| 2026-11-05 | Tambah 20 template baru yang elegan dan modern (12 satu kolom, 8 dua kolom); semuanya Premium, contoh galeri tanpa foto             | Pemilik |
