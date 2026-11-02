# Draf panduan pengguna: Rezumi AI dan kredit

Dibuat di Phase 05 (2026-11-02). **Jangan terbitkan sebelum go-live** (Phase 11): selama `BILLING_MODE=off`, pengguna tidak melihat Rezumi AI, jadi panduan publik di `docs/` belum boleh menyebutnya. Saat go-live, salin teks di bawah ke halaman yang disebut, sesuaikan dengan UI saat itu (cek label di kode), dan buat screenshot baru dengan data fiktif (aturan `docs/contributing/career-platform.mdx` → **Keep product guides current**).

Panduan di `docs/` berbahasa Inggris, jadi teks siap tempel di bawah juga berbahasa Inggris. Harga tidak ditulis di panduan; tunjuk halaman Paket.

## 1. `docs/guides/using-ai.mdx` (halaman utama)

Ganti judul menjadi "Using AI in Rezumi" dan paragraf pembuka dengan:

```mdx
Rezumi's AI features (the assistant, AI imports, drafting, tailoring and the career coach) run on one of two sources:

- **Rezumi AI**: no API key needed. Each action shows its cost in credits before it runs, and credits come back when an action fails. You get 5 trial credits the first time you use it (verified email required), and Pro AI adds 100 credits with each purchase.
- **Your own AI connection**: connect a provider such as OpenAI, Anthropic or Google Gemini with your own key. You pay the provider directly and no credits are used.

Everything else in the app works without AI.
```

Tambahkan bagian baru sebelum "Add a provider":

```mdx
## Rezumi AI and credits

Next to each AI button, a small label shows where the action runs and what it costs, for example **Rezumi AI · 4 credits**. Select it to switch between Rezumi AI and your own connection; the choice applies to every AI action in this browser. The default connection in **Settings → AI providers** decides when you haven't chosen.

| Action                                                                        | Credits |
| ----------------------------------------------------------------------------- | ------: |
| Improve one line, fill an application from a posting, read a job posting      |       1 |
| Draft a form answer or a recruiter reply                                      |       2 |
| Draft a cover letter, interview practice feedback, preparation brief, debrief |       3 |
| One Coach or assistant reply                                                  |       3 |
| Writing review, job match score, fit check                                    |       4 |
| Tailor a resume, import a PDF or Word file with AI                            |       5 |

- Credits are used only when the action gives a result. If it fails, times out or you stop it, they come back.
- Each assistant or Coach reply costs one turn, including the reply after you answer its question or approve saving a story.
- Credits expire with the pass they came with (trial credits after 14 days) and the soonest-expiring credits are used first. See [Plans](/guides/plans) for your balance and history.
- Voice practice, scheduled preparation and web search in the assistant run only on your own connection.
- If you don't have enough credits, Rezumi offers your own connection instead. Nothing runs and nothing is charged.
```

Catatan: halaman `/guides/plans` belum ada; buat di Phase 07 atau ganti tautan ke halaman Paket yang ada saat itu. Hapus paragraf "On a self-hosted instance…" (self-host tidak berlaku lagi).

## 2. Halaman fitur (satu kalimat per halaman)

Tambahkan kalimat ini di dekat langkah yang menjalankan AI:

| Halaman                                                                                                                   | Kalimat                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `using-the-assistant.mdx`                                                                                                 | "On Rezumi AI, each reply costs 3 credits; the cost shows under the message box. A conversation keeps the source it started with until you switch the model." |
| `writing-a-cover-letter.mdx`                                                                                              | "On Rezumi AI, a draft (or a Shorter / More personal revision) costs 3 credits, used only when the draft finishes."                                           |
| `importing-resumes.mdx`                                                                                                   | "PDF and Word files are read with the AI shown under **Import a resume**; on Rezumi AI an import costs 5 credits. Importing a PDF without AI stays free."     |
| `tailoring-a-resume-for-a-job.mdx`                                                                                        | "On Rezumi AI, tailoring costs 5 credits."                                                                                                                    |
| `checking-your-resume.mdx`                                                                                                | "The writing review costs 4 credits on Rezumi AI; the checks and the score are always free."                                                                  |
| `adding-an-application.mdx`                                                                                               | "Reading a posting costs 1 credit on Rezumi AI. With Rezumi AI, pasting a description doesn't fill the fields by itself: select **Fill fields**."             |
| `checking-job-fit.mdx`, `career-workspace-reference.mdx`, `preparing-for-interview-day.mdx`, `replying-to-recruiters.mdx` | "Each tab's AI button shows its cost on Rezumi AI: fit check 4, briefing, practice feedback or debrief 3, reply or answer draft 2."                           |
| `finding-roles-automatically.mdx`                                                                                         | "Scheduled preparation runs on your own AI connection only."                                                                                                  |
| `editing-on-mobile.mdx`                                                                                                   | "On Android, the confirmation before each AI action names its Rezumi AI cost and your balance. The iOS app uses your own AI connection."                      |

## 3. Halaman API dan MCP

`using-the-api.mdx`, `using-the-mcp-server.mdx`, `managing-applications-with-mcp.mdx`, `ai-agent-tools.mdx`:

```mdx
AI procedures and tools take an optional `aiSource`: `"rezumi"` runs on Rezumi AI and uses the account's credits (each tool's description gives its cost), `"own"` uses one of the account's own AI connections. Without `aiSource`, requests use your own connection; if Rezumi AI is the only one, they fail with `AI_SOURCE_REQUIRED` instead of using credits. Send a new `idempotencyKey` (any unique string up to 100 characters) per action and reuse it when retrying, so a retry doesn't use credits twice.
```

Kode error yang perlu dijelaskan di tabel error API: `INSUFFICIENT_CREDITS` (403, `data: { required, balance }`), `AI_SOURCE_REQUIRED` (409), `REZUMI_AI_UNAVAILABLE` (409), `AI_INPUT_TOO_LARGE` (413).

## 4. Screenshot yang perlu dibuat saat go-live

- Pengaturan → AI providers dengan baris Rezumi AI dan saldo.
- Label biaya di samping tombol AI (mis. dialog New document, tab Writing).
- Dialog "Not enough Rezumi AI credits".
- Android: dialog "Use Rezumi AI?".
