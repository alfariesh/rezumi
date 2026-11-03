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

| Kebutuhan                                 | Lokasi                                                                                                                                                                                                                                | Catatan                                                                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Katalog paket, harga, kuota, bobot kredit | `packages/schema/src/billing/` diekspor sebagai `@rezumi/schema/billing` (tambah subpath eksplisit di `packages/schema/package.json`)                                                                                                 | Dipakai server, web (homepage + settings), dan mobile. Murni data + tipe, tanpa DB/HTTP.                                   |
| Tabel database                            | `packages/db/src/schema/billing.ts`, diekspor dari `packages/db/src/schema/index.ts`; migrasi via `pnpm db:generate`                                                                                                                  | Konvensi: id `text` dengan `generateId()` (UUIDv7), `timestamp(..., { withTimezone: true })`, nama kolom snake_case        |
| Logika bisnis + router oRPC               | `packages/api/src/features/billing/`, didaftarkan di `packages/api/src/routers/index.ts` sebagai `billing`                                                                                                                            | Pakai `protectedProcedure` dan pola router di `features/custom-domain/router.ts`                                           |
| Endpoint notifikasi Midtrans              | `apps/server/src/http/midtrans.ts`, dipasang di `apps/server/src/http/app.ts`                                                                                                                                                         | `/api/*` sudah masuk `run_worker_first` di `wrangler.jsonc`                                                                |
| Job terjadwal                             | `packages/api/src/features/billing/jobs.ts` (`runBillingJobs`), dipanggil dari `scheduled()` di `apps/server/src/cloudflare/index.ts` dan scheduler Node di `apps/server/src/startup/`                                                | Phase 04: `scheduled()` dan `startup/job-scheduler.ts` (dulu `career-scheduler.ts`) menjalankan billing lalu career        |
| Env                                       | `packages/env/src/server.ts`, `.env.example`, `turbo.json` (`globalPassThroughEnv` + env task tes), `wrangler.jsonc` (`vars`) / `wrangler secret put`                                                                                 | Aturan "New env var" di `CLAUDE.md`                                                                                        |
| UI web                                    | `apps/web/src/features/billing/`, rute `apps/web/src/routes/dashboard/settings/billing/` (`index.tsx` dengan `?plan=`, `return.{-$paymentId}.tsx`, `receipt.$paymentId.tsx`), entri menu di `apps/web/src/features/settings/root.tsx` | Homepage `apps/web/src/features/homepage/plans.ts` pindah membaca katalog bersama. Phase 07: lihat 6.1–6.2                 |
| UI mobile                                 | `apps/mobile/src/features/billing/` (termasuk helper visibilitas per platform), layar `apps/mobile/app/(tabs)/settings/membership.tsx`                                                                                                | Tanpa pembelian di app. Android: status paket/kredit; iOS: tanpa UI billing sampai IAP (`00-keputusan-produk.md` bagian 6) |
| Email bukti bayar / pengingat             | `packages/email/src/templates/`                                                                                                                                                                                                       | Pola template React Email yang sudah ada                                                                                   |
| Admin internal                            | `packages/api/src/features/billing/admin.ts` + rute web `apps/web/src/routes/dashboard/admin/` (Phase 09: `billing/index.tsx`, `billing/$userId.tsx`; UI di `apps/web/src/features/billing/admin/`)                                   | Hanya `user.role === "admin"`, hanya sesi web. Alat internal, bukan fitur pengguna, jadi tidak perlu versi mobile          |
| Runbook pemilik                           | `.agents/docs/plans/membership/runbook-pemilik.md` (dibuat Phase 09)                                                                                                                                                                  | Bahasa awam                                                                                                                |

Gunakan graph `codebase-memory-mcp` (`search_graph` → `trace_path`) untuk menemukan pemanggil sebelum mengubah fungsi bersama, lalu konfirmasi dengan membaca source.

Isi `packages/api/src/features/billing/` setelah Phase 06:

| Berkas             | Isi                                                                                                                                                                                                                                                                                                                                |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `account.ts`       | Tipe `Transaction` dan `lockBillingAccount(tx, userId)` (4.1)                                                                                                                                                                                                                                                                      |
| `timeline.ts`      | Fungsi murni `schedulePurchase`, `previewPurchase` (Phase 07: jadwal hasil pembelian bila dibayar sekarang, untuk dialog konfirmasi), `revokePeriod`, konstanta `DAY_MS` (6.6)                                                                                                                                                     |
| `periods.ts`       | `grantMembershipPeriod(tx, …)` dan `revokeMembershipPeriod(tx, …)`: kunci akun → baca jadwal → terapkan hasil `timeline`                                                                                                                                                                                                           |
| `entitlements.ts`  | `getBillingMode`, `isBillingActiveFor`, `isBillingAppliedTo` (baca `role` dari DB; mode `off` tanpa DB), `resolveEntitlements` (murni), `getEntitlements` (6.7)                                                                                                                                                                    |
| `limits.ts`        | `countActiveDocuments`, `assertDocumentCapacity`, `precheckDocumentCapacity`, `assertFeature`, `assertDesignChange`, `fitImportedDesign`, error `PLAN_LIMIT_REACHED`/`PLAN_FEATURE_REQUIRED` (Phase 03, 6.8)                                                                                                                       |
| `automation.ts`    | `isFirstPartyClient`, `firstPartyRedirectUris`, `assertAutomationAccess` (Phase 03, 9.1); diekspor `@rezumi/api/features/billing/automation`                                                                                                                                                                                       |
| `credits.ts`       | Ledger kredit (Phase 04, 6.9): `grantCredits`, `ensureTrialCredits`, `reserveCredits`, `commitCredits`, `releaseCredits`, `deductCredits`, `getCreditBalance`, `listCreditHistory`, `releaseStaleReservations`, `allocateCredits` (murni), error `INSUFFICIENT_CREDITS`                                                            |
| `ai-source.ts`     | `aiSourceInput` (field opsional `aiSource` + `idempotencyKey` untuk input prosedur AI, tanpa dependensi DB) dan tipe `AiSourceRequest`; diekspor `@rezumi/api/features/billing/ai-source` (dipakai MCP) (Phase 05)                                                                                                                 |
| `metered-ai.ts`    | Sumber AI + meteran (Phase 05, 6.10): `resolveAiSource`, `startAiRun`, `startResolvedAiRun`, `runWithAiSource`, `AI_WORK_LIMITS`, `costUsdMicros`, `promptSize`, error `AI_SOURCE_REQUIRED`/`REZUMI_AI_UNAVAILABLE`/`AI_INPUT_TOO_LARGE`                                                                                           |
| `jobs.ts`          | `runBillingJobs(now)` → `{ checkedPayments, sentReceipts, releasedReservations, sentNotifications }` (6.4; Phase 09 menambah sapuan masalah, ringkasan harian, pengingat, dan pengiriman notifikasi); diekspor `@rezumi/api/features/billing/jobs`                                                                                 |
| `midtrans/`        | Phase 06: `config.ts` (`getMidtransConfig`), `client.ts` (fetch + Basic Auth, `MidtransError`), `payload.ts` (payload Snap, order id, jendela 24 jam), `signature.ts`, `status.ts` (`mapProviderStatus`, `nextPaymentStatus`, `parseGrossAmount`, `safeProviderFields`)                                                            |
| `checkout.ts`      | Phase 06: `purchaseBlocker`, `checkout`, `changePaymentMethod`, `getPayment`, `listPayments`, `getPendingPayment`, `toPaymentView` (6.1). Phase 07: `previewPurchase` (harga katalog + jadwal), `getPayment` menambah `access` (awal potongan pertama–akhir potongan terakhir milik pembayaran itu, sama dengan email bukti bayar) |
| `fulfillment.ts`   | Phase 06: `applyVerifiedStatus` (satu-satunya pintu perubahan status dari Midtrans) dan `revokePaymentBenefits` (6.5)                                                                                                                                                                                                              |
| `notification.ts`  | Phase 06: `handleMidtransNotification(request)`; diekspor `@rezumi/api/features/billing/notification`, dipasang di `apps/server/src/http/midtrans.ts` (6.3)                                                                                                                                                                        |
| `reconcile.ts`     | Phase 06: `syncPaymentStatus` (saat pembayaran dilihat, maks. tiap 10 detik) dan `reconcilePayments` (job, backoff, kedaluwarsa) (6.4)                                                                                                                                                                                             |
| `receipt.ts`       | Phase 06: `sendPaymentReceipt`, `sendPendingReceipts`, format WIB/Rupiah; template `@rezumi/email/billing` (6.5)                                                                                                                                                                                                                   |
| `admin.ts`         | `assertBillingAdmin` dan `billingAdmin.grantPeriod/revokePeriod/adjustCredits` (tulis `billing_audit_log` di transaksi yang sama). Phase 09: `search`, `customer` (paket dihitung dengan `resolveEntitlements` walau billing belum berlaku), `syncPayment`, `refund`, `recordManualRefund`, `resendReceipt`                        |
| `refunds.ts`       | Phase 09 (6.11): `refundModeOf` (`api`/`api_full`/`manual`), `requestRefund`, `recordManualRefund`, `syncPaymentWithMidtrans` (Get Status untuk status apa pun, sumber `admin`)                                                                                                                                                    |
| `alerts.ts`        | Phase 09 (6.11): `BILLING_ALERT_KINDS`, `raiseBillingAlert(tx, …)`/`raiseBillingAlertQuietly`, ambang per jenis, `detectBillingProblems` (sapuan), `queueDailySummary`, `listRecentAlerts`, helper WIB                                                                                                                             |
| `notifications.ts` | Phase 09: `queueExpiryReminders`, `sendBillingNotifications` (klaim + lease + maks. 5 percobaan), isi email peringatan/ringkasan/pengingat                                                                                                                                                                                         |
| `reports.ts`       | Phase 09: `billingMetrics({ from, to })`, `exportPaymentsCsv({ from, to })`, `formatWibTime`; rentang maks. 400 hari                                                                                                                                                                                                               |
| `export.ts`        | Phase 09: `exportBillingData(userId)` untuk ekspor data akun (`auth.exportData.billing`)                                                                                                                                                                                                                                           |
| `router.ts`        | `billing.summary` (dengan `credits`, `canPurchase`, `purchaseBlockedBy`, `pendingPayment`), `billing.creditHistory`, `billing.previewPurchase` (Phase 07), `billing.checkout`, `billing.changePaymentMethod`, `billing.payment` (dengan `access`), `billing.payments`, `billing.admin.*` (semua tag `Internal`)                    |
| `*.test.ts`        | Unit `timeline`, `entitlements`, `limits`, `credits`, `midtrans/*`; `*.integration.test.ts` (billing, limits, credits, metered-ai, payments) memakai `BILLING_TEST_DATABASE_URL`                                                                                                                                                   |

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
export const CREDIT_COSTS = { "short-text": 1, "draft-answer": 2, "cover-letter": 3, "interview-practice": 3,
  "coach-turn": 3, review: 4, "tailor-resume": 5, "import-document": 5 } as const; // Phase 04: satu kunci per jenis pekerjaan
export type CreditAction = keyof typeof CREDIT_COSTS; // + creditActionSchema, creditSourceSchema (trial | plan | admin)
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

Semua tabel di `packages/db/src/schema/billing.ts`. Tabel dibuat pada phase yang pertama kali memakainya (kolom "Phase"). Setelah `pnpm db:generate`, baca SQL migrasi yang dihasilkan sebelum di-commit. **Jangan mengganti nama folder migrasi** setelah dibuat: server dev (`tsx watch`) bisa langsung menerapkannya ke DB lokal, dan Drizzle mencatatnya per nama folder, sehingga nama baru dianggap migrasi baru dan gagal "relation already exists". Migrasi Phase 01: `migrations/20261102033349_thin_wilson_fisk`; Phase 04: `migrations/20261102055558_panoramic_shen`; Phase 06: `migrations/20261102090943_big_lake`; Phase 09: `migrations/20261103022740_bumpy_paladin` (`billing_refund`, `billing_notification`, `billing_account.locale`).

### 4.1 `billing_account` (Phase 01)

Satu baris per pengguna yang pernah menyentuh billing. Fungsinya terutama sebagai **kunci serialisasi**.

| Kolom                      | Tipe          | Catatan                                                                |
| -------------------------- | ------------- | ---------------------------------------------------------------------- |
| `user_id`                  | text PK       | FK `user.id` `ON DELETE CASCADE`                                       |
| `trial_granted_at`         | timestamptz ∅ | Kapan kredit coba diberikan; menjamin hanya sekali per akun (Phase 04) |
| `created_at`, `updated_at` | timestamptz   |                                                                        |

Phase 09: kolom `locale` (text ∅) = bahasa aplikasi saat checkout terakhir, untuk email pengingat.

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

| Kolom                                      | Tipe               | Catatan                                                                                                          |
| ------------------------------------------ | ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `id`                                       | text PK            | `generateId()`                                                                                                   |
| `user_id`                                  | text ∅             | FK `user.id` **`ON DELETE SET NULL`** — catatan keuangan tetap ada setelah akun dihapus                          |
| `provider`                                 | text               | `midtrans`                                                                                                       |
| `provider_order_id`                        | text unique        | Dikirim sebagai `transaction_details.order_id`. Format `RZ-<id>`; cek batas panjang/karakter di dokumen Midtrans |
| `idempotency_key`                          | text ∅             | Kunci klik checkout; unik per `(user_id, idempotency_key)`. Kunci yang sama mengembalikan pembayaran yang sama   |
| `plan_id`, `catalog_version`               | text, int          | Salinan saat checkout                                                                                            |
| `amount`                                   | integer            | Rupiah bulat, sama dengan `gross_amount` yang dikirim                                                            |
| `duration_days`, `credits`                 | int, int           | Salinan saat checkout                                                                                            |
| `currency`                                 | text               | `IDR`                                                                                                            |
| `status`                                   | text               | Lihat 5.1                                                                                                        |
| `channel`                                  | text               | `web` (satu-satunya kanal saat peluncuran; nanti `app_store`/`google_play` bila backlog L1 dijalankan)           |
| `snap_token`, `redirect_url`               | text ∅             | Untuk melanjutkan pembayaran setelah refresh                                                                     |
| `expires_at`                               | timestamptz ∅      | Batas lokal; disetel dari parameter expiry yang dikirim                                                          |
| `payment_type`, `transaction_id`           | text ∅             | Dari Midtrans                                                                                                    |
| `provider_status`, `fraud_status`          | text ∅             | `transaction_status` dan `fraud_status` terakhir yang terverifikasi                                              |
| `paid_at`, `fulfilled_at`                  | timestamptz ∅      | `fulfilled_at` terisi saat masa aktif + kredit sudah diberikan (penjaga idempotensi)                             |
| `refunded_amount`                          | integer            | default 0                                                                                                        |
| `receipt_sent_at`                          | timestamptz ∅      | Penjaga agar email bukti bayar terkirim sekali                                                                   |
| `receipt_attempts`, `receipt_attempted_at` | int, timestamptz ∅ | Phase 06: maks. 5 percobaan; pengirim lain tidak menyentuh bukti bayar selama 5 menit sejak percobaan terakhir   |
| `last_checked_at`, `check_attempts`        | timestamptz ∅, int | Untuk backoff rekonsiliasi                                                                                       |
| `failure_reason`                           | text ∅             | Kode singkat aman, bukan payload mentah                                                                          |
| `created_at`, `updated_at`                 | timestamptz        | index `(status, created_at)` dan `(user_id, created_at)`                                                         |

`CHECK` membatasi `status` ke daftar 5.1, `amount > 0`, dan `0 ≤ refunded_amount ≤ amount`. `membership_period.payment_id` dan `ai_credit_grant.payment_id` punya FK `ON DELETE SET NULL` dan index.

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

| Kolom                 | Tipe                  | Catatan                                                                                                                           |
| --------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `id`                  | text PK               |                                                                                                                                   |
| `user_id`             | text                  | FK `ON DELETE CASCADE`; index `(user_id, expires_at)`                                                                             |
| `source`              | text                  | `trial`, `plan`, `admin`                                                                                                          |
| `payment_id`          | text ∅                | FK `billing_payment.id` `ON DELETE SET NULL` — kolom dibuat Phase 04 **tanpa FK** karena tabelnya belum ada; Phase 06 menambah FK |
| `amount`, `remaining` | integer               | `CHECK (remaining >= 0 AND remaining <= amount)`, `CHECK (amount > 0)`; `source` juga di-`CHECK`                                  |
| `expires_at`          | timestamptz           |                                                                                                                                   |
| `revoked_at`, `note`  | timestamptz ∅, text ∅ |                                                                                                                                   |
| `created_at`          | timestamptz           |                                                                                                                                   |

`ai_credit_usage` — kredit yang dipesan/dipakai:

| Kolom                           | Tipe        | Catatan                                                                                                                                     |
| ------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                            | text PK     |                                                                                                                                             |
| `user_id`                       | text        | FK `ON DELETE CASCADE`                                                                                                                      |
| `operation_key`                 | text unique | Kunci idempotensi: `<userId>:<actionKey>:<idempotencyKey>`                                                                                  |
| `action`                        | text        | `actionKey` dari `CREDIT_COSTS`, atau `admin-adjustment` (koreksi admin negatif, langsung `committed`)                                      |
| `credits`                       | integer     |                                                                                                                                             |
| `status`                        | text        | `reserved`, `committed`, `released`                                                                                                         |
| `allocations`                   | jsonb       | `[{ grantId, credits }]` — dari grant mana kredit diambil                                                                                   |
| `provider`, `model`             | text ∅      | Model managed yang dipakai                                                                                                                  |
| `input_tokens`, `output_tokens` | integer ∅   | Termasuk reasoning bila provider melaporkannya                                                                                              |
| `cost_usd_micros`               | bigint ∅    | Biaya provider aktual (perkiraan dari tarif yang dikonfigurasi)                                                                             |
| `error_code`                    | text ∅      |                                                                                                                                             |
| `created_at`, `settled_at`      | timestamptz | index `(status, created_at)` untuk melepas reservasi macet, `(user_id, created_at)` untuk riwayat; `CHECK (credits > 0)` dan `CHECK` status |

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

### 4.7a `billing_refund` (Phase 09)

Satu baris = satu pengembalian dana untuk satu pembayaran. `refunded_amount` pembayaran = jumlah refund `succeeded` (atau total Midtrans bila lebih besar; `amount` bila Midtrans menyatakan `refund`).

| Kolom                          | Tipe                  | Catatan                                                                                                                                |
| ------------------------------ | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                           | text PK               |                                                                                                                                        |
| `payment_id`                   | text                  | FK `billing_payment.id` `ON DELETE CASCADE`; unik `(payment_id, sequence)`                                                             |
| `sequence`                     | int                   | Urutan refund pembayaran itu                                                                                                           |
| `refund_key`                   | text unique           | `RF-<payment id>-<sequence>` untuk refund Rezumi (dikirim ke Midtrans); refund dari dashboard Midtrans menyimpan kunci buatan Midtrans |
| `method`                       | text                  | `midtrans` atau `manual` (transfer sendiri, mis. VA)                                                                                   |
| `status`                       | text                  | `requesting` (disimpan sebelum request; tetap selama jawaban belum pasti), `succeeded`, `failed`                                       |
| `amount`, `reason`             | int, text             | `CHECK (amount > 0)`; alasan wajib                                                                                                     |
| `revoke_benefits`              | boolean               | Admin memilih mencabut paket/kredit pada refund sebagian                                                                               |
| `actor_user_id`                | text ∅                | Admin; kosong untuk refund yang ditemukan di Midtrans. FK `ON DELETE SET NULL`                                                         |
| `failure_reason`, `settled_at` | text ∅, timestamptz ∅ | Kode aman (`refund_http_412`), waktu dikonfirmasi                                                                                      |
| `created_at`, `updated_at`     | timestamptz           | index `(status, created_at)`                                                                                                           |

### 4.7b `billing_notification` (Phase 09)

Kotak keluar email yang harus terkirim sekali. `key` unik membuat job ganda menjadi no-op.

| Kolom                                 | Tipe                              | Catatan                                                                                           |
| ------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------- |
| `key`                                 | text unique                       | `alert:<jenis>:<jam UTC YYYY-MM-DDTHH>`, `summary:<tanggal WIB>`, `expiry:<user id>:<ends_at ms>` |
| `kind`                                | text                              | Jenis peringatan (`BILLING_ALERT_KINDS`), `daily_summary`, atau `expiry_reminder`                 |
| `user_id`                             | text ∅                            | Pelanggan (pengingat); kosong untuk email pemilik. FK `ON DELETE CASCADE`                         |
| `count`                               | int                               | Berapa kali terjadi dalam jam itu; peringatan dikirim saat mencapai ambang jenisnya               |
| `details`                             | jsonb                             | `paymentIds`, `day`, `endsAt`; tanpa email/token/payload                                          |
| `sent_at`, `attempts`, `attempted_at` | timestamptz ∅, int, timestamptz ∅ | Lease 5 menit, maks. 5 percobaan, hanya baris ≤ 2 hari                                            |
| `created_at`, `updated_at`            | timestamptz                       | index `(sent_at, created_at)`, `(kind, created_at)`                                               |

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
   - **`gopay` dan `shopeepay` hanya dikirim bila kodenya ada di `enabled_payments`.** Snap sandbox menolak dengan 400 ("Gopay callback url can't be used if gopay payment type is not enabled") bila callback e-wallet dikirim tanpa metodenya (diuji 2026-11-02). Snap membuat token untuk kode apa pun, termasuk yang belum aktif; halaman bayar menampilkan "No payment channels available" bila tidak satu pun aktif.
   - URL kembali: `callbacks.finish` untuk metode umum, `gopay.callback_url` untuk alur deeplink GoPay (Midtrans menambahkan `?order_id=&result=` dan menyarankan garis miring di akhir URL http), `shopeepay.callback_url` tanpa parameter tambahan. Id pembayaran diletakkan di **path**, bukan query, supaya query yang ditambahkan Midtrans (`order_id`, `status_code`, `transaction_status`, `result`) tidak merusak URL. Nilai query itu hanya untuk tampilan. Isi juga Finish/Unfinish/Error URL di dashboard (Snap Preference → System Settings) ke `https://rezumi.app/dashboard/settings/billing/return/` sebagai cadangan; halaman itu bisa menurunkan id pembayaran dari `order_id` (`RZ-<id>`).
   - Jangan kirim nomor telepon, alamat, atau data lain yang tidak perlu. Seluruh request maks. 16 KB.

5. Transaksi #2: simpan `snap_token`, `redirect_url` (perlakukan sebagai string buram; bentuk path-nya berbeda-beda), status `pending` (`expires_at` sudah diisi di langkah 3 dari `start_time` + 24 jam). Bila Snap gagal → `failed` + `failure_reason` (mis. `snap_create_http_400`; alasan Midtrans masuk log tanpa alamat email) dan error `BAD_GATEWAY`; pengguna bisa mencoba lagi dengan klik baru (baris baru).

   Implementasi Phase 06: pembayaran `pending` yang sama dipakai ulang bila sisa jendelanya ≥ 1 jam. Kunci klik yang sama mengembalikan pembayaran itu (`reused: true`); bila masih `creating` → `CONFLICT` ("still being prepared"), bila sudah gagal → `CONFLICT` (klik baru memakai kunci baru). `creating → pending` saat token tersimpan adalah siklus lokal checkout, bukan status dari Midtrans, jadi tidak lewat `applyVerifiedStatus`. Penolakan: mode/kunci tidak tersedia atau `BILLING_CHECKOUT_PAUSED` → `BILLING_UNAVAILABLE` (403); bukan sesi web → `FORBIDDEN`; tamu → `FORBIDDEN`; email belum terverifikasi → `EMAIL_NOT_VERIFIED` (403). Rate limit `checkout`: 10 per 10 menit per akun (produksi).

6. Web mengarahkan browser ke `redirect_url` (mode redirect; tanpa Snap JS, tanpa perubahan CSP).
7. **Ganti metode** (Phase 06: tutup halaman Snap lama dengan `POST /snap/v1/transactions/{token}/cancel` di host Snap, batalkan transaksi di Core API, lalu Get Status; tanpa transaksi → lokal `cancelled` alasan `method_changed`; ternyata dibayar → `paid` + `CONFLICT`, tidak membuka pembayaran baru; masih `pending` karena pembatalan gagal → `CONFLICT`. Diuji di sandbox 2026-11-02): setelah metode dipilih, `order_id` terkunci pada metode itu. Halaman Paket menawarkan "Lanjutkan pembayaran" (pakai `redirect_url` lama) dan "Ganti metode pembayaran": batalkan yang lama dengan `POST /v2/{order_id}/cancel` (best effort; abaikan "tidak ditemukan" bila metode belum dipilih), lalu buat pembayaran baru. Bila pembatalan gagal karena ternyata sudah dibayar, pembayaran lama diproses normal sebagai `paid`.

Implementasi web Phase 07 (`apps/web/src/features/billing/`): `buy-plans.tsx` (kartu Plus/Pro AI; tombol dari `getPurchaseKind`: Beli, Perpanjang 30 hari, Upgrade ke Pro AI, Beli Plus antre; hanya bila `canPurchase`; tamu/email belum terverifikasi/dijeda → langkah, bukan tombol; `unavailable`/`web_only` → bagian tidak tampil), `purchase-dialog.tsx` (Drawer: kanan di desktop, bawah di ponsel/tablet; harga final, "akses 30 hari, tidak diperpanjang otomatis", Timeline HeroUI Pro: Bayar (Midtrans) → paket mulai → paket berakhir → sisa paket yang digeser, dari `billing.previewPurchase` lewat `splitPurchase`, tanggal ringkas di kanan + zona sekali, kredit sebagai keterangan; ringkasan refund, tautan S&K dan Kebijakan Pengembalian Dana; satu `idempotencyKey` per percobaan, penjaga klik ganda sinkron dengan `useRef`, kunci baru setelah error/tutup), `pending-payment.tsx` (banner `summary.pendingPayment`: Lanjutkan pembayaran + Ganti metode), `payment-history.tsx` (Widget + Table tanpa judul kolom terlihat, `billing.payments` per 10, tautan bukti bayar bila `paidAt` ada), `purchase.ts` (helper murni + `usePlanDates`: tanggal dalam bahasa aplikasi dan zona akun, WIB bila `UTC`). Pemicu upgrade membuka `/dashboard/settings/billing?plan=plus` (dialog batas/fitur, API key) atau `?plan=pro-ai` (dialog kredit kurang); kartu itu ditandai "Dipilih" dan digulir ke tengah. Homepage (saat `flags.billing`): tombol paket berbayar → `/auth/register?callbackURL=/dashboard/settings/billing?plan=<id>` (yang sudah masuk langsung diarahkan ke sana); field `plan` di pencarian `/auth` dihapus.

### 6.2 Halaman kembali

`callbacks.finish` menunjuk ke `${APP_URL}/dashboard/settings/billing/return/<id>/`. Halaman harus tampil benar dengan atau tanpa garis miring akhir dan dengan query tambahan dari Midtrans. Query `order_id`, `status_code`, `transaction_status`, `result` — **abaikan untuk keputusan**; halaman memanggil `billing.payment({ id })` setiap beberapa detik (maks. ±2 menit), lalu menampilkan: berhasil, masih menunggu (dengan tombol "Lanjutkan pembayaran" ke `redirect_url`), gagal/kedaluwarsa (dengan tombol coba lagi). Pastikan rute tidak memicu redirect server (rute `/dashboard/*` dilayani SPA oleh `handleWebApp`).

`billing.payment` memicu sinkronisasi status ke Midtrans bila pembayaran masih `creating`/`pending` dan `last_checked_at` lebih lama dari ±10 detik.

Uji sandbox 2026-11-02: Midtrans mengarahkan ke `…/billing/return/<id>?order_id=…&status_code=200&transaction_status=settlement` (garis miring akhir hilang). Hanya pengguna dengan sesi web yang menerima `redirectUrl` di `billing.payment`/`pendingPayment`; app mobile menerima `null`.

Implementasi Phase 07: rute `return.{-$paymentId}.tsx` (parameter opsional; tanpa id → dari `order_id`, hanya `RZ-<uuid>`), `payment-return.tsx` memanggil `billing.payment` tiap 3 detik selama `pending`/`creating`, maks. 2 menit (`refetchInterval`, otomatis berhenti saat tab tersembunyi), lalu tombol "Periksa lagi". Keadaan: diterima (paket, mulai/berakhir dari `access`, kredit, tautan bukti bayar), menunggu (Lanjutkan pembayaran + catatan VA sampai batas waktu), waktu habis (`pending` lewat `expiresAt`), gagal/dibatalkan, kedaluwarsa, dikembalikan/dibalik, tidak ditemukan (`NOT_FOUND`, termasuk pembayaran akun lain). Setelah `paid`, query `billing.*` diinvalidasi. Bukti bayar: `receipt.$paymentId.tsx` → `receipt.tsx` (penjual dari `BILLING_SELLER`, pembeli dari sesi, nomor pesanan, waktu bayar, item, masa aktif, kredit, metode, status, nominal, "bukan faktur pajak"); cetak memakai `[data-print-only]` + aturan `@media print` di `apps/web/src/index.css`. Diuji di dev lokal dan build produksi (E2E): dengan/tanpa garis miring akhir dan dengan query tambahan, tanpa redirect server.

### 6.3 Notifikasi Midtrans

`POST /api/payments/midtrans/notification` (body limit kecil, mis. 64 KB):

1. Parse JSON. Ambil `order_id`, `status_code`, `gross_amount`, `signature_key` **sebagai string apa adanya**.
2. Verifikasi `signature_key == SHA512(order_id + status_code + gross_amount + kunci)` (hex huruf kecil) dengan perbandingan timing-safe. **Kunci = Signature Secret Key** bila akun memakai kredensial Midtrans model baru (beberapa server key; Settings → Access Keys → General Credentials, keterangan dashboard: "used to verify payment notifications"), atau server key pada akun lama. Dibuktikan di sandbox 2026-11-02: notifikasi asli ditandatangani dengan Signature Secret Key dan **tidak** cocok dengan server key, padahal dokumen notifikasi masih menyebut server key. Implementasi menerima tanda tangan dari `MIDTRANS_SIGNATURE_KEY` (bila di-set) atau server key. Tidak valid → catat event `rejected_signature`, balas **403** tanpa mengubah data. (Midtrans mengulang respons 4xx selain 400/404 beberapa kali; bila penyebabnya server key yang salah setel lalu diperbaiki, ulangan berikutnya bisa lolos.)
3. Cari pembayaran berdasarkan `provider_order_id`. Tidak dikenal (misalnya tombol "test notification" di dashboard, atau transaksi lain di akun Midtrans yang sama) → catat event `unknown_order`, balas 200 agar tidak diulang. Payload boleh berisi field tambahan atau tanpa field yang bernilai null; parse dengan longgar.
4. **Konfirmasi ke Midtrans** dengan Get Status (`GET /v2/{order_id}/status` di host Core API). Status dari langkah ini yang dipakai, bukan isi notifikasi.
5. Cocokkan `gross_amount` (desimal string → Rupiah bulat) dengan `amount`. Beda → event `amount_mismatch`, jangan aktifkan, kirim peringatan ke pemilik (Phase 09).
6. Terapkan transisi (5.1) di transaksi dengan kunci `billing_account` + baris pembayaran. Bila menjadi `paid` dan `fulfilled_at` kosong → fulfillment (6.5). Panggilan HTTP ke Midtrans (langkah 4) terjadi **sebelum** transaksi dibuka, tidak pernah di dalamnya.
7. Balas 200 setelah perubahan ter-commit, idealnya dalam < 5 detik (Midtrans menunggu sampai 15 detik). Kesalahan internal sementara (DB tidak tersedia, Get Status gagal, atau Get Status belum mengenal order yang baru dinotifikasikan) → balas **503**. Signature salah → 403 tanpa mengubah data. Rekonsiliasi cron (6.4) tetap menjadi jaring pengaman kedua bila semua ulangan gagal.

Diperiksa di `D/https-notification-webhooks` 2026-11-02: 2xx tidak diulang; 500 diulang sekali; 503 empat kali; 400/404 dua kali; 301/302/303 tidak diulang (jangan dipakai); 307/308 diikuti; status lain (termasuk 403) sampai lima kali, dengan jeda acak. Implementasi Phase 06: tanpa server key → 404; JSON rusak atau tanpa `order_id` → 400; event `rejected_signature` hanya dicatat bila `order_id` milik pembayaran Rezumi (endpoint publik, jangan sampai spam mengisi tabel); `unknown_order` dicatat dengan `payment_id` kosong. Event notifikasi menyimpan kolom dari Get Status (yang diputuskan) dan `payload.notified_status` dari notifikasi. Pemrosesan tetap berjalan saat `BILLING_MODE=off`.

### 6.4 Rekonsiliasi terjadwal (`runBillingJobs`)

Setiap menit, terbatas jumlah dan waktunya:

- Ambil maks. ±20 pembayaran `creating`/`pending` yang umurnya > 2 menit dan sudah waktunya dicek (backoff: 2, 5, 15, 30, 60 menit, lalu tiap 6 jam sampai 3 hari), dengan `FOR UPDATE SKIP LOCKED`. Jalankan Get Status → terapkan transisi yang sama dengan 6.3.
- Get Status sebelum metode dipilih menjawab "Payment not found" (`status_code` `404` di body; kode HTTP-nya tidak didokumentasikan, jadi cek keduanya): itu berarti belum ada transaksi, bukan gagal. Setelah lewat `expires_at` + 30 menit dan status masih "tidak ditemukan" atau `pending` → panggil `POST /v2/{order_id}/expire` (best effort, abaikan error "tidak ditemukan"), cek status sekali lagi, lalu tandai `expired` bila memang tidak dibayar.
- Kirim email bukti bayar yang `receipt_sent_at`-nya masih kosong: maks. 10 per putaran, maks. 5 percobaan per pembayaran, jeda 5 menit antar-percobaan (`receipt_attempted_at`). Peringatan ke pemilik setelah 5 kali gagal: Phase 09.

Implementasi Phase 06 (`reconcile.ts`): klaim maks. 20 baris `creating`/`pending` berumur 2 menit–3 hari dengan `FOR UPDATE SKIP LOCKED`, set `last_checked_at` + `check_attempts` di transaksi klaim, lalu Get Status satu per satu di luar transaksi dengan anggaran waktu 20 detik. Backoff menurut `check_attempts`: 2, 5, 15, 30, 60 menit, lalu 6 jam. Lewat `expires_at` + 30 menit → `expire` (best effort) → Get Status → bila tetap tidak ada transaksi, lokal `expired` alasan `window_closed` lewat `applyVerifiedStatus`. Diuji di sandbox 2026-11-02 (Permata VA): job memanggil `expire`, Get Status menjawab `expire`, lokal `expired`.

- Lepaskan `ai_credit_usage` berstatus `reserved` yang lebih tua dari 15 menit (Phase 04, `releaseStaleReservations`): ambil maks. 100 kandidat tanpa kunci, kelompokkan per akun, lalu per akun satu transaksi: `billing_account … FOR UPDATE SKIP LOCKED` (akun sibuk dilewati putaran ini) → baca ulang usage yang masih `reserved` → kembalikan ke grant asal dengan `error_code = stale_reservation`. Urutan kunci sama dengan semua operasi kredit (akun dulu, lalu usage/grant), jadi tidak ada deadlock.
- Job harus aman berjalan bersamaan atau terulang (Cron Trigger tidak menjamin tepat sekali).

Phase 09: setelah pembayaran, bukti bayar, dan reservasi kredit, job menjalankan `detectBillingProblems` → `queueDailySummary` → `queueExpiryReminders` → `sendBillingNotifications` (lihat 6.11), masing-masing dengan error terpisah.

Phase 04: `scheduled()` di Workers dan `startJobScheduler()` (`apps/server/src/startup/job-scheduler.ts`, dulu `career-scheduler.ts`) menjalankan billing lebih dulu (pendek), lalu career, keduanya dengan error terisolasi, memakai pool yang sama (`max: 1`). Job berjalan juga saat `BILLING_MODE=off` (satu query ber-index), agar reservasi yang tertinggal setelah rollback tetap dilepas.

### 6.5 Fulfillment (atomik, satu transaksi)

1. Kunci `billing_account` pengguna dan baris pembayaran.
2. Bila `fulfilled_at` sudah terisi → selesai (idempoten).
3. Hitung jadwal masa aktif baru dengan fungsi murni `schedulePurchase` (6.6) → insert/update baris `membership_period`.
4. Bila `credits > 0` → insert `ai_credit_grant` (`source = plan`, `amount = remaining = credits`, `expires_at` = akhir potongan masa aktif yang baru dibeli).
5. Set `status = paid`, `paid_at`, `fulfilled_at`; tulis `billing_audit_log` (`payment.fulfilled`, aktor sistem).
6. Setelah commit: kirim email bukti bayar bila `receipt_sent_at` kosong (gagal kirim tidak membatalkan apa pun; dicoba lagi oleh job). Phase 06: email dikirim oleh `runBillingJobs` (maks. ±1 menit setelah commit), bukan di dalam request, supaya balasan notifikasi tetap < 5 detik dan tidak bergantung pada `waitUntil` di Workers. Isi: Bahasa Indonesia (belum ada bahasa akun yang tersimpan di server), waktu di zona akun atau WIB bila zona masih default `UTC`, identitas penjual dari `BILLING_SELLER` (`@rezumi/schema/billing`), "Bukti pembayaran ini bukan faktur pajak".

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

- `reserveCredits({ userId, actionKey, idempotencyKey, now? })` → `{ usageId, credits, balanceAfter, status }`, membuka transaksi sendiri dengan `lockBillingAccount`: bila `operation_key` sudah ada → kembalikan baris itu apa adanya (status bisa sudah `committed`/`released`; Phase 05 memutuskan perlakuannya). `idempotencyKey` 1–200 karakter, selain itu `BAD_REQUEST`. Bila belum: hitung biaya dari `CREDIT_COSTS`, ambil grant yang aktif (belum kedaluwarsa/dicabut, `remaining > 0`) urut `expires_at` paling dekat dulu, kurangi `remaining`, insert usage `reserved`. Saldo kurang → `INSUFFICIENT_CREDITS`.
- `commitCredits(usageId, { provider, model, inputTokens, outputTokens, costUsdMicros })` → `committed` + token/biaya. `releaseCredits(usageId, errorCode)` → `released` + kembalikan `remaining` ke grant asal (grant yang sudah kedaluwarsa menerima kembali tetapi tetap tidak terhitung saldo). Keduanya membuka transaksi sendiri, hanya berlaku dari `reserved`, aman dipanggil dua kali (mengembalikan status sekarang). Reservasi yang sudah dilepas job tidak bisa di-commit: hasilnya gratis untuk pengguna.
- `grantCredits(tx, { userId, source, amount, expiresAt, paymentId?, note?, now? })` dan `deductCredits(tx, { userId, credits, now? })` berjalan di transaksi pemanggil. `deductCredits` (koreksi admin negatif) mengambil dari grant paling cepat kedaluwarsa dan mencatat usage `admin-adjustment` berstatus `committed`, jadi `remaining` grant = `amount` − alokasi usage yang belum `released`; saldo kurang → `BAD_REQUEST` dengan `data.balance` (tidak dipotong sebagian).
- `getCreditBalance(userId, now, database)` → `{ balance, nextExpiry: { credits, at } | null, trial: { available, grantedAt, expiresAt } }`; `trial.available` = belum pernah diberi, email terverifikasi, bukan tamu. Query dijalankan berurutan karena `database` bisa transaksi (satu koneksi).
- `billing.summary.credits` bernilai `null` bila billing tidak berlaku untuk akun (mode `off`, atau `admins` untuk bukan admin). `billing.creditHistory({ limit 1–50 = 20, offset 0–5000 })` → `{ items, hasMore }` (gabungan grant dan usage, terbaru dulu); kosong bila billing tidak berlaku. Memakai limit/offset seperti `pagination.ts`, bukan cursor.
- Kredit coba: diberikan **saat pertama kali** pengguna terverifikasi (bukan tamu) memakai Rezumi AI dan `trial_granted_at` masih kosong; berlaku 14 hari sejak diberikan. `ensureTrialCredits(tx, userId, now?)` → `boolean`; mode `off` tidak membaca apa pun, mode `admins` hanya admin. Phase 05 memanggilnya sebelum `reserveCredits` (belum dipanggil di mana pun pada Phase 04).
- Saldo = jumlah `remaining` grant aktif. Tampilkan juga tanggal kedaluwarsa terdekat.
- BYOK (koneksi AI milik pengguna) tidak menyentuh kredit sama sekali. Tidak boleh ada perpindahan diam-diam dari BYOK ke Rezumi AI atau sebaliknya.
- Phase 05: `reserveCredits` mengembalikan `created` (`true` = reservasi baru). `releaseCredits(usageId, errorCode, now?, spent?)` menyimpan token/biaya pekerjaan yang gagal (provider tetap dibayar) supaya Phase 10 melihat biaya nyata, termasuk yang tidak ditagihkan ke pengguna.

### 6.10 Sumber AI dan meteran (Phase 05)

**Resolver** (`ai-providers/service.ts`). "Akun memilih" (`aiProvidersService.offersChoice`) = server punya AI sendiri (`AI_PROVIDER` + `AI_MODEL`) **dan** billing berlaku untuk akun (`isBillingAppliedTo`). Saat akun memilih:

- `list` berisi baris server `server-ai:<userId>` berlabel **Rezumi AI** (`managed: true`, tanpa key) bersama koneksi pribadi, urut `automaticOrder`. Tanpa `ENCRYPTION_SECRET` hanya Rezumi AI.
- Upsert baris server tidak lagi memaksa `isDefault: true`; pengguna boleh menjadikan Rezumi AI atau koneksinya sendiri default (`setDefault` menerima id server). Baris lama yang dibuat sebelum billing aktif tetap default sampai pengguna mengubahnya. Rezumi AI tidak bisa dihapus.
- Koneksi pribadi boleh dibuat/diubah (`assertPersonalProvidersAllowed` per akun).

Bila akun tidak memilih, perilaku lama persis: AI server (bila ada) menjadi satu-satunya koneksi untuk semua orang, gratis, dan koneksi pribadi ditolak (tes `metered-ai.integration.test.ts` → "while billing doesn't apply"). Akun yang menjadikan koneksi pribadinya default selagi billing berlaku lalu billing berhenti berlaku (misalnya `BILLING_MODE` dikembalikan ke `off`): AI server dilaporkan sebagai default karena satu-satunya koneksi, tetapi flag default di baris pribadi tidak diambil alih (indeks unik satu default per akun). Dulu upsert memaksa `is_default` dan daftar koneksi gagal 500; diperbaiki 2026-11-02. Saat billing berlaku lagi, default pribadi itu tetap berlaku, tidak pernah berpindah diam-diam ke Rezumi AI.

**Aturan sumber** (`resolveAiSource`), hanya saat akun memilih:

| `aiSource` di request      | Hasil                                                                                                                                                                                                                                                                                           |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `"rezumi"`                 | Rezumi AI, dimeter. Ditolak `REZUMI_AI_UNAVAILABLE` (409) bila server tidak punya AI atau pekerjaan tidak didukung (`action: null`: suara, jadwal)                                                                                                                                              |
| `"own"`                    | Koneksi pribadi (id yang disebut atau default pribadi). Id Rezumi AI → `BAD_REQUEST`. Tidak punya → pesan "pasang koneksi" per titik masuk                                                                                                                                                      |
| tidak ada (app/klien lama) | Koneksi pribadi. Bila hanya ada Rezumi AI, atau id yang disebut adalah Rezumi AI → `AI_SOURCE_REQUIRED` (409, "Update Rezumi to use Rezumi AI, or add your own AI connection in Settings."). Tidak pernah memotong kredit. Pengecualian `optional: true` (baca lowongan): tanpa AI, bukan error |

Tidak ada perpindahan sumber: koneksi pribadi yang gagal tidak dilempar ke Rezumi AI (tes).

**Transport.** `aiTransport(serverAi)` (`ai/url-policy.ts`): hanya AI server (`provider.managed`, endpoint pilihan operator) dan `FLAG_ALLOW_UNSAFE_AI_BASE_URL` memakai `fetch` biasa. Koneksi pribadi selalu lewat `fetchPublic` (alamat publik saja, tanpa redirect), juga saat `AI_PROVIDER` di-set, karena akun yang memilih boleh menambah koneksi sendiri. `getModel`/`getAgentModel` menerima `serverAi`.

**Meteran** (`startAiRun` / `runWithAiSource`). Rezumi AI: `ensureTrialCredits` → `reserveCredits` (kunci = `idempotencyKey` atau ID acak) → model dibungkus `wrapLanguageModel` dengan middleware yang menghitung `usage` setiap panggilan (generate dan stream, termasuk reasoning) dan menegakkan `AI_WORK_LIMITS` → `succeed()` = `commitCredits` dengan token dan `cost_usd_micros`; `fail(code)` = `releaseCredits` dengan token yang sudah terpakai. Model dibuat sebelum reservasi, jadi setup provider yang tidak valid gagal tanpa memesan kredit. Gagal commit/release hanya dicatat; job 15 menit membereskannya. Kunci berulang: masih `reserved` atau sudah `committed` → `CONFLICT` tanpa menjalankan AI; sudah `released` → dicoba lagi dengan kunci turunan `<kunci>~<usageId>` (maksimal 3).

**Batas kerja** (`AI_WORK_LIMITS`, dikalibrasi Phase 10): `maxOutputTokens` per panggilan (dipotong ke nilai terkecil), `maxInputChars` per panggilan (teks dalam karakter, file dalam byte; lewat → `AI_INPUT_TOO_LARGE` 413 sebelum provider dipanggil, kredit kembali), `maxSteps` agent.

| `actionKey`                    |      Output token |     Input |                                     Langkah |
| ------------------------------ | ----------------: | --------: | ------------------------------------------: |
| `short-text`                   |             1.024 |    60.000 |                                           1 |
| `draft-answer`, `cover-letter` |             2.048 |   120.000 |                                           1 |
| `interview-practice`           |             4.096 |   120.000 |                                           1 |
| `review`, `tailor-resume`      |             4.096 |   150.000 |                                           1 |
| `coach-turn`                   | 4.096 per langkah |   240.000 | 8 (BYOK 30), tanpa `search_web`/`read_page` |
| `import-document`              |            16.384 | 6.000.000 |                                           1 |

**Peta titik masuk**

| Titik masuk                                   | `actionKey`                                                                                                             | Kapan kredit dipakai                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ai.improve`                                  | `short-text`                                                                                                            | Saran diterima                                                                                                                                                                                                                                                                                                                                            |
| `ai.atsReview`                                | `review`                                                                                                                | Review diterima                                                                                                                                                                                                                                                                                                                                           |
| `ai.parsePdf`, `ai.parseDocx`                 | `import-document`                                                                                                       | Data CV diterima (impor tanpa AI tetap gratis)                                                                                                                                                                                                                                                                                                            |
| `applications.ai.parsePosting`                | `short-text`                                                                                                            | AI membaca lowongan; gagal → isian dari halaman + `enrichmentWarning`, kredit kembali                                                                                                                                                                                                                                                                     |
| `applications.ai.autofill`                    | `short-text`                                                                                                            | Isian diterima. Web tidak menjalankan otomatis saat paste bila sumbernya Rezumi AI                                                                                                                                                                                                                                                                        |
| `applications.ai.matchScore`                  | `review`                                                                                                                | Skor tersimpan                                                                                                                                                                                                                                                                                                                                            |
| `applications.ai.draftMessage`                | `cover-letter` / `draft-answer` (follow-up)                                                                             | Surat tersimpan / teks diterima                                                                                                                                                                                                                                                                                                                           |
| `applications.ai.tailorResume`                | `tailor-resume`                                                                                                         | CV baru tersimpan                                                                                                                                                                                                                                                                                                                                         |
| `coverLetters.draft` (stream)                 | `cover-letter`                                                                                                          | Draf selesai utuh; berhenti/gagal → kembali (AI SDK 7 mengakhiri stream yang dihentikan dengan part `abort`, bukan error)                                                                                                                                                                                                                                 |
| `career.generate`                             | `CAREER_TASK_CREDIT_ACTIONS`: fit `review`; briefing/practice/debrief `interview-practice`; reply/answer `draft-answer` | Hasil tersimpan (answer: dikirim)                                                                                                                                                                                                                                                                                                                         |
| `agent.threads.start`                         | —                                                                                                                       | Tidak memotong; `aiSource: "rezumi"` mengikat percakapan ke Rezumi AI                                                                                                                                                                                                                                                                                     |
| `agent.messages.send` (stream)                | `coach-turn`                                                                                                            | Setiap balasan yang selesai dan tersimpan, **termasuk** balasan setelah pengguna menjawab pertanyaan asisten atau menyetujui tool. Percakapan Rezumi AI wajib `aiSource: "rezumi"`; batal/timeout/error stream utama → kembali. Tool yang gagal tidak membatalkan giliran (hanya part `error` tingkat atas yang dihitung, lewat `experimental_transform`) |
| `career.voice.*`                              | `null`                                                                                                                  | Tidak pernah Rezumi AI (`REZUMI_AI_UNAVAILABLE`)                                                                                                                                                                                                                                                                                                          |
| Jadwal `prepare` (`career.saveSchedule`, job) | `null`                                                                                                                  | Tidak pernah Rezumi AI; menyimpan jadwal dengan id Rezumi AI ditolak, job memakai koneksi pribadi                                                                                                                                                                                                                                                         |

MCP: tool parity mewarisi field opsional dari input prosedur; tool khusus (`autofill_application_from_job`, `score_application_match`, `tailor_resume_for_application`, `draft_application_message`) menambah `aiSourceInput` dan menyebut biaya di deskripsi. Tanpa `aiSource: "rezumi"` klien MCP memakai koneksi pribadi.

**Klien**

- Web (`apps/web/src/features/billing/ai-source.ts`, `ai-source-menu.tsx`): `useAiSource()` (akun memilih bila `billing.summary.credits` ada dan Rezumi AI terdaftar); pilihan sumber per browser di `localStorage` (`rezumi:ai-source`), tanpa pilihan mengikuti default server. `aiSourceFields`/`aiSourceFieldsFor` membuat `idempotencyKey` baru per tindakan. `AiSourceMenu` (biaya + ganti sumber) di samping tombol AI, `AiCostNote` untuk tempat yang memilih koneksi sendiri (review tulisan, Assistant, Coach). `CreditsDialog` untuk `INSUFFICIENT_CREDITS` (pakai koneksi sendiri, lihat Pro AI, batal).
- Mobile: dialog izin AI yang sudah ada (`apps/mobile/src/api/ai-consent.ts`) memutuskan sumber dan menyisipkan `aiSource`/`idempotencyKey` ke input lewat interceptor `client.ts`. Android: judul "Use Rezumi AI?" dengan biaya dan saldo sebelum mengirim; `INSUFFICIENT_CREDITS` → alert netral tanpa tautan/tombol beli. iOS: baris Rezumi AI disembunyikan (`useHasAIProvider`), request selalu `aiSource: "own"`. Tes: `apps/mobile/scripts/rezumi-ai.test.mjs`.

### 6.11 Operasional (Phase 09)

**Refund lewat API** (`refunds.ts` → `requestRefund`). Satu endpoint untuk semua metode: `POST {core}/v2/{order_id}/refund` dengan `refund_key`, `amount` (hanya bila tidak penuh) dan `reason` (≤255). Dokumen Midtrans (diperiksa 2026-11-03): semua field opsional, `refund_key` alfanumerik/`-`/`_`, mengulang kunci yang sama aman sampai 7 hari; Direct Refund masih ada tetapi Midtrans menyarankan `/refund` untuk semua kasus; respons sukses `status_code` `200` dengan `transaction_status` `refund`/`partial_refund`, `refund_amount`, `refund_key`; error `406` kunci duplikat, `412` status tidak bisa diubah, `414` nominal salah, sering sebagai HTTP 200 dengan kode di body (klien memetakannya ke `refund_http_<kode>`). Bisa refund lewat API: `qris`, `gopay`, `shopeepay`, `dana`, `ovo`, `credit_card`, `kredivo`, `akulaku`; ShopeePay/OVO penuh saja; VA (`bank_transfer`, `echannel`) dan gerai (`cstore`) tidak → `recordManualRefund`. Alur: transaksi #1 kunci akun + baris pembayaran, tolak bila ada refund `requesting` dengan nominal berbeda (`CONFLICT`) atau nominal > sisa, insert `requesting` + audit `refund.requested` → commit → HTTP di luar transaksi → jawaban Midtrans diproses lewat `applyVerifiedStatus` (sumber `admin`). Jawaban `status_code` `201` (diterima, bank masih memproses; terutama kartu) → tetap `requesting` dengan `failure_reason = bank_processing` (`REFUND_BANK_PROCESSING`), bukan gagal. Gagal: Get Status dulu (mungkin sudah ter-refund); hanya penolakan pasti (400/401/403/404/412/414) **dan** Get Status berhasil tanpa kunci itu → `failed` + audit `refund.failed` + peringatan `refund_failed`; selain itu (transien, 406, Get Status gagal) tetap `requesting` dan admin boleh mengirim ulang dengan kunci yang sama. Job `reconcileRefunds` (bagian `runBillingJobs`) mengecek refund `requesting` maks. 10 per putaran, tiap 15 menit per refund, sampai 45 hari, lewat Get Status, sehingga refund yang dikonfirmasi bank menjadi `succeeded` sendiri. Uji sandbox 2026-11-03 dengan order buatan lokal: Midtrans menjawab 403 tanpa pesan (order tidak dikenal / refund belum aktif) → `failed`, pesan jelas di dialog.

**Satu pembukuan refund** (`fulfillment.ts`). Saat status terverifikasi `refund`/`partial_refund`: `recordProviderRefunds` mencocokkan daftar `refunds` dari Get Status/jawaban refund berdasarkan `refund_key` (milik Rezumi → `succeeded`; kunci lain = refund dari dashboard Midtrans → baris baru), lalu `settleRefunds` menghitung `refunded_amount` (tidak pernah turun; bila Midtrans menyatakan `refund` tanpa daftar kunci, refund `requesting` dianggap selesai) dan, bila seluruh nominal sudah kembali (termasuk gabungan refund manual + Midtrans), status menjadi `refunded`, lalu mencabut paket + sisa kredit (`revokePaymentBenefits`, idempoten) bila penuh atau ada refund sebagian dengan `revoke_benefits`. Refund manual memakai `settleRefunds` yang sama di transaksinya sendiri. Notifikasi refund yang datang setelah admin me-refund menjadi `duplicate`; pencabutan tercatat tepat sekali (tes).

**Peringatan** (`alerts.ts`). Jenis: `amount_mismatch`, `paid_not_applied` (Midtrans lunas tetapi menerapkannya gagal, Midtrans lunas padahal lokal `reversed`, atau `paid` tanpa `fulfilled_at` > 5 menit; refund manual VA sengaja tidak memicu karena Midtrans tetap `settlement`), `payment_reversed`, `needs_review` (status `review`/tak dikenal), `rejected_signatures` (ambang 5/jam), `midtrans_errors` (ambang 3/jam: Snap gagal, putaran rekonsiliasi yang semuanya gagal, error Midtrans saat notifikasi), `receipt_failed` (5 percobaan habis), `refund_failed` (ditolak atau `requesting` > 30 menit). Peringatan berbasis kejadian ditulis di transaksi yang sama (rollback = tidak ada peringatan); sapuan memakai mode `level` (jumlah tertinggi, bukan ditambah tiap menit) dan hanya menangkap masalah dalam satu jam setelah mulai (paid tanpa pass 5–65 menit, bukti bayar gagal pada percobaan terakhir, refund tanpa jawaban 30–90 menit, kecuali `bank_processing`), jadi satu masalah = satu email, bukan email tiap jam. Pembayaran lunas setelah akunnya dihapus diperingatkan sekali saat lunas. Satu baris per jenis per jam UTC → satu email per jenis per jam. Tanpa `BILLING_ALERT_EMAIL` peringatan hanya tampil di halaman admin.

**Ringkasan harian**: `queueDailySummary` saat jam WIB ≥ 08.00 dan `BILLING_MODE ≠ off` dan alamat ada → `summary:<tanggal WIB>`; isinya dihitung saat dikirim dari `billingMetrics` untuk kemarin (00.00–24.00 WIB).

**Pengingat H-3** (`notifications.ts`): akun yang `max(ends_at)` potongan aktifnya ≤ 3 hari lagi (hanya potongan terakhir, bukan tiap potongan antre) dan billing berlaku → `expiry:<user>:<ends_at>`; akun yang sudah diingatkan dalam 4 hari terakhir dilewati agar batch 100 bergerak ke akun lain. Saat dikirim dicek ulang; bila diperpanjang/dicabut → ditandai `skipped`. Bahasa dari `billing_account.locale` (diisi di checkout dari `context.locale`): `id*` atau kosong → Indonesia, lainnya Inggris. Isi: kapan berakhir, tidak diperpanjang otomatis, apa yang tetap di Gratis (dari katalog), kredit ikut berakhir (Pro AI), tautan Paket; tanpa trik urgensi.

**Angka dan CSV** (`reports.ts`): pendaftar (bukan tamu, terverifikasi), checkout dimulai/dibayar/akun, penjualan per paket dan metode, refund per cara, bersih, pembayaran menggantung (> 1 jam, masih bisa dibayar), kredit coba/Pro AI/terpakai, pemakaian Rezumi AI per jenis (ditagih, dikembalikan, kredit, biaya, P50/P95 `cost_usd_micros`), jumlah peringatan (per pembayaran unik, bukan per jam), pembalikan bank (`reversals`: event `applied` `deny`/`failure`/`chargeback` setelah `paid_at`, nominal = `amount − refunded_amount`); bersih = pendapatan − refund − pembalikan. Aktivasi "PDF pertama dalam 7 hari" belum bisa dihitung (unduhan PDF tidak dicatat server). CSV: `jenis,tanggal_wib,nomor_pesanan,paket,metode,jumlah_idr,status,id_transaksi_midtrans,kunci_refund`, refund dan pembalikan (`jenis = pembalikan`) bernilai negatif sehingga kolom jumlah = bersih, BOM UTF-8, sel teks yang diawali `= + - @` dinetralkan; tanpa nama/email/id akun.

**UI admin web** (`apps/web/src/features/billing/admin/`, mengikuti template dashboard HeroUI Pro milik pemilik; semua kartu memakai `Widget` lewat `AdminCard`/`StatWidget` di `parts.tsx`, tabel tanpa bingkai kartu): `/dashboard/admin/billing?query=` = judul + dropdown periode (7/30/90 hari, bulan ini, bulan lalu; hari WIB) + muat ulang + Unduh CSV; widget oranye "Perlu perhatian" (peringatan 7 hari terakhir, tabel `Table` sekunder); 4 `StatWidget` (ikon + judul, nilai, tren vs periode sebelumnya, sparkline harian): pendapatan bersih, pembayaran berhasil, konversi checkout, pendaftar baru; grafik Penjualan (batang bertumpuk Pro AI/Plus per hari) dan Checkout (garis dimulai vs dibayar); donat metode pembayaran; Rezumi AI per jenis pekerjaan (batang relatif terhadap jenis terbanyak); DataGrid pembayaran dengan filter status (semua, lunas, menunggu, gagal/kedaluwarsa/dibatalkan, refund/dibalik), `Pagination` 20 per baris dengan total sebenarnya, dan pencarian (email, `RZ-…`, ID; hasil dari tanggal mana pun, maks. 20). API: `billing.admin.metrics` = angka periode + `previous` (periode sama panjang tepat sebelumnya) + `daily` (`billingDailySeries`); `billing.admin.payments({ from, to, limit, offset, status })` → `{ items, total }` (`listRecentPayments`). `/dashboard/admin/billing/$userId`: header (avatar, email, chip paket, Beri paket, Sesuaikan kredit), 4 `StatWidget` (paket sekarang, kredit, total dibayar setelah refund, refund selesai), DataGrid pembayaran dengan menu ⋯ (Cek ulang status / Kirim ulang bukti bayar / Refund lewat Midtrans / Catat refund manual; yang tidak berlaku dinonaktifkan), tabel refund, `Timeline` masa aktif (berjalan/antre/berakhir/dicabut + Cabut) dan `Timeline` riwayat (event Midtrans + audit dalam kalimat biasa, chip sumber, waktu di kanan, alasan di bawah). Setiap tindakan yang mengubah data lewat `ReasonDialog` (alasan ≥ 3 karakter). Rute dijaga `beforeLoad` (`session.user.role === "admin"`), menu "Admin billing" hanya untuk admin; server tetap menolak non-admin dan non-sesi-web (tes). Tanpa versi mobile (alat internal).

**Ekspor data akun**: `auth.exportData` memuat `billing` (`payments` + `refunds`, `passes`, `creditGrants`, `creditUsage`; tanpa token/URL Snap). Web menulis `billing.json` di ZIP; mobile membagikan JSON server apa adanya.

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

| Nama                                                        | Jenis        | Isi                                                                                                                                                                                                                                                                                                                                               | Phase |
| ----------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `BILLING_MODE`                                              | var          | `off` (default), `admins` (hanya akun `role = admin`), `on`                                                                                                                                                                                                                                                                                       | 01    |
| `MIDTRANS_ENVIRONMENT`                                      | var          | `sandbox` atau `production`; harus cocok dengan jenis server key (validasi saat start)                                                                                                                                                                                                                                                            | 06    |
| `MIDTRANS_SERVER_KEY`                                       | secret       | Server key dari dashboard Midtrans (sandbox untuk lokal/staging)                                                                                                                                                                                                                                                                                  | 06    |
| `MIDTRANS_SIGNATURE_KEY`                                    | secret       | "Signature Secret Key" dari Settings → Access Keys → General Credentials. **Wajib** untuk akun berkredensial model baru (akun pemilik): tanpa ini semua notifikasi ditolak 403 dan pembayaran baru aktif lewat rekonsiliasi (lebih lambat). Prefiks harus sesuai environment (`SB-` = sandbox)                                                    | 06    |
| `MIDTRANS_ENABLED_PAYMENTS`                                 | var          | Daftar kode metode dipisah koma, **wajib** untuk mode redirect. Default `other_qris` (satu-satunya metode yang diketahui aktif per 2026-11-02). Tambahkan `gopay`, `shopeepay`, `bni_va`, `bri_va`, `echannel`, `permata_va` hanya setelah aktif di akun (tabel Phase 00 bagian B). Kode lain (termasuk `credit_card`, `qris`) ditolak saat start | 06    |
| `BILLING_CHECKOUT_PAUSED`                                   | var          | `true` = pembelian baru ditutup sementara; hak akses yang sudah dibeli tetap berlaku                                                                                                                                                                                                                                                              | 06    |
| `BILLING_ALERT_EMAIL`                                       | var, opsi    | Alamat pemilik untuk peringatan dan ringkasan harian                                                                                                                                                                                                                                                                                              | 09    |
| `AI_PROVIDER`, `AI_MODEL`, `AI_BASE_URL` / `AI_API_KEY`     | var / secret | AI server yang sudah ada. Saat billing berlaku untuk akun, AI ini tampil sebagai **Rezumi AI** dan memotong kredit (6.10); saat tidak, perilaku lama (AI server untuk semua, gratis)                                                                                                                                                              | 05    |
| `AI_COST_INPUT_USD_PER_MTOK`, `AI_COST_OUTPUT_USD_PER_MTOK` | var, opsi    | Tarif provider dalam USD per sejuta token input/output. `cost_usd_micros` = token × tarif; tanpa keduanya hanya token yang disimpan                                                                                                                                                                                                               | 05    |

Ikuti aturan `CLAUDE.md` → "New env var": `packages/env/src/server.ts`, `.env.example`, `turbo.json`, dan validasi silang. Secret produksi dipasang pemilik dengan `pnpm exec wrangler secret put <NAMA>` (atau dashboard Cloudflare), tidak pernah lewat chat atau commit.

Host Midtrans: Snap `app.sandbox.midtrans.com` / `app.midtrans.com`; Core API (status, cancel, refund) `api.sandbox.midtrans.com` / `api.midtrans.com`. Jangan tertukar; pilih berdasarkan `MIDTRANS_ENVIRONMENT`.

## 9. Keamanan, privasi, dan logging

### 9.1 Siapa boleh melakukan apa

- `billing.checkout` dan `billing.changePaymentMethod`: **hanya sesi web (cookie)**. Tolak OAuth bearer (termasuk app mobile resmi — pembelian di app dilarang oleh keputusan kanal), API key, dan klien MCP. Prosedur baca (`billing.summary`, `billing.payment`, `billing.payments`) boleh dipakai app resmi.
- Membedakan app resmi: app mobile mendaftar sebagai klien OAuth dinamis dengan `client_name` "Rezumi for iOS/Android" dan `redirect_uris` `https://<APP_URL host>/auth/native-callback` (`apps/mobile/src/auth/oauth.ts`). Phase 03 membuat helper `isFirstPartyClient(authentication)` berdasarkan redirect URI terdaftar klien token. Keterbatasan yang diterima: pengguna teknis bisa meniru klien ini untuk akunnya sendiri; dampaknya kecil karena tetap terkena rate limit.
- Implementasi Phase 03 (`billing/automation.ts`): app memakai `https://rezumi.app/auth/native-callback` untuk **semua** server (host tetap di `apps/mobile/src/auth/oauth.ts`), jadi daftar yang diterima = `https://rezumi.app/auth/native-callback`, `https://<host APP_URL>/auth/native-callback`, dan `app.rezumi:/auth/native-callback` (build dev). Klien dianggap resmi bila **semua** redirect URI-nya ada di daftar itu. `RequestAuthentication` membawa `clientId` (`azp` token). `protectedProcedure` memanggil `assertAutomationAccess` setelah cek izin: sesi web selalu lolos, bearer klien resmi lolos (satu query `oauth_client`), selain itu butuh `automationApi`. Endpoint MCP memanggilnya sekali per request dan menjawab 403 JSON-RPC dengan pesan paket. Mode `off` tidak membaca apa pun.
- Admin: `user.role === "admin"` (plugin admin Better Auth sudah aktif), sesi web saja, setiap tindakan wajib alasan dan tercatat di `billing_audit_log`. Phase 01: `assertBillingAdmin` menolak metode selain `session` dan membaca `role` dari database; `billing.admin.grantPeriod({ userId | email, planId, days 1–366, reason })` dan `billing.admin.revokePeriod({ periodId, reason })` (RPC saja, tag `Internal`). Phase 04: `billing.admin.adjustCredits({ userId | email, amount −10.000…10.000 bukan 0, expiresInDays 1–366 wajib bila positif, reason })` → `{ userId, amount, balance, expiresAt }`, audit `credits.adjusted` dengan saldo sebelum/sesudah. Phase 09 menambah UI web dan prosedur `search`, `customer`, `alerts`, `metrics`, `exportPayments`, `syncPayment`, `refund`, `recordManualRefund`, `resendReceipt` (6.11); semuanya `adminProcedure`, tag `Internal`, tidak di allowlist MCP.
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
- Uji lokal dengan notifikasi sandbox membutuhkan URL publik: tunnel sementara (mis. `cloudflared tunnel --url http://localhost:3000`) atau lingkungan staging (Phase 11). Replay fixture lokal tetap wajib karena deterministik. Tunnel sebaiknya langsung ke port Hono (`SERVER_PORT`), bukan Vite, karena Vite menolak host yang tidak dikenal.
- Uji notifikasi asli 2026-11-02 (tunnel `cloudflared --protocol http2`; QUIC diblokir jaringan lokal): alamat tunnel ditambahkan di samping URL lama (kolom menerima beberapa URL dipisah koma), Mandiri Bill dibayar di simulator → notifikasi `settlement` dari Midtrans diterima (`applied`), dashboard menandai "Completed"; replay 2× → `duplicate`. Riwayat notifikasi dashboard menampilkan isi kiriman (berguna untuk diagnosis) tetapi tidak punya tombol kirim ulang. URL sandbox dikembalikan setelah uji.
- Akun sandbox pemilik (diperiksa 2026-11-02) menampilkan VA BCA/Mandiri/BNI/Permata/bank lain, kartu, Alfa, Indomaret, dan Akulaku, tetapi **tidak** QRIS, GoPay, atau ShopeePay: GoPay menyala di Snap Checkout tetapi tidak tampil, dan "Default QRIS" berbunyi "No QRIS options available". Uji QRIS di sandbox perlu penyedia QRIS diaktifkan Midtrans; periksa juga "Default QRIS" di dashboard **produksi** sebelum go-live, karena metode bawaan adalah `other_qris`; sampai itu, uji sandbox memakai `MIDTRANS_ENABLED_PAYMENTS=other_qris,bni_va,echannel,permata_va` (Snap hanya menampilkan yang aktif).

## 11. Kontrak error dan app versi lama

| Kode `ORPCError`        | Kapan                                                                                               | `data` yang disertakan                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `PLAN_LIMIT_REACHED`    | Membuat/memulihkan dokumen melewati batas                                                           | `{ limit: "activeResumes" \| "activeCoverLetters", max, used, planId }` |
| `PLAN_FEATURE_REQUIRED` | Memakai fitur yang tidak ada di paket                                                               | `{ feature: keyof PlanFeatures, planId }`                               |
| `INSUFFICIENT_CREDITS`  | Kredit Rezumi AI kurang                                                                             | `{ required, balance }`                                                 |
| `BILLING_UNAVAILABLE`   | Pembelian belum dibuka / Midtrans belum diset / `BILLING_CHECKOUT_PAUSED` (403)                     | —                                                                       |
| `EMAIL_NOT_VERIFIED`    | Checkout atau kredit coba sebelum verifikasi email                                                  | —                                                                       |
| `AI_SOURCE_REQUIRED`    | Request AI tanpa `aiSource` (app/klien lama) saat satu-satunya pilihan Rezumi AI (409)              | —                                                                       |
| `REZUMI_AI_UNAVAILABLE` | `aiSource: "rezumi"` untuk pekerjaan yang tidak didukung (suara, jadwal) atau server tanpa AI (409) | —                                                                       |
| `AI_INPUT_TOO_LARGE`    | Input melewati `AI_WORK_LIMITS` Rezumi AI (413)                                                     | —                                                                       |

- Pesan error harus kalimat yang bisa dipahami pengguna, karena app mobile versi lama belum mengenal kode baru dan hanya menampilkan pesan. Ikuti pola pesan dan lokalisasi yang sudah ada di server (`apps/server/src/rpc/locale.ts` dan pesan `ORPCError` di router lain).
- Pesan error **netral**: tanpa harga, tanpa ajakan membeli, tanpa URL pembayaran, karena tampil juga di app iOS/Android (aturan toko). Web menambahkan tombol upgrade berdasarkan `code`. Pengecualian: pesan untuk klien API/MCP pihak ketiga boleh menyebut halaman Paket di web.
- Gunakan status HTTP 403 untuk tiga kode pertama, kecuali pola repo menunjukkan pilihan lain; konsisten di semua phase.
- Phase 03: pesan server berbahasa Inggris seperti pesan server lain di repo; web dan mobile menampilkan teks Lingui berdasarkan `code` dan `data` (`apps/web/src/features/billing/plan.ts`, `apps/mobile/src/features/billing/plan-alert.ts`). `PLAN_LIMIT_REACHED.data` juga memuat `requested: { resumes, coverLetters }`.
- Endpoint lama tidak boleh mendapat field wajib baru. Endpoint baru bersifat tambahan.
- App lama tidak boleh menjalankan Rezumi AI berbayar tanpa sadar: jalur AI lama yang tidak mengirim pilihan sumber AI diperlakukan sebagai BYOK/default lama, bukan otomatis memotong kredit (rinci di Phase 05).

## 12. Strategi tes

| Jenis               | Isi                                                                                                                                                                                                                                                                                              | Lokasi/perintah                                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit (fungsi murni) | `schedulePurchase`, pemetaan status, signature, pembentuk payload Snap, alokasi kredit                                                                                                                                                                                                           | `packages/api/src/features/billing/*.test.ts`; `pnpm --filter @rezumi/api test <path>`                                                                                                 |
| Integrasi DB nyata  | Fulfillment paralel, kredit dua perangkat, batas dokumen paralel, rekonsiliasi; Phase 09: `operations.integration.test.ts` (admin ditolak untuk non-admin/bearer, refund penuh/sebagian/ganda/dashboard/manual tepat sekali, peringatan/ringkasan/pengingat tidak dobel, CSV tanpa data pribadi) | `*.integration.test.ts` dengan env `BILLING_TEST_DATABASE_URL`, pola `cover-letters/service.integration.test.ts`; tambahkan ke `.github/workflows/ci.yml` dan env task di `turbo.json` |
| Replay notifikasi   | Fixture JSON bertanda tangan kunci sandbox palsu → endpoint lokal                                                                                                                                                                                                                                | Fixture di skill `.claude/skills/integrate-midtrans-payments/assets/fixtures/` dan script `scripts/replay_snap_webhook.sh`                                                             |
| Sandbox end-to-end  | Bayar sungguhan di sandbox per metode, notifikasi dari dashboard, refresh halaman, replay, cek status                                                                                                                                                                                            | Phase 06 (tunnel) dan Phase 11 (staging)                                                                                                                                               |
| Browser E2E         | Alur beli dengan stub Midtrans lokal (tanpa jaringan)                                                                                                                                                                                                                                            | `tests/e2e/specs/billing.spec.ts` (Phase 07)                                                                                                                                           |

Tes yang `--passWithNoTests` dan lolos tanpa tes tidak membuktikan apa pun; laporkan jumlah tes yang benar-benar berjalan.
