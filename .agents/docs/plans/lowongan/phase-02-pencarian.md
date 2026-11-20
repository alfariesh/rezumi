# Phase 02 — Pencarian: cache, kuota, pilihan penyedia

| Dikerjakan | Ukuran | Bergantung pada | Perlu dari pemilik |
| ---------- | ------ | --------------- | ------------------ |
| Claude     | Besar  | Phase 01        | Jawaban K2, K3, K7 |

## Untuk pemilik

**Apa yang dibuat:** "mesin" pencarian lowongan di server: memakai Hirebase sebagai sumber utama dan JobsPipe untuk menambah hasil bila sedikit, menyimpan hasil supaya pencarian yang sama oleh orang lain langsung tampil tanpa biaya, membatasi jumlah pencarian per paket, dan berhenti memanggil penyedia bila anggaran harian habis. Belum ada halaman baru; itu Phase 03.

**Prompt:** `Kerjakan Phase 02 dari .agents/docs/plans/lowongan/README.md`

**Yang bisa kamu cek di akhir:** laporan Claude menunjukkan pencarian pertama (±2 detik, ada biaya) dan pencarian kedua yang sama (di bawah 0,1 detik, biaya $0), serta pesan saat kuota habis.

## Untuk agent

### Langkah

1. Konfirmasi K2, K3, K7 dan catat di `00-keputusan.md`.
2. **Ukur dulu, gratis:** dengan endpoint `*.count`, bandingkan untuk ±15 kata kunci di beberapa negara (AS, Inggris, Jerman, India, Kanada, remote, plus satu negara kecil) apakah kata bebas lebih baik di `job_title_or` vs `description_or` (JobsPipe) dan `job_titles` vs `keywords` (Hirebase). Tulis temuan dan pilihan di bagian baru `02-teknis.md`.
3. **`JobSearchService`** sesuai `02-teknis.md` bagian 7: normalisasi dan kunci cache, rate limit binding `JOB_SEARCH_LIMITER` (tambahkan ke `wrangler.jsonc`), kuota (bagian 8), cache, single-flight lewat `Coordination`, anggaran server, router penyedia dengan cadangan, upsert, dedup, event.
4. **Kuota paket:** `jobSearchesPerDay` di `PlanLimits` (`packages/schema/src/billing/catalog.ts`) dan pengecekan di `packages/api/src/features/billing/limits.ts` (pesan netral seperti `planLimitReached`). Sesuaikan tes billing yang membaca daftar batas.
5. **Anggaran:** penghitung biaya harian di `Coordination` (tambahkan operasi kecil bila `consume` tidak cocok; tes Durable Object yang ada di `apps/server/src/cloudflare/`). Di Node lokal pakai pengganti di memori atau Redis bila `REDIS_URL` ada, mengikuti pola koordinasi yang sudah ada.
6. **oRPC** `jobs.search`, `jobs.listing`, `jobs.hide`, `jobs.quota` (dan `jobs.track` boleh di Phase 03). Semua `protectedProcedure`, galat bertipe (`PLAN_LIMIT_REACHED`, `JOBS_UNAVAILABLE`, `JOBS_BUDGET_LIMITED`, `RATE_LIMIT_EXCEEDED`). `pnpm docs:gen`.
7. Putuskan tempat "lowongan disembunyikan" (tabel baru vs `career_opportunity`), catat di `02-teknis.md` 6.

### Tes dan verifikasi

- Unit: kunci cache stabil (urutan kunci JSON, huruf besar/kecil, spasi), router (Hirebase dulu; JobsPipe menambah bila < 10 atau galat; cursor per penyedia), dedup, cache segar vs kedaluwarsa, lowongan tutup/tersembunyi tidak tampil, anggaran habis → cache basi + tanda.
- Integrasi: dua permintaan bersamaan dengan kunci sama → satu panggilan penyedia (adaptor tiruan menghitung panggilan). Kuota: pencarian ke-(max+1) ditolak; reset di hari berikutnya.
- Satu panggilan nyata lewat oRPC lokal (izin biaya pemilik) lalu ulangi → `fromCache: true`.

### Selesai bila

- `jobs.search` mengembalikan lowongan nyata, cache dan single-flight terbukti, kuota dan anggaran bekerja, galat bertipe.
- Tidak ada pemanggil lama yang berubah perilaku.
