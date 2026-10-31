# Proposal monetisasi dan membership Rezumi — Indonesia

Tanggal: **31 Oktober 2026**. Status: **rekomendasi untuk diuji sebelum peluncuran**, bukan keputusan implementasi.

Konteks pemilik: **belum ada pengguna**. Belum tersedia data penggunaan, kemauan membayar, tagihan operasional, biaya akuisisi, atau pembelian ulang. Semua harga Rezumi, kuota usulan, biaya simulasi, dan target eksperimen dalam dokumen ini merupakan **asumsi**, bukan angka bisnis yang sudah terbukti.

Audit memakai checkout `72506ad`, kode web/mobile/API, dokumentasi produk, serta halaman resmi pembanding. “Sudah ada” berarti ditemukan implementasi atau dokumentasi pendukung; **bukan pernyataan sudah diuji di produksi, tersedia di toko aplikasi, atau sudah digunakan pelanggan**. Proposal ini tidak mengubah produk, menyalakan pembayaran, atau mengubah lisensi.

**Panduan membaca:** mulai dari bagian 1 untuk keputusan, bagian 6 untuk tabel paket, dan bagian 9 untuk hitungan uang. Bagian 10–12 membahas pertumbuhan dan validasi. Bagian 13 serta lampiran dapat dibaca kemudian bersama tim teknis. Istilah bisnis dijelaskan sebelum lampiran.

## 1. Rekomendasi yang saya pilih

**Mulai dengan tiga pilihan: Gratis, Plus Rp29.000/30 hari, Pro AI Rp79.000/30 hari. Jual akses 30 hari yang tidak otomatis diperpanjang.** Harga ini berlaku sebagai hipotesis checkout web; harga dan produk toko aplikasi perlu ditetapkan setelah biaya kanal diketahui.

| Paket      | Janji sederhana                                           |          Harga uji | Pembeda utama                                                                                                        |
| ---------- | --------------------------------------------------------- | -----------------: | -------------------------------------------------------------------------------------------------------------------- |
| **Gratis** | Buat CV layak kirim dan mulai melamar                     |                Rp0 | 3 CV aktif, 4 template, PDF tanpa watermark, pemeriksaan ATS dasar, pelacak lamaran manual                           |
| **Plus**   | Siapkan banyak versi lamaran dengan format lengkap        | Rp29.000 / 30 hari | 50 CV aktif, semua 18 template, Word/ODT, pengaturan desain lanjutan, insight lamaran, MCP/API untuk otomasi pribadi |
| **Pro AI** | Sesuaikan lamaran dan siapkan wawancara dengan bantuan AI | Rp79.000 / 30 hari | Semua Plus + 100 kredit AI yang biayanya ditanggung Rezumi, tanpa memasukkan API key                                 |

**Empat keputusan penting:**

1. PDF gratis harus benar-benar bisa dipakai melamar. Jangan menaruh watermark atau kejutan pembayaran setelah orang selesai mengisi CV.
2. “AI termasuk” berarti biaya penggunaan AI tertentu ditanggung Rezumi, dengan kuota jelas. Jangan menjanjikan AI unlimited.
3. Gunakan batas eksplisit 50 CV aktif untuk peluncuran; jangan menjual “unlimited” lalu menyembunyikan batas kecil. Naikkan atau hapus batas setelah distribusi penggunaan diketahui.
4. Tiga tier adalah eksperimen. **Plus paling rentan dianggap kurang bernilai.** Jika tidak punya pembeli dan alasan beli yang jelas, sederhanakan menjadi Gratis + Pro AI.

Posisi produk yang saya sarankan: **“Dari CV pertama sampai persiapan wawancara, semua bahan lamaran tersimpan dalam satu tempat.”** Untuk penawaran berbayar: **“Siapkan lamaran yang relevan untuk lowongan yang kamu pilih.”** Hindari janji pasti lolos ATS, pasti mendapat wawancara, atau pasti diterima kerja.

## 2. Penilaian terhadap usulan awal Anda

| Usulan                     | Penilaian saya                                                                    | Perubahan yang disarankan                                                                                                            |
| -------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Gratis maksimal 3 CV       | Layak diuji; cukup untuk CV umum, versi Indonesia, dan versi Inggris              | Definisikan sebagai 3 dokumen aktif bersamaan, bukan hanya boleh membuat 3 sepanjang hidup akun                                      |
| Template gratis terbatas   | Masuk akal sebagai pembeda, tetapi daya jualnya lemah jika berdiri sendiri        | Berikan template gratis berkualitas, termasuk beberapa satu kolom; jangan membuat versi gratis sengaja buruk                         |
| Level 1 CV unlimited       | Kebutuhan riilnya menyimpan versi untuk banyak lowongan, bukan angka tak terbatas | Mulai dengan 50 CV aktif untuk pemakaian pribadi; pisahkan pemakaian agensi/massal                                                   |
| Level 1 semua template     | Layak sebagai manfaat tambahan                                                    | Tambahkan ekspor Word/ODT dan pengelolaan pencarian kerja; jangan mengandalkan desain saja                                           |
| Level 1 MCP                | Berguna untuk pengguna mahir, kurang mudah dipahami pasar umum                    | Simpan sebagai bonus; jelaskan sebagai koneksi ke asisten AI eksternal, bukan judul utama paket                                      |
| Level 2 semua Level 1 + AI | Arah terkuat, tetapi definisinya belum cukup                                      | Jual pekerjaan konkret: sesuaikan CV, draf surat, analisis kecocokan, dan latihan wawancara; tampilkan kuota dan biaya tiap tindakan |

Tiga CV gratis memang bisa mencukupi banyak orang. Itu tidak otomatis salah. Gratis berfungsi membantu orang memperoleh hasil pertama dan percaya pada produk. Jika pengguna menghapus CV lama untuk menghindari batas, pelajari apakah manfaat menyimpan versi belum kuat; jangan langsung memperketat pembatasan.

Hipotesis saya: seseorang lebih mudah membayar untuk **menghemat kerja berulang saat melamar** daripada untuk menambah pilihan warna. Hipotesis ini harus dibuktikan melalui penggunaan dan pembayaran nyata.

## 3. Apa yang sudah dimiliki Rezumi

Produk sudah mencakup alur pencarian kerja yang luas. Kekurangan komersial utama saat ini adalah pengemasan manfaat, pembayaran, dan pengendalian biaya; bukan kekurangan daftar fitur.

| Kelompok             | Temuan pada produk saat ini                                                                    | Implikasi bisnis                                                                                                | Bukti                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Editor CV            | Edit isi, desain, preview PDF, autosave, undo, section dan layout                              | Pondasi aktivasi; harus nyaman di Gratis                                                                        | [README][k-readme]                                                        |
| Template             | 18 pilihan; metadata membedakan satu/dua kolom dan `atsSafe`                                   | Pembeda visual tersedia, tetapi bukan seluruh template berarti cocok untuk semua proses rekrutmen               | [Schema template][k-templates]                                            |
| Ekspor               | PDF, DOCX, **ODT**, Markdown, JSON                                                             | Word/ODT berpotensi menjadi pembeda Plus. README belum menyebut ODT; kode lebih mutakhir                        | [Ekspor web][k-export-web], [unduh mobile][k-download-mobile]             |
| Import               | JSON, JSON Resume, data LinkedIn, PDF terbaca; import Word memakai AI                          | Mempercepat perpindahan pengguna dari alat lama. Jalur tanpa AI perlu tetap tersedia                            | [FAQ produk][k-faq], [router AI][k-ai]                                    |
| Pemeriksaan ATS      | Checker publik memproses PDF di browser; pemeriksaan keterbacaan dan kata kunci tersedia       | Alat akuisisi yang relevan dan relatif hemat biaya komputasi server; pertahankan gratis                         | [Panduan ATS][k-ats]                                                      |
| Review AI            | Review tulisan dan usulan perbaikan baris; endpoint review sengaja tidak membuat skor ATS baru | Produk AI dapat membantu memperbaiki isi tanpa menjual angka peluang diterima yang tidak terukur                | [Router AI][k-ai]                                                         |
| Surat lamaran        | Dokumen mandiri, bisa terkait CV, punya editor, ekspor, dan riwayat                            | Nilai paket lamaran sudah ada; bukan fitur yang perlu dibangun dari nol                                         | [README][k-readme], [router utama][k-router]                              |
| Library dan riwayat  | Tag, pencarian, versi, Trash dengan masa pemulihan                                             | Mendukung banyak versi lamaran; recovery dasar jangan dijadikan ancaman kehilangan data                         | [README][k-readme]                                                        |
| Berbagi CV           | Tautan publik, password, kendali privasi, statistik kunjungan/unduh                            | Membantu distribusi. Privasi dasar tetap gratis; statistik bisa menjadi manfaat tambahan                        | [README][k-readme], [FAQ][k-faq]                                          |
| Domain sendiri       | Endpoint memasang dan memverifikasi domain untuk CV utama sudah ada                            | Kandidat tambahan Plus nanti; bukan “domain gratis”. Operasi DNS/TLS dan biaya registrar tetap perlu dibuktikan | [Custom domain][k-domain]                                                 |
| Pelacak lamaran      | List, board, calendar, insights, kontak, catatan, interview, CSV, dokumen terkirim             | Membuat produk berguna setelah CV pertama selesai; fungsi manual dasar tetap terbuka                            | [README][k-readme], [router aplikasi][k-applications]                     |
| Penyesuaian lamaran  | Autofill, pencocokan, draf pesan, tailoring yang membuat CV baru                               | Inti monetisasi AI; hasil tailoring harus ikut menghitung slot CV                                               | [AI aplikasi][k-application-ai]                                           |
| Knowledge            | Fakta pengalaman, cerita, preferensi karier dan scope per lamaran                              | Pembeda terhadap chatbot umum: konteks dapat dipakai ulang dengan kendali pengguna                              | [Career overview][k-career-guide], [router Career][k-career]              |
| Workspace pekerjaan  | Fit, Apply, Prepare, Practice, Debrief, Messages, Saved                                        | Pro AI bisa dijual sepanjang proses melamar, bukan sekadar “AI menulis CV”                                      | [Referensi workspace][k-workspace-guide]                                  |
| Coach                | Percakapan berkonteks, usulan edit, tool loop, persetujuan untuk tindakan tertentu             | Bernilai tinggi, tetapi satu pesan bisa mahal; perlu tarif dan batas kerja                                      | [Service agent][k-agent]                                                  |
| Latihan suara        | Transkripsi dan pembacaan pertanyaan memakai provider tertentu; ada fallback sesuai platform   | Sudah punya fondasi, tetapi biaya suara terpisah dari teks. Jangan masukkan tanpa batas ke harga peluncuran     | [Router voice][k-voice], [referensi workspace][k-workspace-guide]         |
| Penjadwalan          | Discovery lowongan, briefing sebelum interview, pengingat; hasil masuk ke Today                | Membantu kunjungan ulang; pencarian web, AI, dan pengingat biasa mempunyai struktur biaya berbeda               | [Jobs][k-jobs], [panduan discovery][k-discovery]                          |
| Perbandingan tawaran | Perbandingan offer tersedia; perbandingan manual tidak memerlukan AI                           | Berguna pada akhir perjalanan; bukan alasan utama pengguna baru membeli                                         | [Career overview][k-career-guide]                                         |
| MCP dan API          | Operasi dokumen/lamaran memanggil router bisnis yang sama; beberapa tool juga memicu AI        | Bonus distribusi/otomasi. Gate paket dan biaya AI harus berlaku juga pada jalur ini                             | [MCP tools][k-mcp]                                                        |
| Mobile               | Ekspor dan workspace pekerjaan memiliki implementasi native                                    | Entitlement, kuota, dan hasil pembelian harus konsisten antarperangkat                                          | [Unduh mobile][k-download-mobile], [workspace mobile][k-workspace-mobile] |

### Temuan yang mengubah rancangan membership

**AI sudah ada; model pembiayaannya belum berupa membership.** Pengguna dapat menyimpan koneksi provider sendiri. Ada juga provider global milik operator. Saat provider global aktif, resolver mendahulukannya dan pengaturan provider personal dibatasi. Jadi menambahkan managed AI untuk sebagian pelanggan sambil mempertahankan BYOK perlu perubahan resolver, bukan sekadar memasang satu API key global. [Sumber kode][k-providers]

**Pencarian lowongan tidak sama dengan AI teks.** Discovery menggunakan layanan pencarian dan pembacaan halaman; panduan menyatakan koneksi AI teks tidak diperlukan hanya untuk menjadwalkan pencarian. Jangan menghitung seluruh biaya discovery sebagai token AI, dan jangan menyebutnya otomatis melamar pekerjaan. [Jobs][k-jobs], [panduan discovery][k-discovery]

**Sudah ada rate limit dan metadata token, tetapi itu belum menjadi buku saldo pelanggan.** Agent mencatat usage, memiliki batas 30 langkah, output hingga 8.192 token per panggilan model, dan retry model. Batas tersebut bukan jatah rupiah per bulan. Dibutuhkan pencatatan biaya dan saldo yang konsisten untuk semua jalur. [Service agent][k-agent], [rate limit][k-rate]

**Pembayaran dan entitlement komersial belum saya temukan dalam scope yang ditelusuri.** Pemeriksaan router utama, schema DB/auth, API, env, server, dan pencarian istilah integrasi pembayaran tidak menunjukkan fondasi paket, order, payment webhook, atau saldo kredit komersial. Field `remaining` pada API key adalah mekanisme API key, bukan bukti wallet AI. Ini kesimpulan audit source terbatas, bukan audit seluruh sistem eksternal. [Router][k-router], [schema DB][k-db], [schema auth][k-auth]

## 4. Segmen Indonesia yang layak didahulukan

“Indonesia” masih terlalu luas untuk menentukan produk berbayar. Saya sarankan **pencari kerja aktif untuk posisi kantor/digital, pengalaman sekitar 0–5 tahun, sedang menargetkan beberapa lowongan** sebagai segmen uji awal. Ini pilihan strategi, bukan data bahwa kelompok tersebut pasti mau membayar.

| Segmen                                     | Kebutuhan yang diuji                                                             | Paket masuk                                      | Prioritas                                               |
| ------------------------------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------- |
| Fresh graduate yang aktif melamar          | Mengubah proyek kuliah, magang, organisasi menjadi pengalaman yang jelas         | Gratis, lalu Plus/Pro AI saat ada lowongan nyata | Tinggi untuk aktivasi; sensitivitas harga perlu diukur  |
| Profesional awal karier / pindah pekerjaan | Versi CV spesifik posisi, bahasa Inggris, persiapan interview, balasan recruiter | Pro AI                                           | Tinggi untuk uji kemauan membayar                       |
| Mahasiswa yang belum mulai melamar         | CV pertama dan persiapan pengalaman                                              | Gratis                                           | Distribusi, bukan sasaran omzet pertama                 |
| Pengguna teknis dengan asisten AI sendiri  | MCP, API, BYOK, dokumen yang terstruktur                                         | Plus                                             | Niche; bagus sebagai channel khusus                     |
| Kampus, bootcamp, komunitas karier         | Akses bagi satu angkatan dan pendampingan terstruktur                            | Voucher Pro AI per peserta                       | Tahap berikutnya; mulai pilot tanpa dashboard institusi |
| Agen pembuat CV / pemakaian massal         | Banyak identitas, volume ekspor, tim                                             | Paket bisnis terpisah nanti                      | Jangan disubsidi oleh paket personal                    |

Untuk peluncuran, materi contoh harus dekat dengan penggunaan lokal: pengalaman magang, organisasi, proyek kampus, UMKM, dan pencapaian tanpa angka yang dikarang. Sediakan contoh Indonesia dan Inggris. Tampilkan Rupiah, masa berlaku jelas, serta waktu interview WIB/WITA/WIT sesuai preferensi pengguna.

Jangan memperlakukan semua pengguna Indonesia sebagai “hanya mau gratis”. Jangan pula menyalin harga Amerika lalu mengonversinya ke Rupiah. Ukur manfaat pada segmen yang benar-benar sedang membutuhkan pekerjaan.

## 5. Pembanding pasar dan pelajaran yang relevan

Halaman resmi diperiksa 31 Oktober 2026. Harga promosi, mata uang, dan cakupan dapat berubah. Ini pembanding penawaran, **bukan bukti volume penjualan atau kesediaan membayar pengguna Rezumi**.

| Produk                 | Yang terlihat saat diperiksa                                                                                                                        | Pelajaran untuk Rezumi                                                                                                                                                                                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **BikinCV**            | Halaman harga menampilkan contoh CV Rp39.500–Rp44.500; template Uluwatu promo Rp19.995 dari Rp29.500                                                | Ada penawaran lokal dalam puluhan ribu Rupiah. Bandingkan hasil dan masa akses; jangan menyamakan harga satu template dengan seluruh membership. [Harga BikinCV](https://www.bikincv.com/harga)                                                                                       |
| **Dealls CV Reviewer** | Halaman reviewer menampilkan promo Rp29 ribu dari Rp100 ribu. Artikel resmi sebelumnya menyebut pengecekan dasar gratis                             | Review CV sendiri sudah punya pembanding murah/gratis. Cakupan gratis dan promo perlu dicek di checkout; jangan menganggap seluruh produk gratis. [Reviewer Dealls](https://dealls.com/en/cv-reviewer), [artikel resmi](https://dealls.com/pengembangan-karir/cara-membuat-cv-di-hp/) |
| **Cake**               | Gratis: 1 CV dan 60 kredit/bulan; berbayar: CV tidak terbatas dan 600 kredit/bulan. Halaman berbahasa Indonesia yang terbaca justru menampilkan GBP | Mendukung gagasan batas dokumen + kredit AI. Harga GBP tersebut bukan harga Rupiah terverifikasi, sehingga tidak dipakai menentukan harga Indonesia. [Paket Cake](https://www.cake.me/pricing?locale=id)                                                                              |
| **Teal**               | CV dan job tracking unlimited ada pada Gratis; Teal+ US$29/30 hari dan US$79/90 hari                                                                | Unlimited CV bukan pembeda universal. Nilai perlu datang dari bantuan kerja yang lebih mendalam. [Paket Teal](https://www.tealhq.com/pricing)                                                                                                                                         |
| **Kickresume**         | Premium US$24/bulan; kuartal US$54 total; tahunan US$96 total                                                                                       | Contoh bundel template dan AI, tetapi harga global bukan patokan kemampuan bayar lokal. [Paket Kickresume](https://www.kickresume.com/en/pricing/)                                                                                                                                    |
| **Reactive Resume**    | Memasarkan builder dan career manager gratis, open source, dengan ekspor PDF/Word dan tanpa paywall                                                 | Alternatif gratis sangat dekat. Rezumi perlu menang lewat kemudahan, relevansi Indonesia, layanan terkelola, dan distribusi. [Situs resmi](https://rxresu.me/)                                                                                                                        |

Kesimpulan strategi saya: **“template lebih banyak + AI generik” mudah dibandingkan dan diganti.** Nilai yang lebih defensif adalah pengalaman pengguna yang tersimpan, dokumen per lowongan, bukti pendukung jawaban, dan persiapan interview dalam satu alur yang mudah dipakai.

## 6. Rancangan tier secara rinci

Seluruh pembatasan di bawah merupakan **usulan baru untuk layanan hosted Rezumi**, bukan deskripsi batas yang sudah aktif. Baris bertanda “nanti” tidak masuk janji peluncuran.

| Manfaat                                                           | Gratis                                                  | Plus                                                          | Pro AI                                         |
| ----------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------- |
| Harga uji web                                                     | Rp0                                                     | Rp29.000 / 30 hari                                            | Rp79.000 / 30 hari                             |
| CV aktif                                                          | 3                                                       | 50                                                            | 50                                             |
| Surat lamaran aktif                                               | 3                                                       | 50                                                            | 50                                             |
| Template                                                          | 4                                                       | Semua 18                                                      | Semua 18                                       |
| PDF tanpa watermark                                               | Ya                                                      | Ya                                                            | Ya                                             |
| Markdown, JSON, ekspor data akun                                  | Ya                                                      | Ya                                                            | Ya                                             |
| Ekspor baru Word dan ODT                                          | Tidak                                                   | Ya                                                            | Ya                                             |
| Warna, font bawaan, pengaturan halaman dasar                      | Ya                                                      | Ya                                                            | Ya                                             |
| Custom Styles dan unggah font sendiri                             | Tidak                                                   | Ya                                                            | Ya                                             |
| Autosave, undo, pemulihan dasar, akses riwayat                    | Ya                                                      | Ya                                                            | Ya                                             |
| ATS lokal, tampilan teks terbaca, pencocokan kata kunci dasar     | Ya                                                      | Ya                                                            | Ya                                             |
| Tracker manual: daftar/board/calendar, catatan, status, interview | Ya                                                      | Ya                                                            | Ya                                             |
| Insight agregat pencarian kerja                                   | Ringkasan dasar                                         | Lengkap                                                       | Lengkap                                        |
| Knowledge dan perbandingan offer manual                           | Ya                                                      | Ya                                                            | Ya                                             |
| Link CV, password, kendali privasi                                | Ya, untuk CV aktif                                      | Ya                                                            | Ya                                             |
| Sinkronisasi web/mobile                                           | Ya                                                      | Ya                                                            | Ya                                             |
| MCP jarak jauh / API untuk otomasi pribadi                        | Tidak; ekspor data tetap terbuka                        | Ya, dengan rate limit                                         | Ya, dengan rate limit                          |
| AI dengan API key sendiri / BYOK                                  | Ya, opsi lanjutan                                       | Ya, opsi lanjutan                                             | Ya, opsi lanjutan                              |
| AI yang dibayar Rezumi                                            | 5 kredit percobaan sekali per akun yang memenuhi syarat | Tidak ada jatah rutin; sisa trial yang sah tetap bisa dipakai | 100 kredit per masa akses 30 hari              |
| Menambah kredit berbayar                                          | Belum ditawarkan                                        | Belum ditawarkan                                              | Nanti, setelah biaya nyata diketahui           |
| Pencarian web/suara memakai koneksi sendiri                       | Tetap mengikuti dukungan produk dan batas penggunaan    | Sama                                                          | Sama                                           |
| Web research, discovery otomatis, suara yang dibayar Rezumi       | Tidak termasuk peluncuran                               | Tidak termasuk peluncuran                                     | Kandidat tambahan berkuota, **belum termasuk** |
| Sambungkan domain milik sendiri                                   | Nanti, bukan manfaat peluncuran                         | Kandidat tambahan                                             | Kandidat tambahan                              |

### Alasan batas dan pengecualian

**Template gratis:** kandidat awal Bronzor, Onyx, Rhyhorn, dan Azurill. Tiga pertama ditandai satu kolom/ATS-safe pada schema; Azurill memberi pilihan visual dua kolom. Empat ini tetap perlu diuji pada konten Indonesia sebelum dipasang sebagai default. Semua template boleh dipratinjau; label premium harus terlihat sebelum pengguna menghabiskan waktu mendesain. [Metadata template][k-templates]

**50 CV bukan angka ilmiah.** Ini batas peluncuran yang mudah dijelaskan. Ukur apakah pengguna personal yang sah mendekatinya. Surat lamaran punya slot terpisah karena pengguna mungkin memakai satu CV untuk beberapa surat. Riwayat dokumen tidak memakan slot CV baru; duplikasi, import, dan hasil tailoring yang menjadi dokumen baru memakan slot.

**BYOK tetap tersedia:** pengguna membayar provider AI sendiri. Biaya itu tidak termasuk harga Plus dan bukan kredit gratis dari Rezumi. Saya menyarankan mempertahankannya sebagai opsi lanjutan agar komunitas teknis tidak kehilangan kemampuan yang sudah ada. Pro AI menjual kemudahan tanpa API key. Ini sengaja berbeda dari “semua akses AI harus Level 2”. Jika BYOK ternyata sangat membebani dukungan, ukur bebannya sebelum mengubah paket.

**MCP bukan paket token.** Asisten eksternal dapat memakai modelnya sendiri untuk menyusun perubahan CV; biaya model eksternal ditanggung pengguna. Tetapi tool MCP yang memanggil AI milik Rezumi tetap harus mengurangi kredit Rezumi. API yang dipakai aplikasi web/mobile sendiri tidak boleh ikut terputus hanya karena paket Gratis tidak mendapat akses otomasi eksternal. WebMCP di browser juga perlu dibedakan dari layanan MCP jarak jauh.

**Batas dokumen bukan batas unduhan.** Mengunduh PDF yang sama berulang tidak memakai kredit AI. Tetap ada rate limit, batas ukuran unggahan, dan proteksi penyalahgunaan yang dijelaskan terpisah. Hindari tambahan puluhan kuota di pricing page sebelum ada bukti kebutuhan.

## 7. Bentuk pembelian dan siklus membership

### Mulai dari akses 30 hari

Penggunaan pencarian kerja diduga episodik: intensif saat melamar, turun setelah mendapat pekerjaan. Karena belum ada data Rezumi, ini hipotesis yang perlu dipantau. Paket 30 hari mengurangi kekhawatiran lupa membatalkan dan cocok diuji dengan pembayaran satu kali.

Tulis **“Rp79.000 untuk akses 30 hari, tidak diperpanjang otomatis”**, bukan sekadar “Rp79.000/bulan” jika tidak ada langganan otomatis. Masa akses dimulai setelah pembayaran berhasil terverifikasi server. Tampilkan tanggal dan jam berakhir dalam zona waktu pengguna.

| Produk tambahan            | Keputusan                                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Akses 90 hari              | Kandidat fase berikutnya: Plus Rp69.000, Pro AI Rp199.000. Jangan tampilkan sebelum ada bukti penggunaan berulang         |
| Kuota Pro AI 90 hari       | Jika diluncurkan: 100 kredit pada awal setiap interval 30 hari, bukan 300 sekaligus; ketentuan sisa kredit harus terlihat |
| Paket tahunan              | Tunda sampai ada alasan dipakai sepanjang tahun                                                                           |
| Lifetime dengan managed AI | Tolak; pendapatan sekali, biaya provider berlangsung terus                                                                |
| Paket mingguan             | Tunda; jangan membuat harga terlihat murah lewat periode yang pendek dan membingungkan                                    |
| Auto-renew                 | Tambahkan hanya jika ada permintaan nyata; opt-in eksplisit dan pembatalan mudah                                          |

**Upgrade Plus → Pro AI di tengah masa akses:** rancangan sederhana untuk web adalah mulai Pro AI 30 hari baru, kurangi tagihannya dengan nilai sisa hari Plus: `Rp29.000 × sisa detik / total detik periode Plus`. Entitlement Plus lama diganti, bukan ditumpuk; kredit trial tidak diberikan ulang. Contoh sisa tepat 15 dari 30 hari: kredit nilai Rp14.500, pembayaran Pro AI Rp64.500. Rekonsiliasi dan refund harus memakai harga transaksi aktual. Produk toko aplikasi mengikuti mekanisme yang didukung toko, bukan dipaksa meniru rumus web.

### Setelah akses habis

1. Akun kembali ke Gratis; tidak ada tagihan otomatis.
2. Seluruh data tetap bisa dibaca dan diekspor sebagai data akun. Pengguna memilih sampai 3 CV dan 3 surat yang tetap aktif; sisanya arsip baca saja. Jangan menghapus otomatis karena paket habis.
3. Dokumen yang sudah dibuat dengan template premium mempertahankan desainnya; tidak diganti paksa. Template premium baru/duplikasi premium memerlukan akses aktif. Ini berarti sebagian manfaat pembelian tetap melekat pada dokumen, dan itu disengaja.
4. PDF dokumen lama tetap dapat diunduh. File yang sudah diunduh tetap milik pengguna. Ekspor baru Word/ODT mengikuti paket saat tindakan dilakukan.
5. Tautan CV yang sudah dibagikan tidak langsung mati karena masa bayar habis; pertahankan versi terakhir yang diterbitkan. Pembaruan mengikuti dokumen aktif. Pemilik selalu dapat mematikan link atau menghapus data.
6. Managed AI berhenti saat kredit atau masa akses habis. Hasil AI yang sudah disimpan tetap bisa dibaca. BYOK tetap mengikuti opsi akun dan batas sumber daya.
7. Jika kelak ada tugas terjadwal berbayar, hentikan pemakaian biaya setelah entitlement berakhir; beri tahu pengguna sebelum jadwal berikutnya terlewat.

Arsip membership dan perlindungan desain/link tersebut **belum dianggap tersedia**; perlu implementasi. Jangan memakai Trash sebagai arsip membership karena Trash saat ini punya masa penghapusan.

Usulan layanan pelanggan: jalur jelas untuk pembayaran ganda, akses tidak aktif, dan kegagalan teknis. Pertimbangkan pengembalian dana 7 hari bagi pembelian pertama dengan pemakaian managed AI maksimal 10 kredit; itu rancangan kebijakan komersial, bukan pernyataan hak hukum. Ketentuan wajib dan aturan refund toko tetap berlaku. Jangan menjadikan “belum mendapat kerja” sebagai janji refund berbasis hasil.

## 8. Cara menjual AI tanpa membiarkan biaya lepas kendali

### Kredit harus bisa dipahami sebelum dipakai

Kredit adalah satuan manfaat pelanggan; token adalah satuan tagihan provider. Jangan memaksakan pengguna awam memahami token. Tampilkan contoh: **“Sesuaikan CV untuk lowongan ini: 5 kredit.”** Batas input dan lingkup hasil harus jelas sebelum tindakan dimulai.

Usulan bobot awal berikut **harus dikalibrasi melalui pengukuran biaya**. Jangan dipublikasikan sebagai harga tetap sebelum diuji.

| Tindakan                                     | Kredit uji | Batas pekerjaan yang ditawarkan                                                   |
| -------------------------------------------- | ---------: | --------------------------------------------------------------------------------- |
| Perbaiki satu bullet / ringkasan pendek      |          1 | Satu hasil untuk teks pendek dengan batas karakter                                |
| Draf jawaban formulir / balasan recruiter    |          2 | Satu jawaban dari pengalaman yang pengguna sediakan                               |
| Draf surat lamaran                           |          3 | Satu surat untuk satu lowongan                                                    |
| Review CV atau analisis kecocokan            |          4 | Satu dokumen dan satu lowongan                                                    |
| Sesuaikan satu CV                            |          5 | Satu versi baru, perubahan dapat ditinjau                                         |
| Satu latihan jawaban interview berbasis teks |          3 | Satu jawaban dan feedback; bukan sesi suara unlimited                             |
| Satu putaran coach teks yang dibatasi        |          3 | Batas konteks, output, dan langkah yang diterangkan; bukan agent bebas 30 langkah |
| Impor PDF/Word memakai model                 |          5 | Batas halaman/ukuran; import non-AI tetap menjadi alternatif                      |

Contoh 100 kredit: **8 paket** masing-masing tailoring CV (5) + surat (3) + fit review (4) = 96 kredit; sisa 4 untuk perbaikan pendek. Ini contoh kapasitas, bukan janji 100 kredit selalu berarti 100 lamaran. Paket kerja “CV + surat + cek kecocokan” merupakan pengemasan alur yang perlu dirapikan, bukan klaim tombol gabungannya sudah ada.

### Aturan saldo yang disarankan

- Trial 5 kredit diberikan sekali setelah email terverifikasi dan pengguna memiliki CV/lowongan yang bisa diproses. Berlaku 14 hari sejak diberikan; syarat terlihat sebelum aktivasi. Tidak meminta kartu.
- Trial cukup untuk satu hasil bernilai, misalnya tailoring 5 kredit atau review 4 kredit + satu perbaikan. Jangan membagikan ulang trial saat logout, upgrade, atau membuat dokumen baru.
- Kredit paket berlaku selama masa akses. Tidak rollover pada rancangan awal; tampilkan sisa dan tanggal habis. Harga harus tetap terasa layak meskipun tidak semua kredit dipakai.
- Pesan gagal tanpa hasil yang bisa dipakai mengembalikan kredit pelanggan. Biaya provider yang telanjur muncul tetap dicatat sebagai biaya kegagalan Rezumi.
- Klik ganda dan retry jaringan tidak boleh menagih dua kali. Pembatalan setelah hasil sebagian tersedia perlu aturan eksplisit; rekomendasi awal: jangan potong kredit jika hasil tidak berhasil disimpan untuk pengguna.
- Jika nanti ada top-up, pisahkan kredit dibeli dari kredit paket/trial. Jangan otomatis menerapkan kedaluwarsa 30 hari pada saldo dibeli; kebijakan toko dan ketentuan produk dapat berbeda. Tunda top-up sampai aturan dan biaya jelas.
- BYOK tidak memotong kredit managed AI. UI wajib menyebut sumber biaya sebelum setiap proses; jangan diam-diam berpindah ke managed AI ketika key pribadi gagal.

### Batas internal yang wajib ada sebelum menjual

Tetapkan budget maksimum untuk setiap tindakan, bukan hanya batas per menit. Agent yang sekarang dapat mengambil 30 langkah perlu mode kerja terbatas untuk paket konsumen. Ukur input, output termasuk reasoning, seluruh langkah, retry, tool web, dan suara. Reservasi kredit dilakukan sebelum kerja; finalisasi atau pelepasan reservasi dilakukan secara atomik dan dapat dipulihkan setelah proses mati.

Biaya satu akun harus dibatasi lewat desain pekerjaan dan kuota yang diumumkan. **Jangan menjual 100 kredit lalu diam-diam menghentikan pelanggan pada kredit ke-40 karena biaya internal mahal.** Jika tindakan tidak dapat diselesaikan dalam budget, perbaiki implementasi, bobot, atau harga untuk pembelian berikutnya; jelaskan kegagalan dan kembalikan kredit.

Discovery otomatis perlu meter terpisah untuk jumlah pencarian, negara target, dan pembacaan halaman; satu jadwal tidak selalu sama dengan satu request. Latihan suara perlu meter menit/transkripsi/speech. Keduanya belum termasuk managed AI saat peluncuran.

## 9. Keuangan: harga terjangkau belum tentu bisnis sehat

### 9.1 Struktur biaya yang harus dicatat

| Jenis biaya                         | Penggerak                                                      | Perlakuan dalam perhitungan                                                   |
| ----------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Infrastruktur dasar                 | Workers, database, storage dasar, email, monitoring            | Anggaran tetap minimum; jangan dihitung lagi sebagai biaya variabel yang sama |
| Penggunaan pengguna gratis          | Database tambahan, file, trafik, dukungan                      | Biaya per pengguna gratis aktif, termasuk jika tidak pernah membayar          |
| AI dan tools                        | Token, langkah agent, retry, search, parsing, suara            | Catat per tindakan dan akun; tidak cukup hanya tagihan total provider         |
| Pembayaran                          | Kanal web/toko, jenis produk, refund, chargeback, settlement   | Gunakan fee kontrak aktual; pisahkan setiap kanal                             |
| Layanan pelanggan                   | Waktu menangani akun, billing, provider, kualitas hasil        | Waktu founder tetap biaya ekonomi walau belum dibayar sebagai gaji            |
| Akuisisi                            | Iklan, komisi partner, insentif trial, konten, waktu pemasaran | Pisahkan dari margin per pelanggan agar tidak terlihat seolah gratis          |
| Pengembangan dan operasional bisnis | Gaji, perangkat, akuntansi, pajak                              | Masuk laba/rugi dan arus kas, bukan dianggap tertutup oleh omzet              |

PDF di browser/native dapat mengurangi komputasi server. Namun API/MCP dan unduhan tertentu tetap bisa merender di server; data, penyimpanan, backup, dan dukungan tetap berbiaya. Jangan menganggap satu export selalu nol biaya. [Ekspor web][k-export-web], [ekspor server][k-export-server]

### 9.2 Contoh biaya AI dari tarif publik

Sebagai **contoh hitung, bukan pemilihan model final**, tarif standar Gemini 2.5 Flash yang tercantum saat riset adalah US$0,30 per satu juta token input teks dan US$2,50 per satu juta token output, termasuk thinking. Pemakaian search memiliki biaya tersendiri. [Harga resmi Google](https://ai.google.dev/gemini-api/docs/pricing#gemini-2.5-flash)

Dengan asumsi kurs perencanaan **Rp17.000/US$**, bukan kurs pasar yang diverifikasi:

```text
Satu panggilan: 4.000 token input + 1.200 token output tertagih
Biaya = ((4.000 × 0,30 + 1.200 × 2,50) / 1.000.000) × 17.000
      = US$0,0042 × 17.000
      = Rp71,40
```

Ini belum mencakup retry, beberapa putaran model, konteks percakapan yang dikirim ulang, tools, suara, pajak, dan selisih kurs pembayaran. Tiga puluh panggilan dengan ukuran sama saja menjadi Rp2.142; ukuran konteks nyata bisa bertambah. Karena itu **satu pesan chat tidak boleh diasumsikan sama dengan Rp71**. Jika kurs asumsi berubah dari Rp17.000 menjadi Rp18.500, biaya komponen USD naik sekitar 8,8%.

Pilih model melalui sampel CV Indonesia/Inggris yang sudah dianonimkan atau fiktif: cek fakta, kualitas bahasa, kemampuan menyusun output, kecepatan, dan biaya. Jangan mengandalkan promosi/free allowance provider untuk membenarkan margin permanen.

### 9.3 Biaya pembayaran Indonesia

Halaman Midtrans menampilkan QRIS umum 0,7%, transfer bank Rp4.000/transaksi, serta catatan bahwa **perusahaan gaming dan produk digital dapat dikenai tarif berbeda**. Jadi tarif 0,7% belum dapat dianggap berlaku untuk membership Rezumi. Minta penawaran sesuai klasifikasi usaha, termasuk pajak fee, settlement, dan refund. [Biaya Midtrans](https://midtrans.com/id/biaya)

Implikasi hitung sendiri: fee tetap Rp4.000 setara **13,8%** dari transaksi Rp29.000, atau **5,1%** dari Rp79.000, sebelum komponen tambahan. Utamakan pengalaman QRIS/e-wallet yang lancar di web jika fee aktualnya sesuai; tetap sediakan alternatif yang ekonomis. Hindari bundel kredit Rp5.000 yang habis oleh biaya tetap.

### 9.4 Margin kontribusi per pembelian 30 hari

**Margin kontribusi** adalah uang tersisa setelah biaya langsung untuk melayani pembelian, sebelum biaya tetap dan biaya memperoleh pembeli. Ini **bukan laba bersih**.

Asumsi kerja: biaya pembayaran web efektif 3%, cadangan refund/kegagalan transaksi 2% dari nilai penjualan, biaya layanan variabel non-AI Rp3.000 untuk Plus dan Rp4.000 untuk Pro AI, serta anggaran AI Rp15.000 untuk seluruh 100 kredit Pro AI. Angka 3% adalah placeholder, bukan penawaran Midtrans. Angka AI Rp15.000 adalah target anggaran yang harus diuji pada pemakaian penuh, bukan biaya yang sudah diukur.

| Komponen per pembelian                              |         Plus |       Pro AI |
| --------------------------------------------------- | -----------: | -----------: |
| Harga model sebelum memperhitungkan pajak penjualan |     Rp29.000 |     Rp79.000 |
| Fee pembayaran asumsi 3%                            |        Rp870 |      Rp2.370 |
| Cadangan refund asumsi 2%                           |        Rp580 |      Rp1.580 |
| Layanan variabel non-AI                             |      Rp3.000 |      Rp4.000 |
| Anggaran managed AI                                 |          Rp0 |     Rp15.000 |
| **Kontribusi per pembelian**                        | **Rp24.550** | **Rp56.050** |
| **Margin kontribusi**                               |    **84,7%** |    **70,9%** |

Biaya trial dihitung terpisah, termasuk ketika penerimanya akhirnya membeli Plus. Pajak atas penjualan/penghasilan belum dimodelkan; bila harga checkout termasuk pajak penjualan, hitung pendapatan bersih pajak terlebih dahulu. Tampilkan total akhir dengan jelas ke pembeli. Simulasi ini tidak boleh disebut laba setelah pajak.

**Sensitivitas Pro AI pada harga Rp79.000:**

| Skenario                  | Biaya AI |                 Fee kanal | Kontribusi sebelum biaya tetap/akuisisi/pajak |
| ------------------------- | -------: | ------------------------: | --------------------------------------------: |
| Pemakaian ringan          |  Rp5.000 |                    Web 3% |                              Rp66.050 / 83,6% |
| Anggaran dasar            | Rp15.000 |                    Web 3% |                              Rp56.050 / 70,9% |
| Pemakaian mahal           | Rp30.000 |                    Web 3% |                              Rp41.050 / 52,0% |
| Biaya AI tidak terkendali | Rp60.000 |                    Web 3% |                              Rp11.050 / 14,0% |
| Toko dengan fee 15%       | Rp15.000 | 15%, menggantikan fee web |                              Rp46.570 / 58,9% |
| Stress test fee toko 30%  | Rp15.000 | 30%, menggantikan fee web |                              Rp34.720 / 43,9% |

Seluruh baris tetap memakai cadangan refund Rp1.580 dan biaya non-AI Rp4.000. Jangan menjumlahkan fee web 3% lagi pada transaksi toko. Fee toko aktual bergantung program, region, jenis produk, pajak, dan kontrak; tabel adalah sensitivitas.

Apple Small Business Program menawarkan komisi 15% untuk peserta yang memenuhi syarat. Google Play mencantumkan tier 15% bagi developer yang terdaftar untuk US$1 juta pertama di pasar yang masih mengikuti skema tersebut; tarif subscription auto-renew berbeda konteks dari pass non-renewing. Jangan menganggap fee rendah berlaku otomatis. [Apple Small Business](https://developer.apple.com/app-store/small-business-program/), [Google Play service fees](https://support.google.com/googleplay/android-developer/answer/112622?hl=en)

### 9.5 Skenario usaha pada 1.000 pengguna aktif per 30 hari

**Ini ilustrasi matematika, bukan ramalan mencapai 1.000 pengguna.** Pengguna aktif berarti orang yang melakukan pekerjaan bermakna, bukan pengunjung halaman harga. Semua pembeli dalam tabel membeli satu paket 30 hari pada periode tersebut; campuran pembeli diasumsikan 60% Plus dan 40% Pro AI. Belum ada diskon, paket 90 hari, atau transaksi toko.

Asumsi lain:

- Biaya tetap Rp1.500.000 per periode: pos perencanaan untuk infrastruktur dasar dan operasional minimum; bukan tagihan aktual.
- Biaya variabel pengguna gratis Rp300 per pengguna gratis aktif, di luar biaya tetap tadi dan di luar trial.
- 200 penerima trial baru per periode, dengan cadangan biaya Rp1.500 per penerima: Rp300.000. Jangan mengulang trial untuk orang yang sama pada periode berikutnya.
- Pendapatan rata-rata per pembelian = `60% × 29.000 + 40% × 79.000` = **Rp49.000**.
- Kontribusi rata-rata per pembelian = `60% × 24.550 + 40% × 56.050` = **Rp37.150**.

| Pembeli dalam periode | Proporsi dari 1.000 aktif | Penjualan paket | Total kontribusi pembeli | Biaya pengguna gratis | Biaya trial | Biaya tetap | Sisa sebelum akuisisi, pajak, dan gaji founder |
| --------------------- | ------------------------: | --------------: | -----------------------: | --------------------: | ----------: | ----------: | ---------------------------------------------: |
| 10                    |                        1% |       Rp490.000 |                Rp371.500 |             Rp297.000 |   Rp300.000 | Rp1.500.000 |                               **−Rp1.725.500** |
| 30                    |                        3% |     Rp1.470.000 |              Rp1.114.500 |             Rp291.000 |   Rp300.000 | Rp1.500.000 |                                 **−Rp976.500** |
| 50                    |                        5% |     Rp2.450.000 |              Rp1.857.500 |             Rp285.000 |   Rp300.000 | Rp1.500.000 |                                 **−Rp227.500** |
| 100                   |                       10% |     Rp4.900.000 |              Rp3.715.000 |             Rp270.000 |   Rp300.000 | Rp1.500.000 |                                **Rp1.645.000** |

**Margin produk tinggi tidak otomatis menutup biaya banyak pengguna gratis.** Proporsi pembeli pada tabel bukan angka konversi yang sudah terbukti, dan tidak sama dengan conversion rate pengunjung → pembeli.

Rumus titik impas, dengan `P` pembeli dan jumlah aktif tetap 1.000:

```text
Sisa = 37.150P − 300(1.000 − P) − 300.000 − 1.500.000
     = 37.450P − 2.100.000
Impas sekitar 57 pembelian paket per 30 hari (campuran paket dipertahankan).
```

Jika seluruh pembeli baru memerlukan biaya akuisisi tambahan Rp15.000/orang, titik impas naik menjadi sekitar **94 pembelian**. Jika ditambahkan target gaji founder Rp5.000.000 tanpa biaya akuisisi tadi, perlu sekitar **190 pembelian**. Jumlah riil bergantung campuran paket, free usage, harga, kanal, dan biaya yang benar-benar terjadi.

Akses 30 hari yang tidak auto-renew **jangan disebut MRR yang terjamin**. Pantau penjualan, periode layanan, arus kas, dan pembelian ulang per angkatan pengguna. Untuk paket 90 hari, uang diterima di depan bukan seluruhnya ruang belanja bebas: layanan dan AI masih harus dibiayai selama 90 hari.

Simulasi belum memasukkan penumpukan data pengguna nonaktif, arsip, dan trafik tautan CV lama. Ketiganya tetap berbiaya meskipun orang tidak lagi membayar. Tambahkan biaya tersebut ke model setelah ada pola penggunaan; jangan menganggap tabel satu periode ini sebagai proyeksi tahunan.

### 9.6 Batas akuisisi yang masuk akal untuk tahap awal

Sebelum ada bukti pembelian ulang, nilai ekonomi pelanggan secara konservatif adalah kontribusi pembelian pertamanya. Pada campuran di atas, ruang kontribusi awal sekitar Rp37.150, belum dikurangi biaya tetap dan dukungan di luar asumsi.

Target awal **CAC berbayar maksimal Rp15.000** dapat dipakai sebagai batas eksperimen, bukan benchmark industri. CAC berarti total biaya kampanye/partner dibagi pembeli baru yang sah, bukan dibagi pendaftar. Pisahkan insentif trial yang sudah dihitung agar tidak dihitung dua kali.

Sebagai pembanding: biaya Rp1.000 per kunjungan dan konversi kunjungan → bayar 1% menghasilkan CAC Rp100.000. Ini sudah melebihi kontribusi pembelian pertama kedua tier. Karena itu, jangan langsung membesarkan iklan sebelum alur dan konversi terbukti. Distribusi lewat konten, komunitas, dan kampus juga tetap perlu mencatat biaya waktu/produksinya.

## 10. Fitur dan pengemasan yang paling berpotensi menaikkan paid adoption

Urutkan menurut manfaat untuk keputusan membayar, bukan kecanggihan teknis. Dampak di tabel merupakan penilaian, belum hasil eksperimen. Usaha relatif mengasumsikan fondasi kode sekarang tetap dipakai.

| Prioritas | Usulan                                      | Sudah ada vs perlu dibuat                                                                     | Mengapa orang mungkin membayar                                              | Usaha relatif            |
| --------- | ------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------ |
| **P0**    | Alur “Siapkan lamaran untuk lowongan ini”   | Tailoring, surat, fit sudah ada; urutan terpandu dan paket hasil perlu dirapikan              | Menghubungkan AI langsung ke pekerjaan yang mendesak                        | Sedang                   |
| **P0**    | Managed AI tanpa API key + saldo transparan | Provider/fitur ada; billing, resolver per akun, dan ledger perlu dibuat                       | Menghilangkan setup teknis yang tidak relevan bagi pengguna awam            | Sedang–besar             |
| **P0**    | Contoh sebelum/sesudah berbasis CV pengguna | Usulan edit sudah ada; pengalaman trial dan penawaran perlu dirancang                         | Bukti manfaat pribadi lebih kuat daripada tulisan “AI canggih”              | Sedang                   |
| **P0**    | Onboarding berdasarkan tujuan               | Fondasi import/editor ada; alur fresh graduate vs pindah kerja perlu dirapikan                | Mempercepat hasil pertama sebelum menawarkan upgrade                        | Kecil–sedang             |
| **P1**    | Versi Indonesia–Inggris yang konsisten      | Bahasa dan CV terpisah sudah didukung; alur pasangan dan pemeriksaan konsistensi perlu dibuat | Mengurangi penulisan ulang dan salah terjemahan fakta                       | Sedang                   |
| **P1**    | Bank bukti pengalaman untuk fresh graduate  | Knowledge/stories ada; panduan proyek/magang/organisasi lokal perlu ditambahkan               | Membantu pengguna yang merasa “belum punya pengalaman” tanpa mengarang      | Kecil–sedang             |
| **P1**    | Paket persiapan interview berbasis teks     | Prepare/Practice/Debrief ada; kemasan tugas dan materi lokal perlu disederhanakan             | Nilai mendesak setelah mendapat panggilan, memperpanjang manfaat di luar CV | Sedang                   |
| **P1**    | “Apa yang saya kirim ke perusahaan ini?”    | Snapshot dokumen/jawaban sudah ada; perlu ditonjolkan di alur                                 | Memudahkan follow-up dan persiapan interview                                | Kecil                    |
| **P2**    | Bagikan CV untuk komentar mentor            | Link publik ada; komentar, izin, notifikasi review perlu dibangun                             | Membuka distribusi kolaboratif dan jalur kampus                             | Sedang–besar             |
| **P2**    | Discovery lowongan yang dibayar Rezumi      | Scheduler/search ada; validasi kualitas lokal, meter, biaya, dan kuota belum                  | Mengurangi pencarian berulang jika relevansi terbukti                       | Besar secara operasional |
| **P2**    | Latihan suara managed                       | Fondasi voice ada; anggaran menit dan kualitas Indonesia perlu diuji                          | Tambahan upsell bila pengguna benar-benar memakainya                        | Sedang–besar             |
| **P2**    | Domain pribadi terhubung                    | Endpoint ada; operasi domain/TLS/support belum diverifikasi                                   | Cocok untuk profesional tertentu, bukan kebutuhan massal awal               | Sedang                   |

**Jangan menulis “buat job tracker”, “buat cover letter”, atau “buat mock interview” sebagai fitur baru dari nol.** Fondasinya sudah ada. Investasi pertama sebaiknya membuat alur tersebut mudah ditemukan, cepat dipakai, dan bisa ditagih secara adil.

### Yang saya tunda atau tolak

- **Auto-apply massal:** kompleksitas tinggi dan kualitas lamaran berisiko; produk sekarang melacak dan menyiapkan, bukan menjanjikan pengiriman otomatis.
- **Skor pasti lolos atau persentase peluang diterima:** checker keterbacaan tidak mengukur keputusan recruiter.
- **Pembuatan foto AI:** tidak memperkuat manfaat utama dan menambah biaya/moderasi.
- **WhatsApp bot penuh:** evaluasi setelah kebutuhan pengingat terbukti. Mulai dari draft pesan yang dapat disalin; jangan menanggung kanal baru sebelum ada permintaan.
- **Dashboard recruiter/marketplace kerja:** bisnis dua sisi baru; bukan tambahan kecil untuk membership pencari kerja.
- **Unlimited human review:** tenaga manusia adalah biaya nyata dan kapasitas terbatas.

Human review dapat diuji kemudian sebagai layanan terpisah, misalnya Rp149.000–Rp249.000 per review dengan cakupan dan tenggat jelas. Harga tersebut hipotesis; ukur honor reviewer, waktu revisi, biaya admin, refund, dan kualitas sebelum menjual. Jangan masukkan ke Rp79.000 tanpa perhitungan tenaga kerja.

## 11. Alur adopsi dan momen upgrade

Alur yang disarankan:

```text
Konten/template lokal atau ATS checker gratis
  → pengguna melihat masalah CV-nya
  → import/buat CV tanpa hambatan
  → unduh PDF pertama
  → tambahkan lowongan yang benar-benar diminati
  → coba satu hasil AI dengan kredit trial
  → tinjau perubahan dan simpan versi lowongan
  → pilih Plus untuk volume/format, atau Pro AI untuk bantuan berulang
```

Momen upgrade harus menjelaskan keterbatasan yang sedang dialami:

| Pemicu                                   | Penawaran yang relevan                            | Alternatif gratis yang tetap tersedia                    |
| ---------------------------------------- | ------------------------------------------------- | -------------------------------------------------------- |
| Akan membuat CV aktif ke-4               | Plus untuk menyimpan lebih banyak versi           | Arsipkan satu CV atau ubah salah satu yang aktif         |
| Membutuhkan Word dari recruiter          | Plus dengan ekspor Word                           | PDF, Markdown, dan ekspor data                           |
| Kredit trial habis setelah hasil berguna | Pro AI, saldo 100 kredit dan contoh kegunaannya   | Edit manual atau BYOK                                    |
| Interview sudah dijadwalkan              | Persiapan teks dan latihan feedback dengan Pro AI | Catatan, jadwal, cerita pengalaman, dan checklist manual |
| Memilih template premium                 | Tampilkan preview serta harga sebelum dipakai     | Beralih ke template gratis tanpa kehilangan isi          |

Jangan menampilkan klaim “paling populer” sebelum ada data. Jangan memakai countdown diskon palsu atau nominal bulanan kecil yang menyembunyikan tagihan tahunan. Untuk trial, berikan satu hasil lengkap; jangan memotong isi CV yang sudah dihasilkan agar pengguna terpaksa membayar untuk melihatnya.

Distribusi awal: konten contoh CV per posisi yang berkualitas, ATS checker, komunitas fresh graduate, career center kampus, dan bootcamp. Uji satu atau dua channel dahulu. Partner sebaiknya menerima voucher untuk pengguna nyata; data CV tidak diberikan ke institusi tanpa pilihan pengguna yang jelas.

Referral baru layak diuji setelah hasil pertama bagus: bonus kecil setelah orang yang diundang benar-benar aktif atau membeli dan melewati masa refund. Batasi per akun. Jangan memberi hadiah hanya karena ada alamat email baru.

## 12. Rencana validasi 8 minggu

Waktu berikut urutan belajar, bukan estimasi pasti bahwa seluruh billing dan mobile selesai dalam 8 minggu. Peluncuran pembayaran menunggu kesiapan produk dan kanal. Jika belum siap menjual, gunakan demo dan daftar minat dengan label jelas; klik “tertarik” bukan bukti transaksi.

| Tahap      | Pekerjaan                                                                                                           | Bukti yang dicari                                                                             | Keputusan berikutnya                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Minggu 1–2 | Observasi sekitar 20 orang: fresh graduate dan profesional awal karier, semuanya punya lowongan nyata               | Bisa menyelesaikan CV/lamaran? Bagian mana menyita waktu? Apa yang sudah pernah mereka bayar? | Pilih satu masalah berbayar paling kuat                             |
| Minggu 2–3 | Jalankan benchmark biaya dan kualitas pada sekitar 100 tugas fiktif/berizin, termasuk konteks panjang dan kegagalan | Biaya per pekerjaan, hasil yang layak, kasus salah fakta, biaya P95                           | Tentukan bobot kredit dan lingkup fitur launch                      |
| Minggu 3–5 | Pilot kecil pada harga Rp29.000/Rp79.000, hanya jika produk dan pembayaran siap                                     | Pembelian nyata, keberhasilan pembayaran, hasil AI yang diterima, alasan tidak membeli        | Perbaiki manfaat atau harga berdasarkan titik masalah               |
| Minggu 5–6 | Perbaiki satu hambatan terbesar; uji satu variabel                                                                  | Apakah perubahan membantu pengguna menyelesaikan tugas dan membeli?                           | Jangan mengganti harga, trial, dan paket sekaligus                  |
| Minggu 7–8 | Evaluasi penggunaan satu periode dan alasan berhenti                                                                | Pembelian ulang, selesai mendapat kerja, masih mencari tetapi tidak terbantu, biaya dukungan  | Pertahankan tiga tier, sederhanakan dua tier, atau revisi proposisi |

Untuk harga, alternatif uji berikutnya adalah **Plus Rp39.000** atau **Pro AI Rp99.000** bila manfaatnya sudah terbukti; bila hambatan jelas daya beli, uji **Pro AI Rp59.000** dengan paket yang sama terlebih dahulu agar efek harga bisa dibaca. Jangan menjalankan banyak kombinasi pada trafik kecil. Bandingkan segmen dan channel yang serupa; batch kecil mudah terkena bias.

### Metrik yang harus dipisahkan

| Metrik                         | Definisi yang dipakai                                                                                     |
| ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Aktivasi CV                    | Pendaftar yang menghasilkan PDF berisi data mereka dalam 7 hari / pendaftar baru                          |
| Aktivasi workflow              | Pengguna aktif yang menyimpan setidaknya satu lowongan dan dokumen terkait                                |
| Trial → hasil berguna          | Penerima trial yang berhasil menyimpan/menerapkan hasil / penerima trial yang mencoba                     |
| Activated → paid 30 hari       | Pengguna baru teraktivasi yang membeli dalam 30 hari / seluruh pengguna baru teraktivasi pada cohort sama |
| Checkout berhasil              | Pembayaran terverifikasi / checkout yang dimulai; bedakan ditinggalkan vs gagal teknis                    |
| Kontribusi per paket dan kanal | Pendapatan bersih relevan dikurangi biaya langsung, refund, dan fee kanal                                 |
| Biaya AI P50/P95               | Biaya median dan biaya yang melampaui 95% sampel, per pekerjaan serta akun/periode                        |
| Beli ulang                     | Pembeli yang membeli periode berikutnya; pisahkan yang masih mencari kerja dari yang sudah selesai        |
| CAC dan kontribusi 90 hari     | Biaya memperoleh satu pembeli dan kontribusi aktual cohort selama 90 hari                                 |
| Refund/keluhan                 | Jumlah dan alasan; pisahkan salah paham paket, kualitas, billing, dan masalah teknis                      |

Ambang kerja internal awal, **bukan benchmark pasar**: usahakan margin kontribusi web Pro AI ≥70%; penggunaan penuh 100 kredit harus dapat dilayani sesuai anggaran; target awal activated → paid 3–5% digunakan sebagai pertanyaan eksperimen, bukan janji. Pada volume kecil, tampilkan pembilang/penyebut nyata: “6 dari 120”, bukan hanya “5%”.

**Aturan evaluasi Plus:** setelah minimal sekitar 30 pembelian total dan wawancara alasan beli, jika Plus kurang dari 20% pembelian serta penggunanya tidak dapat menyebut manfaat khas, uji halaman dua tier. Sampel 30 cukup sebagai sinyal arah, bukan kesimpulan statistik. Jangan mempertahankan Plus sekadar agar Pro AI terlihat murah.

**Aturan evaluasi Pro AI:** jika banyak pengguna mencoba tetapi sedikit menerapkan hasil, benahi kualitas/kejelasan alur sebelum diskon. Jika hasil dipakai dan checkout dimulai tetapi gagal, perbaiki pembayaran. Jika orang merasa cukup dengan Gratis setelah mendapat hasil yang baik, cari segmen dengan kebutuhan berulang; jangan langsung merusak Gratis.

Instrumen analytics perlu minim data: event tindakan, paket, nominal, hasil sukses/gagal, dan biaya; hindari isi CV, prompt, atau jawaban pribadi pada event pemasaran. Materi produk saat ini menyebut “no tracking”; definisikan pengukuran yang akan digunakan dan sesuaikan pemberitahuan secara jujur sebelum mengaktifkannya. [FAQ][k-faq]

## 13. Pekerjaan implementasi sebelum menerima uang

Bagian ini peta kebutuhan, bukan permintaan langsung untuk mengubah kode.

| Komponen            | Kebutuhan                                                                                            | Area pemilik yang relevan                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Paket dan hak akses | Satu definisi fitur/kuota dengan tanggal mulai/akhir dan versi paket                                 | Schema/domain bersama dan business logic API                             |
| Transaksi           | Order, harga/mata uang yang dibekukan saat checkout, pembayaran, refund, settlement, audit perubahan | DB + API + HTTP webhook server                                           |
| Entitlement         | Status ditentukan server setelah verifikasi; retry webhook, event terlambat/berulang, revoke/refund  | API/DB; jangan mempercayai redirect “success” di browser                 |
| Saldo AI            | Grant, reservasi, pemakaian, pengembalian, kedaluwarsa, rekonsiliasi crash                           | DB/API; setiap operasi memiliki identitas untuk mencegah penagihan ganda |
| Pemilihan provider  | Pisahkan managed AI, BYOK, dan AI eksternal melalui MCP                                              | [Provider service][k-providers], [AI router][k-ai], [agent][k-agent]     |
| Batas dokumen       | Cek transaksi atomik untuk create/import/duplicate/tailor/restore; jangan ada jalur melewati batas   | [Resume service][k-resume-service], [AI aplikasi][k-application-ai]      |
| Gateway biaya       | Semua tindakan berbiaya, termasuk background jobs, memakai meter dan budget                          | [Jobs][k-jobs], [voice][k-voice], [MCP][k-mcp]                           |
| Web/mobile          | Halaman paket, saldo, masa akses, error kuota, restore purchase, billing state yang sama             | Kedua aplikasi, memakai kontrak API bersama                              |
| Kedaluwarsa         | Arsip tanpa hapus, mempertahankan desain/link, hasil AI tetap terbaca                                | Dokumen, sharing, history, scheduler                                     |
| Operasi             | Panel bantuan minimum untuk mencari pembayaran, memberi akses yang sah, refund dan audit             | Tool/admin operasional; bukan akses bebas ke CV pengguna                 |

**Gating template/ekspor lokal punya batas teknis.** Sebagian renderer/export builder dikirim ke browser/native, dan kode open source. Menyembunyikan tombol bukan proteksi yang tidak dapat dilewati. Utamakan enforcement pada layanan hosted, penyimpanan, pembuatan dokumen, autentikasi otomasi, dan biaya AI. Jangan memindahkan semua rendering ke server hanya untuk mempersulit pengguna teknis tanpa menilai biaya serta dampak offline. [Ekspor web][k-export-web]

Perubahan entitlement harus tetap kompatibel dengan versi mobile lama: pertahankan data dan kemampuan membaca, gunakan error yang bisa dipahami, dan jangan membuat aplikasi lama diam-diam menjalankan AI berbayar. Pengubahan dependencies native untuk pembayaran membutuhkan build toko sesuai workflow proyek; bukan sekadar OTA JavaScript.

### Pembayaran mobile perlu diputuskan bersama produk

Secara umum, Apple dan Google mengatur pembelian fitur digital di aplikasi melalui mekanisme pembayaran toko, dengan pengecualian/program yang spesifik. **Jangan menganggap checkout QRIS di dalam aplikasi otomatis diperbolehkan untuk Indonesia**, atau menyalin pengecualian storefront negara lain. Verifikasi produk pass, pemulihan pembelian, dan pilihan billing terhadap kanal distribusi yang benar. [Apple pembayaran digital](https://developer.apple.com/app-store/review/guidelines/#in-app-purchase), [Google Play Payments](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en)

Strategi awal: akuisisi dan uji harga web dapat didahulukan, tetapi hak fitur akun berbayar tetap harus bekerja di web/mobile. Peluncuran pembelian native mengikuti kesiapan integrasi dan aturan toko. Aturan repo mewajibkan parity; pengecualian fitur karena kebijakan toko memerlukan keputusan pemilik, bukan diputuskan sepihak oleh implementer.

Bila transaksi toko dengan harga sama ternyata terlalu menekan margin, pilih harga kanal yang transparan atau revisi biaya produk sebelum menjual. Jangan mengurangi kredit pelanggan yang sudah membeli hanya karena channel-nya lebih mahal.

### Pemeriksaan penerimaan minimum

Sebelum launch, buktikan: satu pembayaran hanya mengaktifkan sekali; pembayaran gagal tidak memberi entitlement; refund dapat direkonsiliasi; dua perangkat tidak bisa membelanjakan saldo yang sama dua kali; AI gagal tidak memakan kredit; batas dokumen berlaku melalui web/mobile/REST/MCP; job terjadwal berhenti memakai budget saat akses habis; downgrade tidak menghapus data; serta receipt toko dan harga lokal cocok dengan yang ditampilkan.

## 14. Menjaga kepercayaan dan model open source

[README][k-readme] menyebut tidak ada paid tier dan [FAQ homepage][k-faq] menyebut seluruh fitur gratis. Itu bertentangan langsung dengan proposal membership hosted. Karena belum ada pengguna, belum perlu menjalankan migrasi pelanggan, tetapi **ubah janji tersebut sebelum menerima pengguna berbayar**. Periksa pula metadata SEO, terjemahan, panduan, serta listing aplikasi yang memuat janji serupa.

Rekomendasi saya:

1. Pertahankan versi open source/self-host sebagai pilihan yang jelas, dengan biaya hosting/provider ditanggung pengelolanya.
2. Membership dikenakan pada layanan hosted dan kemudahannya, termasuk managed AI. Jangan menyiratkan source yang sekarang terbuka tiba-tiba menjadi eksklusif.
3. Pisahkan penjelasan “kode terbuka” dari “seluruh layanan cloud gratis”.
4. Jika ternyata ada akun uji/pengguna awal sebelum perubahan berlaku, inventarisasi hak dan dokumennya; jangan menghapus atau mengunci data yang sebelumnya dibuat dengan janji lama.
5. Ekspor data, hapus akun, autentikasi aman, serta kontrol privasi dasar tetap tersedia tanpa membayar.

Teks [LICENSE repo][k-license] memakai MIT. Lisensi MIT mengizinkan penjualan dengan syarat mempertahankan pemberitahuan hak cipta/lisensi yang relevan; open source dan layanan hosted berbayar dapat berjalan bersama. Hak aset, font, dependensi, dan merek tetap perlu diperiksa menurut lisensinya masing-masing; file MIT root bukan otomatis bukti hak komersial seluruh aset. [Teks MIT resmi](https://opensource.org/license/mit)

## 15. Keputusan dan ketidakpastian yang tersisa

| Hal                     | Posisi rekomendasi sekarang                        | Bukti yang bisa mengubah keputusan                                                     |
| ----------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Jumlah tier             | Tiga untuk uji pertama                             | Plus tidak punya pembeli/manfaat khas → uji dua tier                                   |
| Harga                   | Plus Rp29.000, Pro AI Rp79.000 / 30 hari           | Pembayaran nyata, alasan beli, biaya pelayanan dan akuisisi                            |
| Free CV                 | 3 aktif                                            | Banyak pengguna gagal mencapai hasil pertama → perbaiki flow atau batas                |
| Paid CV                 | 50 aktif                                           | Pemakaian personal sah sering mendekati batas → naikkan; jangan membuat upsell palsu   |
| AI                      | 100 kredit dengan pekerjaan terbatas               | Biaya penuh dan kualitas gagal memenuhi target → ubah bobot/model/harga sebelum launch |
| BYOK                    | Tetap tersedia di semua tier sebagai opsi lanjutan | Beban dukungan atau penggunaan menunjukkan perlu bentuk layanan lain                   |
| Masa pembelian          | Pass 30 hari tanpa auto-renew                      | Pembelian ulang dan permintaan pengguna mendukung 90 hari/auto-renew                   |
| Discovery/suara managed | Tunda                                              | Kualitas lokal dan biaya terukur sudah cukup baik                                      |
| B2B kampus              | Pilot voucher setelah alur individu terbukti       | Institusi mau membayar dan punya penggunaan peserta nyata                              |
| Biaya dasar             | Belum diketahui                                    | Invoice Cloudflare/database/email, quote payment, dan telemetry berizin                |

Pertanyaan bisnis terpenting bukan “berapa fitur yang bisa kita kunci?”, melainkan **“pekerjaan mana yang cukup terbantu sehingga pengguna bersedia membayar lagi atau merekomendasikan Rezumi?”** Untuk kondisi sekarang, saya akan membuktikan alur lamaran spesifik lowongan dan biaya Pro AI terlebih dahulu, sambil memberi Gratis yang tetap berguna.

## Istilah singkat

| Istilah           | Arti dalam dokumen ini                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------ |
| Tier              | Tingkatan paket dengan manfaat berbeda                                                     |
| Managed AI        | Rezumi menyediakan koneksi AI dan membayar pemakaiannya sesuai kuota paket                 |
| BYOK              | Bring Your Own Key: pengguna membawa API key dan membayar provider AI sendiri              |
| MCP               | Cara asisten AI eksternal membaca/mengelola data Rezumi melalui tool yang diizinkan        |
| Entitlement       | Catatan server tentang fitur yang boleh dipakai akun dan sampai kapan                      |
| Ledger            | Buku transaksi saldo: kredit masuk, dipesan, dipakai, dikembalikan, atau berakhir          |
| Aktivasi          | Pengguna berhasil mendapat manfaat pertama yang didefinisikan, bukan hanya mendaftar       |
| Konversi          | Proporsi orang yang berpindah ke tahap berikutnya; pembilang dan penyebut harus disebut    |
| CAC               | Biaya mendapatkan satu pelanggan yang benar-benar membayar                                 |
| Cohort            | Kelompok pengguna dengan periode mulai atau sumber akuisisi yang sama                      |
| Margin kontribusi | Sisa pendapatan setelah biaya langsung; belum sama dengan laba bersih                      |
| P95               | Nilai yang mencakup sekitar 95% hasil pengukuran; membantu melihat pemakaian mahal         |
| Auto-renew        | Akses diperpanjang dan ditagih otomatis, kecuali dibatalkan                                |
| MRR               | Pendapatan berulang bulanan; pembelian pass satu kali tidak menjamin pendapatan berikutnya |

## Lampiran: jejak sumber dan batas audit

Penelusuran struktur memakai graph `Users-salmanalfariesh-Documents-Vitaekit`, generasi `2026-10-31T00:09:23Z`, disertai pemeriksaan coverage dan pembacaan source. Scope tertentu memiliki gap parser pada beberapa baris test/service; baris tersebut diperiksa langsung. Env dan beberapa file non-code tidak sepenuhnya tercakup graph dan dibaca/dicari langsung. Graph bersifat best effort; kesimpulan komersial di sini tidak bergantung pada anggapan bahwa graph lengkap.

Tidak ada akses database produksi, invoice, analytics, checkout berbayar kompetitor, atau sesi uji aplikasi dalam audit ini. Tautan sumber kode di bawah memakai lokasi checkout lokal agar dapat dibuka dari Codex; tautan tersebut perlu disesuaikan jika dokumen dipindahkan ke komputer lain.

| Sumber lokal                                                                                          | Kegunaan                                                 |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| [README][k-readme] dan [FAQ][k-faq]                                                                   | Daftar fitur, positioning gratis, janji publik           |
| [Template schema][k-templates]                                                                        | Jumlah template dan kategori layout                      |
| [Ekspor web][k-export-web], [ekspor server][k-export-server], [unduh mobile][k-download-mobile]       | Format ekspor dan lokasi komputasi                       |
| [Router utama][k-router], [schema DB][k-db], [auth schema][k-auth]                                    | Scope pemeriksaan fondasi membership                     |
| [CRUD resume][k-resume-crud], [service resume][k-resume-service]                                      | Jalur pembuatan dokumen dan titik penegakan batas        |
| [Router AI][k-ai], [provider service][k-providers], [agent][k-agent], [rate limit][k-rate]            | AI, resolver global/BYOK, usage dan batas yang sudah ada |
| [Router applications][k-applications], [AI applications][k-application-ai]                            | Pelacak, drafting, pencocokan dan tailoring              |
| [Router Career][k-career], [jobs][k-jobs], [voice][k-voice]                                           | Knowledge/workspace, background work, suara              |
| [Career overview][k-career-guide], [workspace reference][k-workspace-guide], [discovery][k-discovery] | Perilaku pengguna dan syarat koneksi                     |
| [MCP tools][k-mcp], [custom domain][k-domain], [mobile workspace][k-workspace-mobile]                 | Integrasi dan kandidat manfaat tambahan                  |
| [ATS checker guide][k-ats], [LICENSE][k-license]                                                      | Batas klaim ATS dan konteks open source                  |

[k-readme]: /Users/salmanalfariesh/Documents/Vitaekit/README.md
[k-faq]: /Users/salmanalfariesh/Documents/Vitaekit/apps/web/src/features/homepage/faq.tsx
[k-templates]: /Users/salmanalfariesh/Documents/Vitaekit/packages/schema/src/templates.ts
[k-export-web]: /Users/salmanalfariesh/Documents/Vitaekit/apps/web/src/features/resume/export/use-resume-export.ts
[k-export-server]: /Users/salmanalfariesh/Documents/Vitaekit/packages/api/src/features/resume/export.ts
[k-download-mobile]: /Users/salmanalfariesh/Documents/Vitaekit/apps/mobile/src/features/share/download.tsx
[k-router]: /Users/salmanalfariesh/Documents/Vitaekit/packages/api/src/routers/index.ts
[k-db]: /Users/salmanalfariesh/Documents/Vitaekit/packages/db/src/schema/index.ts
[k-auth]: /Users/salmanalfariesh/Documents/Vitaekit/packages/db/src/schema/auth.ts
[k-resume-crud]: /Users/salmanalfariesh/Documents/Vitaekit/packages/api/src/features/resume/crud.ts
[k-resume-service]: /Users/salmanalfariesh/Documents/Vitaekit/packages/api/src/features/resume/service.ts
[k-ai]: /Users/salmanalfariesh/Documents/Vitaekit/packages/api/src/features/ai/router.ts
[k-providers]: /Users/salmanalfariesh/Documents/Vitaekit/packages/api/src/features/ai-providers/service.ts
[k-agent]: /Users/salmanalfariesh/Documents/Vitaekit/packages/api/src/features/agent/service.ts
[k-rate]: /Users/salmanalfariesh/Documents/Vitaekit/packages/api/src/middleware/rate-limit/index.ts
[k-applications]: /Users/salmanalfariesh/Documents/Vitaekit/packages/api/src/features/applications/router.ts
[k-application-ai]: /Users/salmanalfariesh/Documents/Vitaekit/packages/api/src/features/applications/ai.ts
[k-career]: /Users/salmanalfariesh/Documents/Vitaekit/packages/api/src/features/career/router.ts
[k-jobs]: /Users/salmanalfariesh/Documents/Vitaekit/packages/api/src/features/career/jobs.ts
[k-voice]: /Users/salmanalfariesh/Documents/Vitaekit/packages/api/src/features/career/voice.ts
[k-career-guide]: /Users/salmanalfariesh/Documents/Vitaekit/docs/guides/career-overview.mdx
[k-workspace-guide]: /Users/salmanalfariesh/Documents/Vitaekit/docs/guides/career-workspace-reference.mdx
[k-discovery]: /Users/salmanalfariesh/Documents/Vitaekit/docs/guides/finding-roles-automatically.mdx
[k-domain]: /Users/salmanalfariesh/Documents/Vitaekit/packages/api/src/features/custom-domain/router.ts
[k-mcp]: /Users/salmanalfariesh/Documents/Vitaekit/packages/mcp/src/tools.ts
[k-workspace-mobile]: /Users/salmanalfariesh/Documents/Vitaekit/apps/mobile/src/features/workspace/shell.tsx
[k-ats]: /Users/salmanalfariesh/Documents/Vitaekit/docs/guides/using-the-ats-checker.mdx
[k-license]: /Users/salmanalfariesh/Documents/Vitaekit/LICENSE
