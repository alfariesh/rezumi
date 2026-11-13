# Laporan sesi server

Ditulis 2026-11-13. S1–S8 selesai. Tidak ada commit. Semua cek di akhir laporan dijalankan sungguhan.

## Selesai

### S1 CV baru

- `packages/api/src/features/resume/initial-data.ts`: `createResumeData({ withSampleData, profile, locale })`. CV kosong = `resumeDataFromProfile(profile, defaultResumeData)` (data diri + semua item Profil, desain default). Isi-nama-saja dari `context.user.name` dihapus. CV contoh tetap isi contoh, hanya nama diambil dari Profil (dulu dari nama akun; Profil yang belum disimpan = nama akun, jadi perilakunya sama).
- `packages/api/src/features/resume/crud.ts`: `resume.create` membaca `profileService.read(userId)`. Deskripsi OpenAPI diperbarui.

### S2 Impor

- `crud.ts` `resume.import`: setelah `resumeService.create` berhasil, `profileService.completeFrom(userId, input.data)` (best effort). `importResumeFile` lewat `call(crudRouter.import)`, jadi ikut. Impor lewat MCP (`import_resume`, `api_rest_import_resume_file`) juga ikut.

### S3 Surat

- Resolver tunggal baru `packages/api/src/features/cover-letters/sender.ts`: `resolveLetterLinks(letter, userId, { client?, lock? })` dan `profileSender(style, profile)`. Dipakai `coverLetterService` (semua baca/tulis) dan `recordSentResume` (`packages/api/src/features/applications/service.ts`, salinan inline dihapus).
- Aturan CV di Trash (dipilih, ada di komentar resolver): CV sumber di Trash **tetap** jadi sumber. Alasannya: CV di Trash tidak bisa berubah, sehingga editor dan versi "terkirim" selalu sama, dan memulihkan CV tidak mengubah surat. Dulu `recordSentResume` mengabaikan CV di Trash sementara editor tidak.
- `packages/api/src/features/cover-letters/service.ts`: `toLetter` hanya memaksa `designLinked: false` tanpa CV; `create` tanpa CV = `senderLinked: true` + salinan pengirim dari Profil; `update` menerima `basics`, `senderLinked: true` tanpa CV boleh, `designLinked: true` tanpa CV tetap `BAD_REQUEST`.
- `packages/api/src/dto/cover-letter.ts`: field `basics` (opsional, `basicsSchema`) di update; deskripsi `senderLinked`, `designLinked`, `resumeId` diperbarui.
- Kontrak lengkap: bagian Cross-area.

### S4 Portfolio

- `packages/portfolio/src/source.ts` (baru): `PortfolioSource = { data: ResumeData; from?: "resume" | "profile" }` dan `portfolioSourceResume(source)`. Diekspor ulang dari `@rezumi/portfolio/view`.
- `packages/portfolio/src/view.ts`: `PortfolioViewInput.resume: PortfolioSource | null`. Bahasa, aksen `resume` dan font `resume` hanya dari sumber CV.
- `packages/portfolio/src/initial.ts`: `createInitialPortfolioData({ resume: PortfolioSource | null, basics?, theme? })`. Sumber Profil: About dan karya dari Profil, aksen preset + font tema, `basics` ketikan dipakai.
- `packages/api/src/features/portfolio/service.ts`: `readPortfolioSource` (Profil saat `sourceResumeId` null; null saat CV sumber di Trash), `startingSource` untuk `create` (aturan default baru), `aiContext` mengembalikan `{ data, source }`, `importWorks` membaca proyek sumber (CV atau Profil).
- `packages/api/src/features/portfolio/public.ts`: `PublicPortfolio.source: PortfolioSource | null` (isi halaman) + `resume` (hanya slug/isPublic/hasPassword/showDownloadButtons, untuk tombol CV/PDF). Profil dibaca tiap tampilan. `updatedAt` = yang terbaru dari portfolio dan Profil (untuk `dateModified` mesin pencari).
- Cache/ETag diperiksa: halaman `Cache-Control: private, no-store`; cache render (`apps/server/src/static/portfolio-page.ts`) dan kartu + ETag (`portfolio-card.ts`) dikunci pada isi view, tidak pada versi portfolio/CV. Tidak ada prerender halaman portfolio di server. Jadi perubahan Profil langsung terlihat (dites di `public.integration.test.ts`).
- `apps/server/src/static/portfolio-page.ts`: view publik, kartu dan vCard dibangun dari `source`; tautan CV/PDF hanya dari `resume`.
- `packages/api/src/features/portfolio/moderation.ts` + `admin-router.ts`: review admin melihat isi yang sama dengan halaman publik (`resumeData` dari Profil bila sumbernya Profil) + field baru `sourceFrom`.
- `router.ts`, `errors.ts`: deskripsi dan pesan "unreadable" menyebut Profil.

### S5 AI membaca Profil

- `packages/api/src/features/profile/context.ts` (baru): `profileMarkdown(profile, limit = 10_000)` (Markdown dengan judul section Inggris, dipotong dengan catatan) dan `readProfileContext(userId)` (null bila Profil kosong).
- Draf surat (`cover-letters/draft.ts`): tanpa CV sumber membaca Profil (`## The candidate's Profile`); tanpa Profil, CV dan lamaran = `BAD_REQUEST` dengan pesan baru. Prompt `packages/ai/src/prompts/letter-draft-system.md` diperbarui.
- AI portfolio (`portfolio/ai/{router,draft,rewrite,metrics,source}.ts`): menerima `source: PortfolioSource`; tanpa CV sumber memakai Profil. Bahasa halaman tidak mengikuti Profil; cek nama (`names`) mati untuk Profil karena bahasanya tidak diketahui.
- Coach: `careerService.context` (`career/service.ts`) punya field baru `details` (Markdown Profil, terpotong) dan versinya masuk hash `version`. `career/tools.ts` memasukkan `profile` ke konteks hanya saat chip memori (`shareMemory`) aktif. Prompt `career-system.md` mengakui Profil sebagai sumber fakta.
- `career.generate` (`career/generate.ts`): `profile` dikirim hanya bila lamaran tak punya CV; aturan sistem menyebut Profil.
- Asisten dokumen: tool `read_profile` (`agent/tools.ts`, handler di `agent/service.ts`, hanya untuk asisten dokumen, bukan Coach), tipe `AgentTools.read_profile` di `packages/ai/src/tools/agent-tool-contracts.ts`, prompt `assistant-system.md` mengizinkan Profil sebagai sumber fakta.
- Tambahan di luar daftar README: `applications.ai.draftMessage` (`applications/ai.ts`) memakai Profil bila lamaran tak punya CV.

### S6 Akun

- Ekspor: `authService.exportData` (`auth/service.ts`) menyertakan `profile: { data, updatedAt } | null` (null bila belum pernah disimpan; nama/email akun sudah ada di `user`). Skema output di `auth/router.ts`.
- Guest → akun: `linkAnonymousAccount` (`packages/auth/src/config.ts`) memindahkan baris `profile` guest (dengan URL upload ditulis ulang) hanya bila akun tujuan belum punya Profil; kalau sudah punya, Profil guest ikut terhapus bersama akun guest.

### S7 MCP

- Pola parity (`packages/mcp/src/parity.ts`): `api_profile_get` (READ_IDEMPOTENT), `api_profile_update` (WRITE_DESTRUCTIVE), `api_profile_save_part` (WRITE_DESTRUCTIVE), `api_profile_fill_from_resume` (WRITE_IDEMPOTENT). Deskripsi di `tool-meta.ts` (dibedakan dari `api_career_profile`).
- Deskripsi `create_resume`, `import_resume`, `create_cover_letter`, `update_cover_letter`, `coverLetters.draft` diperbarui; pesan hasil `create_resume` (`tools.ts`).
- `.agents/docs/mcp-tool-annotations.md`: 4 baris baru + alasan untuk `create_resume`, `import_resume`, `api_rest_import_resume_file` diperbarui.

### S8 Tes

- Baru: `packages/api/src/features/profile/service.integration.test.ts` (DB nyata, `INTEGRATIONS_TEST_DATABASE_URL ?? COVER_LETTER_TEST_DATABASE_URL`, semua migrasi di schema unik): Profil awal (akun vs guest), linked ikut + override tetap + CV terkunci/Trash dilewati + event `profile`, item yang dihapus/ditambah, konflik versi (termasuk `null` sebelum simpanan pertama dan simpan isi sama = versi tetap), data tidak valid, `savePart` (basics, item, item baru, CV Trash/milik orang lain), `fillFromResume` (hanya yang kosong, kedua kali tidak menulis), `completeFrom` (best effort).
- Diperbarui/ditambah: `cover-letters/service.integration.test.ts` (pengirim dari Profil, `basics`, CV di Trash, CV terhapus), `cover-letters/draft.test.ts`, `resume/crud.test.ts` (S1, S2), `portfolio/portfolio.integration.test.ts` (create dari Profil, importWorks dari Profil, CV Trash), `portfolio/public.integration.test.ts` (Profil di halaman publik + perubahan langsung terlihat), `portfolio/ai/ai.integration.test.ts` (metrics dari Profil, sumber tak terbaca), `portfolio/ai/ai.test.ts`, `career/service.integration.test.ts` (konteks + generate), `career/tools.test.ts`, `agent/tools.test.ts`, `auth/export.test.ts`, `auth/account.integration.test.ts` (pindah Profil guest), `packages/auth/src/account-link.test.ts`, `packages/portfolio/src/{view,initial}.test.ts`, tes server (`apps/server/src/static/portfolio-*.test.ts`, `apps/server/src/http/portfolio.test.ts`).

### Spesifikasi

- `docs/spec.json` diregenerasi dengan `pnpm docs:gen` (rute `/profile*`, `profile` di ekspor, field `basics` surat, deskripsi baru). Referensi semantic CSS tidak berubah.

## Cross-area

### S3 Surat: kontrak pengirim (final)

Sumber detail pengirim surat (`style.basics` + `style.picture` di output) dihitung server saat dibaca:

| `sourceResumeId` | `senderLinked` | Pengirim                                                                                                                                                                                                  |
| ---------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ada              | `true`         | `basics` + `picture` CV itu, live. CV di Trash tetap dihitung sebagai sumber (tidak bisa berubah di Trash; yang dilihat editor = yang direkam "terkirim"). CV yang tidak bisa dibaca: salinan di `style`. |
| `null`           | `true`         | **Profil**, live: `basics` Profil + `picture.url` Profil. Pengaturan foto lain (ukuran, rotasi, border, `hidden`, dst.) tetap dari `style.picture` surat.                                                 |
| apa saja         | `false`        | Detail sendiri surat: salinan di `style.basics` / `style.picture`.                                                                                                                                        |

`designLinked` tetap butuh CV: tanpa CV, output selalu `designLinked: false`. `senderLinked` **tidak lagi** dipaksa `false` saat tak ada CV (CV yang dihapus permanen membuat surat yang masih linked ikut Profil).

`coverLetter.create`:

- dengan `resumeId`: seperti sebelumnya (`senderLinked: true`, `designLinked: true` kecuali ada `template`).
- tanpa `resumeId`: `senderLinked: true` (sumber = Profil), `designLinked: false`; salinan `style.basics` + `style.picture.url` diisi dari Profil saat dibuat.

`coverLetter.update` (field baru dan semantik):

- `basics?: Basics` (bentuk `basicsSchema` resume: `name`, `headline`, `email`, `phone`, `location`, `website {url,label}`, `customFields`). Detail pengirim milik surat sendiri. Mengirimnya = `senderLinked: false` (foto dan lainnya dibekukan seperti terbaca saat itu, lalu `style.basics` diganti). Mengirim `basics` bersama `senderLinked: true` = `BAD_REQUEST`. Field lengkap (bukan parsial): kirim seluruh objek basics.
- `senderLinked: true` tanpa CV sekarang **boleh** (sumber = Profil). `designLinked: true` tanpa CV tetap `BAD_REQUEST` (pesan: "Choose a resume to link the design to first.").
- `senderLinked: false` tanpa `basics`: membekukan nilai yang terbaca saat itu (dari CV atau Profil), seperti sebelumnya.
- `resumeId: null` (melepas CV): `senderLinked` tidak berubah, jadi surat yang linked sekarang ikut Profil; tautan desain berakhir (desain dibekukan seperti terbaca).
- `resumeId: "<id>"`: pengirim linked ikut CV itu (seperti sebelumnya).

Pemetaan pilihan "From" di web (W5):

- **Profile** → `update({ resumeId: null, senderLinked: true })`. Catatan: karena pengirim dari CV hanya bila ada `sourceResumeId`, memilih Profil melepas CV (dan tautan desainnya). Kombinasi "pengirim Profil + desain dari CV" tidak ada di model ini.
- **CV X** → `update({ resumeId: X, senderLinked: true, ...(belum punya CV ? { designLinked: true } : {}) })` (seperti sekarang).
- **Detail sendiri** → `update({ senderLinked: false })` lalu tiap edit `update({ basics })`; atau langsung `update({ basics })`.
- Output untuk membedakan di UI: `senderLinked && sourceResumeId` = CV; `senderLinked && !sourceResumeId` = Profil; `!senderLinked` = detail sendiri.

`recordSentResume` (`applications/service.ts`) memakai resolver yang sama (`packages/api/src/features/cover-letters/sender.ts`), jadi versi "terkirim" = yang ditampilkan editor, termasuk pengirim dari Profil.

Draf surat tanpa CV, tanpa Profil dan tanpa lamaran: `BAD_REQUEST` "Fill in your Profile, or link the letter to a resume or an application first." (dulu "Link the letter to a resume or an application first.").

### S4 Portfolio: kontrak sumber (final)

DTO portfolio **tidak berubah bentuknya**. Artinya berubah:

- `sourceResumeId: null` (dan `sourceResume: null`) = **sumber = Profil**. Tidak ada lagi keadaan "tanpa sumber".
- `sourceResumeId: "<id>"` = CV itu. `sourceResume.inTrash: true` = halaman tidak menampilkan bagian karier (seperti sebelumnya, tidak jatuh ke Profil); editor meminta sumber lain.
- `portfolio.create({ sourceResumeId })`: string = CV itu; `null` = Profil; tidak dikirim = Profil bila Profil punya minimal satu item section, selain itu CV utama, lalu CV terakhir diedit, lalu Profil. `basics` yang diketik (name/headline/location) dipakai bila sumbernya bukan CV.
- `portfolio.updateSettings({ sourceResumeId: null })` = pindah ke Profil.
- `portfolio.importWorks({ resumeItemIds })`: dengan sumber Profil, id = id item `profile.data.sections.projects[]`.
- AI portfolio (draft, rewrite, find metrics) tanpa CV sumber membaca Profil; tidak lagi `PORTFOLIO_SOURCE_INVALID` hanya karena tak ada CV (masih bila CV sumber di Trash).
- Admin `portfolio.admin.get` (review): `resumeData` = data CV sumber, atau data Profil sebagai resume (`resumeDataFromProfile`) untuk sumber Profil; field baru `sourceFrom: "resume" | "profile" | null` (null = CV sumber di Trash/tak terbaca). Web admin (`apps/web/src/features/portfolio/admin/review-page.tsx`) perlu meneruskannya: `buildPortfolioView({ resume: review.resumeData ? { data: review.resumeData, from: review.sourceFrom ?? "resume" } : null })`.

`@rezumi/portfolio/view` (paket milik server, dipakai web):

- `PortfolioViewInput.resume: PortfolioSource | null`, `PortfolioSource = { data: ResumeData; from?: "resume" | "profile" }` (default `"resume"`, jadi pemanggil lama tetap jalan).
- Untuk sumber Profil, editor web membangun: `{ data: resumeDataFromProfile(profile.data), from: "profile" }` (`resumeDataFromProfile` dari `@rezumi/resume/profile`, `profile` dari `orpc.profile.get`).
- Sumber Profil tidak punya bahasa atau desain: bahasa halaman, aksen `source: "resume"` dan font `source: "resume"` tidak mengikutinya (jatuh ke default tema). Helper `portfolioSourceResume(source)` mengembalikan `ResumeData` hanya bila sumbernya CV; pakai untuk `portfolioPageLocale(data, ...)` di web (`apps/web/src/features/portfolio/editor/context.ts`), atau kirim `null` untuk Profil. `resolveSectionOrder` hanya membaca custom section, jadi hasilnya sama untuk data Profil atau `null`.
- Pilihan aksen/font "ikuti CV" di editor sebaiknya disembunyikan saat sumbernya Profil (server mengabaikannya).
- Tombol CV/PDF: server hanya mengisi `links.resume` / `links.resumePdf` saat ada CV sumber.
- Halaman publik, kartu, vCard: dibangun dari Profil saat `sourceResumeId: null`. Halaman `no-store` dan cache render/kartu dikunci pada isi view, jadi perubahan Profil langsung terlihat.
- `createInitialPortfolioData` sekarang menerima `resume: PortfolioSource | null` (bukan `ResumeData`). Web tidak memakainya.

### Lain-lain untuk sesi web / principal

- **Asisten dokumen**: tool baru `read_profile` (tipe `AgentTools["read_profile"]`). `apps/web/src/features/assistant/conversation.tsx` `stepOf` belum punya `case "tool-read_profile"`; usul label "Read your Profile" (`id-ID`: "Membaca Profil").
- **Ekspor data (W7)**: `auth.exportData` sekarang punya `profile: { data: ProfileData; updatedAt: Date | null } | null`; null bila Profil belum pernah disimpan.
- **CV baru (W4)**: `resume.create` selalu mulai dari Profil (tanpa input baru). Profil yang belum disimpan = nama + email akun, jadi CV baru sekarang juga mendapat email akun (dulu hanya nama).
- **Coach**: Profil masuk konteks Coach saat chip memori aktif; tidak ada perubahan API untuk web.
- **Mobile**: tidak disentuh; `pnpm --filter mobile typecheck` lolos (field `basics` di DTO surat opsional).
- **Usulan untuk `packages/resume/src/profile.ts`**: tidak ada perubahan wajib. Dua pengamatan untuk principal:
  1. `completeFrom`/`fillFromResume` lewat `write` menjalankan `followProfile`, sehingga bagian CV lain yang **kosong** dan sama-kosong dengan Profil ikut terisi saat Profil dilengkapi (mis. impor CV mengisi telepon Profil → semua CV yang teleponnya kosong ikut mendapat telepon itu). Konsisten dengan model "kesamaan isi", tapi mungkin mengejutkan; bila tidak diinginkan, `followProfile` bisa melewati bagian yang sebelumnya kosong di Profil.
  2. Profil yang belum disimpan berisi email akun; portfolio bersumber Profil dengan `contact.email` aktif akan menampilkan email akun itu di halaman publik (sama seperti CV yang dibuat dari Profil). Editor menampilkannya sebelum terbit, jadi tidak tersembunyi.
- **Dokumen yang dimiliki principal**: `.agents/docs/mcp-tool-annotations.md` diubah (S7, diminta README); `docs/spec.json` diregenerasi.

## Belum selesai

- Tidak ada pekerjaan S1–S8 yang tertinggal.
- `applications.ai.draftMessage` dengan Profil (tambahan) belum punya tes unit sendiri (rute itu memang belum dites; perlu banyak mock billing). Typecheck dan lint lolos.
- `pnpm --filter web typecheck` gagal, di berkas yang sedang dikerjakan sesi web, bukan karena perubahan server: `src/features/resume/editor/write/fields.tsx(153,39)` TS6133 `labelAction` tak terpakai; `outline.tsx(179,23)` dan `section-row.tsx(250,73)` TS2554 "Expected 2 arguments, but got 1" (panggilan `addEntryTo`).
- Docker tidak berjalan, jadi tes DB nyata dijalankan di cluster Postgres 18 sementara (Homebrew `initdb` di scratchpad, port 55432, database `rezumi_profile_test` dan `rezumi_oauth_test`), lalu dihentikan dan dihapus. Database dev tidak disentuh.

## Cek yang dijalankan

- Typecheck lolos: `@rezumi/api`, `@rezumi/auth`, `@rezumi/mcp`, `@rezumi/portfolio`, `@rezumi/ai`, `@rezumi/schema`, `server`, `mobile`.
- `pnpm exec turbo boundaries`: lolos (2274 berkas, 28 paket).
- `vp lint --deny-warnings` dan `vp fmt` pada semua berkas yang diubah: bersih.
- Tes: `@rezumi/api` 119 berkas / 1385 tes lolos dengan semua suite DB nyata aktif (`COVER_LETTER_`, `INTEGRATIONS_`, `PORTFOLIO_`, `BILLING_`, `OAUTH_TEST_DATABASE_URL`), 0 dilewati; `@rezumi/portfolio` 488, `@rezumi/mcp` 21, `@rezumi/auth` 53, `@rezumi/ai` 8, `@rezumi/resume` 245, `server` 321 (5 dilewati, sudah begitu sebelumnya) lolos.
