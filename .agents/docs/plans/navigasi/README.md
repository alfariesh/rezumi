# Navigation and section layout (2026-11-16)

Owner's request (in Indonesian, paraphrased): the sidebar has too many entries; merge Applications, Offers and Coach
where it makes sense. Screens with several pages (Profile, Settings) should show a menu beside the content, laid out
like the resume/portfolio editors, not tabs or segments. Empty states are inconsistent. Owner said "just do it", so
the defaults below are decisions, not open questions.

Branch: `feat/web-section-layout`, one shared checkout (`/Users/salmanalfariesh/Documents/Vitaekit`). Workers never
commit, never switch branch, never run `git stash`/`reset`/`checkout -- <file>`. The principal commits by path.

## Final state (shipped on this branch)

Rounds: round 1 (sections A/B/C below), round 2 (owner feedback: sidebar order, no view tabs, coach full screen,
empty-state buttons side by side), a rail+card experiment the owner rejected (reverted), alignment fixes, an
independent review's fixes, then round 3 (owner: applications layout as a switch, Profile Details/Career split, page
titles on the sidebar's first row, loading outlines). Worker reports in `laporan/` describe each round as it was; this
section is what is true now.

- Sidebar (`routes/dashboard/-components/app-shell.tsx`): **Home, Portfolio (when enabled), Documents, Profile,
  Applications** (owner's order). No Coach, Offers or Trash entries (Trash marks Documents current); Settings stays in
  the account menu.
- `components/layout/section-layout.tsx` → `SectionLayout`: a text menu on the left (icon + label + count/badge),
  sticky; no section title or group headings (each page's own `PageHeader` names it), groups set apart by a
  hairline. Phones: the menu as a chip row. Header and content share one column. `SectionNavItem`: `link`, `match`,
  `icon`, `label`, `count?`, `badge?`, `group?`, `current?`. TanStack's own active marking only counts exact matches
  with the search, so one item is `aria-current` at a time.
- `components/layout/page.tsx` → `Page`: from 768px a 12px top margin, so page titles and section menus start on the
  app sidebar's first row; the navbar row is capped at the same width (`PAGE_MAX_WIDTH`) and its toggle and crumbs
  line up with a section menu's icons and labels.
- Sections: Profile (Details, Career at `/dashboard/profile/career`, Facts, Stories, Preferences), Settings (Account,
  Plan, App settings, admin group; the admin pages render in it), Documents (All, Resumes, Letters, Trash),
  Applications (All, Insights, Offers at `/dashboard/applications/offers`; on All a List/Board/Calendar layout switch
  beside the search, kept on the device, list only on phones; `?view=` still opens a view), the application
  workspace (Fit, Apply | Prepare, Practice, Debrief | Messages, Saved; `WORKSPACE_TABS` unchanged).
- Applications: an application opens only in the side sheet (bottom sheet on phones).
- Coach: a panel from the navbar's Coach button (docked from 1025px, a sheet below that closes when a chat link opens
  a page), styled like the editors' assistant, with "Open full screen" → `/dashboard/coach/{-$conversationId}` and
  "Back to the panel". On a job workspace the navbar button and the command palette open that job's coach sheet
  (`features/coach-panel/launcher.ts`).
- `components/layout/empty-block.tsx` → `EmptyBlock` (`page` / `filtered` / `inline`, optional `media` with no tile):
  h5 titles, actions side by side. Lint forbids HeroUI Pro `EmptyState` elsewhere in `apps/web/src`.
- Loading: `components/layout/loading-screen.tsx` shows a section's menu rows as skeletons beside the page outline
  while a section page's code loads; pages keep their own data skeletons.
- Old addresses redirect: `/dashboard/career/offers` (keeps `a`/`b`), `/dashboard/career/coach…`, settings subpages.

## Round 1 contract (historical)

### Round 1 target

Sidebar (`apps/web/src/routes/dashboard/-components/app-shell.tsx`): **Home, Applications, Documents, Portfolio,
Profile**. Coach leaves the sidebar and becomes a panel opened from the top bar on every dashboard page. Offers moves
into Applications. Trash moves into Documents' section menu. Settings stays in the account menu.

### Round 1 building blocks

- `section-layout.tsx`
  - `SectionLayout`: section menu on the left, current page on the right; phones get the menu as a chip row. Props:
    `title`, `items: SectionNavItem[]`, `contentWidth` (`"narrow"` 720px for forms, `"full"` default), `footer`.
  - `SectionNav`: the menu alone, for pages with their own layout (application workspace).
  - `SectionNavItem`: `link` (TanStack `LinkOptions`), `match: { to, fuzzy }`, `icon`, `label`, `count?`, `group?`
    (heading above a run of items), `current?` (override when the address alone can't tell, e.g. search params).
  - Each page under a `SectionLayout` renders its **own** `PageHeader` (title + one-sentence description + actions).
  - Rule: a section menu is for _different pages_. Different _views of the same data_ (Board/List/Calendar,
    Grid/List) stay a `Segment` inside the page.
- `empty-block.tsx` — `EmptyBlock` with `kind`:
  - `page`: nothing here yet. Icon, title naming what goes here, one sentence, one primary action.
  - `filtered`: search/filter matched nothing. Say what was searched; action "Clear filters"-style secondary button.
  - `inline`: small part of a page (widget, card, sheet). One line + optional link, dashed border, no big icon.
  - Lint (`vite.config.ts`) forbids importing `EmptyState` from `@heroui-pro/react` anywhere in `apps/web/src`
    except `empty-block.tsx`. `pnpm exec vp lint --format=agent apps/web/src` lists what is left to migrate.
  - Hand-made empty states (plain text, custom components) in your files also move to `EmptyBlock`.
- Reference implementation: `apps/web/src/routes/dashboard/profile/*` (layout + per-page `PageHeader`).
- View transition name `section-nav` (index.css) keeps the menu still while pages change.

## Work split (strict file ownership)

### A — Settings and Documents

Owns: `apps/web/src/routes/dashboard/settings/**`, `apps/web/src/features/settings/**`,
`apps/web/src/routes/dashboard/documents.tsx`, `apps/web/src/routes/dashboard/trash.tsx`,
`apps/web/src/features/documents/**`, `apps/web/src/features/billing/**` (only for layout/empty states).

- Settings on `SectionLayout` (`contentWidth="narrow"`): one menu item per page (Account, Plan when enabled,
  Settings/app, and any real subpages: AI, API keys, integrations, authentication — inspect what exists; long pages
  with `#hash` groups may become their own items if each group already has an anchor, linking with `hash`). Admin
  links (billing admin, portfolio reports) as a group for admins only. Version + legal links in the `footer` (and
  still reachable on phones, e.g. at the end of the content). `/dashboard/settings` index goes to Account on every
  screen size (the phone drill-down list is replaced by the chip row). Keep existing redirects.
- Documents on `SectionLayout` (`contentWidth="full"`): items All, Resumes, Letters, Trash (with count, only
  linking to `/dashboard/trash`, which renders inside the same section layout). Type items use `?type=` and the
  `current` override. Keep the page's own search/tags/sort/view toolbar inside the content.
- Empty states in all owned files via `EmptyBlock`.

### B — Applications, Offers, application workspace

Owns: `apps/web/src/routes/dashboard/applications/**`, `apps/web/src/features/applications/**`,
`apps/web/src/features/career/workspace/**`, `apps/web/src/features/career/offers.tsx`,
`apps/web/src/features/career/offer-compare*.ts`, `apps/web/src/routes/dashboard/career/**`.

- Offers becomes `/dashboard/applications/offers` (same search params `a`, `b`), reached from the Applications page
  header (a button such as "Compare offers", with the number of saved offers when > 0). `/dashboard/career/offers`
  redirects there keeping `a`/`b`. Breadcrumb data: tell C the label; C edits `useCrumbs`.
- Application workspace: replace the horizontal `Segment` of 7 tabs with `SectionNav` on the left. Keep the 7 tab ids
  and URLs (`WORKSPACE_TABS` in `packages/schema` stays unchanged: notifications, MCP, extension and the mobile app
  use them). Present 5 menu entries: Fit, Apply, Interview (covers prepare, practise, debrief: inside it a `Segment`
  switches between the three, each still its own URL), Messages, Saved. Keep the existing badges (minutes to
  interview, unread messages, saved count) on the menu entries via `count` or an equivalent. Keep the context column
  (`Disclosure`) working; choose a sensible place for it (e.g. right column on wide screens or above content).
- Empty states in all owned files via `EmptyBlock` (board `renderEmptyState`, `FirstJobEmptyState`, calendar, detail
  activity/contacts, workspace tabs, offers).

### C — Sidebar, Coach panel, Home, Portfolio page, command palette

Owns: `apps/web/src/routes/dashboard/-components/app-shell.tsx`, `apps/web/src/routes/dashboard/coach.*.tsx`,
`apps/web/src/routes/dashboard/index.tsx`, `apps/web/src/features/career/coach*.tsx`,
`apps/web/src/features/career/today.tsx`, `apps/web/src/features/career/schedule-sheet.tsx`,
`apps/web/src/features/portfolio/portfolio-page.tsx`, `apps/web/src/features/command-palette/**`,
`apps/web/src/features/assistant/**` (read; edit only if the panel needs it), new files under
`apps/web/src/features/coach-panel/` (or similar).

- Sidebar: Home, Applications, Documents, Portfolio (when enabled), Profile. No Coach, Offers or Trash entries.
- Coach panel: a "Coach" button (sparkle icon) in the navbar on every dashboard page opens a right-side panel
  (HeroUI `Sheet`, or a docked column on wide screens like the editors' AI column — pick what matches the editors)
  holding the existing coach experience: conversation list/history, new conversation, chat. Open state survives
  navigation between dashboard pages. On an application's workspace, the button opens that job's coach (the existing
  `?coach=` sheet in B's area: just navigate with that search param; do not edit B's files).
  `/dashboard/coach/{-$conversationId}` (and its `?offers=` search) keeps working: it opens the panel with that
  conversation / those offers as context (redirect to Home + open, or render Home with the panel open). Offers'
  "Plan what to ask" links there and must still work.
- `useCrumbs`: Documents › Trash, Applications › Offers (`/dashboard/applications/offers`), Settings pages (A will
  list labels in its report; read A's route files for titles), Profile pages unchanged. Remove the Coach/Offers cases
  that no longer exist.
- Command palette: destinations match the new structure (Coach opens the panel; Offers goes to the new address).
- Empty states in all owned files via `EmptyBlock` (today/Home widgets, portfolio page, coach's own empty state).

## Rules for every worker

- Read `CLAUDE.md` (root) first. Web only; no `apps/mobile` changes. No new dependencies.
- User-facing strings via Lingui macros. **Do not run `pnpm lingui:extract` and do not edit `apps/web/locales/*`**:
  the principal extracts once and adds Indonesian at the end. Prefer reusing existing English msgids.
- Keep old URLs working with redirects (notifications, emails, the browser extension and older app builds link
  to them).
- Checks on your own files: `pnpm --filter web typecheck`, `pnpm exec vp lint --fix <paths>`,
  `pnpm exec vp fmt <paths>`, `pnpm exec vp lint --deny-warnings --format=agent <paths>`, and the Vitest files next
  to what you changed (`pnpm --filter web test <path>`). Fix tests you break in your area. If a check fails only in
  another worker's files, note it, don't fix it.
- Browser check: run your own dev server from `.claude/launch.json` with a free port (copy `rezumi-sections`, change
  the ports to yours: A 3320/3321, B 3330/3331, C 3340/3341). Sign up a throwaway `…@example.test` account through
  `/api/auth/sign-up/email` (needs `username` and `displayUsername`), mark it verified with SQL against the local
  `postgres` database, and look at desktop and phone width (375px).
- Write a report at `.agents/docs/plans/navigasi/laporan/<A|B|C>.md`: what changed (files), decisions, checks run
  and results, **Cross-area** (anything another worker or the principal must do), **Not done**.
