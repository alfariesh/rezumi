# Phase 07 — Paket: Gratis dan Plus

| Dikerjakan | Ukuran | Bergantung pada | Perlu dari pemilik                                                          |
| ---------- | ------ | --------------- | --------------------------------------------------------------------------- |
| Claude     | Sedang | Phase 06        | Jawaban aturan turunan #1–#4, #9, #14, dan #16 (`00-keputusan.md` bagian 6) |

## Untuk pemilik

**Apa yang dibuat:** aturan paket untuk portfolio, sesuai keputusanmu 5 November:

- **Gratis:** 1 portfolio, 2 tema, badge "Made with Rezumi" selalu tampil, maks. 6 karya, penyimpanan gambar + PDF usulan 100 MB.
- **Plus/Pro AI:** semua tema, badge bisa disembunyikan, domain sendiri, karya tanpa batas (batas teknis 50), penyimpanan usulan 1 GB.

Juga label "Plus" dan dialog paket di editor, daftar manfaat di halaman Paket dan harga, serta S&K yang diperbarui.

**Siapkan:** jawab tujuh pertanyaan yang akan Claude ajukan: form kontak untuk paket mana, apa yang terjadi saat paket berakhir, apakah domain sendiri untuk CV juga Plus, logo tools di portfolio, besar penyimpanan gambar + PDF per paket, efek intro mana yang khusus Plus, dan apakah rincian statistik (negara, perangkat, perujuk) khusus Plus.

**Prompt:** `Kerjakan Phase 07 dari .agents/docs/plans/portfolio/README.md`

**Yang bisa kamu cek di akhir:** screenshot akun Gratis (tema Plus terkunci, karya ke-7 ditolak dengan pesan jelas) dan akun Plus (semua terbuka) dari server lokal dengan `BILLING_MODE=admins`.

## Untuk agent

### Langkah

1. **Konfirmasi** aturan turunan #1–#4, #9, #14, dan #16 dengan AskUserQuestion (rekomendasi di urutan pertama), lalu pindahkan jawabannya ke log `00-keputusan.md`.
2. **Katalog** (`02-teknis.md` bagian 11): fitur `premiumPortfolioThemes`, `hidePortfolioCredit`, `customDomain`; batas `portfolioWorks` dan `portfolioStorageBytes` (gambar + PDF); `FREE_PORTFOLIO_THEMES`; `PLAN_FEATURE_KEYS`; naikkan `BILLING_CATALOG_VERSION`. Perbarui katalog di `.agents/docs/plans/membership/00-keputusan-produk.md` (dan log-nya) karena isi paket berubah.
3. **Penegakan server** di semua jalur: `create`, `update` (tema premium dan efek intro Plus hanya saat nilainya berubah, badge, jumlah karya), `importWorks`, karya dari tempel tautan, `uploadImage` dan `uploadPdf` (kuota; gambar dari tautan juga masuk lewat `uploadImage`, karena `fetchRemoteImage` hanya mengambilnya tanpa menyimpan), domain (Phase 09 memakai fitur yang sama), dan rincian statistik (`portfolio.statistics` hanya mengirim rincian Analytics Engine bila fitur dimiliki, aturan turunan #16). Pakai helper dan kode error yang ada (`PLAN_FEATURE_REQUIRED`, `PLAN_LIMIT_REACHED`) dengan pesan netral (tanpa harga atau ajakan membeli). Pengecekan batas berada dalam transaksi bersama kunci akun, seperti batas dokumen.
4. **Render publik** membaca hak akses saat ini untuk badge (dan domain di Phase 09); tema premium dan efek intro Plus yang tersimpan tetap dirender.
5. **Paket berakhir**: perilaku sesuai jawaban aturan turunan #2; catat masa tenggang domain untuk Phase 09 di `02-teknis.md`.
6. **UI web**: label "Plus" + gembok + dialog paket di galeri tema, saklar badge, tombol tambah karya, meteran penyimpanan, domain; daftar manfaat di halaman Paket, harga beranda, llms.txt/SEO, S&K ID/EN (draf yang disetujui pemilik).
7. **Mode billing**: semua aturan hanya berlaku saat billing aktif untuk akun (`isBillingActiveFor`); `BILLING_MODE=off` → semua terbuka seperti sekarang.

### Aturan yang wajib dijaga

- Tidak ada jalur (web, API, impor, AI) yang bisa melewati aturan server.
- Paket berakhir tidak pernah menghapus isi portfolio.
- Pesan galat sama untuk semua klien; tombol "Lihat paket" ditambahkan oleh web berdasarkan kode galat.

### Tes dan verifikasi

- Unit + DB nyata: tema premium ditolak di Gratis dan diterima di Plus; update biasa pada portfolio yang sudah memakai tema premium lolos; karya ke-7 ditolak, termasuk 5 permintaan paralel pada akun dengan sisa 1 slot (tepat satu berhasil); badge dipaksa tampil; kuota penyimpanan gambar + PDF (termasuk unggahan paralel); `BILLING_MODE=off` tidak membatasi apa pun.
- Browser lokal (`BILLING_MODE=admins`) dengan akun Gratis dan akun Plus (diberi lewat admin): screenshot.

### Selesai bila

- Semua aturan tabel `00-keputusan.md` bagian 4 ditegakkan di server dan terlihat jelas di web.
- Katalog, halaman harga, dan S&K konsisten.

### Catatan dari hardening Phase 01–06 (2026-11-07, `02-teknis.md` bagian 32)

- Batas teknis penyimpanan sudah ada: 1 GiB dan 3.000 file per akun (`PORTFOLIO_UPLOAD.accountBytes`/`accountFiles`), dicek di `recordUploads` (`packages/api/src/features/portfolio/service.ts`) di bawah kunci baris portfolio, dalam transaksi yang sama dengan insert baris file. Kuota paket masuk di tempat yang sama dan tidak boleh melebihi batas teknis.
- Putuskan apakah file yang masih dalam masa tenggang (tidak dipakai < 24 jam) ikut kuota paket; sekarang ikut dihitung, sedangkan file bertanda `OVERDUE` (portfolio dihapus, `deleteFile`) tidak. `portfolio.get().limits.storageBytes` menampilkan batas teknis; ganti dengan kuota paket akun.
- Editor sudah menggolongkan galat paket (`getPlanProblem`) sebagai `invalid` di `apps/web/src/features/portfolio/editor/save-failure.ts`; ruang karya membaca `limits.works` dari server (`works/limits.ts`).
- Tulisan karena paket berakhir atau berubah tidak boleh menyentuh `updated_at` (versi data) dan mengikuti urutan kunci baris `portfolio` → `portfolio_file`.
