# Draf teks privasi: sumber Profil (onboarding)

Ditulis 2026-11-13 oleh sesi web untuk disetujui owner. **Belum dipasang**: `docs/legal/*` tidak diubah. Setelah disetujui, principal (atau sesi berikutnya) memasukkan potongan di bawah ke `docs/legal/privacy-policy.mdx` dan `docs/legal/kebijakan-privasi.mdx`, di tempat yang disebut.

Yang perlu owner periksa sebelum memasang (tandai `[periksa]`):

1. Nama badan hukum dan negara Apify: tertulis Apify Technologies s.r.o., Republik Ceko. Cocokkan dengan akun Apify yang dipakai dan perjanjian pemrosesan datanya (DPA).
2. Berapa lama Apify menyimpan hasil run (dataset dan log). Server meminta hasil langsung (`run-sync-get-dataset-items`) dan tidak menyimpan apa pun, tetapi Apify sendiri menyimpan run untuk sementara sesuai paket akun. Isi angka hari dari pengaturan akun Apify, atau atur retensi seminimal mungkin.
3. Aktor LinkedIn (`harvestapi~linkedin-profile-scraper`) dibuat pihak ketiga (HarvestAPI) di Apify Store. Pastikan ketentuan aktor itu tidak menyimpan atau memakai data di luar run.
4. Situs pribadi dibaca oleh penyedia AI yang sudah tercantum (Rezumi AI: Anthropic, atau koneksi AI milik user). Tidak perlu penerima baru, cukup kalimat di bagian AI.

## English (`docs/legal/privacy-policy.mdx`)

### Add a row to "Data, purposes and legal bases"

| Data                                                                                                                                    | Purpose                                            | Basis                 |
| --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | --------------------- |
| A LinkedIn profile address, GitHub username or personal website address you enter, what is read from it, and a photo you choose to keep | Filling your Profile when you ask, for your review | User request/contract |

### Add to "Recipients" (after "AI providers")

- **Profile sources, only when you ask:** when you set up or fill your Profile, you can add a LinkedIn profile link, a GitHub
  username or a personal website. Nothing is read until you select Continue, and nothing goes into your Profile until you
  check it and save.
  - **Apify (Apify Technologies s.r.o., Czech Republic) [periksa]:** reads the public LinkedIn profile you link to, which
    you confirm is your own, on Rezumi's behalf. Rezumi sends only the profile's public identifier; it never asks for email
    addresses. Apify keeps run results for a short time under its terms [periksa: N days]. Each account can do this three times a day.
  - **GitHub (GitHub, Inc., United States):** Rezumi reads the public profile and public repositories of the username you
    enter, through GitHub's API. If you signed in with GitHub, Rezumi uses that sign-in to make the request.
  - **Personal websites:** the page is fetched from its own server and read by the AI provider you chose (see AI providers).
  - Rezumi does not store or log what a source returns. Only what you keep at review is saved, in your Profile. A photo you
    keep is copied into your account's private uploads; the original stays where it was.

### Add to "Processing locations" (in "Security, incidents and international transfers")

Add "the Czech Republic (Apify)" and "the United States (GitHub)" to the list of processing locations, used only when you
add those sources.

## Bahasa Indonesia (`docs/legal/kebijakan-privasi.mdx`)

### Tambahkan baris di "Data, tujuan, dan dasar hukum"

| Data                                                                                                                                                 | Tujuan                                                       | Dasar                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------- |
| Alamat profil LinkedIn, username GitHub, atau alamat situs pribadi yang Anda isi, isi yang dibaca dari sana, dan foto yang Anda pilih untuk disimpan | Mengisi Profil Anda atas permintaan Anda, untuk Anda periksa | Permintaan pengguna/kontrak |

### Tambahkan di "Penerima" (setelah "Penyedia AI")

- **Sumber Profil, hanya bila Anda minta:** saat menyiapkan atau mengisi Profil, Anda bisa menambahkan link profil LinkedIn,
  username GitHub, atau situs pribadi. Tidak ada yang dibaca sebelum Anda menekan Lanjutkan, dan tidak ada yang masuk ke
  Profil sebelum Anda memeriksa dan menyimpannya.
  - **Apify (Apify Technologies s.r.o., Republik Ceko) [periksa]:** membaca profil LinkedIn publik yang Anda tautkan, yang
    Anda nyatakan sebagai milik Anda sendiri, atas nama Rezumi. Rezumi hanya mengirim pengenal publik profil itu dan tidak
    pernah meminta alamat email. Apify menyimpan hasil pembacaan untuk sementara sesuai ketentuannya [periksa: N hari]. Tiap
    akun bisa melakukannya tiga kali sehari.
  - **GitHub (GitHub, Inc., Amerika Serikat):** Rezumi membaca profil publik dan repositori publik dari username yang Anda
    isi, lewat API GitHub. Bila Anda login dengan GitHub, Rezumi memakai login itu untuk permintaannya.
  - **Situs pribadi:** halaman diambil dari servernya sendiri lalu dibaca oleh penyedia AI yang Anda pilih (lihat Penyedia AI).
  - Rezumi tidak menyimpan atau mencatat di log apa yang dikembalikan sumber. Hanya yang Anda pertahankan saat memeriksa yang
    disimpan, di Profil Anda. Foto yang Anda pilih disalin ke unggahan pribadi akun Anda; aslinya tetap di tempatnya.

### Tambahkan di "Lokasi pemrosesan" (bagian "Keamanan, insiden, dan transfer internasional")

Tambahkan "Republik Ceko (Apify)" dan "Amerika Serikat (GitHub)" ke daftar lokasi pemrosesan, hanya dipakai bila Anda
menambahkan sumber tersebut.

## Teks yang sudah tampil di aplikasi

Di layar "Bring what you have" (onboarding dan dialog di halaman Profil), di bawah kolom sumber:

- EN: "We only read what you add here, once you continue: LinkedIn profiles through Apify, GitHub accounts through GitHub, websites with AI. Nothing goes into your Profile until you check it."
- ID: "Kami hanya membaca yang Anda tambahkan di sini, setelah Anda lanjut: profil LinkedIn lewat Apify, akun GitHub lewat GitHub, situs dengan AI. Tidak ada yang masuk ke Profil sebelum Anda memeriksanya."

Tanpa LinkedIn (tidak ada `APIFY_TOKEN`), kalimatnya tidak menyebut Apify. Bila owner mengubah draf di atas, sesuaikan juga kalimat ini (`apps/web/src/features/profile/sources/source-fields.tsx`, `SourcesNote`).
