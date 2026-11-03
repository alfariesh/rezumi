# Runbook pemilik: menangani masalah pembayaran

Panduan ini untuk kamu (pemilik), bukan untuk programmer. Setiap bagian menjawab lima hal: **tanda-tandanya**, **apa yang dicek**, **langkahnya**, **kapan menghubungi Midtrans**, dan **prompt Claude** yang bisa ditempel bila ingin dibantu.

## Alat yang dipakai

| Alat                     | Di mana                                                                                               | Untuk apa                                                                                                                                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Halaman admin**        | `https://rezumi.app/dashboard/admin/billing` (masuk dengan akun admin; menu akun → **Admin billing**) | Cari pelanggan (email, nomor pesanan `RZ-…`, ID pembayaran, ID transaksi Midtrans), lihat paket/kredit/pembayaran/riwayat, **Cek ulang status**, refund, beri/cabut paket, koreksi kredit, CSV |
| **Dashboard Midtrans**   | `https://dashboard.midtrans.com` (produksi) / `https://dashboard.sandbox.midtrans.com` (uji)          | Melihat transaksi, riwayat notifikasi, mengaktifkan metode, mengganti kunci, saldo dan pencairan                                                                                               |
| **Dashboard Cloudflare** | `https://dash.cloudflare.com` → Workers & Pages → `vitaekit` → Settings → Variables and Secrets       | Mengubah saklar (`BILLING_CHECKOUT_PAUSED`, `BILLING_MODE`) dan secret (kunci Midtrans, email peringatan)                                                                                      |
| **Email peringatan**     | Alamat di `BILLING_ALERT_EMAIL`                                                                       | Peringatan bila ada yang janggal (maksimal satu email per jenis per jam) dan ringkasan harian sekitar 08.00 WIB                                                                                |

Setiap tindakan di halaman admin yang mengubah data **wajib diberi alasan** dan tercatat di riwayat pelanggan bersama namamu. Halaman admin tidak ada di aplikasi mobile; buka dari browser.

Nomor pesanan selalu berbentuk `RZ-` diikuti 36 karakter. Nomor yang sama terlihat di dashboard Midtrans (kolom Order ID), di email bukti bayar pelanggan, dan di halaman admin.

### Arti email peringatan

| Judul email                                     | Artinya                                                                            | Lihat bagian  |
| ----------------------------------------------- | ---------------------------------------------------------------------------------- | ------------- |
| Pelanggan sudah bayar, tetapi paket belum aktif | Midtrans bilang lunas, tetapi aktivasi di Rezumi gagal                             | 1             |
| Nominal pembayaran tidak cocok                  | Jumlah yang dilaporkan Midtrans berbeda dari harga pesanan; paket tidak aktif      | 1             |
| Pembayaran dibatalkan oleh bank                 | Pembayaran yang sudah lunas dibalik bank (chargeback/deny); akses dicabut otomatis | 3             |
| Status pembayaran perlu dicek manual            | Status aneh dari Midtrans (chargeback sebagian, penipuan terdeteksi)               | 3             |
| Banyak notifikasi Midtrans ditolak              | ≥5 notifikasi dengan tanda tangan salah dalam satu jam                             | 4 dan 8       |
| API Midtrans gagal berulang kali                | Membuat halaman bayar atau cek status ke Midtrans gagal beberapa kali              | 4             |
| Bukti bayar gagal terkirim                      | Email bukti bayar tidak sampai setelah 5 kali percobaan                            | 1 (langkah 5) |
| Refund belum berhasil                           | Midtrans menolak refund atau belum mengonfirmasinya                                | 3             |

---

## 1. Pelanggan sudah bayar tetapi paket belum aktif

**Tanda-tanda:** pelanggan mengirim bukti transfer atau tangkapan layar "pembayaran berhasil", tetapi di halaman Paket masih "Gratis"; atau email peringatan "Pelanggan sudah bayar, tetapi paket belum aktif".

**Cek:**

1. Minta nomor pesanan (`RZ-…`) atau email akun pelanggan.
2. Buka halaman admin, tempel nomor/email di kolom cari di atas tabel **Pembayaran** (tekan Enter), lalu buka pelanggannya.
3. Lihat baris pembayarannya: status di Rezumi, dan "Midtrans: …" (status terakhir dari Midtrans).
4. Bandingkan dengan dashboard Midtrans: Transactions → cari Order ID.

**Langkah:**

1. Di tabel Pembayaran pelanggan, buka menu **⋯** di ujung baris, pilih **Cek ulang status**. Rezumi bertanya langsung ke Midtrans. Bila Midtrans bilang `settlement`, paket dan kredit langsung aktif dan bukti bayar terkirim dalam ±1 menit. Ini menyelesaikan hampir semua kasus.
2. Masih belum aktif dan statusnya **"Nominal tidak cocok"**: bandingkan nominal di Midtrans dengan harga pesanan. Bila pelanggan memang membayar penuh (mis. salah input di sisi bank), beri paket manual dengan **Beri paket** (paket yang sama, 30 hari, alasan "Bayar RZ-… nominal tidak cocok, dicek manual") dan, untuk Pro AI, **Sesuaikan kredit** +100 berlaku 30 hari. Bila nominal kurang, tawarkan refund (bagian 3).
3. Midtrans **tidak** menunjukkan pembayaran berhasil (masih pending/expire): pelanggan mungkin belum benar-benar membayar, atau membayar ke nomor VA/QR yang sudah kedaluwarsa. Minta bukti dari aplikasi bank/e-wallet (bukan tangkapan layar halaman Rezumi), lalu lanjut ke "Kapan menghubungi Midtrans".
4. Pelanggan membayar tetapi akunnya sudah dihapus (di halaman admin tertulis "Akun sudah dihapus"): tidak ada yang bisa diaktifkan; tawarkan refund.
5. Paket aktif tetapi pelanggan tidak menerima bukti bayar: buka menu **⋯** di baris pembayarannya, pilih **Kirim ulang bukti bayar**. Bila gagal juga, cek pengaturan email server (lihat bagian "Email tidak terkirim" di bawah) dan kirimkan bukti dari halaman Paket pelanggan (pelanggan bisa membuka sendiri: Paket → Pembayaran → Bukti bayar).

**Kapan menghubungi Midtrans:** pelanggan punya bukti debit dari bank/e-wallet tetapi transaksi di dashboard Midtrans tidak ada atau tidak `settlement` setelah ±1 jam. Kirim ke support Midtrans: Order ID, waktu bayar, metode, nominal, dan bukti dari pelanggan (tanpa data kartu).

**Prompt Claude:**

```text
Ada pelanggan bilang sudah bayar tapi belum aktif. Nomor pesanan RZ-.... Ikuti runbook-pemilik.md bagian 1 di .agents/docs/plans/membership dan bantu saya cek.
```

## 2. Pelanggan membayar dua kali

**Tanda-tanda:** dua pembayaran berhasil berdekatan untuk akun yang sama; pelanggan bertanya kenapa ditagih dua kali.

**Cek:** buka pelanggan di halaman admin. Kedua pembayaran sah dan masing-masing menambah 30 hari (masuk antrean, terlihat di "Masa aktif"). Tidak ada hari yang hilang.

**Langkah:**

1. Jelaskan ke pelanggan bahwa pembayaran kedua menambah masa aktif. Tanyakan apakah ingin tetap dipakai atau dikembalikan.
2. Bila ingin dikembalikan: refund **pembayaran yang kedua** (yang lebih baru) secara penuh mengikuti bagian 3. Refund penuh otomatis mencabut 30 hari dan kredit dari pembayaran itu saja; pembayaran pertama tetap utuh.
3. Kebijakan: pembayaran ganda **selalu** dikembalikan bila diminta (S&K dan Kebijakan Pengembalian Dana).

**Kapan menghubungi Midtrans:** hanya bila refund-nya ditolak (bagian 3).

**Prompt Claude:**

```text
Pelanggan membayar dua kali (RZ-... dan RZ-...). Ikuti runbook-pemilik.md bagian 2 dan 3 di .agents/docs/plans/membership.
```

## 3. Permintaan refund

**Tanda-tanda:** pelanggan meminta uang kembali; atau email "Refund belum berhasil", "Pembayaran dibatalkan oleh bank", "Status pembayaran perlu dicek manual".

**Cek dulu kebijakannya** (Kebijakan Pengembalian Dana): pembelian pertama boleh refund penuh dalam 7 hari bila Rezumi AI yang terpakai dari pembelian itu paling banyak 10 kredit; pembayaran ganda dan kegagalan teknis selalu ditangani. Pemakaian kredit terlihat di halaman admin (Paket dan kredit) dan di riwayat kredit pelanggan.

**Cek metode pembayarannya** di baris pembayaran (QRIS, GoPay, Virtual account, Mandiri Bill, dll.). Di dialog refund tertulis batas waktu metode itu.

| Metode                                                                     | Cara refund                                                                                                                                                               |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| QRIS, GoPay, ShopeePay, DANA, OVO, kartu, Kredivo, Akulaku                 | Menu **⋯** → **Refund lewat Midtrans**. QRIS dari aplikasi lain hanya ±7 hari; GoPay/DANA ±45 hari; ShopeePay dan OVO hanya refund penuh, ShopeePay hanya 06.00–23.50 WIB |
| Virtual account (BCA, BNI, BRI, Permata), Mandiri Bill, Alfamart/Indomaret | **Tidak bisa** lewat Midtrans. Transfer manual ke rekening pelanggan, lalu menu **⋯** → **Catat refund manual**                                                           |

**Langkah (lewat Midtrans):**

1. Buka pelanggan → tabel Pembayaran → menu **⋯** → **Refund lewat Midtrans** (abu-abu bila metodenya tidak bisa).
2. Kosongkan jumlah untuk refund penuh, atau isi jumlah untuk refund sebagian.
3. Refund penuh **selalu** mencabut masa aktif dan sisa kredit dari pembayaran itu. Refund sebagian hanya dicatat; centang "Cabut juga paket dan sisa kredit" bila memang perlu.
4. Tulis alasan (alasan ini juga terkirim ke Midtrans). Tekan Refund.
5. Hasilnya:
   - "sudah di-refund" → selesai. Uang kembali ke pelanggan sesuai waktu proses metode (QRIS/e-wallet biasanya 1×24 jam, kartu 7–14 hari kerja).
   - Status **"Menunggu bank"** (kartu kredit, biasanya) → Midtrans sudah menerima, bank masih memproses (bisa beberapa hari kerja). Tidak perlu apa-apa: Rezumi mengecek sendiri tiap 15 menit dan menandainya selesai begitu bank mengonfirmasi.
   - "Midtrans belum mengonfirmasi" → tunggu beberapa menit lalu pilih **Cek ulang status** di menu **⋯**. Mengulang Refund dengan jumlah yang sama **aman**: kuncinya sama, jadi tidak mungkin terjadi refund ganda.
   - Ditolak → baca alasannya. Penyebab umum: batas waktu lewat (QRIS lintas aplikasi ±7 hari), ShopeePay di luar jam 06.00–23.50 WIB, saldo Midtrans kurang, atau fitur refund belum diaktifkan di akun Midtrans. Bila tidak bisa lewat Midtrans, transfer manual lalu catat (langkah di bawah).

**Langkah (manual, untuk VA/gerai atau bila Midtrans menolak):**

1. Minta nomor rekening/e-wallet pelanggan lewat email (jangan lewat chat publik). Transfer dari rekeningmu.
2. Di halaman admin → pelanggan → menu **⋯** pembayaran itu → **Catat refund manual**: jumlah yang ditransfer dan alasan, misalnya "Transfer BCA 3 Nov 2026, ref 123456".
3. Simpan bukti transfer di arsip pembukuan.

**Dibatalkan bank (reversed) / perlu cek manual:** akses sudah dicabut otomatis untuk pembalikan. Cek detailnya di dashboard Midtrans. Untuk "perlu dicek manual", Rezumi tidak mengubah apa pun; putuskan sendiri (beri paket manual atau biarkan) setelah melihat dashboard Midtrans.

**Kapan menghubungi Midtrans:** refund ditolak dengan alasan yang tidak jelas; saldo cukup tetapi tetap gagal; tombol refund di dashboard Midtrans tidak ada (fitur refund perlu diaktifkan lewat formulir Midtrans "Prosedur Refund / Pengembalian Dana"); refund `pending` lebih dari waktu proses metode.

**Prompt Claude:**

```text
Pelanggan minta refund untuk RZ-.... Ikuti runbook-pemilik.md bagian 3 di .agents/docs/plans/membership: cek kebijakan, metode, dan bantu saya langkah demi langkah.
```

## 4. Banyak pembayaran menggantung / notifikasi Midtrans tidak masuk

**Tanda-tanda:** di halaman admin angka "Menunggu dibayar" tinggi; beberapa pelanggan bilang sudah bayar tetapi baru aktif setelah beberapa menit; email "Banyak notifikasi Midtrans ditolak" atau "API Midtrans gagal berulang kali".

**Cek:**

1. Pembayaran menggantung yang **wajar**: pelanggan memilih transfer bank lalu belum mentransfer. VA berlaku 24 jam; setelah itu Rezumi menandainya kedaluwarsa sendiri.
2. Dashboard Midtrans → Settings → Payment → Notification URL: harus persis `https://rezumi.app/api/payments/midtrans/notification` (https, tanpa garis miring di akhir).
3. Dashboard Midtrans → riwayat notifikasi (HTTP notification history) satu transaksi: kode jawabannya. `200` = diterima; `403` = tanda tangan salah (kunci tidak cocok, lihat bagian 8); `503` = server sedang bermasalah; tidak ada jawaban = server tidak terjangkau (cek Cloudflare).
4. `https://status.midtrans.com` untuk gangguan Midtrans.

**Langkah:**

1. Rezumi tetap bertanya ke Midtrans sendiri tiap beberapa menit (2, 5, 15, 30, 60 menit, lalu tiap 6 jam sampai 3 hari) dan saat pelanggan membuka halaman kembali. Jadi pembayaran yang lunas tetap aktif walau notifikasi gagal, hanya lebih lambat.
2. Pelanggan yang menunggu: buka pelanggannya di halaman admin → menu **⋯** pembayaran → **Cek ulang status**.
3. Notifikasi ditolak 403: ikuti bagian 8 (kunci).
4. Gangguan berkepanjangan di Midtrans: tutup pembelian sementara (bagian 7) sampai normal.

**Kapan menghubungi Midtrans:** URL sudah benar, server Rezumi normal, tetapi riwayat notifikasi menunjukkan tidak ada pengiriman atau error dari sisi mereka.

**Prompt Claude:**

```text
Banyak pembayaran menggantung dan notifikasi Midtrans sepertinya tidak masuk. Ikuti runbook-pemilik.md bagian 4 di .agents/docs/plans/membership dan bantu saya diagnosis.
```

## 5. Mengubah harga atau isi paket

**Tanda-tanda:** kamu ingin menaikkan/menurunkan harga, mengubah kuota dokumen, atau jumlah kredit.

**Cek:** pembayaran yang sudah dibuat menyimpan salinan harga, durasi, dan kreditnya sendiri, jadi perubahan tidak memengaruhi pembeli lama. Ubah satu hal setiap kali (harga _atau_ kuota _atau_ kredit) supaya hasilnya bisa dibaca.

**Langkah:** minta Claude membuat perubahan kecil di katalog (`@rezumi/schema/billing`) yang juga menaikkan versi katalog, memperbarui homepage, S&K, dan panduan. Review ringkasannya, lalu merge (merge = langsung tayang).

**Kapan menghubungi Midtrans:** tidak perlu.

**Prompt Claude:**

```text
Ubah harga Plus menjadi Rp39.000 mengikuti katalog di .agents/docs/plans/membership. Ikuti runbook-pemilik.md bagian 5.
```

## 6. Mematikan/menyalakan metode pembayaran

**Tanda-tanda:** satu metode bermasalah (mis. ShopeePay gangguan), atau metode baru baru saja diaktifkan Midtrans.

**Cek:** daftar metode yang tampil di halaman bayar diatur oleh **Rezumi** (variabel `MIDTRANS_ENABLED_PAYMENTS`), bukan hanya oleh dashboard Midtrans. Keduanya harus cocok: metode yang ada di variabel tetapi tidak aktif di akun Midtrans tidak tampil.

**Langkah:**

1. Menyalakan metode baru: pastikan statusnya aktif di dashboard Midtrans (Settings → Snap Checkout / Payment methods). Lalu minta Claude menambahkan kodenya ke `MIDTRANS_ENABLED_PAYMENTS` di `wrangler.jsonc` (kode: `other_qris`, `gopay`, `shopeepay`, `bni_va`, `bri_va`, `echannel` untuk Mandiri Bill, `permata_va`). Merge = tayang.
2. Mematikan sementara (cepat, tanpa merge): Cloudflare → Workers & Pages → `vitaekit` → Settings → Variables and Secrets → ubah `MIDTRANS_ENABLED_PAYMENTS`, buang kodenya → Deploy. Catat agar `wrangler.jsonc` disamakan nanti (deploy berikutnya dari GitHub memakai nilai di `wrangler.jsonc`).
3. Jangan pernah mengosongkan daftarnya; server menolak start tanpa metode.
4. Perbarui teks di halaman Paket bila nama metode yang disebut berubah.

**Kapan menghubungi Midtrans:** untuk mengaktifkan metode baru (GoPay, ShopeePay, VA) atau bila metode aktif tetapi tidak tampil.

**Prompt Claude:**

```text
Saya baru mengaktifkan GoPay di Midtrans produksi. Ikuti runbook-pemilik.md bagian 6 di .agents/docs/plans/membership untuk menyalakannya di Rezumi.
```

## 7. Menghentikan penjualan sementara

**Tanda-tanda:** ada bug di checkout, harga salah, gangguan Midtrans, atau kamu perlu jeda (libur, audit).

**Cek:** saklar `BILLING_CHECKOUT_PAUSED` hanya menutup **pembelian baru**. Paket dan kredit yang sudah dibeli tetap berlaku, batas paket tetap berlaku, pembayaran yang sedang berjalan tetap diproses. Jangan memakai `BILLING_MODE=off` untuk ini: itu membuka semua fitur untuk semua orang tanpa batas.

**Langkah:**

1. Cloudflare → Workers & Pages → `vitaekit` → Settings → Variables and Secrets → `BILLING_CHECKOUT_PAUSED` = `true` → Deploy. Tombol beli berganti pesan "dijeda".
2. Membuka lagi: set `false` → Deploy.
3. Agar tidak tertimpa deploy berikutnya, minta Claude menyamakan nilai di `wrangler.jsonc`.

**Kapan menghubungi Midtrans:** bila penyebabnya gangguan Midtrans.

**Prompt Claude:**

```text
Saya perlu menghentikan penjualan sementara tanpa membuka fitur untuk semua orang. Ikuti runbook-pemilik.md bagian 7 di .agents/docs/plans/membership.
```

## 8. Server key Midtrans bocor (atau perlu diganti)

**Tanda-tanda:** kunci tidak sengaja tertempel di chat, dokumen, tangkapan layar, atau repo; atau email "Banyak notifikasi Midtrans ditolak" setelah kunci diganti.

**Cek:** server key dimulai `Mid-server-` (produksi) atau `SB-Mid-server-` (sandbox). Signature Secret Key dipakai Midtrans untuk menandatangani notifikasi.

**Langkah:**

1. **Segera** buat kunci baru di dashboard Midtrans: Settings → Access Keys (General Credentials). Akun kredensial baru bisa punya beberapa server key: buat yang baru dulu, baru nonaktifkan yang bocor.
2. Pasang di server dari laptopmu (jangan tempel di chat):

   ```bash
   pnpm exec wrangler secret put MIDTRANS_SERVER_KEY
   ```

   Bila Signature Secret Key juga diganti:

   ```bash
   pnpm exec wrangler secret put MIDTRANS_SIGNATURE_KEY
   ```

3. Nonaktifkan/hapus kunci lama di dashboard Midtrans.
4. Uji: buka satu pelanggan di halaman admin, menu **⋯** pembayaran → **Cek ulang status**. Berhasil = kunci baru bekerja. Pantau email peringatan satu jam ke depan; "notifikasi ditolak" berarti Signature Secret Key belum cocok.
5. Bila kunci bocor ke repo, minta Claude membantu membersihkan riwayat dan memeriksa tempat lain.

**Kapan menghubungi Midtrans:** bila ada transaksi atau refund yang tidak kamu kenali setelah kebocoran.

**Prompt Claude:**

```text
Server key Midtrans saya bocor. Ikuti runbook-pemilik.md bagian 8 di .agents/docs/plans/membership. Jangan minta saya menempel kunci di chat.
```

## 9. Pelanggan minta hapus akun saat masa aktif masih berjalan

**Tanda-tanda:** pelanggan ingin menghapus akun padahal paketnya masih aktif.

**Cek:** S&K: boleh, tidak ada refund otomatis. Pelanggan bisa mengunduh semua datanya dulu (Pengaturan → Akun → Ekspor data; file ZIP berisi CV, surat, dan `billing.json` riwayat pembayaran/kredit).

**Langkah:**

1. Ingatkan pelanggan: sisa masa aktif dan kredit hilang, tidak bisa dipulihkan, dan tidak ada refund otomatis (kecuali memenuhi Kebijakan Pengembalian Dana; bila ya, refund **sebelum** akun dihapus agar mudah dicocokkan).
2. Pelanggan menghapus sendiri dari Pengaturan → Akun. Kamu tidak perlu melakukan apa pun.
3. Setelah dihapus, catatan pembayaran tetap tersimpan **tanpa** nama/email (untuk pembukuan); di halaman admin tampil "Akun sudah dihapus". Nomor pesanan tetap bisa dicari.

**Kapan menghubungi Midtrans:** tidak perlu.

**Prompt Claude:**

```text
Pelanggan dengan paket aktif ingin menghapus akun. Ikuti runbook-pemilik.md bagian 9 di .agents/docs/plans/membership.
```

## 10. Rekap bulanan untuk pembukuan/pajak

**Tanda-tanda:** awal bulan, atau saat menyiapkan laporan PPh Final UMKM.

**Langkah:**

1. Halaman admin → dropdown periode di kanan atas → **Bulan lalu** → **Unduh CSV**. File berisi satu baris per pembayaran (jumlah positif), per refund, dan per pembayaran yang dibatalkan bank (`pembalikan`, jumlah negatif), dengan waktu WIB, nomor pesanan, paket, metode, status, dan ID transaksi Midtrans. Tidak ada nama atau email pelanggan.
2. Jumlahkan kolom `jumlah_idr` = omzet bersih bulan itu. Angka yang sama tampil di kotak **Pendapatan bersih** untuk periode itu.
3. Cocokkan dengan laporan dashboard Midtrans (Transactions → Download / Settlement report) untuk bulan yang sama; selisih kecil biasanya karena transaksi di batas tengah malam atau refund yang belum selesai.
4. Simpan CSV dan laporan Midtrans di arsip pembukuan (setidaknya 10 tahun; konfirmasi ke konsultan pajak).
5. Ingat: bukti bayar Rezumi bukan faktur pajak (penjual perorangan non-PKP).

**Kapan menghubungi Midtrans:** angka settlement Midtrans tidak cocok dan selisihnya tidak bisa dijelaskan.

**Prompt Claude:**

```text
Bantu saya membuat rekap bulanan Oktober untuk pajak. Ikuti runbook-pemilik.md bagian 10 di .agents/docs/plans/membership.
```

---

## Lain-lain

### Email tidak terkirim (bukti bayar, peringatan, ringkasan, pengingat)

- Peringatan dan ringkasan harian hanya dikirim bila `BILLING_ALERT_EMAIL` diisi. Tanpa itu peringatan tetap terlihat di halaman admin (kotak oranye **Perlu perhatian**, "Belum diemail").
- Ringkasan harian hanya dikirim saat `BILLING_MODE` bukan `off`.
- Semua email Rezumi memakai pengaturan email server yang sama (Cloudflare Email / SMTP). Bila email login juga tidak sampai, masalahnya di sana; minta Claude memeriksa.
- Mengisi atau mengganti alamat peringatan (alamat email tidak rahasia, tetapi lebih rapi tidak di repo):

  ```bash
  pnpm exec wrangler secret put BILLING_ALERT_EMAIL
  ```

### Pengingat ke pelanggan

Pelanggan menerima satu email sekitar 3 hari sebelum masa aktif terakhirnya berakhir (bukan tiap potongan bila ada paket antre), dalam bahasa yang ia pakai saat membeli (Indonesia atau Inggris). Isinya kapan berakhir, apa yang tetap bisa dipakai di Gratis, dan tautan ke halaman Paket. Tidak ada hitung mundur atau diskon palsu.

### Memberi paket atau kredit sebagai kompensasi

Halaman admin → pelanggan → tombol **Beri paket** (kanan atas) (Plus/Pro AI, 1–366 hari) atau **Sesuaikan kredit** (positif menambah dengan masa berlaku; negatif mengurangi). Keduanya wajib alasan dan tercatat. Paket pemberian tidak membuat pembayaran dan tidak muncul di CSV.

### Mencabut paket

Halaman admin → pelanggan → **Masa aktif** → **Cabut** pada potongan yang masih berjalan/antre. Untuk pembayaran yang di-refund, jangan cabut manual: refund penuh sudah mencabutnya.
