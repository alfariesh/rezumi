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

| Modul                                                                                  | Untuk                                                | Catatan                                                       |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------- |
| `react-native-webview`                                                                 | Pratinjau Portofolio (K8), embed                     |                                                               |
| `@shopify/react-native-skia`, `react-native-pager-view`, `react-native-reanimated-dnd` | Peer komponen Pro (grafik, carousel/tab geser, urut) | Versi mengikuti `expo install`                                |
| `expo-apple-authentication`                                                            | Sign in with Apple asli (K4)                         | iOS saja                                                      |
| Google Sign-In (pustaka dipilih di Phase 04)                                           | Google asli (K4)                                     | **[cek]** pustaka yang didukung SDK 58 dan Credential Manager |
| `expo-image-manipulator`                                                               | Kecilkan gambar sebelum `portfolio.uploadImage`      | Server tidak mengecilkan gambar                               |
| `@internationalized/date`                                                              | Peer pemilih tanggal Pro                             | JS saja                                                       |

**Terpasang di Phase 01 (2026-11-21, `expo install`, SDK 58):** `react-native-webview` 14.0.1, `react-native-skia` 3.10.2 (paket tanpa scope; itulah yang dimuat HeroUI Native Pro, bukan `@shopify/react-native-skia`), `react-native-pager-view` 9.0.7, `react-native-reanimated-dnd` 2.0.0, `expo-apple-authentication` 58.0.3, `expo-image-manipulator` 58.0.16, `@internationalized/date` 3.12.4, dan `expo-blur` 58.0.6 (peer opsional HeroUI Native yang dipakai satu komponen Pro; ditambah sekarang supaya tidak memicu build ulang nanti). Google Sign-In ditunda ke Phase 04 (pustaka belum dipilih). `expo-observe` **dihapus** (butuh proyek Expo; diganti `src/shell/error-boundary.tsx`).

Sudah terpasang dan cukup: `expo-image-picker`, `expo-document-picker`, `expo-audio`, `expo-notifications`, `expo-sqlite`, `expo-secure-store`, `expo-sharing`, `expo-print`, `react-native-qrcode-svg`, `expo-haptics`. Pustaka yang mungkin bisa dibuang setelah migrasi: `phosphor-react-native`, `@radix-ui/*` dan `react-dom`/`react-native-web` bila galeri web tidak dipertahankan (putuskan di Phase 02).

## 4. Masuk dan daftar asli (K4)

Tujuan: layar asli tanpa mengubah model token yang ada (access + refresh token OAuth, disimpan dan diputar oleh `src/auth/session.ts`).

Rancangan awal, **diverifikasi lewat spike di awal Phase 04**:

1. Layar asli memanggil endpoint Better Auth yang sudah ada: `/sign-in/email`, `/sign-up/email` (butuh `username` dan `displayUsername`), `/request-password-reset`, verifikasi email, `/two-factor/*`, dan masuk sosial dengan **ID token** dari Apple/Google asli.
2. Hasilnya adalah sesi Better Auth. App **tidak menyimpan** sesi itu; app langsung menukarnya menjadi pasangan token OAuth dengan menjalankan alur authorization code + PKCE yang sama **tanpa membuka browser** (permintaan `authorize` membawa sesi, klien pihak pertama melewati layar persetujuan), lalu menukar kode seperti sekarang. Pola klien pihak pertama mengikuti yang dipakai ekstensi browser (`.agents/docs/plans/plugin-browser/`, `packages/auth/src/config.ts` → `oauthProvider`). **[cek]** cara `@better-auth/oauth-provider` menandai klien tepercaya dan apakah `authorize` bisa diselesaikan lewat `fetch`.
3. Bila langkah 2 tidak bisa dibuat aman, tambahkan satu endpoint pihak pertama di `apps/server/src/http` + `packages/auth` yang menerbitkan pasangan token yang sama untuk sesi yang baru dibuat (terikat PKCE atau attestation perangkat), dengan rate limit dan tes.
4. GitHub, LinkedIn, passkey, OIDC kustom: tetap alur browser yang ada (`ASWebAuthenticationSession` / Custom Tabs), dengan parameter petunjuk penyedia supaya pengguna langsung sampai ke penyedia yang dipilih.
5. Cadangan bila 2 dan 3 gagal uji keamanan: pertahankan alur browser, perbaiki layar pembuka (tombol per penyedia, tanpa baris Server) dan halaman web `/auth/*` untuk tampilan ponsel.

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
