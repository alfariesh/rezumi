# Phase 08 — Statistik pengunjung dan form kontak

| Dikerjakan | Ukuran | Bergantung pada | Perlu dari pemilik                                   |
| ---------- | ------ | --------------- | ---------------------------------------------------- |
| Claude     | Besar  | Phase 05        | Widget Cloudflare Turnstile: site key dan secret key |

## Untuk pemilik

**Apa yang dibuat:**

1. **Statistik** di halaman Portfolio: kunjungan 30 hari, klik tombol (Lihat CV, Unduh PDF, WhatsApp, Email), jumlah pesan, sumber pengunjung (LinkedIn, WhatsApp, Google, langsung), serta negara asal pengunjung pada peta dan jenis perangkat (dari Cloudflare Analytics Engine). Hanya pemilik portfolio yang bisa melihatnya.
2. **Form kontak** di portfolio dengan anti-spam Cloudflare Turnstile. Pesan masuk ke email pemilik portfolio dan ke kotak pesan di dashboard, disimpan 90 hari.

**Siapkan (sebelum sesi):**

Untuk statistik tidak ada yang perlu disiapkan: Cloudflare Analytics Engine sudah termasuk Workers Paid dan datasetnya dibuat otomatis saat deploy. Untuk form kontak:

1. Buka [dash.cloudflare.com](https://dash.cloudflare.com) → **Turnstile** → **Add widget**.
2. Nama: `Rezumi portfolio`. Hostname: `rezumi.app` dan `localhost`. Mode: **Managed**. Simpan.
3. **Site Key** boleh dikirim di chat (memang tampil publik di halaman).
4. **Secret Key jangan dikirim di chat.** Isi sendiri di file `.env.local` di folder proyek: tambahkan baris `TURNSTILE_SECRET_KEY=` lalu tempel kuncinya. Untuk produksi, Claude memandu di Phase 12.

**Prompt:** `Kerjakan Phase 08 dari .agents/docs/plans/portfolio/README.md`

**Yang bisa kamu cek di akhir:** kirim pesan dari HP ke portfolio contoh di server lokal → pesan tampil di dashboard dan email notifikasinya tercatat; grafik kunjungan bertambah.

## Untuk agent

### Langkah

1. **Statistik** (`02-teknis.md` bagian 9): perluas `portfolio_statistics_daily` (`clicks` termasuk video diputar, PDF dibuka, dan tombol layanan; `works` untuk karya yang dibuka; `messages`; `sources`), rute publik `POST /api/portfolio/<username>/event`, `sendBeacon` di skrip halaman, pemetaan sumber dari `Referer` dan `utm_source`, prosedur `portfolio.statistics`, UI di dashboard (ikuti pola widget Visitors di Share CV dan `summarizeViews`; boleh memakai `KPI`/`KPIGroup` HeroUI Pro), termasuk karya yang paling sering dibuka.
   - **Cloudflare Analytics Engine** (`02-teknis.md` bagian 9): binding dataset `portfolio_events` dan binding Analytics SQL di `wrangler.jsonc` (cek versi Wrangler; muat skill `cloudflare`/`wrangler` dan baca dokumen Analytics Engine: retensi, kuota, harga, batas data point); tulis data point untuk kunjungan dan klik yang lolos dedupe (negara, perangkat, kategori dan domain perujuk, karya); tanpa IP/user agent mentah; adaptor no-op di Node/lokal;
   - rincian di dashboard dari kueri Analytics SQL dengan cache ±5 menit dan label "perkiraan"; disembunyikan bila binding tidak ada; gerbang paket sesuai aturan turunan #16 (Phase 07);
   - peta "Asal pengunjung" memakai `Map` HeroUI Pro (`01-desain.md` bagian 19) dari jumlah per negara;
2. **Form kontak** (`02-teknis.md` bagian 10):
   - env `TURNSTILE_SITE_KEY` dan `TURNSTILE_SECRET_KEY` di `packages/env/src/server.ts`, `.env.example`, `turbo.json`; site key di `vars` `wrangler.jsonc`, secret lewat `wrangler secret put` di Phase 12;
   - CSP halaman portfolio untuk Turnstile;
   - rute publik `POST /api/portfolio/<username>/message`: verifikasi Turnstile, kolom jebakan, batas laju, panjang, tautan;
   - tabel `portfolio_message` + job hapus 90 hari (konfirmasi aturan turunan #7);
   - email notifikasi di `packages/email` (template baru, teks Indonesia dan Inggris, `Reply-To` pengirim, penggabungan per 10 menit);
   - kotak pesan di dashboard (daftar, tandai dibaca, hapus) dan saklar form di tab Isi → Kontak;
   - perilaku tanpa kunci Turnstile atau tanpa JavaScript (`01-desain.md` bagian 9).
3. **Domain sendiri**: tentukan perilaku widget di hostname pelanggan berdasarkan dokumen Turnstile (hostname yang diizinkan per widget); bila tidak bisa, siapkan fallback tombol ke `rezumi.app/<username>#contact`. Tulis keputusannya di `02-teknis.md` bagian 10 untuk Phase 09.
4. **Data akun**: ekspor data memuat pesan; hapus akun menghapus pesan dan statistik.
5. **Teks**: Lingui untuk dashboard; katalog halaman publik untuk form (`pnpm pdf:translations`); id-ID diterjemahkan.

### Aturan yang wajib dijaga

- Secret Turnstile tidak pernah muncul di HTML, log, atau respons.
- Pesan pengunjung adalah data pribadi: tidak ditulis ke log, hanya terlihat oleh pemilik portfolio, terhapus sesuai retensi.
- Kunjungan pemilik, bot, dan pratinjau tidak dihitung; tidak ada cookie pelacak dan IP tidak disimpan.

### Tes dan verifikasi

- Unit/integrasi: `siteverify` gagal → ditolak; jebakan terisi → diterima tanpa disimpan (tidak memberi tahu bot); batas laju per IP dan per portfolio; email digabung; job retensi; dedupe per jam; pemilik/bot tidak dihitung; pemetaan sumber; penulis data point Analytics Engine (isi blob, tanpa data pribadi, no-op tanpa binding) dan pembentuk kueri SQL (selalu difilter ID portfolio milik pengguna, rentang 30 hari).
- Browser lokal dengan kunci uji resmi Turnstile: kirim pesan (dengan dan tanpa JavaScript), email tercatat di log server (tanpa SMTP lokal), kotak pesan, grafik statistik; screenshot.

### Selesai bila

- Pemilik portfolio menerima pesan lewat email dan dashboard; statistik 30 hari tampil benar.
- Keputusan perilaku form di domain sendiri tercatat untuk Phase 09.
