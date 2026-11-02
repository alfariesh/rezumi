# Keputusan produk: membership Rezumi (versi 2)

Tanggal: **2 November 2026**. Dokumen ini adalah sumber kebenaran untuk aturan bisnis membership. Ia menyempurnakan [proposal 31 Oktober](../../research/monetisasi-membership-indonesia-2026-10-31.md); analisis pasar, pembanding, dan alasan panjang tetap ada di proposal itu. Bila keduanya berbeda, **dokumen ini yang berlaku**.

Semua harga, kuota, dan angka keuangan masih **hipotesis peluncuran**: belum ada pengguna, jadi angka diuji lewat penjualan nyata (bagian 9). Rezumi sekarang layanan hosted tertutup (repo akan private); bagian proposal tentang model open source/self-host tidak berlaku lagi.

## 1. Ringkasan satu menit

- **Tiga paket:** Gratis, **Plus Rp29.000**, **Pro AI Rp79.000**. Paket berbayar = akses **30 hari, bayar sekali, tidak diperpanjang otomatis**.
- **Beli hanya di web** (rezumi.app) lewat **Midtrans Snap**. Saat ini akun Midtrans pemilik baru mengaktifkan **QRIS**; GoPay, ShopeePay, dan transfer bank (VA) diaktifkan menyusul (Phase 00).
- **Tidak ada hari berbayar yang hangus.** Perpanjang atau upgrade di tengah masa aktif masuk antrean; Pro AI dipakai lebih dulu, sisa Plus lanjut setelahnya.
- **Dokumen tidak pernah dikunci.** Saat paket habis semua CV dan surat tetap bisa dibuka, diedit, dan diunduh PDF; batas hanya berlaku saat membuat dokumen baru.
- **Rezumi AI**: AI tanpa API key, dibayar dengan kredit yang biayanya terlihat sebelum dipakai. API key sendiri (BYOK) tetap boleh dan tidak memotong kredit.
- **Android** menampilkan paket dan kredit tanpa menjual. **iOS** belum menampilkan apa pun soal paket/kredit sampai In-App Purchase dibuat (backlog L1).
- Pemilik berstatus **perorangan, bukan PKP**: harga tampil final tanpa PPN, bukti bayar bukan faktur pajak.
- Semua fitur dibangun di balik saklar dan baru dinyalakan di Phase 11 setelah uji sandbox dan uji uang sungguhan oleh pemilik.

## 2. Paket dan harga

| Manfaat                                                                                         | Gratis                              | Plus                   | Pro AI                       |
| ----------------------------------------------------------------------------------------------- | ----------------------------------- | ---------------------- | ---------------------------- |
| Harga                                                                                           | Rp0                                 | **Rp29.000 / 30 hari** | **Rp79.000 / 30 hari**       |
| CV aktif (tidak di Trash)                                                                       | 3                                   | 50                     | 50                           |
| Surat lamaran aktif                                                                             | 3                                   | 50                     | 50                           |
| Template                                                                                        | 4 (Bronzor, Onyx, Rhyhorn, Azurill) | Semua                  | Semua                        |
| PDF tanpa watermark, Markdown, JSON, ekspor data akun                                           | Ya                                  | Ya                     | Ya                           |
| Ekspor baru Word (.docx) dan ODT                                                                | —                                   | Ya                     | Ya                           |
| Custom Styles (CSS) dan unggah font sendiri                                                     | —                                   | Ya                     | Ya                           |
| API dan MCP untuk aplikasi/asisten luar                                                         | —                                   | Ya (dengan rate limit) | Ya (dengan rate limit)       |
| Rezumi AI                                                                                       | 5 kredit coba (sekali, 14 hari)     | Sisa kredit coba saja  | **100 kredit per pembelian** |
| AI dengan API key sendiri (BYOK)                                                                | Ya                                  | Ya                     | Ya                           |
| Tracker lamaran, ATS checker, knowledge, insight, berbagi CV, sinkron web–mobile, riwayat versi | Ya                                  | Ya                     | Ya                           |

Catatan:

- **Insight pencarian kerja tidak dikunci** (berubah dari proposal). Pembedaan "ringkasan dasar vs lengkap" belum terdefinisi dan menambah pekerjaan tanpa bukti nilai. Hapus "Full job search insights" dari daftar manfaat Plus di homepage.
- **Tidak ada watermark** di paket mana pun.
- Template gratis tetap perlu diuji dengan konten Indonesia sebelum peluncuran; semua template boleh dipratinjau di web.
- Jumlah template tidak ditulis sebagai angka tetap di materi pemasaran; tampilkan dari katalog.

## 3. Aturan beli dan masa aktif

1. **Masa aktif mulai saat pembayaran terverifikasi server**, bukan saat checkout dibuat. Tampilkan tanggal dan jam berakhir di zona waktu akun (bila belum diatur, pakai WIB).
2. **30 hari = 30 × 24 jam.**
3. **Beli paket yang sama saat masih aktif** → tambah 30 hari setelah masa aktif sekarang.
4. **Upgrade Plus → Pro AI** → Pro AI mulai sekarang; sisa hari Plus **dibekukan** dan lanjut setelah Pro AI selesai. Tidak ada rumus prorata dan tidak ada harga dinamis.
5. **Beli Plus saat Pro AI aktif** → Plus masuk antrean setelah Pro AI selesai.
6. Urutan pemakaian selalu: paket berperingkat lebih tinggi lebih dulu, lalu sesuai urutan beli. Total hari yang diterima = total hari yang dibayar.
7. **Pembayaran tertunda**: satu pembayaran yang belum selesai per paket dipakai ulang, bukan dibuat dobel. Pembayaran berlaku **24 jam**; setelah itu buat baru. Pengguna bisa "ganti metode pembayaran".
8. **Syarat membeli**: akun terdaftar (bukan tamu), email sudah terverifikasi, membeli dari web. API key dan klien OAuth/MCP pihak ketiga tidak bisa membeli.
9. **Harga dibekukan saat checkout.** Perubahan harga hanya berlaku untuk checkout baru.
10. Membayar dua kali tidak merugikan pelanggan: kedua pembayaran sah menambah masa aktif (masuk antrean). Pelanggan yang tidak menginginkannya bisa meminta refund sesuai kebijakan.

## 4. Aturan dokumen dan fitur

1. **Batas hanya mencegah pembuatan baru.** Membuat, mengimpor, menduplikasi, tailoring, "copy for job", dan memulihkan dari Trash dihitung terhadap batas dokumen aktif.
2. **Saat paket habis**, tidak ada dokumen yang dikunci, diarsipkan, diubah, atau dihapus. Semua tetap bisa dibuka, diedit, dibagikan, dan diunduh PDF. Untuk membuat dokumen baru di atas batas, pengguna memindahkan dokumen ke Trash atau membeli paket. (Keputusan pemilik 2026-11-02.)
3. **Template premium**: memilih atau mengganti ke template premium butuh paket aktif. Dokumen yang sudah memakai template premium **tetap memakainya**, termasuk salinannya. Impor file dengan template premium tanpa paket → template diganti ke template gratis dan pengguna diberi tahu.
4. **Word/ODT**: ekspor baru butuh paket aktif. File yang sudah diunduh tetap milik pengguna.
5. **Custom Styles dan font**: mengubah/menambah butuh paket; yang sudah tersimpan tetap dipakai saat render.
6. **API/MCP**: aplikasi atau asisten luar yang memakai API key atau koneksi OAuth butuh Plus/Pro AI. App web dan mobile resmi Rezumi tidak pernah terkena aturan ini.
7. **Tautan CV publik** tidak mati karena paket habis.
8. Dokumen dari akun tamu yang dipindah saat mendaftar tidak dibatasi.

## 5. Rezumi AI dan kredit

**Kredit adalah satuan manfaat**, bukan token. Pengguna melihat biayanya sebelum menjalankan tindakan, misalnya "Sesuaikan CV untuk lowongan ini: 5 kredit".

Bobot awal (dikalibrasi di Phase 10 sebelum dijual; nama `actionKey` final ditetapkan Phase 05):

| Jenis pekerjaan                                             | Kredit | Batas pekerjaan                                       |
| ----------------------------------------------------------- | -----: | ----------------------------------------------------- |
| Perbaiki satu bullet / ringkasan pendek / baca lowongan     |      1 | Satu hasil, teks pendek                               |
| Draf jawaban formulir / balasan recruiter                   |      2 | Satu jawaban dari pengalaman yang pengguna berikan    |
| Draf surat lamaran                                          |      3 | Satu surat untuk satu lowongan                        |
| Satu latihan jawaban interview (teks) / persiapan / debrief |      3 | Satu jawaban + umpan balik                            |
| Satu giliran Coach (mode terbatas)                          |      3 | Batas langkah, konteks, dan output; bukan agent bebas |
| Review CV / analisis kecocokan                              |      4 | Satu dokumen dan satu lowongan                        |
| Sesuaikan satu CV (tailoring)                               |      5 | Satu versi baru yang bisa ditinjau                    |
| Impor PDF/Word dengan AI                                    |      5 | Batas halaman/ukuran; impor tanpa AI tetap tersedia   |

Aturan:

1. **Pro AI** memberi **100 kredit langsung saat pembayaran terverifikasi**, berlaku sampai akhir potongan 30 hari yang dibeli. Beli lagi saat masih aktif = 100 kredit baru langsung, berlaku sampai akhir potongan barunya. Kredit tidak menunggu periode berikutnya.
2. **Kredit coba**: 5 kredit, sekali per akun, untuk akun terdaftar dengan email terverifikasi, diberikan saat pertama kali memakai Rezumi AI, berlaku 14 hari. Tanpa kartu, tanpa syarat lain.
3. Kredit dipakai dari yang paling cepat kedaluwarsa. **Tidak ada rollover**, tidak bisa dipindah ke akun lain, tidak bisa diuangkan.
4. **Gagal tanpa hasil yang bisa dipakai → kredit kembali.** Klik ganda atau retry jaringan tidak memotong dua kali.
5. **BYOK** tidak menyentuh kredit. Sistem tidak pernah berpindah sumber AI diam-diam.
6. **Tidak termasuk peluncuran**: latihan suara, discovery lowongan terjadwal, dan tool web yang dibayar Rezumi. Fitur itu tetap bisa dipakai lewat koneksi sendiri.
7. Batas biaya internal per tindakan wajib ada. Jangan pernah menghentikan pelanggan diam-diam sebelum kreditnya habis karena biaya internal mahal; perbaiki bobot/model/harga untuk pembelian berikutnya.
8. **Anggaran AI**: target Rp15.000 per 100 kredit yang dipakai penuh (P95), dibuktikan di Phase 10.

## 6. Kanal penjualan: web, Android, iOS

Keputusan pemilik 2026-11-02, berdasarkan riset kebijakan toko (Apple App Store Review Guidelines revisi 16 Oktober 2026; Google Play Payments policy dan FAQ, diperiksa 2 November 2026). Kedua app belum dirilis di toko saat keputusan ini dibuat.

| Kanal       | Yang boleh                                                                                                                                                                                                         | Yang tidak boleh                                                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Web**     | Semua: halaman Paket, harga, checkout Midtrans, upgrade, riwayat, bukti bayar                                                                                                                                      | —                                                                                                                                                     |
| **Android** | Halaman Paket (status, berlaku sampai, batas, kredit), Rezumi AI dengan saldo, label fitur paket, dan satu kalimat informatif seperti "Paket bisa dibeli di situs rezumi.app" **tanpa tautan, tombol, atau harga** | Tombol beli, tautan ke halaman bayar, harga, ajakan membeli di luar Google Play                                                                       |
| **iOS**     | Hanya yang bisa dipakai akun itu: pengguna Gratis melihat 4 template dan PDF/MD/JSON; pengguna berbayar melihat semua yang sudah menjadi haknya. AI hanya lewat koneksi sendiri (seperti sekarang)                 | Halaman Paket, saldo kredit, Rezumi AI, label "Premium/Plus", ajakan upgrade, harga, penyebutan situs untuk membeli. Sampai IAP tersedia (backlog L1) |

Konsekuensi teknis:

- **Pesan error dari server selalu netral** (tanpa harga, tanpa kata "beli", tanpa URL), karena tampil juga di app. Web menambahkan tombol upgrade sendiri berdasarkan kode error.
- App iOS tidak mengirim `aiSource: "rezumi"`, sehingga tidak pernah memotong kredit.
- Pengecualian parity ini dicatat di `.agents/docs/mobile-release-handoff.md` → "Feature parity exceptions" (Phase 08).
- **Risiko yang diterima pemilik:** Apple 3.1.3(b) mengizinkan akses ke fitur yang dibeli di web **hanya bila item yang sama juga dijual lewat IAP**. Pembeli web tetap mendapat batas paketnya saat memakai app iOS (karena aturan ada di server), jadi pendekatan ini adalah wilayah abu-abu, bukan kepatuhan penuh. Bila Apple menolak, jalankan backlog L1 (IAP iOS). Catatan review iOS tidak boleh berisi klaim yang tidak benar.
- Google Play mengizinkan app "consumption-only" walaupun bagian dari layanan berbayar, dan Indonesia termasuk program user choice billing (potongan fee 4%) untuk dipertimbangkan nanti.

## 7. Pembayaran: Midtrans

**Produk:** Midtrans **Snap mode redirect** untuk semua metode. Tidak memakai Snap JS, BI-SNAP, Payment Link, Subscription API, atau Mobile SDK (Mobile SDK sedang dihentikan bertahap mulai Juni 2026). Alasan: halaman bayar dikelola Midtrans, paling sedikit kode, tidak mengubah CSP, dan sama untuk desktop maupun browser ponsel.

**Metode:**

| Metode                                                                            | Status akun pemilik (2026-11-02) | Peluncuran                                    | Fee Midtrans (belum termasuk PPN 11%) |
| --------------------------------------------------------------------------------- | -------------------------------- | --------------------------------------------- | ------------------------------------- |
| QRIS (`other_qris`)                                                               | **Aktif**                        | Ya                                            | 0,7%                                  |
| GoPay (`gopay`)                                                                   | Belum diketahui                  | Aktifkan bila bisa (Phase 00)                 | 2%                                    |
| ShopeePay (`shopeepay`)                                                           | Belum diketahui                  | Aktifkan bila bisa                            | 2%                                    |
| VA BNI, BRI, Mandiri Bill, Permata (`bni_va`, `bri_va`, `echannel`, `permata_va`) | Belum diketahui                  | Aktifkan bila bisa                            | Rp4.000/transaksi                     |
| BCA VA, Indomaret, direct debit                                                   | Tidak tersedia untuk perorangan  | Tidak                                         | —                                     |
| Kartu kredit/debit                                                                | Perlu NPWP + aktivasi            | Tidak (backlog L8)                            | 2,9% + Rp2.000                        |
| Alfamart, PayLater, DANA/OVO langsung                                             | —                                | Tidak (QRIS sudah bisa dibayar dari DANA/OVO) | —                                     |

Dokumen Midtrans menyebut perusahaan "produk digital" bisa dikenai tarif berbeda; pemilik memastikan tarif aktual di perjanjian/dashboard (Phase 00).

**Biaya per pembelian** (asumsi konservatif: PPN 11% dikenakan atas fee untuk semua metode):

| Metode                                  |   Plus Rp29.000 | Pro AI Rp79.000 |
| --------------------------------------- | --------------: | --------------: |
| QRIS                                    |    Rp225 (0,8%) |    Rp614 (0,8%) |
| GoPay/ShopeePay                         |    Rp644 (2,2%) |  Rp1.754 (2,2%) |
| VA                                      | Rp4.440 (15,3%) |  Rp4.440 (5,6%) |
| Campuran 50% QRIS, 30% e-wallet, 20% VA |  Rp1.194 (4,1%) |  Rp1.721 (2,2%) |

**Kontribusi per pembelian** (asumsi proposal: cadangan refund 2%, biaya layanan non-AI Rp3.000/Rp4.000, anggaran AI Pro AI Rp15.000; campuran metode di atas):

| Komponen                |                 Plus |               Pro AI |
| ----------------------- | -------------------: | -------------------: |
| Harga                   |             Rp29.000 |             Rp79.000 |
| Fee pembayaran campuran |              Rp1.194 |              Rp1.721 |
| Cadangan refund 2%      |                Rp580 |              Rp1.580 |
| Layanan non-AI          |              Rp3.000 |              Rp4.000 |
| Anggaran Rezumi AI      |                  Rp0 |             Rp15.000 |
| **Kontribusi**          | **Rp24.226 (83,5%)** | **Rp56.699 (71,8%)** |

Dengan asumsi proposal lainnya (1.000 pengguna aktif, 60% Plus/40% Pro AI, biaya tetap Rp1,5 juta, biaya pengguna gratis dan trial), titik impas tetap sekitar **56 pembelian per 30 hari**. Ini ilustrasi, bukan ramalan.

Pencairan dana Midtrans: bisa ditarik mulai H+3 hari kerja setelah settlement; cek biaya penarikan di dashboard (dokumen Midtrans tidak konsisten antara gratis dan Rp5.000).

## 8. Legal, pajak, dan kepercayaan

Ringkasan riset (bukan nasihat hukum; poin bertanda ⚖️ dikonfirmasi ke konsultan pajak/hukum):

1. **Identitas penjual**: perorangan atas nama pemilik. Tampilkan nama penjual, email kontak, dan alamat/kota di halaman Kontak/Tentang, S&K, dan bukti bayar (PP 80/2019 pasal 13 dan 27).
2. **Pajak** ⚖️: perorangan memakai PPh Final UMKM 0,5% dari omzet bruto (PP 55/2022 yang diubah PP 20/2026, tanpa batas waktu untuk orang pribadi); omzet sampai Rp500 juta per tahun tidak dikenai pajak. Omzet dari pasangan dan PT Perorangan milik pemilik digabung. Di bawah Rp4,8 miliar per tahun pemilik tidak wajib PKP.
3. **Non-PKP**: harga ditampilkan sebagai harga final **tanpa baris PPN**. Bukti bayar adalah "Bukti Pembayaran", **bukan faktur pajak** (menerbitkan faktur pajak sebagai non-PKP adalah pidana). Simpan catatan omzet bulanan (ekspor CSV, Phase 09) dan catatan pembayaran setidaknya 10 tahun ⚖️.
4. **Perizinan** ⚖️: daftar **NIB perorangan** di OSS dengan KBLI 2025 yang sesuai (kandidat 58290 "Penerbitan Perangkat Lunak Lainnya" atau 62199), lalu **PSE Lingkup Privat** (TDPSE) untuk website dan setiap app. Komdigi aktif menegakkan pendaftaran PSE (sanksi sampai pemblokiran). Bisa dikerjakan paralel, sebelum go-live.
5. **Kontrak konsumen** (PP 80/2019 pasal 53 & 55, UU 24/2009): S&K dan kebijakan refund **wajib berbahasa Indonesia**, memuat identitas, spesifikasi produk, harga, cara bayar, cara penyerahan (akses digital aktif setelah bayar), cara pengembalian/pembatalan, dan pilihan hukum. Klausul "tidak ada refund sama sekali" berisiko batal demi hukum (UU 8/1999 pasal 18).
6. **Kebijakan refund** (rancangan komersial): pembelian pertama boleh minta refund penuh dalam **7 hari** bila Rezumi AI yang terpakai dari pembelian itu maksimal 10 kredit; pembayaran ganda dan kegagalan teknis selalu ditangani. Refund QRIS/e-wallet lewat Midtrans (QRIS dari aplikasi lain hanya ±7 hari); VA ditransfer manual. Tidak ada refund berbasis "belum dapat kerja".
7. **Pelindungan data pribadi** (UU 27/2022; PP 33/2026 berlaku 16 Januari 2027) ⚖️: kebijakan privasi berbahasa Indonesia menyebut data yang diproses untuk pembayaran, pemroses (Midtrans, provider AI, Cloudflare, Neon), dasar pemrosesan, masa simpan, hak pengguna (akses/koreksi dijawab 3×24 jam), dan pemberitahuan kebocoran 3×24 jam. Tentukan usia minimum (mis. 18 tahun untuk membeli) dan perlakuan pengguna di bawah umur (PP Tunas, PP 33/2026).
8. **Klaim publik** yang harus diganti sebelum go-live: "gratis dan open source" (footer halaman CV web), tautan "Source code on GitHub", "Report an issue" ke GitHub, tautan Crowdin proyek Reactive Resume, serta bagian open source di S&K/kebijakan privasi. Klaim "no tracking" hanya boleh dipertahankan bila memang tidak ada pelacakan pihak ketiga (rencana ini hanya memakai catatan transaksi di database sendiri).
9. **Lisensi MIT**: kode berasal dari Reactive Resume (© Amruth Pillai, MIT). Menjadikan repo private dan menjual layanan diperbolehkan, tetapi **pemberitahuan hak cipta dan teks lisensi MIT wajib tetap disertakan** (file `LICENSE`, halaman lisensi open source di app dan web). Jangan dihapus.
10. **Pelanggan berhenti/hapus akun** saat masa aktif berjalan: boleh, diberi peringatan, tidak ada refund otomatis. Catatan pembayaran disimpan tanpa data pribadi untuk pembukuan.

## 9. Validasi dan metrik

Ikuti rencana validasi 8 minggu di proposal bagian 12. Angka yang wajib bisa dilihat pemilik setelah go-live (Phase 09):

- Pendaftar baru, email terverifikasi, aktivasi CV (PDF pertama dalam 7 hari).
- Checkout dimulai → pembayaran berhasil (dengan pembilang/penyebut, mis. "6 dari 40").
- Pembelian per paket dan per metode, pendapatan, refund, pembayaran yang menggantung.
- Kredit coba diberikan → dipakai → hasil disimpan; kredit Pro AI terpakai per pembelian.
- Biaya Rezumi AI P50/P95 per tindakan dan per pembelian.

Aturan evaluasi:

- **Plus**: setelah ±30 pembelian total dan wawancara alasan beli, bila Plus < 20% pembelian dan pembelinya tidak bisa menyebut manfaat khas → uji dua tier (backlog L11).
- **Pro AI**: banyak yang mencoba tapi sedikit menyimpan hasil → perbaiki kualitas/alur dulu, bukan diskon. Checkout dimulai tapi gagal → perbaiki pembayaran (misalnya aktifkan GoPay/VA).
- Ubah satu variabel setiap kali (harga _atau_ kuota _atau_ trial), bukan sekaligus.

## 10. Aturan komunikasi

- Tulis **"Rp79.000 untuk akses 30 hari, tidak diperpanjang otomatis"**, bukan "Rp79.000/bulan".
- Jangan menulis "paling populer" sebelum ada data; "Direkomendasikan" boleh.
- Jangan ada hitung mundur palsu, diskon palsu, atau janji pasti lolos ATS/dapat kerja.
- Jelaskan sumber biaya AI sebelum setiap tindakan.
- Pesan batas menjelaskan alternatif gratis (pindahkan ke Trash, pakai PDF, pilih template gratis, pakai koneksi AI sendiri).
- Di app mobile ikuti tabel bagian 6.

## 11. Apa yang berubah dari proposal 31 Oktober

| Topik                        | Proposal                                          | Keputusan v2                                                                              | Alasan                                                               |
| ---------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Upgrade di tengah masa aktif | Prorata: bayar selisih nilai sisa hari            | Antrean hari: Pro AI sekarang, sisa Plus dibekukan                                        | Tanpa harga dinamis, refund lebih sederhana, tidak ada hari hangus   |
| Kredit saat beli lagi        | 100 kredit per periode                            | 100 kredit langsung saat bayar, berlaku sampai akhir potongan yang dibeli                 | Pengguna yang kehabisan kredit langsung terbantu                     |
| Paket habis                  | Pilih 3 dokumen aktif, sisanya arsip baca saja    | Semua dokumen tetap bisa diedit; batas hanya untuk dokumen baru                           | Keputusan pemilik; jauh lebih sedikit pekerjaan; lebih dipercaya     |
| Kredit coba                  | Setelah email terverifikasi dan punya CV/lowongan | Saat pertama memakai Rezumi AI, akun terverifikasi                                        | Biaya hanya muncul bila dipakai; aturan lebih mudah                  |
| Insight                      | Dasar vs lengkap                                  | Tidak dikunci                                                                             | Definisi belum ada; menjaga aktivasi                                 |
| Open source / self-host      | Dipertahankan sebagai pilihan                     | Layanan hosted tertutup; atribusi MIT tetap                                               | Keputusan pemilik membuat repo private                               |
| Pembayaran mobile            | Perlu diputuskan                                  | Web saja; Android consumption-only; iOS tanpa UI paket sampai IAP                         | Aturan Apple 3.1.3(b) dan Google Play FAQ                            |
| Metode pembayaran            | QRIS/e-wallet diutamakan, fee asumsi 3%           | Snap redirect; QRIS dulu; e-wallet dan VA menyusul; fee nyata dihitung                    | Akun pemilik baru QRIS; fee riil lebih rendah dari asumsi kecuali VA |
| Kartu kredit                 | Tidak dibahas                                     | Tidak di peluncuran                                                                       | Perlu NPWP + aktivasi + 3DS + risiko chargeback                      |
| Hak akses Gratis untuk app   | MCP/API tidak termasuk                            | Sama, dengan pengecualian eksplisit untuk app mobile resmi                                | App mobile memakai OAuth bearer, harus tetap bekerja                 |
| Status legal                 | Umum                                              | Perorangan non-PKP, NIB + PSE, S&K berbahasa Indonesia                                    | Riset regulasi 2026 (PP 20/2026, PP 33/2026, penegakan PSE)          |
| Rollout                      | Pilot kecil bila siap                             | Saklar `BILLING_MODE` (`off` → `admins` → `on`), uji sandbox + uji uang sungguhan pemilik | Merge ke `main` langsung deploy produksi                             |

## 12. Risiko utama

| Risiko                                                  | Dampak                                                               | Mitigasi                                                                                  |
| ------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Hanya QRIS aktif saat go-live                           | Pengguna ponsel kesulitan bayar (harus simpan QR lalu buka e-wallet) | Aktifkan GoPay/ShopeePay dan VA sebelum go-live (Phase 00)                                |
| Apple menolak update iOS                                | Rilis iOS tertunda                                                   | iOS tanpa UI paket; siapkan backlog L1 (IAP)                                              |
| Biaya AI lebih mahal dari anggaran                      | Margin Pro AI turun                                                  | Phase 10 sebelum menjual; batas kerja per tindakan; ubah bobot untuk pembelian berikutnya |
| Notifikasi Midtrans tidak masuk (WAF, TLS, redirect)    | Pelanggan bayar tapi belum aktif                                     | Rekonsiliasi cron + cek status saat halaman kembali; pengaturan zona di Phase 11; runbook |
| Pembalikan `settlement` → `deny` (Permata/Mandiri Bill) | Akses sudah diberikan                                                | Status `reversed` mencabut akses otomatis + peringatan                                    |
| Repo private → kuota menit GitHub Actions               | CI bisa tertahan atau berbayar                                       | Pantau pemakaian menit; Blacksmith/runner sendiri bila perlu                              |
| Belum terdaftar PSE                                     | Teguran sampai pemblokiran                                           | NIB + PSE di Phase 00, sebelum go-live                                                    |
| Pemilik sendirian menangani dukungan                    | Keluhan menumpuk                                                     | Halaman admin, peringatan email, runbook (Phase 09)                                       |

## 13. Log keputusan

| Tanggal    | Keputusan                                                                                                     | Oleh                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 2026-10-31 | Proposal awal tiga paket, pass 30 hari                                                                        | Proposal                                       |
| 2026-11-02 | Pemilik berstatus perorangan                                                                                  | Pemilik                                        |
| 2026-11-02 | Akun Midtrans production sudah aktif; metode yang diketahui aktif: QRIS                                       | Pemilik                                        |
| 2026-11-02 | Pembelian hanya di web; Android consumption-only; iOS tanpa UI paket sampai IAP                               | Pemilik                                        |
| 2026-11-02 | Paket habis: dokumen tetap bisa diedit, batas hanya untuk dokumen baru                                        | Pemilik                                        |
| 2026-11-02 | Aturan v2 di dokumen ini (antrean hari, kredit langsung, insight tidak dikunci, Snap redirect, kartu ditunda) | Rekomendasi Claude, menunggu keberatan pemilik |
