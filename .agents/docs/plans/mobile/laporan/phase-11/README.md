# Laporan Phase 11 — Coach dan asisten AI

**25 November 2026 · 🟡 Implementasi selesai, verifikasi Android tertunda**

Branch `feat/mobile-11-coach-asisten` dibuka di worktree terpisah dari `origin/main`.

## Yang berubah

- Coach dibuka dari tombol kilau di bar atas. Lembar di ponsel bisa diperbesar tanpa memulai percakapan baru. Panel kanan iPad tetap terbuka ketika pindah bagian.
- Coach, ruang kerja lamaran, asisten CV, dan asisten surat berbagi komposer, daftar percakapan, Markdown, lampiran, pemulihan respons, dan menu laporan. Menerima satu atau beberapa usulan sekaligus menambah satu langkah undo di draf.
- Web dan mobile memakai transport serta pembacaan status usulan dari `@rezumi/ai`, dan penanda pratinjau dari `@rezumi/resume/proposals`. Dialog persetujuan tetap berlaku per operasi. Komposer menampilkan koneksi dan, jika Rezumi AI tersedia, biaya per balasan serta saldo.
- Uji visual menemukan komposer editor tertutup keyboard di iPhone dan panel Coach menimpa area status serta mempersempit kolom Home di iPad. Komposer diberi penyesuaian keyboard untuk lembar editor. Panel iPad mengikuti safe area dan konten bagian memakai lebar yang tersisa.

## Yang diuji

| Lingkungan             | Hasil                                                                                                                                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| iPhone 17, iOS 27.2    | Maestro `coach.yaml` dan `assistant-proposals.yaml` lulus dengan stub AI lokal. Coach dibuka dari Home dan diperbesar. Usulan CV diterima lalu diurungkan dari kartu.                              |
| iPhone 17, iOS 27.2    | Inggris terang dan Indonesia gelap. Riwayat Coach dan form laporan dibuka. Menolak persetujuan surat meninggalkan nol pesan tersimpan di server. Kirim ulang disetujui, lalu usulan surat ditolak. |
| iPad Air 11″, iOS 27.2 | Panel kanan dan riwayat Coach tampil. Balasan tetap terlihat saat pindah dari Home ke Documents.                                                                                                   |
| Otomatis               | Mobile 1.097 Jest dan 24 Node. Paket AI 12, resume 418, web 95. Typecheck mobile, web, AI dan resume, lint, format, serta boundaries lulus.                                                        |

Uji iOS memuat bundel Phase 11 ke build dev yang sudah tersedia. Phase ini tidak menambah modul native.

## Screenshot

- iPhone Inggris terang · [Coach diperbesar](ios-coach-en-light.png) · [Usulan CV](ios-asisten-cv-en-light.png) · [Komposer saat keyboard terbuka](ios-asisten-keyboard-en-light.png)
- iPhone Indonesia gelap · [Coach](ios-coach-id-dark.png) · [Usulan surat ditolak](ios-asisten-surat-id-dark.png) · [Persetujuan ditolak](ios-persetujuan-ditolak-id-dark.png) · [Form laporan](ios-laporan-ai-id-dark.png)
- iPad Inggris terang · [Coach di panel kanan](ipad-coach-en-light.png)

## Verifikasi yang tersisa

Android belum dicek, ditunda pemilik. Pengumuman VoiceOver dan TalkBack, unggahan berkas dari pemilih sistem, serta pemulihan saat jaringan terputus belum diuji langsung di simulator. Tes transport mencakup replay balasan yang terputus.
