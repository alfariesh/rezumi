# Phase 09 — Domain sendiri

| Dikerjakan       | Ukuran | Bergantung pada                                  | Perlu dari pemilik                                                           |
| ---------------- | ------ | ------------------------------------------------ | ---------------------------------------------------------------------------- |
| Claude + pemilik | Besar  | Phase 07 (fitur `customDomain`), Phase 08 (form) | Cloudflare for SaaS aktif, token API, satu domain atau subdomain uji milikmu |

## Untuk pemilik

**Apa yang dibuat:** pelanggan Plus/Pro AI bisa membuka portfolio di domain sendiri, misalnya `www.namaku.com`. Rezumi mengurus sertifikat HTTPS otomatis lewat Cloudflare for SaaS: pelanggan cukup memasang dua record DNS, lalu statusnya terlihat di editor sampai "Aktif". Domain yang sama membuka CV utama bila akun belum punya portfolio.

**Langkah persisnya** ada di bagian "Panduan dashboard (hasil riset sesi 2026-11-09)" di bawah. Ringkasannya:

**Siapkan (Claude memandu langkah demi langkah di awal sesi):**

1. Di Cloudflare, zona `rezumi.app` → **SSL/TLS → Custom Hostnames** → aktifkan Cloudflare for SaaS. 100 domain pertama gratis, setelahnya US$0,10 per domain per bulan. Akunmu sudah punya metode pembayaran untuk Workers.
2. Siapkan hostname target, misalnya `domains.rezumi.app`, sebagai fallback origin yang diarahkan ke Worker (Claude menjelaskan pilihan teknisnya sebelum kamu mengklik).
3. Buat API token dengan izin seminimal mungkin (hanya Custom Hostnames di zona `rezumi.app`). Simpan sendiri: `pnpm exec wrangler secret put CLOUDFLARE_SAAS_API_TOKEN` untuk produksi. **Jangan kirim token di chat.**
4. Satu domain atau subdomain uji milikmu (misalnya `uji.domainmu.com`) untuk tes nyata.

**Prompt:** `Kerjakan Phase 09 dari .agents/docs/plans/portfolio/README.md`

**Yang bisa kamu cek di akhir:** setelah PR di-merge (saklar tetap `admins`), domain ujimu membuka portfolio dengan gembok HTTPS.

## Untuk agent

### Langkah

1. **Pelajari dulu**: `docs/self-hosting/sharing-domains.mdx`, kode custom domain (`packages/api/src/features/custom-domain/*`, `apps/server/src/http/custom-domain.ts`, UI di Share CV), dan dokumen Cloudflare for SaaS lewat MCP dokumentasi Cloudflare (muat skill `cloudflare` dan `wrangler`): fallback origin untuk Worker, rute Worker untuk hostname pelanggan, validasi sertifikat (HTTP atau TXT), status hostname, kuota dan ambang API.
2. **Pandu pemilik** melalui bagian "Siapkan" langkah demi langkah. Pengaturan dashboard yang hanya bisa dilakukan pemilik ditulis jelas; jangan pernah meminta token di chat.
3. **Kode** (`02-teknis.md` bagian 12):
   - env `CLOUDFLARE_SAAS_ZONE_ID` (var) dan `CLOUDFLARE_SAAS_API_TOKEN` (secret) di env, `.env.example`, `turbo.json`, `wrangler.jsonc`; `CUSTOM_DOMAIN_TARGET` produksi;
   - klien Cloudflare API kecil (fetch, tanpa SDK besar), kolom status baru di `custom_domain` + migrasi;
   - buat custom hostname setelah DNS terverifikasi; job memeriksa status sampai aktif; hapus custom hostname saat domain dilepas, akun dihapus, atau paket berakhir melewati masa tenggang (keputusan Phase 07);
   - gerbang fitur `customDomain` di server;
   - UI status bertahap di tab Terbitkan dan dashboard (`01-desain.md` bagian 11), termasuk penjelasan domain utama tanpa `www`; teks Share CV ikut menyesuaikan.
4. **Layanan**: portfolio-dulu di `handleCustomDomain` (lanjutan Phase 02); `/api/portfolio/` lolos; form kontak di domain sendiri sesuai keputusan Phase 08; kanonik ke domain sendiri bila aktif.
5. **Dokumen**: perbarui `docs/self-hosting/sharing-domains.mdx` (aplikasi kini memanggil API Cloudflare bila env diisi) dan draf panduan pengguna.

### Aturan yang wajib dijaga

- Panggilan ke API Cloudflare produksi hanya setelah pemilik mengizinkan secara eksplisit di sesi ini.
- Token tidak pernah ditulis di kode, log, atau respons; galat API dicatat tanpa header otorisasi.
- Tanpa env Cloudflare, perilaku lama tetap jalan (verifikasi DNS saja), sehingga instalasi lokal tidak rusak.
- Satu domain per akun tetap berlaku; domain yang sudah diverifikasi akun lain hanya pindah dengan bukti DNS baru (aturan yang ada).

### Tes dan verifikasi

- Unit dengan API Cloudflare tiruan: sukses, menunggu validasi, gagal validasi, kuota penuh, token salah, hostname sudah ada; job idempoten; penghapusan saat akun dihapus dan saat paket berakhir.
- Uji nyata setelah merge, mode `admins`, dengan domain uji pemilik: CNAME + TXT → Cek DNS → hostname dibuat → sertifikat aktif → `https://<domain-uji>/` membuka portfolio; lepas domain → hostname terhapus.

### Selesai bila

- Domain uji pemilik membuka portfolio lewat HTTPS dan statusnya tampil benar di editor.
- Dokumen self-hosting dan draf panduan diperbarui.

### Panduan dashboard (hasil riset sesi 2026-11-09)

Cukup dilakukan sekali, setelah kode di-merge atau sebelumnya. Urutan penting: rute tanpa Worker dibuat dulu supaya `rezumi.app` dan `blog.rezumi.app` tidak pernah lewat Worker yang salah.

1. Cloudflare → zona `rezumi.app` → **SSL/TLS → Custom Hostnames** → aktifkan Cloudflare for SaaS.
2. **DNS → Records** → tambah record `AAAA`, nama `domains`, nilai `100::`, Proxy **menyala** (awan oranye). Kembali ke **Custom Hostnames**, isi **Fallback Origin** dengan `domains.rezumi.app`, tunggu sampai **Active**.
3. **Workers Routes** di zona `rezumi.app` → tambah rute berikut, berurutan:

   | Rute                             | Worker     |
   | -------------------------------- | ---------- |
   | `*/.well-known/acme-challenge/*` | None       |
   | `*/.well-known/pki-validation/*` | None       |
   | `rezumi.app/*`                   | None       |
   | `*.rezumi.app/*`                 | None       |
   | `domains.rezumi.app/*`           | `vitaekit` |
   | `*/*`                            | `vitaekit` |

   Sesudahnya buka `rezumi.app` dan `blog.rezumi.app`: keduanya harus tetap normal.

4. **My Profile → API Tokens → Create Token → Custom token**. Izin: **Zone → SSL and Certificates → Edit**. Zone Resources: **Include → Specific zone → rezumi.app**. Simpan sendiri lewat terminal: `pnpm exec wrangler secret put CLOUDFLARE_SAAS_API_TOKEN`. **Jangan kirim token di chat.**
5. Salin **Zone ID** dari halaman Overview zona `rezumi.app` (ini bukan rahasia), lalu minta Claude mengisinya ke `CLOUDFLARE_SAAS_ZONE_ID` di `wrangler.jsonc`.

### Catatan dari hardening Phase 01–06 (2026-11-07, `02-teknis.md` bagian 32)

- Host yang bukan host aplikasi dan bukan domain sendiri terverifikasi saat ini jatuh ke seluruh aplikasi (masuk, dasbor, API) di `apps/server/src/http/custom-domain.ts`. Dengan Cloudflare for SaaS, domain yang belum terverifikasi atau sudah dihapus akan menyajikan aplikasi di domain milik pengguna: jawab 404/421 atau alihkan ke `APP_URL` untuk host seperti itu.
- File portfolio yang dipakai halaman terbit sudah dikirim dengan `Cross-Origin-Resource-Policy: cross-origin`, jadi gambar tampil di domain sendiri.

### Catatan dari Phase 07 (2026-11-09)

- Fitur katalog `customDomain` dan pemeriksaannya saat menghubungkan domain sudah ada (`assertCanConnect` di `packages/api/src/features/custom-domain/service.ts`), berlaku sejak portfolio dibuka untuk akun itu.
- Yang dikerjakan di sini: masa tenggang 7 hari setelah paket berakhir (aturan turunan #2), lalu domain mengarah ke `rezumi.app/<username>` dan aktif lagi saat berlangganan lagi. Akun Gratis yang sudah punya domain terverifikasi sebelum portfolio dibuka mengikuti jalur yang sama.
- Perbarui deskripsi OpenAPI `setCustomDomain` dan `pnpm docs:gen`, karena rute itu publik dan kini bisa dijawab `PLAN_FEATURE_REQUIRED`.

### Catatan dari Phase 08 (2026-11-09)

- Form kontak di domain sendiri sudah ditentukan: tombol "Kirim pesan" membuka `rezumi.app/<username>#contact` (`02-teknis.md` bagian 10), karena hostname pelanggan tidak bisa didaftarkan ke widget Turnstile. `live.form` di `apps/server/src/static/portfolio-page.ts` sudah memilihnya lewat `customDomain`; tidak perlu pekerjaan tambahan selain mengeceknya di domain uji.
- Beacon statistik memakai alamat relatif `/api/portfolio/<username>/event`, dan `handleCustomDomain` sudah meloloskan `/api/portfolio/`. Cek keduanya di domain uji.
- Domain sendiri tidak punya cookie sesi, jadi kunjungan pemilik di sana masih terhitung. Putuskan apakah perlu diperbaiki.
