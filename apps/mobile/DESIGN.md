# Rezumi mobile · design system

The native app is the web's design system on a phone: HeroUI's default theme, Google Sans and the Hugeicons set, with
HeroUI Native (+ Pro) components on Uniwind. `apps/web/DESIGN.md` is the source of truth for principles, wording and
the do/don't list; this file says how those rules land in `apps/mobile`, and what is deliberately different. The
component gallery is `app/dev/ui.tsx` (development builds: `app.rezumi://dev/ui?group=foundation|fields|feedback|overlays|navigation|data`).

## Rules for every screen

1. **Import UI from `@/ui` only.** No hex colors, font families or spacing numbers in screens; style with `className`
   (Uniwind) and the components below. `style={…}` only for values computed at run time (gesture offsets, insets, a
   measured width). `src/design-guard.test.ts` fails a rebuilt file that holds a hex color, a `style={{…}}` literal or
   a `@/ui-legacy` import.
2. **A missing component goes into `src/ui`**, with a test and a gallery entry, never into a feature folder. Use a
   HeroUI Native or Pro component before building one, at its default size and variant.
3. **`Platform.OS` lives in `src/ui` and `src/shell`** (and permission prompts). Screens never branch on platform.
4. **Every control has an accessible role and label**; icon-only controls take a `label`. Touch targets are at least
   44 pt. Text grows with the system size (rows cap at 1.6×, `Text`'s default).
5. **Primitives take translated strings as props** and never import Lingui; screens translate.
6. **States:** every screen has loading (skeleton in the final shape), empty, error (message + retry) and offline
   (last content + marker). Reversible actions run at once with an Undo toast; only permanent ones confirm.

## Tokens

All tokens live in `global.css` and reach components as classes. HeroUI Native 1.1 ships the same theme as the web's
`@heroui/styles` 3.2.7 in `oklch`, which Uniwind compiles for iOS and Android (checked in Phase 02: no hex conversion
needed). `global.css` only overrides the values where the native default differs from the web.

| Token (class)                      | Light                         | Dark                          | sRGB light / dark   |
| ---------------------------------- | ----------------------------- | ----------------------------- | ------------------- |
| `background` (the desk)            | `oklch(0.9702 0 0)`           | `oklch(12% 0.005 285.823)`    | `#F5F5F5` `#060607` |
| `foreground`                       | `oklch(0.2103 0.0059 285.89)` | `oklch(0.9911 0 0)`           | `#18181B` `#FCFCFC` |
| `surface` (cards, groups)          | `oklch(100% 0 0)`             | `oklch(0.2103 0.0059 285.89)` | `#FFFFFF` `#18181B` |
| `surface-secondary` (nested block) | `oklch(0.9524 0.0013 286.37)` | `oklch(0.257 0.0037 286.14)`  | `#EFEFF0` `#232325` |
| `surface-tertiary`                 | `oklch(0.9373 0.0013 286.37)` | `oklch(0.2721 0.0024 247.91)` | `#EAEAEB` `#262728` |
| `overlay` (menus, dialogs, sheets) | white                         | as `surface`                  | `#FFFFFF` `#18181B` |
| `muted` (secondary text)           | `oklch(0.5517 0.0138 285.94)` | `oklch(70.5% 0.015 286.067)`  | `#71717A` `#9F9FA9` |
| `default` (wells, tracks)          | `oklch(94% 0.001 286.375)`    | `oklch(27.4% 0.006 286.033)`  | `#EBEBEC` `#27272A` |
| `border`                           | `oklch(90% 0.004 286.32)`     | `oklch(28% 0.006 286.033)`    | `#DEDEE0` `#28282C` |
| `separator` (overridden)           | `oklch(92% 0.004 286.32)`     | `oklch(25% 0.006 286.033)`    | `#E4E4E7` `#212124` |
| `accent`                           | `oklch(0.6204 0.195 253.83)`  | same                          | `#0485F7`           |
| `success`                          | `oklch(0.7329 0.1935 150.81)` | same                          | `#17C964`           |
| `warning`                          | `oklch(0.7819 0.1585 72.33)`  | `oklch(0.8203 0.1388 76.34)`  | `#F5A524` `#F7B750` |
| `danger`                           | `oklch(0.6532 0.2328 25.74)`  | `oklch(0.594 0.1967 24.63)`   | `#FF383C` `#DB3B3E` |

- **Soft pairs:** `bg-accent-soft` + `text-accent-soft-foreground` (and the same per signal) for tinted callouts. HeroUI
  has no info role: neutral guidance uses the accent pair.
- **Rezumi additions:** `bg-paper` (`#FFFFFF`, never inverts: resume and letter pages), stages `bg-stage-saved`,
  `-applied`, `-screening`, `-interview`, `-offer`, `-closed` (always beside the stage name).
- **Overrides of HeroUI Native's defaults** (to match the web): `--field-radius` 1.5 × radius (12 pt), `separator`,
  `backdrop` (50% / 60% black), `overlay-shadow`, no field shadow, inputs at 16 pt, secondary fields filled with
  `background`, `h5`/`h6` with normal tracking.
- **JavaScript** reads a color with `useThemeColor("accent")` (from `@/ui`), never a literal. `src/ui/tokens.ts` holds
  the few numbers JavaScript needs: `motion`, `space`, `size`.
- The sRGB column is for reference (the legacy bridge and tooling); compute any new one with a script, never by eye.

### Type

Google Sans 400/500/600/700 and Google Sans Code 400 are bundled as static fonts (`assets/fonts`, OFL), cut from the
same variable fonts the web loads (Latin, Latin Extended, Vietnamese). Other scripts fall back to the system font per
glyph. Each weight is its own family (`--font-normal` … `--font-bold` in `global.css`): Android picks a custom font's
weight by family name only, so never pair a family with a numeric `fontWeight`.

| Role                    | Component                                         | Look                  |
| ----------------------- | ------------------------------------------------- | --------------------- |
| Page title              | `<Typography.Heading type="h2">`                  | 30/36 semibold, tight |
| Section title           | `<Typography.Heading type="h4">`                  | 20/28 semibold, tight |
| Card or row title       | `<Typography.Heading type="h6">`                  | 16/24 semibold        |
| Paragraph (wraps)       | `<Typography type="body-sm">` / `body-xs`         | 14/24, 12/20          |
| Label, value (one line) | `<Text>` / `<Text weight="medium">`               | 14/20                 |
| Caption, group label    | `<Text size="xs" weight="semibold" tone="muted">` | 12/16                 |
| Code, URL, slug, count  | `<Text mono>`; numbers in columns `tabular`       | Google Sans Code 14   |

Sentence case everywhere, nothing below 12 pt, no all-caps. `text-xs`/`text-sm` carry +0.02em tracking and
`text-base` +0.01em, as on the web.

### Space, shape, motion, haptics

- **Spacing:** the 4 pt scale (`p-1` … `p-16`); phone gutter 16 (`Screen` applies it), cards 16 padding.
- **Radius:** `--radius` 8; fields 12 (`rounded-field`); cards and groups HeroUI's surface radius; sheets 24 at the top.
  Nested boxes: outer = inner + padding.
- **Elevation:** HeroUI's `shadow-surface` (built into Card, none in dark), `shadow-overlay` for floating layers.
- **Motion:** `tokens.motion`: quick 120 ms (press, toggles), standard 200 ms (menus, swaps), emphasized 320 ms
  (sheets, toasts); `ease` (strong ease-out) for entering, `easeMove` for sliding/reordering, `easeDrawer` for sheets;
  exits take 70%. Reduced motion (`useReducedMotion`) removes movement; Reanimated and TrueSheet follow the system
  setting themselves.
- **Haptics** (`haptics` from `@/ui`, off when the person turns them off in Settings): `selection` on a choice
  (segment, picker detent, reorder lift), `light` on long-press select, `medium` on picking something up to drag,
  `success` when a task finishes, `warning` before a destructive confirmation, `error` on a failure to notice.

### Icons

`Icon` draws the Hugeicons set from `@rezumi/icons` with the web's kebab names (`file-text`, `gear-six`,
`magnifying-glass`). `stroke` at rest; `duotone` for the selected tab, segment or toggle only. Sizes: 16 in chips and
small buttons, 20 in rows (default), 24 on touch targets and bars. Icons are decorative (hidden from screen readers);
the control around them carries the label. Arrows, carets and undo/redo mirror in right-to-left layouts. A missing
glyph is added to `packages/icons` (`icons:sync`), never drawn locally. Phosphor is gone from the app.

## Components

All from `@/ui`. HeroUI Native and Pro components are used as shipped where they fit (look them up before use:
skill `heroui-native`, the installed source in `node_modules/heroui-native/src`, Pro typings in
`node_modules/heroui-native-pro/lib/typescript`); the wrappers below add only what the app needs. Pro components are
imported by subpath (`heroui-native-pro/segment`), never from the package root.

| Need                                       | Component                                                                                                  | Notes                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page title, section, card title, paragraph | `Typography`, `Typography.Heading`                                                                         | See Type.                                                                                                                                                                                                                                                                                                                                                 |
| One-line label, value, caption, code       | `Text`                                                                                                     | `size`, `weight`, `tone`, `mono`, `tabular`.                                                                                                                                                                                                                                                                                                              |
| Icon                                       | `Icon`                                                                                                     | Decorative; `variant="duotone"` only for the selected state.                                                                                                                                                                                                                                                                                              |
| Actions                                    | `Button` (HeroUI)                                                                                          | `primary` once per screen, `secondary` for the rest, `tertiary` quiet, `ghost`/`outline` supporting, `danger-soft` destructive but not main, `danger` only to confirm.                                                                                                                                                                                    |
| Icon-only action                           | `IconButton`                                                                                               | Required `label`; `isSelected` draws duotone. 44 pt target.                                                                                                                                                                                                                                                                                               |
| Screen frame                               | `Screen`                                                                                                   | Safe areas, keyboard-aware scroll, pull to refresh (`onRefresh`), gutter 16. `bare` for full-bleed lists.                                                                                                                                                                                                                                                 |
| Bar without a native header                | `TopBar`                                                                                                   | Back button (label passed in), title (large 30 pt for top-level screens), up to three `IconButton`s. A tab's top bar is `TabTopBar` from `src/shell/tab-chrome.tsx` (title, Coach, Search, avatar menu).                                                                                                                                                  |
| Grouped rows (Settings, Profile, sheets)   | `ListSection` + `ListRow`                                                                                  | Group label, separators under the text, 40 pt icon tile, `value`, `trailing` control, chevron when it opens a screen, `tone="danger"` for Sign out/Delete. A row with its own control (Switch) leaves the control reachable by screen readers.                                                                                                            |
| Card, nested block                         | `Card`, `Surface` (HeroUI)                                                                                 | `bg-surface-secondary` for blocks nested in a card; never a card in a card.                                                                                                                                                                                                                                                                               |
| Text input                                 | `TextField` + `Label` + `Input`/`TextArea` + `Description`/`FieldError`                                    | Show errors after blur or submit, with the remedy. **On a white surface (card, sheet, dialog) pass `variant="secondary"`**, otherwise the white field disappears. Give the `Input` an `accessibilityLabel` equal to its label: HeroUI's `Label` is not linked to the input for VoiceOver.                                                                 |
| Other fields                               | `SearchField`, `Select`, `Checkbox`, `RadioGroup`, `Switch`, `Slider`, `InputOTP`, `ControlField` (HeroUI) | `Switch` sits at the trailing end of its row (`ListRow trailing`).                                                                                                                                                                                                                                                                                        |
| Date                                       | `DatePicker`                                                                                               | The **system** picker (`@react-native-community/datetimepicker`): Android's date dialog, iOS's inline calendar under the field. Values in and out as `YYYY-MM-DD` (`formatIsoDate`, `parseIsoDate`), never a `Date` that can shift a day.                                                                                                                 |
| Choice of 2–4 views                        | `Segment` (Pro, wrapped)                                                                                   | Selection haptic, selected item announced, hit slop to 44 pt. Long labels truncate: keep them short.                                                                                                                                                                                                                                                      |
| Panels of one screen                       | `Tabs` (HeroUI)                                                                                            |                                                                                                                                                                                                                                                                                                                                                           |
| Steps (onboarding)                         | `Stepper` (Pro, wrapped)                                                                                   | Labels per step ("Step 2 of 4"), finished steps can go back.                                                                                                                                                                                                                                                                                              |
| The one floating action                    | `Fab` (Pro, wrapped)                                                                                       | Icon + label, above the bottom safe area; `actions` turns it into the Pro speed dial. Only on Home and Documents (01-desain).                                                                                                                                                                                                                             |
| Swipe actions on a row                     | `SwipeableRow` (Pro, wrapped)                                                                              | Trailing actions only; a full swipe (past half the row) runs the first one, with a haptic at the threshold; touches within 24 pt of the left edge are left to the iOS back swipe. Every swipe action also lives in the row's menu.                                                                                                                        |
| Chips, tags, people                        | `Chip`, `TagGroup`, `Avatar` (HeroUI)                                                                      | A removable tag: name the remove button with `aria-label` ("Remove Figma"; `accessibilityLabel` is ignored) and add a delete accessibility action on the tag, because VoiceOver cannot reach the nested button.                                                                                                                                           |
| Application stage                          | `StageLabel`, `StageDot`                                                                                   | Dot beside the stage name, never the color alone.                                                                                                                                                                                                                                                                                                         |
| Loading                                    | `Skeleton`, `SkeletonGroup` (HeroUI)                                                                       | In the final shape of the content. Pass `variant="none"` (still), as on the web; HeroUI's default shimmer is not used.                                                                                                                                                                                                                                    |
| Busy without a shape                       | `Spinner` (HeroUI)                                                                                         | Prefer a button's pending state.                                                                                                                                                                                                                                                                                                                          |
| Known progress                             | `ProgressBar` (Pro, wrapped)                                                                               | One screen-reader element with a required label; accent by default.                                                                                                                                                                                                                                                                                       |
| Empty, no results, failed load             | `EmptyState`                                                                                               | The web's three kinds: `page` (nothing yet: one sentence and the action that adds the first one), `filtered` (a search or filter matched nothing: say what, offer to clear), `inline` (a dashed row inside a card). A failed load is `page` with `warning-circle` and Retry. Never restate the page title.                                                |
| Banner (offline, locked, failed save)      | `Alert` (HeroUI)                                                                                           | Statuses `default`, `accent`, `success`, `warning`, `danger`. HeroUI announces every status as an alert (the web: danger only); keep non-urgent banners short.                                                                                                                                                                                            |
| Main navigation on phones                  | `PushDrawer` (`src/ui/drawer.tsx`), filled by `src/shell/app-drawer.tsx`                                   | The menu sits behind the screen; the screen slides aside, rounded and dimmed (no bottom tab bar). Opened by the avatar or a swipe from the leading edge on a section's top screen only; closed by a tap or swipe on the screen, Android Back or the screen reader's escape. While open the screen is hidden from screen readers. Tablets use the sidebar. |
| Feedback after an action                   | `useAppToast()` / `showToast()`                                                                            | Bottom, one at a time, 6 s (doubled with a screen reader on), `undo: { label, onUndo }` instead of a confirmation; success and danger play their haptics; announced to screen readers. `ToastBridge` is mounted once in `app/_layout.tsx`; toasts clear the editor's pane bar (`setToastBarHeight`).                                                      |
| A task beside the screen                   | `Sheet`                                                                                                    | Native sheet (TrueSheet) on both platforms, controlled by `isOpen`/`onOpenChange`; `title`, `closeLabel`, `detents`, a sticky `footer` for the primary action that rises with the keyboard; `canDismiss={false}` + `onDismissAttempt` for unsaved edits (drag, back and close all ask). Form presentation on wide screens.                                |
| A short decision or form                   | `Dialog` (HeroUI)                                                                                          | Sized to its content.                                                                                                                                                                                                                                                                                                                                     |
| Confirm the irreversible                   | `ConfirmDialog`                                                                                            | `cancelLabel` names what cancel keeps; destructive confirms play the warning haptic. Reversible actions use an Undo toast instead.                                                                                                                                                                                                                        |
| Light choices from a trigger               | `Menu`, `Popover` (HeroUI)                                                                                 | Destructive items last; `presentation="bottom-sheet"` for long menus.                                                                                                                                                                                                                                                                                     |
| Short values one at a time (roles, places) | `ChipInput`                                                                                                | Return, a comma or leaving the field adds; each value is a removable tag (named remove button + delete accessibility action). `variant="secondary"` on a card.                                                                                                                                                                                            |
| Before a system permission prompt          | `PermissionPrimer` (through `askPermission` in `src/shell/permissions.tsx`)                                | One sheet says what for; only Continue opens the system dialog; a permission refused for good offers Settings. Never at launch: the feature asks the first time it needs it (notifications, camera, microphone, photos).                                                                                                                                  |

### App shell (`src/shell`, Phase 03)

- **Sections:** on phones the drawer behind the screen (`AppDrawerMenu` in `PushDrawer`, opened from the avatar at the
  start of each section's top bar, which shows a dot for unread notifications): the account, the sections with the
  selected one in accent and its duotone glyph, counts and the Home unread pill, New, the account pages, Sign out and
  the appearance switch; `AppSidebar` from 700 pt in the web's order (Home, Portfolio, Documents, Profile,
  Applications) with quiet counts, New and the account at its foot, a rail of icons under 1000 pt. Portfolio shows only
  when the account has portfolios.
- **Top bar of a tab:** `TabTopBar` (actions row: Coach, Search, avatar; then the 30 pt title). The avatar opens the
  account menu (Account, Plan on Android only, App settings, Help & legal, Sign out).
- **New:** `NewFab` on Home and Documents, phones only (the sidebar has New on tablets). It opens the New sheet.
- **Offline:** `OfflineStrip` under the status bar above every tab.
- **Leaving with unsaved edits:** `useUnsavedChangesGuard({ dirty })` asks with the system dialog for every way out.

### Pro components: used and rejected

| Component                                       | Decision                  | Why                                                                                                                                                                                                                                                          |
| ----------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `empty-state`                                   | Used                      | Under `EmptyState` (`page`, `filtered`).                                                                                                                                                                                                                     |
| `progress-bar`                                  | Used, wrapped             | Not one screen-reader element as shipped, and draws nothing without children.                                                                                                                                                                                |
| `segment`                                       | Used, wrapped             | Adds the selection haptic, ignores a press on the selected item, grows the hit area to 44 pt.                                                                                                                                                                |
| `stepper`                                       | Used, wrapped             | Steps had no accessibility; the wrapper adds labels, `selected` and the back press.                                                                                                                                                                          |
| `fab`                                           | Used, wrapped             | Pro's FAB is a speed dial; for one action the wrapper keeps it closed, drops "collapsed" and the 45° turn.                                                                                                                                                   |
| `swipeable-row`                                 | Used, wrapped             | Adds the full swipe and the iOS edge hand-off.                                                                                                                                                                                                               |
| `date-picker`, `calendar`                       | Rejected for single dates | A JavaScript calendar in a portal that can stack wrongly over native sheets, with English default strings; the system picker is used. `range-calendar`, `date-range-picker`, `calendar` and `agenda` are tried when the calendar views are built (Phase 10). |
| Charts (`line-chart`, `bar-chart`, `pie-chart`) | Not tried yet             | Insights and portfolio statistics (Phases 10, 12).                                                                                                                                                                                                           |

**Pro packaging.** The registry package is a stub whose licensed postinstall downloads the code. That code needs
`its-fine` and `d3-*`, which the stub does not declare: `pnpm-workspace.yaml` adds them with `packageExtensions`. Every
Pro component loads the chart primitives through an internal barrel, so the first Pro component brings the chart code
into the bundle. Pro's stylesheet does not register its sources, so `global.css` has `@source` for it; without it the
classes Pro composes in JavaScript (`data-[orientation=horizontal]:flex-row`) are never generated (the Stepper drew
empty circles).

## Deliberately different from the web

| Topic         | Web                          | App                                                                            |
| ------------- | ---------------------------- | ------------------------------------------------------------------------------ |
| Navigation    | Sidebar                      | Drawer behind the screen on phones (no bottom bar), sidebar on tablets         |
| Section menus | Text menu beside the page    | Scrollable segment under the title                                             |
| Dialogs       | Centered modal               | Bottom sheet; full screen for long forms; `ConfirmDialog` for the irreversible |
| Tooltips      | On every icon-only control   | None; icon-only controls carry an accessibility label                          |
| Hover         | Hover states                 | Press feedback (scale + highlight on iOS, ripple on Android)                   |
| Date pickers  | HeroUI DatePicker            | See DatePicker above                                                           |
| Fonts         | Variable fonts, every script | Static weights, Latin + Vietnamese; other scripts use the system font          |

iOS and Android differences stay inside `src/ui`: sheets are native on each (TrueSheet: UISheetPresentationController
and the Material bottom sheet), Android's back button closes the top sheet first, press feedback follows each
platform, and the system date/time pickers are each platform's own.

## Legacy bridge (until each screen is rebuilt)

Screens not rebuilt yet import `@/ui-legacy` (the former "Desk & Paper" primitives). Phase 02 mapped its tokens to
this system so the whole app already reads as one product: colors to the table above (`bg` → background, `surface` →
surface, `raised` → overlay, `sunken` → surface-secondary, `line` → border, `ink`/`ink3` → foreground/muted, `accent`
→ accent, `*Soft`/`*Text` → the soft pairs, `info*` → the accent pair), fonts to Google Sans (the serif display face
becomes Google Sans semibold, mono becomes Google Sans Code), radii to 4/8/12, and the legacy `Icon` draws the new
Hugeicons glyphs. Moved helpers (`motion`, `keyboard`, `safe-area`, `use-pull-refresh`) live in `src/ui`, and legacy
screens import them from there (`@/ui/keyboard`, `@/ui/motion`; no re-export shims are kept). Both toast systems sit
12 pt above the editor's pane bar while it shows (it reports its height with `setToastBarHeight`), otherwise above the
bottom safe area. Each phase deletes the legacy screens it rebuilds and removes them from
`src/design-guard.legacy.json`; Phase 15 deletes `src/ui-legacy`.
