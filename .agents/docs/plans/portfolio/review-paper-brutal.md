# Audit akhir Paper dan Brutal — 2026-11-07

Audit mencakup seluruh penambahan dua tema: skema dan varian, renderer, warna/font, galeri, terjemahan, tooling, dokumentasi, responsivitas, serta interaksi detail karya. Status phase produk lain tetap mengikuti [README](README.md).

## Temuan dan perbaikan

- **Kartu Paper:** tiga tautan ke karya yang sama menyebabkan urutan tab berulang dan pemulihan fokus ke gambar. Kini satu tautan kartu, dengan judul sebagai nama aksesibel; Escape mengembalikan fokus ke kartu semula. Tes perilaku ini mencakup keenam tema.
- **Tipografi dan teks panjang:** nama Paper sekarang memakai lebar kolom sebenarnya. Kedua tema membatasi nama minimal 28 px dan membungkus kata panjang. Ini memperbaiki overflow data valid pada batas panjang skema, serta panel Syne yang melebar pada layar 360/390 px.
- **Paper HP:** tiga metrik berbagi satu baris; empat metrik memakai susunan 2 × 2 dengan garis pemisah. Sel isi solid menjaga kontras teks kecil. Serat asli tetap tampil pada latar dan footer, termasuk mode gelap.
- **Semantik Brutal:** judul karya menjadi heading dan nama aksesibel tautan kartu. Wadah isi memakai elemen blok yang sesuai untuk metrik bersama.
- **Font Brutal:** IBM Plex Mono 400/700 kini dimuat, bukan sekadar disebut dalam CSS. Font judul tetap menjadi font yang dipreload.
- **CSS Paper:** menghapus dua cabang selector yang tidak punya markup; `vector-effect` diterapkan ke path ilustrasi, dan hover gambar menghormati preferensi kurangi gerakan.

## Bukti verifikasi

- **627 tes lulus:** portfolio 359, skema portfolio 61, editor web portfolio 186, server portfolio 21.
- Typecheck `@rezumi/portfolio`, `@rezumi/schema`, `@rezumi/tooling`, `web`, `server` lulus. Typecheck renderer diulang setelah perbaikan terakhir.
- **192 render empat tema lama identik** dengan `HEAD`, mencakup bahasa Indonesia/Inggris, isi penuh/minimal/panjang/RTL, tiga skema warna dan alternatif varian.
- **609 layout Chrome**: 87 fixture × 7 lebar (360, 390, 640, 768, 1024, 1440, 1920 px), termasuk semua pasangan font, varian, latar intro, isi kosong, foto tersembunyi, RTL, satu–empat metrik, dan teks tanpa spasi pada batas skema. Tidak ada overflow horizontal atau nama di bawah batas baca.
- **106 layout persona** dan interaksi Chrome lulus: menu HP, buka/tutup detail karya, lightbox, Escape, latar inert dan pemulihan fokus. Tidak ada galat skrip. Gambar HP, grid karya, mode terang/gelap, RTL dan detail diperiksa secara visual.
- **252 selector CSS** cocok dengan markup pada fixture audit; tidak ada selector tidak sah atau cabang tema yang tidak terpakai setelah mengabaikan status interaksi dan pseudo-element untuk pencocokan.
- Matriks kedua tema dibuat ulang: 32 halaman, 8 detail karya, 42 bingkai efek dan 4 lembar kontak. Galeri memakai JPEG 1200 × 750 dan WebP 600 × 375 dalam Inggris/Indonesia.
- Knip tidak menemukan kode/ekspor/dependensi lepas. Aset tekstur tetap WebP asli 21.594 byte, SHA-256 `6e0284922ec6e100bf30764f54a6f5c3b5fad275b45f51499c9fbfb7b890b9bd`, tanpa ketergantungan runtime pada direktori portfolio pemilik.
- `lint:agent`, `format:check`, `turbo boundaries` dan dry-run Cloudflare lulus. Delapan aset galeri pada build Worker identik dengan sumber, termasuk ukuran gambar dan kedua bahasa.

## Menjalankan pemeriksaan kembali

Jalankan dari root repository:

```sh
pnpm --filter @rezumi/portfolio test
pnpm --filter @rezumi/schema test src/portfolio
pnpm --filter web test src/features/portfolio
pnpm --filter server test src/static/portfolio
pnpm --filter @rezumi/tooling portfolio:previews paper brutal
pnpm --filter @rezumi/tooling portfolio:matrix --themes paper,brutal --personas own --out /tmp/rezumi-theme-review --jobs 2
pnpm knip
pnpm lint:agent
pnpm format:check
pnpm exec turbo boundaries
pnpm check:cloudflare
```

Perbandingan render, pencocokan selector dan fixture batas teks memakai skrip audit sementara di luar repository. Tidak menambah dependensi, endpoint, skrip runtime, migrasi atau pekerjaan mobile. Pemeriksaan Cloudflare adalah dry-run; tidak melakukan deployment dan `PORTFOLIO_MODE` produksi tetap `off`.
