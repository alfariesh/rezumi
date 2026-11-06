# Phase 03 — Editor: buat portfolio, isi teks, desain, terbitkan

| Dikerjakan | Ukuran | Bergantung pada | Perlu dari pemilik |
| ---------- | ------ | --------------- | ------------------ |
| Claude     | Besar  | Phase 02        | —                  |

## Untuk pemilik

**Apa yang dibuat:** menu **Portfolio** di dashboard (selama mode `admins` hanya untuk admin), dialog "Buat portfolio" (dari CV atau tanpa CV), dan editor dengan pratinjau langsung (desktop/HP) berisi tiga tab:

- **Isi**: urutan dan tampil/sembunyi bagian, intro (sapaan, Open to work, headline dan nama khusus portfolio), Tentang saya, Layanan, Testimoni, Klien (nama), bagian dari CV (sembunyikan item tertentu), bagian bebas, dan kontak. Semua teks panjang memakai **Rich Text Editor HeroUI Pro**.
- **Desain**: mode terang/gelap, warna aksen, font, dan variasi tampilan per bagian.
- **Terbitkan**: saklar terbit, alamat, salin tautan, QR, Google, SEO, bahasa halaman.

Editor karya (dengan blok dan metrik) serta semua unggah gambar menyusul di Phase 04; video, PDF, dan tempel tautan di Phase 05.

**Siapkan:** jawab satu pertanyaan: apakah "Tampil di mesin pencari" menyala sebagai bawaan saat terbit (aturan turunan #5).

**Prompt:** `Kerjakan Phase 03 dari .agents/docs/plans/portfolio/README.md`

**Yang bisa kamu cek di akhir:** screenshot alur lengkap. Setelah merge, kamu bisa mencobanya sendiri di produksi bila akunmu admin dan saklar diubah ke `admins` (tanya Claude caranya).

## Untuk agent

### Langkah

1. **Rute**: `apps/web/src/routes/dashboard/portfolio/index.tsx` (halaman dashboard, `01-desain.md` bagian 8) dan `apps/web/src/routes/builder/portfolio/*` (editor layar penuh, bagian 7). Pastikan `/builder/portfolio` tidak tertangkap `/builder/$resumeId`; route tree dibuat ulang oleh Vite, jangan mengedit `routeTree.gen.ts`. Menu di `apps/web/src/routes/dashboard/-components/app-shell.tsx` hanya tampil bila `portfolio.get().enabled`.
2. **Dialog buat**: CV sumber (CV utama terpilih) atau **Tanpa CV** (nama tampilan, headline; foto menyusul di Phase 04) → tema (galeri sementara berisi satu tema, siap diisi Phase 06) → buat → buka editor.
3. **State editor**: pelajari pola draf builder CV (`apps/web/src/features/resume/builder/draft`) dan pakai ulang yang cocok. Simpan otomatis dengan debounce lewat `portfolio.update` + `expectedUpdatedAt`; konflik → beri tahu dan muat ulang. Undo/Redo bila pola CV mudah dipakai ulang.
4. **Komponen teks kaya** (`02-teknis.md` bagian 15): bungkus `RichTextEditor` HeroUI Pro untuk portfolio (toolbar terbatas, `maxLength` + `CharacterCount`, nilai awal HTML, simpan `details.html`, lazy load). Ambil dokumentasinya dulu lewat MCP `heroui-pro`. Komponen ini dipakai ulang oleh blok Teks di Phase 04.
5. **Tab Isi** (`01-desain.md` bagian 7 dan 17):
   - daftar bagian: seret untuk mengurutkan (dengan tombol naik/turun), sembunyikan, ganti judul;
   - Intro: headline, nama tampilan, lokasi khusus portfolio (kosong = ikut CV), sapaan, foto tampil/tidak, Open to work + teks, tombol (≤3); angka pencapaian menyusul di Phase 04 (memakai form metrik);
   - Tentang saya;
   - Layanan: nama, deskripsi, harga mulai, ikon (pemilih ikon CV), tombol (WhatsApp/form/tautan);
   - Testimoni: kutipan, nama, jabatan, tautan sumber, centang pernyataan (aturan turunan #12 menunggu konfirmasi di Phase 11; centangnya tetap dibuat sekarang); foto menyusul di Phase 04;
   - Klien: nama, tautan, "Ambil dari Pengalaman", logo merek dari set ikon bila dikenali; unggah logo menyusul di Phase 04;
   - bagian dari CV: daftar item + saklar tampil + tautan "Ubah di CV";
   - bagian bebas (gambar menyusul di Phase 04) dan Kontak (Lokasi: label kota, mode kerja, bersedia relokasi, jam lokal; peta menyusul di Phase 05; email, WhatsApp, profil, kalimat ajakan);
   - Karya: daftar sederhana (judul, sembunyikan, urutan) dari isi awal; editor lengkap di Phase 04.
6. **Tab Desain**: tema (galeri sementara), latar intro (polos, gradien lembut, pola; gambar menyusul di Phase 04), mode, aksen (Ikut CV, 8 kurasi, bebas dengan pemilih warna dan catatan bila dikoreksi demi kontras), font (Ikut CV, pasangan tema), varian per bagian dan varian metrik (hanya yang didukung tema). Semua langsung terlihat di pratinjau.
7. **Pratinjau**: iframe inert dengan renderer yang sama (`02-teknis.md` 5.4), pilihan Desktop/HP.
8. **Tab Terbitkan**: saklar terbit dengan dialog (alamat, mesin pencari dengan penjelasan, pemberitahuan alamat pendek bila sebelumnya membuka CV utama), salin tautan, QR (`qrcode.react` sudah dipakai Share CV), SEO, bahasa halaman, CV sumber (termasuk lepas dari CV). Tanyakan aturan turunan #5 sebelum menetapkan bawaan mesin pencari.
9. **Share CV**: teks "Short link" dan "Primary resume" menyesuaikan bila portfolio terbit (alamat pendek membuka portfolio).
10. **Teks**: Lingui, `pnpm lingui:extract`, terjemahan id-ID.
11. **Mobile**: catat portfolio di "Feature parity exceptions" `.agents/docs/mobile-release-handoff.md` (wajib menyusul sebelum rilis toko pertama).
12. **Draf panduan**: buat `draf-panduan-portfolio.md` di folder rencana ini (bahan `docs/guides/creating-a-portfolio.mdx`), diterbitkan di Phase 12.

### Aturan yang wajib dijaga

- Editor tidak pernah menulis `isPublic` lewat `update`.
- Semua aksi bisa dengan keyboard; fokus jelas; label aksesibel; seret-urut punya alternatif tombol.
- Web di HP (≤768 px) bisa dipakai: panel dan pratinjau bergantian.
- Mode `off`: menu, rute, dan teks Share CV sama seperti sebelumnya.

### Tes dan verifikasi

- Tes web untuk logika urut, sembunyi, data dasar khusus portfolio (kosong = ikut CV), konflik simpan, dan teks Share CV.
- Browser pane lokal (`PORTFOLIO_MODE=admins`): buat dari CV dan buat tanpa CV → isi → ubah desain → terbitkan → buka sebagai tamu di jendela tanpa sesi → ubah → halaman ikut berubah; screenshot desktop dan HP; mode `off` → menu tidak ada.
- E2E `tests/e2e/specs/portfolio.spec.ts` (buat, terbit, buka sebagai tamu) bila lingkungan E2E tersedia; bila dilewati, sebutkan di laporan.

### Selesai bila

- Admin bisa membuat (dari CV dan tanpa CV), mengisi teks, mengatur desain, dan menerbitkan portfolio tanpa menyentuh API langsung.
- Draf panduan ada dan pengecualian paritas mobile tercatat.
