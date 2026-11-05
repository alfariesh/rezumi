# Phase 11 — Keamanan konten, privasi, legal

| Dikerjakan              | Ukuran | Bergantung pada | Perlu dari pemilik                                                            |
| ----------------------- | ------ | --------------- | ----------------------------------------------------------------------------- |
| Claude + review pemilik | Sedang | Phase 08        | Membaca dan menyetujui draf S&K dan Kebijakan Privasi; email penerima laporan |

## Untuk pemilik

**Apa yang dibuat:** portfolio adalah konten publik buatan pengguna, jadi Rezumi perlu:

- tautan **"Laporkan"** di setiap portfolio, dengan form laporan anti-spam;
- halaman admin untuk menindak laporan: menangguhkan portfolio (halaman jadi tidak tersedia) atau melarang akun;
- batas anti-spam di semua jalur publik;
- aturan baru di S&K dan Kebijakan Privasi (Indonesia dan Inggris);
- ekspor dan penghapusan data akun yang mencakup portfolio, gambar, dan pesan.

**Siapkan:** waktu membaca draf teks legal; email penerima laporan (boleh sama dengan email peringatan billing); jawaban aturan turunan #11 (logo klien) dan #12 (testimoni).

**Prompt:** `Kerjakan Phase 11 dari .agents/docs/plans/portfolio/README.md`

**Yang bisa kamu cek di akhir:** laporkan portfolio uji dari HP → email laporan masuk → tangguhkan di halaman admin → portfolio tidak tampil lagi → cabut penangguhan → tampil lagi.

## Untuk agent

### Langkah

1. **Laporan** (`02-teknis.md` bagian 14): halaman form yang dirender server di `/<username>?report` (tanpa segmen pertama baru), `POST /api/portfolio/<username>/report` dengan Turnstile dan batas laju, tabel `portfolio_report` (alasan: penipuan, konten ilegal, pelanggaran merek/hak cipta termasuk logo dan karya, testimoni palsu, lainnya; rincian; email pelapor opsional; status), email ke admin (env `ABUSE_ALERT_EMAIL` atau `BILLING_ALERT_EMAIL` sesuai jawaban pemilik).
2. **Admin** `/dashboard/admin/portfolios` (ikuti pola halaman admin billing): daftar laporan dengan filter status, buka portfolio, tangguhkan atau cabut dengan alasan wajib, tautan ke admin akun untuk melarang. Semua tindakan tercatat (audit).
3. **Penangguhan** (`02-teknis.md` bagian 14): portfolio diperlakukan seperti tidak terbit (alamat pendek dan domain sendiri kembali ke CV utama bila ada, selain itu halaman tidak tersedia), kartu share umum, keluar dari sitemap, tidak bisa diterbitkan ulang oleh pemiliknya. Pemilik portfolio melihat status dan alasan di editor beserta cara mengajukan keberatan (email kontak).
4. **Pengerasan**:
   - `rel="ugc nofollow noopener noreferrer"` pada semua tautan keluar;
   - akun berumur kurang dari 7 hari tidak diindeks (konfirmasi aturan turunan #5 bila belum);
   - terbit butuh email terverifikasi (cek sudah ditegakkan sejak Phase 01);
   - pemilik dilarang → portfolio dan gambarnya 404;
   - batas laju di semua rute publik portfolio; batas ukuran body;
   - tinjau ulang dua jalur berisiko dari Phase 05: PDF publik (header terkunci, tipe file, pemilik dilarang → 404) dan tempel tautan (anti-SSRF termasuk pengalihan, ukuran, waktu, tidak mengirim data pengguna); tulis hasil tinjauan di laporan;
   - konfirmasi aturan turunan #11 (logo klien: abu-abu bawaan, pernyataan hak saat menambah) dan #12 (centang keaslian testimoni) dengan pemilik, lalu pastikan editor menegakkannya.
5. **Data akun**: ekspor data memuat portfolio, daftar gambar, pesan, dan laporan tentang portfolio itu tanpa identitas pelapor; hapus akun menghapus semuanya termasuk custom hostname Cloudflare.
6. **Legal ID/EN** (halaman legal yang dibuat di membership Phase 02): S&K (konten buatan pengguna, larangan, prosedur laporan dan penurunan, penangguhan, keberatan), Kebijakan Privasi (pesan kontak dan retensinya, statistik tanpa cookie, gambar, PDF, dan isi yang dipublikasikan pengguna, video YouTube/Vimeo yang baru dimuat setelah diklik, gambar yang disalin dari tautan yang ditempel pengguna, lokasi dan peta tingkat kota, statistik agregat dari Cloudflare Analytics Engine seperti negara dan jenis perangkat), aturan logo klien dan testimoni di S&K, tanggal berlaku. Cek kewajiban untuk platform konten buatan pengguna di Indonesia dengan riset `.agents/docs/research/monetisasi-membership-indonesia-2026-10-31.md` dan sumber resmi; sebutkan ketidakpastian dengan jujur. Minta persetujuan pemilik sebelum menerbitkan.

### Aturan yang wajib dijaga

- Identitas pelapor tidak pernah ditunjukkan ke pemilik portfolio.
- Penangguhan tidak menghapus data; hanya admin yang bisa mencabutnya.
- Teks legal tidak menjanjikan hal yang belum dibangun.

### Tes dan verifikasi

- Unit/integrasi: laporan dengan Turnstile gagal ditolak; batas laju; tangguhkan → `/<username>` membuka CV utama (atau halaman tidak tersedia bila tidak ada), kartu umum, sitemap tanpa portfolio itu, `setPublic` oleh pemilik ditolak; cabut → kembali tampil; pemilik dilarang → 404 portfolio dan gambar; ekspor dan hapus akun lengkap.
- Browser lokal: alur laporan → admin → tangguhkan → cabut; screenshot.

### Selesai bila

- Alur laporan sampai penangguhan berjalan dan tercatat.
- Teks legal disetujui pemilik dan diterbitkan bersama rilis (atau dijadwalkan untuk Phase 12).
