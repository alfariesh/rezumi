# Phase 01 — Fondasi billing: katalog paket, hak akses, dan saklar

| Dikerjakan | Ukuran | Bergantung pada | Perlu dari pemilik |
| ---------- | ------ | --------------- | ------------------ |
| Claude     | Sedang | —               | —                  |

## Untuk pemilik

**Apa yang dibuat:** "otak" sistem paket. Daftar paket dan harga disimpan di satu tempat, database mencatat masa aktif tiap akun, dan ada saklar `BILLING_MODE` untuk menyalakan fitur berbayar kelak. Belum ada pembayaran dan belum ada batas yang berlaku. **Pengguna tidak melihat perubahan apa pun.**

**Siapkan:** tidak ada.

**Prompt:** `Kerjakan Phase 01 dari .agents/docs/plans/membership/README.md`

**Yang bisa kamu cek di akhir:** Claude menunjukkan tes yang lulus, dan harga di bagian pricing homepage sekarang dibaca dari katalog yang sama dengan server.

## Untuk agent

### Tujuan

1. Katalog paket bersama `@rezumi/schema/billing` (bentuk di `01-arsitektur.md` bagian 3, nilai di `00-keputusan-produk.md` bagian 2).
2. Tabel `billing_account`, `membership_period`, `billing_audit_log` (bagian 4.1, 4.2, 4.6) beserta migrasi.
3. Modul `packages/api/src/features/billing/`: kunci akun, algoritme jadwal masa aktif, perhitungan hak akses, router `billing.summary`, dan prosedur admin minimal untuk memberi/mencabut masa aktif (dipakai untuk tes manual sebelum Midtrans ada).
4. Saklar `BILLING_MODE` dan flag publik untuk homepage.
5. Homepage pricing membaca angka dari katalog.

### Tidak termasuk

Pembayaran, kredit AI, penegakan batas, halaman billing di web/mobile, UI admin. Semua itu phase lain.

### Langkah

1. **Katalog** — buat `packages/schema/src/billing/catalog.ts` (+ `index.ts`), tambahkan subpath eksplisit `"./billing"` di `packages/schema/package.json`. Isi: `planIdSchema`, `PlanDefinition`, `PLANS` untuk `free`, `plus`, `pro-ai`, `BILLING_CATALOG_VERSION = 1`, `FREE_TEMPLATES`, `TRIAL_CREDITS`, `CREDIT_COSTS` (kosong dulu atau nilai awal dari `00-keputusan-produk.md` bagian 5), helper `getPlan(id)` dan `isPaidPlan(id)`. Validasi bahwa setiap id di `FREE_TEMPLATES` ada di `templateSchema` (tes).
2. **Tabel** — `packages/db/src/schema/billing.ts` mengikuti konvensi `auth.ts`/`custom-domain.ts` (id `generateId()`, timestamp dengan zona waktu, nama kolom snake_case, index yang disebut di arsitektur). Ekspor dari `packages/db/src/schema/index.ts`. Kolom `membership_period.payment_id` **belum** dibuat (Phase 06). Jalankan `pnpm db:generate`, baca SQL hasilnya, pastikan tidak ada perubahan pada tabel lain.
3. **Env** — tambah `BILLING_MODE: z.enum(["off", "admins", "on"]).default("off")` di `packages/env/src/server.ts` (kelompok Feature Flags), `.env.example` (dengan komentar), `turbo.json` `globalPassThroughEnv` dan env task tes yang relevan. Jangan tambahkan ke `wrangler.jsonc` sekarang (default `off` sudah cukup).
4. **Kunci akun** — `billing/account.ts`: `lockBillingAccount(tx, userId)`.
5. **Jadwal masa aktif** — `billing/timeline.ts`: fungsi murni `schedulePurchase` dan `revokePeriod` sesuai `01-arsitektur.md` 6.6. Fungsi menerima dan mengembalikan data biasa (tanpa DB), lalu `billing/periods.ts` menerapkan hasilnya ke DB di dalam transaksi.
6. **Hak akses** — `billing/entitlements.ts`: `getBillingMode()`, `isBillingActiveFor(user)` (`on` → semua; `admins` → hanya `role === "admin"`; `off` → tidak ada), `getEntitlements(userId, now)` (bagian 6.7) yang mengembalikan mode tanpa batas bila billing tidak aktif untuk pengguna itu.
7. **Router** — `billing/router.ts` didaftarkan sebagai `billing` di `packages/api/src/routers/index.ts`:
   - `billing.summary` (`protectedProcedure`, GET, tag `Internal` kecuali ada alasan menjadikannya publik di OpenAPI): `{ enabled, planId, currentPeriodEndsAt, upcoming[], limits: { activeResumes: { used, max }, activeCoverLetters: { used, max } }, features }`. `max` bernilai `null` saat tanpa batas. Hitung `used` dari dokumen yang tidak di Trash.
   - `billing.admin.grantPeriod({ userId | email, planId, days, reason })` dan `billing.admin.revokePeriod({ periodId, reason })`: hanya `role === "admin"` dan `authentication.method === "session"`; tulis `billing_audit_log`. Tanpa UI (UI di Phase 09).
8. **Flag publik** — tambahkan `billing: boolean` (true hanya bila `BILLING_MODE === "on"`) ke `packages/api/src/features/flags/router.ts` (tipe `FeatureFlags` dan schema output). Konsumen lama tidak boleh rusak: field baru opsional di sisi klien.
9. **Homepage** — `apps/web/src/features/homepage/plans.ts` mengambil harga, jumlah dokumen, jumlah template, dan kredit dari katalog; teks pemasaran tetap di web. Selaraskan daftar manfaat dengan `00-keputusan-produk.md` (misalnya hapus "Full job search insights" dari Plus bila keputusan tetap begitu). Perhatikan: berkas homepage ini mungkin masih berupa perubahan yang belum di-commit dari sesi lain; jangan menimpa pekerjaan yang tidak terkait.
10. **Dokumen** — perbarui `01-arsitektur.md` bila ada perbedaan, status di README, dan catatan sesi.

### Aturan yang wajib dijaga

- `BILLING_MODE=off` → `getEntitlements` mengembalikan mode tanpa batas; `billing.summary` mengembalikan `enabled: false`. Tidak ada perilaku lain yang berubah.
- Semua mutasi masa aktif melewati `lockBillingAccount` di transaksi yang sama.
- Tidak ada potongan masa aktif yang tumpang tindih.

### Tes dan verifikasi

- Unit: `schedulePurchase` (minimal semua contoh di tabel 6.6 + pembelian tiga kali berturut-turut + pencabutan potongan berjalan dan potongan masa depan), `getEntitlements` per mode, validasi katalog.
- Integrasi DB nyata (bila Docker tersedia): `billing.admin.grantPeriod` paralel dua kali untuk akun yang sama menghasilkan dua potongan berurutan tanpa tumpang tindih. Ikuti pola opt-in `COVER_LETTER_TEST_DATABASE_URL` dengan env baru `BILLING_TEST_DATABASE_URL`, lalu daftarkan di `.github/workflows/ci.yml` dan env task di `turbo.json`. Database lokal: `docker compose -f compose.dev.yml up -d postgres`.
- Perintah:

  ```sh
  pnpm --filter @rezumi/schema test
  pnpm --filter @rezumi/api test src/features/billing
  pnpm --filter @rezumi/schema typecheck
  pnpm --filter @rezumi/db typecheck
  pnpm --filter @rezumi/api typecheck
  pnpm --filter web typecheck
  pnpm exec turbo boundaries
  pnpm lint:agent
  pnpm format:check
  ```

### Selesai bila

- Katalog, tabel, migrasi, modul billing, router, flag, dan env ada dan teruji.
- Tes membuktikan `BILLING_MODE=off` tidak mengubah perilaku.
- Homepage memakai katalog.
- README (status + catatan sesi) dan `01-arsitektur.md` diperbarui.
