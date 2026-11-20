# Phase 10 — Lamaran dan ruang kerja lamaran

| Dikerjakan | Ukuran               | Bergantung pada | Perlu dari pemilik |
| ---------- | -------------------- | --------------- | ------------------ |
| Claude     | Besar (2 sesi wajar) | Phase 09        | —                  |

## Untuk pemilik

**Apa yang dibuat:** pelacak lamaran dengan tampilan baru: List, Board, Calendar, Insights, Offers (pindah ke bawah Lamaran), detail lamaran, dan ruang kerja tujuh bagian termasuk latihan wawancara dengan suara. Penanda "Posting closed" ikut tampil.

**Prompt:** `Kerjakan Phase 10 dari .agents/docs/plans/mobile/README.md`

**Yang bisa kamu cek di akhir:** memindahkan lamaran antar tahap di Board, menjadwalkan wawancara di kalender, dan mencoba latihan wawancara di iPhone dan Android.

## Untuk agent

Urutan disarankan: (a) logika ke paket, (b) List + detail, (c) Board + Calendar + Insights + Offers, (d) ruang kerja.

### Langkah

1. **Pindahkan logika** (`02-teknis.md` bagian 5): insights, ICS, langkah berikutnya, wawancara, perbandingan tawaran termasuk `dateOnlyDeadline`/`isDateOnly` (memperbaiki bug mundur sehari); hapus salinan di app; web memakai paket.
2. **List dan detail:** daftar dengan cari, filter tahap, geser baris, pilih banyak; lembar "Simpan lowongan" (tempel tautan → `applications.ai.parsePosting`, isi manual); lembar detail: catatan, kontak, wawancara, berkas, penanda **Posting closed** (`postingClosedAt`). Tanpa CSV (D6).
3. **Board:** satu kolom per layar di ponsel dengan geser antar tahap dan seret kartu; tablet: semua kolom. Tulis ulang `Board` (333 baris) menjadi komponen kecil. Setiap seret punya jalur menu ("Pindah ke…") untuk aksesibilitas.
4. **Calendar:** hari/minggu dengan jadwal ulang lewat seret; bandingkan Pro `agenda` dengan kalender yang ada dan pilih satu (catat alasannya). Pengingat perangkat (`features/reminders`) mengikuti perubahan.
5. **Insights:** grafik dengan komponen Pro (Skia). **Offers:** daftar dan perbandingan, di bawah Applications.
6. **Ruang kerja (`src/features/workspace`):** Fit, Apply, Prepare, Practice, Debrief, Messages, Saved sebagai segmen. Tulis ulang `practise.tsx` (`Session` 401 baris) menjadi mesin keadaan + komponen kecil; rekam suara dengan `expo-audio`, izin mikrofon lewat penjelasan Phase 05; `career.voice.*`. Prosedur lain: `career.{workspace,saveWorkspace,generate,applyReply,submitApplication,savedItems}`, `applications.ai.{autofill,matchScore,draftMessage,tailorResume}`.
7. Hapus `features/{applications,applications-board,application-detail,workspace}` lama dan `career/offers.tsx`.

### Tes dan verifikasi

- Tes logika di paket (pindahan + kasus tanggal saja di zona barat UTC).
- Tes komponen: kartu, kolom, lembar detail, sesi latihan (mesin keadaan dengan perekam tiruan).
- Maestro di dua platform: simpan lowongan dari tautan → pindah tahap → jadwalkan wawancara → pengingat terjadwal; latihan singkat dengan izin mikrofon ditolak lalu diberi.
- Daftar cek dua platform; VoiceOver/TalkBack untuk aksi pindah tahap dan jadwal ulang.

### Selesai bila

- Lamaran dan ruang kerja setara web (kecuali CSV) di dua platform.
- Tidak ada lagi salinan logika lamaran di app.
- Butir Offers, posting closed, dan tanggal tawaran di "Feature parity exceptions" dihapus.
