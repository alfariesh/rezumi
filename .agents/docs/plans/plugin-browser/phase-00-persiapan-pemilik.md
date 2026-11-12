# Phase 00 — Persiapan pemilik: akun toko

| Dikerjakan               | Ukuran | Bergantung pada | Perlu dari pemilik                                     |
| ------------------------ | ------ | --------------- | ------------------------------------------------------ |
| Pemilik + Claude memandu | Kecil  | —               | ±45 menit, kartu untuk US$5, akun Google dan Microsoft |

Phase ini boleh dikerjakan bersamaan dengan Phase 01. Yang dibutuhkan Phase 01 dari sini hanya akun toko yang sudah aktif, dan itu baru dipakai di akhir Phase 01.

## Untuk pemilik

**Apa yang disiapkan:** akun penerbit di dua toko plugin, nama plugin, dan email dukungan. Tidak ada kode.

**Langkah:**

1. **Chrome Web Store** (bayar sekali US$5):
   1. Buka [chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole) dan masuk dengan akun Google yang akan dipakai untuk bisnis Rezumi (sebaiknya bukan akun pribadi sehari-hari, dan dengan verifikasi 2 langkah menyala).
   2. Setujui perjanjian pengembang, lalu bayar biaya pendaftaran US$5.
   3. Di **Account**: isi nama penerbit `Rezumi`, email kontak, lalu verifikasi email. Bila diminta verifikasi identitas atau alamat, ikuti langkah di layar.
2. **Microsoft Edge Add-ons** (gratis):
   1. Buka [partner.microsoft.com/dashboard/microsoftedge](https://partner.microsoft.com/dashboard/microsoftedge) dan masuk dengan akun Microsoft.
   2. Daftar ke program **Microsoft Edge** dan isi profil penerbit (nama `Rezumi`, email kontak).
3. Jawab di chat dua keputusan ini (usulan ada di `00-keputusan.md` bagian 7):
   - **#1 Nama di toko:** "Rezumi: Simpan Loker & Lacak Lamaran" (Indonesia) dan "Rezumi – Save Jobs & Track Applications" (Inggris), atau usulmu sendiri.
   - **#12 Email dukungan:** `hi@rezumi.app`?

**Jangan kirim** password, kode verifikasi, atau data kartu di chat. Belum perlu membuat item plugin; itu dilakukan di akhir Phase 01 setelah Claude menyiapkan file zip.

**Prompt:** `Bantu saya mengerjakan Phase 00 dari .agents/docs/plans/plugin-browser/README.md`

**Yang bisa kamu cek di akhir:** dua dasbor toko bisa dibuka dan menampilkan "belum ada item".

## Untuk agent

### Langkah

1. Pandu pemilik langkah demi langkah sesuai bagian di atas. Bila tampilan dasbor sudah berubah, cari panduan resmi terbaru (Chrome: "Register your developer account"; Edge: "Register as a Microsoft Edge extension developer") dan sesuaikan langkahnya.
2. Jangan membuka, mengisi, atau mengirim formulir pembayaran, identitas, atau perjanjian atas nama pemilik.
3. Catat jawaban aturan turunan #1 dan #12 di `00-keputusan.md` (tabel bagian 7 dan log keputusan).
4. Perbarui status Phase 00 dan "Catatan sesi" di README.

### Selesai bila

- Kedua akun toko aktif (dikonfirmasi pemilik).
- Aturan turunan #1 dan #12 tercatat.
