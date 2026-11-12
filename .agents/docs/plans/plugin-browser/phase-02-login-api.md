# Phase 02 — Masuk akun dan API server

| Dikerjakan | Ukuran | Bergantung pada | Perlu dari pemilik                                                |
| ---------- | ------ | --------------- | ----------------------------------------------------------------- |
| Claude     | Besar  | Phase 01        | ID item Chrome dan Edge + public key Chrome (dari akhir Phase 01) |

## Untuk pemilik

**Apa yang dibuat:**

1. Tombol **Hubungkan ke Rezumi** berfungsi: jendela login Rezumi terbuka, kamu menyetujui sekali, lalu panel menampilkan nama, email, dan paketmu. Ada tombol **Keluar**.
2. Plugin dianggap **aplikasi resmi Rezumi**, jadi bisa dipakai pengguna paket Gratis walaupun billing menyala (keputusan "gratis untuk semua").
3. Server siap menerima loker dari plugin: membaca isian yang dikirim plugin (tanpa membuka halaman sendiri), mengenali loker yang sudah tersimpan, menerima laporan halaman gagal, dan bisa menolak plugin versi lama bila darurat.
4. Di web Rezumi, plugin tampil rapi di **Pengaturan → Aplikasi terhubung** dan bisa diputus dari sana.

**Siapkan:** ID dan public key dari akhir Phase 01 (bila belum dikirim).

**Prompt:** `Kerjakan Phase 02 dari .agents/docs/plans/plugin-browser/README.md`

**Yang bisa kamu cek di akhir:** di server lokal yang dijalankan Claude, klik Hubungkan → login → panel menampilkan akunmu; putus dari Pengaturan Rezumi → panel meminta hubungkan lagi.

## Untuk agent

### Langkah

1. **Login** (`02-teknis.md` bagian 5) di service worker, mengikuti alur app mobile (`apps/mobile/src/auth/oauth.ts`): discovery, registrasi client dinamis sekali, PKCE + `state`, `launchWebAuthFlow`, tukar code, simpan token, refresh otomatis, keluar dengan pencabutan token. Cek apakah consent bisa dilewati untuk client tepercaya; catat hasilnya di bagian 5.
2. **Aplikasi resmi:** tambahkan redirect URI plugin (ID Chrome dan Edge dari bagian 15) ke `firstPartyRedirectUris` (`packages/api/src/features/billing/automation.ts`). Tes: dengan `BILLING_MODE=on`, akun Gratis + client plugin lolos; client pihak ketiga lain tetap ditolak `automationApi`.
3. **Server** (`02-teknis.md` bagian 6):
   - `"extension"` di `postingSourceSchema.method`; cek semua pemakai.
   - Kolom `source_key` + indeks (`packages/db/src/schema/applications.ts`, `pnpm db:generate`, tinjau SQL), diisi di `create`/`update`/`import` lewat `jobKey`. Skrip backfill sekali jalan di `tooling/` (belum dijalankan di produksi; itu Phase 07).
   - `applications.savedKeys`, `applications.readCapture` (fungsi bersama dengan `parsePosting`, bukan salinan), `applications.reportCapture` (email ke `BILLING_ALERT_EMAIL`, digabung per jam; isi email sesuai aturan turunan #8 yang dijawab di Phase 03, sementara pakai usulan), semuanya `Internal`.
   - Header `x-rezumi-extension` + env `EXTENSION_MIN_VERSION` (aturan env var di `CLAUDE.md`), galat `EXTENSION_OUTDATED`.
   - `pnpm docs:gen`: pastikan spesifikasi publik tidak berubah selain yang disengaja.
4. **Panel:** layar terhubung (nama, email, paket dari `billing.summary`), layar galat sesi (3.7), kerangka Pengaturan (3.8) dengan Keluar. Klien oRPC memakai Bearer, `credentials: "omit"`, dan header versi.
5. **Web:** `connected-apps.tsx` menampilkan nama client plugin dengan benar; label "Disimpan dari plugin" untuk `postingSource.method === "extension"` di tempat web menampilkan sumber posting. Lingui + id-ID.
6. **Edge:** cek login berjalan di Edge dengan ID Edge.

### Aturan yang wajib dijaga

- Token hanya di service worker/panel; refresh token di `chrome.storage.local`, access token di `chrome.storage.session`.
- Semua perubahan server menambah saja; tes applications, auth, billing, MCP, dan REST yang ada tetap lulus.
- `readCapture` tidak pernah mengambil URL dari server (beda dengan `parsePosting`).

### Tes dan verifikasi

- API: `readCapture` (JSON-LD, tanpa JSON-LD, tanpa AI, AI tiruan, `existing`), `savedKeys` (hanya milik pengguna, batas 5.000), `source_key` di create/update/import, gerbang paket plugin vs pihak ketiga, `EXTENSION_MIN_VERSION`, `reportCapture` (batas laju, isi email tanpa isi halaman). Pakai suite basis data nyata seperti tes applications yang ada.
- Plugin: unit token (refresh, 401, keluar), Playwright: alur login penuh ke server lokal (daftar akun uji fiktif → Hubungkan → panel menampilkan akun).
- `check:cloudflare`, `lint:agent`, `format:check`, boundaries.

### Selesai bila

- Hubungkan/Keluar berjalan di Chrome dan Edge terhadap server lokal; akun Gratis dengan billing menyala bisa memanggil API dari plugin.
- Prosedur baru, kolom, dan migrasi siap; skrip backfill ada dan teruji.
