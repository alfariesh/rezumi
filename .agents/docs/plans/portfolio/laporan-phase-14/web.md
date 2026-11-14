# Phase 14: web report

Worker: **web**. Contract: `phase-14-asisten-ai.md` §1, §2, §5. Nothing committed. Files below are relative to the worktree root.

## Done

**Assistant feature (shared with resume and letter)**

- `apps/web/src/features/assistant/document.ts`: `AssistantDocument` is now a union. `TextAssistantDocument` (`kind: "resume" | "letter"`) works as before. `PortfolioAssistantDocument` (`kind: "portfolio"`, `posting: null`) adds `reveal(place)` and `source` (the source's resume data, its kind, and the page's own words, used for change lines). Both kinds get two optional hooks: `beforeSend()`, which returns null or the reason a message can't go out, and `prepareUploads(files)`.
- `apps/web/src/features/assistant/send-guard.ts` (new): `DocumentNotReadyError`.
- `use-assistant-chat.ts`: new `beforeSend` option, awaited in the transport before every request (first message, send, Retry, answers to questions, approvals). A refusal fails the request with `DocumentNotReadyError`.
- `assistant-panel.tsx`:
  - `belongsTo` and `documentInput` know `portfolioId`; portfolio threads start with `{ portfolioId }`.
  - `start` runs `beforeSend` first. If it refuses, a toast says why, nothing is created, and the composer gets the message back.
  - The empty state has portfolio wording and five portfolio suggestions.
  - Past conversations: portfolio threads count as "other documents" and open `/builder/portfolio?assistant=<id>`.
- `conversation.tsx`:
  - `send` runs `beforeSend` (toast plus the message back in the box). When `DocumentNotReadyError` reaches the error banner, it shows the reason itself and hides Switch model.
  - Trace lines: "Read the portfolio", "Saving a picture… / Saved a picture" (failures on their own error line), and "Changing the portfolio…" while the call streams. Failed `edit_portfolio` calls get an error line.
  - Proposal handling (`toProposals`, `recordUndone`, the `propose_edits` card) only runs for text documents.
  - `tool-edit_portfolio` parts render the lazily loaded `PortfolioChanges` card.
  - An effect replays new portfolio replies through a dynamic import of `features/portfolio/assistant/apply`.
  - The Stop line reads "Stopped. Nothing was changed." in portfolio threads.
  - The composer:
    - Uses the globe icon on the portfolio chip.
    - Runs `prepareUploads` on files that fit, before the 5 MB and file-count checks.
    - Gives a message back when `onSend` resolves false.
- `dock.tsx`: exports `AssistantDock` so the portfolio editor can mount the panel with its own document.

**Portfolio assistant (`apps/web/src/features/portfolio/assistant/`, new)**

- `document.ts`:
  - `usePortfolioAssistantDocument(reveal)` keeps the same document object until the portfolio or its source changes.
  - `portfolioSendProblem` saves what's waiting (`flush()`). If the save fails, it refuses with `Not sent: the assistant needs your latest changes saved first. {reason}`. The reason comes from the save state: conflict, gone (`portfolioRefusalMessage`), invalid (`describeSaveProblem`) or error (`describeRetry`).
  - `preparePortfolioUploads` shrinks pictures one at a time with `compressImage(file, "photo")` (at most 2,000 px and 2.5 MB, WebP, JPEG or PNG) and renames the extension. Other files, and pictures that can't be compressed (SVG, animated GIF, unreadable), go as they are.
- `dock.tsx`: `PortfolioAssistant({ onReveal })`.
- `records.ts`: `usePortfolioChanges`, which records what this visit did per call (keyed by `messageId:toolCallId`), and `forgetPortfolioChanges`. Kept apart so the route can clear it without loading the engine.
- `apply.ts`:
  - `applyCall` replays a call's resolved edits (`applyPortfolioEdits(..., { mode: "replay" })`). The result goes into the store as one structural undo step (`editPortfolioTo`). It keeps the inverses (applied last-first), records replay failures, and sends `setEditStatus`: accepted for applied edits, rejected for failed ones. It then starts the media fill-in. Redo straight after Undo, with nothing changed in between, uses the store's own `redo()`.
  - `undoCall` uses the store's `undo()` when nothing changed since the call applied; otherwise it applies the inverses as one step. It records rejected.
  - `autoApplyPart` and `autoApplyMessages` apply a call only once. Two module-level sets guard this: card ids applied, and calls already considered. Only pending cards apply.
  - `callStatus` decides what a card offers: applied (Undo only while this visit applied it), undone (Redo), pending (Apply), or failed.
- `media.ts`: blocks the call added without a picture get what a pasted link gets, best effort and quietly, as part of the change's step (`history: false`):
  - Video: the thumbnail is copied in.
  - Embed: its picture is found through `embedFromUrl(embedPageUrl(...))` and copied in.
  - Link: the page's picture is offered through `useLinkSuggestions`.
- `labels.ts`: `portfolioChangeLines(edits, context)` gives one translated line per edit, named from the call's own adds, then the data before, then the data now:
  - Lists: add, edit, remove and move for every list, with hide and show for works and custom sections.
  - Blocks and metrics name their work.
  - Settings read as "Label: value": theme, page language, mode, accent, fonts, name, headline, location, photo, intro effect.
  - Section hiding and career-item hiding are listed per section and per item when the earlier data is known; section renames are covered too.
  - Each line carries a reveal (the work, the section, or the tab), found through `problemPlace`.
- `changes.tsx`: `PortfolioChanges`, the changes card:
  - Shows the call's title and the change lines. Pressing a line runs `document.reveal`; the panel never moves by itself.
  - Shows failures in muted text: the server's and the replay's, with a plural count.
  - Shows the status (Applied, Undone, Not applied yet, or Not applied) with Undo, Redo or Apply.

**Portfolio editor**

- `apps/web/src/features/portfolio/editor/assign.ts` (new):
  - `assignChanged`: the resume editor's approach, plus list items kept by id when a list grows, shrinks or is reordered.
  - `editPortfolioTo(next)`: writes data computed from the current data as one structural step.
  - This is a copy, not an import. Importing the resume module would bring the resume editor into the portfolio bundle.
- `apps/web/src/features/portfolio/editor/webmcp.ts` (new): WebMCP tools `portfolio_read` and `portfolio_edit`.
  - `portfolio_read` returns `{ view: portfolioAiView(...), guide: PORTFOLIO_EDIT_GUIDE }`. It reads the editor's unsaved data and has no uploads.
  - `portfolio_edit` takes `portfolioEditsInputSchema` and runs `applyPortfolioEdits` in strict mode with the plan. The billing summary gives `portfolioEditPlan`; `portfolio.get` limits give the works limit. Applied edits land as one undo step, with the `toastAiChange` toast and its Undo. The tool returns `{ applied: [{index, summary, id?, ref?}], failed, note }`.
  - The engine loads on the first call (it brings the rich-text cleaner), not with the editor.
  - `usePortfolioWebMcpTools()` keeps the source, plan and status current through an effect.
- `routes/builder/portfolio/-components/portfolio-shell.tsx`:
  - `assistant={<PortfolioAssistant onReveal={revealChange} />}` goes into `EditorFrame`, and `MobileEditor` gets `views={["assistant"]}`. The AI icon, the column at 1280 px and up, the drawer and the phone sheet come from the shared shell.
  - `revealChange` reuses the save status's `reveal`. On phones it also closes the AI sheet so the tab's sheet shows; on tablets it opens the panel drawer.
  - ⌘J toggles the assistant in `PortfolioHotkeys`.
  - `useOpenAssistantFromUrl` handles `?assistant=` and `?ask=`, which waits in the composer.
  - `usePortfolioWebMcpTools()` is registered here.
- `routes/builder/portfolio/index.tsx`: the search schema gains `assistant` and `ask`. Leaving the editor also runs `forgetPortfolioChanges()`.

**i18n**: `pnpm --filter web lingui:extract`, 104 new msgids, all translated in `apps/web/locales/id-ID.po`.

- No existing msgid changed.
- "Apply" and "Not applied yet" would otherwise reuse the job-application translations ("Lamar", "Belum melamar"), so they now have their own contexts.
- The id-ID diff is insertions only: no existing entry lost its translation.
- The other 53 catalogs only gained empty new entries.

## Tests run

- `pnpm --filter web typecheck`: clean.
- `pnpm --filter web test src/features/assistant src/features/portfolio`: 42 files, 291 tests passed.
- `pnpm --filter web test src/features/career src/features/resume/editor src/features/letters src/features/command-palette src/routes`: 20 files, 111 tests passed (the resume and letter assistants are unchanged).
- `pnpm exec vp test run src/typography.test.ts` (in `apps/web`): passed.
- `pnpm exec vp build --outDir <scratchpad>` (in `apps/web`): the client bundle built ("built in 3.94s"), so the Lingui macro step and the lazy chunks compile. The prerender step that follows then failed only because it reads `apps/web/dist/index.html` and I had sent the output elsewhere. A full `pnpm build` is still the principal's check.
- `pnpm exec vp lint --fix`, then `pnpm exec vp fmt`, then `pnpm exec vp lint --deny-warnings --format=agent`, on the changed paths: clean.
- `pnpm exec vp fmt --check` on `apps/web/src/features/assistant`, `apps/web/src/features/portfolio`, `apps/web/src/routes/builder/portfolio` and `id-ID.po`: clean.
- New or extended tests (they use the real engine, which has landed; `@/libs/orpc/client` is mocked):
  - `features/portfolio/assistant/labels.test.ts`: every list and op, hide and show, blocks of a work added in the same call, a removal whose item is unknown, settings as label and value, section and career-item hide and show lines, renames, and reveals.
  - `features/portfolio/assistant/apply.test.ts`:
    - A call applies once as one undo step, with status accepted and the media fill-in started.
    - Untouched references are kept.
    - The same card never applies twice, even under another message id.
    - A call already accepted elsewhere is left alone.
    - Undo and Redo go through the store's history; Undo uses inverses after other edits, which stay.
    - A target that's gone gives failures plus statuses rejected and accepted; a call with nothing applied is "failed".
    - Apply works on a pending history card; leaving the editor forgets the records.
  - `features/portfolio/assistant/changes.test.tsx`: lines and the Applied, Undo, Undone, Redo flow on the real store; Apply on a pending card; an accepted history card has no Undo; pressing a line reveals its place; failures are listed.
  - `features/portfolio/assistant/document.test.ts`: the flush lets a message go; a conflict holds it with the right words; pictures are compressed and other files pass through.
  - `features/portfolio/editor/webmcp.test.ts`: `assignChanged`; the hook registers both tools; read shows unsaved data and the guide; edit applies one undo step with applied and failed results and a toast; the plan refuses a Plus theme; there's no plan while plans don't apply.
  - `features/assistant/assistant-panel.test.tsx`: a portfolio thread starts with `{ portfolioId }` after `beforeSend`; a refusal shows a toast, creates no thread and gives the text back; the panel opens the portfolio's own thread, and Past conversations splits it from resume threads.
  - `features/assistant/conversation.test.tsx`: the changes card renders; the read, save and failed trace lines show; only replies new in this visit go to the replay; `beforeSend` is handed to the chat; a refused send keeps the text; pictures go through `prepareUploads` before upload.

## Cross-area

- **Server, as delivered:** `portfolioId` on the start input and thread summary, and `setEditStatus` for `tool-edit_portfolio`. The web typechecks against it.
  - Failed replays are recorded as `rejected`, and their ids are sent with the applied ones. `setEditStatus` must keep accepting `rejected` for cards that never applied.
  - The web ignores `portfolioName` and shows its own translated word.
- **Engine, as delivered:** replay and inverses are used as documented. The engine's `portfolioEditItemName` is not used; `labels.ts` names items itself, including blocks and metrics inside a work the same call adds.
- **Not mine (suggestions):**
  - `apps/web/src/features/command-palette/pages/resumes.tsx`: ⌘K's conversation list routes only letter and resume threads. A portfolio thread does nothing there; it should navigate to `/builder/portfolio` with `search: { assistant: id }`.
  - `apps/web/src/features/resume/editor/webmcp.ts` and `portfolio/editor/assign.ts` both hold `assignChanged`. It could move to `apps/web/src/libs/` later.
  - I ran `pnpm --filter web lingui:extract`, not the root `pnpm lingui:extract`, so the extension catalogs and PDF translations weren't touched. The principal may want the root command before committing.
- **For the principal to check in the browser:**
  1. ⌘J and the AI icon open the assistant: as a column at 1280 px and up, as a drawer below that, and as a phone sheet next to Content, Design and Publish. Suggestions show.
  2. Send while a field is invalid: you see a toast and the text stays. With a conflict, the Changed elsewhere dialog appears and the message is refused.
  3. A change applies live and takes one Undo step in the top bar. On the card: Undo, Redo, line reveals (the work opens, the section opens in Content, a tab switches; on a phone the sheet changes).
  4. Reload mid-reply: the card shows Apply. Reload after applying: Applied, without Undo.
  5. Attach a phone photo of 8 MB or more: it uploads as WebP, and `save_attachment_image` places it as a work cover with alt text.
  6. A video, embed or link block added by AI gets its thumbnail, picture, or the link-picture suggestion.
  7. Past conversations from the resume editor open the portfolio editor on the thread.
  8. With Chrome's WebMCP flag: `portfolio_read` and `portfolio_edit`.
  9. Production build.

## Not done

- No browser verification and no dev server, as briefed.
- `portfolio_read` over WebMCP lists no unplaced uploads (`uploads: []`): the editor has no list of them. Strict edits can place only images already in the data.
- A reply still streaming when the assistant panel closes (the conversation unmounts) isn't replayed until its card's Apply. Contract §5 allows for this ("tab closed mid-reply").

## Round 2

### Done

1. **Security M1, AI link blocks are never read automatically.** `features/portfolio/assistant/media.ts` fills in only Video and Embed blocks. Their addresses are built from a checked id on the provider's own host. Link blocks the assistant adds get no automatic `unfurl`, so no server fetch happens without a click. The person can still read the page from the block: `LinkBlockEditor` → "Fill in from the link" (`readAgain`) already exists, so nothing new was needed. The `apply.ts` comment is updated too.
2. **Refused calls that were retried successfully are hidden.**
   - Your `edit_portfolio` rule is kept and moved into a shared helper, `retriedLater(message, part, same?)`, in `conversation.tsx`.
   - `save_attachment_image` errors now follow the same rule, but only when a later successful save is for the **same `attachmentId`**. A refusal with no id counts any later save. Another picture's failure still shows.
3. **⌘K conversation list (your edit):** there's no command-palette test suite, so none was added. `pnpm --filter web typecheck` is clean, the `src/features/command-palette` run has no test files, and lint is clean. `vp fmt` re-wrapped one line in `pages/resumes.tsx`, whitespace only.
4. **First click on a change line only scrolled.** In the coordinator's settled state I couldn't reproduce it: a real click on "Added the work…" fired `click` on the first try and opened the work, with no scroll (probed in the running preview). Two things can move the transcript under the pointer, and both are fixed:
   - **(a) Trailing rows.** Stopped, the error banner and Copy transcript were transcript rows of their own. They appeared when a reply ended and disappeared when one started, which made the scroller re-anchor (see 5).
   - **(b) The first card in a session popped in late.** It waited on the lazy chunk, then grew the transcript.
   - Fixes: the trailing items now render inside the last message's row (`after` in `Conversation`). `PortfolioAssistant` preloads `./changes` when the panel opens.
5. **Reopened panel sat on an earlier message with Latest showing.** This is the cause, and it's shared with the CV assistant (same `Conversation`). I reproduced it with the scroller's own test harness, as a temporary test that I then deleted. The `MessageScroller` controller assumes rows only get appended at the end:
   - **Swap at reopen.** A reopened thread opens on its last turn but never marks its turns as "handled". When the Copy row is swapped for the resumed reply (same row count), `findUnhandledAnchor` picks the thread's **first** user message and scrolls to it. Measured: scrollTop went from 628 to 0.
   - **Send after reopen.** Sending a message inserted the new user row _before_ the trailing Copy row, so the new turn was never anchored. The transcript stayed put: 664, where the new turn needed 1628; it reaches 1628 without trailing rows.
   - Fix: moving the trailing items into the last row removes both paths.
   - New test in `conversation.test.tsx`: the rows are exactly the messages, and Copy and the error sit in the last row.

**Tests and checks:**

- `pnpm --filter web typecheck`: clean.
- `pnpm --filter web test src/features/assistant src/features/portfolio src/features/command-palette src/features/career src/features/resume/editor src/features/letters`: 63 files, 407 tests passed.
- New tests:
  - `portfolio/assistant/media.test.ts`: Video and Embed only; a link the assistant chose is never read; the embed picture lands in its block with no undo step of its own.
  - Two in `assistant/conversation.test.tsx`: refused-then-retried calls are hidden per tool and attachment, while a lone refusal still shows.
  - One for the row structure.
- `vp lint --deny-warnings` and `vp fmt --check` on the touched paths (plus `command-palette/pages/resumes.tsx`): clean.
- `pnpm --filter web lingui:extract`: no new msgids this round; id-ID still has every new Phase 14 string translated.

### Cross-area (round 2)

- **`packages/ui/src/components/message-scroller-controller.ts` (not mine):** the deeper fix belongs here. `applyDefaultScrollPosition` / `openOnLastTurn` should add every anchor present at open to `handledAnchors`. Today any later same-count row change jumps to the first history message. One way that still happens after my fix: Retry with `regenerate` swaps the failed assistant row for the "Thinking…" row. A matching scroller test: open a saved thread, swap its last row for another, and expect no jump to the first turn.
- **Browser check:**
  - Reopen the panel while a reply streams: it should follow.
  - Send right after reopening: the new turn should settle near the top.
  - Click a change line just after a reply ends: it should open on the first click.
