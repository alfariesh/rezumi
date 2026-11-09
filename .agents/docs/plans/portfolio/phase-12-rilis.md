# Phase 12 — Uji menyeluruh dan rilis

| Dikerjakan       | Ukuran | Bergantung pada | Perlu dari pemilik                                                                |
| ---------------- | ------ | --------------- | --------------------------------------------------------------------------------- |
| Claude + pemilik | Sedang | Semua phase     | Waktu uji ±1 jam, secret produksi diisi sendiri, izin eksplisit menyalakan saklar |

## Untuk pemilik

**Apa yang dibuat:** pengecekan terakhir dari awal sampai akhir di produksi (masih mode `admins`), panduan pengguna di `/docs`, bagian Portfolio di beranda dan halaman harga, lalu saklar `PORTFOLIO_MODE=on` sehingga semua pengguna bisa memakainya.

**Siapkan:**

1. Secret produksi yang belum terpasang. Claude memandu perintahnya, kamu yang menjalankan dan menempel nilainya sendiri:
   - `pnpm exec wrangler secret put TURNSTILE_SECRET_KEY`
   - `pnpm exec wrangler secret put CLOUDFLARE_SAAS_API_TOKEN` (bila belum di Phase 09)
2. Waktu ±1 jam untuk mencoba bersama di HP dan laptop.
3. Izin tertulis di chat untuk menyalakan saklar.

**Prompt:** `Kerjakan Phase 12 dari .agents/docs/plans/portfolio/README.md`

**Yang bisa kamu cek di akhir:** daftar uji dengan tanda ✅/❌, tautan panduan, dan portfolio contoh yang bisa kamu bagikan.

## Untuk agent

### Langkah

1. **Checklist di produksi** (mode `admins`, akun admin uji milik pemilik):
   - buat dari CV dan tanpa CV, isi semua bagian (angka pencapaian, layanan, testimoni, klien), karya dengan semua jenis blok (teks, gambar, metrik, video, PDF, tempel tautan), semua tema, mode, dan varian metrik, terbitkan, buka sebagai tamu di HP;
   - kartu WhatsApp/LinkedIn (alat debugger kartu), Google Rich Results Test, sitemap;
   - form kontak (email masuk, kotak pesan), statistik bergerak;
   - efek intro yang dirilis (juga dengan "kurangi gerakan" menyala di HP), kartu Lokasi dengan peta terang/gelap, rincian statistik dari Analytics Engine (negara pada peta dashboard) muncul setelah beberapa kunjungan uji;
   - domain sendiri dengan domain uji;
   - AI draf dan tulis ulang (kredit terpotong benar);
   - laporan → tangguhkan → cabut;
   - paket Gratis vs Plus sesuai status `BILLING_MODE` produksi saat itu (bila billing belum `on`, cek dengan akun admin di mode `admins` dan catat);
   - ekspor dan hapus akun uji.
2. **Kinerja produksi**: Lighthouse HP untuk tiap tema; catat LCP, CLS, ukuran JS.
3. **Panduan** (`docs/`, bahasa Inggris seperti panduan lain): terbitkan `docs/guides/creating-a-portfolio.mdx` dari draf Phase 03 dan tambahan phase lain (tema, karya dan blok, metrik, video/PDF/tautan, layanan/testimoni/klien, domain sendiri, pesan, statistik, AI, paket), entri `docs/docs.json`, tangkapan layar fiktif 2×; perbarui `sharing-your-resume-publicly.mdx`, `docs/use-cases/export-and-share-resumes.mdx`, `docs/self-hosting/sharing-domains.mdx`. Jalankan `pnpm --filter web test src/features/docs`.
4. **Pemasaran**: bagian Portfolio di beranda (`apps/web/src/routes/_home/-sections`), daftar manfaat paket, SEO/llms.txt, prerender. Halaman pemasaran dengan segmen pertama baru hanya setelah mengecek username di database dan menambah segmen ke daftar cadangan (`02-teknis.md` bagian 1).
5. **API publik**: putuskan bersama pemilik prosedur mana yang keluar dari tag `Internal` (misalnya baca saja); jalankan `pnpm docs:gen`. Tool MCP ke backlog.
6. **Nyalakan**: PR terpisah yang mengubah `PORTFOLIO_MODE` di `wrangler.jsonc` menjadi `"on"`, hanya setelah izin eksplisit pemilik. Pantau log galat, waktu render, dan laporan selama 48 jam pertama.
7. **Rencana mundur**: kembalikan saklar ke `admins`; alamat pendek akun yang portfolionya terbit kembali membuka CV utama, data tidak hilang.
8. **Tutup rencana**: status semua phase di README, catatan sesi, dan ringkasan sisa pekerjaan ke `backlog-lanjutan.md`.

### Aturan yang wajib dijaga

- Tidak menyalakan saklar tanpa izin eksplisit pemilik di sesi ini.
- Tidak memakai data pribadi pengguna sungguhan untuk uji; hanya akun dan persona fiktif.

### Selesai bila

- Semua butir checklist ✅ atau tercatat dengan keputusan pemilik.
- Panduan dan halaman pemasaran tayang; saklar `on` dan pemantauan awal bersih.

### Catatan dari Phase 07 (2026-11-09)

- Saat `PORTFOLIO_MODE=on`, domain sendiri mulai berbayar untuk akun Gratis. Perbarui `docs/guides/sharing-your-resume-publicly.mdx` dan `docs/guides/using-the-api.mdx` yang masih menyebutnya tanpa syarat paket.
- Tambahan S&K soal portfolio sudah disetujui pemilik (2026-11-09); hapus tanda "setelah diluncurkan" dari baris portfolio di `docs/legal/syarat-dan-ketentuan.mdx` dan `docs/legal/terms-of-service.mdx` saat rilis.

### Catatan dari Phase 08 (2026-11-09)

- Buat widget Turnstile dengan hostname `rezumi.app`, lalu isi `TURNSTILE_SITE_KEY` di `vars` `wrangler.jsonc` dan `pnpm exec wrangler secret put TURNSTILE_SECRET_KEY`. Jangan memakai kunci uji di produksi: kunci uji melewatkan cek hostname. Tanpa kedua kunci, form tidak tampil.
- Rincian Plus (peta negara, perangkat, perujuk, karya per hari) belum pernah dicoba dengan Analytics Engine sungguhan, karena hanya berjalan di Cloudflare. Di mode `admins`, buka portfolio dari HP, tunggu beberapa menit, lalu pastikan rinciannya tampil. Bila tetap tidak tampil, cari `Reading analytics details failed` di log Worker.
- Pastikan email notifikasi terkirim dengan `Reply-To` pengirim lewat binding `send_email`.
