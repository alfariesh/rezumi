# Phase 14 — QRIS Indonesia lewat Sumopod

| Dikerjakan         | Ukuran         | Bergantung pada | Perlu dari pemilik                                                                                   |
| ------------------ | -------------- | --------------- | ---------------------------------------------------------------------------------------------------- |
| Claude (+ pemilik) | Besar (1 sesi) | Phase 13 (Dodo) | Akun Sumopod (proyek "Rezumi", Managed Payment), API key **sandbox** di `.env.local` untuk uji lokal |

Keputusan pemilik 2026-11-10 ("saya ingin ada plan khusus di Indonesia dengan provider Sumopod (bukan Midtrans)… khusus di
Indonesia saya mau pakai QRIS dan harga lebih murah… Pastikan semua seamless untuk kapan Dodo (global) dan kapan QRIS
Indonesia"). Dodo Payments tetap menjual langganan kartu; Sumopod hanya untuk QRIS di Indonesia.

## Untuk pemilik

**Kapan Dodo, kapan QRIS** (otomatis, pembeli tidak perlu memilih apa pun):

| Siapa                                                      | Yang ditawarkan                                                                      | Penyedia       |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------- |
| Pengunjung dari Indonesia (IP), belum punya paket          | **QRIS dalam Rupiah** (utama), plus tautan kecil "Bayar dengan kartu dalam dolar AS" | Sumopod / Dodo |
| Pengunjung dari luar Indonesia, belum punya paket          | Kartu dalam dolar AS (tidak bisa memilih harga Rupiah)                               | Dodo           |
| Akun yang punya paket QRIS berjalan/menunggu (di mana pun) | QRIS lagi: tambah masa aktif atau upgrade                                            | Sumopod        |
| Akun yang berlangganan kartu (di mana pun)                 | Kelola langganan kartu: ganti paket, batal, portal tagihan                           | Dodo           |

Paket QRIS adalah **paket prabayar**, bukan langganan, karena QRIS tidak bisa menagih otomatis:

| Paket QRIS | 30 hari  | 365 hari  |
| ---------- | -------- | --------- |
| Plus       | Rp29.000 | Rp249.000 |
| Pro AI     | Rp59.000 | Rp499.000 |

1. **Harga final**, tidak ada pajak tambahan: untuk QRIS kamu sendiri penjualnya (perorangan, bukan PKP), Sumopod hanya
   memproses pembayaran. Bukti bayar dikirim Rezumi lewat email dan bisa dicetak di halaman Paket; **bukan faktur pajak**.
2. **Tidak diperpanjang otomatis.** Email pengingat 3 hari sebelum berakhir. Bayar lagi kapan saja: harinya **ditambahkan
   setelah** paket yang sekarang (tidak ada hari hilang). Upgrade Plus → Pro AI: Pro AI langsung aktif, sisa Plus **dijeda dan
   berlanjut** setelah Pro AI selesai.
3. Pro AI QRIS: **100 kredit per bulan paket** (365 hari = 12 kali 100, tiap bulan kalender; 30 hari = 100). Kredit tidak terbawa.
4. **Tanpa masa coba** (keputusan pemilik): masa coba 7 hari tetap hanya untuk langganan kartu. **Tanpa kode diskon** untuk QRIS.
5. **Refund QRIS manual**: Sumopod tidak punya API refund. Kamu transfer sendiri ke rekening/e-wallet pembeli, lalu di halaman
   admin pilih pembayaran → ⋯ → **Catat refund QRIS**. Refund penuh mencabut paketnya dan sisa kreditnya.
6. Biaya Sumopod QRIS: **0,7% + Rp300** per transaksi, dana masuk saldo Sumopod T+2 (Plus 30 hari: bersih ±Rp28.497).
   Bandingkan Dodo IDR dulu: potongan ±15–22%.
7. Harga kartu sekarang **hanya dolar AS** ($4.99/$39, $9.99/$79, belum termasuk pajak). Harga Rupiah di produk Dodo tidak dipakai lagi
   (boleh dibiarkan). Langganan uji pemilik (Pro AI IDR) tetap berjalan sampai batal di akhir periode.

**Tugasmu** (semua kunci kamu ketik sendiri, tidak pernah di chat):

| Kapan                          | Tugas                                                                                                                                                                                                                                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Uji lokal (sebelum merge)      | Sumopod → Managed Payment → **Sandbox** → Settings → API Key → Reveal → salin. Tambahkan ke `.env.local` worktree: `SUMOPOD_ENVIRONMENT="sandbox"` dan `SUMOPOD_API_KEY="…"`                                                                                                                                       |
| Setelah PR di-merge (produksi) | Sumopod mode **Live** → Settings → **Webhook**: isi `https://rezumi.app/api/payments/sumopod/webhook` → Save. Salin **Webhook Signing Secret** (`whsec_…`)                                                                                                                                                         |
| Setelah PR di-merge (produksi) | Urutan aman (env dicek saat Worker start): `pnpm exec wrangler secret put SUMOPOD_API_KEY` (key **Live**, Settings → API Key), lalu `pnpm exec wrangler secret put SUMOPOD_WEBHOOK_SECRET` (`whsec_…`). `SUMOPOD_ENVIRONMENT=live` sudah ada di `wrangler.jsonc`                                                   |
| Setelah secret terpasang       | Sumopod Live → Settings → Webhook → **Save & Test**: event `payment.test` harus mendapat 200 (tercatat "ignored" di Rezumi). Settings → **Fee Settings**: biarkan **Charge fee to customer MATI** (pembeli membayar tepat Rp29.000)                                                                                |
| Uji produksi                   | Dengan akun admin (`BILLING_MODE=admins`) dari Indonesia: beli **Plus 30 hari Rp29.000** pakai QRIS sungguhan → halaman kembali "Pembayaran diterima", email bukti bayar masuk, riwayat admin menunjukkan pembayaran QRIS. Lalu (opsional) transfer balik ke dirimu dan **Catat refund QRIS** untuk menguji refund |
| Sebelum go-live                | ⚖️ Baca teks legal baru (S&K, refund, privasi; ID/EN): penjual paket QRIS adalah kamu sendiri (perorangan), Sumopod (PT Koding Kreasi Indonesia) pemroses pembayaran, refund QRIS lewat transfer manual. Konsultasi pajak: penghasilan dari QRIS masuk ke kamu langsung (bukan lewat Merchant of Record)           |
| Withdraw                       | Dana QRIS masuk **Wallet Balance** Sumopod (Pending → Available setelah T+2). Tarik lewat tombol **Withdraw** di Managed Payment                                                                                                                                                                                   |

## Untuk agent

Baca dulu: `CLAUDE.md`, README rencana ini, `00-keputusan-produk.md` (log 2026-11-10 QRIS), `01-arsitektur.md` §13 (QRIS).
Dokumentasi Sumopod hanya ada di dashboard (Managed Payment → Quick Start; tidak ada docs publik, dicek 2026-11-10):

- API: `POST /api/v1/payments` (header `X-Api-Key`) di `https://api-pay.sumopod.com` (live) atau
  `https://api-pay-sandbox.sumopod.com` (sandbox). Body: `order_id`, `amount` (Rupiah utuh), `currency: "IDR"`,
  `expires_in_hours` (maks 24; Rezumi 1), `success_return_url`, `cancel_return_url`, `payment_method_type_code: "QRIS"`.
  Jawaban: `payment_id` (uuid), `payment_link_url` (`https://pay.sumopod.com/pay/<uuid>`), `status: pending`, `expires_at`, `fee`.
- **Tidak ada API cek status** (diuji di sandbox 2026-11-10: `GET /api/v1/payments/{id}`, `/status`, `?order_id=` → 404;
  `/api/v1/merchant/*` butuh login dashboard). Webhook satu-satunya kabar lunas; webhook yang hilang dikirim ulang dari tab
  Webhooks Sumopod. Rezumi sendiri hanya menutup link: tidak pernah dibuat → `failed`, ditutup + 30 menit tanpa kabar → `expired`.
- `success_return_url`/`cancel_return_url` **harus https** (atau app link): `http://…` ditolak 400 `redirecturl`. Server lokal
  `http` tidak mengirimnya; pembeli kembali ke Rezumi sendiri.
- Jawaban `create` (sandbox): `{ payment_id, order_id, amount, fee, net_amount, currency, payment_link_url, status: "pending",
  expires_at, created_at }` di tingkat atas (tanpa `data`). Halaman bayar sandbox `sumo.sandbox.pymnt.global/payment-links/…`
  (QR + "I have already paid"). Sandbox: dashboard → Payments → ⋯ → **Simulate Payment** menandai lunas dan membuat event
  `payment.completed` (tab Webhooks: `webhook_url_not_set` bila URL kosong). Referensi halaman bayar = `SUMOPAY-<payment_id>`.
- Webhook: `payment.completed`, `payment.failed`, `payment.expired`, `payment.test`; payload `{ event_type, data: { payment_id,
  order_id, amount, fee, net_amount, status, payment_method, paid_at, settled_at, completed_at } }`. Tanda tangan **Svix**
  (`svix-id`, `svix-timestamp`, `svix-signature: v1,<base64>`; HMAC-SHA256 dengan byte base64 setelah `whsec_`). Header
  `X-Webhook-Token` tidak dipakai. Sumopod menunggu 2xx dalam 10 detik; webhook gagal bisa dikirim ulang dari tab Webhooks.
- Mode sandbox punya metode `QRIS` dan `QRIS_INSTANT` (1,5% + Rp300, settle 0 hari); live hanya `QRIS`.

Kode: `packages/api/src/features/billing/sumopod/` (config, client, signature, mapping, checkout, fulfillment, webhook,
reconcile), `passes.ts` (penempatan paket, kredit Pro AI per bulan paket, cabut paket, pratinjau), `checkout.ts`
(`paymentOptions` = aturan kapan kartu/QRIS; `checkout` memilih penyedia), `refunds.ts` (`recordQrisRefund`), migrasi
`20261110045304_youthful_morgan_stark` (indeks unik `ai_credit_grant_pass_month`). Katalog v8: harga `idr` = harga QRIS,
`PAYMENT_METHODS`, `paymentMethodsForCountry`, `PRICES_INCLUDE_TAX`, `PASS_DAYS`. Web: halaman Paket (QRIS + tautan kartu),
dialog konfirmasi (pratinjau `billing.previewPass`), halaman kembali, bukti bayar `/dashboard/settings/billing/receipt/$paymentId`,
admin (badge QRIS, Catat refund QRIS, angka QRIS). Env: `SUMOPOD_ENVIRONMENT`, `SUMOPOD_API_KEY`, `SUMOPOD_WEBHOOK_SECRET`.

### Langkah dan status

| #   | Langkah                                                                                                            | Status |
| --- | ------------------------------------------------------------------------------------------------------------------ | ------ |
| 1   | Baca dashboard Sumopod (Chrome, baca saja): API, webhook, sandbox, biaya, setelan                                  | ✅     |
| 2   | Katalog v8, env, migrasi, klien Sumopod, verifikasi tanda tangan Svix                                              | ✅     |
| 3   | Backend: aturan kartu/QRIS, checkout QRIS, webhook, fulfillment paket, kredit bulanan, rekonsiliasi, refund manual | ✅     |
| 4   | Email: bukti bayar QRIS, pengingat H-3 "perpanjang dengan QRIS", peringatan & ringkasan harian menyebut Sumopod    | ✅     |
| 5   | Web: halaman Paket, dialog, halaman kembali, riwayat + bukti bayar, admin; homepage/FAQ/llms.txt; terjemahan id    | ✅     |
| 6   | Legal ID/EN, panduan `docs/`, dokumen rencana, runbook                                                             | ✅     |
| 7   | Tes unit + DB nyata (16 skenario QRIS) dan regresi Dodo                                                            | ✅     |
| 8   | Uji sandbox Sumopod lewat server lokal (buat link, cek endpoint status, bayar di sandbox)                          | ✅     |
| 9   | Produksi: secret Worker, webhook live, uji Rp29.000 sungguhan                                                      | ⬜     |

### Hasil uji (2026-11-10)

- **Tes otomatis:** api 1.122 lulus (198 dilewati: suite OAuth/integrasi lain tanpa DB-nya), termasuk 16 skenario QRIS DB
  nyata + 14 unit tanda tangan/mapping dan regresi Dodo (186 tes billing); web 709; server 285; schema 185; env 70; email 10;
  typecheck 9 paket (termasuk mobile); `turbo boundaries`, knip, `lint:agent`, `format:check` bersih; `pnpm check:cloudflare`
  (build + dry-run Worker) lulus. E2E `billing.spec.ts` di build produksi: 2/2 lulus (kartu Dodo dan QRIS baru: Rupiah, dialog, halaman QRIS distub, kembali → lunas, bukti bayar, "Tambah 30 hari").
- **Lokal (server 3150, `DEV_COUNTRY=ID`, DB `rezumi_qris_sandbox`):** halaman Paket dari Indonesia menampilkan QRIS Rupiah
  (Rp29.000/30 hari, tanpa masa coba, tautan kartu USD); dialog dengan pratinjau masa aktif; kunci palsu → Sumopod sandbox
  menjawab 401 → pesan galat, pembayaran "Gagal", peringatan tercatat. Webhook bertanda tangan (Svix) ke
  `/api/payments/sumopod/webhook`: diterapkan (Pro AI 30 hari + 100 kredit + email bukti bayar), kirim ulang = `duplicate`,
  tanda tangan palsu = 403. Halaman Paket "Dibayar dengan QRIS; aktif sampai …", riwayat + **Bukti bayar** (halaman cetak),
  admin: baris `RZ-…` QRIS, **Catat refund QRIS** penuh → akun kembali Gratis, paket dan kredit dicabut.
- **Sandbox Sumopod dengan key asli (2026-11-10):** halaman Paket → Plus 30 hari → `POST /api/v1/payments` 201 → diarahkan ke
  halaman QRIS sandbox (Rp29.000, referensi `SUMOPAY-<payment_id>`); dashboard sandbox menampilkan nomor pesanan `RZ-<id>`;
  **Simulate Payment** → Completed, fee Rp503, bersih Rp28.497, settle T+2, event `payment.completed` dibuat. Webhook yang
  sama (ditandatangani secret lokal) → lunas, Plus 30 hari, halaman kembali "Pembayaran diterima… tidak diperpanjang otomatis".
  Temuan dan perbaikan: tidak ada API cek status (kode cek status dihapus; webhook saja), alamat kembali harus https, dan
  halaman kembali/email sempat menulis "mulai setelah paketmu yang sekarang" karena membandingkan dengan waktu bayar Sumopod.
- **Belum:** webhook asli dari Sumopod ke server (butuh alamat publik: setelah merge, Settings → Webhook → Save & Test di Live
  membuktikan tanda tangan), uji Rp29.000 sungguhan.

### Perlu dibaca pemilik (teks legal baru)

1. Akun yang pernah membayar paket apa pun (termasuk QRIS) tidak mendapat masa coba kartu lagi (sesuai kode
   `hasTrialAvailable`).
2. **Setiap** pembayaran QRIS bisa direfund penuh dalam 7 × 24 jam bila kredit terpakai ≤10 (kartu: hanya tagihan pertama).
3. Refund QRIS ditransfer dalam tenggat 2 × 24 jam sejak data lengkap (termasuk rekening tujuan), tanpa potongan biaya.
4. Privasi: SumoPod (PT Koding Kreasi Indonesia) hanya menerima nomor pesanan dan nominal; rekening tujuan refund masuk data
   pengaduan.

### Uji pembelian produksi (2026-11-10)

PR #59 di-merge dan ter-deploy (CI, autofix, Deploy to Cloudflare sukses). Pemilik memasang webhook Live
`https://rezumi.app/api/payments/sumopod/webhook`, secret Worker `SUMOPOD_API_KEY` (live) dan `SUMOPOD_WEBHOOK_SECRET`; Save &
Test: `payment.test` **200** (dua 404 sebelumnya terjadi sebelum secret terpasang). Akun uji kedua `suraunusantara@gmail.com`
dijadikan admin lewat `POST /api/auth/admin/update-user` dari sesi admin pemilik (akun utama tetap hanya kartu sampai langganan
Dodo uji berakhir 10 Des).

| Cek        | Hasil                                                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| Rute       | Dari Indonesia: `paymentMethods ["qris","card"]`, Rupiah, Plus Rp29.000 / 30 hari                                       |
| Sumopod    | `RZ-01a1c42d-…` Completed, Rp29.000, fee Rp503, bersih Rp28.497 (Pending Balance, cair 12 Nov 14.00)                    |
| Webhook    | `payment.completed` 1 kali, **200**                                                                                     |
| Rezumi     | Pembayaran `paid` (dibayar 13.38.25 WIB, paket aktif 13.38.26), event `applied` dari webhook, audit `payment.fulfilled` |
| Paket      | Plus sampai 10 Des 2026 13.38 WIB, `renews: false`                                                                      |
| Peringatan | Tidak ada                                                                                                               |

Sisa: email bukti bayar dicek pemilik di kotak masuk akun uji. Refund uji (opsional): transfer balik Rp29.000 lalu **Catat refund
QRIS** di halaman admin.
