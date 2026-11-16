# Worker A — Settings and Documents

## Settings pages (for C's breadcrumbs)

Section title: **Settings** (`t\`Settings\``). Menu, in order:

| Menu label                  | Address                                                                                | Shown                           | Page header title                         |
| --------------------------- | -------------------------------------------------------------------------------------- | ------------------------------- | ----------------------------------------- |
| Account                     | `/dashboard/settings/account`                                                          | always                          | Account                                   |
| Plan                        | `/dashboard/settings/billing` (fuzzy: also `billing/return/…` and `billing/receipt/…`) | `usePlan()?.enabled`            | Plan                                      |
| App settings (new msgid)    | `/dashboard/settings/app`                                                              | always                          | App settings                              |
| _group "Admin"_ (new msgid) |                                                                                        | `session.user.role === "admin"` |                                           |
| Billing admin               | `/dashboard/admin/billing`                                                             | admins                          | (admin route, outside the section layout) |
| Portfolio reports           | `/dashboard/admin/portfolios` (`search: {}`)                                           | admins                          | (admin route, outside the section layout) |

Suggested crumbs: Settings › Account, Settings › Plan (› Payment / Receipt for the billing subpages), Settings › App
settings. `/dashboard/settings` itself redirects to Account, so it never shows on its own.

## What changed

- `routes/dashboard/settings/route.tsx`: `SectionLayout` (`contentWidth="narrow"`) with the items above. Version +
  docs/legal links in `footer` (under the menu, `md` and up) and again after the page on phones (`md:hidden`). The old
  phone "Back" link is gone (chips replace the drill-down).
- `routes/dashboard/settings/index.tsx`: `beforeLoad` redirect to `/dashboard/settings/account` on every screen size.
- `features/settings/root.tsx`: **deleted** (phone root list + `popTransition`; no other users).
- Old redirects untouched: `/settings/ai`, `/api-keys`, `/job-search`, `/preferences`, `/integrations` → `/app#…`;
  `/settings/profile`, `/settings/authentication` → `/account`. Checked `/settings/ai` → `/settings/app#ai-providers`.
- Page headers: Account gets a description ("Your details, how you sign in, and your data."); the app page's title
  is now "App settings" (was "Settings", which doubled the section name); Plan gets "What your plan includes, and
  your payments." (both of its headers).
- Documents: new `features/documents/documents-layout.tsx` (`DocumentsLayout`, `contentWidth="full"` default):
  All / Resumes / Letters (`/dashboard/documents?type=…`, `current` override, links keep the rest of the search:
  q, tags, sort, view) and Trash (`/dashboard/trash`). Counts from `orpc.documents.counts` (same query as the
  sidebar, so no extra request). `routes/dashboard/documents.tsx` and `routes/dashboard/trash.tsx` wrap their pages
  in it, so Trash renders inside the same section.
- `features/documents/documents-page.tsx`: no own `Page` any more; the type `Segment` is gone (the menu does it);
  title follows the type (Documents / Resumes / Letters); toolbar = search, then sort + Grid/List together at the end
  (they wrap as one row). "Clear search and filters" no longer resets the type.
- `features/documents/trash-page.tsx`: no own `Page`, no "Back to documents" link (the menu is there).
- Empty states → `EmptyBlock`:
  - Documents first run (`FirstRun`, also used by Home): `page` — "Let's start with what you have", one sentence,
    Choose a file (primary), Start blank (secondary), Try a sample (ghost). The "Fill in your Profile first" link was
    dropped (Start blank already starts from the Profile).
  - Resumes / Letters with none of that type (but other documents exist): `page` — "No resumes yet" + New resume
    (opens the New dialog); "No letters yet" + New cover letter (creates one, as the dialog's letter button does).
  - Search/tags/public with no match: `filtered` with "Clear search and filters".
  - Trash empty: `page`.
  - Settings: AI providers (`inline` + Add provider), API keys (`inline`), Connected applications (`inline`, was a
    plain paragraph).
  - Billing admin: no subscriptions, history, customer payments (`inline`); payments search with no match
    (`filtered`, names the search), no payments in period (`inline`).
- `.claude/launch.json`: added `rezumi-sections-a` (3320/3321).

## Checks

- `pnpm --filter web typecheck`: no errors in my files. Errors at the time of the run were only in B/C files
  (`applications/components/detail/activity.tsx`, `career/workspace/coach-sheet.tsx`, `career/workspace/debrief.tsx`
  unused imports; `routes/dashboard/coach.{-$conversationId}.tsx` missing `CoachPage`).
- `vp lint --fix`, `vp fmt`, `vp lint --deny-warnings --format=agent` on all my changed files and on
  `features/settings`, `features/documents`, `features/billing`, `routes/dashboard/settings`: clean. No
  `@heroui-pro/react` `EmptyState` import left in my areas (only the DataGrid prop `renderEmptyState`).
- `pnpm --filter web test src/features/documents src/features/settings src/features/billing`: 22 files, 80 tests
  passed.
- Browser (own server 3320/3321, admin test account `worker-a-nav@example.test`): desktop and 375px for Settings
  (index → Account, admin group, footer under the menu; phone chips + links at the end, no sideways scroll), App
  settings, Plan, old `/settings/ai` redirect; Documents first run (phone), Letters empty, All with one resume,
  `?q=zzz` filtered, Trash empty (desktop, breadcrumb already "Documents › Trash"), Documents with a resume at 375px
  (no sideways scroll).

## Cross-area

- **C (Home)**: `FirstRun` from `features/documents/documents-page.tsx` now renders an `EmptyBlock kind="page"`
  (centred, icon, three buttons) instead of the left-aligned block with a dashed drop row. Home's first-run look
  changes with it; same props (`onChooseFile`).
- **C (breadcrumbs)**: labels/addresses in the table above. "App settings" and "Admin" are new msgids.
- **Principal**: `index.css` still has the `forward`/`back` view-transition rules for the old phone drill-down; no
  code uses those types any more (safe to remove). New msgids to extract/translate: App settings, Admin, the
  Account/Plan descriptions, FirstRun's new sentence, No resumes yet / No letters yet and their sentences, New
  resume, New cover letter, No connected applications yet. / Apps you allow… (split from one string), Nothing matches
  “{query}” (admin).
- **Everyone testing in the browser pane**: sessions on `127.0.0.1` share cookies across ports, so signing in on one
  worker's server signs the others' tabs into that account too (my tab ended up as B's user mid-check).

## Not done / noticed

- Pre-existing: on 375px in Indonesian, the Theme `Segment` in App settings › General clips "Sistem operasi". Not
  changed (outside this task's scope).
- Console shows a React "called use() to suspend … did not call use()" error from a lazy component; not from these
  files as far as I can tell.
- Settings › App settings stays one page (owner decision 2026-10-30, extension tests link `/app#connected-apps`);
  its groups are not separate menu items because the menu can't follow the scroll position.
