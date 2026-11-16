# Alasan izin — untuk formulir review (disetujui pemilik 2026-11-16)

Sumber kebenaran: `apps/extension/manifest.config.ts` dan `02-teknis.md` §12. Tes `src/manifest.test.ts` menjaga daftar ini
tetap sama dengan manifest. Teks Inggris dipakai di formulir Chrome dan Edge; Indonesia untuk pemilik.

## Izin

| Izin                       | Alasan (EN, tempel di formulir)                                                                                                                | Alasan (ID)                                                                                                                                                      |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sidePanel`                | Shows the extension's interface (posting preview, save form, reminders) in the browser side panel.                                             | Menampilkan antarmuka plugin (pratinjau, form simpan, pengingat) di panel samping browser.                                                                       |
| `storage`                  | Keeps the sign-in token, the list of saved posting keys used for the local "Saved" mark, settings and unsaved form input.                      | Menyimpan token masuk, daftar kunci loker tersimpan untuk tanda "Tersimpan" lokal, pengaturan, dan isian belum simpan.                                           |
| `identity`                 | Signs the user in to their Rezumi account with OAuth (launchWebAuthFlow), without copying API keys.                                            | Masuk ke akun Rezumi lewat OAuth (launchWebAuthFlow), tanpa menyalin kunci API.                                                                                  |
| `activeTab`                | Reads the current job page only when the user clicks the icon, uses the shortcut or the right-click menu on a site without its own reader.     | Membaca halaman loker saat ini hanya ketika pengguna mengklik ikon, memakai pintasan, atau menu klik kanan di situs tanpa pembaca khusus.                        |
| `scripting`                | Runs the posting reader in the active tab after such a click; no code is injected otherwise.                                                   | Menjalankan pembaca loker di tab aktif setelah klik tersebut; tidak ada kode disuntik di luar itu.                                                               |
| `contextMenus`             | Adds "Save selected text to Rezumi" for job pages the extension cannot read.                                                                   | Menambah "Simpan teks terpilih ke Rezumi" untuk halaman loker yang tidak terbaca.                                                                                |
| `alarms`                   | Refreshes the saved-postings list and the follow-up reminders periodically (every 30 and 60 minutes) and schedules the 9:00 reminder.          | Menyegarkan daftar loker tersimpan dan pengingat secara berkala (30 dan 60 menit) dan menjadwalkan pengingat pukul 09.00.                                        |
| `notifications` (opsional) | Optional. Asked only when the user turns on desktop reminders: shows at most one reminder per application per day for follow-ups the user set. | Opsional. Hanya diminta saat pengguna menyalakan pengingat desktop: paling banyak satu notifikasi per lamaran per hari untuk tindak lanjut yang diatur pengguna. |

## Izin host (formulir Chrome: "Host permission justification")

| Pola                                                                                                      | Alasan (EN)                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `https://*.linkedin.com/*`, `https://*.indeed.com/*`, `https://*.jobstreet.com/*`, `https://glints.com/*` | A content script runs on these four job sites to show the "Save to Rezumi" button and the "Saved" mark, and to read the open job posting when the user asks. Between requests it looks only at the page address, inside the browser, to know which posting is open; it reads no other page content and sends nothing. Subdomains are needed because these sites serve postings from country hosts (id.linkedin.com, id.indeed.com, id.jobstreet.com). |
| `https://rezumi.app/*`                                                                                    | Calls the user's own Rezumi account (the API the extension saves jobs to). Authenticated with the user's token only.                                                                                                                                                                                                                                                                                                                                  |

Pola `*.linkedin.com` itu luas karena LinkedIn menyajikan lowongan dari host negara. Tidak ada `<all_urls>`, `tabs`, `history`,
`webNavigation`, `externally_connectable`, atau `web_accessible_resources` (dijaga tes manifest). Situs lain hanya dibaca lewat
`activeTab` setelah klik pengguna.

## Kode jarak jauh

Tidak ada. Semua kode ada di paket; tanpa `eval`, tanpa skrip dari luar, CSP bawaan Manifest V3.
