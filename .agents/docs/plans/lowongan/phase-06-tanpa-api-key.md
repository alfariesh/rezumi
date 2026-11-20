# Phase 06 — Tanpa API key: baca link dan web search asisten

| Dikerjakan | Ukuran | Bergantung pada | Perlu dari pemilik                                             |
| ---------- | ------ | --------------- | -------------------------------------------------------------- |
| Claude     | Sedang | Phase 03, 04    | `CLOUDFLARE_BROWSER_TOKEN` (Phase 00) + account id; jawaban K4 |

## Untuk pemilik

**Apa yang dibuat:** semua yang dulu butuh API key Firecrawl/Tavily/Exa kini jalan tanpa setup:

- **Menempel link lowongan** dibaca server sendiri, dan bila halamannya butuh JavaScript, lewat browser Cloudflare (Browser Run, 10 jam gratis per bulan).
- **Asisten AI yang mencari di web** memakai treg dengan batas biaya.
- Bagian **Settings → AI → Web access** dihapus.

**Prompt:** `Kerjakan Phase 06 dari .agents/docs/plans/lowongan/README.md`

**Yang bisa kamu cek di akhir:** halaman Settings tanpa Web access; menempel link lowongan dari situs karier perusahaan tetap terbaca; asisten bisa menjawab pertanyaan yang butuh web search.

## Untuk agent

### Langkah

1. Konfirmasi K4 dan catat. Baca `02-teknis.md` bagian 3 dan 11, serta `packages/api/src/features/web-access/*`, `agent/service.ts` (`searchWeb`), `agent/tools.ts` (`search_web`), `applications/ai.ts` (`parsePosting`), dan pemanggil `readPage`.
2. **Env:** `CLOUDFLARE_BROWSER_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (cek apakah sudah ada env akun; jangan duplikasi). Daftarkan sesuai aturan env.
3. **`readPage` baru:** bawaan → Browser Run Quick Actions `/content` (baca dokumentasi resmi Browser Run untuk URL, body, dan batas terbaru) → JSON-LD/teks yang sama. Tetap lewat `assertPublicTarget` (cegah SSRF) sebelum URL dikirim ke mana pun. Batas Browser Run per pengguna per hari (Coordination). Event `kind: "browser"` dengan durasi.
4. **`searchWeb` baru:** `treg.web.search` lewat klien treg (Phase 01), batas biaya kecil, hitung ke anggaran server, hasil dinormalisasi ke bentuk yang dipakai `search_web` sekarang. Batas pemakaian per pengguna mengikuti batas asisten yang ada.
5. **Hapus** sesuai bagian 11: penyedia BYOK, SearXNG, tabel `web_access_credentials` (migrasi drop; tinjau SQL), router `webAccess.*`, UI Settings, pengecekan `webAccessService.canSearch`, MCP parity, `.env.example`, `turbo.json`, dokumen dan panduan yang menyebut Web access, Firecrawl, Tavily, Exa, SearXNG.
6. `knip` / lint memastikan tidak ada sisa ekspor mati.

### Tes dan verifikasi

- Unit `readPage`: halaman dengan JSON-LD (bawaan cukup), halaman SPA (Browser Run ditiru), URL privat ditolak sebelum Browser Run, batas harian.
- Unit `searchWeb`: batas biaya terkirim, anggaran habis → galat bertipe yang ditangani asisten dengan sopan.
- Uji nyata kecil: satu link karier perusahaan (JSON-LD), satu halaman SPA, satu web search (izin biaya pemilik).
- `pnpm check:cloudflare`, migrasi drop tertinjau.

### Selesai bila

- Tidak ada lagi kode, env, tabel, UI, atau panduan web-access BYOK/SearXNG.
- Link tempel dan web search asisten berjalan tanpa setup pengguna.
