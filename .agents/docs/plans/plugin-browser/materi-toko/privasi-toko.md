# Jawaban formulir privasi toko (disetujui pemilik 2026-11-16)

Untuk Chrome Web Store (tab Privacy) dan Edge Add-ons (Properties/Privacy). Setiap jawaban mengacu ke bagian "Browser
extension" di Kebijakan Privasi (`docs/legal/privacy-policy.mdx`, Indonesia: `kebijakan-privasi.mdx`) dan ke perilaku plugin
(`02-teknis.md` §20–21). Jangan menjawab lebih dari yang dilakukan plugin.

**URL Kebijakan Privasi:** `https://docs.rezumi.app/legal/privacy-policy` (pastikan alamat ini sudah memuat bagian plugin setelah
merge; Edge menerima URL yang sama). Versi Indonesia: `https://docs.rezumi.app/legal/kebijakan-privasi`.

## Penjelasan satu tujuan (single purpose)

```text
Save job postings from job sites to the user's Rezumi application tracker and help prepare those applications.
```

Fitur lain (skor kecocokan, pengingat, tombol Sesuaikan CV dan Tulis surat lamaran) adalah bagian dari persiapan lamaran yang
sama, bukan tujuan terpisah.

## Chrome: apakah memakai kode jarak jauh?

**No, I am not using remote code.**

## Chrome: jenis data yang dikumpulkan

Centang:

| Kategori Chrome                     | Mengapa                                                                                                               |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Personally identifiable information | Nama dan email akun Rezumi yang tampil di panel setelah masuk; kontak HR (email/telepon) bila pengguna mencentangnya. |
| Authentication information          | Token masuk (OAuth) milik pengguna.                                                                                   |
| Website content                     | Teks, judul, dan alamat halaman loker yang pengguna minta dibaca dan simpan.                                          |

Tidak dicentang: Health information, Financial and payment information, Personal communications, Location, Web history, User
activity. Catatan: plugin **tidak** membaca riwayat; alamat halaman di LinkedIn, Indeed, JobStreet, dan Glints hanya dicocokkan di
dalam browser dan tidak dikirim, sehingga bukan "Web history". Posisi dan lokasi kerja dalam lowongan adalah isi situs, bukan lokasi
pengguna.

## Chrome: pernyataan wajib (centang ketiganya)

- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

"Approved use cases" mencakup pengiriman teks lowongan ke server Rezumi untuk fitur inti, dan (hanya bila pengguna menyalakan AI)
ke penyedia AI yang tertulis di Kebijakan Privasi.

## Pernyataan Limited Use (ditulis juga di Kebijakan Privasi)

Use of information received from browser APIs adheres to the Chrome Web Store User Data Policy, including the Limited Use
requirements: data is used only for the extension's single purpose, not transferred to third parties beyond what that feature
needs, not read by people except for support requests, security or legal reasons, and not used for advertising.

## Edge Add-ons: formulir privasi

- **Menyimpan atau mengirim data pribadi?** Ya: isi lowongan yang dibaca atas permintaan pengguna dikirim ke server Rezumi dan
  disimpan di akun pengguna hanya setelah pengguna menyimpan; token masuk disimpan di browser.
- **Kebijakan Privasi:** URL di atas.
- **Pengumpulan di luar tujuan, iklan, pelacak:** tidak ada.
- **Catatan untuk penguji (Notes for certification):** lihat bagian di bawah.

## Catatan untuk penguji (Chrome "Test instructions" dan Edge "Notes for certification")

```text
The extension needs a free Rezumi account; no credentials are shared, please create your own.

1. Install the extension, click its icon, then "Connect to Rezumi". A Rezumi window opens: sign up for a free account at rezumi.app (any email), or sign in, then click "Allow access".
2. Open any job posting on LinkedIn, Indeed, JobStreet or Glints (or any other page with a job description). A "Save to Rezumi" button appears next to the site's own buttons on those four sites; on other sites click the toolbar icon.
3. The side panel shows the posting's role, company, location and description. Click "Save to Rezumi". The job appears under Applications at rezumi.app, and the button turns into a "Saved" mark.
4. Optional: set a follow-up date, open Settings (gear icon) to change language, turn the on-page button off, or sign out.

The extension reads a page only when you open its panel, click Save, use the right-click menu or the keyboard shortcut (Alt+Shift+S). It sends no browsing data, and never clicks anything on job sites. Host permissions cover only the four job sites and rezumi.app; every other site is read through activeTab after a click.
```

## Email dukungan

`hi@rezumi.app` (aturan turunan #12). Chrome tidak menerima `mailto:` di kolom Support URL: pakai `https://rezumi.app`.
