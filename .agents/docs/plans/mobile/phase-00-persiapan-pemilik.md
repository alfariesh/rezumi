# Phase 00 — Persiapan pemilik

| Dikerjakan               | Ukuran | Bergantung pada | Perlu dari pemilik |
| ------------------------ | ------ | --------------- | ------------------ |
| Pemilik + Claude memandu | Kecil  | —               | ±45 menit          |

## Untuk pemilik

**Tujuan:** memastikan app nanti benar-benar bisa dirilis atas namamu, dan Mac siap dipakai membangun app. Tidak ada kode yang berubah di phase ini.

**Prompt:** `Bantu saya mengerjakan Phase 00 dari .agents/docs/plans/mobile/README.md`

Yang kamu kerjakan (Claude memandu satu per satu; jangan menempel kata sandi atau kunci di chat):

1. **Cek kepemilikan akun (P1).** Buka dan pastikan kamu bisa masuk sebagai pemilik/admin:
   - developer.apple.com → Membership: apakah Team ID-nya `654ASRW868`?
   - appstoreconnect.apple.com → Apps: apakah ada app **Rezumi** (`app.rezumi`)?
   - play.google.com/console: apakah ada app dengan paket `app.rezumi`?
   - expo.dev: apakah kamu anggota akun `reactive-resume` dan melihat proyek `reactive-resume`?
   - GitHub repo → Settings → Secrets and variables → Actions: sebutkan **nama** secret yang ada (bukan isinya).
     Cukup jawab ya/tidak per baris. Bila ada yang "tidak", Claude menjelaskan pilihan (membuat akun/identitas baru) sebelum Phase 01.
2. **Perangkat uji (P2).** Sebutkan iPhone, Android, dan tablet yang bisa kamu pakai.
3. **Ruang disk (P3).** Kosongkan sampai ±60 GB bebas. Claude bisa menunjukkan apa yang paling besar (cache Xcode, simulator lama, image Docker) dan menghapus hanya yang kamu setujui.
4. **Izin aturan (P4).** Jawab apakah Claude boleh mengubah aturan "mobile ditunda" di `CLAUDE.md`.
5. **Keputusan (P5).** Baca tabel K1–K16 di `00-keputusan.md`. Jawab "setuju semua" atau sebut nomor yang ingin dibahas.

## Untuk agent

1. Pandu langkah di atas satu per satu dalam bahasa awam. Untuk langkah 1, pakai browser pemilik hanya bila diminta; jangan masuk ke akun atas inisiatif sendiri.
2. Catat jawaban di `00-keputusan.md`: P1–P5 pindah ke log keputusan dengan tanggal; K yang berubah ditulis ulang di tabelnya.
3. Bila P1 ada yang "tidak": tulis bagian baru di akhir `02-teknis.md` ("Identitas app") berisi pilihan dan dampaknya (bundle id/paket baru, proyek EAS baru, kunci baru, listing toko dibuat ulang), minta keputusan, dan sesuaikan Phase 01 dan 16.
4. Cek alat di Mac tanpa memasang apa pun dulu: versi Xcode dan simulator yang ada, Android Studio/SDK dan AVD yang ada, `eas --version`, `maestro --version`, ruang disk. Tulis hasilnya di "Catatan sesi".
5. Tidak ada commit kode. Perubahan dokumen di-commit di branch `docs/mobile-plan` bila pemilik setuju.

## Selesai bila

- P1–P5 terjawab dan tercatat.
- Daftar alat dan perangkat tertulis; kekurangan (misalnya Android SDK belum ada) punya langkah pemasangan untuk awal Phase 01.
