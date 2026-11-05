# Phase 10 — Rezumi AI untuk portfolio

| Dikerjakan | Ukuran | Bergantung pada | Perlu dari pemilik                                                                        |
| ---------- | ------ | --------------- | ----------------------------------------------------------------------------------------- |
| Claude     | Sedang | Phase 04, 07    | API key AI di `.env.local` untuk uji (yang dipakai sesi membership); jawaban biaya kredit |

## Untuk pemilik

**Apa yang dibuat:** tombol **"Tulis draf dengan AI"** saat membuat portfolio (intro, Tentang saya, dan cerita setiap karya dari CV), plus tombol AI kecil di kolom teks dan blok Teks untuk menulis ulang (lebih singkat, lebih profesional, atau diterjemahkan), dan **Temukan angka**: AI membaca CV lalu menyarankan widget metrik dari angka yang benar-benar tertulis ("meningkatkan konversi 35%" → "+35% konversi"). Memakai kredit Rezumi AI atau koneksi AI sendiri, sama seperti fitur AI lain.

**Siapkan:** jawab biaya kredit. Usulan: draf lengkap 3 kredit, tulis ulang satu kolom 1 kredit, temukan angka 1 kredit.

**Prompt:** `Kerjakan Phase 10 dari .agents/docs/plans/portfolio/README.md`

**Yang bisa kamu cek di akhir:** contoh draf AI untuk dua persona fiktif (Indonesia dan Inggris) dan rincian kredit yang terpakai.

## Untuk agent

### Langkah

1. **Konfirmasi** aturan turunan #6 (biaya) dengan pemilik; catat di log.
2. **Prosedur** `portfolio.ai.draft`, `portfolio.ai.rewrite`, dan `portfolio.ai.findMetrics` (`02-teknis.md` bagian 13) lewat `metered-ai.ts` dan `aiSource`, dengan kunci idempotensi. Keluaran JSON tervalidasi Zod. Masukan tanpa kontak pribadi. Bahasa = bahasa halaman.
3. **Prompt**: tulis dalam gaya portfolio (orang pertama, ringkas, konkret), larang mengarang angka, nama klien, atau hasil yang tidak ada di masukan; boleh menulis "[tambahkan hasil]" sebagai tempat isian.
4. **Biaya**: kunci baru di `CREDIT_COSTS` bila perlu (misalnya `portfolio-draft`), pemetaan meteran, label biaya di UI; naikkan `BILLING_CATALOG_VERSION` hanya bila halaman harga atau S&K menyebut biaya per tindakan.
5. **UI**: langkah AI di dialog buat (`01-desain.md` bagian 2 dan 12), tombol AI di kolom panjang dan blok Teks (pola label biaya + pilihan sumber AI yang ada), tombol **Temukan angka** di form metrik dan angka pencapaian (daftar usulan dengan kutipan asal, pengguna memilih), hasil sebagai perubahan yang bisa di-Urungkan, dialog kredit kurang.
6. **Uji nyata** dengan model produksi (keputusan benchmark membership: Claude Haiku 5.5) memakai persona fiktif ID dan EN; catat token dan perkiraan biaya per tindakan, bandingkan dengan anggaran di `.agents/docs/research/benchmark-rezumi-ai-2026-11-03.md`.

### Aturan yang wajib dijaga

- Kredit dipotong tepat sekali per tindakan; gagal atau batal → kredit kembali.
- `aiSource: "own"` tidak pernah memotong kredit Rezumi AI.
- AI tidak pernah menerbitkan atau mengubah pengaturan publik; ia hanya mengisi draf di editor.

### Tes dan verifikasi

- Unit/integrasi DB nyata: skema keluaran; potong kredit sekali (termasuk permintaan ganda dengan kunci yang sama); gagal → kredit kembali; koneksi sendiri tidak memotong kredit; uji sederhana "tidak ada angka atau nama diri baru" terhadap masukan; setiap metrik dari `findMetrics` punya kutipan asal yang memuat angkanya.
- Browser lokal: alur buat dengan AI dan tulis ulang satu kolom; screenshot.

### Selesai bila

- Draf AI bermutu untuk kedua persona dan biaya per tindakan tercatat di laporan.
