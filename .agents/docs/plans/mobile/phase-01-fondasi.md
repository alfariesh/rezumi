# Phase 01 — Fondasi: build dua platform sehat

| Dikerjakan | Ukuran | Bergantung pada | Perlu dari pemilik                                  |
| ---------- | ------ | --------------- | --------------------------------------------------- |
| Claude     | Besar  | Phase 00        | Jawaban P1, P3, P4; izin menjalankan workflow Forme |

## Untuk pemilik

**Apa yang dibuat:** belum ada yang berubah di tampilan. Phase ini memastikan app lama bisa dibangun dan dijalankan di iPhone (simulator) dan Android (emulator), mengarsipkan keadaan lama, dan memasang alat uji. Hasilnya: screenshot "sebelum" dari dua platform sebagai pembanding.

**Prompt:** `Kerjakan Phase 01 dari .agents/docs/plans/mobile/README.md`

**Yang bisa kamu cek di akhir:** screenshot app lama di iPhone dan Android; daftar hal yang rusak sebelum dirombak.

## Untuk agent

### Langkah

1. **Arsip.** Buat tag `arsip/mobile-2026-11` di `main` terbaru (push dengan izin pemilik). Buat branch `feat/mobile-01-fondasi`.
2. **Upgrade yang sudah dimulai:** branch `chore/heroui-native-1-1` (commit `e9e497af`, worktree `~/Documents/rezumi-heroui-native`) menaikkan heroui-native ke 1.1.1 dan true-sheet ke 4.1.2 dan menyesuaikan `src/ui/overlays.tsx`. Bawa commit itu ke branch phase ini (cek dulu apakah sudah ada PR). Salinan yang sama masih kotor di checkout utama (`pnpm-workspace.yaml`, `pnpm-lock.yaml`, `overlays.tsx`): tanya pemilik sebelum membersihkannya. `skills-lock.json` dan file lain yang kotor bukan bagian dari ini; biarkan.
3. **Aturan repo (P4).** Ubah bagian "Native mobile app" di `CLAUDE.md`: ganti "mobile ditunda" dengan "mobile dikerjakan lewat `.agents/docs/plans/mobile/`; fitur baru web mencatat kebutuhan mobile di rencana itu". Pertahankan paragraf OTA dan rilis.
4. **`apps/mobile/AGENTS.md`** (baru): cara menjalankan (server lokal, simulator, emulator, alamat `10.0.2.2`), struktur folder sasaran (`02-teknis.md` bagian 2), aturan kode, cara menguji, jebakan yang ditemukan. Singkat; tautkan ke rencana.
5. **Forme native.** Bangun lokal (`bash packages/forme-native/rust/build.sh`) untuk iOS simulator dan ABI emulator Android. Dengan izin pemilik jalankan `mobile-forme-build.yml` pada commit yang ditinjau, verifikasi artefak dan checksum, perbarui `packages/forme-native/scripts/prebuilt.json` dari keluaran nyata. Cek keselarasan 16 KB pada `.so`. Jangan melewati penjaga hash.
6. **Build pengembangan.** `expo run:ios` dan `expo run:android` (muat skill `argent-react-native-app-workflow`, `argent-ios-simulator-setup`, `argent-android-emulator-setup`). Catat setiap galat build dan perbaikannya di `AGENTS.md`.
7. **Server lokal** jalan; buat akun uji; masuk dari kedua platform (alur browser lama).
8. **Dasar data.** Beri `QueryClient` default (`staleTime`, `retry` sadar offline) dan hubungkan `focusManager` ke `AppState` serta `onlineManager` ke `expo-network`.
9. **Gelombang dependensi native** (`02-teknis.md` 3.4): pasang semuanya dengan `expo install`, bangun ulang dua platform, pastikan app tetap jalan. Pustaka Google Sign-In boleh ditunda ke Phase 04 bila pilihannya belum pasti; catat.
10. **Alat uji.** Pasang `jest-expo` + React Native Testing Library dengan satu tes contoh yang benar-benar merender komponen; tambah skrip `test:ci`; masukkan typecheck dan tes mobile ke job unit `ci.yml`. Perbaiki `mobile#test` yang gagal di `main` (`scripts/layout.test.mjs`). Pasang Maestro, pindahkan `.maestro/` ke `e2e/`, jalankan alur `sign-in` di dua platform dan perbaiki sampai lulus.
11. **Identitas.** Sesuaikan `owner` di `app.config.ts` dan proyek EAS dengan jawaban P1. Hapus rujukan jalur komputer pihak lain dari dokumen rilis; tandai bagian yang perlu diisi ulang pemilik.
12. **Bersih-bersih kecil.** Hapus komentar yang merujuk dokumen yang tidak ada di repo (`reports/S2.md`, `tokens.md`, `app.html`, `builder.html`) atau ganti dengan rujukan ke rencana ini.
13. **Dasar ukur.** Catat waktu buka dingin dan ukuran build pengembangan/rilis lokal sebagai pembanding Phase 15. Ambil screenshot "sebelum" semua tab di dua platform ke `laporan/phase-01/`.

### Tes dan verifikasi

- `pnpm --filter mobile typecheck`, `pnpm --filter mobile test`, tes contoh RNTL, `pnpm exec turbo boundaries`, `pnpm lint:agent`, `pnpm format:check`.
- Maestro `sign-in` lulus di iOS dan Android.
- Pratinjau PDF sebuah CV tampil di dua platform (membuktikan Forme baru terpakai).

### Selesai bila

- Dari checkout bersih, langkah di `apps/mobile/AGENTS.md` menghasilkan app yang jalan di simulator iPhone dan emulator Android.
- Pin Forme cocok dengan sumber; CI menjalankan typecheck dan tes mobile.
- Tag arsip ada; aturan `CLAUDE.md` sudah diperbarui.
