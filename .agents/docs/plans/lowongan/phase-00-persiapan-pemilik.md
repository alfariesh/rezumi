# Phase 00 — Persiapan pemilik: akun, rahasia, keputusan

| Dikerjakan               | Ukuran | Bergantung pada | Perlu dari pemilik |
| ------------------------ | ------ | --------------- | ------------------ |
| Pemilik + Claude memandu | Kecil  | —               | ±30 menit          |

## Untuk pemilik

**Apa yang disiapkan:** akun dan kunci yang dipakai server, batas biaya, dan jawaban keputusan. Tidak ada kode yang berubah.

**Prompt:** `Bantu saya mengerjakan Phase 00 dari .agents/docs/plans/lowongan/README.md`

**Langkah:**

1. **treg** (https://treg.to, akun yang kunci `TREG_API_KEY`-nya sudah ada di `.env.local`):
   - Top-up saldo secukupnya untuk awal (mis. $10). Pembayaran kamu lakukan sendiri.
   - Pasang **batas belanja harian** (spend cap) sesuai K7: **$1 per hari**.
   - Buat **token tim terpisah untuk produksi** (jangan pakai token yang sama dengan laptop), lalu simpan sebagai rahasia Worker. Claude memandu perintahnya; kamu yang mengetik nilainya:

     ```bash
     pnpm exec wrangler secret put TREG_API_KEY
     ```

2. **Cloudflare Browser Run** (untuk Phase 06): buat API token di dasbor Cloudflare → My Profile → API Tokens → Create Token → Custom, izin **Account → Browser Rendering → Edit** (namanya bisa tampil sebagai Browser Run), akun Rezumi saja. Simpan:

   ```bash
   pnpm exec wrangler secret put CLOUDFLARE_BROWSER_TOKEN
   ```

3. **Email ke JobsPipe** (aturan mereka belum mengatur penyimpanan data). Kirim dari email bisnismu ke kontak di https://jobspipe.dev, misalnya:

   > Hi, we're building a resume and job-tracking app and plan to use JobsPipe through treg.to. May we cache job records in our database for up to 30 days to serve our own users, always linking to the original posting and removing closed jobs? Thanks!

   Tempel jawabannya di chat sesi phase mana pun; Claude mencatatnya di `00-keputusan.md`. Sambil menunggu, pekerjaan boleh jalan (Hirebase sudah jelas mengizinkan).

4. ~~Jawab K1–K11~~ **Sudah: semua disetujui 2026-11-20** ([00-keputusan.md](00-keputusan.md)).

**Yang bisa kamu cek di akhir:** di `00-keputusan.md` kolom log terisi jawabanmu; perintah `pnpm exec wrangler secret list` menampilkan nama `TREG_API_KEY` dan `CLOUDFLARE_BROWSER_TOKEN` (nilainya tidak tampil).

## Untuk agent

1. Pandu langkah di atas satu per satu. Jangan meminta atau menampilkan nilai token di chat. Jangan membuka halaman pembayaran untuk pemilik.
2. Bila pemilik minta bantuan membuka dasbor, pakai built-in browser; pemilik yang login dan mengisi formulir pembayaran atau token.
3. K1–K11 sudah disetujui (2026-11-20). Bila pemilik ingin mengubah salah satunya, catat di log `00-keputusan.md`.
4. Perbarui status Phase 00 di README dan tambahkan baris "Catatan sesi".

### Selesai bila

- K1–K11 tercatat (sudah, 2026-11-20).
- Rahasia produksi `TREG_API_KEY` dan `CLOUDFLARE_BROWSER_TOKEN` terpasang (dicek dengan `wrangler secret list`), spend cap treg aktif.
- Email ke JobsPipe terkirim (jawaban boleh menyusul).
