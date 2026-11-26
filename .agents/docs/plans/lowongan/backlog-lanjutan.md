# Backlog setelah rilis — lowongan

Ide yang sengaja tidak masuk rilis pertama. Urutan bukan prioritas.

| Ide                                                                  | Catatan                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Patokan gaji di Offers / perbandingan tawaran                        | `hirebase.jobs.salary.insights` ($0.01/panggilan, persentil + histogram) dan `jobspipe.jobs.salary.benchmark` ($0.25/laporan). Cakupan gaji beda per negara (AS ±66%, Inggris ±29%, Jerman ±12%, India ±1%): tampilkan hanya bila datanya cukup, ukur dengan count. |
| Info perusahaan di workspace lamaran                                 | `company_data` Hirebase (ukuran, industri, pendanaan) untuk persiapan interview.                                                                                                                                                                                    |
| Lowongan serupa dan dedup lebih pintar                               | Workers AI embeddings + Vectorize atas `job_listing` aktif; atau sinonim dan terjemahan posisi ("Softwareentwickler" ↔ "software engineer", "admin keuangan" ↔ "finance admin") untuk pasar non-Inggris.                                                            |
| Skor AI untuk semua hasil                                            | Model Jev di treg (< $0.001/lowongan) bila K8 diubah.                                                                                                                                                                                                               |
| Pindah ke API langsung Hirebase/JobsPipe                             | Bila volume membuat paket bulanan lebih murah daripada pay-as-you-go (Hirebase Growth $249/bln untuk 250.000 lowongan ≈ $0.001/lowongan, kelebihan $0.0015; JobsPipe Builder $49/bln untuk 25.000). Tinggal menambah adaptor; `provider` di DB tetap.               |
| Import profil LinkedIn lewat treg, bukan Apify                       | Satu token/satu tagihan. Cek endpoint profil HarvestAPI di katalog treg dan bandingkan harga dengan Apify ($0.004/profil).                                                                                                                                          |
| Papan lowongan lokal (JobStreet, Glints, StepStone, Naukri, Seek, …) | Tidak ada di penyedia. Jalur: browser extension (JobStreet sudah didukung); tambah pembaca sesuai negara tempat pengguna paling banyak.                                                                                                                             |
| Webhook dari penyedia                                                | Hirebase dan JobsPipe (paket Builder ke atas) punya webhook; treg tidak meneruskan webhook. Hanya relevan bila pindah ke API langsung.                                                                                                                              |
| App mobile                                                           | Halaman Lowongan di `apps/mobile` setelah mobile dilanjutkan; logika sudah di `packages/api` dan `packages/schema`.                                                                                                                                                 |

- **Laporkan lowongan bermasalah** (dari `01-desain.md` 1, tidak dibuat di Phase 03): menu ⋯ di kartu yang mengirim laporan (penipuan, sudah tutup, salah info) ke dasbor admin; lowongan yang dilaporkan beberapa akun disembunyikan sementara. Butuh tabel laporan dan layar admin (bersama dasbor biaya Phase 07).
- **Peringatan saldo treg lewat email** (temuan Phase 07): sekarang saldo di bawah anggaran satu hari hanya tampil di dasbor biaya. Job billing bisa membaca `GET /orgs/<id>/balance` sekali sehari dan mengirim alert seperti `job_search_budget`; atau nyalakan auto top-up di treg.
- **Prompt MCP "cari lowongan untuk saya"** (seperti `build_portfolio`): membaca preferensi (`api_jobs_defaults`), mencari, memeriksa kecocokan, lalu menawarkan `track_job`. Tool-nya sudah ada sejak Phase 07.
- **`auth.createApiKey` dengan `expiresIn` < 1 hari memberi 500** (galat Better Auth `EXPIRES_IN_IS_TOO_SMALL` tidak dipetakan ke 400). Bukan bagian lowongan; ditemukan saat uji MCP Phase 07.

## Review rilis 2026-11-20 (branch `fix/jobs-hardening`)

Sudah diperbaiki: satu perusahaan maksimal 2 lowongan di atas tiap halaman; batas waktu 25 detik per halaman pencarian dan 3 detik untuk penghitung bersama (Durable Object), lalu jatuh ke penghitung lokal (dugaan penyebab "permintaan pertama sesudah deploy" menggantung); harga di halaman utama menyebut pencarian/hari dan jumlah notifikasi; halaman Jobs tidak lagi mencari ulang setiap Track/Hide/simpan (sebelumnya semua mutasi memuat ulang semua halaman hasil dan bisa memakan kuota); gaji tanpa desimal paksa; gaji minimum besar (IDR/VND) tidak hilang; galat "load more" tampil di dekat tombolnya; tombol "Search again"; hapus notifikasi dengan Undo; kuota hari UTC dibatasi 2x supaya ganti zona waktu tidak memberi pencarian baru; web search: Serper per negara lalu fallback sekali saja, batas belanja $0,20/orang/hari, pencarian/baca yang gagal tidak dihitung, halaman 404/410 tidak dikirim ke Browser Run; notifikasi: JobsPipe ditanya dengan jendela posting sesuai interval (agar delta cursor didapat), cursor yang ditolak dibuang, notifikasi di luar batas paket (setelah turun paket) tidak diperiksa, jadwal ulang karena anggaran disebar 00:05–06:05 UTC, ganti role lewat MCP tidak lagi diabaikan; upkeep: id JobsPipe yang tak dijawab tidak menyumbat antrean, lease 10 menit dan hanya dilepas pemiliknya, listing tertutup dihapus setelah lamarannya ditandai, role "New roles" yang 30 hari tak muncul lagi di-dismiss dan Home memuat maksimal 100.

Sisa (kecil, belum dikerjakan):

- **Track dua kali bersamaan** (klik ganda dari MCP) bisa membuat dua lamaran: `findBySourceKey` lalu `create` tanpa kunci; indeks `(user_id, source_key)` tidak unik. Perlu kunci per pengguna di sekitar keduanya.
- **`jobs.defaults` bisa menulis** (mengisi wilayah pencarian dari zona waktu) padahal GET/read-only di MCP.
- **Skill satu huruf atau bersimbol** (C, C++, C#, R) tidak pernah cocok di chip kecocokan.
- **Biaya Browser Run tercatat $0** di dasbor biaya; bisa diperkirakan dari `x-browser-ms-used`.
- **Jawaban treg 200 dengan JSON rusak** tidak masuk anggaran (galat dilempar sebelum biaya dicatat).
- **Dua permintaan identik bersamaan** dari orang yang sama bisa terhitung dua pencarian (cek "sudah dibuka hari ini" bukan atomik).

## Revamp tata letak 2026-11-20 (pemilik)

Jobs pindah dari sidebar ke menu Applications (`/dashboard/applications/jobs`; `/dashboard/jobs` dialihkan). Hasil berupa satu kolom widget: abu-abu, yang terbuka berwarna logo perusahaannya (dibaca lewat `/api/jobs/listings/<id>/logo`, karena host logo penyedia tidak mengirim header CORS). Mulai lebar 1280 px, detail tampil di kanan dan lowongan pertama terbuka otomatis; di layar lebih kecil detail terbuka sebagai sheet saat dipilih. Belum: screenshot panduan `searching-for-jobs` (results.webp, fit.webp) masih tata letak lama, buat ulang setelah desain disetujui.

## Riwayat pencarian 2026-11-20 (pemilik: Opsi A)

Dibuat: tabel `job_search_recent` (maks 10 per akun, satu baris per pencarian yang dinormalisasi, dicatat setelah halaman pertama berhasil; "load more" tidak), oRPC `jobs.recent` / `jobs.forgetRecent` / `jobs.clearRecent`, MCP `api_jobs_recent` / `api_jobs_forget_recent` / `api_jobs_clear_recent`. Halaman Jobs tanpa `q`: pencarian terakhir dibuka lagi (replace) hanya bila halaman pertamanya sudah dibuka hari ini (gratis); selain itu widget **Recent job searches** dengan lencana "Free today" / "Uses 1 search", hapus per baris dan Clear; peran dari preferensi di bawahnya. Di atas hasil ada tombol **Recent searches** (popover, muncul bila ada ≥2). Tombol Filters menyebut tempat ("Filters · Indonesia (2)").

Belum / catatan:

- **Opsi B (snapshot gratis)** belum: membuka riwayat lama dihitung satu pencarian. Bisa ditambah dengan menyimpan `listing_ids` per baris.
- `remote: "exclude"` (hanya lewat API/MCP) tidak bisa ditampilkan di halaman; dibuka dari riwayat menjadi "On-site, hybrid or remote", jadi dihitung pencarian baru.
- "Free today" dibaca dari penghitung bersama (`seen:` per hari akun); bila penghitung bersama gagal dan jatuh ke memori proses, lencana bisa keliru "Uses 1 search" walau server tetap tidak menghitung dua kali.
- Screenshot panduan `searching-for-jobs` belum dibuat ulang.

## Penghematan lanjutan 2026-11-26 (setelah paket hemat, `02-teknis.md` 22)

- **Cari dulu di database sendiri.** Semua lowongan yang sudah dibayar ada di `job_listing` sampai 30 hari. Bila stok lokal yang cocok (judul, negara, umur posting, belum tutup) cukup untuk satu halaman, jawab dari sana dengan $0. Penghematan terbesar seiring jumlah pengguna. JobsPipe sudah mengizinkan simpan 30 hari; **ketentuan Hirebase perlu dicek dulu**.
- **Sinonim kata kunci** (HR = Human Resources, SWE = software engineer): ukur dulu dengan `*.count` gratis bahwa hasilnya setara sebelum disatukan dalam kunci cache.
- **Kuota per paket vs biaya.** Dengan ±$0,015–0,03 per halaman, pemakaian penuh: Free 3/hari ±$1–2,6 per bulan tanpa pemasukan, Plus 15/hari ±$7–13 (harga $4,99), Pro AI 40/hari ±$18–35 ($9,99). Pilihan: turunkan batas, Free hanya hasil simpanan setelah pencarian pertama, atau batas biaya per akun dalam dolar. Keputusan pemilik.
- **Notifikasi lowongan** masih meminta 20 per penyedia per cek (`ALERT_PAGE_SIZE`); Pro AI bisa 10 notifikasi. Pertimbangkan 10.
- Pantau **Cost per results page** dan persentase "tampil dari yang dibayar" di dasbor setelah deploy; bila persentase rendah, cari filter mana yang membuang (negara, level, gaji).
