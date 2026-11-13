# Onboarding: Profil terisi dalam dua menit

Ditulis 2026-11-13, lanjutan `README.md` di folder ini (branch `feat/profil-sumber-data`). Kontrak kerja untuk sesi server dan web. Kode, komentar, commit: bahasa Inggris. UI: string Inggris lewat Lingui, `id-ID` diisi.

## 1. Keputusan owner (2026-11-13)

1. **Layar penuh terpandu, bisa dilewati**, untuk akun baru.
2. **LinkedIn lewat Apify, dengan batas**: user menempel link profilnya sendiri dan menyatakan itu miliknya; 3 kali per akun per hari; unggah file tetap ada sebagai cadangan.
3. **Sumber rilis pertama**: LinkedIn (link), GitHub (username), unggah CV (PDF/Word/ekspor), situs pribadi (AI).
4. **Akhir alur**: pilih template, CV pertama langsung jadi dan terbuka di editor.
5. **Login OAuth dipakai**: nama, email, foto akun langsung ditawarkan; login GitHub mengisi username GitHub. (OAuth LinkedIn resmi hanya memberi nama, email, foto; riwayat karier tetap lewat link profil.)

Default principal (belum dikonfirmasi): GitHub lewat API resmi (bukan Apify); situs pribadi memakai 2 kredit AI; tamu (guest) tidak mendapat LinkedIn dan situs; tidak ada kolom "onboarded" baru.

## 2. Alur

Rute `/onboarding`, layar penuh di luar shell dashboard. Tombol "Skip" selalu ada.

1. **Bring what you have.** Satu layar, beberapa sumber sekaligus: link LinkedIn, username GitHub (terisi bila login GitHub), alamat situs pribadi, unggah file. Atau "Start from scratch". Nama, email, foto akun sudah tampil sebagai "yang sudah kami tahu".
2. **Sementara data diambil** (progres per sumber, tiap sumber gagal sendiri-sendiri tanpa menggagalkan yang lain): dua pertanyaan singkat yang mengisi Preferences (`career.saveProfile`): posisi incaran (`targetRoles`), lokasi dan cara kerja (`locations`, `maxOfficeDays`). Boleh dikosongkan.
3. **Review.** Hasil gabungan per kelompok (detail, foto, ringkasan, pengalaman N, pendidikan N, skill N, proyek N, dst.) dengan centang; semua tercentang awalnya. Tidak ada yang tersimpan sebelum user menekan lanjut. Lanjut = `profile.update`.
4. **First resume.** Galeri template (yang boleh untuk paketnya), pilih satu, `resume.create` dengan `template`, buka `/builder/$resumeId`. "Not now" membuka Home.

**Kapan muncul**: akun bukan tamu yang Profilnya belum pernah disimpan (`profile.get().updatedAt === null`) dan belum punya dokumen. `/dashboard` mengalihkan ke `/onboarding` saat itu. "Skip" menyimpan Profil apa adanya (baris tercipta), jadi tidak muncul lagi. Tamu tidak dialihkan.

**Di luar onboarding**: kartu kosong di halaman Profil (`features/profile/fill.tsx`) menawarkan sumber yang sama dengan komponen yang sama, lalu review yang sama.

## 3. Kontrak API

Semua di bawah `profile.sources` (oRPC), `protectedProcedure`, tag `Internal` (tidak masuk spec publik). Tidak ada yang menulis Profil: hasilnya draf untuk ditinjau.

```ts
profile.sources.status() -> {
  linkedin: boolean,            // APIFY_TOKEN terpasang dan akun bukan tamu
  github: boolean,              // selalu true
  website: boolean,             // akun bukan tamu
  account: {
    name: string, email: string,
    image: string | null,       // foto akun (OAuth atau unggahan)
    githubUsername: string | null,   // dari akun GitHub yang tertaut
    providers: string[],        // "linkedin" | "github" | "google" | "apple" | ...
  },
}

profile.sources.linkedin({ url: string })                -> SourceResult
profile.sources.github({ username: string })             -> SourceResult
profile.sources.website({ url: string, ...aiSourceInput }) -> SourceResult

type SourceResult = {
  data: ProfileData,            // hanya yang ditemukan; sisanya kosong. Item sudah ber-id.
  photoUrl: string | null,      // URL asli foto (belum disalin)
  notes: string[],              // kode singkat, mis. "private-profile", "no-public-repos", "truncated"
}

profile.sources.adoptPhoto({ url: string }) -> { url: string }   // menyalin ke unggahan akun, mengembalikan path /uploads/...
```

Error (kode oRPC, pesan Inggris): `SOURCE_UNAVAILABLE` 409 (sumber tidak aktif untuk akun/instans ini), `SOURCE_NOT_FOUND` 404 (profil tidak ada atau tertutup), `SOURCE_INVALID` 400 (alamat/username bukan bentuk yang benar), `SOURCE_LIMIT` 429 (batas harian), `SOURCE_FAILED` 502 (penyedia gagal atau waktu habis). `website` juga melempar error AI biasa (`INSUFFICIENT_CREDITS`, `AI_SOURCE_REQUIRED`, dst.).

`resume.create` menerima `template?: Template` opsional (divalidasi terhadap paket seperti perubahan desain lain).

Penggabungan di klien, murni: `mergeProfileData(base, addition)` di `@rezumi/resume/profile`: mengisi `basics`/foto/ringkasan yang kosong, menambah item yang belum ada. Dua item dianggap sama bila kuncinya sama tanpa beda huruf besar/spasi (pengalaman: perusahaan + posisi; pendidikan: sekolah + gelar; proyek/skill/bahasa/minat: nama; sertifikat/penghargaan/publikasi: judul; relawan: organisasi; profil: network). Urutan sumber: file, LinkedIn, GitHub, situs.

## 4. Aturan server

- **LinkedIn**: Apify `run-sync-get-dataset-items` untuk aktor `harvestapi~linkedin-profile-scraper` (bisa diganti lewat env `APIFY_LINKEDIN_ACTOR`), input `{ profileScraperMode: "Profile details no email ($4 per 1k)", queries: [publicIdentifier] }`, batas waktu 60 detik, `maxTotalChargeUsd` kecil. Hanya menerima `linkedin.com/in/<id>` (atau id saja); host lain ditolak sebelum memanggil apa pun. 3 per akun per hari (penghitung yang ada: Redis/Coordination/memori), dihitung saat memanggil Apify. Email pencarian tidak pernah diminta.
- **GitHub**: `api.github.com/users/<login>` dan `/users/<login>/repos?type=owner&sort=pushed&per_page=100`. Memakai token OAuth GitHub milik akun bila tertaut, selain itu tanpa token (opsional env `GITHUB_API_TOKEN`). Proyek: repo sendiri, bukan fork, bukan arsip, diurutkan bintang lalu terbaru, paling banyak 6. Skill: bahasa repo, paling banyak 10. 10 per akun per hari.
- **Situs**: `readPage` yang ada (pemeriksaan alamat publik sudah di sana), lalu `generateJson` menjadi data Profil dengan aksi kredit baru `profile-website` (2 kredit). Teks halaman dibungkus sebagai data tak tepercaya. Kalimat yang tidak ada di halaman tidak boleh ditambahkan.
- **Foto**: `adoptPhoto` hanya dari host yang dikenal (`media.licdn.com`, `avatars.githubusercontent.com`, `*.googleusercontent.com`, dan unggahan aplikasi sendiri yang dikembalikan apa adanya), lewat pengambil aman yang ada (`portfolio/remote.ts`), hanya gambar, batas ukuran, disimpan lewat layanan storage yang sama dengan unggahan foto CV.
- **Pemetaan** murni di `packages/import`: `parseLinkedInProfile(json)` dan `parseGitHubProfile({ user, repos })`, mengembalikan `ResumeData` seperti importer lain, dengan tes dari fixture fiktif.
- Tidak ada data sumber yang disimpan atau dicatat di log. Token Apify hanya di server.
- Env baru: `APIFY_TOKEN`, `APIFY_LINKEDIN_ACTOR`, `GITHUB_API_TOKEN` (semua opsional): `packages/env/src/server.ts` + tes, `.env.example`, `turbo.json` (`globalPassThroughEnv` dan tiga daftar env tes), `docs/self-hosting/environment-variables.mdx`.

## 5. Pembagian kerja

Satu checkout, tanpa commit (principal yang commit). Laporan: `laporan/onboarding-server.md`, `laporan/onboarding-web.md` dengan "Selesai", "Cross-area", "Belum selesai".

- **Server**: `packages/api`, `packages/import`, `packages/env`, `packages/schema`, `packages/resume`, `packages/auth`, `apps/server`, `.env.example`, `turbo.json`, `docs/self-hosting/*`, `docs/spec.json`.
- **Web**: `apps/web`, `packages/ui` bila perlu, `docs/guides/*`, `docs/docs.json`, `tests/e2e`.

Skema bersama `packages/schema/src/profile/sources.ts` (`@rezumi/schema/profile/sources`: `sourceResultSchema`, `sourcesStatusSchema`) dan `mergeProfileData` ditulis sesi server **lebih dulu**; sesi web mulai dari layar yang tidak bergantung padanya.

## 6. Tugas owner sebelum rilis

1. Buat akun Apify, buat token API, pasang sebagai secret Worker `APIFY_TOKEN` (`pnpm exec wrangler secret put APIFY_TOKEN`). Tanpa itu, pilihan LinkedIn tidak tampil dan sisanya tetap jalan.
2. Setujui tambahan teks privasi (Apify dan GitHub sebagai pemroses saat user meminta impor); drafnya ditulis sesi web di `draf-privasi-onboarding.md`, halaman legal tidak diubah.
