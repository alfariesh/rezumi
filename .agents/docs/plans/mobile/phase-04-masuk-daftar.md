# Phase 04 — Masuk dan daftar di dalam app

| Dikerjakan | Ukuran | Bergantung pada | Perlu dari pemilik                                |
| ---------- | ------ | --------------- | ------------------------------------------------- |
| Claude     | Besar  | Phase 03        | Kunci Google Sign-In (dipandu); uji dengan akunmu |

## Untuk pemilik

**Apa yang dibuat:** layar masuk dan daftar yang asli di dalam app: email dan kata sandi, daftar akun, verifikasi email, lupa kata sandi, kode 2FA, **Sign in with Apple** (iPhone), dan **Google**. Baris "Server" hilang dari layar pengguna.

**Prompt:** `Kerjakan Phase 04 dari .agents/docs/plans/mobile/README.md`

**Tugasmu:** membuat kunci Google Sign-In untuk iOS dan Android di Google Cloud Console (Claude memandu klik demi klik; kamu yang mengetik nilainya ke tempat rahasia). Sign in with Apple memakai konfigurasi Apple yang sudah ada; bila perlu perubahan di akun Apple, Claude memandu.

**Yang bisa kamu cek di akhir:** masuk dengan akunmu di simulator iPhone dan emulator Android; daftar akun baru sampai menerima email verifikasi (di lokal emailnya tampil di log server).

## Untuk agent

### Langkah

1. **Spike keamanan dulu** (`02-teknis.md` bagian 4): buktikan jalur sesi → token tanpa browser di server lokal; selesaikan semua butir **[cek]**. Tulis hasil dan rancangan final sebagai bagian baru di akhir `02-teknis.md`. Bila jalur 2 dan 3 gagal, jalankan cadangan (butir 5 di sana) dan beri tahu pemilik.
2. **Server** (bila perlu): endpoint/konfigurasi pihak pertama di `packages/auth` (+ `apps/server/src/http`), rate limit, tes integrasi. Tidak mengubah alur web atau MCP. Env baru mengikuti aturan tiga tempat di `CLAUDE.md`. `pnpm check:cloudflare`.
3. **Layar (`app/(auth)`, `src/features/auth`)** di atas `src/ui`: Welcome (tombol Apple di iOS, Google, email), Sign in, Create account (nama, email, kata sandi dengan indikator kekuatan; `username` dibuat otomatis dan bisa diubah nanti), Check your email, Forgot password, Reset (deep link dari email), 2FA (kode dan kode cadangan), More options (GitHub, LinkedIn, passkey, OIDC kustom lewat lembar browser), tamu bila `allowGuestLogin`, pendaftaran dimatikan bila `disableSignups`.
4. **Apple dan Google asli:** `expo-apple-authentication`; pustaka Google sesuai butir **[cek]**. ID token ditukar di server. Nonce dan audiens diverifikasi server.
5. **Sesi:** rapikan `src/auth/session.ts` seperlunya (kurangi variabel modul, satu mesin keadaan) tanpa mengubah penyimpanan token dan scope akun. Pilihan Server hanya tampil di build pengembangan.
6. **Pesan galat** manusiawi untuk: kata sandi salah, akun belum diverifikasi, terlalu banyak percobaan, tanpa jaringan, email sudah terdaftar.
7. **Isi otomatis:** `textContentType`/`autoComplete` untuk email, kata sandi baru, kode sekali pakai; `webcredentials` iOS sudah ada, cek padanan Android.
8. Hapus layar `server.tsx` dari alur pengguna dan layar masuk lama. Keluar dan hapus akun tetap bekerja.

### Tes dan verifikasi

- Tes integrasi `packages/auth` untuk jalur baru: sukses, 2FA wajib, email belum diverifikasi, token Apple/Google palsu, replay kode, rate limit.
- Tes komponen tiap layar (validasi, keadaan galat).
- Maestro di dua platform: daftar → verifikasi → masuk; masuk → keluar → masuk; lupa kata sandi; ganti akun (cache akun lama tidak bocor).
- **Tinjauan keamanan terpisah** oleh agent baca-saja atas diff server dan klien; temuan diperbaiki sebelum merge.
- Daftar cek dua platform, termasuk keyboard, isi otomatis, dan API 24–28.

### Selesai bila

- Pengguna bisa daftar dan masuk tanpa meninggalkan app dengan email, Apple (iOS), dan Google.
- Tidak ada penurunan keamanan: 2FA dan verifikasi email tetap wajib; token tetap di SecureStore.
- Web dan MCP tidak berubah perilakunya (tes auth yang ada hijau).
