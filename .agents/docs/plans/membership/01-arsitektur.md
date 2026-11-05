# Arsitektur teknis membership dan pembayaran

Dokumen acuan teknis untuk semua phase. Aturan bisnis (harga, isi paket, kebijakan) ada di [00-keputusan-produk.md](00-keputusan-produk.md); dokumen ini menjelaskan cara membangunnya.

Jika kode, script, atau konfigurasi berbeda dengan dokumen ini, ikuti kode dan konfigurasi (aturan `CLAUDE.md`), lalu catat perbedaannya di laporan phase dan perbarui bagian yang relevan di sini. **Sejak 2026-11-05 pembayaran memakai Polar** ([phase-12-polar.md](phase-12-polar.md)); fakta Polar diverifikasi ulang lewat MCP docs Polar (`search_docs`/`read_docs_page`) atau `https://polar.sh/docs/llms.txt` setiap kali menyentuh kode pembayaran; dokumen resmi menang atas dokumen ini. Bagian yang masih menyebut Midtrans adalah sejarah Phase 06–09.

## 1. Gambaran besar

```text
Web (apps/web) / Mobile (apps/mobile)
   │  oRPC  billing.*   (cookie sesi web, atau OAuth bearer milik app resmi)
   ▼
packages/api/src/features/billing   ← hak akses, batas, kredit, checkout, langganan, admin
   │                         │
   │ Drizzle (Hyperdrive)    │ @polar-sh/sdk (API 2026-10, fetch, Organization Access Token)
   ▼                         ▼
PostgreSQL               Polar: checkout session, order, subscription, refund, customer portal
   ▲                         │
   │                         │ Webhook (Standard Webhooks, POST dari Polar, ±10× ulang)
   │                         ▼
   └──────── apps/server/src/http/polar.ts → webhook.ts: verifikasi tanda tangan → fulfillment.ts

Cron Worker tiap menit (scheduled) → runBillingJobs(): rekonsiliasi checkout dan langganan,
refund menunggu, kredit bulanan langganan tahunan, langganan akun terhapus, reservasi kredit macet,
email peringatan/ringkasan/pengingat
```

Prinsip yang tidak boleh dilanggar:

1. **Server adalah satu-satunya sumber kebenaran hak akses.** Redirect "sukses" dari browser hanya petunjuk tampilan. Hak akses hanya dari webhook bertanda tangan atau jawaban API Polar yang diminta server.
2. **Semua perubahan billing milik satu pengguna diserialkan** dengan mengunci baris `billing_account` (`SELECT … FOR UPDATE`) di dalam satu transaksi database.
3. **Idempoten dan monoton.** Webhook yang sama (`webhook-id` sama) hanya diproses sekali; state langganan yang lebih tua (`modified_at`) tidak menimpa yang lebih baru, karena Polar tidak menjamin urutan; status "sudah dibayar" tidak pernah mundur.
4. **Database adalah buku catatan, bukan log.** Setiap webhook dan pengecekan yang mengubah sesuatu tercatat di `billing_payment_event`; tindakan di `billing_audit_log`.
5. **Semua di balik `BILLING_MODE`** (default `off`). Merge ke `main` = deploy produksi.
6. **Kunci rahasia hanya di server.** `POLAR_ACCESS_TOKEN` dan `POLAR_WEBHOOK_SECRET` tidak pernah dikirim ke klien, ditulis di log, dokumen, atau chat.
7. **Polar adalah penjual (Merchant of Record).** Polar menagih, menghitung dan menyetor pajak, mengirim invoice/receipt dan email langganan, serta menangani sengketa. Rezumi tidak mengirim bukti bayar sendiri.

## 2. Peta lokasi kode

| Kebutuhan                                 | Lokasi                                                                                                                                                                                                                                                                                          | Catatan                                                                                                                    |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Katalog paket, harga, kuota, bobot kredit | `packages/schema/src/billing/` diekspor sebagai `@rezumi/schema/billing` (tambah subpath eksplisit di `packages/schema/package.json`)                                                                                                                                                           | Dipakai server, web (homepage + settings), dan mobile. Murni data + tipe, tanpa DB/HTTP.                                   |
| Tabel database                            | `packages/db/src/schema/billing.ts`, diekspor dari `packages/db/src/schema/index.ts`; migrasi via `pnpm db:generate`                                                                                                                                                                            | Konvensi: id `text` dengan `generateId()` (UUIDv7), `timestamp(..., { withTimezone: true })`, nama kolom snake_case        |
| Logika bisnis + router oRPC               | `packages/api/src/features/billing/`, didaftarkan di `packages/api/src/routers/index.ts` sebagai `billing`                                                                                                                                                                                      | Pakai `protectedProcedure` dan pola router di `features/custom-domain/router.ts`                                           |
| Endpoint webhook Polar                    | `apps/server/src/http/polar.ts`, dipasang di `apps/server/src/http/app.ts` (`POST /api/payments/polar/webhook`, ≤256 KB)                                                                                                                                                                        | `/api/*` sudah masuk `run_worker_first` di `wrangler.jsonc`                                                                |
| Job terjadwal                             | `packages/api/src/features/billing/jobs.ts` (`runBillingJobs`), dipanggil dari `scheduled()` di `apps/server/src/cloudflare/index.ts` dan scheduler Node di `apps/server/src/startup/`                                                                                                          | Phase 04: `scheduled()` dan `startup/job-scheduler.ts` (dulu `career-scheduler.ts`) menjalankan billing lalu career        |
| Env                                       | `packages/env/src/server.ts`, `.env.example`, `turbo.json` (`globalPassThroughEnv` + env task tes), `wrangler.jsonc` (`vars`) / `wrangler secret put`                                                                                                                                           | Aturan "New env var" di `CLAUDE.md`                                                                                        |
| UI web                                    | `apps/web/src/features/billing/`, rute `apps/web/src/routes/dashboard/settings/billing/` (`index.tsx` dengan `?plan=`, `return.{-$paymentId}.tsx`, `receipt.$paymentId.tsx`), entri menu di `apps/web/src/features/settings/root.tsx`                                                           | Homepage `apps/web/src/features/homepage/plans.ts` pindah membaca katalog bersama. Phase 07: lihat 6.1–6.2                 |
| UI mobile                                 | `apps/mobile/src/features/billing/` (termasuk helper visibilitas per platform), layar `apps/mobile/app/(tabs)/settings/membership.tsx`                                                                                                                                                          | Tanpa pembelian di app. Android: status paket/kredit; iOS: tanpa UI billing sampai IAP (`00-keputusan-produk.md` bagian 6) |
| Email bukti bayar / pengingat             | `packages/email/src/templates/`                                                                                                                                                                                                                                                                 | Pola template React Email yang sudah ada                                                                                   |
| Admin internal                            | `packages/api/src/features/billing/admin.ts` + rute web `apps/web/src/routes/dashboard/admin/` (Phase 09: `billing/index.tsx`, `billing/$userId.tsx`; UI di `apps/web/src/features/billing/admin/`)                                                                                             | Hanya `user.role === "admin"`, hanya sesi web. Alat internal, bukan fitur pengguna, jadi tidak perlu versi mobile          |
| Runbook pemilik                           | `.agents/docs/plans/membership/runbook-pemilik.md` (dibuat Phase 09)                                                                                                                                                                                                                            | Bahasa awam                                                                                                                |
| Benchmark biaya/kualitas Rezumi AI        | `tooling/benchmark/` (Phase 10, dev-only): `pnpm benchmark:ai` menjalankan ±96 tugas fiktif lewat prosedur produksi ke server lokal, `pnpm benchmark:ai:report` menulis tabel P50/P95, simulasi 100 kredit, dan lembar penilaian buta; hasil mentah di `tooling/benchmark/results/` (di-ignore) |

Gunakan graph `codebase-memory-mcp` (`search_graph` → `trace_path`) untuk menemukan pemanggil sebelum mengubah fungsi bersama, lalu konfirmasi dengan membaca source.

Isi `packages/api/src/features/billing/` setelah Phase 12 (Polar):

| Berkas                                                                                         | Isi                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `account.ts`                                                                                   | `Transaction`, `lockBillingAccount(tx, userId)` (4.1)                                                                                                                                                                          |
| `timeline.ts`, `periods.ts`                                                                    | Antrean masa aktif untuk **pemberian admin/promo dan pass lama** (6.6); langganan tidak memakainya                                                                                                                             |
| `entitlements.ts`                                                                              | `resolveEntitlements(periods, now, subscriptions)`: peringkat tertinggi dari masa aktif yang diberikan dan langganan (6.7); `source`, `renews`                                                                                 |
| `subscriptions.ts`                                                                             | `upsertSubscription` (monoton per `provider_modified_at`, `paid_through` hanya maju), `getCurrentSubscription`, `liveSubscriptions`, `LIVE_SUBSCRIPTION_STATUSES`                                                              |
| `polar/config.ts`                                                                              | `getPolarConfig()` (null tanpa token), `productFor`, `planForProduct`                                                                                                                                                          |
| `polar/client.ts`                                                                              | `polarApi(config)` (`createPolar` dari `@polar-sh/sdk/2026-10`, timeout 10 dtk), `polarErrorCode`, `polarStatus`, `isTransientPolarError`, `polarErrorDetail`                                                                  |
| `polar/mapping.ts`                                                                             | Fungsi murni: status order/checkout → status pembayaran, `nextPaymentStatus`, `orderPeriod`, `subscriptionAccess` (+`RENEWAL_GRACE_MS` 6 jam), `creditMonth`, `addMonths`, `safeObjectFields`                                  |
| `fulfillment.ts`                                                                               | **Satu pintu** semua perubahan dari Polar: `applyPolarOrder`, `applyPolarSubscription`, `applyPolarCheckout`, `applyPolarRefund` (transaksi + kunci akun + klaim `webhook-id` + catat event)                                   |
| `webhook.ts`                                                                                   | `handlePolarWebhook(request)`: `webhooks.validateEvent`, 403/202/400/503/200 (6.3); diekspor `@rezumi/api/features/billing/webhook`                                                                                            |
| `checkout.ts`                                                                                  | `purchaseBlocker`, `checkout`, `changePlan`, `setSubscriptionCancellation`, `openBillingPortal`, `getInvoice`, `getPayment`, `listPayments`, `getPendingPayment`, `currencyOf`, `publicIp`                                     |
| `reconcile.ts`                                                                                 | `syncPaymentStatus`, `syncPaymentWithPolar`, `reconcilePayments`, `applyRecentOrders`, `reconcileSubscriptions`, `grantYearlyCredits`, `endDeletedAccountSubscriptions`                                                        |
| `deletion.ts`                                                                                  | `endBillingForDeletedUser`, `deletePolarCustomer` (anonimkan customer Polar saat akun dihapus); diekspor `@rezumi/api/features/billing/deletion`                                                                               |
| `refunds.ts`                                                                                   | `requestRefund` (Polar, jumlah sebelum pajak, opsi hentikan langganan), `reconcileRefunds`, `REFUND_REASONS`                                                                                                                   |
| `credits.ts`                                                                                   | Ledger kredit (6.9) + `grantSubscriptionMonth` (unik per langganan per bulan, satu bulan kredit pada satu waktu)                                                                                                               |
| `alerts.ts`, `notifications.ts`, `reports.ts`, `export.ts`, `admin.ts`, `jobs.ts`, `router.ts` | Operasional (6.11), laporan per mata uang + MRR, ekspor data akun dengan langganan, admin, job, prosedur                                                                                                                       |
| `*.test.ts`                                                                                    | Unit `polar/mapping`, `entitlements`, dll.; `polar.integration.test.ts` (webhook bertanda tangan, duplikat, urutan acak, perpanjangan, upgrade, past_due, refund, job tahunan, hapus akun) memakai `BILLING_TEST_DATABASE_URL` |

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
  brandLogos: boolean; // logo tools di Keahlian (design.icons.logos); ikon lain gratis
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

Semua tabel di `packages/db/src/schema/billing.ts`. Tabel dibuat pada phase yang pertama kali memakainya (kolom "Phase"). Setelah `pnpm db:generate`, baca SQL migrasi yang dihasilkan sebelum di-commit. **Jangan mengganti nama folder migrasi** setelah dibuat: server dev (`tsx watch`) bisa langsung menerapkannya ke DB lokal, dan Drizzle mencatatnya per nama folder, sehingga nama baru dianggap migrasi baru dan gagal "relation already exists". Migrasi Phase 01: `migrations/20261102033349_thin_wilson_fisk`; Phase 04: `migrations/20261102055558_panoramic_shen`; Phase 06: `migrations/20261102090943_big_lake`; Phase 09: `migrations/20261103022740_bumpy_paladin` (`billing_refund`, `billing_notification`, `billing_account.locale`); Phase 12 (Polar): `migrations/20261105025732_bizarre_warhawk` (buang kolom Midtrans) dan `migrations/20261105025815_melted_deathbird` (`billing_subscription`, kolom Polar, `ai_credit_grant.subscription_id`). drizzle-kit 1.0 rc bertanya "rename atau create" bila satu tabel kehilangan dan mendapat kolom sekaligus: jalankan `drizzle-kit generate --hints '<json>'` (lihat pesannya) atau pisahkan menjadi dua migrasi.

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

### 4.3 `billing_subscription` (Phase 12)

Cermin satu langganan Polar. Diisi dari webhook `subscription.*`, salinan langganan di dalam setiap order, dan jawaban API (`changePlan`, rekonsiliasi).

| Kolom                                                                      | Tipe          | Catatan                                                                                                                           |
| -------------------------------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                                                       | text PK       | `generateId()`                                                                                                                    |
| `user_id`                                                                  | text ∅        | FK `user.id` `ON DELETE SET NULL`: catatan tetap ada setelah akun dihapus                                                         |
| `external_customer_id`                                                     | text          | User id Rezumi yang dikirim sebagai `external_customer_id`; tetap ada setelah akun dihapus agar job bisa menghapus customer Polar |
| `provider_subscription_id`                                                 | text unik     | Id langganan Polar                                                                                                                |
| `provider_customer_id`, `provider_product_id`                              | text          | Customer dan produk Polar saat ini                                                                                                |
| `plan_id`, `interval`                                                      | text          | Dari produk (`POLAR_PRODUCT_*`); `CHECK interval IN ('month','year')`                                                             |
| `status`                                                                   | text          | Status Polar apa adanya (`incomplete`, `incomplete_expired`, `trialing`, `active`, `past_due`, `canceled`, `unpaid`, `paused`)    |
| `amount`, `currency`                                                       | int, text     | Harga berulang sebelum pajak/diskon, unit terkecil                                                                                |
| `current_period_start`, `current_period_end`                               | timestamptz   | Periode berjalan menurut Polar                                                                                                    |
| `paid_through`                                                             | timestamptz ∅ | Akhir periode terakhir yang **lunas** (dari order); hanya maju                                                                    |
| `cancel_at_period_end`, `canceled_at`, `started_at`, `ends_at`, `ended_at` |               | Dari Polar                                                                                                                        |
| `pending_product_id`                                                       | text ∅        | Downgrade terjadwal (`pending_update.product_id`); hanya diisi dari objek Subscription penuh                                      |
| `provider_modified_at`                                                     | timestamptz   | `modified_at` (atau `created_at`) state terbaru yang diterapkan; state lebih tua dilewati                                         |
| `last_checked_at`, `revoked_for_deletion_at`                               | timestamptz ∅ | Rekonsiliasi; langganan akun terhapus yang sudah diakhiri                                                                         |

Hak akses (`subscriptionAccess`): `active` sampai `current_period_end` (+6 jam selama kabar perpanjangan belum tiba), `trialing` sampai `current_period_end`, `past_due` hanya sampai `paid_through`, status lain tidak memberi akses; `ended_at` selalu memotong.

### 4.4 `billing_payment`

Satu baris = satu checkout yang dibuka Rezumi (sampai dibayar) **atau** satu order Polar. Perpanjangan dan ganti paket adalah order tanpa checkout → baris baru. Baris sebelum Polar (pass 30 hari Midtrans) tetap ada dengan `provider = midtrans`.

| Kolom                                                         | Catatan                                                                                                                                 |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `provider`                                                    | `polar` (default) atau `midtrans` (lama)                                                                                                |
| `provider_checkout_id` (unik ∅), `provider_order_id` (unik ∅) | Checkout session dan order Polar                                                                                                        |
| `idempotency_key`                                             | Kunci klik; unik per `(user_id, idempotency_key)`; baris tanpa kunci = order yang datang dari Polar (perpanjangan)                      |
| `subscription_id`                                             | FK `billing_subscription.id` `SET NULL`                                                                                                 |
| `plan_id`, `interval`, `catalog_version`, `billing_reason`    | Salinan katalog; `billing_reason` dari order (`subscription_create`, `subscription_cycle`, `subscription_update`, …)                    |
| `amount`, `tax_amount`, `total_amount`, `currency`            | `amount` = `net_amount` Polar (setelah diskon, **sebelum pajak**; boleh 0 untuk kode diskon 100%), unit terkecil; mata uang huruf kecil |
| `credits`                                                     | Kredit yang diberikan order itu                                                                                                         |
| `status`, `provider_status`                                   | 5.1                                                                                                                                     |
| `redirect_url`, `expires_at`                                  | Halaman checkout dan batasnya (hanya untuk sesi web, selama belum ada order)                                                            |
| `period_start`, `period_end`                                  | Periode yang dibayar order (dari `items[].start/end_timestamp`)                                                                         |
| `paid_at`, `fulfilled_at`                                     | `fulfilled_at` = penjaga "tepat sekali"                                                                                                 |
| `refunded_amount`                                             | Sebelum pajak; tidak pernah turun; `CHECK 0 ≤ refunded ≤ amount`                                                                        |
| `last_checked_at`, `check_attempts`, `failure_reason`         | Rekonsiliasi                                                                                                                            |

### 4.4a `billing_payment_event`

Setiap webhook dan setiap pengecekan yang mengubah sesuatu. `webhook_id` (header `webhook-id`) **unik**: event diklaim di awal transaksi yang sama dengan perubahannya, jadi pengiriman ulang dikenali dan dilewati; transaksi yang gagal ikut membatalkan klaimnya. Kolom: `payment_id`, `subscription_id`, `webhook_id`, `event_type` (`order.paid`, `status_check`, …), `provider_object_id`, `source` (`webhook`, `status_check`, `admin`), `outcome` (`applied`, `duplicate`, `stale`, `ignored`, `unknown_product`, `unknown_customer`, `error`), `payload` (allowlist `safeObjectFields`: id, status, jumlah, mata uang, produk, periode; tanpa nama/email/alamat). Event gagal yang dijawab 200 menyimpan `webhook_id` hanya di `payload`, supaya bisa dikirim ulang dari dashboard Polar setelah perbaikan.

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

| Kolom            | Tipe        | Catatan                                                                                                                                                                                                             |
| ---------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`             | text PK     |                                                                                                                                                                                                                     |
| `actor_user_id`  | text ∅      | Admin pelaku; kosong = sistem. FK `ON DELETE SET NULL`                                                                                                                                                              |
| `target_user_id` | text ∅      | FK `ON DELETE SET NULL`                                                                                                                                                                                             |
| `action`         | text        | `period.granted`, `period.revoked`, `credits.adjusted`, `payment.fulfilled`, `payment.refund_recorded`, `payment.synced`, `subscription.changed` (status, paket, periode tagihan, batal/lanjut, ganti terjadwal), … |
| `reason`         | text ∅      | **Wajib** untuk tindakan admin                                                                                                                                                                                      |
| `details`        | jsonb       | Data ringkas, tanpa isi CV atau PII yang tidak perlu                                                                                                                                                                |
| `created_at`     | timestamptz | index `(target_user_id, created_at)`                                                                                                                                                                                |

### 4.7a `billing_refund`

Satu baris = satu refund. `method`: `polar` (baru), `midtrans`/`manual` (lama). `refund_key` = id refund Polar; sebelum Polar menjawab, kunci Rezumi `RF-<payment id>-<n>`, dan id baris dikirim di `metadata.rezumi_refund_id` supaya webhook menemukannya. Status: `requesting` (Polar `pending`), `succeeded`, `failed` (Polar `failed`/`canceled`, atau tidak pernah sampai ke Polar setelah 1 jam: `refund_not_found`). `amount` sebelum pajak. Refund dari dashboard Polar atau oleh Polar sendiri (`dispute_prevention`) ditambahkan dari webhook.

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

| Status                           | Arti                                                                                       | Dari Polar                   |
| -------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------- |
| `creating`                       | Baris di-commit, checkout Polar sedang dibuat                                              | —                            |
| `pending`                        | Checkout terbuka (`open`/`confirmed`/`succeeded` tanpa order) atau order `draft`/`pending` |                              |
| `paid`                           | Order `paid`                                                                               | `order.paid`                 |
| `failed`                         | Checkout `failed`, atau checkout tidak pernah dibuat (`checkout_not_created`)              |                              |
| `expired`                        | Checkout `expired` (atau masih `open` 30 menit lewat `expires_at`)                         | `checkout.expired`           |
| `cancelled`                      | Order `void`                                                                               |                              |
| `partially_refunded`, `refunded` | Refund sebagian/penuh                                                                      | `refund.*`, `order.refunded` |
| `reversed`                       | Hanya baris Midtrans lama                                                                  | —                            |

Transisi (`nextPaymentStatus`): apa pun boleh menjadi `paid`; `paid` tidak mundur ke `pending`/`failed`/`expired`; dari `partially_refunded` tidak kembali ke `paid`; `refunded`/`reversed` adalah akhir. Fulfillment (kredit, `paid_through`) tepat sekali saat pertama kali `paid`/`partially_refunded` dan `fulfilled_at` kosong.

### 5.2 Status `ai_credit_usage.status`

`reserved` → `committed` (hasil berhasil disimpan/dikirim) atau `released` (gagal, dibatalkan sebelum ada hasil, atau macet > 15 menit). Tidak ada transisi lain.

## 6. Alur utama

### 6.1 Checkout dan ganti paket (web)

1. `billing.checkout({ planId, interval, idempotencyKey })`. Ditolak bila: `BILLING_MODE` tidak berlaku, Polar tidak dikonfigurasi, `BILLING_CHECKOUT_PAUSED`, bukan sesi web, tamu, email belum terverifikasi, atau **sudah punya langganan hidup** (`CONFLICT` → pakai `changePlan`).
2. Mata uang: `currencyForCountry(CF-IPCountry)` → `idr` untuk Indonesia, `usd` lainnya. IP pelanggan (`trustedClient`, hanya IP publik) dikirim sebagai `customer_ip_address` untuk lokasi pajak.
3. Transaksi #1: kunci akun; kunci klik sama → pembayaran sama; checkout `pending` yang masih terbuka ≥10 menit untuk paket+interval+mata uang sama → dipakai ulang; else insert `creating` dengan harga katalog. **Commit sebelum memanggil Polar.**
4. `checkouts.create({ products: [produk], external_customer_id: userId, customer_email, customer_name, customer_ip_address, currency, locale, success_url: APP_URL/dashboard/settings/billing/return/<paymentId>?checkout_id={CHECKOUT_ID}, return_url, allow_discount_codes: true, allow_trial: false, metadata: { rezumi_payment_id } })`. Berhasil → simpan `provider_checkout_id`, `redirect_url`, `expires_at`, status `pending`. Gagal → `failed` (`checkout_create_http_<kode>`), peringatan `provider_errors`, `BAD_GATEWAY`.
5. Web mengarahkan browser ke `redirect_url` (checkout hosted Polar; tanpa embed, tanpa perubahan CSP).
6. **Ganti paket** `billing.changePlan({ planId, interval })` → `subscriptions.update`: naik (peringkat lebih tinggi, atau bulanan→tahunan) `proration_behavior: invoice` (selisih ditagih sekarang ke kartu tersimpan; gagal → `PAYMENT_FAILED`); turun `next_period` (berlaku saat perpanjangan, `pending_product_id`). Ditolak bila `past_due` atau dijadwalkan berhenti (lanjutkan dulu). Jawaban API langsung diterapkan lewat `applyPolarSubscription`; saat naik, order selisih (Polar membuatnya bersama perubahan) langsung dibaca lewat `applyRecentOrders` dan diterapkan, jadi pembayaran dan kredit muncul seketika tanpa menunggu webhook (uji sandbox 2026-11-05: order dibuat saat itu juga, kadang masih `pending` lalu dilunasi job).
7. **Batal/lanjutkan** `billing.cancelSubscription({ reason?, comment? })` → `cancel_at_period_end: true` (+alasan enum Polar); `billing.resumeSubscription` → `false`.
8. **Portal** `billing.portal` → `customerSessions.create({ external_customer_id, return_url })` → `customer_portal_url` (per klik; kartu, invoice, data tagihan, batal). Disarankan mematikan "plan changes" di pengaturan portal agar ganti paket lewat Rezumi.
9. **Invoice** `billing.invoice({ id })` → `orders.invoice`; 404 → `orders.generateInvoice` lalu `generating` (web mencoba lagi 3 detik kemudian); lainnya `unavailable` → portal.

### 6.2 Halaman kembali

`success_url` → `/dashboard/settings/billing/return/<paymentId>?checkout_id=…`. Halaman memanggil `billing.payment({ id })` tiap 3 detik (maks. 2 menit) selama `pending`/`creating`; `billing.payment` memicu `syncPaymentStatus` (maks. tiap 10 detik): `checkouts.get` → bila `succeeded`/`confirmed`, `orders.list({ checkout_id })` → `applyPolarOrder`. Keadaan: diterima (paket aktif, tanggal perpanjangan, kredit, tombol Invoice), menunggu (Lanjutkan checkout), waktu habis, gagal, kedaluwarsa, di-refund, tidak ditemukan. Polar juga menambahkan `customer_session_token` (sesi portal pelanggan) ke query; rute langsung menghapus seluruh query dari alamat dan riwayat browser (redirect `replace`). Riwayat pembayaran pelanggan (`listPayments`) tidak menampilkan percobaan yang tidak pernah dijawab Polar (tanpa checkout dan order); halaman admin tetap menampilkannya.

### 6.3 Webhook Polar

`POST /api/payments/polar/webhook` (≤256 KB; raw body). Endpoint di dashboard Polar memakai format `raw`, versi API **2026-10**, event: `order.created/updated/paid/refunded`, `subscription.*`, `checkout.created/updated/expired`, `refund.created/updated`.

1. Tanpa `POLAR_WEBHOOK_SECRET` → 404.
2. `webhooks.validateEvent(rawBody, headers, secret)` (Web Crypto; toleransi waktu 5 menit; secret `whsec_…` baru maupun lama). Tanda tangan salah → **403** + peringatan `rejected_signatures` (≥5/jam). Tipe yang belum dikenal SDK → **202**. JSON rusak → 400.
3. Dispatch: order → `applyPolarOrder`; subscription → `applyPolarSubscription`; checkout → `applyPolarCheckout`; refund → `applyPolarRefund` (bila ordernya belum dikenal: `orders.get` → terapkan order → refund).
4. Setiap fungsi: transaksi + kunci akun (dari `customer.external_id` atau baris checkout) + klaim `webhook_id` (sudah ada → `duplicate`, 200) + perubahan + catat event.
5. Gagal sementara (Polar/DB tidak tersedia, kunci, timeout) → **503** (Polar mengulang ±10×). Gagal lain → event `error` + peringatan `needs_review` + **200**, supaya satu event rusak tidak membuat endpoint dinonaktifkan Polar (10 gagal berturut-turut); job dan tombol admin "Cek ulang status" menyusul.
6. Produk di luar empat produk Rezumi → `unknown_product`, diabaikan. Order lunas untuk akun yang sudah dihapus → peringatan `paid_not_applied` (sekali).

### 6.4 Rekonsiliasi terjadwal (`runBillingJobs`)

- `reconcilePayments`: maks. 20 pembayaran `creating`/`pending` (Polar) berumur 2 menit–3 hari, backoff 2/5/15/30/60 menit lalu 6 jam, `FOR UPDATE SKIP LOCKED`; per baris: order → `orders.get`; checkout → `checkouts.get` (+ `orders.list`), checkout masih `open` 30 menit lewat batas → `expired`; tanpa checkout >2 menit → `failed` (`checkout_not_created`).
- `reconcileSubscriptions` (cek maks. tiap jam per langganan): langganan hidup yang `current_period_end`-nya lewat >30 menit tanpa kabar, dan langganan Pro AI bulanan yang lunas sampai sekarang tetapi belum punya kredit yang berlaku (order ganti paket yang webhooknya hilang): 3 order terbaru (`applyRecentOrders`) + `subscriptions.get`.
- `reconcileRefunds`: refund `requesting` >2 menit → `refunds.list({ order_id })`; tidak ada di Polar >1 jam → `failed` + peringatan.
- `grantYearlyCredits`: langganan Pro AI tahunan yang lunas → 100 kredit untuk bulan yang sedang berjalan (unik per langganan per bulan; dilewati selama kredit bulan sebelumnya dari langganan yang sama masih berlaku, mis. pindah bulanan→tahunan di tengah bulan).
- `endDeletedAccountSubscriptions`: langganan hidup tanpa `user_id` → `customers.deleteExternal(anonymize)` + `subscriptions.revoke`.
- Lalu reservasi kredit macet, sapuan masalah, ringkasan harian, pengingat (hanya masa aktif yang diberikan), kirim email. Setiap tugas terisolasi; aman berjalan ganda.

### 6.5 Fulfillment (satu transaksi)

`applyPolarOrder`: kunci akun → klaim event → upsert langganan dari salinan di order (+`paid_through` bila lunas) → cari pembayaran (order id, lalu checkout id) atau buat baris baru → transisi status → bila pertama kali lunas: kredit Pro AI untuk bulan berjalan (`grantSubscriptionMonth`, kedaluwarsa di akhir bulan itu; tidak ada rollover; satu bulan kredit pada satu waktu: tidak diberikan selama grant langganan itu yang belum dicabut masih berlaku melewati awal bulan baru), `paid_at`, `fulfilled_at`, audit `payment.fulfilled` → refund bertambah: refund penuh (atau admin meminta) mencabut kredit order itu. Akses mengikuti langganan; refund saja tidak mengakhirinya (admin bisa memilih "hentikan langganan juga", Polar sendiri membatalkan langganan saat me-refund untuk mencegah sengketa).

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

**Font sendiri** (dibuat 3 November, lanjutan Phase 03):

- Data: `metadata.typography.customFonts` (`@rezumi/schema/resume/data`, opsional, maks 24 face) = `{ family, weight, italic, url }` per file. `fontFamily` body/heading boleh menyebut keluarga itu. Surat yang mengikuti desain CV ikut membawanya.
- Unggah: `storage.uploadFont` (oRPC, web) dan REST `POST /fonts` (app mobile) memanggil `assertFeature(userId, "customFonts")`, lalu `uploadFontFile`: hanya TTF/OTF tunggal ≤ 8 MB, dibaca dari byte-nya sendiri oleh `readFontFile` (`@rezumi/fonts/uploaded`: nama keluarga, ketebalan, miring; WOFF/WOFF2/TTC dan font ber-`fsType` "restricted licence" ditolak, `data.problem` untuk pesan per bahasa). Disimpan di `uploads/{userId}/fonts/{uuid}.{ttf|otf}` dan dilayani publik seperti foto (`font/ttf`/`font/otf`, pemilik tidak diblokir) supaya tautan publik bisa menggambar CV.
- Penegakan saat simpan: `designFeaturesNeeded` meminta `customFonts` hanya bila ada URL face **baru**; `assertDesignChange` juga menolak face baru yang bukan unggahan akun itu sendiri di `APP_URL` (`BAD_REQUEST`, berlaku walau billing `off`). Dicek di update/patch CV dan update desain surat (`input.metadata`). Impor (`fitImportedDesign`) membuang face milik akun lain, dan semua face bila paket tidak memuat fiturnya (`changed.fonts`; web/mobile menjelaskannya lewat `describeImportedDesign`). Mempertahankan dan menghapus font selalu boleh; salinan dan restore versi tidak dicek.
- Render: `resolvePdfFonts` hanya memakai face dengan URL unggahan yang sah (`parseUploadedFontUrl`), keluarga unggahan menang atas katalog bernama sama, ketebalan terdekat dipakai, Bold asli lewat `resolveTypographyBoldWeight`. Browser dan app mengunduh URL publiknya; server (`createResumePdfFile`, kartu tautan) membaca storage langsung lewat `readUploadedFont` dan **tidak pernah** mengambil alamat font dari dokumen lewat HTTP (anti-SSRF).
- UI: Advanced → Typography → "Font kamu" (web `features/resume/editor/design/uploaded-fonts.tsx`, mobile `features/design/uploaded-fonts.tsx`): daftar keluarga + Hapus, tombol Unggah font (terkunci + dialog paket di web/Android; disembunyikan di iOS bila paket tidak memuatnya), keluarga unggahan muncul paling atas di pemilih font. File di storage tidak dihapus saat font dilepas dari CV (CV lain/salinan bisa masih memakainya).

**Logo tools** (dibuat 4 November, Phase 05 revamp template CV, `BILLING_CATALOG_VERSION` 3):

- Data: `metadata.design.icons.logos` (default `false`). Gaya ikon, grup ikon lain, dan logo profil tetap gratis.
- Penegakan saat simpan: `designFeaturesNeeded` meminta `brandLogos` hanya bila `logos` berubah ke `true` (sebelumnya `false`/kosong). Menyimpan CV yang sudah menyalakannya, mematikannya, salinan, dan restore versi tidak dicek. Impor tanpa fitur → `fitImportedDesign` mematikan `logos` (`changed.logos`); web dan mobile memberi tahu lewat `describeImportedDesign`.
- UI: Design → Ikon → "Logo tools di Keahlian" (web `features/resume/editor/design/style-groups.tsx`, mobile `features/design/style-groups.tsx`). Tanpa fitur dan saat masih mati: web dan Android menampilkan saklar dengan gembok + label "Plus" yang membuka dialog/alert paket; iOS menyembunyikan barisnya. Bila sudah menyala, saklar tetap bisa dimatikan di semua platform.

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

**Batas kerja** (`AI_WORK_LIMITS`, dikalibrasi Phase 10 pada 2026-11-03, laporan `.agents/docs/research/benchmark-rezumi-ai-2026-11-03.md`): `maxOutputTokens` per panggilan (dipotong ke nilai terkecil; **termasuk token berpikir model**), `maxInputChars` per panggilan (teks dalam karakter, file dalam byte; lewat → `AI_INPUT_TOO_LARGE` 413 sebelum provider dipanggil, kredit kembali), `maxSteps` agent. Panggilan yang berhenti karena batas output (`finishReason` `length`) menggagalkan pekerjaan: `generateText` melempar `AI_OUTPUT_LIMIT`, stream mendapat part `error` dengan kode itu sebelum `finish`; kredit kembali, token tetap dicatat. Batas peluncuran (¼–½ dari tabel ini) memotong surat, review, dan balasan Coach di benchmark, sebagian sebelum ada teks sama sekali, dan kreditnya tetap terpotong.

| `actionKey`                          |      Output token |            Input |                                     Langkah |
| ------------------------------------ | ----------------: | ---------------: | ------------------------------------------: |
| `short-text`, `draft-answer`         |             4.096 | 60.000 / 120.000 |                                           1 |
| `cover-letter`, `interview-practice` |             8.192 |          120.000 |                                           1 |
| `review`                             |            16.384 |          150.000 |                                           1 |
| `tailor-resume`                      |             4.096 |          150.000 |                                           1 |
| `coach-turn`                         | 8.192 per langkah |          240.000 | 8 (BYOK 30), tanpa `search_web`/`read_page` |
| `import-document`                    |            32.768 |        6.000.000 |                                           1 |

Biaya dihitung dengan satu tarif (`AI_COST_*`). Claude Haiku 5.5 menagih 5× untuk prompt di atas 100.000 token; di benchmark prompt tunggal terbesar 54.059 token (giliran Coach dengan CV panjang), jadi tarif datar cukup. Risiko tersisa: PDF berhalaman sangat banyak (±3.000 token per halaman); lihat laporan benchmark.

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

### 6.11 Operasional

- **Refund** (`requestRefund`): transaksi #1 kunci akun + baris pembayaran, tolak bila ada refund `requesting` atau nominal > sisa (sebelum pajak), insert `requesting` + audit → commit → `refunds.create({ order_id, reason (enum), amount, comment, metadata: { rezumi_refund_id } })` → `applyPolarRefund`. Tanpa jawaban → tetap `requesting` (job menanyakan). Penolakan pasti → `failed` + peringatan `refund_failed`. Opsi `endSubscription` → `subscriptions.revoke`. Polar tidak mengembalikan fee-nya; Polar boleh me-refund sendiri ≤60 hari untuk mencegah sengketa (peringatan `payment_reversed`).
- **Peringatan** (`BILLING_ALERT_KINDS`): `paid_not_applied`, `payment_reversed`, `needs_review`, `rejected_signatures` (ambang 5), `provider_errors` (ambang 3), `refund_failed`.
- **Laporan** (`reports.ts`): uang **per mata uang** (`Money`), sebelum pajak dan fee; penjualan per paket/interval/jenis (baru, perpanjangan, ganti paket); refund; bersih; langganan aktif/akan berhenti/gagal bayar, mulai/berakhir, MRR (tahunan dibagi 12); grafik harian berupa jumlah; CSV per order dan refund (`order_polar`, `mata_uang`, `jumlah_sebelum_pajak`, `pajak`, `total_dibayar`). Payout dan fee ada di dashboard Polar.
- **Email**: bukti bayar, perpanjangan, kartu gagal, pembatalan dikirim **Polar**. Rezumi hanya mengirim peringatan/ringkasan ke pemilik dan pengingat H-3 untuk masa aktif yang diberikan admin/promo (dilewati bila langganan berlanjut melewatinya).
- **Hapus akun**: `endBillingForDeletedUser` (dari `authService.deleteAccount` dan hook hapus Better Auth) memanggil `customers.deleteExternal(userId, { anonymize: true })` bila akun pernah berlangganan; gagal → job.

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

| Env                                                                                  | Isi                                                                         |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `BILLING_MODE`                                                                       | `off` (default), `admins`, `on`                                             |
| `BILLING_CHECKOUT_PAUSED`                                                            | Menutup checkout baru; langganan berjalan tidak terpengaruh                 |
| `BILLING_ALERT_EMAIL`                                                                | Tujuan peringatan dan ringkasan harian                                      |
| `POLAR_ENVIRONMENT`                                                                  | `sandbox` atau `production` (wajib bila ada token)                          |
| `POLAR_ACCESS_TOKEN`                                                                 | Organization Access Token (secret) dari organisasi di environment yang sama |
| `POLAR_WEBHOOK_SECRET`                                                               | Secret endpoint webhook (secret); tanpa ini endpoint 404                    |
| `POLAR_PRODUCT_PLUS_MONTHLY`, `…_PLUS_YEARLY`, `…_PRO_AI_MONTHLY`, `…_PRO_AI_YEARLY` | UUID produk; wajib keempatnya bila ada token, harus berbeda                 |

Startup menolak token tanpa environment, produk yang kurang/duplikat, atau secret tanpa token. Produksi: `pnpm exec wrangler secret put <NAMA>` untuk token dan secret; id produk dan environment boleh juga lewat `wrangler secret put` (bukan rahasia). Semua `POLAR_*` ada di `turbo.json` (`globalPassThroughEnv` + env task tes).

## 9. Keamanan, privasi, dan logging

### 9.1 Siapa boleh melakukan apa

- `billing.checkout` dan `billing.changePaymentMethod`: **hanya sesi web (cookie)**. Tolak OAuth bearer (termasuk app mobile resmi — pembelian di app dilarang oleh keputusan kanal), API key, dan klien MCP. Prosedur baca (`billing.summary`, `billing.payment`, `billing.payments`) boleh dipakai app resmi.
- Membedakan app resmi: app mobile mendaftar sebagai klien OAuth dinamis dengan `client_name` "Rezumi for iOS/Android" dan `redirect_uris` `https://<APP_URL host>/auth/native-callback` (`apps/mobile/src/auth/oauth.ts`). Phase 03 membuat helper `isFirstPartyClient(authentication)` berdasarkan redirect URI terdaftar klien token. Keterbatasan yang diterima: pengguna teknis bisa meniru klien ini untuk akunnya sendiri; dampaknya kecil karena tetap terkena rate limit.
- Implementasi Phase 03 (`billing/automation.ts`): app memakai `https://rezumi.app/auth/native-callback` untuk **semua** server (host tetap di `apps/mobile/src/auth/oauth.ts`), jadi daftar yang diterima = `https://rezumi.app/auth/native-callback`, `https://<host APP_URL>/auth/native-callback`, dan `app.rezumi:/auth/native-callback` (build dev). Klien dianggap resmi bila **semua** redirect URI-nya ada di daftar itu. `RequestAuthentication` membawa `clientId` (`azp` token). `protectedProcedure` memanggil `assertAutomationAccess` setelah cek izin: sesi web selalu lolos, bearer klien resmi lolos (satu query `oauth_client`), selain itu butuh `automationApi`. Endpoint MCP memanggilnya sekali per request dan menjawab 403 JSON-RPC dengan pesan paket. Mode `off` tidak membaca apa pun.
- Admin: `user.role === "admin"` (plugin admin Better Auth sudah aktif), sesi web saja, setiap tindakan wajib alasan dan tercatat di `billing_audit_log`. Phase 01: `assertBillingAdmin` menolak metode selain `session` dan membaca `role` dari database; `billing.admin.grantPeriod({ userId | email, planId, days 1–366, reason })` dan `billing.admin.revokePeriod({ periodId, reason })` (RPC saja, tag `Internal`). Phase 04: `billing.admin.adjustCredits({ userId | email, amount −10.000…10.000 bukan 0, expiresInDays 1–366 wajib bila positif, reason })` → `{ userId, amount, balance, expiresAt }`, audit `credits.adjusted` dengan saldo sebelum/sesudah. Phase 09 menambah UI web dan prosedur `search`, `customer`, `alerts`, `metrics`, `exportPayments`, `syncPayment`, `refund`, `recordManualRefund`, `resendReceipt` (6.11); semuanya `adminProcedure`, tag `Internal`, tidak di allowlist MCP.
- Flag publik `flags.get` → `billing: boolean` (`true` hanya bila `BILLING_MODE = on`); field opsional di tipe `FeatureFlags`, jadi klien lama tidak rusak.
- Rate limit: pakai `accountRateLimit` atau buat limit khusus checkout di `packages/api/src/middleware/rate-limit/index.ts`.

### 9.2 Data yang disimpan dari Polar

Id (order, checkout, langganan, customer, produk, refund), status, jumlah dan mata uang, periode, alasan tagihan. **Tidak** disimpan: nama/email/alamat penagihan pelanggan, data kartu, URL portal. Event menyimpan allowlist `safeObjectFields`. Log tidak memuat payload atau token; galat Polar hanya kode pendek (`checkout_create_http_422`) dan detail validasi dengan email disamarkan.

### 9.3 Data yang dikirim ke Polar

Saat checkout: user id (sebagai `external_customer_id`), email dan nama akun, IP publik (lokasi pajak/mata uang), bahasa, id pembayaran di metadata. Polar sebagai Merchant of Record memproses data pembayaran sebagai pengendali sendiri (kebijakan privasi Polar). Saat akun dihapus, customer Polar dihapus dengan `anonymize: true` (order tetap untuk pembukuan Polar).

## 10. Cloudflare dan infrastruktur

- `/api/*` sudah `run_worker_first`; rute webhook dipasang di app Hono yang sama untuk Workers dan Node.
- **Bot Fight Mode memblokir webhook Polar (403)** dan tidak bisa dikecualikan per path: matikan di zona `rezumi.app`. Super Bot Fight Mode (paket Pro+) boleh dengan aturan Skip untuk `POST /api/payments/polar/webhook`. IP webhook Polar produksi: 3.134.238.10, 3.129.111.220, 52.15.118.168, 3.134.178.243, 74.220.50.0/24, 74.220.58.0/24 (sandbox memakai 18.117.215.101); tidak perlu allowlist.
- `@polar-sh/sdk` berbasis `fetch` + Web Crypto tanpa dependensi, berjalan di Workers (`nodejs_compat` sudah aktif) dan Node.
- Cek setelah deploy: `curl -i -X POST https://rezumi.app/api/payments/polar/webhook -d '{}'` harus mendapat 403 dari aplikasi (tanda tangan salah), bukan halaman tantangan Cloudflare.

## 11. Kontrak error dan app versi lama

| Kode `ORPCError`        | Kapan                                                                                               | `data` yang disertakan                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `PLAN_LIMIT_REACHED`    | Membuat/memulihkan dokumen melewati batas                                                           | `{ limit: "activeResumes" \| "activeCoverLetters", max, used, planId }` |
| `PLAN_FEATURE_REQUIRED` | Memakai fitur yang tidak ada di paket                                                               | `{ feature: keyof PlanFeatures, planId }`                               |
| `INSUFFICIENT_CREDITS`  | Kredit Rezumi AI kurang                                                                             | `{ required, balance }`                                                 |
| `BILLING_UNAVAILABLE`   | Pembelian belum dibuka / Polar belum diset / `BILLING_CHECKOUT_PAUSED` (403)                        | —                                                                       |
| `EMAIL_NOT_VERIFIED`    | Checkout atau kredit coba sebelum verifikasi email                                                  | —                                                                       |
| `AI_SOURCE_REQUIRED`    | Request AI tanpa `aiSource` (app/klien lama) saat satu-satunya pilihan Rezumi AI (409)              | —                                                                       |
| `REZUMI_AI_UNAVAILABLE` | `aiSource: "rezumi"` untuk pekerjaan yang tidak didukung (suara, jadwal) atau server tanpa AI (409) | —                                                                       |
| `AI_INPUT_TOO_LARGE`    | Input melewati `AI_WORK_LIMITS` Rezumi AI (413)                                                     | —                                                                       |
| `AI_OUTPUT_LIMIT`       | Jawaban Rezumi AI berhenti di batas output `AI_WORK_LIMITS`; kredit kembali (502, Phase 10)         | —                                                                       |

- Pesan error harus kalimat yang bisa dipahami pengguna, karena app mobile versi lama belum mengenal kode baru dan hanya menampilkan pesan. Ikuti pola pesan dan lokalisasi yang sudah ada di server (`apps/server/src/rpc/locale.ts` dan pesan `ORPCError` di router lain).
- Pesan error **netral**: tanpa harga, tanpa ajakan membeli, tanpa URL pembayaran, karena tampil juga di app iOS/Android (aturan toko). Web menambahkan tombol upgrade berdasarkan `code`. Pengecualian: pesan untuk klien API/MCP pihak ketiga boleh menyebut halaman Paket di web.
- Gunakan status HTTP 403 untuk tiga kode pertama, kecuali pola repo menunjukkan pilihan lain; konsisten di semua phase.
- Phase 03: pesan server berbahasa Inggris seperti pesan server lain di repo; web dan mobile menampilkan teks Lingui berdasarkan `code` dan `data` (`apps/web/src/features/billing/plan.ts`, `apps/mobile/src/features/billing/plan-alert.ts`). `PLAN_LIMIT_REACHED.data` juga memuat `requested: { resumes, coverLetters }`.
- Endpoint lama tidak boleh mendapat field wajib baru. Endpoint baru bersifat tambahan.
- App lama tidak boleh menjalankan Rezumi AI berbayar tanpa sadar: jalur AI lama yang tidak mengirim pilihan sumber AI diperlakukan sebagai BYOK/default lama, bukan otomatis memotong kredit (rinci di Phase 05).

## 12. Strategi tes

| Jenis               | Isi                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit (fungsi murni) | `polar/mapping` (status, transisi, akses langganan, bulan kredit tahunan), `resolveEntitlements` dengan langganan, katalog (harga per mata uang, tahunan lebih murah), `schedulePurchase` (masa aktif yang diberikan), alokasi kredit                                                                                                                                                                                                                                                                                            |
| Integrasi DB nyata  | `polar.integration.test.ts`: webhook bertanda tangan asli (Standard Webhooks), tanda tangan/timestamp salah 403, tipe baru 202, duplikat `webhook-id`, order pertama → kredit sekali, checkout → order, perpanjangan, upgrade (kredit sekali per bulan), urutan acak, `past_due`, refund penuh, refund sebelum order, 503 lalu ulang, produk asing, rekonsiliasi checkout, kredit tahunan, hapus akun, ganti paket, batal/lanjutkan, portal, refund admin + hentikan langganan; ditambah suite billing/credits/limits/metered-ai |
| Sandbox end-to-end  | Checkout sungguhan di sandbox Polar (kartu uji `4242 4242 4242 4242`), webhook lewat tunnel atau `polar webhook listen`, perpanjangan dengan mengubah `current_billing_period_end`, refund dari admin                                                                                                                                                                                                                                                                                                                            |
| Browser E2E         | `tests/e2e/specs/billing.spec.ts`: prosedur dijawab di browser, checkout Polar distub, halaman kembali menunggu lalu lunas, paket diperpanjang, tombol tagihan dan invoice                                                                                                                                                                                                                                                                                                                                                       |

Tes yang `--passWithNoTests` dan lolos tanpa tes tidak membuktikan apa pun; laporkan jumlah tes yang benar-benar berjalan.
