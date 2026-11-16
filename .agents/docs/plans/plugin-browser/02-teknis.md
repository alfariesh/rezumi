# Rancangan teknis — plugin browser

Untuk agent. Path dan nama di sini berasal dari eksplorasi kode 2026-11-11: cek ulang sebelum mengandalkannya. Nomor bagian dirujuk dokumen phase; bagian baru ditambahkan di akhir dan perubahan rancangan dicatat di bagian yang bersangkutan.

## 1. Ringkasan arsitektur

```text
Tab situs loker
  └─ content script (TypeScript polos, tanpa React)
       · menghitung kunci loker dari URL → tanya service worker "sudah tersimpan?"
       · membaca DOM hanya saat diminta (panel, tombol, menu, pintasan)
       · menggambar tombol/chip di Shadow DOM
            │ chrome.runtime messages (tervalidasi)
Service worker (background, ES module)
  · token OAuth, klien oRPC (Bearer), cache kunci tersimpan, alarm, menu klik kanan, badge
            │ fetch, Authorization: Bearer, credentials: "omit"
            ▼
rezumi.app /api/rpc  (oRPC yang sama dengan app mobile)
            ▲
Panel samping (React + HeroUI + TanStack Query) ── meminta data lewat service worker
```

**Pola dipilih di Phase 01:** service worker memegang login (OAuth, refresh token, perbarui token). Panel memanggil API **langsung** dengan klien oRPC + TanStack Query, memakai access token dari `chrome.storage.session` (konteks tepercaya; content script tidak bisa membacanya), dan meminta service worker memperbarui token saat 401. Pesan panel ↔ service worker hanya untuk hal yang bukan panggilan API (status login, keadaan per tab, badge). Token tidak pernah masuk ke content script.

## 2. Kode yang dipakai ulang

| Kebutuhan                     | Kode yang ada                                                                                                                                                                                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Membaca lowongan dari halaman | `packages/api/src/features/applications/posting.ts`: `jobPostingsIn`, `readJobPosting` (JSON-LD `JobPosting`), `isListingUrl`, `MAX_POSTING_CHARS`                                                                                                           |
| Isi kolom dari halaman + AI   | `applications.ai.parsePosting` (`packages/api/src/features/applications/ai.ts` ±baris 219): isi dari JSON-LD, AI opsional (`short-text`, 1 kredit), `dataBlock` untuk teks tidak tepercaya                                                                   |
| Menyimpan lamaran             | `applications.create` (`packages/api/src/dto/application.ts`, `createInputSchema`): `sourceUrl`, `jobDescription`, `postingSource`, `requirements`, `resumeId`, `followUpAt`, `followUpNote`, `tags`, `status`                                               |
| Ubah status, catatan          | `applications.update`, `applications.addNote`                                                                                                                                                                                                                |
| Skor istilah tanpa AI         | `matchResume` (`packages/api/src/features/resume/checks.ts`, REST `/resumes/{id}/job-matches`; saat ini hanya alias REST di `packages/api/src/routers/rest.ts`), mesin `matchJobDescription` di `@rezumi/resume` (`packages/resume/src/ats-pdf/jd/match.ts`) |
| AI lamaran                    | `applications.ai.matchScore` (kunci `review`, 4 kredit), `applications.ai.tailorResume` (5), surat lamaran (3), `aiSourceInput` (`rezumi` / `own`)                                                                                                           |
| Paket dan kredit              | `billing.summary` (`packages/api/src/features/billing/router.ts`)                                                                                                                                                                                            |
| Login OAuth                   | Better Auth `oauthProvider` (`packages/auth/src/config.ts`), dynamic client registration + PKCE; contoh alur lengkap di app mobile: `apps/mobile/src/auth/oauth.ts`, `apps/mobile/src/api/client.ts`                                                         |
| Redirect OAuth yang diizinkan | `isAllowedOAuthRedirectUri` (`packages/utils/src/url-security.node.ts`) sudah menerima https publik, termasuk `https://<id>.chromiumapp.org/`                                                                                                                |
| Gerbang paket untuk API       | `assertAutomationAccess`, `isFirstPartyClient`, `firstPartyRedirectUris` (`packages/api/src/features/billing/automation.ts`)                                                                                                                                 |
| Cookie lintas situs ditolak   | `packages/api/src/context.ts` (±baris 89): permintaan bercookie dari origin lain ditolak, jadi plugin wajib Bearer                                                                                                                                           |
| Aplikasi terhubung            | `apps/web/src/features/settings/ai/connected-apps.tsx` (`authClient.oauth2.getConsents`, cabut izin)                                                                                                                                                         |
| Detail lamaran di web         | rute `apps/web/src/routes/dashboard/applications/$applicationId.{-$tab}.tsx`, tab `WORKSPACE_TABS` (`packages/schema/src/career.ts`: `fit`, `apply`, `prepare`, `practise`, `debrief`, `messages`, `saved`)                                                  |
| UI dan ikon                   | `@rezumi/ui` (HeroUI), `packages/icons`, Lingui seperti `apps/web`                                                                                                                                                                                           |

## 3. Lokasi kode baru

```text
apps/extension/                     # app baru, nama paket "extension"
  manifest.config.ts                # manifest MV3, versi dari package.json
  src/background/                   # service worker: auth, api, kunci tersimpan, alarm, menu, badge, pesan
  src/content/                      # content script: adaptor situs, pembaca umum, tombol/chip
  src/content/sites/__fixtures__/   # HTML sintetis per situs untuk tes
  src/sidepanel/                    # React app panel
  src/shared/                       # tipe & skema pesan, kunci storage, konstanta
  locales/                          # katalog Lingui en, id
  public/_locales/{en,id}/          # nama & deskripsi toko (messages.json)
  public/icons/
  tests/                            # Playwright dengan plugin dimuat
  AGENTS.md                         # perintah dan cara memuat plugin untuk agent
packages/job-sites/                 # @rezumi/job-sites, runtime:universal, role:domain
  src/sites.ts                      # deteksi situs, URL kanonik, kunci loker
  src/json-ld.ts                    # JobPosting dari JSON-LD (bagian murni dipindah dari posting.ts)
  src/capture.ts                    # skema Zod CapturedPosting yang dikirim plugin ke server
```

- `apps/extension/turbo.json`: tag `app:extension`, `runtime:browser`. Boleh mengimpor `@rezumi/ui`, `@rezumi/icons`, `@rezumi/job-sites`, `@rezumi/schema`, dan **tipe** router dari `@rezumi/api` (ikuti cara `apps/mobile/src/api/client.ts`). Cek `pnpm exec turbo boundaries`.
- Logika yang nanti dibutuhkan mobile atau server (kunci loker, JSON-LD, skema capture) ada di `@rezumi/job-sites`, bukan di `apps/extension`.
- Perbarui `CLAUDE.md` root (Overview dan ownership map) dengan app kelima.

## 4. Build dan tooling

- **Vite lewat `vp`**, tanpa framework plugin tambahan, supaya versi Vite tetap satu sesuai override workspace. WXT atau CRXJS hanya boleh dipakai bila terbukti tidak membawa Vite kedua; catat alasannya di sini. **Phase 01:** tanpa WXT/CRXJS. `scripts/build.ts` memanggil `build` dari `vite-plus` dua kali (konfigurasi di `scripts/build-config.ts`), lalu menulis `dist/manifest.json` dari `manifest.config.ts`. Plugin Vite yang sama dengan web: Tailwind, React, Lingui, React Compiler.
- **Versi minimum: Chrome/Edge 116** (`minimum_chrome_version: "116"`). Dasar (dokumentasi resmi, dicek 2026-11-12): `chrome.sidePanel` ada sejak Chrome 114, `sidePanel.open()` sejak 116 dan hanya dalam gestur pengguna (klik ikon, pintasan, menu klik kanan, atau gestur di halaman ekstensi/content script). Edge memakai API `chrome.sidePanel` dan kunci manifest `side_panel.default_path` yang sama; halaman Edge tidak menyebut versi. Edge mendukung `identity.launchWebAuthFlow` (bukan `getAuthToken`); format redirect `https://<id>.chromiumapp.org/` di Edge belum tertulis di dokumentasinya, dicek di Phase 02. `minimum_chrome_version` hanya membatasi pemasangan dari toko. Catatan Edge: panel tidak otomatis tampil lagi saat pengguna kembali ke tab tempat panel tadinya terbuka (isu Edge #142).
- **Dua keluaran:** (a) halaman panel + service worker sebagai ES module (`"background": { "service_worker": "background.js", "type": "module" }`); (b) content script sebagai satu file IIFE (content script tidak bisa memakai `import`). Manifest ditulis skrip build dari `manifest.config.ts`.
- **Target server saat build:** `REZUMI_URL` (bawaan `https://rezumi.app`; build dev `http://localhost:3000`). Izin host dan `resource` OAuth mengikuti nilai ini. Tidak ada pemilih server di rilis pertama (backlog B6).
- **ID stabil:** manifest build dev memuat `key` = public key item Chrome Web Store (dari pemilik di akhir Phase 01), supaya ID plugin saat dikembangkan sama dengan ID di toko. ID Edge berbeda dan dicatat terpisah (bagian 15).
- **Skrip:** `dev` (build watch → "Load unpacked" `apps/extension/dist`), `build`, `zip` (→ `apps/extension/release/rezumi-extension-<versi>.zip`, diabaikan git), `typecheck`, `test`, `test:e2e`.
- **Batas ukuran:** content script ≤ 50 KB setelah diperkecil, tanpa React dan tanpa Zod (validasi ada di service worker). Tes ukuran seperti anggaran skrip portfolio.
- Lint, format, knip, dan Turbo mencakup `apps/extension` seperti workspace lain. Tes unit ikut CI lewat skrip `test`.

## 5. Login

1. Panel: **Hubungkan ke Rezumi** → service worker.
2. Discovery metadata OAuth server, lalu **dynamic client registration** sekali (simpan `client_id`), `client_name` "Rezumi browser extension", `token_endpoint_auth_method: "none"`, redirect `chrome.identity.getRedirectURL()` = `https://<id>.chromiumapp.org/`.
3. PKCE S256 + `state`, `chrome.identity.launchWebAuthFlow({ url, interactive: true })`. Scope: `openid profile email offline_access api:read api:write` (tanpa `api:delete`). `resource` = URL server, seperti app mobile.
4. Tukar `code` → access token + refresh token. Access token di `chrome.storage.session`, refresh token dan `client_id` di `chrome.storage.local` (bukan `sync`). Perbarui token otomatis sebelum kedaluwarsa dan saat respons 401; bila refresh gagal, panel menampilkan 3.7 "Hubungkan lagi".
5. **Keluar:** cabut refresh token di server, hapus storage dan cache kunci.
6. Semua `fetch` ke server memakai `credentials: "omit"` dan header `Authorization: Bearer`.

**Plugin = aplikasi resmi.** Tambahkan `https://<chrome-id>.chromiumapp.org/` dan `https://<edge-id>.chromiumapp.org/` ke `firstPartyRedirectUris`, sehingga `assertAutomationAccess` meloloskan plugin di paket Gratis saat billing menyala. Seperti untuk app mobile, siapa pun bisa mendaftarkan client dengan URI yang sama untuk akunnya sendiri; ini diterima karena batas laju API tetap berlaku (komentar di `automation.ts`). Tes wajib: client plugin lolos di paket Gratis; client pihak ketiga lain tetap butuh `automationApi`.

Cek di Phase 02: halaman izin (consent) tampil sekali dengan nama client yang benar; apakah `oauthProvider` bisa melewati consent untuk client tepercaya (bila ya, pakai untuk plugin; bila tidak, biarkan); `launchWebAuthFlow` + `chromiumapp.org` berjalan juga di Edge.

**Hasil Phase 02 (2026-11-14):** halaman izin tampil dengan nama "Rezumi browser extension" (diuji Playwright). Consent **tidak** dilewati: Better Auth 1.7.12 menolak `skip_consent` lewat registrasi dinamis (hanya bisa di-set di server), dan app mobile pun menampilkan consent; pengguna menyetujui sekali, lalu login berikutnya langsung. Edge: belum bisa diuji otomatis (Edge bermerek tidak memuat ekstensi lewat baris perintah); pemilik mengecek manual (bagian 17).

## 6. API server

### 6.1 Sumber "extension"

Tambahkan `"extension"` ke `postingSourceSchema.method` (`packages/schema/src/applications/data.ts`). Cek semua pemakai enum (label di web, tes, `apps/mobile` tetap terkompilasi).

### 6.2 Kunci loker

- Kolom baru `application.source_key text` + indeks `(user_id, source_key)`. Diisi server dari `sourceUrl` dengan `jobKey()` dari `@rezumi/job-sites` di `create`, `update`, dan `import`.
- Format: `linkedin:<id>`, `indeed:<jk>`, `jobstreet:<id>`, `glints:<uuid>`; situs lain `url:<host><path>[?query]` (host huruf kecil, tanpa `www.`, tanpa garis miring akhir; query tanpa parameter pelacak, diurutkan, ikut dalam kunci karena banyak halaman karier menamai loker lewat query seperti `?gh_jid=`). Perubahan Phase 01, lihat bagian 16.
- Baris lama diisi lewat skrip sekali jalan di `tooling/` (dijalankan di produksi pada Phase 07 dengan izin pemilik). SQL tidak menyalin logika `jobKey`.

### 6.3 Prosedur baru

Semua `protectedProcedure` di fitur `applications`, bertag `Internal` (tidak masuk spesifikasi OpenAPI publik, mengikuti portfolio):

| Prosedur                     | Isi                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `applications.savedKeys`     | `{ keys: [{ key, id, status, updatedAt }] }`, hanya lamaran pengguna sendiri yang punya kunci, paling banyak 5.000 terbaru. Untuk penanda lokal (bagian 9).                                                                                                                                                                                                           |
| `applications.readCapture`   | Masukan `CapturedPosting` (bagian 7.5) + `aiSource` opsional. Tidak mengambil halaman dari server. Isi kolom dari `fields` adaptor dan JSON-LD, lalu AI bila diminta, dengan jalur yang sama dengan `parsePosting` (ekstrak fungsi bersama, jangan menyalin). Keluaran = keluaran `parsePosting` + `validThrough` + `existing` (lamaran dengan kunci sama, bila ada). |
| `applications.reportCapture` | `{ url, site, extensionVersion, missing: string[] }`. Email ringkas ke `BILLING_ALERT_EMAIL` (digabung per jam), batas 10 laporan per jam per pengguna. Tanpa isi halaman.                                                                                                                                                                                            |
| `applications.dueFollowUps`  | Lamaran dengan `followUpAt` ≤ batas yang diminta (bawaan akhir hari ini di zona waktu akun), paling banyak 50. Hanya bila `applications.list` tidak bisa memfilter ini dengan murah.                                                                                                                                                                                  |

Menyimpan tetap lewat `applications.create` dengan `postingSource.method: "extension"` dan `sourceUrl` kanonik. Skor istilah memakai `matchResume`; bila plugin memakai RPC, tambahkan prosedurnya ke router `resume` (sekarang hanya alias REST) tanpa mengubah perilaku REST.

### 6.4 Versi plugin

- Plugin mengirim header `x-rezumi-extension: <versi>` di setiap permintaan.
- Env opsional `EXTENSION_MIN_VERSION` (`packages/env/src/server.ts`, `.env.example`, `turbo.json` sesuai aturan env var di `CLAUDE.md`). Permintaan dari versi lebih lama dijawab galat `EXTENSION_OUTDATED`; panel menampilkan "Perbarui plugin". Ini rem darurat, bukan pengganti kompatibilitas: API tetap kompatibel ke belakang karena versi lama tetap dipakai beberapa hari setelah update.

### 6.5 Batas laju

`readCapture` memakai `aiRequestRateLimit` seperti `parsePosting`. `savedKeys` dan `dueFollowUps` memakai batas API biasa; plugin memanggilnya paling sering tiap 5 menit kecuali setelah simpan/ubah.

## 7. Pembaca halaman

### 7.1 Kontrak adaptor

```ts
type SiteAdapter = {
  site: "linkedin" | "indeed" | "jobstreet" | "glints";
  /** Halaman ini milik situs ini (host + path). */
  matches(url: URL): boolean;
  /** Kunci loker yang sedang dibuka, atau null (bukan loker / belum ada yang dipilih). Hanya dari URL bila bisa. */
  jobKey(url: URL, document: Document): string | null;
  /** Membaca loker yang terbuka. Teks polos, bukan HTML. */
  read(document: Document): CapturedFields;
  /** Elemen tempat tombol "Simpan ke Rezumi" disisipkan, atau null (pakai tombol melayang). */
  anchor(document: Document): Element | null;
};
```

`jobKey`/URL kanonik murni ada di `@rezumi/job-sites` dan dipakai server; bagian yang membaca DOM ada di `apps/extension/src/content/sites/`.

### 7.2 Urutan membaca

1. Adaptor situs (bila cocok).
2. JSON-LD `JobPosting` di halaman (`script[type="application/ld+json"]`, paling banyak 5 blok × 50 KB).
3. Pembaca umum: teks `main`/`article`/elemen teks terpanjang, tanpa `nav`, `header`, `footer`, `script`, `style`, formulir.
4. Teks yang diblok pengguna (menu klik kanan atau tombol 3.5).

### 7.3 Halaman satu-aplikasi (SPA)

LinkedIn, Glints, dan JobStreet berganti lowongan tanpa memuat ulang halaman. Content script mendengar Navigation API (`navigation` event) dengan cadangan `MutationObserver` ber-throttle yang membandingkan `location.href`. **Jangan** meminta izin `webNavigation`, `history`, atau `tabs`: browser akan memperingatkan "membaca riwayat penjelajahan".

### 7.4 URL kanonik dan kunci per situs

Pola ini dari pengetahuan umum; diverifikasi dengan halaman nyata di Phase 03 (2026-11-14, hasil di §18): semua pola cocok, ditambah LinkedIn `/jobs/search-results/?currentJobId=<id>` (halaman pencarian anggota yang login).

| Situs     | Contoh URL yang dikenali                                                                       | Kanonik                                     | Kunci                      |
| --------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------- | -------------------------- |
| LinkedIn  | `/jobs/view/<id>/`, `/jobs/search/?currentJobId=<id>`, `/jobs/collections/…?currentJobId=<id>` | `https://www.linkedin.com/jobs/view/<id>/`  | `linkedin:<id>`            |
| Indeed    | `<sub>.indeed.com/viewjob?jk=<id>`, `…/jobs?…&vjk=<id>`                                        | `https://<sub>.indeed.com/viewjob?jk=<id>`  | `indeed:<id>`              |
| JobStreet | `<sub>.jobstreet.com/<lang>/job/<id>`, `…?jobId=<id>`                                          | `https://<sub>.jobstreet.com/job/<id>`      | `jobstreet:<id>`           |
| Glints    | `glints.com/<negara>/opportunities/jobs/<slug>/<uuid>`                                         | URL tanpa query                             | `glints:<uuid>`            |
| Lainnya   | apa pun                                                                                        | tanpa parameter pelacak (`utm_*`, `ref`, …) | `url:<host><path>[?query]` |

### 7.5 Data yang dikirim (`CapturedPosting`, skema Zod di `@rezumi/job-sites`)

`url`, `canonicalUrl`, `site`, `pageTitle`, `jsonLd: string[]`, `text` (≤ `MAX_POSTING_CHARS`, sama dengan server), `selection?`, `fields?` dari adaptor (`role`, `company`, `location`, `salary`, `employmentType`, `validThrough`, `applyUrl`). Teks dirapikan (spasi ganda, baris kosong berlebih), tanpa HTML.

### 7.6 Keamanan isi halaman

- Content script tidak pernah menyisipkan HTML dari halaman ke UI plugin. Panel merender teks sebagai teks.
- Server memperlakukan teks sebagai data tidak tepercaya (`dataBlock`), sama seperti `parsePosting`.
- Content script tidak memegang token dan tidak memanggil API.

### 7.7 Fixtures dan pemeriksaan halaman nyata

- Fixtures **sintetis** meniru struktur DOM tiap situs (detail, daftar dengan detail terpilih, daftar tanpa pilihan, lowongan kedaluwarsa, antarmuka bahasa Indonesia). Jangan menyalin teks lowongan asli atau data pribadi ke repo.
- Halaman publik diperiksa dengan built-in browser. Halaman LinkedIn yang butuh login hanya lewat Claude in Chrome dengan izin pemilik, **hanya membaca**, tanpa menekan apa pun di akun pemilik.

## 8. Panel, tombol, dan pesan

- `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`. Panel mengikuti tab aktif; keadaan per tab (pratinjau yang belum disimpan) disimpan service worker di `chrome.storage.session` dengan kunci tab.
- **Membuka panel dari tombol di halaman:** `chrome.sidePanel.open({ tabId })` hanya boleh dalam gestur pengguna. Cek di Phase 04 apakah pesan dari klik di content script memenuhi syarat itu (Chrome dan Edge). Bila tidak, pakai perilaku cadangan di `01-desain.md` bagian 4. **Hasil Phase 04 (2026-11-15):** bisa di Chromium (Playwright, klik sungguhan → pesan `open-panel` → `sidePanel.open` dipanggil sebelum `await` apa pun → panel terbuka, tanpa galat gestur). Edge belum diuji otomatis; dicek pemilik di Phase 07. Cadangan bila browser menolak: tombol menampilkan petunjuk "Klik ikon Rezumi di toolbar untuk menyimpan" (bukan simpan langsung, karena content script tidak memegang token dan simpan tanpa pratinjau melanggar "isian bisa diubah dulu"), lihat §20.
- **Pesan** antarbagian memakai tipe dan skema Zod di `src/shared`. Service worker memeriksa `sender.id === chrome.runtime.id` dan, untuk content script, `sender.tab`. Tidak ada `externally_connectable` dan tidak ada `web_accessible_resources` kecuali benar-benar perlu (ikon tombol sebaiknya SVG sebaris).
- **Menu klik kanan:** `contextMenus`, konteks `selection`.
- **Pintasan:** `commands` dengan `_execute_action` (membuka panel lewat perilaku ikon). Phase 04: tetap begitu; Playwright tidak bisa menekan pintasan tingkat browser, jadi dicek manual pemilik (Phase 07). Pengaturan plugin punya tombol ke `chrome://extensions/shortcuts` (Edge: `edge://extensions/shortcuts`).
- **Panel:** React 19, TanStack Query, klien oRPC (`RPCLink`) dengan header Bearer seperti `apps/mobile/src/api/client.ts`, HeroUI dari `@rezumi/ui`, Tailwind v4 dengan `globals.css` yang sama.
- **Bahasa:** Lingui (`apps/extension/locales/{en,id}.po`), `pnpm lingui:extract` mencakup plugin; nama dan deskripsi toko di `public/_locales/{en,id}/messages.json` (`__MSG_…__` di manifest).

## 9. Penanda "sudah disimpan"

- Service worker memanggil `applications.savedKeys` saat terhubung, setelah setiap simpan/ubah status/hapus, saat panel dibuka (bila data > 5 menit), dan lewat alarm tiap 30 menit. Hasil disimpan di `chrome.storage.local` dan dihapus saat keluar.
- Content script menghitung kunci dari URL, bertanya ke service worker, lalu menggambar chip. Service worker memasang badge per tab. **Tidak ada permintaan jaringan per halaman** dan alamat halaman tidak meninggalkan browser.

## 10. Kecocokan dan AI

- **Skor istilah** (gratis): `matchResume` dengan CV pilihan dan teks deskripsi; dihitung ulang (debounce ±500 ms) saat CV atau deskripsi berubah. CV bawaan: aturan turunan #11.
- **Baca dengan AI:** `readCapture` dengan `aiSource`. Tanpa AI tersedia: kolom dari data halaman + peringatan seperti `enrichmentWarning` di web.
- **Skor AI:** `applications.ai.matchScore` setelah tersimpan.
- **Sesuaikan CV / surat lamaran:** buka tab web `/dashboard/applications/<id>/<tab>` dengan tab yang tepat (cek tab mana yang memuat Sesuaikan CV dan surat lamaran di Phase 05). Alur AI berat tetap di web.
- **Kredit:** saldo dan paket dari `billing.summary`; saat billing mati, angka kredit disembunyikan. Galat kredit/paket → 3.7.
- Hasil Phase 05: §21 (`resume.matchTerms`, pilihan AI seperti web, persiapan lewat `?prepare=resume`).

## 11. Pengingat

- Disimpan sebagai `followUpAt` + `followUpNote` lamaran yang sudah ada. Usulan tanggal dari `validThrough` (aturan turunan #6).
- Panel beranda memakai `dueFollowUps` (atau filter `applications.list`).
- Alarm tiap 60 menit: perbarui angka badge; bila notifikasi dinyalakan (`optional_permissions: ["notifications"]`), kirim notifikasi sesuai aturan turunan #7. Catatan notifikasi yang sudah terkirim disimpan lokal per tanggal.
- Hasil Phase 05: §21 (`applications.dueFollowUps`, alarm 09.00, badge angka).

## 12. Izin dan keamanan

| Izin                                                                                                            | Untuk                                             | Catatan                                                                                          |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `sidePanel`                                                                                                     | Panel samping                                     |                                                                                                  |
| `storage`                                                                                                       | Token, cache kunci, isian                         |                                                                                                  |
| `identity`                                                                                                      | Login OAuth                                       |                                                                                                  |
| `activeTab`, `scripting`                                                                                        | Membaca halaman situs lain saat pengguna mengklik | Tanpa izin host luas                                                                             |
| `contextMenus`                                                                                                  | Menu klik kanan teks terpilih                     |                                                                                                  |
| `alarms`                                                                                                        | Sinkron kunci dan pengingat                       |                                                                                                  |
| `notifications` (opsional)                                                                                      | Pengingat desktop                                 | Diminta saat pengguna menyalakan                                                                 |
| Host: `https://*.linkedin.com/*`, `https://*.indeed.com/*`, `https://*.jobstreet.com/*`, `https://glints.com/*` | Tombol, penanda, dan pembaca di empat situs       | Final Phase 03 (§18): LinkedIn `*.` untuk halaman tanpa login di host negara (`id.linkedin.com`) |
| Host: `https://rezumi.app/*` (dev: `http://localhost:3000/*`)                                                   | Memanggil API tanpa CORS                          |                                                                                                  |

- CSP bawaan MV3: tanpa kode jarak jauh, tanpa `eval`.
- Token hanya di service worker/panel. Content script dan halaman situs tidak bisa membacanya.
- Teks alasan setiap izin untuk formulir toko ditulis di Phase 06.

## 13. Bahasa

Inggris (sumber) dan Indonesia saat rilis (aturan turunan #9). Bahasa plugin mengikuti pengaturan plugin, lalu bahasa browser, lalu Inggris.

## 14. Tes

- **Unit `@rezumi/job-sites`:** semua pola URL di 7.4 (termasuk variasi negara dan parameter), JSON-LD (berbagai bentuk `hiringOrganization`, `jobLocation`, `baseSalary`, `validThrough`), skema capture.
- **Unit adaptor** dengan fixtures (Vitest + `happy-dom`).
- **API:** `readCapture` (dengan/tanpa JSON-LD, tanpa AI, AI tiruan), `savedKeys` (hanya milik pengguna), `source_key` di create/update/import, gerbang paket plugin vs pihak ketiga, `EXTENSION_MIN_VERSION`, `reportCapture` (batas laju, isi email). Suite basis data nyata mengikuti pola tes applications yang ada.
- **Playwright** (`apps/extension/tests`, konfigurasi sendiri): `chromium.launchPersistentContext` dengan `--disable-extensions-except` dan `--load-extension`; halaman situs loker dilayani dari fixtures lewat `context.route` pada hostname asli; API ke server lokal. Login di tes boleh lewat helper yang menjalankan alur OAuth secara terprogram.
- **Manual pemilik** di Chrome dan Edge sungguhan (Phase 07, `checklist-rilis.md`).

## 15. Rilis dan toko

- Versi plugin semver sendiri di `apps/extension/package.json` → manifest. Toko tidak menerima versi turun: rollback = unggah versi lama dengan nomor lebih tinggi.
- Zip dibuat dengan skrip `zip`; pemilik mengunggah sendiri di rilis pertama (otomatisasi lewat Chrome Web Store API ada di backlog B7).
- **Chrome Web Store:** akun pengembang (US$5 sekali), item, listing Inggris/Indonesia, formulir praktik privasi (jenis data: konten situs saat disimpan, informasi autentikasi), URL Kebijakan Privasi, penjelasan satu tujuan, alasan per izin, tangkapan layar.
- **Edge Add-ons:** Partner Center (gratis), zip yang sama, listing sendiri.
- Review bisa beberapa hari sampai ±2 minggu; izin host membuat review lebih teliti.
- **ID item** (diisi setelah pemilik mengunggah draf di akhir Phase 01):
  - Chrome Web Store: `fiogmglhgeiaaeajahbpmmehgmojbjjo` (draf diunggah pemilik 2026-11-12; isian toko di `materi-toko/chrome-web-store.md`)
  - Edge Add-ons: CRX ID `jnemleffcmnbkcmmjnkbicdhidedffnd` (Store ID `0RDCKG7TD477`, Product ID `1c977fab-c810-43c6-8dd8-ac733e7a3bac`; draf diunggah 2026-11-12, paket terverifikasi, visibilitas Public, 241 pasar). Redirect OAuth Edge: `https://jnemleffcmnbkcmmjnkbicdhidedffnd.chromiumapp.org/`; Chrome: `https://fiogmglhgeiaaeajahbpmmehgmojbjjo.chromiumapp.org/` (keduanya masuk `firstPartyRedirectUris` di Phase 02)
  - Public key Chrome (untuk `key` manifest dev): terpasang di `CHROME_STORE_PUBLIC_KEY` (`apps/extension/manifest.config.ts`) 2026-11-12; build dev hasil "Load unpacked" ber-ID `fiogmglhgeiaaeajahbpmmehgmojbjjo`, sama dengan toko (dicek tes Playwright)
- Zip: `pnpm --filter extension zip` → `apps/extension/release/rezumi-extension-<versi>.zip` (build produksi, tanpa `key`; skrip menolak `dist/` hasil build dev).
- Setelah tayang: URL toko diisi di konstanta ajakan pasang di web (Phase 06/07), `chrome.runtime.setUninstallURL` ke halaman aturan turunan #10.

## 16. Catatan implementasi Phase 01 (2026-11-12)

- **`@rezumi/job-sites`** (`packages/job-sites`, `runtime:universal`, `role:domain`), tiga ekspor terpisah supaya content script tidak ikut membawa Zod:
  - `./sites`: `JOB_SITES`, `detectSite`, `canonicalJobUrl`, `jobKey` (tanpa DOM, tanpa Zod). Pola URL di 7.4 dipakai apa adanya plus LinkedIn `/jobs/view/<judul>-at-<perusahaan>-<id>/`, Indeed `/m/viewjob`, Glints dengan segmen bahasa (`/id/en/opportunities/…`). Masih pola dari pengetahuan umum: **verifikasi di Phase 03**.
  - `./json-ld`: `jobPostingsIn` (HTML), `jobPostingsInJson` (blok JSON-LD yang sudah di-parse, untuk plugin), `toPagePosting`, `readJobPosting`; `htmlToText` disuntikkan. `packages/api/src/features/applications/posting.ts` memakainya; perilaku dan tes lamanya tidak berubah. Tes baru menjaga `MAX_POSTING_CHARS` = `MAX_CAPTURE_TEXT_CHARS` (20.000).
  - `./capture`: skema Zod `capturedPostingSchema` (7.5) dengan batas panjang per kolom, `site` = salah satu dari empat situs atau `null`.
- **Kunci situs lain menyertakan query** (tanpa parameter pelacak, diurutkan): `url:acme.example/careers?gh_jid=42`. Tanpa ini dua loker berbeda di satu halaman karier akan dianggap sama dan ditandai "sudah disimpan" keliru.
- **`apps/extension`**: `app:extension` + `runtime:browser`; aturan Turbo `app:extension` menolak `app:server`, `app:web`, `app:mobile`, `runtime:server`, `runtime:native`; lint menolak impor nilai dari `@rezumi/api` (tipe boleh, seperti mobile). Pesan antarbagian: `src/shared/messages.ts` (Zod), router `src/background/router.ts` memeriksa `sender.id`, frame atas untuk content script, dan origin halaman ekstensi untuk panel. Content script melapor `{ type: "page", url, site, key }`; service worker menyimpannya di `chrome.storage.session` (`tabPage:<tabId>`), dihapus saat tab ditutup. Alarm `sync-saved-keys` (30 menit) dan `follow-ups` (60 menit) sudah terdaftar, isinya menyusul Phase 04/05.
- **Bahasa panel:** `chrome.i18n.getUILanguage()` berawalan `id`/`in` → Indonesia, selain itu Inggris (pengaturan plugin menyusul Phase 04). Katalog `apps/extension/locales/{en,id}.po`; `pnpm lingui:extract` di root kini juga mengekstrak plugin.
- **Ukuran:** content script produksi ±3 KB (anggaran 50 KB dicek build dan `src/content/size.test.ts`). CSS panel ±1 MB karena `@rezumi/ui/globals.css` memindai kelas Tailwind dari semua app; cukup untuk halaman lokal, dipangkas bila panel terasa lambat.
- **Playwright:** `apps/extension/playwright.config.ts`, Chromium bawaan Playwright (Chrome/Edge bermerek tidak lagi memuat ekstensi lewat `--load-extension`). Fixtures sintetis di `src/content/sites/__fixtures__`. Belum masuk CI (perlu `playwright install chromium`); tes unit ikut CI lewat `test:ci`.
- **Ikon:** PNG 16/32/48/128 dibuat dari `apps/web/public/pwa-512x512.png` dengan sudut membulat; 128 px memakai bantalan transparan 16 px sesuai panduan Chrome Web Store.

## 17. Catatan implementasi Phase 02 (2026-11-14)

- **Login** (`apps/extension/src/background/auth.ts`, `createAuth` dengan dependensi yang disuntikkan supaya teruji tanpa browser): discovery → registrasi dinamis sekali (`client_name` "Rezumi browser extension", `application_type: "web"`, scope tanpa `api:delete`) → PKCE S256 + `state` + `resource` → `chrome.identity.launchWebAuthFlow` → tukar code. Cek `state`, `iss` (RFC 9207), dan semua endpoint harus di origin server. Access token di `chrome.storage.session` (`auth:access`), refresh token, client, akun, dan alasan terputus di `chrome.storage.local` (`auth:refresh`, `auth:client`, `auth:account`, `auth:state`). Refresh satu jalur (single-flight), 60 detik sebelum kedaluwarsa atau setelah 401; refresh ditolak → `expired` (panel 3.7 "Hubungkan lagi"); gagal jaringan → token tetap. Keluar = cabut refresh token (maks 5 detik) lalu hapus token; `client_id` disimpan.
- **Nama dan email** dari OpenID userinfo (`<issuer>/oauth2/userinfo`): ID token Better Auth 1.7.12 tidak memuat `name`/`email`.
- **Panel** memanggil API langsung (`src/sidepanel/api.ts`, `RPCLink` ke `/api/rpc`), meminta token ke service worker lewat pesan `token` (`force` setelah 401), `credentials: "omit"`, header `x-rezumi-extension` dan `x-client-timezone`. 401 kedua → pesan `expire`. Pesan panel baru: `connect`, `disconnect`, `token`, `expire`; `status` kini `{ state, account, version }`. Panel mengikuti `chrome.storage.onChanged` (kunci `auth:*`) sehingga keluar/putus di jendela lain langsung terlihat.
- **Router pesan:** halaman ekstensi dikenali dari alamatnya (`chrome-extension://<id>/`) **sebelum** memeriksa `sender.tab`, karena panel yang dibuka sebagai tab (tes Playwright, atau pengguna) juga membawa `tab`.
- **Layar:** terhubung = beranda kosong 3.2 ("Buka halaman lowongan…", tombol "Buka pelacak lamaran") + Pengaturan 3.8 (akun: nama, email, paket dari `billing.summary`; paket disembunyikan saat billing mati; Keluar; versi). Galat 3.7 di `panel-error.tsx` (offline, `EXTENSION_OUTDATED` + "Cek pembaruan" lewat `chrome.runtime.requestUpdateCheck`, batas laju, server bermasalah). Pengaturan bahasa, CV bawaan, tombol di halaman, notifikasi menyusul Phase 04–05.
- **Aplikasi resmi:** `EXTENSION_IDS` + `https://<id>.chromiumapp.org/` di `firstPartyRedirectUris`. Client dengan alamat ekstensi lain tetap butuh `automationApi` (tes integrasi).
- **Server:**
  - `postingSourceSchema.method` + `"extension"`; web menampilkan "Disimpan dari plugin" di dialog deskripsi lamaran; mobile tetap terkompilasi (menampilkan teks "Retrieved … using extension" seperti metode lain).
  - `application.source_key` + indeks `(user_id, source_key)`, migrasi `20261114012829_loving_toad`. Diisi `sourceKeyFor()` di `create`/`update`/`importMany` hanya bila permintaan membawa `sourceUrl` (null mengosongkan). Kolom **disembunyikan** dari DTO publik (`applicationSchema.omit({ sourceKey })`), jadi REST/MCP/ekspor tidak berubah.
  - Prosedur `applications.savedKeys` (GET), `readCapture`, `reportCapture` di `features/applications/extension.ts`, tag `Internal`. `readCapture` memakai `fillPostingFields()` yang diekstrak dari `parsePosting` (satu jalur AI); urutan isi: blok teks terpilih → deskripsi JSON-LD → teks halaman; kolom: adaptor → JSON-LD → AI. `sourceUrl` = URL kanonik yang dihitung ulang server. `existing` = lamaran terbaru dengan kunci sama milik pengguna.
  - **Laporan halaman:** tabel `extension_capture_report` (alamat, situs, versi, kolom gagal; tanpa isi halaman), batas 10/jam/pengguna dihitung dari tabel (tanpa Redis). Job `runExtensionJobs` (`features/applications/extension-jobs.ts`, Workers cron + penjadwal Node) mengirim ringkasan ke `BILLING_ALERT_EMAIL` paling sering sekali per jam lewat `deliverBillingNotice`, dan menghapus laporan > 30 hari. Laporan ikut ekspor data akun (`extension-page-reports.json`). Isi email mengikuti usulan aturan turunan #8 sampai dikonfirmasi di Phase 03.
  - **Rem versi:** `EXTENSION_MIN_VERSION` (x.y.z, opsional; `packages/env`, `.env.example`, `turbo.json`) diperiksa di `publicProcedure` sebelum autentikasi (`packages/api/src/extension-version.ts`); hanya permintaan dengan header `x-rezumi-extension` yang bisa ditolak (`EXTENSION_OUTDATED`, HTTP 426).
- **Backfill:** `pnpm --filter @rezumi/tooling extension:backfill-keys [--dry-run]` (`tooling/extension/backfill-source-keys.ts`), memakai `jobKey()` yang sama, bisa diulang, mencetak jumlah saja. Diuji unit dan sekali di DB lokal; **belum dijalankan di produksi** (Phase 07, dengan izin pemilik, setelah migrasi).
- **Tes:** API DB nyata `extension.integration.test.ts` (13 tes, env baru `APPLICATIONS_TEST_DATABASE_URL`, didaftarkan di `packages/api/turbo.json` dan `ci.yml`); gerbang paket plugin di `limits.integration.test.ts`; unit login plugin `auth.test.ts`; Playwright `tests/connect.spec.ts` (daftar akun fiktif → Hubungkan → izinkan → akun + paket Gratis dengan `BILLING_MODE=on` → Keluar; cabut di Pengaturan Rezumi → "Sambungan berakhir"; jendela ditutup → tidak berubah; tangkapan layar 360/420, terang/gelap, en/id). Spesifikasi ini butuh server lokal di `http://localhost:3000` (dilewati bila tidak ada); dijalankan dengan launch config `rezumi-extension` (DB `rezumi_extension_dev`, `BILLING_MODE=on`).
- **Edge (belum terverifikasi otomatis):** muat `apps/extension/dist` lewat `edge://extensions` → Load unpacked; build dev membawa `key` Chrome, jadi ID-nya `fiogmglhgeiaaeajahbpmmehgmojbjjo` (alamat balik yang sama sudah resmi). ID Edge toko (`jnemleff…`) baru berlaku setelah dipasang dari Edge Add-ons; alamatnya sudah ada di `firstPartyRedirectUris`.

## 18. Catatan implementasi Phase 03 (2026-11-14)

**Halaman nyata yang diperiksa** (hanya membaca struktur, tanpa menyalin teks lowongan; LinkedIn lewat Chrome pemilik dengan izinnya, Indeed lewat Chrome pemilik karena browser bawaan diblokir pemeriksaan bot; sisanya browser bawaan):

| Situs     | Halaman                                                  | Penanda yang dipakai                                                                                                                                                                                                                                                                                                                                                             | JSON-LD `JobPosting`                   |
| --------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| LinkedIn  | `/jobs/view/<id>/`, `/jobs/search-results/?currentJobId` | Antarmuka baru (login) berkelas acak. Stabil: judul tab `<posisi> \| <perusahaan> \| LinkedIn` (ikut lowongan terpilih), `aria-label="Company, <nama>."`, `componentkey="JobDetails_AboutTheJob_<id>"` (deskripsi + judul "About the job"), baris di bawah posisi `<lokasi> · <waktu> · <pelamar>`, tombol `aria-label="Save the job"`. Tanpa login: dinding login (`/authwall`) | Tidak ada                              |
| Indeed    | `/jobs?…&vjk=<jk>` (daftar + detail)                     | `data-testid`: `viewjob-main-content`, `vj-job-title` (+ teks tersembunyi " - job post"), `company-info-metadata` (tautan perusahaan, lalu lokasi), `structured-job-summary` (baris gaji/jenis/lokasi tanpa label, "Pay information not provided" bila kosong), `vj-job-description-heading`, `job-header-actions`. Gaji bisa "Rp. 6.000.000 …"                                  | Tidak ada di panel detail              |
| JobStreet | `/id/job/<id>`, `/id/<kata>-jobs/in-<kota>?jobId=<id>`   | `data-automation`: `job-detail-title`, `advertiser-name`, `job-detail-location`, `job-detail-salary`, `job-detail-work-type`, `jobAdDetails`, `job-detail-apply` (tautan `/id/job/<id>/apply`). Kartu daftar: `normalJob` + `data-job-id`. Antarmuka `id` dan `en` sama                                                                                                          | Tidak ada (hanya `WebSite`)            |
| Glints    | `/id/opportunities/jobs/<slug>/<uuid>`                   | Kelas styled-components dengan awalan stabil: `JobOverViewTitle`, `JobOverViewCompanyName`, `SalaryJobOverview`, `JobDescriptionsc__DescriptionContainer`, `TopFold…ButtonContainer`. Halaman pencarian (`/explore`) pindah ke halaman detail, tanpa panel samping                                                                                                               | Lengkap (lokasi, gaji, `validThrough`) |

**Situs lain (pembaca umum):** Dealls (`dealls.com/loker/<slug>~<perusahaan>`) punya JSON-LD lengkap (posisi, perusahaan, lokasi, gaji, deskripsi; tanpa `validThrough`); Kalibrr (`kalibrr.id/id-ID/c/<perusahaan>/jobs/<id>/…`) dan papan Greenhouse baru (`job-boards.greenhouse.io/<perusahaan>/jobs/<id>`) tanpa JSON-LD, teks `main` terbaca utuh (±9.000 dan ±13.000 karakter, termasuk deskripsi).

**Hasil baca di halaman nyata** (pembaca yang sama dengan `content.js`, dijalankan di halaman; ✓ terisi, — situs tidak menampilkannya pada lowongan yang diperiksa):

| Situs / halaman            | Posisi | Perusahaan | Lokasi | Gaji | Jenis | Deskripsi | Batas waktu |
| -------------------------- | ------ | ---------- | ------ | ---- | ----- | --------- | ----------- |
| LinkedIn daftar + detail   | ✓      | ✓          | ✓      | —    | —     | ✓         | —           |
| LinkedIn detail            | ✓      | ✓          | ✓      | —    | —     | ✓         | —           |
| Indeed daftar + detail     | ✓      | ✓          | ✓      | ✓    | ✓     | ✓         | —           |
| JobStreet daftar + detail  | ✓      | ✓          | ✓      | ✓    | ✓     | ✓         | —           |
| Glints detail              | ✓      | ✓          | ✓¹     | ✓    | —²    | ✓         | ✓¹          |
| Dealls (umum)              | ✓¹     | ✓¹         | ✓¹     | —²   | —     | ✓¹        | —           |
| Kalibrr, Greenhouse (umum) | —³     | —³         | —³     | —    | —     | ✓         | —           |

¹ dari JSON-LD. ² JSON-LD Dealls dan Glints memuat `baseSalary`/`employmentType`, tetapi `toPagePosting` belum membaca gaji dan jenis (backlog kecil; Glints menampilkan gaji di halaman, jadi kolom itu tetap terisi dari adaptor). ³ diisi AI saat menyimpan (Phase 04) atau oleh pengguna. Halaman detail Indeed (`/viewjob`) dialihkan ke halaman masuk oleh pemeriksaan bot saat diperiksa; komponennya sama dengan panel detail, dan tata letak lamanya (`#jobDescriptionText`) tetap jadi cadangan.

**Implementasi:**

- `src/content/sites/{linkedin,indeed,jobstreet,glints}.ts` mengikuti kontrak 7.1 (`read` + `anchor`; `matches`/`jobKey` dari `@rezumi/job-sites/sites`). Kolom dipotong ke batas `capturedFieldsSchema` (`compact`). LinkedIn mengutamakan judul tab: tautan "On-site" juga menunjuk `/jobs/view/<id>` dan teks iklan Premium menyebut harga, jadi gaji hanya dibaca dari baris pendek yang **diawali** mata uang dan berada di atas deskripsi.
- `src/content/read.ts` (`readPage`): adaptor → blok JSON-LD yang menyebut `JobPosting` (maks 5 × 50.000 karakter, mentah) → teks `main`/`article` terpanjang/`body` tanpa `nav`, `header`, `footer`, `aside`, `form`, `dialog`; teks terpilih ikut sebagai `selection`. Teks dirapikan (`text.ts`: baris per blok, `• ` untuk butir daftar, spasi dan baris kosong diringkas), dipotong ke 20.000. Batas ukuran pindah ke `@rezumi/job-sites/limits` (tanpa Zod) supaya content script tetap tanpa Zod; `content.js` produksi ±10 KB.
- **Alur baca:** panel → `chrome.tabs.sendMessage(tabId, { type: "read" })` → content script menjawab `PageReading`; panel memvalidasi dengan `pageReadingSchema` (Zod, batas sama dengan server). Di situs lain content script disuntik sekali lewat `chrome.scripting.executeScript` (izin `activeTab` setelah pengguna membuka panel); halaman browser dan tab tanpa izin → beranda biasa. Panel membaca ulang saat dibuka, ganti tab, tab selesai dimuat, dan 600 ms setelah content script melapor kunci baru (SPA).
- **Panel:** `page-screen.tsx`: kartu pratinjau (posisi, perusahaan, lokasi, gaji, jenis, batas waktu; belum bisa diubah/disimpan, Phase 04), 3.6 "Pilih satu lowongan" di halaman pencarian tanpa pilihan, 3.5 "Kami tidak menemukan lowongan" untuk halaman tanpa teks. Halaman dengan teks tanpa JSON-LD tetap ditampilkan sebagai pratinjau (banyak halaman karier begitu). Penggabungan kolom (`reading.ts`) mengikuti server: adaptor → JSON-LD; deskripsi: teks terpilih → JSON-LD → teks halaman.
- **Laporan halaman (aturan turunan #8, dikonfirmasi 2026-11-14):** tombol "Laporkan halaman ini" muncul bila kolom posisi/perusahaan/lokasi/deskripsi kosong; memanggil `applications.reportCapture` dengan alamat, situs, versi, dan kolom kosong. Diuji ujung ke ujung: baris masuk `extension_capture_report`, ringkasan `sendCaptureReportDigest` tercatat di log (SMTP mati). "Pakai teks yang saya blok" dan "Tempel deskripsi" (3.5) menyusul di Phase 04 bersama form simpan.
- **Debug (build dev saja):** daftar setiap kolom + sumbernya (`site`/`json-ld`/`page`/`selection`), kunci, jumlah blok JSON-LD, dan kolom kosong di bawah panel; `sidepanel.html?tab=<id>&reading` menampilkan bacaan tanpa akun (tes), `&clean` menyembunyikan daftar debug.
- **Tes:** unit `read.test.ts` (24, fixtures sintetis per situs × keadaan di `__fixtures__/<situs>/`), `reading.test.ts` (5), `sites.test.ts` + pola LinkedIn baru; Playwright `reading.spec.ts` (6, tanpa server: empat situs di hostname asli, perpindahan SPA, lowongan kedaluwarsa) dan `reading-connected.spec.ts` (2, server lokal: pratinjau 360/420 terang/gelap en/id, kirim laporan).

## 19. Tambahan rilis pertama (keputusan 2026-11-14, dikerjakan di Phase 04)

### 19.1 Gaji dan jenis kerja dari JSON-LD

`toPagePosting` (`@rezumi/job-sites/json-ld`) menambah `salary` (dari `baseSalary`: mata uang + min–maks + satuan, mis. "IDR 15.000.000 – 20.000.000 / bulan") dan `employmentType` (`FULL_TIME` → "Full-time", dst.). Dipakai `readCapture` dan panel setelah kolom adaptor; `parsePosting` di web ikut terisi. Glints dan Dealls memuatnya (§18).

### 19.2 Usulan kontak dari deskripsi

- Sumber hanya teks deskripsi lowongan: email (`hr@…`) dan nomor telepon/WhatsApp (`08…`, `+62…`, `wa.me/62…`), paling banyak 5, tanpa duplikat. Tidak membaca profil orang (tim perekrut LinkedIn tetap backlog B9).
- Diusulkan di form simpan sebagai kotak centang yang **bawaan tidak dicentang**; yang dicentang masuk `application.contacts` (`contactSchema`: `name` wajib → nama perusahaan atau "HR", `type` "Recruiter", `email`/`phone`).
- Fungsi murni di `@rezumi/job-sites` (dipakai panel; server bisa memakainya nanti), dengan tes yang menjaga angka gaji/tanggal tidak tertangkap sebagai nomor.

### 19.3 Lowongan serupa lintas situs

- Prosedur internal baru (mis. `applications.similar`, tag `Internal`) atau bagian dari `readCapture`: lamaran milik pengguna dengan posisi + perusahaan yang cocok setelah dinormalkan (huruf kecil, tanpa tanda baca, tanpa "PT"/"Tbk"/"Inc"), kunci loker berbeda, maksimal 3 terbaru.
- Hanya dihitung saat pengguna membuka/menyimpan lowongan (bukan per halaman yang dikunjungi), jadi aturan privasi §9 tetap terjaga. Panel memberi peringatan dengan tautan ke lamaran itu; simpan tidak diblokir.

### 19.4 Logo perusahaan

- Sumber alamat: adaptor (`anchor`-tetangga: logo di kartu atas tiap situs) atau `hiringOrganization.logo` JSON-LD; dikirim di `fields.companyLogoUrl` (skema capture + batas panjang).
- Server mengunduh dengan pengambil web yang aman yang sudah ada (cek `packages/api/src/features/web-access`: tolak alamat privat, ikuti batas redirect), hanya `image/png|jpeg|webp|svg+xml` (SVG disanitasi atau ditolak), ≤ 200 KB, lalu menyimpan di penyimpanan (R2 di produksi) dengan kunci per pengguna. Kegagalan unduh tidak menggagalkan simpan.
- Kolom baru di `application` (mis. `company_logo_key`) + migrasi aditif; DTO menampilkan alamat logo yang aman untuk web; ikut ekspor data dan penghapusan akun. Web menampilkan logo di daftar dan detail lamaran (cadangan: inisial perusahaan). Mobile hanya dijaga terkompilasi.
- Alasan tidak menautkan langsung: alamat CDN situs loker (terutama LinkedIn) kedaluwarsa dan bisa diblokir saat ditampilkan dari situs lain, dan menautkannya membocorkan kunjungan pengguna ke situs itu.

## 20. Catatan implementasi Phase 04 (2026-11-15)

Aturan turunan #2–#5 dikonfirmasi pemilik 2026-11-15 (usulan apa adanya, `00-keputusan.md`).

**Penanda tersimpan (§9).** `src/background/saved.ts` (murni, teruji): `toSavedKeys`, `lookupSaved`, `withSaved`, `pageState`. Salinan kunci di `chrome.storage.local` `saved:keys` = `{ origin, syncedAt, keys: { <kunci>: { id, status } } }` (kunci yang sama disimpan dua kali → lamaran terbaru). Service worker mengambil `savedKeys` lewat klien oRPC sendiri (`src/background/api.ts`, Bearer, 401 → refresh sekali → `expire`) saat terhubung, setelah pesan panel `saved`, saat panel dibuka bila salinan > 5 menit (`status`), dan alarm 30 menit; dihapus saat Keluar. Setiap perubahan `saved:keys`, `settings`, atau sambungan memicu `refreshAllTabs`: badge ✓ hijau + judul ikon per tab, dan pesan `state` ke content script tab yang punya halaman situs. Content script **tidak** membaca storage (token ada di `local`); ia hanya menerima `PageState` dari service worker sebagai jawaban `page` dan lewat pesan `state`.

**Tombol di halaman (`01-desain.md` §4).** `src/content/button.ts`: elemen `<rezumi-save-button>` dengan Shadow DOM **tertutup**, gaya sebaris, ikon SVG dibuat lewat `createElementNS` (tanpa `innerHTML`, karena beberapa situs memakai Trusted Types). Disisipkan di `anchor()` adaptor (ditunggu ±4 detik dengan `MutationObserver` untuk situs SPA), kalau tidak ada → melayang di pojok kanan bawah dengan tombol × (disembunyikan per situs: `settings.floatingHidden`). Label: "Simpan ke Rezumi" / "Tersimpan" / "Tersimpan · Dilamar" (en: "Saved · Applied"); bahasa dari pengaturan plugin. Klik → pesan `open-panel` → `sidePanel.open` (§8). Tampil juga sebelum masuk (aturan #5, klik membuka panel "Hubungkan ke Rezumi"); mati lewat Pengaturan → "Tombol di situs loker". Build dev saja: `data-rezumi-state` (label) dan `data-rezumi-hint` di elemen host untuk tes; build toko tidak memberi tahu halaman apa pun tentang lamaran.

**Panel.** `posting-screen.tsx`:

- `readCapture` dipanggil sekali per lowongan yang dibuka di panel (bukan per halaman dikunjungi) dengan `useAi` = saklar "Baca dengan AI" (aturan #3, disimpan di `settings.readWithAi`). Masukan baru `useAi: false` → server melewati AI sama sekali (`fillPostingFields({ skipAi })`), termasuk koneksi AI sendiri. Menyala → `aiSource: "rezumi"` (1 kredit); pilihan sumber AI dan saldo dirapikan di Phase 05.
- Form (`draft.ts`, murni, teruji): posisi*, perusahaan*, lokasi, gaji, jenis kerja, deskripsi (terlipat), status bersegmen Disimpan / Sudah dilamar (+ tanggal, bawaan hari ini; aturan #2), CV (`resume.list`), tag (`applications.tags` + tag baru), kontak usulan (kotak centang, bawaan kosong), saklar AI. Kolom dari server/AI hanya mengisi kolom yang belum diubah pengguna. Draf per tab di `chrome.storage.session` `draft:<tabId>` (dihapus setelah simpan atau saat tab ditutup).
- Simpan = `applications.create` (`postingSource` dari `readCapture`, `sourceUrl` kanonik, `source` = nama situs atau host, jenis kerja digabung ke lokasi "Jakarta · Full-time" karena pelacak tidak punya kolom jenis kerja, `stageEnteredAt` = tanggal melamar). Lalu pesan `saved` ke service worker (tanda langsung berubah), `saveLogo` bila ada logo, invalidasi kueri.
- Sudah tersimpan (aturan #4): dari salinan lokal `saved:keys` atau `readCapture.existing` → layar tersimpan: "Tersimpan di Rezumi · <hari>", status (6 tahap, langsung `update` + pesan `saved`), Buka di Rezumi, Tambah catatan (`addNote`), tautan kecil "Simpan sebagai lamaran baru". Lamaran yang sudah dihapus di web → "Lamaran ini sudah tidak ada di Rezumi" + Simpan.
- Galat 3.7 (`errors.ts` → `save-error.tsx`): offline (cek `navigator.onLine` sebelum kirim + `TypeError`), sesi berakhir (Hubungkan lagi), batas laju, kredit/paket (Lihat paket · Simpan tanpa AI), plugin terlalu lama, isian ditolak, server. Permintaan dibatasi 45 detik supaya "Menyimpan…" tidak menggantung.
- Beranda (`home-screen.tsx`): 5 lamaran terbaru (`listSummary({ limit: 5 })`) + Buka pelacak lamaran. 3.5: "Tempel deskripsi" (teks tempelan dipakai seperti teks terpilih) + petunjuk menu klik kanan.
- Pengaturan: bahasa (ikuti browser / English / Bahasa Indonesia, berlaku langsung di panel dan tombol), tombol di situs loker, pintasan keyboard (tautan halaman pintasan browser), Keluar.

**Menu klik kanan dan pintasan.** Menu `save-selection` (konteks `selection`) dibuat saat pasang/mulai; klik → `sidePanel.open` dulu (masih dalam gestur), lalu teks + `pageUrl` disimpan di `tabSelection:<tabId>` (session). Panel memakai teks itu hanya untuk halaman yang sama; bila halaman tidak bisa dibaca (tanpa akses `activeTab`), teks itu sendiri dipakai sebagai bacaan dengan alamat dari klik. Build dev: `globalThis.rezumiContextMenu` untuk tes. Pintasan `Alt+Shift+S` tetap `_execute_action`.

**Tambahan §19:**

- 19.1: `toPagePosting` kini mengisi `salary` (mata uang + rentang + satuan; rupiah dikelompokkan dengan titik, lainnya koma; satuan Inggris "/ month"), `employmentType` (kode schema.org → "Full-time", "Contract", …; teks lain apa adanya), `logoUrl` (`hiringOrganization.logo`, https saja). Tiga kolom ini opsional di tipe `PagePosting` supaya pemanggil lama tetap terkompilasi. `parsePosting` di web ikut mengisi gaji.
- 19.2: `@rezumi/job-sites/contacts` `suggestContacts()`: email (tanpa nama file gambar), nomor HP Indonesia (`08…`, `+62…`, `62…`), tautan `wa.me`/`api.whatsapp.com`, nomor lain hanya setelah kata "Telp/Phone/WA/HP/…"; dinormalkan ke `+62…`; uang (`Rp`, `IDR`, `$` tepat sebelum angka), tanggal, dan hitungan tidak tertangkap; maksimal 5. Disimpan sebagai `contacts` `{ name: perusahaan atau "HR", type: "Recruiter", email | phone }` hanya yang dicentang.
- 19.3: bagian dari `readCapture` (`similar`, maksimal 3): `applicationService.similar` membaca 2.000 lamaran terbaru milik pengguna dan mencocokkan `isSamePosting` (`@rezumi/job-sites/match`: huruf kecil, tanpa aksen/tanda baca, tanpa PT/Tbk/Inc/…); kunci sama → `existing`, bukan `similar`. Panel: peringatan dengan tautan ke lamaran itu (+ host situsnya), simpan tidak diblokir.
- 19.4: kolom `application.company_logo_url` (migrasi `20261115031428_productive_gorilla_man`), tampil di DTO lengkap dan ringkasan (REST/MCP mendapat kolom baru ini, bertambah saja). Prosedur Internal `applications.saveLogo({ id, logoUrl })` (batas laju unggah) memanggil `copyCompanyLogo` (`features/applications/logo.ts`): `fetchRemote` yang sama dengan portfolio/foto profil (alamat publik saja, setiap redirect dicek ulang, https, port bawaan, tanpa kredensial, 8 detik), ≤ 200 KB, jenis dari byte (PNG/JPEG/WebP; SVG ditolak), disimpan apa adanya lewat `uploadFile` (`uploads/<user>/pictures/<uuid>.<ext>`, publik beralamat acak seperti gambar lain). Gagal → `companyLogoUrl: null`, lamaran tidak berubah. Logo dihapus bersama lamaran (`delete`/`bulkDelete`) dan saat diganti. Web: `CompanyMark` (logo, cadangan inisial saat kosong atau gagal dimuat) di kartu papan, daftar, dan detail lamaran. Adaptor membaca logo dari kartu atas (`logoIn`: gambar https dengan alt berisi nama perusahaan atau "logo", plus penanda per situs); tidak pernah menebak dari alt "logo" saja, karena halaman juga memuat lowongan lain dengan logo perusahaannya. Bila kosong, lamaran tetap tersimpan dengan inisial.

**Izin:** tidak ada izin baru (`action.setBadge*`, `tabs.sendMessage`, `tabs.create` tidak butuh izin).

**Ukuran:** `content.js` produksi ±17 KB (anggaran 50 KB).

**Tes:** unit plugin 94 (baru: `saved.test.ts`, `button.test.ts`, `draft.test.ts`, `errors.test.ts`, pesan router baru, logo JobStreet di `read.test.ts`), job-sites 88 (baru `contacts.test.ts`, `match.test.ts`, gaji/jenis/logo JSON-LD), API: `logo.test.ts` (11: alamat privat/loopback/http/port/kredensial ditolak tanpa permintaan, SVG dan jenis palsu ditolak, batas ukuran, redirect ke alamat privat), `extension.integration.test.ts` +5 (gaji/jenis JSON-LD, `useAi: false` tanpa AI, lowongan serupa hanya milik sendiri dan bukan lowongan yang sama, logo tersimpan + tampil di ringkasan + terhapus bersama lamaran, logo gagal tidak mengubah lamaran, lamaran akun lain ditolak). Playwright `tests/save.spec.ts` (5, server lokal): tombol di empat situs → klik sungguhan membuka panel → ubah posisi → simpan (< 3 detik, dicetak di log) → chip "Saved" → lamaran ada di REST dengan `postingSource.method = "extension"` dan `sourceUrl` kanonik → buka lagi tetap "Saved" + layar tersimpan → ubah status → chip "Saved · Interview" → catatan; lowongan serupa dari JobStreet saat membuka LinkedIn, kontak dicentang tersimpan (yang tidak dicentang tidak), "Sudah dilamar" + tanggal, koneksi putus → pesan offline, isian bertahan setelah panel dimuat ulang; menu klik kanan di situs lain; halaman lowongan yang tidak terbaca → Tempel deskripsi → simpan; tombol tampil sebelum masuk dan bisa dimatikan. `tests/screens.spec.ts` (2, hanya dengan `EXTENSION_SCREENSHOTS`): form, layar tersimpan, beranda 360/420 terang/gelap en/id, tombol dan chip di empat situs. Seluruh suite plugin: 29 lulus. Lowongan di situs papan yang tidak menampilkan posisi maupun deskripsi kini dianggap "tidak ada lowongan" (3.5: tempel/laporkan), bukan form kosong. Playwright `setOffline` tidak berlaku untuk halaman ekstensi, jadi tes memutus permintaan API dengan `route.abort`.

**Cek halaman nyata (2026-11-15, Chrome pemilik dengan izinnya, hanya membaca; kode pembaca dan tombol yang sama disuntik lewat konsol, tanpa mengklik apa pun di situs):**

| Situs                                | Kolom terbaca                                                                                                                                                                                                          | Logo                                                                                                                                                                                                                                                      | Tombol                                                                                                                                                                               |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| LinkedIn (login, pencarian + detail) | posisi, perusahaan, lokasi, deskripsi                                                                                                                                                                                  | ✓ dari kartu atas (`media.licdn.com`)                                                                                                                                                                                                                     | Awalnya menimpa tombol Save: tombol Save dibungkus grid yang menumpuk isinya. Diperbaiki: `buttonRow()` naik ke baris flex terdekat → sejajar "Easy Apply · Save · Simpan ke Rezumi" |
| Indeed (pencarian + detail)          | posisi, perusahaan, lokasi, deskripsi (cadangan judul deskripsi; `#jobDescriptionText` kosong)                                                                                                                         | lowongan yang dicek tanpa logo                                                                                                                                                                                                                            | `job-header-actions` sudah baris flex, tombol sejajar                                                                                                                                |
| JobStreet (pencarian + detail)       | posisi, perusahaan, lokasi, jenis kerja, deskripsi                                                                                                                                                                     | ✓ `[data-testid="bx-logo-image"] img` di kartu atas. Temuan: halaman detail juga memuat logo lowongan rekomendasi (`<jobId>-company-logo-container`), jadi tebakan alt "logo" dihapus (lowongan "Pengiklan Anonim" sempat mengambil logo perusahaan lain) | "Lamaran Cepat" dibungkus block; diperbaiki dengan `buttonRow()` → sejajar "Lamaran Cepat · Simpan · Simpan ke Rezumi"                                                               |
| Glints (detail, tanpa login)         | posisi, perusahaan, gaji, deskripsi; JSON-LD lengkap: `baseSalary` IDR min–max `MONTH` (bentuk sama dengan tes unit → "IDR 4.000.000 – 5.000.000 / month"), `employmentType` `CONTRACTOR` → "Contract", `validThrough` | ✓ `[class*="CompanyLogo"] img` di kartu atas + `hiringOrganization.logo` JSON-LD (lowongan lain di samping tidak ikut)                                                                                                                                    | `TopFold…ButtonContainer` sudah baris flex, tombol sejajar setelah "Lamar" dan ikon simpan/bagikan                                                                                   |

## 21. Catatan implementasi Phase 05 (2026-11-15)

Aturan turunan #6, #7, #11 dikonfirmasi pemilik 2026-11-15 (usulan apa adanya, `00-keputusan.md`).

**Server (hanya menambah).**

- `resume.matchTerms` = `matchResume` (REST `/resumes/{id}/job-matches`) lewat RPC, bertag `Internal`: REST dan spesifikasi OpenAPI tidak berubah. `checks.ts` memakai helper `literal()` alih-alih `RegExp.escape`, karena web dan plugin kini ikut membaca tipe file itu (lib ES2023), dengan hasil yang sama.
- `applications.dueFollowUps` (`Internal`, GET): lamaran milik pengguna yang `followUpAt` < tengah malam UTC hari esok di zona waktu `x-client-timezone` (`features/applications/follow-ups.ts` `dueBefore`; zona tak dikenal = UTC), bukan status `closed`, terdekat dulu, paling banyak 50 + `total`. Tanggal tindak lanjut adalah hari kalender: web menyimpan hari yang dipilih sebagai tengah malam UTC, plugin mengikutinya (`src/shared/follow-ups.ts`).
- Web: `/dashboard/applications/<id>?prepare=resume&from=<cv>` membuka dialog "Copy a resume for a job" untuk lamaran itu sekali, lalu parameter dihapus (`features/applications/extension-links.ts` + rute `$applicationId.{-$tab}.tsx`). Tidak ada teks baru.

**Kecocokan (§10, aturan #11).** `match.ts` (murni): CV = pilihan terakhir di perangkat (`settings.matchResumeId`) bila masih ada, else CV utama (`isPrimary`, yang dibuka alamat pendek), else CV terbaru. Bagian "Kecocokan" di form dan layar tersimpan: pemilih CV (diingat; juga di Pengaturan), `matchTerms` dengan deskripsi yang diam ±500 ms, persentase istilah, chip "Belum ada di CV-mu" dulu lalu "Ada di CV-mu", paling banyak 12, sisanya "+N". Catatan: mesin istilah belum mengenal bahasa Indonesia (backlog B14).

**AI.** `ai.ts` (murni) = aturan web `useAiSource`: saat billing menyala dan server punya AI, pilih Rezumi AI (kredit) atau koneksi sendiri (`settings.aiSource`, pemilih "Jalankan AI dengan" hanya bila keduanya ada); saat billing mati, angka kredit tidak tampil dan server memakai bawaannya. "Baca dengan AI" menampilkan biaya (1 kredit) dan saldo sebelum menyala, mati dengan alasan bila tidak ada AI; setiap kali dinyalakan = bacaan baru dengan `idempotencyKey` baru (galat kredit sebelumnya tidak tersimpan di cache). Galat kredit/paket → 3.7 "Kreditmu habis" + Lihat paket + Simpan tanpa AI. **Skor AI** di layar tersimpan: tombol "Skor AI (4 kredit)", menautkan CV kecocokan ke lamaran dulu bila belum ada CV, lalu `applications.ai.matchScore`; skor + kekuatan/kekurangan, juga skor tersimpan dari web (`aiMetadata.matchScore`).

**Persiapan.** Sesuaikan CV → tautan web di atas (`from` = CV lamaran, else CV kecocokan). Tulis surat lamaran → `coverLetters.create({ name, applicationId, resumeId })` seperti tombol "Write" di web, lalu tab `/builder/letter/<id>`; bila sudah ada → "Buka surat lamaran". Buka di Rezumi. Tab `WORKSPACE_TABS` tidak memuat alat CV/surat, jadi tidak dipakai.

**Pengingat (§11, aturan #6, #7).**

- Form simpan: "Tindak lanjut pada" + catatan; bawaan `defaultFollowUpDay(validThrough)` = 2 hari sebelum batas waktu (hari ini bila batasnya lebih dekat, kosong bila sudah lewat atau tidak tercantum), dengan petunjuk "Lowongan ditutup <tgl>." selama masih bawaan. Layar tersimpan: ubah/hapus pengingat. Beranda: "Jatuh tempo" (`dueFollowUps`, 10 teratas) dengan "Selesai" (mengosongkan pengingat).
- Service worker: `followUps:due` (local) dari `dueFollowUps` saat terhubung/mulai, setelah pesan panel `follow-ups` (simpan dengan pengingat, ubah, selesai), dan alarm `follow-ups` tiap 60 menit. Badge (`badge.ts`): ✓ hijau di tab lowongan tersimpan, selain itu angka merah jumlah jatuh tempo (global + per tab yang dikenal), judul ikon ikut.
- Notifikasi (aturan #7): bawaan mati; Pengaturan → "Pengingat desktop" meminta izin `notifications` (opsional, sudah di manifest sejak Phase 01) di dalam klik; dimatikan → izin dilepas. Alarm `follow-up-reminder` pada 09.00 berikutnya di perangkat (dijadwalkan ulang setiap kali berbunyi) + pengejaran tiap jam: `remindersToShow` hanya setelah 09.00, satu per lamaran per hari (`followUps:notified`, hanya entri hari ini). Teks: "Tindak lanjut hari ini" / "<posisi> di <perusahaan>" (+ catatan). Klik → lamaran di Rezumi. Izin dicabut di browser → `permissions.onRemoved` mematikan setelan, dan setiap kirim memeriksa `permissions.contains`. Semua dihapus saat Keluar.

**Izin:** tidak ada izin baru (`notifications` tetap opsional).

**Tes:** API `follow-ups.test.ts` (2), `match-terms.test.ts` (2), DB nyata `extension.integration.test.ts` +2 (hanya milik sendiri, bukan `closed`, terdekat dulu, batas + total, zona waktu); web `extension-links.test.ts` (2); plugin unit 119 (baru: `shared/follow-ups.test.ts` 9 — bawaan #6 dan frekuensi #7, `badge.test.ts` 3, `ai.test.ts` 5 — kredit saat billing mati/menyala, `match.test.ts` 6, draf pengingat, pesan `follow-ups`). Playwright `tests/prepare.spec.ts` (2, server lokal + stub AI `tests/ai-stub.ts`): pengingat bawaan dari batas waktu Glints, persentase berubah saat CV diganti dan pilihan diingat, simpan dengan pengingat hari ini → badge "1" (tab lowongan tetap ✓), notifikasi tidak muncul tanpa izin, "Sesuaikan CV" membuka dialog web yang benar, "Tulis surat lamaran" membuka editor surat, beranda Jatuh tempo → Selesai → badge kosong; akun Gratis 0 kredit → biaya tampil, server menolak, "Kreditmu habis" + Simpan tanpa AI; koneksi AI sendiri (stub) mengisi kolom dan Skor AI 72/100. Seluruh suite plugin 31 tes (29 + 2 screenshot). Dicek manual: Rezumi AI dengan kredit nyata di server lokal (stub sebagai AI server) memotong 1 kredit, kunci yang sama tidak menagih dua kali.

**Belum otomatis:** notifikasi desktop sungguhan (Playwright tidak bisa menjawab permintaan izin browser; logika teruji unit), Edge, billing mati di e2e (teruji unit) — dicek pemilik di Phase 07.

## 22. Catatan implementasi Phase 06 (2026-11-16)

Aturan turunan #10 dikonfirmasi (usulan dipakai; `00-keputusan.md`). Tidak ada izin baru dan tidak ada endpoint server baru.

**Ajakan pasang di web (hidden sampai terbit).** `apps/web/src/features/extension/install.ts`: konstanta `EXTENSION_STORE_URLS = { chrome: "", edge: "" }` (**kosong**; Phase 07 mengisinya dengan halaman detail toko), `browserStore(userAgent)` (Edge `Edg/` → Edge Add-ons; Chrome, Brave, Vivaldi, Arc → Chrome Web Store; Firefox, Safari, Opera, HP → tanpa toko) dan `currentExtensionInstall()`. Bila alamat kosong tidak ada yang tampil: `ExtensionInstallHint` (baris kecil di keadaan kosong halaman Lamaran dan di dialog Simpan loker, hanya saat kolom tautan masih kosong), `ExtensionInstallButton` ("Tambahkan ke Chrome/Edge") dan `BrowserExtensionSection` di Pengaturan (setelah Web access; browser tanpa toko melihat tautan kedua toko dan petunjuk membuka di Chrome/Edge). Tes: `install.test.ts`, `install-links.test.tsx` (tersembunyi saat kosong, tombol sesuai browser).

**Halaman setelah dicopot (#10).** Plugin memanggil `chrome.runtime.setUninstallURL` (`src/shared/uninstall.ts`: `<server>/extension/removed?locale=<id-ID|en-US>&v=<versi>`, tanpa data lain) saat pasang, saat mulai, dan saat pengaturan bahasa berubah. Rute `/_home/extension/removed` (`ExtensionRemovedPage`): tanpa formulir; tautan ke bagian bantuan panduan, bagian "akhiri akses" (mencopot plugin **tidak** mencabut izin OAuth di server: tautan ke Pengaturan → Aplikasi yang terhubung), dan `mailto:hi@rezumi.app`. Pilihan "email saja" (bukan formulir + Turnstile) dipakai karena paling sederhana dan tidak mengumpulkan apa pun. Server: `"extension"` masuk `RESERVED_SEGMENTS` (bukan nama pengguna, dan Vite dev tidak memperlakukannya sebagai CV publik), dan `static/web.ts` (`noindexPublicPaths`) menjawab `/extension/removed` dengan shell, `200`, `X-Robots-Tag: noindex, follow`; alamat lain di bawah `/extension` tetap 404 (tes di `web.test.ts`). Pastikan tidak ada akun produksi bernama pengguna `extension` sebelum rilis.

**Panduan.** `docs/guides/saving-jobs-from-your-browser.mdx` (grup Application Tracker; tertaut dari `adding-an-application`, `tracking-job-applications`), gambar `docs/images/guides/saving-jobs-from-your-browser/*.webp`, bagian bantuan: "A job site is not read correctly", "Why does the extension need LinkedIn access?", "How do I disconnect the extension?" (alamat jangkar dipakai halaman setelah dicopot).

**Legal.** Bagian "Ekstensi browser" di `kebijakan-privasi.mdx` / `privacy-policy.mdx` (data, tujuan, dasar; kapan dibaca; yang dikirim; AI; tanda tersimpan lokal; kontak dan logo; token; laporan halaman; notifikasi; halaman setelah dicopot; Limited Use) dan bagian pendek di `syarat-dan-ketentuan.mdx` / `terms-of-service.mdx` (gratis di semua paket, bukan klien pihak ketiga, tanggung jawab atas isi dan syarat situs loker, tanpa kutipan massal, tanpa afiliasi). Disetujui pemilik 2026-11-16 dan komentar "DRAF" sudah dihapus; tanggal berlaku kebijakan (12 November 2026) **belum diubah**: setel ke tanggal plugin terbit di toko.

**Materi toko.** `materi-toko/listing.md`, `izin.md`, `privasi-toko.md` (termasuk catatan untuk penguji), `chrome-web-store.md` diperbarui, lima screenshot × dua bahasa di `gambar/`. Dibuat oleh `tests/store-images.spec.ts` (hanya dengan `EXTENSION_STORE_IMAGES=<folder>` dan server lokal): akun fiktif (Rina Wijaya), CV fiktif, lowongan fiktif "Product Designer" di Lumen Health pada halaman peraga netral `__fixtures__/linkedin/store-demo.html` (struktur LinkedIn supaya pembaca dan tombol asli jalan, tampilan umum tanpa logo/warna situs). Fixture `pixelRatio` (layar 2×) ditambah di `tests/fixtures.ts`. Keluaran 2560×1600, diperkecil ke 1280×800 sebelum diunggah.

**Belum otomatis / menunggu.** Phase 07: isi `EXTENSION_STORE_URLS`, setel tanggal berlaku kebijakan, tinjau gambar di toko.
