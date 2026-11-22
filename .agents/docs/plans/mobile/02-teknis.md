# Rancangan teknis — app mobile (untuk agent)

Ditulis 2026-11-21 dari audit baca-saja atas `apps/mobile`, `packages/forme-native`, dan inventaris `apps/web` + `packages/api`. Tidak ada build atau simulator yang dijalankan saat audit. Butir bertanda **[cek]** belum diverifikasi di kode atau dokumen pustaka: verifikasi di phase yang memakainya dan perbarui dokumen ini.

## 1. Hasil audit

### 1.1 Keadaan sekarang

- Expo SDK 58, React Native 0.88.1, Expo Router 58, Reanimated 4.7, TanStack Query 5, oRPC, Lingui 6, zustand. ±47 ribu baris di `src`, ±2,6 ribu di `app`. Kode masuk repo 2026-10-29; sejak dibekukan (2026-11-04) hanya 2 commit menyentuh `src`/`app`.
- Sinyal utang rendah: 0 `TODO/FIXME/@ts-ignore`, 1 `as any`, 3 `oxlint-disable` beralasan. 23 file di atas 500 baris. Typecheck terakhir (cache 2026-11-20) bersih.
- Semua ±130 prosedur oRPC yang dipanggil app masih ada di router. App tidak memanggil apa pun dari `jobs`, `portfolio`, `profile`.
- Belum pernah dirilis. Build lama (iOS 1.0.0 (4), Android versionCode 5) tidak berisi klien OTA; semua 9 gerbang di `.agents/docs/mobile-release-handoff.md` masih terbuka.
- Perubahan belum di-commit di checkout utama (2026-11-21): `@lodev09/react-native-true-sheet` 3.11.18 → 4.1.2, `heroui-native` ^1.0.11 → ^1.1.1, penyesuaian `apps/mobile/src/ui/overlays.tsx`. Asalnya: commit `e9e497af` "chore(mobile): upgrade heroui-native to 1.1.1 and true-sheet to 4.1.2" (2026-11-20) di branch `chore/heroui-native-1-1`, worktree `~/Documents/rezumi-heroui-native`, belum di-merge. Phase 01 memakai branch itu sebagai dasar (merge atau cherry-pick), bukan salinan kotor di checkout utama; jangan dibuang diam-diam.

### 1.2 Vonis per area

| Area                                                      | Vonis       | Bukti / alasan                                                                                                                                                                                                  |
| --------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Klien API (`src/api/client.ts`)                           | Pertahankan | Snapshot kredensial per permintaan, satu kali refresh pada 401, cek `scope` akun (`SessionChangedError`), persetujuan AI di lapisan transport.                                                                  |
| Sesi dan OAuth (`src/auth/session.ts`, `oauth.ts`)        | Pertahankan | OAuth 2.1 + PKCE, token di SecureStore, refresh single-flight. 8 variabel modul: rapikan saat Phase 04, jangan tulis ulang.                                                                                     |
| Deep link (`src/linking/*`)                               | Pertahankan | Parser allowlist, antrean serial. Peta rute diperluas (bagian 7).                                                                                                                                               |
| Root layout, i18n, polyfill, konfigurasi                  | Pertahankan | Tambah default `QueryClient`, `focusManager`, `onlineManager`.                                                                                                                                                  |
| Simpan offline (`src/draft/store.ts`)                     | Refactor    | Perilaku benar (debounce, undo/redo, replay offline, konflik 3 arah) tetapi satu closure 488 baris dengan ±15 flag dan **tanpa tes**. Inti dipindah ke paket bersama dengan web dan diberi tes (Phase 07).      |
| Pipeline pratinjau (`src/preview/*`, `modules/pdf-pages`) | Pertahankan | iOS PDFKit, Android `PdfRenderer`; tidak ada yang khusus satu platform.                                                                                                                                         |
| `packages/forme-native`                                   | Pertahankan | Pin prebuilt (`scripts/prebuilt.json`, 2026-10-29) basi terhadap sumber Rust (berubah 2026-11-04). Build ulang + pin ulang + cek 16 KB (Phase 01).                                                              |
| Token dan primitif (`src/ui`, 3.365 baris)                | Tulis ulang | Sistem "Desk & Paper" (aksen `#337344`, Figtree, radius 2/3/4) sudah digantikan di web. HeroUI Native terpasang tetapi hanya provider-nya yang dipakai; `className=` nol.                                       |
| Ikon (`src/ui/icon.tsx`, Phosphor, 179 impor)             | Refactor    | Web pindah ke Hugeicons (`packages/icons`) dengan nama yang sama; pertukaran terkurung di `icon.tsx`.                                                                                                           |
| Layar masuk (`app/(auth)/*`)                              | Tulis ulang | Satu tombol "Continue in browser" + baris "Server".                                                                                                                                                             |
| Onboarding                                                | Baru        | Tidak ada; `app/index.tsx` langsung ke `/documents`.                                                                                                                                                            |
| Navigasi (`app/(tabs)`, `src/shell/app-tabs.tsx`)         | Tulis ulang | Tab lama: Documents, Applications, +, Career, Settings. Tab bar JS buatan sendiri.                                                                                                                              |
| Logika fitur (`*.ts`)                                     | Refactor    | 25 file menyatakan diri "ported from apps/web"; sumbernya sudah berubah. Pindah ke paket (bagian 5).                                                                                                            |
| Layar fitur (`*.tsx`)                                     | Tulis ulang | 812 blok `style={{}}` terikat token lama; komponen 300–400 baris (`practise.tsx` `Session` 401, `chat-view.tsx` `Conversation` 411, `Board` 333). Perilaku dan query dipertahankan, tampilan dan struktur baru. |
| Tes (`scripts/*.test.mjs`)                                | Ganti       | 16 file `node:test` dengan tiruan React/RN buatan tangan; Maestro 4 alur belum pernah jalan.                                                                                                                    |
| Dokumen dan workflow rilis                                | Perbarui    | Menyebut identitas pihak lain (Expo `owner: "reactive-resume"`, jalur `/Users/amruth/...`); workflow OTA yatim.                                                                                                 |

### 1.3 Celah kompatibilitas yang sudah diketahui

| Perubahan server sejak 2026-11-04                                           | Keadaan app                                                             | Diperbaiki di |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------- |
| `respondBy` tawaran bisa tanggal saja (`YYYY-MM-DD`)                        | `features/career/offers.tsx` memakai `new Date()` → bisa mundur sehari  | Phase 10      |
| Notifikasi `posting-closed`, `postingClosedAt` pada lamaran                 | Tidak ditangani                                                         | Phase 03, 10  |
| `careerScheduleInput.search` (kriteria notifikasi lowongan)                 | Tidak dikirim; edit jadwal dari app bisa menjatuhkan kriteria **[cek]** | Phase 03      |
| Event update CV `mutation: "profile"`                                       | Tanpa penanganan khusus                                                 | Phase 07      |
| `billing.summary` bertambah (`subscription`, `source`, `renews`, mata uang) | Kartu paket hanya membaca `summary` + `creditHistory`                   | Phase 14      |
| `customDomain.get` punya `stage`, `problem`, `plan`                         | Layar Share hanya tahu terverifikasi atau tidak                         | Phase 08, 12  |
| `coverLetters.update` menerima `basics`                                     | Tanpa pilihan From                                                      | Phase 08      |
| "Knowledge" menjadi "Profile"                                               | 16 file masih memakai kata lama                                         | Phase 06      |

## 2. Arsitektur sasaran

```text
apps/mobile/
  app/                    rute Expo Router; file tipis yang hanya memasang layar dari src/features
  src/
    api/ auth/ draft/ linking/ i18n/ preview/     mesin inti (dipertahankan)
    ui/                   design system baru (HeroUI Native + token)   ← Phase 02
    ui-legacy/            primitif lama selama migrasi; dihapus di Phase 15
    shell/                tab, bar atas, sidebar tablet, lembar Coach   ← Phase 03
    features/<area>/      layar, komponen, hook; tanpa aturan bisnis
  modules/                pdf-pages, key-commands (dipertahankan)
  e2e/                    alur Maestro (pindahan dari .maestro)
  AGENTS.md  DESIGN.md
```

Aturan kode:

1. **Layar tipis.** File layar ≤ ±250 baris, komponen ≤ ±150 baris; lebih dari itu dipecah menjadi komponen dan hook dalam folder fitur. Ini pedoman, bukan lint.
2. **Gaya lewat `className` (Uniwind) dan komponen `src/ui`.** `style={{}}` hanya untuk nilai yang dihitung saat jalan (ukuran dari gestur, inset). Tanpa hex, tanpa angka jarak lepas. Tes penjaga (bagian 9.1) menolak pelanggaran di `src/features` dan `app`.
3. **Data:** semua bacaan lewat `useQuery` dengan opsi dari klien oRPC; mutasi dengan pembaruan optimistis bila aksinya bisa dibalik; kunci query di-scope per akun (pola yang ada). `QueryClient` diberi default (`staleTime`, `retry` yang sadar offline) dan dihubungkan ke `AppState` dan `expo-network`.
4. **Tanpa aturan bisnis di app.** Validasi, perhitungan, format domain, dan model editor diimpor dari paket.
5. **Rute bertipe.** Semua navigasi lewat `src/routes.ts` (sudah ada); tidak ada string rute di layar.
6. **Platform:** perbedaan iOS/Android terkurung di `src/ui` dan `src/shell`. Layar fitur tidak memakai `Platform.OS` kecuali untuk izin.

Arsip: sebelum perubahan pertama Phase 01, buat tag `arsip/mobile-2026-11` pada commit `main` saat itu (push tag dengan izin pemilik). Tidak ada folder arsip di repo; riwayat git adalah arsipnya.

## 3. Design system

### 3.1 Token (nilai web, sumber `@heroui/styles` 3.2.7 + `packages/ui/src/styles/globals.css`)

| Token             | Terang                        | Gelap                         |
| ----------------- | ----------------------------- | ----------------------------- |
| background        | `oklch(0.9702 0 0)`           | `oklch(12% 0.005 285.823)`    |
| foreground        | `oklch(0.2103 0.0059 285.89)` | `oklch(0.9911 0 0)`           |
| surface           | `oklch(100% 0 0)`             | `oklch(0.2103 0.0059 285.89)` |
| surface-secondary | `oklch(0.9524 0.0013 286.37)` | `oklch(0.257 0.0037 286.14)`  |
| surface-tertiary  | `oklch(0.9373 0.0013 286.37)` | `oklch(0.2721 0.0024 247.91)` |
| muted             | `oklch(0.5517 0.0138 285.94)` | `oklch(70.5% 0.015 286.067)`  |
| default           | `oklch(94% 0.001 286.375)`    | `oklch(27.4% 0.006 286.033)`  |
| border            | `oklch(90% 0.004 286.32)`     | `oklch(28% 0.006 286.033)`    |
| separator         | `oklch(92% 0.004 286.32)`     | `oklch(25% 0.006 286.033)`    |
| accent            | `oklch(0.6204 0.195 253.83)`  | sama                          |
| success           | `oklch(0.7329 0.1935 150.81)` | sama                          |
| warning           | `oklch(0.7819 0.1585 72.33)`  | `oklch(0.8203 0.1388 76.34)`  |
| danger            | `oklch(0.6532 0.2328 25.74)`  | `oklch(0.594 0.1967 24.63)`   |

Tambahan Rezumi: `--paper: #ffffff` (tidak pernah dibalik); tahap saved `#908C7F`, applied `#5590CC`, screening `#00A0A6`, interview `#AF8433`, offer `#579F68`, closed `#C67067`. Pasangan lembut (`accent-soft` = aksen 15%) mengikuti pola web. Radius dasar 8; skala 2, 4, 6, 8, 12, 16, 24, 32; isian 12. Jarak 4, 8, 12, 16, 24, 32, 48, 64. Tipe: 30/36, 20/28, 16/24, 14/20, 12/16; tracking +0.02em pada 12–14, +0.01em pada 16. Gerak 120 / 200 / 320 ms; masuk `cubic-bezier(0.23, 1, 0.32, 1)`, gerak `cubic-bezier(0.77, 0, 0.175, 1)`, lembar `cubic-bezier(0.32, 0.72, 0, 1)`.

Cara memasang: tema HeroUI Native lewat variabel CSS di `apps/mobile/global.css` (Uniwind membaca `@theme`). **[cek]** nama variabel dan dukungan `oklch` di HeroUI Native 1.1 / Uniwind 1.13: baca dokumen terpasang (skill `heroui-native`, MCP `heroui-pro` → `get_design_system_manifest` / Native CSS). Bila `oklch` tidak didukung di native, ubah ke hex sekali lewat skrip dan simpan tabel padanannya di `apps/mobile/DESIGN.md`; jangan menaksir dengan mata.

### 3.2 Font dan ikon

- Font: Google Sans dan Google Sans Code. **[cek]** dari mana web memuatnya (`packages/ui`, `packages/fonts`) dan lisensinya untuk dibundel dalam app; bundel berkas statis 400/500/600/700 lewat `expo-font`. Bila lisensi tidak mengizinkan pembundelan, tanya pemilik sebelum memilih pengganti.
- Ikon: tambah `@rezumi/icons` sebagai dependensi; `src/ui/icon.tsx` menggambar data `getAppIcon(name, variant)` (`[tag, attrs][]`) dengan `react-native-svg` (ubah atribut kebab-case ke camelCase, warna dari `currentColor` → prop). Hapus `phosphor-react-native` setelah tidak ada impor. Ikon di dalam PDF sudah Hugeicons lewat `@rezumi/pdf`.

### 3.3 Komponen

`src/ui` baru mengekspor komponen HeroUI Native apa adanya bila cukup, dan pembungkus tipis bila app butuh perilaku tambahan. Jangan membuat ulang komponen yang sudah ada di pustaka.

| Kebutuhan app                      | Sumber                                                                                                                                              |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tombol, kartu, chip, avatar, alert | `heroui-native` (`button`, `card`, `chip`, `avatar`, `alert`, `surface`)                                                                            |
| Isian                              | `text-field`, `text-area`, `input-group`, `input-otp`, `search-field`, `select`, `checkbox`, `radio-group`, `switch`, `slider`                      |
| Daftar pengaturan                  | `list-group`, `separator`                                                                                                                           |
| Lembar                             | TrueSheet (dipertahankan; lembar asli tiap platform) dibungkus `Sheet`; `bottom-sheet` HeroUI untuk lembar ringan bila perilakunya setara **[cek]** |
| Dialog, menu, popover, toast       | `dialog`, `menu`, `popover`, `toast`                                                                                                                |
| Tab dan segmen                     | `tabs`; `segment` dan `swipeable-tabs` dari Pro                                                                                                     |
| Kerangka memuat, kosong            | `skeleton`, `skeleton-group`; `empty-state` (Pro)                                                                                                   |
| Tanggal dan waktu                  | Pro `date-picker`, `wheel-date-time-picker`, `calendar`; pemilih sistem untuk kasus sederhana                                                       |
| Kalender wawancara                 | Pro `agenda` (bandingkan dengan kalender buatan sendiri yang ada; pilih satu)                                                                       |
| Grafik (Insights, statistik)       | Pro `line-chart`, `bar-chart`, `pie-chart` (butuh Skia)                                                                                             |
| Masuk sosial                       | Pro `social-auth-button`                                                                                                                            |
| Langkah onboarding                 | Pro `stepper`, `carousel`, `progress-bar`                                                                                                           |
| Baris geser, tombol mengambang     | Pro `swipeable-row`, `fab`                                                                                                                          |
| Tata letak tablet                  | Pro `split-view`                                                                                                                                    |
| Daftar panjang                     | Legend List (dipertahankan)                                                                                                                         |
| Teks kaya                          | `react-native-enriched-html` (dipertahankan)                                                                                                        |

`heroui-native-pro` masih beta (`1.0.0-beta.12`): tiap komponen Pro yang dipakai dicoba di dua platform di galeri sebelum dipakai di layar; bila bermasalah, buat komponen sendiri di `src/ui` dan catat di `apps/mobile/DESIGN.md`.

### 3.4 Satu gelombang dependensi native (Phase 01–02)

Tiap modul native baru mengubah fingerprint dan menuntut build ulang. Karena itu semua tambahan dipasang sekaligus:

| Modul                                                                                  | Untuk                                                | Catatan                                                      |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------ |
| `react-native-webview`                                                                 | Pratinjau Portofolio (K8), embed                     |                                                              |
| `@shopify/react-native-skia`, `react-native-pager-view`, `react-native-reanimated-dnd` | Peer komponen Pro (grafik, carousel/tab geser, urut) | Versi mengikuti `expo install`                               |
| `expo-apple-authentication`                                                            | Sign in with Apple asli (K4)                         | iOS saja                                                     |
| Google Sign-In (Phase 04: modul lokal `modules/google-credential`, Android saja)       | Google asli (K4)                                     | Credential Manager; iOS lewat OAuth Google tanpa modul (§16) |
| `expo-image-manipulator`                                                               | Kecilkan gambar sebelum `portfolio.uploadImage`      | Server tidak mengecilkan gambar                              |
| `@internationalized/date`                                                              | Peer pemilih tanggal Pro                             | JS saja                                                      |

**Terpasang di Phase 01 (2026-11-21, `expo install`, SDK 58):** `react-native-webview` 14.0.1, `react-native-skia` 3.10.2 (paket tanpa scope; itulah yang dimuat HeroUI Native Pro, bukan `@shopify/react-native-skia`), `react-native-pager-view` 9.0.7, `react-native-reanimated-dnd` 2.0.0, `expo-apple-authentication` 58.0.3, `expo-image-manipulator` 58.0.16, `@internationalized/date` 3.12.4, dan `expo-blur` 58.0.6 (peer opsional HeroUI Native yang dipakai satu komponen Pro; ditambah sekarang supaya tidak memicu build ulang nanti). Google Sign-In ditunda ke Phase 04 (pustaka belum dipilih). `expo-apple-authentication` dan `expo-image-manipulator` belum diimpor kode, jadi `knip.json` mengecualikannya (`ignoreDependencies`); hapus pengecualian itu di phase yang pertama kali memakainya (04 dan 12). `expo-observe` **dihapus** (butuh proyek Expo; diganti `src/shell/error-boundary.tsx`).

Sudah terpasang dan cukup: `expo-image-picker`, `expo-document-picker`, `expo-audio`, `expo-notifications`, `expo-sqlite`, `expo-secure-store`, `expo-sharing`, `expo-print`, `react-native-qrcode-svg`, `expo-haptics`. Pustaka yang mungkin bisa dibuang setelah migrasi: `phosphor-react-native`, `@radix-ui/*` dan `react-dom`/`react-native-web` bila galeri web tidak dipertahankan (putuskan di Phase 02).

## 4. Masuk dan daftar asli (K4)

Tujuan: layar asli tanpa mengubah model token yang ada (access + refresh token OAuth, disimpan dan diputar oleh `src/auth/session.ts`).

Rancangan awal, **diverifikasi lewat spike di awal Phase 04**:

1. Layar asli memanggil endpoint Better Auth yang sudah ada: `/sign-in/email`, `/sign-up/email` (butuh `username` dan `displayUsername`), `/request-password-reset`, verifikasi email, `/two-factor/*`, dan masuk sosial dengan **ID token** dari Apple/Google asli.
2. Hasilnya adalah sesi Better Auth. App **tidak menyimpan** sesi itu; app langsung menukarnya menjadi pasangan token OAuth dengan menjalankan alur authorization code + PKCE yang sama **tanpa membuka browser** (permintaan `authorize` membawa sesi, klien pihak pertama melewati layar persetujuan), lalu menukar kode seperti sekarang. Pola klien pihak pertama mengikuti yang dipakai ekstensi browser (`.agents/docs/plans/plugin-browser/`, `packages/auth/src/config.ts` → `oauthProvider`). **[cek]** cara `@better-auth/oauth-provider` menandai klien tepercaya dan apakah `authorize` bisa diselesaikan lewat `fetch`.
3. Bila langkah 2 tidak bisa dibuat aman, tambahkan satu endpoint pihak pertama di `apps/server/src/http` + `packages/auth` yang menerbitkan pasangan token yang sama untuk sesi yang baru dibuat (terikat PKCE atau attestation perangkat), dengan rate limit dan tes.
4. GitHub, LinkedIn, passkey, OIDC kustom: tetap alur browser yang ada (`ASWebAuthenticationSession` / Custom Tabs), dengan parameter petunjuk penyedia supaya pengguna langsung sampai ke penyedia yang dipilih.
5. Cadangan bila 2 dan 3 gagal uji keamanan: pertahankan alur browser, perbaiki layar pembuka (tombol per penyedia, tanpa baris Server) dan halaman web `/auth/*` untuk tampilan ponsel.

Temuan Phase 01 (2026-11-21): app menyimpan `client_id` per server dan hanya menghapusnya bila endpoint token menjawab `invalid_client`. Bila database server diganti (self-host dipulihkan, klien dihapus), halaman `authorize` menampilkan "client not found" tanpa kembali ke app, sehingga app terjebak sampai dipasang ulang. Phase 04: deteksi kasus ini (mis. cek klien lewat pendaftaran ulang saat `authorize` gagal atau dibatalkan berulang) dan daftar ulang otomatis.

Wajib: tinjauan keamanan terpisah (agent baca-saja) sebelum merge Phase 04; tes integrasi di `packages/auth`; batas laju pada endpoint baru; tidak ada kata sandi atau token di log; 2FA dan verifikasi email tidak bisa dilewati lewat jalur asli. Pilihan Server: dipertahankan di kode (sesi, deep link, dan scope draf bergantung padanya), UI-nya hanya muncul di build pengembangan.

## 5. Logika bersama (K9)

Pemilik paket mengikuti peta di `CLAUDE.md`. Paket baru hanya bila tidak ada pemilik yang cocok; usulan: `packages/career` (`@rezumi/career`, `runtime:universal`, `role:domain`) untuk logika lamaran, lowongan, dan onboarding yang sekarang hanya ada di `apps/web`. Konfirmasi dengan `turbo boundaries` dan catat di sini bila namanya berubah.

| Logika (sumber sekarang)                                                                                                                  | Tujuan                                                        | Phase |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ----- |
| Inti draf (web `draft.ts`, mobile `src/draft/store.ts`)                                                                                   | `@rezumi/resume` (subpath baru `./draft`)                     | 07    |
| Model Write, preset desain (web `resume/editor`, mobile `features/write/model.ts`, `design/presets.ts`, `letters/design-presets.ts`)      | `@rezumi/resume`                                              | 07–08 |
| Langkah onboarding, `needsOnboarding`, alur sumber Profil (web `features/onboarding`, `features/profile/sources`)                         | `@rezumi/career` (atau `@rezumi/resume/profile` untuk sumber) | 05    |
| Draf Profil dengan `expectedUpdatedAt` (web `features/profile/store.ts`)                                                                  | `@rezumi/resume/profile`                                      | 06    |
| Pencarian lowongan: `toSearchRequest`, `fromCriteria`, `sameSearch`, `salaryLabel`, `placeLabel` (web `features/jobs`)                    | `@rezumi/career`                                              | 09    |
| Insights, ICS, langkah berikutnya, wawancara, `dateOnlyDeadline` (web `features/applications`, `career/offer-compare.ts`; salinan mobile) | `@rezumi/career`                                              | 10    |
| Usulan asisten, transport chat (web `features/assistant`; salinan mobile)                                                                 | `@rezumi/ai` atau `@rezumi/resume`                            | 11    |
| Store editor Portofolio, karya, blok, penerapan AI, CSV statistik (web `features/portfolio/*`)                                            | `@rezumi/portfolio` (subpath bersih)                          | 12–13 |

Aturan pemindahan: pindahkan bersama tesnya; web mengimpor dari paket pada commit yang sama; tidak ada perubahan perilaku web (tes web dan Playwright yang relevan tetap hijau); ekspor lewat `package.json` paket, bukan path `src`.

## 6. Pratinjau Portofolio (K8)

- Server: prosedur baru `portfolio.preview` (terautentikasi, pemilik saja) yang mengembalikan HTML dari `renderPortfolioPage` untuk draf tersimpan, dengan opsi karya yang sedang dibuka dan tema. Tanpa cache publik; aset memakai URL bertanda tangan yang sudah ada. **[cek]** `apps/server/src/static/portfolio-page.ts` untuk cara halaman publik dirakit.
- App: `react-native-webview` dengan `source={{ html, baseUrl }}`, JavaScript menyala hanya untuk skrip halaman, navigasi keluar dibuka di browser sistem, tanpa akses file. Pratinjau dimuat ulang setelah autosave selesai.
- Contoh efek intro di pemilih: gambar diam dari `apps/web/public/portfolio-themes/` (salin ke aset app atau muat dari server).

## 7. Peta deep link

| URL web                                                      | Layar app                          |
| ------------------------------------------------------------ | ---------------------------------- |
| `/dashboard`, `/dashboard/career` (+ `?schedule=`)           | Home (buka jadwal bila ada)        |
| `/dashboard/documents`, `/dashboard/trash`                   | Documents (segmen sesuai)          |
| `/builder/$resumeId`, `/builder/letter/$id`                  | Pembuat CV / surat                 |
| `/builder/portfolio` (`?mode=`), `/dashboard/portfolio`      | Editor / tab Portfolio             |
| `/dashboard/profile/*`                                       | Profile (segmen sesuai)            |
| `/dashboard/applications`, `/…/$id/{tab}`                    | Applications / ruang kerja         |
| `/dashboard/applications/jobs`, `/dashboard/jobs`            | Jobs                               |
| `/dashboard/applications/offers`, `/dashboard/career/offers` | Offers                             |
| `/dashboard/coach/{id}`, `/dashboard/career/coach…`          | Coach layar penuh                  |
| `/dashboard/settings/*`                                      | Account / App settings / Plan      |
| `/auth/native-callback`                                      | Penyelesaian masuk (dipertahankan) |

Android App Links sekarang hanya mencakup `/builder/` dan callback: perluas `intentFilters` di `app.config.ts` dan file asosiasi server (`MOBILE_*` env) sesuai tabel. iOS: `applinks` sudah per host; cek pola path di `apple-app-site-association`.

## 8. Urutan migrasi layar

1. Phase 02 memindahkan primitif lama ke `src/ui-legacy` (impor `@/ui` di layar lama ditulis ulang secara mekanis ke `@/ui-legacy`) dan **memetakan token lama ke palet baru** (aksen, latar, font) supaya layar yang belum dimigrasi tidak terlihat seperti produk lain.
2. Tiap phase fitur menulis ulang layarnya di atas `src/ui` baru dan menghapus versi lama.
3. Phase 15 menghapus `src/ui-legacy` dan menambahkan tes yang menolak impornya.

## 9. Pengujian (K10)

### 9.1 Lapisan

| Lapisan        | Alat                                                                                  | Isi                                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Logika         | Vitest di paket (`pnpm --filter <paket> test`)                                        | Semua logika yang dipindah di bagian 5; inti draf wajib punya tes konflik, offline, undo.                                   |
| Komponen/layar | `jest-expo` + React Native Testing Library **[cek]** kecocokan dengan SDK 58 dan pnpm | Keadaan memuat/kosong/gagal/offline tiap layar; form; aksesibilitas (peran dan label).                                      |
| Penjaga        | Skrip tes kecil                                                                       | Tidak ada hex/`style` statis di `src/features` dan `app`; tidak ada impor `ui-legacy` (akhir); tidak ada teks tanpa Lingui. |
| Alur perangkat | Maestro, iOS dan Android                                                              | Masuk, onboarding, buat dan edit CV, simpan offline lalu sambung, ekspor, cari dan lacak lowongan, terbitkan portofolio.    |
| Mata           | Argent (MCP) + simulator/emulator                                                     | Screenshot per phase (aturan README nomor 13).                                                                              |

`mobile` mendapat skrip `test:ci` dan masuk job unit di `.github/workflows/ci.yml`. Tes `node:test` lama dipertahankan hanya untuk logika murni sampai logikanya pindah ke paket, lalu dihapus. Alur Maestro di CI (Blacksmith) dipasang di Phase 15; sebelum itu dijalankan lokal.

### 9.2 Lingkungan lokal

- Server: `pnpm dev` dengan database lokal; app menunjuk ke server lokal lewat pilihan Server (build pengembangan). Simulator iOS memakai `localhost`; emulator Android memakai `10.0.2.2`.
- Forme: `bash packages/forme-native/rust/build.sh` sebelum build lokal bila pin prebuilt tidak cocok dengan sumber.
- Akun uji dibuat lewat API lokal (`/api/auth/sign-up/email` butuh `username` dan `displayUsername`); kata sandi tidak ditulis di dokumen atau chat.
- Lowongan: stub treg lokal (`TREG_BASE_URL`) seperti tes browser web; panggilan nyata hanya dengan izin pemilik.

## 10. Daftar cek dua platform (syarat selesai tiap phase)

> **Android ditangguhkan di Mac pemilik sejak 2026-11-21** (`00-keputusan.md` log). Butir Android di bawah dicatat "belum dicek" sampai pemilik mengizinkan lagi; jangan menjalankan emulator atau build Android lokal.

Untuk tiap layar baru atau yang diubah:

- [ ] Jalan di simulator iPhone (ukuran kecil dan besar) dan emulator Android (API terbaru; API 24–28 untuk phase 03, 04, 15).
- [ ] Terang dan gelap; Inggris dan Indonesia; teks sistem diperbesar satu tingkat tanpa terpotong.
- [ ] Area aman: poni, indikator home, bar navigasi Android (edge-to-edge), keyboard tidak menutup isian aktif atau tombol utama.
- [ ] Android: tombol/gestur kembali menutup lembar, lalu kembali satu layar, lalu keluar; form yang belum disimpan bertanya dulu.
- [ ] iOS: geser dari tepi untuk kembali tidak bentrok dengan geser baris atau board.
- [ ] Keadaan memuat, kosong, gagal, offline ada dan benar.
- [ ] Pembaca layar: tiap kontrol punya label; urutan fokus masuk akal (cek cepat VoiceOver dan TalkBack pada layar utama).
- [ ] Rotasi dan lebar ≥ 700 tidak merusak tata letak (phase yang menyentuh tata letak).
- [ ] Daftar panjang (300 butir) tetap mulus.

## 11. Sasaran performa (divalidasi di Phase 15, angka boleh direvisi dengan data)

| Ukuran                                  | Sasaran                                    |
| --------------------------------------- | ------------------------------------------ |
| Buka dingin sampai Home bisa disentuh   | ≤ 2,5 detik di Android kelas menengah      |
| Pindah tab                              | terasa seketika (< 100 ms ke kerangka)     |
| Gulir daftar dokumen/lamaran/lowongan   | tanpa frame jatuh yang terlihat            |
| Pratinjau PDF setelah berhenti mengetik | ≤ 1 detik untuk CV 2 halaman               |
| Ukuran unduhan                          | tidak naik > 15% dari build dasar Phase 01 |

Dasar ukur Phase 01 (2026-11-21, iPhone 17 simulator iOS 27.2, build pengembangan): `Rezumi.app` 228 MB (101 MB `Rezumi.debug.dylib` + 102 MB `Frameworks`); build iOS dari cache 94 detik. Build rilis lokal, ukuran unduhan rilis, dan waktu buka dingin **belum diukur** (build rilis terlalu berat untuk Mac pemilik di sesi itu; ukur sendirian di Phase 02 atau lewat `mobile-release.yml`). Android belum diukur (ditunda pemilik).

Katalog bahasa sekarang 22 MB untuk 55 bahasa: muat per bahasa saat dibutuhkan, bukan semuanya di bundel awal **[cek]** cara `src/i18n` memuatnya.

## 12. Aturan toko dan rilis

- Tanpa UI pembelian, harga, atau tautan beli (K6). Pesan batas paket netral.
- Sign in with Apple tersedia bila ada masuk pihak ketiga (dipenuhi K4).
- Hapus akun dapat dijangkau dari Account (alur konfirmasi browser yang ada tetap).
- Persetujuan AI per operasi di lapisan transport dan laporan konten AI tetap ada; jangan dipindah ke UI saja.
- Android: target API 36, pustaka native lolos 16 KB (tenggat Play 2027-02-01 menurut `mobile-store-review.md`).
- Pipeline: `mobile-forme-build.yml` → pin `prebuilt.json`; `mobile-release.yml` (Blacksmith, gerbang `mobile-signing` dan `mobile-store`); `mobile-ota-update.yml` diberi pemanggil dari `deploy-cloudflare.yml` di Phase 16 dengan cek `/api/health`.
- `app.config.ts` `owner` dan proyek EAS mengikuti jawaban P1.
- Setelah rilis pertama (bukan sebelumnya), aturan kompatibilitas API untuk binary lama di `CLAUDE.md` berlaku penuh.

## 13. Identitas app (jawaban P1, 2026-11-21)

- Tim Apple pemilik: `ZAVWN3Z2YX`. Dokumen rilis lama memakai `654ASRW868` (pihak lain). Phase 01: cek di akun pemilik apakah bundle id `app.rezumi` dan app Rezumi di App Store Connect memang di tim `ZAVWN3Z2YX`, catat ID app yang benar, ganti `MOBILE_IOS_APP_IDS` menjadi `ZAVWN3Z2YX.app.rezumi` (env server produksi diisi pemilik), dan anggap build lama (4/5), kunci tanda tangan, serta Services ID `app.rezumi.web` belum tentu milik pemilik sampai terbukti. Bila bundle id ternyata terdaftar di tim lain, berhenti dan tanya pemilik (perlu id baru).
- Play Console: paket `app.rezumi` milik pemilik; sidik jari Play App Signing dibaca ulang dari konsol pemilik.
- Expo: tanpa akun `reactive-resume`. Hapus `owner` dan `extra.eas.projectId` lama dari `app.config.ts`; matikan `expo-updates` (URL/kanal) dan `expo-observe` sampai ada proyek Expo milik pemilik; workflow OTA tetap tidak dipakai. Fingerprint tetap berguna secara lokal. Bila pemilik nanti membuat akun `rezumi`, Phase 16 menyalakan OTA lagi.

## 14. Hasil Phase 02: design system (2026-11-21)

Rujukan pemakaian: `apps/mobile/DESIGN.md`. Butir **[cek]** bagian 3 terjawab:

- **`oklch` didukung.** HeroUI Native 1.1.1 sudah memakai tema yang sama dengan `@heroui/styles` 3.2.7 web dalam `oklch`, dan Uniwind 1.13 mengompilasinya untuk iOS dan Android. Tidak ada konversi hex. `global.css` hanya menimpa nilai yang berbeda dari web: `--field-radius` 1,5× (bukan 1,75×), `separator`, `backdrop`, `overlay-shadow`, bayangan isian nol, isian 16 pt, isian `secondary` berisi `background`, tracking `h5`/`h6` normal. Tabel padanan sRGB (untuk jembatan lama dan alat) ada di `DESIGN.md`, dihitung dengan skrip.
- **Lisensi Google Sans: OFL-1.1** (`@fontsource-variable/google-sans` dan `-code`), jadi boleh dibundel. Berkas statis 400/500/600/700 dan Code 400 dipotong dari font variabel yang sama dengan web (subset Latin, Latin Extended, Vietnam; ±110 KB per berat) dengan `fonttools` (`varLib.instancer` + `merge`), disimpan di `apps/mobile/assets/fonts` beserta teks OFL. Skrip lain jatuh ke font sistem. Figtree, Instrument Serif dan Geist Mono dihapus.
- **Ikon:** semua 176 nama yang dipakai layar lama ada di `@rezumi/icons`; tidak ada yang perlu dipetakan. `phosphor-react-native` dihapus; `Icon` lama kini menggambar Hugeicons.
- **Pratinjau web (`preview:web`) dihapus** bersama `react-native-web`, `react-dom`, `@radix-ui/react-dialog`, `@radix-ui/react-presence` (semua peer opsional web) dan middleware COOP/`wasm` Metro: galeri tidak dipakai di browser, dan menjalankan HeroUI Native + TrueSheet di web butuh kerja yang tidak sepadan.
- **Tidak ada modul native baru** di Phase 02: build pengembangan Phase 01 menjalankan semuanya lewat Metro. Warna splash diganti ke token `background` (`#F5F5F5`/`#060607`); itu konfigurasi native dan baru terlihat setelah build berikutnya.
- **Jest + HeroUI Native:** `jest.setup.js` memakai mock resmi Reanimated (+ `modify` pada shared value), worklets, gesture handler, keyboard controller, dan mematikan handler CSS Reanimated yang tidak ada di implementasi JS. `src/ui/test-utils.tsx` (`renderUi`) membungkus provider dengan animasi mati.
- **Penjaga** (bagian 9.1) sudah ada: `src/design-guard.test.ts` + `src/design-guard.legacy.json` (139 layar lama pada 2026-11-21; daftar hanya boleh menyusut dan harus terurut).
- **Tautan galeri:** `app.rezumi://dev/ui?group=…` hanya di build pengembangan (`src/linking/parse.ts`). Pada simulator, tautan pertama setelah app dibuka kadang tidak berpindah layar; kirim sekali lagi.

## 15. Hasil Phase 03: navigasi, kerangka app, Home (2026-11-21)

Butir **[cek]** terjawab dan pilihan yang diambil:

- **Tab asli Expo Router tidak dipakai.** `expo-router/unstable-native-tabs` (Expo Router 58.0.28) mendukung lencana dan sidebar iPad (`sidebarAdaptable`), tetapi ikonnya harus SF Symbol, drawable, atau gambar (bukan SVG Hugeicons, K2); `hidden` "tidak bisa dinavigasi sama sekali" dan menyembunyikan tab secara dinamis me-reset navigator (Portfolio menunggu `portfolio.status`); sidebar hanya di iPad iOS. Dipakai tab JS Expo Router (`expo-router/tabs`) dengan `tabBar` sendiri dari `src/ui`: `src/shell/app-tabs.tsx` (`PhoneTabBar`, `AppSidebar` ≥ 700 pt, rail di bawah 1000 pt). Portfolio disembunyikan dengan `href: null` (opsi `hidden`) bila `portfolio.status().enabled` salah.
- **Rute:** `app/(tabs)/{home,documents,applications,portfolio,profile}`; Offers di `app/(tabs)/applications/offers.tsx` (tombol di header Applications); Knowledge lama di `app/(tabs)/profile/knowledge.tsx` sampai Phase 06; pengaturan di `app/account/*` (tanpa `_layout`, didorong di tumpukan root; tombol kembali minimal); Coach lama di `app/coach.tsx`. `src/routes.ts`: `home(schedule?)`, `offers`, `portfolio`, `profile`, `knowledge`, `account(pane?)`, `coach(offers?)`; `career` dan `settings` dihapus. App dibuka dan selesai masuk ke Home.
- **Shell:** `src/shell/tab-chrome.tsx` (`TabTopBar` = judul + Coach · Search · avatar; `NewFab` hanya ponsel; `useOpenCoach` adalah slot Coach: Phase 11 menggantinya dengan lembar/panel), `account-menu.tsx` (Account, Plan hanya Android, App settings, Help & legal, Sign out dengan konfirmasi; `useSignOut` dipisah dari `SignOutRow`), `offline-strip.tsx`, `tab-root-back.tsx` (halaman tab yang dibuka dari tautan tanpa layar di bawahnya mendapat Back ke akar tab), `unsaved-changes.ts` (`useUnsavedChangesGuard`: `usePreventRemove` + dialog sistem; pemakai pertama isian Nama/Username di Account). Header layar lama (`CollectionHeader`) menambah baris Coach · Search · avatar bila di dalam tab (`InTabs`). Bar bawah editor lama pindah ke `src/shell/editor-bar.tsx`.
- **Home** (`src/features/home/*`): Coming up, Needs you (termasuk `posting-closed`; tautan notifikasi `/dashboard/...` dibuka lewat `parseDeepLink`), Recent documents, New roles (Track dengan Undo 10 detik, Not for me dengan toast Undo), Schedules (sakelar optimistis), keadaan pertama kali tanpa dokumen; dua kolom dari 700 pt. `?schedule=<id|new|new:kind>` membuka lembar jadwal (lembar lama `features/career/schedule-sheet.tsx`, ditulis ulang di Phase 09). Lencana tab Home = notifikasi belum dibaca; tanda baca langsung menurunkan lencana (cache) dan dikirim saat toast Undo habis. Fakta lowongan (cara kerja, gaji) di kartu belum ditampilkan: `salaryLabel`/`arrangementLabel` masih di web, pindah ke paket di Phase 09.
- **`careerScheduleInput.search`:** bila tidak dikirim, server mempertahankan pencarian jadwal yang tersimpan (dan menyesuaikan perannya bila `query` berubah); diuji di `packages/api/src/features/career/jobs.integration.test.ts`. Sakelar dan lembar jadwal app sengaja tidak mengirim `search`; mengirim `null` justru menghapus kriteria. Tidak ada risiko kriteria hilang.
- **Deep link:** `src/linking/parse.ts` memetakan semua baris bagian 7 (`/dashboard`, `/dashboard/career?schedule=`, documents/resumes/cover-letters/trash, portfolio dan `/builder/portfolio`, profile dan `career/knowledge`, applications (+ `$id`, `$id/$tab`, jobs, offers), jobs, coach, settings → account) dengan 51 tes (`parse.test.ts`); admin dan halaman tak dikenal ke browser. Android `intentFilters` dan iOS `apple-app-site-association` (`apps/server/src/http/app-links.ts`, dengan tes) memakai daftar prefiks yang sama; tagihan (`/dashboard/settings/billing`) dan admin tetap di web supaya kembalian checkout tidak membuka app.
- **Gestur kembali prediktif Android tetap mati** (`predictiveBackGestureEnabled: false`): belum bisa diuji (Android ditunda pemilik) dan interaksinya dengan `usePreventRemove` perlu dicek di perangkat. Nyalakan di Phase 15 setelah uji Android.
- **Hermes:** `Intl.RelativeTimeFormat` tidak ada dan `Intl.NumberFormat` gaya `unit` memformat salah ("2,700s" untuk 45 menit). Waktu relatif dan durasi di Home memakai string Lingui. Easing `tokens.motion` adalah worklet Reanimated, bukan fungsi untuk `Animated` React Navigation: transisi tab memakai `Easing` React Native.
- **Tes:** `src/test/render-screen.tsx` (provider + Lingui + QueryClient untuk tes layar); Jest kini mengubah `@lingui/*` dan `@messageformat/*`, dan `jest.setup.js` memberi TrueSheet tiruan global. Tes baru: Home (memuat/kosong/berisi/gagal/offline), tab bar dan sidebar (Portfolio tersembunyi, lencana, urutan), penjaga perubahan, parser. Alur Maestro `e2e/navigation.yaml` lulus di simulator iPhone 17 (iOS 27.2).
- **Tidak ada modul native baru.** Konfigurasi native yang berubah hanya `intentFilters` Android (berlaku di build Android berikutnya).

## 16. Hasil Phase 04: masuk dan daftar asli (2026-11-21)

Spike bagian 4 selesai; jalur 2 (sesi Better Auth → token OAuth tanpa browser) dipakai, dengan satu endpoint pihak pertama kecil. Butir **[cek]** terjawab dari sumber Better Auth 1.7.12 terpasang:

- **`authorize` lewat `fetch`:** bisa. GET tidak dicek Origin; dengan `Accept: application/json` jawabannya `{ redirect, url }` berisi `code`, bukan 302. Syaratnya ada baris `oauthConsent` yang menutup scope dan `resource`. **`skipConsent` tidak dipakai:** klien DCR tidak bisa memilikinya (`skip_consent` = `z.never`), dan ia tidak membuat baris persetujuan sehingga `verifyOAuthToken` (cek `rr_grant_id`) gagal.
- **2FA:** `/sign-in/email` untuk akun ber-2FA menghapus sesinya dan hanya memberi cookie bertanda tangan `better-auth.two_factor` (10 menit); `verify-totp`/`verify-backup-code` membutuhkannya. Tidak ada jalan tanpa cookie, jadi app menyimpan cookie per percobaan di memori dan mengirimnya sendiri bersama `Origin` server (POST bercookie wajib Origin tepercaya). Sosial, passkey dan tamu tidak memicu 2FA, sama dengan web.
- **Verifikasi email:** server memakai `requireEmailVerification: false` (web juga membiarkan akun belum terverifikasi masuk; fitur tertentu yang mensyaratkannya: terbit portofolio, jadwal, pembayaran). App mengikuti: daftar → langsung masuk → layar Check your email (kirim ulang, lanjut).
- **Token bertahan setelah sesi keluar:** pertukaran kode butuh sesi hidup, tetapi refresh tidak; token ber-`offline_access` tidak dicabut saat sesi dihapus. App keluar dari sesi Better Auth segera setelah tukar kode.
- **Apple/Google ID token** (`/sign-in/social` + `idToken`): diverifikasi JWKS, issuer, audiens, umur maks 1 jam; nonce dibandingkan bila dikirim (Apple `exact-or-sha256`, Google persis). Audiens Apple = Services ID + bundle id app dari `MOBILE_IOS_APP_IDS`; Google `clientId` = `[web, GOOGLE_CLIENT_ID_IOS]` (web pertama, alur redirect web tetap). Penyedia tetap aktif hanya bila id + secret ada (perilaku web tidak berubah).
- **Pustaka Google:** iOS tanpa modul native: OAuth Google di `ASWebAuthenticationSession` dengan klien iOS + PKCE (yang juga dilakukan SDK Google iOS), lalu ID token dikirim ke server. Android: modul lokal `modules/google-credential` (Credential Manager `androidx.credentials` 1.5.0 + `googleid` 1.1.1, `GetSignInWithGoogleOption`, nonce). `@react-native-google-signin/google-signin` versi gratis ditolak: di Android memakai SDK Google Sign-In lama yang sudah usang; Credential Manager ada di versi berbayar.

**Rancangan final:**

1. Server: plugin `packages/auth/src/native-app.ts` → `POST /api/auth/native-app/consent { client_id, resource }`. Syarat: sesi lewat cookie (+ Origin tepercaya), dibuat < 10 menit lalu, akun tidak diblokir, `resource` salah satu audiens server, klien publik tanpa secret (`token_endpoint_auth_method: none`) yang **semua** redirect-nya milik app (`nativeAppRedirectUris`: `https://rezumi.app/auth/native-callback`, host server sendiri, dan skema `app.rezumi:` hanya bila `FLAG_ALLOW_UNSAFE_OAUTH_REDIRECT_URI`). Membuat/memperluas baris persetujuan (scope dibatasi scope klien). Rate limit 10/menit. Galat `INVALID_CLIENT`, `SESSION_NOT_FRESH`, `INVALID_TARGET`. `/oauth2/authorize` dan halaman persetujuan tidak berubah untuk klien lain. Daftar redirect yang sama dipakai `firstPartyRedirectUris` (billing, tanpa perubahan isi).
2. Server: `GET /api/openapi/auth/providers/native` (publik, tambahan) → `{ apple, google: { webClientId, iosClientId } | null }`. Env baru `GOOGLE_CLIENT_ID_IOS` (publik, bukan rahasia).
3. App (`src/auth`): `auth-http.ts` (fetch `credentials: "omit"` sehingga cookie tidak masuk penyimpanan cookie platform; jar cookie per percobaan), `native-sign-in.ts` (email, 2FA, daftar dengan username otomatis `usernameFromEmail` di `@rezumi/utils/string` + coba lagi bila terpakai, ID token, tamu, lupa/reset kata sandi, kirim ulang verifikasi; lalu consent → authorize `prompt=none` → token → keluar sesi), `apple.ts`, `google.ts`. `session.ts`: `signInWith` (satu langkah commit untuk browser dan asli), `prepareAuthorization`/`completeAuthorization` (cek state + `iss` yang sama untuk dua jalur), `setSignInServer` (hanya build pengembangan). Penyimpanan token, scope akun, refresh, dan keluar tidak berubah; keluar juga melupakan akun Google Android.
4. Temuan Phase 01 (klien tidak dikenal server) diperbaiki untuk jalur asli: `INVALID_CLIENT` dari consent → lupakan klien, daftar ulang, coba sekali lagi.
5. Layar (`src/features/auth`, `app/(auth)`): Welcome (`/sign-in`), Sign in (`/sign-in/email`), Create account, Check your email (`/check-email`, di luar `(auth)` karena akun sudah masuk), Forgot password, Reset (`/auth/reset-password?token=`, tautan app di iOS + Android, terbuka tanpa masuk), 2FA (kode 6 digit + kode cadangan), lembar More ways (GitHub/LinkedIn/passkey/OIDC lewat browser). Baris Server hanya di build pengembangan. Tautan yang dibuka saat belum masuk → Welcome, lalu layar tujuan setelah masuk (`src/auth/after-sign-in.ts`); sesi kedaluwarsa → masuk lagi lalu kembali ke layar semula.
6. Apple dan Google asli hanya ditawarkan untuk server resmi (`DEFAULT_SERVER`): ID token tidak terikat ke server, jadi server lain tidak boleh mengumpulkannya.

**Tinjauan keamanan terpisah** (agen baca-saja, 2026-11-21): tidak ada temuan Kritis/Tinggi. Diperbaiki: tautan reset sempat meminta masuk dulu; skema `app.rezumi:` kini hanya dengan flag pengembangan; audiens Apple dari `MOBILE_IOS_APP_IDS` (bukan kode keras); Apple/Google hanya untuk server resmi. **Risiko diterima, perlu tindakan pemilik:** klien OAuth Google iOS tidak punya rahasia, sehingga aplikasi pihak ketiga bisa meminta ID token untuk klien itu (phishing dengan layar persetujuan Google bernama Rezumi). Nyalakan **App Check / atestasi app** untuk klien iOS di Google Cloud bila tersedia. Catatan lain: `fetch` React Native selalu mengikuti redirect (opsi `redirect` tidak didukung); aman karena server menjawab JSON untuk `Accept: application/json`.

**Tes:** server `apps/server/src/http/native-sign-in.integration.test.ts` (4: alur penuh + token bertahan setelah keluar + refresh; klien pihak ketiga/campuran/tak dikenal, resource asing, tanpa sesi, Origin asing/tanpa Origin, sesi basi; 2FA wajib + kode salah + kode dipakai ulang; ID token Apple/Google palsu), memakai `AUTH_SECRET` yang sama dengan `oauth-flow` karena CI berbagi database dan JWKS terenkripsi. App: `auth-http` 4, `native-sign-in` 5, layar 14, kekuatan kata sandi 1, parser +1; `@rezumi/utils` `usernameFromEmail` 2. Rate limit plugin hanya aktif di produksi (tidak diuji di tes; aturan 10/menit tercatat di plugin).

**Diuji di iPhone 17 simulator (iOS 27.2, server lokal):** daftar akun asli → Check your email → Home akun baru (tanpa data akun lama); keluar → kata sandi salah (pesan) → masuk; lupa kata sandi → tautan reset (`app.rezumi://auth/reset-password?token=`) terbuka tanpa masuk → kata sandi baru → token app lama dicabut server; Indonesia + gelap. iOS menawarkan "Use Strong Password" di Create account (isi otomatis jalan). **Belum diuji:** Sign in with Apple dan Google sungguhan (butuh build native baru dengan hak `usesAppleSignIn`, akun Apple di simulator, kunci Google pemilik, dan server resmi), layar 2FA di simulator (diuji lewat tes), Maestro, Android.

**Perubahan native (perlu build baru, fingerprint berubah):** `ios.usesAppleSignIn: true`; modul lokal `modules/google-credential` (Android saja); `intentFilters` + AASA menambah `/auth/reset-password`. Tidak ada dependensi npm native baru (`expo-apple-authentication` dari Phase 01 kini dipakai; dikeluarkan dari pengecualian knip).

## 17. Hasil Phase 05: onboarding dan pengalaman pertama (2026-11-21)

**Logika bersama dipindah (K9, bagian 5):**

- `@rezumi/career` (paket baru, `runtime:universal`, `role:domain`), subpath `./onboarding`: `ONBOARDING_STEPS`, `nextStep`/`previousStep`, `skipSaves`, `needsOnboarding`, `answersOf`/`sameAnswers`, `offeredTemplates`, `isOnboardingStep`. Tes pindah dari web (`steps.test.ts`); `shouldStartOnboarding` web (baca cache web) tetap di web dengan tesnya sendiri (`redirect.test.ts`).
- `@rezumi/resume/profile-sources`: model sumber web (`model.ts`) pindah utuh, dibuat generik atas jenis file (`SourceInputs<F>`, `SourceRequest<F>`: `File` di web, dokumen terpilih di app; kunci file `nama:ukuran:lastModified|uri`, sama untuk web). Ditambah bagian murni hook web: `createSourceRunner` (percobaan per sumber, jawaban lama dibuang, `initial` untuk run yang dilanjutkan; fungsi baca dikirim per `run`/`retry`, bukan disimpan, supaya selalu yang terbaru tanpa membaca ref saat render), `keptPhoto`, `clearEditedProblems`, `withKeptPhoto` (salin foto lewat `adoptPhoto`, file apa adanya). `canRetrySource` membaca `code` dari bentuk galat (`sourceErrorCode`) sehingga paket tidak bergantung pada `@orpc/client`. Web memakai semuanya; perilaku web tidak berubah.

**Server (menambah, tidak mengubah):** `profile.sources.file` (`POST /profile/sources/file`, `Internal`, multipart `file` + `format`): membaca CV tanpa AI (lapisan teks PDF, ekspor LinkedIn, JSON Rezumi/JSON Resume) menjadi data Profil untuk ditinjau, tanpa menyimpan. Pembacaannya sama dengan impor (`readResumeFileData` diekstrak dari `importResumeFile`). Alasan: web membaca format ini di browser (pdf.js, fflate), app tidak; iOS tidak memakai Rezumi AI, jadi tanpa ini PDF hampir tidak bisa dibaca di iPhone.

**App:**

- Rute: `app/(auth)/intro.tsx` (sekali per pemasangan, kunci kv `mobile:intro-seen`; `app/index.tsx` membukanya sebelum Welcome), `app/onboarding.tsx` (layar penuh di atas Home, tanpa gestur kembali; tombol kembali Android = langkah sebelumnya).
- `src/features/onboarding`: layar (`onboarding-screen.tsx`, `intro-screen.tsx`), sumber (`source-fields`, `source-progress`, `source-review`, `messages`, `use-sources-flow`), `questions`, `template-choice` (thumbnail dari data Profil lewat mesin PDF native dan antrean thumbnail yang ada; iOS hanya template yang bisa dipakai, Android berlabel + penjelasan paket tanpa ajakan beli), `read-file.ts` (PDF/Word ke AI bila ada koneksi AI yang boleh dipakai app; selain itu server; Word wajib AI; `.doc` ditolak), `saved-run.ts` (run disimpan per akun di kv: langkah, isian teks, jawaban, hasil sumber yang selesai, centang, foto, template, versi Profil yang disimpan; file sendiri tidak disimpan), `queries.ts` (`shouldStartOnboarding`).
- **Kapan dibuka:** Home memanggil `useOnboardingRedirect` → `shouldStartOnboarding`: akun bukan tamu (tamu = `sources.status().website === false`), Profil belum pernah disimpan, tanpa dokumen; **atau** run tersimpan yang sudah menyimpan Profil dan berhenti di pilih template (dilanjutkan). Dokumen yang muncul atau Profil yang disimpan di tempat lain membuang run tersimpan. Baca yang gagal tidak menahan Home.
- **Persetujuan AI:** `profile.sources.website` masuk daftar operasi AI di `src/api/ai-consent.ts` dan dipetakan ke `profile-website` (2 kredit) di `creditActionOf`; dialog persetujuan menyebut biaya di Android. Menolak dialog = sumber gagal dengan pesan dan Retry.
- **Keadaan pertama kali:** Home dan Documents tanpa dokumen menawarkan "Bring in my details" (membuka onboarding lagi, kapan saja) dan Start a document / New document.
- **Izin (K5):** `PermissionPrimer` di `src/ui` + `askPermission` di `src/shell/permissions.tsx` (host dipasang di `app/_layout.tsx`): lembar penjelasan, lalu dialog sistem hanya setelah Continue; izin yang ditolak permanen menawarkan Settings. Dipakai notifikasi pengingat, kamera foto akun, mikrofon latihan. Pemilih foto galeri (PHPicker/Photo Picker) tidak butuh izin.
- `ChipInput` baru di `src/ui` (peran, tempat; dipakai lagi di Phase 06).
- **Tidak ada modul native baru.**
- **Diuji di iPhone 17 simulator (iOS 27.2, server lokal):** perkenalan → daftar → Home mengalihkan ke onboarding → GitHub (`octocat`) → peran dan hari kantor → tinjau → simpan → template dengan thumbnail data sendiri → CV pertama di pembuat CV (template, proyek dan Preferensi dicek di database); Skip → Home kosong dengan "Bring in my details"; app ditutup paksa di langkah template → dibuka lagi di sana. **Diperbaiki dari simulator:** bar tombol bawah disembunyikan selama keyboard terbuka (menutupi kolom), hari kantor jadi tag yang membungkus (Segment tujuh pilihan memotong "Apa saja"/"Jarak jauh"), tiap langkah mulai dari atas (`Screen key={step}`), grup tinjau bergaris tepi (kotak centang kosong hilang di atas `surface-secondary` mode gelap). **Catatan:** tag HeroUI di hari kantor tingginya ±28 pt (di bawah 44 pt); cek lagi di Phase 15. GitHub tidak mengirim foto profil (sama dengan web).
- **Belum:** Android (ditunda pemilik), Maestro (`e2e/`: akun baru → file → CV pertama; akun baru → lewati → Home kosong; akun lama → Home), file CV dari pemilih dokumen di simulator, LinkedIn dan situs sungguhan (butuh token treg/Apify dan koneksi AI), tablet.

## 18. Hasil Phase 06: Profil (2026-11-21)

- **Penyimpan draf Profil di paket.** `@rezumi/resume/profile-draft` (`createProfileSaver`, `mergeFollowed`) memegang aturan simpan: kirim setelah ketikan berhenti (800 ms) dengan `expectedUpdatedAt`, edit yang diketik saat menyimpan dikirim berikutnya, konflik versi diserahkan ke editor, gagal (offline) menyimpan edit untuk dicoba lagi. Penyimpan tidak memegang data: tiap editor (zustand web, store app) memberinya Profil terbaru lewat `read`. Web (`apps/web/src/features/profile/store.ts`) memakainya; perilaku sama, tesnya tetap lulus. Tes paket: 7.
- **Store app** `src/features/profile/store.ts`: data sebagai `ResumeData` (`resumeDataFromProfile`) supaya isian dipakai ulang; riwayat undo dengan aturan gabung yang sama dengan draf CV; konflik **tidak** memuat ulang otomatis (beda dari web) tetapi membuka lembar pilih versi (`ProfileConflictSheet`: simpan perubahanku → kirim ulang di atas versi baru; pakai versi tersimpan → konfirmasi lalu muat). Gagal simpan → catatan "belum tersimpan" + Retry, dan kirim ulang saat `onlineManager` kembali online; simpan saat app ke latar belakang dan saat tab ditinggal.
- **Sumber tulis** `src/features/entries/source.tsx` (`WriteSource`: `useData`, `getData`, `update`, `undo`, `useLocked`, `usePage`, `focus`), seperti `write/source.tsx` di web. Komponen isian baru di `src/features/entries/` di atas `src/ui`: `BasicsForm`, `PhotoField` (kamera/galeri, unggah `/files`), `EntryFields` (teks, tanggal, tautan, teks kaya, kata kunci, level lewat Slider, ikon, peran), `DatesField`, `RichTextField` + `RichTextToolbar`, `IconPickerSheet`, `EntryEditor`, `SummaryEditor`. Model dan skema isian tetap di `features/write/{model,fields,dates,rich-text}.ts`. **Phase 07** menambah `resumeWriteSource` (di atas `useResumeStore`) dan memakai komponen ini untuk Write, lalu menghapus `features/write/*` lama; yang belum dibawa: Improve (AI per baris), warna ikon, pengaturan foto halaman.
- **`MonthPicker`** baru di `src/ui` (bulan/tahun: dialog Android, roda iOS di lembar); `ListRow` menerima `testID`; `useKeyboardVisible` diekspor dari `@/ui`.
- **Rute:** `/profile?tab=details|career|facts|stories|preferences`, `/profile/entry/[section]/[item]`, `/profile/summary`, `/profile/bring`. Tautan web `/dashboard/profile/<bagian>` dan `/dashboard/career/knowledge/<bagian>` membuka bagian yang sama. Rute `profile/knowledge` dan `routes.knowledge` dihapus; tautan cerita dari Prepare membuka Profil → Stories.
- **Dihapus:** `features/career/{knowledge,facts,stories,preferences,search-regions-field}.tsx` (diganti panel di `features/profile/`). `career/shared.tsx` tetap (Offers, jadwal).
- **Temuan:** Hermes iOS tidak punya `Intl.NumberFormat.prototype.formatToParts`; `features/career/amount.ts` membuat Preferences crash (juga di layar lama). Pemisah desimal/ribuan kini dibaca dari string hasil `format`.
- Tanpa modul native baru.

## 19. Hasil Phase 07, bagian 1: inti draf dan model bersama (2026-11-21)

Langkah 1 dan 2 dari `phase-07-dokumen-cv.md` selesai. Belum ada layar yang berubah; langkah 3–9 (Documents, Write, Design, pratinjau, Check/History, kerangka editor, hapus layar lama) menyusul.

- **`@rezumi/resume/draft`** (`packages/resume/src/draft`): mesin draf app (`createDraftStore`) pindah utuh dari `apps/mobile/src/draft/store.ts`, kini di atas `zustand/vanilla` (paket mendapat `immer` dan `zustand`). Isinya: antrean simpan dengan debounce, undo/redo, salinan di perangkat yang bertahan saat app ditutup paksa atau offline, kirim ulang saat tersambung (`replay`), deteksi konflik versi (open dan save) dengan tiga pilihan, penundaan salinan server selama ada isian yang fokus, partisi per akun. Aturan riwayat (`shouldCoalesceEdit`, `joinsUndoStep`, `pushBounded`, `MAX_HISTORY_ENTRIES` 200) dan `changedFields` juga di sini.
- **Tes ditulis lebih dulu untuk perilaku yang ada** (`store.test.ts`, 23; `history.test.ts`, 4): simpan setelah debounce, edit saat menyimpan dikirim berikutnya, dokumen terkunci, flush saat tutup; gabung undo per isian/jendela/`sameStep`, batas 200, nama tetap saat undo isi; offline lalu sambung, Retry setelah gagal, tutup paksa lalu dibuka lagi (juga offline), replay dokumen lain, tulisan yang sampai tetapi jawabannya hilang (tanpa konflik palsu); konflik 3 arah (keep-mine paksa, use-theirs, keep-both menyalin) dan konflik saat simpan; salinan server ditunda selama fokus dan tidak menimpa edit; ganti akun di tengah simpan, draf per akun (akun lain tidak me-replay, keluar menghapus milik sendiri saja), tanpa sesi ditolak.
- **App:** `src/draft/runtime.ts` mengikat store vanilla ke hook (`bindStore`) dan menangani event `mutation: "profile"` (membatalkan cache `profile.get` supaya penanda Profil di Write memakai versi baru). `adapters.ts` (kontrak API resume/surat) dan `native.ts` (SQLite kv, jaringan, AppState, keyboard) tetap di app. Store Profil app memakai `joinsUndoStep`/`pushBounded` (riwayat 200 langkah, sama dengan web; sebelumnya 100).
- **Web:** `useResumeStore` web **tidak** dipindah ke mesin ini pada bagian 1. Ia memakai aturan riwayat dari paket (`shouldCoalesceEdit`, `MAX_HISTORY_ENTRIES`, juga store Profil web) tetapi antrean simpan, `localStorage`, toast, penundaan fokus DOM dan `savePendingChanges` (penjaga navigasi TanStack) masih miliknya. Menyatukan web ke `createDraftStore` adalah sisa syarat "inti draf satu sumber"; risikonya perilaku web (format `rezumi:unsaved:` tanpa akun, pesan toast, penjaga rute), jadi dikerjakan tersendiri dengan tes `draft.test.ts` web sebagai jaring.
- **`@rezumi/resume/write`**: model Write web (`editor/write/model.ts` + tesnya) pindah ke paket, ditambah operasi yang hanya ada di app: `placeSection`, `findPlacement`, `deleteCustomSection`, `moveEntry`, `getCompatibleMoveTargets`, `moveSectionItem`, `removeFromLayout`, dan garis besar ponsel (`outline.ts`: `flattenOutline`, `resolveDrop`, `applySectionDrop`, dengan tes baru). Web mengimpor dari paket; `apps/mobile/src/features/write/model.ts` tinggal selektor store (`readData`, `selectPages`) + ekspor ulang, dan hilang bersama `features/write` di langkah 9.
- **`@rezumi/resume/design-presets`**: preset web (pasangan font, kerapatan, margin, ukuran teks, aksen, Fit) + tambahan app (`parseColorInput`, `contrastOver`, `MIN_CONTRAST`, `isValidHex`, `DATE_FORMATS`, `resetDesign`, filter template). `applyTextSize` kini membatasi judul ke 6–24 pt (batas skema; di web sebelumnya bisa melewati dan ditolak validasi). `src/preview/fit.ts` app memakai `nextFitStep` + `apply*` paket, bukan salinan angka. `features/design/presets.ts` app dihapus. Preset surat (`letters/design-presets.ts`) menyusul di Phase 08.
- **Diuji:** `@rezumi/resume` 340 tes, web (resume, profile, assistant, builder) 133, mobile Jest 428 + `node:test`; typecheck web/mobile/paket; `turbo boundaries`; lint. iPhone 17 simulator (server lokal): CV baru → Basics → ubah headline → "Saved", tersimpan di database. **Belum:** Android (ditunda pemilik), Maestro.

## 20. Hasil Phase 08: surat, cek ATS, bagikan dan ekspor (2026-11-21)

- **Paket:** `@rezumi/resume/custom-domain` (baru: `domainSteps`, `isDomainSettling`, `isRootDomain`, `DOMAIN_SETTLING_REFRESH_MS`, tipe tahap/masalah/paket) dan `isPortfolioLive` + `portfolioHoldsShortLink` di `@rezumi/resume/sharing`, dipindah dari web (`resume/share/domain-progress.ts`, `short-link.ts`, `portfolio/status.ts`) bersama tesnya; `profileHasCareer` pindah ke `@rezumi/resume/profile`. Web mengimpor dari paket. Surat memakai `@rezumi/resume/design-presets`; `letters/design-presets.ts` app dihapus. Nama preset dalam bahasa app ada di `features/design/preset-names.ts` (kunci aksen memakai label paket, karena penjaga desain menolak string hex di layar).
- **Dari (From) surat:** sama dengan web: Profil (bawaan, `senderLinked` tanpa `sourceResumeId`), sebuah CV (tertaut), atau "Surat ini saja" (`senderLinked=false`, isian nama/headline/email/telepon/lokasi/situs). Isian sendiri disimpan lewat draf; adaptor surat (`src/draft/adapters.ts`) mengirim `basics` hanya bila `senderLinked` mati dan `style.basics` berubah, jadi detail tertaut tidak pernah ditimpa. Ganti sumber tetap lewat `relinkLetter` (di luar undo). Draf AI ditawarkan juga dari Profil bila Profil berisi karier (`profileHasCareer`), seperti web.
- **Bagikan:** `features/share/{pane,link,web-page,custom-domain}.tsx` di `src/ui`. Domain kustom: langkah koneksi, `refetchInterval` selama Cloudflare bekerja, galat selain penolakan fitur (412/403/404) tampil dengan Coba lagi (review §21), enam teks masalah, pemberitahuan masa tenggang/pengalihan, chip Plus bila portofolio aktif dan paket tidak mencakup domain, konfirmasi sebelum memutus domain aktif, "Use www" untuk domain root. Pemberitahuan masa tenggang menulis "Your page keeps its address on Rezumi." di kedua platform, tanpa tombol (K6; diperbaiki di review §21, sebelumnya Android punya "See plans"). QR hitam di atas putih agar tetap bisa dipindai di mode gelap.
- **Ekspor:** `features/share/export-options.tsx` (daftar format, nama berkas, pemberitahuan) dipakai Unduh CV dan Unduh surat. Isian di lembar putih memakai `variant="secondary"`. Berkas melewati lembar bagikan sistem (Simpan ke File / app lain); diperiksa di simulator: PDF surat terbuka di app Preview.
- **Cek ATS:** layar ditulis ulang; tetap PDF saja karena `POST /pdf-checks` hanya membaca PDF (rencana menyebut DOCX). Halaman asli tanpa cubit-perbesar lagi (ikut gulir layar). `ats-checker` masuk daftar `overTabs` di `app/_layout.tsx` (tombol kembali tanpa "(tabs)").
- **Tes lama:** `scripts/share.test.mjs` dihapus, bagian Unduh/Ekspor di `experience.test.mjs` dan `OriginalPage` di `layout.test.mjs` dibuang; perilakunya (satu berkas meski ditekan dua kali, tidak mengekspor teks basi setelah gagal simpan, PDF offline) kini di Jest `download.test.tsx`.

## 21. Review Phase 02–08 (2026-11-22)

Satu sesi meninjau kode Phase 02–08 (lima peninjau baca-saja per area, lalu perbaikan dengan kepemilikan berkas ketat) dan menggabungkannya ke satu branch dari `main` terbaru (`feat/mobile-02-08-review`; Phase 01 sudah di `main` lewat PR #103). Yang berubah dan perlu diketahui phase berikutnya:

- **Akun, bukan server:** penyunting Profil, Fakta, dan Cerita kini terikat pada akun (`features/profile/account.ts`, cakupan `getAccountScope`), bukan alamat server. Sebelumnya Profil akun A bisa tampil dan tersimpan ke akun B di server yang sama. Sesi kedaluwarsa tidak lagi membuang edit; keluar akun dan ganti akun menutup penyunting.
- **Edit Profil bertahan setelah app ditutup paksa:** `features/profile/pending.ts` menyimpan edit yang belum terkirim per akun di kv (`rezumi:profile-pending:<scope>:edits`), dikirim ulang saat Profil dibuka, dibuang bila server ternyata sudah memilikinya. Run onboarding pindah ke `rezumi:onboarding:<scope>:run`; dua awalan itu ikut dihapus saat keluar akun (`scopedStoragePrefixes`). Sumber yang masih memuat saat app ditutup dijalankan ulang saat onboarding dilanjutkan.
- **Mesin draf (`@rezumi/resume/draft`):** simpan yang jawabannya hilang tidak lagi menjadi konflik palsu saat Coba lagi / replay / sambung ulang (catatan `sent` per draf, dibandingkan dengan salinan server); kunci yang datang saat ada edit tertunda memberi status `error` (bukan "Menyimpan…" selamanya) dan membuka kunci mengirim edit itu. Web resume dan Profil memakai `joinsUndoStep` dari paket. Web resume masih punya antrean sendiri (tanpa `expectedUpdatedAt`); menyatukannya tetap bagian Phase 07 yang terbuka.
- **`profile-draft`:** `saveNow` saat simpan sedang berjalan kini mengembalikan `false` bila simpan itu konflik/gagal (web `fill.tsx` ikut berhenti dengan benar).
- **Masuk:** email reset kata sandi kini berisi tautan halaman langsung `/auth/reset-password?token=` (bukan lompatan `/api/auth/reset-password/:token`), supaya Universal/App Link membuka app; web tetap sama. Opsi tamu dihapus dari app (tidak ada cara memindahkan data tamu ke akun asli di app; server produksi mematikannya). Tekan ganda tidak lagi dibaca sebagai gagal; 2FA yang kodenya diterima tetapi koneksinya gagal menawarkan "Sign in again"; kode galat Better Auth dicocokkan dengan versi 1.7.12. Tes integrasi menambah klien nonaktif/ber-secret/skema dev dan akun banned.
- **K6:** kartu domain OlaCV (harga, kode diskon, tautan beli) dihapus dari app; pemberitahuan masa tenggang domain netral di kedua platform. `showPlanAlert` Android masih menambah kalimat "Plans can be bought on the rezumi.app website" dan layar Membership Android masih ada: diselaraskan dengan K6 di Phase 14.
- **Bersama dengan web:** `getDefaultFileName`/`sanitizeFileName` → `@rezumi/utils/file-name` (nama berkas CV, surat, dan surat pendamping sama di web dan app); `timeSinceParts` di `@rezumi/resume/sharing` (Hermes salah memformat `Intl.NumberFormat` `style: "unit"`; app memformat dengan Lingui `plural`); laporan ATS membawa `document.checkedPageCount` (DTO `pdf-checks` dan `docs/spec.json` ikut; deploy backend sebelum app). Web memakai `TEMPLATES`/`matchesFilter`/`DATE_FORMATS`/`resetDesign` dari `@rezumi/resume/design-presets`.
- **Tautan app:** daftar awalan server (AASA), `intentFilters` Android, dan parser kini sama (termasuk `/dashboard/settings/{authentication,job-search,api-keys,integrations}`), dijaga `src/linking/app-links.test.ts`. Mengubah `app.config.ts`, jadi butuh build native baru.
- **Kerapian:** shim `ui-legacy` (`safe-area`, `use-pull-refresh`, `keyboard`, `motion`) dihapus, impor menunjuk `@/ui/*`; ekspor barrel legacy dipangkas; `knip.json` tidak lagi menyamarkan berkas app sebagai entry (yatim baru langsung ketahuan); `apps/mobile/uniwind-types.d.ts` dilacak git supaya typecheck checkout bersih (CI) lulus. Toast HeroUI dan legacy berada 12 pt di atas bar bawah yang tampil (`setToastBarHeight`). `useResolveClassNames` diekspor dari `@/ui` untuk input native tanpa `className` (editor teks kaya). `src/shell/editor-bar.tsx` tetap di daftar legacy dengan alasan tercatat sampai Phase 07 langkah 8.
- **Belum:** editor surat masih kerangka lama (Phase 07 langkah 8); dua field teks kaya (`entries`, `letters`) belum disatukan; pengelompokan `issueRows` ATS masih disalin dari web; semua cek Android (ditunda pemilik).
- **Navigasi ponsel jadi laci (permintaan pemilik, 2026-11-22):** tab bar bawah dihapus. `PushDrawer` baru di `src/ui/drawer.tsx` (Reanimated + Gesture Handler, tanpa dependensi baru; ditulis sendiri, perilaku mengikuti laci app X) membungkus navigator `Tabs`; isi laci di `src/shell/app-drawer.tsx`. Slot tab bar ponsel merender `PhoneTabBridge` (tidak menggambar apa pun, menyerahkan state navigator ke laci), jadi tiap bagian tetap punya tumpukan sendiri dan menekan bagian yang terbuka kembali ke puncaknya. Geser tepi hanya di layar utama bagian (`/home`, `/documents`, `/applications`, `/portfolio`, `/profile`) supaya tidak berebut dengan gestur Back iOS. Layar bagian kini berakhir di atas indikator home (tepi bawah aman di layout, kecuali saat keyboard terbuka). Tautan akun dan konfirmasi keluar dipakai bersama sidebar tablet (`useAccountLinks`, `useSignOutConfirm`). Alur Maestro `e2e/navigation.yaml` ditulis ulang untuk laci.

## 22. Hasil Phase 07, langkah 3–9: Documents, pembuat CV, kerangka editor (2026-11-22)

- **Kerangka editor** `src/shell/builder-chrome/` (CV dan surat): `EditorTopBar` (Kembali, `EditableTitle` di atas status simpan, undo/redo, asisten, Unduh, menu ⋯), `ModeBar` di kaki (Write · Page · Design · Check · Share, hitungan Check), tablet tetap `Segment` di bar + halaman di samping panel 400 pt (`size.panel`). Slot baru `onRename` dan `history` diisi `DraftChrome` dari store draf mana pun; keluar setelah simpan ditolak bertanya dulu (perubahan tetap di perangkat; `useUnsavedChangesGuard` mendapat `leaveLabel`). `editor-bar.tsx` dan pengecualian legacy-nya dihapus.
- **Pratinjau:** `ResumePage` (`src/preview/page.tsx` + `page-parts.tsx`) di atas `src/ui`; cubit/ketuk ganda tetap; tombol **layar penuh** di bar zoom membuka `routes.preview(id)` / `routes.letterPreview(id)` (modal layar penuh). `use-page-zoom` dan `usePreview` lepas dari token lama.
- **Documents** (`src/features/documents`): daftar/kisi Legend List, segmen All/Resumes/Letters/Trash (`?segment=`; `routes.trash()` kini `/documents?segment=trash`, rute `documents/trash` dihapus), cari, urut, tag, menu dokumen (lembar dengan langkah Rename/Tags/Link to application), geser baris, impor, lembar New. Menu editor pindah ke `features/documents/document-menu.tsx`. Aturan pustaka bersama: `@rezumi/resume/documents` (web memakainya). Dibuang dari app lama: pilih banyak (batch); pilihan daftar/kisi belum diingat.
- **Write** (`src/features/write`): garis besar dengan seret (`SortableList` di atas `react-native-reorderable-list`, sudah dependensi; aksi pembaca layar untuk setiap pindah), lembar bagian (ganti nama, kolom, Move to), entri layar penuh di atas `src/features/entries` lewat `resumeWriteSource`, foto dan pengaturan foto halaman, Improve, label isian kustom, chip keahlian, warna ikon, **penanda Profil** (aturan di `@rezumi/resume/profile-link`, dipakai web). Satu field teks kaya untuk CV dan surat (`entries/rich-text-field.tsx`, `tools="resume" | "letter"`). Belum: seret belum dicoba dengan jari; unggah foto CV memotong persegi (lewat `PhotoField`); ikon bagian tanpa gaya.
- **Design** (`src/features/design`): satu daftar kartu (Template, Entries, Type, Color, Icons, Page, Advanced) + layar `routes.design(id, screen)` untuk galeri template (filter bidang kerja dan tata letak, coba lalu Apply/Cancel, gambar dari CV sendiri atau `/templates/thumb`), tipografi (font unggahan tetap bisa diunggah), warna, halaman, tata letak. Logika baru di paket: `@rezumi/resume/layout`, `suitsCareerField`/`templateSample`/`hasTemplatePreviewContent` di `design-presets`, `getNextWeights` di `@rezumi/fonts`. Web memakainya; satu perubahan perilaku web: menghapus halaman memindah sidebar ke Main bila halaman tersisa lebar penuh (seperti app).
- **Check dan History:** logika cek di `@rezumi/resume/check` (issues tanpa kata-kata, `page`, `job-match` dengan matcher disuntik, `review`, `pdf-rows`); kata-kata tetap per app (paket tidak memakai Lingui). Cek ATS app dan web memakai `groupPdfFindings` (urutan baris web kini selalu danger → warning → accent). History: pulihkan langsung dengan Undo, hapus versi bernama dengan konfirmasi. Pin masalah tampil di lembar halaman milik Check, belum di Page/tablet (butuh prop `overlay` di `ResumePage`).
- **`src/ui` baru:** `ModeBar`, `EditableTitle`, `ProgressCircle`, `PickerSheet`, `NumberStepper`, `ValueSlider`, `SortableList`/`SortableHandle`, `ColorField` (galeri kecuali `SortableList`, yang tampil di Write).
- **Belum:** draf CV web masih antrean sendiri (bukan `createDraftStore`); Maestro alur phase; perbandingan PDF app vs web; semua cek Android (ditunda pemilik).

## 23. Review Phase 07 sebelum merge (2026-11-22)

Lima peninjau per area (kerangka editor, Documents/History, Write, Design, Check), lalu lima perbaikan dengan kepemilikan berkas terpisah di satu worktree. Bug utama yang diperbaiki:

- **Kerangka:** hitungan Check hanya tampil saat Check terbuka (kini `CheckBadge` di kerangka, juga di segmen tablet); inset sisi di bar tablet dan iPhone miring, inset nyata di pratinjau layar penuh; jarak bawah ganda di atas `ModeBar`; Edit di pratinjau tidak lagi menumpuk pane; `ValueSlider` bisa diatur pembaca layar; label Back netral.
- **Documents/History:** gagal simpan tag dan pindah ke Sampah kini memberi tahu; Trash mengabaikan pencarian; baris yang digeser tidak terbawa ke dokumen lain saat daftar mendaur ulang baris; status (New, Public, Locked, belum sinkron, perusahaan tertaut) ikut dibacakan; impor yang dibatalkan memperingatkan unggahan yang mungkin sudah selesai; gagal tautkan lamaran tetap membuka dokumen; Undo di History memakai id versi dari server, bukan jam perangkat; aksi menu yang membuka layar lain menunggu lembar selesai tertutup (`Sheet` kini punya `onDidDismiss`).
- **Write:** Move up/down pembaca layar kini di elemen yang bisa difokus dan hanya yang bisa jalan; Add from Profile tidak lagi menggandakan entri yang sudah dipindah ke bagian kustom (`missingFromProfile` di paket, web ikut); Move to lokasi sekarang tidak memindah; hapus label dan pindah detail kontak jadi langkah undo sendiri; surat dengan tabel tetap bisa diedit.
- **Design:** template terkunci tidak bisa dipasang lewat keterangan "tap to apply" (satu `useApplyTemplate`); seret yang batal tidak memindah bagian; Undo di toast hanya membatalkan langkahnya sendiri, tanpa toast bila draf menolak; cek kontras memakai warna latar CV yang sebenarnya; `ColorField` bersama dipakai di layar warna; tanpa zona Sidebar untuk template satu kolom; subpath ringan `@rezumi/resume/template-sample` (beranda web tidak lagi memuat skema zod); contoh template onboarding ikut bahasa.
- **Check:** lembar halaman membuka halaman tempat pin/istilah; nomor halaman dijepit saat CV menyusut; hasil pembaca PDF tidak hilang saat ganti tampilan (tanpa unggah ulang); simpan lamaran yang gagal ditautkan hanya mengulang tautan (dan mengirim `resumeId` seperti web); tautan yang sedang jalan tidak dibatalkan saat layar ditutup; pin bertumpuk berjarak 44 pt; duplikat `WritingNote`/`isSameSelection` di web dihapus.

Tes: mobile 33 node + 795 Jest, resume 418, fonts 28, web 913; typecheck mobile/web/resume, lint, format, knip, boundaries lulus. iOS simulator (iPhone 17): hitungan Check di Write, label Back, status di label baris Documents, Open dari menu setelah lembar tertutup, Check dan "Show on page". Sekali, mengetuk Check sesudah membuka CV pertama kali setelah simulator dinyalakan ulang membuka Profil dengan kolom Phone terfokus; tidak bisa diulang (diuji ulang dari awal, Check terbuka normal).

Belum: web `style-groups.tsx` masih memakai `darkenForWhite` dengan asumsi kertas putih (kini tersedia `readableShade`); Write belum menggulir ke bagian dari `?section=` (hanya membuka bagian); `sectionParts` (tambah seluruh bagian dari Profil) bisa membawa kembali entri yang sudah dipindah ke bagian kustom; semua cek Android (ditunda pemilik).
