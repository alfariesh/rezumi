# HeroUI Pro v3 (`@heroui-pro/react`) API reference: navigation and overlays

Source: `heroui-pro` MCP `get_component_docs` (Pro docs) for navbar, command, context-menu, stepper, sheet, emoji-picker, resizable. Purpose: guide migrating Rezumi web (`apps/web`, React 19 + Tailwind v4 + TanStack Router) from shadcn/Base UI (`packages/ui/src/components`) to HeroUI default style.

Rules for this file:

- Props and parts come from the Pro docs. Anything marked **[d.ts]** comes from the installed package types (`apps/web/node_modules/@heroui-pro/react/dist`, version `1.0.0-beta.10`) and is NOT in the docs. Anything marked **[verify]** is inference or something the docs are silent on.
- Sibling reference for OSS parts (Button, Dropdown, Kbd, SearchField, CloseButton...): `.agents/docs/heroui/oss-a-l.md`.

## Pro conventions that apply to every component below

- Compound components use dot notation. No Provider required. Tailwind v4 required. Press events are `onPress` (not `onClick`); disabled is `isDisabled`.
- Import path: root `import {Navbar, Command, ContextMenu, Stepper, Sheet, EmojiPicker} from "@heroui-pro/react"` works for all but Resizable. **[d.ts]** every one also has a subpath (`@heroui-pro/react/navbar`, `/command`, `/context-menu`, `/stepper`, `/sheet`, `/emoji-picker`). **Resizable is subpath-only**: `@heroui-pro/react/resizable`.
- Pro CSS already imported: `packages/ui/src/styles/globals.css` has `@import "@heroui/styles"; @import "@heroui-pro/react/css";`. Pro BEM classes (`.navbar`, `.command__dialog`, `.sheet__content--bottom`...) are overridable in `@layer components`.
- Pro components wrap React Aria Components (RAC). "Also supports all RAC X props" in the docs means the RAC prop surface is inherited but not enumerated; read RAC docs for those (installed `react-aria-components` 1.22.1).
- Hard-coded English defaults that Lingui must override: `Command.InputGroup.Input placeholder` (`"Search commands..."`), `Navbar.MenuToggle srLabel` (`"Toggle navigation menu"`), `EmojiPicker.SkinToneTrigger aria-label` (`"Select skin tone"`), and the labels inside `EMOJI_SKIN_TONES` / `EMOJI_CATEGORIES`.
- Polymorphism: where noted, `render={(props) => <Link .../>}` replaces Base UI's `render={<el/>}` element form. The function receives props to spread.

Peer deps of the installed Pro package that matter here **[d.ts]**: `react-aria-components >=1.21.1`, `react-resizable-panels >=4.10.0` (repo has `^4.15.1`), `motion >=12.12.0`, `@heroui/react >=3.2.6`.

---

## 1. Navbar

Import: `import {Navbar, useNavbar} from "@heroui-pro/react"` (also `@heroui-pro/react/navbar`).
Purpose: composable top navigation bar with hide-on-scroll, built-in responsive mobile menu and client-side routing.

### Anatomy (as the examples nest it)

The docs Anatomy block lists `Menu`/`MenuToggle` inside `Header` and `Content` outside it. Every example instead does this, which is what to copy:

```
Navbar                      <nav>, context provider
  Navbar.Header             <header>, the bar
    Navbar.MenuToggle       hamburger (md:hidden)
    Navbar.Brand            <div>, polymorphic (render)
    Navbar.Content          <div>, group of items (hidden md:flex for desktop-only)
      Navbar.Item           <a> if href, else <button>; polymorphic
        Navbar.Label        truncated text span
      Navbar.Separator      vertical divider (HeroUI Separator)
    Navbar.Spacer           flex-grow gap
  Navbar.Menu               mobile dropdown, SIBLING of Header
    Navbar.MenuItem         same API as Item; closes the menu on press
```

### Props

`Navbar` (all `<nav>` props too):

| Prop                                                          | Type                                              | Default                                                              |
| ------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------- |
| `position`                                                    | `"sticky" \| "static" \| "floating"`              | `"sticky"`                                                           |
| `size`                                                        | `"sm" \| "md" \| "lg"`                            | `"md"` (header, items, toggle sizing)                                |
| `maxWidth`                                                    | `"sm" \| "md" \| "lg" \| "xl" \| "2xl" \| "full"` | `"lg"` (640/768/1024/1280/1536px/100%)                               |
| `height`                                                      | `string`                                          | `"4rem"` (sets `--navbar-height`)                                    |
| `hideOnScroll`                                                | `boolean`                                         | `false` (hide on scroll down, reveal on scroll up, spring transform) |
| `parentRef`                                                   | `RefObject<HTMLElement \| null>`                  | window (scroll container for `hideOnScroll`)                         |
| `isMenuOpen` / `defaultMenuOpen` / `onMenuOpenChange(isOpen)` | `boolean` / `boolean` / fn                        | controlled / `false` / -                                             |
| `shouldBlockScroll`                                           | `boolean`                                         | `true` (locks body scroll while menu open)                           |
| `navigate`                                                    | `(href: string) => void`                          | - (see Routing)                                                      |

`Navbar.Item` and `Navbar.MenuItem`:

| Prop          | Type                      | Default                                                                                          |
| ------------- | ------------------------- | ------------------------------------------------------------------------------------------------ |
| `href`        | `string`                  | - ; external `http(s)://` opens new tab via `window.open(href, "_blank", "noopener,noreferrer")` |
| `isCurrent`   | `boolean`                 | `false`; sets `aria-current="page"` and `data-current="true"`                                    |
| `forceReload` | `boolean`                 | `false`; skips `navigate`, uses `window.location.href`                                           |
| `render`      | `(props) => ReactElement` | -                                                                                                |

`Navbar.MenuToggle` (wraps RAC `ToggleButton`, selected state bound to `isMenuOpen`): `srLabel` (default `"Toggle navigation menu"`), `children` (custom icon; default animated hamburger/close).
`Navbar.Brand`: polymorphic via `render`. `Navbar.Header/Content/Label/Spacer/Menu`: plain elements, no documented props. `Navbar.Separator`: HeroUI Separator, vertical.

`useNavbar()` returns `{height, isHidden, isMenuOpen, setMenuOpen(open), navigate}`; use inside Navbar children (e.g. close menu from a custom button).

### State and events

- Mobile menu: controlled `isMenuOpen`/`onMenuOpenChange`, or uncontrolled `defaultMenuOpen`. `Navbar.Menu` only renders while open and fills `calc(100dvh - var(--navbar-height))`.
- Hidden: `useNavbar().isHidden` / `.navbar[data-hidden="true"]`; menu open: `.navbar[data-menu-open="true"]`.

### Routing

Resolution order: explicit `navigate` prop, then `navigate` inherited from an enclosing `AppLayout`, then a global React Aria `RouterProvider`, then native browser navigation. Three integration options:

1. Global RAC `RouterProvider` (recommended; also routes other Pro link components such as `Sidebar.MenuItem`). Modifier-clicks still open new tab.
2. Per-`Navbar` `navigate`. TanStack form from the docs: `<Navbar navigate={(href) => router.navigate({ to: href })}>` with `const router = useRouter()`.
3. `render` prop with the router's own `<Link>` (keeps prefetch): `<Navbar.Item href="/features" render={(props) => <Link href="/features" {...props} />}>`. `navigate` is still used for programmatic navigations such as closing the mobile menu then pushing.

**[verify]** TanStack Router with option 1: React Aria's routing guide (not the Pro docs) shows `<RouterProvider navigate={(to, opts) => router.navigate({to, ...opts})} useHref={(to) => router.buildLocation({to}).href}>` from `react-aria-components`, mounted inside the router (root route component), because `apps/web/src/main.tsx` already renders TanStack's own `RouterProvider`. Typed `to` needs RAC's `RouterConfig` module augmentation.

### Responsive / mobile, CSS

`MenuToggle` + `Menu` are the built-in mobile pattern; breakpoint switching is yours (`hidden md:flex` on desktop groups, `md:hidden` on the toggle).
Variables: `--navbar-height` (4rem; sm 3rem; lg 5rem), `--navbar-max-width` (1024px), `--navbar-transition-duration` (300ms, reserved), `--spacing` (Tailwind v4 base; override on navbar to scale all padding/gaps/icons uniformly, e.g. `style={{"--spacing": "0.22rem"}}` with `height="2.75rem" size="sm"` for compact).
Classes: `.navbar`, `.navbar--sticky|static|floating`, `.navbar__header(--max-*|--sm|md|lg)`, `.navbar__brand`, `.navbar__content`, `.navbar__spacer`, `.navbar__item(--sm|lg)`, `.navbar__label`, `.navbar__separator`, `.navbar__menu-toggle`, `.navbar__menu`, `.navbar__menu-item`. `floating` adds `rounded-2xl`, border, `shadow-surface`, `mx-2`.

### Gotchas

- Item with no `href` renders `<button>`; icon-only items use `<Navbar.Item><Icon data-slot="icon" /></Navbar.Item>` and need an `aria-label` (**[verify]** no label prop documented).
- Navbar root is a `<nav>` landmark; add `aria-label` when several navs exist (Rezumi already labels them).
- Default `position` is `sticky`, not `fixed`. No `fixed` option documented; use `className="fixed inset-x-0 top-0"` **[verify]**.
- `hideOnScroll` listens to `window` unless `parentRef` is given.
- `MenuItem` press closes the menu automatically.
- `Navbar.Menu` placed inside `Header` per the Anatomy block vs sibling per the examples: use sibling.

### Minimal example

```tsx
import { Navbar } from "@heroui-pro/react";
import { Link } from "@tanstack/react-router";

export function SiteNavbar({ current }: { current: string }) {
  return (
    <Navbar aria-label="Main navigation" hideOnScroll maxWidth="xl">
      <Navbar.Header>
        <Navbar.MenuToggle className="md:hidden" srLabel="Menu" />
        <Navbar.Brand>Rezumi</Navbar.Brand>
        <Navbar.Spacer />
        <Navbar.Content className="hidden md:flex">
          <Navbar.Item
            href="/pricing"
            isCurrent={current === "/pricing"}
            render={(props) => <Link {...props} to="/pricing" />}
          >
            Pricing
          </Navbar.Item>
        </Navbar.Content>
      </Navbar.Header>
      <Navbar.Menu>
        <Navbar.MenuItem href="/pricing">Pricing</Navbar.MenuItem>
      </Navbar.Menu>
    </Navbar>
  );
}
```

### Fit for Rezumi

- No navbar primitive exists in `packages/ui/src/components`. Closest: `apps/web/src/routes/_home/-sections/header.tsx` (prerendered marketing header: fixed, `<nav aria-label>`, hide-on-scroll hand-built with `motion/react` `useScroll`). Navbar `hideOnScroll` replaces that logic; the header has no mobile menu today, so `MenuToggle`/`Menu` is net-new.
- `apps/web/src/features/homepage/header.tsx` (`LandingHeader`: scene-scroll buttons with `aria-current="step"`, gradient taper, night-ink) is not link navigation; keep custom.
- Dashboard (`routes/dashboard/-components/app-shell.tsx`) and editor tab bars (`features/resume/editor/chrome/shell.tsx`) are sidebars / bottom tab bars, not top navbars. Out of scope for Navbar.
- Gaps: no documented `fixed` position; prerender compatibility (`features/homepage/prerender.tsx` imports the header; Navbar uses a spring transform and a window scroll listener, SSR behaviour undocumented **[verify]**); Rezumi's translucent blur header (`bg-bg/80 backdrop-blur-lg`) must be reapplied via `className`.

---

## 2. Command

Import: `import {Command} from "@heroui-pro/react"` (also `/command`).
Purpose: modal command palette with search filtering, grouped items, keyboard navigation. Dialog + overlay are built in (replaces Dialog + cmdk).

### Anatomy

```
Command                          root provider (children only)
  Command.Backdrop               ModalOverlay: isOpen / onOpenChange live HERE
    Command.Container            Modal, positions dialog at 15vh; size
      Command.Dialog             RAC Dialog wrapping an internal Autocomplete (search state lives here)
        Command.Header           <div> above input (breadcrumb chips, tabs)
        Command.InputGroup       RAC SearchField
          .Prefix  .Input  .ClearButton  .Suffix
        Command.List             RAC Menu (scrollable)
          Command.Group heading  RAC MenuSection
            Command.Item         RAC MenuItem
          Command.Separator
        Command.Footer           <div> below list (shortcut hints)
```

### Props

| Part                                                                   | Props (type, default)                                                                                                                                                                  |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Command`                                                              | `children`                                                                                                                                                                             |
| `Command.Backdrop`                                                     | `isDismissable: boolean` (`true`), `variant: "opaque" \| "blur" \| "transparent"` (`"opaque"`), plus all RAC `ModalOverlay` props (`isOpen`, `onOpenChange`, ...)                      |
| `Command.Container`                                                    | `size: "sm" \| "md" \| "lg"` (`"md"`), plus all RAC `Modal` props                                                                                                                      |
| `Command.Dialog`                                                       | `inputValue: string`, `defaultInputValue: string`, `onInputChange(value)`, `filter(textValue, inputValue) => boolean` (default case-insensitive contains), plus all RAC `Dialog` props |
| `Command.InputGroup`                                                   | `autoFocus: boolean` (`true`), plus all RAC `SearchField` props                                                                                                                        |
| `Command.InputGroup.Input`                                             | `placeholder` (default `"Search commands..."`), plus RAC `Input` props (e.g. `onKeyDown`)                                                                                              |
| `Command.InputGroup.ClearButton`                                       | all HeroUI `CloseButton` props; auto-hidden when input empty (`[data-empty="true"]` on the group)                                                                                      |
| `Command.InputGroup.Prefix/Suffix`, `Command.Header`, `Command.Footer` | plain `<div>`                                                                                                                                                                          |
| `Command.List`                                                         | `renderEmptyState: () => ReactNode`, plus all RAC `Menu` props (example uses `onAction(key)`)                                                                                          |
| `Command.Group`                                                        | `heading: ReactNode`, plus RAC `MenuSection` props                                                                                                                                     |
| `Command.Item`                                                         | all RAC `MenuItem` props. Examples use `id`, `textValue` (required for filtering and a11y; filter matches on `textValue`), `className`, `isDisabled` pattern per RAC                   |
| `Command.Separator`                                                    | all RAC `Separator` props                                                                                                                                                              |

Dialog sizes: sm `max-w-sm` / 300px max-height; md `max-w-lg` / 356px (default); lg `max-w-xl` / 440px.

### State and events

- Open state: controlled via `Command.Backdrop isOpen onOpenChange` (every example). Trigger is just a `Button onPress={() => setOpen(true)}`; the global hotkey (Rezumi: `Mod+K` via `@tanstack/react-hotkeys`) stays outside.
- Search text: uncontrolled (`defaultInputValue`) or controlled (`inputValue` + `onInputChange`) on `Command.Dialog`.
- Selection: `Command.List onAction={(key) => ...}` keyed by `Command.Item id` (the Clean example). Per-item `onAction` is a RAC `MenuItem` prop but is not shown in the Pro docs **[verify]**.
- Escape and outside-click close through RAC Modal (`isDismissable` on Backdrop).
- Nested pages (Clean example): `pages: string[]` state; render Items/Groups conditionally per page; breadcrumb chips in `Command.Header`; `Input onKeyDown` Backspace on empty input pops the page (`preventDefault`); reset pages + input in `Backdrop onOpenChange(false)`; `List onAction` pushes a page for drill-in items.

### Routing, mobile, CSS

- No built-in routing: navigate from `onAction`/item handlers with the router, then close. No documented mobile behaviour (container `max-w-sm|lg|xl`, centred at `15vh`).
- Classes: `.command__backdrop(--transparent|opaque|blur)`, `__container`, `__dialog(--sm|md|lg)`, `__input-group(-prefix|-suffix|-clear-button)`, `__header`, `__list`, `__item`, `__group(-heading)`, `__separator`, `__footer`, `__empty`.
- States: `[data-entering]` (backdrop fade 150ms; container fade+zoom+slide 200ms), `[data-exiting]` 100ms, item `[data-hovered|focused|pressed|disabled]`, `[data-empty="true"]` on the input group. Focused item bg is `bg-default` (examples override via `data-[focused=true]:`). No CSS variables documented. `motion-reduce` respected.

### Gotchas

- Default filter is plain case-insensitive substring on `textValue` (the tagline says "fuzzy search", the API says "contains"). No `keywords` prop and no scoring/ranking.
- Set `textValue` on every item (filter target; RAC needs it for non-string children). Shortcut hints: `<Kbd className="ms-auto" slot="keyboard">` as last child.
- No `Loading` / `Empty` parts; empty state is the `renderEmptyState` prop.
- Enter/exit animation always runs (CSS, not a prop). `motion-reduce` disables it; otherwise override the `.command__backdrop`/`.command__container` animation to get an "instant" palette.

### Minimal example

```tsx
import { Command } from "@heroui-pro/react";

export function Palette(props: { isOpen: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Command>
      <Command.Backdrop isOpen={props.isOpen} onOpenChange={props.onOpenChange}>
        <Command.Container>
          <Command.Dialog>
            <Command.InputGroup>
              <Command.InputGroup.Input placeholder="Type a command or search…" />
              <Command.InputGroup.ClearButton />
            </Command.InputGroup>
            <Command.List
              renderEmptyState={() => <p className="p-4 text-sm">No results.</p>}
              onAction={(key) => console.log(key)}
            >
              <Command.Group heading="Go to…">
                <Command.Item id="home" textValue="Home">
                  Home
                </Command.Item>
                <Command.Item id="trash" textValue="Trash">
                  Trash
                </Command.Item>
              </Command.Group>
            </Command.List>
          </Command.Dialog>
        </Command.Container>
      </Command.Backdrop>
    </Command>
  );
}
```

### Fit for Rezumi

Replaces `packages/ui/src/components/command.tsx` (cmdk wrapper: `Command`, `CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup`, `CommandItem`, `CommandSeparator`, `CommandShortcut`) and the Dialog wrapping in `apps/web/src/features/command-palette/content.tsx`. Consumers: `content.tsx`, `pages/{base,navigation,resumes,ask}.tsx`, `pages/preferences/{index,theme,language}.tsx`. Also drops the `cmdk` dependency and `CommandLoading` import in `pages/resumes.tsx`.

| Current (cmdk + Base UI Dialog)                                  | HeroUI Pro                                                             |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `Dialog open/onOpenChange` + `DialogContent instant`             | `Command.Backdrop isOpen/onOpenChange` + `Container` + `Dialog`        |
| `CommandInput value/onValueChange` (zustand `search`)            | `Command.Dialog inputValue/onInputChange` + `InputGroup.Input`         |
| `CommandInput hint` (esc key)                                    | `InputGroup.Suffix` with `Kbd`                                         |
| `CommandItem value keywords onSelect disabled`                   | `Command.Item id textValue` + `List onAction(key)`; `isDisabled` (RAC) |
| `CommandEmpty`                                                   | `Command.List renderEmptyState`                                        |
| `CommandShortcut`                                                | `Kbd slot="keyboard"` with `ms-auto`                                   |
| `BaseCommandGroup` returns null off-page (page stack in zustand) | same conditional rendering works (Clean example)                       |
| Backspace-on-empty pops page (`useHotkeys`)                      | `Input onKeyDown` per Clean example                                    |

Features current code has that HeroUI Command lacks:

- `keywords` (nav items rely on them: "Documents"/"Resumes"/"Cover letters", "Trash"/"Deleted"...). Workaround: put keywords into `textValue` or a custom `filter`.
- cmdk ranking/scoring; HeroUI is boolean `filter`. Server-side filtered lists (`pages/resumes.tsx` filters itself) would need `filter={() => true}` **[verify]**.
- Controlled highlighted item (`value`/`onValueChange`) and `loop`; `content.tsx` re-selects the first enabled item on page change with a `querySelector` on `[cmdk-item]`. No equivalent documented (**[verify]** RAC Menu focus behaviour; the `data-command-page`/`cmdk-*` selectors disappear).
- `CommandLoading` row for async pages.
- `data-checked` check-mark row styling (theme/language pages) and the auto `↵` hint on the selected row (use `Command.Footer` hint instead).
- `instant` (no transition) dialog.
- Gain: built-in `Header` for breadcrumb chips, `Footer` for hints, `size`/`variant` props.

---

## 3. ContextMenu

Import: `import {ContextMenu} from "@heroui-pro/react"` (also `/context-menu`).
Purpose: right-click menu (long-press on touch) with sections, selection state and submenus. Items re-export HeroUI Dropdown parts.

### Anatomy

```
ContextMenu
  ContextMenu.Trigger            <div>, the right-click / long-press target
  ContextMenu.Popover            positioned at cursor
    ContextMenu.Menu             RAC Menu
      ContextMenu.Section        = Dropdown.Section
        ContextMenu.Item         = Dropdown.Item
          ContextMenu.ItemIndicator   = Dropdown.ItemIndicator (check; type="dot" for radio dot)
      ContextMenu.Separator      RAC Separator (HeroUI `Separator` also used inside Menu in examples)
      ContextMenu.SubmenuTrigger = Dropdown.SubmenuTrigger
        ContextMenu.Item + ContextMenu.SubmenuIndicator
        ContextMenu.Popover > ContextMenu.Menu   (nested)
```

### Props

| Part                                              | Props                                                                                                                                                                        |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ContextMenu`                                     | `open: boolean`, `defaultOpen: boolean` (`false`), `onOpenChange(open)`, `isDisabled: boolean` (`false`)                                                                     |
| `ContextMenu.Trigger`                             | `children`, `className`. Not focusable by default; `tabIndex={0}` enables Shift+F10 (Win/Linux) / Control+Enter (macOS). Non-selectable text: examples add `select-none`     |
| `ContextMenu.Popover`                             | `offset: number` (`2`), `placement: Placement` (`"bottom start"`), plus RAC `Popover` props except `isOpen`, `triggerRef`, `children`                                        |
| `ContextMenu.Menu`                                | `onClose: () => void` (overrides default close-on-select), plus RAC `Menu` props (`selectionMode`, `selectedKeys`, `onSelectionChange`, `onAction`...). Auto-focuses on open |
| `ContextMenu.Item`                                | all HeroUI `DropdownItem` props: `id`, `textValue`, `isDisabled`, `variant="danger"` (shown in the Sections example)                                                         |
| `ContextMenu.Section`                             | all HeroUI `DropdownSection` props (selection props can be set per section: `selectionMode`, `selectedKeys`, `onSelectionChange`)                                            |
| `ContextMenu.ItemIndicator`                       | `type="dot"` shown for radio-style; default is check                                                                                                                         |
| `ContextMenu.SubmenuTrigger` / `SubmenuIndicator` | Dropdown equivalents, opens on hover                                                                                                                                         |
| `ContextMenu.Separator`                           | all RAC `Separator` props                                                                                                                                                    |

### State and events

Controlled `open`/`onOpenChange` (no `isOpen` naming here, unlike Sheet). Menu closes automatically on item select. Selection: `selectionMode="single"|"multiple"` + `selectedKeys` (a `Set`) + `onSelectionChange` on `Menu` or on `Section`.

### Routing, mobile, CSS

- No routing: use item handlers with the router (**[verify]** `Dropdown.Item href` support; docs silent).
- Long-press opens the menu on touch (iOS fires no `contextmenu` event); built in. Trigger has `-webkit-touch-callout: none`.
- Classes: `.context-menu__trigger`, `__popover` (`bg-overlay`, `shadow-overlay`, grows from `transform-origin: var(--trigger-anchor-point)`), `__menu` (flex col `gap-0.5`), `__separator`. States `[data-entering]` 150ms, `[data-exiting]` 100ms, `[data-placement]` slide. No settable CSS variables.

### Gotchas

- Item `id` and `textValue` are expected on every item in all examples; icons are manual children (`<Label>` from `@heroui/react` for text).
- Trigger renders a `<div>` per docs. **[d.ts]** installed types make `ContextMenu.Trigger` polymorphic (`DOMRenderProps`, i.e. a `render` prop) but the docs do not mention it; needed for `<article>`/`<li>` triggers.
- A trigger wrapper with interactive children keeps them in tab order; the trigger itself stays out of it.
- Destructive style is `variant="danger"` (Base UI code uses `variant="destructive"`).

### Minimal example

```tsx
import { ContextMenu } from "@heroui-pro/react";
import { Label } from "@heroui/react";

export function RowMenu({ onRename, onDelete }: { onRename: () => void; onDelete: () => void }) {
  return (
    <ContextMenu>
      <ContextMenu.Trigger>
        <div className="select-none">Right-click me</div>
      </ContextMenu.Trigger>
      <ContextMenu.Popover>
        <ContextMenu.Menu onAction={(key) => (key === "rename" ? onRename() : onDelete())}>
          <ContextMenu.Item id="rename" textValue="Rename">
            <Label>Rename</Label>
          </ContextMenu.Item>
          <ContextMenu.Separator />
          <ContextMenu.Item id="delete" textValue="Delete" variant="danger">
            <Label>Delete</Label>
          </ContextMenu.Item>
        </ContextMenu.Menu>
      </ContextMenu.Popover>
    </ContextMenu>
  );
}
```

### Fit for Rezumi

Replaces `packages/ui/src/components/context-menu.tsx` (Base UI; exports `ContextMenu`, `ContextMenuTrigger`, `ContextMenuContent`, `ContextMenuItem`, `ContextMenuSeparator`; shares `menu-styles.tsx` with `dropdown-menu.tsx`). Consumers (grep `components/context-menu`):

- `features/documents/document-card.tsx` (2 usages, `ContextMenuTrigger render={<article .../>}`)
- `features/documents/document-actions.tsx` (one entry list rendered as either context or dropdown via `variant`: `Content/Item/Separator` swapped; `variant="destructive"`, `disabled`, `title`)
- `features/career/coach.tsx` (`RailItem`: `render={<li .../>}`, `finalFocus={false}`, items with `onClick`)

Mapping: `ContextMenuContent` (`align/side/alignOffset/sideOffset`) -> `Popover` + `Menu` with `placement`/`offset`; `Item onClick` -> `onAction`/item handler; `disabled` -> `isDisabled`; `variant="destructive"` -> `"danger"`; separator -> `ContextMenu.Separator`.

Gaps vs current code:

- `render={<article/>}` / `render={<li/>}` on the trigger: docs say `<div>` only (d.ts shows a `render` prop; confirm before relying on it).
- `finalFocus={false}` (Base UI, used to avoid focus return to the trigger) has no documented HeroUI equivalent; RAC restores focus to the trigger by default **[verify]**.
- `title` tooltip on disabled item (`document-actions.tsx`) is an HTML attr; unknown whether Item forwards it **[verify]**.
- `document-actions.tsx` shares one item list between context and dropdown menus; with HeroUI both sides must be `Dropdown.Item`-compatible (they are: `ContextMenu.Item` = `Dropdown.Item`), so one list can feed `Dropdown.Menu` and `ContextMenu.Menu` if the dropdown also migrates to `@heroui/react` Dropdown.
- Gain: long-press on touch is documented as built in.

---

## 4. Stepper

Import: `import {Stepper} from "@heroui-pro/react"` (also `/stepper`).
Purpose: step progress indicator (numbered, icon or bullet) in horizontal or vertical layout; optionally clickable.

### Anatomy

```
Stepper                    <ol>
  Stepper.Step             <li>, provides step context
    Stepper.Indicator      circle: number (inactive/active), animated check (complete); children override
      Stepper.Icon         <span>, icon inside the indicator
    Stepper.Content        <span> wrapper
      Stepper.Title
      Stepper.Description
    Stepper.Separator      connector line; hidden on the last step
```

### Props

| Part                                     | Props                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Stepper`                                | `orientation: "horizontal" \| "vertical"` (`"horizontal"`), `size: "sm" \| "md" \| "lg"` (`"md"`; indicator 22/28/36px), `currentStep: number` (controlled; fractional like `2.4` fills the separator partially), `defaultStep: number` (`0`), `onStepChange(step)` (makes steps interactive buttons when provided), native `ol` attrs |
| `Stepper.Step`                           | `children`, native `li` attrs                                                                                                                                                                                                                                                                                                          |
| `Stepper.Indicator`                      | `children` (override number/checkmark), `className`                                                                                                                                                                                                                                                                                    |
| `Stepper.Content/Title/Description/Icon` | `children`, native `span` attrs                                                                                                                                                                                                                                                                                                        |
| `Stepper.Separator`                      | `progress: number` (0-1, auto from `currentStep` when omitted), `force: boolean` (`false`; render on last step), native `div` attrs                                                                                                                                                                                                    |

Hook: `Stepper.useStep()` (docs examples) / `useStepperStep` (API reference name) returns `{index, status: "inactive" | "active" | "complete", isLast}`. Use inside any `Stepper.Step` descendant for status-aware custom indicators (e.g. complete shows a custom icon; `<Stepper.Indicator><></></Stepper.Indicator>` hides the number).

### State and events

`currentStep` controlled or `defaultStep` uncontrolled. Steps are display-only unless `onStepChange` is provided; then each step renders an interactive `.stepper__step-button` (`data-clickable`). It does not enforce ordering; gate navigation yourself.

### CSS variables

`--stepper-indicator-size`, `--stepper-separator-size` (2px), `--stepper-vertical-gap`, `--stepper-active-color` (accent), `--stepper-complete-color` (accent), `--stepper-complete-fg` (accent-foreground), `--stepper-inactive-border` (border), `--stepper-inactive-fg` (muted), `--stepper-separator-progress` (0-1). Set on the `Stepper` `style` prop to recolour. Data attrs: `[data-status="inactive|active|complete"]` on indicator/step, `[data-complete]` on `.stepper__separator-track`.

### Gotchas

- Every `Stepper.Step` needs its own `Indicator/Content/Separator` children; the component does not generate them from data.
- Last step still receives `<Stepper.Separator />` in examples; it hides itself.
- Step number shown is 1-based; `currentStep` is 0-based.

### Minimal example

```tsx
import { Stepper } from "@heroui-pro/react";

const steps = ["Upload", "Review", "Done"];

export function ImportSteps({ step, onStep }: { step: number; onStep?: (step: number) => void }) {
  return (
    <Stepper currentStep={step} onStepChange={onStep}>
      {steps.map((title) => (
        <Stepper.Step key={title}>
          <Stepper.Indicator />
          <Stepper.Content>
            <Stepper.Title>{title}</Stepper.Title>
          </Stepper.Content>
          <Stepper.Separator />
        </Stepper.Step>
      ))}
    </Stepper>
  );
}
```

### Fit for Rezumi

No stepper in `packages/ui/src/components` and no match in `apps/web/src` (`IssueStepper` in `features/resume/editor/check/page-layer.tsx` is a prev/next "Issue n of m" bar, not a progress stepper; `LandingHeader` scene buttons use `aria-current="step"` but are scroll navigation). Net-new: candidate only for multi-step flows (import, onboarding); no gap to report.

---

## 5. Sheet (Pro)

Import: `import {Sheet} from "@heroui-pro/react"` (also `/sheet`). Not the OSS `Drawer`/`Modal`.
Purpose: edge-anchored overlay (bottom sheet by default) with swipe-to-dismiss, snap points, detached mode, nesting; usable on all four edges.

### Anatomy

```
Sheet                            root provider (state, drag, snap points)
  Sheet.Trigger                  single pressable child; gets injected onPress
  Sheet.Backdrop                 ModalOverlay; variant
    Sheet.Content                Modal, the sliding panel (set width/max-w here)
      Sheet.Dialog               RAC Dialog; aria-labelledby wired to Sheet.Heading
        Sheet.Handle             drag grip (bottom/top); click cycles snap points or closes
        Sheet.CloseTrigger       "x" button, absolute top-right (CloseButton props)
        Sheet.Header > Sheet.Heading
        Sheet.Body               scrollable flex-grow
        Sheet.Footer             flex row, end-aligned
          Sheet.Close            single pressable child; closes on press
  Sheet.NestedRoot               a Sheet inside a Sheet; parent scales/displaces
```

### Props

`Sheet` (root):

| Prop                                                          | Type                                     | Default                                                    |
| ------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------- |
| `isOpen` / `defaultOpen` / `onOpenChange(open)`               | `boolean` / `boolean` / fn               | controlled / `false` / -                                   |
| `placement`                                                   | `"top" \| "bottom" \| "left" \| "right"` | `"bottom"` (set on ROOT, not Content)                      |
| `isDismissable`                                               | `boolean`                                | `true` (outside click and drag-to-close)                   |
| `isDetached`                                                  | `boolean`                                | `false` (0.5rem inset, `rounded-2xl` all sides)            |
| `isModal`                                                     | `boolean`                                | `true`                                                     |
| `isNested`                                                    | `boolean`                                | -                                                          |
| `isHandleOnly`                                                | `boolean`                                | `false` (drag only from `Sheet.Handle`)                    |
| `snapPoints`                                                  | `(number \| string)[]`                   | - (e.g. `["148px", "355px", 1]`; `1` = full)               |
| `activeSnapPoint` / `onActiveSnapPointChange`                 | `number \| string \| null` / fn          | controlled snap                                            |
| `fadeFromIndex`                                               | `number`                                 | last snap index (backdrop starts fading from this snap)    |
| `closeThreshold`                                              | `number`                                 | `0.25` (fraction of visible height that closes on release) |
| `shouldScaleBackground`                                       | `boolean`                                | `false`                                                    |
| `onDrag(event, percentageDragged)` / `onRelease(event, open)` | fn                                       | -                                                          |
| `onClose()` / `onAnimationEnd(open)`                          | fn                                       | -                                                          |
| `shouldAutoFocus`                                             | `boolean`                                | `false` (does NOT focus the first focusable by default)    |

`Sheet.Backdrop`: `variant: "opaque" | "blur" | "transparent"` (`"opaque"`) plus RAC `ModalOverlay` props except `isOpen`/`onOpenChange`. `Sheet.Content`: RAC `Modal` props except `isOpen`/`onOpenChange`. `Sheet.Dialog`: RAC `Dialog` props. `Sheet.Heading`: RAC `Heading` props. `Sheet.Handle`: `preventCycle: boolean` (`false`). `Sheet.CloseTrigger`: HeroUI `CloseButton` props. `Sheet.Trigger`/`Sheet.Close`: `children: ReactElement` (single pressable). `Sheet.NestedRoot`: same props as `Sheet`.

**[d.ts]** props present in installed types but not in the docs API table: `snapToSequentialPoint` (used by the "Snap Points Sequential" example; disables velocity-based skipping), `noBodyStyles`, `isFixed`, `setBackgroundColorOnScale`, `scrollLockTimeout`, `disablePreventScroll`, `repositionInputs`, `preventScrollRestoration`, `container: HTMLElement | null`. `fadeFromIndex` is typed as requiring `snapPoints`.

### State and events

Controlled `isOpen`/`onOpenChange` (works without a `Trigger`); snap controlled via `activeSnapPoint`. `onAnimationEnd(open)` fires after open/close animation. Drag callbacks for custom effects.

### Responsive / mobile (no routing)

The mobile pattern is the default: bottom sheet with `Sheet.Handle`, drag-to-dismiss, snap points, body scroll lock. Side placements (`left`/`right`) are intended for desktop panels; examples set width via className (`w-[400px]`) and omit the handle for left/right. Switch placement with a breakpoint hook on the root prop (`placement={phone ? "bottom" : "right"}`) **[verify]** behaviour when changed while open. Bottom max height `96vh`, left/right max width `96vw`. Reduced motion collapses animation durations.

### CSS variables and classes

`--sheet-backdrop-opacity` (JS-driven, snap mode), `--initial-transform` (100%; detached `calc(100% + 8px)`), `--snap-point-height` (px, JS). Classes: `.sheet__backdrop(--opaque|blur|transparent)`, `.sheet__content(--bottom|top|left|right)` (z-50), `.sheet__dialog(--*)`, `.sheet__header`, `.sheet__heading` (`text-lg font-semibold`), `.sheet__body`, `.sheet__footer`, `.sheet__handle`, `.sheet__handle-bar`, `.sheet__close-trigger`. Data attrs: `[data-sheet-drawer]` with `[data-entering]`/`[data-exiting]`, `.sheet-dragging`, `[data-sheet-snap-points="true"]`, `[data-sheet-detached]`. Keyframes `sheet-slideFrom*/To*`, `sheet-fadeIn/Out`.

### Gotchas

- `placement` is a root prop; there is no per-Content `side`.
- `Sheet.Trigger`/`Sheet.Close` take a child element and inject `onPress`; they are not `render`-prop components. The child must be a RAC/HeroUI pressable (e.g. `Button`).
- No `Description` part. `Dialog` labels itself from `Sheet.Heading`; an untitled sheet needs `aria-label` on `Sheet.Dialog` **[verify]**.
- `Sheet.CloseTrigger` is opt-in per sheet; there is no `showCloseButton` default.
- `Sheet.Footer` is a row, end-aligned (Rezumi's footer is a column).
- Footer/Body padding: Body scrolls; put long forms in `Sheet.Body`, buttons in `Footer`. Set `className="min-h-0 overflow-hidden p-0"` on Body when embedding a self-scrolling component (Emoji Picker Sheet example).
- Without `snapPoints`, `fadeFromIndex` is ignored/typed `never`.

### Minimal example

```tsx
import { Sheet } from "@heroui-pro/react";
import { Button } from "@heroui/react";

export function EditSheet({ isPhone }: { isPhone: boolean }) {
  return (
    <Sheet placement={isPhone ? "bottom" : "right"}>
      <Sheet.Trigger>
        <Button variant="secondary">Edit</Button>
      </Sheet.Trigger>
      <Sheet.Backdrop>
        <Sheet.Content className={isPhone ? "mx-auto max-w-[420px]" : "w-[480px]"}>
          <Sheet.Dialog>
            {isPhone && <Sheet.Handle />}
            <Sheet.CloseTrigger />
            <Sheet.Header>
              <Sheet.Heading>Edit application</Sheet.Heading>
            </Sheet.Header>
            <Sheet.Body>...</Sheet.Body>
            <Sheet.Footer>
              <Sheet.Close>
                <Button variant="secondary">Cancel</Button>
              </Sheet.Close>
              <Sheet.Close>
                <Button>Save</Button>
              </Sheet.Close>
            </Sheet.Footer>
          </Sheet.Dialog>
        </Sheet.Content>
      </Sheet.Backdrop>
    </Sheet>
  );
}
```

### Fit for Rezumi

Replaces `packages/ui/src/components/sheet.tsx` (Base UI `Drawer`; `Sheet`, `SheetTrigger`, `SheetClose`, `SheetContent side showCloseButton closeLabel`, `SheetHeader`, `SheetTitle`, `SheetDescription`, `SheetFooter`; has `sheet.test.tsx`). Do not confuse with `Dialog` (`dialog.tsx`, centred decisions) which maps to OSS `Modal`, or with the unrelated local `<Sheet />` components in `features/homepage/*` (the page mockups). Real consumers (grep `components/sheet`, 9 files):

- `features/career/coach.tsx` (left rail on mobile), `features/career/workspace/coach-sheet.tsx` (right, md max-w 420px), `features/career/schedule-sheet.tsx` (bottom on phone / right)
- `features/resume/stylesheet/editor.tsx` (right, full width), `features/resume/editor/chrome/download-sheet.tsx` (bottom on phone / right)
- `features/applications/components/{application-form,application-detail,import-applications,export-applications}-sheet.tsx` (right `sm:max-w-lg`/480px; detail is bottom `h-svh` on phone)

Mapping: `open` -> `isOpen`; `SheetContent side` -> `Sheet placement` (root); `SheetContent` + overlay + viewport -> `Sheet.Backdrop` > `Sheet.Content` > `Sheet.Dialog`; `SheetTitle` -> `Sheet.Heading`; `onOpenChangeComplete` (used in `application-detail-sheet.tsx`) -> `onAnimationEnd(open)`; bottom grabber `span` -> `Sheet.Handle`; `showCloseButton`/`closeLabel` -> `Sheet.CloseTrigger aria-label={...}`.

Gaps vs current code:

- `SheetDescription` has no counterpart.
- Current bottom sheet only swipes down; HeroUI adds drag-to-dismiss on all placements (`isDismissable={false}` or `isHandleOnly` to restrict).
- RTL: current code mirrors side sheets with `rtl:` variants; HeroUI placements are physical `left`/`right`, RTL behaviour undocumented **[verify]**. Rezumi ships RTL locales (`ar-SA`, `fa-IR`, `he-IL`), so check.
- `shouldAutoFocus` defaults to `false`; forms in sheets (`application-form-sheet.tsx`) rely on Base UI initial focus.
- Backdrop colour `--scrim-sheet` token and 320ms emphasized easing are custom; HeroUI uses `bg-backdrop` + its own keyframes (override `.sheet__backdrop`).
- `SheetTrigger render={...}` Base UI pattern becomes a child element; sheets opened from non-button elements need `Sheet isOpen` controlled instead.
- `sheet.test.tsx` must be rewritten (RAC Modal/Dialog DOM).
- Gains: snap points, detached, nested sheets, scale-background, `Sheet.Handle` snap cycling.

---

## 6. EmojiPicker

Import: `import {EmojiPicker, EMOJI_CATEGORIES, EMOJI_SKIN_TONES} from "@heroui-pro/react"` (also `/emoji-picker`).
Purpose: searchable, virtualized emoji grid in a popover (or inline) with skin-tone selection. Wraps RAC `Select`.

Data is NOT bundled: all examples import `emojibase-data/en/compact.json` (`emojibase-data` is not a dependency of this repo yet; add it to the catalog if used). The search box is the OSS `SearchField` placed inside `EmojiPicker.Content`, which supplies the internal `Autocomplete`.

### Anatomy

```
EmojiPicker                          RAC Select; value = emoji string
  EmojiPicker.Trigger                RAC Button
    EmojiPicker.Value                RAC SelectValue (shows current emoji)
  EmojiPicker.Popover                RAC Popover
    EmojiPicker.Content              <div> flex wrapper + internal Autocomplete (filter)
      SearchField (OSS)              search input (with SkinTonePicker inside its Group)
        EmojiPicker.SkinTonePicker   popover provider
          EmojiPicker.SkinToneTrigger
          EmojiPicker.SkinToneContent
            EmojiPicker.SkinToneOption
      EmojiPicker.Grid               virtualized RAC ListBox (GridLayout)
        EmojiPicker.Item             RAC ListBoxItem
      EmojiPicker.Footer             <div>, category jump buttons etc.
```

Inline (no popover): wrap `EmojiPicker.Content` in `<div className="emoji-picker__popover emoji-picker__popover--md relative">` inside `<EmojiPicker size="md">` (Inline example).

### Props

| Part                            | Props                                                                                                                                                                                                     |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EmojiPicker`                   | `size: "sm" \| "md" \| "lg"` (`"md"`; popover 240x280 / 280x350 / 320x420; item font 20/24/28px), plus all RAC `Select` props. Docs show `aria-label`, `defaultValue="😀"`                                |
| `EmojiPicker.Trigger` / `Value` | RAC `Button` / `SelectValue` props                                                                                                                                                                        |
| `EmojiPicker.Popover`           | `offset` (`4`), `placement` (`"bottom"`), RAC `Popover` props                                                                                                                                             |
| `EmojiPicker.Content`           | `filter(textValue, inputValue) => boolean` (default case-insensitive contains)                                                                                                                            |
| `EmojiPicker.Grid`              | `layoutOptions {minItemSize, maxItemSize, minSpace, preserveAspectRatio}` (default 36x36 cells, 2x2 spacing), `renderEmptyState`, `items`, `ref`, children render fn, RAC `ListBox` props except `layout` |
| `EmojiPicker.Item`              | RAC `ListBoxItem` props; examples: `id={String(item.unicode)}` (this is the select value), `textValue={label + tags}` (search target)                                                                     |
| `EmojiPicker.Footer`            | `<div>`                                                                                                                                                                                                   |
| `EmojiPicker.SkinTonePicker`    | `value` / `defaultValue` (`"default"`) / `onChange(value)`                                                                                                                                                |
| `EmojiPicker.SkinToneTrigger`   | `tones: EmojiSkinToneItem[]` (`EMOJI_SKIN_TONES`), `aria-label` (`"Select skin tone"`)                                                                                                                    |
| `EmojiPicker.SkinToneContent`   | `offset` (`4`), `placement` (`"bottom end"`)                                                                                                                                                              |
| `EmojiPicker.SkinToneOption`    | `id: string` required (`"default"`, `"light"`, `"dark"`...)                                                                                                                                               |

Constants: `EMOJI_SKIN_TONES` items `{id, emoji, label}`; `EMOJI_CATEGORIES` items `{id, emoji, label}`. **[d.ts]** `EMOJI_CATEGORIES` ids: `frequently-used`, `smileys-emotion`, `people-body`, `animals-nature`, `food-drink`, `activities`, `travel-places`, `objects`, `symbols`, `flags`.

### State and events

Selected emoji is the `Select` value (uncontrolled `defaultValue`; controlled via RAC `Select` `value`/`onChange` **[verify]**). Skin tone is a separate `SkinTonePicker` state; applying it means you rewrite each item's `unicode` from `emoji.skins[index]` yourself (examples do this in a `useMemo`). Category jump buttons are hand-built (`gridRef.scrollTo`, assuming 38px cells), not part of the API.

### Routing, mobile, CSS

No routing. Sizes fixed per `size`; popover flips per RAC `Popover`. For mobile, the Emoji Picker Sheet example embeds it in a bottom `Sheet` with `Sheet.Body className="min-h-0 overflow-hidden p-0"`.
Classes: `.emoji-picker__popover(--sm|md|lg)`, `__trigger`, `__value`, `__content`, `__grid`, `__item(--sm|md|lg)`, `__footer` (absolute bottom), `__empty`, `__skin-tone-picker`, `__skin-tone-options`, `__skin-tone-option`. States `[data-hovered|focused|pressed|selected]`. No CSS variables documented.

### Gotchas

- Tagline says "recent emoji tracking", but no prop, part or storage API for recents is documented; `frequently-used` exists as a category id only. The doc examples' category-jump map has no entry for it.
- Emoji label/search text is English from `emojibase-data/en`; Rezumi ships 55 Lingui catalogs (`apps/web/locales/*.po`), so search quality in other languages needs the matching `emojibase-data/<locale>` set.
- Large lists require the `Grid` virtualizer; do not render `Item`s outside `Grid`.

### Minimal example

```tsx
import { EmojiPicker } from "@heroui-pro/react";
import { SearchField } from "@heroui/react";
import emojis from "emojibase-data/en/compact.json";

export function EmojiField({ onPick }: { onPick: (emoji: string) => void }) {
  return (
    <EmojiPicker aria-label="Emoji" defaultValue="😀" onChange={(key) => onPick(String(key))}>
      <EmojiPicker.Trigger className="text-xl">
        <EmojiPicker.Value />
      </EmojiPicker.Trigger>
      <EmojiPicker.Popover>
        <EmojiPicker.Content>
          <SearchField aria-label="Search emoji" variant="secondary">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Search emoji…" />
            </SearchField.Group>
          </SearchField>
          <EmojiPicker.Grid items={emojis}>
            {(e) => (
              <EmojiPicker.Item id={e.unicode} textValue={`${e.label} ${(e.tags ?? []).join(" ")}`}>
                {e.unicode}
              </EmojiPicker.Item>
            )}
          </EmojiPicker.Grid>
        </EmojiPicker.Content>
      </EmojiPicker.Popover>
    </EmojiPicker>
  );
}
```

### Fit for Rezumi

No emoji UI exists (`grep -i emoji` over `apps/web/src` returns nothing) and `emojibase-data` is not installed. Net-new only (e.g. document icon or template accent). Cost: a data dependency per locale plus manual skin-tone and category plumbing. No existing code to replace.

---

## 7. Resizable

Import (subpath ONLY): `import {Resizable} from "@heroui-pro/react/resizable"`. Do not import from the root.
Purpose: resizable panel groups with composable drag handles, built on `react-resizable-panels` with HeroUI tokens. The peer is part of the required peer set (`AppLayout` also uses it); repo already has `react-resizable-panels ^4.15.1` in the catalog and `apps/web/package.json`.

### Anatomy

```
Resizable                     group; orientation; nests (nested groups need `id`)
  Resizable.Panel             sized pane (number = %, string = CSS unit)
  Resizable.Handle            drag separator; type/variant/withIndicator
    Resizable.Indicator       inner pill / drag dots (auto when withIndicator, or compose manually)
  Resizable.Panel
```

### Props

`Resizable` (group):

| Prop          | Type                                     | Default                                             |
| ------------- | ---------------------------------------- | --------------------------------------------------- |
| `orientation` | `"horizontal" \| "vertical"`             | `"horizontal"`                                      |
| `autoSaveId`  | `string`                                 | - (persist sizes to `localStorage`)                 |
| `storage`     | `PanelGroupStorage` (docs)               | `localStorage`; use `createCookieStorage()` for SSR |
| `onLayout`    | `(sizes: number[]) => void` (docs)       | - (every layout change, including drag)             |
| `id`          | `string`                                 | - (required for nested groups)                      |
| `handleRef`   | `Ref<ImperativePanelGroupHandle>` (docs) | - (`setLayout`, `getLayout`)                        |

`Resizable.Panel`:

| Prop                                  | Type                                                | Default                                                               |
| ------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------- |
| `defaultSize` / `minSize` / `maxSize` | `number \| string`                                  | numbers are %, strings take CSS units (`"220px"`, `"18rem"`, `"30%"`) |
| `collapsible`                         | `boolean`                                           | `false`                                                               |
| `collapsedSize`                       | `number \| string`                                  | -                                                                     |
| `groupResizeBehavior`                 | `"preserve-relative-size" \| "preserve-pixel-size"` | `"preserve-relative-size"`                                            |
| `id`                                  | `string`                                            | - (required with `autoSaveId` + `collapsible`)                        |
| `order`                               | `number`                                            | - (docs; conditional panels)                                          |
| `handleRef`                           | `PanelImperativeHandle` ref                         | `collapse()`, `expand()`, ...                                         |
| `onCollapse` / `onExpand`             | `() => void`                                        | -                                                                     |
| `onResize`                            | `(panelSize, id?, prevPanelSize?) => void`          | -                                                                     |

`Resizable.Handle`: `type: "line" | "drag" | "pill" | "handle"` (`"line"`; `handle` = standalone grip, no separator line), `variant: "primary" | "secondary" | "tertiary"` (`"primary"`; maps to `separator`, `separator-secondary`, `separator-tertiary` tokens: match the surface the handle sits on), `withIndicator: boolean`, `disabled: boolean` (`false`), `onDragging(isDragging)` (docs).
`Resizable.Indicator`: `type: "pill" | "drag"` (`"pill"`), `children` (overrides default affordance).

**[d.ts] differs from the docs table (use d.ts, `react-resizable-panels` v4):** group `onLayoutChange(layout: Layout)` (not `onLayout`), `storage: LayoutStorage`, `handleRef: Ref<GroupImperativeHandle>`; group also extends `div` props (`className`, `style`); Panel has no `order`; Handle has no `onDragging` but has `aria-label`, `id`, `children`, `className`; `withIndicator` is auto-enabled when `type` is `"drag"` or `"pill"`. The docs' own Collapsible example already uses the v4 `PanelImperativeHandle` type.

### State and events

- Persist: `autoSaveId` (plus `storage`). Cookie variant: `import {createCookieStorage} from "@heroui-pro/react"` (root export), `storage={createCookieStorage()}`; reads fall back to `localStorage`, writes go to both; cookie name `react-resizable-panels:<autoSaveId>`. Only needed for SSR; Rezumi is a client SPA so `localStorage` default suffices.
- Collapse: `collapsible` + `collapsedSize={0}` + `id` + `handleRef` and `panelRef.current?.collapse()/expand()` with `onCollapse`/`onExpand` to mirror state (Collapsible example).
- Groups can nest with differing orientations (editor-style three-pane layouts).

### Routing, mobile, CSS variables (on `.resizable`)

No routing; no touch-specific behaviour documented (pointer drag, 8px hit area).
`--resizable-handle-size` (1px), `--resizable-handle-hit-area` (8px), `--resizable-handle-color` (`var(--color-separator)`), `--resizable-handle-color-hover` (`var(--color-separator-secondary)`), `--resizable-handle-color-active` (`var(--color-accent-soft)`), `--resizable-indicator-pill-width` (6px), `--resizable-indicator-pill-height` (32px), `--resizable-indicator-drag-size` (12px).

### Gotchas

- Parent must give the group a definite size (examples wrap in `h-[400px] w-full overflow-hidden`); a panel with `preserve-pixel-size` needs at least one sibling that preserves relative size to absorb remaining space.
- Numeric sizes are percentages everywhere (including `minSize`), unlike pixels in many layout libs.
- `id` is mandatory on collapsible panels when persistence is on.
- The docs API table and the installed types disagree (see above); type-check against the installed `.d.ts`.

### Minimal example

```tsx
import { Resizable } from "@heroui-pro/react/resizable";

export function Split({ side, main }: { side: React.ReactNode; main: React.ReactNode }) {
  return (
    <div className="h-dvh">
      <Resizable autoSaveId="builder:panels" orientation="horizontal">
        <Resizable.Panel defaultSize="360px" groupResizeBehavior="preserve-pixel-size" maxSize="520px" minSize="280px">
          {side}
        </Resizable.Panel>
        <Resizable.Handle variant="secondary" />
        <Resizable.Panel minSize={30}>{main}</Resizable.Panel>
      </Resizable>
    </div>
  );
}
```

### Fit for Rezumi

Nothing to replace: `react-resizable-panels` is declared in `apps/web/package.json` (catalog `^4.15.1`) and whitelisted in `knip.json` `ignoreDependencies`, but no source file under `apps/` or `packages/` imports it. The builder (`routes/builder/$resumeId/-components/editor-shell.tsx`, `features/resume/editor/chrome.tsx`) uses fixed CSS grid columns, and the assistant column (`features/assistant/dock.tsx`) is a motion-animated 399px column with an open/close store flag. No draggable splitter exists. Resizable is net-new: possible for panel | page canvas | assistant widths on desktop. Considerations: the assistant dock's animated open/close would map to a collapsible panel (`handleRef.collapse()/expand()`); mobile and tablet layouts (tab bars, pinned panel) stay as they are; widths currently in `px` need `groupResizeBehavior="preserve-pixel-size"` plus one relative panel.

---

## Open verification items before migrating

1. `ContextMenu.Trigger render` works at runtime (types say yes, docs silent).
2. Whether `Command.List` gives first-item highlight on open/page change, and how to disable filtering for server-filtered pages (`filter={() => true}`).
3. TanStack Router wiring of RAC `RouterProvider` (typed `to`, `useHref`) for Navbar/Command/Menu `href` items, mounted inside the router.
4. Sheet RTL placement and `placement` change while open; `shouldAutoFocus` for form sheets.
5. Navbar and Sheet under `renderToString` (`features/homepage/prerender.tsx`).
