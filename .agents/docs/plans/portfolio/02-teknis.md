# Rancangan teknis — portfolio web

Untuk agent. Path di sini berasal dari eksplorasi 2026-11-05; cek ulang dengan graph dan grep sebelum mengandalkannya. Perbarui dokumen ini bila rancangan berubah saat implementasi. Nomor bagian dirujuk oleh dokumen phase; tambahkan bagian baru di akhir, jangan menomori ulang.

## 1. Yang sudah ada dan dipakai ulang

| Kebutuhan                       | Sudah ada                                                                                                                                                                                                            | Lokasi                                                                                                                                                                         |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Halaman web dirender server     | Halaman web CV: React → pohon host Forme → HTML (`toHtml`), dokumen dengan CSP dan skrip inline berhash, cache render per proses                                                                                     | `packages/pdf/src/html/*` (`web-page.tsx`, `document.ts`), `apps/server/src/static/resume-page.ts`                                                                             |
| Rute `/<username>`              | CV utama (`isProfilePath` → `serveResumePage(..., { primary: true })`), GET dan POST (form password)                                                                                                                 | `apps/server/src/http/app.ts`, `apps/server/src/static/web.ts`                                                                                                                 |
| Segmen pertama yang dicadangkan | `RESERVED_SEGMENTS`, `reservedProfileSegments`                                                                                                                                                                       | `packages/utils/src/app-paths.ts`, `apps/server/src/static/web.ts`                                                                                                             |
| Domain sendiri                  | Tabel `custom_domain` (satu per akun, TXT `_rx-verify.<host>`, kegagalan 7 hari mencabut), middleware host → CV utama, UI di Share CV                                                                                | `packages/db/src/schema/custom-domain.ts`, `packages/api/src/features/custom-domain/*`, `apps/server/src/http/custom-domain.ts`, `apps/web/src/features/resume/share/*domain*` |
| Kartu share                     | PNG dengan resvg-wasm, cache kecil, banner umum bila tidak publik                                                                                                                                                    | `apps/server/src/static/resume-card.ts`, `@rezumi/pdf/web-page-card`                                                                                                           |
| Statistik                       | `resume_statistics(_daily)`; dedupe kunjungan per jam (Redis, Durable Object, atau memori); pemilik dan bot tidak dihitung                                                                                           | `packages/db/src/schema/resume.ts`, `packages/api/src/features/resume/{view-dedup,access-policy,web-page}.ts`, `packages/api/src/features/statistics`                          |
| Unggahan publik                 | `uploads/<userId>/pictures/*` raster dilayani publik (cache 1 jam); file lain hanya untuk pemiliknya; pemilik dilarang/terhapus → 404                                                                                | `apps/server/src/static/uploads.ts`, `packages/api/src/features/storage/*`                                                                                                     |
| Teks halaman publik             | `webPageMessages(locale)` + `web-page-catalog.json`, dibuat `pnpm pdf:translations` dari katalog Lingui web                                                                                                          | `packages/pdf/src/html/messages.ts`, `tooling/locales/generate.ts`, `apps/web/src/features/resume/share/web-page-text.ts`                                                      |
| Pratinjau inert di editor       | Renderer yang sama di browser, dokumen di iframe tanpa skrip                                                                                                                                                         | `apps/web/src/features/resume/share/web-page-preview.tsx`                                                                                                                      |
| Editor teks kaya CV             | Tiptap 3 buatan sendiri (lazy load, AI Improve), subset HTML CV                                                                                                                                                      | `apps/web/src/features/resume/editor/write/rich-text-editor*.tsx`, `apps/web/src/components/input/rich-text-*.ts`                                                              |
| Komponen HeroUI Pro             | `RichTextEditor` (Tiptap, nilai JSON + `details.html`, menu slash), `KPI`/`KPIGroup` (butuh peer `recharts`), `TrendChip`, `NumberValue`                                                                             | `@heroui-pro/react/rich-text-editor`, `@heroui-pro/react/kpi`, `@heroui-pro/react` (MCP `heroui-pro` untuk dokumentasi)                                                        |
| Peta HeroUI Pro                 | `Map` berbasis MapLibre (`@heroui-pro/react/map`, peer `maplibre-gl`), contoh memakai gaya OpenFreeMap tanpa API key; worker MapLibre perlu dilayani sendiri (CSP `worker-src 'self' blob:`)                         | `@heroui-pro/react/map` (MCP `heroui-pro`, komponen `map`)                                                                                                                     |
| Workers Analytics Engine        | Tulis data point tanpa menunggu (`writeDataPoint`), dataset dibuat otomatis, kueri SQL lewat binding Analytics SQL tanpa token (Wrangler ≥4.145) atau SQL API; data di-sampling adaptif; di lokal data point dibuang | Binding `analytics_engine_datasets` dan `analytics` di `wrangler.jsonc` (belum ada)                                                                                            |
| PDF.js di browser               | Penampil dan ekstraksi PDF untuk ATS checker                                                                                                                                                                         | `apps/web/src/features/ats-checker/*` (aturan `CLAUDE.md`: kode PDF.js tidak boleh di `packages/pdf`)                                                                          |
| Fetch aman (anti-SSRF)          | `fetchPublic`, `isPrivateOrLoopbackHost`, `parseUrl`; fetch bawaan web access                                                                                                                                        | `@rezumi/utils/url-security.node`, `packages/api/src/features/web-access/builtin.ts`                                                                                           |
| Logo merek                      | `getNetworkIcon`, `BRAND_ICONS`, `getBrandIcon` (Hugeicons)                                                                                                                                                          | `packages/resume/src/icons.ts`                                                                                                                                                 |
| Saklar bertahap                 | `BILLING_MODE` off/admins/on, flag publik `billing`                                                                                                                                                                  | `packages/env/src/server.ts`, `packages/api/src/features/flags/router.ts`, `packages/api/src/features/billing/entitlements.ts`                                                 |
| Paket                           | `PlanFeatures`, `PlanLimits`, `FREE_TEMPLATES`, `BILLING_CATALOG_VERSION`, penegakan dan kode error                                                                                                                  | `packages/schema/src/billing/catalog.ts`, `packages/api/src/features/billing/limits.ts`                                                                                        |
| AI berkredit                    | `metered-ai.ts`, `CREDIT_COSTS`, `aiSource` (rezumi/own)                                                                                                                                                             | `packages/api/src/features/billing/metered-ai.ts`, `packages/api/src/features/ai/*`                                                                                            |
| Pekerjaan terjadwal             | Workers `scheduled()` dan scheduler Node                                                                                                                                                                             | `apps/server/src/cloudflare/index.ts`, `apps/server/src/startup/job-scheduler.ts`                                                                                              |
| Rute API internal               | Tag `Internal` disaring dari spec OpenAPI publik                                                                                                                                                                     | `apps/server/src/openapi/generator.ts` (billing memakai pola ini)                                                                                                              |
| Rate limit                      | Middleware dan kunci klien                                                                                                                                                                                           | `packages/api/src/middleware/rate-limit/*`, koordinasi `@rezumi/db/coordination`                                                                                               |
| Contoh dan matriks visual       | Persona fiktif, skrip pratinjau dan matriks template CV                                                                                                                                                              | `tooling/templates/{personas,previews.ts,matrix.ts}`                                                                                                                           |

Batasan yang mempengaruhi desain:

- Di Cloudflare `FLAG_DISABLE_IMAGE_PROCESSING=true` dan `sharp` di-stub (`tooling/cloudflare/build.mjs`): server **tidak** mengecilkan gambar. Unggahan umum sekarang maks. 10 MB. Portfolio wajib mengompres gambar di browser (bagian 8).
- Username memakai `^[a-z0-9._-]+$`, dan `RESERVED_SEGMENTS` tidak dicegah saat mendaftar. Jangan menambah segmen pertama baru (misalnya `/portfolio`, `/report`) tanpa mengecek username yang sudah ada di database dan menambahkannya ke daftar cadangan.
- SPA tidak punya React SSR; halaman publik dirender sendiri oleh server (pola halaman web CV). Komponen HeroUI (butuh Tailwind, react-aria, Recharts) **tidak** dipakai di halaman publik; hanya di editor dan dashboard.

## 2. Peta kode baru

| Area               | Lokasi                                                                                                                                                                    | Catatan                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Skema Zod          | `packages/schema/src/portfolio/{data,blocks,metric,themes,default,limits}.ts`                                                                                             | Ekspor eksplisit di `packages/schema/package.json`                                     |
| Tabel              | `packages/db/src/schema/portfolio.ts` (+ `index.ts`)                                                                                                                      | `pnpm db:generate`, baca SQL yang dihasilkan                                           |
| API                | `packages/api/src/features/portfolio/*`                                                                                                                                   | Router di agregat `@rezumi/api/routers`; tag `Internal` sampai Phase 12                |
| Render tema        | Paket baru `packages/portfolio` (`@rezumi/portfolio`)                                                                                                                     | Tag Turbo `runtime:universal` + `role:rendering`; jalan di server dan browser          |
| Halaman server     | `apps/server/src/static/{portfolio-page,portfolio-card}.ts`                                                                                                               | Dipasang di `apps/server/src/http/app.ts` dan `apps/server/src/http/custom-domain.ts`  |
| Web                | `apps/web/src/features/portfolio/{editor,blocks,metrics,media,images,sections}/*`, `apps/web/src/routes/dashboard/portfolio/*`, `apps/web/src/routes/builder/portfolio/*` | Rute statis `builder/portfolio` harus menang atas `builder/$resumeId` (cek route tree) |
| Gambar galeri tema | `apps/web/public/portfolio-themes/{jpg,thumb}/<tema>.{jpg,webp}` (+ `id/`)                                                                                                | Dibuat skrip tooling                                                                   |
| Tooling            | `tooling/portfolio/{preview,previews,matrix}.ts` (`portfolio:preview`, `portfolio:previews`, `portfolio:matrix`)                                                          | Persona dari `tooling/templates/personas`                                              |
| Panduan pengguna   | `docs/guides/creating-a-portfolio.mdx` (+ `docs/docs.json`)                                                                                                               | Phase 12                                                                               |

Paket baru mengikuti aturan batas paket `CLAUDE.md`: impor lewat nama paket dan export map, tanpa path `src` lintas paket; jalankan `pnpm exec turbo boundaries`. Bila portfolio memakai PDF.js, perbarui baris kepemilikan PDF.js di `CLAUDE.md` (sekarang hanya preview CV dan ATS checker).

## 3. Saklar `PORTFOLIO_MODE`

- `packages/env/src/server.ts`: `PORTFOLIO_MODE: z.enum(["off", "admins", "on"]).default("off")`. Tambahkan ke `.env.example`, `globalPassThroughEnv` dan array `env` tugas tes di `turbo.json`, dan `vars` di `wrangler.jsonc` (`"off"`).
- `packages/api/src/features/portfolio/mode.ts`: `isPortfolioEnabledFor(user)`. `on` → semua akun terdaftar (bukan tamu/anonymous); `admins` → hanya peran admin; `off` → tidak ada. Menerbitkan butuh email terverifikasi (dicek di `setPublic`).
- Flag publik `portfolio` (mode ≠ `off`) di flags router untuk bagian publik aplikasi; UI akun memakai `portfolio.get().enabled`.
- Rute publik melayani portfolio hanya bila pemiliknya lolos `isPortfolioEnabledFor`. Selain itu `/<username>` jatuh ke CV utama seperti sekarang.

## 4. Data

### 4.1 Tabel

```ts
// packages/db/src/schema/portfolio.ts (sketsa)
portfolio = pgTable("portfolio", {
  id, // generateId()
  userId, // unik, FK user on delete cascade: satu portfolio per akun dijamin database
  sourceResumeId, // FK resume on delete set null; null = portfolio tanpa CV
  isPublic, // boolean, bawaan false
  showInSearchEngines, // boolean, bawaan true (aturan turunan #5)
  publishedAt, // timestamptz null: pertama kali terbit
  suspendedAt,
  suspendedReason, // penangguhan admin (Phase 11)
  data, // jsonb $type<PortfolioData>
  createdAt,
  updatedAt, // updatedAt $onUpdate, dipakai deteksi konflik
});

portfolioFile = pgTable("portfolio_file", {
  id,
  userId, // FK user cascade
  kind, // "image" | "pdf"
  key, // uploads/<userId>/pictures/portfolio/<uuid>.<ext> atau uploads/<userId>/documents/portfolio/<uuid>.pdf
  bytes,
  width,
  height,
  pages, // dimensi untuk gambar, jumlah halaman untuk PDF
  createdAt,
});

// Phase 02/08: portfolio_statistics_daily · Phase 08: portfolio_message · Phase 11: portfolio_report
// Phase 05: cache hasil tempel tautan boleh di Redis/Durable Object/memori, bukan tabel
```

Kolom yang menentukan siapa melihat apa (`isPublic`, `showInSearchEngines`, `suspendedAt`) berada di luar `data`, seperti di tabel `resume`: patch data, AI, atau impor tidak pernah bisa mengubahnya. `portfolio_file` menjadi dasar kuota (jumlah `bytes`) dan pembersihan file yatim.

### 4.2 `PortfolioData` (Zod, sketsa)

```ts
type PortfolioData = {
  version: 1;
  theme: PortfolioTheme; // "lugas" | "prima" | "kanvas" | "mozaik" (Phase 00); bawaan "lugas"
  locale?: string; // bahasa halaman; kosong = bahasa CV sumber
  basics: { name?: string; headline?: string; picture?: Image | null; location?: string }; // kosong = ikut CV; null = tanpa foto
  design: {
    scheme: "light" | "dark" | "auto";
    accent: { source: "resume" } | { source: "preset"; id: string } | { source: "custom"; color: string }; // #rrggbb
    fonts: { source: "resume" } | { source: "pair"; id: string };
    variants: Partial<Record<SectionKey | "metric", string>>; // divalidasi terhadap tema; nilai tak dikenal → bawaan tema
  };
  hero: {
    greeting: string; // ≤160
    showPicture: boolean;
    availability: { show: boolean; text: string }; // text ≤60, kosong = "Open to work" dalam bahasa halaman
    highlights: Metric[]; // angka pencapaian, ≤4
    buttons: Button[]; // ≤3
    effect: { id: HeroEffectId; target: "name" | "headline"; phrases?: string[] }; // bagian 23; phrases ≤3 × ≤40 untuk efek ketik (Phase 00: ≤5 detik)
    background: { kind: "plain" | "soft-gradient" | "pattern" | "image"; image?: Image }; // gambar dengan lapisan kontras otomatis
  };
  about: { content: RichText }; // ≤5.000 karakter teks
  works: { items: Work[] }; // ≤50 (batas teknis); batas paket di Phase 07
  services: { items: Service[] }; // ≤12
  testimonials: { items: Testimonial[] }; // ≤12
  clients: { items: Client[] }; // ≤24
  sections: {
    order: SectionKey[];
    hidden: SectionKey[];
    titles: Partial<Record<SectionKey, string>>; // ≤60
    hiddenItems: Partial<Record<SectionKey, string[]>>; // ID item CV yang disembunyikan
  };
  custom: CustomBlock[]; // ≤10
  location: {
    label: string; // ≤60, kosong = lokasi CV; contoh "Bandung, Indonesia"
    point?: { lat: number; lng: number; precision: "city" | "region" | "country" }; // bagian 24
    showMap: boolean; // bawaan false
    map?: { light: Image; dark: Image }; // gambar peta yang dibuat editor
    workModes: ("remote" | "hybrid" | "onsite")[];
    relocate: boolean;
    timezone?: string; // IANA, dari kota; tampil sebagai jam lokal opsional
    showLocalTime: boolean;
  };
  contact: {
    email: boolean;
    whatsapp: { show: boolean; number: string };
    form: boolean;
    profiles: boolean;
    note: string;
  }; // note ≤200
  seo: { title?: string; description?: string }; // ≤70, ≤160
  credit: { show: boolean }; // dipaksa true tanpa fitur paket `hidePortfolioCredit`
};

type Work = {
  id: string;
  slug: string; // unik dalam portfolio, ASCII, dari judul
  title: string; // ≤100
  summary: string; // ≤240
  role: string; // ≤80
  date: string; // teks bebas ≤40: "2024", "Jan–Mar 2025"
  tags: string[]; // ≤12
  cover?: Image & { focus?: { x: number; y: number } }; // titik fokus 0–1
  highlightMetricId?: string; // metrik unggulan untuk kartu, harus ada di blok Metrik karya ini
  primaryLink?: { label: string; url: string };
  blocks: Block[]; // ≤30, bagian 16
  featured: boolean;
  hidden: boolean;
  fromResumeItemId?: string; // asal proyek CV, untuk "Ambil dari CV"
};

type Image = { key: string; thumbKey?: string; width: number; height: number; alt: string }; // alt ≤200
type Button = {
  kind: "resume" | "pdf" | "contact" | "whatsapp" | "email" | "profile" | "link";
  label?: string;
  url?: string;
};
type Service = { id: string; title: string; description: string; price?: string; icon?: string; cta: Button }; // ≤60, ≤300, ≤40
type Testimonial = {
  id: string;
  quote: string;
  name: string;
  role: string;
  photo?: Image;
  sourceUrl?: string;
  consent: true;
}; // ≤500, ≤60, ≤80
type Client = { id: string; name: string; logo?: Image | { brandIcon: string }; url?: string }; // ≤60
type CustomBlock = { id: string; title: string; content: RichText; image?: Image; button?: Button; hidden: boolean };
type SectionKey =
  | "about"
  | "work"
  | "services"
  | "testimonials"
  | "clients"
  | "experience"
  | "education"
  | "skills"
  | "languages"
  | "certifications"
  | "awards"
  | "publications"
  | "volunteer"
  | "interests"
  | "profiles"
  | "contact"
  | `custom:${string}` // bagian bebas portfolio
  | `resume:${string}`; // bagian kustom CV (UUID)
// Block dan Metric: bagian 16 dan 17.
```

- Setiap kolom punya `.catch()` bawaan (pola `resumeDataSchema`) agar data lama atau rusak tetap terbaca, dan `describe()` untuk OpenAPI/MCP nanti.
- Teks kaya (`RichText`): bagian 15.
- URL hanya `https:`, `http:`, dan `mailto:`. Nomor WhatsApp hanya angka (E.164 tanpa `+`).
- Setiap `Image.key`/file harus milik pemilik portfolio (`uploads/<userId>/...` dengan `userId` pemilik) dan tercatat di `portfolio_file`; dicek di server saat `update`.
- Ukuran JSON maks. ±256 KB; tolak di server dengan pesan jelas.
- Batas paket (jumlah karya, tema premium, badge, kuota file) ditegakkan di Phase 07; skema hanya memegang batas teknis.

### 4.3 Model isi campuran

`buildPortfolioView({ portfolio, resume, owner, entitlements, messages, imageUrl })` (fungsi murni di `packages/portfolio`) menghasilkan satu objek tampilan yang dipakai semua tema:

- Data dasar: `basics` portfolio → CV sumber → akun (nama tampilan). `picture: null` berarti sengaja tanpa foto.
- Dari `resume.data`: profil, pengalaman, pendidikan, keahlian, bahasa, sertifikat, penghargaan, publikasi, relawan, minat, dan bagian kustom CV, plus email, telepon, situs untuk Kontak. Item `hidden` di CV dan item di `sections.hiddenItems` dibuang. Referensi tidak pernah dipakai.
- Privasi kontak memakai pengaturan `contact.*` portfolio, bukan `hideContactDetails` CV.
- CV sumber hilang atau di Trash → bagian dari CV kosong; data dasar jatuh ke `basics` dan akun.
- `portfolio.create` mengisi awal: ringkasan CV → `about`, proyek CV → `works` (blok Teks dari uraian, blok Tautan dari URL proyek, `fromResumeItemId`), aksen dan font "ikut CV", urutan bagian bawaan tema. Tanpa CV: `basics` dari isian dialog.

## 5. Render

### 5.1 Paket `@rezumi/portfolio`

- `renderPortfolioPage(input) → { lang, dir, html, css, script }`.
- Tema adalah komponen React murni (tanpa state), dirender dengan `renderToStaticMarkup` dari `react-dom/server`. Pilih entry yang jalan di Workers dan di browser; ukur bundel Worker dengan `pnpm check:cloudflare` sebelum dan sesudah.
- Registry `src/themes/index.ts`: `{ id, Component, css, supports: { variants, schemes, fontPairs, metricVariants }, defaults }`. Primitif bersama di `src/shared/*`: Section, Button, WorkCard, WorkDetail, Gallery, Timeline, Chips, **Metric/MetricGroup**, **VideoFacade**, **PdfCard**, **LinkCard**, ServiceCard, Testimonial, ClientStrip, ContactForm, Footer. Tema mengatur gaya, bukan perilaku.
- CSS per tema sebagai string (atau file `.css` yang diimpor mentah), semuanya di bawah `.pf[data-theme="<id>"]`, hanya membaca token di `01-desain.md` bagian 6. Tanpa Tailwind: halaman publik tidak bergantung pada CSS aplikasi.
- Koreksi kontras aksen: pindahkan logika `readableAccent` (`packages/pdf/src/templates/shared/tokens.ts`) ke paket bersama yang netral lingkungan (misalnya ekspor baru di `@rezumi/utils`) agar PDF dan portfolio memakai satu aturan; pastikan render PDF tidak berubah (render sebelum/sesudah identik).
- Font: dari daftar web font (`packages/fonts/src/webfontlist.json`), `font-display: swap`, maks. 2 keluarga × 2–3 bobot, `preload` untuk font judul.

### 5.2 Skrip halaman

Satu skrip inline kecil (target ≤6 KB), diizinkan lewat hash CSP seperti `WEB_PAGE_SCRIPT`: menu HP, dialog detail karya + navigasi galeri (keyboard dan geser), pemutar video yang dimuat saat diklik (bagian 18), salin email, kirim form lewat `fetch` (fallback POST biasa), animasi angka opsional, dan klik lewat `navigator.sendBeacon` (Phase 08). Halaman tetap terbaca dan semua tautan tetap jalan tanpa JavaScript.

### 5.3 Dokumen dan header

- `renderPortfolioDocument({ page, head, ... })`: `<!doctype html>`, `lang` dan `dir`, meta viewport, title dan description, canonical, Open Graph/Twitter (`/cards/<username>.png`), JSON-LD `ProfilePage` + `Person` (+ `hasPart` berupa `CreativeWork` untuk karya, `Service` untuk layanan, `Review` tidak dipakai untuk testimoni agar tidak dianggap ulasan palsu), `rel="me"` untuk tautan profil, `theme-color`.
- Header: `BASE_SECURITY_HEADERS`, CSP dari `contentSecurityPolicy(html)` ditambah khusus halaman portfolio: `frame-src` untuk `https://www.youtube-nocookie.com` dan `https://player.vimeo.com` (bagian 18) dan Turnstile (Phase 08). `Cache-Control: private, no-store` (kunjungan dihitung per permintaan; cache tepi ada di backlog), `X-Robots-Tag` bila tidak terindeks.
- Cache render per proses berbasis hash tampilan (pola `rendered` di `resume-page.ts`).

### 5.4 Pratinjau di editor

Renderer yang sama dijalankan di browser; dokumennya dimasukkan ke iframe inert (tanpa skrip, tanpa request selain gambar dan font), seperti `web-page-preview.tsx`. Video tampil sebagai gambar mini saja. Lebar Desktop/HP diatur lewat ukuran iframe dan skala. Debounce ±300 ms.

### 5.5 Teks halaman publik

`packages/portfolio/src/messages.ts` + `portfolio-catalog.json`, dibuat oleh `pnpm pdf:translations` (perluas `tooling/locales/generate.ts` agar juga membaca sumber portfolio). String didaftarkan untuk penerjemah lewat modul seperti `web-page-text.ts` di `apps/web/src/features/portfolio`. Indonesia wajib diterjemahkan; bahasa lain jatuh ke Inggris per string bila kosong.

## 6. Rute dan alamat

- `apps/server/src/http/app.ts`: handler `/:username` memanggil `servePortfolioOrResume`. Portfolio publik + mode mengizinkan pemilik + tidak ditangguhkan + pemilik tidak dilarang → halaman portfolio; selain itu `serveResumePage(..., { primary: true })` seperti sekarang. POST di alamat ini tetap untuk form password CV; form portfolio memakai `/api/portfolio/...`.
- Bila portfolio tidak terbit dan CV utama tidak ada → perilaku sekarang (halaman "tidak dibagikan").
- **Alamat CV utama berubah saat portfolio terbit.** Kanonik dan tautan yang sekarang memakai `/<username>` untuk CV utama (`publicResumePath({ isPrimary })` di `packages/resume/src/sharing.ts`, kanonik di `resume-page.ts`, alamat di `resume-card.ts`, sitemap, teks "Short link" dan "Primary resume" di Share CV, Share mobile) harus menjadi `/<username>/<slug>`. Petakan semua pemakai dengan graph (`trace_path`) di Phase 02 dan ubah lewat satu sumber kebenaran, misalnya `profilePathOwner(user)` → `"portfolio" | "resume" | null`.
- Domain sendiri: `handleCustomDomain` membuka portfolio bila terbit (Phase 02 menyiapkan cabangnya, Phase 09 menyelesaikan otomasinya). Rute `/api/portfolio/` dan dokumen PDF portfolio harus lolos di domain sendiri seperti `/api/resumes/`.
- Kartu share: `GET /cards/<username>.png` (satu segmen; tidak bentrok dengan `/cards/<username>/<slug>.png`).
- Sitemap: `/sitemaps/portfolios-N.xml` untuk portfolio publik yang terindeks, ditambahkan ke indeks sitemap.
- Alias (`APP_ALIAS_URL`): perilaku sama dengan halaman CV (kanonik ke `APP_URL` atau domain sendiri).

## 7. API (oRPC)

Semua `protectedProcedure`, pemilik = akun yang masuk, tag `Internal` sampai Phase 12.

| Prosedur                                                              | Phase | Catatan                                                                                     |
| --------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------- |
| `portfolio.get`                                                       | 01    | `{ enabled, portfolio \| null, limits, usage }`                                             |
| `portfolio.create({ sourceResumeId?, theme?, basics? })`              | 01    | Gagal bila sudah ada; isi awal dari CV (4.3) atau dari `basics` bila tanpa CV               |
| `portfolio.update({ data, expectedUpdatedAt })`                       | 01    | Validasi + sanitasi; konflik → kode error khusus                                            |
| `portfolio.setPublic({ isPublic })`                                   | 01    | Butuh email terverifikasi; isi `publishedAt` saat pertama terbit; ditolak bila ditangguhkan |
| `portfolio.updateSettings({ showInSearchEngines?, sourceResumeId? })` | 01    | CV harus milik akun dan tidak di Trash; `null` = lepas dari CV                              |
| `portfolio.delete`                                                    | 01    | Menghapus semua file juga                                                                   |
| `portfolio.uploadImage(file)`, `portfolio.deleteFile({ key })`        | 04    | Bagian 8                                                                                    |
| `portfolio.importWorks({ resumeItemIds })`                            | 04    | Menambah karya dari Proyek CV                                                               |
| `portfolio.uploadPdf(file, thumbnail)`                                | 05    | Bagian 19                                                                                   |
| `portfolio.unfurl({ url })`, `portfolio.importRemoteImage({ url })`   | 05    | Bagian 20                                                                                   |
| `portfolio.statistics`                                                | 08    | 30 hari                                                                                     |
| `portfolio.messages.{list,markRead,delete}`                           | 08    |                                                                                             |
| `portfolio.domain.*`                                                  | 09    | Membungkus fitur domain yang ada + status Cloudflare                                        |
| `portfolio.ai.{draft,rewrite,findMetrics}`                            | 10    | Lewat `metered-ai.ts`                                                                       |

Rute publik (rute server biasa, bukan oRPC): `POST /api/portfolio/<username>/message` (Phase 08), `POST /api/portfolio/<username>/event` (klik, Phase 08), `POST /api/portfolio/<username>/report` (Phase 11). Batasi ukuran body, laju per IP, dan laju per portfolio (koordinasi Durable Object di Cloudflare, Redis/memori di Node).

## 8. Gambar

- Browser: baca file → `createImageBitmap` → kanvas → WebP (kualitas ±0,82; JPEG bila WebP tidak didukung) dengan sisi terpanjang maks. 2.000 px, plus versi kecil 800 px untuk kartu. Logo klien: maks. 600 px dan transparansi dipertahankan (WebP/PNG). Re-encode menghapus EXIF (termasuk lokasi GPS). Tolak SVG dan GIF animasi. Banyak file sekaligus diproses berurutan dengan progres.
- Server (`portfolio.uploadImage`): terima `image/webp`, `image/jpeg`, `image/png` ≤2,5 MB; cek tanda tangan file dan dimensi dari header (tanpa `sharp`); simpan di `uploads/<userId>/pictures/portfolio/<uuid>.<ext>` agar dilayani rute unggahan publik yang ada; catat di `portfolio_file`.
- Dipakai oleh: sampul dan blok Gambar karya, foto khusus portfolio, gambar bagian bebas, foto testimoni, logo klien.
- Kuota (angka final di Phase 07, aturan turunan #9): jumlah `bytes` gambar + PDF per akun. Gambar dan PDF yang tidak lagi dirujuk dihapus saat pengguna menghapusnya, dan oleh job mingguan (selisih `portfolio_file` dengan rujukan di `data`).
- Halaman: `<img loading="lazy" decoding="async" width height>`, sampul pertama `fetchpriority="high"`, `srcset` 800/2.000, `object-position` dari titik fokus.
- Kinerja: gambar dilayani lewat Worker (`/uploads/...`). Bila trafik membesar, pertimbangkan domain media R2 publik dengan cache (backlog).

## 9. Statistik (Phase 02 dasar, Phase 08 lengkap)

- `portfolio_statistics_daily(portfolioId, date, views, clicks jsonb, works jsonb, messages, sources jsonb)`, unik `(portfolioId, date)`. `clicks`: `resume`, `pdf`, `whatsapp`, `email`, `link`, `contact`, `service`, `video`, `document`. `works`: jumlah buka detail per ID karya (maks. 50 kunci). `sources`: `linkedin`, `whatsapp`, `google`, `direct`, `other`.
- Kunjungan dihitung dengan `countVisit` (dedupe per jam), tanpa pemilik (sesi) dan bot (`isbot`), tanpa pratinjau.
- Sumber dari header `Referer` (hanya domain, dipetakan ke kategori) dan `utm_source` sederhana. Tidak menyimpan IP.
- Klik lewat `sendBeacon` ke `/api/portfolio/<username>/event`, dedupe per jenis per jam.
- **Workers Analytics Engine (produksi)**: setiap kunjungan dan klik yang lolos dedupe juga ditulis sebagai data point ke dataset `portfolio_events` (binding misalnya `PORTFOLIO_EVENTS`): `indexes` = ID portfolio; `blobs` = jenis kejadian, ID karya, kategori sumber, domain perujuk, negara (`request.cf.country`), kelas perangkat (mobile/tablet/desktop); `doubles` = 1. Tanpa IP, tanpa user agent mentah, tanpa ID pengunjung. `writeDataPoint` tidak ditunggu (tidak menambah latensi).
- **Postgres tetap sumber angka inti** (kunjungan, klik per jenis, pesan) di `portfolio_statistics_daily`: jalan di lokal/Node dan tes, dan menyimpan total lebih lama dari retensi Analytics Engine. Analytics Engine menambah rincian: negara, perangkat, domain perujuk, karya per hari. Bila binding tidak ada (lokal), rincian itu disembunyikan, angka inti tetap tampil.
- Dashboard membaca rincian lewat binding Analytics SQL (`events.analyticsEngine."portfolio_events"`, filter `index1` = ID portfolio milik pengguna yang masuk, rentang 30 hari) dengan cache singkat (±5 menit per portfolio). Angka dari Analytics Engine ditandai "perkiraan" karena data di-sampling. Negara pengunjung tampil di peta HeroUI di dashboard (bagian 24).
- Cek di dokumen Cloudflare saat implementasi: retensi data, kuota dan harga Workers Paid, batas per data point, versi Wrangler untuk binding Analytics SQL. Kebijakan Privasi menyebut statistik agregat (negara, perangkat, perujuk) tanpa cookie.

## 10. Form kontak (Phase 08)

- Env baru: `TURNSTILE_SITE_KEY` (var) dan `TURNSTILE_SECRET_KEY` (secret). Tanpa keduanya form tidak tampil dan Kontak jatuh ke tombol email.
- CSP halaman portfolio menambah `https://challenges.cloudflare.com` di `script-src` dan `frame-src`.
- Server memverifikasi token Turnstile (`siteverify`), memeriksa kolom jebakan, dan membatasi: maks. 3 pesan/jam per IP, 30 pesan/hari per portfolio, pesan ≤2.000 karakter, jumlah tautan dalam pesan dibatasi. Tes memakai kunci uji resmi Turnstile.
- `portfolio_message(id, portfolioId, name, email, body, serviceId?, createdAt, readAt)`, disimpan 90 hari (aturan turunan #7), dihapus job harian, termasuk ekspor data akun, terhapus bersama akun.
- Email notifikasi lewat `packages/email` (template baru, bahasa akun pemilik), `Reply-To` = pengirim; maks. 1 email per 10 menit per portfolio, sisanya digabung ("ada N pesan baru").
- Domain sendiri: widget Turnstile membatasi hostname. Cek aturan hostname di dokumen Turnstile saat implementasi. Bila hostname pelanggan tidak bisa didaftarkan, form di domain sendiri diganti tombol "Kirim pesan" yang membuka `rezumi.app/<username>#contact`.

## 11. Paket (Phase 07)

- `PlanFeatures` + `premiumPortfolioThemes`, `hidePortfolioCredit`, `customDomain`, `premiumHeroEffects` (aturan turunan #14), `detailedPortfolioStats` (aturan turunan #16); `PlanLimits` + `portfolioWorks` (Gratis 6, berbayar 50) dan `portfolioStorageBytes` (aturan turunan #9); `FREE_PORTFOLIO_THEMES`; `PLAN_FEATURE_KEYS` diperbarui; `BILLING_CATALOG_VERSION` naik.
- Penegakan di server: memilih tema premium (create, atau update saat nilainya berubah), menyembunyikan badge, menambah karya melewati batas (termasuk `importWorks` dan karya dari tempel tautan), unggah gambar/PDF melewati kuota, menghubungkan domain. Nilai yang sudah tersimpan tetap dirender (pola template premium).
- Saat paket berakhir: aturan turunan #2 (`00-keputusan.md`). Render publik membaca hak akses saat ini untuk badge dan domain.
- Hanya berlaku saat billing aktif untuk akun (`isBillingActiveFor`); `BILLING_MODE=off` → semua terbuka.
- UI: label "Plus" + gembok + dialog paket (pola membership Phase 03/05), meteran penyimpanan, daftar manfaat di halaman Paket, harga beranda, S&K ID/EN, llms.txt.

## 12. Domain sendiri (Phase 09)

- Pakai ulang `custom_domain` (satu per akun) dan verifikasi DNS yang ada. Urutan layan: portfolio terbit → CV utama → halaman tidak tersedia.
- Otomasi Cloudflare for SaaS: env `CLOUDFLARE_SAAS_ZONE_ID` (var) dan `CLOUDFLARE_SAAS_API_TOKEN` (secret, izin minimum untuk Custom Hostnames di zona `rezumi.app`). Setelah DNS terverifikasi: buat custom hostname lewat API, simpan id dan status di kolom baru `custom_domain` (misalnya `cfHostnameId`, `cfSslStatus`, `cfHostnameStatus`), job memeriksa status sampai aktif, hapus custom hostname saat domain dilepas, akun dihapus, atau paket berakhir melewati masa tenggang.
- `CUSTOM_DOMAIN_TARGET` produksi (misalnya `domains.rezumi.app`) menjadi fallback origin dan target CNAME. Perbarui `docs/self-hosting/sharing-domains.mdx`, yang sekarang menyebut aplikasi tidak memanggil API Cloudflare.
- Domain utama tanpa `www` hanya bisa lewat CNAME flattening di DNS pengguna; apex proxying dengan IP statis hanya untuk Enterprise. Arahkan pengguna ke `www` atau subdomain.
- Biaya: 100 hostname termasuk, lalu US$0,10 per hostname per bulan; paket non-Enterprise punya ambang API (cek endpoint quota).

## 13. AI (Phase 10)

- Prosedur memakai `metered-ai.ts` (reservasi → model → commit/release) dan `aiSource` (rezumi/own) seperti fitur AI lain, dengan kunci idempotensi per permintaan.
- `draft`: masukan = data CV sumber (tanpa kontak pribadi) + catatan opsional + bahasa halaman; keluaran JSON tervalidasi (greeting, about, untuk karya terpilih: summary + blok Teks). `rewrite`: satu kolom teks atau satu blok Teks + instruksi pendek. `findMetrics`: uraian pengalaman/proyek CV → kandidat `Metric` dengan kutipan kalimat asalnya; hanya angka yang tertulis.
- Biaya: aturan turunan #6. Kunci baru di `CREDIT_COSTS` berarti memperbarui label biaya, pemetaan meteran, dan `BILLING_CATALOG_VERSION` bila halaman harga menyebut biaya.
- Prompt melarang mengarang fakta; tes memeriksa tidak ada angka atau nama diri baru yang tidak ada di masukan, dan setiap metrik dari `findMetrics` punya kutipan asal yang memuat angkanya.

## 14. Keamanan, privasi, kepatuhan (Phase 11)

- Tidak ada HTML/CSS/JS dari pengguna; teks di-escape React; teks kaya disanitasi (bagian 15).
- Tautan keluar (termasuk kartu tautan dan tombol layanan): `rel="ugc nofollow noopener noreferrer"` dan `target="_blank"`.
- Terbit butuh email terverifikasi; pemilik dilarang → portfolio, gambar, dan PDF-nya 404 (`ownerIsNotBanned`, `isPublicUploadOwner`).
- PDF dilayani dalam mode terkunci (bagian 19). Gambar hanya raster.
- Laporan: tautan "Laporkan" di kaki → halaman form yang dirender server di `/<username>?report` → `POST /api/portfolio/<username>/report` (Turnstile + batas) → tabel `portfolio_report` + email ke admin (env `ABUSE_ALERT_EMAIL`, atau `BILLING_ALERT_EMAIL` bila pemilik setuju memakai yang sama). Alasan laporan mencakup penipuan, konten ilegal, pelanggaran merek/hak cipta (logo, karya), dan testimoni palsu.
- Admin: `/dashboard/admin/portfolios` (daftar laporan, buka portfolio, tangguhkan dengan alasan, cabut penangguhan, tautan ke admin akun untuk melarang). Semua tindakan tercatat.
- Portfolio yang ditangguhkan diperlakukan seperti tidak terbit: alamat pendek dan domain sendiri kembali ke CV utama bila ada (selain itu halaman tidak tersedia), kartu share umum, keluar dari sitemap. Akun yang bermasalah secara keseluruhan dilarang lewat admin akun, sehingga semua halamannya 404.
- Akun berumur kurang dari 7 hari tidak diindeks walau saklarnya menyala (aturan turunan #5).
- Ekspor data akun memuat portfolio, daftar file, dan pesan; hapus akun menghapus semuanya termasuk custom hostname Cloudflare.
- S&K dan Kebijakan Privasi ID/EN: konten buatan pengguna, larangan, logo dan testimoni (aturan turunan #11 dan #12), prosedur laporan dan penurunan, penangguhan, pesan kontak, statistik tanpa cookie, gambar dan PDF publik, video pihak ketiga yang dimuat setelah diklik.

## 15. Teks kaya (Rich Text Editor HeroUI Pro)

- Semua kolom teks kaya portfolio (Tentang saya, blok Teks, bagian bebas) memakai `RichTextEditor` dari `@heroui-pro/react/rich-text-editor`. Ambil dokumentasi lewat MCP `heroui-pro` (`get_component_docs`, komponen `rich-text-editor`) sebelum menulis kode.
- Toolbar dibatasi ke format yang didukung halaman publik: tebal, miring, garis bawah, coret, tautan, daftar berpoin/bernomor, kutipan, judul H2/H3, Undo/Redo. Tidak ada blok kode, tabel, warna, atau gambar di dalam teks (gambar = blok tersendiri).
- `RichTextEditor.SuggestionMenu` (karakter `/`) dipakai untuk menyisipkan blok baru setelah blok Teks yang sedang diedit (bagian 16), bukan untuk menyisipkan node ke dalam teks.
- Penyimpanan: HTML dari `onValueChange(..., details)` (`details.html`), disanitasi di server saat tulis **dan** saat render dengan sanitizer yang sama dengan isi CV (subset di atas; cari dengan graph). Nilai awal HTML (dari ringkasan CV) dimuat ke editor lewat opsi konten Tiptap. Batas panjang memakai `maxLength` + `CharacterCount`.
- Editor dimuat lazy seperti editor CV (Tiptap dan ProseMirror besar). Cek kecocokan versi peer `@tiptap/*` dengan versi yang sudah dipakai web (3.32) sebelum menambah dependensi; satu versi Tiptap saja di bundel.
- Editor CV tidak diubah di rencana ini (penggantian editor CV ada di backlog bila diinginkan).

## 16. Blok karya

```ts
type Block =
  | { id: string; type: "text"; html: RichText } // ≤10.000 karakter teks
  | { id: string; type: "images"; images: (Image & { caption?: string })[]; layout: "full" | "grid" | "carousel" } // 1–12; caption ≤140
  | { id: string; type: "metrics"; items: Metric[] } // 1–4, bagian 17
  | { id: string; type: "video"; provider: "youtube" | "vimeo"; videoId: string; title?: string; thumbnailUrl?: string } // bagian 18
  | { id: string; type: "pdf"; file: string; title: string; pages: number; preview?: Image } // bagian 19
  | {
      id: string;
      type: "link";
      url: string;
      title: string;
      description?: string;
      siteName?: string;
      image?: Image;
      brandIcon?: string;
    }; // bagian 20
```

- Maks. 30 blok per karya; urutan = urutan array. ID blok stabil (untuk metrik unggulan dan statistik).
- Editor (`apps/web/src/features/portfolio/blocks/*`): daftar blok dengan tombol "+ Tambah blok" di antara blok, menu slash di blok Teks, seret + tombol naik/turun, hapus dengan Urungkan, "Mulai dari kerangka studi kasus".
- Render: `WorkDetail` memetakan blok ke primitif bersama (5.1); tema hanya mengatur gaya. Detail karya tanpa JavaScript tetap terbaca.
- Validasi server: setiap blok divalidasi Zod sesuai tipenya; blok tak dikenal dibuang saat parse (`.catch`).

## 17. Metrik

```ts
type Metric = {
  id: string;
  label: string; // ≤60
  value: { kind: "number"; number: number } | { kind: "text"; text: string }; // text ≤12 untuk "Top 3", "#1"
  format: "plain" | "percent" | "currency" | "compact" | "multiplier" | "duration" | "rating";
  currency?: "IDR" | "USD"; // untuk "currency"
  unit?: "hour" | "day" | "week" | "month"; // untuk "duration"
  prefix?: string; // ≤4
  suffix?: string; // ≤12
  change?: { direction: "up" | "down" | "neutral"; text: string; good: boolean }; // text ≤12
  before?: number; // sebelum → sesudah memakai format yang sama dengan value
  series?: number[]; // grafik mini, 3–12 angka (aturan turunan #10)
  progress?: number; // 0–100
  context?: string; // ≤80
  icon?: string; // nama ikon Hugeicons dari set CV
};
```

- Format memakai `Intl.NumberFormat` dengan bahasa halaman (`compact` → "1,2 jt"/"1.2M", `currency` IDR tanpa desimal). Satu helper `formatMetric(metric, locale)` di `packages/portfolio` dipakai halaman publik, pratinjau editor, dan kartu share; uji untuk `id-ID`, `en-US`, dan `ar-SA`.
- Render publik: `Metric`/`MetricGroup` di `packages/portfolio` menggambar anatomi KPI dengan `<dl>`/`<dt>`/`<dd>`, chip perubahan (panah SVG + teks + warna `--pf-positive`/`--pf-negative` sesuai `good`), batang sebelum/sesudah dan progres dari CSS, grafik mini sebagai `<svg>` polyline/area yang dihitung di server (`aria-hidden`, dengan ringkasan teks). Tanpa HeroUI dan tanpa Recharts.
- Editor: form metrik di `apps/web/src/features/portfolio/metrics/*` dengan pratinjau kecil memakai `KPI`, `TrendChip`, dan `NumberValue` HeroUI Pro (impor subpath `@heroui-pro/react/kpi` menarik peer `recharts`; muat lazy dan cek ukuran bundel). Bila menambah `recharts` tidak sepadan, pratinjau kecil memakai komponen metrik portfolio itu sendiri.
- `highlightMetricId` dan `hero.highlights` memakai tipe yang sama; varian tampilan ditentukan tema dan `design.variants.metric`.
- Animasi hitung naik (opsional per tema): skrip halaman, hanya bila `prefers-reduced-motion` tidak aktif; HTML awal selalu berisi nilai akhir.

## 18. Video (YouTube, Vimeo)

- Masukan: tautan `youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/`, `youtube-nocookie.com/embed/`, `vimeo.com/<id>`, `player.vimeo.com/video/<id>`. Parser murni di `packages/schema/src/portfolio/blocks.ts` (atau `@rezumi/utils`) mengembalikan `{ provider, videoId }` atau galat; ID divalidasi ketat (karakter dan panjang).
- Gambar mini: YouTube `https://i.ytimg.com/vi/<id>/hqdefault.jpg`; Vimeo lewat oEmbed saat pengguna menempel tautan (bagian 20, fetch aman), disimpan di `thumbnailUrl`. `img-src https:` di CSP sudah mengizinkan.
- Halaman: `VideoFacade` = gambar mini + tombol putar + judul. Klik → skrip mengganti dengan `<iframe>` `https://www.youtube-nocookie.com/embed/<id>?autoplay=1` atau `https://player.vimeo.com/video/<id>?dnt=1&autoplay=1`, dengan `title`, `allow` minimal, `loading="lazy"`. Tanpa JavaScript: tautan ke halaman video.
- CSP halaman portfolio: `frame-src` menambah `https://www.youtube-nocookie.com https://player.vimeo.com` (hanya untuk halaman portfolio, tidak untuk aplikasi).
- Klik putar tercatat sebagai `clicks.video` (Phase 08).

## 19. PDF

- Browser: pengguna memilih PDF ≤10 MB; cek tanda tangan `%PDF-`; buat gambar halaman pertama dan hitung jumlah halaman dengan PDF.js (pakai ulang pemuat PDF.js yang sudah ada di web; ikuti aturan kepemilikan PDF.js di `CLAUDE.md`); PDF berpassword ditolak dengan pesan jelas.
- Server (`portfolio.uploadPdf`): terima PDF ≤10 MB + gambar halaman pertama (lewat jalur gambar bagian 8); cek tanda tangan; simpan di `uploads/<userId>/documents/portfolio/<uuid>.pdf`; catat di `portfolio_file` (`kind: "pdf"`, `pages`, `bytes`).
- Rute unggahan (`apps/server/src/static/uploads.ts`) diperluas: path `documents/portfolio/` milik pemilik yang tidak dilarang dilayani publik sebagai `application/pdf` dengan `Content-Disposition: inline; filename="<judul aman>.pdf"`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: sandbox`, cache publik 1 jam, ETag. Jalur ini ditinjau khusus di Phase 11 (keamanan).
- Halaman: `PdfCard` (gambar halaman pertama, judul, jumlah halaman, ukuran, tombol "Buka PDF" di tab baru). Klik tercatat sebagai `clicks.document`.
- Kuota: ukuran PDF dihitung ke `portfolioStorageBytes` (aturan turunan #9).

## 20. Tautan otomatis (unfurl)

- `portfolio.unfurl({ url })`: hanya `https:`/`http:`; fetch lewat helper aman (`fetchPublic` dari `@rezumi/utils/url-security.node`, yang menolak alamat privat dan di Workers didukung `global_fetch_strictly_public`); batas waktu 5 detik, maks. 3 pengalihan, maks. 1 MB HTML, `User-Agent` generik tanpa data pengguna.
- Parsing tanpa DOM: `<title>`, `og:title`, `og:description`, `og:image`, `og:site_name`, `twitter:*`, `<link rel="icon">`. YouTube dan Vimeo memakai oEmbed dan menghasilkan blok Video, bukan blok Tautan. Domain dikenal (Behance, Dribbble, GitHub, Figma, Medium, LinkedIn, Notion, Google Drive, Canva) mendapat `brandIcon` dari `getBrandIcon` (`packages/resume/src/icons.ts`) bila ada.
- Gambar: `og:image` hanya ditampilkan sebagai usulan. Setelah pengguna menyetujui, `portfolio.importRemoteImage({ url })` mengunduhnya lewat fetch aman (≤2,5 MB, raster, tanda tangan dicek) ke penyimpanan pengguna (bagian 8). Halaman publik tidak pernah menautkan gambar langsung dari situs lain.
- Cache hasil per URL 24 jam (Redis/Durable Object/memori), batas laju per akun (usulan 30 unfurl per jam).
- Gagal (situs menolak bot, waktu habis, bukan HTML) → pesan "Situs ini tidak bisa dibaca otomatis; isi manual", kolom tetap bisa diisi.
- "Tempel tautan → karya baru": hasil unfurl mengisi kartu (judul, ringkasan, sampul dari gambar yang disetujui, tautan utama) dan satu blok Tautan atau Video.

## 21. Layanan, Testimoni, Klien

- Data: `Service`, `Testimonial`, `Client` di 4.2; batas dan tampilan di `01-desain.md` bagian 17.
- Tombol layanan WhatsApp: `https://wa.me/<nomor>?text=<pesan ter-encode>` dengan pesan dalam bahasa halaman; nomor dari `contact.whatsapp` (tombol disembunyikan bila kosong).
- Testimoni wajib `consent: true` (centang pernyataan di editor); server menolak tanpa itu.
- Klien: `logo` berupa gambar unggahan (bagian 8) atau `{ brandIcon }` dari set ikon; render abu-abu memakai CSS `filter: grayscale(1)` dan berwarna saat `:hover`/`:focus-visible`; tanpa logo → nama sebagai teks. "Ambil dari Pengalaman" mengambil nama perusahaan unik dari CV sumber.

## 22. Tes dan verifikasi

- Unit: skema (bawaan, `.catch`, batas, blok tak dikenal), `buildPortfolioView` (item tersembunyi, CV hilang, portfolio tanpa CV, data dasar khusus portfolio, privasi kontak), sanitasi teks kaya, parser video, `formatMetric` (tiga bahasa), parser unfurl (HTML contoh dari berkas, tanpa jaringan), helper alamat CV utama, koreksi kontras.
- Render: setiap tema × varian × skema × semua jenis blok dan bagian menghasilkan HTML tanpa `undefined`/`NaN`/teks hilang; tes struktur (judul, jangkar, alt, `dl` metrik), bukan snapshot byte.
- DB nyata (pola `*_TEST_DATABASE_URL` di `.github/workflows/ci.yml`): create/update/terbit, satu per akun dengan permintaan paralel, batas paket, kuota file, file milik akun lain ditolak, pesan, laporan.
- Server: `/<username>` untuk mode off/admins/on × portfolio terbit/tidak/ditangguhkan × CV utama ada/tidak; domain sendiri; kartu; sitemap; header dan CSP (termasuk `frame-src` video); PDF publik (header, pemilik dilarang → 404); unfurl dengan server palsu lokal (alamat privat ditolak, pengalihan, ukuran, waktu habis).
- Visual: `pnpm --filter @rezumi/tooling portfolio:matrix` (tema × persona × terang/gelap × 390/1440 px × isi lengkap/minimal/sangat banyak/RTL, termasuk semua jenis blok dan widget metrik) memakai Chrome sistem lewat Playwright (`chromium.launch({ channel: "chrome" })`), lalu dilihat dengan mata.
- Kinerja: Lighthouse atau skill `web-perf` di halaman contoh: LCP < 2,5 s (HP, 4G), CLS < 0,05, JS ≤6 KB; halaman dengan video tidak memuat pemutar sebelum diklik.
- E2E: `tests/e2e/specs/portfolio.spec.ts` (buat dari CV, tambah karya dengan blok, terbit, buka sebagai tamu, kirim pesan dengan kunci uji Turnstile).

## 23. Efek intro (efek teks hero)

- Kode milik sendiri di `packages/portfolio/src/effects/*`: satu modul per efek berisi CSS dan, bila perlu, potongan skrip kecil. Halaman hanya memuat kode efek yang dipilih (disisipkan ke skrip inline berhash dan CSS halaman). Tidak memakai GSAP, motion, atau library animasi lain di halaman publik.
- **Jangan menyalin kode React Bits.** Lisensinya MIT + Commons Clause: komponen boleh dipakai di dalam aplikasi, tetapi tidak boleh dijual, disublisensikan, atau didistribusikan ulang sebagai komponen, termasuk versi porting. Pemilih efek di builder berbayar bisa dianggap mendistribusikan ulang. Efek dibuat dari nol berdasarkan konsep umum (kilau, ketik, acak huruf, garis vektor).
- Kandidat efek (daftar final dipilih di Phase 00, aturan turunan #13):

| ID             | Nama di editor | Cara kerja                                                                                                                                                                        | Butuh skrip |
| -------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `none`         | Tanpa efek     | —                                                                                                                                                                                 | Tidak       |
| `fade-up`      | Muncul halus   | Kata muncul berurutan dengan fade + geser kecil + blur ringan, sekali saat dimuat                                                                                                 | Tidak (CSS) |
| `shimmer`      | Kilau          | Kilau cahaya warna aksen menyapu nama (`background-clip: text`), maks. 3 kali lalu berhenti                                                                                       | Tidak (CSS) |
| `gradient`     | Gradien hidup  | Gradien aksen + dua warna turunan bergerak pelan di nama, berhenti setelah ±5 detik                                                                                               | Tidak (CSS) |
| `typewriter`   | Ketik berganti | Headline mengetik bergantian 2–4 frasa ("UI Designer", "Ilustrator"), berhenti di frasa pertama setelah satu putaran                                                              | Ya (kecil)  |
| `scramble`     | Acak teknologi | Huruf acak berganti cepat lalu tersusun menjadi nama, sekali saat dimuat                                                                                                          | Ya (kecil)  |
| `vector-hover` | Garis vektor   | Saat kursor di atas huruf, huruf itu berubah jadi garis tepi putus-putus dengan kotak seleksi ala aplikasi desain (SVG `stroke-dasharray`); di layar sentuh jatuh ke Muncul halus | Ya          |

- Aturan wajib: teks asli selalu ada di HTML (SEO, LCP, pembaca layar); lapisan animasi `aria-hidden`; `prefers-reduced-motion` → tampil statis tanpa animasi; animasi otomatis selesai ≤5 detik atau berhenti sendiri (WCAG 2.2.2); kontras tetap ≥ AA selama animasi (warna gradien dari `--pf-accent-text`); tidak menggeser tata letak (CLS 0, ukuran dicadangkan); total skrip semua efek ≤3 KB.
- Setiap tema punya efek bawaan (Lugas → Muncul halus, Prima → Tanpa efek, Kanvas → Garis vektor, Mozaik → Gradien hidup) dan menolak efek yang tidak cocok lewat `supports.effects`; daftar per tema di `01-desain.md` bagian 18. Keenam efek masuk rilis (keputusan Phase 00).
- Editor: pemilih efek di tab Desain → Intro dengan demo mini yang memakai kode efek yang sama; tombol "Putar ulang" di pratinjau. Pratinjau editor yang biasanya inert boleh menjalankan skrip halaman untuk efek ini dengan `sandbox="allow-scripts"` tanpa `allow-same-origin`, atau memutar demo di luar iframe; pilih yang lebih aman dan catat.
- Paket: aturan turunan #14.

## 24. Lokasi dan peta

- Data: `location` di 4.2. Tampil sebagai chip lokasi di Intro (teks saja) dan kartu **Lokasi** di bagian Kontak (label, peta bila `showMap`, mode kerja Remote/Hybrid/On-site, bersedia relokasi, jam lokal opsional). Tema boleh memindahkan kartu (misalnya ubin bento di Mozaik).
- **Editor memakai `Map` HeroUI Pro** (`@heroui-pro/react/map`, MapLibre) dengan gaya OpenFreeMap (positron untuk terang, dark untuk gelap; tanpa API key): pengguna memilih kota, peta menampilkan penanda, penanda bisa digeser dengan peringatan "jangan tunjukkan alamat rumah", dan presisi Kota/Provinsi/Negara mengatur zoom. Muat lazy hanya di form Lokasi; layani worker MapLibre dari aset sendiri (CSP `worker-src 'self' blob:`); cek ukuran bundel.
- Pencarian kota: daftar kota GeoNames (lisensi CC BY 4.0, atribusi di halaman lisensi/dokumen) yang dibundel dan dimuat lazy di editor, berisi nama, wilayah, negara, koordinat, dan zona waktu. Tidak memakai API geocoding pihak ketiga (privasi, batas pemakaian Nominatim). Nilai awal dari lokasi CV bila cocok dengan daftar.
- **Halaman publik tanpa JavaScript peta**: saat pengguna menyimpan lokasi dengan peta menyala, editor memotret peta MapLibre (`preserveDrawingBuffer`, `canvas.toBlob`) dalam versi terang dan gelap, lalu mengunggahnya lewat jalur gambar (bagian 8) ke `location.map`. Halaman menampilkan gambar itu (`<picture>` sesuai mode), penanda berwarna aksen digambar CSS di titik tengah, atribusi "© OpenMapTiles © OpenStreetMap contributors" yang wajib, dan tautan "Buka di peta" ke OpenStreetMap. Tidak ada permintaan ke server peta saat pengunjung membuka halaman.
- Gambar peta dibuat ulang hanya bila titik, presisi, atau ukuran kartu berubah.
- Privasi: bawaan peta mati; presisi bawaan kota; titik kota memakai koordinat pusat kota dari daftar, bukan posisi pengguna; tidak ada fitur "lokasi saya" (GPS) di editor portfolio.
- Dashboard (Phase 08): `Map` HeroUI juga dipakai untuk "Asal pengunjung" (negara dari Analytics Engine, bagian 9).
- Ketergantungan OpenFreeMap: layanan gratis tanpa SLA, hanya dipakai di editor dan dashboard. Bila tidak tersedia, form Lokasi tetap bisa disimpan tanpa gambar peta. Ubin peta sendiri (misalnya Protomaps di R2) ada di backlog.

## 25. Catatan teknis dari mockup Phase 00

Mockup di `mockups/` adalah HTML/CSS/JS statis (bukan kode produk), tetapi beberapa temuan berlaku untuk Phase 02, 04, dan 06:

- **Token dan mode:** tema membaca token `--pf-*` (`01-desain.md` bagian 6); mode dipasang sebagai `data-pf-scheme` di `<html>`. Token turunan yang memakai `var()` lain (misalnya `--pf-accent-soft`) harus didefinisikan di elemen yang sama dengan `--pf-bg`-nya; kalau tidak, nilai terhitung di `:root` ikut terwariskan ke area dengan mode lain.
- **Koreksi kontras di server:** `--pf-accent-text`, `--pf-on-accent`, dan warna turunan Gradien hidup dihitung saat render untuk kedua mode, lalu ditulis sebagai CSS halaman. Mockup menghitungnya di browser (`PFX.safe`) hanya untuk panel percobaan.
- **Nama panjang:** server menulis `--name-word` (jumlah huruf kata terpanjang) di elemen nama; CSS tema membatasi ukuran huruf dengan `min(<ukuran tema>, calc(<lebar kolom> / (var(--name-word) * k)))` (k ±0,55–0,62 sesuai font). Efek per huruf (Acak teknologi, Garis vektor) membungkus tiap kata dengan `white-space: nowrap`; bila satu kata lebih lebar dari kolom, pembungkusnya kembali ke `normal`.
- **RTL:** lapisan animasi per huruf diberi `dir="auto"`. Tanpa itu, huruf `inline-block` pada nama Latin di halaman `dir="rtl"` tersusun terbalik (ditemukan di uji mockup).
- **Efek:** kode acuan ada di skrip inline mockup (`PFX` di `lugas.html` dan halaman lain) dan CSS `.pfx-*` di `mockups/shared.css`, ditulis dari nol. Versi mockup belum diperkecil dan memuat semua efek; di produk hanya efek terpilih yang disisipkan dan total skrip efek tetap ≤3 KB (bagian 23). Muncul halus memulai kata dari opasitas 0,12 (bukan 0) agar teks tidak benar-benar hilang; cek dampaknya pada LCP di Phase 06.
- **Grafik mini:** SVG `viewBox="0 0 240 44"` dengan `preserveAspectRatio="none"` dan `vector-effect: non-scaling-stroke`; titik akhir digambar sebagai garis nol-panjang dengan `stroke-linecap: round` agar tetap bulat saat SVG melebar.
- **Detail karya `:target`:** bilah atas detail memakai variabel `--pf-detail-pad` yang sama untuk padding panel dan margin negatif bilah, supaya tidak melebar 4 px saat tema mengubah padding.
- **Gambar dengan atribut `width`/`height`:** CSS dasar wajib `img { height: auto }`; tanpa itu atribut tinggi mengalahkan `aspect-ratio` (foto Prima sempat memanjang).
