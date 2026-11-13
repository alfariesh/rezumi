# Laporan sesi web

Ditulis 2026-11-13. Semua perubahan ada di `apps/web` (termasuk `locales/*.po`) dan panduan user di `docs/` (tanpa `docs/spec.json`). `packages/ui` tidak disentuh. Tidak ada commit.

## Selesai

### W1 Menu Profil

- Rute baru `apps/web/src/routes/dashboard/profile/`: `route.tsx` (judul "Profile", deskripsi, tab Details & career / Facts / Stories / Preferences), `index.tsx` (Details & career, default), `facts.tsx`, `stories.{-$storyId}.tsx`, `preferences.tsx` (dipindah dari `career/knowledge/`, halaman fitur tetap di `features/career/knowledge/*`).
- Rute lama `/dashboard/career/knowledge/{,facts,stories/{-$storyId},preferences}` sekarang redirect (search `highlight`/`edit` dan `storyId` ikut). `career/knowledge/route.tsx` dihapus; `career/route.tsx` tinggal judul Offers.
- `routeTree.gen.ts` dibuat ulang oleh generator TanStack Router dengan opsi plugin Vite yang sama, lalu dibuat ulang lagi oleh `pnpm --filter web build` (tidak diedit tangan).
- Sidebar (`routes/dashboard/-components/app-shell.tsx`): "Knowledge" → "Profile" (`/dashboard/profile`, ikon `user-circle`), breadcrumb Profile › Facts/Stories/Preferences.
- Nama transisi `knowledge-header/nav` → `profile-header/nav` (`src/index.css`).
- Semua tautan `/dashboard/career/knowledge/*` di fitur → `/dashboard/profile/*`.
- Kata "Knowledge" di UI diganti: chip Coach "Profile · # facts" + tooltip, "Save to Profile" di Fit, "Added to your Profile as …", "Saved to your Profile, private to this application.", "Save this story to your Profile?", teks privasi (Coach, Fit, Prepare, schedule, debrief) sekarang menyebut Profil (data diri, karier, serta fakta dan cerita yang aktif), placeholder Apply, langkah "Checking against your Profile". File: `features/career/{coach,coach-chat,shared,schedule-sheet}.tsx`, `features/career/workspace/{apply,coach-sheet,debrief,fit,prepare}.tsx`, `features/assistant/tool-approvals.tsx`.
- Settings → Account: bagian "Profile" → "Account details" (`features/settings/account/profile.tsx`).
- Command palette: item baru "Profile"; kata kunci Account "Profile" → "Account details" (`features/command-palette/pages/navigation.tsx`).
- Asisten dokumen: langkah `tool-read_profile` → "Read your Profile" (`features/assistant/conversation.tsx`).

### W2 Editor Profil (form panel Write dipakai ulang)

- Seam baru `features/resume/editor/write/source.tsx`: `WriteSource` (`kind: "resume" | "profile"`, `store`, `read`, `update`, `undo`), `useWriteSelector`, `useWriteUpdate`, `useWriteIconStyle`, `readWriteData`, `ResumeWriteSource` (CV di alamat, lewat store CV dan autosave-nya). `draft.ts` mengekspor `resumeStoreApi`, `shouldCoalesceEdit`, `MAX_HISTORY_ENTRIES`.
- Semua form Write sekarang membaca/menulis lewat source, bukan hook builder langsung: `basics-card.tsx`, `fields.tsx`, `entries.tsx`, `entry-card.tsx`, `section-row.tsx`, `outline.tsx` (`OutlineSection` diekspor), `add-section.tsx`, `actions.ts`, `summary-editor.tsx`, `picture-settings.tsx`. `WritePanel` membungkus dirinya dengan `ResumeWriteSource` + `ResumeProfileProvider`.
- Hal khusus dokumen tidak ditawarkan di Profil: sembunyikan item, Move to…, ikon/judul/kolom/heading/keep-together section, mata section, drag section, frame foto (`PictureSettings frame={false}`: hanya unggah/hapus/URL), "Show link in title", custom section (Add section hanya bawaan), hint "Appears on the page…".
- Store Profil `features/profile/store.ts`: data Profil sebagai `resumeDataFromProfile`, undo seperti CV, autosave 800 ms ke `profile.update({ data: profileFromResume(...), expectedUpdatedAt })`, `PROFILE_VERSION_CONFLICT` → baca ulang `profile.get` + toast, gagal lain → "Not saved. Retry". Hasil simpan masuk cache `profile.get` dan me-refresh CV yang ikut (`features/profile/queries.ts`, `storeSavedProfile`). Tes: `features/profile/store.test.ts`.
- Halaman `features/profile/details-page.tsx`: catatan simpan ("Saves as you type…", "Saving…", "Saved", tombol "Updated in N resumes" dengan nama CV di tooltip), kartu data diri (judul "Your details"), daftar section bawaan yang terisi dalam urutan Profil, Add section. Simpan saat pindah tab/halaman dan `beforeunload`.
- Keadaan kosong (`features/profile/fill.tsx`, tampil selama belum ada ringkasan/entri): "Import a file" (pembaca impor yang sama dengan New document, lalu `completeProfile` sebagai edit Profil biasa yang bisa di-undo) dan "Fill from a resume…" (`profile.fillFromResume`, simpanan di-flush dulu).
- Pembaca file impor dipisah ke `features/resume/import/use-read-resume-file.ts` (`useReadResumeFile`, `requireImportKind`) dan `IMPORT_ACCEPT` di `read-file.ts`; `new-document-dialog.tsx` memakainya (tidak ada salinan logika).

### W3 Builder CV

- `features/resume/editor/write/profile-link.tsx`: `ResumeProfileProvider` (sekali `profile.get` per panel), perbandingan `compareWithProfile` di-cache per versi data (WeakMap), lalu:
  - Penanda tenang (ikon `link-break` kecil) hanya untuk `override`: field basics (di baris label), foto (baris foto), ringkasan, entri yang juga ada di Profil (di judul kartu). Popover: versi Profil, "Use Profile's" (`takeFromProfile`, edit CV biasa + toast Undo) dan "Save to Profile" (`savePendingChanges` dulu, lalu `profile.savePart`).
  - Field `override` yang di Profil masih kosong: hanya "Save to Profile" ("Not in your Profile yet").
  - Field `empty` (CV kosong, Profil berisi): tanpa penanda, hanya tombol kecil "Use Profile's" (tooltip menampilkan nilai Profil); tidak pernah "Save to Profile".
  - CV yang tidak berbagi apa pun dengan Profil (contoh, impor lama) tidak diberi penanda field sama sekali (`connected`).
  - Entri `local`: "Save to Profile" di menu ⋯ entri, tanpa penanda.
  - "Add from Profile" di samping "+ Add …" tiap section bawaan (daftar `missing`, satu per satu atau "Add all"); Add section punya grup "From your Profile" untuk section yang belum dipakai tapi ada isinya di Profil (satu langkah undo).
  - Tes: `profile-link.test.ts` (contoh tenang, override, save-only, empty, item).
- `draft.ts`: toast "Updated from your Profile." untuk event `mutation: "profile"` (juga saat ditunda sampai blur), dan cache `profile.get` di-invalidate saat event itu datang.

### W4 Dokumen baru / first run

- New document: Start blank "Starts from your Profile. Change anything for this resume."; tile impor menyebut Profil ikut dilengkapi (`features/documents/new-document-dialog.tsx`).
- First run (Documents dan Home): teks baru + tautan "Fill in your Profile first" ke `/dashboard/profile` (`features/documents/documents-page.tsx`).
- Surat baru dari New dibuat tanpa `resumeId`, jadi pengirim = Profil (`use-start-document.ts`).

### W5 Surat: From

- `routes/builder/letter/-components/write-panel.tsx`: pilihan "Your details from": "Your Profile" (`{ resumeId: null, senderLinked: true }`), tiap CV (`{ resumeId, senderLinked: true, designLinked bila CV pertama }`), "This letter only" (`{ senderLinked: false }`, lalu field Name/Headline/Email/Phone/Location/Website yang disimpan saat blur sebagai `{ basics }` lengkap).
- Draf surat tanpa CV memakai Profil: teks EmptyBody, tombol "Draft from your Profile", label sumber draf.
- Notice "detail berubah" di `letter-shell.tsx` membedakan Profil dan CV (snapshot per sumber).

### W6 Portfolio

- `features/portfolio/editor/context.ts`: `useSourceResume` → `usePortfolioSource` (`data` = CV sumber atau `resumeDataFromProfile(profile)`, `from`, `designData` = hanya CV, `resume`, `isLoading`); semua pemanggil diganti. Bahasa halaman memakai `designData`; view dibangun dengan `{ data, from }` (`use-view.ts`, `preview.tsx`, dashboard `portfolio-page.tsx`, admin `admin/review-page.tsx` dengan `sourceFrom`).
- Publish → "Source" / "Content from": "Your Profile" menggantikan "No resume"; catatan Trash diperbarui; "Page language" menulis "Default (…)" untuk sumber Profil.
- Dialog buat (`create-dialog.tsx`): pilihan "Your Profile" (default bila Profil punya karier, lalu CV utama, lalu Profil); nama/headline hanya diminta selama Profil kosong; AI ditawarkan bila ada sumber.
- Impor karya dari proyek Profil (`works/add-work/*`), Find numbers dari Profil (`metrics/find-metrics.tsx`), teks section/chip "From Profile", "Edit in Profile", foto "The photo in my Profile", saran lokasi "From your Profile:", aksen "Same as my resume" hanya mengambil warna CV, teks halaman dashboard.

### W7 Ekspor

- `features/settings/account/export.ts`: zip berisi `profile.json` (`null` bila belum pernah disimpan); deskripsi baris ekspor menyebut Profil. Tes `export.test.ts` diperbarui.

### W8 Teks

- `pnpm --filter web lingui:extract` dijalankan. 108 string baru/berubah diterjemahkan di `id-ID` ("Profil", "CV", sapaan "Anda", istilah yang sudah ada seperti Terbitkan, Sampah, lowongan, karya). Sisa kosong di `id-ID`: 151, semuanya sudah kosong sebelum pekerjaan ini (HEAD: 153).

### W9 Panduan

- Dikerjakan subagen lalu disesuaikan dengan label akhir: halaman baru `docs/guides/using-your-profile.mdx` (masuk `docs/docs.json`), dan pembaruan di guide karier, CV (filling-in-your-details, editing-entries, managing-sections, creating-your-first-resume, importing-resumes, managing-documents), surat, portfolio, ekspor, hapus akun, updating-your-profile (→ "Account details"), getting-started, dan `docs/contributing/career-platform.mdx` (baris peta baru untuk Profil). Nama file/URL tidak diubah.

### Cek yang dijalankan

- `pnpm --filter web typecheck`: lulus.
- `pnpm --filter web test`: 148 file, 787 tes lulus (termasuk `src/features/docs`).
- `pnpm exec vp lint --fix` + `vp fmt` pada semua berkas web yang diubah; `vp lint --deny-warnings` dan `vp fmt --check` pada berkas itu: bersih. `pnpm lint:agent`: bersih.
- `pnpm format:check` (seluruh repo): gagal hanya di `.agents/docs/plans/profil/README.md` (milik principal); `docs/guides/writing-a-cover-letter.mdx` sudah diformat.
- `pnpm exec turbo boundaries`: tidak ada masalah.
- `pnpm --filter web build`: lulus.

## Cross-area

- **Tes E2E (`tests/e2e/specs/career.spec.ts`)**: teks lama akan gagal. Ganti "Save to Knowledge" → "Save to Profile" (baris 131), "Save this story to Knowledge?" → "Save this story to your Profile?" (baris 64, 69, 73), dan sebaiknya `goto("/dashboard/career/knowledge/facts")` → `/dashboard/profile/facts` (baris 96, 134; redirect tetap jalan). `tests/e2e/fixtures/ai-stub.ts` masih menulis "your Knowledge" di teks AI palsu (kosmetik).
- **Lingui root**: saya menjalankan `pnpm --filter web lingui:extract` saja. Root `pnpm lingui:extract` juga mengekstrak extension dan menjalankan `pnpm pdf:translations`.
- **`@rezumi/resume/profile`**: `isBlank` dan pembanding item tidak diekspor, jadi `profile-link.tsx` punya salinan kecil `isBlank`. Usul: ekspor `isBlank` (dan bila perlu `sameItem`) supaya tidak ganda.
- **Mobile parity** (`.agents/docs/mobile-release-handoff.md` → Feature parity exceptions, di luar kepemilikan saya): menu Profil + editor Details & career, penanda/aksi Profil di builder, From surat (Profil/CV/detail sendiri), sumber portfolio Profil. App native masih menampilkan "Knowledge".
- **Legal** (keputusan owner): `docs/legal/{privacy-policy,kebijakan-privasi}.mdx` baris 17 dan 45, `docs/legal/{terms-of-service,syarat-dan-ketentuan}.mdx` baris 39/40 masih menyebut "knowledge"; kebijakan privasi mungkin perlu menyebut Profil sebagai data yang disimpan dan bisa dikirim ke AI.
- **Perilaku surat baru**: surat dari New tidak lagi menautkan CV terakhir (pengirim = Profil, desain bawaan surat). Ini konsekuensi model S3; konfirmasi ke owner bila desain CV terakhir tetap diinginkan.

## Belum selesai

- **Belum diverifikasi di browser.** Lingkungan dev tidak hidup: Postgres untuk `.env.local` (localhost:5432) tidak listen dan Docker tidak berjalan, jadi saya tidak menjalankan app. Principal perlu cek:
  - `/dashboard/profile`: tab, kartu isi kosong (Import a file, Fill from a resume…), edit + autosave + "Updated in N resumes", Add section tanpa custom, menu section/entri yang dipangkas, foto tanpa frame, tampilan ponsel (entri layar penuh).
  - Redirect `/dashboard/career/knowledge/*`, sidebar, breadcrumb, ⌘K "Profile", Settings → Account "Account details".
  - Builder: CV kosong baru (tanpa penanda), ubah satu field → penanda + popover, field dikosongkan → "Use Profile's" kecil, entri dari Profil diubah → penanda di judul, entri lokal → "Save to Profile" di ⋯, "Add from Profile", Add section → "From your Profile", CV contoh dan CV hasil impor tetap tenang, CV terkunci tanpa penanda, toast "Updated from your Profile." saat Profil diubah di tab lain.
  - Surat: tiga pilihan From dan field "This letter only"; draf dari Profil.
  - Portfolio: sumber "Your Profile" di Publish dan dialog buat, pratinjau dari Profil, impor karya dari proyek Profil, Find numbers.
  - Ekspor zip berisi `profile.json`.
- **Screenshot** (tidak dibuat ulang, tidak dipalsukan): `docs/images/guides/career/{facts,story,preferences,coach,today,fit,story-approval}.png`, `docs/images/guides/updating-your-profile/profile-section.webp`, `docs/images/guides/writing-a-cover-letter/letter-from-resume.webp` (dan mungkin `letter-editor-write.webp`), mungkin `editing-entries/entry-move-to-menu.webp`, `creating-your-first-resume/{new-document-dialog,documents-first-visit}.webp`, `managing-documents/new-document-dialog.webp`, `importing-resumes/import-finished.webp`. Halaman Profil baru belum punya screenshot; `pnpm seed:career` belum mengisi Profil.
- Import di halaman Profil memakai pilihan sumber AI tersimpan (`useAiSource`) tanpa menu sumber AI seperti di New document.
- Halaman Profil tidak punya pintasan ⌘Z/⇧⌘Z global; undo lewat toast (hapus entri, kosongkan section, impor) dan undo bawaan field.
- Konflik versi Profil membuang edit yang bentrok (dibaca ulang), sesuai kontrak; tidak ada penggabungan.
