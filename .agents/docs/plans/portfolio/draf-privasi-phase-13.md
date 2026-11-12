# Draf Kebijakan Privasi — fitur Phase 13 (disetujui pemilik 2026-11-13, sudah masuk `docs/legal/`)

Usulan paragraf untuk `docs/legal/kebijakan-privasi.mdx` (Indonesia, yang berlaku) dan `docs/legal/privacy-policy.mdx` (terjemahan Inggris), bagian **Portfolio web** / **Web portfolios**. Ditulis 2026-11-12 oleh sesi dokumentasi Phase 13 (`phase-13-fitur-lanjutan.md` bagian 10). **Disetujui pemilik pada 2026-11-13 dan dimasukkan ke kedua berkas apa adanya; tanggal berlaku tidak diubah.**

## Kenapa belum dimasukkan

- Halaman legal di `docs/` terbit langsung (terdaftar di `docs/docs.json`) dan tidak punya tanda draf: pemilik mencabut tanda draf pada 2026-11-09 (log `00-keputusan.md`), dan tanggal berlaku tertulis 12 November 2026. Satu-satunya penanda yang ada, kalimat "Bagian ini berlaku setelah fitur portfolio diluncurkan" / "This section applies once portfolios launch", menandai bagian Portfolio sebagai belum berlaku, bukan sebagai draf. Menyisipkan paragraf baru berarti langsung terbit.
- Keputusan pemilik di kontrak Phase 13 (bagian 8, jawaban 2026-11-12): teks Kebijakan Privasi untuk sematan menunggu persetujuan pemilik sebelum terbit. Penyedia sematan (#7) dan QR (#8) masih bawaan koordinator yang boleh diubah pemilik.

## Cara memasukkannya setelah disetujui

Di kedua berkas, bagian Portfolio web:

1. Tambahkan satu baris pada tabel data (baris A di bawah).
2. Tambahkan tiga butir baru **setelah butir Video** (Sematan, Kata sandi portfolio, Simpan kontak) dan satu kalimat pada butir "Statistik tanpa cookie pelacak" (kalimat tambahan di bawah).
3. Tambahkan frasa cookie akses pada kalimat cookie di bagian "Data, tujuan, dan dasar pemrosesan" (frasa C di bawah).
4. Perbarui tanggal berlaku bila pemilik menghendaki; jangan menaikkannya diam-diam.

## Bahasa Indonesia (`kebijakan-privasi.mdx`)

**A. Baris tabel Portfolio web (setelah baris "Isi portfolio, …"):**

```text
| Hash kata sandi portfolio dan cookie akses portfolio                               | Membatasi akses ke portfolio yang dilindungi pemiliknya | Pelaksanaan perjanjian; pilihan pemilik portfolio       |
```

**Butir baru, setelah butir Video:**

```text
- **Sematan.** Konten dari Figma, Loom, Spotify, SoundCloud, dan Google Slides baru dimuat setelah pengunjung menekan tombolnya; sebelum itu tidak ada permintaan ke layanan tersebut
  (gambar pratinjau adalah salinan di penyimpanan portfolio). Setelah ditekan, browser pengunjung memuat konten langsung dari layanan itu, yang dapat menerima alamat IP dan data browser
  pengunjung, memasang atau membaca cookie sendiri, dan memprosesnya menurut kebijakan privasinya sendiri sebagai pihak ketiga. Di bawah tombol ada catatan "Memuat konten dari …".
- **Kata sandi portfolio.** Pemilik dapat melindungi portfolionya dengan satu kata sandi. Kata sandi hanya disimpan sebagai hash, bukan teks asli, dan tidak masuk log atau ekspor data.
  Pengunjung yang memasukkan kata sandi yang benar menerima cookie akses yang berlaku 12 jam di browser itu (hanya penanda portfolio dan masa berlaku yang ditandatangani, tanpa data pribadi),
  dan alamat file portfolio (gambar, PDF) yang mereka terima memuat token yang berlaku 12 sampai 24 jam. Percobaan kata sandi yang salah dibatasi menurut alamat IP pengunjung (alamat IPv6
  dihitung per blok /64) dan menurut portfolio; hitungan itu hanya disimpan sementara dan tidak memuat kata sandi yang dicoba. Selama portfolio berkata sandi, isinya tidak ditunjukkan kepada
  pengunjung tanpa kata sandi, tidak diindeks mesin pencari, dan tidak masuk peta situs. Mengganti atau menghapus kata sandi mencabut akses yang ada.
- **Simpan kontak.** Halaman portfolio dapat menawarkan tombol Simpan kontak yang mengunduh kartu kontak (vCard) ke perangkat pengunjung. Kartu dibuat saat diunduh dari data yang sudah tampil
  di halaman: nama, headline, alamat portfolio, dan email, nomor WhatsApp, telepon, situs, profil, serta kota hanya bila pemilik menampilkannya; tanpa foto dan alamat jalan. Rezumi tidak
  menyimpan data pengunjung untuk ini; unduhan hanya dihitung sebagai angka agregat.
```

**Kalimat tambahan pada butir "Statistik tanpa cookie pelacak" (di akhir butir):**

```text
Statistik juga menghitung halaman karya yang dibuka, dan bila pengunjung datang lewat kode QR pada kartu nama pemilik (alamatnya memuat `utm_source=qr`) sumbernya dicatat sebagai "QR".
```

**C. Kalimat cookie di bagian "Data, tujuan, dan dasar pemrosesan" (ganti "Cookie diperlukan untuk login, tema dan bahasa;" dengan):**

```text
Cookie diperlukan untuk login, tema dan bahasa, dan untuk akses ke portfolio yang berkata sandi (12 jam);
```

## English (`privacy-policy.mdx`)

**A. Table row for Web portfolios (after the "Portfolio content, …" row):**

```text
| Portfolio password hash and portfolio access cookie                                       | Limiting access to a portfolio its owner protects | Contract; the portfolio owner's choice              |
```

**New bullets, after the Videos bullet:**

```text
- **Embeds.** Content from Figma, Loom, Spotify, SoundCloud and Google Slides loads only after a visitor presses its button; until then no request goes to those services (the preview
  picture is a copy stored with the portfolio). After the press, the visitor's browser loads the content straight from that service, which may receive the visitor's IP address and browser
  data, may set or read its own cookies, and processes them under its own privacy policy as a third party. A note under the button says "Loads content from …".
- **Portfolio password.** A portfolio's owner can protect it with one password. The password is stored only as a hash, never as plain text, and is not written to logs or data exports.
  A visitor who enters the right password receives an access cookie that lasts 12 hours in that browser (only a signed portfolio marker and expiry, no personal data), and the portfolio file
  addresses (pictures, PDFs) they are given carry a token that lasts 12 to 24 hours. Wrong password attempts are limited by the visitor's IP address (an IPv6 address by its /64 block) and by
  portfolio; those counts are kept only briefly and never hold the password tried. While a portfolio has a password, its content isn't shown to visitors without it, isn't indexed by
  search engines and isn't in the sitemap. Changing or removing the password ends existing access.
- **Save contact.** A portfolio page can offer a Save contact button that downloads a contact card (vCard) to the visitor's device. The card is made when it's downloaded, from what the page
  already shows: name, headline, portfolio address, and email, WhatsApp number, phone, website, profiles and city only when the owner shows them; no photo and no street address. Rezumi
  stores no visitor data for this; downloads are only counted as aggregate numbers.
```

**Additional sentence at the end of the "Statistics without tracking cookies" bullet:**

```text
Statistics also count the work pages opened, and when a visitor arrives through the QR code on the owner's business card (its address carries `utm_source=qr`) the source is recorded as "QR".
```

**C. Cookie sentence in "Data, purposes and legal bases" (replace "Cookies support login, theme and language;" with):**

```text
Cookies support login, theme and language, and access to a portfolio protected by a password (12 hours);
```

## Yang perlu diputuskan atau dicek pemilik

1. **Penyedia sematan memasang cookie apa** tidak diverifikasi oleh agent: teksnya sengaja memakai "dapat" (may). Figma, Loom, Spotify, SoundCloud, dan Google (Slides) adalah pihak ketiga yang memproses data pengunjung menurut kebijakannya sendiri setelah tombol ditekan. Bila ingin menyebut mereka sebagai penerima di bagian "Penerima data" dengan negara pemrosesan seperti Dodo Payments dan SumoPod, minta konsultan hukum menilainya.
2. **Hitungan batas percobaan kata sandi** memakai alamat IP pengunjung sementara (Redis, penyimpanan koordinasi Cloudflare, atau memori proses; masa simpan paling lama sejam untuk anggaran per portfolio, sepuluh menit untuk per alamat). Bagian "Data" yang ada berkata IP mentah tidak disimpan untuk statistik; paragraf di atas hanya menyebut "disimpan sementara". Cek apakah itu cukup atau perlu masa simpan yang tertulis.
3. **Token file** 12 sampai 24 jam (bukan "12 jam" persis) karena berlaku sampai akhir jendela 12 jam berikutnya (`laporan-phase-13/pf-server.md`, "Security review"). Bila kode berubah, sesuaikan angkanya.
4. **Syarat dan Ketentuan** (`syarat-dan-ketentuan.mdx`, `terms-of-service.mdx`) tidak diubah dan mungkin perlu satu kalimat bahwa pemilik yang memakai kata sandi bertanggung jawab atas siapa yang diberi kata sandi, dan bahwa karya di bawah NDA tetap tanggung jawab pemilik. Tidak ada usulan teks di sini karena tidak diminta.
5. Setelah disetujui dan dimasukkan, catat di log `00-keputusan.md` dan tandai butir terkait di `phase-13-fitur-lanjutan.md` bagian 10.
