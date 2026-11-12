# Phase 05 — Kecocokan, AI, persiapan lamaran, pengingat

| Dikerjakan | Ukuran       | Bergantung pada | Perlu dari pemilik                 |
| ---------- | ------------ | --------------- | ---------------------------------- |
| Claude     | Sedang–besar | Phase 04        | Jawaban aturan turunan #6, #7, #11 |

## Untuk pemilik

**Apa yang dibuat:**

1. **Kecocokan dengan CV**: persentase istilah lowongan yang ada di CV pilihanmu dan daftar kata kunci yang belum ada. Gratis, tanpa AI.
2. **AI opsional**: "Baca dengan AI" (1 kredit) mengisi gaji dan syarat lebih lengkap; "Skor AI" (4 kredit) memberi skor dan alasannya. Saldo kredit tampil di panel.
3. **Tombol persiapan**: Sesuaikan CV, Tulis surat lamaran, Buka di Rezumi. Semuanya membuka web Rezumi di bagian yang tepat.
4. **Pengingat**: tanggal tindak lanjut saat menyimpan (bawaan dari batas waktu lowongan), daftar "Jatuh tempo" di panel, angka di ikon, dan notifikasi desktop bila kamu menyalakannya.

**Siapkan:** jawaban aturan turunan #6, #7, #11.

**Prompt:** `Kerjakan Phase 05 dari .agents/docs/plans/plugin-browser/README.md`

**Yang bisa kamu cek di akhir:** simpan lowongan → skor kecocokan dan kata kunci tampil; klik Sesuaikan CV → web Rezumi terbuka di lamaran itu; set pengingat hari ini → angka muncul di ikon.

## Untuk agent

### Langkah

1. **Konfirmasi aturan turunan #6, #7, #11**, catat di `00-keputusan.md`.
2. **Skor istilah** (`02-teknis.md` bagian 10): pastikan `matchResume` bisa dipanggil plugin (tambahkan ke router `resume` untuk RPC bila perlu, tanpa mengubah REST), CV bawaan #11 (cari cara akun menentukan CV utama), pemilih CV di panel, debounce, chip kata kunci.
3. **AI:** sambungkan saklar "Baca dengan AI" ke `readCapture` dengan `aiSource`, biaya dan saldo dari `billing.summary` (disembunyikan saat billing mati), perilaku dengan koneksi AI sendiri, galat kredit/paket (3.7) dengan tombol "Simpan tanpa AI". Tombol **Skor AI** memanggil `applications.ai.matchScore`.
4. **Persiapan:** cek tab detail lamaran di web (`WORKSPACE_TABS`) yang memuat Sesuaikan CV dan surat lamaran, lalu buka `/dashboard/applications/<id>/<tab>` di tab baru. Bila web butuh parameter tambahan agar langsung membuka alatnya, tambahkan dengan perubahan kecil di web dan tes.
5. **Pengingat** (`02-teknis.md` bagian 11): kolom pengingat di form simpan dan layar tersimpan (`followUpAt`, `followUpNote`), bawaan dari `validThrough` (#6), daftar Jatuh tempo di beranda (`dueFollowUps` atau filter `list`; buat prosedurnya bila perlu, `Internal`), tombol "Selesai", alarm 60 menit untuk badge, notifikasi opsional dengan izin `notifications` yang diminta saat dinyalakan (#7).
6. **Teks:** Lingui + terjemahan Indonesia.

### Aturan yang wajib dijaga

- Tidak ada AI yang berjalan tanpa tindakan pengguna; biaya selalu terlihat sebelum diklik.
- Notifikasi mengikuti #7 dan tidak muncul bila izin dicabut.
- Alur AI berat (sesuaikan CV, surat lamaran) tetap di web, bukan di plugin.

### Tes dan verifikasi

- API: `dueFollowUps` (zona waktu akun, hanya milik pengguna) bila dibuat; `matchResume` lewat RPC bila ditambahkan.
- Unit: tanggal pengingat bawaan dari `validThrough`, frekuensi notifikasi, tampilan kredit saat billing mati/menyala.
- Playwright terhadap server lokal: skor istilah tampil dan berubah saat CV diganti; "Baca dengan AI" dan "Skor AI" dengan stub AI lokal (lihat `tests/e2e/README.md`, `FLAG_ALLOW_UNSAFE_AI_BASE_URL`); kredit habis → pesan + "Simpan tanpa AI"; tombol persiapan membuka URL web yang benar; pengingat → badge.
- Screenshot layar 3.3 dan 3.4 lengkap, beranda dengan Jatuh tempo, contoh notifikasi.

### Selesai bila

- Kecocokan, AI, persiapan, dan pengingat berjalan di Chrome dan Edge terhadap server lokal, dengan billing mati dan menyala.
- Aturan turunan #6, #7, #11 tercatat.
