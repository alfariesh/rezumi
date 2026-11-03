# Benchmark biaya dan kualitas Rezumi AI

Tanggal: **3 November 2026**. Phase 10 dari [rencana membership](../plans/membership/README.md). Status: biaya dan batas kerja **final untuk peluncuran**; penilaian kualitas oleh pemilik **menunggu** (bagian 5).

## 1. Ringkasan untuk pemilik

- **Model peluncuran: Claude Haiku 5.5.** Bila 100 kredit Pro AI dipakai penuh dengan campuran tindakan yang wajar, biaya AI-nya sekitar **Rp1.800** (P95). Skenario terburuk yang terukur, semua kredit dipakai untuk giliran Coach, sekitar **Rp4.000**. Anggaran per pembelian **Rp15.000**, jadi masih ada ruang ±4–8 kali lipat.
- **Harga Rp79.000 dan 100 kredit aman.** Tidak ada perubahan harga atau jumlah kredit.
- **Bobot kredit tidak diubah** (1–5 kredit per tindakan seperti di [00-keputusan-produk.md](../plans/membership/00-keputusan-produk.md) bagian 5). Semua tindakan jauh di bawah anggaran, jadi bobot tetap mengikuti manfaat, bukan biaya.
- **Claude Sonnet 5.5 tidak dipakai.** Hasilnya sedikit lebih rapi pada pemeriksaan otomatis, tetapi biayanya ±17 kali Haiku: Rp33.000 untuk campuran wajar dan Rp78.000 untuk skenario terburuk per 100 kredit. Angka itu melewati anggaran, dan skenario terburuknya hampir sama dengan harga paket.
- **Ditemukan dan diperbaiki dua bug kredit.** Batas jawaban (`maxOutputTokens`) terlalu kecil. Model memakai sebagian batas untuk "berpikir", sehingga surat lamaran, review, dan balasan Coach terpotong. Sebagian tersimpan **kosong**, dan kreditnya tetap terpotong. Batas kini dinaikkan 2–4 kali. Jawaban yang tetap terpotong sekarang dianggap gagal, dan kreditnya kembali.
- **Biaya uji: US$5,24** dari batas US$10 yang ditetapkan pemilik (Haiku US$0,34 termasuk uji ulang bahasa, Sonnet US$4,90).
- **Tugas pemilik:** nilai 10 tugas di [lembar penilaian](https://claude.ai/artifact/RFQJFUYhJxvTaMatWgJ63p), ±30 menit. Jawaban A dan B diacak dari kedua model.

## 2. Metode

**Data.** 20 CV fiktif dan 20 lowongan fiktif di `tooling/benchmark/fixtures/`. Personanya: fresh graduate, 1–5 tahun, dan pindah karier. Setiap CV punya satu lowongan pasangan. Ada 14 CV dan lowongan berbahasa Indonesia dan 6 berbahasa Inggris. Dua CV panjang (±1.800 kata, 7–8 pekerjaan) dan dua lowongan panjang (850–930 kata). Fixture juga memuat skenario tugas: 12 baris untuk diperbaiki, pesan recruiter, pertanyaan formulir, jawaban latihan interview, debrief, dan 4 percakapan Coach masing-masing 3 giliran. Semua nama, perusahaan, email (`@example.test`), dan nomor (`+62 812-0000-01NN`) dikarang. Tidak ada data pengguna.

**Jalur.** `pnpm benchmark:ai` (`tooling/benchmark/rezumi-ai.ts`) menjalankan server dev lokal dengan `BILLING_MODE=admins`. Setiap run membuat akun uji baru dan menjadikannya admin. Lewat prosedur admin, akun itu diberi Pro AI 30 hari dan 3.000 kredit. Skrip lalu memanggil prosedur yang sama dengan app (`aiSource: "rezumi"`, `idempotencyKey` per tugas) lewat klien oRPC. Hasilnya **96 tugas per model**, mencakup semua `actionKey` dan 13 titik masuk:

| `actionKey`          | Tugas | Titik masuk                                                                                                  |
| -------------------- | ----: | ------------------------------------------------------------------------------------------------------------ |
| `short-text`         |    22 | `ai.improve` (12), `applications.ai.parsePosting` (6, termasuk 2 lowongan panjang), `autofill` (4)           |
| `draft-answer`       |    11 | `draftMessage` follow-up (4), `career.generate` reply (3) dan answer (4)                                     |
| `cover-letter`       |    10 | `draftMessage` surat (4), `coverLetters.draft` stream (5) + versi lebih pendek (1)                           |
| `interview-practice` |     7 | `career.generate` practice (3), debrief (2), briefing (2)                                                    |
| `coach-turn`         |    12 | `agent.messages.send`, 4 percakapan × 3 giliran (2 dokumen, salah satunya CV panjang; 2 lamaran)             |
| `review`             |    17 | `ai.atsReview` (6, termasuk 2 CV panjang), `matchScore` (4 cocok + 4 tidak cocok), `career.generate` fit (3) |
| `tailor-resume`      |     8 | `applications.ai.tailorResume`                                                                               |
| `import-document`    |     9 | `ai.parsePdf` (5, PDF dari renderer server) dan `ai.parseDocx` (4, dari ekspor Word web)                     |

**Biaya.** Token dibaca dari `ai_credit_usage` (input, output termasuk reasoning). Harga yang dipakai adalah harga daftar Anthropic per sejuta token, dicek 2026-11-03. Haiku 5.5: US$0,10 input dan US$0,50 output; untuk prompt di atas 100.000 token tarifnya US$0,50 dan US$2,50. Sonnet 5.5: US$2 dan US$10. Rupiah memakai **kurs perencanaan Rp17.000/US$**, sengaja di atas kurs pasar. P50, P95, dan maksimum dihitung atas tugas yang kreditnya tetap terpotong. Dengan 7–22 sampel per tindakan, P95 praktis sama dengan maksimum.

**Penjaga anggaran.** Sebelum setiap tugas, skrip menjumlahkan biaya semua akun benchmark. Tugas hanya dijalankan bila jumlah itu ditambah biaya terburuk tugas tersebut masih di bawah `--budget-usd 10`.

**Putaran.** Putaran 1 memakai batas peluncuran dan menemukan bug batas output (bagian 4). Setelah perbaikan, putaran 2 diulang penuh untuk kedua model. Angka di bawah berasal dari putaran 2.

## 3. Hasil biaya (putaran 2)

### Claude Haiku 5.5 — 96 tugas, 1 gagal

| Tindakan             | Kredit | Input token P50 / P95 | Output token P50 / P95 | Biaya P50 | Biaya P95 | P95 Rp | Tunggu P50 / P95 |
| -------------------- | -----: | --------------------: | ---------------------: | --------: | --------: | -----: | ---------------: |
| `short-text`         |      1 |         1.089 / 2.260 |              518 / 963 |  $0,00037 |  $0,00063 |   Rp11 |      2,5 / 4,8 d |
| `draft-answer`       |      2 |         4.113 / 4.902 |          1.374 / 1.988 |  $0,00110 |  $0,00144 |   Rp25 |      6,5 / 8,1 d |
| `cover-letter`       |      3 |         3.768 / 6.985 |          1.721 / 3.014 |  $0,00122 |  $0,00198 |   Rp34 |     8,2 / 12,7 d |
| `interview-practice` |      3 |         3.656 / 4.042 |          1.889 / 2.824 |  $0,00124 |  $0,00182 |   Rp31 |     8,8 / 13,1 d |
| `coach-turn`         |      3 |        6.790 / 51.554 |          1.850 / 4.341 |  $0,00168 |  $0,00707 |  Rp120 |    10,5 / 19,3 d |
| `review`             |      4 |        4.124 / 16.536 |          2.015 / 5.784 |  $0,00125 |  $0,00455 |   Rp77 |     9,7 / 26,2 d |
| `tailor-resume`      |      5 |        4.423 / 14.789 |            928 / 1.022 |  $0,00095 |  $0,00198 |   Rp34 |      4,8 / 5,7 d |
| `import-document`    |      5 |        6.557 / 19.002 |         5.206 / 15.106 |  $0,00341 |  $0,00945 |  Rp161 |    18,3 / 44,9 d |

Biaya per kredit pada P95 berkisar US$0,0004–0,0024, atau Rp7–40 per kredit. Bandingkan dengan anggaran Rp150 per kredit dan harga jual Rp790 per kredit. Tindakan termahal per kredit adalah giliran Coach (konteks CV panjang dan beberapa langkah agent) dan impor CV panjang. Satu-satunya kegagalan (`career.generate` answer) terjadi karena JSON jawaban tidak terbaca; kreditnya kembali.

### Claude Sonnet 5.5 — 96 tugas, 0 gagal

| Tindakan             | Kredit | Output token P50 / P95 | Biaya P50 | Biaya P95 |  P95 Rp | Tunggu P50 / P95 |
| -------------------- | -----: | ---------------------: | --------: | --------: | ------: | ---------------: |
| `short-text`         |      1 |              172 / 675 |  $0,00460 |  $0,00963 |   Rp164 |      2,4 / 5,2 d |
| `draft-answer`       |      2 |          1.014 / 1.538 |  $0,01706 |  $0,02518 |   Rp428 |     8,2 / 12,2 d |
| `cover-letter`       |      3 |          1.073 / 2.682 |  $0,01886 |  $0,03566 |   Rp606 |     7,8 / 18,0 d |
| `interview-practice` |      3 |          1.342 / 2.606 |  $0,01979 |  $0,03413 |   Rp580 |    10,8 / 17,9 d |
| `coach-turn`         |      3 |          1.546 / 3.955 |  $0,03275 |  $0,13965 | Rp2.374 |    14,2 / 29,4 d |
| `review`             |      4 |          1.690 / 6.067 |  $0,02176 |  $0,09374 | Rp1.594 |    12,8 / 43,3 d |
| `tailor-resume`      |      5 |              210 / 253 |  $0,01089 |  $0,03210 |   Rp546 |      2,8 / 3,9 d |
| `import-document`    |      5 |         3.499 / 11.785 |  $0,04611 |  $0,15585 | Rp2.650 |    19,2 / 54,6 d |

Input token hampir sama dengan Haiku (prompt sama). Sonnet menulis lebih sedikit token, tetapi tarifnya 20 kali lipat.

### 100 kredit dipakai penuh

Campuran realistis untuk sebulan mencari kerja dengan bobot sekarang, persis 100 kredit: 1 impor CV, 4 review, 4 sesuaikan CV, 4 surat, 6 giliran Coach, 4 latihan interview, 4 draf jawaban, dan 9 teks pendek. Campuran "terberat" memakai semua kredit untuk tindakan dengan biaya P95 per kredit tertinggi.

| Model      | Skenario                    |      P50 |      P95 | Terhadap anggaran Rp15.000 |
| ---------- | --------------------------- | -------: | -------: | -------------------------- |
| Haiku 5.5  | Realistis                   |    Rp677 |  Rp1.777 | 12%                        |
| Haiku 5.5  | Terberat (33 giliran Coach) |    Rp945 |  Rp3.965 | 26%                        |
| Sonnet 5.5 | Realistis                   | Rp10.837 | Rp33.382 | 223%                       |
| Sonnet 5.5 | Terberat (33 giliran Coach) | Rp18.375 | Rp78.343 | 522%                       |

Dengan Haiku, kontribusi Pro AI di [bagian 7 keputusan produk](../plans/membership/00-keputusan-produk.md) naik. Pos anggaran AI Rp15.000 diasumsikan habis, padahal yang terpakai Rp1.800–4.000 per pembelian. Pos itu tetap dibiarkan Rp15.000 sebagai cadangan: kurs bisa berubah, model bisa diganti, dan kebiasaan pengguna sungguhan belum diketahui.

**Batas atas teoretis.** Satu giliran Coach yang memakai semua 8 langkah dengan prompt penuh (240.000 karakter) dan output penuh menelan ±Rp1.400. Kalau semua 33 giliran dalam 100 kredit seperti itu, totalnya ±Rp45.000. Benchmark tidak pernah mendekati angka ini: giliran terbesar memakai 51.554 token input, ±10% dari kemungkinan maksimum. Pantau P95 per tindakan di halaman Admin billing (Phase 09) setelah rilis. Sesuai aturan 7 di bagian 5 keputusan produk, perbaiki bobot atau model untuk pembelian berikutnya bila angkanya bergeser. Jangan menghentikan pelanggan diam-diam.

**Tarif konteks panjang Haiku** (5 kali lipat di atas 100.000 token) tidak pernah terpakai. Prompt tunggal terbesar adalah 54.059 token (Coach, CV panjang), sehingga tarif datar di `AI_COST_*` cukup. Risiko yang tersisa ada pada impor PDF yang sangat panjang: ±3.000 token per halaman, jadi di atas ±30 halaman. Usulan batas halaman ada di [backlog L14](../plans/membership/backlog-lanjutan.md).

## 4. Temuan dan perbaikan

1. **Batas output memotong hasil, termasuk yang tersimpan kosong.** Di putaran 1, Haiku sering menghabiskan seluruh batas dengan reasoning. Rinciannya: 6 dari 10 surat berhenti tepat di 2.048 token (dua surat dari lamaran tersimpan dengan isi **kosong**), 5 dari 17 review dan fit check gagal di 4.096 token (JSON terpotong, `INTERNAL_SERVER_ERROR`), 2 giliran Coach berhenti di 4.096 (satu tanpa teks), impor CV panjang memakai 15.652 dari 16.384 token, dan pembacaan lowongan panjang berhenti di 1.024. Sonnet mengalami 3 kegagalan review yang sama. **Perbaikan:** `AI_WORK_LIMITS.maxOutputTokens` dinaikkan menjadi sekitar dua kali jawaban terbesar yang terukur (tabel di bawah). Di putaran 2 tidak ada lagi tugas yang menyentuh batas.
2. **Jawaban terpotong tetap memotong kredit.** Ini melanggar aturan 4 di bagian 5: gagal tanpa hasil yang bisa dipakai, kredit kembali. **Perbaikan:** di meteran Rezumi AI (`metered-ai.ts`), panggilan dengan `finishReason` `length` kini gagal dengan `AI_OUTPUT_LIMIT` (502). Pesannya: "Rezumi AI stopped before finishing its answer. Try again; no credits were used." Pada stream, kode itu dikirim sebagai part `error` sebelum `finish`. Kredit kembali dan token tetap dicatat untuk laporan biaya. Draf surat yang di-stream meneruskan kode itu, tidak lagi menampilkan "tidak bisa menghubungi provider". Coach menampilkan pesan yang sama di percakapan. Ada 3 tes DB nyata baru di `metered-ai.integration.test.ts`. Koneksi pribadi (BYOK) tidak berubah.
3. **Isian kosong di balasan recruiter memang disengaja.** Kedua model menulis "[isi nominal per bulan]" atau "[slot 1]" untuk hal yang tidak ada di CV, seperti gaji harapan dan jadwal. Model tidak mengarang, jadi ini bukan cacat. Web sebaiknya tetap meminta pengguna membaca ulang sebelum mengirim.
4. **Ringkasan review ATS selalu berbahasa Inggris, juga untuk CV Indonesia (diperbaiki hari yang sama).** Kedua model melakukannya, karena prompt `ats-review-system.md` tidak menyebut bahasa; penjelasan "why" di `ai.improve` juga selalu berbahasa Inggris, sementara baris yang diperbaiki sudah mengikuti bahasa CV. Pemilik memilih **bahasa CV**. Kedua prompt kini meminta seluruh teks dalam bahasa CV atau baris; tes penjaga ada di `ats-review.test.ts` dan `improve.test.ts`. Uji ulang 29 tugas di Haiku 5.5 (US$0,04): review CV Indonesia berbahasa Indonesia 3/3, CV Inggris tetap Inggris 3/3, alasan Perbaiki baris mengikuti bahasa baris 12/12. Di uji yang sama satu cek kecocokan (`career.generate` fit, lowongan 930 kata) gagal karena model mengembalikan lebih dari 20 kebutuhan dan skema menolaknya; kredit kembali. Lihat [backlog L13](../plans/membership/backlog-lanjutan.md).
5. **Hasil yang akurat.** Impor CV mengenali nama, email, telepon, dan semua pekerjaan di 9/9 file pada kedua model. Skor kecocokan memisahkan pasangan cocok dan tidak cocok dengan jelas: Haiku rata-rata 72 lawan 5, Sonnet 81 lawan 2. Pemeriksaan "angka yang tidak ada di sumber" hanya menemukan dua kasus, dan keduanya bukan karangan. "3–5 komplain per hari" berasal dari permintaan pengguna, dan "lebih dari 4 tahun" dihitung dari periode kerja di CV. Teks pendek dan surat ditulis dalam bahasa lowongan.
6. **Perbedaan kualitas yang terlihat otomatis kecil.** Sonnet menulis review sedikit lebih banyak (9 lawan 7,7 saran) dan memberi skor kecocokan yang lebih tegas. Setelah perbaikan batas, surat Haiku sudah sesuai panjang yang diminta (4/4, rata-rata 252 kata; Sonnet 265 kata). Penilaian manusia ada di bagian 5.

**Batas kerja baru** (`packages/api/src/features/billing/metered-ai.ts`; input dan langkah tidak berubah):

| `actionKey`          |        Output lama → baru | Output terbesar terukur (Haiku / Sonnet, putaran 2) |
| -------------------- | ------------------------: | --------------------------------------------------: |
| `short-text`         |             1.024 → 4.096 |                                         1.451 / 812 |
| `draft-answer`       |             2.048 → 4.096 |                                       1.988 / 1.538 |
| `cover-letter`       |             2.048 → 8.192 |                                       3.014 / 2.682 |
| `interview-practice` |             4.096 → 8.192 |                                       2.824 / 2.606 |
| `coach-turn`         | 4.096 → 8.192 per langkah |                                       4.341 / 3.955 |
| `review`             |            4.096 → 16.384 |                                       5.784 / 6.067 |
| `tailor-resume`      |             4.096 (tetap) |                                         1.022 / 253 |
| `import-document`    |           16.384 → 32.768 |                                     15.106 / 11.785 |

## 5. Penilaian kualitas oleh pemilik

[Lembar penilaian](https://claude.ai/artifact/RFQJFUYhJxvTaMatWgJ63p) memuat 10 tugas dari putaran 2: setiap jenis tindakan kecuali impor, maksimal 2 per jenis, 6 berbahasa Indonesia dan 4 berbahasa Inggris. Setiap tugas berisi permintaan, CV dan lowongan yang dipakai, serta jawaban kedua model sebagai A/B acak. Ada empat kriteria: fakta tidak dikarang, bahasa wajar, format benar, dan berguna untuk lowongan. Pemilik juga memilih jawaban mana yang lebih baik. Kunci A/B ada di `tooling/benchmark/results/rating-key.json` (lokal, tidak di-commit).

_Hasil: menunggu penilaian pemilik._ Bila Haiku dinilai tidak layak, pilihannya adalah mengubah harga atau jumlah kredit Pro AI agar model yang lebih mahal muat di anggaran. Keputusan itu ada di tangan pemilik.

## 6. Keputusan dan konfigurasi

| Hal                    | Keputusan                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| Model Rezumi AI        | `AI_PROVIDER=anthropic`, `AI_MODEL=claude-haiku-5-5`                                       |
| Tarif biaya (produksi) | `AI_COST_INPUT_USD_PER_MTOK=0.10`, `AI_COST_OUTPUT_USD_PER_MTOK=0.50`                      |
| `CREDIT_COSTS`         | Tetap (bobot peluncuran); `BILLING_CATALOG_VERSION` tetap `1` karena katalog tidak berubah |
| `AI_WORK_LIMITS`       | Output dinaikkan (tabel bagian 4); jawaban terpotong = gagal, kredit kembali               |
| Harga dan kuota        | Tidak berubah: Pro AI Rp79.000, 100 kredit                                                 |

## 7. Cara mengulang

1. Jalankan server tanpa web, dengan `.env.local` berisi `AI_PROVIDER`, `AI_MODEL`, dan `AI_API_KEY`: `env PORT=3050 SERVER_PORT=3051 APP_URL=http://127.0.0.1:3051 BILLING_MODE=admins FLAG_DISABLE_API_RATE_LIMIT=true pnpm exec dotenvx run -f .env.local -- turbo run dev --filter=server`. Untuk model lain, tambahkan `AI_MODEL=… AI_COST_INPUT_USD_PER_MTOK=… AI_COST_OUTPUT_USD_PER_MTOK=…` dan pakai port lain.
2. `pnpm benchmark:ai --url http://127.0.0.1:3051 --model claude-haiku-5-5 --budget-usd <batas>`. `--only short-text,coach-1-1` menjalankan sebagian tugas. Satu run penuh memakan ±15 menit, ±US$0,15 untuk Haiku dan ±US$2,50 untuk Sonnet. Model baru perlu ditambahkan ke `MODEL_PRICES` di `tooling/benchmark/stats.ts`.
3. `pnpm benchmark:ai:report` menulis `tooling/benchmark/results/report.md` (run terbaru per model), `summary.json`, serta lembar penilaian.

Akun uji `rezumi-ai-bench-…@example.test` tertinggal di database lokal; hapus bila perlu. Hasil mentah hanya berisi data fiktif dan tidak di-commit.

## 8. Keterbatasan

- Sampel kecil (7–22 per tindakan) dari data fiktif yang ditulis AI. Pemakaian nyata bisa lebih panjang, misalnya CV dengan banyak proyek atau percakapan Coach yang lebih dari 3 giliran.
- Harga provider dan kurs bisa berubah. Kalau tarif atau model berubah, ulangi benchmark ini.
- Latensi diukur dari satu mesin di jaringan rumah, sementara dua run berjalan bersamaan. Waktu di Cloudflare Workers bisa berbeda.
