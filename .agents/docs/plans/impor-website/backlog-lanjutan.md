# Ide setelah rilis

Tidak dikerjakan di Phase 01–04. Pemilik memilih kapan.

- **Behance dan Dribbble (W6).** Keduanya memblokir bot. Jalur seperti LinkedIn: treg dulu (cari tool lewat katalog treg), Apify sebagai cadangan, harga per profil dicek dari katalog. Karya Behance kaya gambar: perhatikan kuota penyimpanan.
- **GitHub → works.** Sumber GitHub sudah mengisi proyek Profil dari repositori terbaik. Bisa ditawarkan juga sebagai works (README sebagai teks, gambar dari README, link demo).
- **MCP:** tool `import_works_from_website` di `packages/mcp` memakai prosedur yang sama (dengan review di sisi asisten).
- **Cloudflare Browser Run `/crawl`** bila penemuan halaman sendiri sering melewatkan karya (situs SPA tanpa link biasa).
- **Sinkron ulang:** "Perbarui dari situs" untuk work yang diimpor (bandingkan, tawarkan perubahan).
- **Metrik admin:** jumlah impor, rasio berhasil, rata-rata karya, biaya AI per impor di halaman admin yang ada.
- **Antrean latar belakang** (Cloudflare Workflows/Queue) bila pengukuran menunjukkan impor terlalu lama untuk satu request.
