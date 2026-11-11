# Phase 03 — Pembaca situs loker

| Dikerjakan | Ukuran | Bergantung pada | Perlu dari pemilik                                                                                     |
| ---------- | ------ | --------------- | ------------------------------------------------------------------------------------------------------ |
| Claude     | Besar  | Phase 01        | Jawaban aturan turunan #8; opsional: izin Claude membaca halaman LinkedIn di Chrome-mu (hanya membaca) |

## Untuk pemilik

**Apa yang dibuat:** plugin bisa **membaca lowongan** (posisi, perusahaan, lokasi, gaji, deskripsi, batas waktu) di LinkedIn, Indeed, JobStreet, dan Glints, termasuk saat kamu berpindah lowongan di halaman hasil pencarian. Di situs lain plugin memakai cara umum. Bila sebuah halaman gagal dibaca, pengguna bisa melaporkannya ke email Rezumi.

**Siapkan:**

- Jawab **aturan turunan #8** (isi laporan halaman gagal) saat ditanya.
- **Opsional:** LinkedIn menampilkan lowongan berbeda bila kita login. Bila kamu mengizinkan, Claude membuka beberapa halaman lowongan LinkedIn di Chrome-mu lewat Claude in Chrome **hanya untuk membaca strukturnya**: tidak menekan tombol, tidak melamar, tidak mengubah apa pun di akunmu.

**Prompt:** `Kerjakan Phase 03 dari .agents/docs/plans/plugin-browser/README.md`

**Yang bisa kamu cek di akhir:** tabel di laporan Claude yang menunjukkan kolom apa saja yang terbaca di tiap situs, dari halaman sungguhan.

## Untuk agent

### Langkah

1. **Konfirmasi aturan turunan #8** dan catat di `00-keputusan.md`.
2. **Riset halaman nyata** (`02-teknis.md` 7.4, 7.7): untuk tiap situs, buka beberapa lowongan publik di built-in browser (halaman detail, hasil pencarian dengan detail terpilih, antarmuka Indonesia bila ada). Catat: pola URL dan ID, keberadaan JSON-LD `JobPosting`, elemen judul/perusahaan/lokasi/gaji/deskripsi, tempat tombol Lamar/Simpan situs, perilaku SPA. LinkedIn saat login hanya lewat Claude in Chrome dengan izin pemilik, hanya membaca. Tulis temuan di bagian baru di akhir `02-teknis.md` (tanggal, tanpa menyalin teks lowongan), lalu perbaiki pola di `@rezumi/job-sites` dan izin host di manifest bila berbeda dari rancangan.
3. **Adaptor** empat situs sesuai kontrak 7.1, **pembaca umum** (7.2), **teks terpilih**, navigasi SPA (7.3), batas ukuran dan perapian teks (7.5), `validThrough` dan tautan lamar bila ada.
4. **Fixtures sintetis** per situs (detail, daftar + detail, daftar tanpa pilihan, lowongan kedaluwarsa, antarmuka Indonesia) dan tes unit adaptor. Fixtures meniru struktur, bukan menyalin isi asli.
5. **Cara umum diuji** di minimal tiga situs lain: satu dengan JSON-LD (misalnya halaman karier perusahaan), satu tanpa JSON-LD, dan Kalibrr atau Dealls.
6. **Laporan halaman:** layar 3.5 di panel memanggil `applications.reportCapture` (Phase 02) dengan isi sesuai #8. Bila Phase 02 belum selesai, siapkan panggilannya di balik antarmuka dan sambungkan di Phase 04.
7. **Tampilan debug di build dev:** panel menampilkan hasil baca mentah (kolom, sumber tiap kolom: adaptor/JSON-LD/umum) untuk memudahkan perbaikan nanti; tidak ada di build produksi.

### Aturan yang wajib dijaga

- Tidak menekan apa pun di situs loker, tidak menjelajah otomatis, tidak membaca halaman di luar permintaan pengguna (kecuali menghitung kunci dari URL).
- Content script tetap ≤ 50 KB, tanpa React/Zod.
- Teks dari halaman tidak pernah disisipkan sebagai HTML.

### Tes dan verifikasi

- Unit adaptor dengan fixtures (semua keadaan di langkah 4), unit `@rezumi/job-sites` untuk pola yang diperbarui.
- Playwright: fixtures dilayani di hostname asli keempat situs → panel debug menampilkan kolom yang benar; perpindahan lowongan di SPA memperbarui kunci.
- Tabel hasil halaman nyata di laporan: situs × kolom (terisi/kosong), dari halaman sungguhan.

### Selesai bila

- Di halaman nyata keempat situs (detail dan daftar + detail), minimal posisi, perusahaan, dan deskripsi terbaca; lokasi, gaji, dan batas waktu terbaca bila situs menampilkannya.
- Cara umum mengisi deskripsi di tiga situs lain, dan posisi/perusahaan bila ada JSON-LD.
- Laporan halaman bisa dikirim (email tercatat di log server lokal).
