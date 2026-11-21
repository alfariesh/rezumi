# Phase 15 — Pengerasan iOS dan Android

| Dikerjakan               | Ukuran                 | Bergantung pada | Perlu dari pemilik                             |
| ------------------------ | ---------------------- | --------------- | ---------------------------------------------- |
| Claude + pemilik menguji | Besar (2–3 sesi wajar) | Phase 04–14     | ±1 jam mencoba di iPhone dan Android sungguhan |

## Untuk pemilik

**Apa yang dibuat:** tidak ada fitur baru. Phase ini memastikan app **solid**: cepat, tidak macet, bekerja tanpa jaringan, ramah pembaca layar, rapi di tablet dan ponsel lipat, dan aman. Kode lama yang tersisa dihapus.

**Prompt:** `Kerjakan Phase 15 dari .agents/docs/plans/mobile/README.md`

**Tugasmu:** memasang build uji di iPhone dan Android milikmu (Claude memandu), lalu mengikuti daftar coba ±20 langkah dan menandai yang terasa salah.

**Yang bisa kamu cek di akhir:** tabel hasil uji per perangkat dan angka kecepatan sebelum/sesudah.

## Untuk agent

### Langkah

1. **Hapus sisa lama:** `src/ui-legacy`, tes `node:test` yang logikanya sudah di paket, dependensi tak terpakai (`phosphor-react-native`, dan lain-lain; cek dengan `pnpm knip`). Tambah tes penjaga impor `ui-legacy`. Kosongkan daftar pengecualian tes gaya.
2. **Performa** (`02-teknis.md` bagian 11; muat skill `argent-react-native-profiler`, `argent-native-profiler`, `argent-react-native-optimization`): ukur buka dingin, pindah tab, gulir daftar, pratinjau PDF di build rilis pada emulator kelas menengah dan perangkat pemilik; perbaiki yang meleset; bandingkan dengan dasar Phase 01. Ukuran unduhan dan katalog bahasa.
3. **Offline dan jaringan buruk:** tiap tab dengan mode pesawat, jaringan lambat, putus di tengah simpan/unggah/streaming; antrean draf; pesan yang jelas; tidak ada putaran tanpa akhir.
4. **Aksesibilitas:** jalankan VoiceOver dan TalkBack pada alur utama (masuk, buat CV, cari lowongan, lamaran, portofolio); teks terbesar; kontras; kurangi gerak; target sentuh. Perbaiki dan catat sisa.
5. **Bentuk perangkat:** iPhone kecil dan besar, iPad (potret, lanskap, Split View), Android kecil, tablet, emulator lipat (tutup/buka), rotasi. Android: perubahan ukuran font/kepadatan (batas yang diketahui: aktivitas dibuat ulang; pastikan draf selamat).
6. **Siklus hidup:** latar belakang lama lalu kembali, memori rendah (proses dimatikan) lalu pulih ke layar yang sama, tautan masuk saat app mati/latar/terbuka, notifikasi pengingat membuka layar yang benar, ganti akun.
7. **Izin:** tolak dan cabut kamera, foto, mikrofon, notifikasi; fitur lain tetap jalan.
8. **Keamanan:** jalankan tinjauan keamanan atas `apps/mobile` dan endpoint yang ditambah rencana ini (skill `security-review` atau agent baca-saja): penyimpanan token, deep link, WebView, log, tangkapan layar pada layar sensitif, pin Forme. Perbaiki temuan.
9. **Maestro penuh di CI** (Blacksmith): alur di `02-teknis.md` 9.1 pada iOS dan Android untuk tiap PR yang menyentuh `apps/mobile` atau paket yang dipakainya; simpan video saat gagal.
10. **Pemantauan:** `expo-observe` dan batas galat dicek menangkap crash JS dan native di build rilis; putuskan bersama pemilik apakah perlu layanan pelaporan crash tambahan.
11. **Build uji untuk pemilik:** iOS lewat TestFlight internal atau build ad hoc, Android APK lewat `mobile-release.yml` (`format=apk`), sesuai jawaban P1 dan P2. Susun daftar coba ±20 langkah dalam bahasa awam; catat hasil per perangkat.
12. Perbarui `.agents/docs/mobile-release-handoff.md`: "Feature parity exceptions" tinggal keputusan sengaja (K6, K7, D6, K16); matriks perangkat diisi hasil nyata.

### Tes dan verifikasi

- Semua tes (paket, komponen, penjaga, Maestro dua platform) hijau di CI.
- Tabel ukuran performa sebelum/sesudah di laporan.
- Hasil uji perangkat pemilik tercatat; temuan penting diperbaiki atau dicatat sebagai risiko dengan persetujuan pemilik.

### Selesai bila

- Tidak ada kode lama tersisa; sasaran performa tercapai atau direvisi dengan data dan persetujuan pemilik.
- Tidak ada crash atau jalan buntu pada alur utama di perangkat nyata iOS dan Android.
- Tidak ada temuan keamanan terbuka berkategori tinggi.
