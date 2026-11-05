# Runbook pemilik: menangani masalah pembayaran (Polar)

Panduan ini untuk kamu (pemilik), bukan untuk programmer. Sejak 2026-11-05 Rezumi menjual **langganan bulanan/tahunan lewat Polar**. Polar adalah penjual resmi (_Merchant of Record_): Polar menagih pelanggan, menghitung dan menyetor pajak, mengirim invoice dan email tagihan, menangani sengketa kartu, lalu membayarkan hasil penjualan ke rekeningmu. Setiap bagian menjawab: **tanda-tandanya**, **apa yang dicek**, **langkahnya**, dan **prompt Claude** bila ingin dibantu.

## Alat yang dipakai

| Alat                     | Di mana                                                                                         | Untuk apa                                                                                                                                              |
| ------------------------ | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Halaman admin**        | `https://rezumi.app/dashboard/admin/billing` (akun admin; menu akun → **Admin billing**)        | Cari pelanggan (email, id order/checkout/langganan Polar, id pembayaran), lihat langganan/kredit/pembayaran/riwayat, **Cek ulang status**, refund, CSV |
| **Dashboard Polar**      | `https://polar.sh` (produksi, organisasi **Rezumi**) / `https://sandbox.polar.sh` (uji)         | Order, langganan, pelanggan, refund, webhook (riwayat kirim + kirim ulang), produk dan harga, payout, metrik                                           |
| **Dashboard Cloudflare** | `https://dash.cloudflare.com` → Workers & Pages → `vitaekit` → Settings → Variables and Secrets | Saklar (`BILLING_CHECKOUT_PAUSED`, `BILLING_MODE`) dan secret (`POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`, email peringatan)                         |
| **Email peringatan**     | Alamat di `BILLING_ALERT_EMAIL`                                                                 | Peringatan bila ada yang janggal (maksimal satu email per jenis per jam) dan ringkasan harian sekitar 08.00 WIB                                        |

Setiap tindakan di halaman admin yang mengubah data **wajib diberi alasan** dan tercatat di riwayat pelanggan. Halaman admin tidak ada di aplikasi mobile; buka dari browser.

Pelanggan menerima email dari **Polar** (bukti bayar/receipt, invoice, perpanjangan, kartu gagal, pembatalan). Rezumi tidak mengirim bukti bayar sendiri. Pelanggan bisa membuka **Tagihan dan invoice** di halaman Paket untuk mengganti kartu, mengunduh invoice, atau membatalkan.

### Arti email peringatan

| Judul email                                     | Artinya                                                                            | Lihat bagian |
| ----------------------------------------------- | ---------------------------------------------------------------------------------- | ------------ |
| Pelanggan sudah bayar, tetapi paket belum aktif | Polar bilang lunas, tetapi Rezumi belum menerapkannya (atau akunnya sudah dihapus) | 1            |
| Uang pembayaran ditarik kembali                 | Polar me-refund sebuah order untuk mencegah sengketa kartu, atau ada sengketa      | 6            |
| Kejadian pembayaran perlu dicek manual          | Ada webhook yang tidak bisa diproses otomatis                                      | 8            |
| Banyak webhook Polar ditolak                    | Secret webhook di server tidak cocok dengan di Polar                               | 9            |
| API Polar gagal berulang kali                   | Token akses dicabut/kedaluwarsa, atau Polar sedang gangguan                        | 9            |
| Refund belum berhasil                           | Polar menolak refund, atau tidak pernah mengonfirmasinya                           | 3            |

## 1. Pelanggan sudah bayar tetapi paket belum aktif

**Tanda-tanda:** pelanggan mengirim email/screenshot receipt Polar, atau ada email peringatan.

**Cek:**

1. Halaman admin → cari email pelanggan → bagian **Pembayaran** dan **Langganan**.
2. Di dashboard Polar → **Sales → Orders**: cari email pelanggan. Status order harus **Paid**.

**Langkah:**

1. Di halaman admin, buka menu ⋯ di baris pembayarannya → **Cek ulang status**. Biasanya paket langsung aktif.
2. Bila pembayarannya belum ada di halaman admin sama sekali: di Polar buka **Settings → Webhooks → Deliveries**, cari event `order.paid` untuk order itu, lalu **Redeliver**. Rezumi memproses ulang dengan aman (tidak dobel).
3. Masih belum aktif: beri paket manual lewat **Beri paket** (pilih paket dan jumlah hari, isi alasan), lalu minta Claude memeriksa.
4. Bila akun pelanggan sudah dihapus sebelum membayar: refund order itu dari dashboard Polar.

**Prompt:** `Pelanggan <email> sudah bayar di Polar tapi paket belum aktif. Ikuti runbook-pemilik.md bagian 1 dan cek datanya.`

## 2. Pelanggan membayar dua kali

Polar hanya mengizinkan **satu langganan aktif per pelanggan**, dan Rezumi menolak checkout baru selama langganan masih hidup, jadi ini jarang. Bila terjadi (misalnya dua checkout dibuka bersamaan): di dashboard Polar, refund order yang dobel dan batalkan langganan keduanya (**Subscriptions → … → Revoke**). Di halaman admin, tekan **Cek ulang status** untuk kedua pembayaran.

## 3. Permintaan refund

**Kebijakan** (lihat Kebijakan Pengembalian Dana): pembelian pertama boleh refund penuh dalam 7 hari bila kredit Rezumi AI dari pembelian itu terpakai maksimal 10; pembayaran ganda dan masalah teknis selalu ditangani.

**Langkah:**

1. Halaman admin → pelanggan → menu ⋯ di pembayaran → **Refund lewat Polar**.
2. Kosongkan jumlah untuk refund penuh, atau isi jumlah **sebelum pajak** (Polar mengembalikan pajaknya sendiri).
3. Centang **Sekaligus hentikan langganan sekarang** bila pelanggan tidak ingin melanjutkan (akses langsung berhenti). Tanpa centang, langganan tetap berjalan dan diperpanjang.
4. Isi alasan → kirim. Status refund menjadi **Selesai** dalam beberapa detik; kartu pelanggan menerima dana dalam beberapa hari kerja (tergantung bank).

**Catatan:** fee Polar tidak dikembalikan ke kamu. Refund penuh otomatis menarik sisa kredit dari pembayaran itu. Bila status "Menunggu Polar" lebih dari 1 jam, tekan **Cek ulang status**; Rezumi menandainya gagal bila Polar tidak pernah menerimanya.

## 4. Pelanggan ingin berhenti (batal langganan)

Pelanggan bisa melakukannya sendiri: halaman **Paket → Batalkan langganan**, atau dari portal Polar. Akses tetap sampai akhir periode yang sudah dibayar, dan tidak ada tagihan lagi. Tidak ada refund otomatis untuk sisa periode (kecuali kebijakan refund di bagian 3 berlaku). Bila pelanggan berubah pikiran sebelum periode habis: **Lanjutkan langganan** di halaman Paket.

## 5. Kartu pelanggan gagal saat perpanjangan

**Tanda-tanda:** halaman Paket pelanggan menulis "Pembayaran terakhir gagal"; di halaman admin langganan berstatus **Pembayaran gagal** (`past_due`).

Polar otomatis mengirim email ke pelanggan dan mencoba lagi (sekitar hari ke-2, 7, 14, 21). Selama itu akses berbayar **dijeda** (dokumen tetap bisa diedit; batas Gratis berlaku untuk dokumen baru). Begitu pelanggan memperbarui kartu lewat **Tagihan dan invoice**, Polar menagih ulang dan akses kembali otomatis. Setelah percobaan terakhir gagal, Polar menghentikan langganan.

## 6. Polar me-refund untuk mencegah sengketa, atau ada sengketa kartu

Polar boleh me-refund sendiri sampai 60 hari setelah pembelian bila melihat tanda-tanda sengketa (biaya sengketa $15 per kasus, tetap dibayar walau menang). Saat itu Polar juga membatalkan langganannya. Rezumi mencatat refundnya, menarik kredit, dan mengirim email peringatan. Tidak ada langkah wajib; cek riwayatnya di dashboard Polar. Bila sengketa sering terjadi (ambang Polar ±0,4%), Polar bisa membekukan akun: balas email Polar dalam 48 jam.

## 7. Mengubah harga atau isi paket

1. Ubah harga di **dua tempat**: produk di dashboard Polar (harga USD dan IDR per produk) **dan** katalog Rezumi (`@rezumi/schema/billing`, lewat Claude). Langganan yang sudah berjalan tetap di harga lama (Polar mempertahankannya).
2. **Prompt:** `Ubah harga Plus bulanan menjadi $5.99 dan Rp69.000 mengikuti katalog di .agents/docs/plans/membership; jelaskan juga apa yang harus saya ubah di dashboard Polar.`

## 8. Kejadian perlu dicek manual / webhook endpoint dinonaktifkan

1. Halaman admin → pelanggan terkait → **Cek ulang status** di pembayarannya.
2. Di Polar **Settings → Webhooks**: bila endpoint berlabel **Disabled** (Polar menonaktifkan setelah 10 kegagalan berturut-turut dan mengirim email), perbaiki penyebabnya dulu (lihat bagian 9), lalu **Enable** dan kirim ulang event yang gagal dari tab **Deliveries**.
3. Selama webhook mati, Rezumi tetap menyusul lewat pengecekan berkala tiap menit, hanya lebih lambat.

**Prompt:** `Ada peringatan "Kejadian pembayaran perlu dicek manual". Ikuti runbook-pemilik.md bagian 8.`

## 9. Token atau secret Polar bocor / perlu diganti

1. **Webhook secret:** Polar → Settings → Webhooks → endpoint → **Reset secret**. Lalu di terminal: `pnpm exec wrangler secret put POLAR_WEBHOOK_SECRET` dan tempel secret baru (jangan di chat). Webhook yang ditolak selama jeda akan diulang Polar.
2. **Access token:** Polar → Settings → General → Developers → buat token baru (scope sama), pasang dengan `pnpm exec wrangler secret put POLAR_ACCESS_TOKEN`, lalu hapus token lama di Polar.
3. Cek: halaman Paket bisa membuka checkout, dan tidak ada email peringatan baru.

## 10. Pelanggan hapus akun saat masih berlangganan

Menghapus akun **langsung menghentikan langganan** (tanpa refund otomatis) dan menganonimkan data pelanggan di Polar; order tetap tersimpan di Polar untuk pembukuan. Bila pelanggan meminta refund setelahnya, lakukan dari dashboard Polar (akun Rezumi-nya sudah tidak ada).

## 11. Menghentikan penjualan sementara

Set `BILLING_CHECKOUT_PAUSED=true` di Cloudflare (Variables and Secrets) lalu deploy ulang/simpan. Checkout baru ditutup; langganan yang berjalan tetap diperpanjang oleh Polar. Untuk menghentikan perpanjangan juga, arsipkan produk di Polar (langganan yang ada tetap berjalan sampai dibatalkan) atau minta Claude membantu.

## 12. Rekap bulanan untuk pembukuan/pajak

1. Halaman admin → pilih periode → **Unduh CSV**: satu baris per order dan refund, per mata uang, jumlah **sebelum pajak**, pajak, dan total yang dibayar pelanggan.
2. Dashboard Polar → **Finance**: saldo, fee Polar, dan **payout** ke rekeningmu (dalam USD, dikonversi Stripe ke Rupiah). Payout manual atau otomatis; ada biaya Stripe $2 per bulan aktif + 0,25% + $0,25 per payout.
3. ⚖️ Penghasilanmu adalah payout dari Polar, bukan total yang dibayar pelanggan. Konsultasikan pencatatan PPh dengan konsultan pajak.

## Lain-lain

- **Memberi paket atau kredit sebagai kompensasi:** halaman admin → **Beri paket** (hari) atau **Sesuaikan kredit**. Paket yang diberikan berjalan di samping langganan; yang berlaku adalah yang lebih tinggi.
- **Mencabut paket yang diberikan:** halaman admin → **Masa aktif yang diberikan** → Cabut. Untuk menghentikan langganan, refund dengan centang "hentikan langganan", atau **Revoke** di dashboard Polar.
- **Email peringatan tidak sampai:** cek `BILLING_ALERT_EMAIL` dan pengaturan email server; peringatan tetap terlihat di halaman admin.
- **Pengingat ke pelanggan:** Rezumi hanya mengirim pengingat H-3 untuk paket yang diberikan admin/promo. Pengingat langganan (mis. 7 hari sebelum perpanjangan tahunan) dikirim Polar.
