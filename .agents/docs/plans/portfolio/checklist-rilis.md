# Daftar uji rilis portfolio (Phase 12)

Tanda: ✅ lulus · ❌ gagal · ⬜ belum · ⏸️ ditunda dengan keputusan pemilik. Semua uji memakai akun dan persona fiktif, bukan data pribadi sungguhan.

## A. Prasyarat

| Butir                                                                                                                                       | Status | Catatan (2026-11-09)                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------- |
| Deploy `main` terakhir sukses                                                                                                               | ✅     | Commit `95dc64ad`, GitHub Actions sukses                                                                                    |
| Migrasi basis data terpasang                                                                                                                | ✅     | Langkah `db:migrate` di deploy yang sama berjalan                                                                           |
| `/api/health` sehat (database, R2)                                                                                                          | ✅     |                                                                                                                             |
| Secret produksi: `TURNSTILE_SECRET_KEY`, `CLOUDFLARE_SAAS_API_TOKEN`, `BILLING_ALERT_EMAIL`, `POLAR_*`                                      | ✅     | Dicek namanya saja lewat `wrangler secret list`, izin pemilik                                                               |
| `TURNSTILE_SITE_KEY` di `wrangler.jsonc`                                                                                                    | ✅     |                                                                                                                             |
| Domain uji `uji.nadzom.com` terbuka lewat HTTPS, kartu, kanonik, tautan laporan, dan skrip Turnstile ada di HTML                            | ✅     | `noindex` karena mode `admins`                                                                                              |
| Billing siap: `BILLING_MODE=on`                                                                                                             | ⬜     | **Wajib sebelum saklar** (keputusan pemilik). Membership Phase 12 langkah 10 belum                                          |
| Akun admin uji fiktif, terpisah dari akun utama pemilik                                                                                     | ⬜     | Butir "hapus akun uji" tidak boleh dijalankan pada akun utama                                                               |
| Migrasi Phase 13 terpasang: `20261112061017_mighty_norrin_radd` (indeks) dan `20261112064636_broken_luke_cage` (kolom `portfolio.password`) | ⬜     | Keduanya diterapkan langkah `db:migrate` di deploy; cek sebelum menguji kata sandi                                          |
| Teks Kebijakan Privasi Phase 13 (sematan, vCard, kata sandi) disetujui pemilik dan dimasukkan ke `docs/legal/`                              | ⬜     | Usulan di `draf-privasi-phase-13.md`; halaman legal terbit langsung, jadi masuk bersama atau sebelum fitur dipakai pengguna |
| `pnpm check:cloudflare` dan `pnpm test:cloudflare` (smoke: halaman karya, kartu karya PNG, kata sandi, file bertoken)                       | ⬜     | Lulus per laporan sesi pf-server 2026-11-12; ulangi di `main`                                                               |

## B. Uji fungsi di produksi (mode `admins`)

| Butir                                                                                                                             | Status                             |
| --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Buat dari CV dan tanpa CV                                                                                                         | ⬜                                 |
| Isi semua bagian: angka pencapaian, layanan, testimoni, klien                                                                     | ⬜                                 |
| Karya dengan semua blok: teks, gambar, metrik, video, PDF, tempel tautan                                                          | ⬜                                 |
| Semua delapan tema (Lugas, Prima, Kanvas, Mozaik, Paper, Brutal, Sintaks, Warta), mode terang/gelap/perangkat, tiga varian metrik | ⬜                                 |
| Terbitkan, buka sebagai tamu di HP                                                                                                | ⬜                                 |
| Kartu WhatsApp dan LinkedIn (alat debugger kartu)                                                                                 | ⬜                                 |
| Google Rich Results Test                                                                                                          | ⬜                                 |
| Sitemap memuat portfolio (setelah saklar `on`; akun < 7 hari tidak ikut)                                                          | ⬜                                 |
| Form kontak: email masuk dengan `Reply-To` pengirim, muncul di kotak pesan                                                        | ⬜                                 |
| Statistik bergerak setelah kunjungan uji                                                                                          | ⬜                                 |
| Efek intro, juga dengan "kurangi gerakan" menyala di HP                                                                           | ⬜                                 |
| Kartu Lokasi dengan peta terang/gelap                                                                                             | ⬜                                 |
| Rincian Analytics Engine: negara pada peta dashboard (bila kosong, cari `Reading analytics details failed`)                       | ⬜                                 |
| Domain sendiri dengan domain uji                                                                                                  | ✅ Phase 09 (dicek ulang saat uji) |
| AI draf dan tulis ulang, kredit terpotong benar                                                                                   | ⬜                                 |
| Laporan → tangguhkan → cabut                                                                                                      | ⬜                                 |
| Paket Gratis vs Plus sesuai `BILLING_MODE` saat itu                                                                               | ⬜                                 |
| Ekspor dan hapus akun uji                                                                                                         | ⬜                                 |

## B2. Uji Phase 13 (mode `admins`, akun uji fiktif)

| Butir                                                                                                                                                                                                  | Status |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| **Halaman karya:** klik kartu di halaman utama → alamat `/<username>/work/<slug>`, judul karya satu-satunya `h1`, tombol Kembali peramban ke halaman utama                                             | ⬜     |
| Halaman karya: "Semua karya" ke `#work`, karya sebelumnya/berikutnya, navigasi ke bagian halaman utama, kaki (badge, Laporkan), cetak (tautan kembali hilang)                                          | ⬜     |
| Halaman karya tanpa JavaScript tetap terbaca; sematan dan video menjadi tautan                                                                                                                         | ⬜     |
| Halaman karya di domain sendiri (`/work/<slug>`); path lain tetap dialihkan ke aplikasi                                                                                                                | ⬜     |
| **Alamat lama:** ubah alamat sebuah karya, buka alamat lama → 301 ke alamat baru; alamat yang tidak dikenal → 404 halaman polos dengan tautan ke portfolio                                             | ⬜     |
| Karya tersembunyi, tanpa judul, atau saat bagian Karya disembunyikan → 404, tanpa kartu share dan tanpa entri sitemap                                                                                  | ⬜     |
| Kartu WhatsApp dan LinkedIn untuk satu halaman karya (judul karya, nama + peran, foto); Google Rich Results Test (`CreativeWork`)                                                                      | ⬜     |
| Sitemap memuat alamat utama dan alamat setiap karya (setelah saklar `on`; akun < 7 hari tidak ikut)                                                                                                    | ⬜     |
| **Kata sandi:** pasang di Terbitkan → jendela samaran melihat halaman kunci tanpa nama, foto, atau isi; saklar mesin pencari mati dengan catatan                                                       | ⬜     |
| Kata sandi: salah → pesan galat; benar → halaman terbuka; membuka halaman karya langsung juga diminta lalu kembali ke karya itu; tidak diminta lagi di peramban itu                                    | ⬜     |
| Kata sandi: berganti kata sandi mencabut akses lama; menghapus kata sandi membuka kembali; pemilik yang login tidak diminta; domain sendiri meminta pemilik juga                                       | ⬜     |
| Kata sandi: alamat gambar/PDF tanpa `?access=` → 404, dengan token dari halaman → 200; setelah berganti kata sandi token lama 404                                                                      | ⬜     |
| Kata sandi: kartu share memakai banner umum, vCard 404, form pesan tidak menerima, tidak di sitemap, `noindex`; `?report` tetap bisa dibuka                                                            | ⬜     |
| Kata sandi: terlalu banyak salah (per alamat 5 per 10 menit; per portfolio 100 per jam) → pesan tunggu; form dari situs lain → 403 (dicek tes otomatis)                                                | ⬜     |
| **Sematan**, satu per satu (Figma, Loom, Spotify, SoundCloud, Google Slides): tempel tautan → judul dan gambar terisi (Google Slides diketik sendiri)                                                  | ⬜     |
| Sematan: di halaman karya hanya gambar dan tombol "Tampilkan … di sini" (tab Network kosong dari penyedia), catatan "Memuat konten dari …"; klik → pemutar muncul                                      | ⬜     |
| Sematan: tautan pendek SoundCloud (`on.soundcloud.com`), set SoundCloud/album Spotify (tinggi 380 px), Google Slides yang tidak dibagikan publik menampilkan petunjuk                                  | ⬜     |
| Sematan: tidak ada galat CSP di konsol saat pemutar dimuat; blok Tautan menawarkan "Sematkan saja" untuk alamat yang bisa disematkan                                                                   | ⬜     |
| **Kartu nama:** dialog di Terbitkan dan di dasbor; unduh PNG dan SVG; cetak lembar A4 berisi 10 kartu; layar penuh di HP                                                                               | ⬜     |
| Kartu nama: pindai QR dengan HP → portfolio terbuka dengan `?utm_source=qr`; statistik menampilkan sumber "Kode QR"                                                                                    | ⬜     |
| **Simpan kontak:** tombol di Kontak dan sebagai tombol intro; unduh `.vcf` di iPhone dan Android → kontak masuk; isinya hanya yang tampil di halaman                                                   | ⬜     |
| Simpan kontak: email atau telepon disembunyikan → tidak ada di berkas; "Tampilkan lokasiku" mati → tanpa alamat; saklar Simpan kontak mati → tombol hilang, rute 404                                   | ⬜     |
| **Open to work:** nyalakan, isi posisi (maks. 5) dan jenis kerja → baris "Mencari" muncul setelah chip intro di kedelapan tema, juga RTL; mati bawaan                                                  | ⬜     |
| **Statistik:** rentang 7/30/90 hari (alamat `?range=`), tabel Per karya, dialog rincian per karya (Gratis: terkunci membuka dialog paket; Plus: sumber, perujuk, negara, perangkat, klik)              | ⬜     |
| Statistik: pembukaan karya oleh tamu terhitung di baris karya itu; kunjungan pemilik tidak; rincian Analytics Engine tampil di produksi (bukan `not-configured`)                                       | ⬜     |
| Statistik: unduh CSV Harian dan Karya (Gratis), Rincian (Plus); buka di Excel, Google Sheets, dan Numbers (Excel berbahasa Indonesia: pemisah `;`, backlog B49); sel berawalan `=` tidak menjadi rumus | ⬜     |
| **Sintaks dan Warta:** pilih dari galeri (terkunci di Gratis), terang/gelap, semua varian dan efek, halaman utama dan halaman karya, 390 dan 1440 px, RTL; pemilik menilai tampilannya                 | ⬜     |
| E2E `tests/e2e/specs/portfolio-phase-13.spec.ts` lulus (`pnpm build`, database baru, `PORTFOLIO_MODE=on`)                                                                                              | ⬜     |
| Matriks visual 8 tema (halaman utama + halaman karya) dilihat; Safari, Firefox, dan HP sungguhan untuk Sintaks dan Warta (backlog B48)                                                                 | ⬜     |

## C. Kinerja produksi (Lighthouse HP)

| Tema                                      | LCP | CLS | Ukuran JS |
| ----------------------------------------- | --- | --- | --------- |
| Lugas                                     | ⬜  | ⬜  | ⬜        |
| Prima                                     | ⬜  | ⬜  | ⬜        |
| Kanvas                                    | ⬜  | ⬜  | ⬜        |
| Mozaik                                    | ⬜  | ⬜  | ⬜        |
| Paper                                     | ⬜  | ⬜  | ⬜        |
| Brutal                                    | ⬜  | ⬜  | ⬜        |
| Sintaks                                   | ⬜  | ⬜  | ⬜        |
| Warta                                     | ⬜  | ⬜  | ⬜        |
| Halaman karya (satu tema, dengan sematan) | ⬜  | ⬜  | ⬜        |

## D. Urutan rilis

1. Billing go-live selesai dan `BILLING_MODE=on` tayang.
2. Bagian B, B2, dan C lulus.
3. Pemilik menulis izin menyalakan saklar di chat, dan menyetujui teks Kebijakan Privasi Phase 13 (`draf-privasi-phase-13.md`) bila belum.
4. Merge PR panduan + beranda (branch `feat/portfolio-12-rilis`). Bagian beranda tersembunyi sampai saklar `on`; panduan langsung tayang, jadi merge di hari yang sama.
5. Merge PR saklar yang terpisah, berisi: `PORTFOLIO_MODE` menjadi `"on"` di `wrangler.jsonc`, dan penghapusan kalimat "setelah fitur portfolio diluncurkan" / "once portfolios launch" di `docs/legal/{syarat-dan-ketentuan,kebijakan-privasi,terms-of-service,privacy-policy}.mdx`. Beranda hasil prerender ikut membaca saklar dari `wrangler.jsonc`.

## E. Pemantauan 48 jam pertama

Log galat Worker, waktu render halaman portfolio, laporan masuk ke `BILLING_ALERT_EMAIL`, jumlah custom hostname di Cloudflare.

## F. Rencana mundur

Kembalikan `PORTFOLIO_MODE` ke `"admins"` lewat PR (revert PR saklar). Alamat pendek akun yang portfolionya terbit kembali membuka CV utama; data tidak hilang.
