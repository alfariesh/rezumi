# Phase 04 — Panel samping dan simpan satu klik

| Dikerjakan | Ukuran | Bergantung pada | Perlu dari pemilik           |
| ---------- | ------ | --------------- | ---------------------------- |
| Claude     | Besar  | Phase 02 dan 03 | Jawaban aturan turunan #2–#5 |

## Untuk pemilik

**Apa yang dibuat:** plugin **benar-benar menyimpan loker**:

1. Tombol **Simpan ke Rezumi** di halaman lowongan empat situs, plus ikon toolbar, menu klik kanan untuk teks terpilih, dan pintasan `Alt+Shift+S` di situs mana pun.
2. Panel samping menampilkan **pratinjau** yang bisa kamu ubah, pilihan status (Disimpan / Sudah dilamar), CV, tag, lalu **Simpan**.
3. Setelah tersimpan, tombol berubah menjadi **"Tersimpan · <status>"**, ikon toolbar bercentang, dan status bisa diubah langsung dari panel. Loker yang sama tidak tersimpan dua kali tanpa sengaja.
4. Beranda panel: lima loker terakhir yang disimpan.
5. Pengaturan plugin: bahasa, tombol di halaman nyala/mati, keluar.

**Siapkan:** jawaban aturan turunan #2–#5 (Claude menanyakannya dengan usulan).

**Prompt:** `Kerjakan Phase 04 dari .agents/docs/plans/plugin-browser/README.md`

**Yang bisa kamu cek di akhir:** dengan plugin uji yang terhubung ke server lokal, simpan satu lowongan dari tiap situs → semuanya muncul di menu Lamaran Rezumi lokal dengan label "Disimpan dari plugin"; buka lagi lowongan yang sama → tombol menunjukkan "Tersimpan".

## Untuk agent

### Langkah

1. **Konfirmasi aturan turunan #2–#5**, catat di `00-keputusan.md`.
2. **Penanda tersimpan** (`02-teknis.md` bagian 9): sinkron `savedKeys`, cache lokal, pencocokan di service worker, chip di halaman, badge per tab.
3. **Panel** sesuai `01-desain.md` 3.2–3.4, 3.6–3.8: pratinjau dari `readCapture` (tanpa AI; saklar AI dari aturan #3 tampil tetapi sambungan biaya/kreditnya dirapikan di Phase 05), edit kolom, status bersegmen + tanggal dilamar, pilih CV, tag (pakai daftar tag dari API yang sudah ada), Simpan lewat `applications.create`, layar tersimpan dengan ubah status (`update`) dan Tambah catatan (`addNote`), aturan duplikat #4. Bagian Kecocokan dan Persiapan boleh berupa tempat kosong yang diisi Phase 05.
4. **Isian tidak hilang:** pratinjau yang diubah disimpan per tab di `chrome.storage.session`; galat 3.7 menyimpan isian dan menawarkan coba lagi.
5. **Tombol dan chip di halaman** (`01-desain.md` bagian 4): Shadow DOM tertutup, anchor adaptor, tombol melayang cadangan, keadaan simpan, aturan #5. **Cek** apakah `chrome.sidePanel.open` bisa dipanggil dari klik di content script (Chrome dan Edge); bila tidak, pakai perilaku cadangan "simpan langsung". Catat hasilnya di `02-teknis.md` bagian 8.
6. **Menu klik kanan** (teks terpilih → pratinjau dengan cara umum), **pintasan** `commands`, **pengaturan** 3.8 (bahasa, tombol di halaman, keluar).
7. **Aksesibilitas:** urutan fokus, label, `aria-live` untuk hasil simpan, kontras AA terang/gelap.
8. **Teks:** Lingui, terjemahan Indonesia lengkap untuk semua layar.

### Aturan yang wajib dijaga

- Tidak ada permintaan jaringan per halaman yang dikunjungi; kunci dicocokkan lokal.
- Menyimpan selalu atas tindakan pengguna; tidak ada simpan otomatis.
- Simpan tanpa AI < 3 detik (ukur di server lokal; catat angka di laporan).

### Tes dan verifikasi

- Unit: keadaan panel per tab, aturan duplikat, pemetaan galat API → layar 3.7.
- Playwright terhadap server lokal: hubungkan (akun uji fiktif) → buka fixture tiap situs → klik tombol di halaman → panel pratinjau → ubah posisi → Simpan → chip "Tersimpan" → lamaran ada di API dengan `postingSource.method = "extension"` dan `sourceUrl` kanonik; buka lagi → tersimpan; ubah status dari panel; galat jaringan menyimpan isian; menu klik kanan dan pintasan.
- Screenshot: panel 360/420 px terang/gelap en/id untuk layar 3.1–3.8, tombol dan chip di fixtures empat situs.
- Pemilik mencoba di Chrome-nya sendiri dengan plugin uji ke server lokal (opsional di sesi ini, wajib di Phase 07).

### Selesai bila

- Alur simpan, penanda tersimpan, ubah status, catatan, menu klik kanan, pintasan, dan pengaturan berjalan di Chrome dan Edge terhadap server lokal.
- Aturan turunan #2–#5 tercatat.
