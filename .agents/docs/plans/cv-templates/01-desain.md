# Bahasa desain dan spesifikasi 16 template

Dokumen untuk agent yang membangun template. Hasil akhir selalu dicek dengan mata: render PDF, ubah ke gambar, bandingkan dengan spesifikasi ini (lihat "Cara mengecek" di `02-teknis.md`).

## Kenapa template lama terasa jadul

Hasil audit 2026-11-03 (gambar `apps/web/public/templates/jpg/*.jpg`):

1. **Sesak.** Margin bawaan 14 pt (≈5 mm). CV yang elegan memakai 12–18 mm.
2. **Hierarki lemah.** Nama, judul bagian, dan tanggal ukurannya mirip; tanggal dan lokasi sama tebal dengan isi.
3. **Kembar.** Sembilan template satu kolom hanya berbeda warna atau huruf judul.
4. **Hiasan berat.** Sidebar warna pekat (ungu, marun, pink), kotak bergaris di setiap bagian, garis 1 pt di mana-mana.
5. **Ritme tidak konsisten.** Jarak antar-butir terlalu lebar, kata kunci keahlian abu-abu kecil.

## Prinsip

1. **Tipografi yang bekerja.** Nama adalah pahlawan: 2–3× ukuran isi, tracking sedikit negatif, tebal 600–800 (atau serif display 400–500). Selebihnya tenang.
2. **Satu aksen, dipakai hemat.** Aksen untuk satu atau dua peran saja (nama atau judul bagian atau garis), tidak semuanya. Teks utama tinta gelap; meta (tanggal, lokasi, penerbit) memakai warna redup; garis memakai warna samar.
3. **Garis rambut.** Garis 0,5–0,75 pt warna samar. Tidak ada kotak berbingkai kecuali konsepnya memang grid (Tenun).
4. **Ritme tetap.** Jarak bagian > jarak entri > jarak butir. Butir rapat (sekitar 0,15× jarak entri).
5. **Tanggal itu meta.** Redup, tidak tebal, rata kanan atau di kolom sendiri.
6. **Foto opsional.** Bulat atau sudut membulat lembut; template tetap seimbang tanpa foto.
7. **Ikon kecil dan sejajar.** Tinggi ikon = tinggi huruf kapital isi; warna aksen atau redup; tidak pernah menggantikan teks.
8. **Tracking maks. 0,06 em.** Dari ±0,1 em, pdf.js dan parser ATS membaca celah antarhuruf sebagai spasi ("E D U C A T I O N") sehingga judul bagian atau nama hilang. Helper `tracking` di `shared/lineup-page.tsx` membatasinya; tes ATS menjaganya.

## Token bersama

Semua template baru memakai `packages/pdf/src/templates/shared/tokens.ts` (dibuat Phase 01). Nilai diturunkan dari pengaturan pengguna, sehingga font, ukuran, dan warna pilihan pengguna tetap berlaku.

| Token           | Nilai                                                          |
| --------------- | -------------------------------------------------------------- |
| `ink`           | warna teks pengguna                                            |
| `muted`         | 60% teks di atas latar (tanggal, lokasi, penerbit, kata kunci) |
| `subtle`        | 38% teks (pemisah, butir)                                      |
| `hairline`      | 16% teks (garis rambut)                                        |
| `accent`        | warna utama pengguna                                           |
| `accentSoft`    | 8% aksen di atas latar (latar sidebar, chip)                   |
| `onAccent`      | putih atau tinta, dipilih menurut kontras di atas `accent`     |
| `meta` (ukuran) | 0,92× ukuran isi                                               |
| `small`         | 0,86× ukuran isi                                               |
| `label`         | 0,8× ukuran isi, huruf kapital, tracking 0,06 em, tebal 700    |

Dekorasi judul bagian (fitur template `headingDecoration`): `rule-below` (garis di bawah), `rule-after` (garis mengisi sisa baris), `bar` (batang aksen pendek di depan), `underline-short` (garis aksen 24 pt di bawah), `band` (pita samar di belakang), `none`.

Bawaan halaman baru: margin 36 × 32 pt; preset Sempit 24 × 20, Normal 36 × 32, Lebar 48 × 40 (web dan mobile sama).

## Preset gaya per template

Setiap template punya preset font, warna, dan tata letak entri (`templatePresets` di `packages/schema/src/templates.ts`). Preset dipakai untuk contoh di galeri, CV baru, dan tombol "Pakai gaya bawaan template" di Design. Mengganti template tanpa menekan tombol itu tetap mempertahankan font dan warna pengguna, jadi setiap template harus tetap bagus dengan font lain.

## Spesifikasi

Kolom "Preset" adalah titik awal; agent boleh menyesuaikan setelah melihat hasil render, lalu memperbarui tabel ini.

### Satu kolom

**1. Meridian** — modern Swiss bersih, template default.

- Header rata kiri: nama besar sans tebal tracking −0,01 em; headline aksen tebal 500; baris kontak redup dengan ikon kecil. Foto opsional di kanan, bulat.
- Garis rambut penuh di bawah header.
- Judul bagian: label kapital kecil aksen + `rule-after`.
- Entri: organisasi tebal, peran normal, tanggal dan lokasi redup rata kanan.
- Preset: Plus Jakarta Sans (judul 700, isi 400/600); aksen biru tinta.

**2. Sterling** — klasik Wall Street, tenang dan berwibawa.

- Header tengah: nama serif kapital dengan tracking 0,06 em (lebih lebar membuat ATS membaca huruf terpisah); kontak tengah dipisah "·" (ikon kecil bila menyala).
- Judul bagian: serif kapital tebal tracking + `rule-below` warna tinta.
- Entri: organisasi tebal + lokasi kanan; peran miring + tanggal kanan.
- Preset: EB Garamond; aksen hampir hitam.

**3. Aksara** — editorial ala majalah.

- Kicker (headline) kapital kecil aksen di atas nama serif display sangat besar (≈3× isi, tebal 400).
- Ringkasan sebagai standfirst: 1,15× isi, tinta redup.
- Judul bagian serif 1,2× isi tanpa kapital, garis rambut di atas bagian.
- Preset: Instrument Serif (judul) + Inter (isi); aksen terakota.

**4. Atlas** — grid Swiss dengan label di selokan kiri.

- Judul bagian di kolom kiri (≈22% lebar), isi di kanan; garis rambut di atas tiap bagian selebar halaman.
- Header: nama kiri; kontak sejajar dengan kolom isi.
- Preset: Inter Tight; aksen teal tua.

**5. Tunas** — padat dan segar untuk fresh graduate.

- Kepadatan Ringkas; nama sedang; kontak satu baris.
- Judul bagian dengan `bar` aksen; Pendidikan di atas Pengalaman pada preset tata letak.
- Preset: DM Sans; aksen hijau daun.

**6. Summit** — eksekutif.

- Garis aksen tebal (3 pt) di tepi atas setiap halaman; nama sangat tebal; headline kapital tracking.
- Judul bagian kalimat biasa tebal dengan garis aksen 1,5 pt selebar kolom di bawahnya (dibuat begitu setelah render: lebih tegas daripada garis pendek).
- Preset: Manrope (judul 800) + Inter; aksen merah anggur tua.

**7. Cendekia** — akademik dan beasiswa.

- Header rata kiri serif; tahun di kolom kiri (`date-column`); Publikasi bernomor dengan indentasi gantung.
- Judul bagian kapital kecil aksen + `rule-below`.
- Preset: Source Serif 4; aksen biru Oxford; entri `date-column`.

**8. Wibawa** — formal Indonesia.

- Foto 3:4 sudut membulat di kanan atas; di kirinya nama, headline, lalu tabel **Data Pribadi** (label rata kiri, nilai sejajar) dari kontak dan kolom kustom berlabel.
- Judul bagian tebal + `rule-below` aksen.
- Preset: Plus Jakarta Sans; aksen biru dongker; ikon kontak mati (label sudah menjelaskan).

**9. Tenun** — grid bergaris ala DRH/rirekisho, versi modern.

- Header sebagai sel tabel bergaris rambut (nama, kontak, foto); setiap bagian tabel dengan baris judul `band` samar (bukan blok gelap); tanggal di sel kiri.
- Preset: IBM Plex Sans; aksen nila.

**10. Vector** — developer dan data.

- Nama sans tebal; headline dan tanggal monospace aksen; logo GitHub/LinkedIn di kontak.
- Keahlian di atas sebagai "Stack": chip bersudut membulat per kata kunci, logo tools bila fitur menyala (Plus).
- Judul bagian label monospace kapital aksen.
- Preset: JetBrains Mono (judul, label, tanggal) + Inter (isi, nama); aksen indigo.

### Dua kolom

**11. Kirana** — sidebar kiri lembut.

- Sidebar penuh tinggi warna `accentSoft`; foto bulat di atas sidebar; kontak, keahlian, bahasa di sidebar dengan label kapital kecil.
- Kolom utama: nama + headline di atas, lalu ringkasan dan pengalaman. Judul utama kalimat biasa semibold aksen.
- Preset: Manrope; aksen teal.

**12. Linen** — minimalis putih, sidebar kanan.

- Tanpa isian warna; garis rambut vertikal memisahkan kolom; nama serif elegan.
- Label sidebar kapital kecil redup.
- Preset: Newsreader (judul 500) + Source Sans 3; aksen tanah liat, tinta hangat.

**13. Horizon** — pita header.

- Pita aksen penuh lebar di atas: nama, headline, kontak putih; foto bulat di kanan pita.
- Dua kolom di bawahnya: utama kiri ≈65%, sidebar kanan.
- Preset: Inter; aksen slate gelap.

**14. Jejak** — timeline karier.

- Pengalaman dan Pendidikan sebagai timeline: garis rambut vertikal, titik aksen kecil per entri, tanggal di sisi kiri garis.
- Sidebar kiri sempit untuk kontak dan keahlian.
- Preset: Outfit; aksen koral.

**15. Purnama** — sidebar gelap elegan.

- Sidebar penuh tinggi warna aksen gelap, teks `onAccent`; nama serif besar di sidebar; foto bulat dengan cincin tipis.
- Kolom utama putih, judul tinta dengan aksen hanya di garis kecil.
- Preset: Cormorant Garamond (judul 600) + Inter; aksen biru malam.

**16. Senja** — kreatif.

- Nama sangat besar (≈3,2× isi) sans display; blok warna aksen asimetris di kiri atas di belakang monogram inisial (bila tanpa foto) atau di belakang foto yang sedikit bergeser.
- Dua kolom di bawahnya, sidebar kanan 32%.
- Preset: Bricolage Grotesque (judul 700) + DM Sans; aksen koral senja.
