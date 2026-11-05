# Revamp template CV Rezumi — mulai di sini

Rencana mengganti 18 template lama (nama Pokémon) dengan 16 template baru yang elegan, modern, dan kuat di ATS, plus sistem ikon Hugeicons tiga gaya dan logo. Satu phase dikerjakan dalam satu sesi Claude.

- Keputusan produk (lineup, nama, ikon, paket): [00-keputusan.md](00-keputusan.md)
- Bahasa desain dan spesifikasi tiap template: [01-desain.md](01-desain.md)
- Rancangan teknis (untuk agent): [02-teknis.md](02-teknis.md)

## Cara memakai (untuk pemilik)

1. Buka **sesi Claude baru** untuk setiap phase, lalu tempel (ganti nomornya):

   ```text
   Kerjakan Phase 02 dari .agents/docs/plans/cv-templates/README.md
   ```

2. Claude membaca dokumen, bertanya bila ada keputusan yang kurang, lalu mengerjakan.
3. Di akhir sesi Claude memberi laporan berbahasa awam plus gambar contoh template, lalu menawarkan commit dan Pull Request.
4. **Merge ke `main` = langsung tayang.** Lihat dulu gambar contohnya.

| Kebutuhan                   | Prompt                                                                                    |
| --------------------------- | ----------------------------------------------------------------------------------------- |
| Melanjutkan phase terpotong | `Lanjutkan Phase 02 dari .agents/docs/plans/cv-templates/README.md`                       |
| Mengubah satu desain        | `Ubah template Senja: blok warnanya terlalu besar. Ikuti .agents/docs/plans/cv-templates` |
| Mengganti nama template     | `Ganti nama template Atlas jadi Garis. Ikuti .agents/docs/plans/cv-templates`             |
| Menanyakan posisi rencana   | `Apa status revamp template? Baca .agents/docs/plans/cv-templates/README.md`              |

## Urutan phase dan status

Status: ⬜ belum mulai · 🟡 berjalan/sebagian · ✅ selesai · ⛔ diblokir.

| Phase | Judul                                                | Bergantung pada | Status |
| ----- | ---------------------------------------------------- | --------------- | ------ |
| 01    | Fondasi: ikon Hugeicons 3 gaya, skema, token desain  | —               | ✅     |
| 02    | Sepuluh template satu kolom                          | 01              | ✅     |
| 03    | Enam template dua kolom, hapus template lama         | 02              | ✅     |
| 04    | Builder web dan mobile: kontrol ikon, galeri, preset | 01, 03          | 🟡     |
| 05    | Paket: template gratis baru, fitur logo tools        | 03              | ✅     |
| 06    | Polesan desain, contoh galeri, dokumentasi, DOCX     | 03              | ✅     |
| 07    | QA akhir: ATS, matriks visual, mobile, optimasi      | 04, 05, 06      | 🟡     |
| 08    | Perluasan: 20 template baru (total 36)               | 01–07           | ✅     |

### Phase 01 — Fondasi

Ikon PDF dari Hugeicons dengan tiga gaya; `design.icons` menggantikan `page.hideIcons`/`hideSectionIcons`; label untuk kolom kustom; chip kata kunci; logo otomatis untuk Profil; token desain dan dekorasi judul bagian; margin bawaan baru; alat render contoh `tooling/templates/preview.ts`. Template lama tetap jalan dengan ikon baru. Detail: `02-teknis.md` bagian 2–4.

Selesai bila: semua template lama merender dengan ikon Hugeicons di ketiga gaya; tes `@rezumi/pdf`, `@rezumi/schema`, `@rezumi/resume` lulus; typecheck paket terdampak lulus.

### Phase 02 — Sepuluh template satu kolom

Meridian, Sterling, Aksara, Atlas, Tunas, Summit, Cendekia, Wibawa, Tenun, Vector (spesifikasi `01-desain.md`). ID baru ditambahkan di samping ID lama; setiap template punya `semantic.ts`, entri galeri web dan mobile (nama, deskripsi Lingui, tag), entri DOCX, dan preset. Cek matriks visual (`02-teknis.md` bagian 6) untuk tiap template dan simpan gambarnya untuk laporan.

### Phase 03 — Hapus 18 template lama

Sudah (2026-11-03): enam template dua kolom, `legacyTemplateSuccessors` + `upgradeTemplateId` (setiap baca dan tulis), Meridian sebagai default, `templateLineup` di semua pemilih.

Selesai (2026-11-03, cabang dari `main` setelah PR #22 digabung):

- [x] Folder 18 template lama di `packages/pdf/src/templates/` beserta entri `index.ts`, `semantic/template-manifest.ts`, `apps/web/src/dialogs/resume/template/data.ts`, `templateLayouts`, dan gambar contohnya di `apps/web/public/templates/{pdf,jpg,thumb}` (72 berkas) dihapus. Ikut dibersihkan: modul `shared` yang tak punya pemakai lagi, galeri gambar di `README.md`, pilihan template di form issue GitHub, `GLOSSARY.md`, contoh `SIDEBAR_BACKGROUND` DOCX, dan data `dev-seed`.
- [x] `templateSchema` hanya 16 ID; ID lama diterima lewat `readableTemplateSchema` (data tersimpan dan impor), `templateInputSchema` (DTO API) dan `upgradeTemplateId` (kode). JSON Schema, OpenAPI, `docs/spec.json` dan `references/schema.md` hanya menyebut lineup.
- [x] Tes yang mengunci geometri ke Onyx/Ditgar/Glalie/Persian/Gengar/Chikorita dipindah ke Meridian/Purnama/Kirana/Sterling/Linen dengan nilai ukur baru; empat tes khusus template (Onyx, Persian, Ditgar, Gengar) dipindah ke Meridian, Sterling, Purnama, Kirana; mekanisme mesin tanpa template pemakai diuji lewat manifest pengganti. Perincian: `02-teknis.md` bagian 7–8.
- [x] Fixture CSS `all-templates-fixture.ts` memakai `jejak`; `docs/applying-custom-styles.mdx` memakai `jejak` dan daftar bagian khusus Jejak, Kirana, Purnama; `pnpm docs:gen` dijalankan; `pnpm lingui:extract` (web) membuang 18 pesan galeri lama.

Temuan yang dibawa ke phase berikut: pemeriksa ATS tidak menemukan bagian pada template yang memakai huruf kapital ber-tracking (lihat Phase 07); `SIDEBAR_BACKGROUND` DOCX sementara hanya Kirana (tint) dan Purnama (solid); sisa mesin tanpa template pemakai ada di `02-teknis.md` bagian 8.

### Phase 04 — Builder web dan mobile

Sudah: grup Design → Ikon (saklar, gaya Standar/Rounded/Sharp, kontak, judul bagian, item, logo tools) di web, web ponsel, dan app mobile; pemilih ikon menggambar Hugeicons; galeri hanya lineup.

Selesai di web, termasuk web ponsel (2026-11-04, cabang `feat/cv-templates-04-builder`; rincian teknis di `02-teknis.md` bagian 10):

- [x] Pemilih ikon per kategori: grup "Sering dipakai" lalu kategori Hugeicons, pilihan kategori, pencarian dengan sinonim Inggris dan Indonesia ("surel", "pendidikan"), Enter memilih hasil teratas, tombol Tanpa ikon. Ikon digambar dalam gaya ikon resume yang aktif, juga pada tombol pemilih dan pratinjau level.
- [x] Panel "Gaya {template}" di Design → Template dengan tombol "Pakai gaya bawaan {template}" (font, ukuran, warna aksen, tata letak entri, `keywordLayout`, bentuk foto) dan Undo.
- [x] Input label kolom kustom di kartu About (baris label di atas isi); PDF mencetak "Label: isi" atau baris tabel Data Pribadi.
- [x] Opsi "Chip" di menu Keahlian → Tata letak kata kunci. Chip dicek di ke-16 template; di sidebar berwarna (Kirana, Purnama) chip kini memakai warna teks sidebar sehingga terbaca.
- [x] Filter bidang (Teknologi, Kreatif, Keuangan, Pemerintahan & BUMN, Akademik, Fresh graduate) dari `templateCareerFields`: pilihan bidang di Design → Template dan chip di galeri publik `/resume-templates`.

Sisa:

- [ ] App mobile (`apps/mobile`) untuk kelima item di atas. Ditunda atas keputusan pemilik (log `00-keputusan.md`, 2026-11-04). Logika bersama sudah di package (`02-teknis.md` bagian 10); label kategori ikon dan nama bidang perlu ditulis di katalog Lingui mobile.
- [ ] Pemilik: cek pemetaan template → bidang (`templateCareerFields` di `packages/schema/src/templates.ts`), usulan agent dari kolom "Untuk siapa".

### Phase 05 — Paket

Sudah: `FREE_TEMPLATES` = Meridian, Sterling, Tunas, Wibawa, Kirana; `BILLING_CATALOG_VERSION` = 2; halaman legal menyebut template gratis baru.

Selesai (2026-11-04):

- [x] Fitur paket `brandLogos` di `packages/schema/src/billing/catalog.ts` (Plus dan Pro AI; `BILLING_CATALOG_VERSION` = 3). Server menolak _menyalakan_ `design.icons.logos` tanpa fitur (`designFeaturesNeeded` di `packages/api/src/features/billing/limits.ts`, kode `PLAN_FEATURE_REQUIRED`, pesan netral), nilai yang sudah tersimpan tetap dirender dan boleh dimatikan (termasuk salinan dan restore versi), dan impor file mematikan logo bila paket tidak memuatnya (`fitImportedDesign` → `changed.logos`). Tes unit + tes DB nyata (`limits.integration.test.ts`).
- [x] Saklar "Logo tools di keahlian" terkunci dengan label "Plus" untuk Gratis: web (gembok + chip, membuka dialog paket), Android (gembok + "· Plus", alert netral), iOS (baris disembunyikan; tetap tampil bila CV sudah menyalakannya). Tes node mobile `apps/mobile/scripts/icons-plan.test.mjs`. Daftar manfaat di halaman Paket web/mobile, kartu beli, harga beranda, llms.txt/SEO (juga "4 template" → 5), S&K ID/EN, `docs/use-cases/free-resume-builder.mdx`, resource MCP `resume://_meta/design` dan skill agen, dokumen keputusan + arsitektur membership.

### Phase 06 — Polesan desain, contoh galeri, dokumentasi, ekspor

Selesai (2026-11-04; bagian 1 di PR #26, bagian 2 di PR berikutnya):

- [x] Polesan: Jejak tanpa titik timeline di Ringkasan dan tanpa garis untuk satu entri (`sectionTypes`/`minItems` di manifest semantik), garisnya kini tergambar di PDF di setiap halaman (Forme diperbaiki, `vendor/README.md`); Wibawa meluruskan label Data Pribadi dengan kolom ikon (`contactIconColumn`); Aksara ringkasan sebagai standfirst 1,15× isi dengan tinta redup (slot gaya `summary`, juga di DOCX); Cendekia publikasi bernomor dengan indentasi gantung di semua tata letak entri (`numberedPublications`); contoh Vector memakai logo tools. Template lain identik per byte (16 template × 3 varian).
- [x] Contoh galeri: 16 persona fiktif (`tooling/templates/personas/`, Inggris + Indonesia) lewat `pnpm --filter @rezumi/tooling templates:previews`, yang menulis PDF + JPG + WebP ke `apps/web/public/templates/{pdf,jpg,thumb}` (Indonesia di `id/`) dan gambar dokumen `docs/images/templates`. Galeri web, beranda, kartu Design dan surat memilih versi Indonesia di halaman berbahasa Indonesia (`templateSample` di `data.ts`). Prosedur manual di `apps/web/DESIGN.md` diganti. Delapan template memakai foto (Meridian, Tunas, Wibawa, Tenun, Kirana, Horizon, Purnama, Senja), delapan tanpa foto.
- [x] DOCX setiap template (`DOCX_LOOKS` menggantikan `SIDEBAR_BACKGROUND`).
- [x] Halaman web publik ke-16 template, termasuk ponsel.
- [x] Panduan: `docs/guides/choosing-a-template.mdx` ditulis ulang untuk 16 template (filter bidang, gaya bawaan, sisi sidebar, paket), `quickstart.mdx` dan `writing-a-cover-letter.mdx` (teks + tangkapan layar baru), panduan baru `docs/guides/icons-and-logos.mdx` (logo tools hanya Plus/Pro AI), gambar 16 template di dokumen; beranda memakai gambar contoh baru yang ikut bahasa.
- [x] `.agents/docs/template-showcase-sources.json` berisi persona dan foto Unsplash baru (halaman foto, fotografer, lisensi, tanggal cek).

Sisa: app mobile tidak diubah (keputusan pemilik "web dulu"); pemilih template mobile tetap memuat `templates/jpg/<id>.jpg`, jadi ikut gambar baru versi Inggris. Versi Indonesia untuk mobile menyusul bersama Phase 04 mobile.

### Phase 07 — QA akhir dan optimasi

Sudah (2026-11-04, sebelum Phase 04–06 masuk `main`):

- [x] Tes ekstraksi teks ATS untuk ke-16 template (`packages/pdf/src/ats-extraction.integration.test.tsx`), dalam tampilan contoh dan tampilan preset (font + aksen template): urutan nama → email → telepon → judul bagian (satu kolom: utama lalu sidebar per halaman; dua kolom: tiap kolom berurutan), tanggal Pendidikan dan Pengalaman di dalam bagiannya, tidak ada huruf yang terbaca terpisah ("E D U C A T I O N"), tidak ada karakter PUA/U+FFFD, dan semua ikon + logo tools menyala (gaya bergiliran per template) tidak menambah satu karakter pun.
- [x] Huruf kapital ber-tracking diperbaiki: pdf.js menyisipkan spasi bila jarak antarhuruf ≥ 0,102 em (pdfminer dan parser ATS ±0,1 em). Tracking semua template kini maks. **0,06 em** (`MAX_TRACKING_EM` di `shared/lineup-page.tsx`, membatasi helper `tracking`); nilai di 13 template diturunkan (judul bagian Meridian/Atlas/Tenun/Horizon/Kirana/Linen/Jejak/Purnama/Senja, kicker Aksara/Summit, nama + judul Sterling, judul Cendekia). Tabel temuan satu kolom kini kosong (skor 100); Horizon juga bersih.
- [x] Temuan di pemeriksa ATS sendiri: spasi antara teks tebal dan teks biasa ("**…experience** creating") hilang ("experiencecreating"), karena item spasi dari pdf.js dibuang dan celah 0,23 em di bawah ambang 0,25 em. `buildExtractedDocument` kini mencatat `spaceBefore` dan memakai ambang 0,05 em setelah item spasi (`packages/resume/src/ats-pdf/extract.ts`); importer PDF (`packages/import/src/pdf-lines.ts`) ikut. Ini memperbaiki pemeriksa ATS dan impor PDF untuk semua pengguna, bukan hanya template kita.

Temuan dua kolom yang tersisa, dengan Forme dari Phase 06 (jujur dicatat di tabel tes; bukan teks rusak, tapi geometri kolom):

| Template | Temuan                                        | Skor | Sebab                                                                      |
| -------- | --------------------------------------------- | ---- | -------------------------------------------------------------------------- |
| Kirana   | `MULTI_COLUMN_LAYOUT`, `NO_EDUCATION_SECTION` | 55   | Celah kolom 1,6 em: baris sidebar dan judul "Education" terbaca satu baris |
| Purnama  | `COLUMN_GUTTER`                               | 97   | Sidebar gelap penuh tinggi, celah 1,6 em (sebelum Forme baru: 55)          |
| Linen    | `READING_ORDER_RISK`, `TIGHT_LINE_SPACING`    | 96   | Baris dua kolom berselang-seling                                           |
| Senja    | `READING_ORDER_RISK`                          | 97   | Sama                                                                       |
| Jejak    | `READING_ORDER_RISK`, `TIGHT_LINE_SPACING`    | 96   | Sama; kolom utama kini ditulis sebelum sidebar kiri                        |

- [x] Urutan baca dua kolom (keputusan pemilik 2026-11-04: perbaiki di mesin, tampilan Kirana tetap). Dulu Forme 0.29 menata `row-reverse` sebagai `row` dan konverter `to-forme.tsx` membalik anaknya, jadi kolom kiri selalu ditulis lebih dulu: di Kirana, Profiles dan Skills terbaca sebelum nama. Sekarang `TwoColumnLayout` menulis kolom ber-header lebih dulu, bila tidak ada maka kolom utama, dan memakai `row-reverse` agar sidebar tetap di kiri. Forme dari Phase 06 (PR #26) menata `row-reverse` sendiri dalam urutan pohon. Hasilnya, nama terbaca sebelum semua judul bagian di ke-16 template (tes ATS memeriksanya), dan halaman web publik ikut. Cabang Phase 07 dibangun di atas cabang Phase 06: **merge #26 dulu, lalu Phase 07.**

Matriks visual (2026-11-04, setelah Phase 04–06 di `main`):

- [x] Matriks 16 template × 5 varian lewat `pnpm --filter @rezumi/tooling templates:matrix` (persona galeri + gaya bawaan; PDF, PNG dan lembar kontak per template di folder sementara): **A** foto · A4 · semua ikon + logo tools · chip · aksen gelap; **B** tanpa foto · Letter · semua ikon mati · aksen terang (kuning); **C** 2–3 halaman · nama sangat panjang · foto; **D** RTL `ar-SA` (nama + ringkasan Arab) · 2–3 halaman · Letter · semua ikon; **E** panjang · semua ikon + logo · chip. 80 PDF dicek dengan mata.
- [x] Diperbaiki. Semua render LTR satu halaman dan ke-32 PDF galeri (EN + ID) tetap identik per byte; yang berubah hanya render RTL dan render yang terpotong pergantian halaman. Tes: `page-breaks.integration.test.tsx` (gagal tanpa perbaikan), `html/web-page.test.ts`, `rich-text-html.test.tsx`.
  - Judul entri terbelah di pergantian halaman (nama sekolah di halaman 3, gelarnya di halaman 2: Sterling, Aksara, Tunas, Summit, Linen). Forme memecah tiap kolom sebuah baris sendiri-sendiri. `SectionItemHeader` kini `wrap={false}`, kecuali di timeline Jejak (titiknya ada di kolom lain dan akan tertinggal). Item Bahasa, yang tidak punya node judul, utuh lewat `keepTogether`: dulu nama bahasa di halaman 1 dan kemahirannya di halaman 2 (Wibawa, Vector), dan bintang level Kirana muncul di bawah Interests.
  - Judul bagian sendirian di dasar halaman, isinya di halaman berikutnya (Languages di Summit, Wibawa, Cendekia, Vector; Awards di Aksara). Forme tidak punya keep-with-next. `renderResume` kini membaca tata letak, mencari judul di 15% terbawah halaman yang item pertamanya ada di halaman berikutnya, lalu merender ulang dengan bagian itu mulai di halaman baru (`orphanedSectionTitles` di `forme/render.ts`, sekali per bagian, mekanisme yang sama dengan penanda daftar).
  - RTL: nomor telepon terbaca terbalik ("1824 5550 812 62+"), handle "@studio" jadi "studio@", label "Gender:" jadi ":Gender". Teks kontak kini `direction: ltr` (telepon) atau `auto` (arah dari huruf pertama; teks Arab tetap RTL) di PDF, dan `unicode-bidi: isolate`/`plaintext` di halaman web.
  - RTL: tanda RLM yang disisipkan di awal paragraf diberi lebar ±2,5 pt oleh Forme, jadi baris melewati kotaknya dan terpotong di bagian dua kolom ("price tool fo|r" di Projects Atlas dan Tunas). RLM tidak disisipkan lagi; arah paragraf sudah datang dari `direction: rtl`. Isi dan urutan teks RTL ke-16 template tidak berubah.
  - Atlas: ikon judul bagian turun ke tengah bagian bila bagian itu terbelah antarhalaman (kolom label direntangkan setinggi potongan). `section` Atlas kini `alignItems: "flex-start"` (khusus Atlas).
  - Purnama: nama sangat panjang di sidebar terpotong di tengah kata ("Kusumawar/dhani", "Hadiningra/t"). Ukuran nama kini mengecil sampai kata terpanjangnya muat, paling kecil 60%; nama biasa tidak berubah.

Temuan besar dari matriks (belum diperbaiki, lihat Sisa):

| Temuan                                                            | Di mana                                                                                                                                  | Sebab / usul                                                                                                                                                                               |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Judul entri tinggal di dasar halaman tanpa poin pertamanya        | C/E di Tenun, Kirana, Linen, Meridian                                                                                                    | Forme tidak punya keep-with-next. Usul: dukung `minPresenceAhead` di Forme (sudah ada di API template dan CSS semantik, dibuang `to-forme`), lalu pakai untuk judul entri dan judul bagian |
| Jejak: judul entri masih bisa terbelah (titik ikut baris pertama) | Jejak C/D/E                                                                                                                              | Sama dengan kapsul titik timeline: mesin perlu memindah baris timeline utuh                                                                                                                |
| Aksen terang kurang kontras                                       | B: judul bagian di putih (Meridian, Sterling, Summit, Tunas, Horizon, Senja, Atlas), label pita Tenun, chip Vector, judul sidebar Kirana | Aksen dipakai langsung sebagai warna teks. Usul: token "aksen untuk teks" yang digelapkan bila kontras < 3:1. Keputusan pemilik, karena mengubah warna pilihan pengguna                    |
| RTL: baris Inggris terbungkus yang diawali angka                  | D Horizon ("…GMV in 2025 310" untuk "IDR 310 billion…")                                                                                  | Forme mengurutkan bidi per baris, bukan per paragraf. Beberapa baris poin RTL juga melewati margin kanan ±2,4 pt (Horizon, Senja, Tunas, Linen; tidak terlihat mata)                       |
| Halaman web publik RTL tidak mengikuti PDF                        | Semua template di `ar-SA` (sudah begitu di `main`)                                                                                       | `row-reverse` dari template dibalik lagi oleh `dir="rtl"`: sidebar Senja pindah sisi, "Rimbun Kreatif Bandung" menempel di judul entri, poin rata kiri. Perlu kerja di `html/to-html.ts`   |

Sisa:

- [ ] Jejak: entri yang pindah utuh ke halaman berikutnya membuat titik timeline diregangkan Forme jadi kapsul setinggi entri (sudah ada di produksi; temuan sesi Phase 06). Perlu perbaikan mesin (relokasi item baris saat pindah halaman); titik absolut sudah dicoba dan lebih buruk. Sekalian: judul entri timeline yang terbelah (tabel di atas).
- [ ] Mesin: keep-with-next (`minPresenceAhead`) untuk judul entri + poin pertama dan judul bagian; bisa menggantikan pass `orphanedSectionTitles`. Patch Forme + WASM (`tooling/forme/build-wasm.sh`) + build native baru.
- [x] Pemilik: aksen terang (tabel di atas). Diputuskan 2026-11-05: teks dan ikon beraksen memakai token `accentText` (`readableAccent` di `packages/pdf/src/templates/shared/tokens.ts`), digelapkan seperlunya sampai kontras 3:1; garis, bar dan blok tetap memakai aksen pilihan pengguna.
- [ ] RTL: bidi per paragraf di Forme; tata letak halaman web publik RTL.
- [ ] App mobile di simulator: Design → Ikon, galeri, render PDF dengan ketiga gaya ikon. Ditunda: app mobile belum dikerjakan (web dulu, keputusan pemilik 2026-11-04), termasuk Phase 04 mobile. Build iOS lokal butuh `bash packages/forme-native/rust/build.sh` (pin prebuilt tidak cocok dengan hash sumber Forme), lalu build Expo.
- [ ] Ukuran bundel mobile. Diukur dari berkas (tanpa menjalankan mobile): data ikon Standar 1,20 MB, Rounded 1,62 MB, Sharp 1,13 MB = 3,95 MB mentah. Metro (rilis native tanpa pemecahan bundel) memasukkan ketiganya ke satu bundel lewat `iconFiles` (`import()` hanya menunda eksekusi, tidak mengecualikan). Selain itu `apps/mobile/src/features/write/pickers.tsx` meng-import `@rezumi/pdf/icons` secara statis, jadi ±2.491 ikon Standar diurai + di-`expandIcon` begitu modul layar tulis dimuat. Saran (dikerjakan bersama pemilih ikon mobile Phase 04, file yang sama): pakai `loadIconGlyphs(style)` dari `@rezumi/pdf/icon-glyphs` saat pemilih dibuka, lalu ukur `npx expo export --platform ios` sebelum/sesudah. Mengecilkan bundel itu sendiri (mis. data ikon sebagai aset) bertentangan dengan render offline (bagian 9 `02-teknis.md`); putuskan setelah diukur.
- [ ] Tes mobile `scripts/layout.test.mjs`: penyebabnya `ui/layout.tsx` me-`require("../../assets/avatar-placeholder.webp")` tanpa fixture di tes. Fixture ditambahkan ke `componentFixtures`; **belum dijalankan** (permintaan pemilik). Jalankan `node apps/mobile/scripts/layout.test.mjs`.
- [x] `poppler` 26.10.0 dipasang (`brew install poppler`, izin pemilik 2026-11-04): 14 tes `export-text` kini lulus lokal.

### Phase 08 — Perluasan 20 template (2026-11-05)

Selesai: 12 satu kolom (Anggrek, Ivory, Pilar, Bingkai, Cerah, Mozaik, Nusa, Selaras, Teras, Cobalt, Kontras, Lintasan) dan 8 dua kolom (Graphite, Awan, Menara, Tepi, Sekar, Marquee, Fajar, Cahaya); spesifikasi di `01-desain.md` → "Perluasan 2026-11-05". Cerah, Teras dan Lintasan masuk paket Gratis (`FREE_TEMPLATES`, `BILLING_CATALOG_VERSION` 4; S&K, halaman Gratis, SEO dan panduan ikut diperbarui), 17 lainnya Premium. Setiap template punya `semantic.ts`, entri galeri web (deskripsi Lingui + terjemahan id-ID), `DOCX_LOOKS` (Graphite memakai isian sidebar baru `charcoal`), preset, persona fiktif dwibahasa tanpa foto, contoh galeri EN + ID (semuanya satu halaman A4) dan gambar dokumen. Matriks 20 × 5 varian dicek dengan mata.

Sisa: tangkapan layar galeri di `docs/guides/choosing-a-template.mdx` dan `quickstart.mdx` masih menunjukkan "16 of 16"; foto Unsplash untuk persona baru (perlu sumber dan lisensi); app mobile (keputusan "web dulu"). Kartu sidebar Awan/Sekar bisa menyisakan potongan padding kosong di halaman berikutnya bila isi sidebar pas di dasar halaman (Forme membelah padding).

## Aturan wajib untuk setiap sesi agent

1. **Baca dulu:** `CLAUDE.md`, README ini, `00-keputusan.md`, `01-desain.md`, `02-teknis.md`.
2. **Keputusan pemilik tidak diubah diam-diam.** Tanyakan, lalu catat di log `00-keputusan.md`.
3. **Git:** `git status --short` sebelum mengedit; sesi lain bisa sedang bekerja di checkout yang sama, jadi stage hanya path milik sesi ini. Branch `feat/cv-templates-NN-<slug>`. Conventional Commits. Jangan merge ke `main` tanpa persetujuan pemilik.
4. **Desain dicek dengan mata**, bukan hanya tes: render, lihat gambarnya, perbaiki, ulangi. Sertakan gambar di laporan.
5. **Web dulu; app mobile belum dikerjakan** (keputusan pemilik 2026-11-04, aturan `CLAUDE.md`). Bagian mobile di setiap phase tidak dikerjakan dan tidak dijalankan sampai pemilik memintanya; catat sebagai sisa. Logika yang nanti dibutuhkan mobile ditaruh di paket bersama, bukan di `apps/web`.
6. **Kualitas:** string baru lewat Lingui lalu `pnpm lingui:extract`; typecheck dan tes paket yang berubah; `pnpm exec turbo boundaries`; `pnpm exec vp lint --fix <path>` dan `pnpm exec vp fmt <path>`; akhiri dengan `pnpm lint:agent` dan `pnpm format:check`. Laporkan yang gagal atau dilewati.
7. **Akhir sesi:** perbarui Status di tabel dan tambahkan baris di "Catatan sesi". Bila konteks hampir habis, berhenti di titik aman, set 🟡, dan tulis langkah lanjutan yang konkret.

Format laporan akhir untuk pemilik:

```text
Phase NN — <judul>: selesai / sebagian
Yang berubah: …
Gambar contoh: …
Tes yang dijalankan: … (lulus/gagal)
Belum dikerjakan / risiko: …
Tugasmu: …
```

## Saran lanjutan (di luar phase)

- Rekomendasi template dari isi CV (ada publikasi → Cendekia; banyak skill teknis → Vector) dan filter bidang di galeri.
- Palet warna kurasi 4–5 pilihan per template, supaya pengguna Gratis tetap dapat kombinasi yang cantik.
- Surat lamaran dengan kop yang serasi untuk setiap template.
- Analitik pemakaian template (dipilih, diekspor) untuk memangkas yang kurang diminati.
- Panduan foto: perusahaan lokal sering minta foto, perusahaan multinasional dan ATS lebih suka tanpa foto. Tampilkan saran ini di Design.

## Catatan sesi

| Tanggal    | Phase                                               | Hasil                                                                                                                                                                                                                                                                                                                                                                                                                                    | Sisa / tugas pemilik                                                                                                                                                                                                                                                                                                                                                    |
| ---------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-03 | —                                                   | Audit 18 template, keputusan pemilik, rencana ini; uji Forme untuk ikon stroke Hugeicons                                                                                                                                                                                                                                                                                                                                                 | —                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-11-03 | 01, 02, 03 (sebagian), 05 (sebagian), 06 (sebagian) | Ikon Hugeicons 3 gaya di PDF + `design.icons`; 16 template baru (`lineup-page.tsx`, `tokens.ts`); galeri web/mobile hanya menampilkan lineup; default CV baru = Meridian; 5 template gratis baru; gambar contoh galeri; chip keahlian + logo tools; label kolom kustom                                                                                                                                                                   | Phase 03: hapus 18 template lama + tesnya, pasang `legacyTemplateIds`. Phase 04: grup "Ikon" lengkap di Design (gaya, judul bagian, logo) web+mobile, pemilih ikon per kategori, tombol gaya bawaan. Phase 05: fitur paket `brandLogos`. Phase 06: persona contoh, DOCX, dokumentasi. Owner: opsional sinkron kategori ikon hobi (travel, media, food) via `icons:sync` |
| 2026-11-03 | 01 (lanjutan), 04 (sebagian)                        | Set ikon CV 2.491 ikon dari ekspor Hugeicons Pro (format padat); grup Ikon di Design web + mobile; normalisasi template/ikon di setiap tulis; resource MCP `resume://_meta/design` + skill agent diperbarui; contoh resume memakai Meridian                                                                                                                                                                                              | Phase 04 sisa: pemilih ikon per kategori, tombol gaya bawaan template, label kolom kustom di form. Phase 05: kunci logo tools untuk Gratis. Phase 03: hapus kode 18 template lama (sudah tidak pernah dipakai: semua ID lama dipetakan)                                                                                                                                 |
| 2026-11-03 | 03                                                  | 18 template lama dihapus (kode, entri, 72 gambar contoh, modul `shared` yatim); `templateSchema` 16 ID; ID lama lewat `readableTemplateSchema`/`templateInputSchema`/`upgradeTemplateId`; tes dipindah ke pengganti dengan nilai ukur baru; fixture CSS, docs, README, form issue; `docs:gen` dan `lingui:extract`                                                                                                                       | Phase 04, 05, 06, 07 seperti di atas. Phase 07: kosongkan tabel temuan ATS (tracking huruf kapital). Owner: putuskan apakah mesin tanpa template pemakai (region `featured`, `skillLevelAfterName`, kontak per-pemilik) dihapus; Phase 06 mengganti `template-showcase-sources.json`                                                                                    |
| 2026-11-04 | 07 (sebagian)                                       | Tes ATS 16 template (urutan, tanggal, ikon/logo tanpa teks, dua tampilan); tracking kapital maks. 0,06 em → 10 template satu kolom + Horizon skor 100; spasi tebal→biasa tidak hilang lagi di pemeriksa ATS dan impor PDF; fixture `avatar-placeholder` tes mobile; ukuran data ikon mobile diukur dari berkas; Kirana: kolom utama lebih dulu di pohon (web sudah, PDF menunggu Forme); `poppler` dipasang                              | Matriks visual dan simulator menunggu Phase 04–06 di `main`; jalankan tes mobile; Phase 06: `row-reverse` asli di Forme untuk urutan teks Kirana                                                                                                                                                                                                                        |
| 2026-11-04 | 04 (web)                                            | Pemilih ikon per kategori + pencarian sinonim, digambar dalam gaya ikon aktif; tombol "Pakai gaya bawaan" dengan Undo; label kolom kustom; opsi Chip Keahlian (+ perbaikan chip di sidebar gelap/berwarna); filter bidang di Design dan galeri publik; terjemahan Indonesia (termasuk "Undo" → "Urungkan" di web)                                                                                                                        | Phase 04: versi mobile kelima item (ditunda pemilik). Owner: cek pemetaan template → bidang. Tindak lanjut: preset margin Sempit/Normal/Lebar web+mobile masih 10/14/19 pt, belum 24/36/48 seperti `01-desain.md`                                                                                                                                                       |
| 2026-11-04 | 05                                                  | Fitur paket `brandLogos` (Plus/Pro AI, katalog v3): server menolak menyalakan logo tools tanpa paket, nilai tersimpan tetap, impor menyesuaikan; saklar terkunci + label Plus di web dan Android, disembunyikan di iOS; daftar manfaat, harga, legal ID/EN; terjemahan id-ID. Dicek di server lokal `BILLING_MODE=admins` dengan akun Gratis dan Plus (web)                                                                              | App mobile belum dicoba di HP/simulator (web dulu, keputusan pemilik 2026-11-04); perubahan mobile yang sudah dibuat diuji dengan tes node. Owner: setujui PR (merge = tayang)                                                                                                                                                                                          |
| 2026-11-04 | 06 (bagian 1, PR #26)                               | DOCX per template (`DOCX_LOOKS`); halaman web publik di ponsel (pita Horizon, sidebar Purnama); Jejak titik/garis timeline opt-in; Wibawa kolom ikon Data Pribadi; Forme 0.29.0 ditambal di repo (tinggi absolut, `zIndex`, `row-reverse` asli) dan dilaporkan ke upstream (danmolitor/forme#234)                                                                                                                                        | Owner: PR upstream butuh tanda tangan CLA (belum); mobile butuh build toko baru karena sumber Forme native berubah                                                                                                                                                                                                                                                      |
| 2026-11-04 | 07 (matriks visual)                                 | Matriks 16 × 5 varian (`templates:matrix`, 80 PDF dicek mata): judul entri dan item Bahasa tidak terbelah lagi, judul bagian tidak tinggal sendirian di dasar halaman (render ulang), kontak RTL terbaca benar (telepon, "@handle", label) di PDF dan web, RLM RTL tidak lagi membuat teks terpotong, ikon judul Atlas tetap di tempat, nama panjang Purnama tidak terpotong. Render satu halaman LTR dan 32 PDF galeri identik per byte | Mesin: keep-with-next, timeline Jejak, bidi per paragraf; web publik RTL; pemilik: aksen terang. Mobile tetap ditunda                                                                                                                                                                                                                                                   |
| 2026-11-04 | 06 (bagian 2)                                       | Aksara standfirst, Cendekia publikasi bernomor (PDF + DOCX); 16 persona fiktif EN/ID dengan 8 foto Unsplash; skrip `templates:previews`; galeri, beranda, kartu Design dan surat memilih versi Indonesia di halaman `id`; panduan template ditulis ulang, panduan ikon dan logo baru, 5 tangkapan layar dokumen baru                                                                                                                     | Owner: setujui PR (merge = tayang). Mobile: versi Indonesia gambar galeri menyusul bersama Phase 04 mobile                                                                                                                                                                                                                                                              |
