# Chrome Web Store — isian draf

Item: `fiogmglhgeiaaeajahbpmmehgmojbjjo`. Isian ini untuk **draf**; jangan kirim untuk review sebelum Phase 07. Teks final dan
bagian privasi diperiksa lagi di Phase 06 (setelah Kebijakan Privasi punya bagian plugin).

Gambar ada di `gambar/`.

## Sebelum publikasi: Setelan akun

Dasbor → **Setelan** (Account) → isi **email kontak penayang** `hi@rezumi.app` → kirim email verifikasi → klik tautan di kotak masuk `hi@rezumi.app`.

## Tab "Store listing"

**Language:** English (tambahkan Indonesian lewat pemilih bahasa di kanan atas; nama dan ringkasan diambil otomatis dari
`_locales` di zip).

**Description (English):**

```text
Save job postings to your Rezumi application tracker in one click, and prepare each application without copying and pasting.

• One-click save on LinkedIn, Indeed, JobStreet and Glints, and from any other job page through the toolbar icon, the right-click menu or Alt+Shift+S.
• Review before saving: role, company, location, salary, description and requirements, all editable.
• "Saved" marks on postings you already saved, so the same job is never tracked twice. The check runs inside your browser.
• Update the status, add notes and set follow-up reminders from the side panel.
• See how well your resume matches the posting, with the keywords it is missing.
• Optional AI: read a posting with AI, an AI match score, tailor your resume or write a cover letter (uses Rezumi credits).

Privacy first: the extension reads a page only when you ask it to, sends nothing about the pages you browse, runs no trackers or analytics, and never clicks anything on job sites for you.

Free for every Rezumi plan. Requires a free Rezumi account (rezumi.app).
```

**Description (Indonesian):**

```text
Simpan lowongan ke pelacak lamaran Rezumi dengan satu klik, lalu siapkan lamarannya tanpa salin-tempel.

• Simpan satu klik di LinkedIn, Indeed, JobStreet, dan Glints, serta dari halaman loker lain lewat ikon toolbar, menu klik kanan, atau Alt+Shift+S.
• Periksa dulu sebelum menyimpan: posisi, perusahaan, lokasi, gaji, deskripsi, dan syarat, semuanya bisa diubah.
• Tanda "Tersimpan" di loker yang sudah kamu simpan, jadi loker yang sama tidak tercatat dua kali. Pengecekannya berjalan di dalam browsermu.
• Ubah status, tambah catatan, dan pasang pengingat tindak lanjut dari panel samping.
• Lihat seberapa cocok CV-mu dengan lowongan, lengkap dengan kata kunci yang belum ada.
• AI opsional: baca loker dengan AI, skor kecocokan AI, sesuaikan CV, atau tulis surat lamaran (memakai kredit Rezumi).

Privasi nomor satu: plugin membaca halaman hanya saat kamu minta, tidak mengirim apa pun tentang halaman yang kamu kunjungi, tanpa pelacak atau analitik, dan tidak pernah menekan tombol di situs loker atas namamu.

Gratis untuk semua paket Rezumi. Perlu akun Rezumi gratis (rezumi.app).
```

**Category:** Productivity → Workflow & Planning

**Graphic assets:**

| Kolom                      | File                                                                 |
| -------------------------- | -------------------------------------------------------------------- |
| Store icon (128×128)       | `gambar/ikon-toko-128x128.png`                                       |
| Screenshots (1280×800)     | `gambar/screenshot-en-1280x800.png` (Indonesian: `screenshot-id-…`)  |
| Small promo tile (440×280) | `gambar/promo-kecil-en-440x280.png` (Indonesian: `promo-kecil-id-…`) |
| Marquee promo tile         | kosongkan                                                            |

Screenshot sekarang hanya layar "Hubungkan ke Rezumi"; Phase 06 menggantinya dengan layar simpan, tersimpan, dan
kecocokan.

**Additional fields:**

- Official URL: kosongkan (butuh verifikasi domain di Search Console; bisa di Phase 06)
- Homepage URL: `https://rezumi.app`
- Support URL: `https://rezumi.app` (Chrome Web Store tidak menerima `mailto:`)
- Mature content: No

## Tab "Privacy"

**Single purpose description:**

```text
Save job postings from job sites to the user's Rezumi application tracker and help prepare those applications.
```

**Permission justification:**

| Izin            | Alasan                                                                                                                                       |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| sidePanel       | Shows the extension's interface (posting preview, save form, reminders) in the browser side panel.                                           |
| storage         | Keeps the sign-in token, the list of saved posting keys used for the local "Saved" mark, and unsaved form input.                             |
| identity        | Signs the user in to their Rezumi account with OAuth (launchWebAuthFlow), without copying API keys.                                          |
| activeTab       | Reads the current job page only when the user clicks the icon, uses the shortcut or the right-click menu on a site without its own reader.   |
| scripting       | Runs the posting reader in the active tab after such a click; no code is injected otherwise.                                                 |
| contextMenus    | Adds "Save selected text to Rezumi" for job pages the extension cannot read.                                                                 |
| alarms          | Refreshes the saved-postings list and follow-up reminders periodically.                                                                      |
| notifications   | Optional, asked only when the user turns on desktop reminders: shows at most one reminder per application per day for follow-ups they set.   |
| Host permission | LinkedIn, Indeed, JobStreet and Glints: shows the Save button and "Saved" mark on postings. rezumi.app: calls the user's own Rezumi account. |

**Are you using remote code?** No, I am not using remote code.

**Data usage** — centang:

- Personally identifiable information (nama dan email akun Rezumi saat masuk)
- Authentication information (token masuk)
- Website content (isi lowongan yang pengguna simpan)

Lalu centang ketiga pernyataan: tidak menjual data ke pihak ketiga; tidak memakai data untuk hal di luar tujuan tunggal;
tidak memakai data untuk menilai kelayakan kredit atau pinjaman.

**Privacy policy URL:** `https://docs.rezumi.app/legal/privacy-policy` (bagian plugin ditambahkan di Phase 06 sebelum review).

## Tab "Distribution"

- Payments: Free of charge
- Visibility: Public (baru berlaku saat dikirim untuk review; aman disetel sekarang)
- Regions: All regions

## Setelah disimpan

Package → **View public key** → salin dan kirim ke Claude bersama ID item Edge.
