# Worker C — Sidebar, Coach panel, Home, Portfolio page, command palette

## What changed

- `apps/web/src/routes/dashboard/-components/app-shell.tsx`
  - Sidebar: Home, Applications, Documents, Portfolio (when `portfolio.status.enabled`), Profile. Coach, Offers and
    the Trash footer entry are gone (the `NavItem["to"]` union shrank to match).
  - Navbar: a **Coach** button (sparkle; text button from `md`, icon button on phones) before Search. It toggles the
    panel (`aria-pressed`, accent-soft when open). Hovering it preloads the coach chunk. On an application workspace
    (`routeId === "/dashboard/applications/$applicationId/{-$tab}"`) it instead navigates there with `coach: true`
    added to the current search, with `replace: true` so B's sheet close leaves no Back entry that reopens it.
  - Panel: `AppLayout`'s own `aside` slot (docked column, 360px, 400px from `xl`) from 1024px up; below that a
    `Sheet` on the right (`md:max-w-[420px]`, full width on phones), same as the job coach sheet. I don't use
    AppLayout's `asideMobile="sheet"` because it renders the `aside` twice below 1024px (column hidden by CSS + sheet),
    which would mount two live chats. On a workspace the panel hides (the open state is kept and comes back on leaving).
    Hidden/closed panel content stays mounted (so a reply keeps streaming) but is `inert`.
  - Remembers the last dashboard `href` (never a coach address) for the coach redirect below.
  - `useCrumbs`: Applications › Offers (checked before the application crumb), Documents › Trash (unchanged),
    Settings › Account / Plan / App settings, Settings › Plan › Payment / Receipt (billing return and receipt pages),
    Settings › Billing admin / Portfolio reports for `/dashboard/admin/*`. Removed the `coach` and `career` cases.
- New `apps/web/src/features/coach-panel/store.ts` (zustand): `open`, `conversationId`, `offerIds`, `lastHref`;
  `openCoachPanel({ conversationId?, offerIds? })` (no args: reopen on the last conversation; `conversationId: null`:
  new one; only `offerIds`: new conversation with those offers), `showConversation`, `toggle`, `setOpen`.
  `store.test.ts` covers these (4 tests).
- New `apps/web/src/features/coach-panel/coach-panel.tsx`: `CoachPanelSlot` lazy-loads `features/career/coach.tsx`
  on first open, keeps it mounted, makes it `inert` when hidden, and returns focus to the navbar Coach on close.
- `apps/web/src/features/career/coach.tsx`: `CoachPage` → `CoachPanel` (props `conversationId`, `offerIds`,
  `onConversationChange`, `onClose`). Header like the editors' assistant (sparkle, "Coach", New conversation, Past
  conversations toggle, Close), then either the chat or the conversation list (search, grouped by day, rename /
  delete with Undo). Conversation switching goes through the store, not the URL. Chat uses `variant="sheet"`.
  Conversation-list empties are `EmptyBlock` (`filtered` with "Clear search", `inline` "Your conversations appear
  here."). The model select no longer carries the history button.
- `apps/web/src/routes/dashboard/coach.{-$conversationId}.tsx`: no page any more. `beforeLoad` opens the panel with
  that conversation (or a new one) and `?offers=` as context, then redirects (`replace`) to the page the person was
  on, or Home when the address is opened directly. Preloads (hover) don't open it. `/dashboard/career/coach/…` still
  redirects here, and Offers' "Plan what to ask" (`/dashboard/coach?offers=…`) keeps the person on Offers with the
  panel open and the "1 saved offer" chip on.
- `apps/web/src/features/career/coach-chat.tsx`: the saved-offer link now goes to `/dashboard/applications/offers`.
- `apps/web/src/features/career/today.tsx`: Home's empties → `EmptyBlock kind="inline"`: Needs you ("You're up to
  date", with "Show N read"), New roles (set up discovery / paused / next run), Schedules ("Nothing scheduled yet."
  with an Add button). HeroUI `EmptyState` import removed.
- `apps/web/src/features/portfolio/portfolio-page.tsx`: "Turn your Profile into a portfolio website" → `EmptyBlock
  kind="page"` with Create portfolio.
- `apps/web/src/features/command-palette/pages/navigation.tsx`: added Offers (`/dashboard/applications/offers`),
  Coach (opens the panel; from outside `/dashboard` it goes to Home first), Portfolio (only when enabled). Trash keeps
  `/dashboard/trash` (also matches "Documents"). `content.tsx`: the "No commands match" empty → `EmptyBlock
  kind="filtered"` (only visible signed out, since the Ask row fills any signed-in search).
- `.claude/launch.json` (gitignored): added `rezumi-nav-c` (3340/3341).

## Decisions

- **Coach welcome keeps its orb, not `EmptyBlock`.** The new-conversation view in the panel (orb, "What are you
  working on?", three starters) is the chat's start screen, and its orb flies to the first "Thinking…" line
  (`OrbFlightProvider` / `orbLanding`), the same as the editors' assistant. `EmptyBlock` takes only an icon, so
  converting it would drop that animation. I restyled it to the assistant's compact size instead. B converted the
  job coach sheet's empty chat to `EmptyBlock` and noted the lost orb; principal: pick one rule for both (either
  restore B's orb, or give `EmptyBlock` a media slot and convert mine).
- Panel open state lives in memory (survives navigation, not a reload). The last conversation is kept between
  openings.
- On a workspace the general panel hides rather than sitting beside the job coach sheet: two coaches at once read as
  one too many.

## Checks run

- `pnpm --filter web typecheck`: passes (whole web app, last run after all edits).
- `pnpm exec vp lint --fix`, `vp fmt`, `vp lint --deny-warnings --format=agent`, `vp fmt --check` on my paths
  (app-shell, coach route, `index.tsx`, `coach*.tsx`, `today.tsx`, `schedule-sheet.tsx`, `portfolio-page.tsx`,
  `command-palette/**`, `coach-panel/**`): clean. No `@heroui-pro` `EmptyState` import left in my files.
- `pnpm --filter web test src/features/coach-panel`: 4 passed. `src/features/career/knowledge src/features/career/
  workspace`: 5 files, 45 passed. No existing tests cover app-shell, today, coach or the palette.
- Browser (`rezumi-nav-c`, 127.0.0.1:3340, account `navc-tester@example.test`, Indonesian UI), desktop 1440×900:
  5-entry sidebar; Home inline empties; Coach opens the docked panel and stays open from Home → Documents; history
  view with its inline empty; `/dashboard/coach` loaded directly → Home with panel open; in-app navigation to
  `/dashboard/coach?offers=x1` from Offers → stays on Offers, panel open, offers chip shown; workspace hides the panel
  (`data-state="closed"`, inert) and the navbar Coach opens B's job coach sheet (`?coach=true`); palette "Coach"
  opens the panel; Portfolio empty state; breadcrumbs: Lamaran › Penawaran, Dokumen › Sampah, Pengaturan › Akun,
  Pengaturan › App settings, Profil › Cerita, Portofolio. 375×812: Coach icon in the navbar opens the full-width
  sheet with the chat. No console errors.

## Cross-area

- **e2e** (`tests/e2e`, not edited): `specs/career.spec.ts:59` does `page.goto("/dashboard/coach")`, then fills
  "Ask about your next career step…". It now lands on `/dashboard` with the panel docked (Playwright's default
  1280×720 is ≥ 1024px), so it should still pass, but the story-approval screenshot is now of the narrower panel.
  Nothing in `tests/e2e` names the sidebar's Coach, Offers or Trash links or `/dashboard/career/offers`.
- **B**: Offers' "Plan what to ask" can keep linking to `/dashboard/coach?offers=…` (works, stays on Offers). Calling
  `openCoachPanel({ offerIds: [a, b] })` from `@/features/coach-panel/store` instead would skip the redirect.
- **Principal**: new msgids from me: "Close the coach", "Past conversations" (exists in assistant), "Clear search"
  (exists), "Nothing is titled “{query}”.", "Payment"/"Receipt" (exist in billing). Extract
  and translate as usual. "App settings" is A's.
- Docs: `docs/` user guides that mention the Coach page or sidebar Coach/Offers entries need the career-platform
  guide pass (not done; not in my file set).

## Not done

- No Indonesian strings and no `lingui:extract` (principal's step).
- Panel open state does not survive a reload (in memory on purpose; easy to add a cookie if wanted).
- Dev server `rezumi-nav-c` is still running; the test account `navc-tester@example.test` and one application
  ("Product Designer · Example Co") stay in the local `postgres` database.
