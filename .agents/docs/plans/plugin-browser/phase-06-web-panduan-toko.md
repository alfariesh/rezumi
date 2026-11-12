# Phase 06 — Web Rezumi, panduan, privasi, materi toko

| Dikerjakan              | Ukuran | Bergantung pada | Perlu dari pemilik                                                    |
| ----------------------- | ------ | --------------- | --------------------------------------------------------------------- |
| Claude + review pemilik | Sedang | Phase 05        | Menyetujui teks Kebijakan Privasi, S&K, dan listing toko; jawaban #10 |

## Untuk pemilik

**Apa yang dibuat:**

1. **Di web Rezumi:** ajakan "Pasang plugin" di halaman Lamaran dan di Pengaturan (tersembunyi sampai plugin terbit di toko), halaman singkat "Kenapa berhenti?" yang terbuka saat plugin dicopot.
2. **Panduan pengguna** "Menyimpan lowongan dari browser" (Inggris) dengan gambar persona fiktif.
3. **Kebijakan Privasi dan S&K** (Indonesia dan Inggris): bagian plugin, sebagai draf untuk kamu setujui.
4. **Materi toko**: nama, deskripsi singkat dan panjang (Indonesia dan Inggris), alasan tiap izin, jawaban formulir privasi toko, ikon, lima tangkapan layar, dan gambar promosi.

**Siapkan:** waktu ±30 menit untuk membaca dan menyetujui teks; jawaban aturan turunan #10.

**Prompt:** `Kerjakan Phase 06 dari .agents/docs/plans/plugin-browser/README.md`

**Yang bisa kamu cek di akhir:** baca folder `materi-toko/` dan draf legal yang ditunjukkan Claude; lihat gambar toko.

## Untuk agent

### Langkah

1. **Konfirmasi aturan turunan #10**, catat di `00-keputusan.md`.
2. **Ajakan pasang di web:** satu konstanta URL toko (Chrome, Edge) yang masih kosong; bila kosong, ajakan tidak tampil. Tempat: halaman Lamaran (keadaan kosong dan dialog tambah lamaran, dekat "tempel tautan"), Pengaturan → Integrasi. Pilih tombol toko sesuai browser pengunjung (Edge → Edge Add-ons, lainnya → Chrome Web Store). Lingui + id-ID.
3. **Halaman setelah dicopot** (#10): rute publik ringan di web (ikuti aturan rute pemasaran publik di `CLAUDE.md`: fallback dan SEO server di `apps/server/src/static/web.ts`, `noindex`), isian opsional tanpa data pribadi. Bila isian butuh endpoint baru, pakai batas laju publik dan Turnstile seperti form publik yang ada, atau cukup tautan email; pilih yang paling sederhana dan catat. Plugin memanggil `chrome.runtime.setUninstallURL` ke halaman ini.
4. **Panduan** `docs/guides/saving-jobs-from-your-browser.mdx` (judul akhir menyesuaikan gaya panduan lain) di grup "Application Tracker" `docs/docs.json`, tangkapan layar persona fiktif (dibuat dengan Playwright + fixtures, bukan situs asli), tautan dari `adding-an-application.mdx` dan `tracking-job-applications.mdx`. `pnpm --filter web test src/features/docs` harus lulus.
5. **Legal:** bagian plugin di `docs/legal/kebijakan-privasi.mdx`, `privacy-policy.mdx`, dan bila perlu S&K: data yang dibaca, kapan, apa yang dikirim dan disimpan, token login, izin, penanda tersimpan yang dihitung lokal, laporan halaman, pernyataan "Limited Use" yang diminta Chrome Web Store. Tandai sebagai draf sampai pemilik setuju.
6. **Materi toko** di `.agents/docs/plans/plugin-browser/materi-toko/`: `listing.md` (nama dari #1, deskripsi singkat ≤132 karakter dan panjang, Indonesia + Inggris, kategori), `izin.md` (alasan tiap izin dan izin host untuk formulir review), `privasi-toko.md` (jawaban formulir praktik privasi Chrome dan Edge, penjelasan satu tujuan), gambar sesuai `01-desain.md` bagian 8 (persona fiktif, fixtures).
7. **Halaman Bantuan/FAQ** singkat di panduan: "Situs saya tidak terbaca", "Kenapa plugin butuh izin LinkedIn?", "Bagaimana memutus plugin?".

### Aturan yang wajib dijaga

- Gambar hanya memakai data fiktif dan halaman fixtures; tidak ada logo situs loker di materi promosi (sebut nama situs dalam teks saja, tanpa kesan kemitraan).
- Teks legal dan listing tidak berjanji lebih dari yang dilakukan plugin.

### Tes dan verifikasi

- Web: tes ajakan (tersembunyi saat URL kosong, tombol sesuai browser), rute halaman dicopot (200, `noindex`), tes docs.
- `lint:agent`, `format:check`, `check:cloudflare` bila server berubah.

### Selesai bila

- Pemilik menyetujui teks legal dan materi toko (catat di log keputusan).
- Panduan dan gambar siap; ajakan web siap dinyalakan dengan mengisi URL toko.
