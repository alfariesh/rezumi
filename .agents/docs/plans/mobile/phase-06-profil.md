# Phase 06 — Profil

| Dikerjakan | Ukuran | Bergantung pada | Perlu dari pemilik |
| ---------- | ------ | --------------- | ------------------ |
| Claude     | Sedang | Phase 05        | —                  |

## Untuk pemilik

**Apa yang dibuat:** tab **Profile**, satu sumber data untuk CV, surat, portofolio, dan AI: Details, Career, Facts, Stories, Preferences, dan "Bring what you have". Kata "Knowledge" hilang dari app.

**Prompt:** `Kerjakan Phase 06 dari .agents/docs/plans/mobile/README.md`

**Yang bisa kamu cek di akhir:** screenshot lima bagian Profil di iPhone dan Android; mengubah Profil di app lalu melihatnya berubah di web.

## Untuk agent

### Langkah

1. Baca `.agents/docs/plans/profil/README.md` dan web `apps/web/src/features/profile`.
2. **Pindahkan logika:** draf Profil dengan `expectedUpdatedAt` dan penanganan konflik (`features/profile/store.ts`) ke `@rezumi/resume/profile`; web memakai dari paket.
3. **Layar (`src/features/profile`)**, segmen di bawah judul: Details (identitas, kontak, foto lewat kamera/galeri), Career (bagian pengalaman, pendidikan, keahlian, dst. memakai komponen isian yang sama dengan Write; komponen isian ditulis di atas `src/ui` di phase ini dan dipakai ulang Phase 07), Facts (`career.facts/saveFact/updateFact/forgetFact`), Stories (`career.stories/saveStory/deleteStory`), Preferences (`career.profile/saveProfile`, termasuk wilayah pencarian), Bring what you have (komponen dari Phase 05), Fill from resume (`profile.fillFromResume`).
4. Simpan otomatis lewat `profile.update` dengan `expectedUpdatedAt`; konflik menampilkan lembar pilih versi (pola lembar konflik draf yang ada).
5. Ganti kata "Knowledge" di semua teks dan nama rute; `pnpm --filter mobile lingui:extract`.
6. Hapus `features/career/{knowledge,facts,stories,preferences}.tsx` lama dan rute `career/knowledge`.

### Tes dan verifikasi

- Tes logika draf Profil di paket (simpan, konflik, offline).
- Tes komponen tiap segmen dalam empat keadaan.
- Maestro: ubah nama dan satu pengalaman → tutup paksa → buka → tersimpan; ubah di web → app menyegarkan.
- Daftar cek dua platform; tablet: daftar dan detail berdampingan untuk Facts dan Stories.

### Selesai bila

- Profil setara web dan dipakai onboarding yang sama.
- Butir "Profile, the single source of data" di "Feature parity exceptions" tinggal bagian pembuat CV dan surat (Phase 07–08).
