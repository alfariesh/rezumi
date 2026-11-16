# Listing toko — teks final (disetujui pemilik 2026-11-16)

Untuk Chrome Web Store dan Edge Add-ons. Nama dan ringkasan sudah ada di paket (`apps/extension/public/_locales/*/messages.json`) dan
tampil otomatis; deskripsi panjang ditempel di dasbor tiap toko. Teks tidak berjanji lebih dari yang dilakukan plugin (dicek
terhadap `02-teknis.md` §20–21).

## Nama (aturan turunan #1, sudah dikonfirmasi)

| Bahasa | Nama                                    | Panjang |
| ------ | --------------------------------------- | ------- |
| EN     | Rezumi – Save Jobs & Track Applications | 39      |
| ID     | Rezumi: Simpan Loker & Lacak Lamaran    | 36      |

Chrome membatasi nama 75 karakter; Edge 30 sampai 100 untuk judul toko. Keduanya aman.

## Ringkasan (≤ 132 karakter)

| Bahasa | Teks                                                                                                                        | Panjang |
| ------ | --------------------------------------------------------------------------------------------------------------------------- | ------- |
| EN     | Save job postings from LinkedIn, Indeed, JobStreet, Glints and other sites to your Rezumi application tracker in one click. | 127     |
| ID     | Simpan lowongan dari LinkedIn, Indeed, JobStreet, Glints, dan situs lain ke pelacak lamaran Rezumi dengan satu klik.        | 116     |

## Deskripsi panjang

### English

```text
Save job postings to your Rezumi application tracker in one click, and prepare each application without copying and pasting.

• One-click save on LinkedIn, Indeed, JobStreet and Glints, and from any other job page through the toolbar icon, the right-click menu or Alt+Shift+S.
• Review before saving: role, company, location, salary, description and requirements, all editable.
• "Saved" marks on postings you already saved, so the same job is never tracked twice. The check runs inside your browser.
• Update the status, add notes and set follow-up reminders from the side panel.
• See how well your resume matches the posting, with the keywords it is missing.
• Optional AI: read a posting with AI, an AI match score, tailor your resume or write a cover letter (uses Rezumi credits).

Privacy first: the extension reads a page only when you ask it to, sends nothing about the pages you browse, runs no trackers or analytics, and never clicks anything on job sites for you.

Free for every Rezumi plan. Requires a free Rezumi account (rezumi.app).

Rezumi is not affiliated with LinkedIn, Indeed, JobStreet or Glints. Their names are used only to say where the extension works.
```

### Indonesia

```text
Simpan lowongan ke pelacak lamaran Rezumi dengan satu klik, lalu siapkan lamarannya tanpa salin-tempel.

• Simpan satu klik di LinkedIn, Indeed, JobStreet, dan Glints, serta dari halaman loker lain lewat ikon toolbar, menu klik kanan, atau Alt+Shift+S.
• Periksa dulu sebelum menyimpan: posisi, perusahaan, lokasi, gaji, deskripsi, dan syarat, semuanya bisa diubah.
• Tanda "Tersimpan" di loker yang sudah kamu simpan, jadi loker yang sama tidak tercatat dua kali. Pengecekannya berjalan di dalam browsermu.
• Ubah status, tambah catatan, dan pasang pengingat tindak lanjut dari panel samping.
• Lihat seberapa cocok CV-mu dengan lowongan, lengkap dengan kata kunci yang belum ada.
• AI opsional: baca loker dengan AI, skor kecocokan AI, sesuaikan CV, atau tulis surat lamaran (memakai kredit Rezumi).

Privasi nomor satu: plugin membaca halaman hanya saat kamu minta, tidak mengirim apa pun tentang halaman yang kamu kunjungi, tanpa pelacak atau analitik, dan tidak pernah menekan tombol di situs loker atas namamu.

Gratis untuk semua paket Rezumi. Perlu akun Rezumi gratis (rezumi.app).

Rezumi tidak berafiliasi dengan LinkedIn, Indeed, JobStreet, atau Glints. Nama mereka hanya disebut untuk menunjukkan di mana plugin bekerja.
```

Perubahan dari draf Phase 01: ditambah baris tidak berafiliasi (nama merek pihak ketiga di teks toko tanpa kesan kemitraan, aturan
Phase 06). Catatan: pencocokan kata kunci paling cocok untuk lowongan dan CV berbahasa Inggris (backlog B14); deskripsi tidak
menjanjikannya untuk bahasa Indonesia.

## Kategori

- Chrome Web Store: **Productivity → Workflow & Planning**
- Edge Add-ons: **Productivity**

## Gambar

Folder `gambar/`. Dibuat dari persona fiktif (Rina Wijaya, perancang produk, melamar posisi fiktif "Product Designer" di Lumen
Health) di halaman peraga netral, tanpa logo, nama, atau warna situs loker. Panel dan tombol yang tampil adalah plugin
sungguhan.

| File                              | Isi                                                                      |
| --------------------------------- | ------------------------------------------------------------------------ |
| `ikon-toko-128x128.png`           | Ikon (dari Phase 01)                                                     |
| `screenshot-{en,id}-1-1280x800`   | Tombol "Simpan ke Rezumi" di samping tombol situs                        |
| `screenshot-{en,id}-2-1280x800`   | Panel pratinjau: posisi, perusahaan, lokasi, gaji, deskripsi             |
| `screenshot-{en,id}-3-1280x800`   | Kecocokan dengan CV + kata kunci yang belum ada                          |
| `screenshot-{en,id}-4-1280x800`   | Tersimpan: status + tombol persiapan (Sesuaikan CV, Surat lamaran, Buka) |
| `screenshot-{en,id}-5-1280x800`   | Pengingat jatuh tempo di beranda panel                                   |
| `promo-kecil-{en,id}-440x280.png` | Ubin promosi kecil (dari Phase 01)                                       |

Membuat ulang: bangun plugin (`pnpm --filter extension build:dev`), jalankan server lokal dengan akun kosong, lalu
`EXTENSION_STORE_IMAGES=<folder> pnpm --filter extension exec playwright test tests/store-images.spec.ts`. Spesifikasi menulis
potongan panel asli ke `<folder>/raw/` dan lima gambar tersusun ke `<folder>/{en-US,id}/screenshot-N.png`. Hasilnya berukuran
2560×1600 (layar 2×); perkecil ke 1280×800 sebelum diunggah. Gambar juga dipakai di panduan
(`docs/images/guides/saving-jobs-from-your-browser/`).
