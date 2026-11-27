# Draf teks privasi: impor website (Phase 03)

Ditulis 2026-11-27, **disetujui pemilik dan dipasang 2026-11-27** di `docs/legal/privacy-policy.mdx` dan `kebijakan-privasi.mdx` (baris tabel data, poin "Sumber Profil" di Penerima, GitHub di lokasi pemrosesan). Bagian GitHub dan foto diambil dari draf sumber Profil 2026-11-13. **LinkedIn (treg/Apify) belum dipasang**: draf lama masih punya `[periksa]` (badan hukum Apify, lama simpan run) dan belum menyebut treg yang sekarang dipakai lebih dulu. Tanggal berlaku kebijakan tidak diubah.

Catatan di bawah ini adalah teks usulan aslinya.

Kenapa belum dipasang:

1. Draf sumber Profil sebelumnya (`.agents/docs/plans/profil/draf-privasi-onboarding.md`, 2026-11-13) juga **belum masuk** ke `docs/legal/privacy-policy.mdx` maupun `kebijakan-privasi.mdx`. Kalimat impor website menumpang di bagian itu, jadi keduanya sebaiknya dipasang bersama.
2. Checkout utama pemilik sedang punya perubahan belum di-commit di kedua file itu (bagian analytics). Memasang dari worktree ini akan bentrok.

Setelah disetujui: pasang draf profil (dengan `[periksa]` Apify dijawab) **dan** tambahan di bawah, di kedua bahasa, lalu perbarui tanggal "Terakhir diperbarui".

Tidak ada penerima atau vendor baru (keputusan W7): halaman dibaca server Rezumi (dan Cloudflare Browser Run, yang sudah tercantum sebagai infrastruktur Cloudflare), teksnya dibaca penyedia AI yang sudah tercantum, dan gambar disimpan di penyimpanan Rezumi (Cloudflare R2) yang sudah tercantum.

## English (`docs/legal/privacy-policy.mdx`)

### Change the row added from the Profile sources draft ("Data, purposes and legal bases")

| Data                                                                                                                                                                                                   | Purpose                                                          | Basis                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- | --------------------- |
| A LinkedIn profile address, GitHub username or personal website address you enter, what is read from it, a photo you choose to keep, and the pictures of the works you choose to add from your website | Filling your Profile and portfolio when you ask, for your review | User request/contract |

### Replace the "Personal websites" bullet under "Profile sources, only when you ask"

- **Personal websites:** the page is fetched from its own server (or, when it needs JavaScript, through Cloudflare's browser
  rendering) and read by the AI provider you chose (see AI providers). If you confirm the site is your own, Rezumi also reads
  up to ten of its pages about your work (eleven pages in all) to suggest portfolio works. What was found is kept for 24
  hours so you can review it, then deleted; Rezumi keeps only a record that the import ran (the site's address, when, how many
  pages and works, and whether it was your free one). Nothing is added until you choose the works. The pictures of the works you add are
  copied to your portfolio's storage at Rezumi and count toward its storage limit; Rezumi does not show them from your site.

## Bahasa Indonesia (`docs/legal/kebijakan-privasi.mdx`)

### Ubah baris dari draf sumber Profil ("Data, tujuan, dan dasar hukum")

| Data                                                                                                                                                                                                                 | Tujuan                                                                     | Dasar                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------- |
| Alamat profil LinkedIn, username GitHub, atau alamat situs pribadi yang Anda isi, isi yang dibaca dari sana, foto yang Anda pilih untuk disimpan, dan gambar karya yang Anda pilih untuk ditambahkan dari situs Anda | Mengisi Profil dan portfolio Anda atas permintaan Anda, untuk Anda periksa | Permintaan pengguna/kontrak |

### Ganti poin "Situs pribadi" di bawah "Sumber Profil, hanya bila Anda minta"

- **Situs pribadi:** halaman diambil dari servernya sendiri (atau, bila butuh JavaScript, lewat layanan browser Cloudflare)
  lalu dibaca oleh penyedia AI yang Anda pilih (lihat Penyedia AI). Bila Anda menyatakan situs itu milik Anda sendiri, Rezumi
  juga membaca sampai sepuluh halaman karya di situs itu (total sebelas halaman) untuk mengusulkan karya portfolio. Hasilnya
  disimpan 24 jam supaya bisa Anda periksa, lalu dihapus; Rezumi hanya menyimpan catatan bahwa impor itu berjalan (alamat
  situs, kapan, berapa halaman dan karya, dan apakah itu impor gratis Anda). Tidak ada yang ditambahkan sebelum Anda memilih karyanya.
  Gambar karya yang Anda tambahkan disalin ke penyimpanan portfolio Anda di Rezumi dan dihitung ke kuota penyimpanannya;
  Rezumi tidak menampilkannya dari situs Anda.

## Yang perlu pemilik putuskan

- Setuju dengan teks di atas (Inggris dan Indonesia)?
- Pasang sekarang bersama draf sumber Profil (butuh jawaban `[periksa]` Apify di draf itu), atau tunggu sampai perubahan
  analytics di checkout utama di-commit?
