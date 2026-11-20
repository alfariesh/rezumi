# Phase 05 — Onboarding dan pengalaman pertama

| Dikerjakan              | Ukuran | Bergantung pada | Perlu dari pemilik |
| ----------------------- | ------ | --------------- | ------------------ |
| Claude + review pemilik | Sedang | Phase 04        | Melihat screenshot |

## Untuk pemilik

**Apa yang dibuat:** tiga layar perkenalan saat app pertama dibuka, lalu setelah daftar: bawa data (LinkedIn, GitHub, situs, atau file CV), dua pertanyaan singkat, tinjau, pilih template, dan CV pertama langsung terbuka. Sama dengan onboarding web.

**Prompt:** `Kerjakan Phase 05 dari .agents/docs/plans/mobile/README.md`

**Yang bisa kamu cek di akhir:** rekaman layar alur dari buka app sampai CV pertama, di iPhone dan Android.

## Untuk agent

### Langkah

1. Baca `.agents/docs/plans/profil/onboarding.md` dan kode web `apps/web/src/features/onboarding`, `features/profile/sources`.
2. **Pindahkan logika** (`02-teknis.md` bagian 5): `nextStep`/`previousStep`, `needsOnboarding`, model dan alur sumber (`model`, `use-sources-flow`, `use-source-runs` → bagian murninya) ke paket; web memakai dari paket; tes ikut pindah.
3. **Perkenalan** (sebelum masuk): tiga layar dengan ilustrasi dari layar app sungguhan, tombol Skip, titik penunjuk; hanya sekali per pemasangan.
4. **Onboarding** (setelah masuk, bila `needsOnboarding`): langkah Bring what you have (`profile.sources.linkedin/github/website`, file lewat `expo-document-picker` → `ai.parsePdf`/`parseDocx` atau `resume.import` sesuai web; butuh persetujuan AI seperti biasa), progres berjalan dengan status per sumber, Preferences (peran, lokasi/negara → `career.saveProfile`), Review (edit cepat, `profile.update`), Template (galeri dari `templateLineup`) → `resume.create` dengan `template` → pembuat CV. Bisa dilanjutkan bila app ditutup di tengah; bisa dilewati kapan saja.
5. **Foto profil** dari sumber: `profile.sources.adoptPhoto` seperti web.
6. **Keadaan pertama kali** di Home dan Documents untuk yang melewati onboarding.
7. **Izin:** satu komponen "penjelasan sebelum izin" di `src/ui` (notifikasi, kamera, foto, mikrofon), dipakai saat fitur pertama kali butuh. Tidak ada dialog izin saat app dibuka.
8. Kredit dan kuota: tampilkan dengan cara yang sama dengan web bila langkah memakai kredit AI; tanpa ajakan membeli (K6).

### Tes dan verifikasi

- Tes logika di paket (langkah, `needsOnboarding`).
- Tes komponen tiap langkah: sukses, sumber gagal, tanpa jaringan, dilewati.
- Maestro di dua platform: akun baru → onboarding dengan file → CV pertama; akun baru → lewati → Home kosong; akun lama → langsung Home.
- Daftar cek dua platform.

### Selesai bila

- Akun baru sampai ke CV pertama dalam satu alur tanpa jalan buntu, di dua platform.
- Butir "First-run onboarding" di "Feature parity exceptions" dihapus.
