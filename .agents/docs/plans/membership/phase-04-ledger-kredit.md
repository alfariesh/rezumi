# Phase 04 — Ledger kredit Rezumi AI

| Dikerjakan | Ukuran | Bergantung pada | Perlu dari pemilik |
| ---------- | ------ | --------------- | ------------------ |
| Claude     | Sedang | Phase 01        | —                  |

## Untuk pemilik

**Apa yang dibuat:** "buku tabungan" kredit AI. Sistem bisa mencatat kredit masuk (kredit coba 5, kredit Pro AI 100, koreksi admin), memesan kredit sebelum AI bekerja, memotongnya bila berhasil, dan mengembalikannya bila gagal. Fitur AI belum memakai buku ini (itu Phase 05). Pengguna belum melihat perubahan apa pun di produksi.

**Siapkan:** tidak ada.

**Prompt:** `Kerjakan Phase 04 dari .agents/docs/plans/membership/README.md`

**Yang bisa kamu cek di akhir:** halaman Paket (lokal, `BILLING_MODE=admins`) menampilkan saldo kredit dan tanggal kedaluwarsanya setelah admin menambah kredit untuk akunnya sendiri.

## Untuk agent

### Tujuan

1. Tabel `ai_credit_grant` dan `ai_credit_usage` (`01-arsitektur.md` 4.5) + migrasi.
2. Layanan `packages/api/src/features/billing/credits.ts`: `grantCredits`, `reserveCredits`, `commitCredits`, `releaseCredits`, `getCreditBalance`, `ensureTrialCredits`.
3. `runBillingJobs()` pertama (`packages/api/src/features/billing/jobs.ts`) dengan satu tugas: melepas reservasi macet. Dipanggil dari `scheduled()` di `apps/server/src/cloudflare/index.ts` dan dari scheduler Node di `apps/server/src/startup/` (sebelum `runCareerJobs`, error saling terisolasi).
4. Data kredit di `billing.summary` dan prosedur riwayat kredit; prosedur admin untuk koreksi kredit.
5. Bobot awal `CREDIT_COSTS` di katalog.

### Aturan bisnis

Sumber: `00-keputusan-produk.md` bagian 5.

- Kredit Pro AI diberikan saat pembayaran terverifikasi dan berlaku sampai akhir potongan masa aktif yang dibeli (Phase 06 memanggil `grantCredits`).
- Kredit coba: 5 kredit, sekali per akun, hanya akun non-tamu dengan email terverifikasi, diberikan saat pertama kali memakai Rezumi AI, berlaku 14 hari sejak diberikan. `billing_account.trial_granted_at` mencegah pemberian ulang, termasuk setelah logout/login atau ganti perangkat.
- Pemakaian mengambil grant yang paling cepat kedaluwarsa lebih dulu.
- Gagal tanpa hasil yang bisa dipakai → kredit kembali. Klik ganda atau retry jaringan dengan `idempotencyKey` yang sama → tidak dipotong dua kali.
- Kredit tidak bisa dipindah ke akun lain dan tidak bisa diuangkan.

### Langkah

1. **Tabel + migrasi** — sesuai arsitektur, termasuk `CHECK` dan index. Baca SQL hasil `pnpm db:generate`.
2. **`credits.ts`** — semua fungsi menerima `tx` atau membuka transaksi sendiri, selalu memanggil `lockBillingAccount` lebih dulu:
   - `grantCredits(tx, { userId, source, amount, expiresAt, paymentId?, note? })`.
   - `reserveCredits({ userId, actionKey, idempotencyKey })` → `{ usageId, credits, balanceAfter }`; idempoten berdasarkan `operation_key`; saldo kurang → `ORPCError` `INSUFFICIENT_CREDITS` dengan `{ required, balance }`.
   - `commitCredits(usageId, { provider, model, inputTokens, outputTokens, costUsdMicros })` dan `releaseCredits(usageId, errorCode)`; keduanya hanya dari `reserved`, aman dipanggil dua kali.
   - `getCreditBalance(userId, now)` → `{ balance, nextExpiry: { credits, at } | null, trial: { available, grantedAt, expiresAt } }`.
   - `ensureTrialCredits(tx, user)` → memberi 5 kredit bila memenuhi syarat; mengembalikan apakah diberikan.
3. **Bobot awal** — isi `CREDIT_COSTS` di `@rezumi/schema/billing` dengan bobot uji dari `00-keputusan-produk.md` bagian 5. Nama `actionKey` final ditetapkan di Phase 05 saat memetakan titik masuk AI; di phase ini sediakan tipe dan nilai awal per jenis pekerjaan.
4. **Job** — `runBillingJobs()` melepas `ai_credit_usage` `reserved` yang lebih tua dari 15 menit (`FOR UPDATE SKIP LOCKED`, maksimal ±100 per putaran). Aman berjalan ganda.
5. **API**:
   - `billing.summary` ditambah `credits` (dari `getCreditBalance`).
   - `billing.creditHistory({ cursor? })` → daftar grant dan pemakaian (tanggal, jenis, jumlah, status, kedaluwarsa), dipaginasi mengikuti pola `packages/api/src/pagination.ts`.
   - `billing.admin.adjustCredits({ userId | email, amount, expiresInDays, reason })` → positif = grant `admin`; negatif = mengurangi `remaining` grant aktif (paling cepat kedaluwarsa dulu, tidak boleh di bawah nol). Wajib alasan, tulis audit log.
6. **UI baca saja** — halaman Paket web dan Android (dari Phase 03) menampilkan saldo, kedaluwarsa terdekat, dan riwayat singkat. iOS tidak menampilkan kredit (`00-keputusan-produk.md` bagian 6). Teks Lingui.

### Aturan yang wajib dijaga

- Saldo tidak pernah negatif; `remaining` grant tidak pernah melebihi `amount`.
- Dua reservasi paralel tidak bisa memakai kredit yang sama.
- Tidak ada fungsi publik yang mengubah kredit tanpa melewati layanan ini.
- `BILLING_MODE=off` → `billing.summary.credits` tidak ditampilkan dan tidak ada kredit yang diberikan otomatis.

### Tes dan verifikasi

- Unit/integrasi: grant → reserve → commit; reserve → release mengembalikan saldo ke grant asal; alokasi lintas dua grant dengan kedaluwarsa berbeda; idempotensi `operation_key`; saldo kurang; grant kedaluwarsa tidak terpakai; release grant yang sudah kedaluwarsa tidak membuat saldo aktif; kredit coba hanya sekali dan tidak untuk tamu/email belum terverifikasi; job melepas reservasi macet; koreksi admin negatif tidak membuat saldo negatif.
- Integrasi DB nyata: 10 reservasi paralel dengan saldo cukup untuk 3 → tepat 3 berhasil.
- Perintah standar dari README.

### Selesai bila

- Ledger berfungsi dan teruji, job terpasang di Workers dan Node, saldo terlihat di halaman Paket web dan Android (mode admins), admin bisa koreksi kredit lewat prosedur dengan audit.
