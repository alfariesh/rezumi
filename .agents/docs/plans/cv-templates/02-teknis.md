# Rancangan teknis — revamp template CV

Untuk agent. Perbarui dokumen ini bila desain berubah saat implementasi.

## 1. ID template

- `packages/schema/src/templates.ts`: `templateSchema` berisi 16 ID baru; `templateLayouts` per ID; `templatePresets` (font judul/isi + bobot, warna aksen, tata letak entri) per ID.
- `legacyTemplateIds`: peta 18 ID lama → pengganti (lihat tabel `00-keputusan.md`). `metadata.template` memakai `.catch(({ input }) => upgradeTemplateId(input))`, sehingga JSON lama, file Reactive Resume, dan data uji tetap terbuka. ID lama tidak pernah ditulis lagi. Surat lamaran (`packages/api/src/dto/cover-letter.ts`) memakai pemetaan yang sama.
- Semua `Record<Template, …>` ikut diperbarui: galeri web `apps/web/src/dialogs/resume/template/data.ts`, mobile `apps/mobile/src/features/design/*`, DOCX `packages/docx/src/builder.ts` (`SIDEBAR_BACKGROUND`), manifest semantik `packages/pdf/src/semantic/template-manifest.ts`, registry `packages/pdf/src/templates/index.ts`, dan `packages/resume/src/stylesheet/registry/semantic.ts`.
- Selector CSS kustom `resume[template="…"]` memakai ID baru; karena belum ada pengguna sungguhan, tidak perlu alias.

## 2. Ikon

### Data

- Sumber: `packages/icons/svg/stroke-{standard,rounded,sharp}/*.svg`, set `cv` di `packages/icons/catalog.json` (1.163 ikon, termasuk 194 logo). Nama = nama Hugeicons (`mortarboard-01`, `linkedin-02`).
- Generator `tooling/icons/hugeicons-pdf.ts` (skrip `icons:pdf`) menulis `packages/pdf/src/forme/hugeicons/<gaya>/{common,rest}.json` berisi markup di dalam `viewBox 0 0 24 24`: setiap elemen tanpa `fill` diberi `fill="none"`, `currentColor` diganti saat render, angka path dipisah spasi (kebiasaan Forme lama), dan markup selain `path/circle/rect/ellipse` membuat generator gagal.
- Uji 2026-11-03: Forme 0.29 menggambar stroke, `stroke-linecap`, dan `stroke-linejoin` Hugeicons dengan benar asalkan `fill="none"` ada di setiap elemen.
- Ukuran: ±175–273 KB gzip per gaya untuk seluruh set; hanya gaya yang dipakai yang dimuat, ±40 ikon umum dimuat lebih dulu.
- `@rezumi/schema/icons` (`icons.ts`) menjadi daftar nama ikon CV (untuk pemilih ikon dan deskripsi AI). Phosphor dihapus dari PDF.

### Nama lama

`packages/schema/src/resume/icon-names.ts`: `upgradeIconName(name)` memetakan nama Phosphor yang dikenal (bagian `cv.phosphor` di `packages/icons/icons.config.json`, diperluas untuk ikon yang sering dipakai) ke nama Hugeicons; nama tak dikenal → tanpa ikon. Dipakai saat parse data (`parseResumeData`) agar data lama tersimpan ulang dengan nama baru.

### Pengaturan di skema

`metadata.design.icons` (menggantikan `page.hideIcons` dan `page.hideSectionIcons`; nilai lama dibaca sekali saat parse):

```ts
icons: {
  enabled: boolean; // false = tidak ada ikon sama sekali
  style: "standard" | "rounded" | "sharp";
  contact: boolean; // email, telepon, lokasi, situs, kolom kustom
  sections: boolean; // ikon di depan judul bagian
  items: boolean; // ikon keahlian, minat, profil
  logos: boolean; // logo tools di Keahlian (fitur paket `brandLogos`)
}
```

Bawaan: `{ enabled: true, style: "standard", contact: true, sections: false, items: true, logos: false }`.

### Logo otomatis

`packages/resume/src/brands.ts`: daftar merek yang punya logo di set Hugeicons beserta alias teks (`"js"`, `"javascript"` → `javascript`; `"ms excel"`, `"excel"` → `office-365` bila tidak ada yang lebih tepat). Dipakai untuk:

- jaringan Profil tanpa ikon pilihan pengguna (`getNetworkIcon`),
- nama dan kata kunci Keahlian saat `icons.logos` menyala.

Teks selalu dicetak; logo hanya hiasan.

## 3. Skema lain

- `customFieldSchema.label` (opsional, `""`): label untuk tabel Data Pribadi (Wibawa, Tenun) dan tampilan "Label: teks" di template lain.
- `skillsSection.keywordLayout`: tambah `"tags"` (chip).
- Bawaan halaman: margin 36 × 32 pt (lihat `01-desain.md`).
- Deskripsi Zod untuk ikon menyebut set Hugeicons, bukan Phosphor; `docs/spec.json` dan skema JSON publik dibuat ulang (`pnpm docs:gen`).

## 4. Komponen bersama PDF

Di `packages/pdf/src/templates/shared/`:

- `tokens.ts`: warna turunan (`ink`, `muted`, `subtle`, `hairline`, `accent`, `accentSoft`, `onAccent`) dan skala ukuran.
- Fitur template `headingDecoration` di `SectionShell` (lihat `01-desain.md`).
- Chip kata kunci Keahlian (`keywordLayout: "tags"`) dan logo merek.
- `DetailsTable` untuk Data Pribadi; `Monogram` (inisial) untuk Senja.
- `Icon` primitive membaca `design.icons` dan gaya; pengganti `PhosphorIcon` di `packages/pdf/src/forme/icons.tsx`.

Halaman web publik (`packages/pdf/src/html`) memakai pohon template yang sama; cek setiap template baru di sana juga.

## 5. Kompatibilitas

- App mobile belum dirilis ke toko (status 2026-11-03), jadi skema boleh berubah sekarang. Mulai rilis pertama, field baru wajib opsional dengan `.catch`, dan perubahan bentuk data butuh rencana untuk binary lama (lihat `CLAUDE.md`).
- `parseResumeData` meng-upgrade: ID template lama, nama ikon Phosphor, `page.hideIcons`/`hideSectionIcons` → `design.icons`.

## 6. Cara mengecek desain

```sh
cd tooling
pnpm exec tsx --tsconfig ../tsconfig.json templates/preview.ts --out <folder> --photo meridian sterling
sips -s format png --resampleWidth 1240 <folder>/meridian.pdf --out <folder>/meridian.png   # macOS
```

`--locale id-ID` mencetak judul bagian bahasa Indonesia; `--set path=json` mengubah satu nilai (`--set metadata.design.colors.primary='"rgba(0,0,0,1)"'`). Cek setiap template dalam matriks: dengan/tanpa foto, A4/Letter, dua halaman, aksen terang dan gelap, `--locale ar` (RTL).

## 7. Tes

- `packages/pdf/src/semantic/all-templates-smoke.test.tsx` dan `ats-extraction.integration.test.tsx` mencakup semua ID baru (urutan teks hasil ekstraksi: nama, kontak, judul bagian, tanggal).
- Tes khusus template lama (`ditgar`, `onyx`, `persian`, `gengar`) dihapus atau dipindah ke template penggantinya.
- `pnpm --filter @rezumi/pdf test`, `pnpm --filter @rezumi/schema test`, `pnpm --filter @rezumi/docx test`, typecheck paket terdampak, `pnpm exec turbo boundaries`.

## 8. Status implementasi (2026-11-03)

- Ikon: `tooling/icons/hugeicons-pdf.ts` (`icons:pdf`) menulis `packages/pdf/src/forme/hugeicons/` dan `packages/schema/src/icons.ts`; renderer `ResumeIcon` di `packages/pdf/src/forme/icons.tsx`; saklar per peran di `packages/pdf/src/icon-visibility.ts` (`contact`, `item`, `section`, `level`, `logo`). Prop `Icon` bernama `iconRole` (bukan `role`, yang dibaca lint sebagai ARIA). Ikon kontak bisa punya slot sendiri (`contactIcon`) untuk header berpita.
- Nama lama: `packages/schema/src/resume/icon-names.ts` (`upgradeIconName`, `upgradeResumeIcons` dipanggil dari `parseResumeData`).
- Ikon item otomatis: `packages/pdf/src/templates/shared/item-icons.ts` (logo jaringan Profil; logo tools Keahlian saat `icons.logos`). Katalog merek: `packages/resume/src/icons.ts` (`getNetworkIcon`, `getBrandIcon`). Ikon yang digambar harus ada di pohon semantik (`semantic/tree.ts` memakai `itemIcon` yang sama), karena node yang tidak ada di pohon tidak dirender.
- Template: kerangka `OneColumnLayout`/`TwoColumnLayout` dan hook `useLineupBase` di `packages/pdf/src/templates/shared/lineup-page.tsx`; token di `shared/tokens.ts` (`createDesignTokens`, `createLineupStyles`); slot baru `sectionHeadingMarker`, `sectionHeadingRule`, `tag`, `tagList`, `contactLabel`, `contactIcon`; header bersama `HeaderContactList`.
- Lineup dan preset: `templateLineup`, `templatePresets` di `packages/schema/src/templates.ts`. Pemilih web/mobile, galeri, beranda, SEO server, dan WebMCP hanya memakai `templateLineup`; 18 ID lama masih di enum agar dokumen lama tetap dirender sampai Phase 03.
- Tes lama yang mengukur geometri dengan bawaan lama dikunci ke nilai lama (Onyx, margin 14 × 12, IBM Plex Serif 10 pt, aksen merah) dengan komentar; pindahkan atau hapus saat template lama dihapus.
- Contoh galeri dibuat dengan `tooling/templates/preview.ts` (preset otomatis, `--no-preset` untuk mematikan) + `sips` (macOS) + Pillow untuk JPG/WebP. Saat ini semua contoh memakai persona sampel David Kowalski; persona per template menyusul di Phase 06.

## 9. Pembaruan 2026-11-03 (sesi kedua)

- **Aset ikon tidak di R2.** Gambar ikon ikut kode aplikasi (`packages/pdf/src/forme/hugeicons/`), sehingga render PDF di web, Worker, dan app mobile tidak perlu mengambil ikon lewat jaringan (mobile bisa offline), versinya selalu cocok dengan kode, dan paket Hugeicons Pro tidak tersedia publik sebagai berkas SVG mentah. R2 hanya untuk unggahan pengguna (foto, font). Data resume hanya menyimpan **nama** ikon dan `design.icons`; logo tools dicari dari teks saat render, tanpa penyimpanan.
- **Set ikon CV**: 26 kategori, 2.491 ikon per gaya, disinkron dari ekspor Hugeicons Pro 4.3.4 (`pnpm --filter @rezumi/tooling icons:sync <folder ekspor svg>`, lalu `icons:pdf`). Kategori diatur di `packages/icons/icons.config.json` → `cv.categories`. Format data padat: angka 2 desimal, atribut cat yang berulang ditulis sebagai satu karakter (`expandIcon` di `hugeicons/index.ts`); ±1,1 MB mentah / ±300 KB gzip per gaya, dimuat per gaya hanya saat dipakai.
- **Normalisasi tulis**: `upgradeResumeDesign` (skema) dipanggil di setiap baca (`parseResumeData`) dan tulis (`parseWritableResumeData`): ID template lama → penggantinya (`legacyTemplateSuccessors`), nama ikon Phosphor → padanan Hugeicons (145 pemetaan), nama tak dikenal → `""`, saklar ikon lama di `page` → `design.icons`. Surat lamaran memakai `upgradeTemplateId` saat template dipilih.
- **Untuk agent**: resource MCP `resume://_meta/design` (`@rezumi/resume/design-catalog`) berisi lineup + ringkasan + paket + preset, peta template lama, ikon per kategori dengan aturan `design.icons`, dan aturan logo (profil otomatis; logo tools + kata yang dicocokkan). Dicantumkan juga di server card MCP, deskripsi `patch_resume`, dan skill `plugins/rezumi/skills/resume-builder/SKILL.md`. Deskripsi Zod ikut menjelaskan nama ikon dan pengaturannya (dibuat ulang ke `docs/spec.json` dan `references/schema.md` lewat `pnpm docs:gen`).
- **Untuk manusia**: Design → Ikon (web: bagian sendiri; web ponsel dan app mobile: tab "Icons"): Tampilkan ikon, Gaya ikon (Standar/Rounded/Sharp), Baris kontak, Judul bagian, Keahlian/minat/profil, Logo tools. Dicek di browser lokal: saklar dan gaya tersimpan ke server dan pratinjau langsung berubah.
