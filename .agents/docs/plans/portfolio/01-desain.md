# Desain — portfolio web

Untuk pemilik dan agent. Phase 00 mengganti bagian 5 dengan spesifikasi final empat tema dan menetapkan varian widget metrik (bagian 16) setelah pemilik memilih mockup.

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

| Kontrol                     | Pilihan                                                                                                                             | Bawaan                   |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Tema                        | 4 tema rilis (2 gratis, 2 Plus)                                                                                                     | Tema gratis pertama      |
| Mode warna                  | Terang, Gelap, Ikuti perangkat                                                                                                      | Sesuai tema              |
| Warna aksen                 | Ikut CV, 8 warna kurasi, warna bebas (hex)                                                                                          | Ikut CV                  |
| Font                        | Ikut CV, 5–6 pasangan font kurasi per tema                                                                                          | Pasangan bawaan tema     |
| Urutan bagian               | Seret untuk mengurutkan                                                                                                             | Urutan bawaan tema       |
| Tampil/sembunyi bagian      | Per bagian                                                                                                                          | Bagian berisi tampil     |
| Judul bagian                | Teks sendiri (≤60 karakter)                                                                                                         | Judul bawaan per bahasa  |
| Item dari CV                | Sembunyikan per item                                                                                                                | Semua tampil             |
| Varian per bagian           | Sesuai tabel bagian 3, hanya yang didukung tema                                                                                     | Bawaan tema              |
| Varian widget metrik        | Varian yang lolos Phase 00 (bagian 16)                                                                                              | Bawaan tema              |
| Data dasar khusus portfolio | Foto, headline, nama tampilan, lokasi (kosong = ikut CV)                                                                            | Ikut CV                  |
| Intro                       | Sapaan, foto tampil/tidak, Open to work + teks, angka pencapaian, tombol                                                            | Dari CV                  |
| Efek intro                  | Kandidat: Tanpa efek, Muncul halus, Kilau, Gradien hidup, Ketik berganti, Acak teknologi, Garis vektor (daftar final dari Phase 00) | Bawaan tema              |
| Latar intro                 | Polos, gradien lembut dari aksen, pola halus, gambar (lapisan kontras otomatis)                                                     | Polos                    |
| Lokasi                      | Label kota, peta tampil/tidak, presisi Kota/Provinsi/Negara, Remote/Hybrid/On-site, bersedia relokasi, jam lokal                    | Label dari CV, peta mati |
| Kontak                      | Email, WhatsApp (nomor), form kontak, tautan profil, kalimat ajakan                                                                 | Email + profil menyala   |
| SEO                         | Judul, deskripsi, tampil di mesin pencari                                                                                           | Otomatis dari isi        |
| Bahasa halaman              | Bahasa yang didukung aplikasi                                                                                                       | Bahasa CV sumber         |
| Badge                       | Tampil/sembunyi (Plus)                                                                                                              | Tampil                   |

Sengaja tidak ada di rilis pertama: CSS sendiri, font unggahan, ukuran atau posisi bebas, pilihan animasi, beberapa halaman, beberapa portfolio, unggah file video. Lihat `backlog-lanjutan.md`.

## 5. Tema: enam arah untuk mockup Phase 00

Nama adalah nama kerja; pemilik menyetujui nama final di Phase 00 (hindari bentrok dengan nama template CV). Rilis memakai 4 tema (2 gratis + 2 Plus); dua sisanya pindah ke backlog.

| Nama kerja | Untuk siapa                                               | Tata letak                                                                  | Ciri khas                                                        | Usulan paket |
| ---------- | --------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------ |
| Lugas      | Semua bidang; tema bawaan                                 | Satu kolom sempit (±680 px), tipografi besar, banyak ruang putih            | Karya sebagai daftar dengan sampul kecil; tenang dan rapi        | Gratis       |
| Prima      | Keuangan, konsultan, BUMN, manajer, fresh graduate formal | Intro dua kolom dengan foto, angka pencapaian, timeline pengalaman menonjol | Warna tenang, garis rapi, kesan tepercaya; metrik gaya kartu KPI | Gratis       |
| Kanvas     | Desainer, fotografer, arsitek, kreator konten             | Grid gambar besar, keterangan saat hover atau tap                           | Detail karya layar penuh; mode gelap menonjolkan gambar          | Plus         |
| Sintaks    | Developer, data, IT                                       | Intro bergaya terminal, kartu proyek bergaya repositori                     | Aksen font mono, chip tech stack + logo, tautan GitHub dan demo  | Plus         |
| Mozaik     | Kreator, freelancer, mahasiswa                            | Grid "bento": kartu berbagai ukuran (foto, tentang, tautan, karya, angka)   | Ceria, sudut bulat, cocok untuk layanan dan banyak tautan        | Plus         |
| Warta      | Penulis, PR/komunikasi, pemasaran, peneliti               | Gaya majalah: judul serif besar, kolom, kutipan                             | Cerita karya terasa seperti artikel; testimoni sebagai kutipan   | Plus         |

Setiap tema wajib mendukung: semua bagian di bagian 3; semua jenis blok karya (bagian 15) dan widget metrik (bagian 16); terang dan gelap (satu boleh jadi bawaan); semua warna aksen dengan koreksi kontras; semua pasangan font yang ditawarkan tema itu; isi sangat sedikit dan sangat banyak; nama sangat panjang; `dir="rtl"`; lebar 360–1920 px tanpa geser horizontal.

## 6. Token desain bersama

Setiap tema hanya membaca token ini (CSS custom properties), sehingga kustomisasi berlaku sama di semua tema:

- Warna: `--pf-accent`; `--pf-accent-text` (aksen yang aman sebagai teks: digeser terang/gelap sampai kontras ≥4,5:1 untuk teks kecil dan ≥3:1 untuk teks besar dan ikon); `--pf-on-accent` (teks di atas blok aksen); `--pf-bg`, `--pf-surface`, `--pf-text`, `--pf-muted`, `--pf-border`; `--pf-positive` dan `--pf-negative` (chip tren metrik, kontras aman); `--pf-chart` (garis grafik mini, bawaan = aksen). Dua set: terang dan gelap.
- Huruf: `--pf-font-heading`, `--pf-font-body`, `--pf-font-mono`, ditambah skala ukuran per tema; angka metrik memakai `font-variant-numeric: tabular-nums`.
- Bentuk: `--pf-radius`, `--pf-max-width`, skala spasi per tema.

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

## 8. Halaman Portfolio di dashboard

`/dashboard/portfolio`: kartu status (Terbit/Belum terbit, alamat, Salin, Buka, Edit), statistik 30 hari (Phase 08), pesan masuk (Phase 08), domain (Phase 09). Menu "Portfolio" hanya tampil bila `PORTFOLIO_MODE` mengizinkan akun itu.

## 9. Form kontak (Phase 08)

- Kolom: nama, email, pesan (≤2.000 karakter). Teks kecil di bawah form: pesan dikirim ke pemilik portfolio dan email pengirim terlihat olehnya agar bisa membalas.
- Anti-spam: Cloudflare Turnstile, kolom jebakan tersembunyi, batas per pengunjung dan per portfolio.
- Setelah kirim: pesan sukses di tempat. Tanpa JavaScript, form tetap terkirim (POST biasa, kembali dengan tanda terkirim).
- Tombol layanan "Pesan lewat form" mengisi pesan awal dengan nama layanan.
- Pemilik portfolio menerima email notifikasi (membalas email = membalas pengirim) dan melihat pesan di dashboard; bisa menandai dibaca, menghapus, dan mematikan form.

## 10. Statistik (Phase 08)

Hanya pemilik yang melihat: kunjungan 30 hari (grafik harian), klik tombol (Lihat CV, Unduh PDF CV, WhatsApp, Email, tautan, layanan), karya yang paling sering dibuka, PDF karya yang dibuka, video yang diputar, jumlah pesan, sumber kunjungan (LinkedIn, WhatsApp, Google, langsung, lainnya), negara pengunjung pada peta HeroUI, dan jenis perangkat (HP/desktop). Rincian negara, perangkat, dan perujuk berasal dari Cloudflare Analytics Engine dan ditandai "perkiraan". Dashboard boleh memakai `KPI`/`KPIGroup` HeroUI Pro untuk menampilkannya. Tanpa cookie pelacak; kunjungan pemilik dan bot tidak dihitung; satu pengunjung dihitung sekali per jam, sama seperti CV.

## 11. Domain sendiri (Phase 09)

Di tab Terbitkan dan halaman dashboard: masukkan domain → tampilkan record DNS (CNAME + TXT) dengan tombol salin → "Cek DNS" → status bertahap: DNS ✓ → kepemilikan ✓ → sertifikat HTTPS ✓ → Aktif. Untuk domain utama tanpa `www`, sarankan `www.` atau subdomain dan pengalihan domain utama di registrar. Akun Gratis melihat kontrol terkunci berlabel Plus.

## 12. AI (Phase 10)

- Saat membuat portfolio: "Tulis draf dengan AI" (intro, Tentang saya, ringkasan dan blok Teks cerita setiap karya) dari CV sumber. Hasil masuk ke editor sebagai perubahan yang bisa di-Urungkan.
- Di kolom teks panjang dan blok Teks: tombol AI kecil (lebih singkat, lebih profesional, terjemahkan ke bahasa halaman).
- **Temukan angka**: AI membaca uraian pengalaman dan proyek di CV, lalu menyarankan metrik ("meningkatkan konversi 35%" → metrik "+35% konversi"). Pengguna memilih mana yang dipakai. AI tidak pernah menambah angka yang tidak tertulis.
- Label biaya kredit, pilihan sumber AI (Rezumi AI atau koneksi sendiri), dan dialog kredit kurang mengikuti pola AI yang sudah ada.
- AI tidak boleh mengarang fakta (angka, nama klien, hasil) yang tidak ada di CV atau catatan pengguna.

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

### Varian tampilan (dipilih di Phase 00)

- **Kartu KPI**: kartu dengan label, nilai besar, chip perubahan, grafik mini atau progres, konteks.
- **Angka besar sederet**: nilai sangat besar + label, tanpa kartu (cocok untuk tema tenang seperti Lugas dan Warta).
- **Sebelum → sesudah**: dua nilai dengan panah dan batang pembanding.

### Aturan

- Nilai selalu tertulis di HTML, bukan hanya di grafik. Pembaca layar membaca misalnya "Konversi checkout: 2,8 persen, naik 35 persen".
- Warna perubahan memakai `--pf-positive`/`--pf-negative`, selalu dengan panah dan teks; tidak hanya warna.
- Animasi hitung naik opsional per tema, hanya bila `prefers-reduced-motion` tidak aktif; tanpa JavaScript nilai akhir tetap tampil.
- Petunjuk di editor: "Pakai angka yang bisa kamu jelaskan saat wawancara." Kolom konteks/sumber dianjurkan.
- AI hanya menyarankan metrik dari angka yang tertulis di CV (bagian 12).

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
| Ketik berganti | Headline mengetik bergantian 2–4 peran                                                                   | Multi-peran, freelancer            |
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
- Daftar final efek untuk rilis dipilih pemilik dari demo di Phase 00 (aturan turunan #13); pembagian gratis/Plus dikonfirmasi di Phase 07 (aturan turunan #14).

## 19. Lokasi dan peta

- **Tempat:** chip lokasi (teks) di Intro, dan kartu **Lokasi** di bagian Kontak. Tema boleh memindahkan kartu (misalnya ubin bento di Mozaik).
- **Isi kartu:** kota/wilayah, peta kecil (opsional), mode kerja (Remote, Hybrid, On-site), "Bersedia relokasi", jam lokal (opsional, misalnya "14.05 WIB di Bandung" untuk perekrut di zona lain).
- **Privasi:** peta mati sebagai bawaan; presisi bawaan tingkat kota; penanda di pusat kota, bukan alamat; saat penanda digeser muncul peringatan "jangan tunjukkan alamat rumah"; tidak ada "gunakan lokasi saya".
- **Editor:** peta interaktif **HeroUI Map** untuk memilih kota (cari dari daftar kota), menggeser penanda, dan memilih presisi Kota/Provinsi/Negara.
- **Halaman publik:** gambar peta (versi terang dan gelap) yang dibuat editor saat menyimpan, penanda berwarna aksen, atribusi OpenStreetMap, dan tautan "Buka di peta". Tidak ada peta interaktif di halaman publik agar tetap cepat dan pengunjung tidak dilacak penyedia peta (peta interaktif ada di backlog).
- **Dashboard:** HeroUI Map juga menampilkan negara asal pengunjung (bagian 10).
