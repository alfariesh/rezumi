# Web app migration to HeroUI

Status: Phases 0–4 done (October 30, 2026); Phase 5 (builder and letters) next.
Date: October 29, 2026.

## Decisions

Owner decisions, October 29, 2026:

- **Scope:** `apps/web` app surfaces: dashboard, builder, letters, applications, career, assistant, settings, auth, command palette and dialogs. The marketing homepage (`features/homepage`, `routes/_home`) keeps its look. The native app (`apps/mobile`) is out of scope here; a HeroUI Native migration is separate work.
- **Look:** full HeroUI default theme. Use HeroUI default tokens, radius, font (system stack), focus ring and the default blue accent, which suits the new `#00BAFF` logo. Desk & Paper tokens, Figtree, Instrument Serif and Geist Mono leave the app UI. Resume and letter paper, templates and PDF fonts are unchanged.
- **Icons:** Hugeicons Stroke Rounded, through `@hugeicons/react` and `@hugeicons/core-free-icons`. The free set is the Stroke Rounded style. Pin `@hugeicons/core-free-icons` to 4.3.5; 4.4.0 was published October 28, 2026. Icons inside resumes stay Phosphor names drawn by `@phosphor-icons/web`, because they are stored in resume data.
- **Components:** use `@heroui/react` (OSS) and `@heroui-pro/react` (Pro) directly at call sites. When neither has a component, build one in `packages/ui` from HeroUI tokens, primitives and BEM-style class names, so it reads as HeroUI.
- **Delivery:** phased. Each phase builds, passes the checks below and is a separate Conventional Commit on a migration branch.

## Reference notes

API notes written from the HeroUI MCP docs and checked against installed `@heroui/react` 3.2.7 and `@heroui-pro/react` 1.0.0-beta.10:

- [OSS A–L](../heroui/oss-a-l.md): Accordion through Link, plus the `packages/ui` mapping and call-site counts.
- [OSS M–Z and theming](../heroui/oss-m-z-theming.md): ListBox through Typography, default tokens, the token and utility mapping, and toast call shapes.
- [Pro navigation and overlays](../heroui/pro-navigation-overlays.md): Navbar, Command, ContextMenu, Stepper, Sheet, EmojiPicker, Resizable.
- [Pro data display](../heroui/pro-data-display.md): DataGrid, ListView, EmptyState, ActionBar, ItemCard, KPI, Timeline, Widget and others.
- [Pro forms](../heroui/pro-forms.md): Cell controls, CheckboxButtonGroup, DropZone, InlineSelect, NativeSelect, NumberStepper, RadioButtonGroup, RichTextEditor, and TanStack Form wiring.
- [Pro AI, feedback and charts](../heroui/pro-ai-feedback-charts.md): chat primitives, PromptInput, Markdown, NumberValue, charts.

AppLayout, Sidebar, Kanban, Agenda and Segment were read in full for this plan; their key APIs are summarized under the phases that use them.

## Rules for every phase

- **Direct HeroUI APIs.** `onPress` instead of `onClick`; `isDisabled`, `isPending`, `isOpen`, `isSelected`; compound parts with dot notation. A thin helper in `packages/ui` is allowed only for a pattern repeated in at least five places (for example a labelled switch row) and must compose HeroUI parts, not restyle them.
- **Translated strings.** HeroUI and HeroUI Pro ship English defaults (Command placeholder, Navbar `srLabel`, CodeBlock copy label, Toast close, Agenda labels, skin-tone label and others). Pass Lingui strings for every visible or accessible default, then run `pnpm lingui:extract`.
- **Locale and direction.** React Aria reads locale and direction from its `I18nProvider`. Phase 0 adds it with the Lingui locale, so RTL locales (ar, fa, he) and number and date formats follow the app language.
- **Routing.** A React Aria `RouterProvider` at the root, wired to TanStack Router (`navigate` and `useHref`), makes `href` on HeroUI items (Sidebar, Navbar, Link, Tabs, ListBox, Table rows) navigate client-side.
- **Feature parity.** A visual restyle needs no mobile change. A capability that is new on the web, such as Agenda week and day views or drag-to-reschedule, needs the matching mobile change or an owner exception recorded in `.agents/docs/mobile-release-handoff.md`.
- **Accessibility.** Keep WCAG 2.2 AA: keyboard and menu alternatives for every drag, labelled icon-only buttons, focus return on close. React Aria provides most of it; do not remove an existing alternative (for example the card menu's Move to…).
- **Checks per phase:** `pnpm exec vp lint --fix` and `pnpm exec vp fmt` on changed paths, then `pnpm lint:agent`, `pnpm format:check`, `pnpm --filter web typecheck`, `pnpm --filter @rezumi/ui typecheck`, the affected Vitest suites, `pnpm exec turbo boundaries`, and the matching Playwright specs. Check light, dark, a phone width and an RTL locale in the browser.

## Phase 0: Foundation

Goal: HeroUI theme active everywhere with no broken screen; old components still render.

1. **Dependencies.** Add `@hugeicons/react` and `@hugeicons/core-free-icons@4.3.5` to the catalog and `packages/ui`. Add Pro peers only when a phase adopts the component that needs them: `recharts` (charts, KPI), `@number-flow/react` (NumberValue), and `marked`, `remark-breaks`, `streamdown`, `shiki` (Pro Markdown imports all four statically).
2. **Theme.** In `packages/ui/src/styles/globals.css`, delete the Desk & Paper definitions that shadow HeroUI variables (`--surface`, `--accent`, `--accent-hover`, `--accent-soft`, `--danger`, `--danger-soft`) and the rest of the palette. Keep only custom tokens HeroUI lacks: `--paper` (white in both themes), `--stage-*`, `--shadow-page`, layout constants (`--editor-bar`, `--editor-panel`, `--sheet-*`, `--assistant`), motion durations and `--tooltip-delay: 400ms`. HeroUI has no info role and its info toasts use the accent, so the old `info-*` names alias the accent-soft tokens instead of adding a custom color.
3. **Temporary aliases.** Add `packages/ui/src/styles/legacy-aliases.css` mapping old utility names to HeroUI variables (`ink` → `foreground`, `ink-2`/`ink-3` → `muted`, `sunken` → `default`, `line` → `border`, `raised` → `overlay`, `warn` → `warning`, `shadow-e1/e2/e3` → `shadow-surface/overlay/overlay`). Untouched screens adopt the HeroUI palette immediately; each later phase removes the old names from its files; Phase 9 deletes the file.
4. **Homepage scope.** Move the Desk & Paper values and its fonts (Figtree, Instrument Serif, Geist Mono imports) into `features/homepage/landing.css` under `.landing`, so the homepage keeps its look.
5. **Fonts.** Drop the app's `font-ui` and `font-display` usage in favour of HeroUI's system stack. Keep `font-mono` mapped to HeroUI's `--font-mono` for shortcuts, URLs and counts.
6. **Providers in `routes/__root.tsx`.** Add React Aria `I18nProvider` (Lingui locale) and `RouterProvider` (TanStack Router). `Toast.Provider` replaces the old `Toaster` in batch 1g, together with the call sites. Keep Base UI `DirectionProvider` until Base UI is gone.
7. **Icons.** Re-implement `packages/ui/src/components/icon.tsx` on Hugeicons, keeping the `Icon name="…"` API and `IconName` keys so the 162 importing files compile unchanged. Map each of the ~109 names to a Stroke Rounded glyph; mirror directional glyphs in RTL as today. Remove `IconContext` from the root once nothing uses Phosphor React.
8. **Typeset.** Rename the variables `typeset.css` reads (`--ink`, `--ink-3`, `--sunken`, `--accent`, `--font-*`, `--radius`) to HeroUI tokens.

Done when every route renders in light and dark with the HeroUI palette, icons are Hugeicons, and checks pass.

## Phase 1: Primitives

Goal: every `packages/ui` Base UI or shadcn component replaced at its call sites, then deleted. Work in batches by dependency; each batch is one commit.

| Batch | Current (`@rezumi/ui/components/…`)                                                                          | HeroUI target                                                                                    | Main call-site changes                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1a    | `button` (107 files), `icon-button` (22), `button-group`, `hold-button`, `kbd`, `spinner`, `tooltip`         | OSS `Button`, `ButtonGroup`, `Kbd`, `Spinner`, `Tooltip`; custom `IconButton` and `HoldButton`   | `onClick` → `onPress`; `loading` → `isPending` (render the spinner); `size="icon*"` → `isIconOnly` with `sm`/`md`/`lg`; variant map below; `render={<Link/>}` → HeroUI `Link`/router `href` or a `render` function; delete `TooltipProvider`, set `--tooltip-delay: 400ms`                                                                                                                                             |
| 1b    | `input`, `input-group`, `textarea`, `label`, `form` (18), `otp-field`                                        | `TextField`, `Input`, `InputGroup`, `TextArea`, `Label`, `Description`, `FieldError`, `InputOTP` | `FormItem`/`FormControl`/`FormMessage` (40 uses) collapse into `TextField` + `FieldError` with `isInvalid`/`isRequired`; keep TanStack Form as the state owner                                                                                                                                                                                                                                                         |
| 1c    | `checkbox`, `switch` (`SwitchRow`), `radio-group`, `slider`, `native-select`, `segmented-control` (15 files) | `Checkbox`, `Switch`, `RadioGroup`/`Radio`, `Slider`, Pro `NativeSelect`, Pro `Segment`          | `checked`/`onCheckedChange` → `isSelected`/`onChange`; Slider `number[]` → `number \| number[]`, `min`/`max` → `minValue`/`maxValue`; Segment `selectedKey`/`onSelectionChange` with `Segment.Item id`                                                                                                                                                                                                                 |
| 1d    | `tabs`, `accordion`, `collapsible`, `separator`, `skeleton`, `badge`, `avatar`, `alert`                      | `Tabs`, `Accordion`, `Disclosure`, `Separator`, `Skeleton`, `Chip`, `Avatar`, `Alert`            | Tabs `value` → `selectedKey`, `TabsTrigger` → `Tabs.Tab id`, `TabsContent` → `Tabs.Panel id`; `Badge` → `Chip` (HeroUI `Badge` is an overlay dot); `decorative` → `isDecorative`                                                                                                                                                                                                                                       |
| 1e    | `popover`, `dropdown-menu` (25), `context-menu`, `combobox`, `command`                                       | `Popover`, `Dropdown`, Pro `ContextMenu`, `ComboBox`/`Autocomplete`, Pro `Command`               | Dropdown items → `onAction(key)`, `variant="danger"`; checkbox and radio items become menu-level `selectedKeys`; side and align → `placement`; ComboBox selects by key                                                                                                                                                                                                                                                 |
| 1f    | `dialog` (28), `alert-dialog`, `sheet` (9)                                                                   | `Modal`, `AlertDialog`, Pro `Sheet`                                                              | open state moves to `Modal.Backdrop`/`Sheet` root; `side` → `placement` on the root; no Description part (plain `<p>` + `aria-describedby`); AlertDialog: set `isKeyboardDismissDisabled={false}` to keep Escape                                                                                                                                                                                                       |
| 1g    | `toast` (101 files, 176 `toast.add`)                                                                         | `toast` + `Toast.Provider`                                                                       | `toast.add({description})` → `toast(…)`; `type:"error"` → `toast.danger`; loading-then-replace (34 calls with `id`) → keep the returned key and `toast.update(key, …)`; static ids (`auto-save`, `pdf-lost-characters`, `resume-preview-render-error`, `webmcp-*`) → a small keyed helper that updates or closes the live toast; `actionProps.onClick` → `onPress`; `timeout: 6000` default and `maxVisibleToasts={1}` |

Button variants: `primary` → `primary`; `secondary` (142 uses) → `secondary`; `ghost` → `ghost`; `danger` → `danger`; destructive secondary actions → `danger-soft`; `link` (13 uses) → HeroUI `Link`. Pick these once and apply them globally.

`packages/ui` keeps: `globals.css`, `icon`, `brand-icon`, `trace`, `message-scroller`, `swap`, and the custom `icon-button`, `hold-button` and keyed-toast helper, all rebuilt on HeroUI. Tests in `packages/ui` (`alert`, `button`, `form`, `input-group`, `sheet`, `switch-row`) move or go with their components.

## Phase 2: App shell

Replace the hand-built sidebar, icon rail and phone tab bar in `routes/dashboard/-components/app-shell.tsx` with Pro `AppLayout`.

- `AppLayout` renders `Sidebar.Provider` itself; do not add another. Props: `sidebar`, `navbar`, `aside`, `sidebarCollapsible="icon"` (replaces the tablet rail), `toggleShortcut` (default `mod+b`), `scrollMode`, `toolbar`. Persist the collapsed state with the `sidebar_state` cookie read through `js-cookie` (`defaultSidebarOpen`).
- `Sidebar`: `Sidebar.Header` (brand, search button opening the command palette with `⌘K`), `Sidebar.Content` > `Sidebar.Group` > `Sidebar.Menu` > `Sidebar.MenuItem href isCurrent` with `Sidebar.MenuIcon`, `Sidebar.MenuLabel` and `Sidebar.MenuChip` for counts (Documents, Applications, Career unread, Trash), `Sidebar.Footer` (New button with `N`, user `Dropdown` with `Avatar`). Settings and Career Knowledge sub-navigation can become `Sidebar.Submenu`.
- Phones: below 768px the desktop sidebar hides and `AppLayout.MenuToggle` in the `Navbar` opens `Sidebar.Mobile` as a sheet. This replaces the bottom tab bar and `MobileTabIndicator`, which is a navigation pattern change on phones; the destinations stay the same.
- `Navbar` inside the layout: `AppLayout.MenuToggle`, `Sidebar.Trigger`, `Breadcrumbs`, `Navbar.Spacer`, page actions. The application workspace keeps its own full-screen phone layout.
- Keep the skip link, `GuestBanner`, the `N` hotkey and `view-transition-name`.

## Phase 3: Applications

- **Board → Pro `Kanban`.** Use `Kanban`, `Kanban.Column`, `ColumnHeader` (`ColumnIndicator` with the stage color, `ColumnTitle`, `ColumnCount`, `ColumnActions`), `ColumnBody`, `ScrollShadow`, `CardList` (React Aria `GridList`) and `Card textValue`. Do not use `useKanban`: it keeps its own list from `initialItems`, while the board is server state with an optimistic move and a pending-move override. Build per-column `dragAndDropHooks` with React Aria `useDragAndDrop` over the query data, keep the Closed drop opening the close-reason dialog (now `Modal`), keep the 50-card paging, and keep the card ⋯ menu with Move to… as the keyboard alternative. `Kanban.DragHandle` adds keyboard drag. `@dnd-kit/*` leaves the web app if nothing else uses it.
- **Calendar → Pro `Agenda`.** Map interviews to `AgendaEvent` (`id`, `title` = kind + role · company, `start`/`end` from start and duration as `CalendarDateTime`, `color` = interview kind color). `onEventSelect` opens the interview dialog for editing; `onEventCreate` opens it prefilled for scheduling; `onEventMove`/`onEventResize` reschedule through the existing mutation. Pass `undefined` for drag callbacks on touch widths, as the docs advise. The "Upcoming interviews" aside stays custom with `ItemCard`/`EmptyState`. Agenda's month view links "N more" and date numbers to its day view, so day and week views arrive with it: see Open decisions.
- **List → custom on HeroUI.** `DataGrid` has no row groups, so the grouped, collapsible stage list stays custom, built from `Disclosure`, `ListView`-style rows and `Chip`. Bulk selection uses Pro `ActionBar` (offset its fixed `.action-bar` above the phone navigation with a CSS override).
- **Insights → Pro `KPIGroup`/`KPI`, `Widget` and charts** (`recharts`). Keep `PipelineFlow` and its PNG export: there is no Sankey chart. Per-stage bar colors need a custom bar shape, since `BarChart` does not re-export Recharts `Cell`.
- **Detail → Pro `Sheet`**; activity → Pro `Timeline` with stage-colored marker children; next-step card → `Card`; empty states → Pro `EmptyState`.
- Before editing `insights-view.tsx`, confirm with the owner what to do with its uncommitted edits.

## Phase 4: Documents, trash and templates

- Documents and Trash lists → Pro `DataGrid` (sorting, selection) or `ItemCardGroup` on phones; row menus move to a ⋯ cell, since DataGrid has no row context menu. Bulk actions → `ActionBar`. Empty states → `EmptyState`. New-document flow → `Modal`.
- Done: `document-list.tsx` is the list view and Trash, on `DataGrid`. A row click opens the document until something is selected, then toggles the row (React Aria checkbox selection with `onRowAction`). The selection column is our own `Checkbox slot="selection"` column, because `showSelectionCheckboxes` hard-codes English labels. Column `width` only applies to resizable columns, so widths are `headerClassName` classes on a `table-fixed` table. Name and Edited headers set the URL sort (one direction per key, as the Sort select). Phones drop Type, Application and Edited and show the date under the name. List rows lose the right-click menu and the intro stagger; cards keep both, now on `cardVariants`. Tag filters and the copy-for-a-job picker are `TagGroup`s.

## Phase 5: Builder and letters

- Editor bar → `Toolbar` + `Button`/`Tooltip`; side panels → `Tabs`/`Segment`; download and share sheets → Pro `Sheet`.
- Design panel: template strip stays custom (optional Pro `Carousel`); style groups → `Slider`, `Switch`, `NativeSelect`, `Segment`; header layout cards → Pro `RadioButtonGroup`; color fields → OSS `ColorPicker`/`ColorSwatchPicker`, converting `Color` objects to the stored `rgba()` strings.
- Rich text: keep the TipTap editor (HTML in and out, custom paragraph, heading, whitespace and table extensions). Pro `RichTextEditor` is JSON-based with fixed extensions. Rebuild only its toolbar and frame from HeroUI parts.
- Keep `NumberInput` custom (Pro `NumberStepper` has no typed input or unit), restyled on `NumberField`/`InputGroup`.
- Page canvas and paper stay as they are.

## Phase 6: Assistant and career coach chat

- Keep `MessageScroller` behaviour (anchors each new question, reopens on the last question, "Latest" button); Pro `ChatConversation` only pins to the bottom. Restyle it with HeroUI tokens.
- Messages → Pro `ChatMessage`; composer → Pro `PromptInput` with `allowSubmitWhileRunning` checked against IME and Escape-to-stop, or a custom composer from `TextArea` + `Button` if it fails those checks.
- Markdown: either Pro `Markdown` with `components` overrides that restore image-to-alt-text and safe link targets, or the current renderer restyled. Decide in a spike.
- Tool calls: keep approvals, `Trace` lines and domain cards custom; Pro `ChatTool` lacks approval-responded and denied states and shows raw JSON by default. `ChainOfThought` and `TextShimmer` can replace hand-rolled reasoning and shimmer.

## Phase 7: Career workspace

- Workspace steps → Pro `Stepper` where the flow is sequential; today and schedules → `ItemCardGroup`, `Widget`; schedule sheet → Pro `Sheet`; facts, stories and preferences forms → Phase 1 fields. Update the mapped user guides and fictional screenshots, as `docs/contributing/career-platform.mdx` requires.

## Phase 8: Settings, auth, command palette and dialogs

- Settings nav → `Tabs` or `Sidebar.Submenu`; forms → Phase 1 fields; API keys and integrations → `Table`/`DataGrid`.
- Auth pages → `Card`, `TextField`, `InputOTP`, `Button`, `Link`.
- Command palette → Pro `Command`. It has no keyword or ranking support, so put keywords into each item's `textValue`; its overlay and open state (`isOpen` on `Command.Backdrop`) replace the custom dialog.
- `dialogs/manager.tsx` renderers → `Modal`; `use-confirm` → `AlertDialog`.

## Phase 9: Cleanup and documentation

- Delete `legacy-aliases.css`; check that no old token utilities remain in app code.
- Remove `@base-ui/react`, `cmdk`, `shadcn`, `@shadcn/react`, `class-variance-authority`, `tw-animate-css` (if unused), `@dnd-kit/*`, and `@phosphor-icons/react` (keep `@phosphor-icons/web` for resume icons). Run `pnpm knip`.
- Rewrite `apps/web/DESIGN.md` for the HeroUI default system. Update the ownership row for `packages/ui` in `CLAUDE.md`/`AGENTS.md` ("HeroUI-based custom components"), and refresh screenshots in user guides.
- Full checks: `pnpm build`, `pnpm test:e2e`, `pnpm check:cloudflare`.

## Custom components to build in HeroUI style

| Need                                                                          | Why no HeroUI component fits                                        |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `IconButton` (label, tooltip, shortcut)                                       | Wraps `Button isIconOnly` + `Tooltip` + `Kbd`; repeated in 22 files |
| `HoldButton`                                                                  | No press-and-hold confirm in HeroUI                                 |
| Keyed toast helper                                                            | HeroUI toast has no `id` option for replace and dedupe              |
| `MessageScroller`, `Trace`, tool approval cards                               | Pro chat lacks anchor-to-question scrolling and approval states     |
| Grouped applications list                                                     | DataGrid and ListView have no row groups                            |
| Interview upcoming list, `PipelineFlow` diagram                               | No Sankey; list composed from `ItemCard`                            |
| `NumberInput` with unit, `ChipInput`, `IconPicker`, `UrlInput`, level display | No typed number-with-unit, tag input or icon grid in HeroUI         |
| Rich-text toolbar                                                             | Pro RichTextEditor stores JSON and fixes its extensions             |

## Open decisions

1. **Agenda day and week views.** Decided October 30, 2026: the web calendar ships month, week and day views with drag to move, resize and create (pointer devices only). The native calendar (`apps/mobile/app/(tabs)/applications/calendar.tsx`) needs matching week and day views and rescheduling before the next release; tracked as follow-up work.
2. **Phone navigation.** Decided October 30, 2026: follow the HeroUI default, a menu sheet from the navbar instead of a bottom tab bar (done in Phase 2).
3. **Uncommitted work.** The working tree holds unrelated edits (new logo assets, `insights-view.tsx`, `packages/pdf/src/html/document.ts`). Commit or set them aside before the migration branch starts.

## Risks

- Default fields have no border (shadow only); Rezumi's inputs are bordered. This is an intended visual change.
- `ToggleButtonGroup` and `Segment` behave as toggle buttons, not a radio group; check keyboard behaviour where a radio group was announced.
- Pro is a beta (`1.0.0-beta.10`); pin it and re-check APIs on upgrades. Some doc tables disagree with the typings (Resizable uses `onLayoutChange`, `LayoutStorage`, `GroupImperativeHandle`).
- Playwright selectors that rely on `data-slot` attributes break with new markup; prefer roles and labels.
- Tailwind source detection uses `source(none)` and explicit `@source` globs; confirm HeroUI's classes are generated after each phase.
