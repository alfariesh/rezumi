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

Panel samping boleh memanggil API langsung dengan token yang diberikan service worker, atau lewat service worker; pilih satu pola di Phase 01 dan pakai konsisten. Token tidak pernah masuk ke content script.

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

- **Vite lewat `vp`**, tanpa framework plugin tambahan, supaya versi Vite tetap satu sesuai override workspace. WXT atau CRXJS hanya boleh dipakai bila terbukti tidak membawa Vite kedua; catat alasannya di sini.
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

## 6. API server

### 6.1 Sumber "extension"

Tambahkan `"extension"` ke `postingSourceSchema.method` (`packages/schema/src/applications/data.ts`). Cek semua pemakai enum (label di web, tes, `apps/mobile` tetap terkompilasi).

### 6.2 Kunci loker

- Kolom baru `application.source_key text` + indeks `(user_id, source_key)`. Diisi server dari `sourceUrl` dengan `jobKey()` dari `@rezumi/job-sites` di `create`, `update`, dan `import`.
- Format: `linkedin:<id>`, `indeed:<jk>`, `jobstreet:<id>`, `glints:<uuid>`; situs lain `url:<host><path>` (host huruf kecil, tanpa `www.`, tanpa parameter pelacak, tanpa garis miring akhir).
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

Pola ini dari pengetahuan umum; **verifikasi dengan halaman nyata di Phase 03** sebelum dipakai, dan catat hasilnya di bagian baru di akhir dokumen ini.

| Situs     | Contoh URL yang dikenali                                                                       | Kanonik                                     | Kunci              |
| --------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------ |
| LinkedIn  | `/jobs/view/<id>/`, `/jobs/search/?currentJobId=<id>`, `/jobs/collections/…?currentJobId=<id>` | `https://www.linkedin.com/jobs/view/<id>/`  | `linkedin:<id>`    |
| Indeed    | `<sub>.indeed.com/viewjob?jk=<id>`, `…/jobs?…&vjk=<id>`                                        | `https://<sub>.indeed.com/viewjob?jk=<id>`  | `indeed:<id>`      |
| JobStreet | `<sub>.jobstreet.com/<lang>/job/<id>`, `…?jobId=<id>`                                          | `https://<sub>.jobstreet.com/job/<id>`      | `jobstreet:<id>`   |
| Glints    | `glints.com/<negara>/opportunities/jobs/<slug>/<uuid>`                                         | URL tanpa query                             | `glints:<uuid>`    |
| Lainnya   | apa pun                                                                                        | tanpa parameter pelacak (`utm_*`, `ref`, …) | `url:<host><path>` |

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
- **Membuka panel dari tombol di halaman:** `chrome.sidePanel.open({ tabId })` hanya boleh dalam gestur pengguna. Cek di Phase 04 apakah pesan dari klik di content script memenuhi syarat itu (Chrome dan Edge). Bila tidak, pakai perilaku cadangan di `01-desain.md` bagian 4.
- **Pesan** antarbagian memakai tipe dan skema Zod di `src/shared`. Service worker memeriksa `sender.id === chrome.runtime.id` dan, untuk content script, `sender.tab`. Tidak ada `externally_connectable` dan tidak ada `web_accessible_resources` kecuali benar-benar perlu (ikon tombol sebaiknya SVG sebaris).
- **Menu klik kanan:** `contextMenus`, konteks `selection`.
- **Pintasan:** `commands` dengan `_execute_action` (membuka panel lewat perilaku ikon); cek di Phase 04.
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

## 11. Pengingat

- Disimpan sebagai `followUpAt` + `followUpNote` lamaran yang sudah ada. Usulan tanggal dari `validThrough` (aturan turunan #6).
- Panel beranda memakai `dueFollowUps` (atau filter `applications.list`).
- Alarm tiap 60 menit: perbarui angka badge; bila notifikasi dinyalakan (`optional_permissions: ["notifications"]`), kirim notifikasi sesuai aturan turunan #7. Catatan notifikasi yang sudah terkirim disimpan lokal per tanggal.

## 12. Izin dan keamanan

| Izin                                                                                                              | Untuk                                             | Catatan                              |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------ |
| `sidePanel`                                                                                                       | Panel samping                                     |                                      |
| `storage`                                                                                                         | Token, cache kunci, isian                         |                                      |
| `identity`                                                                                                        | Login OAuth                                       |                                      |
| `activeTab`, `scripting`                                                                                          | Membaca halaman situs lain saat pengguna mengklik | Tanpa izin host luas                 |
| `contextMenus`                                                                                                    | Menu klik kanan teks terpilih                     |                                      |
| `alarms`                                                                                                          | Sinkron kunci dan pengingat                       |                                      |
| `notifications` (opsional)                                                                                        | Pengingat desktop                                 | Diminta saat pengguna menyalakan     |
| Host: `https://www.linkedin.com/*`, `https://*.indeed.com/*`, `https://*.jobstreet.com/*`, `https://glints.com/*` | Tombol dan penanda di empat situs                 | Pola final mengikuti temuan Phase 03 |
| Host: `https://rezumi.app/*` (dev: `http://localhost:3000/*`)                                                     | Memanggil API tanpa CORS                          |                                      |

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
  - Chrome Web Store: _belum ada_
  - Edge Add-ons: _belum ada_
  - Public key Chrome (untuk `key` manifest dev): _belum ada_
- Setelah tayang: URL toko diisi di konstanta ajakan pasang di web (Phase 06/07), `chrome.runtime.setUninstallURL` ke halaman aturan turunan #10.
