# Runbook pemilik: menangani masalah pembayaran (Dodo Payments)

Panduan ini untuk kamu (pemilik), bukan untuk programmer. Rezumi menjual **langganan bulanan/tahunan lewat Dodo Payments** (sejak 2026-11-10; sebelumnya Polar). Dodo Payments adalah penjual resmi (_Merchant of Record_): Dodo menagih pelanggan, menghitung dan menyetor pajak, mengirim invoice dan email tagihan, menangani sengketa kartu, lalu membayarkan hasil penjualan ke rekeningmu. Setiap bagian menjawab: **tanda-tandanya**, **apa yang dicek**, **langkahnya**, dan **prompt Claude** bila ingin dibantu.

## Alat yang dipakai

| Alat                        | Di mana                                                                                         | Untuk apa                                                                                                                                                        |
| --------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Halaman admin**           | `https://rezumi.app/dashboard/admin/billing` (akun admin; menu akun → **Admin billing**)        | Cari pelanggan (email, id pembayaran/checkout/langganan/pelanggan Dodo, id Rezumi), lihat langganan/kredit/pembayaran/riwayat, **Cek ulang status**, refund, CSV |
| **Dashboard Dodo Payments** | `https://app.dodopayments.com` (saklar **Live Mode** di sidebar: nyala = sungguhan, mati = uji) | Pembayaran, langganan, pelanggan, refund, sengketa (Disputes), webhook (Developer → Webhooks: log + kirim ulang), produk, kode diskon, payout                    |
| **Dashboard Cloudflare**    | `https://dash.cloudflare.com` → Workers & Pages → `vitaekit` → Settings → Variables and Secrets | Saklar (`BILLING_CHECKOUT_PAUSED`, `BILLING_MODE`) dan secret (`DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_KEY`, email peringatan)                           |
| **Email peringatan**        | Alamat di `BILLING_ALERT_EMAIL`                                                                 | Peringatan bila ada yang janggal (maksimal satu email per jenis per jam) dan ringkasan harian sekitar 08.00 WIB                                                  |

Setiap tindakan di halaman admin yang mengubah data **wajib diberi alasan** dan tercatat di riwayat pelanggan. Halaman admin tidak ada di aplikasi mobile; buka dari browser.

Pelanggan menerima email dari **Dodo Payments** (bukti bayar, invoice, pengingat akhir masa coba, perpanjangan, kartu gagal, pembatalan; nyalakan email yang bawaannya mati, lihat [phase-13-dodo.md](phase-13-dodo.md)). Rezumi tidak mengirim bukti bayar sendiri. Pelanggan bisa membuka **Tagihan dan invoice** di halaman Paket untuk mengganti kartu, mengunduh invoice, atau membatalkan.

### Arti email peringatan

| Judul email                                     | Artinya                                                                                   | Lihat bagian |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------ |
| Pelanggan sudah bayar, tetapi paket belum aktif | Dodo bilang pembayaran berhasil, tetapi Rezumi belum menerapkannya (atau akunnya dihapus) | 1            |
| Uang pembayaran ditarik kembali                 | Ada sengketa kartu (dibuka, atau kalah)                                                   | 6            |
| Kejadian pembayaran perlu dicek manual          | Ada webhook yang tidak bisa diproses otomatis                                             | 8            |
| Banyak webhook Dodo Payments ditolak            | Secret webhook di server tidak cocok dengan di Dodo                                       | 9            |
| API Dodo Payments gagal berulang kali           | API key dicabut atau dari mode yang salah, atau Dodo sedang gangguan                      | 9            |
| Refund belum berhasil                           | Dodo menolak refund, masih meninjaunya, atau tidak pernah mengonfirmasinya                | 3            |

## 1. Pelanggan sudah bayar tetapi paket belum aktif

**Tanda-tanda:** pelanggan mengirim email/screenshot bukti bayar Dodo Payments, atau ada email peringatan.

**Cek:**

1. Halaman admin → cari email pelanggan → bagian **Pembayaran** dan **Langganan**.
2. Di dashboard Dodo (Live Mode nyala) → **Payments**: cari email pelanggan. Statusnya harus **Succeeded**.

**Langkah:**

1. Di halaman admin, buka menu ⋯ di baris pembayarannya → **Cek ulang status**. Biasanya paket langsung aktif.
2. Bila pembayarannya belum ada di halaman admin sama sekali: cari id pembayaran Dodo (`pay_…`) di kotak pencarian halaman admin. Bila tetap tidak ada, buka Dodo **Developer → Webhooks → endpoint → Logs**, cari event `payment.succeeded` untuk pembayaran itu, lalu **Replay**. Rezumi memproses ulang dengan aman (tidak dobel).
3. Masih belum aktif: beri paket manual lewat **Beri paket** (pilih paket dan jumlah hari, isi alasan), lalu minta Claude memeriksa.
4. Bila akun pelanggan sudah dihapus sebelum membayar: refund pembayaran itu dari dashboard Dodo.

**Prompt:** `Pelanggan <email> sudah bayar di Dodo Payments tapi paket belum aktif. Ikuti runbook-pemilik.md bagian 1 dan cek datanya.`

## 2. Pelanggan membayar dua kali

Rezumi menolak checkout baru selama langganan akun masih hidup (termasuk yang "on hold"), jadi ini jarang. Bila terjadi (misalnya dua checkout dibuka bersamaan): refund pembayaran yang dobel dari halaman admin dengan centang **Sekaligus hentikan langganan sekarang**, atau dari dashboard Dodo (Payments → Refund, lalu Subscriptions → Cancel). Lalu tekan **Cek ulang status** di halaman admin untuk kedua pembayaran.

## 3. Permintaan refund

**Kebijakan** (lihat Kebijakan Pengembalian Dana): tagihan pertama boleh refund penuh dalam 7 hari bila kredit Rezumi AI dari tagihan itu terpakai maksimal 10; pembayaran ganda dan masalah teknis selalu ditangani.

**Langkah:**

1. Halaman admin → pelanggan → menu ⋯ di pembayaran → **Refund lewat Dodo Payments**.
2. Kosongkan jumlah untuk refund penuh (Dodo ikut mengembalikan pajaknya), atau isi jumlah **sebelum pajak** untuk refund sebagian (Dodo menambahkan pajak atas jumlah itu).
3. Centang **Sekaligus hentikan langganan sekarang** bila pelanggan tidak ingin melanjutkan (akses langsung berhenti). Tanpa centang, langganan tetap berjalan dan diperpanjang.
4. Isi alasan → kirim. Status refund menjadi **Selesai** dalam beberapa detik, atau **Menunggu Dodo Payments** bila Dodo masih memproses/meninjau; dana sampai ke kartu pelanggan dalam beberapa hari kerja (tergantung bank).

**Bila Dodo menolak dengan "insufficient funds in wallet":** Dodo membayar refund dari **saldo wallet-mu**, bukan dari pembayaran aslinya. Saldo dari satu pembayaran selalu lebih kecil dari yang dibayar pelanggan (sudah dipotong fee), jadi saat penjualan masih sedikit atau tepat setelah payout, refund penuh bisa ditolak. Di halaman admin refund tercatat **Ditolak** dan email peringatan "Refund belum berhasil" terkirim; tidak ada uang yang bergerak dan langganan tidak dihentikan. Langkahnya:

1. Kirim email dari email terdaftar di Dodo ke `support@dodopayments.com`: minta refund penuh, sebutkan id pembayaran (`pay_…`, ada di halaman admin) dan bahwa refund gagal karena saldo wallet kurang.
2. Bila pelanggan juga ingin berhenti: halaman admin tidak bisa menghentikan langganan tanpa refund, jadi minta pelanggan menekan **Batalkan langganan** di halaman Paket, atau batalkan di dashboard Dodo (Subscriptions → Cancel).
3. Setelah Dodo memprosesnya, refund tercatat otomatis lewat webhook (kredit ikut ditarik). Bila belum muncul, tekan **Cek ulang status** di pembayarannya.
4. Atau tunggu saldo cukup dari penjualan berikutnya (Payouts → Balances), lalu ulangi refund dari halaman admin. Jangan lewat dari batas waktu refund.

**Catatan:** fee Dodo tidak dikembalikan ke kamu, dan Dodo menarik $1 per refund. Refund penuh otomatis menarik sisa kredit dari pembayaran itu. Bila status "Menunggu Dodo Payments" lebih dari 1 jam, tekan **Cek ulang status**; Rezumi menandainya gagal bila Dodo tidak pernah menerimanya. Refund yang kamu buat langsung di dashboard Dodo juga tercatat otomatis di halaman admin.

## 4. Pelanggan ingin berhenti (batal langganan)

Pelanggan bisa melakukannya sendiri: halaman **Paket → Batalkan langganan**, atau dari portal Dodo (portal hanya menawarkan batal di akhir periode; batal seketika sengaja dimatikan). Akses tetap sampai akhir periode yang sudah dibayar, dan tidak ada tagihan lagi. Tidak ada refund otomatis untuk sisa periode (kecuali kebijakan refund di bagian 3 berlaku). Bila pelanggan berubah pikiran sebelum periode habis: **Lanjutkan langganan** di halaman Paket.

## 5. Kartu pelanggan gagal saat perpanjangan

**Tanda-tanda:** halaman Paket pelanggan menulis "Pembayaran terakhir gagal"; di halaman admin langganan berstatus **Pembayaran gagal** (`on_hold` atau `past_due`).

Dodo mengirim email ke pelanggan ("Subscription Renewal Failed", lalu rangkaian email **dunning** selama langganan on hold) dan mencoba menagih lagi sampai 5 kali dalam ±10 hari (**Payment retries**). Selama itu akses berbayar **dijeda** (dokumen tetap bisa diedit; batas Gratis berlaku untuk dokumen baru). Begitu pelanggan memperbarui kartu lewat **Tagihan dan invoice**, Dodo menagih ulang dan akses kembali otomatis.

## 6. Sengketa kartu (dispute / chargeback)

**Tanda-tanda:** email peringatan "Uang pembayaran ditarik kembali"; di Dodo **Disputes** ada kasus baru.

1. **Sengketa dibuka:** kumpulkan bukti (riwayat pemakaian dari halaman admin, email dengan pelanggan, S&K dan kebijakan refund) dan kirim lewat dashboard Dodo → **Disputes** dalam ±10 hari. Rezumi belum mengubah apa pun.
2. **Sengketa kalah atau diterima:** Rezumi otomatis menandai pembayaran **Dibatalkan bank**, menarik kreditnya, dan menghentikan langganannya. Tidak ada langkah wajib.
3. Bila sengketa sering terjadi, Dodo bisa membatasi akun: balas email Dodo secepatnya.

## 7. Mengubah harga atau isi paket

1. Ubah harga di **dua tempat**: produk di dashboard Dodo (harga USD dan harga lokal IDR per produk; "tax inclusive" tetap mati) **dan** katalog Rezumi (`@rezumi/schema/billing`, lewat Claude). Langganan yang sudah berjalan tetap di harga lama (Dodo tidak memindahkannya).
2. **Prompt:** `Ubah harga Plus bulanan menjadi $5.99 dan Rp69.000 mengikuti katalog di .agents/docs/plans/membership; jelaskan juga apa yang harus saya ubah di dashboard Dodo Payments.`

## 8. Kejadian perlu dicek manual / webhook gagal

1. Halaman admin → pelanggan terkait → **Cek ulang status** di pembayarannya.
2. Di Dodo **Developer → Webhooks → endpoint**: lihat **Logs/Activity**. Perbaiki penyebabnya dulu (lihat bagian 9), lalu **Replay** pesan yang gagal (bisa sekaligus lewat **Bulk replay**). Dodo tidak punya email peringatan per endpoint; peringatan datang dari Rezumi (`BILLING_ALERT_EMAIL`) dan angka **Error rate** di daftar endpoint.
3. Selama webhook gagal, Rezumi tetap menyusul lewat pengecekan berkala tiap menit, hanya lebih lambat.

**Prompt:** `Ada peringatan "Kejadian pembayaran perlu dicek manual". Ikuti runbook-pemilik.md bagian 8.`

## 9. API key atau secret webhook bocor / perlu diganti

1. **Secret webhook:** Dodo → Developer → Webhooks → endpoint → rotate signing secret. Lalu di terminal: `pnpm exec wrangler secret put DODO_PAYMENTS_WEBHOOK_KEY` dan tempel secret baru (jangan di chat). Webhook yang ditolak selama jeda akan diulang Dodo, atau replay dari Logs.
2. **API key:** Dodo → Developer → API Keys → buat key baru di mode yang sama (Live Mode nyala untuk produksi), pasang dengan `pnpm exec wrangler secret put DODO_PAYMENTS_API_KEY`, lalu hapus key lama.
3. Cek: halaman Paket bisa membuka checkout, dan tidak ada email peringatan baru.

## 10. Pelanggan hapus akun saat masih berlangganan

Menghapus akun **langsung menghentikan langganan** di Dodo (tanpa refund otomatis); Dodo tetap menyimpan catatan transaksinya untuk pembukuan sebagai penjual. Bila pelanggan meminta refund setelahnya, lakukan dari dashboard Dodo (akun Rezumi-nya sudah tidak ada).

## 11. Menghentikan penjualan sementara

Set `BILLING_CHECKOUT_PAUSED=true` di Cloudflare (Variables and Secrets) lalu deploy ulang/simpan. Checkout baru ditutup; langganan yang berjalan tetap diperpanjang oleh Dodo. Untuk menghentikan perpanjangan juga, minta Claude membantu (langganan berjalan sampai dibatalkan satu per satu).

## 12. Rekap bulanan untuk pembukuan/pajak

1. Halaman admin → pilih periode → **Unduh CSV**: satu baris per pembayaran dan refund, per mata uang, jumlah **sebelum pajak**, pajak, dan total yang dibayar pelanggan.
2. Dashboard Dodo → **Balances / Payouts**: saldo, fee Dodo, dan **payout** ke rekeningmu. Pembayaran Rupiah dicatat Dodo dalam USD: "Gross" sudah dipotong biaya kurs ±4%, "Net" sudah dipotong fee transaksi. Payout standar gratis; $5 bila payout di bawah $1.000; payout USD lewat SWIFT untuk bisnis non-AS dikenai $25.
3. ⚖️ Penghasilanmu adalah payout dari Dodo, bukan total yang dibayar pelanggan. Konsultasikan pencatatan PPh dengan konsultan pajak.

## Lain-lain

- **Memberi paket atau kredit sebagai kompensasi:** halaman admin → **Beri paket** (hari) atau **Sesuaikan kredit**. Paket yang diberikan berjalan di samping langganan; yang berlaku adalah yang lebih tinggi.
- **Mencabut paket yang diberikan:** halaman admin → **Masa aktif yang diberikan** → Cabut. Untuk menghentikan langganan, refund dengan centang "hentikan langganan", atau Cancel di dashboard Dodo (Subscriptions).
- **Kode diskon / promo:** dashboard Dodo → Discounts. Pembeli mengetik kodenya di checkout. Untuk review Dodo atau uji produksi, kode 100% satu kali pakai.
- **Email peringatan tidak sampai:** cek `BILLING_ALERT_EMAIL` dan pengaturan email server; peringatan tetap terlihat di halaman admin.
- **Pengingat ke pelanggan:** Rezumi hanya mengirim pengingat H-3 untuk paket yang diberikan admin/promo. Pengingat akhir masa coba dan perpanjangan dikirim Dodo.
