# Phase 07 — Halaman beli, pembayaran tertunda, dan riwayat di web

| Dikerjakan | Ukuran | Bergantung pada  | Perlu dari pemilik |
| ---------- | ------ | ---------------- | ------------------ |
| Claude     | Sedang | Phase 03, 04, 06 | —                  |

## Untuk pemilik

**Apa yang dibuat:** pengalaman membeli di web dari awal sampai akhir: pilih paket → lihat ringkasan (harga, 30 hari, tidak diperpanjang otomatis) → bayar di halaman Midtrans → kembali ke Rezumi dan melihat status → bukti bayar. Ada juga pengingat "pembayaran belum selesai" dan riwayat pembelian.

**Siapkan:** tidak ada. Uji memakai sandbox dari Phase 06.

**Prompt:** `Kerjakan Phase 07 dari .agents/docs/plans/membership/README.md`

**Yang bisa kamu cek di akhir:** di lokal, beli Pro AI dengan simulator sandbox, kembali ke Rezumi, lihat paket aktif, saldo 100 kredit, dan bukti bayar.

## Untuk agent

### Langkah

1. **Halaman Paket** (`apps/web/src/routes/dashboard/settings/billing.tsx`, dari Phase 03) mendapat kartu paket dengan tombol sesuai keadaan: "Beli" (tidak ada paket), "Perpanjang 30 hari" (paket sama aktif), "Upgrade ke Pro AI" (Plus aktif), "Beli Plus" saat Pro AI aktif (masuk antrean). Data dari katalog + `billing.summary`. Tombol hanya ada bila `billing.summary.canPurchase` benar (tambahkan field ini bila belum ada: mode aktif, bukan tamu, email terverifikasi, Midtrans terkonfigurasi, `BILLING_CHECKOUT_PAUSED` mati).
2. **Dialog konfirmasi** sebelum checkout: nama paket, harga final Rupiah, "Akses 30 hari, tidak diperpanjang otomatis", penjelasan dampak pada masa aktif saat ini (pakai fungsi yang sama dengan server untuk menghitung pratinjau, atau minta server menghitungnya lewat `billing.previewPurchase({ planId })`), ringkasan kebijakan refund dengan tautan Syarat & Ketentuan serta Kebijakan Pengembalian Dana (Phase 02), dan teks "Dengan melanjutkan, kamu menyetujui …". Untuk akun tamu atau email belum terverifikasi tampilkan langkah yang perlu dilakukan, bukan tombol bayar.
3. **Checkout** — panggil `billing.checkout({ planId, idempotencyKey })`; tampilkan status memuat; arahkan `window.location` ke `redirectUrl`. Klik ganda tidak membuat dua pembayaran (server sudah idempoten; tombol juga dinonaktifkan selama proses).
4. **Halaman kembali** — rute `/dashboard/settings/billing/return/$paymentId` (Phase 06 sudah memakai alamat ini di `callbacks.finish`, `gopay.callback_url`, dan `shopeepay.callback_url`; lihat `01-arsitektur.md` 6.1–6.2). Tanpa `$paymentId` (Finish URL cadangan dari dashboard), turunkan id dari query `order_id` (`RZ-<id>`). Halaman memanggil `billing.payment({ id })` berkala (mis. tiap 3 detik, maks. ±2 menit, berhenti saat tab tersembunyi), lalu menampilkan: berhasil (paket, berlaku sampai, kredit), menunggu (instruksi + "Lanjutkan pembayaran" ke `redirectUrl` + catatan bahwa VA bisa dibayar nanti sampai batas waktu), gagal/kedaluwarsa (tombol coba lagi). Query `transaction_status`/`result` dari Midtrans tidak dipakai untuk keputusan. Uji dengan dan tanpa garis miring akhir serta dengan query tambahan.
5. **Pembayaran tertunda** — banner di halaman Paket bila ada pembayaran `pending` yang belum kedaluwarsa: paket, nominal, batas waktu, "Lanjutkan pembayaran", dan "Ganti metode pembayaran" (membatalkan yang lama lalu membuat yang baru, `01-arsitektur.md` 6.1 langkah 7).
6. **Riwayat** — `billing.payments({ cursor? })` (bila belum ada di Phase 06) dan tabel di halaman Paket: tanggal, paket, nominal, metode, status, tautan bukti.
7. **Bukti bayar** — rute `billing.receipt.$paymentId` yang bisa dicetak (print CSS): identitas penjual dari Phase 02, nomor pesanan (`provider_order_id`), tanggal dan jam (zona waktu akun; bila masih `UTC` default, pakai `Asia/Jakarta`), paket, periode, nominal, metode, status, dan catatan pajak sesuai `00-keputusan-produk.md` bagian 8. Bukan faktur pajak kecuali pemilik sudah PKP.
8. **Sambungkan pemicu upgrade** — dialog batas/fitur (Phase 03) dan dialog kredit kurang (Phase 05) membuka halaman Paket dengan paket yang relevan sudah dipilih (`?plan=pro-ai`).
9. **Homepage** — tombol paket berbayar di `apps/web/src/features/homepage/pricing.tsx`: bila `flags.billing` benar → ke halaman Paket (lewat daftar/masuk bila belum login, lalu kembali); bila salah → ke pendaftaran saja dan label paket berbayar "Segera tersedia" sesuai keputusan Phase 02.
10. **Teks** — Lingui untuk semua string; `pnpm lingui:extract`. Hindari klaim "paling populer" atau hitung mundur palsu (`00-keputusan-produk.md` bagian 10).
11. **Panduan pengguna** — siapkan draf `docs/guides/` tentang paket, pembayaran, dan refund untuk diterbitkan saat go-live (Phase 11).

### Tes dan verifikasi

- Tes komponen/route untuk setiap keadaan tombol dan halaman kembali (berhasil, menunggu, gagal, kedaluwarsa, tidak ditemukan, bukan milik pengguna).
- Browser E2E `tests/e2e/specs/billing.spec.ts`: mock jaringan di level browser (`page.route`) untuk respons `billing.checkout` dan `billing.payment` sehingga tidak ada panggilan Midtrans sungguhan; uji klik → redirect → kembali → berhasil. Ikuti `tests/e2e/README.md` untuk environment.
- Manual: satu pembelian sandbox penuh lewat UI lokal + tunnel (lihat Phase 06), screenshot setiap tahap untuk laporan.
- Perintah standar dari README, termasuk `pnpm --filter web typecheck`.

### Selesai bila

- Alur beli web lengkap dan teruji (otomatis + satu uji sandbox manual), riwayat dan bukti bayar tersedia, pemicu upgrade tersambung, draf panduan siap.
- Pasangan mobile dikerjakan di Phase 08 (catat di laporan apa saja yang perlu disamakan).
