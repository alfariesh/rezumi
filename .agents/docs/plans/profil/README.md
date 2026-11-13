# Profil: satu sumber data user

Ditulis 2026-11-13. Branch `feat/profil-sumber-data`. Dokumen ini adalah kontrak kerja antar sesi (server, web) dan catatan keputusan. Kode, komentar, commit: bahasa Inggris. UI: string Inggris lewat Lingui, terjemahan `id-ID` diisi.

## 1. Masalah

Data user tersebar dan harus diketik ulang:

| Tempat    | Sumber data sebelum pekerjaan ini                                                                     |
| --------- | ----------------------------------------------------------------------------------------------------- |
| CV        | Tiap CV menyimpan salinan sendiri. CV baru hanya mendapat nama akun. Duplikat lepas total.            |
| Surat     | Data pengirim wajib menumpang satu CV (`senderLinked` + `sourceResumeId`), tidak bisa diisi langsung. |
| Portfolio | Bagian karier dibaca langsung dari satu CV sumber, dengan timpaan nama/headline/foto/lokasi.          |
| Knowledge | Fakta, cerita, preferensi. Hanya dibaca Coach. AI penulis surat/portfolio/CV tidak membacanya.        |
| Akun      | Nama + foto sendiri, tidak tersambung ke dokumen.                                                     |

## 2. Keputusan owner (2026-11-13)

1. **Induk data = "Profil" terpisah** (bukan "CV Utama"). Profil berisi data diri + seluruh riwayat karier.
2. **Sinkron otomatis, kecuali yang ditimpa.** Saat Profil berubah, bagian dokumen yang masih sama dengan Profil ikut berubah. Bagian yang sudah diubah khusus di dokumen (override) tidak disentuh. CV terkunci, CV di Trash dan versi "terkirim" tidak pernah berubah.
3. **Edit di dalam CV = khusus CV itu.** Ada penanda "berbeda dari Profil" dengan dua aksi: "Simpan ke Profil" dan "Pakai versi Profil".
4. **Satu menu "Profil"** menggantikan menu "Knowledge", dengan tab: Data diri & karier, Fakta, Cerita, Preferensi.

Keputusan turunan (default principal, belum dikonfirmasi satu per satu):

- Item baru di Profil **tidak** otomatis masuk ke CV yang sudah ada; CV menawarkan "Tambah dari Profil". Portfolio (membaca Profil langsung) menampilkannya otomatis.
- Item yang dihapus dari Profil **tetap** ada di CV yang memakainya (jadi milik CV itu).
- Profil tidak diisi otomatis dari CV lama (CV contoh bisa mencemari). Pengisian: impor file CV/LinkedIn (mengisi yang masih kosong), tombol "Isi dari CV…", "Simpan ke Profil" per bagian, atau ketik langsung.
- Portfolio: sumber isi default = Profil. Memilih satu CV sebagai sumber tetap bisa.
- Surat: pengirim default = Profil. Bisa pilih satu CV, atau "detail sendiri" yang bisa diedit di surat.

## 3. Model

- **Profil hanya menyimpan isi**, dalam bentuk yang sama dengan CV (`basics`, foto, ringkasan, item tiap section bawaan). Desain, tata letak, judul section, dan apa yang disembunyikan tetap milik dokumen.
- **CV tetap menyimpan data lengkapnya sendiri.** Semua pembaca CV (halaman publik, PDF, ekspor, versi, MCP, mobile) tidak berubah.
- **Tautan = kesamaan isi, bukan flag.** Bagian CV yang isinya persis sama dengan Profil = "linked" dan mengikuti perubahan Profil. Yang berbeda = "override". Item dicocokkan lewat `id` (CV yang mengambil item dari Profil memakai `id` yang sama; salinan CV juga).
- **Bagian (part)**: tiap field `basics` (`name`, `headline`, `email`, `phone`, `location`, `website`, `customFields`), foto (`picture.url`), ringkasan (`summary.content`), tiap item section bawaan. Custom section selalu milik dokumen.
- Perbandingan item mengabaikan `hidden` (pilihan dokumen) dan teks tanggal (`period`/`date`, ditulis tiap CV dari `dates` sesuai bahasanya).
- Surat dan portfolio membaca sumbernya **langsung saat dibaca** (tidak ada salinan yang perlu disinkronkan).

## 4. Fondasi (sudah ada, ditulis principal)

| Berkas                                                                | Isi                                                                                                                                                                                                                                                                          |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/schema/src/profile/data.ts` (`@rezumi/schema/profile/data`) | `profileDataSchema`, `ProfileData`, `parseProfileData` (baca longgar), `emptyProfileData`, `isProfileEmpty`, `profilePartSchema`/`ProfilePart`, `PROFILE_SECTION_TYPES`, `PROFILE_BASICS_FIELDS`                                                                             |
| `packages/resume/src/profile.ts` (`@rezumi/resume/profile`)           | Murni, tanpa DB: `compareWithProfile`, `followProfile`, `takeFromProfile`, `saveToProfile`, `resumeDataFromProfile`, `profileFromResume`, `completeProfile`, `sameContent`. Tes: `profile.test.ts`                                                                           |
| `packages/db/src/schema/profile.ts`                                   | Tabel `profile` (`user_id` PK, `data` jsonb, `created_at`, `updated_at` = versi). Migrasi `20261113020808_condemned_living_tribunal`                                                                                                                                         |
| `packages/api/src/features/profile/service.ts`                        | `profileService.read / update / savePart / fillFromResume / completeFrom`. Semua tulis lewat `write`: kunci akun (`lockUser`), simpan, lalu `followProfile` ke semua CV aktif yang tidak terkunci, dalam satu transaksi. Event `resume.updated` dengan `mutation: "profile"` |
| `packages/api/src/features/profile/router.ts`                         | oRPC `profile.get`, `profile.update`, `profile.savePart`, `profile.fillFromResume` (REST `/profile`, `/profile/parts`, `/profile/fill`)                                                                                                                                      |

Catatan nama: `career_profile` / `career.profile` = preferensi cari kerja (tab Preferensi), `auth.getProfile` = akun. "Profil" yang baru = `profile` / `orpc.profile.*`.

### Kontrak API

```ts
profile.get()                                   -> { data: ProfileData, updatedAt: Date | null }
profile.update({ data, expectedUpdatedAt? })    -> { data, updatedAt, updatedResumes: {id,name}[] }   // 409 PROFILE_VERSION_CONFLICT
profile.savePart({ resumeId, part })            -> sama   // membaca CV yang TERSIMPAN: klien flush simpanan dulu
profile.fillFromResume({ resumeId })            -> sama   // hanya mengisi yang kosong
```

`updatedAt: null` = belum pernah disimpan; isinya nama + email akun. Kirim `expectedUpdatedAt` (termasuk `null`) untuk deteksi konflik.

"Pakai versi Profil" dan "Tambah dari Profil" adalah edit CV biasa di klien: `takeFromProfile(data, profile, part)` lalu simpan CV seperti edit lain (bisa di-undo).

## 5. Pembagian kerja

Dua sesi di **satu checkout**, kepemilikan berkas ketat, **tanpa commit** (principal yang commit). Tiap sesi menulis laporan di `.agents/docs/plans/profil/laporan/<nama>.md` dengan bagian "Selesai", "Cross-area" (yang perlu disentuh sesi lain) dan "Belum selesai".

### Sesi server

Milik: `packages/api`, `packages/auth`, `packages/mcp`, `packages/portfolio`, `packages/ai`, `packages/resume` (kecuali `profile.ts`: usulkan perubahan lewat laporan), `apps/server`, `docs/spec.json` (hasil `pnpm docs:gen`).

- **S1 CV baru.** `resume.create` tanpa `withSampleData` mulai dari Profil (`resumeDataFromProfile`), menggantikan isi-nama-saja di `initial-data.ts`. CV contoh tetap seperti sekarang.
- **S2 Impor.** Setelah `resume.import` (termasuk `importResumeFile`) berhasil: `profileService.completeFrom(userId, data)`.
- **S3 Surat.** Pengirim dari Profil:
  - `senderLinked` + `sourceResumeId` → `basics`/`picture` CV itu (seperti sekarang).
  - `senderLinked` tanpa CV → `basics` + `picture.url` dari Profil (pengaturan foto lain dari `style` tersimpan). `toLetter` tidak lagi memaksa `senderLinked: false` saat tak ada CV; `designLinked` tetap butuh CV.
  - Surat baru tanpa CV: `senderLinked: true`, `style.basics` diisi dari Profil.
  - DTO update menerima `basics` (detail sendiri); mengirimnya berarti `senderLinked: false`. Melepas tautan tetap membekukan nilai saat itu.
  - Satu resolver dipakai juga oleh `recordSentResume` (`applications/service.ts`), yang sekarang menyalin logika sendiri.
- **S4 Portfolio.** `sourceResumeId: null` berarti **sumber = Profil**: halaman publik, kartu, vCard, `aiContext`, `importWorks` (proyek dari Profil) membangun view dari `resumeDataFromProfile(profile)`. Portfolio baru tanpa pilihan CV: Profil bila Profil punya minimal satu item section, selain itu aturan lama (CV utama, lalu yang terakhir diedit). Aksen/font `source: "resume"` dan tombol CV/PDF hanya saat ada CV sumber. Perubahan Profil harus terlihat di halaman publik (periksa cache/ETag).
- **S5 AI membaca Profil.** Draf surat tanpa CV sumber memakai Profil; AI portfolio tanpa CV sumber memakai Profil; Coach (chip Knowledge/memory) dan `career.generate` (saat lamaran tak punya CV) mendapat Profil sebagai Markdown dengan batas ukuran; asisten dokumen mendapat tool `read_profile` dan prompt mengizinkan Profil sebagai sumber fakta.
- **S6 Akun.** Ekspor data menyertakan `profile` (service + skema output router). Guest → akun (`linkAnonymousAccount`): pindahkan baris Profil guest bila akun tujuan belum punya.
- **S7 MCP.** Tool untuk membaca dan menyimpan Profil (ikuti pola yang ada: native atau parity), dengan deskripsi; perbarui `.agents/docs/mcp-tool-annotations.md` bila relevan.
- **S8 Tes.** Tes integrasi DB nyata untuk `profileService` (linked ikut, override tetap, CV terkunci/Trash dilewati, konflik versi, `savePart`, `fillFromResume`), plus tes untuk S1–S6.

### Sesi web

Milik: `apps/web` (termasuk `locales/*.po`), `packages/ui` bila perlu, `docs/` panduan user.

- **W1 Menu.** "Knowledge" → "Profile" (`id-ID`: "Profil"), rute `/dashboard/profile` dengan tab Details & career (default), Facts, Stories, Preferences. Rute lama `/dashboard/career/knowledge/*` redirect. Kata "Knowledge" di UI (chip Coach, tombol "Save to Knowledge", breadcrumb, command palette) diganti konsisten. Bagian "Profile" di Settings → Account (nama/username/foto akun) diberi nama yang tidak bentrok.
- **W2 Editor Profil.** Memakai ulang form panel Write CV (basics, foto, ringkasan, tiap section) lewat store yang digeneralisasi, bukan salinan form. Autosave ke `profile.update` dengan `expectedUpdatedAt`; catatan "diperbarui di N CV". Keadaan kosong: impor file CV/LinkedIn untuk mengisi Profil, atau "Isi dari CV…" (`profile.fillFromResume`).
- **W3 Builder CV.** `compareWithProfile` + `profile.get`: penanda tenang hanya untuk override (field basics, foto, ringkasan, item) dengan aksi "Use Profile's" (`takeFromProfile`) dan "Save to Profile" (`profile.savePart`, flush simpanan dulu); item "local" mendapat aksi "Save to Profile" di menu item tanpa penanda; tiap section menawarkan "Add from Profile" untuk `missing`. Toast untuk event `mutation: "profile"`.
- **W4 Dokumen baru / first run.** Salinan teks: mulai dari Profil; first run mengarahkan mengisi Profil (impor mengisi Profil di server).
- **W5 Surat.** Bagian "From": Profile (default) / CV tertentu / detail sendiri yang bisa diedit.
- **W6 Portfolio.** Sumber: "Profile" menggantikan "No resume"; editor membangun view dari Profil saat tak ada CV sumber; dialog buat, impor karya dari proyek Profil, placeholder intro, teks section disesuaikan.
- **W7 Ekspor data.** Zip menyertakan `profile.json`.
- **W8 Teks.** `pnpm lingui:extract`, isi `id-ID` untuk string baru.
- **W9 Panduan.** Perbarui panduan user yang terpetakan (`docs/contributing/career-platform.mdx` → Keep product guides current).

Mobile: tidak dikerjakan (web first). Cukup tetap lolos typecheck.

## 6. Aturan

- Baca `CLAUDE.md` root. Lint + format berkas yang diubah; typecheck dan tes paket sendiri sebelum lapor.
- Jangan sentuh berkas milik sesi lain; tulis kebutuhan di "Cross-area".
- Tidak commit, tidak push, tidak ganti branch.
- Tidak ada pekerjaan setengah jadi tanpa dicatat di "Belum selesai".

## 7. Status (2026-11-13)

Selesai di branch `feat/profil-sumber-data`, belum di-commit saat catatan ini ditulis. Laporan: `laporan/server.md`, `laporan/web.md`.

Perubahan terhadap rencana di atas:

- **Yang kosong tidak diisi otomatis.** Field `basics`, foto atau ringkasan yang kosong di CV tetap kosong saat Profil mendapat isinya (`followProfile`), supaya CV yang dibagikan tidak tiba-tiba menampilkan nomor telepon atau foto. `compareWithProfile` melaporkannya sebagai `"empty"`; builder menawarkan "Use Profile's" tanpa penanda.
- **Surat baru tetap mengikuti CV yang terakhir diedit** bila ada (pengirim + desain, supaya tampilan surat dan CV sama); tanpa CV, pengirimnya Profil. Model surat tidak bisa menyatakan "pengirim dari Profil, desain dari CV".
- Sumber CV portfolio yang ada di Trash berarti tanpa bagian karier (tidak jatuh ke Profil).

Cek yang dijalankan principal: `pnpm typecheck` (27 paket), `pnpm lint:agent`, `pnpm format:check`, `pnpm exec turbo boundaries`, semua tes kecuali mobile dengan suite DB nyata aktif (api 1385, web 787, pdf 989, portfolio 488, server 326, resume 246, dst.), `pnpm check:cloudflare`. Uji browser lokal (launch config `rezumi-profil`, 3300/3301): editor Profil autosave, CV baru dari Profil, penanda override, sinkron + toast, pengirim surat (CV / Profil), dialog buat portfolio, redirect rute lama.

Belum: Playwright E2E (`tests/e2e/specs/career.spec.ts` sudah disesuaikan teksnya, belum dijalankan); tangkapan layar panduan (daftar di `laporan/web.md`); kata "knowledge" di `docs/legal/*` (keputusan owner); uji browser untuk "Add from Profile", editor portfolio bersumber Profil, zip ekspor, tampilan `id-ID` dan layar ponsel.
