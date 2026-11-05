# Phase 02 — Mesin tampilan, tema pertama, halaman publik

| Dikerjakan | Ukuran | Bergantung pada | Perlu dari pemilik |
| ---------- | ------ | --------------- | ------------------ |
| Claude     | Besar  | Phase 01        | —                  |

## Untuk pemilik

**Apa yang dibuat:** mesin yang mengubah isi portfolio menjadi halaman web, tema pertama (**Lugas**, tema gratis bawaan dari Phase 00), dan halaman publik di `rezumi.app/<username>`, lengkap dengan kartu preview WhatsApp/LinkedIn, data untuk Google, dan penghitung kunjungan. Di produksi tetap tersembunyi (`PORTFOLIO_MODE=off`).

**Siapkan:** tidak ada.

**Prompt:** `Kerjakan Phase 02 dari .agents/docs/plans/portfolio/README.md`

**Yang bisa kamu cek di akhir:** screenshot halaman contoh di HP dan desktop (terang dan gelap) dari server lokal, plus bukti bahwa akun tanpa portfolio tetap membuka CV utama di alamat pendeknya.

## Untuk agent

### Langkah

1. **Paket `packages/portfolio`** (`@rezumi/portfolio`): `package.json` dengan export map eksplisit (misalnya `.`, `./document`, `./messages`), `turbo.json` dengan tag `runtime:universal` + `role:rendering`, konfigurasi vitest dan tsconfig mengikuti paket lain. Jalankan `pnpm exec turbo boundaries`.
2. **Render** (`02-teknis.md` 5.1–5.3, 5.5): `buildPortfolioView`, `renderPortfolioPage`, `renderPortfolioDocument`, skrip halaman (tanpa bagian Phase 08), pesan dan katalog terjemahan (`pnpm pdf:translations`), pindahkan `readableAccent` ke paket bersama tanpa mengubah PDF.
3. **Tema pertama (Lugas)** sesuai spesifikasi final `01-desain.md` bagian 5 dan `mockups/lugas.html`: semua bagian (termasuk angka pencapaian, Layanan, Testimoni, Klien, chip lokasi dan kartu Lokasi tanpa gambar peta, latar intro), semua varian yang dijanjikan tema ini, terang/gelap/ikuti perangkat, RTL, detail karya dengan jangkar.
4. **Primitif blok dan metrik** di `packages/portfolio` (`02-teknis.md` 5.1, 16, 17): `WorkDetail` untuk blok Teks, Gambar, dan Metrik; `Metric`/`MetricGroup` (anatomi KPI dengan `<dl>`, chip perubahan, sebelum → sesudah, progres, grafik mini SVG bila diputuskan di Phase 00) dan `formatMetric`. Blok Video, PDF, dan Tautan cukup dilewati dengan aman di phase ini (render penuh di Phase 05).
5. **Server**: `apps/server/src/static/portfolio-page.ts` dan integrasi handler `/:username` (`02-teknis.md` 6). Buat sumber kebenaran alamat pendek (`profilePathOwner` atau sejenisnya), petakan semua pemakai alamat CV utama dengan graph (`trace_path` dari `publicResumePath`, `isPrimary`, kanonik di `resume-page.ts`, `resume-card.ts`, sitemap, teks Share CV web dan mobile), ubah semuanya, dan tulis daftarnya di laporan.
6. **Kartu** `GET /cards/<username>.png` mengikuti pola `resume-card.ts`: nama, headline, foto, aksen tema; banner umum bila tidak publik.
7. **Kunjungan dasar**: tabel `portfolio_statistics_daily` dengan kolom `views` (Phase 08 menambah kolom lain), dihitung dengan `countVisit`, tanpa pemilik, bot, dan pratinjau.
8. **SEO**: kanonik, JSON-LD, `rel="me"`, sitemap `portfolios-N.xml` + indeks, `X-Robots-Tag` untuk yang tidak terindeks.
9. **Domain sendiri**: cabang portfolio-dulu di `handleCustomDomain` dan lolosnya `/api/portfolio/`. Uji dengan domain terverifikasi buatan tes; otomasi Cloudflare menyusul di Phase 09.
10. **Alat pratinjau**: `tooling/portfolio/preview.ts` (skrip `portfolio:preview`) merender persona ke HTML di folder sementara untuk dicek dengan mata; dipakai lagi di Phase 06.
11. Untuk menguji tanpa editor (editor dibuat Phase 03), buat portfolio uji lewat prosedur API atau skrip seed lokal.

### Aturan yang wajib dijaga

- Mode `off`: respons `/<username>` untuk CV utama sama seperti sebelum phase ini (bandingkan HTML sebelum/sesudah di tes).
- Render tidak pernah memanggil layanan luar; gambar dari asal aplikasi (`webPageImageUrl`).
- CSP tetap ketat: hanya skrip inline berhash.
- Portfolio pemilik yang dilarang (banned) atau ditangguhkan tidak pernah tampil.

### Tes dan verifikasi

- Unit render: semua bagian, item tersembunyi, isi kosong, nama sangat panjang, RTL, tanpa `undefined`/`NaN`.
- Server: `/<username>` untuk mode off/admins/on × portfolio terbit/tidak × CV utama ada/tidak; kanonik CV utama sebelum dan sesudah portfolio terbit; header dan CSP; kartu; sitemap; domain sendiri.
- Server lokal dengan `PORTFOLIO_MODE=admins` (konfigurasi preview di `.claude/launch.json`; akun uji `…@example.test`): buka `/<username>` sebagai tamu, screenshot 390 dan 1440 px, terang dan gelap; ukur kasar LCP, CLS, dan ukuran JS.
- `pnpm check:cloudflare` (renderer React di Worker) dan catat perubahan ukuran bundel.

### Selesai bila

- Portfolio admin yang terbit tampil benar di `/<username>`; akun lain dan mode `off` tidak berubah.
- Pemilik sudah melihat screenshot tema pertama.
