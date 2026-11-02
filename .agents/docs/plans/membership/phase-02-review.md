# Phase 02 — review dan serah terima

Tanggal: 2 November 2026. **Implementasi draf selesai; Phase 02 sebagian sampai pemilik mengisi data dan menyetujui dokumen.**
Tidak ada deploy, perubahan BILLING_MODE, pembayaran, atau aktivasi provider.

## Hasil

- Empat dokumen Indonesia: `docs/legal/syarat-dan-ketentuan.mdx`, `kebijakan-privasi.mdx`, `kebijakan-pengembalian-dana.mdx`, `kontak.mdx`.
  Empat terjemahan Inggris pada slug lama terms/privacy dan slug baru refund/contact. Setiap pasangan saling tertaut; Indonesia berlaku bagi konsumen Indonesia.
  Seluruh dokumen berstatus draf, tanggal berlaku belum ditetapkan. Lisensi MIT dan atribusi dipertahankan; file LICENSE tidak diubah.
- Docs memakai navigasi tab tunggal tanpa konfigurasi bahasa. Halaman Indonesia ditambahkan pada grup Legal; slug Inggris tetap tersedia untuk tautan lama.
- `@rezumi/schema/billing` mengekspor `BILLING_SELLER` dan `LEGAL_URLS`. Nama, alamat, nomor pengaduan dan usia minimum dikonfirmasi pemilik pada 2 November 2026;
  `identityConfirmed: true`, `minimumAge: 18`. Email belum dikonfirmasi eksplisit (`supportEmailConfirmed: false`);
  tenggat penyelesaian masih null. Jam layanan Senin–Jumat 09.00–17.00 WIB, respons awal maksimal 3 hari kerja. Phase 06/07 harus memakai konstanta ini untuk bukti bayar/email dan menolak finalisasi identitas yang belum lengkap.
  Teks MDX perlu diselaraskan dengan konstanta saat data pemilik diterima; situs docs tidak mengimpor kode workspace.
- Footer/homepage dan Settings web/mobile memakai tautan legal Indonesia dan kontak. Tautan Source, Crowdin, dan GitHub issues app dihapus.
  Mobile tetap menyediakan MIT dan layar lisensi dependensi. Halaman legal terbuka untuk memenuhi akses dokumen; tidak ada tautan checkout pada halaman legal.
  Tidak menambah UI paket/kredit/harga atau tombol beli pada mobile; pengecualian kanal Phase 08 tetap berlaku.
- Kredit halaman CV publik menjadi “Made with Rezumi”/“Dibuat dengan Rezumi”, termasuk daftar pesan PDF dan katalog hasil generator.
- Pricing membaca flag publik billing dari context route. Default/prerender tertutup: harga tetap terlihat, paid CTA nonaktif “Segera tersedia”,
  penjelasan paid limits/trial belum aktif. Flag true mempertahankan intent pendaftaran paket untuk UI Phase 07; belum membuat checkout baru.
  Manfaat Plus tidak memuat “Full job search insights”. README, SEO llms, docs use case/introduction dan catatan review toko diselaraskan.
- Lingui web dan mobile diekstrak; salinan Indonesia baru diterjemahkan. Locale lain memakai fallback Inggris bila belum diterjemahkan.

## Data dan keputusan pemilik yang belum ada

1. Konfirmasi email **hi@rezumi.app** aktif/dibaca (jawaban pemilik mengonfirmasi nama).
2. Tetapkan tenggat penyelesaian pengaduan dan keputusan refund; tenggat 3 hari kerja dicatat untuk respons awal.
3. Identitas/alamat/nomor dan usia minimum sudah dimasukkan ke konfigurasi, Phase 00 dan dua versi legal.
4. Usia minimum 18 tahun adalah keputusan kebijakan; penegakan umur pada alur akun belum ditambahkan dalam perubahan draf ini.
5. Provider email produksi, provider/model Rezumi AI, lokasi pemrosesan, retensi/pelatihan provider, perjanjian dan mekanisme transfer lintas negara.
6. Lama simpan log, tiket dukungan, ledger, backup dan siklus penghapusannya; validasi rencana catatan pembukuan 10 tahun serta anonimisasi setelah hapus akun.
7. Tanggal berlaku, proses pemberitahuan dan persetujuan pemilik atas dua versi. Ganti semua placeholder dan hapus label draf setelah disetujui.

Tidak ada tenggat atau identitas yang dikarang. Jangan menerbitkan halaman ini sebagai kebijakan final sebelum butir tersebut lengkap.

## Tinjauan konsultan yang disarankan

- S&K: kelayakan usia, identitas/legalitas penjual, pemenuhan jasa digital, hak konsumen, penangguhan, tanggung jawab dan penyelesaian sengketa.
- Refund: syarat komersial pembelian pertama (7 hari/maksimal 10 kredit), hak pemulihan di luar syarat itu, pencabutan akses/kredit,
  SLA operasional serta transfer manual tanpa membebankan fee refund penuh kepada konsumen.
- Privasi: dasar setiap pemrosesan, data anak, hak dan tenggat khusus, pelaporan insiden, transfer lintas negara,
  retensi/anonimisasi vs kewajiban pembukuan; bukti refund manual dapat tetap memuat data penerima.
- Rencana sebelumnya menyebut PP 33/2026 berlaku 16 Januari 2027. Pencarian menemukan ringkasan sekunder,
  tetapi teks resmi belum terverifikasi dalam sesi ini. Jangan mengklaim telah memenuhi PP tersebut; periksa teks resmi dan kebutuhan penyesuaian sebelum tanggal itu.

## Dasar yang diperiksa

- Kontrak elektronik berbahasa Indonesia dan isi minimum: [PP 80/2019, sumber resmi Kemendag](https://jdih.kemendag.go.id/peraturan/peraturan-pemerintah-nomor-80-tahun-2019-tentang-perdagangan-melalui-sistem-elektronik).
- Dasar hak/pemrosesan, tenggat tindakan tertentu dan insiden: [UU 27/2022, JDIH Komdigi](https://jdih.komdigi.go.id/produk_hukum/view/id/832/t/crc32/).
- Larangan klausula baku yang menghilangkan hak konsumen: [UU 8/1999, JDIH Kemenkeu](https://jdih.kemenkeu.go.id/api/download/fulltext/1999/8TAHUN~1999UU.htm).
- Bahasa perjanjian: [UU 24/2009, JDIH Setneg](https://jdih.setneg.go.id/detailperaturan?jns=UU&no=24&thn=2009).
- Jendela refund bervariasi menurut metode/acquirer; metode tak didukung atau melewati jendela memakai transfer manual:
  [Midtrans: metode refund](https://docs.midtrans.com/docs/metode-pembayaran-apa-yang-memiliki-fitur-refund).
  Karena itu draf tidak menjanjikan dana masuk dalam tujuh hari atau mengurangi hak pelanggan mengikuti batas QRIS.

## Verifikasi

- Typecheck: web, mobile, server, schema lulus.
- Tes: pricing web 2; SEO server 3; HTML PDF 3; mobile 30. **38 lulus, 0 gagal, 0 skipped**.
- Build web/prerender lulus. Tidak ada skrip build docs dalam manifest; MDX legal dikompilasi dengan GFM,
  dirender lokal; 18 MDX berubah terkompilasi, 9 entri navigasi legal dan 32 tautan internal legal valid. Preview lokal memakai sumber MDX, bukan tema Mintlify produksi.
- `pnpm lint:agent`, `pnpm format:check`, `pnpm exec turbo boundaries` lulus; boundaries memeriksa 1.602 file dalam 24 paket.
- Browser pane: pricing Indonesia dari HTML prerender build, harga dan dua tombol nonaktif diverifikasi; screenshot pricing dan draf S&K ditampilkan.
- Grep ulang sumber app/katalog dan docs publik: klaim layanan “free and open source”/“no paid tier” dihapus;
  penyebutan komponen open source/lisensi/editor eksternal tetap sah. Repositori pada instruksi maintainer dan integrasi/dependency tidak dihapus secara membabi buta.

## Cara mengecek

Baca empat halaman Indonesia dan pasangan Inggris; cari `[BELUM`, `[PERLU`, `[KONFIRMASI`, `[OWNER`, `[CONFIRMATION`.
Pada homepage, flag billing false/absen harus memberi dua tombol nonaktif dan harga Rupiah. Flag true mengaktifkan tautan intent paket.
Pada Settings web/mobile, buka Kontak, Privasi, S&K, Refund dan Lisensi; URL baru baru tersedia publik setelah deploy docs terpisah.

## Pembaruan data pemilik — 2 November 2026

Nama, alamat dan nomor pengaduan diterima dari pemilik. Jam layanan Senin–Jumat 09.00–17.00 WIB;
tenggat 3 hari kerja ditafsirkan sebagai respons awal, bukan janji seluruh kasus/refund selesai.
Usia minimum 18 tahun diterapkan pada draf S&K dan privasi; tidak ada opsi pengguna anak dengan izin wali.
Persetujuan identitas bukan persetujuan seluruh draf legal atau izin deploy. Retensi/provider, tenggat penyelesaian, email dan tanggal berlaku tetap menunggu finalisasi.

Verifikasi pembaruan data: typecheck schema, lint dan format lulus; 9 MDX legal terkompilasi dan 32 tautan internal valid.
