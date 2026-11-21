# Phase 02 — Design system baru

| Dikerjakan              | Ukuran | Bergantung pada | Perlu dari pemilik      |
| ----------------------- | ------ | --------------- | ----------------------- |
| Claude + review pemilik | Besar  | Phase 01        | Melihat galeri komponen |

## Untuk pemilik

**Apa yang dibuat:** "kotak perkakas" tampilan app yang baru: warna, huruf, ikon, tombol, isian, kartu, lembar, dan seterusnya, sama dengan web. Layar lama belum ditulis ulang, tetapi warnanya langsung ikut palet baru supaya tidak terlihat seperti produk lain.

**Prompt:** `Kerjakan Phase 02 dari .agents/docs/plans/mobile/README.md`

**Yang bisa kamu cek di akhir:** galeri komponen (satu layar berisi semua komponen) di iPhone dan Android, terang dan gelap, berdampingan dengan komponen web yang sama.

## Untuk agent

### Langkah

1. Baca `apps/web/DESIGN.md`, `packages/ui/src/styles/globals.css`, dokumen HeroUI Native terpasang (skill `heroui-native`, MCP `heroui-pro`), dan `01-desain.md` bagian 5, `02-teknis.md` bagian 3.
2. **Pindahkan yang lama:** `src/ui` → `src/ui-legacy`; tulis ulang impor `@/ui` di layar lama secara mekanis. App harus tetap jalan.
3. **Tema:** variabel tema HeroUI Native di `global.css` dengan nilai web (terang/gelap), token Rezumi (paper, tahap), radius, jarak, tipe, gerak. Selesaikan butir **[cek]** `oklch`. Mode sistem/terang/gelap memakai preferensi yang sudah ada.
4. **Font:** selesaikan butir **[cek]** lisensi; bundel Google Sans 400/500/600/700 dan Google Sans Code; skrip non-Latin tetap memakai font sistem.
5. **Ikon:** `@rezumi/icons` + `react-native-svg` di `src/ui/icon.tsx`; varian garis dan duotone; nama sama dengan web. Pastikan semua nama yang dipakai layar lama tersedia (buat daftar yang hilang; tambah lewat `icons:sync` hanya bila sumber ekspornya ada, selain itu petakan ke ikon terdekat dan catat).
6. **Komponen `src/ui`:** sesuai tabel `02-teknis.md` 3.3. Minimal: Text, Button, IconButton, Card/Surface, ListGroup/ListRow, TextField/TextArea/Select/Switch/Checkbox/Radio/Slider/SearchField/OTP, Chip/Tag, Avatar, Banner/Alert, Toast (dengan Undo), Dialog, Menu, Sheet (TrueSheet), Tabs/Segment, Skeleton, EmptyState (tiga jenis seperti web), ProgressBar, Stepper, FAB, SwipeableRow, DatePicker, Screen (area aman, gulir, keyboard, tarik-segarkan), TopBar. Tiap komponen: label aksesibilitas, target 44 pt, haptik sesuai `01-desain.md`.
7. **Komponen Pro:** coba tiap komponen Pro yang direncanakan di dua platform; yang bermasalah diganti buatan sendiri dan dicatat.
8. **Jembatan lama:** petakan token `ui-legacy/tokens.ts` ke palet dan font baru (aksen, latar, permukaan, teks, radius) tanpa menyentuh layar lama.
9. **Galeri:** tulis ulang `app/dev/ui.tsx` sebagai galeri komponen baru (hanya build pengembangan), dipecah per kelompok. Putuskan nasib pratinjau web (`preview:web`): pertahankan bila galeri jalan di sana tanpa usaha besar, selain itu hapus bersama dependensi web-nya.
10. **`apps/mobile/DESIGN.md`** (baru): token, komponen dan kapan dipakai, aturan do/don't dari web yang berlaku, perbedaan sengaja iOS/Android, daftar komponen Pro yang dipakai/ditolak.
11. **Tes penjaga** (`02-teknis.md` 9.1): hex dan `style` statis ditolak di `src/features` dan `app` untuk file yang sudah dimigrasi (daftar pengecualian = layar lama, menyusut tiap phase).

### Tes dan verifikasi

- Tes komponen RNTL untuk tiap komponen (render, tekan, nonaktif, label aksesibilitas).
- Galeri di iPhone dan Android: terang/gelap, teks diperbesar, RTL (bahasa Arab) untuk tata letak.
- Bandingkan berdampingan dengan web untuk tombol, isian, kartu, chip: warna dan radius sama.

### Selesai bila

- Semua komponen di daftar ada, teruji, dan tampil benar di dua platform.
- Layar lama tetap jalan dengan palet baru.
- `apps/mobile/DESIGN.md` ada dan menjadi rujukan phase berikutnya.
