# Phase 11 — Coach dan asisten AI

| Dikerjakan | Ukuran | Bergantung pada | Perlu dari pemilik |
| ---------- | ------ | --------------- | ------------------ |
| Claude     | Sedang | Phase 03        | —                  |

## Untuk pemilik

**Apa yang dibuat:** Coach bisa dibuka dari tombol di bar atas pada tab mana pun (lembar yang bisa dibesarkan ke layar penuh), dan asisten AI di pembuat CV dan surat mendapat tampilan percakapan baru.

**Prompt:** `Kerjakan Phase 11 dari .agents/docs/plans/mobile/README.md`

**Yang bisa kamu cek di akhir:** bertanya ke Coach dari Home, meminta asisten memperbaiki satu bagian CV lalu menerima atau menolak usulannya, di iPhone dan Android.

## Untuk agent

### Langkah

1. **Pindahkan logika** (`02-teknis.md` bagian 5): usulan asisten (`proposals.ts`) dan transport chat ke paket; web dan app memakai yang sama.
2. **Satu komponen percakapan** (`src/features/assistant`): tulis ulang `chat-view.tsx` (922 baris; `Conversation` 411) menjadi daftar pesan (Legend List), komposer (lampiran, berhenti, lanjut), render markdown, kartu usulan (terima, tolak, urungkan), status streaming dan lanjut setelah putus (`agent.messages.{send,stop,resume,setEditStatus}`), lampiran (`agent.attachments.*`).
3. **Coach:** lembar dari TopBar di semua tab (slot dari Phase 03), tombol besarkan ke layar penuh, daftar percakapan (`agent.threads.*`); tablet: panel kanan.
4. **Asisten editor:** lembar di pembuat CV dan surat memakai komponen yang sama; usulan diterapkan ke draf sebagai satu langkah undo.
5. **Persetujuan AI** per operasi tetap di transport (`src/api/ai-consent.ts`); tampilan dialognya pindah ke `src/ui`. **Laporan konten AI** tetap ada di menu pesan.
6. **Kredit dan sumber AI:** tampilkan sumber (Rezumi AI atau koneksi sendiri) dan biaya kredit seperti web; kredit habis → pesan netral (K6).
7. Keyboard: komposer menempel di atas keyboard di dua platform; daftar tidak melompat saat pesan baru masuk.
8. Hapus `coach-screen.tsx` lama, tab Career, dan sisa grup `career`.

### Tes dan verifikasi

- Tes logika usulan di paket.
- Tes komponen: streaming, galat di tengah, usulan diterima/ditolak, persetujuan ditolak (tidak ada data terkirim).
- Maestro dengan stub AI lokal (pola `tests/e2e`): tanya Coach; usulan asisten → terima → undo.
- Daftar cek dua platform; pembaca layar membacakan pesan baru.

### Selesai bila

- Coach dan asisten setara web dan memakai satu komponen percakapan.
- Butir "Section menus and the coach panel" di "Feature parity exceptions" dihapus.
