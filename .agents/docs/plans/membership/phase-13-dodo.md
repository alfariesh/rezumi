# Phase 13 — Polar diganti Dodo Payments

| Dikerjakan                  | Ukuran         | Bergantung pada      | Perlu dari pemilik                                                                                |
| --------------------------- | -------------- | -------------------- | ------------------------------------------------------------------------------------------------- |
| Claude (+ pemilik di akhir) | Besar (1 sesi) | Phase 12 (langganan) | Akun Dodo Payments (bisnis "Rezumi", mode test sudah ada), API key test di `.env.local` untuk uji |

Keputusan pemilik 2026-11-10 ("Saya ingin mengubah metode pembayaran dari Polar ke Dodo… belum ada user dan belum launch").
Dokumen ini menggantikan bagian Polar di [phase-12-polar.md](phase-12-polar.md) dan Phase 11. **Skema bisnis Phase 12 tetap
sama**: langganan bulanan/tahunan, harga USD dan Rupiah, harga belum termasuk pajak, masa coba 7 hari untuk Plus pertama, kode
diskon di checkout, Pro AI 100 kredit per bulan, upgrade langsung dan downgrade di perpanjangan, refund dari halaman admin.

## Untuk pemilik

**Apa yang berubah untuk pembeli:**

1. **Penjual resmi (Merchant of Record) sekarang Dodo Payments, Inc.**: Dodo menagih, menghitung dan menyetor pajak, mengirim
   invoice dan email tagihan, menangani sengketa kartu, lalu membayar hasil penjualan ke rekeningmu.
2. **Harga dan paket tidak berubah**: Plus $4.99/bln atau $39/thn, Pro AI $9.99/bln atau $79/thn; pengunjung Indonesia Plus
   Rp59.000/Rp459.000, Pro AI Rp129.000/Rp999.000. Rupiah adalah **harga tetap**, bukan konversi kurs. Harga **belum termasuk
   pajak**; Dodo menambahkan pajak lokasi pembeli (contoh uji: Jerman +19% VAT). Catatan: di mode test Dodo menghitung **0%
   pajak untuk pembeli Indonesia** (Polar dulu +11% PPN). Itu urusan pendaftaran pajak Dodo sebagai penjual, bukan Rezumi.
3. **Cara bayar**: kartu debit/kredit, Apple Pay, Google Pay, dan metode lokal yang didukung Dodo. **QRIS, e-wallet, dan VA
   Indonesia tetap tidak ada** (Dodo belum mendukungnya untuk langganan).
4. **Masa coba Plus 7 hari**: sama. Dodo menyimpan kartu dengan pembayaran $0, mengirim email "trial ending" ±2 hari sebelum
   tagihan pertama. **Lebih baik dari Polar:** upgrade saat masa coba langsung menagih harga penuh paket baru (dicek lewat preview di mode test),
   jadi trik dua langkah untuk menutup celah Polar tidak diperlukan lagi.
5. **Kode diskon** tetap bisa diketik pembeli di checkout. Buat kodenya di dashboard Dodo (Products → Discounts): persentase
   atau nominal, batas pemakaian, tanggal kedaluwarsa, berlaku untuk produk tertentu, dan jumlah siklus langganan.
6. **Portal pelanggan Dodo**: tombol "Billing and invoices" (Indonesia: "Tagihan dan invoice") membukanya: ganti kartu, unduh
   invoice, batalkan. Tombol "Invoice" di riwayat pembayaran kini membuka PDF invoice Dodo langsung.

**Yang lebih baik dari skema Polar:**

- Setiap akun Rezumi punya **pelanggan Dodo sendiri** (dibuat sebelum checkout pertama, id akun di metadata). Portal dan
  checkout tidak lagi menebak dari email, jadi email bekas akun yang dihapus tidak membuka riwayat orang lain.
- Webhook langganan **selalu membaca ulang langganan dari Dodo** sebelum diterapkan, jadi urutan event yang acak tidak pernah
  mengembalikan status lama.
- **Sengketa kartu (chargeback)** ditangani: dibuka → email peringatan ke pemilik (kirim bukti di dashboard Dodo dalam ±10 hari);
  kalah/diterima → pembayaran ditandai "Reversed", kreditnya dicabut, langganannya dihentikan.
- Status **on hold** (tagihan gagal, menunggu kartu baru) dikenali: akses berhenti di akhir periode yang dibayar, tombol paket
  dikunci sampai pembeli memperbarui kartu di portal.
- Email Dodo ke pembeli memakai bahasa akun (Indonesia untuk akun berbahasa Indonesia).

**Biaya Dodo** (situs harga Dodo, 2026-11-10): 4% + 40¢ per transaksi, +1,5% kartu non-AS, +0,5% untuk langganan → kira-kira
**6% + 40¢** per tagihan internasional (Polar: 6,5% + 50¢). Contoh Plus $4.99: ±$0.70 (Polar ±$0.82). Payout standar gratis,
$5 bila payout di bawah $1.000; payout USD lewat SWIFT untuk bisnis non-AS $25. Cek metode payout ke rekening Indonesia saat
onboarding.

**Biaya nyata pembeli Rupiah** (uji produksi 2026-11-10): harga lokal IDR selalu "fees inclusive", jadi Rezumi juga menanggung
**biaya kurs Adaptive Currency ±4%**. Pro AI bulanan Rp129.000 ≈ $7.14 → biaya kurs −$0.27 → Gross $6.87 → fee 6% × $7.14 +
$0.40 = −$0.83 → **Net $6.04** (potongan ±15%). Perkiraan dengan kurs yang sama:

| Paket IDR                | Potongan Dodo |
| ------------------------ | ------------- |
| Plus bulanan Rp59.000    | ±22%          |
| Pro AI bulanan Rp129.000 | ±15%          |
| Plus tahunan Rp459.000   | ±12%          |
| Pro AI tahunan Rp999.000 | ±11%          |

**Tugasmu** (Claude memandu; semua kunci kamu ketik sendiri, tidak pernah di chat):

| Kapan                            | Tugas                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ✅ Sudah (mode test, 2026-11-10) | Dashboard Dodo, **mode Test** (saklar Live Mode mati): Developer → API Keys → buat key. Tulis di `.env.local`: `DODO_PAYMENTS_ENVIRONMENT="test_mode"`, `DODO_PAYMENTS_API_KEY="…"`, dan empat id produk test di bagian "Untuk agent". Hapus baris `POLAR_*` lama                                                                                                                                                                                                |
| ✅ Sudah (mode test, 2026-11-10) | Settings → Pricing → nyalakan **Adaptive Currency** (wajib agar checkout bisa menagih Rupiah). Harga Rupiah tetap memakai harga lokal yang sudah dibuat; biaya kurs ±4% ditanggung Rezumi (harga lokal selalu "fees inclusive")                                                                                                                                                                                                                                  |
| ✅ Sudah (mode test, 2026-11-10) | Settings → Subscriptions: **Prevent Trial Misuse ON**; Settings → Revenue Recovery: **Payment retries ON**. Jangan membuat "product collection" untuk portal (ganti paket lewat Rezumi saja)                                                                                                                                                                                                                                                                     |
| ✅ Sudah (mode test, 2026-11-10) | Settings → Communication → Customer emails: nyalakan **Payment Failed**, **Subscription Renewal Failed**, dan **Upcoming Renewal Reminder** (bawaannya mati; Rezumi tidak mengirim email itu sendiri). **Ulangi semua setelan ini di mode Live** sebelum go-live: setelan mode test dan live terpisah                                                                                                                                                            |
| Sebelum uji webhook              | Developer → Webhooks → Add endpoint ke `https://<staging atau rezumi.app>/api/payments/dodo/webhook` dengan event: semua `payment.*`, semua `subscription.*`, `refund.succeeded`, `refund.failed`, semua `dispute.*`. Salin **signing secret** ke `DODO_PAYMENTS_WEBHOOK_KEY` (lokal: `.env.local`; produksi: `pnpm exec wrangler secret put DODO_PAYMENTS_WEBHOOK_KEY`). Uji lokal bisa juga dengan `dodo wh listen`                                            |
| Sebelum go-live                  | Selesaikan **verifikasi bisnis/KYC** dan **rekening payout** di Dodo. Lalu minta Claude membuat 4 produk live (Claude meminta izinmu dulu), isi id produk + `"DODO_PAYMENTS_ENVIRONMENT": "live_mode"` di `wrangler.jsonc`, lalu secret Worker `DODO_PAYMENTS_API_KEY` (key live) dan `DODO_PAYMENTS_WEBHOOK_KEY`                                                                                                                                                |
| Sebelum go-live                  | **Ulangi setelan di mode Live** (saklar Live Mode nyala): Pricing → Adaptive Currency ON; Subscriptions → Allow Multiple Subscriptions OFF, Prevent Trial Misuse ON, portal: Allow Subscription Updates OFF, Allow Immediate Cancellation OFF, Cancellation at Next Billing Date ON, Subscription Pause OFF; Revenue Recovery → Payment retries ON, Dunning emails ON; Communication → Upcoming Renewal Reminder, Payment Failed, Subscription Renewal Failed ON |
| Sebelum go-live                  | Cloudflare zona `rezumi.app`: **Bot Fight Mode tetap mati** (bisa memblokir webhook)                                                                                                                                                                                                                                                                                                                                                                             |
| Setelah PR ini di-merge          | Bersihkan Polar: `pnpm exec wrangler secret delete POLAR_ACCESS_TOKEN` dan `… POLAR_WEBHOOK_SECRET`; di polar.sh hapus endpoint webhook produksi dan cabut token; di sandbox batalkan langganan uji (Pro AI tahunan) lalu cabut token sandbox                                                                                                                                                                                                                    |
| Sebelum go-live                  | ⚖️ Review teks legal baru (S&K, privasi, refund, ID/EN) yang kini menyebut **Dodo Payments, Inc.**; pastikan nama badan hukum sama dengan yang tertulis di invoice/perjanjian merchant Dodo. Konsultasi pajak tetap berlaku (penghasilan dari payout Dodo)                                                                                                                                                                                                       |

## Untuk agent

Baca dulu: `CLAUDE.md`, README rencana ini, `00-keputusan-produk.md` (log 2026-11-10), `01-arsitektur.md` (bagian Polar dibaca
sebagai Dodo, lihat tabel di bawah). Dokumen Dodo: MCP `dodopayments` (`search_docs`, `read_docs_page`, `search` untuk SDK,
`execute` untuk akun pemilik; sesi MCP 2026-11-10 = **mode test**, bisnis "Rezumi" `bus_0NrLh5lcOwpDoTyhEcGUj`) dan skill
`dodo-payments:dodo-payments`. **Jangan menulis ke mode live tanpa izin eksplisit pemilik.** SDK `dodopayments` **2.61.1**
(dipin di katalog pnpm).

Produk test (2026-11-10, USD + harga lokal IDR `by_currency`, `tax_inclusive: false`, `tax_category: saas`, trial 0, periode
langganan 20 tahun dengan tagihan bulanan/tahunan, metadata `rezumi_plan`/`rezumi_interval`):

| Env                                    | Id produk test              | USD  | IDR      |
| -------------------------------------- | --------------------------- | ---- | -------- |
| `DODO_PAYMENTS_PRODUCT_PLUS_MONTHLY`   | `pdt_0NrbytD9Enu0PTffpt7KM` | 499  | 5900000  |
| `DODO_PAYMENTS_PRODUCT_PLUS_YEARLY`    | `pdt_0NrbytGSj7f6FeVzY3YT1` | 3900 | 45900000 |
| `DODO_PAYMENTS_PRODUCT_PRO_AI_MONTHLY` | `pdt_0NrbytKkgbAgXP4kJQEtp` | 999  | 12900000 |
| `DODO_PAYMENTS_PRODUCT_PRO_AI_YEARLY`  | `pdt_0NrbytOIWHFnsqvo3Vzu1` | 7900 | 99900000 |

### Pemetaan Polar → Dodo

| Polar (Phase 12)                        | Dodo (Phase 13)                                                                                                                                                                                                      |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `external_customer_id` = user id        | `billing_account.provider_customer_id`: pelanggan Dodo dibuat sekali (`customers.create`, metadata `rezumi_user_id`, `preferred_locale`), lalu `customer: { customer_id }` di setiap checkout dan portal             |
| Order                                   | Payment (`pay_…`); `billing_payment.providerPaymentId` (kolom lama `provider_order_id`). `amount` = `total_amount − tax`; periode dari `service_periods`; alasan dari `charge_type` (new/renewal/plan_change)        |
| Checkout `currency`, `allow_trial`      | `billing_currency` USD/IDR dipin + `allow_currency_selection: false`; IDR juga `billing_address.country: "ID"`; `subscription_data.trial_period_days` 7 atau 0; `allow_discount_code: true`; sesi hidup 24 jam       |
| Status `trialing`                       | Dodo melaporkan `active`; Rezumi menyimpan `trialing` selama periode pertama berakhir ≤ `created_at + trial_period_days` (`isInTrial`)                                                                               |
| `modified_at` untuk urutan event        | Objek Dodo tanpa waktu ubah: webhook langganan **membaca ulang** `subscriptions.retrieve`, dan waktu baca (`observedAt`) menjadi `provider_modified_at`                                                              |
| Upgrade `proration_behavior: invoice`   | Interval sama: `prorated_immediately_keep_cycle`; interval lain: `prorated_immediately`; selalu `on_payment_failure: prevent_change`. Rezumi menunggu ≤6 detik sampai produk berganti, lalu menerapkan pembayarannya |
| Akhiri trial dulu (`trial_end: now`)    | Tidak perlu: dalam trial, `keep_cycle` berjalan sebagai `full_immediately` (preview: tagihan $9.99 hari itu)                                                                                                         |
| Downgrade `next_period`                 | `full_immediately` + `effective_at: next_billing_date` → `scheduled_change.product_id` = `pendingProductId`                                                                                                          |
| Batal di akhir periode                  | `cancel_at_next_billing_date: true` (status tetap `active`, diuji); batal seketika `status: "cancelled"`                                                                                                             |
| `past_due`                              | `past_due` dan `on_hold`: akses sampai `paid_through`, ganti paket ditolak; `on_hold` tetap "langganan hidup" agar tidak dobel                                                                                       |
| Invoice URL                             | `invoices.payments.retrieve` (PDF) diteruskan sebagai `File` lewat oRPC                                                                                                                                              |
| Refund `amount` sebelum pajak           | Penuh: tanpa `items` (Dodo mengembalikan pajaknya). Sebagian: `items: [{ item_id, amount, tax_inclusive: false }]` dari `retrieveLineItems`. Refund dari dashboard Dodo dikonversi ke porsi bersih (`netShare`)      |
| `dispute_prevention` refund             | Webhook `dispute.*`: dibuka → alert; kalah/diterima → `reversed`, kredit dicabut, langganan dibatalkan                                                                                                               |
| Hapus akun → `customers.deleteExternal` | Batalkan langganan hidup (`status: cancelled`); Dodo menyimpan catatan transaksi                                                                                                                                     |
| Webhook `/api/payments/polar/webhook`   | `/api/payments/dodo/webhook`, verifikasi `webhooks.unwrap` (Standard Webhooks), dedupe `webhook-id`, 403/503/200 seperti sebelumnya                                                                                  |

Kode: `packages/api/src/features/billing/dodo/` (client, config, mapping), `subscription-access.ts` (aturan akses netral),
`fulfillment.ts`, `webhook.ts`, `checkout.ts`, `reconcile.ts`, `refunds.ts`, `deletion.ts`. Migrasi
`20261110013112_tiny_jocasta`: `billing_account.provider_customer_id`, status langganan Dodo (status Polar lama dikonversi),
metode refund `dodo`, default provider `dodo`.

### Langkah dan status

| #   | Langkah                                                                                                                                                                                                       | Status |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | Riset Dodo (docs, SDK 2.61.1) dan produk test (4 produk, USD + IDR, pajak di atas harga)                                                                                                                      | ✅     |
| 2   | Env, skema DB + migrasi                                                                                                                                                                                       | ✅     |
| 3   | Backend: client, webhook, checkout/ganti paket/batal/portal/invoice, rekonsiliasi, refund, sengketa, hapus akun, admin, laporan, notifikasi                                                                   | ✅     |
| 4   | Web: teks, status on hold, invoice PDF, admin; terjemahan Indonesia                                                                                                                                           | ✅     |
| 5   | Tes unit + DB nyata (27 skenario Dodo), tes web, tes e2e diperbarui                                                                                                                                           | ✅     |
| 6   | Legal ID/EN, dokumen rencana, runbook                                                                                                                                                                         | ✅     |
| 7   | Verifikasi perilaku di API mode test (parameter checkout, pembayaran trial $0, metadata, batal di akhir periode, downgrade terjadwal, upgrade saat trial, batal seketika)                                     | ✅     |
| 8   | Uji end-to-end lewat server lokal dengan kartu uji 4242, lalu webhook asli lewat relay `dodo wh listen` (2026-11-10)                                                                                          | ✅     |
| 9   | Go-live: verifikasi live (✅), produk live (✅), setelan live (✅), `wrangler.jsonc` live; secret Worker (✅), webhook live (✅), uji pembelian (✅); sisa: refund lewat support Dodo, lalu `BILLING_MODE=on` | 🟡     |

### Hasil verifikasi mode test (2026-11-10, lewat MCP, tanpa server Rezumi)

- `checkoutSessions.create` dengan parameter persis kode (IDR + trial 7, USD tanpa trial) diterima; portal pelanggan dibuat.
- Langganan trial tanpa kartu (produk sementara, sudah diarsipkan): pembayaran `succeeded`, `total_amount 0`, `tax null`,
  `charge_type new`, `service_periods` = 7 hari trial, `checkout_session_id` terisi; **metadata checkout ikut ke pembayaran dan
  langganan**; langganan `active`, `trial_period_days 7`, `next_billing_date` = akhir trial.
- `cancel_at_next_billing_date: true` → status tetap `active`; dibatalkan seketika → `cancelled` + `cancelled_at`; membatalkan dua
  kali tidak error.
- Preview upgrade `prorated_immediately_keep_cycle` saat trial → tagihan $9.99 hari itu, tanggal tagih sebulan lagi.
- Ganti paket terjadwal → `scheduled_change.product_id`.
- Belum diuji: pengiriman webhook asli, pembayaran kartu sungguhan (mode test, kartu 4242) lewat halaman Rezumi, refund dan
  sengketa sungguhan. Data uji yang tertinggal di mode test: pelanggan `cus_0Nrc49YL49BjkPFVZp5gT`
  (`dodo-integration-check@rezumi.app`) dengan satu langganan dibatalkan.

### Hasil uji end-to-end lokal (2026-11-10)

Server lokal dari worktree `rezumi-dodo` (port 3140, `BILLING_MODE=admins`, database terpisah `rezumi_dodo_sandbox`, API key
test pemilik), akun uji `dodo-sandbox@rezumi.app` (admin, terverifikasi; kata sandi hanya di `localStorage.__testpw` origin
127.0.0.1:3140), kartu uji 4242 4242 4242 4242, 12/34, 123. Tanpa webhook.

- **Berhasil:** trial Plus 7 hari (checkout Dodo menampilkan "7 days free trial", total hari ini $0, kode diskon tersedia) →
  halaman kembali "Your free trial has started"; upgrade ke Pro AI saat trial → ditagih **$9.99** penuh, trial berakhir, 100
  kredit; pindah ke tahunan → ditagih **$69.01** ($79 dikurangi sisa bulan), periode baru setahun, kredit tidak dobel;
  downgrade ke Plus tahunan terjadwal ("Changes to Plus on November 10, 2027"); batal di akhir periode lalu lanjut; portal
  pelanggan Dodo (paket, kartu, riwayat, unduh invoice); tombol Invoice membuka PDF Dodo; admin: cari dengan id `pay_…`,
  refund sebagian $2 → selesai seketika, metadata `rezumi_refund_id` tercatat di Dodo; laporan admin MRR $6.58.
- **Setelan dashboard (mode test) yang diubah atas izin pemilik:** Prevent Trial Misuse ON; Payment retries ON (jadwal standar,
  jendela 13 hari); email pelanggan Upcoming Renewal Reminder, Payment Failed, Subscription Renewal Failed ON. Menyusul
  rekomendasi Claude yang disetujui pemilik: **Allow Multiple Subscriptions OFF** (pengaman kedua terhadap langganan dobel; Rezumi
  sendiri juga menolaknya), **Dunning emails ON** (urutan email bawaan Dodo saat langganan on hold), portal **Allow Immediate
  Cancellation OFF** (sesuai kebijakan batal di akhir periode; Cancellation at Next Billing Date tetap ON). Sudah sesuai sejak awal:
  Adaptive Currency ON, portal Allow Subscription Updates OFF, Allow Subscription Pause OFF, grace period OFF, Abandoned cart
  recovery OFF.
- **Ditemukan dan diperbaiki:**
  1. Tagihan upgrade diselesaikan Dodo secara asinkron (±45 detik di mode test). Dulu Rezumi menjawab "Your plan is now Pro AI"
     padahal paket belum berganti, dan tanpa webhook job tidak mengecek ulang. Sekarang jawabannya `processing` ("Your payment
     is being processed…"), halaman memperbarui sendiri, dan permintaan dicatat (`subscription.change_requested`) sehingga job
     billing mengecek tiap ±45 detik selama 30 menit sampai paket berganti.
  2. Klik kedua saat data lokal masih tertinggal membuat perubahan Pro AI → Pro AI $0 di Dodo. Sekarang Rezumi membaca
     langganan dari Dodo dulu dan tidak mengubah paket yang sudah berganti.
  3. Pembayaran ganti paket $0 tidak lagi memberi kredit bulanan; kredit menempel ke tagihan yang dibayar (refund penuh
     mencabutnya).
  4. Teks dialog upgrade saat trial dan pindah ke tahunan disesuaikan dengan cara Dodo menagih.
  5. Tautan pembayaran di daftar peringatan admin dulu mencari `RZ-<id>` (sisa Midtrans) dan tidak menemukan apa pun;
     placeholder pencarian dan judul kolom "Order" diganti.
- Data uji di mode test Dodo: pelanggan `cus_0Nrc7vnztLn0GhaQUErgy` dengan langganan Pro AI tahunan aktif (downgrade terjadwal),
  plus dua pembayaran $0 dari klik ganda dan uji diagnosis.

### Uji webhook asli (2026-11-10, setelah PR #56 di-merge)

Relay Dodo CLI v3.7.4 (`dodo wh listen http://localhost:3141/api/payments/dodo/webhook`, tanpa alamat publik; terowongan
`cloudflared` ditolak pengaman Claude Code). CLI membuat endpoint relay di mode test; secret-nya diambil lewat API
(`webhooks.retrieveSecret`) langsung ke `.env.local` worktree, lalu endpoint dan secret dihapus setelah uji.

- **9 webhook diterima, semua 200, tanda tangan valid** (relay tidak merusak isi kiriman), 0 error, 0 peringatan.
- Akun lama: batal di akhir periode lalu lanjut → `subscription.updated` ×2, hasil `duplicate` (sudah diterapkan Rezumi sendiri).
- Akun baru `dodo-sandbox2@rezumi.app` beli Pro AI bulanan: `payment.succeeded` dan `subscription.active` **diterapkan dari
  webhook** (sebelum cek status halaman kembali); `subscription.updated`/`renewed` yang datang bersamaan tercatat `stale`.
- Refund penuh + hentikan langganan dari admin → `refund.succeeded`, `subscription.cancelled`, `subscription.updated` tercatat
  `duplicate`; kredit dicabut, akun kembali Gratis.
- Belum bisa diuji di mode test: sengketa kartu (dispute). Logikanya dicakup tes DB nyata.

### Mode live (2026-11-10)

Verifikasi bisnis Dodo disetujui; plugin MCP `dodopayments` dihubungkan ulang ke mode **live** (Dodo CLI tetap mode test).
Atas persetujuan pemilik, Claude membuat empat produk live dengan isi sama seperti produk test (USD, harga lokal IDR
`by_currency`, `tax_inclusive: false`, `saas`, periode 20 tahun, metadata `rezumi_plan`/`rezumi_interval`). Pratinjau checkout
live: Rupiah tetap tanpa pajak untuk Indonesia, USD + VAT 19% untuk Jerman.

| Env (`wrangler.jsonc`)                 | Id produk live              |
| -------------------------------------- | --------------------------- |
| `DODO_PAYMENTS_PRODUCT_PLUS_MONTHLY`   | `pdt_0NrcLxDOzozrbdcuNkIZz` |
| `DODO_PAYMENTS_PRODUCT_PLUS_YEARLY`    | `pdt_0NrcLxH3dG9NbNzj3GL0U` |
| `DODO_PAYMENTS_PRODUCT_PRO_AI_MONTHLY` | `pdt_0NrcLxLNpsfqo3e2jP7zY` |
| `DODO_PAYMENTS_PRODUCT_PRO_AI_YEARLY`  | `pdt_0NrcLxOnM7iDIBRvf4zQN` |

Setelan dashboard ternyata berlaku untuk kedua mode: di live semuanya sudah seperti mode test (dicek 2026-11-10).

**Urutan menyalakan produksi** (salah urutan menjatuhkan situs, karena pemeriksaan env berjalan saat Worker start):

1. Merge PR yang mengisi `wrangler.jsonc` (id produk live + `DODO_PAYMENTS_ENVIRONMENT: live_mode`). Tanpa API key, pembelian
   tetap tidak tersedia; situs aman.
2. Dashboard Dodo, **Live Mode nyala**: Developer → API Keys → buat key. Lalu `pnpm exec wrangler secret put DODO_PAYMENTS_API_KEY`
   dan tempel key itu. **Harus key mode live**: key mode test di sini membuat Worker gagal start. Bila salah, ulangi perintah
   dengan key yang benar.
3. Developer → Webhooks → Add endpoint `https://rezumi.app/api/payments/dodo/webhook`, event: semua `payment.*`,
   `subscription.*`, `refund.*`, `dispute.*`. Salin signing secret → `pnpm exec wrangler secret put DODO_PAYMENTS_WEBHOOK_KEY`.
   Dodo tidak punya email peringatan per endpoint (dicek 2026-11-10); peringatan datang dari Rezumi (`BILLING_ALERT_EMAIL`).
4. ✅ Settings → Business → brand Rezumi: support email `hi@rezumi.app` (2026-11-10). Settings → Communication → Your Emails:
   notifikasi Payments, Payouts, Refunds, Disputes, Subscription Started untuk email pemilik menyala.
5. Uji di produksi dengan akun admin (`BILLING_MODE=admins`): satu pembelian kecil sungguhan (Plus bulanan $4.99, atau Rp59.000)
   lalu refund penuh dari halaman admin; cek webhook masuk di Developer → Webhooks → Logs dan di riwayat pelanggan admin.
6. Go-live: `BILLING_MODE=on` (Phase 11).

### Uji pembelian produksi (2026-11-10)

Akun admin pemilik di rezumi.app (`BILLING_MODE=admins`), kartu Mastercard kredit Indonesia, Pro AI bulanan (Plus pertama akan
memberi masa coba $0, jadi tidak menguji tagihan sungguhan).

| Cek                     | Hasil                                                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Checkout                | `cks_0NrcQu9s22CepVGkRod5A` → `pay_0NrcRE2m6DYTZFL4kNweT`, Rp129.000, pajak 0, metadata Rezumi ikut              |
| Langganan               | `sub_0NrcRE30SeWKXuMsGvLEm` aktif, perpanjangan 10 Des 2026                                                      |
| Webhook produksi        | `payment.succeeded`, `subscription.active`, `subscription.renewed`, `subscription.updated`; error rate 0%        |
| Rezumi                  | Paket Pro AI, 100 kredit, riwayat "New subscription · Paid", halaman admin lengkap                               |
| Saldo Dodo              | Gross $6.87, fee $0.83, Net $6.04 (lihat "Biaya nyata pembeli Rupiah")                                           |
| Refund penuh dari admin | **Ditolak Dodo: "insufficient funds in wallet"** (HTTP 409); tercatat Ditolak + email peringatan, tak ada efek   |
| Tindak lanjut           | Pemilik meminta refund lewat support Dodo; langganan dibatalkan di akhir periode (`cancel_at_next_billing_date`) |

Temuan:

- **Refund dibayar dari saldo wallet**, bukan dari pembayaran aslinya. Satu pembayaran hanya menambah saldo sebesar Net-nya,
  jadi refund penuh atas pembayaran pertama (atau tepat setelah payout) selalu ditolak. Penanganan Rezumi sudah benar (refund
  `failed`, alert `refund_failed`, langganan tidak dihentikan); langkah pemilik ada di runbook bagian 3.
- **Langganan Rupiah tercatat dalam USD** di Dodo (`currency: USD`, `recurring_pre_tax_amount: 714`), walau pembayarannya IDR
  dan perpanjangan tetap memakai harga lokal (docs Localized Pricing: "Renewals keep the localized price"). Akibatnya halaman
  admin menampilkan langganan sebagai "Monthly · $7.14" dan laporan MRR memakai angka USD itu. Belum diubah.
- Langganan baru Dodo juga mengirim `subscription.renewed` saat dibuat; Rezumi membaca ulang langganan, jadi tidak ada efek ganda.
- Sisa: pastikan refund dari support Dodo tercatat lewat webhook (`refund.succeeded`, pembayaran Refunded, kredit ditarik).
