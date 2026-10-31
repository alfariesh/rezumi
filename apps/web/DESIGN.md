---
version: 7.0.0
name: Rezumi · HeroUI
description: The app is HeroUI's default system as shipped: its palette, radius, system type and focus ring, with HeroUI Pro for the shell and the data-heavy surfaces. Rezumi adds paper, application stages and a few layout and motion tokens. The homepage keeps its own Desk & Paper look.
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
  family: "HeroUI system stack (--font-sans); --font-mono for shortcuts, URLs and counts"
  body: { fontSize: 14px, fontWeight: 400 }
  title: { fontSize: 30px, lineHeight: 36px, fontWeight: 600, letterSpacing: -0.025em }
  heading: { fontSize: 20px, lineHeight: 28px, fontWeight: 600 }
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
  easing: cubic-bezier(0.2, 0.8, 0.2, 1)
  exit: 70% of the entering duration
  movement-easing: cubic-bezier(0.77, 0, 0.175, 1)
marketing:
  typography:
    display: { fontFamily: Instrument Serif, fontWeight: 400 }
    write-title: { fontFamily: Instrument Serif, fontSize: "clamp(72px, 9vw, 160px)", lineHeight: 0.9, fontWeight: 300 }
    numeral:
      {
        fontFamily: Instrument Serif,
        fontSize: "clamp(56px, 7.5vw, 136px)",
        fontWeight: 300,
        fontVariantNumeric: tabular-nums,
      }
    body: { fontFamily: Instrument Serif, fontSize: "16–21px", lineHeight: "1.45–1.5", fontWeight: 400 }
    accent: { fontFamily: Instrument Serif, fontStyle: italic, color: accent-text }
    label: { fontFamily: Figtree, fontSize: 13px, fontWeight: 500 }
  colors:
    graphite: { light: "oklch(0.38 0.01 95 / .3)", dark: "oklch(0.9 0.01 95 / .18)" }
    night-1: "oklch(0.24 0.03 265)"
    night-2: "oklch(0.15 0.02 265)"
    night-accent: "oklch(0.8 0.13 150)"
    star: "oklch(0.72 0.14 80)"
    receipt: "#FDFCF8"
    bulb-glass: "oklch(0.95 0.11 92)"
    bulb-filament: "oklch(0.7 0.16 60)"
  shadow:
    paper:
      light: "0 1px 2px oklch(0.2 0.01 95 / 0.12), 0 40px 80px -30px oklch(0.2 0.01 95 / 0.5), 0 0 0 1px oklch(0.2 0.01 95 / 0.04)"
      dark: "0 1px 2px oklch(0 0 0 / 0.5), 0 40px 80px -30px oklch(0 0 0 / 0.8)"
  motion:
    pull-easing: cubic-bezier(0.3, 1.7, 0.5, 1)
  doodles: { opacity: { light: 0.92, dark: 0.8 }, darkFilter: "brightness(0.92)" }
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
- **Fields:** fill only: no border and no drop shadow (`--field-shadow` is zero). On a white surface use `variant="secondary"` (the default fill disappears on white). On a gray nested card use the `fields-on-card` utility; inside a collapsible section's body use `fields-on-background` (both in `apps/web/src/index.css`).
- **Paper:** `--paper` stays white in both themes. Switching the theme must not invert documents.
- **Stages:** `stage-saved`, `stage-applied`, `stage-screening`, `stage-interview`, `stage-offer` and `stage-closed` identify application stages. Use small dots or stepper bars beside the stage name, never the color alone.

Use semantic tokens in app code. No arbitrary colors and no palette classes such as `amber-600`; the old Desk & Paper names (`ink`, `line`, `raised`, `sunken`, `warn`, `shadow-e1`) exist only inside the homepage's `.landing` scope.

## Typography

HeroUI's system stack, with no webfont in the app. Hierarchy comes from size and weight.

- **Titles:** 30px semibold with `tracking-tight` for a page title (`PageHeader`); 20px semibold for a section; 14px medium for a label. Body is 14px. Descriptions and metadata are `text-muted` at 12–14px.
- **Numbers:** `tabular-nums` on prices, counts, scores and stats so columns align.
- **Mono:** `font-mono` for shortcuts, URLs, slugs, filenames and counts.
- No all-caps labels or title caps: headings, eyebrows, group labels and buttons are sentence case at 12px or larger, with normal tracking.
- Field labels are 12–14px medium; a description sits under the control in `text-muted`.
- Rendered rich text (assistant and coach replies, the rich-text editor) uses `packages/ui/src/styles/typeset.css`, an owned stylesheet based on shadcn's typeset (MIT) that reads HeroUI tokens. Wrap content in `typeset` plus a preset: `typeset-chat` or `typeset-field`. It styles only the elements those surfaces render (no images, `kbd`, `details`, definition lists or math). Opt a component out with `not-typeset`.
- Touch inputs use at least 16px text to prevent iOS zoom.

## Iconography

Every system icon in the web and mobile apps comes from the Hugeicons Pro set staged in `packages/icons` (`@rezumi/icons`). Do not add another icon library, import `@hugeicons/*`, or draw a one-off SVG for the interface; a missing glyph is added to the set.

- **Two variants.** `stroke` is the default: Stroke Standard, 24px grid, 1.5px line. `duotone` (Duotone Standard) is for the selected state only: the current sidebar item, the active mobile navbar tab, and the selected tab or segment. It is also the solid form of stop, play, pause and star. Never use duotone for resting controls, and never mix other Hugeicons styles (rounded, sharp, solid, bulk, twotone) into the interface.
- **Web.** `Icon` from `@rezumi/ui/components/icon` takes a Phosphor-style kebab name (`x`, `gear-six`, `magnifying-glass`) and an optional `variant="duotone"`. Those names are the shared vocabulary for web and mobile and stay stable; `packages/icons/icons.config.json` maps each to its Hugeicons glyph. Pass `variant` from the selected state: `variant={isCurrent ? "duotone" : "stroke"}`.
- **Mobile.** The native app draws the same names and the same two variants from `@rezumi/icons` (render data in `getAppIcon`, raw files in `@rezumi/icons/svg/<style>/<name>.svg`). Its `Icon` still uses Phosphor until it moves over; the tab bar and navbar active state become duotone then.
- **Adding or changing a glyph.** Edit `icons.config.json` (the `app` map for an icon in use; `appCategories` stages whole categories as files only), then run `pnpm --filter @rezumi/tooling icons:sync <path to the Hugeicons SVG export>`. The command rewrites `packages/icons/svg`, `catalog.json` and `src/generated`; do not edit those by hand. Brand marks (Apple, Google, GitHub, LinkedIn, Google Play) are in the map like any other glyph.

Use 20px icons on desktop and 24px on touch interfaces; 16px inside small buttons, chips and rows. `Icon` is decorative (`aria-hidden`), so pair it with text or give the control a label. Icon-only controls use `IconButton` (a `Button isIconOnly` with a tooltip, an optional shortcut and a required label). Directional arrows, chevrons, undo and redo mirror in RTL layouts.

Icons inside resumes are Phosphor names stored in resume data, drawn by the Phosphor web font (`@phosphor-icons/web`) in the page and by generated SVG data in the PDF (`pnpm --filter @rezumi/tooling icons:pdf`). They are separate from app icons. The resume's icon style will be a person's choice of three stroke-only sets: rounded, standard or sharp. `packages/icons/svg/stroke-rounded`, `stroke-standard` and `stroke-sharp` already hold every brand logo and the resume-related categories (work, education, awards, programming, sport, health, legal), and `catalog.json` maps the Phosphor names resumes use today (`cvPhosphor`) to their Hugeicons counterparts. The preference itself is not built yet; until it is, resumes keep drawing Phosphor.

## Space, shape and elevation

- **Spacing:** the 4px scale. Cards 16px padding; panels 16–24px; phone pages 16px margins; desktop pages 32–40px margins with generous top padding, and a constrained max width (Career and Settings use a centred 720px column) so lines stay readable.
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

- Entering and changing state use `ease-enter` (`cubic-bezier(0.2, 0.8, 0.2, 1)`). Exits take 70% of the entry duration. Bare `transition-*` utilities already use these.
- Sliding indicators, reordering and settling use `ease-in-out-strong` (`cubic-bezier(0.77, 0, 0.175, 1)`). Swipe-dismissed bottom sheets use `ease-drawer`. `ease-out-strong` is for marketing pages only.
- Hover states on sidebar links and nav items are static (color or background), not animated.
- First appearance uses the `starting:` variant (`ENTER_CLASS`, `POP_CLASS` in `apps/web/src/libs/motion.ts`), not an animation library class. Loading placeholders stay still; document reflow is never animated. Keyboard mode switches are instant.
- Reduced motion sets the duration tokens to 1ms and collapses CSS transitions and animations. Status spinners continue turning.
- `apps/web/src/libs/motion.ts` mirrors the CSS timings for Motion. `MotionConfig reducedMotion="user"` and `followReducedMotion()` make Motion animations respect the preference.

The homepage has separate motion rules below.

## Components

Use HeroUI and HeroUI Pro directly at call sites: `onPress` (not `onClick`), `isDisabled`, `isPending`, `isSelected`, compound parts in dot notation (`Card.Header`, `Sheet.Content`). Look a component up with the HeroUI MCP before using it; never guess a name or a prop. `packages/ui` keeps only what HeroUI lacks: `Icon`, `IconButton`, `HoldButton` (press and hold to confirm), `Form` (TanStack Form wired to a label, description and error for any control), `SwitchRow`, `NativeSelect`, `Swap`, the toast helper, `MessageScroller`, `Trace`, `BrandIcon` and two hooks. Feature-specific UI belongs in its owning `apps/web` feature.

- **Shell:** Pro `AppLayout` with a 240px `Sidebar` (collapsible to icons by default below 1024px; the state is the `sidebar_state` cookie) and a `Navbar`. The sidebar holds the brand, the command-bar search, the destinations (Career opens its Today, Knowledge and Offers pages as a submenu), New and the account menu. Phones open the same sidebar from a menu sheet; there is no bottom tab bar. Headers carry only contextual controls and page actions, never the brand or the user.
- **Pages and groups:** every group of content is a Pro `Widget`: a level-2 title, an optional trailing action, a muted description line and an optional footer. Blocks nested in a widget use `rounded-xl bg-surface-secondary` with no border; rows split by a `Separator`, starting under the text. A row is the 40px `RowIcon` tile, the text and the control, the same on Settings and Career.
- **Buttons:** `primary` for the one main action, `secondary` for the rest, `ghost` and `outline` for supporting actions, `tertiary` for quiet ones, `danger-soft` for destructive actions that are not the main one, `danger` for the confirmation. Give a button text only unless an icon adds information; pending state is `isPending`. Provide an escape action (Cancel, Skip) beside the primary action in footers.
- **Inputs:** `TextField` with `Label`, `Description` and `FieldError`; show errors after blur or submission, with a specific remedy. `Segment` (Pro) for 2–4 options and `Tabs` for panels; `Switch` is at the trailing end of its row and uses the dot-notation anatomy; prefer `SwitchRow` when the label is part of the target.
- **Menus:** `Dropdown` with a ghost `Button` or `IconButton` trigger and no chevron unless the affordance would be invisible; destructive items last, after a separator; `ContextMenu` for right-click. The command bar is Pro `Command` (⌘K): put keywords into each item's `textValue`.
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

The public homepage in `apps/web/src/features/homepage` keeps the earlier Desk & Paper look, scoped to the `.landing` wrapper: its own palette, typography, illustrations and motion. It shares the app's theme switch (the `.dark` class) and nothing else. `landing.css` defines the palette (below), the fonts (Figtree, Instrument Serif and Geist Mono, imported there), the names its utilities use (`bg-bg`, `text-ink`, `text-ink-2`, `text-ink-3`, `border-line`, `accent-text`, `shadow-e1` to `shadow-e3` and the rest), the graphite color, paper shadows and ambient animations. Illustration colors in the front matter are scene values, not tokens. The other public pages under `routes/_home` (templates, the ATS checker) are app surfaces and use HeroUI tokens.

### Palette

OKLCH values live in `.landing` and `.dark .landing`; light sRGB approximations: `bg` #F8F7F3, `surface` #FEFDFC, `raised` #FFFFFF, `sunken` #F0EFEB, `line` #DFDEDA, `line-2` #C5C4BE, `ink` #1C1B15, `ink-2` #4F4D47, `ink-3` #6D6C65, `accent` moss #337344, `accent-text` #195C2E, `accent-soft` #DCF2DF. Dark: `bg` #100F0C, `surface` #171613, `ink` #EFEEEB, `accent` #6FC082. Radius is 4px, with 2px for small marks; nothing is rounder, and there are no pills.

### Brand and type

- **Header:** a 30px logomark from `apps/web/public/icon/{light,dark}.svg`. Keep “Rezumi” as visually hidden text inside the home link.
- **Footer:** a 140px logo from `apps/web/public/logo/{light,dark}.svg` above the hero's promise (its two highlighted phrases in `accent-text`), the link columns, then a line of community, MIT license and version copy.
- **Footer desk:** two drawings of the same writing desk in front of an open window, day (`apps/web/public/illustrations/footer-desk-light.webp`, moss and charcoal on white) and night (`footer-desk-dark.webp`, silver and amber on black). The light one multiplies and the dark one lightens into the page, so their white or black wall vanishes and the desk seems to stand on the footer; their far edges fade out. As the desk scrolls into view it paints itself in from the window down, just ahead of the fold, while it rises and settles from a 4% zoom; it completes exactly when the page ends (`--dp`, written by `scroll.ts`; 1 under reduced motion). In the light theme a soft morning glow rises behind the window with it. Its objects are links back into the story, each showing its scene number and name on hover or focus: the resume to Write, the glasses to Check, the letters to Share, the calendar to Prepare, the window to Remember. The lamp switches the theme, like the header's cord. Below 700px the desk crops to its middle and the hotspots hide (the columns carry the same links). Hotspot boxes are percentages of the drawing (`getDeskSpots` in `footer.tsx`): re-measure them if the drawing changes. The wall must be pure white in the day drawing and pure black in the night one: multiply and lighten only make those disappear, and any tint shows as a band. Flatten with `magick in.png -background white -alpha remove -alpha off flat.png` (black for the night one); if the wall came back tinted, lift it to white per channel (e.g. `-channel R -level 0,97% -channel G -level 0,96.6% -channel B -level 0,95% +channel` for a #F8F7F3 wall), then `cwebp -q 74 -m 6 -sharp_yuv flat.png -o out.webp`. The 3200px drawing also ships at 1600px and 2400px (`footer-desk-<theme>-1600.webp`, `-2400.webp`; `magick -filter Lanczos -resize 1600x`, same `cwebp` settings), listed in the images' `srcSet`.
- **Instrument Serif (`font-anybody`):** hero and closing headlines, selected scene titles, and large numerals. `font-anybody` is an alias of `font-display`.
- **Instrument Serif:** body copy, italic accents, and serif title treatments in the Design scene.
- **Labels (`font-martian`, an alias of `font-ui`):** Figtree 13px, weight 500, sentence case (`labelClass`).
- **Figtree:** buttons and mock app UI. The receipt keeps IBM Plex Mono (`public/fonts`).

### Controls

- Repeat the same primary CTA, “Build your resume,” in the header, hero, and closing section. Buttons have 2px corners, in Figtree 600, at 38px, 54px, and 56px respectively.
- Scene navigation appears from 1240px. Sentence-case labels use `ink` when active and `ink-3` when inactive; a 6px accent dot marks the active scene. The Share night scene uses its own light inks.
- The GitHub link appears from 1024px, with the GitHub mark, a duotone gold star, and a live compact count. Format counts with the locale's `Intl.NumberFormat`; include the full count in the accessible name.
- The homepage theme control is a fixed 30px pull-cord button at the top end corner. Its height is 92px at rest, 112px on hover, and 124px during a pull. It uses a 450ms spring curve, toggles the shared theme after 170ms, and sways every seven seconds until first activated. The bulb glows in dark mode.

### Motion

Pinned scenes contain a sticky `100svh` stage. Scroll progress is `p = clamp(0, −top / max(1, height − viewportHeight), 1)`; `scroll.ts` writes it to `--p` through one animation-frame-throttled scroll listener. CSS derives continuous motion from progress; React receives only coarse scene and step changes.

| Scene  | Below 900px | From 900px |
| ------ | ----------- | ---------- |
| Hero   | 190vh       | 260vh      |
| Write  | 280vh       | 330vh      |
| Design | 380vh       | 440vh      |
| Check  | 260vh       | 320vh      |
| Tailor | 280vh       | 330vh      |
| Share  | 240vh       | 300vh      |

Light mode combines breathing window light (16 seconds), a drifting mullion shadow (90 seconds), and 18 dust motes. Dark mode adds a neutral 620px cursor glow at 6% opacity. These are decorative and must not obscure text.

Scroll performance (Firefox and phones dropped frames here): the mullion shadow's softness is drawn into its gradients, never `filter: blur()`; backdrop blur uses the `blur-ok` variant (fine pointer, non-Gecko only) and falls back to the plain tinted backdrop; components that follow fast-changing scroll steps (Check's score, Prepare's clock and countdown) subscribe to `useLanding` on their own so the scene around them doesn't re-render.

Reduced motion fixes scenes at their end state and collapses pinned sections to `100svh`. Disable scroll scrubbing, parallax, ambient movement, cord sway, and count animations. The Languages word rotation has a pause control and stays still with reduced motion.

### Illustration

- Nine watercolour doodles live in `apps/web/public/doodles/` as transparent WebP (up to 800px, plus a half-size `-small` and a quarter-size `-tiny`, each resized from the full file with `magick -filter Lanczos` and encoded with the same `cwebp` settings): pencil, paperclip, eraser, curve, magnifier, scissors, plane, globe, and note. They share the footer desk's style: soft washes, thin blue-grey pen lines, cream, sage, moss, slate blue, terracotta and ochre. Prompts and references for regenerating them are kept outside the repo; each is trimmed to its content and its faint background alpha cleaned (`-channel A -level 4%,100%`) before encoding losslessly in alpha (`cwebp -q 82 -alpha_q 100 -exact`), and its size goes in `doodleSizes` (`ui.tsx`). The magnifier is not trimmed: its empty glass is the Check lens, so `check.tsx` positions it from the lens's measured centre and radius in the 1024px source.
- Doodles appear through a 110° mask wipe with subtle parallax. They keep their colours in both themes: opacity 0.92 in light mode, 0.8 and slightly dimmed (`brightness(0.92)`) in dark. No drop shadows: a hard shadow draws the image's box against the paper texture. The Share plane fades in with the night sky.
- Most doodles hide below 900px; pencil and plane remain. Keep them decorative, noninteractive, and clear of readable text.
- Construction guides use `graphite` lines with an SVG turbulence filter for a pencil effect.

### Content and delivery

- Prerender the homepage and public ATS checker per locale at build time through `prerender.tsx` and `apps/web/vite.config.ts`. The app is a client-rendered SPA; `apps/server/src/static/web.ts` serves the generated HTML and adds canonical, Open Graph, `hreflang`, and structured data. Keep headings and body copy in the initial HTML. Prerendered pages start the app's JavaScript only after the first contentful paint (the loader in `vite.config.ts`), so their first screen must not depend on it, and must not fade in on load: the largest paint would wait for the fade.
- Include title and description metadata and `SoftwareApplication` structured data with a zero-price offer.
- **Template previews** come from each template's sample PDF (`apps/web/public/templates/pdf/<id>.pdf`), never at print resolution: `templates/jpg/<id>.jpg` at 600×848 (builder and letter cards, the mobile picker and the README; old mobile builds load this URL, so it stays a JPEG), and `templates/thumb/<id>.webp` at 596×843 with a 300×424 `<id>-small.webp` (homepage and gallery). Regenerate them with the server's sharp:

  ```sh
  id=gengar
  pdftoppm -png -r 300 -singlefile "apps/web/public/templates/pdf/$id.pdf" "/tmp/$id"
  (cd apps/server && node --input-type=module -e '
  import sharp from "sharp";
  const id = process.argv[1], dir = "../web/public/templates";
  const page = (width) => sharp(`/tmp/${id}.png`).resize(width, Math.round((width * 3508) / 2481), { fit: "fill" });
  const webp = { quality: 75, effort: 6, smartSubsample: true };
  await page(600).jpeg({ mozjpeg: true, quality: 75 }).toFile(`${dir}/jpg/${id}.jpg`);
  await page(596).webp(webp).toFile(`${dir}/thumb/${id}.webp`);
  await page(300).webp(webp).toFile(`${dir}/thumb/${id}-small.webp`);
  ' "$id")
  ```

- Use one `h1`, section headings, landmarks, and a skip link. Animated character treatments expose the complete string once to assistive technology. Nothing relies on hover alone.
- Translate copy, accessible labels, and demo resume text through Lingui. Names and addresses may stay literal; the Languages display intentionally preserves native words and language names. Allow text expansion and RTL layouts.

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
