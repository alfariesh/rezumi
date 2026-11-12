# Phase 01 — Fondasi plugin dan pengenal situs loker

| Dikerjakan       | Ukuran | Bergantung pada                        | Perlu dari pemilik                                               |
| ---------------- | ------ | -------------------------------------- | ---------------------------------------------------------------- |
| Claude + pemilik | Besar  | — (akun toko Phase 00 untuk langkah 8) | Chrome dan Edge terpasang; di akhir: unggah draf zip ke dua toko |

## Untuk pemilik

**Apa yang dibuat:**

1. **Kerangka plugin** yang bisa dipasang di Chrome dan Edge: ikon Rezumi di toolbar, panel samping berbahasa Inggris/Indonesia dengan layar "Hubungkan ke Rezumi" (tombolnya belum berfungsi).
2. **Pengenal situs loker**: plugin sudah tahu kapan kamu membuka lowongan di LinkedIn, Indeed, JobStreet, atau Glints. Pengenal yang sama nanti dipakai server untuk mencegah loker tersimpan dua kali.

**Siapkan:** tidak ada sebelum sesi.

**Di akhir sesi** (Claude memandu langkah demi langkah):

1. Pasang plugin uji di Chrome-mu: buka `chrome://extensions`, nyalakan **Developer mode**, klik **Load unpacked**, pilih folder yang disebut Claude. Lakukan juga di Edge (`edge://extensions`).
2. **Unggah draf** file zip dari Claude ke kedua toko **tanpa mengirim untuk review**:
   - Chrome Web Store: dasbor → **New item** → unggah zip → simpan sebagai draf. Lalu buka item itu → **Package** → **View public key**.
   - Edge: Partner Center → **Create new extension** → unggah zip → simpan.
3. Kirim di chat: **ID item Chrome**, **ID item Edge**, dan **public key Chrome**. Ketiganya bukan rahasia (ID memang tampil di alamat toko).

**Prompt:** `Kerjakan Phase 01 dari .agents/docs/plans/plugin-browser/README.md`

**Yang bisa kamu cek di akhir:** ikon Rezumi tampil di toolbar Chrome dan Edge; klik ikon membuka panel samping; ganti bahasa browser ke Indonesia, teks panel ikut berubah.

## Untuk agent

### Langkah

1. **Eksplorasi** (`02-teknis.md` bagian 2–4): setup Vite+ (`vite.config.ts` root, `vp`, override `vite` di `pnpm-workspace.yaml`), cara `apps/web` memakai `@rezumi/ui` + Tailwind v4 + Lingui, cara `apps/mobile/src/api/client.ts` mengambil tipe router dan membuat klien oRPC. Baca dokumentasi resmi Chrome Extensions (Manifest V3, `sidePanel`, `identity`, content scripts, `commands`) dan Edge (dukungan `sidePanel` dan `identity.launchWebAuthFlow`). Tetapkan versi minimum Chrome/Edge dan catat di `02-teknis.md` bagian 4.
2. **Konfirmasi aturan turunan #9** (bahasa saat rilis) dan catat di `00-keputusan.md`.
3. **Paket `@rezumi/job-sites`** (`02-teknis.md` bagian 3, 7.4, 7.5):
   - `package.json` dengan export map ke `src`, `turbo.json` bertag `runtime:universal` dan `role:domain`, skrip `typecheck`/`test`.
   - `detectSite`, `canonicalJobUrl`, `jobKey` untuk empat situs + aturan umum (`url:`), dengan tes per pola. Tandai di komentar bahwa pola diverifikasi ulang di Phase 03.
   - Pindahkan bagian murni pembacaan JSON-LD `JobPosting` dari `packages/api/src/features/applications/posting.ts` (`jobPostingsIn`, `toPagePosting`, pembacaan lokasi). `htmlToText` (memakai `sanitize-html`, khusus server) disuntikkan sebagai parameter; di plugin konversinya memakai DOM. `posting.ts` memakai paket baru dan semua tesnya tetap lulus tanpa diubah perilakunya.
   - Skema Zod `CapturedPosting`.
4. **`apps/extension`** (`02-teknis.md` bagian 3, 4, 8, 12):
   - Pembangun manifest MV3 dengan izin di bagian 12 (izin host empat situs boleh sementara; finalnya di Phase 03), `REZUMI_URL` saat build, `key` dev menyusul di langkah 8.
   - Dua keluaran build (panel + service worker sebagai ES module, content script sebagai IIFE), skrip `dev`, `build`, `zip`, `typecheck`, `test`, `test:e2e`; `release/` dan `dist/` diabaikan git.
   - Service worker: `setPanelBehavior`, router pesan dengan validasi pengirim dan skema Zod, kerangka alarm.
   - Panel: React 19 + HeroUI + Tailwind dari `@rezumi/ui`, terang/gelap, layar 3.1 statis, Lingui en/id, `_locales` untuk nama dan deskripsi (nama dari aturan turunan #1 bila sudah dijawab; bila belum, nama sementara "Rezumi").
   - Content script: deteksi situs + `jobKey` (dari `@rezumi/job-sites`) + navigasi SPA (`02-teknis.md` 7.3); di build dev saja, tampilkan kunci di konsol. Tes ukuran ≤ 50 KB.
   - Ikon 16/32/48/128 dari aset merek yang ada (cari logo Rezumi di `apps/web/public` atau `packages/icons`).
5. **Integrasi monorepo:** tag Turbo dan `pnpm exec turbo boundaries`, knip, lint/format mencakup app baru, CI menjalankan tes unitnya. Tambahkan `apps/extension/AGENTS.md` (perintah, cara memuat plugin, struktur) dan perbarui `CLAUDE.md` root (Overview: app kelima; ownership map: baris plugin dan `@rezumi/job-sites`).
6. **Harness Playwright** (`02-teknis.md` bagian 14): konfigurasi sendiri di `apps/extension`, Chromium dengan plugin dimuat, satu tes: halaman fixture LinkedIn dilayani lewat `context.route` → service worker menerima kunci yang benar; satu tes membuka halaman panel dan mengambil screenshot.
7. **Cek manual:** muat plugin hasil build di Chromium lewat Playwright; ambil screenshot panel 360 dan 420 px, terang/gelap, en/id.
8. **Draf toko:** buat zip produksi, pandu pemilik mengunggah draf (bagian "Untuk pemilik"). Setelah pemilik mengirim ID dan public key: isi `02-teknis.md` bagian 15, pasang `key` di manifest build dev, pastikan ID plugin hasil "Load unpacked" sama dengan ID Chrome Web Store. Bila pemilik belum sempat, catat sebagai tugas pemilik sebelum Phase 02 dan set status 🟡.

### Aturan yang wajib dijaga

- Satu versi Vite di workspace. Tidak ada kode jarak jauh, `eval`, atau analitik.
- Content script tanpa React dan tanpa Zod; tidak memegang token.
- Perilaku `parsePosting` dan semua tes applications yang ada tidak berubah.

### Tes dan verifikasi

- Unit `@rezumi/job-sites` (pola URL, kunci, JSON-LD, skema), tes `posting` API yang ada, unit plugin (router pesan, validasi pengirim), Playwright harness (2 tes), typecheck semua paket yang tersentuh, boundaries, knip, `lint:agent`, `format:check`.

### Selesai bila

- Plugin terpasang lewat "Load unpacked" di Chrome dan Edge; panel terbuka dengan teks Inggris/Indonesia (screenshot).
- Content script mengenali kunci loker di fixtures empat situs.
- `@rezumi/job-sites` dipakai API tanpa mengubah perilaku.
- ID item kedua toko dan public key Chrome tercatat di `02-teknis.md` bagian 15 (atau tercatat sebagai tugas pemilik).
