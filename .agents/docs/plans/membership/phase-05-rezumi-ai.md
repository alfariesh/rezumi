# Phase 05 — Rezumi AI dan meteran di semua fitur AI

| Dikerjakan | Ukuran                 | Bergantung pada | Perlu dari pemilik                                  |
| ---------- | ---------------------- | --------------- | --------------------------------------------------- |
| Claude     | Besar (mungkin 2 sesi) | Phase 04        | API key provider AI untuk uji lokal di `.env.local` |

## Untuk pemilik

**Apa yang dibuat:** pengguna web dan Android bisa memakai AI tanpa memasukkan API key sendiri. Pilihan ini bernama **Rezumi AI**: biayanya dibayar Rezumi dan dipotong dari kredit pengguna. Sebelum setiap tindakan AI, pengguna melihat biayanya (misalnya "5 kredit") dan sumbernya. Pengguna yang punya API key sendiri (BYOK) tetap bisa memakainya tanpa memotong kredit. App iOS belum menampilkan Rezumi AI (keputusan 2 November).

**Siapkan:** API key provider AI yang akan dipakai Rezumi AI, untuk uji lokal. Isi sendiri di `.env.local` (jangan kirim di chat):

```dotenv
AI_PROVIDER=<nama provider, mis. google>
AI_MODEL=<nama model>
AI_API_KEY=<kunci kamu>
```

Gunakan batas pengeluaran (budget/limit) di dashboard provider AI agar uji tidak kebablasan. Model final dipilih di Phase 10.

**Prompt:** `Kerjakan Phase 05 dari .agents/docs/plans/membership/README.md`

**Yang bisa kamu cek di akhir:** di lokal (`BILLING_MODE=admins`), tombol AI menampilkan biaya kredit, saldo berkurang setelah berhasil, dan kembali utuh bila AI gagal.

## Untuk agent

### Aturan bisnis

Sumber: `00-keputusan-produk.md` bagian 5.

- Dua sumber AI: **Rezumi AI** (server AI, memotong kredit) dan **koneksi sendiri** (BYOK, tanpa kredit). Pengguna memilih; sistem tidak pernah berpindah sumber diam-diam, termasuk saat key pribadi gagal.
- Rezumi AI hanya untuk pekerjaan teks yang ada di `CREDIT_COSTS`. **Tidak termasuk peluncuran:** latihan suara (transkripsi/suara), discovery lowongan terjadwal, dan tool pencarian/pembacaan web yang dibayar operator. Fitur itu tetap tersedia lewat koneksi sendiri.
- Setiap pekerjaan Rezumi AI punya batas kerja internal (token output, jumlah langkah agent, ukuran input) agar biaya per tindakan terkendali. Bila tidak bisa selesai dalam batas, gagal dengan jelas dan kredit kembali.

### Kondisi kode saat ini (cek ulang sebelum mengubah)

- `packages/api/src/features/ai-providers/service.ts`: bila `AI_PROVIDER`/`AI_MODEL` di-set, `serverProvider()` meng-upsert baris `server-ai:<userId>` dengan `isDefault: true` dan **semua pengguna memakainya**; `assertPersonalProvidersAllowed()` melarang koneksi pribadi.
- Titik masuk AI (hasil grep `getRunnableById`/`getDefaultRunnable`): `features/ai/router.ts` (empat prosedur), `features/applications/ai.ts`, `features/cover-letters/draft.ts`, `features/career/generate.ts`, `features/career/jobs.ts`, `features/career/voice.ts`, `features/agent/service.ts` (beberapa titik). Cari juga MCP tool di `packages/mcp/src/tools.ts` yang memanggil prosedur AI.

### Langkah

1. **Peta tindakan** — untuk setiap titik masuk, tetapkan `actionKey` dan bobot kredit (jenis pekerjaan di `00-keputusan-produk.md` bagian 5). Hasilnya tabel di laporan + `CREDIT_COSTS` final di katalog. Titik masuk yang tidak boleh memakai Rezumi AI (suara, discovery terjadwal) ditandai eksplisit.
2. **Resolver** — ubah `aiProvidersService` agar, bila `isBillingActiveFor(user)`:
   - daftar koneksi berisi Rezumi AI (baris server) **dan** koneksi pribadi; `assertPersonalProvidersAllowed()` tidak memblokir;
   - upsert baris server tidak lagi memaksa `isDefault: true` (hormati pilihan default pengguna);
   - hasil runnable menandai `managed: true` untuk Rezumi AI.

   Bila billing tidak aktif untuk pengguna, perilaku lama dipertahankan persis (tes).

3. **Pembungkus meteran** — `packages/api/src/features/billing/metered-ai.ts`: `runWithAiSource({ user, actionKey, aiSource, idempotencyKey, providerId? }, run)`:
   - `aiSource: "rezumi"` → `ensureTrialCredits` → `reserveCredits` → jalankan dengan batas kerja → `commitCredits` dengan usage dari AI SDK (`usage`/`totalUsage`, termasuk reasoning bila ada) → bila gagal/dibatalkan tanpa hasil tersimpan → `releaseCredits`.
   - `aiSource: "own"` atau koneksi pribadi → jalankan tanpa kredit.
   - **Request tanpa `aiSource`** (app lama, klien API/MCP lama) → diperlakukan sebagai koneksi pribadi/default lama; bila satu-satunya pilihan adalah Rezumi AI, tolak dengan pesan "Perbarui aplikasi untuk memakai Rezumi AI" — jangan memotong kredit tanpa persetujuan yang terlihat.
4. **Input prosedur** — tambahkan field opsional `aiSource` dan `idempotencyKey` ke prosedur AI. Field baru opsional agar klien lama tidak rusak. MCP tool yang memicu AI menerima `aiSource` opsional dan deskripsinya menyebut biaya kredit; tanpa `aiSource: "rezumi"`, tool memakai koneksi pribadi.
5. **Batas kerja Rezumi AI** — tetapkan per `actionKey`: `maxOutputTokens`, batas ukuran input, dan untuk Coach/agent batas langkah yang jauh di bawah 30 (mulai mis. 8) dengan tool web operator dimatikan. Simpan konstanta di modul billing; nilai akhir dikalibrasi Phase 10.
6. **Biaya aktual** — tambah env opsional `AI_COST_INPUT_USD_PER_MTOK` dan `AI_COST_OUTPUT_USD_PER_MTOK` (ikuti aturan "New env var" di `CLAUDE.md`). `commitCredits` menyimpan `cost_usd_micros` = token × tarif. Tidak ada tarif → simpan token saja.
7. **UI web** — setiap tombol AI menampilkan biaya kredit dan pemilih sumber (Rezumi AI dengan saldo, atau koneksi sendiri); kirim `aiSource` dan `idempotencyKey` (UUID baru per tindakan pengguna, dipakai ulang saat retry otomatis). Saldo kurang → dialog: beli Pro AI (Phase 07 menghubungkan tombolnya), pakai koneksi sendiri, atau batal. Pengaturan AI (`apps/web/src/routes/dashboard/settings/ai.tsx`) menampilkan Rezumi AI dan saldo.
8. **UI mobile** — aturan per platform (`00-keputusan-produk.md` bagian 6):
   - **Android:** setara web (`apps/mobile/src/features/ai`, layar `settings/ai*.tsx`, tombol AI di builder/aplikasi/workspace), termasuk biaya kredit dan saldo; dialog kredit kurang menawarkan koneksi sendiri atau batal, plus kalimat informatif tanpa tautan. Tidak ada tombol beli.
   - **iOS:** Rezumi AI tidak ditampilkan; app tidak pernah mengirim `aiSource: "rezumi"` dan memakai koneksi sendiri seperti sekarang.
9. **Teks dan panduan** — Lingui + `pnpm lingui:extract`. Siapkan draf perubahan panduan `docs/` (AI, Coach, workspace) di laporan; terbitkan saat go-live.

### Aturan yang wajib dijaga

- Tidak ada jalur yang memakai Rezumi AI tanpa reservasi kredit.
- Kegagalan, timeout, atau pembatalan sebelum hasil tersimpan selalu melepas reservasi.
- Klien lama tidak pernah memotong kredit tanpa sadar.
- Key server tidak pernah dikirim ke klien; daftar koneksi tidak menampilkan key.

### Tes dan verifikasi

- Unit: pembungkus meteran (sukses → commit; error → release; abort → release; retry dengan `idempotencyKey` sama → satu potongan); resolver per mode; request tanpa `aiSource`.
- Integrasi: minimal satu tes per titik masuk dengan provider AI tiruan (mock), membuktikan reservasi + commit/release terjadi.
- Manual lokal (dengan key pemilik, batas anggaran kecil): satu tindakan per jenis pekerjaan, catat token dan biaya yang tersimpan; tampilkan ringkasannya di laporan (ini bahan awal Phase 10).
- Perintah standar dari README.

### Selesai bila

- Semua titik masuk AI terpetakan dan terbungkus, UI web dan mobile menampilkan biaya dan sumber, tes membuktikan kredit tidak bocor dan klien lama aman.
