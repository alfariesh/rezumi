# Phase 13 — pf-web

Summary: every item in section 5 "`pf-web`" is built. That covers B16 password, B2 work page addresses, slug history and preview, B14 business card and Save contact, B17 Embed block, B19 Open to work, B9 statistics with CSV, errors, translations and the E2E spec.

- `pnpm --filter web typecheck` is clean and `pnpm --filter web test src/features/portfolio` passes: 33 files, 241 tests.
- Lint and format are clean on my paths.
- id-ID has every new string translated.
- I checked each feature in the browser against the live API, at phone width (the pane is 365 px) and in the desktop dashboard.
- The E2E spec is written, and Playwright lists all 5 tests. It hasn't run: see "Not done".

Nothing is committed.

## Built

### B16 — Password (`editor/password-group.tsx`, `editor/publish-panel.tsx`, `portfolio-page.tsx`)

- **Password group** in Publish, after Publish:
  - The "Protect with a password" switch opens a dialog with one password field and a show/hide button. It checks 6–64 characters in the browser and says why when the value is refused.
  - While the password is on: "Change password" (same dialog). Turning the switch off asks "Remove the password?" first, then removes it.
  - Uses `portfolio.setPassword` and `portfolio.removePassword`.
- **Search engines**: the switch shows off and is disabled while there's a password, with the note "Off while your portfolio has a password."
- **Publish dialog**: with a password on, it shows a note instead of the search-engine switch, and never sends that setting.
- **Dashboard status card**: a **Password** chip, and "Only people with the password can see it."
- **Refactor**: `useSettingAction` moved from `publish-panel.tsx` to `editor/setting-action.ts`, so the password group shares it.

### B2 — Work pages (`works/work-address.tsx`, `works/works.ts`, `works/work-editor.tsx`, `editor/preview.tsx`, `editor/store.ts`)

- **Page address** field in the work editor, under Title:
  - Shows `<portfolio>/work/` then the slug. The portfolio part is the person's own domain while it's connected and opens the portfolio.
  - Typing is normalised as you type (lowercase; spaces become dashes).
  - Errors: "Use lowercase letters, digits and single dashes." and "Another work uses this address."
  - Copy button. **Open page** only while the portfolio is live and the work has a page.
  - Help text "Changing it keeps the old address working…", or why the work has no page (hidden, untitled, or Work section hidden).
- **Slug history** (`changeWorkSlug`, `cleanSlugHistory`, `workSlugProblem`, `retitleWork(…, saved)`):
  - The old slug goes to the front of `previousSlugs` only when it was saved as this work's address. `lastSavedData()` is new in `editor/store.ts` and reads the data the server last took.
  - Effect: the letters of a title being typed never pile up as old addresses. A saved address is kept even if the person changes it a second later.
  - Entries stay unique, at most 5, and never include a slug any work now uses. Changing one work's slug also strips it from every other work's history.
- **Preview**: while a work is open and has a page, the preview draws `page: { kind: "work", workId }`. The old `openAnchor` CSS trick is removed.
  - The scroll position is kept per page.
  - "Replay intro" is hidden on a work page (no intro there).

### B14 — Business card and Save contact (`card/`)

- `card/business-card-dialog.tsx` (`BusinessCardButton`, `BusinessCardDialog`). It replaces `QrCodeButton` in Publish and is added to the dashboard status card. The card always prints white:
  - a preview with the name, headline, "Scan to see my portfolio" and the short address;
  - **Download QR (PNG)** at 1024 px through `QRCodeCanvas`;
  - **Download QR (SVG)**: the shown `QRCodeSVG`, serialised;
  - **Print cards**: an A4 sheet of 10 cards at 85 × 55 mm with dashed cut lines, printed from a hidden frame, so only the sheet prints;
  - **Show full screen**: a white full-screen code at 80vmin with the name. It asks for a screen wake lock where available and ignores failures.
  - QR settings: level M, quiet zone of 4 modules.
- `card/qr.ts`:
  - `businessCardAddress()` gives `…?utm_source=qr` (own domain at its root) and the bare shown address.
  - `businessCardPrintSheet()` escapes every typed value.
  - `cardFileName()` names the download.
- `card/use-page-url.ts`, `usePortfolioPageUrl(username)`: the own domain while it's active, not redirecting, and the portfolio holds the short link; else `/<username>`.
- `save-file.ts`: one download helper, shared with the CSV.
- **Contact**: the "Show a Save contact button" switch, with the contract's help text.
- **Intro buttons**: the `vcard` kind was labelled in Langkah 0. Both `useEditorView` and the preview now pass `links.vcard = "#contact"`, per section 4.1.

### B17 — Embed block (`blocks/embed-block.tsx`, `media/embeds.ts`, `blocks/add-media-block.tsx`, `blocks/block-list.tsx`, `blocks/link-block.tsx`, `works/add-work/from-link.tsx`, `media/remote.ts`)

- **Add block → Embed**:
  - The prompt reads "Paste a link to Figma, Loom, Spotify, SoundCloud or Google Slides…".
  - The block is added at once. The title and picture come from `portfolio.unfurl` (oEmbed).
  - The picture is copied quietly. Only no-room errors (plan limit or full storage) open the plan dialog.
  - Not embeddable: "This link isn't from a service we can embed. Use a Link block instead."
- **Embed block editor**:
  - Provider chip and a Link field. A new link shows at once (the old picture is dropped); title and picture are read after a 600 ms pause, latest link only, and kept only while the block still shows that content.
  - Title field, and a picture field (upload, replace, remove).
  - Sharing hints for Google Slides and Figma.
  - The privacy note "Visitors load it from {provider} only when they press it.", and "Open it on {provider}".
- **Link block**: when the address (or what reading it found, such as a SoundCloud short link) can be embedded, it offers **Embed it instead**. That replaces the card in place, keeping the block id, title and picture, or the service's picture when the card had none.
- **Add block → Link**: an embeddable page is added as an Embed block, with a toast, the same way videos already were.
- **Add work → From a link**: an embeddable page makes a work holding an Embed block, its picture as the cover, with a chip in the preview.
- Scaffold lines replaced: `ADDABLE_BLOCK_TYPES` is gone (`PORTFOLIO_BLOCK_TYPES` again, including the "/" menu), and the `embed`-to-link fallback in `unfurlLink` is gone. `EditBlock` covers `embed`.

### B19 — Open to work (`editor/intro-form.tsx`)

- Under the switch, always shown: "Anyone who opens your page sees this, your current employer too."
- While on:
  - **Roles you're looking for**: chips, at most 5, trimmed, unique, 60 characters each.
  - **Kinds of work**: five checkboxes, stored in the list's own order.
  - All edits use the history key `hero.availability`.

### B9 — Statistics (`statistics/portfolio-statistics.tsx`, `statistics/parts.tsx`, `statistics/work-statistics.tsx`, `statistics/csv.ts`, `routes/dashboard/portfolio/index.tsx`)

- **Range**: Last 7 / 30 / 90 days, kept in `?range=` (30 stays out of the address). Changing it replaces the history entry.
  - The previous numbers stay on screen, dimmed, until the new ones arrive.
  - If loading the new range fails, an alert says the numbers below are from before, with Try again. This came from a 502 seen during browser testing.
- **New labels** from Langkah 0 are shown: the QR code source, "Embeds opened", "Contacts saved".
- **Per work** table: every work, times opened, % of all openings, and **Details**. The table scrolls sideways when narrow.
- **Work details**: a `work-statistics.tsx` dialog over `portfolio.workStatistics`.
  - Every plan: times opened, and a daily chart.
  - Plus: Sources (including "From your portfolio"), linking sites, countries, devices and clicks on the page.
  - Free: the locked card, which opens the plan dialog.
  - `unavailable` shows a note; `not-configured` shows nothing.
  - Errors are worded, including `NOT_IMPLEMENTED` while the skeleton stood.
- **Download CSV** menu:
  - Daily numbers and Works for every plan; Breakdown for Plus. On Free it shows a Plus chip and opens the plan dialog.
  - Breakdown is disabled while the details aren't available.
- **`csv.ts`**: UTF-8 BOM, commas, CRLF line ends.
  - Text cells starting with `=`, `+`, `-`, `@`, tab or CR get a leading `'`; quotes are escaped.
  - Columns and file names follow the contract. `work_days` rows use the key `<date> <workId>`.
- **Shared pieces** moved to `statistics/parts.tsx`: labels, `RankList`, `DailyBars` (generalised from `DailyVisits`), `LockedDetails`, `UnavailableDetails`.

### Errors and strings

- `errors.ts`: wording for `PORTFOLIO_WORK_NOT_FOUND`.
- `pnpm lingui:extract`: run through `turbo run lingui:extract --filter=web`, so `pdf:translations` did not run, as asked.
- id-ID: every new portfolio string is translated, about 80, in "portofolio" / "Anda" terms. The 19 page strings and the theme copy from Langkah 0 were checked as translated. Placeholders match in every entry.

## Tests (new or extended)

| File                                  | Tests | Covers                                                                                                                                                     |
| ------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `works/works.test.ts`                 | +4    | Saved slug kept, newest first; typed letters not kept; another work's active slug dropped; limit of 5; `workSlugProblem` (pattern, taken, empty, too long) |
| `card/qr.test.ts`                     | 5     | `utm_source=qr` on the app and on an own domain, query and hash dropped, print sheet (10 cards, escaping, A4), file names                                  |
| `card/business-card-dialog.test.tsx`  | 1     | Dialog shows name, address and QR title; SVG download is an `image/svg+xml` file with `<svg`; PNG download is named `<user>-qr.png`                        |
| `media/embeds.test.ts`                | 7     | Title and picture from `unfurl`, fallback when reading fails, short link resolved, non-embed → null, cancel, `stillEmbeds`, hints, no-room errors          |
| `statistics/csv.test.ts`              | 6     | BOM and CRLF, formula injection, quoting, daily columns for every kind and source, works, details only when ready, file name                               |
| `statistics/work-statistics.test.tsx` | 3     | Per-work percentages and Details, empty state, work dialog (daily numbers, locked breakdown opens the plan dialog)                                         |

## Checks run (exact results)

- `pnpm --filter web typecheck`: `tsrs --noEmit`, no errors. Earlier runs failed only in `packages/api` / `packages/portfolio` files that other sessions were editing; the last run is clean.
- `pnpm --filter web test src/features/portfolio`: Test Files 33 passed (33), Tests 241 passed (241).
- `pnpm exec vp lint --deny-warnings --format=agent` on `apps/web/src/features/portfolio`, `apps/web/src/routes/dashboard/portfolio`, `apps/web/src/routes/builder/portfolio`, `tests/e2e/specs/portfolio-phase-13.spec.ts`: no diagnostics.
- `pnpm exec vp fmt --check` on the same paths: "All matched files use the correct format."
- `pnpm exec playwright test --list tests/e2e/specs/portfolio-phase-13.spec.ts`: 5 tests listed.
- id-ID script check: no empty portfolio msgstr; placeholder mismatches 0.
- **Browser** (`rezumi-portfolio-12`, test account `pf-web-review2@example.test`, against pf-server's live procedures):
  - **Password**: too short → "Use between 6 and 64 characters."; valid → "Password set". The search switch is locked with its note.
  - **Lock page**: a visitor with no cookie gets a 401 titled "Portofolio ini privat", with no name in it.
  - **Dashboard while locked**: Password chip and wording.
  - **Removing it**: asks first, then the page is public again (200).
  - **Business card**: preview, `data-qr-value` is `http://127.0.0.1:3260/raniprw2?utm_source=qr`, full screen at 375 px.
  - **Statistics range**: the address became `?range=7` and the chart reads "over 7 days"; still so after a reload.
  - **Open to work**: added a role, and the preview showed "Mencari: Product Lead".
  - **Work editor** at 365 px: Page address `qr-checkout` fits. The preview is the work page (`h1` is the work title, `.pf-workpage`, "Semua karya").
  - **Embed** from Add block with a Loom link: block editor, and in the preview a facade "Tampilkan Loom di sini" with `data-embed=https://www.loom.com/embed/…`, no iframe.
  - **Real API**: `workStatistics` answered with the contract's shape.
  - **Console**: no errors on fresh loads. The errors seen came from the API restarting during pf-server's edits (502, `ECONNREFUSED`).

## Differences from the contract

1. **Slug history rule.** The contract says every slug change records the old slug. Recording only slugs that were saved (`lastSavedData()`) keeps intermediate letters of a typed title out, while still meeting the purpose: shared links never break. A new, never-saved work records nothing, which the contract allows.
2. **Address field input.** The contract has the user type the slug, with an error for a bad one. Spaces and underscores become dashes and capitals are lowered as you type; the pattern error remains for other cases (`--`, an empty field, over 64).
3. **Statistics header.** The description no longer says "The last 30 days"; the range switch says it.
4. **Percentage column** is headed "Of total", not "Share": the "Share" msgid is shared with Share elsewhere and reads "Membagikan".
5. **`work_days` CSV key** is `<date> <workId>` (the contract leaves the key open).
6. **Embed block title** falls back to the provider name as placeholder text; the stored title stays optional.
7. **`data-qr-value`** on the QR wrapper in the business card dialog. It's not in the contract; added so E2E can check the encoded address without a QR decoder.
8. **Print** uses a hidden iframe with its own HTML (not `print:` Tailwind classes), so the app around the dialog never prints.

## Not done, with reasons

- **E2E not run.** It needs a production build and a fresh database, and the dev API restarted many times during this session while pf-server, pf-render and pf-themes edited (502s, `ECONNREFUSED`). The spec is written and lists. The integration step should run `pnpm build` then `PORTFOLIO_MODE=on pnpm test:e2e tests/e2e/specs/portfolio-phase-13.spec.ts` against a fresh database.
  - Its embed test depends on the server reading Loom's oEmbed with no network; the block is made from the link either way.
- **Per-work Details with real data** was not checked in the browser: work-open counting (pf-server) didn't register a guest opening a work page during my test. The dialog is covered by its component test, and its API answered with the right shape.
- **Shared component wording**: `ChipInput` (`apps/web/src/components/input/chip-input.tsx`, not mine) says "Add a keyword…" in the roles field. A `placeholder` prop would let Open to work say "Add a role…".
- **Billing-feature strings** that were already empty in id-ID (other features, catalog lag) are not mine and were left as they were. All portfolio strings are translated.

## Integration

1. **Typography test.**
   - `src/typography.test.ts` flagged two paragraphs on the one-line scale in `card/business-card-dialog.tsx` (the headline and the caption).
   - They, and the short address, now use `text-body-sm` / `text-body-xs`.
   - The whole `pnpm --filter web test` is green: Test Files 146 passed (146), Tests 768 passed (768).
2. **Roles placeholder.**
   - `apps/web/src/components/input/chip-input.tsx` gains an optional `placeholder` prop, used while adding. The default "Add a keyword…" is unchanged and the editing hint is unchanged.
   - Open to work passes "Add a role…" (id-ID "Tambah posisi…").
3. **Preview work cards.**
   - The preview runs no script and keeps the app's origin (`allow-same-origin`), so the editor listens for clicks in the preview's document. That is less code than changing the renderer's links, and nothing runs inside the frame.
   - A work card, or a work page's previous/next link (`#work-<slug>`), opens that work: the work editor in the panel and its page in the preview.
   - On a work page, a link to a part of the home page ("All work" → `#work`, navigation → `#about` and so on) goes back to the home view and lands on that section.
   - Scroll restores now jump instantly. The page's own `scroll-behavior: smooth` otherwise left a redraw reading the position mid-animation.
   - Checked in the browser on the live editor: a card click turned the preview into "Pelacakan kurir langsung" (`.pf-workpage`, `h1` the work's title) and opened its editor. "All work" returned to the home page with the Work section at the top (its top at 0), and the list in the panel. No console errors.
4. **Work-address behaviour**: unchanged, as accepted.
5. **Per-work Details with real data.**
   - **Cause:** the dev proxy (`apps/web/src/libs/dev-server-proxy.ts`) sent only `/<username>` and `/<username>/<slug>` to the server. Vite answered `/<username>/work/<slug>` with the web app, so the server never rendered or counted a work page in development.
   - **Fix:** `publicResumeProxyPattern` now also takes `/<username>/work/<slug>` (`[^/.?]+(?:/work/[^/.?]+|/[^/.?]+)?`). The app's own three-segment routes all start with a reserved segment, so they stay on Vite.
   - **Tests** in `dev-server-proxy.test.ts`: work pages with and without a query are proxied. `/dashboard/settings/app`, `/docs/guides/creating-a-portfolio`, `/builder/portfolio/x`, `/agent/abc/new`, `/cards/tess/work/kopi.png` and `/tess/other/kopi` are not.
   - **Browser:**
     - After Vite reloaded its config, a signed-out request to `/raniprw2/work/qr-checkout` returned the server's work page.
     - The dashboard's Per work then listed "QR checkout yang jarang gagal — 1 — 100%".
     - Its Details showed Times opened 1 and the daily chart ("peak 1"). On the Free test account the breakdown was locked, and "See what's included" offered Plus. No console errors.
   - **E2E user agent:** `browser.newContext()` doesn't take the project's `Desktop Chrome` settings, so the guests in `portfolio-phase-13.spec.ts` said `HeadlessChrome`, which the server treats as a crawler.
     - All four guest contexts now use `guestContext()`, with `devices["Desktop Chrome"].userAgent` and `locale: "en-US"`.
     - The work-page test now ends on the owner's dashboard: the work's row shows 1, and its Details dialog opens with "Times opened".
     - Playwright still lists 5 tests.

**Checks (this round, after item 5):**

- `pnpm --filter web typecheck`: clean.
- `pnpm --filter web test`: 146 files, 776 tests passed.
- `vp lint --deny-warnings` on `apps/web/src/features/portfolio`, `chip-input.tsx`, `routes/dashboard/portfolio`, `libs/dev-server-proxy*.ts` and the E2E spec: no diagnostics. `vp fmt --check` on the same: all formatted.
- `pnpm lingui:extract` (web only): run; "Add a role…" translated; no portfolio msgstr left empty.

## Guide (`docs/guides/creating-a-portfolio.mdx`)

**Text.** Updated in the guide's existing voice and structure; no new page, so `docs/docs.json` is unchanged. There is no Indonesian twin in `docs/`.

- **Intro:** the portfolio is now "a website" whose home page lists the work, and each work has a page of its own.
- **Create:** the theme table adds **Sintaks** and **Warta** (Plus), with the gallery's own descriptions.
- **Write your content:** the Intro buttons include **Save contact**. A new paragraph covers **Open to work** with **Roles you're looking for** (up to five), **Kinds of work** (full-time, part-time, contract, freelance, internship), the "Looking for: …" line, and the warning that a current employer sees it. Contact lists the **Save contact** button, and a paragraph says what the contact card holds and where to turn it on (**Show a Save contact button**, or an Intro button).
- **Add your work:** "detail" is replaced by the work's **page**. A new section, **A work's own page**, covers:
  - the address (`rezumi.app/your-username/work/…`), previous and next work, **All work** and the back button;
  - **Page address**: it follows the title, the allowed characters, **Open page**, and that a changed address forwards from the old one;
  - which works have no page.
- **Blocks:** the table adds **Embed**. A new section, **Embeds**, covers:
  - the five services and **Add an embed**, and **Embed it instead** for a pasted link;
  - the button-first loading ("Show … here", nothing loads or tracks before the press);
  - the sharing requirement (Figma viewable by anyone with the link; Google Slides shared with **Anyone with the link**).
- **Publish:** step 3 now says **Open page** and **Business card**. Two new sections:
  - **Your business card**: what the card shows, the PNG and SVG downloads, the A4 sheet of 10 cards (85 × 55 mm), full screen, and `?utm_source=qr` shown as **QR code** in statistics.
  - **Protect it with a password**: at least 6 characters; the private page without name or work; 12 hours per browser; files (pictures, PDFs) open only after the password; search engines don't list it and link previews show a general picture, with **Show in search engines** off; **Change password** ends every visitor's access and file links; 10-minute wait after several wrong tries, and the whole portfolio refusing every try for an hour after about 100 wrong passwords in an hour; **Remove password**.
- **See visitors and messages:** the period picker (7, 30, 90 days, kept in the address), the timezone line, the click kinds (videos, embeds, contacts saved), the sources including **QR code**, **Per work** with **Details**, and **Download CSV** (Daily numbers, Works, Breakdown with Plus).
- **What your plan includes:** themes row "All eight, including Sintaks and Warta"; statistics row "Basic numbers, per work" against "Also countries, devices, linking sites". The paragraph under the table lists the features every plan has: Embed, work pages and addresses, Open to work, Save contact, the business card, a password, the three periods and the CSV of basic numbers.

**Labels.** Checked against the current source (Lingui `t`/`Trans` in `intro-form.tsx`, `contact-form.tsx`, `password-group.tsx`, `work-address.tsx`, `business-card-dialog.tsx`, `block-list.tsx`, `add-media-block.tsx`, `media/embeds.ts`, `statistics/*.tsx`, `themes.ts`, and `packages/portfolio/src/messages.ts`), and against the screenshots. Limits come from the code: `PORTFOLIO_SLUG_PATTERN`, `PORTFOLIO_ACCESS_TTL_SECONDS` (12 h), `PORTFOLIO_PASSWORD_FAILURES_PER_HOUR` (100), the lock page's "Wait 10 minutes", and `EMBED_PROVIDER_NAMES`.

**Pictures** (`docs/images/guides/creating-a-portfolio/`). All are 2560×1600 (1280×800 at 2×), light, English UI, `Asia/Jakarta`, WebP q80, with the dev overlays hidden. The fictional persona is Nadia Rahmawati (`portfolio:seed --persona nadia`), on the local dev database only.

- Kept from the earlier round: `editor-content`, `editor-design`, `publish-panel`.
- Replaced:
  - `theme-gallery`: the old file showed the empty Portfolio page, not a gallery. It is now the Create dialog's step 2, from a second fictional account without a portfolio.
  - `work-editor`: the old file showed the removed detail. It is now the work editor with **Page address** beside the work's page in the preview.
- New: `work-page`, `embed-block`, `business-card`, `lock-page`, `statistics`, `work-statistics`. The statistics come from a fictional 30-day seed; the lock page was shown with a test password set, then removed.
- Each picture was opened and checked before it went in.

**Mobile handoff.** `.agents/docs/mobile-release-handoff.md` → Feature parity exceptions → Portfolio gains a "Since Phase 13" paragraph: work addresses and the work-page preview, Business card, Password, Embed blocks, Open to work roles and kinds, Save contact, ranged statistics with Per work, Details, the QR source and CSV.

**Preview PDF link (item 2).**

- **Cause:** the published page links a PDF card through `portfolioFileAddress`. The editor preview passed `ownPictureUrl` as `imageUrl`, which accepts pictures only, so the preview's PDF card had no link.
- **Fix:** `editor/pictures.ts` gains `ownFileUrl(source, origins)`: a picture by `ownPictureUrl`, or a portfolio PDF (`/(api/)uploads/<id>/documents/portfolio/<id>.pdf`) on the app's own origin or its alias, with no query, hash or credentials. That is the server's rule without the file token, which a preview never has. The preview passes it as `imageUrl`.
- **Tests:** a new case in `pictures.test.ts` covers an own PDF and an own picture (linked), and a PDF on another site, outside `documents/portfolio`, or with a query (not linked).

**Checks (guide round):**

- `pnpm --filter web test src/features/docs`: 2 files, 15 tests passed.
- `pnpm --filter web exec vp test run src/features/portfolio/editor/pictures.test.ts`: 4 passed.
- `pnpm --filter web exec tsrs --noEmit`: clean.
- `vp lint --deny-warnings` on the three changed web files: no diagnostics.
- `vp fmt --check` on those files, the guide and the handoff: all formatted.

**Lock-page wording (principal's late item).**

- `tooManyTries` no longer names a duration, because a portfolio can also refuse every try for an hour. It now reads "Too many tries. Try again later." in both `apps/web/src/features/portfolio/page-text.ts` and `packages/portfolio/src/messages.ts`.
- Ran `pnpm exec turbo run lingui:extract --filter=web`. The new msgid is translated in all 55 catalogs (id-ID "Terlalu banyak percobaan. Coba lagi nanti."); the old msgid is gone.
- Ran `pnpm pdf:translations`: `packages/portfolio/src/portfolio-catalog.json` changed only in this string (54 lines).
- The one test that asserted the old wording, `packages/portfolio/src/gate.test.ts:41`, now expects the new text. That was a one-line edit in a file another session also has uncommitted changes in.
- No server or E2E test used the old wording.
- Checks:
  - `pnpm --filter @rezumi/portfolio test`: 31 files, 485 tests passed.
  - `src/features/portfolio/page-text.test.ts` (web): passed.
  - `src/static/portfolio-page.test.ts` (server): 39 passed.
- The guide keeps "a visitor waits 10 minutes" for one browser's tries, which is still the per-address window in `visitor-access.ts`.

## E2E (exact results)

**Setup:**

- Production build with `pnpm exec turbo run build`, which is `pnpm build` without its leading `pdf:translations`, so the shared generated files weren't rewritten mid-round. Result: 5 tasks successful. The build includes the other sessions' uncommitted edits in `packages/portfolio`.
- A fresh disposable database, `rezumi_e2e_pf13`, on the local dev PostgreSQL, created empty and migrated with `pnpm db:migrate`.
- Environment as in `tests/e2e/README.md`: `APP_URL=http://localhost:3330`, `PORT=3330`, generated `AUTH_SECRET` and `ENCRYPTION_SECRET`, signups and email auth on, `FLAG_DISABLE_API_RATE_LIMIT=true`, `FLAG_ALLOW_UNSAFE_AI_BASE_URL=true`, `STORAGE_BACKEND=local` with a scratch `LOCAL_STORAGE_PATH`, and `PORTFOLIO_MODE=on`.
- Command: `pnpm test:e2e tests/e2e/specs/portfolio-phase-13.spec.ts tests/e2e/specs/portfolio.spec.ts --workers=1`. Playwright started `node apps/server/dist/index.mjs` itself.

**Run 1: 2 passed, 4 failed.** All four failures were in the spec's selectors or expectations; the app behaved correctly.

1. _Work page:_ `getByText("Times opened")` matched both the KPI title and the chart caption "Times opened per day". The page, Back, the old address's forward and the dashboard count of 1 had all passed before it. **Fix:** `exact: true`.
2. _Password:_ `getByLabel("Password")` in the dialog also matched the field's "Show password" button. **Fix:** `exact: true`.
3. _Business card:_ the SVG downloaded as `e2e-2-portfolio-…-qr.svg`, while the spec expected the raw username with underscores. `cardFileName` keeps only letters, digits and dashes, as designed and unit-tested. **Fix:** the spec now names the file the same way.
4. _Embed:_ the link prompt is the app's `usePrompt`, a HeroUI `AlertDialog` (role `alertdialog`), so `getByRole("dialog")` waited until the test timed out. **Fix:** `getByRole("alertdialog")`.

**Run 2** (database dropped, recreated and migrated again; same build): **6 passed (32.5s)**, 0 failed.

- `portfolio-phase-13.spec.ts`: 5/5 passed.
  - A work page, Back to home, an old address forwarding to the new one, and the owner's Per work row showing 1 with its Details dialog.
  - Password lock, a wrong password, unlocking, and the work page opening with the same access.
  - The vCard response, plus the business card's `utm_source=qr` value and SVG download.
  - An Embed block shown as a facade with no iframe.
  - The 7/30/90 range kept in the address across a reload.
- `portfolio.spec.ts`: 1/1 passed. It never used the removed detail dialog (it creates, publishes and checks the greeting), so it needed no change.

**Server log during the runs:** every editor open logs `ORPCError: Custom domains aren't set up on this server.` (412, `PRECONDITION_FAILED`) from the custom-domain query, because the test server has no custom-domain config. No test failed on it, but it is noisy, and it may be worth answering that state without an error log (server layer).

**Cleanup:**

- The disposable database was dropped after the run.
- On the shared dev database, the docs persona accounts `portfolio13-docs@example.test` and `portfolio13-docs-new@example.test` (fictional) remain for future picture refreshes.
- `.claude/launch.json` keeps the `rezumi-portfolio-docs` entry (ports 3280/3281).

**Run 3** (final tree, after pf-render and pf-server finished, HEAD `def5cba3` plus the working tree): same steps from scratch.

- Fresh `rezumi_e2e_pf13`; `pnpm db:migrate` exit 0.
- `turbo run build`: 5 tasks successful.
- Playwright run in the foreground: exit 0, **6 passed (30.1s), 0 failed, 0 skipped, 0 flaky**.
  - `tests/e2e/specs/portfolio-phase-13.spec.ts`: 5 passed.
  - `tests/e2e/specs/portfolio.spec.ts`: 1 passed.
- Nothing was skipped: both specs skip only without `PORTFOLIO_MODE=on`, which was set.
- No failure in another layer, so there are no traces to hand over.
- The test database was dropped afterwards.

## Final checks (final tree, exact results)

- `pnpm --filter web typecheck` (`tsrs --noEmit`): exit 0.
- `pnpm --filter web test`: 146 files, 777 tests passed.
- `pnpm --filter @rezumi/portfolio test`: 31 files, 485 tests passed.
- `pnpm --filter web test src/features/docs`: 2 files, 15 tests passed.
- `vp lint --deny-warnings` on the paths below: exit 0, no diagnostics. The paths:
  - `apps/web/src/features/portfolio` and the portfolio routes (`builder/portfolio`, `dashboard/portfolio`, `dashboard/admin/portfolios`);
  - `chip-input.tsx` and `dev-server-proxy.ts` (+ test);
  - both portfolio E2E specs;
  - `packages/portfolio/src/messages.ts` and `gate.test.ts`.
- `vp fmt --check` on the same paths plus the guide, the mobile handoff and this report: 143 files, all formatted.
