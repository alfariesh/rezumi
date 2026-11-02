# Phase 11 — Staging, uji menyeluruh, dan go-live

| Dikerjakan       | Ukuran                | Bergantung pada     | Perlu dari pemilik                                                                                                                           |
| ---------------- | --------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude + pemilik | Besar (bisa 2–3 sesi) | Phase 00–10 selesai | Akses dashboard Cloudflare, Neon, dan Midtrans; server key produksi; key AI produksi; ±2–3 jam untuk uji; satu pembayaran sungguhan Rp29.000 |

## Untuk pemilik

**Apa yang terjadi:** penjualan dibuka dengan aman, bertahap:

1. **Staging** (sangat disarankan): salinan Rezumi di `staging.rezumi.app` dengan database terpisah dan Midtrans sandbox, untuk menguji semuanya dari server sungguhan tanpa uang sungguhan.
2. **Pengaturan Cloudflare** agar kabar pembayaran dari Midtrans tidak terblokir.
3. **Uji menyeluruh** di staging (daftar uji di bawah).
4. **Kunci produksi** dipasang dan alamat notifikasi diisi di dashboard Midtrans produksi.
5. **Mode admin dulu** (`BILLING_MODE=admins`): hanya akunmu yang melihat dan bisa membeli. Kamu membeli Plus **Rp29.000 dengan uang sungguhan** lewat QRIS sebagai uji terakhir.
6. **Dibuka untuk semua** (`BILLING_MODE=on`), panduan pengguna diterbitkan, lalu pantau 48 jam pertama.

**Tugasmu di phase ini** (Claude memandu langkah demi langkah; semua kunci kamu ketik sendiri, tidak pernah di chat):

- Membuat branch database staging di Neon dan alamat `staging.rezumi.app` di Cloudflare bila memilih staging.
- Menjalankan `pnpm exec wrangler secret put …` untuk kunci yang diminta.
- Mengisi URL notifikasi dan URL kembali di dashboard Midtrans.
- Melakukan pembayaran uji sungguhan.

**Prompt:** `Kerjakan Phase 11 dari .agents/docs/plans/membership/README.md`

## Untuk agent

Muat skill `integrate-midtrans-payments` (`operations-and-go-live.md`, `sandbox-interaction-helper.md`) serta `cloudflare`/`wrangler`. Periksa ulang dokumen Midtrans dan Cloudflare yang relevan sebelum memberi instruksi dashboard; nama menu bisa berubah.

### 1. Gerbang kesiapan

Jangan lanjut sebelum semua ini benar (tulis tabelnya di laporan): Phase 01–10 ✅ di README; Phase 00 bagian A–D selesai (NIB dan PSE terdaftar atau keputusan sadar pemilik untuk menundanya, dicatat di log keputusan); halaman legal Phase 02 disetujui dan sudah tayang; metode Midtrans produksi yang aktif sudah diketahui dan cocok dengan `MIDTRANS_ENABLED_PAYMENTS`; bobot kredit hasil Phase 10 diterapkan.

### 2. Staging (disarankan)

- Wrangler environment `staging` di `wrangler.jsonc` → Worker terpisah `vitaekit-staging` (bindings tidak diwariskan): Hyperdrive baru **dengan `--caching-disabled`** ke branch Neon yang sudah dimigrasi, bucket R2 terpisah, Durable Object dengan migrasi sendiri, `vars` (`APP_URL=https://staging.rezumi.app`, `BILLING_MODE=on`, `MIDTRANS_ENVIRONMENT=sandbox`, `MIDTRANS_ENABLED_PAYMENTS` sandbox), secrets sandbox (`AUTH_SECRET`, `ENCRYPTION_SECRET`, `MIDTRANS_SERVER_KEY` sandbox, key AI uji). Preview Workers tidak cocok karena cron dan route menembak produksi.
- Custom domain `staging.rezumi.app` dipasang pemilik di dashboard (seperti domain produksi). Matikan atau batasi pengiriman email dari staging bila perlu.
- Deploy manual: `pnpm build:cloudflare` lalu `pnpm exec wrangler deploy --env staging`. Workflow `deploy-cloudflare.yml` tetap hanya untuk produksi.
- Dashboard Midtrans **sandbox**: Payment notification URL `https://staging.rezumi.app/api/payments/midtrans/notification`; Finish/Unfinish/Error URL `https://staging.rezumi.app/dashboard/settings/billing/return/`; tombol tes notifikasi harus 200.
- Bila pemilik menolak staging: catat risikonya di log keputusan, lalu andalkan uji tunnel Phase 06 + uji produksi mode `admins` (langkah 5–6). Uji panggilan keluar Worker → Midtrans terjadi pertama kali di produksi.

### 3. Pengaturan zona Cloudflare `rezumi.app`

Ikuti `01-arsitektur.md` bagian 10:

- **Bot Fight Mode**: bila paket zona Free dan aktif → matikan (tidak bisa dikecualikan per path). Bila Pro ke atas → custom rule **Skip** untuk `POST` ke `/api/payments/midtrans/notification` (fase `http_ratelimit`, `http_request_sbfm`, `http_request_firewall_managed`; produk `bic`, `securityLevel`, `uaBlock`, `zoneLockdown`).
- **Minimum TLS Version** ≤ 1.2. Cek: `openssl s_client -connect rezumi.app:443 -tls1_2 < /dev/null` harus berhasil.
- `curl -i -X POST https://rezumi.app/api/payments/midtrans/notification -H 'content-type: application/json' -d '{}'` harus mendapat respons aplikasi (4xx dari handler), **bukan** halaman tantangan Cloudflare atau redirect.
- Hyperdrive produksi `vitaekit`: konfirmasi `caching.disabled = true` (sudah benar per 2026-11-02).

### 4. Matriks uji di staging (sandbox)

Catat setiap baris dengan format "Sandbox result" dari skill:

| Area                | Uji                                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| Setiap metode aktif | Bayar → notifikasi → aktif sekali; refresh halaman kembali; replay notifikasi; Get Status cocok          |
| Kedaluwarsa         | Biarkan pembayaran lewat batas → `expired`; pembayaran baru bisa dibuat                                  |
| Ganti metode        | Pilih metode, kembali, ganti metode → yang lama dibatalkan, yang baru berhasil                           |
| Klik ganda          | Dua checkout cepat → satu pembayaran                                                                     |
| Upgrade/antrean     | Plus lalu Pro AI lalu Plus → jadwal sesuai `01-arsitektur.md` 6.6                                        |
| Kredit              | Dua perangkat memakai kredit bersamaan; AI gagal → kredit kembali; kredit coba sekali                    |
| Batas dokumen       | Web, Android, iOS, REST, MCP; pembuatan paralel                                                          |
| Aturan mobile       | Android consumption-only; iOS tanpa UI paket (`00-keputusan-produk.md` bagian 6)                         |
| Notifikasi hilang   | Kosongkan sementara URL notifikasi → bayar → cron rekonsiliasi tetap mengaktifkan                        |
| Refund              | Refund penuh lewat admin (metode yang bisa) → akses dan sisa kredit dicabut; notifikasi refund idempoten |
| Email               | Bukti bayar sekali; pengingat H-3 (bisa dengan memalsukan waktu di tes); peringatan pemilik              |
| Saklar              | `BILLING_CHECKOUT_PAUSED=true` menutup pembelian tanpa mengubah hak akses                                |

### 5. Konfigurasi produksi (mode `admins`)

1. Pastikan secret `DATABASE_URL` workflow deploy terpasang supaya migrasi dijalankan sebelum deploy; atau jalankan migrasi produksi secara manual sesuai `CLAUDE.md` sebelum merge.
2. Pemilik menjalankan `pnpm exec wrangler secret put MIDTRANS_SERVER_KEY` (key produksi, diawali `Mid-server-`), dan secret AI produksi bila belum ada.
3. PR ke `wrangler.jsonc` `vars`: `MIDTRANS_ENVIRONMENT=production`, `MIDTRANS_ENABLED_PAYMENTS=<metode aktif produksi>`, `BILLING_MODE=admins`, `BILLING_ALERT_EMAIL`, tarif biaya AI. Merge = deploy.
4. Dashboard Midtrans **produksi**: Payment notification URL `https://rezumi.app/api/payments/midtrans/notification`; Finish/Unfinish/Error URL `https://rezumi.app/dashboard/settings/billing/return/`; tes notifikasi → 200 (event `unknown_order` di database).

### 6. Uji uang sungguhan oleh pemilik

1. Akun admin pemilik (email terverifikasi) membeli **Plus Rp29.000** lewat QRIS (minimum transaksi uji Midtrans Rp10.000).
2. Verifikasi: riwayat notifikasi di dashboard Midtrans, `billing_payment` `paid`, masa aktif, email bukti bayar, halaman admin, ringkasan harian keesokan harinya.
3. Opsional: refund penuh lewat admin bila metode mendukung (QRIS dari aplikasi GoPay: ±45 hari; dari aplikasi lain: ±7 hari) → cek akses dicabut dan dana kembali.

### 7. Buka untuk semua

1. PR `BILLING_MODE=on`. Saat itu juga terbitkan draf panduan pengguna dari Phase 03/05/07 di `docs/guides/`, perbarui FAQ/homepage (tombol paket aktif), dan pastikan halaman legal sudah final.
2. Pantau 48 jam: peringatan email, pembayaran menggantung, error notifikasi di tabel event, keluhan.
3. Perbarui README (status ✅, catatan sesi) dan log keputusan.

### 8. Rencana mundur

| Masalah                          | Tindakan                                                                                                                                      |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Bug di checkout atau harga salah | `BILLING_CHECKOUT_PAUSED=true` (hak akses yang sudah dibeli tetap berlaku)                                                                    |
| Bug serius pada penegakan batas  | `BILLING_MODE=admins` → semua pengguna non-admin kembali ke mode tanpa batas (semua fitur terbuka) sampai diperbaiki; pembeli tidak dirugikan |
| Notifikasi Midtrans gagal masuk  | Cron rekonsiliasi tetap berjalan; cek pengaturan zona dan riwayat notifikasi di dashboard                                                     |
| Server key bocor                 | Rotasi di dashboard Midtrans, `wrangler secret put` key baru, cek event `rejected_signature`                                                  |

### Selesai bila

- Pembayaran sungguhan pemilik berhasil end-to-end di produksi, `BILLING_MODE=on`, panduan dan halaman legal tayang, pemantauan 48 jam selesai tanpa masalah terbuka, README dan log keputusan diperbarui.
- App mobile yang akan dirilis ke toko berisi aturan Phase 08 (cek sebelum submit).
