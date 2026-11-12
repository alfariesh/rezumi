# Phase 13 — Fitur lanjutan (gelombang kedua)

| Dikerjakan                                                                      | Ukuran       | Bergantung pada                                                               | Perlu dari pemilik                           |
| ------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------- | -------------------------------------------- |
| Claude: Langkah 0, lalu 4 sesi paralel per lapisan, lalu satu langkah integrasi | Sangat besar | Phase 12 dan pass tinjauan di `feat/portfolio-review-2` sudah masuk ke `main` | Jawaban "Perlu keputusan pemilik" (bagian 8) |

**Status (2026-11-12): 🟡 langkah integrasi berjalan.** Langkah 0 dan keempat sesi gelombang 1 selesai (laporan di `laporan-phase-13/`); jawaban bagian 8 sudah ada (#1 dan #2 dipilih pemilik, #3–#8 bawaan koordinator). Tinjauan keamanan atas build menghasilkan lima perbaikan (`laporan-phase-13/pf-server.md`, "Security review"; ringkasan di `02-teknis.md` bagian 41.5), termasuk file portfolio terkunci yang kini hanya dilayani dengan token, yang menggantikan "risiko yang diterima" di bagian 3.4 dan 9. Dokumen internal bagian 10 diperbarui (butir yang tercentang). **Belum:** E2E `portfolio-phase-13.spec.ts` dijalankan, matriks visual 8 tema dan penilaian pemilik atas Sintaks dan Warta, panduan publik `docs/guides/creating-a-portfolio.mdx` (dikerjakan agent lain), teks Kebijakan Privasi (usulan di `draf-privasi-phase-13.md`, menunggu persetujuan pemilik), catatan paritas mobile.

Dipilih pemilik 2026-11-12 dari `backlog-lanjutan.md`: B2, B14, B1, B16, B17, B19, B9. Belum ada pengguna sungguhan, jadi data tersimpan, skema DB, dan bentuk API boleh berubah. Web saja; `apps/mobile` tidak disentuh (aturan `CLAUDE.md`). Dokumen ini adalah **kontrak**: empat sesi bekerja bersamaan tanpa saling bicara, jadi nama field, prosedur, rute, string, dan pemilik setiap file ditulis persis di sini. Bila kode yang ditemui berbeda dari yang ditulis (nama simbol bergeser karena pass tinjauan), pakai konsep yang sama dan catat selisihnya di laporan; jangan mengubah kontrak sepihak.

## Untuk pemilik

**Apa yang dibuat:**

1. **Halaman sendiri untuk setiap karya** (B2): `rezumi.app/<username>/work/<slug>` (di domain sendiri `/work/<slug>`). Kartu karya di halaman utama membuka halaman itu; setiap karya punya kartu share, masuk Google, dan bisa dibagikan sendiri. Jendela detail di atas halaman utama diganti halaman ini.
2. **Kartu nama digital** (B14): kode QR ke portfolio (unduh PNG/SVG, cetak 10 kartu di A4, tampil layar penuh di HP saat job fair) dan tombol **Simpan kontak** di halaman yang mengunduh kartu kontak (vCard) ke HP pengunjung.
3. **Dua tema baru** (B1): **Sintaks** untuk developer/IT (gaya terminal) dan **Warta** untuk penulis/PR/pemasaran (gaya majalah). Enam tema jadi delapan.
4. **Portfolio berkata sandi** (B16): pengunjung harus memasukkan kata sandi, seperti CV berkata sandi.
5. **Sematan baru di karya** (B17): Figma, Loom, Spotify, SoundCloud, Google Slides, di samping YouTube dan Vimeo. Tetap baru dimuat setelah pengunjung menekan tombol.
6. **"Open to work" lebih lengkap** (B19): selain label, posisi yang dicari (maks. 5) dan jenis kerja (penuh waktu, kontrak, lepas, dll.).
7. **Statistik lanjutan** (B9): pilihan 7/30/90 hari, angka per karya dengan rinciannya, sumber "QR", dan unduh CSV.

**Siapkan sebelum mulai:** jawab daftar di bagian 8. Boleh dijawab "ikut rekomendasi semua".

**Cara menjalankan (berurutan):**

1. Satu sesi: `Kerjakan Langkah 0 Phase 13 dari .agents/docs/plans/portfolio/phase-13-fitur-lanjutan.md`. Tunggu sampai di-commit.
2. Empat sesi sekaligus, masing-masing satu prompt:
   - `Kerjakan sesi pf-server Phase 13 dari .agents/docs/plans/portfolio/phase-13-fitur-lanjutan.md`
   - `Kerjakan sesi pf-render Phase 13 dari .agents/docs/plans/portfolio/phase-13-fitur-lanjutan.md`
   - `Kerjakan sesi pf-themes Phase 13 dari .agents/docs/plans/portfolio/phase-13-fitur-lanjutan.md`
   - `Kerjakan sesi pf-web Phase 13 dari .agents/docs/plans/portfolio/phase-13-fitur-lanjutan.md`
3. Setelah keempatnya selesai: `Kerjakan langkah integrasi Phase 13 dari .agents/docs/plans/portfolio/phase-13-fitur-lanjutan.md`.

**Yang bisa kamu cek di akhir:** buka portfolio contoh di server lokal → klik satu karya → alamatnya berubah ke `/work/…` dan tombol kembali bekerja; pasang kata sandi di tab Terbitkan → buka di jendela samaran → diminta kata sandi; scan QR dari dialog Kartu nama dengan HP → statistik menampilkan sumber "QR"; tekan **Simpan kontak** di HP → kontak masuk; pilih tema Sintaks dan Warta di galeri.

## Untuk agent

### 1. Ringkasan dan urutan kerja

**Bacaan wajib:** `CLAUDE.md` root, `README.md` folder ini, `00-keputusan.md`, `02-teknis.md` bagian 32 dan 35–40 (aturan yang wajib dijaga), lalu dokumen ini. Refresh graph (`index_repository`) di awal sesi.

**Urutan:**

| Gelombang | Siapa                                                                        | Isi                                                                                                                                                                                                                        | Mulai setelah                    |
| --------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| 0         | Satu sesi (pemilik lapisan `pf-server`, dengan izin lintas lapisan terbatas) | **Langkah 0**: semua tipe, field skema, daftar, pendaftaran tema, string halaman, dan kerangka prosedur yang dipakai lebih dari satu lapisan, dengan implementasi kecil atau stub, sehingga seluruh workspace terkompilasi | Jawaban pemilik bagian 8 (#1–#6) |
| 1         | `pf-server`, `pf-render`, `pf-themes`, `pf-web` bersamaan                    | Implementasi penuh per lapisan (bagian 5 dan 6)                                                                                                                                                                            | Langkah 0 di-commit              |
| 2         | Satu sesi koordinator                                                        | **Integrasi**: `pnpm pdf:translations`, cek seluruh workspace, matriks visual 8 tema termasuk halaman karya, E2E, pembaruan dokumen (bagian 10)                                                                            | Keempat sesi gelombang 1 selesai |

Di gelombang 1 ada ketergantungan lunak, bukan pemblokir:

- `pf-render` mengerjakan dulu **halaman karya** (B2: `page: { kind: "work" }`, `work.href`, skrip) lalu `OpenToWork` dan tombol vCard, karena `pf-themes` dan `pf-server` menunggu hasil visualnya. Sampai itu, stub Langkah 0 menggambar halaman utama untuk halaman karya, jadi rute server sudah bisa diuji.
- `pf-web` memanggil prosedur yang kerangkanya sudah ada sejak Langkah 0 (stub menjawab `NOT_IMPLEMENTED`); uji tampilannya dengan data tiruan sampai `pf-server` selesai.
- `pf-themes` memakai komponen bersama dengan tanda tangan final sejak Langkah 0; tampilan akhirnya dicek ulang setelah `pf-render` selesai (atau di langkah integrasi).

**Git:** semua sesi di checkout yang sama atau worktree masing-masing; stage hanya file milik sesi sendiri (bagian 7). Branch: `feat/portfolio-13-<lapisan>` dari commit Langkah 0. Commit Conventional Commits. Jangan merge ke `main` tanpa persetujuan pemilik.

#### 1.1 Aturan bersama untuk semua sesi

Dari `02-teknis.md` bagian 32.6 dan 35–40; bila sesi melanggar satu, tinjauan integrasi menolaknya.

- **Saklar**: semua perilaku baru di balik `PORTFOLIO_MODE`. Dengan `off`, rute baru jatuh ke perilaku lama (`next()` → aplikasi web), prosedur menolak `PORTFOLIO_DISABLED`, tidak ada akses DB tambahan.
- **Satu penulis data**: setiap tulisan `portfolio.data` lewat `saveVersionedData` + `markFileUsage` + `assertPortfolioPlan`. Setelan (kata sandi, terbit, mesin pencari) **tidak** menyentuh `updated_at`.
- **Urutan kunci**: `portfolio` → akun billing → `portfolio_file`.
- **File**: field file baru masuk `portfolioFileKeys` (`packages/portfolio/src/files.ts`) dan fixture penuh di `files.test.ts`; jalur publik file lewat `isPublicPortfolioFile`/penggantinya.
- **CSP** hanya lewat `portfolioContentSecurityPolicy(script, additions)`; tidak mengedit string CSP.
- **Skrip**: skrip halaman + satu efek ≤ 6 KB, skrip terbit (`PORTFOLIO_LIVE_SCRIPT`) ≤ 1,75 KB (diuji). Tema baru tidak menambah skrip.
- **Batas laju publik**: setiap jalur publik baru memanggil `publicPortfolioRequestAllowed(trustedClient)` sebelum membaca DB.
- **Galat API** baru didefinisikan sekali di `packages/api/src/features/portfolio/errors.ts`, diberi kata-kata di `apps/web/src/features/portfolio/errors.ts`, digolongkan di `editor/save-failure.ts` bila muncul saat simpan.
- **Teks halaman publik**: `packages/portfolio/src/messages.ts` dan `apps/web/src/features/portfolio/page-text.ts` selalu berisi string yang sama persis (diuji). Placeholder diisi `fillPortfolioMessage`. Semua string baru gelombang ini ditambahkan sekaligus di Langkah 0 (bagian 4.4).
- **Tanpa React di klien halaman publik**; tanpa permintaan ke situs lain saat halaman dibuka (font, gambar dari asal sendiri). Tidak ada dependensi baru kecuali disebut di dokumen ini (tidak ada).
- **Rahasia**: kata sandi pengunjung dan hash-nya tidak pernah masuk log, respons, ekspor, atau HTML.
- **Kualitas**: Lingui + `pnpm lingui:extract` (id-ID diterjemahkan); typecheck dan tes paket yang berubah; `pnpm exec turbo boundaries` bila ekspor berubah; `pnpm exec vp lint --fix <path>` + `pnpm exec vp fmt <path>`; akhiri dengan `pnpm lint:agent` dan `pnpm format:check` pada path sendiri; `pnpm check:cloudflare` bila kode server berubah. Laporkan jumlah tes yang benar-benar berjalan.

### 2. Langkah 0 — kerangka kontrak

Satu sesi, sebelum yang lain mulai. Tujuannya: setelah commit ini **seluruh workspace terkompilasi** dan setiap lapisan bisa menjalankan cek paketnya sendiri, walau perilakunya masih stub. Sesi ini boleh menyentuh file lapisan lain **hanya** untuk baris yang tercantum di sini. Setelah commit, kepemilikan file kembali ketat (bagian 7).

Isi (rincian tiap kontrak di bagian 3–4):

1. **Skema** (`packages/schema/src/portfolio/`):
   - `limits.ts`: `previousSlugs: 5`, `availabilityRoles: 5`, `text.availabilityRole: 60`, `text.embedRef: 200`.
   - `data.ts`: `PORTFOLIO_BUTTON_KINDS` + `"vcard"`; `PORTFOLIO_JOB_TYPES`; `work.previousSlugs`; `hero.availability.roles`/`types`; `contact.saveContact`; fungsi `isListedWork` dan `listedWorkSlugs` (bagian 3.1, 3.5, 3.2, 3.6).
   - `embed.ts` **baru, lengkap** (fungsi murni kecil; bagian 3.5) + `embed.test.ts`; ekspor `./portfolio/embed` di `packages/schema/package.json`.
   - `blocks.ts`: tipe blok `embed` (bagian 3.5).
   - `statistics.ts`: jenis klik, sumber, rentang (bagian 3.7), **kecuali** penghapusan `"work"` dari `PORTFOLIO_EVENT_KINDS` (itu dikerjakan `pf-server` bersama penggunanya).
   - `themes.ts`: tema `sintaks` dan `warta`, empat pasangan font (bagian 3.3).
2. **DB**: kolom `portfolio.password` + migrasi lewat `pnpm db:generate` (tinjau SQL-nya: hanya `ADD COLUMN`).
3. **API** (`packages/api/src/features/portfolio/`): di `router.ts` kerangka `setPassword`, `removePassword`, `workStatistics` dengan skema input/output final dan handler yang melempar `new ORPCError("NOT_IMPLEMENTED", { status: 501 })`; output `statistics` dan `unfurl` diperluas ke bentuk final (handler `statistics` mengisi field baru dari baris yang sudah dibaca; `unfurl` belum pernah mengembalikan `embed`); `hasPassword` di `portfolioSchema` dan `toDto`; `PORTFOLIO_WORK_NOT_FOUND` di `errors.ts`.
4. **Render** (`packages/portfolio/`):
   - `view.ts`: semua tipe dan field baru bagian 4.1, dengan implementasi langsung (semuanya pemetaan kecil); `resolvePortfolioWork`; kasus `embed` di `buildBlock`.
   - `page.tsx`: `RenderPortfolioPageInput.page` dan tipe `PortfolioPageKind` diterima (stub: selalu menggambar halaman utama); `shared/context.ts`: `RenderContext.page`.
   - `shared/intro.tsx`: komponen `OpenToWork` dengan tanda tangan final, stub `return null`.
   - `shared/parts.tsx`: label tombol `vcard` di `BUTTON_ICONS` (ikon sementara `"link"`).
   - `messages.ts`: semua string baru bagian 4.4; `portfolioViewMessages` mengisi `buttons.vcard`.
   - `gate.ts` dan `vcard.ts` baru dengan tanda tangan final (bagian 4.2, 4.3), implementasi minimal yang lulus typecheck; ekspor `./gate` dan `./vcard` di `packages/portfolio/package.json`.
   - `files.ts` + `files.test.ts`: thumbnail blok `embed` (aturan 32.6; tanpa ini kunci file orang lain bisa dirujuk).
   - Tema stub: `themes/sintaks/{index.ts,theme.tsx,css.ts,palette.ts}` dan `themes/warta/…` = salinan Lugas dengan id diganti (`themeVariant("sintaks", …)`, `PageShell theme="sintaks"`, CSS `LUGAS_CSS.replaceAll('data-theme="lugas"', 'data-theme="sintaks"')`, palet salinan Lugas). Pendaftaran di `themes/index.ts` (`sintaks: SINTAKS_RENDERER`, `warta: WARTA_RENDERER`) dan `themes/palettes.ts` (`SINTAKS_PALETTE`, `WARTA_PALETTE` diimpor dari `./sintaks/palette`, `./warta/palette`). Setelah ini `index.ts` dan `palettes.ts` tidak perlu disentuh lagi: opsi renderer (`headingWeights` dll.) berada di `themes/<id>/index.ts` milik `pf-themes`.
5. **Tooling**: `tooling/portfolio/personas/raka.ts` dan `laras.ts` stub (`{ ...nadia, id: "raka", theme: "sintaks", username: "raka" }`, `{ ...anindya, id: "laras", theme: "warta", username: "laras" }`); di `tooling/portfolio/persona.ts`: `PERSONA_IDS` + `"raka", "laras"`, impor, `DEFINITIONS`, `THEME_PERSONAS.sintaks = "raka"`, `THEME_PERSONAS.warta = "laras"`.
6. **Web** (baris kompilasi saja): `features/portfolio/themes.ts` (deskripsi dan audiens, string bagian 3.3), `statistics/portfolio-statistics.tsx` (label `embed`, `vcard`, `qr`), `editor/intro-form.tsx` (`buttonKindLabel.vcard`, `hiddenButtonReason` kasus `vcard`, `ADD_ORDER`), `blocks/block-list.tsx` (kasus `embed` sementara: label "Embed", isi belum tersedia), `page-text.ts` (string bagian 4.4 + `const provider = ""`).
7. Jalankan typecheck seluruh workspace (`pnpm typecheck`), tes paket `@rezumi/schema`, `@rezumi/portfolio`, `@rezumi/api` (portfolio), `server`, `web` (portfolio), `pnpm exec turbo boundaries`. Commit: `chore(portfolio): scaffold phase 13 contract`.

**Selesai bila:** workspace terkompilasi, tes yang ada lulus (tes tema mengulang semua `PORTFOLIO_THEMES`, jadi stub Sintaks/Warta harus lulus seperti Lugas), dan file di bagian 7 punya isi awal di jalur finalnya.

### 3. Fitur

#### 3.1 B2 — Halaman detail karya

**Tujuan.** Setiap karya punya alamat, kanonik, kartu share, entri sitemap, dan JSON-LD sendiri, sehingga satu proyek bisa dibagikan dan ditemukan di mesin pencari.

**Perilaku yang terlihat pengguna.**

- Kartu karya di halaman utama adalah tautan biasa ke `/<username>/work/<slug>` (domain sendiri: `/work/<slug>`). Halaman utama **tidak lagi** memuat jendela detail `#work-<slug>` (keputusan pemilik #2): lebih ringan, satu cara membuka karya, dan tombol Kembali peramban bekerja apa adanya.
- Halaman karya memakai tema dan navigasi portfolio: navigasi menautkan ke bagian di halaman utama (`/<username>#about`), tautan **Semua karya** ke `/<username>#work`, isi karya (judul sebagai `h1`, ringkasan, peran, tahun, tag, sampul, blok, tautan utama), lalu navigasi karya sebelumnya/berikutnya dengan judulnya, lalu kaki (badge, Laporkan).
- Alamat karya dibuat otomatis dari judul (seperti sekarang) dan bisa diubah di editor. Alamat lama tetap bekerja: dialihkan 301 ke alamat baru (maks. 5 alamat lama per karya, keputusan pemilik #3).
- Karya tersembunyi, tanpa judul, atau saat bagian Karya disembunyikan: tidak punya halaman (404).

**Aturan paket.** Semua paket. Tidak ada fitur katalog baru.

**Kontrak skema** (`packages/schema/src/portfolio/data.ts`, `limits.ts`):

```ts
// limits.ts
PORTFOLIO_LIMITS.previousSlugs = 5;

// data.ts, di objek `work`
previousSlugs: kit.list(slugSchema, PORTFOLIO_LIMITS.previousSlugs, { id: (slug) => slug })
	.describe("Addresses this work had before, newest first; each forwards to the current one."),
// slugSchema = z.string().max(max.slug).regex(PORTFOLIO_SLUG_PATTERN) (baca toleran: entri buruk dibuang satu per satu)
// Cek tulis `whole` work: previousSlugs tidak memuat `slug` milik karya itu sendiri; baca toleran membuangnya.

/** A work the page lists: shown and titled. The one rule the view, the sitemap query and the editor use. */
export function isListedWork(work: Pick<PortfolioWork, "hidden" | "title">): boolean; // !hidden && title.trim() !== ""
/** Slugs of the works that have a page: none while the Work section is hidden. */
export function listedWorkSlugs(data: Pick<PortfolioData, "works" | "sections">): string[];
```

Bentrok antarkarya tidak dicek saat tulis; penyelesaian alamat mendahulukan `slug` aktif semua karya, baru `previousSlugs` dalam urutan karya. Editor membuang alamat lama yang kini dipakai karya lain sebagai alamat aktif.

**Kontrak API.** Tidak ada prosedur baru. `portfolio.get` tidak berubah untuk B2.

**URL dan penyajian** (`pf-server`):

| Hal            | Aturan                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rute aplikasi  | `app.get("/:username/work/:slug", …)` di `apps/server/src/http/app.ts`, didaftarkan setelah middleware statis dan sebelum `/:username/:slug`; penjaga `isPortfolioWorkPath(pathname)` (di `apps/server/src/static/portfolio-page.ts`): tepat 3 segmen, segmen 1 bukan `RESERVED_PROFILE_SEGMENTS`, segmen 2 `work`, segmen 3 cocok `PORTFOLIO_SLUG_PATTERN` dan ≤64. Bukan jalur itu atau `PORTFOLIO_MODE=off` → `next()`.                                                                                                                                                          |
| Domain sendiri | `handleCustomDomain`: `/work/<slug>` (pola sama) → `servePortfolioWork(request, username, slug, trustedClient, { customDomain })`, sebelum pengalihan "path lain ke aplikasi".                                                                                                                                                                                                                                                                                                                                                                                                      |
| Fungsi         | `servePortfolioWork(request, username, slug, trustedClient, options)` di `portfolio-page.ts`: `publicPortfolioRequestAllowed` → `findPublicPortfolio` → gerbang kata sandi (3.4) → `publicPortfolioView(portfolio, { customDomain })` → `resolvePortfolioWork(view, slug)`.                                                                                                                                                                                                                                                                                                         |
| Status         | Ada → 200. Alamat lama → **301** ke alamat aktif (path saja, tanpa query). Portfolio ada tapi karya tidak punya halaman → **404** halaman polos `renderPortfolioMissingWorkPage` (bahasa halaman, tautan ke portfolio). Tidak ada portfolio di alamat itu → 404 yang sama dengan CV tak tersedia (ekspor `unavailableResponse` dari `resume-page.ts`).                                                                                                                                                                                                                              |
| Kanonik        | Domain sendiri yang hidup (`options.customDomain ?? portfolio.customDomain`) → `https://<domain>/work/<slug>`; selain itu `${APP_URL}/<username>/work/<slug>`.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Robots         | Sama dengan halaman utama: `portfolio.indexable` (termasuk aturan akun < 7 hari dan kata sandi); bila tidak, `X-Robots-Tag: noindex, follow` dan meta robots.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Cache          | `private, no-store` (kunjungan dihitung per permintaan), seperti halaman utama.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Head           | `title` = `"<judul karya> — <nama>"`; `description` = ringkasan, else teks blok teks pertama dipotong 160, else `view.seo.description`; `og:type` = `article` (field baru `PortfolioHead.type`); `og:image` = `${APP_URL}/cards/<username>/work/<slug>.png`.                                                                                                                                                                                                                                                                                                                        |
| JSON-LD        | Hanya bila terindeks: `CreativeWork` { `name`, `description`, `url` (kanonik), `image` (sampul, `portfolioPictureUrl`), `keywords` (tag), `inLanguage`, `dateModified` (`portfolio.updatedAt`), `author` { `@type: Person`, `name`, `url`: kanonik halaman utama }, `isPartOf` { `@type: ProfilePage`, `url`: kanonik halaman utama } }. `hasPart` di JSON-LD halaman utama memakai URL halaman karya, bukan `#work-…`.                                                                                                                                                             |
| CSP            | `portfolioContentSecurityPolicy(page.script, { "frame-src": embedFrameOrigins(providers karya ini) })`; tanpa Turnstile (halaman karya tidak punya form).                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Kunjungan      | Hanya GET, bukan spekulatif: `recordPortfolioVisit({ …, workId })` (3.7).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Kartu share    | `app.get("/cards/:username/work/:file{[^/]+\\.png}", …)` **sebelum** rute `/cards/:username/:file{.+\\.png}` → `handlePortfolioWorkCard` di `portfolio-card.ts`: `resumeCardSvg({ name: judul karya, headline: nama orang (+ " · " + peran bila ada), address: "<host>/<username>/work/<slug>" atau "<domain>/work/<slug>", color: aksen, picture: foto orang seperti kartu portfolio })`. Sampul WebP tidak bisa digambar resvg, jadi tidak dipakai. Karya tidak ada, portfolio terkunci, atau gagal → banner umum (302). ETag dan `public, max-age=3600` seperti kartu portfolio. |
| Sitemap        | `listIndexablePortfolios(page)` mengembalikan `{ username, updatedAt, workSlugs: string[] }`; `workSlugs` dihitung di SQL dengan jsonpath dari `data` (tanpa membaca seluruh JSON ke Node) dan harus setara `listedWorkSlugs` (uji DB nyata 3.1). `PORTFOLIO_SITEMAP_PAGE_SIZE = Math.floor(50_000 / (1 + PORTFOLIO_LIMITS.works))` (= 980 portfolio per halaman, maks. 49.980 alamat). `handlePortfoliosSitemap` menulis alamat utama lalu alamat setiap karya dengan `lastmod` yang sama. Portfolio di domain sendiri tetap tidak masuk sitemap aplikasi.                         |
| Beacon lama    | `"work"` dihapus dari `PORTFOLIO_EVENT_KINDS` (`pf-server`): karya dibuka kini dihitung di server saat GET halaman karya. `parsePortfolioEvent` menerima `id` (karya) untuk jenis klik apa pun; `findPortfolioEventTarget` tetap memeriksa `hasWork`.                                                                                                                                                                                                                                                                                                                               |

**Kontrak view/render** (`pf-render`, detail bagian 4.1):

- `PortfolioViewWork.href` (alamat halaman karya), `previousSlugs`, `readingMinutes`; `PortfolioView.homeUrl`.
- `renderPortfolioPage({ …, page: { kind: "work", workId } })` menggambar halaman karya; `PageShell` mengganti isi `main` dengan `WorkArticle` bersama, jadi **setiap tema mendapat halaman karya tanpa kode tema baru**, cukup CSS untuk `.pf-workpage`.
- Setiap tema mengganti tautan kartu `href={`#${work.anchor}`}` menjadi `href={work.href}`. `work.anchor` tetap dipakai sebagai dasar id (`<anchor>--card-title`).
- `WorkDetail` (dialog), `.pf-detail` (CSS dialog, `:target`, `.pf-open`), dan kode dialog di `PORTFOLIO_PAGE_SCRIPT` dihapus; lightbox, sematan/video, menu, dan jam lokal tetap. `PORTFOLIO_LIVE_SCRIPT` berhenti mengirim beacon `work` dan menambahkan `id` karya ke beacon klik bila akar `.pf` membawa `data-pf-work`.
- Aksesibilitas halaman karya: satu `h1` (judul karya; nama orang di navigasi bukan judul), `main` dengan `aria-labelledby` judul, tautan Semua karya sebelum judul, navigasi sebelumnya/berikutnya `nav aria-label={messages.otherWork}` dengan teks judul (bukan hanya panah), gambar sampul dengan alt, `expectSoundPage` lulus untuk setiap tema × LTR/RTL.

**UI editor** (`pf-web`):

- Editor karya (`works/work-editor.tsx`): kolom **Page address** ("Alamat halaman") menampilkan `rezumi.app/<username>/work/` + input slug (huruf kecil, angka, satu tanda hubung; unik), tombol Salin dan **Open page** ("Buka halaman", hanya saat terbit). Teks bantu: "Changing it keeps the old address working: it forwards to the new one." Galat: "Use lowercase letters, digits and single dashes." / "Another work uses this address."
- `works/works.ts`: setiap perubahan slug (otomatis dari judul maupun manual) memasukkan slug lama ke depan `previousSlugs` (unik, maks. 5, buang yang kini menjadi slug aktif karya mana pun). Karya baru yang belum pernah tersimpan boleh tidak mencatat (opsional).
- Pratinjau (`editor/preview.tsx`): saat satu karya sedang diedit, pratinjau menggambar `page: { kind: "work", workId }`, menggantikan trik jangkar `openAnchor`.

**Keamanan dan privasi.** Karya tersembunyi tidak pernah punya halaman, kartu, entri sitemap, atau JSON-LD. `resolvePortfolioWork` hanya mencari di `view.works` (yang sudah disaring). Slug dari URL tidak pernah ditulis ke HTML tanpa melewati pola; pengalihan 301 hanya ke path yang dibangun server.

**Uji wajib.**

- Skema: `previousSlugs` (tulis menolak slug sendiri dan pola buruk; baca membuang), `isListedWork`, `listedWorkSlugs`.
- Render: `href` default `#work-<slug>` dan dari `links.work`; `resolvePortfolioWork` (aktif, lama → `moved`, tersembunyi → null, bentrok: slug aktif menang); halaman karya per tema × varian × LTR/RTL lulus `expectSoundPage` (satu `h1`, tanpa `role="dialog"` selain lightbox); halaman utama tidak lagi memuat `.pf-detail`; ukuran skrip.
- Server: rute (jalur sah/tidak sah, mode `off` → `next()`), 301, 404 dua jenis, kanonik aplikasi/domain sendiri, `noindex`, kartu karya (banner untuk karya tak dikenal), sitemap (alamat karya, ukuran halaman), domain sendiri `/work/<slug>`.
- DB nyata: `workSlugs` SQL = `listedWorkSlugs` untuk fixture berisi karya tersembunyi, tanpa judul, judul spasi saja, dan bagian Karya tersembunyi.
- Browser (E2E): dari halaman utama klik kartu → halaman karya, Kembali → halaman utama; alamat lama → alamat baru.

**Pekerjaan per sesi:** `pf-server`: rute, `servePortfolioWork`, kartu, sitemap, JSON-LD, counting, domain sendiri. `pf-render`: view, `WorkArticle`, `PageShell`, navigasi, skrip, enam tema (href + CSS). `pf-themes`: CSS `.pf-workpage` dan `href` di dua tema baru. `pf-web`: alamat di editor karya, riwayat slug, pratinjau.

#### 3.2 B14 — Kartu nama digital

**Tujuan.** Di job fair, pemilik menunjukkan QR atau kartu cetak; perekrut memindai, membuka portfolio, lalu menyimpan kontak ke HP dengan satu tombol.

**Perilaku yang terlihat pengguna.**

- Pemilik (aplikasi): tombol **QR code** di tab Terbitkan diganti **Business card** ("Kartu nama") yang membuka dialog: pratinjau kartu (nama, headline, QR, alamat pendek), **Download QR (PNG)**, **Download QR (SVG)**, **Print cards** (lembar A4 berisi 10 kartu 85 × 55 mm dengan garis potong), **Show full screen** (QR besar + nama untuk ditunjukkan dari HP). Tombol yang sama di kartu status halaman Portfolio dashboard.
- QR mengarah ke alamat portfolio dengan `?utm_source=qr` (domain sendiri bila hidup), sehingga statistik menampilkan sumber **QR** (keputusan pemilik #8). Teks alamat di kartu tanpa `https://` dan tanpa parameter.
- Pengunjung (halaman publik): tombol **Save contact** ("Simpan kontak") di bagian Kontak (bisa dimatikan) dan sebagai jenis tombol intro baru, mengunduh `<username>.vcf`.

**Aturan paket.** Semua paket.

**Kontrak skema** (`data.ts`):

```ts
export const PORTFOLIO_BUTTON_KINDS = ["resume", "pdf", "contact", "whatsapp", "email", "profile", "link", "vcard"] as const;
// contact
saveContact: kit.field(z.boolean(), true).describe("Show a Save contact button in Contact."),
```

**Isi vCard** (keputusan pemilik #4): vCard 3.0, baris berakhir CRLF, dilipat pada 75 oktet tanpa memotong karakter UTF-8, nilai di-escape (`\\`, `\,`, `\;`, `\n`). Hanya yang **sudah tampil di halaman** (dibaca dari view, jadi pengaturan privasi otomatis berlaku):

| Baris                          | Sumber view                                                 | Syarat                                                   |
| ------------------------------ | ----------------------------------------------------------- | -------------------------------------------------------- |
| `N:;<nama>;;;` dan `FN:<nama>` | `view.basics.name`                                          | selalu                                                   |
| `TITLE:<headline>`             | `view.basics.headline`                                      | tidak kosong                                             |
| `EMAIL;TYPE=INTERNET:`         | `contact.email` dari bagian Kontak                          | Kontak tampil dan email tampil                           |
| `TEL;TYPE=CELL:+<nomor>`       | `contact.whatsapp.number`                                   | WhatsApp tampil                                          |
| `TEL;TYPE=VOICE:`              | `contact.phone`                                             | telepon tampil                                           |
| `URL:<kanonik portfolio>`      | argumen `url`                                               | selalu                                                   |
| `URL:`                         | `contact.website.href`, lalu tiap `contact.profiles[].href` | tampil                                                   |
| `ADR;TYPE=WORK:;;;<label>;;;`  | `introLocation(view)`                                       | tidak kosong (aturan "Tampilkan lokasiku" sudah di view) |

Tanpa foto, tanpa alamat jalan, tanpa catatan. Portfolio terkunci (3.4): 404.

**Kontrak API dan URL** (`pf-server`):

- `GET /api/portfolio/:username/vcard` (`apps/server/src/http/app.ts` → `handlePortfolioVcard` di `apps/server/src/http/portfolio.ts`): `publicPortfolioRequestAllowed` → `findPublicPortfolio` (null → 404) → gerbang kata sandi (terkunci → 404) → `buildPortfolioVcard(publicPortfolioView(portfolio, { customDomain }), { url: kanonik })`. Header: `Content-Type: text/vcard; charset=utf-8`, `Content-Disposition: attachment; filename="<username>.vcf"`, `Cache-Control: private, no-store`, `X-Robots-Tag: noindex`. Di domain sendiri jalur `/api/portfolio/` sudah diteruskan `handleCustomDomain`, jadi tautan relatif bekerja.
- `robots.txt` (`apps/server/src/static/seo.ts`): tambah `Disallow: /api/portfolio/`.
- Klik dihitung lewat beacon `data-pf-event="vcard"` (jenis klik baru, 3.7), bukan di rute unduhan.

**Kontrak view/render** (`pf-render`):

- `PortfolioViewInput.links.vcard?: string | null`; `PortfolioViewContact.vcard: string | null` (diisi bila `data.contact.saveContact` dan `links.vcard`); tombol intro `kind: "vcard"` → `{ label: label sendiri atau messages.buttons.vcard, href: links.vcard, external: false, kind: "vcard" }`, atau tidak tampil bila `links.vcard` kosong. vCard tidak membuat bagian Kontak tampil sendirian (aturan `empty` di `buildContact` tidak memperhitungkannya).
- `Contact` bersama menggambar tombol sekunder **Save contact** (ikon baru `user-plus` di `shared/icons.tsx`) dengan `data-pf-event="vcard"`, `download` attribute, setelah tombol Email/WhatsApp. Semua tema memakai `Contact` bersama, jadi tidak ada kode tema.
- `buildPortfolioVcard(view: PortfolioView, input: { url: string }): string` di `packages/portfolio/src/vcard.ts`, ekspor `@rezumi/portfolio/vcard`. Fungsi murni.

**UI editor dan dashboard** (`pf-web`):

- Komponen baru `apps/web/src/features/portfolio/card/business-card-dialog.tsx` (+ `card/print.css` atau kelas Tailwind `print:`), dipakai `editor/publish-panel.tsx` (mengganti `QrCodeButton`) dan `portfolio-page.tsx` (kartu status).
- QR: `qrcode.react` yang sudah ada di `apps/web` (`QRCodeSVG` untuk tampilan dan unduhan SVG, `QRCodeCanvas` untuk PNG 1024 px), tingkat koreksi `M`, quiet zone 4 modul. **Tidak ada dependensi baru dan QR tidak dibuat di server atau paket render:** QR hanya tampil bagi pemilik di aplikasi yang sudah login, halaman publik tidak pernah menggambarnya, jadi menambah encoder ke Worker atau `@rezumi/portfolio` hanya menambah ukuran tanpa manfaat. `qrcode.react` memakai encoder QR Nayuki (MIT) yang terkenal. Bila kelak halaman publik butuh QR, pindahkan ke `@rezumi/portfolio` dengan encoder kecil yang sama.
- Layar penuh: dialog layar penuh dengan QR ±80 vmin dan nama; minta `navigator.wakeLock` bila ada (opsional, abaikan galat).
- Isi → Kontak (`editor/contact-form.tsx`): saklar **Show a Save contact button** ("Tampilkan tombol Simpan kontak"), bawaan menyala, teks bantu: "Visitors save your name, headline and the contact details shown here to their phone."
- Intro → Tombol: jenis **Save contact** di `buttonKindLabel`; `hiddenButtonReason("vcard")`: tidak pernah tersembunyi di halaman terbit ("Shown on your published page.").
- String dialog (Inggris sumber Lingui): "Business card", "Scan to see my portfolio", "Download QR (PNG)", "Download QR (SVG)", "Print cards", "Show full screen", "The QR code adds ?utm_source=qr, so your statistics show visits from it."

**Keamanan dan privasi.** vCard tidak pernah memuat lebih dari halaman (dibangun dari view). Tidak bisa diunduh dari portfolio terkunci, tidak terbit, ditangguhkan, atau saat saklar `off`. Robots dan `noindex` menjauhkan crawler; isinya tetap bisa diambil siapa pun yang bisa melihat halaman, sama seperti email di halaman.

**Uji wajib.** Render: `buildPortfolioVcard` (escape `,;\` dan baris baru, lipatan 75 oktet dengan emoji/aksara Arab, privasi: Kontak tersembunyi → tanpa email/telepon; "Tampilkan lokasiku" mati → tanpa ADR; tanpa portfolio URL ganda); tombol di `Contact` dan tombol intro `vcard` (ada/tidak). Server: header, 404 untuk tidak terbit/terkunci/mode off, domain sendiri. Web: URL QR (`utm_source=qr`, domain sendiri), unduh PNG/SVG menghasilkan berkas. E2E: unduh `.vcf` → `Content-Type` dan isi `FN`.

**Pekerjaan per sesi:** `pf-server`: rute vCard, robots, `links.vcard` di `publicPortfolioView`. `pf-render`: `vcard.ts`, `Contact`, tombol intro, ikon. `pf-web`: dialog kartu nama, saklar Kontak, jenis tombol. `pf-themes`: tidak ada (selain memakai `Contact` bersama).

#### 3.3 B1 — Tema Sintaks dan Warta

**Tujuan.** Enam tema menjadi delapan, untuk dua kelompok yang belum terlayani: developer/data/IT dan penulis/PR/pemasaran/peneliti (`backlog-lanjutan.md` B1).

**Aturan paket.** Keduanya **Plus** (keputusan pemilik #1): `FREE_PORTFOLIO_THEMES` tetap `["lugas", "prima"]`, jadi `assertPortfolioPlan` otomatis meminta `premiumPortfolioThemes`, katalog tidak berubah, `BILLING_CATALOG_VERSION` tidak naik.

**Kontrak skema** (`packages/schema/src/portfolio/themes.ts`, Langkah 0, final):

```ts
export const PORTFOLIO_THEMES = ["lugas", "prima", "kanvas", "mozaik", "paper", "brutal", "sintaks", "warta"] as const;
// describe: "…, paper, brutal, sintaks or warta (Plus)."

// PORTFOLIO_FONT_PAIRS (semua ada di packages/fonts/src/webfontlist.json, sudah dicek)
geist: { label: "Geist", heading: "Geist", body: "Geist" },
"jetbrains-hanken": { label: "JetBrains Mono + Hanken Grotesk", heading: "JetBrains Mono", body: "Hanken Grotesk" },
"newsreader-franklin": { label: "Newsreader + Libre Franklin", heading: "Newsreader", body: "Libre Franklin" },
"spectral-public": { label: "Spectral + Public Sans", heading: "Spectral", body: "Public Sans" },

sintaks: {
	id: "sintaks", name: "Sintaks", plan: "plus", defaultScheme: "dark",
	fallbackAccent: "#22C55E", monoFont: "JetBrains Mono",
	effects: ["scramble", "none", "fade-up", "typewriter", "shimmer"],
	fontPairs: ["geist", "jetbrains-hanken", "space-inter", "dm-sans", "manrope"],
	variants: {
		hero: ["photo-right", "photo-left", "big-name"],
		work: ["grid-2", "list", "grid-3"],
		services: ["list", "cards"], testimonials: ["cards", "carousel"], clients: ["grayscale", "color"],
		experience: ["timeline", "compact"], education: ["compact", "timeline"], skills: ["chips", "groups"],
		metric: allMetricVariants("kpi"),
	},
	sectionOrder: ["about", "work", "skills", "experience", "services", "testimonials", "clients", "education",
		"certifications", "awards", "publications", "languages", "volunteer", "interests", "profiles", "contact"],
},
warta: {
	id: "warta", name: "Warta", plan: "plus", defaultScheme: "light",
	fallbackAccent: "#B42318",
	effects: ["fade-up", "none", "shimmer", "typewriter"],
	fontPairs: ["newsreader-franklin", "spectral-public", "source-serif-sans", "caslon-public", "literata-work"],
	variants: {
		hero: ["big-name", "photo-top", "photo-left"],
		work: ["featured-grid", "list", "grid-2"],
		services: ["list", "cards"], testimonials: ["cards", "carousel"], clients: ["grayscale", "color"],
		experience: ["compact", "timeline"], education: ["compact", "timeline"], skills: ["groups", "chips"],
		metric: allMetricVariants("big"),
	},
	sectionOrder: ["about", "work", "publications", "experience", "services", "testimonials", "clients", "awards",
		"education", "skills", "certifications", "languages", "volunteer", "interests", "profiles", "contact"],
},
```

Bila `pf-themes` butuh nilai metadata lain (varian, efek, urutan), tulis di laporannya; perubahan dilakukan di langkah integrasi, bukan oleh `pf-themes`.

**Kontrak render** (`pf-themes`, dalam `packages/portfolio/src/themes/<id>/`):

| File                 | Ekspor                                               | Isi                                                                         |
| -------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------- |
| `index.ts`           | `SINTAKS_RENDERER: ThemeRenderer` / `WARTA_RENDERER` | `{ id, Page, css, palette, headingWeights?, nameWeight?, headingDisplay? }` |
| `theme.tsx`          | `SintaksPage` / `WartaPage`                          | Halaman lewat `PageShell` + `Navigation` bersama                            |
| `css.ts`             | `SINTAKS_CSS` / `WARTA_CSS`                          | Di bawah `.pf[data-theme="<id>"]`; prefiks kelas `sk-` / `wt-`              |
| `palette.ts`         | `SINTAKS_PALETTE` / `WARTA_PALETTE`                  | Tanpa impor React (dibaca editor lewat `@rezumi/portfolio/editor`)          |
| `data.ts` (opsional) | helper murni + `data.test.ts`                        | Seperti `themes/mozaik/data.ts`                                             |
| `theme.test.tsx`     | —                                                    | Seperti `brutal/theme.test.tsx` dan `paper/theme.test.tsx`                  |

Usulan palet (boleh disetel `pf-themes` di `palette.ts` asal uji kontras lulus): Sintaks gelap `bg #0B0F14, surface #131A22, text #E6EDF3, muted #94A0AE, border #263241`, terang `bg #FAFBFC, surface #F1F4F7, text #0F1720, muted #536170, border #D5DCE3`. Warta terang `bg #FBFAF7, surface #FFFFFF, text #161513, muted #5E5A52, border #DDD8CE`, gelap `bg #14130F, surface #1D1C17, text #EEEBE3, muted #A8A397, border #34322B`.

**Arah visual** (dari B1; tanpa mockup tersimpan):

- **Sintaks**: intro sebagai jendela terminal (tiga titik dekoratif `aria-hidden`), baris `$ whoami` lalu nama (`h1` lewat `HeroName`), `$ cat role.txt` lalu headline, sapaan sebagai komentar `# …`, kursor berkedip CSS yang berhenti saat kurangi gerakan; foto sebagai avatar kecil di samping (varian `photo-right`/`photo-left`), `big-name` tanpa foto. Kartu karya bergaya repositori: judul huruf mono dengan ikon folder, ringkasan, tag sebagai chip "bahasa" dengan titik warna (warna dari hash tag, dekoratif), metrik unggulan sebagai statistik kecil (`WorkMetric`), tautan utama berikon kode. Pengalaman bergaya `git log`: titik + hash pendek dekoratif `aria-hidden` (dari FNV id entri) + jabatan @ perusahaan + tanggal. Keahlian sebagai chip tech stack. Bawaan gelap.
- **Warta**: masthead bergaris tipis, kicker kecil (headline), nama serif besar di tengah (`big-name`), dateline (lokasi · Open to work). Tentang saya dengan huruf awal besar (`::first-letter`, mati untuk `[dir="rtl"]`). Karya `featured-grid`: karya unggulan sebagai cerita utama besar, sisanya kisi artikel dengan rubrik (tag pertama, huruf kecil kapital), judul serif, ringkasan, waktu baca (`work.readingMinutes` → `messages.readingTime`), tahun. Testimoni sebagai kutipan besar. Publikasi naik di urutan. Bawaan terang.

**Yang wajib digambar setiap tema** (berlaku juga untuk enam tema lama; dicek uji bersama yang mengulang `PORTFOLIO_THEMES`):

1. Halaman utama: `Navigation` bersama; intro dengan `HeroName` (satu-satunya `h1`), `HeroHeadline`, `IntroChips`, **`OpenToWork`** (3.6) di bawah chip, `MetricGroup` sorotan, `Buttons`; setiap jenis bagian (`about`, `work` dengan kartu `href={work.href}`, `services`, `testimonials`, `clients`, bagian CV lewat `ResumeSectionBody` atau gambar sendiri dari `entries`, `custom`, `resume:<id>`, `contact` lewat `Contact` bersama); semua varian yang dinyatakan di `PORTFOLIO_THEME_INFO`; aturan latar intro (`background: var(--pf-hero-bg)` pada elemen intro, setel `--pf-hero-ground`/`--pf-hero-shade`); efek yang dinyatakan; kaki lewat `PageShell`.
2. Halaman karya: otomatis lewat `PageShell`; tema menulis CSS `.pf[data-theme="<id>"] .pf-workpage …` agar sesuai gayanya, termasuk blok `embed`.
3. Aksesibilitas dan mutu (`00-keputusan.md` bagian 7): kontras AA lewat palet (uji kontras otomatis atas 14 aksen × 2 mode), bisa dipakai keyboard, fokus terlihat, `prefers-reduced-motion`, RTL, 360–1920 px tanpa geser horizontal, nama sangat panjang, tanpa foto/gambar, isi minimal dan penuh, terang/gelap/otomatis. Tanpa skrip baru, tanpa permintaan luar, font lewat `portfolioFontFaces`.

**UI editor** (`pf-web`): galeri tema membaca `RENDERED_PORTFOLIO_THEMES` (otomatis 8). String Langkah 0 di `features/portfolio/themes.ts`:

- `sintaks`: deskripsi "A terminal window for your intro, repositories for your work and a git log of your career." · audiens "For developers, data people and IT."
- `warta`: deskripsi "A magazine: your name as the masthead, a cover story and articles with reading times." · audiens "For writers, PR, marketing and researchers."

Gambar galeri `apps/web/public/portfolio-themes/{jpg,thumb}/{,id/}{sintaks,warta}.{jpg,webp}` dibuat `pf-themes` dengan `pnpm --filter @rezumi/tooling portfolio:previews` setelah persona Raka dan Laras jadi.

**Persona fiktif** (`pf-themes`, `tooling/portfolio/personas/{raka,laras}.ts`): Raka (backend engineer, Yogyakarta; resume persona template yang cocok dari `tooling/templates/personas`) dan Laras (penulis dan PR, Jakarta). Nama, perusahaan, angka fiktif; dua bahasa (en/id) dan varian Arab sesuai `PersonaDefinition`. Foto: gambar fiktif baru di `.agents/docs/plans/portfolio/mockups/img/` (bukan foto orang nyata) atau ilustrasi.

**Uji wajib.** `theme.test.tsx` per tema (urutan, varian, privasi foto/karya tersembunyi, efek bawaan, aksen fallback, `OpenToWork`, kartu ke `work.href`, blok `embed` di halaman karya); uji bersama (`themes.test.ts`, `contrast.test.ts`, `page.test.tsx`, efek) lulus untuk 8 tema; matriks visual (`portfolio:matrix --themes sintaks,warta`) dilihat dengan mata: 1440 dan 390 px, terang/gelap, penuh/minimal/panjang/RTL, halaman utama dan halaman karya.

**Pekerjaan per sesi:** Langkah 0: metadata dan stub. `pf-themes`: isi kedua folder tema, persona, gambar galeri. `pf-web`: tidak ada selain teks Langkah 0 dan terjemahan. `pf-render`: tidak menyentuh folder kedua tema.

#### 3.4 B16 — Portfolio berkata sandi

**Tujuan.** Pemilik bisa membagikan portfolio hanya kepada orang yang diberi kata sandi (misalnya karya di bawah NDA), memakai pola CV berkata sandi yang sudah ada.

**Perilaku yang terlihat pengguna.**

- Tab Terbitkan → grup **Password** ("Kata sandi"): saklar **Protect with a password**; menyalakan membuka dialog isi kata sandi (6–64 karakter, tombol lihat/sembunyikan); saat aktif ada **Change password** dan mematikan saklar = **Remove password** (dengan konfirmasi).
- Pengunjung tanpa akses melihat **halaman kunci** polos dalam bahasa halaman: judul umum, kolom kata sandi, tombol buka, tautan Laporkan. Tanpa nama, foto, atau isi portfolio (keputusan pemilik #5). Benar → kembali ke halaman yang diminta (utama, karya, atau `?report`). Salah → pesan galat. Terlalu banyak coba → pesan tunggu.
- Akses berlaku **12 jam** per peramban dan per host; berganti kata sandi mencabut semua akses. Pemilik yang login di domain aplikasi tidak diminta kata sandi. Di domain sendiri pemilik juga diminta (tidak ada sesi di sana).
- Selama berkata sandi: tidak masuk mesin pencari (saklar Mesin pencari tampil mati dengan catatan), tidak di sitemap, tanpa JSON-LD, kartu share memakai banner umum, vCard tidak bisa diunduh tanpa akses.

**Aturan paket.** Semua paket (keputusan pemilik #1): kata sandi CV juga gratis, dan privasi tidak dijual. Tanpa fitur katalog baru.

**Kontrak data** (`packages/db/src/schema/portfolio.ts`, Langkah 0):

```ts
// bcrypt hash (bcryptjs, cost 10, seperti CV); null = terbuka. Kolom, bukan `data`: simpan data, AI, impor tidak pernah mengubahnya.
password: pg.text("password"),
```

Migrasi hanya `ALTER TABLE "portfolio" ADD COLUMN "password" text;`. Ekspor data akun: `portfolio.hasPassword: boolean`, tidak pernah hash.

**Kontrak API** (`packages/api/src/features/portfolio/router.ts`, tag `Internal`):

| Prosedur                   | Rute                         | Input                                     | Output            | Galat                             | Batas laju                   |
| -------------------------- | ---------------------------- | ----------------------------------------- | ----------------- | --------------------------------- | ---------------------------- |
| `portfolio.setPassword`    | `PUT /portfolio/password`    | `{ password: z.string().min(6).max(64) }` | `portfolioSchema` | `PORTFOLIO_DISABLED`, `NOT_FOUND` | `portfolioMutationRateLimit` |
| `portfolio.removePassword` | `DELETE /portfolio/password` | `z.object({}).optional()`                 | `portfolioSchema` | `PORTFOLIO_DISABLED`, `NOT_FOUND` | `portfolioMutationRateLimit` |

- `portfolioSchema` + `hasPassword: z.boolean()`; `rowColumns.hasPassword = sql<boolean>\`${schema.portfolio.password} is not null\``.
- Keduanya mengikuti pola `setPublic`: satu `UPDATE … RETURNING`, tidak menyentuh `updated_at`; boleh saat ditangguhkan; boleh saat belum terbit.
- Tidak ada galat baru; panjang salah → `BAD_REQUEST` dari zod.

**Kontrak server publik** (`pf-server`):

- `packages/api/src/features/portfolio/access.ts` (baru, ekspor `@rezumi/api/features/portfolio/access`):

  ```ts
  export const PORTFOLIO_ACCESS_TTL_SECONDS = 12 * 60 * 60;
  export function hasPortfolioAccess(headers: Headers, portfolioId: string, passwordHash: string | null): boolean;
  export function grantPortfolioAccess(responseHeaders: Headers, portfolioId: string, passwordHash: string): void;
  /** "open": tanpa kata sandi, pemilik (resolveViewer), atau cookie sah. */
  export async function portfolioAccess(
    portfolio: Pick<PublicPortfolio, "id" | "userId" | "passwordHash">,
    headers: Headers,
  ): Promise<"open" | "locked">;
  export async function verifyPortfolioPassword(input: {
    username: string;
    password: string;
    trustedClient?: string;
    responseHeaders: Headers;
  }): Promise<"ok" | "wrong" | "limited">;
  ```

  Cookie `portfolio_access_<portfolioId>` = `<expires>.<hmac>`; HMAC dengan kunci turunan `AUTH_SECRET` bertujuan `rezumi:portfolio-access:v1` atas `[portfolioId, passwordHash, expires]` (sama seperti `resume/access.ts`, pakai ulang `safeEquals`); atribut `Path=/; Max-Age=43200; SameSite=Lax; HttpOnly` + `Secure` bila https; tanpa `Domain` (cookie per host). Verifikasi: panjang 6–64, limiter sendiri `createRateLimiter("portfolioPasswordAttempts", rateLimitConfig.orpc.resumePassword)` (5 per 10 menit) berkunci `portfolio-password:<portfolioId|missing>:ip:<client>`, bcrypt `compare` dengan hash pengganti saat portfolio tidak ada atau tanpa kata sandi (waktu tidak membocorkan), `FLAG_DISABLE_API_RATE_LIMIT` dihormati.

- `PublicPortfolio` + `passwordHash: string | null` (hanya di server; tidak pernah ke view, log, atau respons). `portfolioIsIndexable()` + `and portfolio.password is null`.
- Rute `POST /api/portfolio/:username/unlock` (`limitBody(16 * 1024)`) → `handlePortfolioUnlock` di `apps/server/src/http/portfolio.ts`: form `password`, `next` ∈ `"home" | "report" | "work:<slug>"` (slug cocok pola; selain itu `home`). Target dibangun server: host aplikasi → `/<username>`, `/<username>?report`, `/<username>/work/<slug>`; host lain (domain sendiri) → `/`, `/?report`, `/work/<slug>`. Berhasil → 303 ke target + `Set-Cookie`; salah → 303 ke target + `unlock=wrong`; dibatasi → `unlock=limited`; portfolio tidak ada → 404. `Cache-Control: no-store`.
- Gerbang di `servePortfolioOrResume`, `servePortfolioWork`: `portfolioAccess === "locked"` → 401 dengan `renderPortfolioLockPage` (`@rezumi/portfolio/gate`), `X-Robots-Tag: noindex, nofollow`, `private, no-store`, CSP tanpa skrip (`portfolioContentSecurityPolicy("", {})`), kunjungan **tidak** dihitung. `?report` **tidak** digerbang (pelapor halaman kunci palsu tetap bisa melapor) tetapi untuk portfolio terkunci tanpa akses form memakai `@<username>` sebagai nama.
- Jalur lain: kartu portfolio dan kartu karya → banner; vCard → 404; beacon (`handlePortfolioEvent`) → 204 tanpa hitung; pesan kontak (`submitPortfolioMessage`) → hasil `unavailable` (tanpa kode baru); sitemap → otomatis lewat `portfolioIsIndexable`.
- File: fungsi baru `portfolioFileAccess(key): Promise<"public" | "protected" | "none">` di `public.ts`; `isPublicPortfolioFile` menjadi pembungkus `!== "none"`. File milik portfolio terkunci tetap dilayani bagi siapa pun yang punya alamatnya (kuncinya acak), tapi dengan `Cache-Control: private, max-age=3600` dan `X-Robots-Tag: noindex` (`apps/server/src/static/uploads.ts`, `apps/server/src/cloudflare/index.ts`). Alasan: gambar di domain sendiri dimuat dari domain aplikasi, tempat cookie akses domain sendiri tidak terkirim (risiko yang diterima, bagian 9).

**Kontrak render** (`pf-render`, `packages/portfolio/src/gate.ts`, ekspor `@rezumi/portfolio/gate`):

```ts
export function renderPortfolioLockPage(input: {
  lang: string;
  dir: "ltr" | "rtl";
  action: string; // /api/portfolio/<username>/unlock
  next: string; // nilai form `next`
  status?: "wrong" | "limited" | undefined;
  reportUrl: string; // ?report di domain ini
  messages: PortfolioPageMessages;
}): string;
export function renderPortfolioMissingWorkPage(input: {
  lang: string;
  dir: "ltr" | "rtl";
  homeUrl: string;
  messages: PortfolioPageMessages;
}): string;
```

Halaman polos seperti `report.ts`: CSS sendiri terang/gelap, tanpa skrip, form `method="post"`, `<input type="password" name="password" autocomplete="current-password" minlength="6" maxlength="64" required>`, label terhubung, galat dengan `role="alert"`, semua teks di-escape, `<meta name="robots" content="noindex, nofollow">`.

**UI editor** (`pf-web`): grup **Password** di `editor/publish-panel.tsx` (dialog dari pola panel Share CV, tanpa mengimpor kode CV yang terikat API CV). Teks: "Protect with a password", "Visitors need this password to see your portfolio and its works. While it's on, search engines don't list it and link previews show a general picture.", "At least 6 characters.", "Change password", "Remove the password?". Grup **Search engines**: saklar dinonaktifkan dengan catatan "Off while your portfolio has a password." Dialog Terbitkan: catatan bila berkata sandi. Kartu dashboard: chip **Password**.

**Keamanan dan privasi.** Hash bcrypt; cookie bertanda tangan terikat hash (ganti kata sandi = cabut); batas 5/10 menit per IP per portfolio + batas publik 600/menit; `next` hanya nilai yang dikenal (bukan URL bebas, jadi tidak ada open redirect); form lintas situs tidak berbahaya karena cookie hanya untuk peramban yang mengirim; halaman kunci tidak membocorkan nama, foto, atau apakah karya ada (halaman karya terkunci menjawab 401 sebelum mencari karya).

**Uji wajib.** Unit: tanda tangan cookie (kedaluwarsa, hash lain, portfolio lain, format rusak), `next` (nilai jahat → `home`), halaman kunci (escape, tanpa skrip). DB nyata (`portfolio.integration.test.ts` atau berkas baru `password.integration.test.ts`): set/hapus tidak menggerakkan `updated_at`; `hasPassword` di DTO; `portfolioIsIndexable` palsu; sitemap tanpa portfolio terkunci; verifikasi benar/salah/batas; `portfolioFileAccess`. Server: halaman utama, karya, kartu, vCard, beacon, pesan, `?report` untuk terkunci tanpa/dengan cookie dan untuk pemilik; domain sendiri. E2E: pasang kata sandi → jendela lain (konteks baru) melihat kunci → salah → benar → halaman karya terbuka tanpa diminta lagi.

**Pekerjaan per sesi:** `pf-server`: kolom, prosedur, `access.ts`, gerbang di semua jalur, rute unlock, file, sitemap, ekspor. `pf-render`: `gate.ts`. `pf-web`: grup Kata sandi, saklar mesin pencari, chip. `pf-themes`: tidak ada.

#### 3.5 B17 — Sematan lain di blok karya

**Tujuan.** Karya bisa memuat desain Figma, video Loom, audio Spotify/SoundCloud, dan presentasi Google Slides, dengan pola privasi blok Video: tidak ada yang dimuat dari penyedia sebelum pengunjung menekan.

**Perilaku yang terlihat pengguna.** Menu **+ Tambah blok** punya **Embed** ("Sematan") dengan keterangan "Figma, Loom, Spotify, SoundCloud or Google Slides". Pengguna menempel tautan; judul dan gambar terisi otomatis bila penyedia menyediakannya (Google Slides tidak: pengguna mengetik judul dan boleh mengunggah gambar). Di halaman karya tampil gambar + tombol bertuliskan "Show Figma here" dan catatan kecil "Loads content from Figma"; setelah ditekan, pemutar/penampil penyedia dimuat di tempat. Tanpa JavaScript, tautan membuka halaman penyedia di tab baru. Blok Video (YouTube/Vimeo) tidak berubah.

**Aturan paket.** Semua paket ("semua jenis blok tersedia di semua paket", `00-keputusan.md` bagian 4).

**Kontrak skema** — `packages/schema/src/portfolio/embed.ts` (baru, Langkah 0, lengkap):

```ts
export const EMBED_PROVIDERS = ["figma", "loom", "spotify", "soundcloud", "google-slides"] as const;
export type EmbedProvider = (typeof EMBED_PROVIDERS)[number];
export const EMBED_PROVIDER_NAMES: Record<EmbedProvider, string>; // Figma, Loom, Spotify, SoundCloud, Google Slides
export type EmbedShape = "wide" | "audio" | "audio-tall";
export type ParsedEmbed = { provider: EmbedProvider; ref: string };
export function parseEmbedUrl(input: string): ParsedEmbed | null;
export function isEmbedRef(provider: EmbedProvider, ref: string): boolean;
export function embedPlayerUrl(embed: ParsedEmbed): string;
export function embedPageUrl(embed: ParsedEmbed): string;
export function embedShape(embed: ParsedEmbed): EmbedShape;
export const EMBED_FRAME_ORIGINS: Record<EmbedProvider, readonly string[]>;
export function embedFrameOrigins(providers: Iterable<EmbedProvider>): string[]; // unik, urut
export const EMBED_OEMBED_ENDPOINTS: Partial<Record<EmbedProvider, string>>;
```

| Penyedia        | Tautan yang diterima                                                                                                            | `ref` (pola)                                                                                               | Pemutar (`embedPlayerUrl`)                                                                   | Halaman (`embedPageUrl`)                  | `frame-src`                                        | Bentuk                                           | oEmbed                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------ |
| `figma`         | `(www.)figma.com/{file,design,proto,board,slides,deck}/<key>[/<nama>][?node-id=…]`, `embed.figma.com/…`                         | `^(file\|design\|proto\|board\|slides\|deck)/[\dA-Za-z]{10,64}(\?node-id=[\d-]{1,40})?$`                   | `https://embed.figma.com/<kind>/<key>?embed-host=rezumi[&node-id=…]`                         | `https://www.figma.com/<ref>`             | `https://embed.figma.com`, `https://www.figma.com` | `wide`                                           | `https://www.figma.com/api/oembed?url=`          |
| `loom`          | `(www.)loom.com/{share,embed}/<id>`                                                                                             | `^[\da-f]{32}$`                                                                                            | `https://www.loom.com/embed/<id>`                                                            | `https://www.loom.com/share/<id>`         | `https://www.loom.com`                             | `wide`                                           | `https://www.loom.com/v1/oembed?url=`            |
| `spotify`       | `open.spotify.com/[intl-xx/]{track,album,playlist,episode,show,artist}/<id>`                                                    | `^(track\|album\|playlist\|episode\|show\|artist)/[\dA-Za-z]{22}$`                                         | `https://open.spotify.com/embed/<ref>`                                                       | `https://open.spotify.com/<ref>`          | `https://open.spotify.com`                         | `audio` (track, episode), `audio-tall` (lainnya) | `https://open.spotify.com/oembed?url=`           |
| `soundcloud`    | `(m.)soundcloud.com/<user>/<track>`, `…/<user>/sets/<set>`; tautan pendek `on.soundcloud.com/…` diselesaikan `unfurl` di server | `^[\w-]{1,64}/(sets/)?[\w-]{1,128}$`, segmen pertama bukan `discover\|search\|stream\|you\|upload\|charts` | `https://w.soundcloud.com/player/?url=<encode(https://soundcloud.com/<ref>)>&auto_play=true` | `https://soundcloud.com/<ref>`            | `https://w.soundcloud.com`                         | `audio`, `audio-tall` (`sets/`)                  | `https://soundcloud.com/oembed?format=json&url=` |
| `google-slides` | `docs.google.com/presentation/d/<id>/…`, `…/d/e/<pubId>/pub…`                                                                   | `^(e/)?[\w-]{25,128}$`                                                                                     | `https://docs.google.com/presentation/d/<ref>/embed?start=false&loop=false`                  | `…/d/<ref>/view` (atau `/pub` untuk `e/`) | `https://docs.google.com`                          | `wide`                                           | —                                                |

`ref` dibatasi `PORTFOLIO_LIMITS.text.embedRef` (200). Alamat penyedia dan endpoint dicek ulang terhadap dokumentasi penyedia saat implementasi (`pf-server` untuk oEmbed, `pf-render` untuk pemutar); bila satu berubah, ubah tabel ini di laporan.

`packages/schema/src/portfolio/blocks.ts`:

```ts
export const PORTFOLIO_BLOCK_TYPES = ["text", "images", "metrics", "video", "embed", "pdf", "link"] as const;
z.object({
	id: itemIdSchema,
	type: z.literal("embed"),
	provider: z.enum(EMBED_PROVIDERS),
	ref: z.string(),
	title: kit.optional(kit.text(max.mediaTitle)),
	thumbnail: kit.optional(image).describe("The provider's picture copied to the portfolio's storage, or one the person uploaded. The page shows only this."),
}).refine((block) => isEmbedRef(block.provider, block.ref), { message: "This isn't a link this service can embed.", path: ["ref"] }),
// Seperti video: aturan berlaku saat baca juga (blok yang tidak bisa diputar dibuang).
```

Tidak ada `thumbnailUrl` tersimpan (editor menyimpannya di memori saja), jadi tidak perlu daftar host gambar penyedia.

**Kontrak API** (`pf-server`): `portfolio.unfurl` output union + varian:

```ts
z.object({
  kind: z.literal("embed"),
  url: z.string().describe("The page on the provider's site."),
  provider: z.enum(EMBED_PROVIDERS),
  ref: z.string(),
  title: z.string().optional(),
  thumbnailUrl: z.string().optional().describe("The provider's picture; copy it with fetchRemoteImage + uploadImage."),
});
```

`unfurl.ts`: setelah pengalihan, bila URL akhir cocok `parseEmbedUrl` → baca oEmbed penyedia (fetch aman yang sama: 5 detik, 1 MB, alamat privat ditolak), ambil `title` dan `thumbnail_url`; galat oEmbed tidak menggagalkan (kembalikan `embed` tanpa judul/gambar). Kunci cache unfurl naik ke `portfolio-unfurl:v3:…`. Gambar disalin lewat `fetchRemoteImage` + `uploadImage` seperti video. Klik pemutar dihitung sebagai jenis klik `embed` (3.7).

**URL dan penyajian.** Halaman karya: `frame-src` = dasar (YouTube nocookie, Vimeo) + `embedFrameOrigins(penyedia yang ada di karya itu)`. Halaman utama tidak memuat blok, jadi tidak berubah.

**Kontrak view/render** (`pf-render`):

```ts
| {
	id: string; type: "embed";
	provider: EmbedProvider; providerName: string; shape: EmbedShape;
	title: string; href: string /* embedPageUrl */; embedUrl: string /* embedPlayerUrl */;
	thumbnail: PortfolioViewImage | null;
}
```

Komponen `EmbedFacade` di `shared/media.tsx` (generalisasi `VideoFacade`): `<a … data-embed={embedUrl} data-title={title || providerName} data-pf-event="embed" data-pf-block={id}>` dengan `linkAttributes` (`ugc nofollow noopener noreferrer`, tab baru), `aria-label` = `messages.showEmbed` + judul, catatan `messages.embedNote` terlihat, `data-shape` untuk tinggi (CSS: `wide` 16:9, `audio` 166 px, `audio-tall` 380 px; bentuk audio tampil sebagai baris: gambar persegi + judul + penyedia + tombol). Skrip halaman memakai jalur `a[data-embed]` yang sama untuk membuat `iframe` (tanpa `sandbox`, `allow` dan `referrerPolicy` sama dengan video). `WorkArticle` menggambar kasus `embed`.

**UI editor** (`pf-web`): `blocks/embed-block.tsx` (baru): input **Link** dengan tunda 600 ms dan pembatalan seperti blok Video; `parseEmbedUrl` di browser lalu `portfolio.unfurl` untuk judul/gambar; salin gambar lewat `fetchRemoteImage` + `uploadImage` (diam, tanpa dialog paket kecuali kuota penuh seperti thumbnail video); kolom **Title**, gambar (ganti/hapus/unggah sendiri lewat `image-field`), lencana penyedia. Galat: "This link isn't from a service we can embed. Use a Link block instead." Petunjuk: Google Slides "Share the presentation with 'Anyone with the link' first, or it won't show."; Figma "The file must be viewable by anyone with the link." Catatan privasi: "Visitors load it from {provider} only when they press it." Blok Tautan dan **Tambah karya → Tempel tautan**: bila URL cocok `parseEmbedUrl`, tawarkan "Embed it instead" (opsional, bila waktu cukup).

**Keamanan dan privasi.** Tidak ada permintaan ke penyedia sebelum klik (gambar adalah salinan di penyimpanan sendiri); `ref` divalidasi pola ketat sehingga URL pemutar selalu dibangun dari bagian yang dikenal (tidak ada URL bebas di `iframe`); CSP per halaman hanya membuka asal penyedia yang dipakai karya itu; setelah klik penyedia bisa memasang cookie dan melacak, jadi Kebijakan Privasi menyebut kelima penyedia (bagian 10) dan catatan di bawah tombol memberi tahu pengunjung (keputusan pemilik #7).

**Uji wajib.** Skema (`embed.test.ts`): setiap bentuk tautan sah per penyedia, tautan mirip yang harus ditolak (host lain, `javascript:`, ref terlalu panjang, segmen SoundCloud terlarang, `figma.com/community/…`), URL pemutar/halaman/bentuk, `embedFrameOrigins`; blok tulis/baca (ref buruk dibuang saat baca). Render: `EmbedFacade` (tanpa `iframe` di HTML awal, tanpa `src` luar selain gambar sendiri, label), `portfolioFileKeys` paritas. API: unfurl tiap penyedia dengan oEmbed tiruan, oEmbed gagal → tetap `embed`, tautan pendek SoundCloud. Server: CSP halaman karya memuat tepat asal yang dipakai. E2E (opsional, jaringan luar tidak di CI): klik fasad → `iframe` dengan `src` yang diharapkan muncul (cek atribut saja).

**Pekerjaan per sesi:** Langkah 0: `embed.ts`, blok, `files.ts`. `pf-server`: unfurl + oEmbed, CSP halaman karya. `pf-render`: view, `EmbedFacade`, CSS dasar, skrip. `pf-themes`: CSS sematan di dua tema baru. `pf-web`: blok editor, tawaran dari Tautan.

#### 3.6 B19 — "Open to work" dengan jenis pekerjaan

**Tujuan.** Label "Open to work" yang sudah ada mendapat isi: posisi yang dicari dan jenis kerja. Mandiri sebagai field portfolio. **Catatan, tidak dirancang di sini:** kelak bisa disambungkan ke fitur Applications (lowongan yang dilamar); jangan membuat kaitan atau kolom untuk itu sekarang.

**Perilaku yang terlihat pengguna.** Di intro: chip "Open to work" (atau teks sendiri) seperti sekarang, lalu satu baris "Looking for: Product Designer · UI Designer — Full-time, Contract". Mode kerja (Remote/Hybrid/On-site) dan relokasi tetap di kartu Lokasi, tidak diulang.

**Aturan paket.** Semua paket. Bawaan mati (keputusan pemilik #6).

**Kontrak skema** (`data.ts`, `limits.ts`):

```ts
export const PORTFOLIO_JOB_TYPES = ["full-time", "part-time", "contract", "freelance", "internship"] as const;
export type PortfolioJobType = (typeof PORTFOLIO_JOB_TYPES)[number];
// limits: availabilityRoles: 5, text.availabilityRole: 60
availability: kit.field(z.object({
	show: kit.field(z.boolean(), false),
	text: kit.field(kit.text(max.availability), "").describe("Empty shows 'Open to work' in the page's language."),
	roles: kit.list(kit.text(max.availabilityRole), PORTFOLIO_LIMITS.availabilityRoles).describe("Roles the person is looking for."),
	types: kit.list(z.enum(PORTFOLIO_JOB_TYPES), PORTFOLIO_JOB_TYPES.length, { id: (type) => type }),
}), { show: false, text: "", roles: [], types: [] }),
```

**Kontrak view/render:**

```ts
hero: {
	availability: string | null;            // tidak berubah
	openTo: { roles: string[]; types: PortfolioJobType[] } | null; // null bila !show atau keduanya kosong; roles di-trim, kosong dibuang
}
```

`OpenToWork` (`shared/intro.tsx`, tanda tangan final di Langkah 0): `export function OpenToWork({ className }: { className?: string })` membaca `useRender().view.hero.openTo`; menggambar `<p class="pf-opento">` berisi `<span class="pf-opento__label">{messages.lookingFor}</span>` + peran dipisah " · " + " — " + label jenis dari `messages` (`fullTime`, `partTime`, `contractWork`, `freelance`, `internship`) dipisah ", ". Teks biasa (tidak hanya warna), urutan baca wajar di RTL, `null` bila tidak ada isi. Setiap tema (enam lama oleh `pf-render`, dua baru oleh `pf-themes`) menaruhnya di intro setelah `IntroChips`. JSON-LD tidak berubah.

**UI editor** (`pf-web`, `editor/intro-form.tsx`): di bawah saklar Open to work (saat menyala): **Roles you're looking for** (input tag, maks. 5, "Up to 5, such as Product Designer."), **Kinds of work** (kotak centang lima jenis: Full-time, Part-time, Contract, Freelance, Internship). Kunci riwayat `hero.availability`.

**Keamanan dan privasi.** Bawaan mati; teks bantu saklar: "Anyone who opens your page sees this, your current employer too."

**Uji wajib.** Skema (batas, unik, baca toleran), view (`openTo` null/terisi, trim), render `OpenToWork` per tema (ada di intro, tidak ada saat kosong, RTL), editor (form).

**Pekerjaan per sesi:** Langkah 0: skema, view, stub komponen. `pf-render`: komponen + penempatan di enam tema + CSS dasar. `pf-themes`: penempatan di dua tema. `pf-web`: form.

#### 3.7 B9 — Statistik lanjutan

**Yang sudah ada** (`02-teknis.md` bagian 36): 30 hari, kunjungan/klik/pesan/sumber/karya teratas untuk semua paket; rincian Analytics Engine (negara, perangkat, perujuk, karya per hari) untuk Plus. **Yang ditambah:** rentang 7/30/90 hari, angka harian lengkap, semua karya (bukan 10 teratas), rincian per karya, sumber QR, klik sematan dan simpan kontak, karya dihitung dari halaman karya (B2), dan unduh CSV.

**Aturan paket** (keputusan pemilik #1): rentang 7/30/90 dan CSV harian + CSV karya untuk **semua** paket (angka dasar dari Postgres, data milik pemilik sendiri); rincian negara/perangkat/perujuk/per karya dan CSV rincian untuk **Plus** (`detailedPortfolioStats` yang sudah ada). Katalog tidak berubah.

**Kontrak skema** (`packages/schema/src/portfolio/statistics.ts`):

```ts
export const PORTFOLIO_CLICK_KINDS = [
  "resume",
  "pdf",
  "whatsapp",
  "email",
  "link",
  "contact",
  "service",
  "video",
  "document",
  "embed",
  "vcard",
] as const;
export const PORTFOLIO_EVENT_KINDS = PORTFOLIO_CLICK_KINDS; // "work" dihapus oleh pf-server (bukan Langkah 0)
export const PORTFOLIO_VISIT_SOURCES = ["linkedin", "whatsapp", "google", "qr", "direct", "other"] as const;
/** Sumber kunjungan halaman karya di Analytics Engine: + "portfolio" (dari halaman portfolio itu sendiri). */
export const PORTFOLIO_WORK_SOURCES = [...PORTFOLIO_VISIT_SOURCES, "portfolio"] as const;
export const PORTFOLIO_STATISTICS_RANGES = [7, 30, 90] as const;
export type PortfolioStatisticsRange = (typeof PORTFOLIO_STATISTICS_RANGES)[number];
export const PORTFOLIO_STATISTICS_DAYS = 30; // bawaan, tetap
export const PORTFOLIO_QR_UTM_SOURCE = "qr";
```

Tabel `portfolio_statistics_daily` tidak berubah (kolom `works` sudah per karya per hari, maks. 50 = batas karya).

**Kontrak API** (`router.ts`):

```ts
// portfolio.statistics — GET /portfolio/statistics
input: z.object({ range: z.coerce.number().pipe(z.union([z.literal(7), z.literal(30), z.literal(90)])).optional() }).optional()
output: {
	range: { days: 7 | 30 | 90, from: "YYYY-MM-DD", to: "YYYY-MM-DD" },
	days: { date, views, messages, workOpens, clicks: countsOf(PORTFOLIO_CLICK_KINDS), sources: countsOf(PORTFOLIO_VISIT_SOURCES) }[],
	totals: { views, clicks: countsOf(PORTFOLIO_CLICK_KINDS), messages },   // tidak berubah
	sources: countsOf(PORTFOLIO_VISIT_SOURCES),                              // tidak berubah
	works: { id, title, opens }[],    // SEMUA karya yang masih ada dengan opens > 0, urut menurun (tanpa potongan 10)
	details: locked | unavailable | ready { countries, devices, referrers, workDays },  // bentuk tidak berubah, ikut rentang
} | null

// portfolio.workStatistics — GET /portfolio/statistics/works/{workId}  (baru)
input: { workId: itemIdSchema, range?: 7 | 30 | 90 }
output: {
	range,
	work: { id, title, slug },
	days: { date, opens }[],          // Postgres `works`, semua paket
	totals: { opens },
	details: locked | unavailable | ready {
		sources: { source: string /* PORTFOLIO_WORK_SOURCES */, views }[],
		referrers: { domain, views }[], countries: { code, views }[], devices: { device, views }[],
		clicks: countsOf(PORTFOLIO_CLICK_KINDS),   // klik di halaman karya itu (AE blob2 = workId)
	},
}
errors: PORTFOLIO_DISABLED, NOT_FOUND, PORTFOLIO_WORK_NOT_FOUND
```

`errors.ts`: `PORTFOLIO_WORK_NOT_FOUND: { status: 404, message: "This work isn't in the portfolio." }` + `portfolioErrors.workNotFound()`.

**Pencatatan** (`pf-server`, `public.ts`, `traffic.ts`, `analytics.ts`, `statistics.ts`):

- `visitSource`: `utm_source=qr` → `"qr"` (tambahkan di `sourceOfName`).
- `recordPortfolioVisit({ portfolio, requestHeaders, requestUrl, trustedClient, workId? })`: (1) kunjungan portfolio seperti sekarang (dedupe `portfolio:<id>:view:<visitor>` per jam; datang dari halaman utama ke karya tidak menghitung kunjungan dua kali); (2) bila `workId`: dedupe `portfolio:<id>:work:<workId>:<visitor>` → `countWorkOpen` + data point AE `event: "work"`, `workId`, `source` (`"portfolio"` bila `Referer` host sendiri, selain itu `visitSource`), `referrerDomain`, `device`.
- Beacon klik membawa `id` karya di halaman karya → data point AE dengan `blob2 = workId`; Postgres `clicks` tetap per portfolio per hari.
- `portfolioDetailQueries(portfolioId, now, timeZone, { days, workId? })`: rentang `days`; dengan `workId` filter `blob1 = 'work' AND blob2 = $work` untuk sumber (`blob3`), perujuk, negara, perangkat, plus kueri klik `blob1 NOT IN ('view','work') AND blob2 = $work GROUP BY blob1`. Tetap tanpa `accountTag`/`FORMAT`, `SUM(double1)`, parameter bernama, zona waktu disaring `queryTimeZone`. Kunci cache `portfolio-details:v2:<portfolioId>:<days>:<workId|all>`, 5 menit.
- Retensi Analytics Engine 3 bulan: 90 hari adalah batas atas; dashboard menandai rincian "perkiraan" seperti sekarang.

**UI dashboard** (`pf-web`, `features/portfolio/statistics/`):

- `portfolio-statistics.tsx`: kontrol segmen **Last 7 days / Last 30 days / Last 90 days** (disimpan di URL search param `range`); sumber baru **QR code**; klik baru **Embeds opened**, **Contacts saved**; tabel **Per work** (semua karya: judul, dibuka, persen) dengan tombol **Details** per baris.
- `work-statistics.tsx` (baru): panel/sheet per karya: grafik harian (semua paket); untuk Plus: sumber (termasuk **From your portfolio**), perujuk, negara, perangkat, klik; untuk Gratis: kartu terkunci yang membuka dialog paket (`openPlanDialog`) seperti rincian sekarang.
- `csv.ts` (baru) + `csv.test.ts`: tiga berkas, UTF-8 dengan BOM, pemisah koma, baris CRLF, sel yang diawali `=`, `+`, `-`, `@`, tab, atau CR diberi awalan `'` (cegah formula injection), tanda kutip ganda di-escape. Nama: `portfolio-<username>-<from>-<to>-daily.csv` (`date,views,messages,work_opens,click_<kind>…,source_<source>…`), `…-works.csv` (`work_id,title,opens`), `…-details.csv` (`section,key,value` untuk countries, devices, referrers, work_days; hanya saat `details.state === "ready"`). Menu **Download CSV** dengan tiga pilihan; yang Plus terkunci untuk Gratis.

**Keamanan dan privasi** (kajian privasi B9). Semua angka agregat; tidak ada IP, user agent mentah, atau ID pengunjung di Postgres, AE, maupun CSV. Rincian per karya pada lalu lintas kecil bisa menunjuk satu kunjungan ("1 dari Singapura, iPad"); ini statistik situs milik pemilik sendiri tanpa data pribadi, dan Kebijakan Privasi sudah menyebut statistik agregat tanpa cookie. CSV dibuat di browser dari jawaban API yang hanya bisa dibaca pemiliknya. Domain perujuk ditampilkan apa adanya (sudah tanpa path).

**Uji wajib.** Unit: `sourceOfName("qr")`, pembentuk kueri (rentang, `workId`, selalu `index1 = $portfolio`), CSV (BOM, escape, injection, kolom). DB nyata: `statistics` dengan rentang 7/90 dan batas tanggal zona pemilik, angka harian lengkap; `workStatistics` (karya milik sendiri, karya tak ada → 404, karya milik orang lain tidak terbaca); kunjungan halaman karya: dedupe per jam, pemilik dan bot tidak dihitung, kunjungan portfolio tidak ganda; beacon `work` lama tidak menghitung. Web: rentang, tabel per karya, panel terkunci.

**Pekerjaan per sesi:** Langkah 0: konstanta skema + kerangka prosedur. `pf-server`: semua pencatatan dan kueri. `pf-render`: `data-pf-work` dan `id` di beacon. `pf-web`: UI dan CSV.

### 4. Kontrak lintas lapisan

#### 4.1 View (`packages/portfolio/src/view.ts`)

```ts
export type PortfolioViewInput = {
  // … yang ada …
  links?: {
    resume?: string | null;
    resumePdf?: string | null;
    /** The portfolio's home, for links back from a work page. Default "#main". */
    home?: string;
    /** A work's own page. Default (slug) => `#work-${slug}`. */
    work?: (slug: string) => string;
    /** "Save contact" (vCard); null or absent leaves the buttons off. */
    vcard?: string | null;
  };
};

export type PortfolioViewWork = {
  // … yang ada (id, slug, anchor, title, …) …
  href: string;
  previousSlugs: string[];
  /** Minutes to read the work's text blocks and summary at 200 words a minute, at least 1; null with no text. */
  readingMinutes: number | null;
};

export type PortfolioViewBlock = /* … */ PortfolioViewEmbedBlock; // bagian 3.5

export type PortfolioViewContact = { /* … */ vcard: string | null };

export type PortfolioView = {
  // … yang ada …
  homeUrl: string;
  hero: { /* … */ openTo: { roles: string[]; types: PortfolioJobType[] } | null };
};

/** A work's page by an address: the current slug, else a previous one (moved), else null. */
export function resolvePortfolioWork(
  view: PortfolioView,
  slug: string,
): { status: "ok"; work: PortfolioViewWork } | { status: "moved"; slug: string } | null;
```

`buildPortfolioView` memakai `isListedWork` dari skema untuk daftar karya. `PortfolioViewMessages.buttons` + `vcard`.

Nilai yang dikirim server (`publicPortfolioView(portfolio, { customDomain? })`, `pf-server`):

|               | Domain aplikasi                     | Domain sendiri           |
| ------------- | ----------------------------------- | ------------------------ |
| `links.home`  | `/<username>`                       | `/`                      |
| `links.work`  | `(slug) => /<username>/work/<slug>` | `(slug) => /work/<slug>` |
| `links.vcard` | `/api/portfolio/<username>/vcard`   | sama                     |

Editor (`pf-web`, `useEditorView` dan pratinjau) mengirim `links.vcard = "#contact"` agar tombol tampil di pratinjau inert, dan membiarkan `home`/`work` bawaan.

#### 4.2 Render (`packages/portfolio`)

```ts
// page.tsx
export type PortfolioPageKind = { kind: "home" } | { kind: "work"; workId: string };
export type RenderPortfolioPageInput = { /* … */ page?: PortfolioPageKind }; // bawaan home; workId tak dikenal → throw Error
// shared/context.ts
page: { kind: "home" } | { kind: "work"; work: PortfolioViewWork; previous: PortfolioViewWork | null; next: PortfolioViewWork | null };
// document.ts
PortfolioHead.type?: "profile" | "article"; // og:type, bawaan profile
```

- `PageShell`: pada halaman karya, `main` berisi `<WorkArticle />` (komponen bersama baru di `shared/work-page.tsx`) menggantikan `children`; akar `.pf` mendapat `data-pf-work=<id>` bila terbit; `Navigation` menautkan merek ke `view.homeUrl` dan bagian ke `${view.homeUrl}#<anchor>` di halaman karya.
- `WorkArticle`: tautan **All work** ke `${homeUrl}#work`, `h1.pf-detail__title`, kelas isi yang sudah ada (`pf-detail__head`, `__summary`, `__meta`, `pf-tags`, `pf-detail__hero` dengan `Picture` `eager`, `pf-blocks`, tombol tautan utama), lalu `nav.pf-workpage__more` dengan karya sebelumnya/berikutnya (tidak berputar bila hanya satu karya), lalu `Lightbox` bila ada galeri. Pembungkus `article.pf-workpage`.
- `BASE_CSS`: aturan dasar `.pf-workpage`; hapus `.pf-detail` dialog dan aturan cetaknya (ganti aturan cetak untuk `.pf-workpage`).
- `effects`: efek intro hanya di halaman utama (halaman karya tidak punya intro), jadi `effectAssets` tidak dipanggil untuk `page.kind === "work"`.

#### 4.3 Fungsi baru `@rezumi/portfolio`

| Subpath                      | Fungsi                                                      | Pemilik     |
| ---------------------------- | ----------------------------------------------------------- | ----------- |
| `@rezumi/portfolio`          | `renderPortfolioPage({ page })`, `PortfolioPageKind`        | `pf-render` |
| `@rezumi/portfolio/view`     | `resolvePortfolioWork`                                      | `pf-render` |
| `@rezumi/portfolio/gate`     | `renderPortfolioLockPage`, `renderPortfolioMissingWorkPage` | `pf-render` |
| `@rezumi/portfolio/vcard`    | `buildPortfolioVcard`                                       | `pf-render` |
| `@rezumi/portfolio/document` | `PortfolioHead.type`                                        | `pf-render` |

#### 4.4 String halaman publik baru

Ditambahkan **di Langkah 0** ke `ENGLISH` di `messages.ts` dan ke `page-text.ts` (sama persis). Terjemahan Indonesia (usulan) diisi `pf-web` di katalog Lingui; `portfolio-catalog.json` dibuat ulang di langkah integrasi.

| Kunci           | Inggris (persis)                                   | Indonesia (usulan)                                            |
| --------------- | -------------------------------------------------- | ------------------------------------------------------------- |
| `allWork`       | All work                                           | Semua karya                                                   |
| `saveContact`   | Save contact                                       | Simpan kontak                                                 |
| `lookingFor`    | Looking for                                        | Mencari                                                       |
| `fullTime`      | Full-time                                          | Penuh waktu                                                   |
| `partTime`      | Part-time                                          | Paruh waktu                                                   |
| `contractWork`  | Contract                                           | Kontrak                                                       |
| `freelance`     | Freelance                                          | Lepas                                                         |
| `internship`    | Internship                                         | Magang                                                        |
| `readingTime`   | {count} min read                                   | {count} menit baca                                            |
| `showEmbed`     | Show {provider} here                               | Tampilkan {provider} di sini                                  |
| `embedNote`     | Loads content from {provider}                      | Memuat konten dari {provider}                                 |
| `workMissing`   | This work isn't on this portfolio anymore.         | Karya ini sudah tidak ada di portofolio ini.                  |
| `lockedTitle`   | This portfolio is private                          | Portofolio ini privat                                         |
| `lockedIntro`   | Enter the password you were given to see it.       | Masukkan kata sandi yang diberikan kepadamu untuk melihatnya. |
| `password`      | Password                                           | Kata sandi                                                    |
| `unlock`        | Open portfolio                                     | Buka portofolio                                               |
| `wrongPassword` | That password isn't right. Check it and try again. | Kata sandi salah. Periksa lalu coba lagi.                     |
| `tooManyTries`  | Too many tries. Wait 10 minutes, then try again.   | Terlalu banyak percobaan. Tunggu 10 menit, lalu coba lagi.    |

### 5. Pekerjaan per sesi

Setiap sesi: baca bagian 1.1, kerjakan butir di bawah, jalankan cek paketnya, tulis laporan dengan format README ditambah daftar "selisih dari kontrak".

**Langkah 0** — bagian 2.

**`pf-server`** (`packages/schema/src/portfolio/**`, `packages/schema/package.json`, `packages/api/src/features/portfolio/**`, `packages/api/package.json`, `packages/db/src/schema/portfolio.ts` + `migrations/`, `apps/server/src/{http,static,cloudflare}` bagian portfolio):

1. B16: `setPassword`/`removePassword`, `access.ts`, `verifyPortfolioPassword`, gerbang di `servePortfolioOrResume`/`servePortfolioWork`/kartu/vCard/beacon/pesan, `POST /api/portfolio/:username/unlock`, `portfolioFileAccess` + `uploads.ts` + `cloudflare/index.ts`, `portfolioIsIndexable`, ekspor data.
2. B2: `isPortfolioWorkPath`, `servePortfolioWork`, rute di `app.ts` dan `handleCustomDomain`, kanonik/robots/head/JSON-LD, 301/404 (`unavailableResponse` diekspor dari `resume-page.ts`), kartu karya + rute `/cards/:username/work/…`, sitemap (SQL jsonpath + ukuran halaman), `publicPortfolioView(portfolio, options)` dengan `links`, `hasPart` halaman utama.
3. B9: `PORTFOLIO_EVENT_KINDS` tanpa `work`, `parsePortfolioEvent` dengan `id` untuk klik, `recordPortfolioVisit({ workId })`, QR di `traffic.ts`, AE rentang/per karya, `statistics` dan `workStatistics` penuh.
4. B14: rute vCard, `robots.txt`.
5. B17: unfurl `embed` + oEmbed + cache v3, CSP halaman karya.
6. Uji: `*.integration.test.ts` (DB nyata, lihat `.github/workflows/ci.yml` untuk database uji), `apps/server` (`portfolio-page.test.ts`, `http/portfolio.test.ts`, `custom-domain.test.ts`, `seo.test.ts`, `portfolio-card.test.ts`, `uploads-portfolio.test.ts`). Cek: `pnpm --filter @rezumi/schema test`, `pnpm --filter @rezumi/api test src/features/portfolio`, `pnpm --filter server test`, typecheck ketiganya, `pnpm exec turbo boundaries`, `pnpm check:cloudflare`.

**`pf-render`** (`packages/portfolio/**` kecuali `themes/sintaks/**` dan `themes/warta/**`; `tooling/portfolio/**` kecuali `personas/raka.ts`, `personas/laras.ts`):

1. B2 dulu: `WorkArticle`, `PageShell`/`Navigation` untuk halaman karya, `renderPortfolioPage({ page })`, hapus dialog + CSS + kode skrip, `PORTFOLIO_LIVE_SCRIPT` (`data-pf-work`, tanpa beacon `work`), `href` di enam tema, CSS `.pf-workpage` di enam tema, `PortfolioHead.type`.
2. B19 `OpenToWork` + penempatan di enam tema; B14 tombol vCard di `Contact` + tombol intro + ikon; B17 `EmbedFacade` + CSS dasar.
3. `vcard.ts`, `gate.ts` penuh.
4. `fixtures.test-helpers.ts` (`fullPortfolioData` dengan semua field baru: `previousSlugs`, `openTo`, `saveContact`, blok `embed` per penyedia), `files.test.ts`.
5. Tooling: `portfolio:preview`/`portfolio:matrix` bisa merender halaman karya (`--work <slug>` atau baris matriks "work"), persona lama mendapat `availability.roles/types` contoh.
6. Uji: view, page (halaman karya × tema × LTR/RTL), script (happy-dom: lightbox, sematan, tanpa dialog), anggaran skrip, vcard, gate, kontras. Cek: `pnpm --filter @rezumi/portfolio test`, typecheck, `@rezumi/tooling` typecheck. Lihat matriks enam tema (halaman utama + karya) dengan mata.

**`pf-themes`** (`packages/portfolio/src/themes/sintaks/**`, `…/warta/**`, `tooling/portfolio/personas/{raka,laras}.ts`, gambar baru di `.agents/docs/plans/portfolio/mockups/img/`, `apps/web/public/portfolio-themes/**/{sintaks,warta}.*`):

1. Ganti stub dengan tema penuh (bagian 3.3), termasuk `OpenToWork`, `href`, `.pf-workpage`, sematan, semua varian, RTL.
2. Persona Raka dan Laras (dua bahasa, varian minimal/panjang/RTL).
3. `theme.test.tsx` per tema; uji bersama lulus untuk 8 tema.
4. Gambar galeri lewat `portfolio:previews`; matriks `--themes sintaks,warta` dilihat dengan mata; tangkapan desktop 1440 dan HP 390, terang/gelap, untuk laporan.
5. Tidak mengedit file bersama. Butuh perubahan di `shared/` atau metadata tema? Tulis di laporan untuk langkah integrasi.

**`pf-web`** (`apps/web/src/features/portfolio/**`, `apps/web/src/routes/{dashboard,builder}/portfolio/**`, `apps/web/locales/*.po`, `tests/e2e/specs/portfolio-phase-13.spec.ts` baru):

1. B16: grup Kata sandi, saklar mesin pencari, catatan dialog Terbitkan, chip dashboard.
2. B2: alamat halaman di editor karya, riwayat slug di `works/works.ts` (+ tes), pratinjau halaman karya.
3. B14: `card/business-card-dialog.tsx`, saklar Simpan kontak, jenis tombol.
4. B17: `blocks/embed-block.tsx`, menu blok, tawaran dari Tautan.
5. B19: form Open to work.
6. B9: rentang, per karya, `work-statistics.tsx`, `csv.ts`.
7. Galat `PORTFOLIO_WORK_NOT_FOUND` di `errors.ts`; `pnpm lingui:extract`; terjemahan id-ID untuk semua string baru, termasuk 18 string halaman (bagian 4.4) dan deskripsi tema.
8. E2E `portfolio-phase-13.spec.ts` (`PORTFOLIO_MODE=on`, akun uji fiktif): halaman karya + Kembali, alamat lama → baru, kata sandi (kunci, salah, benar, halaman karya tanpa diminta lagi), unduh vCard, dialog kartu nama (QR berisi `utm_source=qr`), blok sematan tersimpan dan tampil sebagai fasad, rentang statistik.
9. Cek: `pnpm --filter web typecheck`, `pnpm --filter web test src/features/portfolio`, `pnpm lint:agent`, `pnpm format:check`, E2E terhadap build lokal.

**Langkah integrasi** (sesi koordinator, setelah keempatnya): `pnpm pdf:translations` (perbarui `portfolio-catalog.json`), `pnpm lingui:extract` tanpa selisih, `pnpm typecheck`, `pnpm test` paket terkait, `pnpm exec turbo boundaries`, `pnpm lint:agent`, `pnpm format:check`, `pnpm check:cloudflare`, E2E penuh portfolio, matriks visual 8 tema (halaman utama + halaman karya, 1440/390, terang/gelap, RTL) dilihat dengan mata, tinjauan terpisah atas gerbang kata sandi (semua jalur di 3.4) dan CSP, lalu pembaruan dokumen bagian 10.

### 6. Ringkasan per fitur × sesi

| Fitur | Langkah 0                                                                                  | `pf-server`                                             | `pf-render`                         | `pf-themes`                 | `pf-web`                        |
| ----- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------- | ----------------------------------- | --------------------------- | ------------------------------- |
| B2    | `previousSlugs`, `isListedWork`, view `href`/`homeUrl`/`resolvePortfolioWork`, tipe `page` | rute, 301/404, kanonik, kartu, sitemap, JSON-LD, hitung | `WorkArticle`, shell, skrip, 6 tema | 2 tema                      | alamat, riwayat slug, pratinjau |
| B14   | tombol `vcard`, `saveContact`, `vcard.ts` stub                                             | rute vCard, robots, `links.vcard`                       | `buildPortfolioVcard`, tombol       | —                           | dialog QR, saklar, jenis tombol |
| B1    | metadata, font, stub, persona stub, deskripsi                                              | —                                                       | —                                   | tema penuh, persona, galeri | terjemahan                      |
| B16   | kolom, kerangka prosedur, `hasPassword`                                                    | akses, gerbang, unlock, file, indeks                    | `gate.ts`                           | —                           | grup Kata sandi                 |
| B17   | `embed.ts`, blok, `files.ts`                                                               | unfurl/oEmbed, CSP                                      | `EmbedFacade`                       | CSS                         | blok editor                     |
| B19   | skema, `openTo`, stub `OpenToWork`                                                         | —                                                       | komponen, 6 tema                    | 2 tema                      | form                            |
| B9    | konstanta, kerangka prosedur                                                               | pencatatan, kueri                                       | beacon `id`                         | —                           | UI, CSV                         |

### 7. Daftar file bersama

File yang disentuh lebih dari satu fitur, dengan satu pemilik. "L0" = boleh diubah Langkah 0 untuk baris tercantum, lalu hanya pemiliknya.

| File                                                                                                        | Pemilik                                                      | Fitur             | Catatan                                    |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ----------------- | ------------------------------------------ |
| `packages/schema/src/portfolio/data.ts`                                                                     | `pf-server` (L0)                                             | B2, B14, B19      | Field final di L0                          |
| `packages/schema/src/portfolio/blocks.ts`                                                                   | `pf-server` (L0)                                             | B17               |                                            |
| `packages/schema/src/portfolio/embed.ts` (baru)                                                             | `pf-server` (L0)                                             | B17               | Lengkap di L0                              |
| `packages/schema/src/portfolio/limits.ts`                                                                   | `pf-server` (L0)                                             | B2, B17, B19      |                                            |
| `packages/schema/src/portfolio/statistics.ts`                                                               | `pf-server` (L0)                                             | B9, B14, B17      | `EVENT_KINDS` diubah `pf-server`, bukan L0 |
| `packages/schema/src/portfolio/themes.ts`                                                                   | `pf-server` (L0)                                             | B1                | Metadata tema final di L0                  |
| `packages/schema/package.json`                                                                              | `pf-server` (L0)                                             | B17               | ekspor `./portfolio/embed`                 |
| `packages/db/src/schema/portfolio.ts` + migrasi                                                             | `pf-server` (L0)                                             | B16               |                                            |
| `packages/api/src/features/portfolio/router.ts`                                                             | `pf-server` (L0)                                             | B9, B16, B17      | Kerangka di L0                             |
| `packages/api/src/features/portfolio/errors.ts`                                                             | `pf-server` (L0)                                             | B9                |                                            |
| `packages/api/src/features/portfolio/public.ts`                                                             | `pf-server`                                                  | B2, B9, B16       |                                            |
| `packages/api/package.json`                                                                                 | `pf-server`                                                  | B16               | ekspor `./features/portfolio/access`       |
| `apps/server/src/http/app.ts`                                                                               | `pf-server`                                                  | B2, B14, B16      | Urutan rute kartu penting                  |
| `apps/server/src/http/portfolio.ts`                                                                         | `pf-server`                                                  | B9, B14, B16      |                                            |
| `apps/server/src/http/custom-domain.ts`                                                                     | `pf-server`                                                  | B2, B16           |                                            |
| `apps/server/src/static/portfolio-page.ts`                                                                  | `pf-server`                                                  | B2, B14, B16, B17 |                                            |
| `apps/server/src/static/{portfolio-card,seo,uploads,resume-page}.ts`, `apps/server/src/cloudflare/index.ts` | `pf-server`                                                  | B2, B14, B16      |                                            |
| `packages/portfolio/src/view.ts`                                                                            | `pf-render` (L0)                                             | semua kecuali B16 | Tipe final di L0                           |
| `packages/portfolio/src/page.tsx`, `document.ts`, `shared/context.ts`                                       | `pf-render` (L0)                                             | B2                |                                            |
| `packages/portfolio/src/shared/{parts,intro,shell,media,icons,base-css,work-page}.tsx`                      | `pf-render` (L0 hanya `intro.tsx` stub dan `parts.tsx` ikon) | B2, B14, B17, B19 | `pf-themes` hanya membaca                  |
| `packages/portfolio/src/script.ts`, `live-script.ts`                                                        | `pf-render`                                                  | B2, B9, B17       |                                            |
| `packages/portfolio/src/messages.ts`                                                                        | `pf-render` (L0)                                             | semua             | String final di L0                         |
| `packages/portfolio/src/portfolio-catalog.json`                                                             | Langkah integrasi                                            | semua             | Dibuat `pnpm pdf:translations`             |
| `packages/portfolio/src/files.ts`, `files.test.ts`                                                          | `pf-render` (L0)                                             | B17               |                                            |
| `packages/portfolio/src/fixtures.test-helpers.ts`                                                           | `pf-render`                                                  | semua             | `pf-themes` hanya membaca                  |
| `packages/portfolio/src/{gate,vcard}.ts` (baru), `package.json`                                             | `pf-render` (L0)                                             | B14, B16          |                                            |
| `packages/portfolio/src/themes/index.ts`, `palettes.ts`                                                     | `pf-render` (L0)                                             | B1                | Tidak perlu disentuh setelah L0            |
| `packages/portfolio/src/themes/{lugas,prima,kanvas,mozaik,paper,brutal}/**`                                 | `pf-render`                                                  | B2, B17, B19      |                                            |
| `packages/portfolio/src/themes/{sintaks,warta}/**`                                                          | `pf-themes` (stub L0)                                        | B1 dan semua      |                                            |
| `tooling/portfolio/persona.ts`                                                                              | `pf-render` (L0)                                             | B1                | Pendaftaran persona di L0                  |
| `tooling/portfolio/personas/{raka,laras}.ts`                                                                | `pf-themes` (stub L0)                                        | B1                |                                            |
| `apps/web/public/portfolio-themes/**/{sintaks,warta}.*`                                                     | `pf-themes`                                                  | B1                | Berkas baru saja                           |
| `apps/web/src/features/portfolio/page-text.ts`                                                              | `pf-web` (L0)                                                | semua             | Sama persis dengan `messages.ts`           |
| `apps/web/src/features/portfolio/themes.ts`                                                                 | `pf-web` (L0)                                                | B1                |                                            |
| `apps/web/src/features/portfolio/editor/{publish-panel,intro-form,contact-form,preview,use-view}.tsx`       | `pf-web` (L0 hanya `intro-form` label)                       | B2, B14, B16, B19 |                                            |
| `apps/web/src/features/portfolio/statistics/portfolio-statistics.tsx`                                       | `pf-web` (L0 label)                                          | B9, B14, B17      |                                            |
| `apps/web/src/features/portfolio/blocks/block-list.tsx`                                                     | `pf-web` (L0 kasus `embed`)                                  | B17               |                                            |
| `apps/web/locales/*.po`                                                                                     | `pf-web`                                                     | semua             |                                            |
| `tests/e2e/specs/portfolio-phase-13.spec.ts` (baru)                                                         | `pf-web`                                                     | semua             | Spesifikasi lama tidak diubah              |
| `.agents/docs/plans/portfolio/*`, `docs/**`                                                                 | Langkah integrasi                                            | semua             | Bagian 10                                  |

Tidak disentuh siapa pun di fase ini: `packages/schema/src/billing/catalog.ts` (selama keputusan #1 sesuai rekomendasi), `packages/api/src/middleware/rate-limit/index.ts`, `packages/utils/src/rate-limit.ts`, `packages/env`, `turbo.json`, `wrangler.jsonc`, `packages/email`, `packages/pdf`, `apps/mobile`.

### 8. Perlu keputusan pemilik

1. **Paket per fitur.** Rekomendasi: Sintaks dan Warta **Plus**; halaman karya, kartu nama + vCard, sematan, Open to work, dan kata sandi untuk **semua paket**; statistik rentang 7/30/90 + CSV harian/karya untuk semua, rincian (negara, perangkat, perujuk, per karya) + CSV rincian **Plus**. Alasan: sesuai `00-keputusan.md` bagian 4 (Gratis 2 tema, semua jenis blok untuk semua, rincian statistik Plus, kata sandi CV juga gratis), jadi katalog, harga, dan S&K tidak berubah.
2. **Karya dibuka di halaman sendiri, bukan jendela di atas halaman utama.** Rekomendasi: ya, jendela detail dihapus. Alasan: satu cara membuka karya, halaman utama jauh lebih ringan, tombol Kembali dan kartu share per karya bekerja apa adanya.
3. **Aturan alamat karya.** Rekomendasi: dibuat otomatis dari judul, bisa diubah sendiri, dan hingga 5 alamat lama per karya tetap mengalihkan ke alamat baru. Alasan: tautan yang sudah dibagikan tidak rusak saat judul diganti.
4. **Isi vCard.** Rekomendasi: nama, headline, email/WhatsApp/telepon hanya bila tampil di Kontak, alamat portfolio, situs dan profil yang tampil, kota bila "Tampilkan lokasiku" menyala; tanpa foto dan alamat jalan. Alasan: vCard tidak pernah membuka lebih dari yang sudah terlihat di halaman.
5. **Kata sandi dan mesin pencari.** Rekomendasi: satu kata sandi untuk seluruh portfolio (halaman utama dan semua karya); selama aktif tidak diindeks, tidak di sitemap, kartu share umum; halaman kunci tanpa nama/foto; akses berlaku 12 jam per peramban; pemilik yang login tidak diminta; berganti kata sandi mencabut semua akses. Alasan: sama dengan CV berkata sandi dan paling menjaga privasi.
6. **Open to work.** Rekomendasi: tetap mati bawaan; isi posisi (maks. 5) dan jenis kerja (penuh waktu, paruh waktu, kontrak, lepas, magang); tanpa gaji dan tanggal mulai. Alasan: atasan saat ini bisa melihat halaman, dan gaji di halaman publik merugikan saat negosiasi.
7. **Penyedia sematan.** Rekomendasi: kelima penyedia (Figma, Loom, Spotify, SoundCloud, Google Slides), hanya dimuat setelah diklik, dengan catatan "Memuat konten dari …" dan penyebutan di Kebijakan Privasi. Alasan: pola privasi sama dengan YouTube/Vimeo; Google Slides hanya tampil bila dibagikan publik, editor memberi tahu itu.
8. **QR dan statistik.** Rekomendasi: QR selalu memuat `?utm_source=qr`, sehingga statistik punya sumber "QR". Alasan: pemilik bisa melihat apakah kartu di job fair menghasilkan kunjungan, tanpa cookie atau data pengunjung.

**Jawaban (2026-11-12):** pemilik memilih rekomendasi untuk #1 (paket) dan #2 (karya dibuka di halaman sendiri, jendela detail dihapus). #3–#8 berjalan dengan rekomendasi di atas sebagai bawaan yang dipilih koordinator, belum ditanyakan satu per satu ke pemilik; pemilik boleh mengubahnya, dan #7–#8 masih murah diubah sampai langkah integrasi. Teks Kebijakan Privasi untuk sematan tetap menunggu persetujuan pemilik sebelum terbit.

**Git untuk gelombang ini (menggantikan catatan Git di bagian 1):** semua sesi bekerja di satu checkout, branch `feat/portfolio-review-2`; sesi tidak membuat commit, branch, atau stash. Koordinator yang memeriksa dan meng-commit per tahap.

### 9. Risiko dan yang sengaja tidak dikerjakan

**Risiko:**

- **B2 adalah perubahan terluas**: enam tema, skrip halaman, CSS dasar, pratinjau editor, dan cara karya dihitung berubah sekaligus. Uji baseline byte-per-byte halaman utama akan berubah (hilangnya `.pf-detail`); `pf-render` mencatat perubahan sengaja itu. Bila ada CSS tema yang bergantung pada `.pf-detail .x`, gaya isi karya di halaman karya bisa hilang tanpa galat; matriks visual halaman karya wajib dilihat.
- **Kerangka Langkah 0 yang kurang** membuat sesi paralel saling merusak typecheck (record lengkap per tema, `switch` tuntas atas tipe blok, paritas `messages.ts`/`page-text.ts`). Selama jendela antara string baru dan terjemahan, skrip root yang menjalankan `pdf:translations` bisa gagal; cek per paket tidak terpengaruh, dan langkah integrasi menutupnya.
- **Gerbang kata sandi punya banyak jalur** (utama, karya, `?report`, kartu ×2, vCard, beacon, pesan, sitemap, file, domain sendiri dengan cookie per host). Satu jalur terlewat = bocor. File portfolio terkunci tetap bisa diambil oleh siapa pun yang tahu alamatnya (kunci acak, tidak diindeks, tidak di-cache publik): risiko yang diterima karena domain sendiri memuat gambar dari domain aplikasi.
- **Sitemap**: aturan jsonpath SQL harus sama dengan `listedWorkSlugs`; bila beda, karya tersembunyi bisa masuk sitemap. Uji DB nyata wajib. Ukuran halaman sitemap turun dari 50.000 ke 980 portfolio.
- **Sematan bergantung pada pihak luar**: format URL, host pemutar (`embed.figma.com`), parameter widget SoundCloud, dan endpoint oEmbed bisa berubah tanpa pemberitahuan; Google Slides yang tidak dibagikan publik tampil kosong setelah diklik. Setelah klik, penyedia bisa memasang cookie.
- **Statistik**: rentang 90 hari menyentuh batas retensi Analytics Engine (3 bulan), jadi hari tertua bisa kosong; panel per karya menambah kueri baca (tetap jauh di bawah kuota, cache 5 menit). Kunjungan pemilik di domain sendiri masih terhitung (keputusan Phase 09). Excel berbahasa Indonesia memakai `;` sebagai pemisah daftar, jadi CSV berkoma bisa terbuka dalam satu kolom; BOM membantu aksara, bukan pemisah (Google Sheets dan Numbers tidak terpengaruh).
- **Tema baru tanpa mockup tersimpan**: arah visual hanya dari uraian B1; perlu penilaian pemilik di langkah integrasi seperti Phase 06.

**Sengaja tidak dikerjakan:**

- Kaitan Open to work dengan Applications (B19 bagian kedua), gaji, tanggal mulai, JSON-LD `seeks`.
- Kata sandi per karya, beberapa kata sandi, tautan undangan bertanggal.
- QR di halaman publik, halaman kartu nama publik, Apple/Google Wallet, NFC.
- Sematan selain lima penyedia; `sandbox` pada `iframe` (sama dengan video; bisa ditambah setelah diuji per penyedia).
- Gambar sampul karya sebagai `og:image` (resvg tidak bisa menggambar WebP); kartu karya memakai foto orang.
- Pengunjung unik, perbandingan periode, ekspor terjadwal, statistik CV di Analytics Engine (B26).
- Aplikasi mobile (catat di "Feature parity exceptions").

### 10. Pembaruan dokumen setelahnya

Dikerjakan langkah integrasi, bukan sesi gelombang 1:

- [x] `00-keputusan.md`: tabel paket bagian 4 (baris Tema: 8 tema; baris baru halaman karya, kartu nama, kata sandi, sematan bila perlu; baris Statistik: rentang dan CSV); bagian 1/2 (halaman karya `/<username>/work/<slug>`); bagian 3b (jenis blok + Sematan); bagian 3d/Intro (Open to work + posisi/jenis); log keputusan untuk jawaban #1–#8.
- [x] `backlog-lanjutan.md`: tandai B1, B2, B9, B14, B16, B17, B19 "dikerjakan di Phase 13"; tambahkan sisa yang ditunda (B19 bagian Applications, `sandbox` sematan, kata sandi per karya, QR publik).
- [x] `README.md`: baris Phase 13 di tabel phase (status), baris "Catatan sesi", isi folder.
- [x] `01-desain.md`: bagian 3 (aturan detail karya diganti halaman karya; jangkar `#work-<slug>` tidak ada lagi), bagian 4 (kontrol baru), bagian baru untuk Sintaks, Warta, halaman karya, halaman kunci, kartu nama.
- [x] `02-teknis.md`: bagian baru di akhir (41) dengan catatan implementasi Phase 13; rujukan dari bagian 6 (rute), 9 (statistik), 18 (video → sematan).
- [ ] `docs/guides/creating-a-portfolio.mdx`: halaman karya dan alamatnya, kartu nama dan QR, kata sandi, sematan, Open to work, statistik dan CSV, dua tema; tangkapan layar persona fiktif baru; `pnpm --filter web test src/features/docs`.
- [ ] `docs/legal/privacy-policy.mdx` dan `kebijakan-privasi.mdx`: kelima penyedia sematan (dimuat setelah klik), vCard, kata sandi portfolio; **perlu persetujuan pemilik** sebelum terbit.
- [ ] `draf-panduan-portfolio.md`, `checklist-rilis.md` (uji halaman karya, kata sandi, sematan), `.agents/docs/mobile-release-handoff.md` (Feature parity exceptions).
- [ ] `llms.txt` (`apps/server/src/static/seo.ts`) bila pemilik ingin menyebut fitur baru.

### 11. Selesai bila

- Ketujuh fitur bekerja di server lokal dengan `PORTFOLIO_MODE=on`, dan dengan `off` produk berperilaku seperti sebelumnya (diuji).
- Semua uji wajib di bagian 3 lulus, cek seluruh workspace di langkah integrasi lulus, E2E Phase 13 lulus.
- Matriks visual 8 tema (halaman utama + karya) dilihat dan temuan diperbaiki; pemilik menilai Sintaks dan Warta.
- Dokumen bagian 10 diperbarui; draf legal menunggu persetujuan pemilik.

### 12. Selisih setelah tinjauan kedua (2026-11-12)

Dokumen ini ditulis saat tinjauan kedua masih berjalan. Butir di bawah **mengalahkan** teks di atas bila berbeda.

1. **Nama modul kata sandi.** `packages/api/src/features/portfolio/access.ts` sudah ada sejak tinjauan kedua (siapa yang boleh memakai portfolio: `enabledAccount`, `requireEnabled`). Modul akses pengunjung berkata sandi (bagian 3.4) bernama `visitor-access.ts`, diekspor sebagai `@rezumi/api/features/portfolio/visitor-access`. Di mana pun dokumen ini menulis `access.ts` untuk B16, baca `visitor-access.ts`.
2. **Jenis peristiwa `view`** sudah ada di `PORTFOLIO_EVENT_KINDS` (halaman prerender yang diaktifkan mengirim satu `view`, server menghitungnya sebagai kunjungan tanpa dobel). B9 mempertahankannya saat menghapus `work`.
3. **Status rincian statistik** kini `"not-configured"` (Analytics Engine tidak terpasang) dan `"unavailable"` (kueri gagal). Bentuk keluaran B9 memakai keduanya.
4. **String tambahan di Langkah 0** (bagian 4.4): `viewWork` = "View work" / "Lihat karya". `pf-render` memakainya untuk ajakan di kartu karya Paper (`pp-work__cta`, sekarang menampilkan judul bagian) dan boleh memakainya di tema lain; `pf-themes` memakainya di Sintaks dan Warta bila kartu punya ajakan.
5. **Istilah Indonesia.** Katalog memakai "portofolio" dan "Anda", bukan "kamu". Usulan `lockedIntro` menjadi "Masukkan kata sandi yang diberikan kepada Anda untuk melihatnya." Semua terjemahan baru mengikuti istilah itu.
6. **String "Role" halaman publik** sudah dipisah dari "Role" milik Applications pada tinjauan kedua; ikuti cara yang dipakai di `messages.ts`/`page-text.ts` bila string baru bentrok dengan msgid fitur lain.
7. **Kartu share di Workers** diperbaiki pada tinjauan kedua (wasm resvg ikut dibundel, diuji `tooling/cloudflare/smoke.mjs`). Kartu per karya (B2) memakai jalur yang sama dan menambah satu pemeriksaan smoke untuk `/cards/<username>/work/<slug>.png`.
8. **Zona waktu statistik**: akun kini mendapat zona waktu peramban bila belum pernah memilih; rentang 7/30/90 hari B9 memakai zona waktu akun yang sama dengan kartu statistik sekarang.
9. **Laporan sesi** ditulis ke `.agents/docs/plans/portfolio/laporan-phase-13/<nama sesi>.md` (bahasa Inggris): yang dikerjakan, uji dengan hasil persis, selisih dari kontrak, yang tidak dikerjakan beserta alasannya.
10. **Perujuk kunjungan prerender.** Beacon `view` sekarang tanpa perujuk, jadi kunjungan seperti itu tercatat `direct`. Di B9: `pf-render` menambah `ref: document.referrer` (dipotong 300 karakter) pada beacon `view`, dan `pf-server` memakainya di `traffic.ts` seperti header `Referer`.
