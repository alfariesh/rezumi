# Report B — Applications, Offers, application workspace (2026-11-16)

## What changed

**Offers under Applications**

- New `apps/web/src/routes/dashboard/applications/offers.tsx`: `/dashboard/applications/offers` (search `a`, `b`), its own
  `Page` + `PageHeader` (title "Offers", the old description, a small "‹ Applications" back link).
- `apps/web/src/routes/dashboard/career/offers.tsx` is now a redirect to the new address, keeping `a`/`b` (checked in
  the browser: `/dashboard/career/offers?a=x1&b=y2` → `/dashboard/applications/offers?a=x1&b=y2`).
- `apps/web/src/routes/dashboard/career/route.tsx` **deleted**: every child under `career/` is a redirect now (index →
  Home, coach, knowledge/*, offers), so the layout had nothing to render. Route tree regenerates on dev/build.
- `apps/web/src/routes/dashboard/applications/index.tsx`: header button "Compare offers" (scales icon; icon-only on
  phones with an aria-label) linking to Offers, with a count chip when saved offers > 0
  (`orpc.career.savedItems` with `kind: "offer"`). Hidden only on the first-job empty state while there are no offers.
- `features/career/offers.tsx`, `workspace/saved.tsx` ("Open in Offers"), `workspace/shell.tsx` ("Compare offers" in the
  header): links/navigation point at the new address.

**Application workspace** (`features/career/workspace/shell.tsx`)

- The 7-tab `Segment` is replaced by `SectionNav` (title "Workspace sections", `showTitle={false}`) with 5 entries:
  Fit, Apply, Interview, Messages, Saved. Each entry sets `current` itself (the address has no tab when the stage picks
  the default). `WORKSPACE_TABS` untouched; all 7 URLs still open their content (checked each in the browser).
- Interview covers prepare/practise/debrief: it links to the current one of the three, else Debrief when the round has
  ended, else Prepare. Inside, a `Segment` (Prepare / Practice / Debrief) switches between them, each its own URL.
- Badges on the menu entries (principal's new `SectionNavItem.badge`): Interview shows the countdown chip ("40 min",
  "3 h"; warning colour in the last hour; only within a week), Messages an accent chip with the unread reply; Saved
  uses `count`. The Interview `Segment` has no badge any more.
- Panel: one `<section aria-label={tab}>` for the current tab instead of 7 `role="tabpanel"` divs (there is no tablist
  any more).
- Context column: from 1024px the left column (264px, 300px from 1280px) holds the menu with the details (next step,
  documents, notes) under it, like the old details column; the menu is not sticky there so the details scroll with it.
  Below 1024px the details fold into the "Details" disclosure above the panel; phones get the menu as chips.
- Skeleton follows the new layout. `defaultTab` comment updated (offers compared in Applications › Offers).

**EmptyBlock everywhere in my files** (no `EmptyState` import left; lint rule clean)

- `routes/dashboard/applications/index.tsx`: `FirstJobEmptyState` → `page` (Save job, Import from CSV, extension hint
  on its own row); search with no match → `filtered` with "Clear search".
- `features/applications/components/`: board column `renderEmptyState` → `inline` "No applications"; calendar "Nothing
  scheduled yet" → `inline` with Schedule interview; `detail/activity.tsx` → `inline`; `detail/contacts.tsx` → `inline`
  with Add contact; `insights-view.tsx` "No source data yet." → `inline`; `application-detail-sheet.tsx` pane
  placeholder → `page`.
- `features/career/workspace/`: shell (application couldn't be opened) → `page`; fit, saved, prepare (`Notice`) →
  `page`; debrief week plan → `inline`; coach-sheet empty chat → `page` with sparkle icon and title "Ask the coach"
  (reused msgid; the `HeadingOrb` is gone because `EmptyBlock` takes an icon name).
- `features/career/offers.tsx`: "No offers to compare yet" → `page` with "Open applications".

**Tests**: `workspace/shell.test.tsx` — router mock gains `useMatchRoute` and passes `aria-current`; breakpoint mock is
`"wide"`; mount takes `tab` and `activity`; three new tests (five entries with Interview current on `practise` and its
three-way switch; no switch on other sections; countdown on the Interview entry). `workspace.test.tsx` needed no change.

## New/changed strings (for extraction)

New msgids: "Interview" with context "Application workspace section: prepare, practise and debrief"; "Compare offers
({offerCount})" (aria-label); "Search reads the role, company, location, contacts and tags."; "Open applications";
"No application open". "Compare offers", "Offers", the Offers description, "Ask the coach", "Applications" are reused.

## Checks

- `pnpm --filter web typecheck`: my files clean. One error left in C's area:
  `src/features/coach-panel/store.test.ts(1,50)` imports `vitest` (should be `vite-plus/test`). Earlier run also showed
  C's `routes/dashboard/coach.{-$conversationId}.tsx` importing a removed `CoachPage`; gone on the last run.
- `pnpm exec vp lint --fix` / `vp fmt` / `vp lint --deny-warnings --format=agent` / `vp fmt --check` on my paths: clean.
- `pnpm --filter web test src/features/career/workspace src/features/applications`: 20 files, 99 tests passed.
- Browser (own server `rezumi-sections-b`, 3330/3331, throwaway `navb-tester@example.test`, verified by SQL, two
  applications): 1440px, 900px and 375px. All 7 tab URLs mark the right menu entry and render the right panel; the
  Interview switch changes the URL; Offers redirect keeps `a`/`b`; Offers and Saved empty states; Applications header
  button (icon-only on phones); no horizontal page scroll at 375px. After the badge change: an interview 40 minutes out
  shows "40 min" in warning colour on Interview, one line in the menu (1440px) and in the chip row (375px).
- Local tip: sessions on `127.0.0.1:<port>` share cookies across ports, so signing in on one worker's server signs the
  others out; I switched to `localhost:3330`.

## Cross-area

- **C**: breadcrumb for Offers looked right already ("Applications › Offers") in my browser check. Still on the old
  address (works through the redirect): `features/career/coach-chat.tsx:592`, and `app-shell.tsx` / command palette if
  they still list `/dashboard/career/offers`. Note left in the shared notes folder (`B-to-C-offers-crumb.md`).
- **C**: the workspace header's "Ask the coach" still opens the job's coach sheet through `?coach=` (unchanged).
- `.claude/launch.json`: added `rezumi-sections-b` (3330/3331); not my file, the contract asked for it.
- Mobile handoff (`.agents/docs/mobile-release-handoff.md`, feature parity): web's workspace now groups prepare/
  practise/debrief under Interview and Offers lives under Applications; mobile is on hold, so not written there.

## Not done

- The coach sheet's empty chat lost its animated orb (EmptyBlock takes an icon); restore only if `EmptyBlock` gains a
  media slot.
- No Indonesian strings, no `lingui:extract` (principal's step).
- Dev server `rezumi-sections-b` and the local test account/applications remain in the local `postgres` database.
