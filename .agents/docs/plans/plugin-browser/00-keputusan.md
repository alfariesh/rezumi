# Keputusan produk — plugin browser (simpan loker)

Keputusan pemilik yang berlaku untuk semua phase. Agent tidak mengubahnya diam-diam: bila implementasi menunjukkan satu keputusan tidak bisa atau tidak sebaiknya dipakai, jelaskan pilihannya, tanya pemilik, lalu catat di log di bawah.

## 1. Konsep

- **Plugin browser Rezumi** untuk Chrome dan Microsoft Edge (satu kode, dua toko).
- **Satu tujuan** (aturan "single purpose" Chrome Web Store): menyimpan lowongan kerja dari situs loker ke pelacak lamaran Rezumi, lalu membantu menyiapkan lamarannya.
- **Plugin hanya "tangan", otaknya di server Rezumi.** Semua data tersimpan di akun Rezumi (menu Lamaran / Applications). Plugin tidak punya database sendiri, hanya cache kecil di browser.
- **Web dulu tetap berlaku.** Plugin adalah aplikasi baru `apps/extension`. App mobile tidak disentuh (aturan `CLAUDE.md`).
- Nama fitur di aplikasi: "Plugin browser" (Indonesia), "Browser extension" (Inggris). Nama di toko: aturan turunan #1.

## 2. Paket dan biaya (keputusan 2026-11-11)

- **Gratis untuk semua paket:** pasang, masuk, simpan loker, tanda "sudah disimpan", skor kecocokan istilah (tanpa AI), ubah status, catatan, pengingat, buka di Rezumi.
- **Fitur AI mengikuti aturan web yang sudah ada**, tanpa harga baru: baca loker dengan AI 1 kredit, skor kecocokan AI 4 kredit, sesuaikan CV 5 kredit, surat lamaran 3 kredit. Pengguna dengan koneksi AI sendiri memakai koneksinya.
- Plugin dianggap **aplikasi resmi Rezumi**, sama seperti app mobile, jadi tidak butuh fitur paket "Automation API" yang dipakai kunci API dan aplikasi pihak ketiga. Rincian teknis: `02-teknis.md` bagian 5.
- Batas yang sudah ada tetap berlaku (batas laju API, kredit). Tidak ada batas jumlah loker yang baru.

## 3. Situs loker (keputusan 2026-11-11)

- **Pembaca khusus di rilis pertama:** LinkedIn, Indeed, JobStreet, Glints. Di keempat situs ini tombol "Simpan ke Rezumi" tampil langsung di halaman loker.
- **Situs lain memakai cara umum:** data lowongan standar di halaman (JSON-LD `JobPosting`, yang dipakai Google for Jobs), lalu teks halaman, atau teks yang diblok pengguna. Dengan AI, kolomnya terisi lebih lengkap. Di situs lain plugin hanya bekerja setelah pengguna mengklik ikon, menu klik kanan, atau pintasan keyboard.
- Situs berikutnya (Kalibrr, Dealls, KitaLulus, Karir.com) ada di backlog.

## 4. Browser

- Chrome dan Microsoft Edge versi desktop. Versi minimum ditetapkan di Phase 01 (target: Chrome/Edge 116, karena panel samping).
- Firefox, Safari, dan HP ada di backlog.

## 5. Cakupan rilis pertama (keputusan 2026-11-11: lengkap sekaligus)

Semua butir di bawah keluar bersama di rilis pertama:

1. **Masuk satu klik** "Hubungkan ke Rezumi" (tanpa menyalin kunci API), keluar dari plugin, dan memutus plugin dari Pengaturan Rezumi.
2. **Tombol "Simpan ke Rezumi"** di halaman loker empat situs, plus ikon toolbar, menu klik kanan, dan pintasan keyboard di situs mana pun.
3. **Panel samping** dengan pratinjau isi (posisi, perusahaan, lokasi, gaji, deskripsi, syarat) yang bisa diubah sebelum disimpan; pilih status (Disimpan / Sudah dilamar + tanggal), CV, tag, dan pengingat.
4. **Tanda "Sudah disimpan · <status>"** di halaman loker dan di ikon. Loker yang sama tidak tersimpan dua kali tanpa sengaja.
5. **Ubah status dan tambah catatan** langsung dari panel.
6. **Skor kecocokan istilah** dengan CV pilihan (gratis) plus daftar kata kunci yang belum ada di CV.
7. **AI opsional:** baca loker dengan AI dan skor kecocokan AI (memakai kredit).
8. **Tombol persiapan:** Sesuaikan CV, Tulis surat lamaran, Buka di Rezumi (membuka web Rezumi di tab baru).
9. **Pengingat:** tanggal tindak lanjut (bawaan dari batas waktu loker bila tercantum), daftar "jatuh tempo" di panel, angka di ikon, notifikasi desktop opsional.
10. **Laporkan halaman** yang gagal dibaca.
11. **Bahasa Inggris dan Indonesia**; tema terang/gelap mengikuti browser.
12. **Di web Rezumi:** label "Disimpan dari plugin", ajakan memasang plugin, plugin tampil di Aplikasi terhubung, panduan pengguna, bagian plugin di Kebijakan Privasi.

**Tidak termasuk rilis pertama:** isi formulir lamaran otomatis, Firefox, simpan banyak loker sekaligus dari daftar hasil pencarian (semua di backlog).

## 6. Privasi (prinsip yang tidak boleh dilanggar)

- Plugin **membaca isi halaman hanya saat pengguna memintanya**: membuka panel, menekan Simpan, menu klik kanan, atau pintasan.
- **Tanda "sudah disimpan" dihitung di dalam browser.** Plugin mengunduh daftar kunci loker yang sudah disimpan pengguna, lalu mencocokkannya sendiri. Alamat halaman yang dikunjungi tidak dikirim ke server.
- Tidak ada pelacak atau analitik pihak ketiga, dan tidak ada kode yang dimuat dari luar (aturan Manifest V3).
- Izin seminimal mungkin. Izin situs hanya untuk empat situs loker dan `rezumi.app`.
- Plugin **tidak menyedot data otomatis** dan **tidak menekan tombol apa pun** di situs loker atas nama pengguna.

## 7. Aturan turunan yang menunggu konfirmasi

Agent menanyakan setiap aturan di phase yang disebut, dengan usulan sebagai pilihan pertama, lalu mencatat jawabannya di log.

| #   | Aturan                                     | Usulan                                                                                                                                         | Dikonfirmasi di        |
| --- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| 1   | Nama di toko                               | ID: "Rezumi: Simpan Loker & Lacak Lamaran"; EN: "Rezumi – Save Jobs & Track Applications"                                                      | Phase 00 ✅ 2026-11-11 |
| 2   | Status bawaan saat menyimpan               | Disimpan (Saved); pilihan "Sudah dilamar" mengisi tanggal hari ini                                                                             | Phase 04               |
| 3   | Baca dengan AI                             | Bawaan mati; pilihan terakhir diingat di perangkat; tanpa AI kolom diisi dari data halaman                                                     | Phase 04               |
| 4   | Loker yang sama disimpan lagi              | Panel menampilkan lamaran yang sudah ada; ada tombol kecil "Simpan sebagai lamaran baru"                                                       | Phase 04               |
| 5   | Tombol di halaman saat belum masuk         | Tetap tampil; diklik membuka panel "Hubungkan ke Rezumi". Bisa dimatikan di pengaturan plugin                                                  | Phase 04               |
| 6   | Pengingat bawaan                           | 2 hari sebelum batas waktu loker bila tercantum; bila tidak, kosong                                                                            | Phase 05               |
| 7   | Notifikasi desktop                         | Bawaan mati; izin browser diminta saat pengguna menyalakannya; paling banyak satu notifikasi per lamaran per hari, pukul 09.00 waktu perangkat | Phase 05               |
| 8   | Isi laporan halaman gagal                  | Alamat halaman, situs, versi plugin, kolom yang gagal terbaca; tanpa isi halaman; dikirim hanya setelah pengguna mengklik                      | Phase 03               |
| 9   | Bahasa plugin saat rilis                   | Inggris dan Indonesia; bahasa lain memakai Inggris dan menyusul                                                                                | Phase 01 ✅ 2026-11-12 |
| 10  | Halaman setelah plugin dicopot             | Buka halaman singkat "Kenapa berhenti?" di rezumi.app, isian opsional tanpa data pribadi                                                       | Phase 06               |
| 11  | CV untuk skor kecocokan                    | CV utama akun (yang dibuka alamat pendek); bisa diganti di panel; pilihan diingat                                                              | Phase 05               |
| 12  | Email dukungan di toko dan laporan halaman | `hi@rezumi.app` untuk toko; laporan halaman ke `BILLING_ALERT_EMAIL`                                                                           | Phase 00 ✅ 2026-11-11 |

## 8. Mutu yang dijanjikan

- **Cepat:** simpan tanpa AI selesai kurang dari 3 detik dari klik (koneksi normal); panel terbuka kurang dari 1 detik.
- **Ringan:** skrip yang berjalan di halaman situs loker kecil (target ≤ 50 KB setelah diperkecil, tanpa React) dan tidak membuat situs terasa lambat. Di situs lain tidak ada skrip yang berjalan sebelum pengguna mengklik.
- **Tidak kehilangan isian:** bila simpan gagal (internet putus, sesi habis, server bermasalah), isian tetap di panel dengan pesan yang jelas.
- **Lolos review** Chrome Web Store dan Edge Add-ons tanpa izin berlebih; setiap izin punya alasan tertulis.
- **Tahan perubahan situs:** bila situs mengubah tampilan, cara umum tetap jalan, dan pembaca yang rusak bisa diperbaiki lalu dirilis ulang dalam ±1 minggu.

## 9. Log keputusan

| Tanggal    | Keputusan                                                                                                                                                                                           | Oleh    |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 2026-11-11 | Rencana dibuat. Plugin gratis untuk semua paket (AI tetap memakai kredit); pembaca khusus LinkedIn, Indeed, JobStreet, Glints; rilis lengkap sekaligus kecuali isi formulir otomatis; Chrome + Edge | Pemilik |
| 2026-11-11 | Aturan turunan #1 (nama toko: usulan ID dan EN dipakai) dan #12 (email dukungan `hi@rezumi.app`) dikonfirmasi di Phase 00                                                                           | Pemilik |
| 2026-11-12 | Aturan turunan #9 (bahasa saat rilis: Inggris dan Indonesia, bahasa lain memakai Inggris) dikonfirmasi di Phase 01                                                                                  | Pemilik |
