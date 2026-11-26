# Keputusan — impor website ke Profil dan portfolio

Log keputusan pemilik. Agent tidak mengubah keputusan diam-diam (aturan README nomor 5); jawaban baru ditambahkan di bagian bawah.

## Disetujui pemilik (2026-11-26)

| ID  | Keputusan                                                                                                                                                                                                      | Catatan                                                                                                                                                                                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W1  | **Review dulu.** Works hasil impor tidak langsung masuk. Pengguna melihat daftar, semua sudah dicentang, lalu membuang yang salah. Portfolio tidak pernah dipublikasikan otomatis.                             | Sama dengan aturan sumber Profil lain: hasil sumber selalu draf untuk direview.                                                                                                                     |
| W2  | **Impor pertama gratis.** Impor website pertama yang berhasil di setiap akun tidak memotong kredit.                                                                                                            | "Berhasil" = ada data Profil atau minimal satu work. Gagal tidak menghabiskan jatah gratis.                                                                                                         |
| W3  | **Impor berikutnya: 5 kredit** (keputusan diserahkan ke Claude). Kredit kembali bila tidak ada yang ditemukan. Dengan AI milik pengguna sendiri: tanpa kredit.                                                 | Sekarang baca website = 2 kredit untuk 1 halaman. Versi baru membaca sampai 11 halaman dan dua panggilan AI.                                                                                        |
| W4  | **Maksimal 10 works per impor.**                                                                                                                                                                               | Paket Gratis hanya boleh 6 works di portfolio: daftar review tetap menampilkan sampai 10, tetapi pengguna Gratis hanya bisa mencentang sebanyak sisa kuotanya, dengan ajakan upgrade untuk sisanya. |
| W5  | **Gambar disalin ke penyimpanan Rezumi (R2) dan dihitung ke kuota penyimpanan portfolio pengguna** (Gratis 100 MB, berbayar 1 GB). Gambar diperkecil dulu.                                                     | Bila kuota habis, works tetap ditambahkan tanpa gambar dan pengguna diberi tahu. Tidak ada hotlink ke situs asli.                                                                                   |
| W6  | **Behance, Dribbble, dan platform lain yang memblokir bot menyusul di fase berikutnya** (lihat `backlog-lanjutan.md`). Fase pertama hanya untuk situs pribadi (domain sendiri, Framer, Webflow, Notion, dll.). | Bila pengguna mengetik alamat Behance/Dribbble/LinkedIn di kolom website, tampilkan pesan yang jelas.                                                                                               |
| W7  | **Cukup Cloudflare, tanpa Firecrawl.** Pembaca halaman yang sudah ada (baca langsung, lalu Cloudflare Browser Run bila halaman butuh JavaScript).                                                              | Tidak ada vendor baru, tidak ada perubahan pihak ketiga di kebijakan privasi.                                                                                                                       |

## Default yang ditetapkan Claude (boleh dikoreksi pemilik)

| ID  | Default                                                                                                                                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Pengguna wajib mencentang **"Ini situs saya sendiri"** sebelum works dan gambar diimpor (seperti LinkedIn). Tanpa centang, hanya data Profil yang dibaca seperti sekarang.         |
| D2  | Batas **3 impor website per akun per hari**. Halaman yang dibaca di dalam satu impor tidak menghabiskan jatah "20 halaman Browser Run per hari" milik fitur lain.                  |
| D3  | Works yang dipilih juga masuk ke **Profil sebagai Proyek** (judul, ringkasan, tanggal, link), jadi CV ikut terisi. Work di portfolio terhubung ke proyek itu (`fromResumeItemId`). |
| D4  | Bila akun belum punya portfolio, menyimpan works **membuat portfolio dalam keadaan belum tayang** (sumber: Profil). Pengguna yang memilih kapan mempublikasikan.                   |
| D5  | Per work maksimal **1 gambar sampul + 6 gambar galeri**.                                                                                                                           |

## Pertanyaan terbuka

Belum ada.
