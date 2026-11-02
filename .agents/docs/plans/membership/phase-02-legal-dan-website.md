# Phase 02 — Halaman legal, klaim publik, dan kesiapan website

| Dikerjakan              | Ukuran | Bergantung pada | Perlu dari pemilik                                 |
| ----------------------- | ------ | --------------- | -------------------------------------------------- |
| Claude + review pemilik | Sedang | —               | Tabel identitas penjual (Phase 00 bagian A) terisi |

## Untuk pemilik

**Apa yang dibuat:** dokumen hukum dan klaim publik disesuaikan dengan layanan berbayar di Indonesia:

1. **Syarat & Ketentuan** berbahasa Indonesia (wajib untuk kontrak dengan konsumen Indonesia), termasuk paket, pembayaran, kredit AI, masa aktif, dan refund.
2. **Kebijakan Privasi** sesuai UU Pelindungan Data Pribadi (pemroses pembayaran Midtrans, provider AI, hak pengguna).
3. **Kebijakan Pengembalian Dana** (refund).
4. **Halaman Kontak & Pengaduan**: identitas penjual, cara mengadu, dan tenggat jawaban.
5. Klaim yang tidak lagi benar dihapus: "gratis dan open source", tautan ke GitHub/Crowdin, dan bagian open source di dokumen hukum. Atribusi lisensi MIT tetap dipertahankan (kewajiban lisensi).

Claude menulis draf; **kamu membaca dan menyetujui** isinya. Untuk keamanan, sebaiknya draf S&K dan Kebijakan Privasi dibaca juga oleh konsultan hukum sebelum go-live.

**Siapkan:** tabel identitas penjual di Phase 00 bagian A, dan keputusan usia minimum pengguna.

**Prompt:** `Kerjakan Phase 02 dari .agents/docs/plans/membership/README.md`

## Untuk agent

### Konteks

- Dokumen hukum ada di `docs/legal/` (`terms-of-service.mdx`, `privacy-policy.mdx`, `license.mdx`), diterbitkan di `docs.rezumi.app/legal/...` (situs docs; konfigurasi `docs/docs.json`). App mobile dan web menautkan ke sana (mis. `apps/mobile/src/auth/auth-header.tsx`).
- Isi sekarang berbahasa Inggris, menyebut operator "Salman Alfariesh", kontak `hi@rezumi.app`, dan bagian "Intellectual property and open source" serta self-host.
- Klaim yang ditemukan saat perencanaan (cek ulang dengan grep, termasuk katalog `apps/web/locales/*.po` setelah ekstraksi):
  - `apps/web/src/features/resume/share/web-page-text.ts`: "Made with Rezumi, free and open source".
  - `apps/web/src/routes/dashboard/settings/route.tsx`: tautan "Source" (GitHub), "Translate" (Crowdin proyek Reactive Resume), "Report a bug" (GitHub issues).
  - `apps/mobile/app/(tabs)/settings/index.tsx`: "Report an issue" dan "Source code on GitHub".
  - FAQ dan teks homepage (`apps/web/src/features/homepage/`), README, metadata SEO (`apps/server/src/static/seo.ts`, `apps/web/src/libs/seo.ts`), teks toko di `.agents/docs/mobile-store-review.md`.
- **Berkas homepage dan README sedang diubah di working tree (belum di-commit, mungkin dari sesi lain).** Jalankan `git status --short` dan `git diff` untuk berkas itu; jangan menimpa pekerjaan yang tidak terkait. Bila ragu, tanyakan pemilik.

### Langkah

1. **Rencana bahasa** — konsumen Indonesia: versi Bahasa Indonesia wajib (PP 80/2019 pasal 55; UU 24/2009 pasal 31) dan dinyatakan sebagai versi yang berlaku. Cek apakah `docs/docs.json` mendukung lokalisasi; bila tidak, buat halaman Indonesia di `docs/legal/` (mis. `syarat-dan-ketentuan.mdx`, `kebijakan-privasi.mdx`, `kebijakan-pengembalian-dana.mdx`, `kontak.mdx`) dan pertahankan/selaraskan versi Inggris sebagai terjemahan. Perbarui navigasi docs dan semua tautan dari web/mobile ke halaman yang tepat.
2. **Syarat & Ketentuan** — minimal memuat (PP 80/2019 pasal 53; UU 8/1999 pasal 18): identitas penjual (Phase 00 A), deskripsi layanan dan paket (dari `00-keputusan-produk.md` bagian 2–5), harga dalam Rupiah dan bahwa harga dibekukan saat checkout, cara bayar (Midtrans), kapan akses aktif (setelah pembayaran terverifikasi), masa 30 hari tanpa perpanjangan otomatis, antrean hari saat perpanjang/upgrade, aturan kredit (tidak rollover, tidak bisa diuangkan, kembali bila gagal), apa yang terjadi saat paket habis (dokumen tetap ada), refund dan pembatalan (merujuk kebijakan refund), penangguhan akun karena penyalahgunaan, batas tanggung jawab yang wajar (tanpa klausul yang dilarang pasal 18), perubahan ketentuan dengan pemberitahuan, usia minimum (keputusan pemilik), dan pilihan hukum Indonesia. Hapus bagian self-host/open source; ganti dengan pernyataan bahwa layanan memakai komponen open source dengan lisensinya masing-masing.
3. **Kebijakan Pengembalian Dana** — sesuai `00-keputusan-produk.md` bagian 8 nomor 6: syarat 7 hari dan ≤10 kredit Rezumi AI terpakai untuk pembelian pertama, pembayaran ganda, kegagalan teknis, cara mengajukan (email/kontak), tenggat jawaban, cara pengembalian (lewat Midtrans untuk QRIS/e-wallet; transfer manual untuk VA), dan apa yang terjadi pada akses serta kredit setelah refund. Hindari janji yang tidak bisa dipenuhi (batas waktu refund QRIS dari aplikasi lain hanya ±7 hari di Midtrans).
4. **Kebijakan Privasi** (UU 27/2022; PP 33/2026 berlaku 16 Januari 2027) — data yang diproses untuk akun, dokumen, pembayaran (yang dikirim ke Midtrans: nama dan email; Rezumi tidak menyimpan data kartu/rekening), kredit/AI (yang dikirim ke provider AI), infrastruktur (Cloudflare, Neon), email; dasar pemrosesan; masa simpan (termasuk catatan pembayaran untuk pembukuan setelah akun dihapus, tanpa data pribadi); hak pengguna dan tenggat 3×24 jam; pemberitahuan kebocoran 3×24 jam; transfer ke luar negeri; anak di bawah umur; kontak. Klaim "tanpa pelacakan" hanya bila benar (tidak ada analytics pihak ketiga).
5. **Kontak & Pengaduan** (PP 80/2019 pasal 27) — alamat, email, nomor kontak, prosedur pengaduan, tindak lanjut, tenggat penyelesaian.
6. **Klaim dan tautan publik** — ganti teks "free and open source" dengan teks netral (mis. "Dibuat dengan Rezumi"); ganti tautan GitHub issues dengan email dukungan atau halaman Kontak; hapus tautan sumber kode dan Crowdin Reactive Resume (atau ganti sesuai keputusan pemilik); selaraskan FAQ, homepage, SEO, dan README dengan paket di `00-keputusan-produk.md`. Pertahankan halaman/layar lisensi open source (`docs/legal/license.mdx`, `apps/mobile/app/(tabs)/settings/licences.tsx`) dan file `LICENSE`.
7. **Homepage sebelum go-live** — tampilkan paket dan harga (Midtrans mensyaratkan harga Rupiah terlihat), tetapi selama `flags.billing` belum aktif tombol paket berbayar berlabel "Segera tersedia" dan tidak mengarah ke pembayaran. Hapus "Full job search insights" dari Plus (keputusan v2).
8. **Penyesuaian app** — string mobile/web yang berubah memakai Lingui; jalankan `pnpm lingui:extract`. Perubahan web yang terlihat pengguna punya pasangan mobile (parity), kecuali aturan bagian 6 keputusan produk.
9. **Konfigurasi identitas penjual** — simpan identitas penjual yang dipakai email bukti bayar dan halaman bukti bayar di satu tempat (mis. konstanta di `@rezumi/schema/billing` atau env non-rahasia), supaya Phase 06/07 tidak menulis ulang.

### Aturan

- Jangan mengarang data identitas; pakai tabel Phase 00. Yang belum diisi → placeholder jelas + daftar di laporan.
- Tandai di laporan bagian mana yang sebaiknya ditinjau konsultan hukum.
- Jangan menerbitkan janji fitur yang belum ada (mis. auto-renew, IAP).

### Tes dan verifikasi

- Build docs bila ada perintahnya (cek `package.json` root/docs), atau minimal validasi MDX dan tautan internal.
- Grep ulang: tidak ada lagi "open source" sebagai klaim layanan, tautan GitHub issues/source di app, atau "no paid tier"/"semua fitur gratis".
- Typecheck dan tes untuk berkas web/mobile/server yang berubah; `pnpm lint:agent`; `pnpm format:check`.
- Screenshot homepage (pricing) dan halaman legal di browser pane.

### Selesai bila

- Draf legal Indonesia dan Inggris siap dan disetujui pemilik (atau daftar revisi tercatat), klaim publik bersih, homepage siap menampilkan harga dengan status "Segera tersedia", identitas penjual tersedia untuk phase berikutnya.
