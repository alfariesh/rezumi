# Phase 01 — Fondasi: klien treg, data lowongan, tabel

| Dikerjakan | Ukuran | Bergantung pada | Perlu dari pemilik                         |
| ---------- | ------ | --------------- | ------------------------------------------ |
| Claude     | Sedang | Phase 00        | `TREG_API_KEY` di `.env.local` (sudah ada) |

## Untuk pemilik

**Apa yang dibuat:** "pipa" di belakang layar: server bisa memanggil Hirebase dan JobsPipe lewat treg dengan aman (batas biaya, coba ulang otomatis), mengubah hasilnya ke satu format lowongan Rezumi, dan menyimpannya di database. Belum ada yang terlihat oleh pengguna.

**Prompt:** `Kerjakan Phase 01 dari .agents/docs/plans/lowongan/README.md`

**Yang bisa kamu cek di akhir:** laporan Claude berisi contoh lowongan dari beberapa negara (mis. AS, Inggris, remote) yang sudah tersimpan di database lokal (posisi, perusahaan, kota, link), dan biaya treg yang terpakai (di bawah $0.10).

## Untuk agent

### Langkah

1. Baca `02-teknis.md` bagian 1–6 dan 13. Ambil skema terbaru dari katalog treg (gratis) untuk `hirebase.jobs.search`, `hirebase.jobs.get`, `hirebase.jobs.expired`, `jobspipe.jobs.search`, `jobspipe.jobs.new`, dan endpoint `*.count`. Simpan `example_response` (atau satu respons nyata kecil, tanpa kolom kontak orang) sebagai fixtures di `packages/api/src/features/jobs/__fixtures__/`.
2. **Env:** `TREG_API_KEY` (opsional), `JOB_SEARCH_DAILY_BUDGET_USD` (angka, bawaan 1), `FLAG_DISABLE_JOB_SEARCH` (boolean) di `packages/env/src/server.ts`, `.env.example`, `turbo.json`.
3. **Klien treg** `packages/api/src/features/jobs/treg.ts` sesuai bagian 4: header, batas biaya per panggilan, retry 429/503, batas waktu, biaya dari `X-Treg-Cost-Micro`, log tanpa rahasia.
4. **Skema** `packages/schema/src/jobs/` (`listing.ts`, `search.ts`) dengan Zod, ekspor eksplisit di `package.json`.
5. **Adaptor penyedia** `packages/api/src/features/jobs/providers/hirebase.ts` dan `jobspipe.ts`: `search(input) → { listings: JobListing[], cursor?, costMicro }` dan pemetaan bagian 5. Kolom kontak dibuang. Deskripsi HTML → teks.
6. **Tabel** `job_listing` dan `job_search_cache` (bagian 6) di `packages/db/src/schema/jobs.ts`, `pnpm db:generate`, tinjau SQL, `pnpm db:migrate` lokal. Fungsi `upsertListings`, `purgeProvider`.
7. **Analytics Engine:** binding `JOB_EVENTS` dataset `job_search_events` di `wrangler.jsonc` + tipe; helper `recordJobEvent` yang diam (no-op) di Node lokal, mengikuti pola `PORTFOLIO_EVENTS`.
8. **Skrip uji manual** di `tooling/` (dev-only), mis. `pnpm --filter @rezumi/tooling jobs:probe "digital marketing" ID`: memanggil adaptor sungguhan, menyimpan ke DB lokal, mencetak ringkasan dan biaya. Minta izin pemilik sebelum menjalankan versi berbayar; versi `--count` gratis.

### Tes dan verifikasi

- Unit: pemetaan Hirebase dan JobsPipe dari fixtures (termasuk gaji kosong, lokasi tanpa kota, deskripsi HTML, kolom kontak terbuang), klien treg (retry 503, berhenti di spend cap, biaya dari header, token tidak muncul di log), upsert idempoten.
- Integrasi database (pola tes integrasi yang ada) untuk upsert dan `purgeProvider`.
- Satu panggilan nyata kecil per penyedia (≤ 5 lowongan) lewat skrip, biaya dilaporkan.
- `pnpm check:cloudflare` lulus dengan binding baru.

### Selesai bila

- Adaptor dua penyedia mengembalikan `JobListing` yang valid dari fixtures dan dari satu panggilan nyata.
- Tabel ada, migrasi tertinjau, `purgeProvider` teruji.
- Tidak ada perubahan perilaku untuk pengguna.
