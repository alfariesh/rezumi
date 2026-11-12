# Review 2 — pf-web (web editor, dashboard, admin)

Summary: 54 findings fixed in the web Portfolio area (editor, dashboard, admin, homepage section), plus 58 Indonesian wording fixes and 43 new id-ID strings. `web` typecheck, 211 portfolio tests (26 files), lint and format on the changed paths all pass. Checked in the browser at desktop and phone width. 10 cross-area items. Nothing is committed.

Method: four read-only reviewers covered media/works/blocks, publish/statistics/admin, editor forms, and id-ID wording. I reviewed the editor store, the save path, the preview and the shell myself. `editor/store.ts`, `save-problem.ts`, `save-failure.ts`, `leave.ts` and `preview.tsx` held up: flush ordering, conflict handling, retry/back-off, refusal memory, leaving with unsaved edits and the sandbox were all correct. I changed nothing in them.

## Findings fixed

### Data loss and races

- **Link block "Fill in from the link" could overwrite a URL typed while it ran.** It also blanked a typed title when the page had none.
  - Editing the address now cancels the read. The result is dropped when the block's URL has changed since.
  - A missing page title keeps the typed one.
  - File: `blocks/link-block.tsx`.
- **The "Add work" dialog could be dismissed mid-import or mid-upload.**
  - From resume: `applyServerEdit` then replaced edits made after the dismiss.
  - From pictures: dismissing cancelled the batch and deleted what had already uploaded.
  - Steps now report `onBusy`. While busy, the dialog ignores Escape and outside clicks, hides Close, and disables Back.
  - Files: `works/add-work/{parts,add-work-dialog,from-resume,from-pictures,from-link}.tsx`.
- **A mid-list "+ Add block" cancelled its own upload when the block after it moved or was removed.**
  - The menu between blocks now belongs to the block before it.
  - After the last block it stays mounted in a "quiet" mode that shows only its progress and errors.
  - File: `blocks/block-list.tsx`.
- **Testimonial photo and client logo uploads landed on whichever item sat at the old index** after a reorder or removal. The same applied to every per-item edit in Services, Testimonials and Clients.
  - All updates and removals now find the item by id (`editOffer`/`removeOffer`).
  - File: `editor/offer-forms.tsx`.
- **Works list hide/show toggled by render-time index.** It now finds the work by id. File: `works/works-form.tsx`.
- **Metrics removed by render-time index.** Removal is now by id. File: `metrics/metric-form.tsx`.
- **From-link: a failed read of link B kept link A's title and summary**, so the new work was titled A but pointed to B. File: `works/add-work/from-link.tsx`.
- **A client's brand logo was dropped for good mid-typing** ("Stripe" → "Stripe I" → "Stripe" lost the logo).
  - New pure helper `editor/clients.ts` (`renameClient`).
  - The form remembers that the switch was on and brings the logo back when the name matches again.

### Errors the user sees

- **Silent drops are now explained:**
  - Pictures past a block's 12 (`leftOutMessage`).
  - Pictures past the works room in "From pictures"; this also opens the plan dialog when the limit comes from the plan.
  - A block that arrives when its work already has 30 (`InsertBlock` now returns whether it went in). The video thumbnail copy and the link suggestion are skipped then.
  - Files: `blocks/{images-block,block-list,add-media-block}.tsx`, `works/add-work/from-pictures.tsx`, `images/image-field.tsx`.
- **Full storage while copying a picture was reported as "couldn't copy".**
  - `importVideoThumbnail` now stops on `PORTFOLIO_STORAGE_FULL` as well as `PLAN_LIMIT_REACHED`.
  - It takes an `onFailure` callback for user-started copies. "Copy the thumbnail" and from-link now show the real reason and open the plan dialog.
  - Background copies stay quiet.
  - Files: `media/remote.ts`, `blocks/video-block.tsx`, `works/add-work/from-link.tsx`.
- **Local file-read errors (`NotReadableError`/`NotFoundError`: moved files, iCloud placeholders) said "Check your connection".** They now get their own message, for pictures and PDFs. Files: `images/upload.ts`, `media/pdf.ts`.
- **Upload error alerts couldn't be dismissed** (`clearErrors` had no caller). `UploadStatus` now has a Dismiss button. File: `images/image-field.tsx`.
- **Statistics:**
  - A query error made the Visitors widget vanish. It now shows a message with "Try again".
  - Analytics details `unavailable` showed nothing to a Plus user. They now see a note.
  - "Work opened by day" listed up to 1,500 rows by count. It now shows the 10 latest days, newest first.
  - The "Button clicks" tile counted videos, PDFs and links too. It is renamed "Clicks", matching its list.
  - File: `statistics/portfolio-statistics.tsx`.
- **The statistics days are in the account timezone (UTC by default), and the page never said so.** A note now names the zone and links to Settings → Timezone.
- **Messages inbox:**
  - "No messages yet" showed while loading and on error. It now shows a spinner, or an error with a retry.
  - A message already deleted elsewhere said "This portfolio doesn't exist anymore". It now gets its own wording, and the list refreshes.
  - Marking a message read refetched the whole portfolio. It now refreshes only the inbox, plus statistics after a delete.
  - File: `statistics/portfolio-messages.tsx`.
- **Admin:**
  - "Find portfolio" with no match said the portfolio was deleted.
  - Moderation errors showed the server's English through `ReasonDialog`. They are now worded via `portfolioErrorMessage`, including the report `NOT_FOUND` pf-server added.
  - The action dialog's title flipped to "report" while closing.
  - A review preview that failed to render spun forever.
  - The new `deleted` log action now has a label.
  - Files: `admin/{reports-page,review-page,labels}.tsx|ts`.
- **Dashboard delete had no pending state, so a second press gave a misleading error.** It now shows pending, a success toast, an "already deleted" message, and always refreshes. File: `portfolio-page.tsx`.
- **The AI draft said "Wait for them to save" even when saving was blocked** by a conflict, a deleted portfolio or invalid data. It now names the real case. File: `ai/draft-dialog.tsx`.
- **Section rename silently cut titles at 60 characters.** It now warns. File: `editor/content-panel.tsx`.

### Plan and limit gates

- **Keyboard users on Free got the plan dialog every time the arrow keys reached a Plus theme or effect.** A radio group selects as you arrow, so this happened on every pass.
  - New `editor/arrow-keys.ts` tells arrow-key changes from deliberate ones.
  - Arrowing past a Plus option focuses it and its label says "Plus". Space or a click opens the dialog.
  - Files: `theme-gallery.tsx`, `editor/intro-effect.tsx`.
- **The homepage showcase showed Free/Plus chips even with billing off.** `PortfolioShowcase` now takes `billingEnabled`, default `true`. The caller needs a one-line change (cross-area 1). File: `features/homepage/portfolio.tsx`.

### Correctness of editor hints

- **Intro buttons the page leaves off had no explanation.**
  - The editor now checks each button against the renderer's own view (`useEditorView` now passes the resume links).
  - Each such button gets a reason: resume not public, no PDF, Contact hidden, no WhatsApp number, no email, or no address.
  - Files: `editor/intro-form.tsx`, `editor/use-view.ts` (new `useResumeLinks`, shared with `preview.tsx`).
- **Service with "A link" and no URL** now warns. File: `editor/offer-forms.tsx`.
- **Typewriter with only one line** (the headline, no roles) now warns, as the page plays no effect then. File: `editor/intro-effect.tsx`.
- **Metrics missing a label or value** (the page drops them) now say so. `isMetricComplete` was dead code; it is now used. File: `metrics/metric-form.tsx`.
- **Metric number fields:**
  - The example and placeholder are now in the app language's number format ("2,8"), not hard-coded "2.8".
  - The error says to leave out % and currency.
  - A rating is capped at 0–5.
  - File: `metrics/metric-form.tsx`.
- **A bare email typed into a link field** became `https://nadia@example.com`, which opens example.com. It now becomes `mailto:`, which web-only fields refuse with their message. File: `editor/fields.tsx`.
- **WhatsApp:**
  - "+44 (0)20…" kept the trunk 0. It is now dropped.
  - A number starting with 0 now says it was read as +62.
  - File: `editor/contact-form.tsx`.
- **The contact form switch** no longer flashes greyed out with a warning while `portfolio.get` loads. File: `editor/contact-form.tsx`.
- **Publish dialog:**
  - When publishing failed after the search-engine setting was saved, the switch showed the old value. The updated record is now applied at once.
  - "Send it again" can't be spammed; once sent, it says so.
  - The "Verify your email" warning no longer flashes before the session loads (`usePortfolioOwner().loaded`).
  - Files: `editor/publish-panel.tsx`, `editor/context.ts`.

### Undo

- **URL fields and alt text made one undo step per keystroke.**
  - `ImageField.onChange` now has a `typing` flag for description edits.
  - Every caller passes a key then, and URL fields always pass a key.
  - Undo now takes a typed address or description back as one step.
  - Files: `images/image-field.tsx`, `works/work-editor.tsx`, `editor/{section-forms,intro-form,design-panel,offer-forms}.tsx`, `blocks/link-block.tsx`.

### Accessibility

- **Focus fell to `<body>` after Remove** in Services, Testimonials, Clients and intro Buttons. These lists now use `useRemovalFocus`, like metrics and blocks.
- **Closing a work (back or delete) lost focus.** It now reveals the Work section and focuses its toggle.
- **City search:** results are announced through a live region, and Escape closes the list. File: `location/location-fields.tsx`.
- **"Open the PDF"** now says it opens in a new tab and shows an icon. File: `blocks/pdf-block.tsx`.

### Performance and memory

- **A very tall PDF first page could allocate a ~180 MB canvas.**
  - The preview scale is now capped by height too (≤2,000 px).
  - Cancelling now stops before the page is drawn.
  - File: `media/pdf.ts`.

### Indonesian (id-ID)

- **New strings:** all 43 are translated.
- **Untranslated portfolio strings:** none remain (checked by script).
- **Placeholders:** they match msgid and msgstr in every id-ID entry.
- **Wording fixes:** 58 entries were changed in `apps/web/locales/id-ID.po`:
  - "Membubarkan" → "Abaikan" for Dismiss.
  - Ban terms "larang" → "blokir".
  - Unpublish "Matikan" → "Batalkan penerbitan".
  - "Tombol pesan" → "Tombol pemesanan".
  - "Acak teknologi" → "Acak huruf"; "Ketik berganti" → "Mesin tik".
  - Leftover English: "Trash", "Open to work", "Made with Rezumi".
  - "portfolio" → "portofolio".
  - kamu/-mu/-ku → Anda/saya.
  - Step titles, sentence case, "Tambah X", "timpa" for overwrite, and others.
- **Shared msgids changed:** a few changed msgids are shared with other features (Dismiss, Retry, Keep mine, Make it shorter, Layout, No resume). The new wording fits every use.
- **Other locales:** they keep portfolio strings empty (English fallback), as the repo already does.

## Refactors

- `editor/offer-forms.tsx`: one `editOffer(list, id, change, key)` and one `removeOffer` replace three index-based copies. Each card builds its `update` from the item id.
- `editor/clients.ts`: the client-rename rule is pulled out as a pure function, so it can be tested.
- `editor/arrow-keys.ts`: one hook for "arrowing isn't choosing", used by the theme gallery and the effect picker.
- `editor/use-view.ts`: `useResumeLinks()` is shared by the preview and `useEditorView`, so the panel view matches the preview.
- `works/add-work/parts.tsx`: `useReportBusy` and a disabled `BackButton`.
- I did not split `metric-form.tsx` (≈600 lines): it is already split into `NumberText`, `MetricFields` and `MetricsEditor`, and splitting further would only move code.

## Tests added

- `editor/clients.test.ts` (new): brand logo kept through typos, not added unasked, uploaded logo untouched.
- `media/remote.test.ts` (new): thumbnail falls back from YouTube's largest picture; stops on full storage and reports it; a cancel is not reported as a failure.
- `theme-gallery.test.tsx`: arrowing onto a Plus theme opens no dialog; clicking it does.
- `editor/fields.test.ts`: email → `mailto:`; "+44 (0)…"; a number without a country code.
- `images/upload.test.ts`: file-read error wording.
- Totals: portfolio web tests went from 202 to 211.

## Checks run

- `pnpm --filter web typecheck`: pass (`tsrs --noEmit`, no errors). Mid-session it failed only on pf-server's in-progress `packages/api` files; the last run is clean.
- `pnpm --filter web test src/features/portfolio`: 26 files, 211 tests passed.
- `pnpm exec vp lint --deny-warnings --format=agent` on `apps/web/src/features/portfolio`, `features/homepage/portfolio.tsx`, `routes/builder/portfolio`, `routes/dashboard/portfolio`, `routes/dashboard/admin/portfolios`: no diagnostics.
- `pnpm exec vp fmt --check` on the same paths: "All matched files use the correct format."
- `pnpm lingui:extract` was run twice, the second time after the last string change.
  - It also re-sorted and dropped obsolete entries in all 55 catalogs, as noted for this repo.
  - The id-ID empty-msgstr count is back to its pre-extract number, apart from non-portfolio strings that were already empty (153).
- Browser (launch config `rezumi-portfolio-12`, test account seeded with `pnpm portfolio:seed`):
  - Editor at desktop and 375 px phone width: Content sheet, intro buttons, no horizontal scroll.
  - The "Not on the page" hint shows for a Link button without an address; Undo restores it.
  - Remove moves focus to the previous card.
  - Theme gallery: ArrowDown onto Kanvas (Plus) on Free opens no dialog and leaves the theme on Lugas; Space opens the plan dialog.
  - Dashboard: the timezone note shows and the "Clicks" tile is renamed. In Indonesian the strings read correctly.
  - The admin review page renders its preview.
  - No console errors on a fresh load. Errors seen earlier came from hot reload mid-edit (imports not yet added) and from 502s while pf-server restarted the API.

## Cross-area

1. **`apps/web/src/features/homepage/page.tsx:37`** (web, outside my list): pass `billingEnabled={billingEnabled}` to `<PortfolioShowcase />`. The prop exists now; without it the chips still show when billing is off.
2. **`apps/web/src/features/resume/share/custom-domain-field.tsx:161-166`** (resume share, used by the Publish panel and the dashboard):
   - Remove disconnects a verified domain with one press. Add a `useConfirm` step.
   - `allowServerMessage: true` (`:76`) shows the server's English text in the Indonesian UI.
3. **Statistics timezone** (auth/pf-server): `user.timezone` defaults to UTC and nothing sets it from the browser. Set it from `Intl…timeZone` at sign-up, or when the portfolio is first created. Until then, an Indonesian user's "today" runs 00:00–07:00 behind. The web now names the zone.
4. **`portfolio.statistics` details `unavailable`** (pf-server, `statistics.ts:155` and `analytics.ts:191`) means both "Analytics Engine isn't bound" (Node) and "the query failed". Split them, e.g. `not-configured` vs `unavailable`, so the web can hide the note on Node and say "try again later" only on failure.
5. **`portfolio.setPublic`** (pf-server): optionally accept `showInSearchEngines`, so publishing is one write. The web now applies the first write at once, so this is cleanup, not a bug.
6. **`@rezumi/portfolio`** (pf-render): export `typewriterPhrases` (`shared/hero-text.tsx`), or an `effectPlays(view)` helper. The editor keeps a copy in `editor/intro-effect.tsx` to decide its warnings.
7. **"Role" msgid shared** between Applications ("Posisi") and the public page's work role (`page-text.ts`, should be "Peran"). It needs a Lingui context split, and the page messages flow through pf-render's `messages.ts` and `pdf:translations`. pf-render and the principal should decide; leaving it gives "Posisi" on the page in Indonesian.
8. **Billing strings about the portfolio** (`features/billing/**` msgids such as "You can look at every theme…"): they use "portfolio" and "Kamu" in id-ID, against the catalog's "portofolio"/"Anda". These are billing-owned strings in the shared `.po`.
9. **pf-render's Paper "View case study" request**: once `messages.ts` has the string, pf-web runs `lingui:extract` and translates it. Nothing to do until it lands.
10. **`apps/web/src/features/billing/admin/reason-dialog.tsx:57`** shows `error.message` raw. Portfolio admin now rethrows with worded messages; other callers (billing admin) may still leak the server's English.

## Not done

- **No error boundary around lazy chunks** (rich text editor, map, metric preview). I did not verify whether the route's `errorComponent` replaces the whole editor on a failed chunk load. Needs a decision on a local `ErrorBoundary` (none exists in `apps/web/src`).
- **The admin "All reports" link drops the reports page's status filter** (`admin/review-page.tsx`). Minor; it needs the filter carried in route search or history.
- **Custom section button:** a label without a URL renders no button, and there is no hint. Services and intro buttons have hints now. The same view-based check could be added.
- **The text block's "/" add menu** still cancels its upload if that text block itself is removed mid-upload. That is acceptable, since the person removed the place it was going to.
- **Touch reorder** was not checked on a real device. Keyboard reorder is checked by code and existing tests.

## Feature ideas (later wave)

- When the browser's timezone differs from the account's, offer "Use <zone>" right on the statistics card.
- After choosing Reload in the conflict dialog, keep the local version as an Undo step, so "Reload" is never destructive.
- Retry button for pictures that failed in a batch (keep the `File`s that failed).
- Undo toast for removed services, testimonials, clients and buttons, as blocks already have.
- Accept "35%" or "Rp1.200.000" in metric numbers and pick the format from the sign.
