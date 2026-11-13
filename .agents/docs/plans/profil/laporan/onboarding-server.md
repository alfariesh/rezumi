# Laporan sesi server: onboarding sumber Profil

Ditulis 2026-11-13, kontrak `../onboarding.md` bagian 3 dan 4. Tidak ada commit. Semua cek di bagian akhir dijalankan sungguhan.

## Selesai

### Skema dan penggabungan

- `packages/schema/src/profile/sources.ts` (ekspor baru `@rezumi/schema/profile/sources`): `sourceResultSchema`/`SourceResult`, `sourcesStatusSchema`/`SourcesStatus`, `SOURCE_NOTES`/`SourceNote`, dan pembaca alamat murni `linkedInProfileId`, `linkedInProfileUrl`, `gitHubLogin`. Tes: `sources.test.ts`.
- `packages/resume/src/profile.ts`: `mergeProfileData(base, addition)`. Tes di `profile.test.ts` (isi yang kosong, kunci tanpa beda huruf/spasi, duplikat di sumber, ID bentrok, urutan sumber).

### Pemetaan murni (`packages/import`)

- `src/linkedin.ts`: `parseLinkedInProfile(item)` → `ResumeData` dan `linkedInProfileNotes(item)` → `SourceNote[]`. Memakai helper tanggal/bahasa LinkedIn yang sudah ada di file itu. Toleran: field `null` atau tidak ada, tanggal tahun saja, `{ text: "Present" }`, spasi di nama perusahaan, array section yang absen, `topSkills` sebagai cadangan skill, `websites[0]` sebagai situs, foto ukuran 400 px dari `profilePicture.sizes` (lalu `photo`), logo perusahaan/sekolah diabaikan, profil LinkedIn sendiri masuk ke section Profiles. Catatan `truncated` bila `sectionTotals` lebih besar dari yang datang; `private-profile` bila hanya nama/headline. Tes: `linkedin-profile.test.ts` (orang fiktif).
- `src/github.ts` (ekspor baru `@rezumi/import/github`): `parseGitHubProfile({ user, repos })`. Proyek: repo milik sendiri, bukan fork/arsip, bintang lalu terbaru, maks 6. Skill: bahasa repo menurut jumlah repo, maks 10. Profiles: GitHub (+ X bila ada). Tes: `github.test.ts`.

### API (`packages/api/src/features/profile/sources/`)

- `router.ts`: `profile.sources.status | linkedin | github | website | adoptPhoto`, tag `Internal`, dipasang di `profileRouter.sources`.
- `linkedin.ts`: Apify REST `POST https://api.apify.com/v2/acts/<actor>/run-sync-get-dataset-items?timeout=60&maxItems=1&maxTotalChargeUsd=0.05&format=json&clean=true`, token di header `Authorization: Bearer`, input `{ profileScraperMode: "Profile details no email ($4 per 1k)", queries: ["https://www.linkedin.com/in/<id>"] }` (alamat kanonik, bukan id saja, supaya tidak dibaca sebagai pencarian). Batas tunggu fetch 75 detik. Status 4xx dari Apify dicatat di log hanya sebagai kode status. Tanpa SDK.
- `github.ts`: API resmi `/users/<login>` dan `/users/<login>/repos?type=owner&sort=pushed&per_page=100`; token urut: token OAuth GitHub milik akun (lewat Better Auth), `GITHUB_API_TOKEN`, tanpa token (401 → coba berikutnya). Login GitHub untuk `status` dari `GET /user/<id GitHub>` (batas 5 detik, gagal → null).
- `website.ts`: alamat dinormalkan ke https, lalu di dalam `runWithAiSource` (aksi `profile-website`): `readPage` yang ada, lalu `aiService.parseWebsite` (baru, `packages/api/src/features/ai/service.ts`) yang memakai jalur impor file yang sama (template ekstraksi, `sanitizeAndParseResumeJson`), teks halaman dibungkus `dataBlock("PAGE", …)`. Halaman dibaca setelah sumber AI pasti, jadi tanpa AI tidak ada yang dibaca; gagal baca atau hasil kosong mengembalikan kredit.
- `photo.ts`: `adoptPhoto` memakai `fetchRemote`/`remoteUrl` dari `portfolio/remote.ts` dengan allowlist host (juga untuk redirect), hanya https, hanya gambar, maks 5 MB, lalu `processImageForUpload` + `uploadFile` yang sama dengan `storage.uploadFile` (di Workers tidak di-resize karena `FLAG_DISABLE_IMAGE_PROCESSING`).
- `limits.ts`: batas harian lewat `createRateLimiter` (Redis / Coordination / memori): LinkedIn 3, GitHub 10 per akun per 24 jam, dihitung tepat sebelum panggilan keluar (setelah validasi alamat). Berlaku juga di luar production (biaya Apify); hanya `FLAG_DISABLE_API_RATE_LIMIT` yang mematikan.
- `account.ts`, `status.ts`, `errors.ts`, `result.ts`: akun + login tertaut, status, kode error, `sourceResult` (foto dipisah ke `photoUrl`, `data.picture.url` dikosongkan).
- Tes `sources.test.ts` (21): tiap sumber dengan fetch/reader/AI/storage/DB palsu: sukses, tidak ditemukan, penyedia gagal, waktu habis, batas harian, tamu ditolak, alamat tidak sah (host selain LinkedIn ditolak tanpa panggilan apa pun), token Apify tidak ada di URL/pesan/log, allowlist `adoptPhoto` (host lain, http, redirect keluar, bukan gambar, unggahan sendiri).

### Lain-lain

- `packages/auth/src/config.ts`: `providerAccessToken(userId, providerId)` lewat `auth.api.getAccessToken({ body: { accountId, userId } })` (cara resmi Better Auth: dekripsi + refresh). Null bila tidak tertaut atau gagal.
- `packages/ai/src/prompts.ts` + `prompts/website-parser-user.md`: `websiteParserSystemPrompt` (varian `parser-system.md`: hanya teks di antara penanda PAGE, tidak menambah kalimat/angka/jabatan/tanggal) dan `websiteParserUserPrompt`. (`packages/ai` disentuh karena prompt lain ada di sana.)
- Kredit: `"profile-website": 2` di `CREDIT_COSTS` (+ tes katalog) dan `AI_WORK_LIMITS` (16k token keluar, 120k karakter masuk).
- `resume.create`: input `template?` (lihat Cross-area), `createResumeData({ template })` menerapkan `applyTemplatePreset`; tes di `crud.test.ts`.
- Env: `APIFY_TOKEN`, `APIFY_LINKEDIN_ACTOR` (default `harvestapi~linkedin-profile-scraper`, `owner/name` diubah ke `owner~name`), `GITHUB_API_TOKEN` di `packages/env/src/server.ts` (+ tes), `.env.example`, `turbo.json` (`globalPassThroughEnv` + tiga daftar env tes), `docs/self-hosting/environment-variables.mdx` (bagian baru "Profile sources") dan `docs/self-hosting/cloudflare.mdx` (langkah 5).
- `docs/spec.json` diperbarui lewat `pnpm docs:gen`: hanya `template` di `createResume` (rute sumber `Internal`, tidak masuk spec).

## Cross-area

### Skema bersama `@rezumi/schema/profile/sources`

```ts
import { sourceResultSchema, sourcesStatusSchema, SOURCE_NOTES, linkedInProfileId, gitHubLogin, linkedInProfileUrl } from "@rezumi/schema/profile/sources";
import type { SourceResult, SourcesStatus, SourceNote } from "@rezumi/schema/profile/sources";

type SourceResult = {
  data: ProfileData;          // hanya yang ditemukan; sisanya kosong. Item ber-id. data.picture.url selalu "" (foto di photoUrl)
  photoUrl: string | null;    // URL foto asli di sumber (media.licdn.com berkedaluwarsa), belum disalin
  notes: string[];            // kode: "private-profile" | "no-public-repos" | "truncated" (SOURCE_NOTES)
};

type SourcesStatus = {
  linkedin: boolean;          // APIFY_TOKEN terpasang dan bukan tamu
  github: boolean;            // selalu true
  website: boolean;           // bukan tamu
  account: {
    name: string; email: string;      // "" untuk tamu
    image: string | null;
    githubUsername: string | null;    // login GitHub dari akun GitHub yang tertaut (null bila tidak ada / GitHub gagal)
    providers: string[];              // providerId yang tertaut, tanpa "credential": "github", "google", "linkedin", "apple", ...
  };
};

linkedInProfileId(input: string): string | null   // "linkedin.com/in/x", "https://id.linkedin.com/in/x/", atau "x" → "x"; host lain → null
gitHubLogin(input: string): string | null         // "octocat", "@octocat", "github.com/octocat" → "octocat"
```

Klien boleh memakai `linkedInProfileId` / `gitHubLogin` untuk validasi sebelum memanggil server (server memakai fungsi yang sama).

### Penggabungan `@rezumi/resume/profile`

```ts
mergeProfileData(base: ProfileData, addition: ProfileData): ProfileData
```

Murni, tidak mengubah `base`. Mengisi `basics` yang kosong (per field), foto, ringkasan; menambah item yang belum ada. Kunci (huruf besar/kecil dan spasi berlebih diabaikan): pengalaman perusahaan+posisi; pendidikan sekolah+gelar; sertifikat/penghargaan/publikasi judul; relawan organisasi; profil network; bahasa `language`; proyek/skill/minat/referensi nama. Duplikat di dalam `addition` ditambah sekali. ID item yang bentrok dengan `base` diganti ID baru. Urutan: `[file, linkedin, github, website].reduce(mergeProfileData, base)`.

### Router `profile.sources.*` (oRPC, `protectedProcedure`, tag `Internal`)

```ts
orpc.profile.sources.status()                                   -> SourcesStatus            // GET  /profile/sources
orpc.profile.sources.linkedin({ url })                          -> SourceResult             // POST /profile/sources/linkedin
orpc.profile.sources.github({ username })                       -> SourceResult             // POST /profile/sources/github
orpc.profile.sources.website({ url, aiSource?, idempotencyKey? }) -> SourceResult           // POST /profile/sources/website
orpc.profile.sources.adoptPhoto({ url })                        -> { url: string }          // POST /profile/sources/photo
```

- `url` LinkedIn: maks 300 karakter, alamat `linkedin.com/in/<id>` (subdomain negara boleh) atau id saja.
- `username` GitHub: maks 200, username, `@username`, atau `github.com/username`. Tamu boleh.
- `url` situs: maks 2048; tanpa skema diberi `https://`, `http://` dinaikkan ke `https://` (pembaca hanya https).
- `adoptPhoto`: hanya `https://media.licdn.com`, `https://avatars.githubusercontent.com`, `https://*.googleusercontent.com`; alamat unggahan aplikasi sendiri (`APP_URL/api/uploads/...` atau `/api/uploads/...`, `/uploads/...`) dikembalikan apa adanya. Hasil = URL lengkap `APP_URL/api/uploads/<userId>/pictures/<uuid>.jpg`, bentuk yang sama dengan `storage.uploadFile` (yang dipakai foto CV), **bukan** path relatif seperti tertulis di kontrak. Panggil hanya untuk foto yang dicentang saat review, lalu taruh hasilnya di `data.picture.url` sebelum `profile.update`.

Error (kode oRPC; dideklarasikan di `.errors()` sehingga bertipe di klien):

| Kode                 | Status | Kapan                                                                                                                                  |
| -------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `SOURCE_UNAVAILABLE` | 409    | LinkedIn tanpa `APIFY_TOKEN`; tamu memanggil `linkedin` atau `website`                                                                 |
| `SOURCE_NOT_FOUND`   | 404    | profil/akun tidak ada atau tertutup; halaman tidak ditemukan/kosong; AI tidak menemukan data diri                                      |
| `SOURCE_INVALID`     | 400    | bukan alamat LinkedIn `/in/`, username GitHub tidak sah, alamat situs tidak sah/privat, foto bukan host yang dikenal atau bukan gambar |
| `SOURCE_LIMIT`       | 429    | LinkedIn 3/akun/hari, GitHub 10/akun/hari; situs: batas baca halaman bersama (per menit)                                               |
| `SOURCE_FAILED`      | 502    | penyedia gagal, menolak, atau waktu habis                                                                                              |

`website` juga melempar error AI biasa (`INSUFFICIENT_CREDITS`, `AI_SOURCE_REQUIRED`, `REZUMI_AI_UNAVAILABLE`, `BAD_REQUEST` "Test and turn on an AI provider…", `BAD_GATEWAY`, `CONFLICT` untuk `idempotencyKey` yang sama) dan, di production, `TOO_MANY_REQUESTS` dari batas permintaan AI per menit yang sama dengan rute AI lain; `adoptPhoto` memakai batas unggahan yang sama dengan `storage.uploadFile`. Pesan semua error berbahasa Inggris, aman ditampilkan, tidak memuat token atau data sumber.

### `resume.create`

Input baru opsional `template?: Template` (ID lama diterima dan diganti penggantinya). CV baru mendapat template itu **dengan preset-nya** (`applyTemplatePreset`: font, aksen, tata letak entri, bentuk foto), sama dengan pratinjau galeri. Template premium tanpa paketnya → `PLAN_FEATURE_REQUIRED` 403 (pemeriksaan `assertDesignChange` yang sama dengan perubahan desain lain); CV tidak dibuat.

### Aksi kredit baru (sesi web)

`"profile-website"` = 2 kredit (`CREDIT_COSTS`, `AI_WORK_LIMITS`). Tambahkan nama tampilan di `apps/web/src/features/billing/credits.ts` `getCreditActionName` (mis. "Website read into your Profile"); pakai `<AiSourceMenu action="profile-website" />` di langkah situs dan kirim `aiSource` + `idempotencyKey` baru per percobaan, seperti fitur AI lain.

### Principal

- Tidak ada migrasi baru.
- Cek seluruh workspace (`pnpm typecheck`, `pnpm lint:agent`, `pnpm format:check`, `pnpm check:cloudflare`) belum dijalankan oleh sesi ini; yang dijalankan per paket ada di bawah.

### Owner (sebelum rilis)

1. Buat akun di apify.com, buka **Settings → API & Integrations**, salin **Personal API token**.
2. Isi saldo/paket Apify. Aktor `harvestapi~linkedin-profile-scraper` menagih sekitar $0,004 per profil; tiap baca dibatasi $0,05 dan 3 baca per akun Rezumi per hari.
3. Pasang sebagai secret Worker: `pnpm exec wrangler secret put APIFY_TOKEN` (lalu deploy ulang). Tanpa token, pilihan LinkedIn tidak muncul; GitHub, situs dan unggah file tetap jalan.
4. Opsional: `pnpm exec wrangler secret put GITHUB_API_TOKEN` (token GitHub tanpa scope) supaya pengguna yang tidak login dengan GitHub tidak kena batas anonim GitHub (60 permintaan/jam per alamat server, dan Workers berbagi alamat).
5. Untuk uji lokal: taruh `APIFY_TOKEN=...` di `.env.local`; batas 3 per hari juga berlaku lokal kecuali `FLAG_DISABLE_API_RATE_LIMIT=true`.

## Belum selesai

- Aktor Apify tidak pernah dipanggil dari sesi ini (tidak ada token); pemeta dibangun dari bentuk keluaran di brief plus fakta tambahan principal (nilai `null`, tanggal tahun saja, `websites`, `profilePicture.sizes`, `sectionTotals`). Uji sekali dengan token asli sebelum rilis, termasuk profil yang tidak ada (bentuk jawaban aktor untuk profil tidak ditemukan diasumsikan: array kosong atau item dengan `status` ≠ 200).
- GitHub dan situs pribadi juga belum diuji ke layanan asli (semua panggilan keluar dipalsukan di tes, sesuai aturan).
- `status` memanggil GitHub (`/user/<id>`) tiap kali akun punya login GitHub tertaut; tidak di-cache.
- Teks privasi (Apify dan GitHub sebagai pemroses) milik sesi web/owner.

## Cek yang dijalankan

- Typecheck: `@rezumi/schema`, `@rezumi/resume`, `@rezumi/import`, `@rezumi/auth`, `@rezumi/env`, `@rezumi/ai`, `@rezumi/api`, `server`, `mobile`, `web` (web saat itu juga lolos, dengan perubahan sesi web yang sedang berjalan): semua lolos.
- Tes (suite DB nyata aktif lewat `*_TEST_DATABASE_URL` → `127.0.0.1:55432/rezumi_profile_test`): `@rezumi/api` 120 berkas / 1408 tes, `@rezumi/schema` 250, `@rezumi/resume` 250, `@rezumi/import` 94, `@rezumi/env` 74, `@rezumi/auth` 53, `@rezumi/ai` 8, `server` 326, `@rezumi/mcp` 21, `web` `src/features/docs` 15: semua lolos.
- `vp lint --deny-warnings` dan `vp fmt --check` untuk semua berkas yang diubah: bersih. `pnpm exec turbo boundaries`: tidak ada masalah. `pnpm docs:gen`: dijalankan.
