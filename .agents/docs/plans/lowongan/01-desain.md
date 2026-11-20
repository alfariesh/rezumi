# Alur dan layar — cari lowongan

Untuk pemilik dan agent. Tampilan memakai komponen HeroUI yang sudah ada (MCP `heroui-pro`) dan pola halaman dashboard Rezumi. Detail visual diputuskan di Phase 03 dengan screenshot untuk pemilik.

## 1. Halaman "Lowongan" (`/dashboard/jobs`)

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Lowongan                                          Sisa hari ini: 12/15 │
│ ┌──────────────────────────────┐ ┌──────────────┐ [Cari]             │
│ │ Posisi atau kata kunci        │ │ Lokasi       │                    │
│ └──────────────────────────────┘ └──────────────┘                    │
│ [United Kingdom ▾] [Posted: 30 days ▾] [Remote ▾] [Level ▾] [More ▾]  │
│ [Simpan sebagai notifikasi]                                          │
├──────────────────────────────────────────────────────────────────────┤
│ 20 lowongan · diperbarui 2 jam lalu                                   │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │ [logo] Product Manager, Payments             ● Cocok: 4 dari 6   │ │
│ │        Acme Ltd · London · Hybrid · £70k–£85k · Sponsor visa      │ │
│ │        Diposting 2 hari lalu · lewat situs karier perusahaan      │ │
│ │        [Lacak]  [Sesuaikan CV]  [Lihat posting asli ↗]            │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│ …                                                                    │
│ [Muat lebih banyak]                                                  │
└──────────────────────────────────────────────────────────────────────┘
```

- **Kotak pencarian** diisi otomatis dari Profil (posisi yang dicari dan lokasi preferensi) saat pertama dibuka, tetapi tidak langsung mencari sebelum pengguna menekan Cari.
- **Negara** mengikuti pengaturan wilayah pencarian yang sudah ada (`searchRegions`, bawaan dari zona waktu akun), bisa diganti di sini. Pilihan "Remote (di mana saja)" tersedia. Gaji ditampilkan dalam mata uang aslinya, apa adanya.
- **Filter** (K11): negara/kota, tanggal posting, remote (di mana saja / di negara ini / tidak), level, tipe kerja, dan di "More": **gaji minimum** dengan centang "sertakan lowongan tanpa gaji" (aktif bawaan, karena di banyak negara gaji jarang dicantumkan) dan **sponsor visa**. Filter yang tidak didukung penyedia tidak ditampilkan.
- **Kartu lowongan:** posisi, perusahaan (logo bila ada), lokasi, tipe kerja, tanggal posting relatif, sumber ("lewat LinkedIn", "lewat situs karier perusahaan"), gaji bila ada, chip kecocokan (K8).
- **Tombol kartu:**
  - **Lacak** → membuat lamaran di Applications dengan posisi, perusahaan, lokasi, deskripsi, dan link; kartu berubah jadi "Dilacak ✓" dengan tautan ke lamaran.
  - **Sesuaikan CV** → lacak dulu bila belum, lalu buka alur "tailor resume" yang sudah ada.
  - **Lihat posting asli ↗** → selalu ada (aturan penyedia).
  - Menu ⋯: **Sembunyikan** (tidak muncul lagi untuk pengguna ini), **Laporkan lowongan bermasalah**.
- **Klik kartu** → panel samping (Sheet di ponsel) berisi deskripsi lengkap, ringkasan persyaratan, info perusahaan (ukuran, industri) bila ada, dan tombol yang sama.
- **Lowongan yang sudah tutup** tidak tampil di hasil. Bila tutup setelah dilacak, lamaran diberi tanda (Phase 05).

## 2. Keadaan khusus

| Keadaan                    | Tampilan                                                                                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Belum pernah mencari       | Ilustrasi kecil + saran kata kunci dari Profil ("Coba: Digital Marketing di Jakarta")                                                                                           |
| Tidak ada hasil            | "Belum ada lowongan yang cocok." + saran: perluas tanggal posting, hapus filter, coba kata lain; tautan ke extension untuk papan lowongan lokal                                 |
| Kuota harian habis         | Hasil cache tetap bisa dibuka. Pesan netral (tanpa harga, sesuai aturan pesan paket): "Batas pencarian hari ini tercapai. Coba lagi besok." Web menambahkan tautan Lihat paket. |
| Anggaran server habis (K7) | "Pencarian baru sedang dibatasi. Hasil yang sudah ada tetap bisa dibuka." Tanpa menyalahkan pengguna.                                                                           |
| Penyedia gagal             | Coba penyedia lain otomatis. Bila semua gagal: "Lowongan belum bisa dimuat. Coba lagi sebentar lagi."                                                                           |

## 3. Notifikasi lowongan baru

- Tombol **"Simpan sebagai notifikasi"** di halaman Lowongan membuat jadwal discovery yang sudah ada (`careerSchedule` jenis `discovery`) dengan kata kunci dan filter yang sama. Frekuensi: harian (bawaan) atau mingguan.
- Lowongan baru masuk ke daftar **Peluang** di Home/Karier (layar `today.tsx` yang sudah ada) dan, bila dipilih, email ringkasan.
- Pengaturan jadwal di `schedule-sheet.tsx` tidak lagi menyebut Web access atau API key.

## 4. Dialog "Tambah lamaran"

Pencarian di dialog (`add-application-dialog.tsx`) diganti tautan **"Cari lowongan"** yang membuka halaman Lowongan. Tempel link atau teks posting tetap ada.

## 5. Yang hilang

- Bagian **Settings → AI → Web access** (Firecrawl/Tavily/Exa) dihapus di Phase 06 (K4).
- Pesan "Job search isn't configured on this server" tidak ada lagi.
