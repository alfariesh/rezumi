# Phase 03 — Penegakan batas paket

| Dikerjakan | Ukuran | Bergantung pada | Perlu dari pemilik |
| ---------- | ------ | --------------- | ------------------ |
| Claude     | Besar  | Phase 01        | —                  |

## Untuk pemilik

**Apa yang dibuat:** aturan paket mulai bisa ditegakkan: batas 3 CV dan 3 surat aktif di paket Gratis, template premium, ekspor Word/ODT, Custom Styles dan font sendiri, serta akses API/MCP untuk aplikasi luar. Muncul juga halaman "Paket" (baca saja) di web dan Android yang menunjukkan paket dan pemakaian; iOS tidak menampilkannya (keputusan 2 November). Semua masih tersembunyi di produksi karena saklar `BILLING_MODE` tetap `off`.

**Siapkan:** tidak ada.

**Prompt:** `Kerjakan Phase 03 dari .agents/docs/plans/membership/README.md`

**Yang bisa kamu cek di akhir:** Claude menjalankan aplikasi lokal dengan `BILLING_MODE=admins`, lalu menunjukkan (screenshot) bahwa akun admin tanpa paket tidak bisa membuat CV ke-4, template premium berlabel, dan Word/ODT terkunci; setelah admin memberi dirinya Plus lewat prosedur admin, semuanya terbuka.

## Untuk agent

### Aturan bisnis yang ditegakkan

Sumber: `00-keputusan-produk.md` bagian 2 dan 4. Ringkas:

| Aturan                      | Ditegakkan di server                                                                                                         | Perilaku                                                                                                                                                                                                                                                   |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CV aktif / surat aktif      | Semua jalur yang **membuat atau memulihkan** dokumen (lihat `01-arsitektur.md` 6.8)                                          | Lewat batas → `PLAN_LIMIT_REACHED`. Dokumen lama tidak pernah dikunci, diubah, atau dihapus                                                                                                                                                                |
| Template premium            | Membuat dokumen baru dengan template premium; mengubah `metadata.template` ke template premium (update penuh dan JSON Patch) | Ditolak `PLAN_FEATURE_REQUIRED`. Dokumen yang sudah memakai template premium tetap memakainya, termasuk salinannya (duplikat, tailoring, copy for job). Impor file dengan template premium → template diganti `FREE_TEMPLATES[0]` dan pengguna diberi tahu |
| Ekspor Word/ODT             | `packages/api/src/features/documents/exports.ts` (REST/MCP) + pemeriksaan di klien web/mobile                                | Ekspor baru `.docx`/`.odt` butuh fitur `wordOdtExport`. PDF, Markdown, JSON selalu terbuka                                                                                                                                                                 |
| Custom Styles               | Menyimpan perubahan CSS kustom (cari jalurnya; panduan `docs/applying-custom-styles.mdx`)                                    | Mengubah/menambah butuh `customStyles`; CSS yang sudah tersimpan tetap dirender                                                                                                                                                                            |
| Font sendiri                | Unggah font (cari endpoint unggah font di `features/storage`)                                                                | Unggah baru butuh `customFonts`; font yang sudah ada tetap dipakai                                                                                                                                                                                         |
| API/MCP untuk aplikasi luar | Middleware autentikasi (`packages/api/src/context.ts` atau middleware billing yang dipasang di sana)                         | Request dengan API key atau token OAuth dari klien selain app resmi butuh `automationApi`. Sesi web dan app resmi tidak terpengaruh                                                                                                                        |

Semua aturan hanya berlaku bila `isBillingActiveFor(user)` benar (lihat Phase 01). Dengan `BILLING_MODE=off` tidak ada yang berubah.

### Langkah

1. **Peta titik masuk** — dengan graph (`search_graph`, `trace_path`) dan grep, buat daftar lengkap fungsi yang menyisipkan baris `resume`/`cover_letter` atau mengosongkan `trashed_at`, beserta semua router/MCP tool yang memanggilnya. Daftar awal ada di `01-arsitektur.md` 6.8. Tulis daftar final di laporan.
2. **Helper bersama** — `packages/api/src/features/billing/limits.ts`: `assertDocumentCapacity(tx, userId, { resumes, coverLetters })`, `assertFeature(userId, feature)`, dan error terstandar (`PLAN_LIMIT_REACHED`, `PLAN_FEATURE_REQUIRED`) sesuai `01-arsitektur.md` bagian 11. Pesan error berupa kalimat jelas dan **netral** — tanpa harga, tanpa ajakan membeli, tanpa URL — karena tampil juga di app iOS/Android (aturan toko, `00-keputusan-produk.md` bagian 6). Contoh: "Batas 3 CV aktif sudah tercapai. Pindahkan CV ke Trash untuk membuat yang baru." Web menambahkan tombol upgrade sendiri berdasarkan kode error.
3. **Batas dokumen** — panggil `assertDocumentCapacity` di dalam transaksi insert/restore yang sudah ada, setelah `lockBillingAccount`. Impor CV yang membawa surat (`adoptEmbeddedLetters`) menghitung CV + surat bersama-sama; bila melewati batas, tolak seluruh impor dengan pesan yang menyebut jumlahnya. Pemindahan dokumen dari akun tamu (`linkAnonymousAccount` di `packages/auth`) tidak dibatasi.
4. **Template premium** — tegakkan di jalur create dan di jalur update/patch saat nilai template berubah. Bandingkan nilai sebelum dan sesudah; jangan menolak update biasa pada dokumen yang memang sudah memakai template premium.
5. **Word/ODT** — server: tolak format `docx`/`odt` di `documents/exports.ts` tanpa fitur. Web: `apps/web/src/features/resume/export/use-resume-export.ts` dan menu ekspor surat; mobile: `apps/mobile/src/features/share/download.tsx`. Klien membaca `billing.summary.features` dan menampilkan opsi terkunci + dialog, bukan menyembunyikan diam-diam.
6. **Custom Styles dan font** — cari titik simpan dan unggah; tegakkan di server; tampilkan status terkunci di editor web dan mobile (bila fitur itu ada di mobile).
7. **API/MCP** — buat `isFirstPartyClient(authentication)` (lihat `01-arsitektur.md` 9.1: klien OAuth yang `redirect_uris`-nya hanya `https://<host APP_URL>/auth/native-callback`, ditambah `app.rezumi:/auth/native-callback` untuk build dev). Request `apiKey`, atau `bearer` dari klien lain, tanpa `automationApi` → `PLAN_FEATURE_REQUIRED`. Pesan untuk klien pihak ketiga ini boleh menyebut halaman Paket di web karena tidak tampil di app resmi (misalnya "Koneksi API/MCP membutuhkan paket Plus atau Pro AI. Buka rezumi.app/dashboard/settings/billing."). Pastikan app mobile resmi tetap bekerja di paket Gratis (tes).
8. **Halaman Paket (baca saja)** — aturan per platform dari `00-keputusan-produk.md` bagian 6:
   - Web: rute `apps/web/src/routes/dashboard/settings/billing.tsx` + entri di `apps/web/src/features/settings/root.tsx`, hanya tampil bila `billing.summary.enabled`. Isi: paket aktif, berlaku sampai (zona waktu pengguna), potongan berikutnya, pemakaian CV/surat, daftar fitur, dan tautan ke harga. Tombol beli ditambahkan di Phase 07.
   - Android: layar `apps/mobile/app/(tabs)/settings/membership.tsx` + baris di `apps/mobile/app/(tabs)/settings/index.tsx`, isi setara web tanpa tombol beli, tautan pembayaran, atau harga.
   - iOS: **tidak ada** layar/baris Paket. Siapkan helper visibilitas per platform sejak phase ini (Phase 08 merapikannya).
9. **Dialog batas/fitur** — dipicu kode error di atas atau pemeriksaan klien; menjelaskan batas dan alternatif gratis (pindahkan dokumen ke Trash, pakai PDF, pilih template gratis). Web menambahkan tombol "Lihat paket". Android menambahkan kalimat informatif tanpa tautan ("Paket bisa dibeli di situs rezumi.app"). iOS hanya menampilkan pesan netral.
10. **Label premium** — web dan Android menandai template di luar `FREE_TEMPLATES` hanya bila billing aktif untuk pengguna; pratinjau tetap boleh. **iOS** tidak memakai label: pemilih template menampilkan template yang bisa dipakai akun itu saja, dan opsi Word/ODT hanya muncul bila fiturnya dimiliki.
11. **Teks** — semua string lewat Lingui; `pnpm lingui:extract`. Panduan pengguna di `docs/` yang menjelaskan template/ekspor/API diberi catatan paket **hanya** setelah go-live (Phase 11); di phase ini cukup siapkan draf di laporan.

### Aturan yang wajib dijaga

- Pengecekan batas berada di transaksi yang sama dengan insert/restore, setelah kunci akun; dua permintaan paralel tidak bisa melewati batas.
- Tidak ada jalur (web, mobile, REST/OpenAPI, MCP, Assistant tool) yang bisa melewati aturan server.
- Paket habis tidak mengunci, mengubah, atau menghapus dokumen lama.
- App mobile resmi tidak terkena aturan "API/MCP butuh Plus".

### Tes dan verifikasi

- Unit/integrasi per aturan: di bawah batas lolos, tepat di batas ditolak, Trash tidak dihitung, restore dari Trash dihitung, impor dengan surat dihitung bersama, duplikat dokumen bertemplate premium lolos, mengubah ke template premium ditolak, update biasa pada dokumen premium lolos, ekspor docx/odt ditolak dan PDF lolos, API key ditolak tanpa Plus, token app resmi lolos.
- Integrasi DB nyata (`BILLING_TEST_DATABASE_URL`): 5 permintaan create paralel pada akun dengan sisa 1 slot → tepat 1 berhasil.
- Mode: semua tes di atas juga dijalankan dengan `BILLING_MODE=off` → tidak ada yang ditolak.
- UI: jalankan web lokal (`pnpm dev`) dengan `BILLING_MODE=admins`, verifikasi di browser pane (screenshot): dialog batas, label template, menu ekspor terkunci, halaman Paket. Untuk mobile, minimal typecheck + tes komponen; jalankan di simulator bila tersedia.
- Perintah standar dari README (typecheck `@rezumi/api`, `web`, `mobile`; tes paket; `pnpm exec turbo boundaries`; `pnpm lint:agent`; `pnpm format:check`).

### Selesai bila

- Semua aturan di tabel ditegakkan di server dan terlihat jelas di web serta mobile.
- Daftar titik masuk final tercatat di laporan dan di `01-arsitektur.md` 6.8.
- Tes membuktikan `BILLING_MODE=off` tidak mengubah perilaku dan app mobile resmi tidak terblokir.
