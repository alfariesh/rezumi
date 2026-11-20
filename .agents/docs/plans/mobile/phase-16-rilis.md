# Phase 16 — Rilis ke App Store dan Play Store

| Dikerjakan       | Ukuran | Bergantung pada | Perlu dari pemilik                |
| ---------------- | ------ | --------------- | --------------------------------- |
| Pemilik + Claude | Besar  | Phase 15        | Akses toko, penguji, ±2 jam total |

## Untuk pemilik

**Apa yang dibuat:** app dikirim ke TestFlight dan uji internal Play, dicoba dari toko, lalu diajukan untuk ditinjau Apple dan Google. Setelah itu pembaruan kecil bisa dikirim tanpa lewat toko (OTA).

**Prompt:** `Kerjakan Phase 16 dari .agents/docs/plans/mobile/README.md`

**Tugasmu (dipandu):** menyetujui dua gerbang di GitHub (tanda tangan, lalu kirim ke toko), menambah penguji, memasang dari TestFlight dan Play, mengisi atau memeriksa ulang formulir toko, dan menekan tombol ajukan. Claude tidak mengajukan ke toko tanpa persetujuanmu yang jelas di chat pada saat itu.

**Yang bisa kamu cek di akhir:** app terpasang dari TestFlight dan Play di perangkatmu; status tinjauan di dua toko.

## Untuk agent

Ikuti `.agents/docs/mobile-release-handoff.md` (gerbang, lingkungan, matriks) dan `.agents/docs/mobile-ci.md`. Dokumen itu sumber langkah rinci; phase ini urutannya.

### Langkah

1. **Server dulu:** semua perubahan server rencana ini sudah tayang; `/api/health` sehat; file asosiasi (`/.well-known/apple-app-site-association`, `assetlinks.json`) mengembalikan JSON yang benar untuk rute baru (`02-teknis.md` bagian 7); env mobile dan Apple/Google terpasang.
2. **Forme:** prebuilt cocok dengan sumber; cek 16 KB.
3. **Versi:** putuskan nomor versi bersama pemilik (app berubah total dari build lama yang pernah diunggah); nomor build mengikuti penghitung CI, jangan direset.
4. **Build toko:** `mobile-release.yml` (`platform=all`, `format=store`, `upload` sesuai tahap); pemilik menyetujui `mobile-signing`; periksa artefak; baru `mobile-store`.
5. **Uji dari toko:** TestFlight dan uji internal Play; jalankan matriks perangkat bertanda tangan; masuk Apple dan Google dari build toko; tautan universal; pengingat; ekspor.
6. **OTA:** beri pemanggil untuk `mobile-ota-update.yml` dari `deploy-cloudflare.yml` (kirim `sha`, cek `/api/health` sebelum terbit); terbitkan satu update ke kanal `production` dan buktikan terunduh di dua platform; uji rollback.
7. **Listing:** screenshot baru dari build rilis (app sudah berubah total) untuk semua ukuran dan bahasa yang didaftarkan, deskripsi dan "What's new", kategori, privasi/Data safety dicek ulang terhadap perilaku baru (masuk Google asli, kamera, mikrofon, WebView), akun peninjau dengan data fiktif dan akses AI yang bisa dipakai peninjau.
8. **Ajukan** dengan persetujuan eksplisit pemilik; pantau; tanggapi penolakan dengan perbaikan, bukan jalan pintas.
9. **Setelah terbit:** uji asap dari toko publik; perbarui `CLAUDE.md` (app sudah di toko: aturan kompatibilitas API untuk binary lama berlaku penuh; fitur web baru menyebut dampak mobile); perbarui handoff; tulis catatan rilis.

### Tes dan verifikasi

- CI `main` hijau pada commit yang dirilis (`tooling/ci/check-ci.mjs`).
- Matriks perangkat bertanda tangan terisi untuk iPhone, iPad, ponsel dan tablet Android.
- Update OTA terbukti sampai; rollback terbukti.

### Selesai bila

- App diajukan ke dua toko (atau sudah terbit), dengan bukti uji dari build toko.
- OTA jalan otomatis setelah deploy server yang sehat.
- Dokumen rilis mencerminkan keadaan nyata.
