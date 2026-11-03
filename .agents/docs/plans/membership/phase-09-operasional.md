# Phase 09 — Operasional: admin, peringatan, laporan, runbook

| Dikerjakan | Ukuran | Bergantung pada | Perlu dari pemilik                                  |
| ---------- | ------ | --------------- | --------------------------------------------------- |
| Claude     | Besar  | Phase 06        | Alamat email pemilik untuk peringatan dan ringkasan |

## Untuk pemilik

**Apa yang dibuat:** alat kerja harianmu setelah mulai berjualan:

1. **Halaman admin** di web (hanya akun admin): cari pelanggan berdasarkan email atau nomor pesanan, lihat pembayaran, masa aktif, dan kredit; cek ulang status ke Midtrans; beri atau cabut masa aktif; koreksi kredit; catat refund; kirim ulang bukti bayar. Setiap tindakan wajib diberi alasan dan tercatat.
2. **Angka bisnis sederhana**: pendaftar, checkout dimulai, pembayaran berhasil, pendapatan, refund, kredit terpakai, perkiraan biaya AI.
3. **Email peringatan** bila ada yang janggal (nominal tidak cocok, pembayaran berhasil tapi aktivasi gagal, notifikasi Midtrans ditolak berulang) dan **ringkasan harian**.
4. **Email pengingat ke pelanggan** 3 hari sebelum masa aktif habis.
5. **Ekspor CSV** pembayaran per periode untuk pembukuan dan pajak.
6. **Runbook**: panduan langkah demi langkah berbahasa awam untuk masalah yang paling mungkin terjadi.

**Siapkan:** email tujuan peringatan (boleh email pribadimu).

**Prompt:** `Kerjakan Phase 09 dari .agents/docs/plans/membership/README.md`

**Yang bisa kamu cek di akhir:** buka halaman admin di lokal, cari akun uji, lihat riwayatnya, lakukan "cek ulang status" pada pembayaran sandbox, dan baca runbook.

## Untuk agent

### Langkah

1. **Prosedur admin** — `packages/api/src/features/billing/admin.ts` (lanjutan dari Phase 01/04): `admin.search({ query })` (email, `provider_order_id`, id pembayaran), `admin.customer({ userId })` (masa aktif, kredit, pembayaran, event terbaru), `admin.syncPayment({ paymentId })`, `admin.refund({ paymentId, amount?, reason })`, `admin.recordManualRefund({ paymentId, amount, reason })`, `admin.resendReceipt({ paymentId })`, `admin.metrics({ from, to })`, `admin.exportPayments({ from, to })` (CSV). Semua: `role === "admin"`, sesi web saja, alasan wajib untuk tindakan yang mengubah data, audit log.
2. **Refund lewat API** — `admin.refund` memanggil `POST {api}/v2/{order_id}/refund` dengan `refund_key` deterministik (`RF-<paymentId>-<urutan>`, disimpan **sebelum** request), `amount` (kosong = penuh), dan `reason`. Metode yang bisa di-refund menurut dokumen (diperiksa 2026-11-02): QRIS, GoPay, ShopeePay, DANA, OVO, kartu, Kredivo, Akulaku. **VA dan gerai tidak bisa** → tombol API disembunyikan; admin mentransfer manual lalu memakai `recordManualRefund`. Tampilkan batas waktu refund per metode (mis. QRIS lintas penerbit hanya ±7 hari, refund ShopeePay hanya diterima 06.00–23.50 WIB, saldo Midtrans harus cukup) dan ingatkan bahwa fitur refund mungkin perlu diaktifkan oleh support Midtrans. Kunci baris pembayaran agar dua klik tidak menjadi dua refund; total refund tidak boleh melebihi `amount`.
3. **Kebijakan refund** — refund penuh mencabut potongan masa aktif milik pembayaran itu (algoritme pencabutan di `01-arsitektur.md` 6.6) dan sisa kredit dari grant pembayaran itu; refund sebagian hanya dicatat (`refunded_amount`, status `partially_refunded`) tanpa mencabut otomatis, kecuali admin memilih mencabut. Notifikasi `refund`/`partial_refund` dari Midtrans (Phase 06) memakai fungsi yang sama dan idempoten terhadap `refund_key`, sehingga refund yang sama tidak diproses dua kali.
4. **UI admin web** — rute `apps/web/src/routes/dashboard/admin/billing*.tsx`, tidak tampil di menu untuk non-admin, server tetap menolak non-admin. Tanpa versi mobile (alat internal; catat ini sebagai bukan pelanggaran parity).
5. **Peringatan** — env `BILLING_ALERT_EMAIL` (aturan "New env var"). Kirim lewat `packages/email` saat: `amount_mismatch`; pembayaran `paid` tetapi fulfillment gagal; ≥5 `rejected_signature` dalam 1 jam; pembayaran yang menurut Midtrans `settlement` tetapi lokal belum `paid` setelah rekonsiliasi; error Midtrans API beruntun. Batasi satu email per jenis per jam; simpan jejak pengiriman di tabel kecil `billing_alert` atau di audit log.
6. **Ringkasan harian** — sekitar 08.00 WIB lewat `runBillingJobs` (cek jam, idempoten per tanggal): penjualan kemarin, pending yang menggantung, refund, peringatan.
7. **Pengingat pelanggan** — email H-3 sebelum `ends_at` potongan terakhir (bukan tiap potongan bila potongan berikutnya sudah antre). Catat pengiriman agar tidak dobel (`billing_notification_sent` atau kolom penanda). Bahasa mengikuti preferensi akun; isi: kapan berakhir, apa yang tetap bisa dipakai di Gratis, tautan ke halaman Paket. Tanpa trik urgensi.
8. **Ekspor data akun** — pastikan ekspor data pengguna yang sudah ada menyertakan riwayat pembayaran dan kredit miliknya.
9. **Runbook** — buat `.agents/docs/plans/membership/runbook-pemilik.md` berbahasa awam, setiap skenario berisi: tanda-tanda, cek apa, langkah, kapan menghubungi Midtrans, dan prompt Claude yang bisa dipakai. Skenario minimum:
   - Pelanggan sudah bayar tetapi paket belum aktif.
   - Pelanggan membayar dua kali.
   - Permintaan refund (metode yang bisa refund lewat dashboard Midtrans vs transfer manual untuk VA).
   - Banyak pembayaran menggantung / notifikasi Midtrans tidak masuk.
   - Mengubah harga atau isi paket.
   - Mematikan/menyalakan metode pembayaran di dashboard Midtrans.
   - Menghentikan penjualan sementara (`BILLING_CHECKOUT_PAUSED`, Phase 06) tanpa membuka semua fitur untuk semua orang.
   - Server key Midtrans bocor: rotasi kunci dan perbarui secret.
   - Pelanggan minta hapus akun saat masa aktif masih berjalan.
   - Rekap bulanan untuk pembukuan/pajak.

### Tes dan verifikasi

- Non-admin ditolak di semua prosedur admin (tes).
- Refund penuh mencabut masa aktif dan sisa kredit tepat sekali, baik lewat admin maupun notifikasi.
- Peringatan dan ringkasan tidak terkirim dobel saat job berjalan ganda.
- CSV tidak memuat data pribadi selain yang perlu untuk pembukuan.
- Verifikasi UI admin di browser pane (screenshot).

### Selesai bila

- Admin, metrik, peringatan, ringkasan, pengingat, ekspor CSV, dan runbook tersedia dan teruji; README diperbarui.

### Catatan implementasi (2026-11-03)

- Refund memakai satu endpoint `POST /v2/{order_id}/refund` untuk semua metode (dokumen Midtrans 2026-11-03 menyarankan ini; Direct Refund tidak dipakai). Detail alur, kunci, dan pemetaan error: `01-arsitektur.md` 6.11.
- Jejak peringatan, ringkasan, dan pengingat disimpan di satu tabel `billing_notification` (bukan `billing_alert` + `billing_notification_sent`); refund di `billing_refund`. Bahasa pengingat dari `billing_account.locale` yang diisi saat checkout.
- "Error Midtrans API beruntun" = ≥3 kejadian dalam satu jam (Snap gagal, putaran rekonsiliasi yang semuanya gagal, error Midtrans saat memproses notifikasi). "≥5 `rejected_signature` dalam 1 jam" dihitung per jam UTC.
- Aktivasi "PDF pertama dalam 7 hari" dari `00-keputusan-produk.md` bagian 9 belum bisa dihitung: unduhan PDF dibuat di browser dan tidak tercatat di server. Perlu pencatatan baru bila angka ini dibutuhkan.
- **Paritas web–mobile:** halaman admin adalah alat internal pemilik, bukan fitur pengguna, jadi tidak dibuat di mobile (sudah diputuskan di `01-arsitektur.md` bagian 2). Ekspor data akun di mobile otomatis memuat `billing` karena app menyimpan JSON server apa adanya.
- Panduan `docs/`: baris `billing.json` untuk "Exporting your data" dan bagian pengingat disimpan di [draf-panduan-paket-pembayaran.md](draf-panduan-paket-pembayaran.md) sampai go-live.
