# Daftar uji rilis portfolio (Phase 12)

Tanda: ✅ lulus · ❌ gagal · ⬜ belum · ⏸️ ditunda dengan keputusan pemilik. Semua uji memakai akun dan persona fiktif, bukan data pribadi sungguhan.

## A. Prasyarat

| Butir                                                                                                            | Status | Catatan (2026-11-09)                                                               |
| ---------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------- |
| Deploy `main` terakhir sukses                                                                                    | ✅     | Commit `95dc64ad`, GitHub Actions sukses                                           |
| Migrasi basis data terpasang                                                                                     | ✅     | Langkah `db:migrate` di deploy yang sama berjalan                                  |
| `/api/health` sehat (database, R2)                                                                               | ✅     |                                                                                    |
| Secret produksi: `TURNSTILE_SECRET_KEY`, `CLOUDFLARE_SAAS_API_TOKEN`, `BILLING_ALERT_EMAIL`, `POLAR_*`           | ✅     | Dicek namanya saja lewat `wrangler secret list`, izin pemilik                      |
| `TURNSTILE_SITE_KEY` di `wrangler.jsonc`                                                                         | ✅     |                                                                                    |
| Domain uji `uji.nadzom.com` terbuka lewat HTTPS, kartu, kanonik, tautan laporan, dan skrip Turnstile ada di HTML | ✅     | `noindex` karena mode `admins`                                                     |
| Billing siap: `BILLING_MODE=on`                                                                                  | ⬜     | **Wajib sebelum saklar** (keputusan pemilik). Membership Phase 12 langkah 10 belum |
| Akun admin uji fiktif, terpisah dari akun utama pemilik                                                          | ⬜     | Butir "hapus akun uji" tidak boleh dijalankan pada akun utama                      |

## B. Uji fungsi di produksi (mode `admins`)

| Butir                                                                                                       | Status                             |
| ----------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Buat dari CV dan tanpa CV                                                                                   | ⬜                                 |
| Isi semua bagian: angka pencapaian, layanan, testimoni, klien                                               | ⬜                                 |
| Karya dengan semua blok: teks, gambar, metrik, video, PDF, tempel tautan                                    | ⬜                                 |
| Semua tema (Lugas, Prima, Kanvas, Mozaik, Paper, Brutal), mode terang/gelap/perangkat, tiga varian metrik   | ⬜                                 |
| Terbitkan, buka sebagai tamu di HP                                                                          | ⬜                                 |
| Kartu WhatsApp dan LinkedIn (alat debugger kartu)                                                           | ⬜                                 |
| Google Rich Results Test                                                                                    | ⬜                                 |
| Sitemap memuat portfolio (setelah saklar `on`; akun < 7 hari tidak ikut)                                    | ⬜                                 |
| Form kontak: email masuk dengan `Reply-To` pengirim, muncul di kotak pesan                                  | ⬜                                 |
| Statistik bergerak setelah kunjungan uji                                                                    | ⬜                                 |
| Efek intro, juga dengan "kurangi gerakan" menyala di HP                                                     | ⬜                                 |
| Kartu Lokasi dengan peta terang/gelap                                                                       | ⬜                                 |
| Rincian Analytics Engine: negara pada peta dashboard (bila kosong, cari `Reading analytics details failed`) | ⬜                                 |
| Domain sendiri dengan domain uji                                                                            | ✅ Phase 09 (dicek ulang saat uji) |
| AI draf dan tulis ulang, kredit terpotong benar                                                             | ⬜                                 |
| Laporan → tangguhkan → cabut                                                                                | ⬜                                 |
| Paket Gratis vs Plus sesuai `BILLING_MODE` saat itu                                                         | ⬜                                 |
| Ekspor dan hapus akun uji                                                                                   | ⬜                                 |

## C. Kinerja produksi (Lighthouse HP)

| Tema   | LCP | CLS | Ukuran JS |
| ------ | --- | --- | --------- |
| Lugas  | ⬜  | ⬜  | ⬜        |
| Prima  | ⬜  | ⬜  | ⬜        |
| Kanvas | ⬜  | ⬜  | ⬜        |
| Mozaik | ⬜  | ⬜  | ⬜        |
| Paper  | ⬜  | ⬜  | ⬜        |
| Brutal | ⬜  | ⬜  | ⬜        |

## D. Urutan rilis

1. Billing go-live selesai dan `BILLING_MODE=on` tayang.
2. Bagian B dan C lulus.
3. Pemilik menulis izin menyalakan saklar di chat.
4. Merge PR panduan + beranda (branch `feat/portfolio-12-rilis`). Bagian beranda tersembunyi sampai saklar `on`; panduan langsung tayang, jadi merge di hari yang sama.
5. Merge PR saklar yang terpisah, berisi: `PORTFOLIO_MODE` menjadi `"on"` di `wrangler.jsonc`, dan penghapusan kalimat "setelah fitur portfolio diluncurkan" / "once portfolios launch" di `docs/legal/{syarat-dan-ketentuan,kebijakan-privasi,terms-of-service,privacy-policy}.mdx`. Beranda hasil prerender ikut membaca saklar dari `wrangler.jsonc`.

## E. Pemantauan 48 jam pertama

Log galat Worker, waktu render halaman portfolio, laporan masuk ke `BILLING_ALERT_EMAIL`, jumlah custom hostname di Cloudflare.

## F. Rencana mundur

Kembalikan `PORTFOLIO_MODE` ke `"admins"` lewat PR (revert PR saklar). Alamat pendek akun yang portfolionya terbit kembali membuka CV utama; data tidak hilang.
