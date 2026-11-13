# Laporan sesi web: onboarding

Ditulis 2026-11-13. Perubahan di `apps/web` (termasuk `locales/*.po`), satu perbaikan gaya di `packages/ui`, `docs/guides/*`, `docs/getting-started/quickstart.mdx`, `docs/docs.json`, `tests/e2e`. Tidak ada commit. `apps/mobile` tidak disentuh.

## Selesai

### Rute dan kapan muncul

- `apps/web/src/routes/onboarding.tsx`: rute `/onboarding`, layar penuh di luar shell dashboard, butuh sesi (tanpa sesi → login). `routeTree.gen.ts` dibuat ulang oleh Vite (dev server dan `pnpm --filter web build`), tidak diedit tangan.
- `apps/web/src/routes/dashboard/index.tsx`: `loader` memanggil `shouldStartOnboarding` (`features/onboarding/redirect.ts`): bukan tamu, `profile.get().updatedAt === null`, dan `documents.list({ trashed: false })` kosong → `redirect` ke `/onboarding`. Dokumen hanya dibaca bila Profil belum pernah disimpan; gagal baca → Home tetap terbuka. Tamu bisa membuka `/onboarding` langsung tetapi tidak dialihkan.

### Alur (`apps/web/src/features/onboarding/`)

- `onboarding-page.tsx`: bingkai (brand, `Stepper` Pro 4 langkah dengan judul tersembunyi di bawah `md`, Skip di kanan atas; pada langkah 4 menjadi "Not now"), judul langkah = `h1` yang menerima fokus tiap ganti langkah (`aria-describedby` ke kalimat di bawahnya), footer lengket dengan Back dan satu aksi utama. Skeleton saat memuat, `CareerLoadError` bila Profil/Preferences gagal dimuat; bila `profile.sources.status` gagal, LinkedIn dan situs disembunyikan dan file + GitHub tetap jalan.
  1. **Bring what you have**: "From your account" (nama, email, foto akun), lalu `SourceFields`. Continue memvalidasi (link LinkedIn, centang "This is my own profile", username GitHub, alamat situs) dan memindah fokus ke kolom bermasalah. "Start from scratch" lanjut tanpa sumber.
  2. **Pertanyaan**: progres per sumber (`SourceProgress`) di atas, `Questions` (posisi incaran, lokasi, hari kantor) memakai `ChipField`/`OfficeDaysField` dari halaman Preferences. Continue tidak pernah menunggu sumber; labelnya menjadi "Review what we found" begitu semua sumber selesai. Jawaban disimpan lewat `career.saveProfile` (digabung ke preferensi yang ada) saat lanjut atau Skip, hanya bila berubah.
  3. **Review**: `SourceReview` (foto + kelompok dengan hitungan dan centang). Tombol simpan nonaktif selama ada sumber yang masih dibaca ("Waiting for LinkedIn…"). Simpan = `finishReview` (foto yang dipilih disalin `adoptPhoto`) lalu `profile.update` dengan `expectedUpdatedAt`; konflik versi → Profil dibaca ulang dan review dihitung ulang dengan toast. Tanpa hasil → keadaan kosong "Nothing new to add" dan tombol Continue (tetap menyimpan).
  4. **First resume**: `TemplateChoice` menggambar kartu dengan isi Profil yang baru disimpan dan preset template (sama dengan hasil `resume.create`), 6 template pertama yang dibuka paket, "More templates" untuk semua (yang terkunci ditandai Plus dan membuka dialog paket). "Create my resume" → `resume.create({ ..., template })` → `/builder/$resumeId`.
- Start from scratch melewati Review (Profil disimpan apa adanya saat meninggalkan langkah 2).
- Skip: menyimpan Profil apa adanya bila belum disimpan di onboarding (konflik versi dianggap sudah tersimpan), menyimpan jawaban yang berubah, lalu ke `/dashboard`. Cache `profile.get` diperbarui sehingga redirect tidak memantul.
- `steps.ts`: urutan langkah, lompatan review saat tanpa sumber, aturan Skip. `questions.tsx`, `template-choice.tsx` (`offeredTemplates`).

### Satu implementasi sumber dan review (`apps/web/src/features/profile/sources/`)

- `model.ts` (murni): `readSourceInputs` (memakai `linkedInProfileId`/`gitHubLogin` dari server, `websiteAddress`), `requestsToRun`/`keepRequested` (yang sudah ditemukan tidak dibaca ulang, yang gagal/berubah dibaca ulang, yang dikosongkan dibuang), `mergeSourceResults` (urutan file, LinkedIn, GitHub, situs, `mergeProfileData`), `photoCandidates` (LinkedIn, akun, file, GitHub, situs; unik), `reviewGroups`/`applyReview`/`countReviewEntries`, `canRetrySource`, `sourceFindings`.
- `messages.ts`: label sumber, pesan per kode (`SOURCE_*`, `INSUFFICIENT_CREDITS`, `AI_SOURCE_REQUIRED`, `REZUMI_AI_UNAVAILABLE`, `TOO_MANY_REQUESTS`, offline, file), catatan (`private-profile`, `no-public-repos`, `truncated`). Pesan AI situs lain memakai pesan server (aman ditampilkan, menurut laporan server).
- `use-source-runs.ts`: tiap sumber berjalan sendiri dengan nomor percobaan (jawaban lama dibuang), Retry per sumber; file dibaca dengan `useReadResumeFile` + `detectImportKind` lalu `profileFromResume`; situs memakai `aiSourceFields(useAiSource())`; kegagalan kredit/paket membuka dialog yang sudah ada.
- `use-sources-flow.ts`: state satu run (input, masalah, hasil, centang, foto), `finishReview`, `keepPhoto`.
- `source-fields.tsx` (`SourceFields`, `SourcesNote`, `focusFirstProblem`), `source-progress.tsx`, `source-review.tsx`.
- Halaman Profil (`features/profile/fill.tsx`): kartu kosong sekarang "Bring what you have" (dialog, layar penuh di ponsel) dengan komponen yang sama: sumber → baca + review → "Add N entries" sebagai edit Profil biasa (autosave, toast Undo). "Fill from a resume…" tetap. "Import a file" lama digantikan (file ada di sumber yang sama).

### Pemakaian ulang dan perbaikan kecil

- `TemplateCard` + `PlanBadge` + `layoutTags` dipindah ke `features/resume/editor/design/template-card.tsx` (props `onChoose`, `onPreview?`, `onPreviewEnd?`); `template-group.tsx` dan desain surat memakainya.
- `SECTION_ICONS` dipindah ke `libs/resume/section.tsx` (dipakai Add section dan review).
- `ChipField` (dengan `description`) dan `OfficeDaysField` diekspor dari `features/career/knowledge/preferences.tsx`; halaman Preferences memakai `OfficeDaysField`.
- `features/billing/credits.ts`: nama aksi `profile-website` = "Website read into your Profile".
- `packages/ui/src/styles/globals.css`: checkbox indeterminate kehilangan isian aksennya karena aturan isian checkbox global (tanda minus tidak terlihat di mana pun di aplikasi). Aturan itu sekarang melewati `[data-indeterminate="true"]`.

### Teks

- `pnpm --filter web lingui:extract` dijalankan. 84 string baru diterjemahkan di `id-ID` ("Profil", "CV", "Anda"). Sisa kosong `id-ID`: 150 (sebelumnya 151; "Coach memory" ikut diterjemahkan). Msgid lama yang teksnya tidak berubah tetap.

### Tes

- `features/profile/sources/model.test.ts` (16): sumber mana yang jalan dan masalah input, konfirmasi LinkedIn, sumber yang tidak ditawarkan, alamat situs, jalan ulang/gagal/dibuang, kegagalan independen dan Retry, merge berurutan, review hanya yang baru, `applyReview`, foto tidak ikut merge, kandidat foto.
- `features/onboarding/steps.test.ts` (15): urutan langkah dan lompatan review, aturan Skip, aturan redirect (`needsOnboarding`, `shouldStartOnboarding` termasuk tamu, tanpa sesi, gagal baca), jawaban, `offeredTemplates`.
- E2E `tests/e2e/specs/onboarding.spec.ts` (3 tes, sumber dijawab di browser lewat `mockRpc`, tanpa jaringan ke Apify/GitHub): alur penuh (validasi konfirmasi, gagal independen + Retry, pertanyaan, review dengan satu entri dilepas, template Sterling, Profil dan Preferences tersimpan lewat REST, Home tidak memantul), Skip, Start from scratch → Not now. `tests/e2e/fixtures/rpc.ts` mendapat `rpcError(status, code)` untuk menjawab dengan penolakan. **Belum dijalankan** (lihat Belum selesai).

### Panduan

- Baru: `docs/guides/setting-up-your-profile.mdx` (masuk `docs/docs.json`, grup Getting Started setelah Quickstart).
- Diperbarui: `using-your-profile` (isi Profil: "Bring what you have"), `getting-started/quickstart` (langkah Skip, mendarat di Home), `creating-an-account` (setup pertama, foto/username GitHub dari login sosial), `creating-your-first-resume`.

### Privasi

- Draf EN + ID: `.agents/docs/plans/profil/draf-privasi-onboarding.md` (baris data, penerima Apify/GitHub, lokasi pemrosesan, butir `[periksa]` untuk owner). `docs/legal/*` tidak diubah. Kalimat di aplikasi (`SourcesNote`) menyebut Apify hanya bila LinkedIn aktif.

### Cek yang dijalankan

- `pnpm --filter web typecheck`: lulus.
- `pnpm --filter web test`: 150 file, 813 tes lulus.
- `pnpm lint:agent`: bersih. `pnpm format:check`: bersih (2839 file).
- `pnpm exec turbo boundaries`: tidak ada masalah.
- `pnpm --filter web build`: lulus.
- `tsc --noEmit --strict` pada `tests/e2e/specs/onboarding.spec.ts` dan `tests/e2e/fixtures/rpc.ts`: lulus.
- Browser (dev server `rezumi-profil`, 3300): dua akun fiktif baru dialihkan dari `/dashboard` ke `/onboarding`; sumber LinkedIn/GitHub/situs dijawab oleh stub `fetch` di halaman (LinkedIn berhasil, GitHub gagal lalu Retry berhasil, situs `SOURCE_NOT_FOUND` tanpa Retry); validasi centang LinkedIn; review (foto, kelompok, centang parsial/indeterminate); simpan; galeri template menggambar data Profil; "Create my resume" membuka builder dengan Sterling dan isi Profil; `/dashboard` tidak lagi dialihkan. Akun kedua di ukuran ponsel 375 px: Start from scratch → pertanyaan → template → Not now → Home. Halaman Profil: dialog "Bring what you have" dengan file JSON Resume asli (dibaca di browser), review, "Add 12 entries", toast Undo. Fokus pindah ke `h1` tiap langkah. Tema gelap dicek sekilas.

## Cross-area

- **Menghambat, `packages/utils/src/app-paths.ts`**: tambahkan `"onboarding"` ke `APP_SECTIONS`. Terlihat di dev: memuat penuh `http://127.0.0.1:3300/onboarding` (reload, link langsung) menghasilkan 404 "This resume isn't shared right now", karena proxy dev Vite (`apps/web/src/libs/dev-server-proxy.ts`, dari `RESERVED_SEGMENTS`) meneruskannya ke server sebagai `/<username>`. Alur dari `/dashboard` tetap jalan karena navigasinya di klien. Di produksi `apps/server/src/static/web.ts` sama (bukan app section → bukan shell SPA), username `onboarding` masih bisa didaftarkan, dan domain alias tidak memindahkannya ke `APP_URL`. Periksa tes yang mendaftar segmen (utils/server) setelah mengubahnya.
- `docs/contributing/career-platform.mdx` → "Keep product guides current": tambahkan `setting-up-your-profile` di baris "Profile details and career…" (di luar kepemilikan saya).
- Mobile parity (`.agents/docs/mobile-release-handoff.md` → Feature parity exceptions): onboarding sumber Profil (LinkedIn, GitHub, situs, file, review, template pertama) dan dialog "Bring what you have" di Profil hanya ada di web.
- Legal: draf privasi menunggu persetujuan owner (lihat file draf).
- Saya hanya menjalankan `pnpm --filter web lingui:extract`; root `pnpm lingui:extract` (extension + `pdf:translations`) tidak dijalankan.

## Belum selesai

- **E2E belum dijalankan**: browser Playwright tidak terpasang di mesin ini (`~/Library/Caches/ms-playwright` tidak ada), dan memasangnya berarti mengunduh Chromium; saya tidak melakukannya. Jalankan dengan resep `tests/e2e/README.md` pada database baru: `pnpm test:e2e tests/e2e/specs/onboarding.spec.ts`.
- **Belum diuji dengan sumber asli**: LinkedIn (tidak ada `APIFY_TOKEN` lokal), GitHub API, pembacaan situs dengan AI, dan `adoptPhoto` asli (stub mengembalikan URL apa adanya). Tampilan pesan kredit/paket untuk situs belum dilihat langsung.
- **Screenshot panduan** (tidak dibuat, tidak dipalsukan); halaman baru belum bergambar. Yang dibutuhkan: `docs/images/guides/setting-up-your-profile/{bring-what-you-have,reading-and-questions,review,first-resume}.webp` (desktop) dan satu tangkapan ponsel; `docs/images/guides/using-your-profile/bring-what-you-have-dialog.webp`. `getting-started/quickstart/documents-empty.webp` masih cocok dengan keterangannya.
- Keterbatasan yang disengaja: state onboarding hanya di memori, jadi reload mengulang dari langkah 1 (sumber dibaca lagi; LinkedIn ikut terhitung 3/hari). Pada jalur "Start from scratch", indikator langkah menandai Review selesai. Galeri template untuk Profil yang hanya berisi nama/email menampilkan contoh template (bukan data user) karena belum ada isi untuk digambar.
- Urutan kolom di layar: LinkedIn, file CV, GitHub, situs (kontrak menulis file terakhir; file saya taruh kedua karena paling umum bagi target user). Urutan merge tetap sesuai kontrak.
- Dua akun uji fiktif dibuat di database lokal `rezumi_profile_dev` (`dewi.onboarding1@example.test`, `rangga.onboarding2@example.test`); yang pertama sudah punya CV dan Profil terisi, yang kedua Profil terisi dari file JSON.
