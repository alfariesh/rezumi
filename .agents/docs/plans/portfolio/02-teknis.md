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
| Skema Zod          | `packages/schema/src/portfolio/{data,blocks,metric,themes,default,limits,sections,files,links,video,kit}.ts`                                                              | Ekspor eksplisit di `packages/schema/package.json` (`kit.ts` internal); bagian 26      |
| Tabel              | `packages/db/src/schema/portfolio.ts` (+ `index.ts`)                                                                                                                      | `pnpm db:generate`, baca SQL yang dihasilkan                                           |
| API                | `packages/api/src/features/portfolio/{mode,service,router}.ts`                                                                                                            | Router di agregat `@rezumi/api/routers`; tag `Internal` sampai Phase 12                |
| Render tema        | Paket `packages/portfolio` (`@rezumi/portfolio`), dibuat Phase 01: `view`, `initial`, `rich-text`, `files`, `text`                                                        | Tag Turbo `runtime:universal` + `role:rendering`; jalan di server dan browser          |
| Halaman server     | `apps/server/src/static/{portfolio-page,portfolio-card}.ts`                                                                                                               | Dipasang di `apps/server/src/http/app.ts` dan `apps/server/src/http/custom-domain.ts`  |
| Web                | `apps/web/src/features/portfolio/{editor,blocks,metrics,media,images,sections}/*`, `apps/web/src/routes/dashboard/portfolio/*`, `apps/web/src/routes/builder/portfolio/*` | Rute statis `builder/portfolio` harus menang atas `builder/$resumeId` (cek route tree) |
| Gambar galeri tema | `apps/web/public/portfolio-themes/{jpg,thumb}/<tema>.{jpg,webp}` (+ `id/`)                                                                                                | Dibuat skrip tooling                                                                   |
| Tooling            | `tooling/portfolio/{preview,previews,matrix}.ts` (`portfolio:preview`, `portfolio:previews`, `portfolio:matrix`)                                                          | Persona dari `tooling/templates/personas`                                              |
| Panduan pengguna   | `docs/guides/creating-a-portfolio.mdx` (+ `docs/docs.json`)                                                                                                               | Phase 12                                                                               |

Paket baru mengikuti aturan batas paket `CLAUDE.md`: impor lewat nama paket dan export map, tanpa path `src` lintas paket; jalankan `pnpm exec turbo boundaries`. Bila portfolio memakai PDF.js, perbarui baris kepemilikan PDF.js di `CLAUDE.md` (sekarang hanya preview CV dan ATS checker).

## 3. Saklar `PORTFOLIO_MODE`

- `packages/env/src/server.ts`: `PORTFOLIO_MODE: z.enum(["off", "admins", "on"]).default("off")`. Tambahkan ke `.env.example`, `globalPassThroughEnv` dan array `env` tugas tes di `turbo.json`, dan `vars` di `wrangler.jsonc` (`"off"`).
- `packages/api/src/features/portfolio/mode.ts`: `isPortfolioEnabledFor(user)`. `on` → semua akun terdaftar (bukan tamu/anonymous); `admins` → hanya peran admin; `off` → tidak ada. Akun tamu tidak pernah. Menerbitkan butuh email terverifikasi (dicek di `setPublic`). Service membaca peran dari database (seperti `isBillingAppliedTo`); saat `off` tidak ada kueri sama sekali.
- Flag publik `portfolio` di flags router untuk bagian publik aplikasi (beranda, harga): **hanya `true` saat mode `on`** (seperti flag `billing`), agar selama `admins` pengunjung tidak melihat fitur yang belum rilis. UI akun memakai `portfolio.get().enabled`. (Rencana awal menulis "mode ≠ `off`"; diubah di Phase 01.)
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
  basics: { name?: string; headline?: string; picture?: Image | null; location?: string }; // kosong = ikut CV; null = tanpa foto. Editor memakai hero.showPicture: false untuk "Tanpa foto", dan view lalu mengosongkan basics.picture juga (bagian 32)
  design: {
    scheme?: "light" | "dark" | "auto"; // kosong = mode bawaan tema
    accent: { source: "resume" } | { source: "preset"; id: string } | { source: "custom"; color: string }; // #rrggbb
    fonts: { source: "theme" } | { source: "resume" } | { source: "pair"; id: string }; // "theme" = pasangan bawaan tema
    variants: Partial<
      Record<
        "hero" | "work" | "services" | "testimonials" | "clients" | "experience" | "education" | "skills" | "metric",
        string
      >
    >; // nilai dari katalog global; yang tidak didukung tema → bawaan tema saat render
  };
  hero: {
    greeting: string; // ≤160
    showPicture: boolean;
    availability: { show: boolean; text: string }; // text ≤60, kosong = "Open to work" dalam bahasa halaman
    highlights: Metric[]; // angka pencapaian, ≤4
    buttons: Button[]; // ≤3
    effect: { id?: HeroEffectId; target: "name" | "headline"; phrases: string[] }; // id kosong = efek bawaan tema; bagian 23; phrases ≤2 peran × ≤40 setelah headline untuk efek ketik (keputusan 2026-11-06; bagian 32)
    background: { kind: "plain" | "soft-gradient" | "pattern" | "image"; image?: Image }; // gambar dengan lapisan kontras otomatis
  };
  about: { content: RichText }; // ≤5.000 karakter teks
  works: { items: Work[] }; // ≤50 (batas teknis); batas paket di Phase 07
  services: { items: Service[] }; // ≤12
  testimonials: { items: Testimonial[] }; // ≤12
  clients: { items: Client[] }; // ≤24
  sections: {
    order: SectionKey[]; // kosong atau bagian yang tidak disebut = urutan bawaan tema
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
    email: boolean; // bawaan true
    phone: boolean; // bawaan false (ditambah Phase 01: telepon CV tidak tampil kecuali dinyalakan)
    website: boolean; // bawaan true (ditambah Phase 01)
    whatsapp: { show: boolean; number: string };
    form: boolean; // bawaan false
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

`buildPortfolioView({ portfolio, resume, owner, entitlements, messages, fileUrl, links?, contactFormAvailable? })` (fungsi murni di `@rezumi/portfolio/view`, dibuat Phase 01; rincian di bagian 26) menghasilkan satu objek tampilan yang dipakai semua tema:

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
- Header: `BASE_SECURITY_HEADERS`, CSP sendiri dari `portfolioContentSecurityPolicy(script, additions)` (bagian 32): `frame-src` hanya `https://www.youtube-nocookie.com` dan `https://player.vimeo.com` (bagian 18), `form-action 'self'`, tanpa `blob:`; Turnstile (Phase 08) ditambahkan lewat `additions`. `Cache-Control: private, no-store` (kunjungan dihitung per permintaan; cache tepi ada di backlog), `X-Robots-Tag` bila tidak terindeks.
- Cache render per proses berbasis hash tampilan (pola `rendered` di `resume-page.ts`).

### 5.4 Pratinjau di editor

Renderer yang sama dijalankan di browser; dokumennya dimasukkan ke iframe inert (tanpa skrip, tanpa request selain gambar dan font), seperti `web-page-preview.tsx`. Phase 03: `sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"` (tanpa `allow-scripts`), karena file yang belum publik dilayani ke pemiliknya dengan `Cross-Origin-Resource-Policy: same-site` dan iframe ber-origin kosong tidak bisa memuat foto (file yang dipakai portfolio terbit dan foto publik CV: `cross-origin`, bagian 32); lihat bagian 28. Video tampil sebagai gambar mini saja. Lebar Desktop/HP diatur lewat kotak berlebar maksimum (tanpa skala). Debounce ±250 ms. Sejak bagian 32: foto hanya unggahan aplikasi ini (`ownPictureUrl`), status galat dengan Coba lagi, dan `openWorkId` menjaga detail karya yang sedang diedit.

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
| `portfolio.status`                                                    | —     | Hardening (bagian 32): `{ enabled, portfolio: { isPublic, suspendedAt } \| null }`          |
| `portfolio.create({ sourceResumeId?, theme?, basics? })`              | 01    | Gagal bila sudah ada; isi awal dari CV (4.3) atau dari `basics` bila tanpa CV               |
| `portfolio.update({ data, expectedUpdatedAt })`                       | 01    | Validasi + sanitasi; konflik → kode error khusus                                            |
| `portfolio.setPublic({ isPublic })`                                   | 01    | Butuh email terverifikasi; isi `publishedAt` saat pertama terbit; ditolak bila ditangguhkan |
| `portfolio.updateSettings({ showInSearchEngines?, sourceResumeId? })` | 01    | CV harus milik akun dan tidak di Trash; `null` = lepas dari CV                              |
| `portfolio.delete`                                                    | 01    | Menghapus semua file juga                                                                   |
| `portfolio.uploadImage(file)`, `portfolio.deleteFile({ key })`        | 04    | Bagian 8                                                                                    |
| `portfolio.importWorks({ resumeItemIds })`                            | 04    | Menambah karya dari Proyek CV                                                               |
| `portfolio.uploadPdf({ file, pages })`                                | 05    | Bagian 19                                                                                   |
| `portfolio.unfurl({ url })`, `portfolio.fetchRemoteImage({ url })`    | 05    | Bagian 20 dan 30 (`importRemoteImage` diganti `fetchRemoteImage` + `uploadImage`)           |
| `portfolio.statistics`                                                | 08    | 30 hari                                                                                     |
| `portfolio.messages.{list,markRead,delete}`                           | 08    |                                                                                             |
| `portfolio.domain.*`                                                  | 09    | Membungkus fitur domain yang ada + status Cloudflare                                        |
| `portfolio.ai.{draft,rewrite,findMetrics}`                            | 10    | Lewat `metered-ai.ts`                                                                       |

Rute publik (rute server biasa, bukan oRPC): `POST /api/portfolio/<username>/message` (Phase 08), `POST /api/portfolio/<username>/event` (klik, Phase 08), `POST /api/portfolio/<username>/report` (Phase 11). Batasi ukuran body, laju per IP, dan laju per portfolio (koordinasi Durable Object di Cloudflare, Redis/memori di Node).

## 8. Gambar

- Browser: baca file → `createImageBitmap` → kanvas → WebP (kualitas ±0,82; JPEG bila WebP tidak didukung) dengan sisi terpanjang maks. 2.000 px, plus versi kecil 800 px untuk kartu. Logo klien: maks. 600 px dan transparansi dipertahankan (WebP/PNG). Re-encode menghapus EXIF (termasuk lokasi GPS). Tolak SVG dan GIF animasi. Banyak file sekaligus diproses berurutan dengan progres.
- Server (`portfolio.uploadImage`): terima `image/webp`, `image/jpeg`, `image/png` ≤2,5 MB; cek tanda tangan file dan dimensi dari header (tanpa `sharp`); simpan di `uploads/<userId>/pictures/portfolio/<uuid>.<ext>` agar dilayani rute unggahan publik yang ada; catat di `portfolio_file`.
- Dipakai oleh: sampul dan blok Gambar karya, foto khusus portfolio, gambar bagian bebas, foto testimoni, logo klien.
- Kuota (angka final di Phase 07, aturan turunan #9): jumlah `bytes` gambar + PDF per akun. Gambar dan PDF yang tidak lagi dirujuk dihapus 24 jam setelah tidak dipakai (agar Urungkan tetap bisa mengembalikannya), dan job mingguan mencocokkan `portfolio_file` dengan rujukan di `data` serta isi penyimpanan; rincian di bagian 29.
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
- Domain sendiri (keputusan Phase 08, untuk Phase 09): widget Turnstile hanya berlaku di hostname yang terdaftar (paket gratis 10 per widget, tanpa wildcard; hostname menyertakan subdomainnya; "Any hostname" hanya Enterprise), jadi hostname pelanggan tidak bisa didaftarkan. Di domain sendiri form **tidak** ditampilkan: tombol "Kirim pesan" membuka `rezumi.app/<username>#contact` (`PortfolioPageForm` jenis `link`). Statistik dan beacon tetap berjalan di domain sendiri.

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
- Akun berumur kurang dari 7 hari tidak diindeks walau saklarnya menyala (aturan turunan #5; dipasang di Phase 03, bagian 28).
- Ekspor data akun memuat portfolio, daftar file, dan pesan; hapus akun menghapus semuanya termasuk custom hostname Cloudflare.
- S&K dan Kebijakan Privasi ID/EN: konten buatan pengguna, larangan, logo dan testimoni (aturan turunan #11 dan #12), prosedur laporan dan penurunan, penangguhan, pesan kontak, statistik tanpa cookie, gambar dan PDF publik, video pihak ketiga yang dimuat setelah diklik.

## 15. Teks kaya (Rich Text Editor HeroUI Pro)

- Semua kolom teks kaya portfolio (Tentang saya, blok Teks, bagian bebas) memakai `RichTextEditor` dari `@heroui-pro/react/rich-text-editor`. Ambil dokumentasi lewat MCP `heroui-pro` (`get_component_docs`, komponen `rich-text-editor`) sebelum menulis kode.
- Toolbar dibatasi ke format yang didukung halaman publik: tebal, miring, garis bawah, coret, tautan, daftar berpoin/bernomor, kutipan, judul H2/H3, Undo/Redo. Tidak ada blok kode, tabel, warna, atau gambar di dalam teks (gambar = blok tersendiri).
- `RichTextEditor.SuggestionMenu` (karakter `/`) dipakai untuk menyisipkan blok baru setelah blok Teks yang sedang diedit (bagian 16), bukan untuk menyisipkan node ke dalam teks.
- Penyimpanan: HTML dari `onValueChange(..., details)` (`details.html`), disanitasi di server saat tulis **dan** saat render dengan `sanitizePortfolioHtml` (`@rezumi/portfolio/rich-text`, sanitize-html dengan subset di atas). CV sendiri tidak punya sanitizer HTML (teksnya diurai ke node Forme); yang paling dekat adalah `sanitizeCoverLetterHtml`, jadi portfolio punya miliknya sendiri (Phase 01). Nilai awal HTML (dari ringkasan CV) dimuat ke editor lewat opsi konten Tiptap. Batas panjang memakai `maxLength` + `CharacterCount`.
- Editor dimuat lazy seperti editor CV (Tiptap dan ProseMirror besar). Cek kecocokan versi peer `@tiptap/*` dengan versi yang sudah dipakai web (3.32) sebelum menambah dependensi; satu versi Tiptap saja di bundel.
- Editor CV tidak diubah di rencana ini (penggantian editor CV ada di backlog bila diinginkan).

## 16. Blok karya

```ts
type Block =
  | { id: string; type: "text"; html: RichText } // ≤10.000 karakter teks
  | { id: string; type: "images"; images: (Image & { caption?: string })[]; layout: "full" | "grid" | "carousel" } // 1–12; caption ≤140
  | { id: string; type: "metrics"; items: Metric[] } // 1–4, bagian 17
  | {
      id: string;
      type: "video";
      provider: "youtube" | "vimeo";
      videoId: string;
      hash?: string;
      title?: string;
      thumbnailUrl?: string;
    } // bagian 18; hash = video Vimeo tak terdaftar
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
- Halaman: `VideoFacade` = gambar mini + tombol putar + judul. Klik → skrip mengganti dengan `<iframe>` `https://www.youtube-nocookie.com/embed/<id>?autoplay=1` atau `https://player.vimeo.com/video/<id>?dnt=1&autoplay=1`, dengan `title` dan `allow` minimal (iframe baru dibuat saat diklik, jadi `loading="lazy"` tidak perlu). Tanpa JavaScript: tautan ke halaman video.
- CSP halaman portfolio: `frame-src` hanya `https://www.youtube-nocookie.com https://player.vimeo.com` (hanya untuk halaman portfolio, tidak untuk aplikasi; dibangun per direktif sejak bagian 32).
- Klik putar tercatat sebagai `clicks.video` (Phase 08).

## 19. PDF

- Browser: pengguna memilih PDF ≤10 MB; cek tanda tangan `%PDF-`; buat gambar halaman pertama dan hitung jumlah halaman dengan PDF.js (pakai ulang pemuat PDF.js yang sudah ada di web; ikuti aturan kepemilikan PDF.js di `CLAUDE.md`); PDF berpassword ditolak dengan pesan jelas.
- Server (`portfolio.uploadPdf`): terima PDF ≤10 MB + gambar halaman pertama (lewat jalur gambar bagian 8); cek tanda tangan; simpan di `uploads/<userId>/documents/portfolio/<uuid>.pdf`; catat di `portfolio_file` (`kind: "pdf"`, `pages`, `bytes`).
- Rute unggahan (`apps/server/src/static/uploads.ts`) diperluas: path `documents/portfolio/` dilayani publik hanya selama portfolio terbit (tidak ditangguhkan, saklar menyala, pemilik tidak dilarang) memakainya, selain itu hanya ke pemiliknya (bagian 32), sebagai `application/pdf` dengan `Content-Disposition: inline; filename="document.pdf"`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: sandbox`, cache publik 1 jam, ETag. Jalur ini ditinjau khusus di Phase 11 (keamanan).
- Halaman: `PdfCard` (gambar halaman pertama, judul, jumlah halaman, ukuran, tombol "Buka PDF" di tab baru). Klik tercatat sebagai `clicks.document`.
- Kuota: ukuran PDF dihitung ke `portfolioStorageBytes` (aturan turunan #9).

## 20. Tautan otomatis (unfurl)

- `portfolio.unfurl({ url })`: hanya `https:`/`http:`; fetch lewat helper aman (`fetchPublic` dari `@rezumi/utils/url-security.node`, yang menolak alamat privat dan di Workers didukung `global_fetch_strictly_public`); batas waktu 5 detik, maks. 3 pengalihan, maks. 1 MB HTML, `User-Agent` generik tanpa data pengguna.
- Parsing tanpa DOM dengan pemindaian linear (bagian 32): `<title>` dari head, `og:title`, `og:description`, `og:image`, `og:site_name`, `twitter:*`. YouTube dan Vimeo memakai oEmbed dan menghasilkan blok Video, bukan blok Tautan. Domain dikenal (Behance, Dribbble, GitHub, Figma, Medium, LinkedIn, Notion, Google Drive, Canva) mendapat `brandIcon` dari `packages/api/src/features/portfolio/brand.ts` bila ada.
- Gambar: `og:image` hanya ditampilkan sebagai usulan. Setelah pengguna menyetujui, gambar disalin ke penyimpanan pengguna (bagian 8). Halaman publik tidak pernah menautkan gambar langsung dari situs lain, termasuk foto CV (sejak bagian 32 hanya unggahan aplikasi ini). Phase 05: server hanya mengambil gambar lewat fetch aman (`portfolio.fetchRemoteImage`, ≤10 MB, ≤50 MP, raster), browser mengecilkannya, lalu menyimpannya lewat `portfolio.uploadImage` (bagian 30).
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

- Aturan wajib: teks asli selalu ada di HTML (SEO, LCP, pembaca layar); lapisan animasi `aria-hidden`; `prefers-reduced-motion` → tampil statis tanpa animasi; animasi otomatis selesai ≤5 detik atau berhenti sendiri (WCAG 2.2.2); kontras tetap ≥ AA selama animasi (warna gradien dari `--pf-accent-text`); tidak menggeser tata letak (CLS 0, ukuran dicadangkan); tiap efek ≤3 KB dan satu efek per halaman; skrip halaman + efek ≤ 6 KB tanpa spasi (diuji, bagian 32).
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

## 26. Catatan implementasi Phase 01

Yang dibuat dan keputusan teknis yang perlu diketahui phase berikutnya (2026-11-06).

**Skema (`@rezumi/schema/portfolio/*`).**

- Dua skema dari satu definisi (`kit.ts`, internal): `writablePortfolioDataSchema` (tulis: semua batas, format, rujukan; kolom yang tidak dikirim diisi bawaan sehingga editor lama tetap bisa menyimpan) dan `portfolioDataSchema`/`parsePortfolioData` (baca: tidak pernah gagal; kolom rusak → bawaan, item rusak atau ID kembar dibuang, batas panjang teks **tidak** berlaku agar data lama tetap terbaca, data yang bukan objek → portfolio kosong). Tipe: `PortfolioData` (keluaran) dan `PortfolioDataInput` (masukan klien).
- Blok berjenis tak dikenal dibuang di kedua skema. Blok Video dengan ID tidak sah dibuang juga saat baca (tidak bisa diputar). Testimoni tanpa `consent: true` ditolak saat tulis dan dibuang saat baca.
- Aturan lintas kolom saat tulis: `highlightMetricId` harus ada di blok Metrik karya itu (baca: dibuang), alamat karya (`slug`) unik dan sah (baca: alamat sah dipertahankan, sisanya dibuat ulang dari judul), varian per bagian dan kunci bagian dari katalog. Kelengkapan (judul kosong, tombol tautan tanpa URL, WhatsApp tampil tanpa nomor, format mata uang tanpa mata uang) **tidak** ditolak agar simpan otomatis tidak gagal saat mengetik; renderer melewati yang belum lengkap.
- URL hanya `https:`/`http:`/`mailto:` (`links.ts`; tautan klien, testimoni, dan blok Tautan hanya http/https). Kunci file harus berpola `uploads/<id>/pictures/portfolio/<id>.(webp|jpg|png)` atau `uploads/<id>/documents/portfolio/<id>.pdf` (`files.ts`). Gambar mini video hanya dari `i.ytimg.com`/`i.vimeocdn.com`.
- `themes.ts` memegang lineup Phase 00, katalog varian global (`PORTFOLIO_VARIANT_OPTIONS`, termasuk `hero`), 8 aksen, 21 pasangan font (ID dari mockup bila ada: `jakarta`, `lora-figtree`, `source-plex`, `archivo`, `bodoni-work`, `bricolage-onest`, `unbounded-albert`, …), dan per tema: paket, mode bawaan, efek (pertama = bawaan), pasangan font (pertama = bawaan), varian per bagian (pertama = bawaan), dan urutan bagian bawaan. Daftar varian per tema adalah tebakan dari `01-desain.md` bagian 5; Phase 02/06 boleh menyesuaikan. Helper `themeVariant`, `themeEffect`, `themeFontPair`, `themeScheme` memilih bawaan tema bila pilihan tersimpan tidak didukung (pilihan tetap tersimpan, jadi kembali ke tema lama memulihkannya).
- Parser video di `video.ts` (`parseVideoUrl`, `youtubeThumbnailUrl`). Vimeo tak terdaftar (`vimeo.com/<id>/<hash>`, `?h=`) disimpan sebagai `hash`.
- Portfolio baru (`createDefaultPortfolioData`): aksen ikut CV, font `{ source: "theme" }`, `sections.order` kosong (= urutan tema), bagian `profiles` tersembunyi (tautan profil sudah tampil di Kontak).

**Tabel.** Migrasi `20261106012502_tranquil_crusher_hogan` (hanya `CREATE`). `portfolio.user_id` unik (`portfolio_user_unique`); `source_resume_id` FK `set null` + indeks; `portfolio_file.key` unik, indeks `user_id`. `updatedAt` hanya berubah saat **data** disimpan: `setPublic` dan `updateSettings` mempertahankannya, sehingga menerbitkan di satu tab tidak membuat editor di tab lain konflik.

**API (`packages/api/src/features/portfolio`).**

- Prosedur `portfolio.{get,create,update,setPublic,updateSettings,delete}`, semuanya `protectedProcedure` dengan tag `Internal` (tidak masuk spec publik; satu-satunya perubahan `docs/spec.json` adalah flag `portfolio`). Batas laju: `portfolioUpdateRateLimit` 60/menit dan `portfolioMutationRateLimit` 20/menit per akun.
- Kode error: `PORTFOLIO_DISABLED` (403), `PORTFOLIO_EXISTS` (409), `NOT_FOUND`, `PORTFOLIO_SOURCE_INVALID` (400), `PORTFOLIO_VERSION_CONFLICT` (409, `data.updatedAt`), `PORTFOLIO_TOO_LARGE` (413, `data.bytes`/`max`), `PORTFOLIO_FILE_NOT_FOUND` (400, `data.key`), `PORTFOLIO_EMAIL_NOT_VERIFIED` (403), `PORTFOLIO_SUSPENDED` (403), `BAD_REQUEST` untuk data tidak sah.
- `create`: `sourceResumeId` kosong → CV utama, lalu CV aktif yang terakhir diubah, lalu tanpa CV; `null` → tanpa CV. Dua `create` paralel: tepat satu berhasil (`ON CONFLICT DO NOTHING` pada `user_id`).
- `update`: parse ketat → sanitasi teks kaya → batas 256 KB → setiap kunci file harus di bawah `uploads/<userId>/` dan tercatat di `portfolio_file` milik akun → kunci baris (`FOR UPDATE`) → bandingkan `expectedUpdatedAt` di JavaScript (presisi milidetik, alasan sama dengan resume service). Urutan sejak bagian 32: router menolak data mentah > 4 × 256 KB lalu satu parse ketat; sanitasi, batas 256 KB dan folder milik sendiri sebelum kunci; lalu kunci → bandingkan versi → tulis → tandai pemakaian file (sekaligus cek file tercatat).
- `delete`: hapus folder `pictures/portfolio` dan `documents/portfolio` di penyimpanan, lalu baris `portfolio_file` dan `portfolio`. Hapus akun: baris ikut FK cascade, file ikut penghapusan `uploads/<userId>` yang sudah ada.
- `get().limits` sekarang batas teknis (`works: 50`, `storageBytes: null`, `dataBytes`); Phase 07 mengisi batas paket.
- Ekspor data akun belum memuat portfolio (Phase 11).

**`@rezumi/portfolio` (dibuat Phase 01).** `view.ts` (`buildPortfolioView`, `resolveSectionOrder`, `englishPortfolioViewMessages`), `initial.ts` (`createInitialPortfolioData`, `workFromResumeProject`), `rich-text.ts` (`sanitizePortfolioHtml`, `sanitizePortfolioData`), `files.ts` (`portfolioFileKeys`, untuk cek kepemilikan dan job pembersihan), `text.ts` (`htmlToText`, `truncateText`). Bergantung pada `@rezumi/schema`, `@rezumi/utils`, `@rezumi/fonts`, `sanitize-html`. Phase 02 menambah tema dan `renderPortfolioPage` di paket ini.

- `buildPortfolioView` memakai `fileUrl(key)` (gambar dan PDF), `links.resume`/`links.resumePdf` (tombol Lihat CV/Unduh PDF hilang bila tidak ada), dan `contactFormAvailable` (Turnstile, Phase 08). `messages` (judul bagian, label tombol, "Open to work", pesan WhatsApp layanan) diisi katalog Phase 02; tes memakai `englishPortfolioViewMessages`.
- Font "ikut CV" hanya dipakai bila kedua keluarga ada di daftar web font (`getWebFont`) dan bukan font unggahan; selain itu pasangan bawaan tema. Aksen "ikut CV" tanpa CV → Samudra.
- Urutan bagian: urutan portfolio; bagian standar yang tidak disebut disisipkan setelah tetangga terdekatnya di urutan tema; bagian bebas portfolio dan bagian kustom CV (kecuali surat lamaran dan referensi) sebelum Kontak. Bagian kosong dan yang disembunyikan tidak masuk.
- Kontak: email dan situs tampil bawaan, telepon mati bawaan (`contact.phone`), profil dari CV, WhatsApp bila nomor ada. Tombol layanan WhatsApp memakai `messages.serviceInquiry(nama)`.

## 27. Catatan implementasi Phase 02

Yang dibuat dan keputusan teknis yang perlu diketahui phase berikutnya (2026-11-06).

**Render (`@rezumi/portfolio`).**

- Ekspor baru: `.` (`renderPortfolioPage`, `portfolioIconNames`), `./document` (`renderPortfolioDocument`, `PORTFOLIO_PAGE_SCRIPT`), `./messages` (`portfolioMessages`, `portfolioViewMessages`, `PORTFOLIO_SOURCE_MESSAGES`), `./metric` (`formatMetric`, `formatMetricNumber`, `formatMetricBefore`, `beforeAfterBars`, `sparklinePaths`). Paket kini bergantung pada `react` dan `react-dom`.
- React biasa + `renderToStaticMarkup` dari `react-dom/server` (di Worker teresolusi ke `server.edge`, yang sudah ada di bundel lewat `react-email`). React 19 menaruh `<link rel="preload" as="image">` di awal keluaran untuk gambar `fetchPriority="high"`; `renderPortfolioPage` memindahkannya ke `page.head`, yang ditulis dokumen di `<head>`. React menulis nama atribut `srcSet` dan `fetchPriority` dengan huruf besar; HTML tidak membedakannya.
- `renderPortfolioPage` mengembalikan `{ lang, dir, scheme, html, head, css, script, preloadFont, themeColors }` (bagian 5.1 menyebut subsetnya). Masukan: `view`, `messages`, `icons` (bentuk ikon CV untuk nama dari `portfolioIconNames`; server memuatnya dari `@rezumi/pdf/icon-glyphs` hanya bila ada), `imageUrl`, `year` (diberikan, agar render murni), `creditUrl`.
- Struktur: `src/design.ts` (token warna per mode dihitung di server: `--pf-accent-text` ≥4,5:1, `--pf-on-accent`, `--pf-accent-soft` lewat `mixColors` bukan `color-mix()`, `--pf-positive`/`--pf-negative` dikoreksi kontras, `--pf-accent-text-dark` untuk area yang selalu gelap seperti intro bergambar; font judul 700/800 + isi 400/600/400 miring, bobot terdekat dari daftar web font, preload bobot judul terberat), `src/shared/{base-css.ts,context.ts,icons.tsx,metric.tsx,parts.tsx}` (primitif bersama), `src/themes/index.ts` (registry) dan `src/themes/lugas/{css.ts,theme.tsx}`, `src/script.ts`.
- Registry hanya berisi Lugas. Portfolio bertema Prima/Kanvas/Mozaik dirender sebagai Lugas sampai Phase 06; komponen Lugas membaca varian lewat `themeVariant("lugas", …)` sehingga nilai yang tidak didukung jatuh ke bawaan Lugas.
- Keputusan tampilan Lugas: navigasi berisi 4 bagian pertama + Kontak; bagian daftar pendek yang berurutan (Bahasa, Sertifikat, Penghargaan, Publikasi, Minat) digabung dalam satu blok 2 kolom `.pf-extras`, masing-masing tetap punya jangkar dan `h2`; angka pencapaian intro selalu nilai + label gaya Angka besar; intro tanpa foto memakai `data-variant="no-photo"`; latar intro gradien lembut, pola titik, dan gambar (lapisan gelap dengan token lokal) sudah ada. Daftar varian Lugas tetap seperti Phase 01.
- Belum dirender (sesuai rencana): blok Video, PDF, dan Tautan dilewati (Phase 05); gambar peta di kartu Lokasi (Phase 05); efek intro, termasuk bawaan Lugas "Muncul halus" (Phase 06); form kontak (Phase 08); tautan "Laporkan" (Phase 11); badge selalu tampil karena `hidePortfolioCredit` belum ada (Phase 07).
- Teks kaya dirender lewat `renderPortfolioHtml` (`./rich-text`): disanitasi ulang, tautan keluar diberi `rel="ugc nofollow noopener noreferrer" target="_blank"`, `mailto:` dibiarkan. Situs dan profil di Kontak memakai `rel="me ugc nofollow noopener noreferrer"` dan juga tertulis sebagai `<link rel="me">` di `<head>`.
- RTL: blok teks memakai `unicode-bidi: plaintext`, agar teks Latin di halaman `ar-SA` tidak memindahkan tanda baca ke awal baris.
- Skrip halaman 1,2 KB: menutup menu setelah diketuk, mengunci gulir dan memberi fokus saat detail karya terbuka, Escape/klik di luar panel menutup, panah kiri/kanan berpindah karya (dibalik di RTL), mengisi jam lokal kartu Lokasi.
- Teks halaman: `packages/portfolio/src/messages.ts` + `portfolio-catalog.json`, dibuat `pnpm pdf:translations` (generator di `tooling/locales/generate.ts`) dari string yang dideklarasikan untuk Lingui di `apps/web/src/features/portfolio/page-text.ts` (didaftarkan sebagai entry knip karena tidak diimpor). Judul "Tentang saya" memakai sumber "About me", bukan "About" yang di aplikasi berarti "Tentang aplikasi ini". Indonesia lengkap; bahasa lain jatuh ke Inggris per string.
- `readableAccent` pindah ke `@rezumi/utils/contrast` (`mixColors`, `contrastRatio`, `readableAccent(aksen, latar, minimum = 3)`, `readableOn`). Template PDF tetap memanggilnya dengan 3:1 lewat pembungkus di `packages/pdf/src/templates/shared/tokens.ts`; seluruh 629 tes PDF lulus tanpa perubahan.

**Alamat pendek: satu sumber kebenaran.** `portfolioOwnsProfilePath(userId)` di `packages/api/src/features/portfolio/public.ts` adalah kondisi SQL: akun punya portfolio yang terbit, tidak ditangguhkan, bukan akun tamu, dan saklar mengizinkan pemiliknya (`off` → konstanta `false` tanpa kueri; `admins` → peran admin). Pemakainya:

| Pemakai alamat CV utama                                                                  | Status Phase 02                                                                                            |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Rute `/<username>` (`apps/server/src/http/app.ts`)                                       | Diubah: `servePortfolioOrResume`; POST tetap form password CV                                              |
| Domain sendiri (`apps/server/src/http/custom-domain.ts`)                                 | Diubah: `/` lewat `servePortfolioOrResume`; `/api/portfolio/` diloloskan                                   |
| Kanonik + JSON-LD halaman CV (`resume-page.ts` lewat `loadPublicWebPage`)                | Diubah: `isPrimary` dan `customDomain` palsu bila portfolio memegang alamat → kanonik `/<username>/<slug>` |
| Alamat di kartu CV (`resume-card.ts` lewat `getPublicResumeCardData`)                    | Diubah dengan aturan yang sama                                                                             |
| Sitemap CV (`listIndexableResumes`)                                                      | Diubah: CV utama tercantum di alamat slug; pengecualian domain sendiri hanya bila CV yang memegang domain  |
| Teks "Short link" dan "Primary resume" di Share CV web (`share-panel.tsx`)               | Diubah di Phase 03: `apps/web/src/features/resume/share/short-link.ts` (bagian 28)                         |
| Share CV mobile (`apps/mobile/src/features/share/web-page.tsx`)                          | Tidak diubah (aturan web dulu); dicatat untuk paritas mobile                                               |
| Pengalihan slug lama, form password, `webPagePreviewUrl`, tautan CV di dokumen dan Share | Tidak terdampak: semuanya memakai alamat slug                                                              |

Graph `codebase-memory` sedang dipakai sesi lain saat pemetaan, jadi daftar ini dibuat dengan `rg` atas `publicResumePath`, `publicResumeUrl`, `isPrimary`, dan `verifiedDomainColumn`.

**Server.** `apps/server/src/static/portfolio-page.ts` (`servePortfolioOrResume`, `publicPortfolioView`) dan `portfolio-card.ts` (`GET /cards/<username>.png`, kartu memakai `resumeCardSvg` dan `loadResumeCardAssets` dengan resume tiruan berisi font dan foto portfolio; bukan portfolio → banner umum). CSP = CSP aplikasi + `frame-src https://www.youtube-nocookie.com https://player.vimeo.com`. `Cache-Control: private, no-store`; `X-Robots-Tag: noindex, follow` dan tanpa JSON-LD bila tidak terindeks. Cache render per proses dengan kunci hash `[view, tahun]`. JSON-LD `ProfilePage` + `Person` + `hasPart` (`CreativeWork` per karya, `Service` per layanan). Tombol "Lihat CV" hanya bila CV sumber publik; "Unduh PDF" hanya bila publik, unduhan diizinkan, dan tanpa password. Sitemap `/sitemaps/portfolios-N.xml` + indeks (`listIndexablePortfolios`, tanpa portfolio yang punya domain sendiri terverifikasi).

**Kunjungan.** Tabel `portfolio_statistics_daily(id, portfolio_id, date, views, …)`, unik `(portfolio_id, date)`, migrasi `20261106032359_common_smiling_tiger` (hanya `CREATE`). `recordPortfolioVisit` melewati bot (`isbot`) dan pemilik (`resolveViewer`), lalu dedupe per jam lewat `isFirstVisitThisHour("portfolio:<id>")` di `view-dedup.ts`. Kegagalan menghitung dicatat di log tanpa menggagalkan halaman. Terindeks = `showInSearchEngines` saja; aturan akun < 7 hari menyusul di Phase 11 (dipasang lebih awal di Phase 03, bagian 28).

**Alat.** `pnpm --filter @rezumi/tooling portfolio:preview --out <dir> [--variant full|minimal|long|rtl] [--scheme …] [--accent #rrggbb] [--set work=grid-2]` merender persona Lugas (Nadia Rahmawati, `tooling/portfolio/persona.ts`, gambar dari `mockups/img`) ke HTML. `pnpm portfolio:seed --email <akun> [--minimal] [--unpublish]` (root, memuat `.env.local`, hanya basis data lokal) mengisi akun dengan persona, mengubah sampul SVG mockup jadi PNG lewat `sharp` ke penyimpanan lokal, mencatatnya di `portfolio_file`, dan menerbitkan. Seed tidak membuat akun atau mengubah peran.

**Catatan pengembangan lokal.** Proxy dev Vite tidak meneruskan username bertitik (`publicResumeProxyPattern` memakai `[^/.?]+`; sudah begitu sebelum phase ini), jadi uji `/<username>` di port Vite dengan username tanpa titik, atau langsung ke `SERVER_PORT`.

**Ukuran dan kinerja (2026-11-06).** Skrip Worker `pnpm check:cloudflare` 11.190.436 byte (batas 12 MiB); `@rezumi/portfolio` menyumbang ±163 KB, ±92 KB di antaranya katalog teks 54 bahasa. Server lokal, HP 390 px dengan simulasi 4G lambat dan CPU 4×: LCP 0,4–0,9 detik, CLS 0, JavaScript 1,2 KB inline tanpa berkas skrip, HTML ±70 KB sebelum kompresi.

## 28. Catatan implementasi Phase 03

Yang dibuat dan keputusan teknis yang perlu diketahui phase berikutnya (2026-11-06).

**Rute dan menu.** `apps/web/src/routes/dashboard/portfolio/index.tsx` (halaman `PortfolioPage` di `features/portfolio/portfolio-page.tsx`: kartu kosong + dialog buat, atau kartu status dengan Salin, Buka, Edit, Hapus) dan `apps/web/src/routes/builder/portfolio/index.tsx` (editor layar penuh; segmen statis menang atas `/builder/$resumeId`). Keduanya memanggil `portfolio.get` di loader dan mengalihkan ke `/dashboard` bila `enabled` false; editor tanpa portfolio pindah ke `/dashboard/portfolio`. Menu "Portfolio" di `app-shell.tsx` (setelah Dokumen) hanya tampil bila `portfolio.get().enabled`; saat `off` prosedur itu tidak membaca database. Dicek dengan server `PORTFOLIO_MODE=off`: menu tidak ada, kedua rute dialihkan, `/<username>` membuka CV.

**Dialog buat** (`features/portfolio/create-dialog.tsx`): langkah 1 CV sumber (CV utama terpilih) atau Tanpa CV (nama + headline), langkah 2 tema dari `RENDERED_PORTFOLIO_THEMES` (ekspor baru `@rezumi/portfolio`, kini hanya Lugas; Phase 06 mengisinya). Langkah AI menyusul Phase 10.

**State editor** (`features/portfolio/editor/store.ts`, zustand tanpa immer middleware; `produce` immer per edit). Pola surat lamaran (`features/letters/store.ts`) lebih cocok daripada draf CV (yang memakai event stream dan History): simpan dengan debounce 800 ms (batas API 60/menit) lewat `client.portfolio.update({ data, expectedUpdatedAt })`; data yang dikirim tetap seperti diketik (server membersihkan teks kaya saat menyimpan); edit selama simpan berjalan dikirim sesudahnya. Status: `saved`, `saving`, `error` (Retry), `invalid` (data akan ditolak server, dicek dulu dengan `writablePortfolioDataSchema`; kolom URL dan WhatsApp sendiri hanya meneruskan nilai sah), `conflict` (`PORTFOLIO_VERSION_CONFLICT` → dialog "Muat ulang" yang mengambil versi server; edit lokal dibuang, tidak ada penimpaan diam-diam). Undo/Redo: tumpukan maks. 100, ketikan pada kolom yang sama dalam 1 detik digabung (`key`). `revision` naik saat data datang dari luar kolom (muat, undo, redo, atau edit `structural` seperti memindah/menghapus item), sehingga kolom yang menyimpan salinan sendiri (teks kaya, URL, WhatsApp) mulai ulang dari data. Pengaturan di luar data (`setPublic`, `updateSettings`) masuk lewat `applySettings`, yang mempertahankan data dan `updatedAt` editor; sebelum memanggilnya editor menyimpan dulu.

**Panel.** `editor/content-panel.tsx` (Intro + daftar bagian dengan `SortableProvider`/`useSortableItem` yang sama dengan CV, tombol naik/turun, mata, ganti nama lewat `usePrompt`; chip "Dari CV" dan "Kosong" dari `buildPortfolioView`), `intro-form.tsx`, `section-forms.tsx` (Tentang saya, Karya sederhana, bagian bebas, item CV dengan saklar + "Ubah di CV"), `offer-forms.tsx` (Layanan, Testimoni lewat dialog dengan centang pernyataan, Klien + "Ambil dari Pengalaman" + logo merek `getBrandIcon`), `contact-form.tsx` (kontak, WhatsApp dinormalisasi: awalan 0 dibaca +62, kartu Lokasi: label, mode kerja, relokasi, jam lokal dengan daftar zona waktu umum; Phase 05 mengisinya dari kota), `design-panel.tsx`, `publish-panel.tsx`. Logika murni yang dites: `editor/sections.ts` (urutan, sembunyi, judul, item CV, data dasar "kosong = ikut CV"). Label bagian memakai judul bawaan dalam **bahasa halaman** (`usePageMessages`), karena itulah yang tampil dan yang diganti namanya.

**Tab tidak disimpan tersembunyi.** Shell memakai `EditorFrame`, `ModeSwitch` dan `MobileTabBar` dari editor CV (mode `write`/`design`/`share` agar tipe `mobileView` cocok), tetapi **tidak** `KeptModes`/`MobilePanel`: `RichTextEditor` HeroUI Pro membaca editor Tiptap-nya (penghitung karakter) setelah `<Activity mode="hidden">` menghancurkannya, dan halaman runtuh. Hanya tab aktif yang dirender; semua isinya ada di store. HP (≤768 px): panel atau pratinjau bergantian lewat tab bawah.

**Teks kaya** (`editor/rich-text-editor.tsx`, dimuat lazy lewat `RichTextField` di `editor/fields.tsx`, dipreload saat editor dibuka). `RichTextEditor` HeroUI Pro dengan toolbar tebal, miring, garis bawah, coret, H2, H3, daftar, kutipan, tautan, undo/redo, `maxLength` + `CharacterCount`. Nilainya JSON; nilai awal HTML diubah dengan `generateJSON(html, [StarterKit])` (opsi `content` di `editorOptions` ditimpa komponen). Simpan `details.html` (kosong → ""). Tombol toolbar tidak punya ikon bawaan: ikon diberikan sebagai anak. Peer Tiptap yang dipakai komponen (`@tiptap/core`, `extension-link`, `extension-underline`, `extensions`, `suggestion`) kini dependensi `apps/web` (katalog `^3.32.0`, satu versi Tiptap). Phase 04 memakai ulang `RichTextField` untuk blok Teks; menu `/` (`SuggestionMenu`) belum dipasang.

**Pratinjau** (`editor/preview.tsx`): `buildPortfolioView` + `renderPortfolioPage` + `renderPortfolioDocument` di browser, debounce 250 ms, ikon dari `@rezumi/pdf/icon-glyphs` bila dipakai, tombol Lihat CV/Unduh PDF hanya bila CV sumber publik (tautannya `#`). Iframe `allow-same-origin` tanpa `allow-scripts` (bagian 5.4): skrip halaman tidak jalan, jadi tidak ada yang diberikan ke halaman; tanpa itu foto CV/portfolio tidak termuat (CORP `same-site`). Phase 06 yang butuh demo efek harus memilih: `allow-scripts` **tanpa** `allow-same-origin` (dan foto lewat data URL/blob), atau demo di luar iframe.

**Terbitkan.** Dialog terbit: alamat, saklar "Tampil di mesin pencari" (nilai `showInSearchEngines`, bawaan kolom `true`; aturan turunan #5), penjelasan dan tanggal akhir aturan akun baru, pemberitahuan bila CV utama publik sebelumnya memegang alamat pendek (alamat slug CV-nya ditampilkan), peringatan email belum terverifikasi + kirim ulang. Grup lain: alamat + salin + buka + QR (`qrcode.react`), mesin pencari + judul/deskripsi SEO (placeholder dari `view.seo`), bahasa halaman (`Combobox` lokal, kosong = ikut CV), CV sumber (daftar CV aktif + "Tanpa CV"; peringatan bila CV di Trash). Badge "Made with Rezumi" menunggu Phase 07; domain sendiri Phase 09.

**Aturan akun baru (aturan turunan #5).** `PORTFOLIO_NEW_ACCOUNT_NOINDEX_DAYS = 7` dan `portfolioIndexableFrom(createdAt)` di `@rezumi/schema/portfolio/limits` (dipakai server dan editor). `findPublicPortfolio().indexable` = saklar menyala **dan** akun ≥ 7 hari; `indexablePortfolioWhere` (sitemap) menambah `user.created_at <= now() - 7 hari`. Halaman akun baru mendapat `X-Robots-Tag: noindex, follow` dan tanpa JSON-LD. Tes basis data nyata ditambah (akun 6 hari vs 8 hari) dan akun uji lama diberi `createdAt` 30 hari lalu.

**Share CV.** `apps/web/src/features/resume/share/short-link.ts`: `portfolioHoldsShortLink(portfolio.get())` meniru `portfolioOwnsProfilePath` di klien (enabled + terbit + tidak ditangguhkan), `primaryResumeDescription` dan `shortLinkDescription`. Saat portfolio memegang alamat: saklar "CV utama" berkata portfolio dibuka di alamat pendek dan CV kembali ke sana bila portfolio dimatikan; kolom "Short link" mendapat catatan "Membuka portofolio Anda.". Saat `off` atau tidak terbit, teks sama persis seperti sebelumnya (dites; dicek di browser kedua mode). Share mobile tidak diubah (aturan web dulu, dicatat di paritas mobile).

**Tes.** Web: `editor/sections.test.ts` (urutan, sembunyi, judul, item CV, data dasar), `editor/store.test.ts` (simpan dengan versi, simpan otomatis, edit saat simpan berjalan, konflik, Retry, data tidak sah, `applySettings`, undo/redo), `editor/fields.test.ts` (URL tanpa https, nomor WhatsApp, pindah item), `resume/share/short-link.test.ts`. API: aturan akun baru (basis data nyata). E2E `tests/e2e/specs/portfolio.spec.ts`: lihat catatan sesi README.

**Catatan pengembangan lokal.** Server uji `rezumi-portfolio-03` (3150/3151, `PORTFOLIO_MODE=admins`) dan `rezumi-portfolio-03-off` (3160/3161, `off`) di `.claude/launch.json` (lokal). Akun uji `portfolio03-admin@example.test` (username `nadia03`, admin, terverifikasi, CV persona dengan dua proyek, portfolio terbit); kata sandinya acak dan tidak disimpan di repo.

## 29. Catatan implementasi Phase 04

Yang dibuat dan keputusan teknis yang perlu diketahui phase berikutnya (2026-11-06). Sisi server dikerjakan paralel oleh fork sesi ini; catatan lengkapnya di folder catatan sesi (`phase-04-server.md`).

**Unggah gambar di browser** (`apps/web/src/features/portfolio/images/`). `compress.ts`: tolak SVG (tipe, nama, atau isi XML) dan GIF bergerak (pembaca blok GIF, >1 frame), lalu `createImageBitmap(file, { imageOrientation: "from-image" })` → kanvas (`OffscreenCanvas` bila ada) → WebP kualitas 0,82, turun ke 0,72/0,62 lalu ukuran ×0,8 sampai ≤2,5 MB; browser tanpa encoder WebP → PNG bila ada transparansi (dicek pada salinan 64 px), selain itu JPEG berlatar putih. Foto: maks. 2.000 px + salinan 800 px bila lebih besar; logo: maks. 600 px tanpa salinan kecil, transparansi dipertahankan. File > 50 MB atau > 100 megapiksel ditolak sebelum digambar. `upload.ts`: `uploadPortfolioImages` mengunggah berurutan dengan progres, file yang gagal dilewati dengan pesannya (galat kompres dan kode server dipetakan ke kalimat). `image-field.tsx`: `ImageDrop` (DropZone HeroUI Pro + tempel `Ctrl/⌘+V`), `ImageField` (satu gambar: pratinjau, teks alternatif wajib dengan saran awal, Ganti/Hapus, pemilih titik fokus opsional), `useImageUploads`, `useFilePicker`. Contoh terukur: foto fiktif 6000×4000 JPEG 10,8 MB → 2000×1333 WebP 484 KB + salinan 800 px 36 KB; logo PNG 1600×800 transparan → WebP 600×300 dengan alpha.

**Server** (`packages/api/src/features/portfolio/`). `image.ts` membaca jenis dari tanda tangan dan dimensi dari header tanpa `sharp` (PNG IHDR, JPEG SOFn, WebP VP8/VP8L/VP8X), menolak WebP bergerak dan APNG. Prosedur bertag `Internal`:

- `portfolio.uploadImage({ file, thumbnail? })` → `{ key, thumbKey?, width, height, bytes }`; kunci `uploads/<userId>/pictures/portfolio/<uuid>.<ext>` dan `<uuid>-sm.<ext>`; baris `portfolio_file` ditulis **sebelum** file (gagal tulis → file dan baris dihapus). Galat: `PORTFOLIO_FILE_TOO_LARGE` (413, `{ bytes, max }`, per file ≤2,5 MB), `PORTFOLIO_IMAGE_INVALID` (400, `{ reason: "type" | "animated" | "dimensions" | "unreadable" }`, sisi utama ≤2.000 px, salinan ≤800 px; batas logo 600 px hanya di browser), `NOT_FOUND` tanpa portfolio. Laju 60/menit.
- `portfolio.deleteFile({ key })`: hanya file milik akun yang tercatat; `PORTFOLIO_FILE_IN_USE` (409) bila data tersimpan masih memakainya. Sejak bagian 32 editor memanggilnya untuk unggahan yang tidak jadi dipakai (unggahan dibatalkan, gambar kelebihan, gambar peta untuk tempat yang sudah berubah); file yang dibuang setelah dipakai tetap dibersihkan job.
- `portfolio.importWorks({ resumeItemIds, expectedUpdatedAt })`: proyek CV sumber (urutan CV, yang sudah diimpor dilewati) lewat `workFromResumeProject`, disimpan lewat jalur `update` (cek versi). `PORTFOLIO_WORKS_LIMIT` (400, `{ max }`). Editor menyimpan dulu (`flush`), memanggilnya, lalu `applyServerEdit` (data server jadi data editor, Urungkan kembali ke sebelum impor tanpa konflik).
- Batas laju `portfolioUploads`/`portfolioFileDeletes` di `packages/utils/src/rate-limit.ts`.

**Pemakaian file dan pembersihan.** Migrasi `20261106055010_serious_deadpool` (hanya `ADD COLUMN` + indeks): `portfolio_file.unused_since` (null = dipakai data tersimpan) dan `portfolio.files_checked_at`. `create`/`update`/`importWorks` menandai dalam transaksi yang sama: kunci yang dipakai → `null`, sisanya → `now()`. `update` kini mengunci baris portfolio **sebelum** cek file, agar file tidak terhapus di antara cek dan simpan. Job `runPortfolioJobs` (`@rezumi/api/features/portfolio/jobs`, dipanggil setiap menit oleh scheduler Node dan `scheduled()` Workers setelah billing dan karier; tidak melakukan apa pun saat `PORTFOLIO_MODE=off`): (a) menghapus file yang tidak dipakai > 24 jam (maks. 100 per putaran, portfolio yang sedang disimpan dilewati, file yang dipakai lagi dikembalikan); (b) sapuan mingguan maks. 5 portfolio per putaran (`files_checked_at` kosong atau > 7 hari): mencocokkan `unused_since` dengan data dan menghapus objek penyimpanan tanpa baris. Aman dijalankan ulang. **Akibatnya:** gambar yang dihapus atau diganti di editor baru hilang dari penyimpanan sehari kemudian (keputusan agent; Urungkan dan tab lain tetap aman). Menghapus portfolio tetap menghapus semuanya seketika. **Diganti di bagian 32:** job memindai data mentah dan tidak memegang kunci selama I/O penyimpanan; menghapus portfolio menandai semua filenya lewat tenggat dan job menghapusnya pada putaran berikutnya.

**Editor karya.** `works/works-form.tsx` (daftar karya + dialog Tambah karya: Kosong, Dari CV, Unggah gambar dengan pilihan "satu karya berisi semua gambar" (maks. 12 per karya, sisanya karya berikutnya) atau "satu karya per gambar"; Tempel tautan dinonaktifkan sampai Phase 05), `works/work-editor.tsx` (kartu + blok), `works/works.ts` (murni: `newWork`, `retitleWork` (alamat mengikuti judul selama masih alamat otomatis dari judul lama), `worksFromImages`, `resumeProjects`, `workRoom`). Karya yang dibuka disimpan di `editor/ui.ts` (zustand terpisah, bukan langkah Urungkan); panel Isi menggantinya dengan editor karya, dan pratinjau menyisipkan `<style>#work-<slug>{display:block}</style>` agar detailnya terbuka (iframe inert tidak bisa memakai `:target`) serta mempertahankan posisi gulir halaman dan detail saat dirender ulang.

**Blok** (`blocks/`). `blocks.ts` (murni: `newTextBlock`, `newImagesBlock` (blok Gambar baru dibuat setelah gambar pertama terunggah, karena skema mewajibkan ≥1), `newMetricsBlock` (satu metrik kosong), `insertBlocks` (batas 30), `removeBlock` (+ membuang `highlightMetricId` yang hilang), `caseStudyBlocks`/`addCaseStudy` (H2 Masalah, Peran saya, Proses, Hasil + blok Metrik; judul dari bahasa aplikasi)). `block-list.tsx`: seret (`SortableProvider`), naik/turun, hapus + toast Urungkan, "+ Tambah blok" di antara blok (Video/PDF/Tautan tampil "Segera hadir"), menu `/` di blok Teks lewat `RichTextEditor.SuggestionMenu` (perintah menghapus "/…" lalu menambah blok setelah blok itu). `RichTextField` mendapat `slashItems` dan `hideLabel`. Menghapus gambar terakhir atau metrik terakhir menghapus bloknya. Blok Video/PDF/Tautan (dari impor CV) tampil dengan catatan "segera bisa diubah".

**Metrik** (`metrics/`). `metrics.ts` (murni): pilihan format editor (rupiah dan dolar = `currency` IDR/USD), `applyMetricFormat` (memasang/membuang `currency`/`unit`), `parseMetricNumber` sesuai bahasa aplikasi (`usesDecimalComma` lewat `Intl`: "2,8", "1.200.000", "1.200,5" di id-ID; "2.8", "1,200,000" di en-US), `parseMetricSeries` (pemisah `;`/spasi di bahasa berkoma desimal, koma juga di lainnya), `workMetrics`, `dropMissingHighlight`. `metric-form.tsx`: `MetricsEditor` (daftar 1–4 atau 0–4, `onRemoveLast`) dan form satu metrik; kolom angka menyimpan teks ketikan dan baru menulis ke data saat terbaca, mulai ulang dari data saat `revision` naik. `metric-preview.tsx` (lazy): `KPI` + `TrendChip` HeroUI Pro dengan `formatMetric` bahasa halaman; `recharts` sudah ada di bundel web (halaman wawasan lamaran), jadi tidak ada dependensi baru.

**Kolom gambar lain.** Foto Intro (radio: foto CV / khusus portofolio / tanpa foto; foto khusus disimpan sementara di state agar memilih "foto CV" lalu kembali tidak mengunggah ulang), gambar bagian bebas, foto testimoni, logo klien (`kind: "logo"`, pernyataan hak di deskripsi kolom (aturan turunan #11, dikonfirmasi Phase 11); logo unggahan menggantikan logo merek), dan gambar latar intro (pilihan "Gambar" kini aktif; gambar tetap tersimpan saat berganti jenis latar).

**Render (`@rezumi/portfolio`).** Metrik tanpa label (atau teks kosong) tidak dirender di blok, angka pencapaian, maupun chip kartu. Gambar galeri dibungkus `<a class="pf-zoom" href="<gambar penuh>" data-lightbox data-caption>`; tanpa JavaScript tautan membuka file gambar. Satu `Lightbox` per halaman (dirender bila ada blok Gambar; teks "Penampil gambar" baru di katalog halaman). Skrip halaman (3,0 KB): penampil gambar (panah kiri/kanan sesuai RTL, geser > 40 px, Escape, klik latar, Tab terkunci, fokus kembali ke gambar), dan fokus kembali ke kartu karya saat detail ditutup. Judul detail yang difokuskan skrip tidak lagi menampilkan cincin fokus. Logo klien 40 px (sebelumnya 32 px).

**Tes.** Web: `images/compress.test.ts`, `metrics/metrics.test.ts`, `blocks/blocks.test.ts`, `works/works.test.ts`, `editor/store.test.ts` (+ `applyServerEdit`). Portfolio: galeri + penampil, metrik belum lengkap. API (fork): `image.test.ts`, mode `off` untuk ketiga prosedur baru, 14 tes basis data nyata (jenis salah, terlalu besar, dimensi, file akun lain, hapus file dipakai/tidak, impor, job idempoten). Tes skema batas blok/metrik.

**Catatan pengembangan lokal.** Server uji `rezumi-portfolio-04` (3180/3181, `PORTFOLIO_MODE=admins`) di `.claude/launch.json` (lokal). Akun uji `portfolio04-admin@example.test` (username `nadia04`, admin, terverifikasi, `created_at` 30 hari lalu, diisi `pnpm portfolio:seed`, CV persona ditambah dua proyek fiktif untuk uji impor); kata sandinya acak dan hanya ada di scratchpad sesi. HMR Vite kadang menampilkan "Trans component was rendered without I18nProvider" setelah `lingui:extract`; muat ulang halaman.

## 30. Catatan implementasi Phase 05

Yang dibuat dan keputusan teknis yang perlu diketahui phase berikutnya (2026-11-06). Sisi server dikerjakan paralel oleh fork sesi ini; catatan lengkapnya di folder catatan sesi (`phase-05-server.md`).

**Skema.** Blok Video mendapat `thumbnail` (salinan gambar mini di penyimpanan portfolio; `thumbnailUrl` tetap ada untuk editor saja) dan blok PDF mendapat `bytes` (ukuran untuk kartu). `PORTFOLIO_UPLOAD.pdfBytes` dan `remoteImageBytes` (10 MiB) dan `PORTFOLIO_MAP_ZOOM` (`city` 10, `region` 7, `country` 4) di `@rezumi/schema/portfolio/{limits,data}`. `portfolioFileKeys` menghitung gambar mini video.

**Server (`packages/api/src/features/portfolio/`).** Prosedur bertag `Internal`:

- `portfolio.uploadPdf({ file, pages })` → `{ key, bytes, pages }`: ≤10 MiB, harus diawali `%PDF-`, kunci `uploads/<userId>/documents/portfolio/<uuid>.pdf`, baris `portfolio_file` (`kind: "pdf"`) ditulis sebelum file. Galat `PORTFOLIO_FILE_TOO_LARGE` (413, kalimat PDF) dan `PORTFOLIO_PDF_INVALID` (400). Jumlah halaman dari browser (hanya untuk tampilan). Batas laju unggah 60/menit.
- `portfolio.unfurl({ url })` → `{ kind: "video", provider, videoId, hash?, title?, thumbnailUrl? }` (oEmbed YouTube/Vimeo) atau `{ kind: "link", url, title, description?, siteName?, imageUrl?, brandIcon? }`. Fetch aman sendiri (`remote.ts`): setiap lompatan pengalihan dicek ulang (maks. 3, https→http ditolak), 5 detik, HTML dibaca maks. 1 MiB lalu dipotong, hanya HTML, `User-Agent` umum tanpa cookie. Meta diurai tanpa DOM (`link-meta.ts`). `brandIcon` dari peta domain (`brand.ts`), bukan dari `getBrandIcon(label)` (salah tebak). Galat `PORTFOLIO_LINK_UNREADABLE` (400, `reason`: `unreachable`, `not-a-page`, `timeout`, `unsafe-url`, `blocked`). Cache 24 jam: Redis, atau Durable Object koordinasi di Workers, atau memori (500 entri). Batas 30/jam per akun.
- **`portfolio.fetchRemoteImage({ url })` menggantikan `importRemoteImage`**: server mengambil gambar lewat fetch aman (≤10 MiB, JPEG/PNG/WebP/GIF dari tanda tangan, 10 detik) dan mengembalikannya sebagai `File`; browser mengecilkannya seperti unggahan lain lalu menyimpannya lewat `uploadImage`. Alasan: server tidak bisa mengecilkan gambar di Workers, dan `og:image` sering lebih besar dari aturan unggah (2,5 MB/2.000 px). Kuota dan pemeriksaan tetap satu jalur. Batas 30/jam sendiri.
- PDF publik (`apps/server/src/static/uploads.ts`): `documents/portfolio/<uuid>.pdf` milik pemilik yang tidak dilarang, bila tipe tersimpan `application/pdf`: `Content-Disposition: inline; filename="document.pdf"` (judul tidak diketahui dari alamat), `nosniff`, `Content-Security-Policy: sandbox`, cache publik 1 jam, ETag/304; `X-Frame-Options: DENY` tetap, jadi PDF hanya dibuka di tab baru. **Dicek di Chrome asli: penampil PDF tetap menampilkan PDF dengan `CSP: sandbox`.** Domain sendiri tidak perlu jalur baru: `fileUrl` memakai origin aplikasi.

**Render (`@rezumi/portfolio`).** `src/shared/media.tsx`: `VideoFacade` (tautan ke halaman video + `data-embed`; gambar mini hanya salinan sendiri, tanpa salinan → latar gelap beraksen + tombol putar; judul dibatasi 2 baris, 1 baris di HP), `PdfCard` (halaman pertama, judul, "PDF · N halaman · ukuran" dengan `Intl` unit, "Buka PDF" di tab baru), `LinkCard` (gambar salinan sendiri atau logo merek atau ikon globe, judul, deskripsi 2 baris, situs). Primitif `linkAttributes`, `Picture`, `hostOf`, `vars` pindah ke `src/shared/primitives.tsx` (diekspor ulang dari `parts.tsx`) agar tidak ada impor melingkar. Kartu Lokasi: gambar peta (`<picture>` dengan `prefers-color-scheme` saat mode auto, satu gambar saat terang/gelap), penanda aksen dari CSS hanya untuk presisi kota, atribusi "© OpenMapTiles © OpenStreetMap contributors", tautan "Buka di peta" ke OpenStreetMap (penanda `mlat/mlon` hanya untuk kota). `portfolioIconNames` memuat logo merek blok Tautan. Atribut statistik untuk Phase 08: `data-pf-event="video" | "document" | "link"` + `data-pf-block`. Skrip halaman 3,5 KB: klik putar mengganti tautan dengan `<iframe>` (`allow` minimal, `referrerpolicy="strict-origin-when-cross-origin"`, karena embed YouTube butuh perujuk), menutup atau berpindah detail karya mengembalikan tombol putar (video berhenti). Teks baru di katalog halaman (Indonesia lengkap).

**Editor (`apps/web/src/features/portfolio/`).**

- `blocks/media-blocks.tsx`: `useAddMediaBlock` (Video dan Tautan lewat `usePrompt`, PDF lewat pemilih file), `VideoBlockEditor` (ganti tautan, judul, salin ulang gambar mini), `PdfBlockEditor` (judul, ganti PDF), `LinkBlockEditor` (isi dari tautan, judul, deskripsi, nama situs, usulan gambar "Pakai gambar ini"/"Tanpa gambar", atau gambar sendiri). Menu "+ Tambah blok" dan "/" kini memuat keenam jenis. Tautan YouTube/Vimeo di "Tambah tautan" menjadi blok Video. Situs yang menolak (Behance, LinkedIn) → blok Tautan berisi alamat saja + pesan "isi manual".
- `media/remote.ts` (unfurl, salin gambar, gambar mini YouTube `maxresdefault` lalu `hqdefault`), `media/pdf.ts` (PDF.js dari pemuat resume preview, dimuat lazy: cek `%PDF-` dan 10 MB, PDF berpassword ditolak, halaman 1 digambar 800 px → `uploadImage`, lalu `uploadPdf`), `media/link-blocks.ts` (murni: `linkBlockFromUnfurl`, `videoBlockFromUnfurl`, `workFromLink`, `clip`; usulan gambar disimpan di store zustand di luar data, jadi tidak ada alamat gambar situs lain yang tersimpan). Baris kepemilikan PDF.js di `AGENTS.md`/`CLAUDE.md` diperbarui.
- Dialog "Tambah karya" → **Tempel tautan** (`FromLink` di `works/works-form.tsx`): baca tautan, judul dan ringkasan bisa diubah, centang "Pakai gambar ini sebagai sampul" (disalin), lalu karya baru dengan kartu, tautan utama, dan satu blok Tautan atau Video (gambar sampul dipakai juga sebagai gambar blok).

**Lokasi dan peta (`location/`).**

- Daftar kota `cities.txt` (34.204 kota GeoNames `cities15000`, CC BY 4.0; 1,25 MB, ±425 KB brotli) dibuat `pnpm --filter @rezumi/tooling portfolio:cities <folder>` (`tooling/portfolio/cities.ts`, cara unduh di komentar file), diimpor sebagai aset ber-hash (`?url`) dan diambil hanya saat form Lokasi butuh. Atribusi GeoNames tampil di form; halaman lisensi publik (`docs/legal/license.mdx`) perlu menyebut GeoNames, OpenStreetMap/OpenMapTiles, dan OpenFreeMap sebelum rilis (Phase 11/12).
- `cities.ts` (murni, dites): cari dengan awalan nama lalu awalan kata, tanpa aksen, urut populasi, "Valencia, Spanyol" menyaring negara/wilayah dalam bahasa apa pun yang dikenal `Intl.DisplayNames`; `findCity` untuk usulan dari lokasi CV; `cityLabel` sesuai presisi dalam bahasa halaman; `areaCenter` (presisi provinsi/negara memusatkan peta di rata-rata kota wilayah itu, bukan di kota pilihan); `roundPoint` (penanda yang digeser dibulatkan 2 desimal, ±1 km).
- `location-fields.tsx` (mengganti form Lokasi Phase 03): cari kota, label halaman, presisi Kota/Provinsi/Negara, saklar "Tampilkan peta di halamanku" (mati bawaan, butuh kota), peta HeroUI Pro `Map` (`location-map.tsx`, lazy, OpenFreeMap positron/dark, worker MapLibre dari aset sendiri `maplibre-gl/dist/maplibre-gl-worker.mjs?url`, penanda bisa digeser di presisi kota dengan peringatan alamat rumah), hapus kota dan peta, mode kerja, relokasi, jam lokal (zona waktu dari kota). Tidak ada "gunakan lokasi saya".
- Gambar peta (`map-snapshot.ts`): MapLibre di luar layar 400×240 dengan `pixelRatio: 2` dan `preserveDrawingBuffer`, tanpa penanda dan atribusi, terang lalu gelap, PNG → `uploadImage` (WebP 800×480). Dibuat 1,2 detik setelah titik/presisi berubah atau peta dinyalakan; hasil untuk titik yang sudah berubah dibuang; gagal (layanan peta mati, 20 detik) → `location.map` dihapus dan halaman menampilkan kartu tanpa peta, dengan tombol "Coba lagi". Mematikan peta menghapus `location.map` (file dibersihkan job 24 jam kemudian).
- Dependensi baru `maplibre-gl` 6.15.0 (peer `Map` HeroUI Pro; katalog `pnpm-workspace.yaml`), hanya di potongan lazy editor.

**Tes.** Portfolio: render video (tanpa iframe, tanpa `ytimg`/`vimeocdn`, `data-embed` YouTube no-cookie dan Vimeo `dnt=1`, tautan tanpa JavaScript), PDF, Tautan, peta terang/gelap/auto, atribusi, tanpa ubin peta, presisi wilayah tanpa penanda; tampilan gambar mini tersimpan. Web: `location/cities.test.ts` (10, termasuk daftar asli: Bandung, Valencia di banyak negara), `media/media.test.ts`. Server (fork): parser meta, peta merek, unfurl dengan server palsu lokal (alamat privat, pengalihan ke alamat privat, HTML terpotong, waktu habis, bukan HTML), gambar jarak jauh (bukan gambar, terlalu besar), `uploadPdf` dengan basis data nyata, header PDF publik, CSP `frame-src` hanya di halaman portfolio, mode `off`.

**Cek di browser (2026-11-06, server lokal `PORTFOLIO_MODE=admins`).** Tambah Video YouTube (judul dari oEmbed, gambar mini tersalin), Vimeo lewat "Tambah tautan" (otomatis blok Video), PDF fiktif 3 halaman (halaman pertama jadi gambar, "3 halaman · 40 kB"), tautan GitHub (judul, deskripsi, gambar disalin), tautan Behance (situs menolak → pesan isi manual), Tempel tautan → karya baru, Bandung + peta (gambar terang/gelap tersimpan). Halaman publik: 0 permintaan ke YouTube/Vimeo sebelum klik, iframe `youtube-nocookie.com` setelah klik, iframe hilang saat detail ditutup; tidak ada permintaan ke `tiles.openfreemap.org`. HP 390 px, CPU 4×, 4G lambat: LCP halaman 0,44 detik, CLS 0, tanpa file skrip; buka langsung `#work-…` LCP 2,47 detik (gambar sampul 2.000 px dipilih di layar 3×; kandidat perbaikan Phase 06).

**Catatan pengembangan lokal.** Server uji `rezumi-portfolio-05` (3190/3191) di `.claude/launch.json` (lokal). Akun uji `portfolio05-admin@example.test` (username `nadia05`, admin, terverifikasi, `created_at` 30 hari lalu, `pnpm portfolio:seed`); kata sandi acak hanya di scratchpad sesi. Buka halaman publik lewat port Vite (3190), bukan port server: di lokal gambar dilayani dari origin `APP_URL`, jadi di port server CSP `img-src 'self'` memblokirnya. Di produksi ada juga domain alias dan domain sendiri, jadi file yang dipakai halaman terbit dikirim dengan `CORP: cross-origin` (bagian 32).

## 31. Catatan implementasi Phase 06

Yang dibuat dan keputusan teknis yang perlu diketahui phase berikutnya (2026-11-06). Tiga tema dikerjakan paralel oleh sub-agent sesi ini (satu per tema), tooling oleh sub-agent keempat.

**Registry dan primitif.** `src/themes/index.ts` mendaftar keempat tema (`RENDERED_THEMES` = semua). `ThemeRenderer` mendapat `headingWeights` (bawaan 700/800) dan `nameWeight` (berkas yang di-preload); `portfolioFontFaces(view, headingWeights)` dan `preloadFont(view, faces, nameWeight)` memakainya. `themes/palettes.ts` memegang netral keempat tema (tabel `01-desain.md` bagian 5) dan `readableOnNeutrals`. Helper bagian pindah dari Lugas ke `shared/sections.ts` (`navSections`, `groupSections`, `EXTRA_KINDS`, `initials`). Nama dan headline intro di semua tema dirender lewat `shared/hero-text.tsx` (`HeroName`, `HeroHeadline`), satu-satunya tempat markup efek. Render Lugas dengan efek `none` dibandingkan byte demi byte dengan render sebelum phase ini (15 kombinasi: penuh/minimal/panjang/RTL × terang/gelap/auto, varian alternatif, aksen ekstrem): identik sebelum koreksi kontras di bawah.

**Koreksi kontras terhadap kartu (perubahan render untuk semua tema, termasuk Lugas).** Cek otomatis aksen ekstrem (`src/contrast.test.ts`: 8 aksen kurasi + `#FFD60A`, `#111111`, `#FFFFFF` × 4 tema × terang/gelap) menemukan `--pf-accent-text` hanya dikoreksi terhadap `--pf-bg`, padahal teks aksen juga tampil di atas `--pf-surface` (tautan di kartu bagian bebas Lugas, ubin Mozaik, kartu Prima dan Kanvas): 29 dari 44 kombinasi turun ke 4,1–4,4:1. `readableOnNeutrals` kini menggeser warna sampai ≥4,5:1 terhadap latar **dan** kartu (keduanya di sisi terang/gelap yang sama). Berlaku untuk `--pf-accent-text`, `--pf-chart`, `--pf-positive`, `--pf-negative`, warna Gradien hidup, dan catatan "warna dikoreksi" di editor (`accentIsCorrected`). Akibatnya warna teks aksen Lugas sedikit lebih gelap/terang untuk sebagian aksen; hanya nilai token itu yang berubah.

**Efek intro (`src/effects/`, `02-teknis.md` bagian 23).** Ditulis dari nol, tanpa kode React Bits.

- Markup (`shared/hero-text.tsx`): elemen sasaran mendapat `data-pfx="<id>"`. Muncul halus dan Garis vektor membungkus tiap kata dalam `span.pfx-w` (`--i` = urutan) di dalam `<span dir="auto">` (urutan nama Latin benar di halaman RTL). Kilau, Gradien hidup, dan Acak teknologi memakai teks apa adanya. Ketik berganti: headline + ≤2 frasa pengguna (maks. 3, tanpa duplikat), semua frasa ada di HTML sebagai "hantu" tak terlihat di satu sel grid (ukuran dicadangkan, tanpa CLS), frasa pertama tampil, `aria-hidden` pada lapisan, dan `sr-only` berisi semua frasa. Ketik berganti selalu di headline; bila hanya ada satu frasa, efek mati. Efek lain di headline jatuh ke nama bila headline kosong. Efek yang tidak didukung tema → bawaan tema (`themeEffect`).
- CSS (`effects/css.ts`): hanya CSS efek yang dipakai yang ikut ke halaman. Semua animasi di dalam `@media (prefers-reduced-motion:no-preference)`; tanpa itu teks polos (Gradien hidup tetap gradien diam). Muncul halus 0,7 detik per kata, jeda 90 ms (maks. 8 kata), mulai dari opasitas 0,12. Kilau 3 × 1,6 detik lalu polos. Gradien hidup 5 detik sekali. `forced-colors` mematikan latar teks.
- Skrip (`effects/runtime.ts`): Ketik berganti (±4,6 detik untuk 3 frasa, kecepatan menyesuaikan panjang frasa, kursor berhenti berkedip di akhir), Acak teknologi (lapisan `aria-hidden` per huruf di posisi asli dari `Range.getBoundingClientRect`, teks asli transparan selama ±1,1 detik; hanya bila font siap ≤1,2 detik setelah dimuat; dilewati untuk aksara Arab/Ibrani), Garis vektor (hanya `hover: hover` + `pointer: fine` + lebar ≥761 px; huruf dibungkus `span.pfx-c`, heading diberi `aria-label` nama; huruf di bawah kursor jadi `<text>` SVG bergaris putus-putus + kotak seleksi bergagang + label ukuran, hilang 0,65 detik setelah kursor pergi; di HP/layar sentuh CSS memutar Muncul halus). Setiap efek adalah fungsi mandiri `(document) => void`; halaman menyisipkan **sumber fungsinya sendiri** (`effectScript`: `String(fn)` dipadatkan), dan editor memanggil fungsi yang sama. Aturan menulisnya: tanpa impor, variabel luar, komentar di badan, atau fungsi yang diberi nama (`const f = () => …`), karena `tsx` membungkusnya dengan helper `__name` (ditemukan saat uji; `effectScript` tetap memberi helper kosong bila muncul). Ukuran skrip efek per halaman: Ketik berganti ±1,1 KB, Acak teknologi ±1,7 KB, Garis vektor ±2,4 KB (tes: ≤3 KB per efek; satu halaman hanya memuat satu efek). Warna Gradien hidup (`effects/colors.ts`): aksen-teks + rona ±36° (HSL), masing-masing dikoreksi kontras per mode, plus set gelap untuk intro bergambar.
- Server: skrip halaman = skrip bersama + skrip efek, jadi `apps/server/src/static/portfolio-page.ts` menghitung CSP dari skrip halaman itu sendiri (hash per respons). Tes server baru: efek skrip diizinkan lewat hash skrip utuh.
- Diukur di Chrome (halaman Lugas): tidak ada perubahan tinggi `h1` selama animasi, CLS dari efek 0 (CLS kecil yang tersisa berasal dari font, sama dengan "tanpa efek"), tidak ada galat skrip; teks asli ada di HTML sebelum skrip jalan.

**Editor.** `apps/web/src/features/portfolio/theme-gallery.tsx` (`ThemeGallery`, `themePicture`): kartu bergambar (`/portfolio-themes/thumb/[id/]<tema>.webp`, Indonesia memakai `id/`), nama, chip Gratis/Plus (label saja; batas paket Phase 07), deskripsi, dan "untuk siapa" (`themes.ts`: `themeDescription`, `themeAudience`). Dipakai di dialog buat (dua kolom, dialog `lg` di langkah tema) dan Desain → Tema. Desain → **Intro** (`editor/intro-effect.tsx`): latar intro (pindah dari grup Warna) dan pemilih efek: satu kartu per efek yang didukung tema dengan demo mini hidup (CSS dan skrip yang sama dari subpath ringan baru `@rezumi/portfolio/effects`, warna dari `effectDemoColors` di `@rezumi/portfolio/editor`), diputar saat dipilih, ditunjuk, atau difokuskan; "Diputar pada" (nama/headline); dua kolom peran untuk Ketik berganti. Pratinjau tetap **tanpa** `allow-scripts`: dokumen pratinjau diberi `PREVIEW_STILL_CSS` (efek diam selama mengedit) dan tombol **Putar ulang intro** (juga otomatis setelah memilih efek) menjalankan `replayIntroEffect(iframe.contentDocument)` dari skrip editor: menghapus gaya diam, memulai ulang animasi CSS (`getAnimations`), dan memanggil fungsi efek. Dicek di Chrome: Garis vektor bereaksi terhadap kursor di pratinjau (listener milik editor tetap jalan di dokumen tanpa skrip).

**Tema (`src/themes/{prima,kanvas,mozaik}/`, masing-masing `theme.tsx`, `css.ts`, `theme.test.tsx`).** Semua memakai primitif bersama (bagian karya, detail, metrik, media, kontak, kaki) dan hanya token; aturan CSS di bawah `.pf[data-theme="<id>"]`, properti logis untuk RTL; latar intro (polos, gradien lembut, pola, gambar dengan lapisan gelap dan token terang lokal) di semua tema lewat `data-bg` + `--pf-hero-image` seperti Lugas.

- **Prima:** navigasi menempel + tombol "Kirim pesan" (hanya bila ada Kontak; disembunyikan ≤960 px); intro foto kanan/kiri, headline kapital kecil di atas nama (di HTML sesudah `h1`, dipindah CSS agar navigasi heading mendarat di nama), nama serif 600 (`headingWeights: ["400","600","700"]`, `nameWeight: "600"`; 400 untuk kutipan miring), foto 4:5 dengan keterangan = dua sertifikat pertama (tidak ada kolom kredensial di data); strip KPI bersambung (kolom = jumlah angka, 2 kolom ≤900 px; ≤560 px nilai 22 px agar "Rp ٤,٦ ترليون" muat); baris dua kolom 220 px | isi; timeline pengalaman dari `CvList` dengan CSS saja; Karya bawaan grid-2 berjudul "Studi kasus" (`messages.caseStudies`, hanya bila judul tidak diganti); daftar bernomor di bagian bebas jadi angka berlingkar.
- **Kanvas:** nama raksasa (Archivo tanpa sumbu lebar, jadi 72% diganti tracking −0,045em; faktor kata panjang per pasangan font `--kv-k`, dibatasi `100cqi`); Karya langsung setelah intro: grid 6 kolom (4×2 + 2×1, celah baris terakhir diisi otomatis), keterangan muncul saat hover/fokus, selalu tampil di HP dan layar sentuh; tablet sentuh 2 kolom (bukan 1, agar gambar tidak setinggi layar); detail layar penuh berlatar halaman, galeri satu kolom dengan gambar utuh (bukan dipotong 3:2, sesuai aturan galeri `01-desain.md` bagian 3); `headingWeights: ["600","700","800"]`; **`headingDisplay: "optional"`**: di HP 4G lambat nama raksasa sempat pindah baris saat Archivo tiba (CLS 0,111); dengan `font-display: optional` + preload CLS 0, dengan risiko kunjungan pertama yang sangat lambat memakai font cadangan.
- **Mozaik:** grid bento intro dihitung di server (`layout.ts`: `bentoAreas` untuk desktop/tablet/HP, `workSpans` untuk karya) dan ditulis sebagai properti kustom, sehingga setiap kombinasi ubin yang hilang (foto, angka 0–4, Tentang, Lokasi, tautan) tetap persegi tanpa lubang (48 kombinasi dites); Tentang saya dan kartu Lokasi tampil sebagai ubin intro dan tidak diulang di bawah (Kontak tetap menampilkan sisanya; bila Kontak kosong, ubin Lokasi memegang `#contact`); ubin tautan memegang bagian Profil; karya bento 4 kolom dengan ubin penutup "Lebih banyak di {situs}" (`messages.moreOn`, profil karya seperti Behance/Dribbble/GitHub dulu); Testimoni + Klien berdampingan; bagian CV dalam grid ubin.

**Perbaikan bersama lain (ikut mengubah Lugas, sengaja).** `.pf-cover` kini `display:block` (gambar mini video berupa `span`, sehingga potongan 16:9 sebelumnya tidak berlaku dan muncul pita hitam); token `--pf-accent-edge` = aksen, kecuali aksen hampir sama dengan latar (misalnya `#111111` di mode gelap) → bayangan 3:1, dipakai sebagai tepi `.pf-btn--primary` (tampilan sama untuk aksen biasa); tautan navigasi tidak terlipat (`white-space:nowrap`; nama yang sangat panjang yang dipotong). Selain tiga hal ini dan koreksi kontras kartu di atas, render Lugas tidak berubah.

**Tooling (`tooling/portfolio/`).** `persona.ts` + `personas/{nadia,anindya,bayu,citra}.ts`: empat persona fiktif (foto mockup Phase 00, tercatat di `.agents/docs/template-showcase-sources.json`), Inggris dan Indonesia, semua jenis blok, metrik lengkap, layanan, testimoni, klien dengan/tanpa logo buatan, bagian bebas, lokasi dengan peta, frasa ketik; varian A penuh, B minimal, C sangat banyak (12 karya, nama dengan kata ≥19 huruf), D `ar-SA`. `render.ts` (render sama dengan server), `browser.ts` (Playwright + Chrome sistem; `@playwright/test` kini dependensi dev `@rezumi/tooling` lewat katalog), `preview.ts` (`--persona`, `--lang`, `--effect`), `previews.ts` (`portfolio:previews`: 1440×900 @2× dengan efek selesai, mode bawaan tema → `apps/web/public/portfolio-themes/jpg/<tema>.jpg` 1200×750 dan `thumb/<tema>.webp` 600×375, Indonesia di `jpg/id/` dan `thumb/id/`, 10–66 KB), `matrix.ts` (`portfolio:matrix`: 4 tema × 3 persona (milik tema + dua berikutnya) × terang/gelap × 390/1440 × A–D, detail karya pertama, bingkai efek awal/tengah/akhir + kurangi gerakan + HP sentuh untuk Garis vektor, jam halaman dibekukan, lembar kontak per tema dan per efek, peringatan geser horizontal). Satu putaran penuh: 299 gambar (192 halaman, 16 detail, 83 bingkai efek, 8 lembar), ±3 menit. `seed.ts` mendapat `--persona` dan `--lang`.

**Kinerja (2026-11-06, halaman persona tiap tema, HP 390 px, 4G lambat 1,6 Mbps/150 ms, CPU 4×).** LCP Lugas 0,55–0,59 dtk, Prima 0,78–0,79, Kanvas 0,66–0,68, Mozaik 0,90–1,02; CLS 0 di keempatnya (Kanvas setelah `font-display: optional`); tanpa file skrip; skrip inline 3,5 KB (Garis vektor 5,9 KB). Skrip Worker `pnpm check:cloudflare` 11.345.345 byte (Phase 05: 11,25 MB; batas 12 MiB). Fungsi efek di bundel Worker yang di-minify dicek tetap mandiri.

**Diketahui, belum diubah.** Pada halaman RTL, teks Latin (nama, judul bagian Inggris karena katalog Arab belum lengkap) tetap rata kiri karena aturan bersama `unicode-bidi: plaintext` (sama seperti Lugas sejak Phase 02); `nameWeight` satu per tema, jadi pasangan Bodoni di Kanvas mem-preload berkas 800 yang tidak dipakai; kutipan Prima memakai miring sintetis (font judul miring tidak dimuat); peta Lokasi ±1024 px di Mozaik membuat atribusi dua baris.

## 32. Hardening Phase 01–06 (2026-11-07)

Tinjauan menyeluruh atas kode Phase 01–06 oleh enam peninjau (model data, API dan job, permukaan keamanan, renderer, editor, media) menghasilkan ±150 temuan. Yang diperbaiki tercatat di bawah; yang ditunda dicatat di 32.7 dan di dokumen phase terkait. Bila bagian sebelumnya berkata lain, bagian ini yang berlaku.

### 32.1 Data dan skema

- `PORTFOLIO_LIMITS.typewriterPhrases` = 2: jumlah **peran setelah headline** (keputusan pemilik 2026-11-06). Tulis menolak 3; baca menyimpan 2 pertama.
- Rujukan ke CV (`fromResumeItemId`, `sections.hiddenItems`, kunci `resume:<id>`) menerima id CV apa adanya: teks tidak kosong ≤64 karakter (`isResumeReferenceId`, `resumeItemIdSchema`), karena skema CV menerima id apa pun. Id milik portfolio sendiri dan `custom:<id>` tetap `PORTFOLIO_ITEM_ID_PATTERN` (`[\w-]{1,64}`). Anchor yang dibuat dari id CV selalu dibuat aman (32.4).
- Baca toleran `hiddenItems` membuang entri buruk satu per satu (gagal tertutup: item yang disembunyikan tidak pernah jadi publik).
- `richTextLength` hanya menghitung tag sungguhan (`<` lalu huruf, atau `</` lalu huruf) sebagai markup; entitas angka dan `amp/lt/gt/quot/apos/nbsp` dihitung satu karakter, entitas lain dihitung penuh. `fitsRichText(html, max)` = teks ≤ `max` dan HTML ≤ `max × 8`. Sanitizer membuang isi `title`, `xmp`, `plaintext`, `noembed`, `noframes`.
- Batas baru: `sectionKeys` 100, `text.timezone` 64; `PORTFOLIO_UNUSED_FILE_GRACE_MS` (24 jam) pindah ke `@rezumi/schema/portfolio/limits`. `cutText` (dipakai `truncateText`) tidak pernah memotong pasangan surrogate: jsonb Postgres menolak surrogate tunggal.
- Kolom `portfolio.data` bertipe `unknown`: baca hanya lewat `parsePortfolioData`.
- `updated_at` adalah versi data dan hanya bergerak lewat simpan data (`saveVersionedData`, `max(now, sebelumnya + 1 ms)`); `$onUpdate` dihapus. Tulisan lain (setelan, terbit, cek file, penangguhan Phase 11, turun paket Phase 07) tidak menyentuhnya.
- Isi awal dari CV melewati ringkasan yang disembunyikan, bagian Proyek yang disembunyikan, dan proyek yang disembunyikan; HTML CV yang melebihi batas teks atau 8× markup menjadi awal teksnya.
- Teks halaman publik: jumlah halaman PDF memakai "Pages: {count}" (halaman tidak punya aturan jamak per bahasa); `fillPortfolioMessage` mengisi placeholder tanpa pola `String.replace`. `page-text.test.ts` menjaga daftar `page-text.ts` sama dengan `messages.ts`. `defaultPortfolioData` dihapus.

### 32.2 API, file, dan job

- Galat didefinisikan sekali di `packages/api/src/features/portfolio/errors.ts` (`PORTFOLIO_ERRORS`, `portfolioErrorMap` untuk `.errors()`, `portfolioErrors.*` untuk service); kode dan status tidak berubah. Baru: `PORTFOLIO_STORAGE_FULL` (413, `{ bytes, maxBytes, files, maxFiles }`); `PORTFOLIO_SOURCE_INVALID` membawa `data.reason` `unreadable` (data CV tak terbaca) atau `unavailable`.
- Pembatas laju berjalan **sebelum** validasi input (oRPC 1.16: middleware sebelum `.input()`); router menolak data mentah > 4 × 256 KB sebelum parse; satu parse ketat; unggahan punya `z.file().max(...)` (berkas kebesaran → BAD_REQUEST dari router).
- `update`: sanitasi, batas 256 KB, dan folder milik sendiri sebelum kunci; lalu kunci → bandingkan versi (konflik dilaporkan sebelum cek file) → tulis → tandai pemakaian file (sekaligus menolak file yang tidak tercatat). `importWorks` lewat jalur yang sama dan tidak menulis apa pun bila tidak ada yang ditambahkan. `create` menandai pemakaian dalam transaksi yang sama dengan insert.
- Batas teknis penyimpanan per akun: 1 GiB dan 3.000 file (`PORTFOLIO_UPLOAD.accountBytes`/`accountFiles`), dicek di bawah kunci baris portfolio dalam transaksi yang sama dengan insert baris (`recordUploads`); file yang masih dalam masa tenggang ikut dihitung, file yang sudah ditandai `OVERDUE` (portfolio dihapus, atau `deleteFile`) tidak. `portfolio.get().limits.storageBytes` = batas ini. Kuota paket (Phase 07, aturan turunan #9) berada di bawahnya.
- `portfolio.status` (GET, Internal): `{ enabled, portfolio: { isPublic, suspendedAt } | null }` tanpa membaca `data`, jumlah penyimpanan, atau CV; tanpa akses basis data saat saklar `off`. Menu dasbor dan panel Bagikan memakainya.
- Keputusan "file masih dipakai?" (job pembersih, cek mingguan, `deleteFile`, dan penanda pemakaian saat simpan) memakai `portfolioFileKeysInStoredData`: pindai JSON tersimpan mentah untuk setiap kunci file milik portfolio (superset `portfolioFileKeys`). Field file baru atau batas yang diperketat tidak lagi bisa membuat file terpakai terhapus. `portfolioFileKeys` tetap dipakai untuk memvalidasi rujukan saat simpan; uji paritas di `packages/portfolio/src/files.test.ts` memakai fixture yang mengisi semua field file.
- Job: dengan portfolio, di bawah kunci `SKIP LOCKED` cek ulang dari data mentah dan hapus barisnya, commit, baru hapus objek (gagal → file liar untuk cek mingguan); tanpa portfolio, objek dulu lalu baris, berhenti di kegagalan pertama dan diulang putaran berikutnya. Urutan deterministik, tiap akun terisolasi (satu kegagalan tidak menghentikan yang lain; cek mingguan yang gagal di penyimpanan mengembalikan klaimnya, jadi diulang putaran berikutnya), `false` dari adapter penyimpanan dicocokkan dengan daftar objek. Prefiks folder berakhiran `/`, jadi objek bernama mirip di sebelahnya tidak tersentuh.
- `delete`: kunci baris portfolio dulu (urutan sama dengan simpan dan job), hapus barisnya, tandai semua file akun lewat tenggat (`OVERDUE`); job menghapusnya pada putaran berikutnya (100 file per putaran). `deleteFile`: tandai lewat tenggat lalu hapus dengan cara job.
- `storage.deleteFile` umum (juga alat MCP) menolak file dan folder portfolio (`reachesPortfolioFiles`).
- Data CV yang tersimpan tapi tidak lolos parse ketat: `create`/`importWorks` → `PORTFOLIO_SOURCE_INVALID` (`unreadable`); halaman publik tetap tampil tanpa bagian CV (dicatat di log).

### 32.3 Keamanan dan penyajian

- **File portfolio** (`pictures/portfolio/*`, `documents/portfolio/*`): publik hanya bila `isPublicPortfolioFile` (baris file ada dan dipakai, `portfolioOwnsProfilePath` pemiliknya, pemilik tidak dilarang, saklar tidak `off`) → `public, max-age=3600` + `Cross-Origin-Resource-Policy: cross-origin`; selain itu hanya sesi pemiliknya (pratinjau editor) → `private, max-age=3600` + `same-site`; selain itu 404 `no-store`. Dicek sebelum membaca penyimpanan atau ETag. Pembaca foto langsung di Workers (`configureOwnPictureReader`) memakai cek yang sama untuk gambar portfolio. Foto dan font publik non-portfolio kini juga `cross-origin`, agar tampil di domain alias dan domain sendiri.
- **Tautan**: parser meta tanpa regex kuadratik (pemindaian linear; head + 128 KiB pertama body; nilai mentah dibatasi; entitas hanya kunci sendiri), uji 17 halaman jahat 1 MiB < 100 ms. Fetch hanya port bawaan; host dengan titik di akhir (`localhost.`) ikut diblokir; nama yang menunjuk alamat privat dilaporkan `unreachable` seperti nama yang tidak ada (tidak membocorkan DNS internal). Gambar jarak jauh ≤ 50 MP (termasuk ukuran layar GIF). Cache unfurl berversi (`portfolio-unfurl:v2:…`), divalidasi saat dibaca, video tanpa judul tidak di-cache.
- **CSP** halaman portfolio dibangun per direktif (`portfolioContentSecurityPolicy(script, additions)`): `frame-src` hanya YouTube nocookie dan Vimeo, `object-src`/`worker-src 'none'`, `form-action 'self'`, `script-src 'self'` + beacon Cloudflare + hash skrip. Phase 08 menambahkan Turnstile lewat `additions`.
- **Terindeks**: satu aturan SQL `portfolioIsIndexable()` dipakai halaman (kolom `indexable`) dan sitemap.
- **Kunjungan**: hanya GET (bukan HEAD, prefetch, prerender, preview), dicatat setelah respons (Node tanpa menunggu; Workers lewat `configurePortfolioVisitLifetime` → `waitUntil`).
- **Foto**: halaman dan pratinjau hanya menampilkan unggahan aplikasi ini (`ownPictureUrl`, `@rezumi/utils/own-picture`; foto CV di situs lain = tanpa foto). Kartu share memakai sumber non-WebP (salinan kecil JPEG dari jenis `portrait`), selain itu kartu tanpa foto (resvg tidak bisa menggambar WebP). Asal foto dinilai dari origin alamatnya: foto CV yang tersimpan sebagai URL lengkap di `APP_URL` lama (pindah domain, data salinan staging) tidak tampil, jadi pindah domain perlu migrasi URL foto.
- **Username**: `RESERVED_PROFILE_SEGMENTS` (`@rezumi/utils/app-paths`: segmen aplikasi, `cards`, `sitemaps`, berkas di akar situs) ditolak saat daftar, ganti username, cek ketersediaan, dan alokasi username OAuth (`api@…` → `api-1`); akun lama yang sudah memakainya tetap.

### 32.4 View dan renderer

- **Privasi di view**: "Tanpa foto" (`hero.showPicture: false`) mengosongkan `basics.picture` juga, jadi kartu share dan JSON-LD tidak memuat foto. `view.works` hanya berisi karya bagian Karya yang tampil (kosong bila disembunyikan), dan keempat tema menggambar detail serta lightbox dari situ; `openWorkId` adalah pengecualian khusus pratinjau editor. Bagian CV yang disembunyikan utuh (standar maupun bebas) tidak tampil, termasuk Profil di Kontak. URL situs dan profil dari CV harus http(s) (domain tanpa skema mendapat `https://`, lainnya dibuang). Titik lokasi dibulatkan sesuai presisi: kota 2 desimal, provinsi dan negara derajat bulat (juga di tautan OpenStreetMap).
- **Kebenaran**: karya tanpa judul dilewati; karya Unggulan didahulukan pada tata letak yang memperbesar karya pertama (featured-grid, bento); tombol Kontak hanya tampil bila bagian Kontak tampil; id judul `<anchor>--title` (`headingId`, tidak bisa bertabrakan dengan anchor karya karena slug tidak memuat `--`); anchor dari id CV yang tidak biasa menjadi `resume-x<hash FNV>` dan dibuat unik; `resolveSectionOrder` membuang kunci yang ditolak skema; registri tema dan palet berupa record lengkap tanpa cadangan Lugas.
- **Tautan dan ikon**: `linkAttributes` hanya menerima http(s), mailto, tel, `#` dan path root; `imageUrl` bawaan `renderPortfolioPage` berupa daftar izin (bukan identitas); pencarian ikon hanya entri milik sendiri (`brandIcon: "constructor"` tidak lagi menyisipkan markup).
- **Aksesibilitas**: detail karya terbuka mendapat `.pf-open`, `aria-modal="true"`, dan semua bagian lain di bawah `.pf` menjadi `inert` (juga untuk lightbox); fokus ke judul satu frame kemudian (kunjungan langsung ke `#work-…`); panah diabaikan di dalam `.pf-gallery` atau dengan tombol pengubah; lightbox tertutup saat `hashchange`. Nama aksesibel gambar galeri jatuh ke keterangan lalu "judul karya (n/m)"; klien tidak dibaca dua kali, ikon merek tanpa nama mendapat `role="img"`; teks kaya H2/H3 diturunkan satu tingkat bila memakai H2; jam lokal dan grafik mini punya teks khusus pembaca layar; efek vektor memakai salinan teks khusus pembaca layar.
- **Kontras**: token `--pf-accent-text-soft` terbaca di atas `--pf-accent-soft`, latar, dan kartu; warna tren dikoreksi terhadap warna chip-nya sendiri; uji 14 aksen × 4 tema × 2 mode atas halaman, kartu, tint lembut, dan tint chip.
- **Efek**: Ketik berganti selesai ≤4,6 detik termasuk jeda (headline + ≤2 peran); Acak teknologi memecah per grafem (`Intl.Segmenter`) dan putar ulang menghentikan putaran sebelumnya; Kilau berakhir di warna elemennya sendiri. Anggaran: skrip halaman + satu efek ≤ 6 KB tanpa spasi (diuji), tiap efek ≤ 3 KB, satu efek per halaman. Ukuran sekarang: skrip halaman 3.544 B; skrip + Garis vektor 6.125 B.
- **CSS**: garis waktu memakai selektor anak (peran di bawah satu pekerjaan tidak mendapat titik dan garis kedua); `.pf-extralist` untuk daftar ekstra (Profil Lugas kini bergaya); aturan ganda dan mati dihapus; lencana tanpa `!important`.
- **Bagian bersama tema** (refaktor D19/D20): `PageShell` dan `Navigation` (`shared/shell.tsx`, dengan slot untuk perbedaan tema), `useIntroBackground`/`IntroChips`/`introLocation` (`shared/intro.tsx`), `ServiceList`/`TestimonialList` (`shared/offers.tsx`), `Section`/`ExtraSection`/`CustomSectionBody`/`WorkDetails` (`shared/parts.tsx`), `ResumeSectionBody` dan daftar CV (`shared/resume.tsx`). Item CV dibaca bertipe oleh `resume-entries.ts` (`PortfolioViewEntry`; tiap bagian CV di view membawa `entries` di samping `items`; testimoni membawa `initials`), tanpa cast di tema. Helper data Mozaik ada di `themes/mozaik/data.ts` (diuji). Latar intro memakai satu set aturan dasar: tiap tema hanya menulis `background:var(--pf-hero-bg)` pada elemen intro dan mengatur `--pf-hero-ground`/`--pf-hero-shade` (Lugas dan Kanvas .62/.70, Prima .68/.76, Mozaik .70/.78); tema baru wajib melakukan hal yang sama. Kartu karya tetap per tema karena keempatnya memang berbeda. Bukti: 4.404 halaman (4 tema × 20 data × en-US/id-ID/ar-SA × terang/gelap/otomatis, plus semua varian, latar intro, dan efek) identik byte demi byte sebelum perubahan sengaja; perubahan sengaja hanya kelas `pf-service__desc` di semua tema dan Garis vektor yang tidak lagi mengganti teks RTL ke Muncul halus (cadangan itu tidak pernah tampil di desktop); gaya terhitung di Chrome pada 1.440 pasangan halaman tanpa selisih.
- **Uji**: `script.test.ts` (happy-dom), `effects/runtime.test.ts`, cek nama bebas efek lewat `parseAst`, dan helper bersama di `fixtures.test-helpers.ts` (`fullPortfolioData`, `renderTestPage`, `expectSoundPage`: satu h1, id unik, rujukan `aria-labelledby` dan `#href` ada, alt, tautan bernama, tanpa level judul terlompati) dijalankan untuk tema × varian × LTR/RTL.

### 32.5 Editor web

- **Simpan**: status `saving`/`saved`/`error` (bisa diulang: jaringan, 5xx, 408, 429, 401; mundur 2–60 detik, ikut `reset` 429, langsung saat event `online`), `invalid` (ditolak: data tidak sah dengan lokasinya, terlalu besar, file hilang, nanti galat paket) dan `gone` (portfolio terhapus atau saklar dimatikan: Muat ulang / Kembali). Ukuran data dicek di browser sebelum dikirim; tiap simpan berbatas 30 detik; semua pemanggil `flush()` menunggu simpan yang berjalan dan mendapat hasil sebenarnya; jawaban simpan hanya mengambil `updatedAt`; meninggalkan editor menyimpan dulu (≤10 detik) lalu bertanya "Keluar tanpa menyimpan?". Konflik versi: salinan server diambil; bila sama dengan yang dikirim editor ini, versinya diambil diam-diam; bila beda, dialog Muat ulang / Pertahankan versi saya.
- **Pesan galat**: satu pemetaan berbahasa pengguna (`apps/web/src/features/portfolio/errors.ts`, `portfolioErrorMessage`); pesan Inggris server tidak pernah tampil. Status simpan menyebut tempat masalahnya ("Intro → Sapaan") dengan tombol Tunjukkan.
- **Terbit dan status**: hanya Terbitkan yang menunggu simpan berhasil dan berhenti bila gagal; `isPortfolioLive` (terbit dan tidak diturunkan) dipakai di editor, panel Terbitkan, kartu dasbor (chip "Diturunkan"), dan panel Bagikan; `invalidatePortfolioQueries` menyegarkan `portfolio.*` dan daftar CV setelah buat, terbit, setelan, dan hapus.
- **Lain-lain**: demo efek dibangun di luar pohon React (tidak lagi crash saat nama berubah); galeri tema, warna aksen, dan kartu efek berupa radio group (satu Tab, panah memindah pilihan); live region simpan hanya mengumumkan kegagalan; foto khusus portofolio disimpan di store UI editor selama setengah masa tenggang file (12 jam), jadi tidak hilang saat pindah tab; urutan bagian `resume:<id>` yang belum termuat tidak hilang saat menggeser bagian; `edit(…, { history: false })` untuk perubahan otomatis tanpa langkah Urungkan.
- **Gambar**: ukuran piksel dibaca dari header berkas sebelum didekode (bom dekompresi ditolak sebelum memakan memori), dekode diperkecil, ulang tanpa opsi orientasi di Safari 15, dukungan WebP dicek sekali, kanvas dilepas; jenis `portrait` (foto profil) selalu membuat salinan kecil JPEG; unggahan bisa dibatalkan, maks. 50 gambar per seret, berhenti pada 429 dan penyimpanan penuh, unggahan yang tidak jadi dipakai dihapus lewat `deleteFile` (yang sudah dipakai lalu diganti tetap disimpan untuk Urungkan).
- **Blok**: alamat tautan divalidasi sebelum dibaca (email mendapat pesan sendiri); blok Video menunda pembacaan 600 ms dan membatalkan permintaan lama; blok yang datang terlambat masuk setelah blok tetangganya; Urungkan dari toast hanya mengembalikan blok itu bila ada perubahan lain sesudahnya; kunci gambar stabil dan fokus berpindah setelah menghapus; usulan gambar dimuat `no-referrer`; berkas dipecah ke `blocks/{add-media-block,video-block,pdf-block,link-block}.tsx` dan `works/add-work/*`; ruang karya membaca `limits.works` dari server.
- **Lokasi**: setiap perubahan titik, presisi, atau saklar peta menghapus `location.map` dalam suntingan yang sama; gambar peta dibuat ulang oleh `location/map-pictures.ts` yang mengikuti store (bukan form), tanpa langkah Urungkan, dengan batas waktu di tiap langkah; ganti presisi tidak pernah mengubah zona waktu atau menebak kota (presisi lebih halus setelah muat ulang meminta kota dipilih lagi); provinsi dengan < 5 kota terdaftar berpusat di negaranya, negara kecil dibulatkan ke derajat bulat; pencarian kota memakai normalisasi yang di-cache dan bahasa aplikasi + halaman + Inggris.
- **Metrik**: angka ditampilkan dengan digit Latin dan dibaca dari digit aksara apa pun (Arab, Persia, Bengali, Devanagari) serta pemisah `٫`/`٬`; tombol ± untuk tanda minus (papan angka iPhone tidak punya minus).

### 32.6 Aturan untuk phase berikutnya

- Urutan kunci: baris `portfolio` dulu, baru baris `portfolio_file`; job tidak pernah menunggu (`SKIP LOCKED`). Penulis baru `portfolio_file` (kuota Phase 07, penurunan Phase 11) mengikuti urutan ini.
- Setiap penulis `data` lewat `saveVersionedData` + `markFileUsage`; penulis lain tidak menyentuh `updated_at`. `portfolioService.update` menerima data yang sudah di-parse.
- Field file baru: tambahkan ke `portfolioFileKeys` dan ke fixture penuh di `packages/portfolio/src/files.test.ts` (uji paritas gagal bila lupa); pemindaian mentah menjaga file tetap aman sementara itu.
- Jalur publik baru untuk file portfolio lewat `isPublicPortfolioFile`; CSP baru lewat `additions`; skrip halaman baru tetap dalam anggaran 6 KB (diuji).
- Galat API baru: definisikan di `packages/api/src/features/portfolio/errors.ts` dan beri kata-kata di `apps/web/src/features/portfolio/errors.ts`; editor menggolongkannya di `editor/save-failure.ts`.
- Teks halaman publik baru: `messages.ts` + `page-text.ts` (diuji sama), placeholder diisi dengan `fillPortfolioMessage`.

### 32.7 Ditunda

- **Phase 07**: kuota paket di `recordUploads` (transaksi yang sama); putuskan apakah file yang menunggu dihapus ikut kuota; `limits.storageBytes` menampilkan kuota paket; galat paket sudah digolongkan `invalid` di editor.
- **Phase 08**: batas hari statistik masih UTC (`public.ts`); deduplikasi per IP (CGNAT, `ip:unknown`); Turnstile lewat `additions` CSP.
- **Phase 09**: host yang bukan host aplikasi dan bukan domain sendiri terverifikasi jatuh ke seluruh aplikasi (`apps/server/src/http/custom-domain.ts`); jawab 404/421 atau alihkan ke `APP_URL`.
- **Phase 11**: metadata PDF (Author, XMP) tidak dihapus; belum ada pilihan "tanpa lokasi" (kosong = ikut CV); tombol Email/WhatsApp memuat alamatnya walau kartu Kontak menyembunyikannya (tombol = persetujuan, perlu dijelaskan di editor dan S&K); penangguhan tidak boleh mengubah `updated_at`.
- **Backlog**: titik "dibuat untuk" pada `location.map` dan identitas kota `location.place`; teks halaman untuk nama gambar galeri dan ringkasan tren; label "Disembunyikan di CV" di daftar bagian editor; `apps/web/src/features/letters/store.ts` punya celah `flush()` yang sama dengan editor portfolio sebelum hardening.

## 33. Tema Paper (2026-11-07)

Permintaan pemilik menambahkan tema `paper` ke builder, sebagai tema kelima. Spesifikasi visual: `01-desain.md` bagian 20. Implementasi di `packages/portfolio/src/themes/paper/{theme.tsx,css.ts}`; skema/metadata di `packages/schema/src/portfolio/themes.ts`; registry, palet dan galeri memakai daftar tema yang sama. Galeri memakai Nadia dan menyediakan gambar Inggris/Indonesia.

- `PortfolioThemeInfo` mendapat `fallbackAccent?` dan `monoFont?`. Paper memakai fallback oranye saat tidak ada warna CV yang sah, dan JetBrains Mono untuk angka/tanggal; Brutal kemudian memakai fallback kuning dan IBM Plex Mono. Semua pilihan aksen dan font pengguna tetap dihormati. `portfolioFontFaces` memuat bobot 400/700 font mono hanya pada tema yang menyatakan font mono sendiri; keluaran empat tema lama tidak berubah.
- Paper adalah React statis dengan CSS di bawah `.pf[data-theme="paper"]`. Ilustrasi dekoratif SVG ditulis sendiri dan tidak memerlukan skrip baru, shader, dependensi atau perubahan CSP. Detail karya, video/PDF/tautan, lokasi, privasi, sanitasi, efek dan pratinjau memakai jalur bersama.
- `tooling/portfolio/previews.ts` kini meneruskan `theme` secara eksplisit: persona yang dipakai lebih dari satu tema dirender dengan tema yang diminta. Aksen fallback tema dipakai untuk gambar galeri Paper; persona lain tetap mengikuti warna CV-nya.
- Tes struktur, varian, bahasa, efek dan kontras otomatis mencakup Paper lewat daftar `PORTFOLIO_THEMES`. Tes hardening halaman yang sebelumnya menyebut empat ID secara literal juga membaca daftar itu. Tes khusus Paper memeriksa urutan/terjemahan, media, privasi foto/karya tersembunyi, font dan resolusi aksen.

**Verifikasi:** renderer portfolio 323 tes, skema portfolio 61 tes, editor web portfolio 186 tes, server portfolio 21 tes, semuanya lulus. Typecheck `@rezumi/portfolio`, `@rezumi/schema`, `@rezumi/tooling`, `web`, `server`, `lint:agent`, `format:check`, `turbo boundaries` dan `check:cloudflare` lulus. Chrome: 48 kombinasi layout (360/390/768/1440/1920 px, terang/gelap, minimal/penuh/panjang/RTL, grid alternatif), menu HP, detail, fokus, latar inert, lightbox dan Escape lulus tanpa galat skrip. Matriks menghasilkan 16 halaman, 4 detail, 25 bingkai efek dan 2 lembar kontak; tidak ada geser horizontal. Galeri Inggris/Indonesia masing-masing ±38 KB JPEG / 10 KB WebP. Tidak ada migrasi atau deployment; `PORTFOLIO_MODE` produksi tetap `off`.

**Koreksi tekstur, 2026-11-07:** permintaan pemilik setelah menilai hasil. `themes/paper/texture.ts` menyimpan WebP asli dari portfolio pemilik sebagai data URI; SHA-256 `6e0284922ec6e100bf30764f54a6f5c3b5fad275b45f51499c9fbfb7b890b9bd`. Ini aset hasil render PaperFibre yang sudah dipakai proyek acuan, bukan grain buatan pengganti. `css.ts` menggambar lapisan di belakang isi dan footer, dengan `multiply` di terang serta `invert(1)` + `screen` di gelap/otomatis. Gambar ditanam agar renderer Node, Workers, pratinjau sandbox dan domain sendiri memakai aset identik tanpa permintaan tambahan. CSS bertambah sekitar 29 KB; skrip halaman tetap 3.544 byte. Galeri Inggris/Indonesia dibuat ulang. Verifikasi ulang perbaikan: 323 tes renderer, typecheck portfolio, boundaries, lint global, format global dan dry-run Cloudflare lulus. Chrome memuat WebP asli di terang/gelap pada 1440/390 px, tanpa galat skrip atau geser horizontal; footer dan potongan tekstur diperiksa secara visual. Galeri menjadi sekitar 42–43 KB JPEG / 10 KB WebP per bahasa.

## 34. Tema Brutal (2026-11-07)

Tema `brutal` menambah gaya neobrutalism sesuai referensi pemilik. Visual: `01-desain.md` bagian 21. Kode di `packages/portfolio/src/themes/brutal/{theme.tsx,css.ts}`; metadata, font `space-inter`, varian dan urutan di `@rezumi/schema/portfolio/themes`; palet, registry, deskripsi galeri dan pemetaan persona ikut ditambahkan. Galeri memakai Citra dan aksen fallback tema untuk menampilkan pilihan kuning, sedangkan halaman pengguna tetap mengikuti aksen CV/pilihannya.

- Memakai `PageShell`, `Navigation`, `HeroName`/`HeroHeadline`, latar intro, bagian CV, `ServiceList`, `TestimonialList`, detail karya, media, lokasi dan metrik bersama. Tidak ada dependensi, skrip halaman, CSP, migrasi, atau endpoint baru.
- CSS berada di bawah `.pf[data-theme="brutal"]`; token `--br-stroke`, `--br-shadow` dan `--br-pad` menjaga ketebalan, offset bayangan dan jarak. Potret grayscale dan dekorasi bintang hanya gaya tema. Isi kosong dan bagian tersembunyi tetap disaring oleh view bersama.
- Daftar tema, uji struktur/varian/RTL, kontras dan pengujian efek mengikuti `PORTFOLIO_THEMES`; tes khusus menguji isi/urutan, blok attachment, privasi karya/foto dan aksen mandiri. Kuning bawaan juga masuk uji kontras ekstrem.

**Verifikasi Brutal:** 354 tes renderer portfolio, 61 tes skema portfolio, 186 tes editor web dan 21 tes server portfolio lulus (622 total); setelah perapian thumbnail PDF/tombol video, 113 tes terkait tema/struktur/kontras diulang dan lulus. Typecheck lima paket (`portfolio`, `schema`, `tooling`, `web`, `server`), boundaries dan dry-run Cloudflare lulus. Chrome: 58 kombinasi layout 360/390/768/1440/1920 px (penuh, minimal, panjang, RTL, terang/gelap, grid alternatif dan varian intro), menu HP, detail, fokus, latar inert, lightbox dan Escape tanpa galat atau geser horizontal. Dekorasi awal melebar 7 px di tablet; diperbaiki dengan ruang sisi kartu, tanpa memotong bayangan. Matriks 39 gambar (16 halaman, 4 detail, 17 bingkai efek, 2 lembar kontak) diperiksa lewat lembar kontak dan tangkapan detail. Galeri Inggris/Indonesia sekitar 56–57 KB JPEG / 15 KB WebP. Tidak ada deployment atau perubahan saklar produksi.

## 35. Catatan implementasi Phase 07 (2026-11-09)

- **Katalog** (`packages/schema/src/billing/catalog.ts`, versi 7): lima fitur baru, `PlanLimits.portfolioWorks`/`portfolioStorageBytes`, `FREE_PORTFOLIO_THEMES`, `FREE_PORTFOLIO_HERO_EFFECTS`. `PLAN_FEATURE_KEYS` = `DOCUMENT_PLAN_FEATURE_KEYS` + `PORTFOLIO_PLAN_FEATURE_KEYS`; web mencantumkan yang portfolio hanya bila `portfolio.status.enabled`, mobile hanya yang dokumen.
- **Satu pintu penegakan**: `assertPortfolioPlan` (`packages/api/src/features/portfolio/plan.ts`) dipanggil `saveVersionedData` (jadi `update`, `importWorks`, dan penulis berikutnya seperti AI Phase 10) dan `create`. Aturan fitur ada di fungsi murni `portfolioFeaturesNeeded`: hanya nilai yang **baru dipilih** yang butuh fitur. Tidak ada tulisan apa pun saat paket berakhir, jadi `updated_at` tidak bergerak; `credit.show: false` tetap tersimpan dan halaman publik memaksa badge dari hak akses saat ini.
- **Urutan kunci**: `portfolio` → akun billing (`lockBillingAccount`) → `portfolio_file`. Jangan mengambil kunci billing sebelum kunci portfolio pada jalur yang menulis portfolio.
- **Kuota penyimpanan** di `recordUploads`, transaksi yang sama dengan batas teknis. Kuota yang sama dengan batas teknis (paket berbayar) dilaporkan sebagai `PORTFOLIO_STORAGE_FULL`, karena tidak ada paket yang lebih besar; di bawahnya `PLAN_LIMIT_REACHED`. Keputusan: file yang menunggu dihapus 24 jam **ikut dihitung** (angka meteran = angka yang ditegakkan); file `OVERDUE` tidak.
- **`create`** dari CV dengan proyek melebihi batas paket mengambil karya pertama sebanyak batas, bukan menolak.
- **Domain sendiri** (`custom-domain/service.ts`): `set` (hostname baru) dan `verify` (domain belum terverifikasi) butuh fitur `customDomain`, **hanya bila portfolio terbuka untuk akun itu**, agar `PORTFOLIO_MODE=off` tidak mengubah perilaku. Memeriksa ulang domain yang sudah terhubung tidak butuh fitur.
- **Untuk Phase 09**: masa tenggang domain 7 hari setelah paket berakhir (aturan turunan #2) dikerjakan di sana: domain berhenti dan mengarah ke `rezumi.app/<username>`, aktif lagi saat berlangganan lagi, tanpa menghapus baris `custom_domain` selama masa tenggang. Akun Gratis yang sudah punya domain terverifikasi sebelum portfolio dibuka mengikuti jalur yang sama.
- **Untuk Phase 08**: `detailedPortfolioStats` membatasi rincian di `portfolio.statistics`.
- **Logo tools** (aturan turunan #4): renderer portfolio saat ini tidak menggambar logo tools di Keahlian (hanya logo klien dan ikon merek di blok tautan), jadi belum ada yang ditegakkan; bila ditambahkan, pakai `brandLogos`.
- **Web**: `usePlan`/`hasPlanFeature`, `isLockedPortfolioTheme`, `isLockedHeroEffect`, `openPlanDialog`. Galat paket saat simpan, unggah, dan impor membuka dialog paket. Label paket hanya tampil bila paket berlaku untuk akun. Meteran `works/storage-meter.tsx` membaca `portfolio.get` lagi setelah unggahan (`usePortfolioEditorUi.noteUpload`).
- **File `OVERDUE` dianggap sudah hilang**: tidak dihitung kuota, jadi `markFileUsage` tidak menghidupkannya lagi dan simpan yang menyebutnya mendapat `PORTFOLIO_FILE_NOT_FOUND` seketika. Tanpa ini, akun bisa melewati kuota lewat hapus portfolio → buat lagi → simpan kunci lama.
- **Baca paket setelah kunci**: di `recordUploads` dan saat menambah karya, kunci billing diambil dulu lalu hak akses dibaca (`isBillingAppliedTo` lebih dulu, agar tanpa kunci bila paket tidak berlaku).
- **Dialog paket hanya untuk aksi pengguna**: unggahan batch, salin gambar tautan, PDF, impor karya, dan simpan. `uploadPortfolioImage` sendiri diam, jadi gambar peta dan thumbnail video di latar belakang tidak memunculkan modal; thumbnail berhenti mencoba begitu kuota penuh. Simpan otomatis menjelaskan satu masalah paket sekali sampai ada simpan yang berhasil (`explainPlanProblem`); status simpan tetap menyebutnya.
- **Tawaran domain `.cv`** tidak ditampilkan pada akun yang belum bisa menghubungkan domain.
- **Rilis**: daftar manfaat di halaman Paket, kartu harga, dan llms.txt hanya menyebut portfolio saat fitur terbuka (`flags.portfolio`, `PORTFOLIO_MODE=on`). S&K ID/EN berupa draf yang belum disetujui pemilik; baris portfolio ditandai berlaku setelah peluncuran.

## 36. Catatan implementasi Phase 08 (2026-11-09)

Statistik pengunjung dan form kontak. Bila bagian 9, 10, atau `01-desain.md` bagian 9 berkata lain, bagian ini yang berlaku.

- **Daftar bersama** di `@rezumi/schema/portfolio/statistics`: jenis klik, sumber, perangkat, batas form, nama kolom jebakan.
- **Rute publik** (`apps/server/src/http/portfolio.ts`, juga di domain sendiri): `POST /api/portfolio/:username/event` (JSON sebagai teks, `sendBeacon`, jawab 204) dan `POST /api/portfolio/:username/message` (form; `Accept: application/json` dijawab JSON, selain itu 303 ke `?contact=sent|failed#contact`).
- **Skrip** `PORTFOLIO_LIVE_SCRIPT` (1,8 KB) terpisah dari skrip halaman dan hanya dikirim bila `renderPortfolioPage` mendapat `live`; pratinjau editor tidak memilikinya, jadi tidak pernah menghitung atau mengirim. Anggaran 6 KB (skrip halaman + satu efek) tidak berubah; anggaran baru skrip terbit ≤1,75 KB (diuji). Turnstile dimuat dengan `render=explicit` saat form mendekati layar atau mendapat fokus; widget mengikuti `data-pf-scheme`.
- **Tanpa JavaScript**: Turnstile tidak bisa berjalan, jadi `<noscript>` menyembunyikan form dan menampilkan catatan. Server menolak kiriman tanpa token (tidak ada jalur tanpa token).
- **Dedupe**: kunci per jam = hash SHA-256 dari IP + user agent + bahasa, jadi pengguna satu IP (CGNAT) tidak melebur; IP mentah tidak disimpan. Klik per jenis per jam, karya per ID per jam.
- **Hari statistik** memakai `user.timezone` pemilik (bawaan UTC); dashboard dan rincian karya per hari Analytics Engine (`toStartOfInterval` dengan zona pemilik) memakai zona yang sama.
- **Pemilik tidak dihitung**: sesi dibaca tanpa penanda lintas situs (`origin`, `sec-fetch-site`), jadi pemilik yang membuka halamannya dari LinkedIn tetap dikenali; hasilnya hanya menentukan dihitung atau tidak. Di domain sendiri tidak ada cookie sesi, jadi kunjungan pemilik di sana masih terhitung (Phase 09 boleh memperbaikinya).
- **Sumber** dibaca dari `Referer` (hanya domain) dan `utm_source` lewat fungsi murni di `traffic.ts`. Data point klik tidak punya sumber, karena `Referer` beacon adalah halaman portfolio itu sendiri.
- **Analytics Engine**: binding `PORTFOLIO_EVENTS` (dataset `portfolio_events`) dan `ANALYTICS_SQL` (`analytics`, butuh Wrangler ≥4.145; terpasang 4.157). Retensi 3 bulan; maks. 1 indeks, 20 blob, 250 data point per pemanggilan. Paket Workers Paid: 10 juta tulis dan 1 juta baca per bulan, selebihnya $0,25 dan $1 per juta; Cloudflare belum menagih saat ini. Binding `analytics` tidak punya versi lokal, jadi `pnpm dev:cloudflare` memakai `--local` dan smoke test membuang binding itu; tanpa keduanya Wrangler membuka sesi ke Cloudflare dan butuh token API. Kueri lewat binding tidak boleh memuat `accountTag` atau `FORMAT`. `SUM(double1)` sudah berbobot sampling. Cache ±5 menit per portfolio. Di Node binding tidak ada: rincian disembunyikan (`details.state = "unavailable"`).
- **Gerbang paket** (aturan turunan #16): `details.state = "locked"` tanpa `detailedPortfolioStats`.
- **Peta asal pengunjung**: titik per negara di tengah kota-kota yang terdaftar pada daftar GeoNames yang sudah dibundel, ukuran mengikuti akar jumlah kunjungan. Tidak ada data batas negara baru.
- **Pesan**: `portfolio_message` (hapus bersama portfolio dan akun). Retensi 90 hari di `runPortfolioJobs`, tetap berjalan saat `PORTFOLIO_MODE=off` karena ini data pribadi.
- **Batas**: 20 percobaan/jam per IP sebelum Turnstile; 3 pesan/jam per IP, 5/hari per IP per portfolio, dan 30/hari per portfolio dihitung hanya untuk pesan yang lolos Turnstile, jadi percobaan gagal tidak memakai jatah dan satu pengunjung hanya bisa memakai sebagian. Kunjungan dibatasi 120/jam per IP per portfolio dan klien tanpa user agent tidak dihitung. `FLAG_DISABLE_API_RATE_LIMIT` dihormati untuk E2E.
- **Kunci uji Turnstile** selalu menjawab hostname `example.com`, jadi cek hostname dilewati hanya untuk secret uji resmi. Widget produksi jangan mengizinkan `localhost` bila memungkinkan; langkah pemilik di Phase 08 mencantumkannya untuk uji lokal, jadi cek hostname server tetap menjaga produksi.
- **Email**: satu email per 10 menit per portfolio lewat klaim atomik `portfolio.message_email_at` (tidak menyentuh `updated_at`); sisanya digabung oleh job menit-an, yang terlama menunggu didahulukan. Kirim gagal atau email belum diatur tidak melepas klaim, jadi dicoba lagi 10 menit kemudian dan tidak mengirim ulang tiap menit. Galat simpan pesan dicatat dengan teks tetap (pesan galat Drizzle memuat nilai kueri, termasuk isi pesan). Bahasa dari `billing_account.locale`, lalu bahasa halaman, lalu `id` (tidak ada kolom bahasa akun). `deliverEmail` mendapat `replyTo` dan `privateBody`: tanpa SMTP, log hanya memuat subject dan penanda.
- **Domain sendiri**: lihat bagian 10; form menjadi tombol ke domain aplikasi.
- **Untuk Phase 11**: Kebijakan Privasi menyebut statistik agregat tanpa cookie, pesan kontak (90 hari), Turnstile sebagai layanan pihak ketiga, dan bahwa email pengirim terlihat pemilik portfolio.
- **Untuk Phase 12**: isi `TURNSTILE_SITE_KEY` di `vars` dan `pnpm exec wrangler secret put TURNSTILE_SECRET_KEY`; terapkan migrasi `20261109024510_stormy_thena`. Tanpa kedua kunci, form tidak tampil.
