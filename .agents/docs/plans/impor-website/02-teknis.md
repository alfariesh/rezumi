# Rancangan teknis — impor website (untuk agent)

Path dan nama di sini dari eksplorasi 2026-11-26. Cek ulang dengan graph + grep sebelum mengandalkannya. Bagian baru ditambahkan di akhir dokumen, bukan disisipkan.

## 1. Kondisi sekarang

- **Sumber Website Profil:** `packages/api/src/features/profile/sources/website.ts` (`readWebsite`). Membaca **satu** halaman lewat `readPage` lalu `aiService.parseWebsite` (`packages/api/src/features/ai/service.ts`) mengubah teksnya jadi `ResumeData` → `SourceResult`. Harga `profile-website: 2` di `packages/schema/src/billing/catalog.ts`; batas token di `packages/api/src/features/billing/metered-ai.ts` (`maxInputChars: 120_000`). Router: `packages/api/src/features/profile/sources/router.ts` (`profile.sources.website`, tag Internal). Hanya untuk non-tamu.
- **Pembaca web:** `packages/api/src/features/web/service.ts` (`readPage`): baca langsung (`builtin.ts`, cek alamat publik di tiap redirect), lalu Cloudflare Browser Run `/content` (`browser.ts`) bila tidak ada teks. `BROWSER_READS_PER_DAY = 20` per orang. Hasil `ReadPageResult` hanya berisi **teks** (`content`), bukan link atau gambar.
- **Alur sumber di web:** `apps/web/src/features/profile/sources/` (`use-source-runs.ts` menjalankan sumber berdampingan di browser; `source-progress.tsx`, `source-review.tsx`, `source-fields.tsx`). Langkah onboarding di `packages/career/src/onboarding.ts`: `bring → questions → review → resume`. Halaman: `apps/web/src/features/onboarding/onboarding-page.tsx`; isi Profil di luar onboarding: `apps/web/src/features/profile/fill.tsx`. Aturan input sumber: `packages/resume/src/profile-sources.ts` (`SourceInputs`, `websiteAddress`, `linkedinOwn` sebagai contoh centang "milik saya").
- **Portfolio:** `packages/api/src/features/portfolio/service.ts`. `create` (sumber: resume atau Profil, lewat `startingSource`), `importWorks` (work dari proyek sumber, `workFromResumeProject`, `fromResumeItemId`, lewati yang sudah ada, `saveVersionedData`). Skema work: `packages/schema/src/portfolio/data.ts` (title, summary ≤240, role, date, tags, cover, primaryLink, blocks, `fromResumeItemId`). Blok: `packages/schema/src/portfolio/blocks.ts` (`text, images, metrics, video, embed, pdf, link`). Batas: `packages/schema/src/portfolio/limits.ts` (`works: 50`, `blocksPerWork: 30`, `imagesPerBlock: 12`, `PORTFOLIO_UPLOAD.imageBytes 2,5 MB`, `imageSide 2000`, `remoteImageBytes 10 MB`). Batas paket: `PLANS.*.limits.portfolioWorks` (Gratis 6, berbayar 50) dan `portfolioStorageBytes` (Gratis 100 MB, berbayar 1 GB).
- **Media portfolio:** `packages/api/src/features/portfolio/media.ts`: `addImage` (dari URL publik atau file; buang metadata; catat ke kuota; simpan ke R2; **tidak memperkecil**, gambar harus sudah ≤ `imageBytes` dan `imageSide`), `fetchRemoteImage`, `unfurl` (`unfurl.ts`: video YouTube/Vimeo, embed Figma/Loom/Spotify/SoundCloud/Slides, kartu link; cache sehari). Di Workers, gambar diperkecil lewat binding `IMAGES` (`configureImageProcessor` di `apps/server/src/cloudflare/index.ts`); di Node lewat sharp.
- **Streaming oRPC** sudah dipakai (event iterator) di `packages/api/src/features/cover-letters/router.ts` dan `resume/event-router.ts`: contoh untuk progres.
- Worker: `limits.cpu_ms = 30000` di `wrangler.jsonc`. Tidak ada batas waktu dinding untuk request HTTP selama klien terhubung, tetapi CPU dibatasi.

## 2. Arsitektur ringkas

Dua prosedur streaming baru, keduanya menghasilkan event progres lalu hasil akhir:

```
[browser] profile.sources.websiteImport({ url, own: true, aiSource })   ── stream ──>
   1. baca beranda (teks + link + gambar)                      → event "reading"
   2. AI #1: data Profil + daftar halaman karya (≤10)          → event "found", n
   3. baca halaman karya paralel (maks 4 sekaligus)            → event "page", i/n
   4. AI #2: draf works (dari semua halaman, satu panggilan)   → event "extracting"
   5. simpan hasil ke tabel website_import (24 jam)            → event "done", { runId, profile: SourceResult, works: WorkDraft[] }

[browser] review: Profil + "Karya dari situsmu" (semua dicentang)
[browser] profile.update(...)  (seperti sekarang; proyek ikut, D3)
[browser] portfolio.importSiteWorks({ runId, workIds })        ── stream ──>
   1. pastikan proyek Profil ada (D3), buat portfolio bila belum (D4)
   2. salin gambar (maks 4 sekaligus), perkecil, cek kuota     → event "image", i/n
   3. bangun blok, simpan dengan saveVersionedData            → event "done", PortfolioDto + catatan
```

Prosedur lama `profile.sources.website` **tetap** dan tidak berubah perilakunya: app mobile versi lama masih memakainya (aturan kompatibilitas di `CLAUDE.md`). Tanpa centang "milik saya" (D1), web tetap memanggil prosedur lama.

Kenapa tidak di antrean (Queue): sumber lain juga berjalan di request dari browser selama onboarding, dan satu impor diperkirakan 30–90 detik. **Ukur di Phase 01.** Bila p95 > 120 detik atau CPU mendekati 30 detik, catat di bagian akhir dokumen ini dan usulkan Cloudflare Workflows/Queue ke pemilik sebelum mengubah arsitektur.

## 3. Membaca halaman: teks, link, gambar

Tambah fungsi di `features/web` (mis. `readPageDocument(url, ctx)`) yang memakai jalur `readPage` yang sama (cek alamat publik, batas ukuran, fallback Browser Run) tetapi mengembalikan juga dari HTML:

- `links`: `{ href, text }[]` absolut, tanpa fragmen, dedupe; dipisah `sameSite` (host sama atau subdomain) dan `external`.
- `images`: `{ src, alt, width?, height?, context }[]` dari `og:image`, `twitter:image`, `<img>` (`src`, `srcset` → ambil yang terbesar ≤ 2000 px), `<picture><source>`. Buang `data:`, SVG, favicon, gambar < 200 px bila ukurannya diketahui, pelacak 1×1. `context` = teks pendek di dekatnya (alt, caption, heading terdekat) untuk AI.
- `embeds`: URL video/embed yang dikenali secara deterministik dengan `parseVideoUrl` / `parseEmbedUrl` (`packages/schema/src/portfolio/{video,embed}.ts`), dari `<iframe src>` dan link.
- `sitemap`: bila beranda, coba `/sitemap.xml` (batas ukuran sama, hanya `<loc>` dengan host sama, maks 200 URL).

Parsing HTML di Workers tanpa DOM: pakai yang sudah dipakai `link-meta.ts` / `builtin.ts` (`htmlToText`). Jangan menambah dependensi berat tanpa cek bundel (`pnpm check:cloudflare`).

**Batas Browser Run:** satu impor maks 11 halaman. Halaman di dalam impor tidak dihitung ke `BROWSER_READS_PER_DAY` (D2); sebagai gantinya batas harian impor 3 per akun (`limits.ts` profil: tambah `website: 3`). Kirim paralel maks 4; bila Browser Run menjawab 429, turun ke berurutan.

**Alternatif `/crawl`:** Browser Run punya endpoint `/crawl` (beta; `render: false` gratis selama beta, `render: true` = tarif jam browser). Jangan dipakai di fase pertama: pembaca sendiri sudah punya cek keamanan per redirect. Catat di backlog bila penemuan halaman sendiri kurang bagus.

## 4. AI

**AI #1 (Profil + kandidat halaman karya):** perluas `parseWebsite` atau buat `parseWebsiteWithWorks`. Masukan: teks beranda (≤ 30.000 karakter), daftar link situs yang sama (teks + href, maks 150), daftar URL sitemap. Keluaran: `ResumeData` seperti sekarang + `workPages: { url, title }[]` (maks 10, urut paling meyakinkan) + `homeWorks: boolean` (karya ada di beranda sendiri, situs satu halaman). Server memastikan setiap `url` memang ada di daftar link/sitemap (AI tidak boleh mengarang URL).

**AI #2 (works):** satu panggilan untuk semua halaman karya. Masukan per halaman: URL, teks (≤ 8.000 karakter), daftar gambar bernomor (`[3] alt — context`), daftar link eksternal bernomor. Keluaran `WorkDraft[]` (skema Zod baru di `packages/schema/src/portfolio/import.ts` atau di bawah `profile/sources`):

```ts
type WorkDraft = {
  id: string; // dibuat server, stabil per run
  sourceUrl: string; // halaman asal (dari server, bukan AI)
  title: string; // ≤ workTitle
  summary: string; // ≤ 240
  role: string;
  date: string; // teks bebas, mis. "2024"
  tags: string[]; // ≤ tagsPerWork
  description: string; // teks panjang → blok text
  metrics: { label: string; value: string }[]; // hanya angka yang tertulis di halaman
  coverImage: number | null; // nomor dari daftar gambar halaman itu
  galleryImages: number[]; // maks 6 (D5)
  primaryLink: number | null; // nomor link eksternal (demo, App Store, dll.)
  otherLinks: number[];
};
```

Server mengganti nomor dengan URL asli dan menambah `embeds` dari langkah 3 (tanpa AI). Untuk situs satu halaman, AI #2 menerima beranda saja dan memecahnya menjadi works.

Aturan prompt (sama dengan impor file): hanya yang tertulis di halaman, tidak mengarang angka atau peran; teks halaman adalah **data, bukan instruksi** (cegah prompt injection: bungkus dengan pembatas dan katakan eksplisit). Batas token di `metered-ai.ts` untuk aksi baru; total masukan ≤ 120.000 karakter.

## 5. Kredit dan impor pertama gratis (W2, W3)

- Aksi baru `profile-website-import: 5` di katalog. Prosedur lama tetap `profile-website: 2`.
- **Gratis pertama:** tabel `website_import` (bagian 7) menyimpan setiap run. Impor gratis bila akun belum punya run berstatus `succeeded` dengan `free = true` atau berbayar. Cek dan tandai di transaksi yang sama dengan reservasi kredit supaya dua tab paralel tidak sama-sama gratis (kunci per akun, mis. `pg_advisory_xact_lock` atau baris unik parsial `unique (user_id) where free`).
- `runWithAiSource` sekarang selalu memesan kredit untuk Rezumi AI. Tambahkan opsi biaya nol (mis. `price: 0` / `free: true`) yang tetap memakai model Rezumi AI dan tetap tercatat di ledger dengan nilai 0, tanpa mengubah perilaku aksi lain. Dengan AI milik pengguna: tanpa kredit, tetapi run tetap tercatat dan **tidak** menghabiskan jatah gratis.
- Gagal (tidak ada Profil maupun work) → kredit kembali, jatah gratis tetap ada.
- Biaya operator untuk impor gratis = biaya model Rezumi AI untuk ±2 panggilan besar. Catat token di Phase 01 dan laporkan perkiraan biaya per impor ke pemilik.

## 6. Hasil, review, dan simpan

- Hasil run disimpan di `website_import.result` (jsonb) selama 24 jam, lalu dikosongkan oleh pemeliharaan harian yang sudah ada (cari tick cron career/portfolio cleanup). Baris run tetap ada untuk jatah gratis dan metrik.
- Browser menerima `runId` + draf. Simpan hanya lewat `runId` + `workIds` yang dipilih: server tidak menerima URL gambar atau teks dari klien untuk impor ini (mencegah klien menyuntikkan URL lain).
- Tab ditutup di tengah impor: request terputus, AI dibatalkan (`signal`), kredit kembali. Hasil yang sudah selesai (status `succeeded`) bisa diambil lagi dengan `profile.sources.websiteImportResult({ runId })` selama 24 jam: pakai ini bila onboarding dimuat ulang (run id disimpan di state onboarding yang sudah ada).

**`portfolio.importSiteWorks({ runId, workIds })`** (streaming):

1. Baca run (milik akun, belum kedaluwarsa). Saring `workIds` ke yang ada.
2. **Proyek Profil (D3):** untuk tiap work, cari proyek Profil dengan URL sama (`sourceUrl` atau `primaryLink`); bila tidak ada, tambahkan proyek (name, description = summary, date, website). Pakai aturan simpan Profil yang ada (versi/konflik). Browser sudah menyimpan Profil hasil review lebih dulu; langkah ini hanya menambah yang belum ada.
3. **Portfolio (D4):** bila belum ada, `portfolioService.create` dengan sumber Profil, tidak tayang. Bila sumber portfolio adalah resume (bukan Profil), works tetap ditambahkan tanpa `fromResumeItemId`.
4. **Kuota works (W4):** sisa = `PLANS[plan].limits.portfolioWorks − works sekarang`. Bila lebih dari sisa → error yang jelas (UI sudah membatasi centang; ini penjaga server).
5. **Gambar (W5, D5):** per work sampul + ≤6 galeri, paralel maks 4. Ambil dengan jalur `fetchRemoteImage` (cek publik, ≤10 MB), perkecil ke `imageSide`/`imageBytes` dengan pemroses gambar yang sudah dikonfigurasi (Images di Workers, sharp di Node; pastikan jalur ini memang tersedia untuk server, bukan hanya upload browser), lalu jalur `addImage` (buang metadata, catat kuota, R2). Cek kuota sebelum tiap gambar; kuota habis → berhenti menyalin gambar, lanjut simpan works tanpa gambar, catatan `storage-full`. Gambar gagal → catatan `images-skipped: n`.
6. **Blok per work:** `text` (description) → `metrics` (bila ada; `highlightMetricId` metrik pertama) → `images` (galeri, layout `grid`) → `video`/`embed` (dari embeds, lewat parser yang sama dengan `unfurl`) → `link` untuk `otherLinks`. `primaryLink` ke kolom work. `cover` = sampul. Slug unik seperti `workFromResumeProject`. Tandai asal impor (mis. `fromResumeItemId` ke proyek Profil; tambahkan kolom opsional `importedFrom: { url }` di skema work hanya bila perlu untuk "Sudah ada", dengan `kit.optional` supaya data lama tetap valid).
7. Simpan dengan `saveVersionedData` dalam satu transaksi setelah semua gambar siap. Gambar yang sudah tersimpan tetapi works gagal disimpan menjadi file tak terpakai yang dibersihkan job yang ada (`deleteUnusedFiles`); pastikan itu benar.

## 7. Data

Tabel baru `website_import` di `packages/db/src/schema/profile.ts` (atau file sendiri):

| Kolom                       | Isi                                                                 |
| --------------------------- | ------------------------------------------------------------------- |
| `id` uuid                   | run id                                                              |
| `user_id`                   | FK user, hapus berantai                                             |
| `url`                       | alamat yang dibaca (hasil resolve)                                  |
| `status`                    | `running` / `succeeded` / `failed`                                  |
| `free` boolean              | impor gratis pertama                                                |
| `credits` int               | kredit yang dipotong (0 bila gratis atau AI sendiri)                |
| `pages_read`, `work_count`  | angka untuk metrik                                                  |
| `result` jsonb null         | `{ profile: SourceResult, works: WorkDraft[] }`, dikosongkan 24 jam |
| `result_expires_at`         |                                                                     |
| `created_at`, `finished_at` |                                                                     |

`pnpm db:generate`, baca SQL-nya. Hapus akun → baris ikut terhapus. Tidak menyimpan teks halaman mentah.

## 8. Keamanan dan privasi

- Hanya alamat publik (pembaca yang ada). Tidak mengikuti link ke host lain kecuali gambar (CDN situs sering di host lain: izinkan, tetap lewat cek publik).
- Centang "Ini situs saya sendiri" (D1) wajib di server untuk prosedur baru (`own: true`), seperti `linkedinOwn`.
- Teks halaman = data, bukan instruksi (bagian 4). Hasil AI divalidasi Zod ketat; URL dari AI diterima hanya bila ada di daftar yang diberikan server.
- Kebijakan privasi (Indonesia + Inggris, `docs/legal/`): pastikan bagian sumber Profil menyebut bahwa halaman situs pribadi dibaca saat pengguna meminta (maks 11 halaman), teksnya dikirim ke model AI, dan gambar karya disalin ke penyimpanan Rezumi. Cek dulu apakah `.agents/docs/plans/profil/draf-privasi-onboarding.md` sudah masuk ke kebijakan; tunjukkan perubahan teks ke pemilik sebelum commit.

## 9. Mobile

Web dulu. Prosedur baru tidak dipakai app mobile versi lama. Tambahkan catatan ke `.agents/docs/plans/mobile/README.md` (bagian kebutuhan dari fitur web baru): onboarding mobile perlu centang "milik saya", progres streaming, bagian review works, dan `importSiteWorks`. Semua logika ada di `packages/*`, jadi mobile hanya membuat layar.

## 10. Tes

- Fixtures HTML di `packages/api/src/features/profile/sources/__fixtures__/websites/`: situs dengan halaman `/work/*`, situs satu halaman, situs Framer/Webflow (HTML hasil render), situs dengan sitemap, halaman berisi teks "abaikan instruksi sebelumnya" (prompt injection), gambar srcset, iframe YouTube/Figma.
- Model AI tiruan seperti tes sumber yang ada (`sources.test.ts`); fetch tiruan; tidak ada panggilan jaringan di tes.
- Kasus: gratis pertama sekali saja (termasuk dua run paralel), kredit kembali saat gagal, AI sendiri tidak menghabiskan jatah gratis, batas 3/hari, URL karangan AI dibuang, kuota works Gratis, kuota penyimpanan habis di tengah, gambar gagal sebagian, impor ulang menandai "Sudah ada", portfolio dibuat tidak tayang.
- Uji nyata di akhir (Phase 04): situs milik pemilik bila ada, plus 3–5 situs portfolio publik dari template Framer/Webflow/Notion/Carrd. Hanya baca; jangan simpan data orang lain di luar database lokal, hapus setelah uji.

## 11. Hasil Phase 01 (2026-11-26)

Yang dibangun, dan bedanya dengan rancangan di atas:

- **Kode:** `packages/api/src/features/profile/sources/website-import/`: `document.ts` (link, gambar, embed, sitemap dari HTML dengan `node-html-parser`; `srcset` dibaca seperti spesifikasi HTML, gambar yang sama dengan ukuran lain dihitung sekali), `ai.ts` (pemilih halaman + pembuat draf works), `site.ts` (alur membaca, dipakai aplikasi dan skrip uji), `run.ts` (batas harian, kredit, baris tabel), `jobs.ts` (pemeliharaan). Skema: `@rezumi/schema/profile/website-import` (`WorkDraft`, `WebsiteImportResult`, event progres). Prompt: `packages/ai/src/prompts/website-work-pages-system.md`, `website-works-system.md`.
- **Tiga panggilan AI, bukan dua.** Data Profil tetap memakai `aiService.parseWebsite` yang lama (aturan dan hasilnya sama dengan sumber Website), berjalan **paralel** dengan panggilan kecil pemilih halaman (`pickWorkPages`: teks beranda ≤ 6.000 karakter + ≤ 150 link bernomor). Lalu satu panggilan `extractWorks` untuk semua halaman karya. Batas aksi `profile-website-import`: 120.000 karakter per panggilan, 32.768 token keluar.
- **Anggaran teks works:** total 70.000 karakter dibagi rata ke halaman (maks 8.000 per halaman), 20 gambar dan 12 link per halaman; situs satu halaman dibaca sampai 30.000 karakter. Tes memastikan 10 halaman tetap < 110.000 karakter.
- **Pembaca web:** `WebContext.allowance: "import"` melewati throttle per menit dan tidak memakai jatah 20 Browser Run harian; `readSitemapXml` membaca `/sitemap.xml` (8 detik, gagal = dilewati). `readBuiltinPage` sekarang menerima jenis konten (XML untuk sitemap).
- **Gratis pertama tanpa baris kredit.** `ai_credit_usage.credits` punya check `> 0`, jadi impor gratis tidak lewat ledger kredit: `startAiRun({ free: true })` menjalankan Rezumi AI tanpa reservasi (batas tetap berlaku, token dihitung, `AiRun.spent()`), dan token serta biayanya disimpan di baris `website_import` (`input_tokens`, `output_tokens`, `cost_usd_micros`). Index unik parsial `website_import_one_free` (user, `free` dan status `running`/`succeeded`) menjamin dua tab tidak sama-sama gratis; impor gagal membebaskan jatahnya. Impor dengan AI milik pengguna tidak memakai jatah gratis. **Akibat:** biaya impor gratis tidak muncul di laporan biaya AI yang membaca `ai_credit_usage`; ambil dari `website_import` (masuk backlog metrik admin).
- **Batas harian** dihitung dari tabel: 3 impor berjalan/berhasil per 24 jam, dan 10 percobaan termasuk yang gagal.
- **Endpoint:** `profile.sources.websiteImport` (POST `/profile/sources/website/import`, event iterator, input `{ url, own: true, aiSource, idempotencyKey }`) dan `profile.sources.websiteImportResult` (GET `/profile/sources/website/import/{runId}`). `profile.sources.status` mendapat `websiteImportFree` (opsional, supaya klien lama tetap jalan). Alamat Behance, Dribbble, dan LinkedIn ditolak dengan pesan yang mengarahkan.
- **Pemeliharaan:** `runWebsiteImportJobs` (ekspor `@rezumi/api/features/profile/website-import-jobs`) tiap menit di cron Worker dan scheduler Node: mengosongkan `result` setelah 24 jam, menggagalkan run yang masih `running` setelah 15 menit.
- **Migrasi:** `migrations/20261126085535_website_import`. Sudah diuji di Postgres lokal lewat tes integrasi (schema terisolasi); database dev pemilik tidak dimigrasi.
- **Untuk Phase 03:** label kredit `profile-website-import` di `apps/web/src/features/billing/credits.ts` (sekarang jatuh ke "Rezumi AI"), dan pemetaan aksi di `apps/mobile/src/features/billing/ai-source.ts` saat mobile menyusul.

### Pengukuran Phase 01

Skrip: `pnpm website:probe <alamat> --yes [--out file.json]` (`tooling/website-import/probe.ts`), memakai AI server dari `.env.local` (Claude Haiku 5.5) dan Browser Run bila perlu. Biaya AI total sesi ini ±$0,04.

| Situs                           | Total | Halaman dibaca | Works | Gambar                       | Token masuk / keluar | Biaya AI |
| ------------------------------- | ----- | -------------- | ----- | ---------------------------- | -------------------- | -------- |
| alfariesh.ai.id (milik pemilik) | 57 s  | 7              | 4     | sampul dari gambar preview   | 18.925 / 16.446      | $0,0101  |
| eliasvent.framer.website        | 37 s  | 6              | 5     | 4 sampul (2048 px), galeri 0 | 13.051 / 9.977       | $0,0063  |
| noahvesper.framer.website       | 78 s  | 9              | 8     | sampul + 6 gambar tiap work  | 25.963 / 22.770      | $0,0140  |

- Waktu terbesar: beranda + Profil + pemilih halaman (±24–26 s, didominasi panggilan Profil) dan pembuatan works (10–31 s, sebanding dengan token keluar). Membaca halaman karya hanya 0,4–1,3 s (paralel 4).
- p95 jauh di bawah 120 s dan pekerjaan CPU kecil (parsing HTML ≤ 11 halaman), jadi **request streaming biasa cukup**; tidak perlu Queue/Workflows.
- Situs pemilik tidak memakai tag `<img>` (gambar karya digambar dengan cara lain), jadi sampulnya gambar preview halaman; itu hasil yang benar.
- Temuan yang diperbaiki di sesi ini: `srcset` Framer tanpa spasi setelah koma membuat sampul terambil versi 512 px.
- Biaya operator per impor gratis ≈ $0,01 (Haiku 5.5), di bawah perkiraan maksimum $0,025.

## 12. Hasil Phase 02 (2026-11-26)

- **Endpoint:** `portfolio.importSiteWorks` (POST `/portfolio/works/import-site`, event iterator), input `{ runId, workIds }` (1–10). Event: `saving` → `picture` (`done`/`total`) → `done` dengan `added`, `alreadyThere`, `picturesSkipped`, `storageFull`, `created` (skema `siteWorksEventSchema` di `@rezumi/schema/profile/website-import`). Hasil impor yang sudah hilang atau milik akun lain: error baru `PORTFOLIO_IMPORT_GONE` (404). Phase 03 perlu menambah kalimatnya di `apps/web/src/features/portfolio/errors.ts`.
- **Kode:** `packages/api/src/features/portfolio/site-import.ts` (alur), `packages/portfolio/src/site-import.ts` (murni: `isSameWork`, `projectFromDraft`, `storyHtml`, `metricFromText`, `workFromDraft`, `hasWork`), `profileService.projectsForDrafts`, `portfolioService.saveBuiltWorks`.
- **Urutan:** baca hasil run (hanya draf milik run, dipilih per ID) → proyek Profil → buat portfolio bila belum ada → cek kuota works paket **sebelum** menyalin gambar → salin gambar (4 sekaligus) → simpan dalam satu transaksi (`saveVersionedData` pada versi yang dikunci).
- **Proyek Profil (D3):** draf dicocokkan dengan proyek yang sudah ada lewat link (halaman sumber atau link utama, tanpa skema/`www.`/garis miring) atau nama: sama persis, atau satu nama mengawali yang lain di batas kata dan minimal 4 huruf ("Rekanesia" = "Rekanesia: one product, many brands"). Yang tidak cocok ditambahkan di akhir dengan nama, periode, ringkasan, dan link utama (atau halaman sumber).
- **Portfolio baru (D4):** dibuat lewat `portfolioService.create` dengan sumber Profil, **tidak tayang**. Karena `create` otomatis membuat works dari semua proyek Profil, portfolio yang dibuat oleh impor diisi **hanya karya hasil impor**; proyek Profil lain tetap bisa ditambahkan lewat "Add works from the source" yang sudah ada.
- **Impor ulang:** draf dilewati bila portfolio sudah punya work dari proyek yang sama (`fromResumeItemId`) atau dengan judul sama. Tidak ada kolom baru di skema work.
- **Blok per work:** teks (paragraf dari cerita) → metrics (persen dan kelipatan jadi angka, teks ≤ 12 karakter jadi teks, sisanya dibuang; metrik pertama jadi sorotan kartu) → images (galeri, `grid`, atau `full` bila satu) → video (YouTube dengan thumbnail editor, Vimeo) / embed → link lain. `primaryLink` dan `cover` di kolom work.
- **Gambar (W5, D5):** diambil lewat jalur `fetchRemoteImage` (alamat publik, ≤ 10 MB). Gambar yang sudah ≤ 2.000 px dan ≤ 2,5 MB disimpan apa adanya, **tanpa diproses** (supaya tidak ada biaya Cloudflare Images). Yang lebih besar diperkecil ke 2.000 px JPEG q82: sharp di Node, binding Images di Workers. `processImageForUpload` dan `ImageProcessor` sekarang menerima ukuran; default tetap 800/80. Lalu lewat `portfolioMedia.addImage` (buang metadata, catat kuota, R2). Kuota habis (`PLAN_LIMIT_REACHED` atau `PORTFOLIO_STORAGE_FULL`) → berhenti menyalin, works tetap disimpan tanpa gambar, `storageFull: true`. Gambar gagal → dihitung di `picturesSkipped`. Gambar yang tersalin tapi tidak jadi disimpan (request putus) tetap tercatat tidak terpakai dan dihapus oleh `deleteUnusedPortfolioFiles` setelah masa tenggang.
- **Biaya gambar:** Cloudflare Images hanya dipakai untuk gambar > 2.000 px atau > 2,5 MB. Template Framer sering memberi 2.048 px, jadi umumnya ikut diperkecil. Pantau tagihan Images setelah rilis.
- **Uji lokal** (server dev worktree, database `rezumi_website_import`, hasil impor Noah Vesper dari Phase 01, tanpa biaya AI): 4 karya + 28 gambar dari framerusercontent dalam 7,5 detik. Portfolio dibuat belum tayang (publik 404). Setelah dipublikasikan manual, daftar karya tampil dengan sampul dan chip angka, dan halaman karya menampilkan cerita, angka besar (+32%, +41%, −18%), dan galeri. Impor ulang 3 karya: 2 dilewati, 1 ditambah, proyek Profil tidak dobel.

## 13. Hasil Phase 03 (2026-11-27)

- **Input (`@rezumi/resume/profile-sources`):** `SourceInputs.websiteOwn` (opsional, supaya state onboarding mobile lama tetap valid), `SourceAvailability.websiteImport`, permintaan `website` membawa `own`; kuncinya `<url>#own`, jadi mencentang membaca ulang sebagai impor. `websitePlatform` menolak alamat LinkedIn (`linkedin-site`) dan Behance/Dribbble (`platform-site`) sebelum apa pun berjalan (W6). Web menyalakan `websiteImport` bila `status.website`, server mengenal impor (`websiteImportFree` ada), dan `portfolio.status.enabled`.
- **Review karya (`@rezumi/portfolio/site-import`):** `importedDrafts` (draf yang portfolio sudah punya: lewat proyek Profil yang cocok `isSameWork` lalu `hasWork`, sama dengan penjaga server), `initialDraftChoice` (semua draf baru dicentang, sebanyak sisa kuota), `toggleDraft` (tidak bisa melewati kuota atau mencentang yang sudah ada).
- **Web:** `apps/web/src/features/profile/sources/site-import.ts` (`importSite` streaming, `saveSiteWorks`, `useSiteWorksRoom` dari `portfolio.get` `limits.works` − karya sekarang, `useDraftChoice`), `use-site-works.ts` (simpan + catatan gambar), `site-works-review.tsx` (kartu: sampul dari situs asli hanya untuk pratinjau, `referrerPolicy="no-referrer"`; detail dibuka di bawah kartu, baca saja), progres per tahap di `source-progress.tsx`, langkah `from-site.tsx` di dialog Tambah work editor portfolio + tombol di daftar Works kosong.
- **Reload:** onboarding tidak menyimpan state, jadi alih-alih `runId` di state onboarding, tab menyimpan `{ url, runId }` impor terakhir di `sessionStorage`. Impor ulang alamat yang sama di tab itu memakai `websiteImportResult` dulu (tanpa kredit atau jatah gratis lagi) selama hasilnya masih disimpan server. Satu impor berjalan sekaligus; impor yang tidak dipakai lagi (alamat diubah, centang dilepas, dialog ditutup) dibatalkan supaya kreditnya kembali.
- **Simpan:** onboarding menyimpan Profil dulu, lalu `importSiteWorks`, lalu membaca ulang Profil (proyek baru dari server) supaya langkah CV memakai versi terbaru. Isi Profil: edit Profil disimpan dulu (`saveProfileNow`), lalu karya; halaman Profil memuat versi baru sendiri, jadi Undo satu langkah tidak tersedia untuk isi yang datang bersama karya (toast tanpa Undo). Editor portfolio: `flush`, simpan, lalu `portfolio.get` → `applyServerEdit` (Undo mengembalikan ke sebelum impor).
- **Teks privasi:** disetujui pemilik dan dipasang 2026-11-27 (lihat `draf-privasi.md`): sumber Profil GitHub dan situs pribadi termasuk impor website. LinkedIn (treg/Apify) masih menunggu jawaban `[periksa]` draf profil.
- **Tes:** tidak ada spec Playwright. Pembaca website hanya menerima alamat publik (cek per redirect), jadi situs tiruan lokal ditolak; tes onboarding ujung-ke-ujung butuh stub di server. Logika input dan review dites di paket (`profile-sources.test.ts`, `site-import.test.ts`); alur layar dicek di server dev dengan hasil impor dari Phase 01 yang disalin ke akun uji (tanpa biaya AI).
