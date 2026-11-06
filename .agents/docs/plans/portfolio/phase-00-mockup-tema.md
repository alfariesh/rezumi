# Phase 00 — Mockup tema dan arah desain

| Dikerjakan               | Ukuran | Bergantung pada | Perlu dari pemilik                                                         |
| ------------------------ | ------ | --------------- | -------------------------------------------------------------------------- |
| Claude + pemilik memilih | Sedang | —               | ±30 menit menilai mockup; contoh website portfolio yang disukai (opsional) |

## Untuk pemilik

**Apa yang dibuat:** enam mockup tema portfolio (halaman HTML contoh, belum masuk aplikasi) memakai persona fiktif. Masing-masing bisa dilihat di HP dan laptop, terang dan gelap, dengan panel kecil untuk mencoba warna aksen dan font. Kamu memilih **4 tema** (2 gratis + 2 Plus), memberi komentar, dan menyetujui namanya. Kamu juga memilih tampilan **widget metrik** (angka hasil kerja seperti "+35% konversi") dari tiga contoh, dan apakah grafik mini ikut di rilis pertama. Produk belum berubah sama sekali.

**Siapkan:** waktu menilai. Bila punya contoh website portfolio yang kamu suka, kirim tautannya di chat.

**Prompt:** `Kerjakan Phase 00 dari .agents/docs/plans/portfolio/README.md`

**Yang bisa kamu cek di akhir:** satu halaman pratinjau (tautan Artifact privat) berisi keenam tema yang bisa dibuka di HP dan laptop, lalu ringkasan pilihanmu yang tercatat di dokumen.

## Untuk agent

### Langkah

1. Baca `01-desain.md` bagian 3–6 dan 14–17. Pilih persona fiktif dari `tooling/templates/personas/` yang cocok untuk tiap arah tema (desainer untuk Kanvas, developer untuk Sintaks, dan seterusnya). Isi lengkap: intro dengan angka pencapaian, Tentang saya, 6 karya (kartu dengan metrik unggulan; satu detail karya terbuka berisi blok Teks, Gambar, Metrik, Video sebagai gambar mini + tombol putar, PDF sebagai kartu, dan Tautan sebagai kartu), Layanan, Testimoni, Klien, pengalaman, pendidikan, keahlian, sertifikat, satu bagian bebas, kontak dengan form, kaki dengan badge.
2. Gambar karya, logo klien, dan foto testimoni: buat sendiri (komposisi SVG/kanvas abstrak, mockup layar dan logo rekaan buatan sendiri) atau foto Unsplash dengan sumber dicatat di `.agents/docs/template-showcase-sources.json`. Jangan memakai karya, logo merek, atau testimoni orang sungguhan.
3. **Widget metrik** (`01-desain.md` bagian 16, aturan turunan #10): buat satu halaman mockup `mockups/metrik.html` yang membandingkan tiga varian (kartu KPI, angka besar sederet, sebelum → sesudah), masing-masing dengan dan tanpa grafik mini, dalam terang/gelap dan di HP. Lihat anatomi `KPI` HeroUI Pro lewat MCP `heroui-pro` sebagai acuan, tetapi tulis dengan HTML/CSS/SVG biasa seperti halaman publik nanti.
   Buat juga `mockups/efek-intro.html`: setiap kandidat efek intro (`01-desain.md` bagian 18: Muncul halus, Kilau, Gradien hidup, Ketik berganti, Acak teknologi, Garis vektor) diterapkan ke nama persona, dengan tombol putar ulang, versi "kurangi gerakan", dan versi HP. Tulis efeknya sendiri dengan CSS/JS biasa; jangan menyalin kode React Bits (lisensi, `02-teknis.md` bagian 23). Mockup tema juga memuat kartu Lokasi (gambar peta contoh dengan atribusi OpenStreetMap, mode kerja) di bagian Kontak.
4. Tulis mockup statis di `.agents/docs/plans/portfolio/mockups/`: `tokens.css` (token `01-desain.md` bagian 6), satu `<tema>.html` per tema, dan `index.html` yang menautkan semuanya. Mockup memakai token yang sama dengan produk nanti. Panel percobaan (hanya di mockup) mengganti aksen (Ikut CV + 3 contoh, termasuk kuning terang untuk menguji kontras), mode terang/gelap, dan 2 pasangan font. Tanpa dependensi luar kecuali Google Fonts.
5. Cek sendiri sebelum menunjukkan: lebar 390 px dan 1440 px, terang dan gelap, nama sangat panjang, tanpa foto, karya tanpa gambar, `dir="rtl"`. Perbaiki yang rusak.
6. Tunjukkan ke pemilik lewat Artifact privat (muat skill `artifact-design` dulu) yang memuat keenam mockup dan halaman metrik, atau kirim screenshot dengan SendUserFile. Jelaskan setiap tema dalam satu kalimat: untuk siapa dan apa ciri khasnya.
7. Tanya pemilik (AskUserQuestion, rekomendasi di urutan pertama): empat tema mana, dua mana yang gratis, nama final (usulkan alternatif bila nama kerja kurang pas atau mirip nama template CV), varian widget metrik mana yang dipakai (boleh lebih dari satu, sebagai pilihan pengguna), apakah grafik mini masuk rilis pertama, efek intro mana yang dibuat untuk rilis (aturan turunan #13), dan komentar perubahan. Revisi sampai pemilik setuju.
8. Tetapkan bersama keputusan itu: 8 warna aksen kurasi; 5–6 pasangan font per tema (cek ada di `packages/fonts/src/webfontlist.json` dan berlisensi bebas untuk web); varian yang didukung tiap tema (termasuk varian metrik); mode bawaan tiap tema; ID teknis (huruf kecil).
9. Catat hasilnya:
   - `00-keputusan.md`: log keputusan, aturan turunan #8, #10, dan #13 ditandai selesai.
   - `01-desain.md` bagian 16: varian metrik yang dipilih dan keputusan grafik mini; bagian 18: daftar final efek intro dan efek bawaan per tema.
   - `01-desain.md` bagian 5: ganti tabel enam arah dengan spesifikasi final empat tema (tata letak per lebar layar, tipografi, skala, warna bawaan, varian, mode bawaan, gratis/Plus). Dua arah lain pindah ke `backlog-lanjutan.md`.
   - Mockup final di `mockups/` (hapus versi yang ditolak).

### Aturan yang wajib dijaga

- Tidak ada perubahan di kode produk pada phase ini.
- Mockup memperlihatkan batas kustomisasi yang sungguh akan dibangun (bagian 4 `01-desain.md`), bukan fitur yang tidak direncanakan.

### Selesai bila

- Pemilik menyetujui empat tema, namanya, pembagian gratis/Plus, dan varian widget metrik secara tertulis di chat.
- `01-desain.md` bagian 5 dan 16 cukup rinci untuk Phase 02 dan 06 membangun tema tanpa bertanya lagi.
- Mockup tersimpan dan diformat (`pnpm exec vp fmt .agents/docs/plans/portfolio`).
