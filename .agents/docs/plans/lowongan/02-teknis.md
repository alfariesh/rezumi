# Rancangan teknis — cari lowongan

Untuk agent. Path dan nama di sini berasal dari eksplorasi kode 2026-11-20: cek ulang sebelum mengandalkannya. Nomor bagian dirujuk dokumen phase; bagian baru ditambahkan di akhir dan perubahan rancangan dicatat di bagian yang bersangkutan.

## 1. Ringkasan arsitektur

```text
Web (halaman Lowongan, jadwal discovery, dialog lamaran)        MCP search_jobs
        │ oRPC jobs.search / jobs.listing / jobs.track …            │
        ▼                                                           ▼
packages/api/src/features/jobs  ── JobSearchService ─────────────────┘
   1. normalisasi pencarian → kunci cache (sha256)
   2. kuota per pengguna (Coordination DO, "consume")           ── Durable Object (ada)
   3. baca cache  job_search_cache + job_listing                ── Postgres via Hyperdrive (ada)
   4. miss → kunci single-flight per kunci cache (Coordination DO)
   5. JobSource router: Hirebase utama untuk semua negara; JobsPipe menambah bila < 10 hasil atau galat
        └─ TregClient → https://treg.to/call/<tool-id>  (X-Treg-Token, batas biaya, retry 429/503)
   6. normalisasi → upsert job_listing, tulis job_search_cache
   7. event biaya/latensi → Analytics Engine                    ── Analytics Engine (ada)
        ▼
Cron tiap menit (ada) → Queue rezumi-career-jobs (ada) → runner karier
   · discovery terjadwal: lowongan baru sejak cursor terakhir
   · pemeliharaan harian: lowongan tutup, hapus cache kedaluwarsa, hapus lowongan yatim
```

## 2. Layanan Cloudflare

Akun di Workers Paid. Worker dipasang di `gcp:asia-southeast2` (Jakarta), dekat VPS Postgres (lihat `wrangler.jsonc`).

### 2.1 Dipakai

| Layanan                                                      | Status                                    | Untuk apa                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Hyperdrive + Postgres**                                    | Ada (`HYPERDRIVE`)                        | Sumber kebenaran: `job_listing`, `job_search_cache`, relasi ke `career_opportunity` dan `application`. Satu database, bisa join dengan data pengguna, transaksional.                                                                                                                                                                                    |
| **Durable Object `Coordination`**                            | Ada (`COORDINATION`)                      | (a) **Kuota harian** per pengguna: operasi `consume` dengan `window` 24 jam dan `max` dari paket. (b) **Single-flight** per kunci cache: `consume` dengan `max: 1`, `window: 30 s` sebagai kunci; yang kalah menunggu cache terisi. Tidak perlu class DO baru.                                                                                          |
| **Queues `rezumi-career-jobs`**                              | Ada (`CAREER_JOBS`)                       | Discovery terjadwal dan pemeliharaan harian lewat runner karier yang sudah ada (`runNextCareerJob`).                                                                                                                                                                                                                                                    |
| **Cron Triggers**                                            | Ada (`* * * * *`)                         | Memicu enqueue. Pemeliharaan harian dijalankan bila jam UTC tertentu dan belum jalan hari ini (penanda di Postgres atau `Coordination` `set`).                                                                                                                                                                                                          |
| **Rate Limiting binding**                                    | Ada (pola `PORTFOLIO_PUBLIC_LIMITER`)     | Binding baru `JOB_SEARCH_LIMITER` (mis. 10 per 60 detik per pengguna) untuk menahan ledakan klik. Kuota harian tetap di Coordination karena binding ini hanya mendukung periode 10/60 detik dan tidak akurat lintas lokasi.                                                                                                                             |
| **Analytics Engine**                                         | Ada (`PORTFOLIO_EVENTS`, `ANALYTICS_SQL`) | Dataset baru `job_search_events`: penyedia, hit/miss cache, biaya mikro-USD, latensi, jumlah hasil, negara. Dibaca dashboard admin lewat SQL API yang sudah dipakai portofolio.                                                                                                                                                                         |
| **Browser Run (dulu Browser Rendering), Quick Actions REST** | Baru (Phase 06)                           | Cadangan membaca link lowongan yang butuh JavaScript, menggantikan Firecrawl/Tavily/Exa. Workers Paid: 10 jam browser per bulan gratis, lalu $0.09/jam; REST 10 request/detik. Pakai endpoint `/content` (HTML untuk JSON-LD) atau `/markdown`. Butuh token API Cloudflare dengan izin Browser Run (rahasia `CLOUDFLARE_BROWSER_TOKEN`) dan account id. |
| **Secrets (wrangler secret)**                                | Pola ada                                  | `TREG_API_KEY`, `CLOUDFLARE_BROWSER_TOKEN`. Sama seperti rahasia lain di proyek ini.                                                                                                                                                                                                                                                                    |
| **AI Gateway**                                               | Ada (`AI_BASE_URL`)                       | Analisis kecocokan AI per lowongan (K8) lewat penyedia AI yang sudah ada dan kredit.                                                                                                                                                                                                                                                                    |

### 2.2 Sengaja tidak dipakai

| Layanan                                                 | Alasan                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Workers KV**                                          | Worker sudah berjalan di Jakarta di samping Postgres, jadi baca cache dari Postgres hanya beberapa milidetik. KV menambah penyimpanan kedua yang konsisten-akhirnya (sampai ±60 detik) dan harus disinkronkan dengan baris lowongan. Pertimbangkan lagi hanya bila beban baca VPS jadi masalah. |
| **D1**                                                  | Database relasional kedua yang tidak bisa join dengan data pengguna di Postgres.                                                                                                                                                                                                                |
| **Workflows**                                           | Runner karier + Queue sudah menangani pekerjaan terjadwal dengan retry dan kunci per pengguna.                                                                                                                                                                                                  |
| **Workers Cache / edge cache**                          | Hasil bergantung pada pengguna dan kuota; edge cache pernah dicoba dan dibatalkan (PR alfariesh/rezumi#90) karena salinan cache hidup lebih lama dari datanya.                                                                                                                                  |
| **Vectorize / Workers AI embeddings**                   | Belum perlu. Kandidat backlog untuk deduplikasi lintas penyedia dan "lowongan serupa".                                                                                                                                                                                                          |
| **Browser Run Sessions (Puppeteer/Playwright binding)** | Ditagih juga per browser bersamaan ($2/browser tambahan). Quick Actions REST cukup untuk membaca satu halaman.                                                                                                                                                                                  |

Catatan Hyperdrive: bila query caching Hyperdrive aktif, hasil baca bisa tertinggal sampai ±60 detik. Untuk cache lowongan itu tidak masalah. Untuk kuota dan kunci tidak relevan karena keduanya ada di Durable Object.

## 3. Kode yang ada dan nasibnya

| Kode                                                                                                              | Sekarang                                                   | Rencana                                                                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/api/src/features/applications/posting.ts` `searchJobPostings`, `postingQueryFor`                        | Web search "<query> job posting in <negara>", maks 5 hasil | Dihapus di Phase 04 setelah semua pemanggil pindah ke `JobSearchService`                                                                                                                                 |
| `posting.ts` `readOpenPosting`, `fetchJobPosting`, `readJobPosting`, `POSTING_URLS`                               | Membaca satu halaman lowongan                              | **Tetap** untuk link yang ditempel pengguna dan extension; pembacanya diganti di Phase 06                                                                                                                |
| `applications/ai.ts` `searchPostings` (`/applications/ai/search-postings`)                                        | Endpoint pencarian untuk dialog Tambah lamaran             | Dihapus di Phase 03 (UI pindah ke halaman Lowongan); MCP parity disesuaikan                                                                                                                              |
| `career/jobs.ts` `discover()`                                                                                     | Web search + baca tiap link                                | Ditulis ulang di Phase 04 memakai `JobSearchService` dan cursor lowongan baru                                                                                                                            |
| `career/scheduling.ts` `canonicalOpportunityUrl`, `parseListingTitle`, `plainSnippet`                             | Bantu discovery                                            | Dipakai sebagian; yang tidak terpakai dihapus                                                                                                                                                            |
| `career/matching.ts` `matchOpportunity`                                                                           | Cocokkan frasa preferensi dengan teks                      | Dipakai untuk chip kecocokan gratis (K8)                                                                                                                                                                 |
| `web-access/*` (`firecrawl.ts`, `tavily.ts`, `exa.ts`, `searxng.ts`, `credentials.ts`, `router.ts`, `service.ts`) | BYOK web search dan baca                                   | Phase 06: `searchWeb` → treg `treg.web.search`; `readPage` → bawaan → Browser Run; sisanya dihapus beserta tabel `web_access_credentials`, env `WEB_SEARCH_SEARXNG_URL`, UI `settings/ai/web-access.tsx` |
| `web-access/regions.ts` `searchScope`, `resolveRegions`                                                           | Negara pencarian dari Profil/zona waktu                    | **Tetap**, dipindah ke `features/jobs` bila web-access dihapus                                                                                                                                           |
| `agent/service.ts` (±baris 977) dan `agent/tools.ts` (±183) `search_web`                                          | Web search asisten lewat web-access                        | Phase 06: lewat `searchWeb` baru (treg)                                                                                                                                                                  |
| `profile/sources/linkedin.ts` (Apify)                                                                             | Import profil LinkedIn                                     | Tidak disentuh rencana ini (backlog)                                                                                                                                                                     |
| `packages/db/src/schema/career.ts` `careerOpportunity`                                                            | Lowongan temuan per pengguna (url, role, company, …)       | Ditambah kolom `listingId` (FK ke `job_listing`, `set null`) di Phase 04                                                                                                                                 |

## 4. Klien treg

Lokasi: `packages/api/src/features/jobs/treg.ts`. Hanya server.

- Panggilan: `POST https://treg.to/call/<tool-id>` dengan body JSON, header `X-Treg-Token: <TREG_API_KEY>`, `Content-Type: application/json`, `X-Treg-Route-Max-Cost: <usd>` (selalu diisi; batas per panggilan dari perkiraan baris × harga, ditambah sedikit).
- Hasil: body penyedia apa adanya untuk tool penyedia (`hirebase.*`, `jobspipe.*`); tool routed (`treg.*`) membungkus `{output, raw, _treg}`. Biaya dibaca dari header `X-Treg-Cost-Micro` (integer mikro-USD), id panggilan dari `X-Treg-Call-Id`. Jangan membaca biaya dari body.
- Galat:
  - `503` (`treg_saturated`, `upstream_busy`) dan `429` `share_busy` / `provider_rate_limited`: coba ulang maksimal 2 kali dengan jeda (pakai `retry_after_s` bila ada), dalam batas waktu total 10 detik.
  - `429` `member_spend_cap_reached` / `org_rate_limit`: berhenti, tandai "anggaran habis" (lihat bagian 8).
  - `4xx` lain: galat pemanggil, catat tanpa body (bisa memuat input).
  - Panggilan gagal tidak ditagih treg.
- Arsip treg: pertanyaan yang sama dari tim bisa dijawab dari arsip (`X-Treg-Cache: hit`) seharga 10%. Untuk pencarian kita boleh (cache sendiri tetap utama); untuk discovery dan pengecekan lowongan tutup kirim `Cache-Control: no-cache` supaya data segar.
- Batas waktu per panggilan 15 detik, `AbortSignal` dari permintaan diteruskan.
- Log: `[jobs] {tool, status, costMicro, ms}`. Jangan pernah mencatat header token.
- Env: `TREG_API_KEY` (opsional di skema; tanpa nilai, fitur Lowongan tampil "belum tersedia di server ini"). Tambahkan ke `packages/env/src/server.ts`, `.env.example`, `turbo.json`.

## 5. Model data lowongan

Skema di `packages/schema/src/jobs/listing.ts` (runtime-universal, dipakai web dan nanti mobile):

```ts
type JobListing = {
  id: string; // id Rezumi
  provider: "hirebase" | "jobspipe";
  externalId: string; // Hirebase _id, JobsPipe id
  title: string;
  company: { name: string; domain?: string; logoUrl?: string; size?: string; industry?: string };
  location: { city?: string; region?: string; country?: string; countryCode?: string; text: string };
  workArrangement?: "onsite" | "hybrid" | "remote";
  seniority?: string; // dinormalisasi: entry, junior, mid, senior, lead, executive
  employmentType?: string;
  visaSponsorship?: boolean; // Hirebase `visa_sponsored`, JobsPipe `visa_sponsorship`
  salary?: { min?: number; max?: number; currency: string; period: "year" | "month" | "hour" | "unknown" };
  description: string; // teks bersih, maks MAX_POSTING_CHARS
  requirementsSummary?: string;
  skills: string[];
  postingUrl: string; // link posting asli (WAJIB tampil)
  applyUrl?: string;
  source?: string; // "linkedin", "indeed", "workday", …
  language?: string;
  postedAt?: string; // ISO
  firstSeenAt: string;
  lastVerifiedAt: string;
  closedAt?: string | null;
};
```

Pemetaan (dari sampel 2026-11-20, bagian 14; cek ulang dengan `example_response` di katalog treg dan simpan contoh respons sebagai fixtures tes di Phase 01):

| Kolom           | Hirebase                                                                                             | JobsPipe                                                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| externalId      | `_id`                                                                                                | `id`                                                                                                                          |
| title           | `job_title`                                                                                          | `job_title`                                                                                                                   |
| company         | `company_name`, `company_link`, `company_logo`, `company_data.size_range`, `company_data.industries` | `company`, `company_domain`, `company_object`                                                                                 |
| location        | `locations[0]` (`city`, `region`, `country`), `location_raw`                                         | `city`/`normalized_city`, `normalized_region`, `country_code`, `location`                                                     |
| workArrangement | `location_type` ("Remote"/"Hybrid"/"In-Person")                                                      | `work_arrangement`, `remote`, `hybrid`                                                                                        |
| seniority       | `experience_level`                                                                                   | `seniority`                                                                                                                   |
| salary          | `salary_range` (`min`, `max`, `currency`, `period`)                                                  | `min_annual_salary`, `max_annual_salary`, `salary_currency`, `salary_type` (`estimated_*` **tidak** ditampilkan sebagai gaji) |
| description     | `description` (HTML bersih, 500–2.000 karakter) → teks                                               | `description` → teks                                                                                                          |
| postingUrl      | `application_link`, cadangan `job_board_link` (papan karier seluruh perusahaan; lihat 15)            | `url` / `source_url` / `sources[0].url`                                                                                       |
| applyUrl        | `application_link`                                                                                   | `final_url`                                                                                                                   |
| source          | `job_board`                                                                                          | `sources[0]`                                                                                                                  |
| postedAt        | `date_posted`                                                                                        | `date_posted`                                                                                                                 |
| closedAt        | dari feed `hirebase.jobs.expired`                                                                    | `closed_at` / `status`                                                                                                        |

**Kolom yang dibuang, tidak pernah disimpan:** `recruiter_emails`, `hiring_team`, kontak orang mana pun (bagian 13).

HTML deskripsi diubah ke teks dengan `htmlToText` yang ada (`web-access/builtin.ts`; pindahkan ke paket yang tepat bila web-access dihapus). Teks dari penyedia adalah data tidak tepercaya: tidak pernah dirender sebagai HTML; bila masuk prompt AI, bungkus dengan `dataBlock` seperti alur `parsePosting`.

## 6. Tabel database

Di `packages/db/src/schema/jobs.ts`, lalu `pnpm db:generate`.

- **`job_listing`**: kolom bagian 5 + `raw` (jsonb, kolom penyedia yang dipakai saja, tanpa kontak orang) + `searchText` (untuk pencocokan). Unik `(provider, externalId)`. Indeks `closedAt`, `lastSeenAt`. Tidak terikat pengguna.
- **`job_search_cache`**: `key` (sha256 dari pencarian ternormalisasi, primary key), `providers` (text[], penyedia yang dipakai jawaban ini), `query` (jsonb ternormalisasi), `listingIds` (text[] berurutan), `cursors` (jsonb, lanjutan per penyedia untuk "muat lebih banyak"), `total` (bila diketahui), `fetchedAt`, `expiresAt`.
- **`job_listing_hidden`** (diputuskan Phase 02: tabel sendiri, bukan `career_opportunity.dismissedAt`): `(userId, listingId)` primary key, `hiddenAt`, cascade ke `user` dan `job_listing`. Alasan: menyembunyikan berlaku untuk hasil pencarian apa pun, yang belum tentu opportunity. Phase 04 membaca tabel ini sebelum membuat `career_opportunity` baru.
- **`career_opportunity`**: tambah `listingId` (Phase 04).
- **Penghapusan per penyedia:** satu fungsi admin `purgeProvider(provider)` menghapus `job_listing` dan `job_search_cache` milik penyedia itu (aturan Hirebase: hapus dalam 30 hari bila berhenti). Lamaran yang sudah dilacak pengguna menyimpan salinan teksnya sendiri dan tidak ikut terhapus.

Ingat aturan repo: tinjau SQL migrasi sebelum diterapkan; deploy produksi menerapkan migrasi sebelum Worker.

## 7. Alur pencarian

`packages/api/src/features/jobs/service.ts`, `JobSearchService.search(userId, input)`:

1. **Input** (`packages/schema/src/jobs/search.ts`): `query` (2–200), `location?`, `country?` (ISO-2; kosong = di mana saja), `remote` (`any` | `only` | `exclude`), `postedWithinDays` (1/7/14/30, bawaan 30), `workArrangement?`, `seniority?`, `salaryMin?` + `salaryCurrency?` + `includeNoSalary` (bawaan true), `visaSponsorship?`, `cursor?`.
2. **Normalisasi** untuk kunci cache: huruf kecil, spasi dirapikan, sinonim sederhana tidak dilakukan dulu (backlog), negara dari input atau `searchScope`. Kunci = sha256 JSON terurut + penyedia + versi skema.
3. **Rate limit** `JOB_SEARCH_LIMITER` lalu **kuota harian** (bagian 8). Halaman cache yang sudah dibuka pengguna hari itu tidak dihitung ulang.
4. **Cache** segar (`expiresAt > now`) → ambil `job_listing` urut `listingIds`, buang yang `closedAt`, buang yang disembunyikan pengguna → jawab.
5. **Miss** → kunci single-flight `Coordination` key `jobs-search:<key>` (`consume`, `max 1`, `window 30000`). Kalah → tunggu dengan jeda pendek (maks ±8 detik) sampai cache terisi, lalu baca cache; bila tetap kosong, lanjut panggil sendiri.
6. **Anggaran server** (bagian 8) cukup? Bila tidak: jawab cache basi bila ada, plus tanda `budgetLimited`.
7. **Router penyedia** (K1): **Hirebase dulu untuk semua negara dan remote.** Bila Hirebase galat atau memberi < 10 lowongan di halaman pertama, panggil JobsPipe untuk menambah sampai 20 (dedup langkah 9). Halaman berikutnya ("muat lebih banyak") meneruskan cursor penyedia yang masih punya sisa. Aturan ini satu tempat (`router.ts`) dan mudah diubah per negara bila data Phase 07 menunjukkan perlu. Pemetaan input:
   - Hirebase `hirebase.jobs.search`: `job_titles` atau `keywords` dari `query`, `geo_locations: [{country, city?}]` (nama negara bahasa Inggris), `days_ago`, `location_types` (remote), `experience`, `salary` + `currency` + `include_no_salary`, `visa`, `limit` (20), `page`. Parameter tak dikenal → 422, jadi kirim hanya yang ada di katalog.
   - JobsPipe `jobspipe.jobs.search`: `job_title_or` (dan/atau `description_or`), `job_country_code_or`, `city_or`, `posted_at_max_age_days`, `remote`, `job_seniority_or`, `min_salary_usd` (hanya bila "sertakan tanpa gaji" dimatikan, karena lowongan tanpa gaji tidak pernah cocok), `visa_sponsorship_or` (cek nama di katalog), `limit` (20), `cursor`; status aktif saja.
   - Remote: "di mana saja" = tanpa negara + remote; "di negara ini" = negara + remote.
   - Uji 2026-11-20: `job_title_or: ["admin"]` cocok dengan "Admin Accounting". Cek di Phase 02 apakah kata kunci bebas lebih baik lewat `job_title_or` atau `description_or`/`keywords`, ukur dengan endpoint `*.count` gratis.
8. **Normalisasi + upsert** `job_listing` (on conflict `(provider, externalId)` update kolom dan `lastSeenAt`), tulis `job_search_cache` dengan TTL (K3), lepas kunci.
9. **Dedup lintas penyedia** hanya saat dua penyedia dipakai di satu jawaban: kunci `lower(title) + lower(company) + kota`. Simpan keduanya di DB, tampilkan satu.
10. **Event** Analytics Engine (bagian 12).
11. **Jawaban:** `{ listings: JobListingCard[], cursor?, fetchedAt, fromCache, budgetLimited, quota: {used, max} }`. Kartu = `JobListing` tanpa `description` penuh (detail lewat `jobs.listing`).

Prosedur oRPC baru di `packages/api/src/features/jobs/router.ts`, digabung ke `@rezumi/api/routers`, semuanya `protectedProcedure`: `jobs.search`, `jobs.listing` (detail), `jobs.track` (membuat lamaran; pakai `applicationsService` yang ada), `jobs.hide`, `jobs.quota`. `pnpm docs:gen` setelahnya.

## 8. Kuota dan anggaran

- **Kuota pengguna (K2):** `PlanLimits` di `packages/schema/src/billing/catalog.ts` mendapat `jobSearchesPerDay` (free 3, plus 15, pro-ai 40, atau sesuai jawaban pemilik). Pengecekan memakai `Coordination` `consume` key `jobs-quota:<userId>:<YYYY-MM-DD zona akun>`, `window` sampai tengah malam zona akun. Saat `BILLING_MODE` mati, pakai batas Pro AI. Pesan galat netral (tanpa harga) seperti `planLimitReached`; kode galat `PLAN_LIMIT_REACHED` dengan `limit: "jobSearchesPerDay"`.
- **Anggaran server (K7):** env `JOB_SEARCH_DAILY_BUDGET_USD` (angka; bawaan 1). Total biaya hari ini dijumlah dari `X-Treg-Cost-Micro` dan disimpan di `Coordination` key `jobs-budget:<YYYY-MM-DD UTC>` (Phase 02: operasi baru `add` di `Coordination`, lihat bagian 16). Lewat batas → hanya cache. Batas keras kedua ada di dasbor treg (spend cap harian per anggota).
- **Kill switch:** env `FLAG_DISABLE_JOB_SEARCH=true` mematikan panggilan penyedia (hanya cache).

## 9. Lowongan baru otomatis (Phase 04)

- Jadwal `careerSchedule` jenis `discovery` menyimpan input pencarian (bagian 7.1) di kolomnya (tambah kolom jsonb `search` bila `query` teks saja tidak cukup).
- Saat jadwal jalan (runner karier yang ada, lewat Queue):
  - JobsPipe: `jobspipe.jobs.new` dengan `delta_cursor` yang disimpan per jadwal; poll tanpa hasil gratis; bayar lowongan baru saja.
  - Hirebase: `hirebase.jobs.search` dengan `ingested_after` = waktu jalan terakhir.
  - Hasil di-upsert ke `job_listing`, lalu baris `career_opportunity` per pengguna (dengan `listingId`) untuk yang belum pernah terlihat, belum disembunyikan, belum dilacak. Notifikasi dan email ringkasan memakai `notices.ts` dan `sendCareerNotification` yang ada.
  - Tidak lagi membuka halaman satu per satu.
- Biaya jadwal masuk anggaran server yang sama dan **tidak** memakai kuota harian pengguna (sudah dibatasi jumlah jadwal per pengguna `MAX_SCHEDULES_PER_USER`; pertimbangkan batas jadwal discovery per paket dan catat).

## 10. Pemeliharaan harian (Phase 05)

Satu tugas per hari (jam 19:00 UTC ≈ 02:00 WIB):

1. `hirebase.jobs.expired` (gratis, id lowongan tutup 14 hari terakhir) → set `closedAt` untuk `job_listing` Hirebase yang cocok.
2. JobsPipe: untuk lowongan yang **dilacak** atau ada di `career_opportunity` aktif dan belum dicek > 3 hari, cek status lewat pencarian berdasarkan id/kunci perusahaan bila tersedia di katalog; bila tidak tersedia, andalkan `status`/`closed_at` saat lowongan muncul lagi di hasil. Catat temuan di sini.
3. Lamaran yang dilacak dari lowongan yang kini tutup → notice "Lowongan ini sudah ditutup" di workspace lamaran (sekali).
4. Hapus `job_search_cache` kedaluwarsa > 1 hari.
5. Hapus `job_listing` yang `lastSeenAt` > 30 hari (K3) dan tidak dirujuk `career_opportunity` aktif.

## 11. Tanpa API key (Phase 06)

- **Baca link** (`readPage`): pembaca bawaan (`builtin.ts`, sudah ada; JSON-LD dulu) → bila gagal karena halaman butuh JavaScript (`empty`, `challenge`, `not-a-page` tanpa JSON-LD) → Browser Run Quick Actions `/content` (HTML) lalu pembacaan JSON-LD/teks yang sama. LinkedIn/Indeed sering memblokir browser tanpa login; untuk itu pengguna diarahkan ke extension. Batasi Browser Run per pengguna (Coordination `consume`, mis. 20/hari) dan catat durasinya.
- **Web search asisten** (`searchWeb`): `treg.web.search` (`q`, `limit`) dengan `X-Treg-Route-Max-Cost` kecil (mis. 0.01) dan `X-Treg-Route-Waterfall: 0`; harga routed bervariasi ($0–$0.16 per hit), jadi baca `catalog_get` untuk rencana penyedia termurah dan pertimbangkan memilih satu penyedia tetap. Hitung ke anggaran server. Hormati wilayah (`regions`) bila parameter tersedia.
- **Hapus:** `firecrawl.ts`, `tavily.ts`, `exa.ts`, `searxng.ts`, `credentials.ts`, router web-access (oRPC `webAccess.*`), tabel `web_access_credentials` (migrasi drop), env `WEB_SEARCH_SEARXNG_URL`, UI `apps/web/src/features/settings/ai/web-access.tsx` dan pemanggilnya, MCP parity, dokumen dan panduan yang menyebut Web access.

## 12. Observability dan biaya

- Analytics Engine dataset `job_search_events` (binding `JOB_EVENTS`): `blobs` = [provider, tool, outcome (`hit`/`miss`/`stale`/`error`/`budget`), countryCode, kind (`search`/`discovery`/`maintenance`/`web-search`/`browser`)], `doubles` = [costMicro, ms, resultCount], `indexes` = [provider]. Tanpa userId dan tanpa teks pencarian (privasi).
- Dashboard admin (Phase 07): biaya per hari per penyedia, rasio cache hit, latensi p50/p95, galat; memakai pola laporan admin yang ada (`ANALYTICS_SQL`).
- Peringatan: bila biaya hari ini > 80% anggaran, catat log `warn` dan (bila ada) kirim alert admin dengan mekanisme `billing/alerts.ts`.

## 13. Aturan data penyedia (dibaca 2026-11-20)

Hirebase Terms (https://www.hirebase.org/terms, diperbarui 2026-11-12) dan JobsPipe Terms + Acceptable Use (https://jobspipe.dev/terms, https://jobspipe.dev/acceptable-use). Ketentuan treg §05: pengguna treg wajib mengikuti aturan tiap penyedia.

| Hal                                | Hirebase                                                         | JobsPipe                                                                               | Konsekuensi di Rezumi                                                 |
| ---------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Simpan/cache di sistem sendiri     | Diizinkan (§4)                                                   | Tidak diatur (konfirmasi tertulis diminta di Phase 00)                                 | Cache bersama + umur terbatas                                         |
| Tampilkan ke pengguna aplikasi     | Diizinkan, termasuk publik (§4)                                  | Diizinkan untuk pencarian, papan lowongan, notifikasi yang mengarahkan ke posting asli | Link posting asli selalu tampil                                       |
| Lowongan tutup                     | Wajib diperbarui berkala dan dihapus segera (§4)                 | —                                                                                      | Pemeliharaan harian (bagian 10)                                       |
| Ubah isi lowongan                  | Tidak boleh menyesatkan soal pemberi kerja, posisi, gaji, syarat | Tidak boleh mengaku posting sebagai milik sendiri                                      | Tampilkan apa adanya; ringkasan AI diberi label                       |
| Ekspor massal / redistribusi / API | Dilarang                                                         | Dilarang dalam jumlah besar                                                            | Tidak ada ekspor CSV lowongan; MCP dibatasi jumlah hasil              |
| Database pesaing                   | Dilarang                                                         | Dilarang                                                                               | Tidak menarik data massal di muka; tidak ada halaman SEO publik (K10) |
| Kontak orang                       | Kewajiban hapus saat diminta (§5)                                | Dilarang membuat daftar kontak                                                         | Kolom kontak dibuang (bagian 5)                                       |
| Akun berakhir                      | Hapus data dalam 30 hari (§11)                                   | Tidak diatur                                                                           | `purgeProvider` (bagian 6)                                            |
| Atribusi                           | Tidak wajib                                                      | Link ke posting asli                                                                   | "lewat <sumber>" + link asli                                          |

## 14. Hasil uji 2026-11-20

Target produk global (D6). Uji Indonesia dikerjakan lebih dulu karena pemilik tinggal di sana; uji global menyusul di hari yang sama dan menjadi dasar K1.

### 14.1 Global (endpoint count gratis, 30 hari terakhir, Hirebase / JobsPipe; JobsPipe berhenti menghitung di 10.000)

| Negara    | software engineer | product manager | marketing manager | data analyst  | nurse            |
| --------- | ----------------- | --------------- | ----------------- | ------------- | ---------------- |
| AS        | 9.918 / ≥10.000   | 5.441 / ≥10.000 | 3.410 / 7.458     | 1.577 / 3.918 | 55.655 / ≥10.000 |
| Inggris   | 1.143 / 3.826     | 747 / 1.584     | 723 / 1.718       | 312 / 843     | 2.167 / ≥10.000  |
| Jerman    | 608 / 1.590       | 621 / 771       | 554 / 1.399       | 139 / 229     | 247 / 137        |
| India     | 5.095 / 7.402     | 912 / 1.874     | 467 / 2.870       | 393 / 1.104   | 135 / 1.998      |
| Kanada    | 681 / 2.999       | 506 / 886       | 364 / 645         | 180 / 348     | 2.718 / 5.774    |
| Australia | 280 / 742         | 205 / 340       | 210 / 417         | 92 / 216      | 1.250 / 4.623    |
| Belanda   | 253 / 848         | 186 / 366       | 97 / 225          | 94 / 115      | 490 / 12         |
| Prancis   | 509 / 833         | 447 / 872       | 333 / 329         | 286 / 969     | 1.292 / 38       |
| Brasil    | 350 / 818         | 169 / 362       | 77 / 110          | 272 / 111     | 677 / 400        |
| Remote    | 2.572 / 9.493     | 1.672 / 3.963   | 1.186 / 3.230     | 539 / 1.333   | —                |

- JobsPipe biasanya 2–3× lebih banyak (menggabungkan LinkedIn, Indeed, papan lowongan). Hirebase lebih kuat di beberapa sektor/negara (perawat di Jerman, Belanda, Prancis; data analyst di Brasil). Angka tidak sepenuhnya sebanding (cara mencocokkan judul berbeda).
- **Gaji tercantum** (software engineer): AS Hirebase 6.532 dari 9.920 (±66%); Inggris 335 dari 1.143 (±29%); Jerman 70 dari 608 (±12%); India 42 dari 5.095 (±1%). JobsPipe dengan `min_salary_usd: 1`: AS ≥10.000, Inggris 1.173, Jerman 126, India 151.
- Kesimpulan K1: untuk 20 hasil per halaman, Hirebase hampir selalu cukup dan 2,6× lebih murah; JobsPipe dipakai untuk menambah pada pencarian sempit.

### 14.2 Indonesia

Biaya total ±$0.05 dari saldo gratis $1. Skrip ada di scratchpad sesi (tidak disimpan di repo).

- **Jumlah lowongan 30 hari terakhir** (endpoint count gratis), Hirebase / JobsPipe:
  - Indonesia semua posisi: ±7.000 / ≥10.000 (batas angka JobsPipe).
  - Indonesia per posisi: software engineer 37 / 148; data analyst 26 / 98; digital marketing 31 / 152; accountant 18 / 112; admin 59 / 865; sales 589 / 3.562; customer service 26 / 231; graphic designer 18 / 120; product manager 64 / 168.
  - Pembanding software engineer: Singapura 316 / 877; Malaysia 94 / 333; Amerika 9.880 / ≥10.000.
- **Sumber Indonesia:** JobsPipe LinkedIn ≥10.000, Indeed ±7.055, Workday 638, SmartRecruiters 392, Workable 214, SuccessFactors 133. Hirebase LinkedIn 3.168, Workday 902, SuccessFactors 439, SmartRecruiters 321. JobStreet, Glints: 0.
- **Kualitas sampel** (20 lowongan, "digital marketing" dan "admin" Jakarta): diposting 1–15 hari lalu, relevan, campuran perusahaan besar dan UMKM. **Gaji kosong di semua sampel.** Hirebase: deskripsi 850–1.900 karakter, `experience_level`, `requirements_summary`, `company_data`. JobsPipe: deskripsi 340–3.600 karakter, sebagian berbahasa Indonesia, `ghost_score`, `seniority`, `applicant_count` (sebagian).
- **Latensi:** Hirebase ±1,6 detik, JobsPipe 1,8–2,6 detik.
- **Keandalan:** beberapa `503 treg's database pool is saturated` saat panggilan count beruntun → wajib retry (bagian 4).
- **Tool routed** `treg.companies.jobs.search` dilayani Hirebase dengan harga sama; tidak dipakai karena kita butuh parameter khusus tiap penyedia.

## 15. Phase 01 — yang dibangun dan temuan (2026-11-20)

Kode: `packages/api/src/features/jobs/` (`treg.ts`, `events.ts`, `store.ts`, `providers/{shared,hirebase,jobspipe,index}.ts`, fixtures di `__fixtures__/` dari `example_response` katalog treg), skema `packages/schema/src/jobs/{listing,search}.ts`, tabel `packages/db/src/schema/jobs.ts` (migrasi `20261120021955_orange_talon`), binding `JOB_EVENTS`, skrip `pnpm jobs:probe`.

Keputusan teknis (berbeda atau lebih rinci dari bagian 4–6):

- **Klien treg:** kode galat `not-configured`, `budget` (`member_spend_cap_reached`, `tag_spend_cap_reached`, `insufficient_balance`, `funds_required`, `trial_allowance_reached`), `busy`, `rejected` (4xx lain, termasuk 402 `route_max_cost`), `timeout`, `unavailable`. Coba ulang hanya 503 dan 429 `share_busy`/`provider_rate_limited`; `org_rate_limit`/`org_concurrency_limit` berhenti sebagai `busy`. Header `X-Treg-Meta: feature=jobs-<kind>` untuk ledger treg (tanpa id pengguna). Panggilan `GET` memakai query (`hirebase.jobs.expired?since=…`, `hirebase.jobs.get?job_id=…`).
- **Batas biaya per panggilan:** `limit × harga × 1,25 + $0.005`. Harga di kode: Hirebase $0.0015, JobsPipe $0.00392 per lowongan (katalog 2026-11-20). Endpoint count dikirim dengan batas $0.001.
- **Adaptor** punya `search()` dan `count()` (endpoint gratis). `search()` mencatat event Analytics Engine sendiri (`miss`, `error`, `budget`); Phase 02 menambah `hit`/`stale` dari cache.
- **`postingUrl` Hirebase = `application_link`**: di contoh katalog `job_board_link` adalah papan karier seluruh perusahaan (`jobs.ashbyhq.com/ramp`), bukan posting itu. `company_link` hanya dipakai sebagai domain bila berupa domain polos (di `jobs.get` isinya link papan Lever).
- **Gaji JobsPipe** dari `min/max_annual_salary_usd`, jadi selalu USD per tahun (lowongan Inggris tampil dalam USD hasil konversi penyedia). `estimated_*` tidak dipakai.
- **Status JobsPipe:** `active` → `closedAt: null`; status lain → `closed_at` atau `last_seen_at`. Hirebase tidak memberi status, jadi `upsertListings` tidak mengubah `closedAt` yang sudah ada (diisi pemeliharaan Phase 05).
- **Tabel:** `job_listing` punya `country_code` (indeks nanti bila perlu), `last_seen_at` (pembersihan 30 hari) dan `last_verified_at` (terakhir dipastikan buka). `raw` hanya daftar kolom tetap per penyedia; kolom kontak tidak pernah masuk (diuji).

Untuk Phase 02:

- **Visa:** katalog kedua penyedia tidak punya parameter filter visa. Hirebase mengisi `visa_sponsored` per lowongan; JobsPipe tidak punya kolomnya di contoh. Filter K11 "sponsor visa" harus dikerjakan setelah hasil diterima (atau hanya untuk Hirebase).
- **"Sertakan lowongan tanpa gaji":** Hirebase tidak punya `include_no_salary` di katalog, JobsPipe `min_salary_usd` membuang lowongan tanpa gaji. Adaptor mengirim filter gaji hanya bila pengguna mematikan opsi itu; bila menyala, saring/urutkan sendiri.
- **Seniority JobsPipe:** nilai `job_seniority_or` tidak tercantum di katalog (contoh respons: `director`). Belum dikirim; ukur dulu dengan `jobspipe.jobs.search.count`.
- **Jumlah total JobsPipe** kosong (`total_results: null`) kecuali `include_total_results: true`; pakai endpoint count gratis bila angka perlu.
- **Relevansi:** uji nyata "nurse" Inggris di JobsPipe memberi "Reception Class Teacher (… Nursery School)"; "data analyst" remote di JobsPipe memberi sebagian lowongan tanpa tanda remote. Bandingkan `job_title_or` dengan frasa berkutip/`description_or` dan cek `work_arrangement` hasil sebelum memilih.
- **Uji nyata 2026-11-20** (3 lowongan per penyedia: software engineer AS, nurse Inggris, data analyst remote): semua 18 lowongan valid (0 dibuang), latensi 1,5–2,3 detik, total biaya **$0.0292**. Hirebase 6 dari 9 mencantumkan gaji; JobsPipe 6 dari 9.

## 16. Phase 02 — yang dibangun dan temuan (2026-11-20)

Kode: `packages/api/src/features/jobs/` — `service.ts` (`createJobSearchService`, `jobSearchService`), `routing.ts` (router penyedia; nama `router.ts` dipakai prosedur oRPC seperti fitur lain), `search-key.ts`, `filters.ts`, `cache.ts`, `allowance.ts` (rate limit, kuota, anggaran), `counters.ts`, `router.ts` (oRPC `jobs.*`). Skema keluaran di `packages/schema/src/jobs/search.ts`. Tabel `job_listing_hidden` (migrasi `20261120024148_happy_fallen_one`). `pnpm jobs:probe … --service --user <id>` menjalankan service sungguhan dua kali.

### 16.1 Ukuran gratis: kata kunci bebas (2026-11-20, 525 panggilan `*.count`, $0)

15 kata kunci × AS, Inggris, Jerman, India, Kanada, Indonesia, remote; 30 hari. Angka Hirebase `job_titles` / `"judul berkutip"` / `keywords`, JobsPipe `job_title_or` / `description_or` (JobsPipe berhenti di 10.000):

| Kata kunci        | AS                                         | Jerman                            | Indonesia                 | Remote                                 |
| ----------------- | ------------------------------------------ | --------------------------------- | ------------------------- | -------------------------------------- |
| software engineer | 9.965 / 8.311 / 24.176 · 10.000 / 10.000   | 612 / 501 / 1.658 · 1.591 / 3.824 | 38 / 28 / 92 · 147 / 561  | 2.602 / 2.361 / 5.416 · 9.489 / 10.000 |
| customer support  | 829 / 623 / 146.421 · 1.646 / 10.000       | 157 / 118 / 10.835 · 182 / 9.474  | 11 / 9 / 408 · 28 / 4.340 | 412 / 371 / 11.727 · 1.172 / 10.000    |
| data analyst      | 1.589 / 1.079 / 10.933 · 3.930 / 10.000    | 138 / 101 / 349 · 229 / 871       | 27 / 22 / 78 · 98 / 550   | 545 / 390 / 2.326 · 1.330 / 10.000     |
| react             | 165 / 165 / 5.177 · 1.080 / 10.000         | 23 / 23 / 457 · 101 / 1.400       | 0 / 0 / 37 · 37 / 326     | 203 / 203 / 2.193 · 1.061 / 9.099      |
| python            | 453 / 453 / 29.116 · 1.695 / 10.000        | 47 / 47 / 2.914 · 131 / 7.831     | 1 / 1 / 227 · 18 / 856    | 378 / 378 / 8.856 · 1.535 / 10.000     |
| nurse             | 56.791 / 56.791 / 77.267 · 10.000 / 10.000 | 251 / 251 / 1.201 · 137 / 222     | 3 / 3 / 3 · 29 / 42       | 864 / 864 / 1.557 · 3.206 / 5.758      |

Temuan:

- `keywords` (Hirebase) dan `description_or` (JobsPipe) mencocokkan isi deskripsi: 3–175× lebih banyak dari judul ("customer support" di AS: 829 lewat judul, 146.421 lewat deskripsi; hampir semua lowongan menyebut kata itu). Untuk pencarian posisi, hasilnya bukan posisi yang dicari.
- `job_titles` tanpa kutip (semua kata di judul, urutan bebas) hanya 10–35% di atas versi berkutip; tanpa kutip dipakai karena "engineer software" dan "Software Engineer II" tetap cocok.
- Judul cukup di pasar besar (AS, Inggris, India, remote: ratusan sampai ribuan untuk hampir semua kata kunci). Kata yang berupa skill, bukan posisi ("react", "python", "machine learning"), lemah lewat judul di pasar kecil (Indonesia: react 0, python 1); JobsPipe judul menambah sedikit (37, 18).

**Pilihan Phase 02:** kedua penyedia memakai judul (`job_titles`, `job_title_or`), seperti Phase 01. Tidak ada cadangan `keywords` dulu: satu panggilan berbayar tambahan untuk kasus yang jarang. Kandidat backlog: bila Hirebase dan JobsPipe judul bersama memberi < 10, coba Hirebase `keywords` (diperingkat relevansi).

### 16.2 Keputusan teknis

- **Router (K1):** Hirebase dulu (20). JobsPipe menambah sampai 20 bila Hirebase galat atau memberi < 10 lowongan yang lolos filter. Cursor per penyedia di `job_search_cache.cursors`: string = halaman berikutnya, `""` = habis, tidak ada = belum ditanya (JobsPipe bisa mulai di halaman berikutnya setelah Hirebase habis). Pencarian sponsor visa tidak memanggil JobsPipe (datanya tidak punya kolom visa). Galat `budget` dari treg langsung berhenti tanpa mencoba penyedia lain.
- **Filter setelah hasil diterima** (`filters.ts`): negara, remote/arrangement, level, visa, gaji. Lowongan yang tidak menyebut (tanpa negara, tanpa gaji, tanpa level) tetap tampil; hanya yang jelas tidak cocok dibuang. Gaji hanya dibandingkan bila mata uang sama dan per tahun.
- **Dedup:** kunci judul + perusahaan + kota (huruf kecil, tanpa tanda baca), di dalam satu halaman dan terhadap halaman sebelumnya. Semua lowongan yang dibayar disimpan; cache hanya menunjuk yang tampil.
- **Kunci cache:** sha256 dari JSON berurutan `{v: 1, search, providers, after?}`. `search` ternormalisasi (NFKC, huruf kecil, spasi tunggal); kolom yang tidak mengubah jawaban dibuang (mata uang dan "sertakan tanpa gaji" tanpa gaji minimum, `visaSponsorship: false`, `remote` bila arrangement dipilih). Halaman berikutnya dikunci dengan cursor penyedia halaman sebelumnya, jadi "muat lebih banyak" juga dibagi antar pengguna. Naikkan `JOB_SEARCH_CACHE_VERSION` bila pemetaan atau filter berubah.
- **Cursor ke klien** = kunci halaman sebelumnya (64 hex). Ditolak (`BAD_REQUEST`) bila halaman itu sudah dihapus atau milik pencarian lain.
- **Negara tidak diisi otomatis** di server: input kosong = di mana saja. Halaman Phase 03 mengisi negara bawaan dari `searchScope` (Profil/zona waktu).
- **Kuota (K2):** dihitung **setelah** jawaban ada, jadi pencarian gagal tidak memakai kuota. Halaman yang sudah dibuka hari itu (kunci `seen:<user>:<hari>:<kunci halaman>`) tidak dihitung lagi, juga saat kuota habis. Hari = zona waktu akun (`user.timezone`). Saat plans tidak berlaku untuk akun (`BILLING_MODE` off/admins): batas Pro AI (40).
- **Penghitung bersama** (`counters.ts`): operasi `add(key, amount, {window, max?})` — `amount` 0 untuk membaca; dengan `max`, jumlah yang melewati batas ditolak dan tidak ditambahkan. Workers: operasi baru `add` di Durable Object `Coordination` (`consume` tidak bisa menambah lebih dari 1). Node: Redis (skrip Lua) bila `REDIS_URL` ada, kalau tidak di memori proses. Store yang gagal → memori proses (pencarian tidak pernah berhenti karena store).
- **Anggaran (K7):** kunci `budget:<hari UTC>` dalam mikro-USD dari `X-Treg-Cost-Micro`. Dicek sebelum memanggil penyedia; lewat batas → cache basi dengan `budgetLimited: true`, atau galat `JOBS_BUDGET_LIMITED` bila tidak ada cache. Log `warn` sekali saat melewati 80%. Alert admin lewat `billing/alerts.ts` belum dibuat (butuh jenis alert baru; Phase 07 bersama dasbor biaya).
- **Single-flight:** `add("lock:<kunci>", 1, {max: 1, window: 30 s})`. Yang kalah menunggu (cek cache tiap 300 ms, maks 8 detik), lalu memanggil sendiri bila belum terisi. Kunci tidak dilepas; habis sendiri dalam 30 detik.
- **Rate limit:** binding `JOB_SEARCH_LIMITER` (10 per 60 detik per akun, namespace `1102`); di Node `createRateLimiter` biasa. Mati bila `FLAG_DISABLE_API_RATE_LIMIT`.
- **Kill switch / tanpa token:** `FLAG_DISABLE_JOB_SEARCH` → hanya cache (basi pun boleh), tanpa cache `JOBS_UNAVAILABLE`. Tanpa `TREG_API_KEY` → `JOBS_UNAVAILABLE` selalu; `jobs.quota` menjawab `available: false`.
- **Galat penyedia** tanpa cache → `JOBS_UNAVAILABLE`; dengan cache kedaluwarsa → jawaban basi `stale: true`.
- **oRPC** (`/api/rpc`, OpenAPI tag `Jobs`): `jobs.search` (POST `/jobs/search`), `jobs.listing` (GET `/jobs/listings/{id}`), `jobs.hide` (PUT `/jobs/listings/{id}/hidden`), `jobs.quota` (GET `/jobs/quota`). `jobs.track` menyusul di Phase 03. Galat: `PLAN_LIMIT_REACHED` (`data.limit: "jobSearchesPerDay"`, `resetsAt`), `JOBS_UNAVAILABLE`, `JOBS_BUDGET_LIMITED`, `RATE_LIMIT_EXCEEDED`, `BAD_REQUEST`.

### 16.3 Uji nyata (2026-11-20, izin pemilik)

`pnpm jobs:probe "software engineer" US --service --user <akun lokal> --yes`: pencarian pertama 1,8 detik, Hirebase 20 lowongan, **$0.0300**, 16 tampil (4 baris ganda dari Hirebase sendiri: posting yang sama dua kali atau satu baris per lokasi; dedup bekerja), tidak perlu JobsPipe. Pencarian kedua yang sama: **9 ms, `fromCache: true`, $0**, kuota tetap 1/40 (halaman yang sama hari itu tidak dihitung ulang). Total biaya sesi Phase 02: $0.0300.

### 16.4 Untuk Phase 03

- `apps/web/src/features/billing/plan.ts` `getPlanProblem` belum mengenal `limit: "jobSearchesPerDay"` (saat ini terbaca seperti batas resume). Tambahkan cabangnya bersama pesan Lingui saat halaman Lowongan dibuat.
- Kartu tidak membawa `description`; detail lewat `jobs.listing`. `requirementsSummary` ada di kartu bila penyedia memberinya.
- Tampilkan `stale`/`budgetLimited` sebagai pesan ringan ("hasil tersimpan; coba lagi besok"), dan sisa kuota dari `quota`.
