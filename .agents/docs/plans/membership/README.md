# Membership dan pembayaran Rezumi — mulai di sini

Folder ini berisi rencana lengkap untuk menjual paket berbayar Rezumi di Indonesia dengan Midtrans. Rencana dipecah menjadi **phase**: satu phase dikerjakan dalam satu sesi Claude.

- Keputusan produk (paket, harga, aturan): [00-keputusan-produk.md](00-keputusan-produk.md)
- Rancangan teknis (untuk agent): [01-arsitektur.md](01-arsitektur.md)
- Latar belakang riset awal: [../../research/monetisasi-membership-indonesia-2026-10-31.md](../../research/monetisasi-membership-indonesia-2026-10-31.md)

## Cara memakai (untuk pemilik)

1. Buka **sesi Claude baru** untuk setiap phase.
2. Tempel prompt ini (ganti nomornya):

   ```text
   Kerjakan Phase 01 dari .agents/docs/plans/membership/README.md
   ```

3. Claude membaca dokumen, mengecek apa yang perlu kamu siapkan, lalu bertanya bila ada yang kurang. Jawab saja di chat.
4. Di akhir sesi Claude memberi laporan berbahasa awam: apa yang berubah, cara mengecek, apa yang belum, dan apa tugasmu. Claude lalu menawarkan commit dan Pull Request.
5. **Merge ke `main` = langsung tayang di produksi** (deploy otomatis). Fitur berbayar tetap tersembunyi oleh saklar `BILLING_MODE` sampai Phase 11, tetapi tetap baca ringkasan sebelum merge.
6. Lanjut ke phase berikutnya sesuai urutan di bawah.

Prompt lain yang bisa dipakai:

| Kebutuhan                            | Prompt                                                                                                         |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Melanjutkan phase yang terpotong     | `Lanjutkan Phase 06 dari .agents/docs/plans/membership/README.md`                                              |
| Dibantu mengerjakan tugas non-kode   | `Bantu saya mengerjakan Phase 00 dari .agents/docs/plans/membership/README.md`                                 |
| Menanyakan posisi rencana            | `Apa status rencana membership? Baca .agents/docs/plans/membership/README.md`                                  |
| Mengubah harga/isi paket             | `Ubah harga Plus menjadi Rp39.000 mengikuti katalog di .agents/docs/plans/membership`                          |
| Ada masalah pembayaran setelah rilis | `Ada pelanggan bilang sudah bayar tapi belum aktif. Ikuti runbook-pemilik.md di .agents/docs/plans/membership` |

## Urutan phase dan status

Status: ⬜ belum mulai · 🟡 berjalan/sebagian · ✅ selesai · ⛔ diblokir (lihat catatan).

| Phase | Judul                                                                      | Dikerjakan                 | Perlu dari pemilik sebelum mulai                           | Bergantung pada | Status |
| ----- | -------------------------------------------------------------------------- | -------------------------- | ---------------------------------------------------------- | --------------- | ------ |
| 00    | [Persiapan bisnis dan akun](phase-00-persiapan-pemilik.md)                 | Pemilik (+Claude membantu) | —                                                          | —               | ⬜     |
| 01    | [Fondasi billing: katalog, hak akses, saklar](phase-01-fondasi-billing.md) | Claude                     | —                                                          | —               | ✅     |
| 02    | [Halaman legal dan kesiapan website](phase-02-legal-dan-website.md)        | Claude + review pemilik    | Data identitas usaha (Phase 00 bagian A)                   | —               | 🟡     |
| 03    | [Penegakan batas paket](phase-03-batas-paket.md)                           | Claude                     | —                                                          | 01              | ✅     |
| 04    | [Ledger kredit Rezumi AI](phase-04-ledger-kredit.md)                       | Claude                     | —                                                          | 01              | ✅     |
| 05    | [Rezumi AI dan meteran di semua fitur AI](phase-05-rezumi-ai.md)           | Claude                     | API key provider AI untuk uji lokal                        | 04              | ✅     |
| 06    | [Midtrans: checkout, notifikasi, rekonsiliasi](phase-06-midtrans-inti.md)  | Claude                     | Akun Midtrans sandbox + server key sandbox di `.env.local` | 01, 04          | ⬜     |
| 07    | [Halaman beli dan riwayat di web](phase-07-ui-beli-web.md)                 | Claude                     | —                                                          | 03, 04, 06      | ⬜     |
| 08    | [Mobile: paket, kuota, kredit](phase-08-mobile.md)                         | Claude                     | —                                                          | 03, 05, 07      | ⬜     |
| 09    | [Operasional: admin, peringatan, runbook](phase-09-operasional.md)         | Claude                     | Email pemilik untuk peringatan                             | 06              | ⬜     |
| 10    | [Benchmark biaya AI dan kalibrasi kredit](phase-10-benchmark-ai.md)        | Claude + pemilik           | API key AI produksi + batas anggaran uji                   | 05              | ⬜     |
| 11    | [Staging, uji menyeluruh, dan go-live](phase-11-staging-golive.md)         | Claude + pemilik           | Midtrans production aktif, kunci produksi, waktu uji       | Semua           | ⬜     |

Phase 00 bisa dimulai sekarang dan berjalan paralel karena pendaftaran Midtrans dan urusan legal memerlukan waktu. Phase 01–05 tidak membutuhkan Midtrans. Pekerjaan setelah go-live (IAP toko aplikasi, perpanjangan otomatis, voucher kampus, dan lain-lain) ada di [backlog-lanjutan.md](backlog-lanjutan.md).

## Aturan wajib untuk setiap sesi agent

Bagian ini untuk Claude. Pemilik tidak perlu menghafalnya.

1. **Baca dulu:** `CLAUDE.md` di root repo, README ini, `00-keputusan-produk.md`, `01-arsitektur.md`, lalu dokumen phase. Phase yang menyentuh pembayaran juga memuat skill `integrate-midtrans-payments` dan menjalankan preflight-nya; phase yang menyentuh Cloudflare memuat skill `cloudflare`/`wrangler`.
2. **Cek prasyarat.** Bila ada yang belum disiapkan pemilik (lihat kolom tabel dan bagian "Untuk pemilik" di phase), berhenti dan sebutkan persis apa yang dibutuhkan dan cara menyiapkannya. Jangan menebak kunci, URL, atau keputusan bisnis.
3. **Keputusan bisnis tidak diubah diam-diam.** Bila implementasi menunjukkan aturan di `00-keputusan-produk.md` tidak bisa atau tidak sebaiknya dipakai, jelaskan pilihan dan tanyakan pemilik. Catat keputusan baru di log keputusan dokumen itu.
4. **Git:** jalankan `git status --short` sebelum mengedit; jangan menyentuh perubahan yang tidak terkait. Buat branch `feat/membership-NN-<slug>` dari `main` terbaru. Commit memakai Conventional Commits. Jangan merge ke `main` tanpa persetujuan pemilik.
5. **Saklar:** semua perilaku baru berada di balik `BILLING_MODE` (default `off`). Dengan `off`, produk harus berperilaku sama persis seperti sebelumnya. Ini dibuktikan dengan tes.
6. **Rahasia:** jangan pernah menulis server key, token, atau password di kode, dokumen, tes, log, atau chat. Minta pemilik mengisinya sendiri di `.env.local` (lokal) atau `pnpm exec wrangler secret put <NAMA>` (produksi). Kunci produksi hanya dipakai di Phase 11 dengan persetujuan eksplisit pemilik.
7. **Parity web–mobile** (aturan `CLAUDE.md`): perubahan fitur pengguna di web punya pasangan di mobile pada phase yang sama, kecuali dokumen phase menyebut pengecualian yang sudah diputuskan pemilik.
8. **Kualitas:** string baru memakai Lingui lalu `pnpm lingui:extract`; jalankan typecheck, tes paket yang berubah, `pnpm exec turbo boundaries` bila mengubah ekspor/impor antarpaket, `pnpm exec vp lint --fix <path>`, `pnpm exec vp fmt <path>`, lalu `pnpm lint:agent` dan `pnpm format:check`. Laporkan jumlah tes yang benar-benar berjalan; jangan mengaku lulus bila dilewati.
9. **Dokumen ikut diperbarui:** bila desain berubah saat implementasi, perbarui `01-arsitektur.md`. Panduan pengguna di `docs/` diperbarui bila tampilan atau perilaku pengguna berubah.
10. **Akhir sesi:** perbarui kolom Status di tabel atas dan tambahkan satu baris di "Catatan sesi" (tanggal, phase, hasil, sisa pekerjaan, tugas pemilik). Lalu beri laporan dengan format di bawah.
11. **Bila konteks sesi hampir habis:** berhenti di titik yang aman (tes lulus, tidak ada perubahan setengah jadi), set status 🟡, tulis langkah lanjutan yang konkret di "Catatan sesi", dan minta pemilik membuka sesi baru dengan prompt "Lanjutkan Phase NN".

Format laporan akhir untuk pemilik (bahasa awam, singkat):

```text
Phase NN — <judul>: selesai / sebagian
Yang berubah: …
Cara mengecek sendiri: …
Tes yang dijalankan: … (jumlah lulus/gagal)
Belum dikerjakan / risiko: …
Tugasmu sebelum phase berikutnya: …
```

## Isi folder

| File                     | Isi                                                                            |
| ------------------------ | ------------------------------------------------------------------------------ |
| `00-keputusan-produk.md` | Paket, harga, aturan bisnis final, perubahan dari proposal awal, log keputusan |
| `01-arsitektur.md`       | Rancangan teknis: lokasi kode, tabel, status, alur, invariant, konfigurasi     |
| `phase-00` … `phase-11`  | Instruksi tiap phase                                                           |
| `backlog-lanjutan.md`    | Ide setelah go-live dan syarat memulainya                                      |
| `runbook-pemilik.md`     | Dibuat di Phase 09: langkah menangani masalah pembayaran                       |

## Catatan sesi

| Tanggal    | Phase | Hasil                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-11-02 | —     | Rencana dibuat: review proposal 31 Oktober, riset Midtrans/Cloudflare/kebijakan toko, dokumen phase 00–11                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-11-02 | 01    | Selesai di branch `feat/membership-01-fondasi-billing`: katalog `@rezumi/schema/billing`, tabel `billing_account`/`membership_period`/`billing_audit_log` (migrasi `20261102033349_thin_wilson_fisk`), modul `packages/api/src/features/billing` (kunci akun, jadwal masa aktif, hak akses, `billing.summary`, admin grant/revoke), `BILLING_MODE` (default `off`), flag publik `billing`, homepage membaca katalog. Tes: schema 99, api 677 (29 billing, 7 di antaranya DB nyata). Sisa: belum di-merge. Tugas pemilik: review PR, tidak ada yang perlu disiapkan untuk Phase 03/04.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-11-02 | 02    | Draf legal ID/EN (S&K, privasi, refund, kontak), navigasi/tautan web–mobile, seller config, pembersihan klaim, pricing mengikuti flag billing dengan CTA Segera tersedia. Validasi dan keputusan tersisa: [review Phase 02](phase-02-review.md). Identitas/alamat/nomor dan usia 18+ diterima; layanan Senin–Jumat 09.00–17.00 WIB, respons awal maksimal 3 hari kerja. Belum final: konfirmasi email, tenggat penyelesaian, retensi/provider dan persetujuan draf. Tidak deploy atau mengaktifkan billing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-11-02 | 03    | Selesai di branch `feat/membership-03-batas-paket`: batas 3 CV/3 surat aktif di semua jalur buat/impor/duplikat/copy-for-job/tailoring/restore (kunci akun, termasuk surat bawaan file impor), template premium (create/update/patch; impor diganti Bronzor), Custom Styles, ekspor Word/ODT (REST/MCP + klien), API/MCP butuh `automationApi` kecuali sesi web dan app mobile resmi. UI: halaman Paket web + layar Paket Android, dialog/alert batas, label "Plus", Word/ODT dan CSS terkunci; iOS hanya menampilkan yang bisa dipakai. Teks id-ID diterjemahkan. Tes: schema 101, api 704 (+17 DB nyata), server 187, web 434, mobile 33. Unggah font belum ada di kode (tidak ada titik penegakan). Tidak deploy; `BILLING_MODE` tetap `off`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-11-02 | 04    | Selesai di branch `feat/membership-04-ledger-kredit`: tabel `ai_credit_grant`/`ai_credit_usage` (migrasi `20261102055558_panoramic_shen`; `payment_id` tanpa FK sampai Phase 06), `credits.ts` (grant, kredit coba sekali per akun, reserve/commit/release idempoten, koreksi admin, saldo, riwayat), bobot awal `CREDIT_COSTS` per jenis pekerjaan, `runBillingJobs` melepas reservasi macet >15 menit (Workers `scheduled()` + scheduler Node `job-scheduler.ts`, error terpisah dari career), `billing.summary.credits`, `billing.creditHistory`, `billing.admin.adjustCredits` (wajib alasan, audit). UI baca saja: saldo, kedaluwarsa terdekat, kredit coba, aktivitas terbaru di halaman Paket web dan Android; iOS tidak berubah. Kartu "Your plan" untuk Plus (biru) dan Pro AI (ungu→biru) dengan konten kaca, teks putih dan shimmer, atas review pemilik. Teks id-ID diterjemahkan. Tes: schema 102, api 720 (+DB nyata: 69 tes billing, termasuk 10 reservasi paralel → tepat 3), server 189, web 438, mobile 33. Web dicek di browser lokal (mode `admins`); layar Android tidak dicek visual (typecheck + lint saja). Belum: kredit coba belum dipanggil (Phase 05), ekspor data belum memuat kredit (Phase 09). Tidak deploy; `BILLING_MODE` tetap `off`. |
| 2026-11-02 | 05    | Selesai di branch `feat/membership-05-rezumi-ai` (ditumpuk di atas Phase 04, PR #13 belum di-merge): AI server tampil sebagai **Rezumi AI** di samping koneksi pribadi saat billing berlaku; `metered-ai.ts` (reservasi → model dibungkus penghitung token + batas kerja → commit/release, kunci idempotensi, klien lama ditolak `AI_SOURCE_REQUIRED` tanpa potong kredit); semua titik masuk AI terpetakan (13 prosedur + MCP), suara dan jadwal tidak pernah Rezumi AI; env opsional `AI_COST_INPUT/OUTPUT_USD_PER_MTOK`. Web: label biaya + pilihan sumber di setiap tombol AI, dialog kredit kurang, Rezumi AI + saldo di Pengaturan AI. Android: biaya dan saldo di dialog izin AI sebelum mengirim; iOS selalu koneksi sendiri. Teks id-ID diterjemahkan. Tes: api 741 (+21 DB nyata meteran; 90 tes billing DB nyata), web 438, server 189, schema 102, mcp 21, mobile 34 (+tes Rezumi AI Android/iOS). Uji lokal dengan key pemilik (Claude Haiku 5.5, mode `admins`): satu tindakan per jenis pekerjaan, token tercatat (lihat laporan). Belum: tarif `AI_COST_*` belum diisi (biaya dolar kosong), panduan `docs/` baru draf di laporan, layar Android tidak dicek visual. Tidak deploy; `BILLING_MODE` tetap `off`.                                           |
