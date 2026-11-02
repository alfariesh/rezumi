# Phase 08 — Mobile: paket, kuota, dan kredit (tanpa pembelian di app)

| Dikerjakan | Ukuran | Bergantung pada  | Perlu dari pemilik |
| ---------- | ------ | ---------------- | ------------------ |
| Claude     | Sedang | Phase 03, 05, 07 | —                  |

## Untuk pemilik

**Apa yang dibuat:** app Android dan iOS mengikuti aturan paket dengan cara yang aman untuk review toko (keputusan 2 November 2026, `00-keputusan-produk.md` bagian 6):

- **Android:** ada halaman "Paket" yang menunjukkan paket aktif, berlaku sampai kapan, pemakaian CV/surat, saldo kredit, dan pilihan Rezumi AI. Ada satu kalimat "Paket bisa dibeli di situs rezumi.app" **tanpa tombol, tautan, atau harga**.
- **iOS:** tidak ada halaman Paket, saldo, Rezumi AI, label premium, atau ajakan membeli. App hanya menampilkan apa yang memang bisa dipakai akun itu. Pembeli tetap mendapat haknya (misalnya bisa membuat lebih dari 3 CV).
- Di kedua app, pesan batas bersifat netral, misalnya "Batas 3 CV aktif sudah tercapai. Pindahkan CV ke Trash untuk membuat yang baru."

**Siapkan:** tidak ada.

**Prompt:** `Kerjakan Phase 08 dari .agents/docs/plans/membership/README.md`

**Yang bisa kamu cek di akhir:** screenshot simulator iOS dan Android dengan akun Gratis dan akun berbayar (diberi lewat admin), memperlihatkan perbedaan di atas.

## Untuk agent

### Konteks

- Phase 03, 04, 05 sudah menambah UI mobile (halaman Paket baca-saja, dialog batas, label template, sumber AI). Phase ini **memastikan semuanya mengikuti aturan per platform**, merapikan yang tertinggal dari Phase 07 (paritas tampilan riwayat/status), dan mencatat pengecualian.
- App mobile memakai OAuth bearer sebagai klien resmi (`apps/mobile/src/auth/oauth.ts`); aturan API/MCP tidak boleh memblokirnya (Phase 03).
- Belum ada app yang dirilis di toko (`.agents/docs/mobile-release-handoff.md`: "Not ready for store submission yet").

### Langkah

1. **Satu sumber aturan tampilan** — buat helper `apps/mobile/src/features/billing/visibility.ts`, misalnya `billingSurface()` → `"full"` (Android), `"none"` (iOS), berdasarkan `Platform.OS` dan `billing.summary.enabled`. Semua komponen billing di mobile membaca helper ini. Jangan menyebar `Platform.OS === "ios"` di banyak tempat.
2. **Android (`"full"`)**:
   - Layar `apps/mobile/app/(tabs)/settings/membership.tsx`: paket aktif, berlaku sampai (zona waktu akun; default WIB), antrean, pemakaian CV/surat, fitur, saldo kredit + kedaluwarsa terdekat, riwayat pembelian (tanggal, paket, nominal, status) **tanpa tombol beli dan tanpa tautan ke halaman bayar**. Satu kalimat informatif tanpa tautan: "Paket bisa dibeli di situs rezumi.app." Bukti bayar ditampilkan secara native (tanpa membuka web).
   - Rezumi AI tersedia sebagai sumber AI dengan saldo dan biaya per tindakan (Phase 05). Dialog kredit kurang: pakai koneksi sendiri atau batal, plus kalimat informatif yang sama — tanpa tombol ke web.
3. **iOS (`"none"`)**:
   - Sembunyikan baris/layar Paket, saldo kredit, Rezumi AI, label "Premium/Plus", dan setiap kalimat tentang membeli atau situs.
   - Pemilih template menampilkan template yang bisa dipakai akun (Gratis: `FREE_TEMPLATES`; berbayar: semua) tanpa label. Opsi ekspor menampilkan Word/ODT hanya bila `features.wordOdtExport` benar. Custom Styles/font mengikuti fitur yang sama.
   - App iOS **tidak pernah** mengirim `aiSource: "rezumi"`; AI hanya lewat koneksi sendiri seperti sekarang.
   - Error batas dari server tampil apa adanya (server sudah netral, Phase 03).
4. **Pesan server netral** — periksa ulang semua pesan `PLAN_LIMIT_REACHED`, `PLAN_FEATURE_REQUIRED`, `INSUFFICIENT_CREDITS` di server: tanpa harga, tanpa kata "beli/upgrade di", tanpa URL. Web menambahkan CTA sendiri berdasarkan kode error.
5. **Penyegaran hak akses** — setelah pengguna membeli di web, app memperbarui `billing.summary` saat kembali ke foreground dan pada pull-to-refresh di layar terkait (pola React Query yang sudah ada).
6. **Kompatibilitas** — app versi lama (tanpa UI billing) tetap berfungsi: hanya melihat pesan error netral dan tidak memakai kredit. Tes: request tanpa `aiSource` tidak memotong kredit.
7. **Pengecualian parity** — tambahkan di `.agents/docs/mobile-release-handoff.md` → "Feature parity exceptions":
   - "Membeli paket hanya di web (keputusan pemilik 2026-11-02). Android menampilkan status paket dan kredit tanpa pembelian; iOS tidak menampilkan UI paket/kredit/Rezumi AI sampai In-App Purchase tersedia (backlog L1)."
   - Admin billing hanya di web (alat internal).
8. **Catatan review toko** — perbarui `.agents/docs/mobile-store-review.md`:
   - Pertahankan kalimat yang benar: tidak ada pembelian di dalam build ini. Jangan menulis klaim yang tidak benar dan jangan menyembunyikan fitur dari reviewer.
   - Google Play: jelaskan bahwa app consumption-only (FAQ Payments Google mengizinkan) dan kalimat informatif tanpa tautan.
   - Catat risiko Apple 3.1.3(b) dan rencana L1 bila ditolak.
9. **Rilis** — perubahan ini JavaScript saja → bisa dikirim sebagai EAS Update, tetapi workflow OTA saat ini yatim (`CLAUDE.md` → Native mobile app). Untuk rilis pertama di toko, perubahan ikut build toko. Jalankan `eas fingerprint:compare` dari `apps/mobile` bila ada build terpasang untuk memastikan tidak ada perubahan native.
10. **Teks** — Lingui + `pnpm lingui:extract`.

### Tes dan verifikasi

- Tes unit helper visibilitas dan komponen: Android menampilkan layar Paket tanpa tombol/tautan; iOS tidak menampilkan elemen billing apa pun; pemilih template dan opsi ekspor iOS sesuai fitur akun.
- Cari di kode mobile: tidak ada URL halaman billing web, kata "Rp", atau tombol beli di jalur iOS (`grep` dan tes).
- Jalankan di simulator iOS dan emulator Android bila tersedia (`mcp__Claude_Code_iOS_Simulator__control` untuk iOS), akun Gratis dan akun berbayar; lampirkan screenshot.
- `pnpm --filter mobile typecheck`, `pnpm --filter mobile test`, lalu lint dan format standar dari README.

### Selesai bila

- Aturan per platform diterapkan lewat satu helper, terbukti dengan tes dan screenshot, pengecualian parity dan catatan review diperbarui, dan app lama tetap aman.
