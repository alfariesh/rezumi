# Phase 07 — MCP, dashboard biaya, panduan, rilis

| Dikerjakan       | Ukuran | Bergantung pada | Perlu dari pemilik                 |
| ---------------- | ------ | --------------- | ---------------------------------- |
| Claude + pemilik | Sedang | Semua           | ±30 menit uji bersama; izin deploy |

## Untuk pemilik

**Apa yang dibuat:**

- Pengguna Claude/ChatGPT bisa mencari lowongan lewat **MCP Rezumi** (tool `search_jobs`, kuota sama).
- **Dashboard biaya** di halaman admin: biaya treg per hari, berapa persen pencarian dilayani dari cache, kecepatan, galat.
- Panduan pengguna diperbarui, lalu uji bersama sebelum rilis.

**Prompt:** `Kerjakan Phase 07 dari .agents/docs/plans/lowongan/README.md`

**Yang bisa kamu cek di akhir:** dashboard biaya di admin; daftar uji bersama yang sudah dicentang; fitur tayang di rezumi.app.

## Untuk agent

### Langkah

1. **MCP** `packages/mcp`: tool `search_jobs` (input sama dengan `jobs.search`, maks 10 hasil per panggilan, kuota dan anggaran sama, selalu menyertakan link posting asli; tanpa ekspor massal) dan `track_job`. Perbarui server card dan panduan MCP.
2. **Dashboard biaya admin:** data dari Analytics Engine `job_search_events` lewat `ANALYTICS_SQL` (pola laporan yang ada), ditambah saldo treg bila treg menyediakan endpoint saldo (cek katalog/dokumentasi; MCP treg punya `balance`). Peringatan > 80% anggaran (`02-teknis.md` 12).
3. **Panduan** sesuai tabel career-platform; pastikan tidak ada panduan yang masih menyuruh memasang API key web search.
4. **Uji menyeluruh** (lokal, build produksi): cari ID dan global, cache, kuota tiap paket, lacak, notifikasi lowongan baru, lowongan tutup, link tempel, asisten web search, MCP, anggaran habis, kill switch `FLAG_DISABLE_JOB_SEARCH`.
5. **Uji bersama pemilik** (±30 menit) dengan daftar centang di laporan.
6. **Deploy:** pastikan rahasia produksi ada (`wrangler secret list`), migrasi diterapkan oleh workflow deploy, binding baru di `wrangler.jsonc`. Setelah deploy: satu pencarian nyata di produksi, cek dashboard biaya dan log.
7. Isi `backlog-lanjutan.md` dengan temuan baru; status semua phase ✅.

### Selesai bila

- Fitur tayang di produksi, biaya terpantau, panduan sesuai, pemilik sudah mencoba sendiri.
