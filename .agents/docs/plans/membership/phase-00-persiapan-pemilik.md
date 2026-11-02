# Phase 00 — Persiapan bisnis dan akun (tugas pemilik)

| Dikerjakan                | Ukuran                        | Bergantung pada | Kapan                                                       |
| ------------------------- | ----------------------------- | --------------- | ----------------------------------------------------------- |
| Pemilik (Claude membantu) | Beberapa hari–minggu, paralel | —               | Mulai sekarang; semua bagian wajib selesai sebelum Phase 11 |

Phase ini **bukan pekerjaan kode**. Kamu yang mengisi formulir dan dashboard; Claude bisa menjelaskan langkah, menyiapkan draf email ke Midtrans, dan mengecek kelengkapan. Claude tidak bisa login, mendaftar akun, atau mengisi password untukmu.

Prompt untuk dibantu: `Bantu saya mengerjakan Phase 00 dari .agents/docs/plans/membership/README.md`

Status kamu per 2 November 2026: **perorangan**, akun **Midtrans production sudah aktif**, metode yang diketahui aktif: **QRIS**.

## A. Identitas penjual (dibutuhkan Phase 02 dan bukti bayar)

Isi tabel ini (boleh langsung di file ini; repo akan private). **Jangan menulis NIK, NPWP, nomor rekening, atau password di sini.**

| Data                                                                                            | Isi                                               | Dipakai di                                                                 |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------- |
| Nama penjual (sesuai KTP) dan nama merek                                                        | Salman Alfariesh — Rezumi (konfirmasi)            | S&K, bukti bayar, halaman Kontak                                           |
| Email dukungan                                                                                  | hi@rezumi.app (konfirmasi masih aktif dan dibaca) | Semua halaman, email bukti bayar                                           |
| Alamat surat-menyurat (kota minimal; alamat lengkap bila bersedia, boleh alamat kantor virtual) |                                                   | Halaman Kontak, S&K (PP 80/2019 meminta alamat dan nomor kontak pengaduan) |
| Nomor kontak pengaduan (mis. WhatsApp bisnis)                                                   |                                                   | Halaman Kontak                                                             |
| Jam/tenggat menjawab pengaduan (mis. 2 hari kerja)                                              |                                                   | Halaman Kontak, runbook                                                    |
| Email pemilik untuk peringatan sistem                                                           |                                                   | Phase 09 (`BILLING_ALERT_EMAIL`)                                           |

## B. Midtrans (akun sudah production)

1. **Cek metode yang aktif** di dashboard produksi (menu pembayaran/Snap Preference, nama menu bisa berbeda). Catat di tabel di bawah. Untuk akun perorangan, Midtrans menyebut paket awal berisi **Bank Transfer (VA), GoPay, dan QRIS**; BCA VA, Indomaret, dan direct debit tidak tersedia untuk perorangan.
2. **Ajukan aktivasi GoPay, ShopeePay, dan transfer bank (VA)** bila belum aktif. Hanya QRIS membuat pembeli di ponsel harus menyimpan gambar QR lalu membukanya di aplikasi e-wallet; GoPay/ShopeePay langsung membuka aplikasinya. Claude bisa menyiapkan draf email ke support Midtrans.
3. **Tanyakan ke Midtrans** (sekalian di email yang sama):
   - Tarif MDR yang berlaku untuk akunmu. Halaman biaya Midtrans menyebut perusahaan "produk digital" bisa mendapat tarif berbeda dari QRIS 0,7%, GoPay/ShopeePay 2%, VA Rp4.000.
   - Apakah fee sudah termasuk PPN (dokumen mereka tidak konsisten).
   - Biaya penarikan dana (dokumen menyebut gratis di satu tempat dan Rp5.000 di tempat lain).
   - Apakah fitur **refund** (API maupun dashboard) aktif untuk QRIS/GoPay/ShopeePay di akunmu.
4. **Cek profil merchant**: nama yang tampil di halaman bayar, website terdaftar `https://rezumi.app`, kategori usaha sesuai (layanan perangkat lunak/digital). Bila pendaftaran dulu memakai data lain, minta pembaruan.
5. **Cek rekening pencairan** atas nama yang sama dengan KTP pendaftar dan email "Finance PIC" untuk menerima invoice Midtrans.
6. **Sandbox**: pastikan bisa pindah ke lingkungan Sandbox di dashboard dan melihat **Settings → Access Keys**. Server key sandbox diisi sendiri di `.env.local` saat Phase 06. Server key produksi baru dipasang di Phase 11.
7. **Jangan dulu** mengisi Payment notification URL atau Finish URL produksi; itu langkah Phase 11.
8. Rahasiakan server key. Bila pernah terkirim ke tempat lain (chat, email, screenshot), buat ulang di dashboard.

| Metode                                | Aktif di produksi? | Tanggal dicek | Catatan |
| ------------------------------------- | ------------------ | ------------- | ------- |
| QRIS                                  | Ya (info pemilik)  | 2026-11-02    |         |
| GoPay                                 |                    |               |         |
| ShopeePay                             |                    |               |         |
| VA BNI / BRI / Mandiri Bill / Permata |                    |               |         |
| Lainnya                               |                    |               |         |

Setiap metode yang aktif harus ditambahkan ke `MIDTRANS_ENABLED_PAYMENTS` (mode redirect wajib mengirim daftar ini). Beri tahu Claude saat ada perubahan.

## C. Perizinan dan data pribadi (sebelum go-live)

Ringkasan riset 2 November 2026; bukan nasihat hukum. Detail di `00-keputusan-produk.md` bagian 8.

1. **NIB perorangan** lewat [OSS](https://oss.go.id) dengan NIK. Pilih kode KBLI 2025 yang sesuai; kandidat: **58290** (Penerbitan Perangkat Lunak Lainnya) atau **62199** (Aktivitas Pemrograman Komputer Lainnya). Pastikan tingkat risikonya; bila OSS meminta Sertifikat Standar, ikuti langkahnya.
2. **PSE Lingkup Privat** (TDPSE) lewat OSS untuk website `rezumi.app`, lalu untuk app iOS/Android saat dirilis. Komdigi aktif menegur dan bisa memblokir PSE yang belum terdaftar.
3. **Usia pengguna**: putuskan usia minimum (usulan: 18 tahun untuk membeli; di bawah itu dengan izin orang tua/wali). Ini masuk S&K di Phase 02.

## D. Pajak (konsultasi singkat disarankan)

1. Pastikan NPWP/NIK-sebagai-NPWP aktif dan akun pajak online (Coretax DJP) bisa dipakai.
2. Konfirmasi ke konsultan pajak: PPh Final UMKM 0,5% untuk orang pribadi, bebas pajak sampai omzet Rp500 juta per tahun, cara pencatatan omzet bulanan, dan berapa lama catatan transaksi disimpan.
3. Selama bukan PKP: harga tampil final tanpa PPN, bukti bayar bukan faktur pajak.

## E. Provider AI untuk Rezumi AI

1. Siapkan akun provider AI (mis. Google AI Studio/Vertex, atau provider lain yang dipakai Rezumi) dengan **batas pengeluaran bulanan**.
2. Key uji diisi sendiri di `.env.local` saat Phase 05; key produksi dipasang di Phase 11. Model final dipilih di Phase 10.

## F. Cloudflare (dicek bersama Claude di Phase 11)

Catat saja dulu: paket zona `rezumi.app` (Free/Pro), apakah **Bot Fight Mode** aktif, dan pengaturan **Minimum TLS Version**. Hyperdrive produksi sudah dipastikan caching mati (2 November 2026).

## Selesai bila

- Tabel A terisi, tabel metode B terisi dan metode tambahan sudah diajukan, pertanyaan B.3 sudah dijawab Midtrans, NIB dan PSE terdaftar (atau jadwal selesainya jelas sebelum go-live), konsultasi pajak dilakukan atau diputuskan ditunda dengan sadar.
- Beri tahu Claude di sesi berikutnya; Claude memperbarui status di README.
