# Phase 03 — Navigasi, kerangka app, dan Home

| Dikerjakan              | Ukuran | Bergantung pada | Perlu dari pemilik |
| ----------------------- | ------ | --------------- | ------------------ |
| Claude + review pemilik | Besar  | Phase 02        | Melihat screenshot |

## Untuk pemilik

**Apa yang dibuat:** susunan app yang baru: lima tab di bawah (Home, Documents, Applications, Portfolio, Profile), bar atas dengan tombol Coach, pencarian, dan menu akun, serta tab **Home** yang baru. Di tablet, menu pindah ke samping seperti web. Tab yang isinya belum ditulis ulang menampilkan layar lama dulu.

**Prompt:** `Kerjakan Phase 03 dari .agents/docs/plans/mobile/README.md`

**Yang bisa kamu cek di akhir:** screenshot lima tab di iPhone dan Android, tablet dengan sidebar, dan Home dengan data contoh.

## Untuk agent

### Langkah

1. Baca `01-desain.md` bagian 2 dan `.agents/docs/plans/navigasi/README.md`. **[cek]** tab asli Expo Router (`expo-router/unstable-native-tabs`) di SDK 58: pakai bila mendukung lencana, penyembunyian tab bersyarat, dan Android dengan baik; selain itu buat tab bar dari komponen `src/ui`. Catat pilihan dan alasannya di `02-teknis.md`.
2. **Rute:** susun ulang `app/(tabs)` menjadi `home`, `documents`, `applications`, `portfolio`, `profile`; pengaturan pindah ke tumpukan `app/account/*` yang dibuka dari avatar. Perbarui `src/routes.ts`. Tab Portfolio hanya tampil bila `portfolio.status().enabled`.
3. **Shell (`src/shell`):** TopBar (judul, Coach, Search, avatar), tombol Baru mengambang, sidebar untuk lebar ≥ 700 dengan urutan web, panel Coach sebagai slot (isi di Phase 11; untuk sekarang membuka Coach lama).
4. **Layar sementara:** Documents dan Applications memasang layar lama; Portfolio dan Profile menampilkan keadaan kosong "sedang disiapkan" yang hanya ada sampai phase-nya (jangan sampai rilis).
5. **Home (baru):** tulis ulang dari `features/career/today.tsx` dan `recent-documents.tsx` di atas `src/ui`: Recent documents, Needs you (termasuk notifikasi `posting-closed`), New roles dari notifikasi lowongan (bawa `search` saat menyimpan jadwal; selesaikan butir **[cek]** `careerScheduleInput.search`), Coming up, Schedules, keadaan pertama kali. Prosedur: `career.notifications/markNotificationRead/opportunities/trackOpportunity/dismissOpportunity/schedules/saveSchedule/deleteSchedule`, `documents.list`, `applications.list`. Lencana tab = notifikasi belum dibaca.
6. **Deep link:** perluas `src/linking/parse.ts` sesuai `02-teknis.md` bagian 7 (rute yang layarnya belum ada mendarat di tab terkait). Perluas `intentFilters` Android dan cek file asosiasi server.
7. **Android kembali:** nyalakan gestur kembali prediktif bila stabil di versi terpasang **[cek]**; pasang penjaga "ada perubahan belum disimpan" di satu tempat (`src/shell`) untuk dipakai semua editor.
8. Hapus tab bar lama, grup `career` sebagai tab, dan layar Today lama.

### Tes dan verifikasi

- Tes komponen: Home dalam keadaan memuat/kosong/berisi/gagal/offline; tab Portfolio tersembunyi bila tidak aktif.
- Tes unit parser deep link untuk tiap baris tabel.
- Daftar cek dua platform (`02-teknis.md` 10), termasuk API 24–28 dan lebar ≥ 700 (iPad dan emulator lipat).
- Maestro: masuk → lima tab → buka dokumen dari Home → kembali.

### Selesai bila

- Navigasi baru jalan di ponsel dan tablet, dua platform; tautan web membuka layar yang sepadan.
- Home setara dengan Home web (kecuali hal di `01-desain.md` bagian 6).
- Butir navigasi di "Feature parity exceptions" yang sudah terpenuhi dihapus.
