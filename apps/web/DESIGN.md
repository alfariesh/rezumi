---
version: 7.0.0
name: Rezumi · HeroUI
description: The app is HeroUI's default system as shipped: its palette, radius, Google Sans typography and focus ring, with HeroUI Pro for the shell and the data-heavy surfaces. Rezumi adds paper, application stages and a few layout and motion tokens. The homepage uses the same system.
colors:
  paper: "#FFFFFF"
  stages:
    saved: "#908C7F"
    applied: "#5590CC"
    screening: "#00A0A6"
    interview: "#AF8433"
    offer: "#579F68"
    closed: "#C67067"
typography:
  family: "Google Sans (--font-sans); Google Sans Code (--font-mono) for shortcuts, URLs, slugs and counts"
  body: { fontSize: 14px, fontWeight: 400 }
  title: { fontSize: 30px, lineHeight: 36px, fontWeight: 600, letterSpacing: -0.025em }
  heading: { fontSize: 20px, lineHeight: 28px, fontWeight: 600 }
  card-title: { fontSize: 16px, lineHeight: 24px, fontWeight: 600 }
  label: { fontSize: 14px, fontWeight: 500 }
  caption: { fontSize: 12px, lineHeight: 16px, fontWeight: 500 }
rounded:
  radius: 0.5rem
  field: "1.5 × radius"
  page: none (paper is square)
spacing: [4, 8, 12, 16, 24, 32, 48, 64]
motion:
  quick: 120ms
  standard: 200ms
  emphasized: 320ms
  easing: cubic-bezier(0.23, 1, 0.32, 1)
  exit: 70% of the entering duration
  movement-easing: cubic-bezier(0.77, 0, 0.175, 1)
  sheet-easing: cubic-bezier(0.32, 0.72, 0, 1)
---

## Overview

Rezumi's app is HeroUI's default theme, used as shipped: its blue accent (the logo's `#00BAFF` family), light gray desk, white surfaces, 0.5rem radius, system font and focus ring. We restyle nothing HeroUI already draws. A bright resume or letter sits in the middle of that quiet interface and is the one thing that is not themed.

Components come from `@heroui/react` and, where the base library has none, `@heroui-pro/react` (the shell, widgets, grids, charts, chat, command palette and sheets). Where neither has one, `packages/ui` and the owning feature build it from HeroUI tokens and BEM-style class names, so it reads as HeroUI. Check `apps/web/PRODUCT.md` for who the product is for. The decisions behind this system, and what changed from the earlier Desk & Paper look, are in `.agents/docs/plans/heroui-migration.md`.

Five principles guide decisions:

1. **The page is the interface.** Keep the live document visible while editing. Selecting a supported block opens its fields.
2. **One obvious next step.** Each view has one primary action. Reserve the accent fill for that action, selection and progress.
3. **Nothing is lost.** Edits autosave, reversible changes offer undo, and confirmations are reserved for irreversible actions.
4. **Detail on demand.** Make defaults useful; put advanced controls one disclosure deeper.
5. **AI proposes, you decide.** Show AI edits as reviewable proposals before applying them.

And one rule for every screen: **say each thing once.** One route to each destination (the sidebar owns navigation and the account menu owns Settings: no second rail, no duplicate tab bar, no breadcrumb that repeats the sidebar). No heading, caption or helper text that restates the control or the title beside it. Empty states and placeholders say what to do, not what the page is.

Resume templates keep their Pokémon names, fonts and palettes. App typography and control styling never dictate template appearance.

## Tokens

`packages/ui/src/styles/globals.css` imports `@heroui/styles` and `@heroui-pro/react/css`. HeroUI owns every color, radius, shadow and focus token and their dark values (`.dark`); read them with the HeroUI MCP (`get_theme_variables`) rather than copying values here. Tailwind exposes them as semantic utilities.

- **Surfaces:** `bg-background` for the desk; `bg-surface` for panels, cards and widgets; `bg-surface-secondary` for blocks nested in a surface (never another border); `bg-overlay` for menus, popovers, dialogs and toasts; `bg-default` for wells, tracks, hover rows and selected rows.
- **Text:** `text-foreground`, `text-muted` for secondary text, metadata and placeholders. Use no lighter text token, and check contrast on tinted backgrounds.
- **Lines:** `border-separator` for rules between rows, `border-border` for outlines that carry structure. Prefer spacing and surface changes to either.
- **Signals:** `accent` for the primary action, selection and progress; `danger` for errors and irreversible actions; `warning` for issues to review; `success` for done and better. Tinted callouts use `bg-accent-soft` with `text-accent-soft-foreground` (and the same pair per signal). HeroUI has no info role: neutral guidance uses the accent soft pair.
- **Elevation:** `shadow-surface` for cards (built into `Card`; do not add another), `shadow-overlay` for menus, popovers, dialogs, sheets and toasts, `shadow-page` for editor paper.
- **Fields:** fill only: no border and no drop shadow (`--field-shadow` is zero). On a white surface use `variant="secondary"`: it is filled with the page `background` (`--field-fill`, set in `packages/ui/src/styles/globals.css`), not the gray `default`, which disappears on white anyway. On a gray nested card use the `fields-on-card` utility; inside a collapsible section's body use `fields-on-background` (both in `apps/web/src/index.css`).
- **Paper:** `--paper` stays white in both themes. Switching the theme must not invert documents.
- **Stages:** `stage-saved`, `stage-applied`, `stage-screening`, `stage-interview`, `stage-offer` and `stage-closed` identify application stages. Use small dots or stepper bars beside the stage name, never the color alone.

Use semantic tokens in app code. No arbitrary colors and no palette classes such as `amber-600`. The old Desk & Paper names (`ink`, `line`, `raised`, `sunken`, `warn`, `shadow-e1`) are gone, the homepage's included.

## Typography

Google Sans for the interface and Google Sans Code for monospace, self-hosted from `@fontsource-variable` and named once, in `packages/ui/src/styles/globals.css` (`--font-sans` and `--font-mono`; Tailwind's `font-sans` and `font-mono` read them). Scripts those fonts do not draw (Arabic, CJK) fall through to the system stack. Google Sans has weights 400 to 700, so the interface uses `font-normal`, `font-medium`, `font-semibold` and `font-bold` and nothing lighter or heavier. Hierarchy comes from size and weight.

The scale is HeroUI's [Typography](https://heroui.com/docs/react/components/typography) scale, which is Tailwind's `text-*` steps. Use no arbitrary value (`text-[13px]`, `leading-[19px]`, `tracking-[-.02em]`, `font-[…]`) and no literal font stack in app code; a value the scale lacks is a design decision to make here first. `apps/web/src/typography.test.ts` fails when one appears.

| Role                  | Look                       | Use                                                                                               |
| --------------------- | -------------------------- | ------------------------------------------------------------------------------------------------- |
| Page title            | 30 / 36, semibold, tight   | `<Typography type="h2" render={renderAsH1}>` (`PageHeader`; auth cards use `type="h3"`)           |
| Section title         | 20 / 28, semibold, tight   | `type="h4"`                                                                                       |
| Card or row title     | 16 / 24, semibold, tight   | `type="h6"`                                                                                       |
| Body, label           | 14, labels `font-medium`   | `text-sm`; HeroUI controls already set it                                                         |
| Description, metadata | 14 or 12, `text-muted`     | `text-sm text-muted`, `text-xs text-muted`; a multi-line paragraph is `Typography type="body-sm"` |
| Group label, caption  | 12, semibold, `text-muted` | `text-xs font-semibold text-muted`                                                                |
| Mono                  | 14                         | `font-mono text-sm` for shortcuts, URLs, slugs, filenames and counts                              |

- **Titles use `Typography`.** Its `type` sets how text looks and `render` sets the element, so the document outline and the scale stay independent. `renderAsH1`, `renderAsH2` and `renderAsH3` in `apps/web/src/libs/typography.tsx` are the shared render functions; a page title is the `h1` that looks like an `h2`. A public page that is itself an `h1`-sized hero (templates, the ATS checker) uses `type="h1"` and steps up with `sm:text-5xl` or `sm:text-6xl`.
- **Dense UI uses the scale utilities.** Single-line labels, captions, table cells and chips take `text-xs` or `text-sm` with a `font-*` weight. Typography's `body-*` types carry paragraph leading (24px at 14px), which is too loose for rows and chips.
- **Numbers:** `tabular-nums` on prices, counts, scores and stats so columns align.
- No all-caps labels or title caps: headings, eyebrows, group labels and buttons are sentence case at 12px or larger, with normal tracking. Nothing is set below 12px.
- Field labels are 12–14px medium; a description sits under the control in `text-muted`.
- Rendered rich text (assistant and coach replies, the rich-text editor) uses `packages/ui/src/styles/typeset.css`, an owned stylesheet based on shadcn's typeset (MIT) that reads HeroUI tokens. Wrap content in `typeset` plus a preset: `typeset-chat` or `typeset-field`. It styles only the elements those surfaces render (no images, `kbd`, `details`, definition lists or math). Opt a component out with `not-typeset`.
- Touch inputs use at least 16px text to prevent iOS zoom.
- **Outside the scale:** the landing page (Marketing site below), a reflowed resume (`resume-reflow.tsx`, drawn in the resume's own font on white paper), and the exported chart image in Insights (SVG pixel geometry). Resume templates and the font picker name their own families; app type never sets them.

## Iconography

Every system icon in the web and mobile apps comes from the Hugeicons Pro set staged in `packages/icons` (`@rezumi/icons`). Do not add another icon library, import `@hugeicons/*`, or draw a one-off SVG for the interface; a missing glyph is added to the set.

- **Two variants.** `stroke` is the default: Stroke Standard, 24px grid, 1.5px line. `duotone` (Duotone Standard) is for the selected state only: the current sidebar item, the active mobile navbar tab, and the selected tab or segment. It is also the solid form of stop, play, pause and star. Never use duotone for resting controls, and never mix other Hugeicons styles (rounded, sharp, solid, bulk, twotone) into the interface.
- **Web.** `Icon` from `@rezumi/ui/components/icon` takes a Phosphor-style kebab name (`x`, `gear-six`, `magnifying-glass`) and an optional `variant="duotone"`. Those names are the shared vocabulary for web and mobile and stay stable; `packages/icons/icons.config.json` maps each to its Hugeicons glyph. Pass `variant` from the selected state: `variant={isCurrent ? "duotone" : "stroke"}`.
- **Mobile.** The native app draws the same names and the same two variants from `@rezumi/icons` (render data in `getAppIcon`, raw files in `@rezumi/icons/svg/<style>/<name>.svg`). Its `Icon` still uses Phosphor until it moves over; the tab bar and navbar active state become duotone then.
- **Adding or changing a glyph.** Edit `icons.config.json` (the `app` map for an icon in use; `appCategories` stages whole categories as files only), then run `pnpm --filter @rezumi/tooling icons:sync <path to the Hugeicons SVG export>`. The command rewrites `packages/icons/svg`, `catalog.json` and `src/generated`; do not edit those by hand. Brand marks (Apple, Google, GitHub, LinkedIn, Google Play) are in the map like any other glyph.

Use 20px icons on desktop and 24px on touch interfaces; 16px inside small buttons, chips and rows. `Icon` is decorative (`aria-hidden`), so pair it with text or give the control a label. Icon-only controls use `IconButton` (a `Button isIconOnly` with a tooltip, an optional shortcut and a required label). Directional arrows, chevrons, undo and redo mirror in RTL layouts.

Icons inside resumes are Phosphor names stored in resume data, drawn by the Phosphor web font (`@phosphor-icons/web`) in the page and by generated SVG data in the PDF (`pnpm --filter @rezumi/tooling icons:pdf`). They are separate from app icons. The resume's icon style will be a person's choice of three stroke-only sets: rounded, standard or sharp. `packages/icons/svg/stroke-rounded`, `stroke-standard` and `stroke-sharp` already hold every brand logo and the resume-related categories (work, education, awards, programming, sport, health, legal), and `catalog.json` maps the Phosphor names resumes use today (`cvPhosphor`) to their Hugeicons counterparts. The preference itself is not built yet; until it is, resumes keep drawing Phosphor.

## Space, shape and elevation

- **Spacing:** the 4px scale. Cards 16px padding; panels 16–24px; phone pages 16px margins, 32px from 640px (`PAGE_GUTTER`, shared with the navbar so their edges line up).
- **Page widths:** every dashboard page sits in `Page` (`apps/web/src/components/layout/page.tsx`), centred and capped by what it holds: `narrow` 720px for forms and Settings; `default` 1440px for pages of widgets (Home's main column beside its side column, Knowledge, Offers); `wide` 1920px for data that uses the room it gets (Documents, Trash, Applications with its board, calendar and insights). Text-heavy parts inside a wide page cap their own measure (Preferences at 820px). A page keeps one width across its views, so switching List, Board or Insights never moves the header. Full-height tools (Coach, the application workspace) lay out their own panes.
- **Radius:** HeroUI's. `--radius` is 0.5rem; fields use 1.5× that (`rounded-field`); cards, popovers and dialogs use the surface radii. Nested rounded boxes follow outer = inner + padding. `Segment` and pill `Tabs` take the field radius (`globals.css`).
- **Controls:** the default size of every component; omit `size` unless a layout asks otherwise. Icon-only and badge-carrying buttons keep the minimum touch target; `touch-target` grows a smaller control's hit area to 44×44px on coarse pointers.
- **Layout variables:** `--editor-bar: 56px`, `--editor-panel` (420px, growing to 520px on large screens), `--editor-side`, `--app-sidebar: 240px`, `--sheet-share: 440px`, `--sheet-detail: 480px`, `--assistant: 400px`, `--tooltip-delay: 400ms`.
- **Scrollbars:** one thin thumb in the default fill (`--scrollbar-thumb`), a step darker while the pointer is over its area.

## Motion

| Token                 | Duration | Use                                                    |
| --------------------- | -------- | ------------------------------------------------------ |
| `duration-quick`      | 120ms    | Hover, press, toggles, checkboxes, and focus           |
| `duration-standard`   | 200ms    | Menus, popovers, expansion, content swaps, and dialogs |
| `duration-emphasized` | 320ms    | Sheets, toasts, and the assistant column               |

- Entering and changing state use `ease-enter` (`cubic-bezier(0.23, 1, 0.32, 1)`), a strong ease-out: it moves most in the first frames and spends the rest settling. Never ease-in. Exits take 70% of the entry duration. Bare `transition-*` utilities already use these. `ease-out-strong`, the marketing pages' name, is the same curve.
- Sliding indicators (HeroUI's tab indicator included), reordering and settling use `ease-in-out-strong` (`cubic-bezier(0.77, 0, 0.175, 1)`). A label that grows with its tab (the editor's mode switch) shares the indicator's `duration-standard` and curve.
- Sheets, drawers and full-screen pushes, and anything that moves in step with one (the page stepping aside for the Download & history sheet), use `ease-drawer` (`cubic-bezier(0.32, 0.72, 0, 1)`), the curve HeroUI's drawers use. So do swipe-dismissed bottom sheets on release.
- HeroUI's own motion runs on these curves (`globals.css`): popovers, menus, pickers and tooltips enter on `ease-enter` from their trigger; dialogs rise from 95% over `duration-standard`; press feedback (`Button`, `ToggleButton`, pagination) scales on `duration-quick`. Animate only opacity and transform there; HeroUI's keyframes already do.
- Hover states on sidebar links and nav items are static (color or background), not animated.
- Page navigations (a pathname change) fade the page out and the next one up 6px (`index.css`). The shell's chrome is named and swaps in place, with no fade: the sidebar (`app-nav`), the navbar (`app-bar`), and a section's header and tabs that persist between its pages (`knowledge-header`, `knowledge-nav`). Give any new persistent header or tab row a `view-transition-name` and add it to that rule. Search-param changes (views, filters) swap instantly.
- First appearance uses the `starting:` variant (`ENTER_CLASS`, `POP_CLASS` in `apps/web/src/libs/motion.ts`), not an animation library class. Loading placeholders stay still; document reflow is never animated. Keyboard mode switches are instant.
- Reduced motion sets the duration tokens to 1ms and collapses CSS transitions and animations. Status spinners continue turning.
- `apps/web/src/libs/motion.ts` mirrors the CSS timings for Motion. `MotionConfig reducedMotion="user"` and `followReducedMotion()` make Motion animations respect the preference.

The homepage follows these rules too; its few extra ones are below.

## Components

Use HeroUI and HeroUI Pro directly at call sites: `onPress` (not `onClick`), `isDisabled`, `isPending`, `isSelected`, compound parts in dot notation (`Card.Header`, `Sheet.Content`). Look a component up with the HeroUI MCP before using it; never guess a name or a prop. `packages/ui` keeps only what HeroUI lacks: `Icon`, `IconButton`, `HoldButton` (press and hold to confirm), `Form` (TanStack Form wired to a label, description and error for any control), `SwitchRow`, `NativeSelect`, `Swap`, the toast helper, `MessageScroller`, `Trace`, `BrandIcon` and two hooks. Feature-specific UI belongs in its owning `apps/web` feature.

- **Shell:** Pro `AppLayout` with a 240px `Sidebar` (collapsible to icons by default below 1024px; the state is the `sidebar_state` cookie) and a `Navbar`. The sidebar holds the brand (linking to Home), the destinations as one flat list in the order a search runs (Home, Applications, Documents, Coach, Knowledge, Offers; Trash at the foot when it holds something), New and the account menu. Home (`/dashboard`) is the first page after signing in: what needs you, new roles, the next interview, recently edited documents and schedules; until the first document exists it opens with the same start as an empty Documents. The navbar holds the sidebar toggle, breadcrumbs (section, then page: Knowledge › Stories) and Search (⌘K) from 768px; on phones the menu button, the brand, search and New. Phones open the same sidebar from a menu sheet; there is no bottom tab bar. Page headers carry only contextual controls and page actions, never the brand or the user.
- **Loading:** a placeholder keeps the shape of what it stands for. Render the real frame (the widget, its title and icon) with placeholder rows inside (`RowsSkeleton` for `RowIcon` rows), not one gray block: the content then lands where its frame already is. A route still loading inside the shell shows `PagePending` in the page's place; the full-screen loader is for the first load only.
- **Pages and groups:** every group of content is a Pro `Widget` with one header (`WidgetHeading`; the spacing and type live in `globals.css` under `.widget__header`): a level-2 title in `h6` (16/24 semibold), an optional 20px muted icon and count, a muted `body-sm` description line (under the title's text when there is an icon), and at most one trailing action, a `WidgetAction` (accent text, no background, 32px tall). The header is at least 48px tall, with a lone title 12px from the top and bottom, 16px from the start, and the action text 16px from the end, so a widget looks the same with or without an action or a description. Widgets may also have a footer. Blocks nested in a widget use `rounded-xl bg-surface-secondary` with no border; rows split by a `Separator`, starting under the text. A row is the 40px `RowIcon` tile, the text and the control, the same on Settings and Career.
- **Buttons:** `primary` for the one main action, `secondary` for the rest, `ghost` and `outline` for supporting actions, `tertiary` for quiet ones, `danger-soft` for destructive actions that are not the main one, `danger` for the confirmation. Give a button text only unless an icon adds information; pending state is `isPending`. Provide an escape action (Cancel, Skip) beside the primary action in footers.
- **Inputs:** `TextField` with `Label`, `Description` and `FieldError`; show errors after blur or submission, with a specific remedy. `Segment` (Pro) for 2–4 options and `Tabs` for panels; `Switch` is at the trailing end of its row and uses the dot-notation anatomy; prefer `SwitchRow` when the label is part of the target.
- **Menus:** `Dropdown` with a ghost `Button` or `IconButton` trigger and no chevron unless the affordance would be invisible; destructive items last, after a separator; `ContextMenu` for right-click. The command bar is Pro `Command` (⌘K): put keywords into each item's `textValue`.
- **List and detail:** from 1536px the Applications list keeps the open application in a pane beside it (sticky, scrolling inside), so moving between rows needs no closing; narrower, and on the board and calendar, the detail opens in the sheet.
- **Layers:** popovers and menus hold light choices; Pro `Sheet` holds a task beside the document (a bottom sheet on phones); `Modal` holds a form or a decision, sized to its content (`max-w-md` or `max-w-lg`); `AlertDialog` confirms what cannot be undone and names what cancel keeps (the `use-confirm` hook). Tooltips open after 400ms and wrap every icon-only control.
- **Toasts:** HeroUI's `Toast` region, bottom, one visible at a time, six seconds by default; `timeout: 0` keeps one. `toast.add({ id })` updates the toast with that id in place. Undo is the optional action.
- **Alerts:** HeroUI `Alert` with `status` danger, warning, success or accent; only danger adds `role="alert"` by default.
- **Data:** Pro `DataGrid` for tables (secondary variant; phones drop secondary columns into a line under the name), `ListView` and `ItemCard` for lists, `Kanban` for the application board, `Agenda` for the calendar, `KPI` and the chart set for stats, `ActionBar` for bulk actions (a floating bar, never inline), `EmptyState` for empty and no-result states.
- **Files:** Pro `DropZone` for choosing or dropping a file; a `Button` that opens a file picker only when there is no drop target.
- **Chats:** Pro `PromptInput`, `PromptSuggestion`, `ChainOfThought` and `Markdown` for the assistant and the career coach. Transcripts use `MessageScroller` (`packages/ui`, behaviour adapted from shadcn's message scroller, MIT): it follows a streaming reply only while the reader is at the latest message, settles each question near the top, reopens a saved thread on its last question and shows a “Latest” button after scrolling away. Agent steps are `Trace` lines: shimmer while running, check when done, danger when failed, a dimmed dash when unfinished. Mobile mirrors both.
- **Reordering:** `apps/web/src/components/input/sortable.tsx` on React Aria drag and drop. A grip (`SortableHandle`) starts a drag by pointer, touch or keyboard (Enter on the grip, then the arrow keys and Enter; Escape cancels); a line shows where the item lands; the dragged item dims. Every reorder also has a non-drag route: ⌥↑ / ⌥↓ on a section or entry title, and the item's Move menu.
- **Empty states:** concise body text and a primary action; add a secondary action only when it helps. Never a headline that restates the page title.

## Accessibility

Target WCAG 2.2 AA:

- HeroUI draws its own focus ring on its components; everything else gets a 2px accent outline with a 2px gap on `:focus-visible`.
- Provide at least 24px pointer targets and 44px touch targets. Every drag operation needs keyboard and menu alternatives.
- Pair color signals with text; add icons where they clarify status.
- Trap focus in modal sheets and dialogs. Escape closes the top layer; closing returns focus to its trigger. React Aria provides most of this; do not remove an existing alternative.
- Announce save state and routine feedback politely. Reserve assertive announcements for errors that need immediate attention.
- Informational items have no hover state; reserve hover feedback for what can be pressed. Custom interactive elements use `cursor-(--cursor-interactive)`.

## Themes

The shared `theme` cookie stores `light`, `dark` or `system` (the default). System mode follows `prefers-color-scheme` live. `ThemeProvider` manages the `.dark` class on `<html>`; an inline script in `apps/web/index.html` applies it before first paint. The homepage uses this same preference. Theme choice lives in Settings (a `Segment`) and the command bar, not in the account menu.

## Internationalization

- Translate user-facing text and accessible labels through Lingui (`t`, `msg` or `<Trans>`). Catalogs live in `apps/web/locales`. HeroUI and Pro ship English defaults (Command placeholder, Navbar label, Toast close, Agenda labels): pass a translated string for every visible or accessible default.
- UI primitives receive translated labels as props; they do not depend on Lingui.
- Supported locales come from `packages/utils/src/locale.ts`. The root route updates `<html lang>` and `<html dir>`; React Aria's `I18nProvider` takes the same locale, so HeroUI's number and date formats and RTL (ar, fa, he) follow the app language.
- Prefer logical properties and utilities (`ps`, `pe`, `ms`, `me`, `start`, `end`, `inset-s`, `inset-e`). Prefix a value that is not text direction, such as a username or a code, with `dir="ltr"`.
- Allow 30–50% text expansion; avoid fixed widths for translated labels.

## Marketing site

The public homepage in `apps/web/src/features/homepage` is built from HeroUI components and tokens like the app, in both themes. Its layout follows a book-launch page: a hero split around an accent panel, a short introduction, then numbered sections under a sticky section bar, a closing panel and the footer. The other public pages under `routes/_home` (templates, the ATS checker) are app surfaces with the shared marketing header.

### Layout

- **Column:** every section sits in `Container` (`max-w-6xl`, 16/24/32px gutters). The introduction narrows to `max-w-3xl`.
- **Hero:** the accent panel (`bg-accent`, without a grid pattern) runs off the start edge of the page, rounded only at its end-bottom corner (`rounded-ee-[4rem]`). The example resume (`resume.tsx`) stands on it: a `light`-scoped paper page with `shadow-page`, so it stays light in the dark theme, and three floating callouts (`bg-overlay`, `shadow-overlay`) for the ATS check, a tailored line and the shared link. A `surface-secondary` band behind the quote runs to the end edge. The headline is the page's only `h1`.
- **Section bar:** sticky under the introduction, one numbered link per section from `getLandingSections` in `ui.tsx`; the section being read gets accent text and an accent underline, without a background. On phones a compact logomark and brand sit beside a small call to action above the horizontal links; the active link scrolls into view. From `lg` everything sits in one row.
- **Section headings:** a pill with the section's number and name (`SectionHeading`), then a large statement (`SectionTitle`, 36–48px, weight 600).
- **Bento grids:** six columns from `lg`, tiles of span 3+3 then 2+2+2 (light) or 4+2 then 2+4 (dark). Tiles are `Card`s with `p-0`; only the grid's outer corners round to 2rem. Each tile draws its feature from the same surfaces as the app (`surface-secondary` fields, `Chip`s, stage dots, paper pages) over a 288px stage that can fade into the card. The second grid sits on a band scoped with the `dark` class, so it reads dark in both themes.
- **Pricing:** three plans in one `surface-secondary` panel; the featured plan (Pro AI) is raised on a solid accent without a grid. Names, prices and lists start at the same height in every card. Prices come from `plans.ts`: Rupiah in every locale for the Indonesian pilot, formatted with the locale's `Intl.NumberFormat`, the currency set smaller than the figure. Paid plans say they last 30 days and never renew on their own; no plan is ever “coming soon”.
- **FAQ:** an `Accordion` (`surface`) beside a sticky intro column; the same answers go out as `FAQPage` structured data.
- **Closing and footer:** the accent panel again, rounded 2–3rem, with the call to action as a `secondary` button. The footer has the logomark, one line, three link columns and the version.

### Brand and controls

- **Brand:** the 32px logomark from `apps/web/public/icon/{light,dark}.svg` (`BrandIcon variant="icon"`) beside “Rezumi” in 18px semibold.
- **Call to action:** “Build your resume” (`CtaLink`) in the hero, the section bar and the closing panel, always to `/auth/register`. Plan buttons add `?plan=plus` or `?plan=pro-ai` to the sign-up URL; checkout is part of the membership implementation.
- **No source-code links:** the landing does not link to GitHub, a license or self-hosting.
- The hero has no separate header. Three collaboration pointers on the example resume identify You, Rezumi Agent and BYOK Agent; only the icons have a white stroke and soft shadow.

### Motion

Motion is the app's: hover color changes, the bento's template fan spreading on hover (`duration-emphasized`), and the text caret's pulse (`motion-safe` only). The hero headline slides its words upward with a last-to-first character stagger after hydration, sizes to the active word, stays static with reduced motion, and pauses outside the viewport or in a hidden tab. Mobile keeps three lines; larger screens use two. No scroll-driven scenes, parallax or entrance animations; initial content remains visible in prerendered HTML.

### Content and delivery

- Prerender the homepage and public ATS checker per locale at build time through `prerender.tsx` and `apps/web/vite.config.ts`. The app is a client-rendered SPA; `apps/server/src/static/web.ts` serves the generated HTML and adds canonical, Open Graph, `hreflang`, and structured data. Keep headings and body copy in the initial HTML. Prerendered pages start the app's JavaScript only after the first contentful paint (the loader in `vite.config.ts`), so their first screen must not depend on it, and must not fade in on load: the largest paint would wait for the fade.
- Include title and description metadata and `SoftwareApplication` structured data with one offer per plan, in Rupiah.
- **Template previews** come from each template's sample: a fictional persona (`tooling/templates/personas/<id>.ts`), in English and Indonesian, drawn with the template's preset. `pnpm --filter @rezumi/tooling templates:previews [ids…]` renders the sample PDF (`apps/web/public/templates/pdf/<id>.pdf`), `templates/jpg/<id>.jpg` at 600×848 (builder and letter cards, the mobile picker and the README; old mobile builds load this URL, so it stays a JPEG), `templates/thumb/<id>.webp` at 596×843 with a 300×424 `<id>-small.webp` (homepage and gallery), and the docs image `docs/images/templates/<id>.webp`; the Indonesian versions go in an `id/` folder of each, which the web app shows on Indonesian pages (`templateSample` in `src/dialogs/resume/template/data.ts`). It needs `pdftoppm` (poppler). Never at print resolution. For checking a template change, `templates:matrix` renders every template in five stress variants (photo, Letter, long pages, a very long name, right to left, light and dark accents, icons and tool logos on and off) with contact sheets and a hash per PDF to compare runs. Names, employers and contacts are invented; portraits are Unsplash photos in `tooling/templates/photos/`, each listed with its photographer and licence in `.agents/docs/template-showcase-sources.json`.
- Use one `h1`, section headings, landmarks, and a skip link. Drawings inside the hero and bento tiles are decorative (`aria-hidden`); the words beside them carry the meaning. Nothing relies on hover alone.
- Translate copy, accessible labels, and demo resume text through Lingui. Names, companies and addresses may stay literal. Allow text expansion and RTL layouts.

## Do and don't

- **Do** make the primary action obvious and reserve the accent for actions and state.
- **Do** use a HeroUI or HeroUI Pro component before building one, and its default size, variant and look before adding classes.
- **Do** keep text readable and pair color signals with words.
- **Do** provide empty, loading, error and success states; keep loading placeholders at their final size.
- **Don't** introduce arbitrary app colors or palette classes such as `amber-600`; use semantic tokens.
- **Don't** add a border, shadow or background HeroUI already draws, nest a surface in a surface, or stack a second shadow on `Card`.
- **Don't** duplicate navigation or repeat a title as a caption; say it once.
- **Don't** set labels in all caps, use emoji in headings or labels, or put an icon beside self-explanatory text.
- **Don't** confirm reversible actions; offer undo.
- **Don't** build a drag interaction without a keyboard and a menu route.
