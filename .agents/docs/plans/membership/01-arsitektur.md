# Arsitektur teknis membership dan pembayaran

Dokumen acuan teknis untuk semua phase. Aturan bisnis (harga, isi paket, kebijakan) ada di [00-keputusan-produk.md](00-keputusan-produk.md); dokumen ini menjelaskan cara membangunnya.

Jika kode, script, atau konfigurasi berbeda dengan dokumen ini, ikuti kode dan konfigurasi (aturan `CLAUDE.md`), lalu catat perbedaannya di laporan phase dan perbarui bagian yang relevan di sini. Fakta Midtrans diverifikasi ulang dari `https://docs.midtrans.com/llms.txt` setiap kali menyentuh kode pembayaran; dokumen resmi menang atas dokumen ini.

## 1. Gambaran besar

```text
Web (apps/web) / Mobile (apps/mobile)
   │  oRPC  billing.*   (cookie sesi web, atau OAuth bearer milik app resmi)
   ▼
packages/api/src/features/billing   ← hak akses, batas, kredit, checkout, fulfillment, admin
   │                         │
   │ Drizzle (Hyperdrive)    │ fetch + Basic Auth (server key)
   ▼                         ▼
PostgreSQL               Midtrans Snap (buat transaksi) + Core API (cek status)
   ▲                         │
   │                         │ HTTP Notification (POST dari server Midtrans)
   │                         ▼
   └──────── apps/server/src/http/midtrans.ts → verifikasi signature → cek status → terapkan

Cron Worker tiap menit (scheduled) → runBillingJobs(): rekonsiliasi pembayaran pending,
kedaluwarsa, pelepasan reservasi kredit macet, email pengingat (Phase 09)
```

Prinsip yang tidak boleh dilanggar:

1. **Server adalah satu-satunya sumber kebenaran hak akses.** Redirect "sukses" dari browser, callback Snap, dan status di URL hanya petunjuk tampilan. Hak akses hanya diberikan setelah notifikasi terverifikasi atau pengecekan status dari server ke Midtrans.
2. **Semua perubahan billing milik satu pengguna diserialkan** dengan mengunci baris `billing_account` (`SELECT … FOR UPDATE`) di dalam satu transaksi database. Pola transaksi + `.for("update")` sudah dipakai di `packages/api/src/features/career/jobs.ts` dan berjalan lewat Hyperdrive.
3. **Idempoten dan monoton.** Notifikasi yang sama boleh datang berkali-kali; hasilnya tetap satu kali aktivasi. Status "sudah dibayar" tidak pernah mundur ke pending/gagal/kedaluwarsa, kecuali menjadi refund.
4. **Database adalah buku catatan, bukan log.** `wrangler.jsonc` memakai `observability.head_sampling_rate: 0.1`, jadi hanya sekitar 10% log Workers tersimpan. Setiap kejadian pembayaran wajib tercatat di tabel (`billing_payment_event`, `billing_audit_log`).
5. **Semua di balik `BILLING_MODE`** (default `off`). Push/merge ke `main` langsung deploy ke produksi lewat `.github/workflows/deploy-cloudflare.yml`, jadi kode billing harus aman dan tidak terlihat sampai go-live (Phase 11).
6. **Kunci rahasia hanya di server.** Server key Midtrans tidak pernah dikirim ke web/mobile, tidak ditulis di log, dokumen, atau chat.

## 2. Peta lokasi kode

| Kebutuhan                                 | Lokasi                                                                                                                                                                                 | Catatan                                                                                                                    |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Katalog paket, harga, kuota, bobot kredit | `packages/schema/src/billing/` diekspor sebagai `@rezumi/schema/billing` (tambah subpath eksplisit di `packages/schema/package.json`)                                                  | Dipakai server, web (homepage + settings), dan mobile. Murni data + tipe, tanpa DB/HTTP.                                   |
| Tabel database                            | `packages/db/src/schema/billing.ts`, diekspor dari `packages/db/src/schema/index.ts`; migrasi via `pnpm db:generate`                                                                   | Konvensi: id `text` dengan `generateId()` (UUIDv7), `timestamp(..., { withTimezone: true })`, nama kolom snake_case        |
| Logika bisnis + router oRPC               | `packages/api/src/features/billing/`, didaftarkan di `packages/api/src/routers/index.ts` sebagai `billing`                                                                             | Pakai `protectedProcedure` dan pola router di `features/custom-domain/router.ts`                                           |
| Endpoint notifikasi Midtrans              | `apps/server/src/http/midtrans.ts`, dipasang di `apps/server/src/http/app.ts`                                                                                                          | `/api/*` sudah masuk `run_worker_first` di `wrangler.jsonc`                                                                |
| Job terjadwal                             | `packages/api/src/features/billing/jobs.ts` (`runBillingJobs`), dipanggil dari `scheduled()` di `apps/server/src/cloudflare/index.ts` dan scheduler Node di `apps/server/src/startup/` | Sekarang `scheduled()` hanya menjalankan `runCareerJobs`                                                                   |
| Env                                       | `packages/env/src/server.ts`, `.env.example`, `turbo.json` (`globalPassThroughEnv` + env task tes), `wrangler.jsonc` (`vars`) / `wrangler secret put`                                  | Aturan "New env var" di `CLAUDE.md`                                                                                        |
| UI web                                    | `apps/web/src/features/billing/`, rute `apps/web/src/routes/dashboard/settings/billing*.tsx`, entri menu di `apps/web/src/features/settings/root.tsx`                                  | Homepage `apps/web/src/features/homepage/plans.ts` pindah membaca katalog bersama                                          |
| UI mobile                                 | `apps/mobile/src/features/billing/` (termasuk helper visibilitas per platform), layar `apps/mobile/app/(tabs)/settings/membership.tsx`                                                 | Tanpa pembelian di app. Android: status paket/kredit; iOS: tanpa UI billing sampai IAP (`00-keputusan-produk.md` bagian 6) |
| Email bukti bayar / pengingat             | `packages/email/src/templates/`                                                                                                                                                        | Pola template React Email yang sudah ada                                                                                   |
| Admin internal                            | `packages/api/src/features/billing/admin.ts` + rute web `apps/web/src/routes/dashboard/admin/`                                                                                         | Hanya `user.role === "admin"`, hanya sesi web. Alat internal, bukan fitur pengguna, jadi tidak perlu versi mobile          |
| Runbook pemilik                           | `.agents/docs/plans/membership/runbook-pemilik.md` (dibuat Phase 09)                                                                                                                   | Bahasa awam                                                                                                                |

Gunakan graph `codebase-memory-mcp` (`search_graph` → `trace_path`) untuk menemukan pemanggil sebelum mengubah fungsi bersama, lalu konfirmasi dengan membaca source.

Isi `packages/api/src/features/billing/` setelah Phase 01:

| Berkas            | Isi                                                                                                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `account.ts`      | Tipe `Transaction` dan `lockBillingAccount(tx, userId)` (4.1)                                                                                                                                                |
| `timeline.ts`     | Fungsi murni `schedulePurchase`, `revokePeriod`, konstanta `DAY_MS` (6.6)                                                                                                                                    |
| `periods.ts`      | `grantMembershipPeriod(tx, …)` dan `revokeMembershipPeriod(tx, …)`: kunci akun → baca jadwal → terapkan hasil `timeline`                                                                                     |
| `entitlements.ts` | `getBillingMode`, `isBillingActiveFor`, `resolveEntitlements` (murni), `getEntitlements` (6.7)                                                                                                               |
| `limits.ts`       | `countActiveDocuments`, `assertDocumentCapacity`, `precheckDocumentCapacity`, `assertFeature`, `assertDesignChange`, `fitImportedDesign`, error `PLAN_LIMIT_REACHED`/`PLAN_FEATURE_REQUIRED` (Phase 03, 6.8) |
| `automation.ts`   | `isFirstPartyClient`, `firstPartyRedirectUris`, `assertAutomationAccess` (Phase 03, 9.1); diekspor `@rezumi/api/features/billing/automation`                                                                 |
| `admin.ts`        | `assertBillingAdmin` dan `billingAdmin.grantPeriod/revokePeriod` (tulis `billing_audit_log` di transaksi yang sama)                                                                                          |
| `router.ts`       | `billing.summary`, `billing.admin.grantPeriod`, `billing.admin.revokePeriod` (semua tag `Internal`)                                                                                                          |
| `*.test.ts`       | Unit `timeline` + `entitlements`; `billing.integration.test.ts` memakai `BILLING_TEST_DATABASE_URL`                                                                                                          |

MCP memakai allowlist eksplisit (`packages/mcp/src/parity.ts`), dan tag `Internal` menyembunyikan rute dari OpenAPI, jadi prosedur `billing.*` tidak terlihat oleh klien luar. Jangan tambahkan prosedur admin ke allowlist MCP.

## 3. Katalog paket (`@rezumi/schema/billing`)

Satu sumber data untuk semua tempat yang menampilkan atau menegakkan paket. Bentuk yang disarankan:

```ts
export const planIdSchema = z.enum(["free", "plus", "pro-ai"]);
export type PlanId = z.infer<typeof planIdSchema>;
export const paidPlanIdSchema = planIdSchema.exclude(["free"]); // isi membership_period.plan_id
export type PlanLimits = { activeResumes: number; activeCoverLetters: number };

export type PlanFeatures = {
  premiumTemplates: boolean; // template di luar FREE_TEMPLATES
  wordOdtExport: boolean; // ekspor baru .docx dan .odt
  customStyles: boolean; // Custom Styles (CSS) — lihat docs/applying-custom-styles.mdx
  customFonts: boolean; // unggah font sendiri
  automationApi: boolean; // API key dan klien OAuth/MCP pihak ketiga
};

export type PlanDefinition = {
  id: PlanId;
  rank: number; // free 0, plus 1, pro-ai 2 — peringkat lebih tinggi dipakai lebih dulu
  priceIdr: number; // bilangan bulat Rupiah; 0 untuk free
  durationDays: number | null; // 30 untuk paket berbayar
  limits: { activeResumes: number; activeCoverLetters: number };
  features: PlanFeatures;
  creditsPerPurchase: number; // kredit Rezumi AI yang langsung diberikan saat bayar
};

export const BILLING_CATALOG_VERSION = 1; // naikkan setiap harga/isi paket berubah
export const BILLING_CURRENCY = "IDR";
export const FREE_TEMPLATES = ["bronzor", "onyx", "rhyhorn", "azurill"] as const;
export const TRIAL_CREDITS = { amount: 5, validDays: 14 } as const;
export const CREDIT_COSTS = {/* actionKey → kredit, diisi Phase 04/05 */} as const;
export const PLANS = { free, plus, "pro-ai" }; // satisfies { [Id in PlanId]: PlanDefinition & { id: Id } }
export function getPlan(id: PlanId): PlanDefinition;
export function isPaidPlan(id: PlanId): id is PaidPlanId;
```

Homepage (`apps/web/src/features/homepage/plans.ts` dan `faq.tsx`) membaca harga, batas dokumen, jumlah template gratis, kredit Pro AI, dan kredit coba dari katalog ini (Phase 01).

Aturan katalog:

- Nilai awal persis seperti tabel paket di `00-keputusan-produk.md`. Perubahan harga = PR kecil yang menaikkan `BILLING_CATALOG_VERSION`.
- Pembayaran menyimpan salinan harga, durasi, kredit, dan versi katalog saat checkout. Mengubah katalog tidak mengubah pembayaran yang sudah dibuat.
- Teks pemasaran (nama yang diterjemahkan, daftar manfaat) tetap di web/mobile dengan Lingui; katalog hanya berisi data yang ditegakkan.

## 4. Model data

Semua tabel di `packages/db/src/schema/billing.ts`. Tabel dibuat pada phase yang pertama kali memakainya (kolom "Phase"). Setelah `pnpm db:generate`, baca SQL migrasi yang dihasilkan sebelum di-commit. **Jangan mengganti nama folder migrasi** setelah dibuat: server dev (`tsx watch`) bisa langsung menerapkannya ke DB lokal, dan Drizzle mencatatnya per nama folder, sehingga nama baru dianggap migrasi baru dan gagal "relation already exists". Migrasi Phase 01: `migrations/20261102033349_thin_wilson_fisk`.

### 4.1 `billing_account` (Phase 01)

Satu baris per pengguna yang pernah menyentuh billing. Fungsinya terutama sebagai **kunci serialisasi**.

| Kolom                      | Tipe          | Catatan                                                                |
| -------------------------- | ------------- | ---------------------------------------------------------------------- |
| `user_id`                  | text PK       | FK `user.id` `ON DELETE CASCADE`                                       |
| `trial_granted_at`         | timestamptz ∅ | Kapan kredit coba diberikan; menjamin hanya sekali per akun (Phase 04) |
| `created_at`, `updated_at` | timestamptz   |                                                                        |

Helper wajib: `lockBillingAccount(tx, userId)` = `INSERT … ON CONFLICT DO NOTHING` lalu `SELECT … FOR UPDATE`. Semua operasi yang mengubah masa aktif, kredit, pembayaran, atau mengecek batas dokumen memanggil helper ini dulu, di transaksi yang sama.

### 4.2 `membership_period` (Phase 01)

Satu baris = satu potong waktu akses berbayar. Potongan tidak boleh tumpang tindih untuk satu pengguna (dijaga oleh algoritme di 6.6, diuji).

| Kolom                         | Tipe                  | Catatan                                                                   |
| ----------------------------- | --------------------- | ------------------------------------------------------------------------- |
| `id`                          | text PK               | `generateId()`                                                            |
| `user_id`                     | text                  | FK `user.id` `ON DELETE CASCADE`; index `(user_id, ends_at)`              |
| `plan_id`                     | text                  | `plus` atau `pro-ai`                                                      |
| `starts_at`, `ends_at`        | timestamptz           | `CHECK (ends_at > starts_at)`                                             |
| `source`                      | text                  | `payment`, `admin`, `promo`                                               |
| `payment_id`                  | text ∅                | FK `billing_payment.id` `ON DELETE SET NULL` (kolom ditambah di Phase 06) |
| `granted_by`                  | text ∅                | id admin bila `source = admin`; FK `user.id` `ON DELETE SET NULL`         |
| `revoked_at`, `revoke_reason` | timestamptz ∅, text ∅ | Dicabut karena refund atau koreksi admin                                  |
| `created_at`                  | timestamptz           | Waktu beli; mengurutkan potongan berperingkat sama                        |

- "Jadwal" = baris dengan `revoked_at IS NULL` dan `ends_at > now`. Invariant tanpa tumpang tindih berlaku untuk baris yang tidak dicabut.
- Saat paket lebih tinggi menggeser potongan yang sedang berjalan, sisa potongan menjadi baris baru yang **menyalin `source`, `granted_by`, dan `created_at`** dari baris asal (Phase 06: juga `payment_id`), supaya urutan beli dan asal-usulnya tetap.

### 4.3 `billing_payment` (Phase 06)

Satu baris = satu percobaan bayar = satu `order_id` di Midtrans. Coba bayar ulang setelah kedaluwarsa/gagal membuat baris baru.

| Kolom                               | Tipe               | Catatan                                                                                                          |
| ----------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `id`                                | text PK            | `generateId()`                                                                                                   |
| `user_id`                           | text ∅             | FK `user.id` **`ON DELETE SET NULL`** — catatan keuangan tetap ada setelah akun dihapus                          |
| `provider`                          | text               | `midtrans`                                                                                                       |
| `provider_order_id`                 | text unique        | Dikirim sebagai `transaction_details.order_id`. Format `RZ-<id>`; cek batas panjang/karakter di dokumen Midtrans |
| `plan_id`, `catalog_version`        | text, int          | Salinan saat checkout                                                                                            |
| `amount`                            | integer            | Rupiah bulat, sama dengan `gross_amount` yang dikirim                                                            |
| `duration_days`, `credits`          | int, int           | Salinan saat checkout                                                                                            |
| `currency`                          | text               | `IDR`                                                                                                            |
| `status`                            | text               | Lihat 5.1                                                                                                        |
| `channel`                           | text               | `web` (satu-satunya kanal saat peluncuran; nanti `app_store`/`google_play` bila backlog L1 dijalankan)           |
| `snap_token`, `redirect_url`        | text ∅             | Untuk melanjutkan pembayaran setelah refresh                                                                     |
| `expires_at`                        | timestamptz ∅      | Batas lokal; disetel dari parameter expiry yang dikirim                                                          |
| `payment_type`, `transaction_id`    | text ∅             | Dari Midtrans                                                                                                    |
| `provider_status`, `fraud_status`   | text ∅             | `transaction_status` dan `fraud_status` terakhir yang terverifikasi                                              |
| `paid_at`, `fulfilled_at`           | timestamptz ∅      | `fulfilled_at` terisi saat masa aktif + kredit sudah diberikan (penjaga idempotensi)                             |
| `refunded_amount`                   | integer            | default 0                                                                                                        |
| `receipt_sent_at`                   | timestamptz ∅      | Penjaga agar email bukti bayar terkirim sekali                                                                   |
| `last_checked_at`, `check_attempts` | timestamptz ∅, int | Untuk backoff rekonsiliasi                                                                                       |
| `failure_reason`                    | text ∅             | Kode singkat aman, bukan payload mentah                                                                          |
| `created_at`, `updated_at`          | timestamptz        | index `(status, created_at)` dan `(user_id, created_at)`                                                         |

### 4.4 `billing_payment_event` (Phase 06)

Setiap notifikasi masuk dan setiap pengecekan status yang mengubah sesuatu. Jejak audit dan bahan investigasi.

| Kolom                                                               | Tipe        | Catatan                                                                                            |
| ------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------- |
| `id`                                                                | text PK     |                                                                                                    |
| `payment_id`                                                        | text ∅      | FK `ON DELETE SET NULL`; kosong bila `order_id` tidak dikenal                                      |
| `provider_order_id`                                                 | text        | index `(provider_order_id, received_at)`                                                           |
| `source`                                                            | text        | `notification`, `status_check`, `admin`                                                            |
| `transaction_status`, `status_code`, `fraud_status`, `gross_amount` | text ∅      | Nilai mentah dari Midtrans (string apa adanya)                                                     |
| `signature_valid`                                                   | boolean ∅   | Hanya untuk `notification`                                                                         |
| `outcome`                                                           | text        | `applied`, `duplicate`, `stale`, `rejected_signature`, `unknown_order`, `amount_mismatch`, `error` |
| `payload`                                                           | jsonb       | **Allowlist** field aman saja (lihat 9.2)                                                          |
| `received_at`                                                       | timestamptz |                                                                                                    |

### 4.5 `ai_credit_grant` dan `ai_credit_usage` (Phase 04)

`ai_credit_grant` — kredit yang masuk:

| Kolom                 | Tipe                  | Catatan                                               |
| --------------------- | --------------------- | ----------------------------------------------------- |
| `id`                  | text PK               |                                                       |
| `user_id`             | text                  | FK `ON DELETE CASCADE`; index `(user_id, expires_at)` |
| `source`              | text                  | `trial`, `plan`, `admin`                              |
| `payment_id`          | text ∅                | FK `billing_payment.id` `ON DELETE SET NULL`          |
| `amount`, `remaining` | integer               | `CHECK (remaining >= 0 AND remaining <= amount)`      |
| `expires_at`          | timestamptz           |                                                       |
| `revoked_at`, `note`  | timestamptz ∅, text ∅ |                                                       |
| `created_at`          | timestamptz           |                                                       |

`ai_credit_usage` — kredit yang dipesan/dipakai:

| Kolom                           | Tipe        | Catatan                                                         |
| ------------------------------- | ----------- | --------------------------------------------------------------- |
| `id`                            | text PK     |                                                                 |
| `user_id`                       | text        | FK `ON DELETE CASCADE`                                          |
| `operation_key`                 | text unique | Kunci idempotensi: `<userId>:<actionKey>:<idempotencyKey>`      |
| `action`                        | text        | `actionKey` dari `CREDIT_COSTS`                                 |
| `credits`                       | integer     |                                                                 |
| `status`                        | text        | `reserved`, `committed`, `released`                             |
| `allocations`                   | jsonb       | `[{ grantId, credits }]` — dari grant mana kredit diambil       |
| `provider`, `model`             | text ∅      | Model managed yang dipakai                                      |
| `input_tokens`, `output_tokens` | integer ∅   | Termasuk reasoning bila provider melaporkannya                  |
| `cost_usd_micros`               | bigint ∅    | Biaya provider aktual (perkiraan dari tarif yang dikonfigurasi) |
| `error_code`                    | text ∅      |                                                                 |
| `created_at`, `settled_at`      | timestamptz | index `(status, created_at)` untuk melepas reservasi macet      |

### 4.6 `billing_audit_log` (Phase 01)

| Kolom            | Tipe        | Catatan                                                                                                                     |
| ---------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------- |
| `id`             | text PK     |                                                                                                                             |
| `actor_user_id`  | text ∅      | Admin pelaku; kosong = sistem. FK `ON DELETE SET NULL`                                                                      |
| `target_user_id` | text ∅      | FK `ON DELETE SET NULL`                                                                                                     |
| `action`         | text        | `period.granted`, `period.revoked`, `credits.adjusted`, `payment.fulfilled`, `payment.refund_recorded`, `payment.synced`, … |
| `reason`         | text ∅      | **Wajib** untuk tindakan admin                                                                                              |
| `details`        | jsonb       | Data ringkas, tanpa isi CV atau PII yang tidak perlu                                                                        |
| `created_at`     | timestamptz | index `(target_user_id, created_at)`                                                                                        |

### 4.7 Penghapusan akun dan retensi

- `membership_period`, `ai_credit_*`, `billing_account` ikut terhapus bersama akun (`CASCADE`).
- `billing_payment`, `billing_payment_event`, `billing_audit_log` **tetap ada** dengan `user_id` menjadi `NULL`. Data di dalamnya tidak mengandung isi CV, email, atau nomor telepon. Ini untuk pembukuan dan pajak; masa simpan dikonfirmasi pemilik dengan konsultan pajak (lihat `00-keputusan-produk.md`).
- Ekspor data akun (`api_auth_export_data` / fitur ekspor yang ada) menyertakan riwayat pembayaran dan kredit milik pengguna.

## 5. Status dan transisi

### 5.1 Status `billing_payment.status`

| Status lokal         | Arti                                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| `creating`           | Baris sudah di-commit, permintaan ke Snap sedang berjalan                                                |
| `pending`            | Token Snap ada; menunggu pengguna membayar                                                               |
| `paid`               | Pembayaran terverifikasi; masa aktif + kredit diberikan                                                  |
| `failed`             | Pembuatan transaksi gagal, atau Midtrans melaporkan `deny`/`failure`                                     |
| `expired`            | Midtrans melaporkan `expire`, atau batas waktu lokal lewat setelah dicek                                 |
| `cancelled`          | Midtrans melaporkan `cancel`                                                                             |
| `partially_refunded` | Sebagian dana dikembalikan                                                                               |
| `refunded`           | Seluruh dana dikembalikan                                                                                |
| `reversed`           | Dana yang sudah `settlement` dibalik oleh bank/penerbit (`deny` setelah `settlement`, atau `chargeback`) |

Pemetaan dari `transaction_status` Midtrans (daftar dari `D/transaction-status-cycle`, diperiksa 2026-11-02; verifikasi ulang saat implementasi):

| Midtrans                            | Lokal                                                                   |
| ----------------------------------- | ----------------------------------------------------------------------- |
| `pending`, `authorize`              | `pending`                                                               |
| `settlement`                        | `paid`                                                                  |
| `capture` + `fraud_status = accept` | `paid` (kartu; kartu tidak aktif di peluncuran)                         |
| `capture` + `fraud_status` lain     | `pending`                                                               |
| `deny`, `failure`                   | `failed` — **kecuali** pembayaran sudah `paid`: menjadi `reversed`      |
| `cancel`                            | `cancelled`                                                             |
| `expire`                            | `expired`                                                               |
| `refund`                            | `refunded`                                                              |
| `partial_refund`                    | `partially_refunded`                                                    |
| `chargeback`                        | `reversed`                                                              |
| `partial_chargeback`                | tidak diubah otomatis; event `error` + peringatan untuk ditinjau manual |
| status lain/tak dikenal             | jangan ubah status; catat event `error`                                 |

`status_code` adalah kode hasil API (`200`, `201`, `202`, `404`, …), bukan status pembayaran. Keputusan selalu berdasarkan `transaction_status` + `fraud_status`.

Aturan transisi:

1. **Status apa pun boleh menjadi `paid`** bila status terverifikasi menyatakan `settlement` (atau `capture` + `accept`) dan nominal cocok, kecuali dari `refunded`/`reversed`. Pelanggan yang benar-benar membayar tepat di batas waktu tetap mendapat aksesnya. Satu sesi Snap bisa berisi beberapa percobaan metode; `failed` bukan akhir.
2. **`paid` tidak pernah mundur** ke `pending`, `failed`, `expired`, atau `cancelled`. Notifikasi terlambat seperti itu dicatat sebagai event `stale`.
3. Dari `paid`/`partially_refunded` hanya boleh ke `partially_refunded`, `refunded`, atau `reversed`.
4. **Pembalikan:** dokumen Midtrans menyebut Permata VA, Mandiri Bill, dan Indomaret bisa berubah dari `settlement` ke `deny` dalam ±1–5 menit. `deny`/`chargeback` setelah `paid` → `reversed`, cabut masa aktif dan sisa kredit dari pembayaran itu (logika yang sama dengan refund penuh), lalu kirim peringatan ke pemilik.
5. Fulfillment terjadi tepat sekali: saat `fulfilled_at` masih kosong dan status berubah ke `paid`.

### 5.2 Status `ai_credit_usage.status`

`reserved` → `committed` (hasil berhasil disimpan/dikirim) atau `released` (gagal, dibatalkan sebelum ada hasil, atau macet > 15 menit). Tidak ada transisi lain.

## 6. Alur utama

### 6.1 Checkout (web)

1. Pengguna memilih paket → web memanggil `billing.checkout({ planId, idempotencyKey })`.
2. Server menolak bila: `BILLING_MODE` tidak mengizinkan pengguna ini; `BILLING_CHECKOUT_PAUSED`; akun tamu (`isAnonymous`); email belum terverifikasi; metode autentikasi bukan **sesi web (cookie)** — app mobile, API key, dan klien OAuth/MCP tidak bisa membeli (lihat 9.1); Midtrans belum dikonfigurasi.
3. Transaksi #1: `lockBillingAccount` → bila ada `billing_payment` milik pengguna untuk paket + nominal yang sama, berstatus `pending`, `redirect_url` ada, dan belum mendekati kedaluwarsa → kembalikan itu (tidak membuat dobel). Bila tidak ada → insert baris `creating` dengan salinan harga katalog. **Commit sebelum memanggil Midtrans.**
4. Panggil Snap `POST /snap/v1/transactions` (Basic Auth server key, header JSON, timeout ±10 detik) dengan isi berikut (fakta dari `R/json-objects` dan `D/snap-advanced-feature`, diperiksa 2026-11-02; `R/` = `https://docs.midtrans.com/reference/`, `D/` = `https://docs.midtrans.com/docs/`). Contoh ini memperlihatkan `enabled_payments` saat semua metode inti sudah aktif; nilai sebenarnya selalu dari env:

   ```json
   {
     "transaction_details": { "order_id": "RZ-<payment id>", "gross_amount": 79000 },
     "item_details": [{ "id": "pro-ai", "name": "Rezumi Pro AI - akses 30 hari", "price": 79000, "quantity": 1 }],
     "customer_details": { "first_name": "<nama akun>", "email": "<email akun>" },
     "enabled_payments": ["other_qris", "gopay", "shopeepay", "bni_va", "bri_va", "echannel", "permata_va"],
     "expiry": { "start_time": "2026-11-02 14:00:00 +0700", "unit": "hour", "duration": 24 },
     "callbacks": { "finish": "https://rezumi.app/dashboard/settings/billing/return/<payment id>/" },
     "gopay": {
       "enable_callback": true,
       "callback_url": "https://rezumi.app/dashboard/settings/billing/return/<payment id>/"
     },
     "shopeepay": { "callback_url": "https://rezumi.app/dashboard/settings/billing/return/<payment id>/" },
     "custom_field1": "pro-ai"
   }
   ```

   - `order_id` maks. 50 karakter, hanya alfanumerik dan `- _ ~ .`; `RZ-` + UUIDv7 = 39 karakter. Setelah pelanggan memilih metode, `order_id` itu tidak bisa dipakai lagi.
   - `gross_amount` dan `price` bilangan bulat; jumlah `price × quantity` harus sama dengan `gross_amount`; `item_details.name` maks. 50 karakter.
   - **`enabled_payments` wajib dikirim di mode redirect** (pengaturan kanal di dashboard hanya berlaku untuk mode popup). Nilainya dari `MIDTRANS_ENABLED_PAYMENTS` dan harus sama dengan metode yang aktif di akun produksi pemilik. Kode QRIS adalah `other_qris` (bukan `qris`).
   - `expiry` dengan `start_time` eksplisit (format `yyyy-MM-dd HH:mm:ss +0700`, dibuat saat request) membatasi halaman **dan** pembayaran 24 jam sejak dibuat; maksimum Midtrans 7 hari. Tanpa `start_time`, hitungan baru mulai saat metode dipilih, sehingga batas lokal tidak pasti. Simpan `expires_at = start_time + 24 jam`.
   - URL kembali: `callbacks.finish` untuk metode umum, `gopay.callback_url` untuk alur deeplink GoPay (Midtrans menambahkan `?order_id=&result=` dan menyarankan garis miring di akhir URL http), `shopeepay.callback_url` tanpa parameter tambahan. Id pembayaran diletakkan di **path**, bukan query, supaya query yang ditambahkan Midtrans (`order_id`, `status_code`, `transaction_status`, `result`) tidak merusak URL. Nilai query itu hanya untuk tampilan. Isi juga Finish/Unfinish/Error URL di dashboard (Snap Preference → System Settings) ke `https://rezumi.app/dashboard/settings/billing/return/` sebagai cadangan; halaman itu bisa menurunkan id pembayaran dari `order_id` (`RZ-<id>`).
   - Jangan kirim nomor telepon, alamat, atau data lain yang tidak perlu. Seluruh request maks. 16 KB.

5. Transaksi #2: simpan `snap_token`, `redirect_url` (perlakukan sebagai string buram; bentuk path-nya berbeda-beda), `expires_at`, status `pending`. Bila Snap gagal → `failed` + `failure_reason`; pengguna bisa mencoba lagi (baris baru).
6. Web mengarahkan browser ke `redirect_url` (mode redirect; tanpa Snap JS, tanpa perubahan CSP).
7. **Ganti metode:** setelah metode dipilih, `order_id` terkunci pada metode itu. Halaman Paket menawarkan "Lanjutkan pembayaran" (pakai `redirect_url` lama) dan "Ganti metode pembayaran": batalkan yang lama dengan `POST /v2/{order_id}/cancel` (best effort; abaikan "tidak ditemukan" bila metode belum dipilih), lalu buat pembayaran baru. Bila pembatalan gagal karena ternyata sudah dibayar, pembayaran lama diproses normal sebagai `paid`.

### 6.2 Halaman kembali

`callbacks.finish` menunjuk ke `${APP_URL}/dashboard/settings/billing/return/<id>/`. Halaman harus tampil benar dengan atau tanpa garis miring akhir dan dengan query tambahan dari Midtrans. Query `order_id`, `status_code`, `transaction_status`, `result` — **abaikan untuk keputusan**; halaman memanggil `billing.payment({ id })` setiap beberapa detik (maks. ±2 menit), lalu menampilkan: berhasil, masih menunggu (dengan tombol "Lanjutkan pembayaran" ke `redirect_url`), gagal/kedaluwarsa (dengan tombol coba lagi). Pastikan rute tidak memicu redirect server (rute `/dashboard/*` dilayani SPA oleh `handleWebApp`).

`billing.payment` memicu sinkronisasi status ke Midtrans bila pembayaran masih `creating`/`pending` dan `last_checked_at` lebih lama dari ±10 detik.

### 6.3 Notifikasi Midtrans

`POST /api/payments/midtrans/notification` (body limit kecil, mis. 64 KB):

1. Parse JSON. Ambil `order_id`, `status_code`, `gross_amount`, `signature_key` **sebagai string apa adanya**.
2. Verifikasi `signature_key == SHA512(order_id + status_code + gross_amount + serverKey)` (hex huruf kecil) dengan perbandingan timing-safe. Tidak valid → catat event `rejected_signature`, balas **403** tanpa mengubah data. (Midtrans mengulang respons 4xx selain 400/404 beberapa kali; bila penyebabnya server key yang salah setel lalu diperbaiki, ulangan berikutnya bisa lolos.)
3. Cari pembayaran berdasarkan `provider_order_id`. Tidak dikenal (misalnya tombol "test notification" di dashboard, atau transaksi lain di akun Midtrans yang sama) → catat event `unknown_order`, balas 200 agar tidak diulang. Payload boleh berisi field tambahan atau tanpa field yang bernilai null; parse dengan longgar.
4. **Konfirmasi ke Midtrans** dengan Get Status (`GET /v2/{order_id}/status` di host Core API). Status dari langkah ini yang dipakai, bukan isi notifikasi.
5. Cocokkan `gross_amount` (desimal string → Rupiah bulat) dengan `amount`. Beda → event `amount_mismatch`, jangan aktifkan, kirim peringatan ke pemilik (Phase 09).
6. Terapkan transisi (5.1) di transaksi dengan kunci `billing_account` + baris pembayaran. Bila menjadi `paid` dan `fulfilled_at` kosong → fulfillment (6.5). Panggilan HTTP ke Midtrans (langkah 4) terjadi **sebelum** transaksi dibuka, tidak pernah di dalamnya.
7. Balas 200 setelah perubahan ter-commit, idealnya dalam < 5 detik (Midtrans menunggu sekitar 15 detik). Kesalahan internal sementara (DB tidak tersedia, Get Status gagal) → balas **503**: menurut dokumen notifikasi Midtrans, 503 diulang beberapa kali sedangkan 500 hanya sekali (verifikasi ulang angka pastinya di dokumen saat implementasi). Signature salah → 4xx tanpa mengubah data. Rekonsiliasi cron (6.4) tetap menjadi jaring pengaman kedua bila semua ulangan gagal.

### 6.4 Rekonsiliasi terjadwal (`runBillingJobs`)

Setiap menit, terbatas jumlah dan waktunya:

- Ambil maks. ±20 pembayaran `creating`/`pending` yang umurnya > 2 menit dan sudah waktunya dicek (backoff: 2, 5, 15, 30, 60 menit, lalu tiap 6 jam sampai 3 hari), dengan `FOR UPDATE SKIP LOCKED`. Jalankan Get Status → terapkan transisi yang sama dengan 6.3.
- Get Status sebelum metode dipilih menjawab "Payment not found" (`status_code` `404` di body; kode HTTP-nya tidak didokumentasikan, jadi cek keduanya): itu berarti belum ada transaksi, bukan gagal. Setelah lewat `expires_at` + 30 menit dan status masih "tidak ditemukan" atau `pending` → panggil `POST /v2/{order_id}/expire` (best effort, abaikan error "tidak ditemukan"), cek status sekali lagi, lalu tandai `expired` bila memang tidak dibayar.
- Kirim ulang email bukti bayar yang `receipt_sent_at`-nya masih kosong (maks. beberapa kali, lalu peringatan).
- Lepaskan `ai_credit_usage` berstatus `reserved` yang lebih tua dari 15 menit.
- Job harus aman berjalan bersamaan atau terulang (Cron Trigger tidak menjamin tepat sekali).

`scheduled()` di Workers saat ini hanya memanggil `runCareerJobs`. Jalankan billing lebih dulu (pendek), lalu career, keduanya dengan error terisolasi, memakai pool yang sama (`max: 1`).

### 6.5 Fulfillment (atomik, satu transaksi)

1. Kunci `billing_account` pengguna dan baris pembayaran.
2. Bila `fulfilled_at` sudah terisi → selesai (idempoten).
3. Hitung jadwal masa aktif baru dengan fungsi murni `schedulePurchase` (6.6) → insert/update baris `membership_period`.
4. Bila `credits > 0` → insert `ai_credit_grant` (`source = plan`, `amount = remaining = credits`, `expires_at` = akhir potongan masa aktif yang baru dibeli).
5. Set `status = paid`, `paid_at`, `fulfilled_at`; tulis `billing_audit_log` (`payment.fulfilled`, aktor sistem).
6. Setelah commit: kirim email bukti bayar bila `receipt_sent_at` kosong (gagal kirim tidak membatalkan apa pun; dicoba lagi oleh job).

### 6.6 Algoritme jadwal masa aktif (`schedulePurchase`)

Fungsi murni di `packages/api/src/features/billing/timeline.ts`, diuji dengan tabel kasus. Aturan bisnis: **tidak ada hari berbayar yang hangus, dan paket berperingkat lebih tinggi dipakai lebih dulu.**

Masukan: potongan milik pengguna yang belum dicabut dan `ends_at > now`, pembelian baru `{ planId, durationMs }`, dan `now`.

1. Ubah setiap potongan menjadi "sisa waktu": `remaining = ends_at − max(starts_at, now)`, beserta `planId`, `rank`, dan urutan beli (`created_at`).
2. Tambahkan pembelian baru sebagai sisa waktu `durationMs`.
3. Urutkan: `rank` menurun, lalu urutan beli naik.
4. Susun berurutan mulai `now` tanpa celah.
5. Hasilkan perubahan minimal: potongan yang sedang berjalan dan tetap di depan tidak diubah; potongan yang sedang berjalan tetapi tergeser dipotong `ends_at = now` (bagian yang sudah terpakai tetap sebagai riwayat) dan sisanya menjadi baris baru di posisi barunya; potongan masa depan digeser.

Contoh wajib di tes (30 hari = D):

| Keadaan                                       | Pembelian | Hasil                                                                   |
| --------------------------------------------- | --------- | ----------------------------------------------------------------------- |
| Tidak ada paket                               | Plus      | Plus `now → now+D`                                                      |
| Plus aktif, sisa 20 hari                      | Plus      | Plus berjalan sampai akhir, lalu Plus baru 30 hari (total 50 hari)      |
| Plus aktif, sisa 20 hari                      | Pro AI    | Plus berhenti `now`; Pro AI `now → now+D`; Plus sisa 20 hari setelahnya |
| Pro AI aktif, sisa 10 hari                    | Plus      | Pro AI tetap; Plus 30 hari setelah Pro AI selesai                       |
| Pro AI aktif sisa 10 hari, Plus antre 20 hari | Pro AI    | Pro AI 10 + Pro AI 30, lalu Plus 20                                     |

Pencabutan (refund/koreksi admin) memakai aturan yang sama: potongan berjalan dipotong `ends_at = now` dan diberi `revoked_at`; potongan masa depan dikeluarkan dari jadwal dengan mengisi `revoked_at` (barisnya **tidak dihapus** dan waktunya tidak diubah, sebagai catatan); lalu sisa potongan lain disusun ulang mulai `now`. Potongan yang sudah berakhir atau sudah dicabut tidak bisa dicabut lagi (`BAD_REQUEST`).

Detail implementasi: potongan dianggap "berjalan" bila `starts_at < now`. Potongan yang mulai tepat `now` diperlakukan sebagai potongan masa depan (digeser, bukan dipotong), sehingga `CHECK (ends_at > starts_at)` tidak pernah dilanggar. Urutan: `rank` menurun, lalu `created_at` naik, lalu `id`; pembelian baru selalu terakhir di peringkatnya.

### 6.7 Hak akses (`getEntitlements`)

`getEntitlements(userId, now = new Date(), database = db)` → `{ enabled, planId, features, limits, currentPeriodEndsAt, upcoming: [{ planId, startsAt, endsAt }] }`. Di dalam transaksi, kirim `tx` sebagai `database`.

- `BILLING_MODE = off`, atau `admins` untuk bukan admin: kembalikan **mode tanpa batas** (perilaku hari ini: semua fitur terbuka, tanpa batas): `enabled: false`, `limits` bernilai `null`, `planId: "free"` yang tidak bermakna. Mode `off` **tidak menyentuh database sama sekali** (dibuktikan tes). Mode `admins` membaca `user.role` dari database (bukan dari objek sesi), lalu memakai `isBillingActiveFor`.
- Selain itu (`resolveEntitlements`, fungsi murni): cari potongan yang belum dicabut dan memuat `now`. Ada → paket itu. Tidak ada → `free`. Potongan berurutan dengan paket yang sama digabung: `currentPeriodEndsAt` adalah akhir akses paket sekarang (mis. Plus + Plus antre = satu tanggal), dan `upcoming` berisi paket berikutnya yang sudah digabung.
- Baca dari database setiap request yang menegakkan aturan; jangan cache di sesi Better Auth atau di klien sebagai sumber kebenaran. Klien boleh cache untuk tampilan saja.

### 6.8 Batas dokumen dan fitur (Phase 03)

Helper `assertDocumentCapacity(tx, userId, { resumes, coverLetters })` (`packages/api/src/features/billing/limits.ts`) dipanggil **di dalam transaksi yang sama dengan insert/restore**, sebelum menulis:

- Baca hak akses dulu (`getEntitlements(userId, now, tx)`). Bila billing tidak berlaku untuk akun itu (mode `off`, atau `admins` untuk bukan admin) fungsi selesai tanpa mengunci atau membuat baris `billing_account`; mode `off` tidak menyentuh database sama sekali.
- Bila berlaku: `lockBillingAccount` → hitung dokumen aktif (tidak di Trash) → tambah jumlah yang akan dibuat → bandingkan dengan `limits`. Kunci membuat permintaan paralel menghitung bergiliran (tes: 5 create paralel dengan sisa 1 slot → tepat 1 berhasil; tanpa kunci tes ini gagal).
- Lewat batas → `ORPCError` `PLAN_LIMIT_REACHED` (lihat 11), `data.requested` berisi `{ resumes, coverLetters }` permintaan itu.
- Urutan kunci bila keduanya dipakai: `lockUser` (baris `user`) lalu `lockBillingAccount`.
- `precheckDocumentCapacity(userId, request)` menjalankan cek yang sama di transaksi pendek sebelum pekerjaan lambat (panggilan AI); cek sebenarnya tetap terjadi saat dokumen disimpan.

Titik masuk final (diperiksa dengan graph `trace_path` + grep pada `insert(schema.resume|coverLetter)` dan `trashedAt: null`):

| Titik masuk                                          | Pemanggil (semua jalur web/mobile/REST/MCP lewat router yang sama)                                                                                                                                       | Cek                                                                                         |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `resumeService.create` (`resume/service.ts`)         | `resume.create`, `resume.import`, `resume.duplicate`, `resumes/file-imports` (REST), `documents.copyForJob`, `applications.ai.tailorResume`, tool MCP `create_resume`/`import_resume`/`duplicate_resume` | `{ resumes: 1, coverLetters: <surat di file> }` sekaligus; impor di atas batas ditolak utuh |
| `adoptEmbeddedLetters` (`cover-letters/embedded.ts`) | `resumeService.create` (sudah dihitung, `capacityChecked`), `resumeService.update` (termasuk restore versi), `resumeService.patch`/`patchInTransaction`                                                  | `{ coverLetters: <surat baru setelah dedup> }`                                              |
| `insert` di `cover-letters/service.ts`               | `coverLetters.create`, `coverLetters.duplicate`, `coverLetters.import`, `applications.ai.draftMessage` (kind `cover-letter`)                                                                             | `{ coverLetters: 1 }` setelah `lockUser`                                                    |
| `documentsService.restore` (`documents/service.ts`)  | `documents.restore` (web, mobile, REST, MCP `api_documents_restore`)                                                                                                                                     | `{ resumes: 1 }` atau `{ coverLetters: 1 }` hanya bila dokumen memang di Trash              |
| Pre-check sebelum AI                                 | `applications.ai.tailorResume`, `applications.ai.draftMessage`                                                                                                                                           | `precheckDocumentCapacity`                                                                  |

Tidak dibatasi: pemindahan dokumen tamu (`linkAnonymousAccount` di `packages/auth/src/config.ts`), restore versi isi dokumen, dan semua edit dokumen lama. Dokumen lama tidak pernah dikunci atau dihapus karena paket habis.

**Template dan Custom Styles** (`assertDesignChange`, `designFeaturesNeeded`):

- Butuh `premiumTemplates` hanya bila template berubah **ke** template di luar `FREE_TEMPLATES`; butuh `customStyles` hanya bila teks stylesheet (`metadata.stylesheet.source.text`, di-trim) berubah dan tidak kosong. Mempertahankan template premium/CSS lama, menghapus CSS, dan pindah ke template gratis selalu boleh.
- Dicek di `resumeService.update` (data penuh) dan `applyResumePatchTx` (JSON Patch, termasuk tool Assistant/MCP), di `coverLetterService.create` bila `template` dikirim dan `coverLetterService.update` saat `template` berubah.
- Salinan (duplicate, copy for job, tailoring, surat yang mengikuti desain CV) dan **restore versi** (`restoringVersion`) memakai desain dokumen itu sendiri, tidak dicek.
- Impor (`resumeService.create` dengan `origin: "import"` dan `coverLetterService.import`) memakai `fitImportedDesign`: template premium diganti `FREE_TEMPLATES[0]` dan stylesheet dilepas bila paket tidak memuat fiturnya. Endpoint tidak berubah; web/mobile memberi tahu pengguna dengan membandingkan desain file dengan `billing.summary` (`describeImportedDesign`).

**Ekspor Word/ODT**: `documents/exports.ts` memanggil `assertFeature(userId, "wordOdtExport")` untuk format `docx`/`odt` sebelum memuat dokumen (REST/MCP dan app mobile, yang mengunduh non-PDF lewat REST). Web membuat file di browser, jadi web hanya bisa mengunci di klien.

**Font sendiri**: belum ada fitur unggah font di kode (Phase 03 memeriksa `features/storage` dan editor). `customFonts` sudah ada di katalog dan dialog, belum punya titik penegakan; tambahkan `assertFeature(userId, "customFonts")` saat fitur unggah font dibuat.

### 6.9 Kredit Rezumi AI

- `reserveCredits({ userId, actionKey, idempotencyKey })` di transaksi dengan `lockBillingAccount`: bila `operation_key` sudah ada → kembalikan baris itu. Bila belum: hitung biaya dari `CREDIT_COSTS`, ambil grant yang aktif (belum kedaluwarsa/dicabut, `remaining > 0`) urut `expires_at` paling dekat dulu, kurangi `remaining`, insert usage `reserved`. Saldo kurang → `INSUFFICIENT_CREDITS`.
- `commitCredits(usageId, usage)` → `committed` + token/biaya. `releaseCredits(usageId, reason)` → `released` + kembalikan `remaining` ke grant asal.
- Kredit coba: diberikan **saat pertama kali** pengguna terverifikasi (bukan tamu) memakai Rezumi AI dan `trial_granted_at` masih kosong; berlaku 14 hari sejak diberikan.
- Saldo = jumlah `remaining` grant aktif. Tampilkan juga tanggal kedaluwarsa terdekat.
- BYOK (koneksi AI milik pengguna) tidak menyentuh kredit sama sekali. Tidak boleh ada perpindahan diam-diam dari BYOK ke Rezumi AI atau sebaliknya.

## 7. Invariant dan tes wajib

Setiap invariant di bawah harus punya tes otomatis sebelum go-live:

1. Satu pembayaran hanya mengaktifkan masa aktif dan kredit **sekali**, walau notifikasi dan rekonsiliasi datang bersamaan atau berulang.
2. Pembayaran gagal/kedaluwarsa/dibatalkan tidak pernah memberi akses.
3. Notifikasi dengan signature salah tidak mengubah apa pun.
4. Nominal yang tidak cocok tidak mengaktifkan apa pun.
5. Notifikasi `pending`/`expire` yang terlambat tidak menurunkan pembayaran `paid`.
6. Dua permintaan paralel (dua perangkat) tidak bisa memakai kredit yang sama dua kali.
7. Permintaan AI yang gagal tanpa hasil mengembalikan kredit.
8. Batas dokumen berlaku lewat web, mobile, REST/OpenAPI, dan MCP; pembuatan paralel tidak bisa melewati batas.
9. Masa aktif tidak tumpang tindih; total hari yang diterima = total hari yang dibayar.
10. Paket habis tidak menghapus atau mengunci dokumen yang sudah ada.
11. `BILLING_MODE=off` membuat perilaku produk identik dengan sebelum fitur ini.
12. Log dan event tidak memuat server key, signature, token Snap, email, atau nomor telepon.

## 8. Konfigurasi

| Nama                        | Jenis      | Isi                                                                                                                                                                                                                                                                                | Phase |
| --------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `BILLING_MODE`              | var        | `off` (default), `admins` (hanya akun `role = admin`), `on`                                                                                                                                                                                                                        | 01    |
| `MIDTRANS_ENVIRONMENT`      | var        | `sandbox` atau `production`; harus cocok dengan jenis server key (validasi saat start)                                                                                                                                                                                             | 06    |
| `MIDTRANS_SERVER_KEY`       | secret     | Server key dari dashboard Midtrans (sandbox untuk lokal/staging)                                                                                                                                                                                                                   | 06    |
| `MIDTRANS_ENABLED_PAYMENTS` | var        | Daftar kode metode dipisah koma, **wajib** untuk mode redirect. Default `other_qris` (satu-satunya metode yang diketahui aktif per 2026-11-02). Tambahkan `gopay`, `shopeepay`, `bni_va`, `bri_va`, `echannel`, `permata_va` hanya setelah aktif di akun (tabel Phase 00 bagian B) | 06    |
| `BILLING_CHECKOUT_PAUSED`   | var        | `true` = pembelian baru ditutup sementara; hak akses yang sudah dibeli tetap berlaku                                                                                                                                                                                               | 06    |
| `BILLING_ALERT_EMAIL`       | var, opsi  | Alamat pemilik untuk peringatan dan ringkasan harian                                                                                                                                                                                                                               | 09    |
| `MANAGED_AI_*`              | var/secret | Model dan tarif biaya Rezumi AI (rinci di Phase 05)                                                                                                                                                                                                                                | 05    |

Ikuti aturan `CLAUDE.md` → "New env var": `packages/env/src/server.ts`, `.env.example`, `turbo.json`, dan validasi silang. Secret produksi dipasang pemilik dengan `pnpm exec wrangler secret put <NAMA>` (atau dashboard Cloudflare), tidak pernah lewat chat atau commit.

Host Midtrans: Snap `app.sandbox.midtrans.com` / `app.midtrans.com`; Core API (status, cancel, refund) `api.sandbox.midtrans.com` / `api.midtrans.com`. Jangan tertukar; pilih berdasarkan `MIDTRANS_ENVIRONMENT`.

## 9. Keamanan, privasi, dan logging

### 9.1 Siapa boleh melakukan apa

- `billing.checkout` dan `billing.changePaymentMethod`: **hanya sesi web (cookie)**. Tolak OAuth bearer (termasuk app mobile resmi — pembelian di app dilarang oleh keputusan kanal), API key, dan klien MCP. Prosedur baca (`billing.summary`, `billing.payment`, `billing.payments`) boleh dipakai app resmi.
- Membedakan app resmi: app mobile mendaftar sebagai klien OAuth dinamis dengan `client_name` "Rezumi for iOS/Android" dan `redirect_uris` `https://<APP_URL host>/auth/native-callback` (`apps/mobile/src/auth/oauth.ts`). Phase 03 membuat helper `isFirstPartyClient(authentication)` berdasarkan redirect URI terdaftar klien token. Keterbatasan yang diterima: pengguna teknis bisa meniru klien ini untuk akunnya sendiri; dampaknya kecil karena tetap terkena rate limit.
- Implementasi Phase 03 (`billing/automation.ts`): app memakai `https://rezumi.app/auth/native-callback` untuk **semua** server (host tetap di `apps/mobile/src/auth/oauth.ts`), jadi daftar yang diterima = `https://rezumi.app/auth/native-callback`, `https://<host APP_URL>/auth/native-callback`, dan `app.rezumi:/auth/native-callback` (build dev). Klien dianggap resmi bila **semua** redirect URI-nya ada di daftar itu. `RequestAuthentication` membawa `clientId` (`azp` token). `protectedProcedure` memanggil `assertAutomationAccess` setelah cek izin: sesi web selalu lolos, bearer klien resmi lolos (satu query `oauth_client`), selain itu butuh `automationApi`. Endpoint MCP memanggilnya sekali per request dan menjawab 403 JSON-RPC dengan pesan paket. Mode `off` tidak membaca apa pun.
- Admin: `user.role === "admin"` (plugin admin Better Auth sudah aktif), sesi web saja, setiap tindakan wajib alasan dan tercatat di `billing_audit_log`. Phase 01: `assertBillingAdmin` menolak metode selain `session` dan membaca `role` dari database; `billing.admin.grantPeriod({ userId | email, planId, days 1–366, reason })` dan `billing.admin.revokePeriod({ periodId, reason })` (RPC saja, tag `Internal`). Belum ada UI; sebelum Phase 09 panggil lewat `/api/rpc/billing/admin/...` dari browser yang login sebagai admin.
- Flag publik `flags.get` → `billing: boolean` (`true` hanya bila `BILLING_MODE = on`); field opsional di tipe `FeatureFlags`, jadi klien lama tidak rusak.
- Rate limit: pakai `accountRateLimit` atau buat limit khusus checkout di `packages/api/src/middleware/rate-limit/index.ts`.

### 9.2 Data yang boleh disimpan dari Midtrans

Allowlist untuk `billing_payment_event.payload`: `order_id`, `transaction_id`, `transaction_status`, `status_code`, `status_message`, `fraud_status`, `payment_type`, `gross_amount`, `currency`, `transaction_time`, `settlement_time`, `expiry_time`, `issuer`, `acquirer`, `bank` / nama bank VA. **Jangan simpan**: `signature_key`, data kartu (masked card, approval code), data pelanggan, token apa pun.

Log (`console.*`) hanya berisi id pembayaran, `provider_order_id`, status, kode hasil, dan durasi. Jangan mencetak header `Authorization`, server key, signature, `snap_token`, `redirect_url`, email, atau isi CV.

### 9.3 Data yang dikirim ke Midtrans

`customer_details.first_name` (nama akun) dan `email` (agar Midtrans bisa mengirim instruksi VA/bukti), tanpa nomor telepon dan alamat. Kebijakan privasi (Phase 02) menyebut Midtrans sebagai pemroses pembayaran.

## 10. Cloudflare dan infrastruktur

- Endpoint notifikasi harus publik HTTPS, tanpa redirect, tanpa autentikasi, dapat diakses dari server Midtrans. Midtrans **tidak mengikuti** redirect 301/302/303, jadi URL yang didaftarkan harus persis `https://rezumi.app/api/payments/midtrans/notification` (bukan `http://`, tanpa garis miring tambahan yang memicu redirect).
- Pengaturan zona `rezumi.app` (diperiksa di Phase 11):
  - **Bot Fight Mode** (paket Free) dapat menantang trafik API dan **tidak bisa dikecualikan per path** lewat custom rule. Bila aktif, matikan, atau pakai paket zona Pro ke atas yang memakai Super Bot Fight Mode (bisa di-skip).
  - Buat custom rule **Skip** untuk `POST` ke path notifikasi: skip fase `http_ratelimit`, `http_request_sbfm`, `http_request_firewall_managed`, dan produk `bic` (Browser Integrity Check), `securityLevel`, `uaBlock`, `zoneLockdown`.
  - **Minimum TLS Version** tetap 1.2 (atau lebih rendah). Jangan setel 1.3; menurut dokumentasi Midtrans dan riset skill, pengiriman notifikasi bisa gagal.
- Hyperdrive: caching query bawaan aktif untuk query baca (±60 detik) dan tulis tidak membatalkan cache. Konfigurasi produksi `vitaekit` **sudah `caching.disabled = true`** (diperiksa 2026-11-02). Setiap Hyperdrive baru (staging) wajib dibuat dengan `--caching-disabled`.
- Hyperdrive memakai pooling mode transaksi: `BEGIN … COMMIT` dan `SELECT … FOR UPDATE` dipakai seperti biasa, tetapi **advisory lock, `LISTEN/NOTIFY`, dan state sesi tidak didukung**. Karena itu kunci serialisasi memakai baris `billing_account`, bukan `pg_advisory_lock`.
- Workers membuat pool `max: 1` per invocation (`apps/server/src/cloudflare/index.ts`). **Di dalam `db.transaction(async (tx) => …)` semua query wajib lewat `tx`.** Memanggil fungsi yang memakai `db` global di dalam transaksi akan menunggu koneksi yang sedang dipegang transaksi itu sampai timeout 10 detik. Helper billing menerima `DbOrTx` (`packages/db/src/client.ts`) supaya pemanggil yang memilih transaksi.
- Panggilan HTTP keluar (Snap, Get Status, email) selalu di luar transaksi; transaksi dibuat sesingkat mungkin.
- Cron Trigger tidak menjamin tepat sekali dan bisa tumpang tindih: setiap job idempoten dan mengklaim baris dengan `FOR UPDATE SKIP LOCKED` atau lease di database. Batas CPU handler terjadwal dengan interval < 1 jam: 30 detik. Uji lokal: `curl "http://localhost:8787/cdn-cgi/local/scheduled?cron=*+*+*+*+*"` saat `wrangler dev`, atau panggil `runBillingJobs()` langsung di tes.
- Log Workers disampel per request (`head_sampling_rate: 0.1` → ±90% invocation tanpa log) dan disimpan 7 hari. Jangan bergantung pada log untuk investigasi pembayaran; tabel event adalah catatan resmi.
- Fetch keluar ke Midtrans memakai `AbortSignal.timeout(...)`; flag `global_fetch_strictly_public` aman karena host Midtrans publik.
- **Jangan memakai library `midtrans-client`.** Versi terakhir 1.4.3 (Juni 2025) bergantung pada `axios` dan `lodash`, memuat modul SnapBi yang memerlukan `https`/`crypto` Node, belum pernah diuji di Workers, dan tidak memverifikasi signature notifikasi. API Midtrans cukup HTTPS + Basic Auth, jadi buat modul kecil `midtrans/client.ts` berbasis `fetch` (Basic Auth `base64(serverKey + ":")`, JSON, `AbortSignal.timeout`, `User-Agent` yang jelas, pemetaan error, tanpa logging rahasia).
- API Midtrans berada di belakang Cloudflare dan dokumentasinya menyebut request lewat proxy bisa mendapat 403. Uji panggilan keluar **dari Worker yang sudah ter-deploy** (staging) sedini mungkin, bukan hanya dari laptop.
- Uji lokal dengan notifikasi sandbox membutuhkan URL publik: tunnel sementara (mis. `cloudflared tunnel --url http://localhost:3000`) atau lingkungan staging (Phase 11). Replay fixture lokal tetap wajib karena deterministik.

## 11. Kontrak error dan app versi lama

| Kode `ORPCError`        | Kapan                                              | `data` yang disertakan                                                  |
| ----------------------- | -------------------------------------------------- | ----------------------------------------------------------------------- |
| `PLAN_LIMIT_REACHED`    | Membuat/memulihkan dokumen melewati batas          | `{ limit: "activeResumes" \| "activeCoverLetters", max, used, planId }` |
| `PLAN_FEATURE_REQUIRED` | Memakai fitur yang tidak ada di paket              | `{ feature: keyof PlanFeatures, planId }`                               |
| `INSUFFICIENT_CREDITS`  | Kredit Rezumi AI kurang                            | `{ required, balance }`                                                 |
| `BILLING_UNAVAILABLE`   | Pembelian belum dibuka / Midtrans belum diset      | —                                                                       |
| `EMAIL_NOT_VERIFIED`    | Checkout atau kredit coba sebelum verifikasi email | —                                                                       |

- Pesan error harus kalimat yang bisa dipahami pengguna, karena app mobile versi lama belum mengenal kode baru dan hanya menampilkan pesan. Ikuti pola pesan dan lokalisasi yang sudah ada di server (`apps/server/src/rpc/locale.ts` dan pesan `ORPCError` di router lain).
- Pesan error **netral**: tanpa harga, tanpa ajakan membeli, tanpa URL pembayaran, karena tampil juga di app iOS/Android (aturan toko). Web menambahkan tombol upgrade berdasarkan `code`. Pengecualian: pesan untuk klien API/MCP pihak ketiga boleh menyebut halaman Paket di web.
- Gunakan status HTTP 403 untuk tiga kode pertama, kecuali pola repo menunjukkan pilihan lain; konsisten di semua phase.
- Phase 03: pesan server berbahasa Inggris seperti pesan server lain di repo; web dan mobile menampilkan teks Lingui berdasarkan `code` dan `data` (`apps/web/src/features/billing/plan.ts`, `apps/mobile/src/features/billing/plan-alert.ts`). `PLAN_LIMIT_REACHED.data` juga memuat `requested: { resumes, coverLetters }`.
- Endpoint lama tidak boleh mendapat field wajib baru. Endpoint baru bersifat tambahan.
- App lama tidak boleh menjalankan Rezumi AI berbayar tanpa sadar: jalur AI lama yang tidak mengirim pilihan sumber AI diperlakukan sebagai BYOK/default lama, bukan otomatis memotong kredit (rinci di Phase 05).

## 12. Strategi tes

| Jenis               | Isi                                                                                                   | Lokasi/perintah                                                                                                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit (fungsi murni) | `schedulePurchase`, pemetaan status, signature, pembentuk payload Snap, alokasi kredit                | `packages/api/src/features/billing/*.test.ts`; `pnpm --filter @rezumi/api test <path>`                                                                                                 |
| Integrasi DB nyata  | Fulfillment paralel, kredit dua perangkat, batas dokumen paralel, rekonsiliasi                        | `*.integration.test.ts` dengan env `BILLING_TEST_DATABASE_URL`, pola `cover-letters/service.integration.test.ts`; tambahkan ke `.github/workflows/ci.yml` dan env task di `turbo.json` |
| Replay notifikasi   | Fixture JSON bertanda tangan kunci sandbox palsu → endpoint lokal                                     | Fixture di skill `.claude/skills/integrate-midtrans-payments/assets/fixtures/` dan script `scripts/replay_snap_webhook.sh`                                                             |
| Sandbox end-to-end  | Bayar sungguhan di sandbox per metode, notifikasi dari dashboard, refresh halaman, replay, cek status | Phase 06 (tunnel) dan Phase 11 (staging)                                                                                                                                               |
| Browser E2E         | Alur beli dengan stub Midtrans lokal (tanpa jaringan)                                                 | `tests/e2e/specs/billing.spec.ts` (Phase 07)                                                                                                                                           |

Tes yang `--passWithNoTests` dan lolos tanpa tes tidak membuktikan apa pun; laporkan jumlah tes yang benar-benar berjalan.
