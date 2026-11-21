# Phase 14 — Pengaturan, paket, bantuan, pencarian, bahasa

| Dikerjakan | Ukuran | Bergantung pada | Perlu dari pemilik |
| ---------- | ------ | --------------- | ------------------ |
| Claude     | Sedang | Phase 03        | —                  |

## Untuk pemilik

**Apa yang dibuat:** menu akun yang rapi (Account, Plan, App settings, Help & legal), pencarian menyeluruh, dan terjemahan Indonesia yang lengkap.

**Prompt:** `Kerjakan Phase 14 dari .agents/docs/plans/mobile/README.md`

**Yang bisa kamu cek di akhir:** mengganti tema dan bahasa, melihat sisa kredit, mencari dokumen dari kotak pencarian, di iPhone dan Android dalam bahasa Indonesia.

## Untuk agent

### Langkah

1. **Account:** nama, username, email, foto, keamanan (kata sandi, 2FA, passkey, akun tertaut: yang belum asli dibuka di lembar browser seperti sekarang), ekspor data, **hapus akun** (alur konfirmasi browser yang ada), keluar, keluar dari semua perangkat.
2. **Plan:** nama paket, sumber (langganan kartu atau pass QRIS) dan tanggal berakhir/perpanjangan dari `billing.summary`, kredit dan `billing.creditHistory`, fitur paket. **Tanpa harga, tombol beli, atau tautan ke halaman beli** di dua platform (K6); hapus percabangan khusus iOS di `features/billing/plan-alert.ts` dan jadikan satu aturan. Pesan batas paket netral di seluruh app.
3. **App settings:** tema, bahasa, zona waktu, notifikasi (pengingat lokal: nyala/mati per jenis, tautan ke pengaturan sistem), AI providers dan sumber AI, MCP server (info dan salin alamat), persetujuan AI (lihat dan cabut), penyimpanan offline (ukuran, hapus cache), lisensi.
4. **Help & legal:** kartu bantuan seperti web, kebijakan privasi, ketentuan, Report an issue, versi app dan build, versi update OTA.
5. **Search:** satu layar (padanan command palette): dokumen, lamaran, percakapan, pindah halaman, "tanya Coach"; pintasan keyboard fisik lewat `key-commands`.
6. **Bahasa:** `pnpm --filter mobile lingui:extract`; terjemahkan id-ID sampai nol kosong; muat katalog per bahasa saat dibutuhkan (`02-teknis.md` bagian 11, butir **[cek]**); RTL diperiksa pada layar utama (Arab).
7. **Ulasan toko:** pemicu `use-review-prompt` disesuaikan dengan navigasi baru.
8. Hapus `app/(tabs)/settings/*` lama dan `features/settings` yang sudah diganti.

### Tes dan verifikasi

- Tes komponen: kartu paket untuk Free, langganan, pass, kedaluwarsa; daftar pengaturan.
- Tes penjaga: tidak ada kata "price", "upgrade", "buy" atau URL billing di `apps/mobile` (daftar kata ditentukan di tes).
- Maestro di dua platform: ganti bahasa → app berbahasa Indonesia; ganti tema; cari dokumen.
- Daftar cek dua platform.

### Selesai bila

- Menu akun setara web (dikurangi pembelian dan admin), id-ID lengkap.
- Tidak ada lagi layar lama di app selain yang menunggu dihapus di Phase 15.
