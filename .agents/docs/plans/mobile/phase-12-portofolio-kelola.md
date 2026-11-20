# Phase 12 — Portofolio I: kelola, terbitkan, statistik, pesan

| Dikerjakan              | Ukuran | Bergantung pada | Perlu dari pemilik |
| ----------------------- | ------ | --------------- | ------------------ |
| Claude + review pemilik | Besar  | Phase 03        | —                  |

## Untuk pemilik

**Apa yang dibuat:** tab **Portfolio**: membuat portofolio (dari Profil, dari CV, atau kosong), menerbitkan dan menarik kembali, alamat dan tombol bagikan, kartu nama QR, kata sandi, status domain, statistik pengunjung, pesan masuk, dan **pratinjau halaman asli** di dalam app. Mengedit isi hadir di Phase 13.

**Prompt:** `Kerjakan Phase 12 dari .agents/docs/plans/mobile/README.md`

**Yang bisa kamu cek di akhir:** menerbitkan portofolio dari ponsel, memindai QR-nya dengan ponsel lain, membaca pesan masuk, di iPhone dan Android.

## Untuk agent

### Langkah

1. Baca `.agents/docs/plans/portfolio/README.md` (dan `02-teknis` di sana), butir Portofolio di "Feature parity exceptions", web `apps/web/src/features/portfolio`.
2. **Server: `portfolio.preview`** (`02-teknis.md` bagian 6): prosedur baru, pemilik saja, tes di `packages/api`; `pnpm docs:gen` bila spesifikasi berubah; `pnpm check:cloudflare`.
3. **Pindahkan logika** yang dibutuhkan phase ini ke `@rezumi/portfolio`: CSV statistik (`statistics/csv.ts`), model status/terbit, vCard sudah ada. Hindari subpath yang menarik `sanitize-html` ke app (`./initial`, `./rich-text`): bila perlu, pecah supaya bagian murninya bisa diimpor.
4. **Tab Portfolio (`src/features/portfolio`):**
   - Belum punya: buat (sumber Profil / CV / kosong, pilih tema dari galeri bergambar, draf AI opsional `portfolio.ai.draft`).
   - Sudah punya: kartu status (draf/terbit, `portfolio.setPublic`), alamat dengan salin dan bagikan, tombol Preview dan Edit, ringkasan statistik, pesan belum dibaca.
   - **Publish:** alamat, mesin pencari dan sumber data (`portfolio.updateSettings`), kata sandi (`setPassword`/`removePassword`), domain kustom dengan tahap (`customDomain.get`), tombol Save contact, hapus portofolio.
   - **Kartu nama:** QR dari alamat dengan `?utm_source=qr` (`react-native-qrcode-svg`), layar penuh untuk dipindai, simpan/bagikan PNG. Lembar cetak A4: "Atur di web" (K7).
   - **Statistik:** rentang 7/30/90 hari, grafik (Pro), sumber, per karya dengan detail (`portfolio.statistics`, `workStatistics`), bagikan CSV. Peta pengunjung tidak dibawa; tampilkan daftar negara.
   - **Pesan:** kotak masuk (`portfolio.messages.*`): daftar, detail, tandai dibaca, hapus, balas lewat app email.
5. **Pratinjau:** WebView sesuai bagian 6; tombol ukuran ponsel/desktop; buka halaman publik di browser.
6. Batas paket (Free/Plus) ditampilkan dengan pesan netral (K6); aturan batas datang dari server.

### Tes dan verifikasi

- Tes API `portfolio.preview` (pemilik, bukan pemilik, draf vs terbit).
- Tes komponen: keadaan belum punya/draf/terbit, kotak masuk, statistik kosong.
- Maestro di dua platform: buat → terbitkan → pratinjau → tarik kembali; baca pesan.
- Keamanan WebView: tautan keluar tidak membuka di dalam WebView; tanpa akses file. Minta tinjauan baca-saja atas prosedur pratinjau dan konfigurasi WebView.
- Daftar cek dua platform.

### Selesai bila

- Portofolio bisa dibuat, diterbitkan, dipantau, dan dibagikan dari app.
- Pratinjau di app sama dengan halaman publik.
