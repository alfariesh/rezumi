# Phase 06 — Midtrans: checkout, notifikasi, rekonsiliasi (sandbox)

| Dikerjakan | Ukuran                 | Bergantung pada | Perlu dari pemilik                                                       |
| ---------- | ---------------------- | --------------- | ------------------------------------------------------------------------ |
| Claude     | Besar (mungkin 2 sesi) | Phase 01, 04    | Server key **sandbox** di `.env.local`; akses dashboard sandbox Midtrans |

## Untuk pemilik

**Apa yang dibuat:** sambungan ke Midtrans memakai **sandbox** (uang mainan). Server bisa membuat transaksi, menerima kabar pembayaran dari Midtrans, mengecek ulang statusnya, lalu mengaktifkan paket dan memberi kredit secara otomatis. Ada juga email bukti bayar. Halaman beli yang rapi dibuat di Phase 07; di phase ini Claude menguji alurnya dengan simulator sandbox.

**Siapkan sebelum mulai:**

1. Masuk ke dashboard Midtrans, pindah ke lingkungan **Sandbox** (sakelar lingkungan di dashboard).
2. Buka **Settings → Access Keys** (sandbox) dan salin **Server Key** sandbox (diawali `SB-Mid-server-`).
3. Buka file `.env.local` di root repo dengan editor teks, tambahkan dua baris ini, lalu simpan. **Jangan tempel kunci di chat.**

   ```dotenv
   MIDTRANS_ENVIRONMENT=sandbox
   MIDTRANS_SERVER_KEY=SB-Mid-server-xxxxxxxx
   MIDTRANS_SIGNATURE_KEY=isi-signature-secret-key-sandbox
   ```

   `MIDTRANS_SIGNATURE_KEY` diambil dari **Settings → Access Keys → General Credentials → Signature Secret Key** (ikon mata). Akun Midtrans model baru menandatangani notifikasi dengan kunci ini, bukan dengan server key (ditemukan saat uji 2026-11-02).

4. Siapkan waktu ±10 menit saat Claude meminta kamu mengisi **Payment notification URL** di dashboard sandbox (Settings → Payment Settings / Configuration) dengan alamat sementara yang Claude berikan.
5. Bila Claude meminta memasang `cloudflared` (untuk alamat sementara itu), jalankan `brew install cloudflared` sendiri atau izinkan Claude menjalankannya.

**Prompt:** `Kerjakan Phase 06 dari .agents/docs/plans/membership/README.md`

**Yang bisa kamu cek di akhir:** Claude menunjukkan satu pembayaran sandbox QRIS lewat simulator → status menjadi "dibayar" → akun uji mendapat paket dan kredit → notifikasi yang dikirim ulang tidak memberi paket dua kali.

## Untuk agent

### 0. Preflight (wajib, skill `integrate-midtrans-payments`)

Muat skill, baca `merchant-readiness-preflight.md`, `project-adaptation.md`, `snap-checkout.md`, `operations-and-go-live.md`, `sandbox-interaction-helper.md`, lalu periksa ulang dokumen Midtrans terkini lewat `https://docs.midtrans.com/llms.txt` (versi `.md` halaman). Tulis ringkasan preflight di laporan dengan format skill. Fakta yang sudah diketahui:

```text
Merchant readiness:
- Account/MID: confirmed — production aktif, perorangan (00-keputusan-produk.md bagian 13)
- Sandbox access: inferred — setiap akun punya sandbox; konfirmasi saat pemilik menyalin key
- Sandbox credentials: missing sampai pemilik mengisi .env.local
- Target environment: sandbox (lokal + tunnel). Produksi hanya di Phase 11
- Requested customer flows: beli pass 30 hari (Plus/Pro AI) dari web, Snap redirect
- Payment methods and activation: QRIS aktif di produksi; metode lain menunggu Phase 00
- Callback and redirect URLs: notifikasi /api/payments/midtrans/notification; kembali /dashboard/settings/billing/return/<id>/
- Expected proof: tes deterministik lokal + satu pembayaran sandbox end-to-end per metode yang aktif di sandbox
- Operational owner: pemilik (perorangan)
- Blockers before provider calls: server key sandbox
```

### 1. Env dan konfigurasi

Tambahkan (aturan "New env var" di `CLAUDE.md`; `01-arsitektur.md` bagian 8): `MIDTRANS_ENVIRONMENT` (`sandbox` | `production`), `MIDTRANS_SERVER_KEY` (secret), `MIDTRANS_ENABLED_PAYMENTS` (default `other_qris` — sesuai metode yang diketahui aktif; daftar lengkap kode di `01-arsitektur.md` 6.1), `BILLING_CHECKOUT_PAUSED` (default `false`). Validasi saat start: key sandbox harus diawali `SB-Mid-server-` bila `sandbox`, dan **tidak** boleh diawali `SB-` bila `production`; kombinasi salah = gagal start dengan pesan jelas. Tanpa key → fitur checkout `BILLING_UNAVAILABLE`, endpoint notifikasi membalas 404. Jangan menambahkan nilai ke `wrangler.jsonc` sekarang.

### 2. Tabel

`billing_payment` dan `billing_payment_event` (`01-arsitektur.md` 4.3–4.4), kolom `membership_period.payment_id` dan FK `ai_credit_grant.payment_id`. Tambahkan status `reversed`. Baca SQL migrasi.

### 3. Modul Midtrans (`packages/api/src/features/billing/midtrans/`)

- `client.ts` — `fetch` langsung, **bukan** `midtrans-client` (alasan di `01-arsitektur.md` bagian 10). Fungsi: `createSnapTransaction(payload)` → `{ token, redirectUrl }`; `getTransactionStatus(orderId)` → status atau "tidak ditemukan"; `cancelTransaction(orderId)`; `expireTransaction(orderId)`. Host berdasarkan `MIDTRANS_ENVIRONMENT` (Snap `app[.sandbox].midtrans.com`, Core API `api[.sandbox].midtrans.com`). Basic Auth `base64(serverKey + ":")`, header JSON, `AbortSignal.timeout(10_000)`, error terketik (jaringan, 4xx, 5xx). Jangan pernah log header, body request berisi data pelanggan, token, atau `redirect_url`.
- `payload.ts` — pembentuk payload Snap persis seperti contoh di `01-arsitektur.md` 6.1 (order id `RZ-<id>`, item name ≤ 50 karakter, `expiry` 24 jam dengan `start_time` eksplisit `+0700`, `callbacks.finish`, `gopay`, `shopeepay`, `enabled_payments` dari env, tanpa nomor telepon).
- `signature.ts` — `verifyNotificationSignature(payload, serverKey)`: SHA-512 hex dari `order_id + status_code + gross_amount + serverKey` memakai **string mentah** dari payload, perbandingan `timingSafeEqual`.
- `status.ts` — fungsi murni `mapProviderStatus(transactionStatus, fraudStatus)` dan `nextPaymentStatus(current, mapped)` sesuai tabel dan aturan transisi `01-arsitektur.md` 5.1 (termasuk `reversed`).

### 4. Checkout dan status (`checkout.ts`, `router.ts`)

- `billing.checkout({ planId, idempotencyKey })` mengikuti `01-arsitektur.md` 6.1 langkah 1–7: cek syarat (mode, bukan tamu, email terverifikasi, **hanya sesi web** — app mobile/API key/OAuth ditolak, `BILLING_CHECKOUT_PAUSED`), pakai ulang pembayaran pending yang sah, commit baris `creating` sebelum memanggil Snap, simpan token/URL, kembalikan `{ paymentId, redirectUrl, expiresAt, reused }`. Rate limit (pola `packages/api/src/middleware/rate-limit`).
- `billing.changePaymentMethod({ paymentId })`: batalkan yang lama (best effort) lalu buat pembayaran baru (6.1 langkah 7).
- `billing.payment({ id })`: milik pengguna sendiri saja; sinkron ke Midtrans bila `creating`/`pending` dan `last_checked_at` > ±10 detik.
- `billing.payments({ cursor? })`: riwayat.
- `billing.summary` ditambah `canPurchase` dan `pendingPayment`.

### 5. Fulfillment dan pencabutan (`fulfillment.ts`)

- `applyVerifiedStatus(paymentId, verified)` — satu-satunya pintu perubahan status: kunci akun + baris pembayaran, cek nominal, terapkan transisi, fulfillment sekali (6.5: jadwal masa aktif lewat Phase 01, kredit lewat Phase 04 dengan `payment_id`), tulis event + audit.
- `revokePaymentBenefits(paymentId, reason)` — dipakai untuk `refunded` penuh dan `reversed`: cabut potongan masa aktif dan sisa kredit dari grant pembayaran itu, idempoten. `partially_refunded` hanya dicatat (aturan Phase 09).

### 6. Endpoint notifikasi

- `apps/server/src/http/midtrans.ts` + pasang di `apps/server/src/http/app.ts`: `app.post("/api/payments/midtrans/notification", …)` dengan body limit kecil (mis. 64 KB). Delegasikan ke `handleMidtransNotification(request)` yang diekspor lewat subpath eksplisit baru di `packages/api/package.json` (mis. `./features/billing/notification`).
- Urutan dan kode balasan persis `01-arsitektur.md` 6.3: signature salah → 403; order tidak dikenal → 200; Get Status ke Midtrans **di luar transaksi**; nominal tidak cocok → event `amount_mismatch`, tidak mengaktifkan; berhasil → 200; gangguan sementara → **503**. Balas dalam < 5 detik.
- Proxy dev Vite sudah meneruskan prefiks `/api` ke Hono (`apps/web/vite.config.ts`); pastikan `/api/payments/*` ikut terlayani saat uji tunnel.

### 7. Job terjadwal

Tambahkan ke `runBillingJobs()` (Phase 04): rekonsiliasi pembayaran `creating`/`pending` dengan backoff, kedaluwarsa setelah `expires_at` + 30 menit (panggil `expireTransaction` lalu cek sekali lagi), dan kirim ulang email bukti bayar yang tertunda (`01-arsitektur.md` 6.4). Batasi jumlah per putaran; idempoten; `FOR UPDATE SKIP LOCKED`.

### 8. Email bukti bayar

Template React Email baru di `packages/email/src/templates/` (Bahasa Indonesia sebagai bawaan, mengikuti bahasa akun bila tersedia): nama penjual, nomor pesanan, tanggal (WIB bila zona akun default), paket, masa berlaku, nominal, metode, catatan "Bukti pembayaran ini bukan faktur pajak". Kirim setelah fulfillment ter-commit, set `receipt_sent_at`. Identitas penjual diambil dari konfigurasi yang disiapkan Phase 02 (bila belum ada, pakai placeholder yang jelas dan catat di laporan).

### 9. Tes otomatis (wajib sebelum uji sandbox)

- Unit: pembentuk payload (nilai, panjang order id, karakter, item name, expiry), signature (pakai fixture skill `.claude/skills/integrate-midtrans-payments/assets/fixtures/` yang ditandatangani `SB-Mid-server-test`, plus kasus `gross_amount` "79000.00" vs "79000"), pemetaan status, transisi termasuk `deny` setelah `paid` → `reversed`, `settlement` setelah `expired` → `paid`.
- Integrasi DB nyata (`BILLING_TEST_DATABASE_URL`): notifikasi + rekonsiliasi bersamaan untuk pembayaran yang sama → fulfillment tepat sekali; notifikasi duplikat → satu potongan + satu grant; notifikasi `pending` setelah `paid` → tetap `paid`; nominal tidak cocok → tidak aktif; refund penuh → akses + sisa kredit dicabut; order tidak dikenal → 200 tanpa perubahan.
- HTTP: endpoint dengan signature salah → 403 tanpa perubahan; body kebesaran → ditolak; `BILLING_MODE=off` tidak mematikan pemrosesan notifikasi bila key ada (pembayaran tidak boleh hilang).
- Replay: `scripts/replay_snap_webhook.sh` dari skill ke server lokal, dengan signature yang dihitung ulang memakai key sandbox pemilik dari env (jangan dicetak).

### 10. Uji sandbox end-to-end (bukti tingkat "Sandbox provider proof")

1. Jalankan `pnpm dev` dengan `BILLING_MODE=admins` dan akun admin uji yang emailnya terverifikasi.
2. Buat tunnel publik sementara ke server dev (mis. `cloudflared tunnel --url http://localhost:3000`). Minta pemilik mengisi **Payment notification URL** sandbox ke `https://<alamat-tunnel>/api/payments/midtrans/notification` dan memakai tombol tes notifikasi di dashboard (harus mendapat 200).
3. Panggil `billing.checkout` (lewat UI sementara, REST lokal, atau skrip dev — jangan menambah UI permanen yang menjadi milik Phase 07), buka `redirect_url`, bayar memakai simulator sandbox (QRIS: `https://simulator.sandbox.midtrans.com/v2/qris/index`; deeplink GoPay/ShopeePay: `/v2/deeplink/index`; VA: `/openapi/va/index` atau `/bni/va/index` — sesuai `D/testing-payment-on-sandbox`).
4. Bukti yang dicatat (format "Sandbox result" dari skill): order id, status sebelum/sesudah, event notifikasi, Get Status, replay idempoten, refresh halaman kembali.
5. Uji juga: pembayaran dibiarkan kedaluwarsa (bisa dengan memperpendek expiry khusus dev), "ganti metode", dan notifikasi yang dikirim ulang dari dashboard (Settings → Configuration → See History bila tersedia).
6. Setelah selesai, minta pemilik **mengosongkan/mengganti** URL notifikasi sandbox (alamat tunnel tidak berlaku lagi).

### Aturan yang wajib dijaga

- Tidak ada jalur yang memberi akses dari callback browser atau query URL.
- Semua perubahan status lewat `applyVerifiedStatus`.
- Tidak ada panggilan HTTP di dalam transaksi DB; semua query di dalam transaksi memakai `tx`.
- Tidak ada rahasia di log, event, tes, atau laporan.

### Selesai bila

- Semua tes otomatis lulus, satu pembayaran sandbox per metode yang aktif di sandbox terbukti end-to-end, replay terbukti idempoten, dan `01-arsitektur.md` diperbarui dengan fakta yang berubah dari dokumen Midtrans.
- Laporan menyebut bukti yang **belum** ada (misalnya pengiriman notifikasi ke Worker produksi, metode yang belum aktif) — itu urusan Phase 11.
