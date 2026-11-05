# Phase 12 — Go global: Midtrans diganti Polar, paket menjadi langganan

| Dikerjakan                  | Ukuran           | Bergantung pada                       | Perlu dari pemilik                                                                                      |
| --------------------------- | ---------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Claude (+ pemilik di akhir) | Besar (2–3 sesi) | Phase 01–10 (fondasi billing, kredit) | Akun Polar sandbox + produksi, token akses sandbox di `.env.local`, keputusan harga (sudah, 2026-11-05) |

Keputusan pemilik 2026-11-05 ("ingin ke global… migrasikan Midtrans ke Polar"). Dokumen ini menggantikan bagian Midtrans di Phase 06, 07, 09, dan 11. Aturan bisnis yang tidak disebut di sini (batas dokumen, fitur paket, bobot kredit, dokumen tidak pernah dikunci, beli hanya di web) **tetap berlaku**.

## Untuk pemilik

**Apa yang berubah untuk pembeli:**

1. **Langganan otomatis**, bulanan atau tahunan, bisa dibatalkan sendiri kapan saja (akses tetap sampai akhir periode yang sudah dibayar). Tidak ada lagi pass 30 hari.
2. **Harga global** dalam USD; pengunjung dari Indonesia otomatis melihat Rupiah. **Harga belum termasuk pajak** (keputusan 2026-11-05): Polar menambahkan pajak lokasi pembeli di checkout dan setiap tagihan (mis. Plus Indonesia: $4.99 + PPN $0.55 = $5.54).

   | Paket  | Bulanan           | Tahunan         |
   | ------ | ----------------- | --------------- |
   | Plus   | $4.99 / Rp59.000  | $39 / Rp459.000 |
   | Pro AI | $9.99 / Rp129.000 | $79 / Rp999.000 |

3. **Cara bayar:** kartu debit/kredit, Apple Pay, Google Pay, Link, dan beberapa metode lokal di Eropa/India/Korea. **QRIS, e-wallet, dan VA tidak ada lagi.**
4. **Polar adalah penjual resmi (Merchant of Record):** Polar Software, Inc. menagih pembeli, menghitung dan menyetor pajak (VAT/GST/sales tax, termasuk PPN PMSE Indonesia), mengirim invoice dan email tagihan, menangani sengketa kartu, lalu membayarkan hasil penjualan ke rekening bank Indonesia-mu lewat Stripe Connect Express.
5. **Portal pelanggan Polar:** pembeli bisa membatalkan, mengganti kartu, dan mengunduh invoice sendiri. Tombol "Tagihan dan invoice" (Inggris: "Billing and invoices") di halaman Paket membukanya.
6. **Pro AI** tetap 100 kredit Rezumi AI **per bulan** (pelanggan tahunan menerimanya tiap bulan), tanpa rollover.
7. **Masa coba gratis 7 hari untuk Plus** (keputusan 2026-11-05, sementara hanya Plus): langganan Plus pertama sebuah akun, bulanan atau tahunan. Kartu tetap diminta; tagihan pertama di hari ke-8 kecuali dibatalkan; Polar mengirim pengingat 3 hari sebelumnya. Upgrade ke Pro AI atau ke tahunan selama masa coba mengakhiri masa coba dan langsung ditagih. Refund 7 hari dihitung dari tagihan pertama.

**Biaya Polar** (paket Starter, organisasi dibuat setelah 27 Mei 2026): 5% + 50¢ per transaksi, +1,5% untuk kartu non-AS, dihitung dari total termasuk pajak. Payout: $2 per bulan aktif + 0,25% + $0,25 per payout, plus konversi kurs ±1%. Paket Pro Polar ($20/bulan, 3,8% + 40¢) baru menguntungkan di atas ±$1.379 penjualan per bulan.

**Tugasmu** (Claude memandu; semua kunci kamu ketik sendiri, tidak pernah di chat):

| Kapan                      | Tugas                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sebelum uji lokal          | Di **sandbox.polar.sh** (organisasi `elqebdsuhcoxtaljswym`): Settings → General → Developers → buat **Organization Access Token** (semua scope `checkouts`, `customer_sessions`, `customers`, `orders`, `products:read`, `refunds`, `subscriptions`, `webhooks`), lalu tulis di `.env.local`: `POLAR_ENVIRONMENT="sandbox"` dan `POLAR_ACCESS_TOKEN="…"`                                                                                                                                                |
| Sebelum uji webhook        | Claude membuat endpoint webhook sandbox; salin **secret**-nya dari dashboard (Settings → Webhooks) ke `.env.local` sebagai `POLAR_WEBHOOK_SECRET`                                                                                                                                                                                                                                                                                                                                                       |
| Sebelum go-live (Phase 11) | Selesaikan onboarding organisasi **Rezumi** di polar.sh: detail usaha dan produk, verifikasi identitas (KTP/paspor + selfie lewat Stripe), hubungkan rekening bank Indonesia (Rupiah, atas namamu). Review Polar bisa sampai 14 hari dan reviewer meminta kode diskon 100% atau video alur beli                                                                                                                                                                                                         |
| Sebelum go-live            | Di zona Cloudflare `rezumi.app`: **matikan Bot Fight Mode** (memblokir webhook Polar dengan 403)                                                                                                                                                                                                                                                                                                                                                                                                        |
| Sebelum go-live            | Pengaturan Polar produksi: Payments → **Default tax behavior: Exclusive** (pajak di atas harga); Subscriptions → proration **Invoice** (upgrade langsung ditagih) dan **Prevent trial abuse: ON**; matikan "plan changes" di Customer portal (ganti paket lewat Rezumi; ganti paket di portal saat masa coba tidak ditagih); biarkan email pelanggan bawaan Polar aktif (termasuk pengingat masa coba). Di sandbox, harga sudah diset Exclusive per harga; nyalakan juga Prevent trial abuse di sandbox |
| Sebelum go-live            | ⚖️ Konsultasi pajak: penghasilan dari payout Polar (bukan lagi omzet penjualan langsung) dan status perorangan. Review teks legal baru (S&K, privasi, refund) yang menyebut Polar                                                                                                                                                                                                                                                                                                                       |

## Untuk agent

Baca dulu: `CLAUDE.md`, README rencana ini, `00-keputusan-produk.md` (log 2026-11-05), `01-arsitektur.md`. Dokumen Polar: MCP Polar (`search_docs`/`read_docs_page`); koneksi `0a751028-…` = **sandbox**, `16e7c96b-…` = **produksi** (jangan menulis ke produksi tanpa izin eksplisit pemilik). SDK `@polar-sh/sdk` 1.0.x, **API version `2026-10`** (stabil; `2027-01` masih "Next" sampai 1 Januari 2027 dan bisa berubah).

### Desain

- **Katalog** (`@rezumi/schema/billing`, `BILLING_CATALOG_VERSION` 4): `PLANS[id].prices[interval][currency]` dalam unit terkecil (USD sen; IDR juga dua desimal: Rp59.000 = `5900000`, diverifikasi di checkout sandbox 2026-11-05), `creditsPerMonth` (Pro AI 100). `BILLING_INTERVALS = ["month","year"]`, `BILLING_CURRENCIES = ["usd","idr"]`, `currencyForCountry("ID") = "idr"`, lainnya `usd`.
- **Produk Polar:** empat produk (Plus/Pro AI × bulanan/tahunan), masing-masing harga USD + IDR, metadata `rezumi_plan`/`rezumi_interval`. ID produk lewat env `POLAR_PRODUCT_PLUS_MONTHLY`, `…_PLUS_YEARLY`, `…_PRO_AI_MONTHLY`, `…_PRO_AI_YEARLY`. Sandbox 2026-11-05: Plus bulanan `1eed6e9a-623e-4773-9f35-dbec17a0a0d4`, Plus tahunan `1dd73112-6f2c-43f1-a546-48454c07a588`, Pro AI bulanan `5e164955-b367-4f38-90ff-1f07715d8833`, Pro AI tahunan `1aa24a00-f999-49cc-b1c2-c21ebe69a917`.
- **Tabel baru `billing_subscription`**: cermin langganan Polar (status, paket, interval, periode, `cancel_at_period_end`, `paid_through` = akhir periode terakhir yang lunas, `provider_modified_at` untuk menolak event lama). Hak akses: `active`/`trialing` sampai `current_period_end`; `past_due` hanya sampai `paid_through`; status lain tidak memberi akses. `membership_period` tetap untuk pemberian admin/promo dan pass lama; paket aktif = peringkat tertinggi yang menutupi saat ini.
- **`billing_payment`** = satu checkout Polar yang belum dibayar atau satu order Polar (perpanjangan membuat baris baru tanpa checkout). Kolom Midtrans dibuang; kolom baru `provider_checkout_id`, `subscription_id`, `billing_reason`, `interval`, `tax_amount`, `total_amount`. `amount` = `net_amount` Polar (setelah diskon, sebelum pajak), boleh 0 (kode diskon 100% untuk review Polar).
- **Webhook** `POST /api/payments/polar/webhook` (raw body, ≤256 KB): `webhooks.validateEvent` dari `@polar-sh/sdk/2026-10`; signature salah → 403; tipe tak dikenal → 202; dedupe dengan `webhook-id` (unik di `billing_payment_event.webhook_id`, dicatat di transaksi yang sama dengan perubahan); error sementara → 503 (Polar mengulang ±10×). Event: `order.paid`/`order.updated`/`order.refunded`, `subscription.*`, `refund.*`, `checkout.updated`/`checkout.expired`.
- **Kredit Pro AI**: setiap order Pro AI yang lunas memberi 100 kredit sampai akhir potongan bulan itu; langganan tahunan mendapat potongan bulan berikutnya lewat job (`grantSubscriptionCredits`), maksimal satu hibah per potongan per langganan (upgrade bolak-balik tidak menambah kredit).
- **Checkout** (`billing.checkout({ planId, interval, idempotencyKey })`): baris lokal `creating` di-commit dulu, lalu `checkouts.create` (produk, `external_customer_id` = user id, email/nama, `customer_ip_address` dari `CF-Connecting-IP`, `currency` dari negara `CF-IPCountry`, `locale`, `success_url` ke halaman kembali, `return_url`, metadata id pembayaran). Sudah berlangganan → `billing.changePlan` (`subscriptions.update`: naik paket atau ganti ke tahunan `invoice`; turun paket atau ke bulanan `next_period`). `billing.portal` membuat customer session (`external_customer_id`). Pembatalan/kartu/invoice lewat portal.
- **Rekonsiliasi** (job tiap menit): checkout `pending` ditanya ke Polar (`checkouts.get`, lalu `orders.list({ checkout_id })`); langganan `active` yang `current_period_end`-nya lewat > 1 jam disinkronkan ulang; langganan milik akun terhapus dibatalkan (`subscriptions.revoke`).
- **Refund** admin: `refunds.create` (jumlah **tanpa pajak**, alasan dari enum Polar); refund tidak membatalkan langganan, jadi admin memilih "batalkan langganan juga". Refund manual dihapus. Polar bisa me-refund sendiri ≤60 hari (mencegah chargeback) dan sekaligus membatalkan langganan: ditangani lewat webhook yang sama.
- **Dihapus:** modul `midtrans/`, notifikasi Midtrans, ganti metode bayar, email dan halaman bukti bayar Rezumi (Polar mengirim invoice/receipt sebagai penjual), env `MIDTRANS_*`.
- **Hapus akun:** hook hapus pengguna memanggil `customers.deleteExternal(userId, { anonymize: true })` (membatalkan langganan seketika, data Polar dianonimkan); job membatalkan sisa langganan bila panggilan itu gagal.

### Langkah dan status

| #   | Langkah                                                                                                                                           | Status |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | Keputusan + rencana (dokumen ini, log keputusan)                                                                                                  | ✅     |
| 2   | Produk sandbox (4 produk USD + IDR)                                                                                                               | ✅     |
| 3   | Katalog, env, skema DB + migrasi                                                                                                                  | ✅     |
| 4   | Backend: klien Polar, webhook, checkout/changePlan/portal, langganan, kredit bulanan, rekonsiliasi, refund, admin, laporan per mata uang          | ✅     |
| 5   | Server: rute webhook, hook hapus akun, job                                                                                                        | ✅     |
| 6   | Web: halaman Paket (bulanan/tahunan, mata uang, langganan, portal), halaman kembali, riwayat, admin                                               | ✅     |
| 7   | Tes unit + DB nyata (webhook bertanda tangan, urutan acak, duplikat, perpanjangan, refund, past_due) + tes browser                                | ✅     |
| 8   | Dokumen: arsitektur, runbook, legal ID/EN, draf panduan pengguna                                                                                  | ✅     |
| 9   | Uji sandbox end-to-end lewat server lokal (2026-11-05; webhook asli belum, lihat di bawah)                                                        | ✅     |
| 10  | Go-live: Phase 11 versi Polar (onboarding produksi, webhook produksi, Bot Fight Mode, uji kartu sungguhan dilarang Polar: pakai kode diskon 100%) | ⬜     |

### Hasil uji sandbox (2026-11-05)

Server lokal (`BILLING_MODE=admins`, database terpisah `rezumi_polar_sandbox`, token sandbox pemilik), kartu uji Stripe 4242, tanpa webhook (semua lewat cek status dan job):

- **Berhasil:** beli Plus bulanan → halaman kembali "Payment received"; invoice PDF dari Polar; portal pelanggan; upgrade Plus → Pro AI (selisih $5.00 ditagih saat itu); pindah Pro AI bulanan → tahunan ($69.01); batal lalu lanjutkan; turun ke Plus terjadwal di perpanjangan; refund admin $4.50 lewat Polar (kredit order itu dicabut); laporan admin (penjualan bersih, pajak, MRR $6.58).
- **Pajak:** harga Polar sudah termasuk pajak. Pembeli dari Indonesia membayar $4.99 dengan rincian "Taxes (included) $0.49"; yang tercatat bersih $4.50.
- **Email akun uji:** Polar memeriksa apakah domain email bisa menerima email. `@example.test` dan `@example.com` ditolak (checkout gagal 422); pakai domain sungguhan (uji ini: `polar-sandbox@rezumi.app`, email Polar ke sana tidak terkirim karena domain tanpa kotak masuk).
- **Diperbaiki dari temuan uji:**
  1. Order ganti paket hanya datang lewat webhook, jadi tanpa webhook kredit upgrade tidak pernah masuk. Sekarang `changePlan` langsung membaca dan menerapkan order itu, dan job memeriksa langganan Pro AI lunas yang belum punya kredit.
  2. Pindah bulanan → tahunan di tengah bulan memberi 200 kredit (100 lama masih berlaku + 100 bulan pertama tahunan). Sekarang satu bulan kredit pada satu waktu.
  3. Riwayat pembayaran pelanggan tidak lagi menampilkan percobaan yang tidak pernah sampai ke Polar sebagai "Failed".
  4. Polar menambahkan token sesi portal ke URL halaman kembali; query itu kini langsung dihapus dari alamat browser.
  5. Copy untuk ganti periode saja ("Yearly billing starts now", "You're now billed yearly") dan riwayat admin yang lebih jelas (batal/lanjut, ganti periode, ganti terjadwal).
- **Belum diuji:** pengiriman webhook asli dari Polar (butuh alamat publik dan secret webhook). Lakukan di staging pada Phase 11: buat endpoint sandbox ke staging, pemilik menyalin secret-nya ke secret Worker, lalu ulangi satu pembelian dan satu refund.

### Masa coba Plus dan pajak di atas harga (2026-11-05, diuji di sandbox)

- **Cara kerja:** checkout langganan Plus pertama sebuah akun mengirim `allow_trial: true, trial_interval: day, trial_interval_count: 7` (`PLANS.plus.trialDays`); akun yang pernah berlangganan atau pernah membayar mendapat `allow_trial: false`. Polar membuat langganan `trialing` dan **pesanan $0 lunas** (`subscription_create`, periode = masa coba); Rezumi mencatatnya dengan `billing_payment.trial_days = 7` dan menampilkannya sebagai "Free trial" (tanpa invoice), bukan penjualan. Akhir masa coba = tagihan `subscription_cycle` biasa (masa tenggang 6 jam seperti perpanjangan).
- **Celah yang ditemukan dan ditutup:** ganti paket di tengah masa coba (ke Pro AI, atau ke tahunan) membuat Polar mengakhiri masa coba dan memulai periode baru **tanpa tagihan** (diuji: 2 menit, tetap tidak ada order). Rezumi sekarang mengakhiri masa coba dulu (`trial_end: "now"`, Polar menagih bulan pertama paket sekarang) lalu mengganti paket dengan selisih ditagih. Diuji: $4.99 + $0.55 lalu $5.00 + $0.55. Karena celah ini juga ada di portal pelanggan Polar, **matikan "plan changes" di portal** sebelum go-live.
- **Pajak:** harga sandbox diset Exclusive per harga; checkout Indonesia menunjukkan "Subtotal $4.99, Taxes $0.55, Monthly $5.54". Produksi: set "Default tax behavior: Exclusive" di pengaturan organisasi (lihat Tugasmu).
- **Laporan admin:** masa coba tidak dihitung sebagai penjualan atau MRR; ada hitungan "in a free trial" dan "Free trials started", juga di ringkasan harian.

- **Keputusan pemilik (2026-11-05):** upgrade Plus → Pro AI di akhir periode tetap memberi **100 kredit penuh** untuk harga selisih yang kecil (mis. ±$0.17 bila sisa 1 hari), berlaku sampai akhir periode itu; tidak diprorata. Ditinjau lagi bila laporan admin menunjukkan penyalahgunaan (log keputusan di [00-keputusan-produk.md](00-keputusan-produk.md)).
