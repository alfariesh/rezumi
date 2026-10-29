# HeroUI Pro v3 (`@heroui-pro/react`) API reference, Data Display

Source: `heroui-pro` MCP (`get_component_docs`, `get_css`, `get_docs` installation page), read in full for each component. Cross-checked against the installed package `@heroui-pro/react@1.0.0-beta.10` (`apps/web/node_modules/@heroui-pro/react/dist`): prop lists of DataGrid, ListView, ActionBar, KPI, Timeline, EmptyState match the docs. Only documented props and parts are listed; anything inferred is marked "(inferred)". Purpose: guide migrating Rezumi web (`apps/web`, React 19 + Tailwind v4, currently shadcn/Base UI in `packages/ui/src/components`) to the HeroUI default style. Kanban and Agenda are covered in other notes. Companion: `oss-a-l.md` (OSS A to L).

Scope: action-bar, data-grid, empty-state, list-view, item-card, item-card-group, kpi, kpi-group, timeline, widget, hover-card, file-tree, floating-toc, carousel, holo-card, map. KPI also needs `number-value` and `trend-chip`, documented under KPI.

## Global conventions

- Pro CSS is already wired: `packages/ui/src/styles/globals.css` imports `@heroui/styles` then `@heroui-pro/react/css` (order matters). No `@heroui*` import exists in `apps/web/src` yet.
- Import root vs subpath. Root barrel `@heroui-pro/react` exports everything in this note EXCEPT three, which are subpath-only because of optional peers: `KPI` (`@heroui-pro/react/kpi`, peer `recharts >=2.0.0`), `Carousel` (`@heroui-pro/react/carousel`, peers `embla-carousel`, `embla-carousel-react` `>=8.6.0`), `Map` (`@heroui-pro/react/map`, peer `maplibre-gl >=6.0.0`). In beta.10 every component here also has its own subpath (`@heroui-pro/react/data-grid`, `/timeline`, ...), so subpaths are a safe default for tree-shaking. None of `recharts`, `embla-carousel*`, `maplibre-gl` is in Rezumi's dependencies today.
- Co-parts live in other places: `NumberValue`, `TrendChip`, `KPIGroup`, `ChartTooltip`, `PressableFeedback`, `EmptyState` are root exports. `Button`, `Chip`, `Separator`, `Tooltip`, `Card`, `Switch`, `Table`, `Pagination`, `SearchField`, `Dropdown` come from `@heroui/react` (OSS).
- Pro packages assume React 19, Tailwind v4, `motion >=12.12` (ActionBar uses `motion/react`; Rezumi has `motion ^14`), `react-aria-components >=1.21.1`, `tailwind-variants`.
- Same v3 rules as OSS: compound dot notation, `onPress` not `onClick` on HeroUI Buttons, `isDisabled`/`isSelected`/`isOpen` naming, `render` prop replaces `asChild`.
- Selection type: `Selection = "all" | Set<Key>` (from `react-aria-components/GridList` or `@heroui/react`). Every selection-count calculation must handle `"all"`.
- Locale: NumberValue/KPI and RAC strings (sort/select labels, HoverCard) use the nearest `react-aria-components` `I18nProvider`, falling back to the browser locale. Rezumi has no RAC `I18nProvider` (only Lingui's in `features/homepage/prerender.tsx`), so wrap the app root with `<I18nProvider locale={i18n.locale}>` or pass `locale` per NumberValue.
- Strings in docs are English literals. Rezumi must pass Lingui `t`/`Trans` output (ActionBar `aria-label` defaults to `"Actions"`).
- Icons: docs use `@gravity-ui/icons` (not installed). Any SVG child works; Rezumi uses `@phosphor-icons/react`, used in the examples below.
- Mobile parity (CLAUDE.md): these are web-only React components. `apps/mobile` needs its own native equivalent for any user-facing behavior that changes (`heroui-native-pro` is in the catalog; not evaluated here).

## Index

| Component                | Import                        | Peers       | Rezumi verdict                                                       |
| ------------------------ | ----------------------------- | ----------- | -------------------------------------------------------------------- |
| DataGrid                 | root                          | none        | Documents list, Trash list, desktop Applications list (with caveats) |
| ListView                 | root                          | none        | Phone Applications rows; simple lists                                |
| EmptyState               | root                          | none        | Replaces ~8 hand-rolled empty states                                 |
| ActionBar                | root                          | motion      | Replaces `SelectionBar` (documents) and `BulkBar` (applications)     |
| ItemCard / ItemCardGroup | root                          | none        | Career Today Schedules, Needs you list (with text-clamp caveat)      |
| KPI / KPIGroup           | `/kpi` (KPI), root (KPIGroup) | recharts    | Insights "heard back" and "median reply" figures                     |
| Timeline                 | root                          | none        | Application detail Activity                                          |
| Widget                   | root                          | none        | Insights sections shell                                              |
| HoverCard                | root                          | none        | New: resume/application quick preview                                |
| FileTree                 | root                          | none        | No current fit                                                       |
| FloatingToc              | root                          | none        | No current fit (no scroll-spy in docs)                               |
| Carousel                 | `/carousel`                   | embla       | Template strip in design panel (optional)                            |
| HoloCard                 | root                          | none        | No fit                                                               |
| Map                      | `/map`                        | maplibre-gl | No fit                                                               |

---

# 1. DataGrid (deepest)

Import: `import {DataGrid} from "@heroui-pro/react"` (also types `DataGridColumn`, `DataGridReorderEvent`, `DataGridSelection`, `DataGridSortDescriptor`, `DataGridSortDirection`, `DataGridColumnSize`). Purpose: full table (sorting, selection, resize, pinned columns, row drag reorder, tree rows, virtualization, infinite load) built on the OSS `Table`.

Anatomy: NOT compound. One element, `<DataGrid />`, configured by `data` + `columns`. No `DataGrid.*` parts.

## DataGrid props

| Prop                                       | Type                                                                                                     | Default                                                                                |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `data`                                     | `T[]`                                                                                                    | required                                                                               |
| `columns`                                  | `DataGridColumn<T>[]`                                                                                    | required                                                                               |
| `getRowId`                                 | `(item: T) => string \| number`                                                                          | required                                                                               |
| `aria-label`                               | `string`                                                                                                 | required                                                                               |
| `variant`                                  | `"primary" \| "secondary"`                                                                               | `"primary"` (primary = inset background, footer sits on it; secondary = no background) |
| `className`                                | root wrapper                                                                                             |                                                                                        |
| `contentClassName`                         | the inner `<table>` (e.g. `min-w-[1200px]` for horizontal scroll, or a fixed height for virtualization)  |                                                                                        |
| `scrollContainerClassName`                 | scroll container (e.g. `max-h-[400px] overflow-y-auto`)                                                  |                                                                                        |
| `verticalAlign`                            | `"top" \| "middle" \| "bottom"`                                                                          | `"middle"`                                                                             |
| `selectionMode`                            | `"none" \| "single" \| "multiple"`                                                                       | `"none"`                                                                               |
| `selectedKeys` / `defaultSelectedKeys`     | `Selection`                                                                                              |                                                                                        |
| `onSelectionChange`                        | `(keys: Selection) => void`                                                                              |                                                                                        |
| `selectionBehavior`                        | `"toggle" \| "replace"`                                                                                  | `"toggle"`                                                                             |
| `showSelectionCheckboxes`                  | `boolean`, auto-prepends a checkbox column (header has select-all)                                       | `false`                                                                                |
| `sortDescriptor` / `defaultSortDescriptor` | `SortDescriptor` (`{column, direction: "ascending" \| "descending"}`)                                    |                                                                                        |
| `onSortChange`                             | `(descriptor) => void`, fires in controlled and uncontrolled mode                                        |                                                                                        |
| `allowsColumnResize`                       | `boolean`                                                                                                | `false`                                                                                |
| `onColumnResize` / `onColumnResizeEnd`     | `(widths: Map<string \| number, ColumnSize>) => void`                                                    |                                                                                        |
| `onReorder`                                | `(e: DataGridReorderEvent<T>) => void`; enables built-in drag handles                                    |                                                                                        |
| `dragAndDropHooks`                         | RAC `DragAndDropHooks` (cross-list, custom items); overrides `onReorder`                                 |                                                                                        |
| `onRowAction`                              | `(key: string \| number) => void` ("double-click or Enter")                                              |                                                                                        |
| `renderEmptyState`                         | `() => ReactNode` (string allowed)                                                                       |                                                                                        |
| `footer` / `footerClassName`               | node rendered in `Table.Footer`, full width outside the horizontal scroll; footer is `flex items-center` |                                                                                        |
| `onLoadMore`                               | `() => void`, fires when the sentinel row scrolls into view                                              |                                                                                        |
| `isLoadingMore`                            | `boolean`                                                                                                | `false`                                                                                |
| `loadMoreContent`                          | node inside the sentinel row (e.g. `<Spinner/>`)                                                         |                                                                                        |
| `disabledKeys`                             | `Iterable<string \| number>`                                                                             |                                                                                        |
| `virtualized`                              | `boolean`; needs `rowHeight` and `headingHeight`                                                         | `false`                                                                                |
| `rowHeight`                                | `number` px                                                                                              | `42`                                                                                   |
| `headingHeight`                            | `number` px                                                                                              | `36`                                                                                   |
| `getChildren`                              | `(item: T) => T[] \| undefined`; presence enables tree rows                                              |                                                                                        |
| `treeColumn`                               | column id showing the chevron                                                                            | first `isRowHeader` column, else first column                                          |
| `expandedKeys` / `defaultExpandedKeys`     | `Iterable<Key>`                                                                                          |                                                                                        |
| `onExpandedChange`                         | `(keys: Set<Key>) => void`                                                                               |                                                                                        |
| `treeIndent`                               | px per level on the tree cell (`0` disables)                                                             | `20`                                                                                   |

## DataGridColumn<T> (object in `columns`)

| Property                            | Type                                                          | Default   |
| ----------------------------------- | ------------------------------------------------------------- | --------- |
| `id`                                | `string`, required; sort key and RAC column id                |           |
| `header`                            | `ReactNode \| ({sortDirection}) => ReactNode`                 |           |
| `accessorKey`                       | `keyof T & string`; default cell value and default sort       |           |
| `cell`                              | `(item: T, column) => ReactNode`                              |           |
| `isRowHeader`                       | `boolean` (a11y; mark one column)                             | `false`   |
| `allowsSorting`                     | `boolean`                                                     | `false`   |
| `sortFn`                            | `(a: T, b: T) => number`; else locale-aware STRING comparison |           |
| `allowsResizing`                    | `boolean`; only effective when root `allowsColumnResize`      |           |
| `width`                             | `ColumnSize` (px, %, fr)                                      |           |
| `minWidth` / `maxWidth`             | `number`                                                      |           |
| `align`                             | `"start" \| "center" \| "end"`                                | `"start"` |
| `headerClassName` / `cellClassName` | appended to every `<th>` / `<td>` of the column               |           |
| `pinned`                            | `"start" \| "end"`; needs numeric `width` or `minWidth`       |           |

`DataGridReorderEvent<T>`: `keys: Set<string|number>`, `target: {key, dropPosition: "before"|"after"}`, `reorderedData: T[]` (apply with `setData(e.reorderedData)`).

## State / behavior

- Sorting: uncontrolled sorts `data` client-side. Pass `sortDescriptor` + `onSortChange` for server or URL-driven sort (data then arrives pre-sorted; DataGrid does not sort in controlled mode per docs).
- Selection: toggle checkboxes via `showSelectionCheckboxes`; `selectedKeys` keys are the `getRowId` values.
- Tree rows: `getChildren` + `treeColumn`; composes with selection, drag, sorting, pinned, resize. Chevron toggle auto-generated; leaf rows get an invisible spacer.
- Infinite scroll: sentinel row calls `onLoadMore`; pass `onLoadMore={hasMore ? fn : undefined}` to stop it. Needs a bounded scroll area via `scrollContainerClassName`.
- Drag: handles + keyboard (Enter grab, arrows move, Enter drop).

## Gotchas

- Not documented, so absent: row `className`/`href`/`onClick`, row context menu, row grouping/sections (only tree via `getChildren`), responsive column hiding, stacked/card mobile layout, built-in pagination, column-visibility toggle, search, skeleton/loading state (other than load-more row). The docs compose pagination (`footer` + OSS `Pagination`), search, filters and column toggles OUTSIDE the grid.
- `onRowAction` is described as double-click or Enter. Single-click-to-open with checkbox-only selection is not documented. Prototype before promising it (inferred: RAC Table semantics).
- Default sort is string comparison; give `sortFn` for dates, numbers, priorities.
- Resizing needs three things: root `allowsColumnResize`, column `allowsResizing`, and `minWidth`.
- Virtualization needs fixed `rowHeight` (cells cannot grow) and a bounded height set on `contentClassName` (docs: `h-[600px] min-w-[900px] overflow-auto`); infinite load uses `scrollContainerClassName` instead. Do not mix them up.
- `onReorder` and `dragAndDropHooks` are mutually exclusive; `dragAndDropHooks` wins.
- Interactive cells (inputs, switches, dropdowns) work via `cell`, but typing inside RAC grid cells can trigger grid typeahead/arrow handling (inferred; test inline rename).
- `aria-label` is required. Headers/labels are strings; wrap with Lingui.

Example (documents list):

```tsx
import type { DataGridColumn } from "@heroui-pro/react";
import { DataGrid } from "@heroui-pro/react";

const columns: DataGridColumn<DocumentSummary>[] = [
  { id: "name", header: t`Name`, accessorKey: "name", isRowHeader: true, allowsSorting: true, minWidth: 240 },
  { id: "type", header: t`Type`, accessorKey: "type", width: 96 },
  {
    id: "edited",
    header: t`Edited`,
    allowsSorting: true,
    sortFn: (a, b) => +new Date(a.updatedAt) - +new Date(b.updatedAt),
    cell: (d) => formatRelativeTime(d.updatedAt, locale),
  },
  { id: "menu", header: "", width: 48, align: "end", cell: (d) => <DocumentMenu document={d} /> },
];

<DataGrid
  aria-label={t`Documents`}
  variant="secondary"
  columns={columns}
  data={shown}
  getRowId={(d) => `${d.type}:${d.id}`}
  selectionMode="multiple"
  showSelectionCheckboxes
  selectedKeys={selected}
  onSelectionChange={setSelected}
  defaultSortDescriptor={{ column: "edited", direction: "descending" }}
  renderEmptyState={() => <NothingMatches />}
/>;
```

## Fit for Rezumi

- `apps/web/src/features/documents/documents-page.tsx` list view (hand-built `<table>` + `DocumentRow` in `document-card.tsx`; same markup reused by `trash-page.tsx`). Maps cleanly: checkbox column = `showSelectionCheckboxes` (header select-all replaces the manual `Checkbox` with `indeterminate`), Name/Type/Application/Edited/Options = columns, `getRowId` = existing `documentKey` (`type:id`), `renderEmptyState` replaces the "Nothing matches" block, `variant="secondary"` matches today's borderless look.
- Current code has, DataGrid lacks: per-row right-click `ContextMenu` (wraps the `<tr>`), per-row staggered intro animation, per-row `opacity-70` for trashed rows and `bg-accent-soft` selected row styling (selection styling is built in, custom row classes are not), inline rename input in the Name cell, "New" badge logic (doable in `cell`), phone layout (Type and Application columns hidden `max-sm:hidden`: filter `columns` with `useBreakpoint`, there is no responsive prop), sort UI separate from the grid (page header `NativeSelect` + URL `sort`; map to controlled `sortDescriptor` or keep the select and pre-sort).
- `apps/web/src/features/applications/components/list-view.tsx` (`ApplicationList`): grouped by stage with collapsible groups, one shared sort, row checkbox, selected-row highlight for the open detail sheet, two-line phone rows. DataGrid has no group/section rows. Closest model is the tree (`getChildren`, parent row = stage group, `defaultExpandedKeys`), but then group rows are real rows with a checkbox and cells per column (no `colSpan` header), group keys leak into `selectedKeys`, and whether sorting applies within each level is not documented. Treat as a poor fit unless groups are dropped; consider a flat grid sorted by stage plus a Stage column.
- Opening a row: today row click opens the detail sheet and the checkbox cell stops propagation. DataGrid `onRowAction` (double-click/Enter per docs) is a behavior change.

---

# 2. ListView (deepest)

Import: `import {ListView} from "@heroui-pro/react"`. Purpose: single-column interactive list on RAC `GridList` with keyboard navigation, typeahead, selection, item actions. Per installed d.ts it extends RAC `GridListProps` minus `layout`/`orientation`, so unlisted GridList props (for example `dragAndDropHooks`) pass through (inferred; the Pro docs never show them, though the CSS has a dragging state).

Anatomy:

```
ListView
  ListView.Item
    ListView.ItemContent      (icon/avatar + text block)
      ListView.Title
      ListView.Description
    ListView.ItemAction       (trailing slot)
```

## Props

| Part                                        | Prop                                   | Type                                      | Default                                                                                                                        |
| ------------------------------------------- | -------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| ListView                                    | `aria-label`                           | `string`, required                        |                                                                                                                                |
|                                             | `variant`                              | `"primary" \| "secondary"`                | `"primary"` (gray wrapper, white surface rows forming cards) / secondary (transparent rows, bottom borders, accent checkboxes) |
|                                             | `selectionMode`                        | `"none" \| "single" \| "multiple"`        | `"none"`                                                                                                                       |
|                                             | `selectedKeys` / `defaultSelectedKeys` | `Selection`                               |                                                                                                                                |
|                                             | `onSelectionChange`                    | `(keys) => void`                          |                                                                                                                                |
|                                             | `selectionBehavior`                    | `"toggle" \| "replace"`                   | `"toggle"`                                                                                                                     |
|                                             | `items`                                | `Iterable<T>`                             |                                                                                                                                |
|                                             | `disabledKeys`                         | `Iterable<Key>`                           |                                                                                                                                |
|                                             | `onAction`                             | `(key: Key) => void`                      |                                                                                                                                |
|                                             | `renderEmptyState`                     | `() => ReactNode`                         |                                                                                                                                |
|                                             | `virtualized`                          | `boolean`                                 | `false`                                                                                                                        |
|                                             | `rowHeight`                            | `number`, estimated px for virtualization | `48`                                                                                                                           |
|                                             | `children`                             | `ReactNode \| (item: T) => ReactNode`     |                                                                                                                                |
| Item                                        | `id`                                   | `Key`                                     |                                                                                                                                |
|                                             | `textValue`                            | `string` (typeahead, a11y)                |                                                                                                                                |
|                                             | `isDisabled`, `href`                   | `boolean`, `string`                       |                                                                                                                                |
| ItemContent, Title, Description, ItemAction | `className`, `children`                |                                           |                                                                                                                                |

## State / behavior

Checkboxes are rendered automatically when `selectionMode` is not `none`. Dynamic collections: `items` + render-function child with `id` per item. `href` on an item navigates when actioned. Hover/selected/focus styles via `.list-view__item` states. No sort, no columns, no groups/sections documented.

## Gotchas

- Always give `textValue` when item content is not plain text.
- Selection checkboxes cannot be hidden per breakpoint (no prop). Rezumi hides row checkboxes on phones today.
- No section headers or collapsible groups in the docs.
- Disabled items: `disabledKeys` or `isDisabled`.

Example:

```tsx
<ListView
  aria-label={t`Applications`}
  items={apps}
  variant="secondary"
  selectionMode="none"
  onAction={(key) => open(String(key))}
>
  {(a) => (
    <ListView.Item id={a.id} textValue={`${a.role} ${a.company}`}>
      <ListView.ItemContent>
        <span className="grid size-8 place-items-center rounded-lg bg-default">{a.company[0]}</span>
        <div className="flex min-w-0 flex-col">
          <ListView.Title>{a.role}</ListView.Title>
          <ListView.Description>
            {a.company} · {a.nextStep}
          </ListView.Description>
        </div>
      </ListView.ItemContent>
      <ListView.ItemAction>
        <CaretRight />
      </ListView.ItemAction>
    </ListView.Item>
  )}
</ListView>
```

## Fit for Rezumi

- Phone branch of `ApplicationRow` in `applications/components/list-view.tsx` (two-line row: initial tile, role, "company · next step", trailing caret) is a near 1:1 ListView item. `ListView` selection mode `none` + `onAction` replaces the `<tr onClick>`.
- ListView cannot do the desktop columns, group headers, per-column sort, or group collapse. Do not use it for the grouped desktop list.
- Lists of simple rows elsewhere (assistant past conversations, saved items) could use it; not checked in detail.

---

# 3. EmptyState (deepest)

Import: `import {EmptyState} from "@heroui-pro/react"`. Purpose: centered icon/title/description/actions block.

Anatomy (docs Anatomy block puts `Media` directly under root; every example puts `Media` inside `Header`; both render, since styling is class-based):

```
EmptyState
  EmptyState.Header
    EmptyState.Media        (variant "icon" = circular muted background)
    EmptyState.Title        (h3)
    EmptyState.Description  (p)
  EmptyState.Content        (actions)
```

| Part                                | Prop                     | Type                                          | Default     |
| ----------------------------------- | ------------------------ | --------------------------------------------- | ----------- |
| EmptyState                          | `size`                   | `"sm" \| "md" \| "lg"`                        | `"md"`      |
|                                     | `render`                 | `DOMRenderFunction` (replaces the root `div`) |             |
|                                     | `className`, `children`  |                                               |             |
| Media                               | `variant`                | `"default" \| "icon"`                         | `"default"` |
| Header, Title, Description, Content | `children`, native attrs |                                               |             |

Classes: `.empty-state`, `--sm|md|lg`, `__header`, `__media` (`[data-variant="icon"|"default"]`), `__title`, `__description`, `__content`.

## Gotchas

- No built-in border or background. The docs' "Outline" is just `className="border-border rounded-2xl border border-dashed"`, "With Background" is `bg-surface-secondary rounded-2xl`.
- `Content` is `flex flex-col items-center gap-2`; use `className="flex-row gap-2"` for side-by-side buttons.
- Size tokens (from CSS): sm `gap-3 px-4 py-6`, icon media 40px, title `text-sm`; md `gap-4 px-6 py-8`, 48px, `text-base`; lg `gap-5 px-8 py-12`, 56px, `text-lg`. Icon media is a circle (`rounded-full bg-default`), whereas Rezumi uses a `rounded-xl bg-sunken` tile.
- Title is `h3`, fixed; heading level not adjustable except via custom children.
- DataGrid usage: return it from `renderEmptyState` (docs pattern, `size="sm"` inside a `py-6` wrapper).
- Description has no max width; docs add `max-w-xs text-pretty`.

Example:

```tsx
<EmptyState className="rounded-2xl border border-dashed border-border">
  <EmptyState.Header>
    <EmptyState.Media variant="icon">
      <Briefcase />
    </EmptyState.Media>
    <EmptyState.Title>{t`Track your first job`}</EmptyState.Title>
    <EmptyState.Description className="max-w-sm text-pretty">
      {t`Paste a job link. We'll save the posting.`}
    </EmptyState.Description>
  </EmptyState.Header>
  <EmptyState.Content className="flex-row gap-2">
    <Button onPress={onAdd}>{t`Save job`}</Button>
    <Button variant="outline" onPress={onImport}>{t`Import from CSV`}</Button>
  </EmptyState.Content>
</EmptyState>
```

## Fit for Rezumi (strongest replacement candidate)

Hand-rolled empty states that map directly:

- `routes/dashboard/applications/index.tsx` `EmptyState` (icon tile in `bg-sunken`, h2, p, two buttons): exact match (`Media variant="icon"`, `Content` row).
- `features/documents/documents-page.tsx` "Nothing matches" (magnifier icon, bold line, helper, "Clear search and filters" button).
- `features/documents/trash-page.tsx` "Trash is empty" (title + description).
- `features/career/today.tsx` NeedsYou "You're up to date" (dashed `border-line-2` card, display-font title, description, optional "Show N read" ghost button): matches the docs' Outline example.
- `features/career/offers.tsx` "No offers to compare yet", `features/career/knowledge/stories.tsx` "No stories yet" (both dashed card + title + description).
- `features/applications/components/insights-view.tsx` bare `<p>` "Once you've sent a few applications...".
- Not a fit: `FirstRun` in documents-page (bespoke dashed drop zone with file-arrow icon, import CTA and two link buttons), `features/assistant/assistant-panel.tsx` and `features/career/coach.tsx` `EmptyState` functions (left-aligned prompt starters, not empty states in this sense), `today.tsx` `emptyLine` one-liner.
- Lacks vs current: entrance animation (`starting:` translate/opacity), display font title (`font-display`) is styled by Rezumi tokens not the component, left-aligned variants.

---

# 4. ActionBar (deepest)

Import: `import {ActionBar} from "@heroui-pro/react"`. Purpose: floating pill toolbar for contextual (bulk) actions, animated in/out by `isOpen`.

Anatomy (all three sections optional; use OSS `Separator` between them):

```
ActionBar (isOpen)
  ActionBar.Prefix     (count Chip)
  <Separator />
  ActionBar.Content    (action Buttons)
  <Separator />
  ActionBar.Suffix     (clear/dismiss)
```

| Part                    | Prop                    | Type                                             | Default        |
| ----------------------- | ----------------------- | ------------------------------------------------ | -------------- |
| ActionBar               | `isOpen`                | `boolean`, required, drives enter/exit animation |                |
|                         | `aria-label`            | `string`                                         | `"Actions"`    |
|                         | `isAttached`            | `boolean` (surface background + full rounding)   | `true`         |
|                         | `orientation`           | `"horizontal" \| "vertical"`                     | `"horizontal"` |
|                         | `className`, `children` |                                                  |                |
| Prefix, Content, Suffix | `className`, `children` |                                                  |                |

Extends OSS `ToolbarProps` (RAC Toolbar: arrow-key focus among buttons).

## Behavior and CSS

- `.action-bar`: `pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center`. `.action-bar__wrapper` is the pill (`shadow-overlay`, `pointer-events-auto`, padding `6px 12px`; `4px 8px` below 640px).
- Content is mounted only while `isOpen` (motion `AnimatePresence`, spring, y 8px, 0.3s). No `inert`/`aria-hidden` bookkeeping needed.
- Responsive labels: put `<span className="action-bar__label">` around button text; below 640px it becomes `sr-only` (icon-only buttons). Buttons still need `aria-label`.
- Selection count and clear button are NOT built in; you compose them (`Chip` in Prefix, `Button isIconOnly` in Suffix).

## Gotchas

- Verified in `dist/components/action-bar/action-bar.js`: your `className` lands on the inner toolbar (`.action-bar__wrapper`), NOT on the fixed outer `.action-bar` element. To lift it above Rezumi's mobile bottom nav (today `max-sm:bottom-[calc(69px+env(safe-area-inset-bottom))]`) override `.action-bar { bottom: ... }` in CSS (`[data-slot="action-bar"]` also exists). No CSS variable offers this.
- `z-50` fixed; today Rezumi uses `z-30`. Check layering against `application-detail-sheet` and dialogs.
- No live region. Today's `aria-live="polite"` on "N selected" must be added to your Prefix content.
- `isOpen` is required, so derive it from `selectionCount > 0` and handle `selected === "all"`.
- No built-in "Select all" or "N selected" text; they are plain children.

Example:

```tsx
<ActionBar aria-label={t`Selected documents`} isOpen={count > 0}>
  <ActionBar.Prefix>
    <Chip size="sm" className="tabular-nums" aria-live="polite">
      {count}
    </Chip>
  </ActionBar.Prefix>
  <Separator />
  <ActionBar.Content>
    <Button size="sm" variant="ghost" onPress={onTags}>
      <Tag />
      <span className="action-bar__label">{t`Tags`}</span>
    </Button>
    <Button size="sm" variant="ghost" className="text-danger" onPress={onTrash}>
      <Trash />
      <span className="action-bar__label">{t`Move to Trash`}</span>
    </Button>
  </ActionBar.Content>
  <Separator />
  <ActionBar.Suffix>
    <Button isIconOnly size="sm" variant="ghost" aria-label={t`Clear selection`} onPress={clear}>
      <X />
    </Button>
  </ActionBar.Suffix>
</ActionBar>
```

## Fit for Rezumi

- `documents-page.tsx` `SelectionBar` (fixed `bottom-6 z-30`, toolbar role, count, Select all, Tags, Sharing dropdown, Move to Trash, clear `x`, `max-sm:sr-only` labels) is the target use case; the `action-bar__label` class is the same trick. Remove manual `aria-hidden`/`inert`/translate transition: `isOpen` handles it.
- `applications/components/list-view.tsx` `BulkBar` (Move to dropdown, Add tag popover with inline form, Close dropdown, Delete with `confirm`, clear). Also fits; wrapped today by a `motion` fixed container with phone offset.
- Lacks vs current: configurable bottom offset (see gotcha), `z-30` layering, aria-live count, hidden "Select all" on phones.

---

# 5. ItemCard and ItemCardGroup (deepest)

Imports: `import {ItemCard, ItemCardGroup} from "@heroui-pro/react"`; pressable cards also use `PressableFeedback` (root). Purpose: settings-style row (icon, title, description, trailing action) and a container that groups rows as a list or grid.

Anatomy:

```
ItemCardGroup (layout "list" | "grid")
  ItemCardGroup.Header
    ItemCardGroup.Title        (h3)
    ItemCardGroup.Description  (p)
  ItemCard
    ItemCard.Icon
    ItemCard.Content
      ItemCard.Title           (span, truncated)
      ItemCard.Description     (span, truncated)
    ItemCard.Action
  <Separator />   (explicit, between cards in list layout)
  ItemCard ...
```

| Part                                      | Prop                     | Type                                                                   | Default                        |
| ----------------------------------------- | ------------------------ | ---------------------------------------------------------------------- | ------------------------------ |
| ItemCard                                  | `variant`                | `"default" \| "secondary" \| "tertiary" \| "outline" \| "transparent"` | `"default"` (surface + shadow) |
|                                           | `render`                 | `DOMRenderFunction` (generic `ItemCard<"button">`)                     |                                |
|                                           | `className`, `children`  |                                                                        |                                |
| Icon, Content, Title, Description, Action | `children`, native attrs |                                                                        |                                |
| ItemCardGroup                             | `layout`                 | `"list" \| "grid"`                                                     | `"list"`                       |
|                                           | `variant`                | same five values                                                       | `"default"`                    |
|                                           | `columns`                | `2 \| 3` (grid only, sets `--item-card-group-columns`)                 | `2`                            |
| Header, Title, Description                | `children`, native attrs |                                                                        |                                |

CSS facts (from `get_css`): `.item-card` is `flex items-center gap-3 rounded-2xl px-4 py-3`; `__icon` is `size-9` with `svg size-4` on `bg-default`; `__title` and `__description` are `truncate`; `__action` is `ms-auto shrink-0 ps-2`. `.item-card-group > [data-slot="item-card"]` flattens children (no radius/border/shadow) ONLY for direct children.

## Gotchas

- The CSS comment says "auto-dividers", but no divider is drawn. Every example inserts `<Separator />` between cards in list layout. Grid layout needs none.
- Flattening and Separator spacing depend on cards being DIRECT children of `ItemCardGroup`. Wrapping each card (for example `motion.div` collapse rows) breaks the group styling.
- Title and Description truncate to one line. Multi-line bodies need a className override (for example `whitespace-normal`).
- Pressable card: `ItemCard<"button"> render={(props) => <button type="button" {...props} />}` with `className="relative w-full cursor-pointer overflow-hidden"` and a `PressableFeedback.Highlight` or `.Ripple` child. Do not nest a `Switch`/`Button` inside a button-rooted card; keep the root a div and make `ItemCard.Content` the pressable part (inferred).
- `ItemCard.Icon` has no tone prop; tint with `className`.
- Neither part is a list: add `role="list"/"listitem"` yourself if you need list semantics.

Example (Schedules row):

```tsx
<ItemCardGroup variant="outline">
  {rows.map((row, i) => (
    <Fragment key={row.id}>
      {i > 0 && <Separator />}
      <ItemCard variant="transparent">
        <ItemCard.Icon>
          <Calendar />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>{title(row)}</ItemCard.Title>
          <ItemCard.Description>{status(row)}</ItemCard.Description>
        </ItemCard.Content>
        <ItemCard.Action>
          <Switch aria-label={title(row)} isSelected={row.enabled} onChange={(on) => toggle(row, on)}>
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch.Content>
          </Switch>
        </ItemCard.Action>
      </ItemCard>
    </Fragment>
  ))}
</ItemCardGroup>
```

## Fit for Rezumi

- `features/career/today.tsx` `Schedules` (title, 2-line clamped description, accent status line, `Switch`, plus "Add" header button and footer note): docs "With Switch" and "Linked/Notification" examples are the same pattern. Gaps: `line-clamp-2` description and a third status line (Title/Description truncate to one line, so either two ItemCard.Description spans with a className override, or custom content); the whole text block is a button opening the schedule editor (put the button inside `ItemCard.Content`); `AnimatePresence` collapse rows (wrapper breaks the direct-child rule); header with Eyebrow plus Add button (`ItemCardGroup.Header` takes only Title/Description, extra children probably fit but are undocumented).
- `today.tsx` `NeedsYou` rows (tone-tinted icon tile, title, body, meta, "Review" button, mark-read check): structural match, but body text wraps over multiple lines and has `content-visibility:auto`, exit animation and undo toast. Medium fit.
- `RoleCard`, `ComingUp` are vertical/multi-row cards: keep as OSS `Card`.
- `application-card.tsx` (board card): not a fit; board is covered by Kanban.
- Settings pages (`features/settings/*`) not inspected; ItemCardGroup is the Pro settings-row component.

---

# 6. KPI, KPIGroup, NumberValue, TrendChip (deepest)

Imports:

```tsx
import { KPIGroup, NumberValue, TrendChip } from "@heroui-pro/react";
import { KPI } from "@heroui-pro/react/kpi"; // subpath ONLY, needs recharts (even if you never use KPI.Chart)
```

Purpose: metric card (value, trend chip, optional progress bar or sparkline). KPI root wraps the OSS `Card` (accepts Card props).

Anatomy:

```
KPI
  KPI.Header
    KPI.Icon (status)     KPI.Title (dt)     KPI.Trend (may sit in Header, className="ml-auto")
  KPI.Actions             (absolutely positioned three-dot ghost icon Button)
  KPI.Content             (grid: value left, trend/progress right)
    KPI.Value (dd)        KPI.Trend     KPI.Progress
  KPI.Chart               (sparkline, below Content or inline in a 2-col Content)
  KPI.Separator
  KPI.Footer
KPIGroup (orientation)  >  KPI, KPIGroup.Separator, KPI ...
```

| Part                          | Props                                                                                                                                                                                                                                                                                                                      |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| KPI                           | all OSS `Card` props, `children`                                                                                                                                                                                                                                                                                           |
| KPI.Header / Content / Footer | native `div`                                                                                                                                                                                                                                                                                                               |
| KPI.Icon                      | `status?: "success" \| "warning" \| "danger"`, `children`                                                                                                                                                                                                                                                                  |
| KPI.Title                     | native `dt`                                                                                                                                                                                                                                                                                                                |
| KPI.Value                     | `value: number` (required) plus all NumberValue props except `children`; `children?: (formatted: string) => ReactNode`; also accepts `<NumberValue.Suffix>` child per examples                                                                                                                                             |
| KPI.Trend                     | all TrendChip props                                                                                                                                                                                                                                                                                                        |
| KPI.Progress                  | `value: number` (0 to 100, required), `status?: "success" \| "warning" \| "danger"` (default `"success"`)                                                                                                                                                                                                                  |
| KPI.Actions                   | all OSS `Button` props; `children` replaces the dots icon                                                                                                                                                                                                                                                                  |
| KPI.Chart                     | `data: Record<string, number \| string \| null>[]` (required), `dataKey` (`"value"`), `color` (`"currentColor"`), `connectNulls` (`false`), `fillColor`, `height` (`80`), `strokeWidth` (`2`), `tooltip: ReactNode` (an `<AreaChart.Tooltip content={...}/>`), `areaProps` (forwarded to Recharts `Area`, minus `dataKey`) |
| KPI.Separator                 | OSS `Separator` props                                                                                                                                                                                                                                                                                                      |
| KPIGroup                      | `orientation?: "horizontal" \| "vertical"` (`"horizontal"`), native `div`                                                                                                                                                                                                                                                  |
| KPIGroup.Separator            | native `span` (1px divider)                                                                                                                                                                                                                                                                                                |

NumberValue (`@heroui-pro/react`): `value: number` required; `style: "decimal" \| "currency" \| "percent" \| "unit"` (`"decimal"`); `currency` (needed for currency); `unit` (needed for unit, e.g. `"day"`, `"minute"`); `notation: "standard" \| "compact" \| "scientific" \| "engineering"` (`"standard"`); `signDisplay: "auto" \| "always" \| "exceptZero" \| "never"`; `minimumFractionDigits`, `maximumFractionDigits`; `locale`; `formatOptions` (raw `Intl.NumberFormatOptions`, overrides the convenience props); `children` (parts or `(formatted) => ReactNode`). Parts: `NumberValue.Prefix`, `NumberValue.Suffix`. Percent style expects a fraction (`0.423` renders 42.3%).

TrendChip: `trend: "up" \| "down" \| "neutral"` (`"up"`; color is derived: success/danger/warning), `size: "sm" \| "md" \| "lg"` (`"sm"`), `variant: "primary" \| "secondary" \| "soft" \| "tertiary"` (`"soft"`), other OSS Chip props except `children`/`color`/`size`. Parts: `TrendChip.Indicator` (custom arrow SVG), `.Prefix`, `.Suffix` (e.g. "vs last week").

CSS: `--kpi-chart-fade` (sparkline edge mask, `10%`).

## Gotchas

- `KPI` is not in the barrel. Importing it pulls `recharts`; install it only if KPI is adopted (KPI.Chart is optional but the peer is not).
- `TrendChip` color is forced by `trend`; `color` is omitted from its props. A metric where down is good (median days to reply falling) renders red with `trend="down"`. Work around with `className`/`neutral` or skip the chip (inferred).
- `KPI.Title` renders `dt` and `KPI.Value` renders `dd`, and the package ships no `dl` wrapper (checked in `kpi.js`): add one, or accept invalid structure (inferred a11y issue).
- `value` is required and numeric: no null/"—" state. Render a placeholder yourself for "no replies yet".
- `null` in chart data is a gap by default; `connectNulls` bridges it. Do not use `0` for "no data".
- Locale: pass `locale={i18n.locale}` or set RAC `I18nProvider`.
- Docs provide no skeleton state or entry animation.

Example:

```tsx
<KPIGroup>
  <KPI>
    <KPI.Header>
      <KPI.Title>{t`Heard back`}</KPI.Title>
    </KPI.Header>
    <KPI.Content>
      <KPI.Value style="percent" maximumFractionDigits={0} locale={i18n.locale} value={heardBack / sent} />
    </KPI.Content>
  </KPI>
  <KPIGroup.Separator />
  <KPI>
    <KPI.Header>
      <KPI.Title>{t`Median to first reply`}</KPI.Title>
    </KPI.Header>
    <KPI.Content>
      <KPI.Value style="unit" unit="day" locale={i18n.locale} value={medianDays} />
      <KPI.Trend trend="neutral">{t`vs last month`}</KPI.Trend>
    </KPI.Content>
  </KPI>
</KPIGroup>
```

## Fit for Rezumi

- `applications/components/insights-view.tsx` two figure cards ("{n}% heard back", "{n} days median to first reply", both `font-display text-[34px]` inside `rounded-xl border` divs): direct `KPIGroup` + `KPI` + `NumberValue style="percent"` / `style="unit" unit="day"`. Replaces the `Plural` for days (Intl handles plural units per locale; keep Lingui for the label).
- The 8-week "Applications over time" bars could become a `KPI.Chart` sparkline (loses per-bar counts and labels; `tooltip` prop restores hover values). The funnel bars, source bars and the SVG `PipelineFlow` PNG export have no KPI/Widget equivalent; keep (charts are a separate note).
- Current code has, KPI lacks: stagger/scale-in bar animations, the "—" fallback, display font treatment (restyle through tokens).

---

# 7. Timeline (deepest)

Import: `import {Timeline, useTimelineItem} from "@heroui-pro/react"`. Purpose: read-only chronology (activity feed, audit log, release history). Renders `ol`/`li`; connectors are decorative; empty markers hidden from AT; `status="current"` sets `aria-current="true"`. Use a Stepper for progress through known steps.

Anatomy:

```
Timeline
  Timeline.Item (status, align, side)
    Timeline.Rail (optional; default rail is built when omitted)
      Timeline.Marker
      Timeline.Connector
    Timeline.Marker   (shortcut: direct child of Item is accepted in all examples)
    Timeline.Content
```

| Part         | Prop                                   | Type                                                                      | Default         |
| ------------ | -------------------------------------- | ------------------------------------------------------------------------- | --------------- |
| Timeline     | `axis`                                 | `"start" \| "center"` (rail position)                                     | `"start"`       |
|              | `placement`                            | `"start" \| "end" \| "alternate"` (default content side)                  | `"end"`         |
|              | `size`                                 | `"sm" \| "md" \| "lg"` (marker and text size)                             | `"md"`          |
|              | `density`                              | `"compact" \| "comfortable"`                                              | `"comfortable"` |
|              | `itemAlign`                            | `"start" \| "center"`                                                     | `"start"`       |
|              | native `ol` attrs                      |                                                                           |                 |
| Item         | `status`                               | `"default" \| "current" \| "success" \| "warning" \| "danger" \| "muted"` | `"default"`     |
|              | `align`                                | `"start" \| "center"`                                                     | inherited       |
|              | `side`                                 | `"start" \| "end"` (centered timelines)                                   | inherited       |
| Rail, Marker | `status` (Marker only, overrides item) | same six                                                                  | item status     |
| Connector    | `force`                                | `boolean`, render even on the last item                                   | `false`         |
| Content      | `side`                                 | `"start" \| "end"`                                                        | item side       |

`useTimelineItem()` returns `{align, index, isLast, side, status}` for descendants of an Item.

CSS variables on `.timeline` (override per marker or root): `--timeline-marker-size`, `--timeline-connector-size`, `--timeline-rail-width`, `--timeline-gap`, `--timeline-item-gap`, `--timeline-marker-border-width`, `--timeline-current-color`, `--timeline-marker-border`, `--timeline-marker-fg`, `--timeline-connector-color`. Marker colors per `data-status`: `success`/`warning`/`danger` use `color-mix` of the semantic colors; `current` uses accent; `muted` is 0.7 opacity.

## Gotchas

- Tone is limited to six statuses. Rezumi colors markers by pipeline stage (`getStageColor`, arbitrary colors): pass `Timeline.Marker` children (a colored dot) or override `--timeline-marker-border` / `--timeline-marker-fg` via `style` on the Marker (inferred from the CSS cascade).
- Timeline owns layout only. Dates, titles, menus, hover actions are your own children inside `Timeline.Content` (use `<time>`, `<h3>` as docs do).
- A composer can be the first Item (docs "Incident Response": avatar marker + `Input` + `Button`), so the note field fits.
- Order is your data order; no sorting, grouping or "load more".
- Connector auto-hides for the last item; pass `force` to keep it (for example when a "load older" item follows).

Example (application activity):

```tsx
<Timeline density="compact" size="sm">
  {sorted.map((entry) => (
    <Timeline.Item key={entry.id} align="center" status={entry.id === anchorId ? "current" : "default"}>
      <Timeline.Marker aria-hidden="true">
        <span className="size-2 rounded-sm" style={{ background: dot(entry) }} />
      </Timeline.Marker>
      <Timeline.Content>
        <div className="flex min-w-0 items-start justify-between gap-3">
          <p className="min-w-0 text-sm">{text(entry)}</p>
          <time className="shrink-0 text-xs text-muted">{formatDate(entry)}</time>
          <EntryMenu entry={entry} />
        </div>
      </Timeline.Content>
    </Timeline.Item>
  ))}
</Timeline>
```

## Fit for Rezumi

- `applications/components/detail/activity.tsx`: the `<ol>` of rows (colored 8px square dot, text, right-aligned date, hover-revealed `...` menu, interview rows as buttons, note composer on top, edit dialog, confirm delete) maps onto Timeline with all interactive parts kept as children. Gaps: per-stage marker color (see gotcha), the rounded-square dot becomes a ringed circle, and the "anchor entry cannot be deleted" rule stays in your menu logic.
- Dense compact feed with `size="sm" density="compact"` matches the current spacing.
- `today.tsx` ComingUp is a single event, not a timeline.

---

# 8. Widget

Import: `import {Widget} from "@heroui-pro/react"`. Purpose: dashboard container with a `surface-secondary` shell and an elevated `bg-surface` content area. Works for charts, tables, KPIs.

Anatomy:

```
Widget
  Widget.Header       (justify-between)
    Widget.Title (span)   Widget.Description (span)   Widget.Legend > Widget.LegendItem (color required)
  Widget.Content      (use p-0 for edge-to-edge tables)
  Widget.Footer
```

Props: Widget `className`, `children`, `render` (polymorphic), native `div`. Header/Title/Description/Content/Footer/Legend: `className`, `children`. `Widget.LegendItem`: `color` (required CSS color, e.g. `"var(--chart-3)"`), `className`, `children`. Classes: `.widget`, `__header`, `__title`, `__description`, `__content`, `__footer`, `__legend`, `__legend-item`, `__legend-item-dot`, `__legend-item-label`.

Gotchas: Title is a `span`, so heading semantics are lost (add `role="heading" aria-level={2}` or keep your own `h2`). Pair a OSS `Table variant="secondary"` with `Widget.Content className="p-0"`. KPIGroup inside Widget needs `className="bg-transparent shadow-none"` (docs).

Example:

```tsx
<Widget>
  <Widget.Header>
    <Widget.Title>{t`Where applications come from`}</Widget.Title>
    <Widget.Description>{t`Count by source`}</Widget.Description>
  </Widget.Header>
  <Widget.Content>{/* bars or chart */}</Widget.Content>
</Widget>
```

## Fit for Rezumi

`insights-view.tsx` repeats `rounded-xl border border-line p-5` containers for the funnel, tailored-vs-base note, "Applications over time", and "Where applications come from". Widget replaces those shells; its two-tone surface is a visual change from the current flat bordered cards. Lacks: `aria-labelledby` section wiring and the entrance animations.

---

# 9. HoverCard

Import: `import {HoverCard} from "@heroui-pro/react"` (RAC `PreviewTrigger`). Purpose: hover/focus/long-press preview card.

Anatomy: `HoverCard` > `HoverCard.Trigger` (inline `span` wrapper around a focusable child) + `HoverCard.Content` (> optional `HoverCard.Arrow`).

| Part      | Prop                                                                                | Type                                 | Default           |
| --------- | ----------------------------------------------------------------------------------- | ------------------------------------ | ----------------- |
| HoverCard | `open` / `defaultOpen` / `onOpenChange`                                             | boolean / boolean / `(open) => void` |                   |
|           | `openDelay`                                                                         | ms                                   | `700`             |
|           | `closeDelay`                                                                        | ms                                   | `300`             |
|           | `isDisabled`                                                                        | `boolean`                            | `false`           |
| Content   | `placement`                                                                         | `Placement`                          | `"top"`           |
|           | `offset`                                                                            | `number`                             | `8`               |
|           | other RAC `Popover` props except `isOpen`/`defaultOpen`/`onOpenChange`/`triggerRef` |                                      |                   |
| Arrow     | `children` (custom arrow), RAC `OverlayArrow` props                                 |                                      | default SVG arrow |

A11y: renders `role="dialog"`; pass `aria-label` to `HoverCard.Content`. Keyboard: focus trigger opens, Tab enters, Escape closes. Touch: long press opens. Delays are shared globally with Tooltips (next card opens instantly once one has been shown).

Gotchas: not a tooltip; content can contain interactive elements. Keep the preview supplementary (touch devices need long press; Rezumi's mobile parity needs a native alternative). `packages/ui` has `tooltip` and `popover` only, no hover card.

Example:

```tsx
<HoverCard openDelay={400}>
  <HoverCard.Trigger>
    <Link href={href}>{document.name}</Link>
  </HoverCard.Trigger>
  <HoverCard.Content aria-label={t`Preview`} className="w-64 p-0">
    <ResumeThumbnail resumeId={document.id} />
  </HoverCard.Content>
</HoverCard>
```

Fit for Rezumi: no current code. Candidate (new behavior, not a replacement): quick preview of a resume thumbnail (`features/documents/resume-thumbnail.tsx`) on the document name in a DataGrid row, or application peek in a list. Optional.

---

# 10. FileTree

Import: `import {FileTree, useFileTree, useFileTreeDrag} from "@heroui-pro/react"`. Purpose: hierarchical explorer on RAC `Tree` with expand/collapse, icons, guide lines, multi-select, drag and drop.

Anatomy:

```
FileTree (role treegrid)
  FileTree.Section > FileTree.Header
  FileTree.Item (id, textValue, title)
    FileTree.Indicator   (optional custom chevron, child of an Item)
    FileTree.Item ...    (nested)
```

| Part                                          | Prop                                                                                                                                                                   | Type                                                                      | Default   |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------- |
| FileTree                                      | `size`                                                                                                                                                                 | `"sm" \| "md" \| "lg"`                                                    | `"md"`    |
|                                               | `showGuideLines`                                                                                                                                                       | `boolean \| "hover"`                                                      | `true`    |
|                                               | `reduceMotion`                                                                                                                                                         | `boolean`                                                                 | `false`   |
|                                               | plus all RAC `Tree` props (`items`, `defaultExpandedKeys`, `selectedKeys`, `selectionMode`, `onSelectionChange`, `dragAndDropHooks`, `renderEmptyState`, `aria-label`) |                                                                           |           |
| Item                                          | `title`                                                                                                                                                                | `ReactNode`, required                                                     |           |
|                                               | `icon`                                                                                                                                                                 | `ReactNode \| ({isExpanded, hasChildItems, allowsDragging}) => ReactNode` |           |
|                                               | `dragIcon`                                                                                                                                                             | `ReactNode \| false`                                                      | grip icon |
|                                               | RAC `TreeItem` props (`id`, `textValue`)                                                                                                                               |                                                                           |           |
| Indicator                                     | `children`, `className`                                                                                                                                                |                                                                           | chevron   |
| `useFileTree({items, isLeaf?})`               | returns `{expandableKeys, filterTree(predicate), leaves}`                                                                                                              |                                                                           |           |
| `useFileTreeDrag({tree, getItems?, onMove?})` | returns `{dragAndDropHooks}`; needs RAC `useTreeData`                                                                                                                  |                                                                           |           |

CSS variables: `--file-tree-indent`, `--file-tree-item-px`, `--file-tree-guide-color`.

Gotchas: dynamic data needs `Collection` from `react-aria-components/Collection` for nested children in the render function (docs pattern). Use `defaultExpandedKeys` (array of ids; `useFileTree().expandableKeys` gives all branches). File-explorer look (folder icons, guide lines) is baked in.

Example:

```tsx
<FileTree aria-label="Outline" defaultExpandedKeys={["experience"]}>
  <FileTree.Item id="experience" textValue="Experience" title="Experience">
    <FileTree.Item id="e1" textValue="Acme" title="Acme" />
  </FileTree.Item>
</FileTree>
```

Fit for Rezumi: no hierarchical file-like UI exists. `features/resume/editor/write/outline.tsx` and `section-row.tsx` use `@dnd-kit` sortable lists with page/column/hidden semantics; `routes/builder/.../layout/pages.tsx` drags sections across pages. FileTree DnD moves nodes inside a `useTreeData` tree; multi-container page/column layout is not documented as supported. Low value, skip.

---

# 11. FloatingToc

Import: `import {FloatingToc} from "@heroui-pro/react"`. Purpose: floating side table of contents: a stack of indicator bars that opens a panel of section links.

Anatomy: `FloatingToc` > `FloatingToc.Trigger` (wraps `FloatingToc.Bar` per section) + `FloatingToc.Content` (RAC Popover, wraps `FloatingToc.Item` per section).

| Part        | Prop                                                                                         | Type                 | Default       |
| ----------- | -------------------------------------------------------------------------------------------- | -------------------- | ------------- |
| FloatingToc | `placement`                                                                                  | `"left" \| "right"`  | `"right"`     |
|             | `triggerMode`                                                                                | `"hover" \| "press"` | `"hover"`     |
|             | `open` / `defaultOpen` / `onOpenChange`                                                      |                      |               |
|             | `openDelay` / `closeDelay`                                                                   | ms                   | `200` / `300` |
| Trigger     | native `span` (give `aria-label`)                                                            |                      |               |
| Bar         | `active`, `level` (1 = top, deeper = shorter bar)                                            | `boolean`, `number`  |               |
| Content     | `offset` (`8`), `placement` (auto from root), RAC Popover props except `isOpen`/`triggerRef` |                      |               |
| Item        | `active`, `level` (indents), native `button` attrs                                           |                      |               |

CSS variables: `--floating-toc-bar-width` (16px), `--floating-toc-bar-active-width` (24px), `--floating-toc-bar-height` (2px), `--floating-toc-bar-level-step` (3px), `--floating-toc-bar-gap` (12px), `--floating-toc-item-indent` (0.75rem), `--floating-toc-level`.

Gotchas: despite the description ("tracks scroll position") it does NOT track scroll. Every example holds `activeId` in state and sets it on `onClick`. You supply scroll-spy (IntersectionObserver) and the scrolling. Item is a plain `button`. Large lists: docs show a virtualized variant using RAC `ListBox` + `Virtualizer` with class `floating-toc__item`.

Example:

```tsx
<FloatingToc triggerMode="press">
  <FloatingToc.Trigger aria-label={t`Sections`}>
    {sections.map((s) => (
      <FloatingToc.Bar key={s.id} active={s.id === activeId} />
    ))}
  </FloatingToc.Trigger>
  <FloatingToc.Content>
    {sections.map((s) => (
      <FloatingToc.Item key={s.id} active={s.id === activeId} onClick={() => scrollTo(s.id)}>
        {s.label}
      </FloatingToc.Item>
    ))}
  </FloatingToc.Content>
</FloatingToc>
```

Fit for Rezumi: nothing today (no IntersectionObserver/scroll-spy in `apps/web/src`). Possible future: long ATS report (`features/ats-checker/report/report-view.tsx`) section jump. Optional.

---

# 12. Carousel

Import: `import {Carousel, useCarousel} from "@heroui-pro/react/carousel"` (subpath only; peers `embla-carousel`, `embla-carousel-react`; autoplay needs the separate `embla-carousel-autoplay`). Purpose: Embla-based slider with arrows, dots, thumbnails.

Anatomy: `Carousel` > `Carousel.Content` > `Carousel.Item`_, then `Carousel.Previous`, `Carousel.Next`, `Carousel.Dots`, `Carousel.Thumbnails` > `Carousel.Thumbnail`_.

| Part            | Prop                                                                          | Type                                    | Default      |
| --------------- | ----------------------------------------------------------------------------- | --------------------------------------- | ------------ |
| Carousel        | `opts`                                                                        | Embla options (`loop`, `align`, ...)    |              |
|                 | `plugins`                                                                     | `EmblaPluginType[]`                     |              |
|                 | `type`                                                                        | `"in-place" \| "modal" \| "miniatures"` | `"in-place"` |
|                 | `setApi`                                                                      | `(api: EmblaCarouselType) => void`      |              |
| Item            | `className` (use `basis-1/3` for multiple per view)                           |                                         | full width   |
| Previous / Next | `icon` (replaces chevron), button attrs; auto-disabled at ends unless looping |                                         |              |
| Dots            | `renderDot({index, isSelected})`; one per snap, hidden if one snap            |                                         |              |
| Thumbnails      | native div, `tablist`                                                         |                                         |              |
| Thumbnail       | `index` (required, 0-based), `src`, `alt` (`""`), or `children`               |                                         |              |

`useCarousel()` returns `{api, selectedIndex, scrollSnapCount, canScrollPrev, canScrollNext, scrollPrev, scrollNext, scrollTo}`. CSS: `--carousel-gap`.

Gotchas: slides need `select-none`/`draggable={false}` on images (docs do). Embla pointer-drag can fight inner pointer handlers.

Example:

```tsx
<Carousel opts={{ align: "start", dragFree: true }}>
  <Carousel.Content>
    {ids.map((id) => (
      <Carousel.Item key={id} className="basis-28">
        <TemplateCard id={id} />
      </Carousel.Item>
    ))}
  </Carousel.Content>
  <Carousel.Previous />
  <Carousel.Next />
</Carousel>
```

Fit for Rezumi: `features/resume/editor/design/template-group.tsx` "strip" layout is a CSS snap scroller (`flex snap-x ... *:w-28`) with pointer-leave preview handlers on the container; Carousel adds arrows and drag but risks the existing hover-preview and keyboard handlers. Low priority; keep the CSS scroller unless arrows are wanted.

---

# 13. HoloCard

Import: `import {HoloCard} from "@heroui-pro/react"`. Purpose: 3D tilting card with pointer-tracked holographic glare, for passes and collectibles.

Anatomy: `HoloCard` > `HoloCard.Rotator` > `HoloCard.Frame` > `HoloCard.Surface` > layers: `HoloCard.Image`, `HoloCard.Inset`, `HoloCard.Pattern`, `HoloCard.Content` (repeatable parallax layers), `HoloCard.Shine` (> `HoloCard.ShinePattern`). Only Rotator, Frame, Surface are required.

HoloCard props: `gradient` (CSS background), `patternSrc`, `patternSize`, `isInteractive` (`true`), `isDisabled` (`false`), `parallaxStrength` (`10`), `className`, native div and Motion props. `Content`: `parallax` (`true`). `Image`: `alt` (required), `src`. CSS variables: `--holo-card-width` (302px), `--holo-card-height` (453px), `--holo-card-radius` (20px), `--holo-card-bleed` (36px), `--holo-card-perspective` (600px), `--holo-card-gradient`, `--holo-card-inset-color`, `--holo-card-pattern`, `--holo-card-pattern-size`, `--holo-card-pattern-opacity` (0.9), `--holo-card-texture-opacity` (0.1). Static under `prefers-reduced-motion`; on touch only horizontal drags tilt. Put card art in `HoloCard.Image`, not `Content`.

Example:

```tsx
<HoloCard gradient="linear-gradient(140deg, #3a3730, #12131c)">
  <HoloCard.Rotator>
    <HoloCard.Frame>
      <HoloCard.Surface>
        <HoloCard.Inset />
        <HoloCard.Pattern />
        <HoloCard.Content className="items-center justify-center">
          <span className="text-white">Rezumi</span>
        </HoloCard.Content>
        <HoloCard.Shine />
      </HoloCard.Surface>
    </HoloCard.Frame>
  </HoloCard.Rotator>
</HoloCard>
```

Fit for Rezumi: none. Decorative; skip.

---

# 14. Map

Import: `import {Map} from "@heroui-pro/react/map"` (subpath only; peer `maplibre-gl >=6.0.0`; note it shadows the global `Map`, alias on import). Purpose: MapLibre surface with markers, popups, routes, arcs, clusters, controls. No tile provider is bundled: pass `mapStyle` (one style) or `styles={{light, dark}}`; docs use OpenFreeMap (`https://tiles.openfreemap.org/styles/positron` and `/dark`). Keyed providers watermark tiles without a key. Pass `workerUrl` when the bundler cannot resolve the MapLibre worker.

Anatomy and props:

| Part             | Props                                                                                                                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Map              | `center: [lng, lat]`, `zoom`, `mapStyle`, `styles`, `theme` (`"light" \| "dark"`, detected), `viewport` / `onViewportChange`, `isLoading` (`false`), `workerUrl`, MapLibre `MapOptions` except `container`/`style`       |
| Map.Marker       | `latitude`, `longitude`, `draggable` (`false`), `onClick`, `onDragEnd({lat, lng})`; children `Map.MarkerContent` (> `Map.MarkerDot color ringColor`, `Map.MarkerLabel position`), `Map.MarkerTooltip`, `Map.MarkerPopup` |
| Map.Popup        | `latitude`, `longitude`, `closeButton` (`false`), `onClose`                                                                                                                                                              |
| Map.Controls     | `position` (`"bottom-right"` default); contains `Map.ZoomControl`, `CompassControl`, `LocateControl`, `FullscreenControl`, `ControlGroup`, `ControlButton`, `ControlSeparator`                                           |
| Map.Route        | `coordinates: [lng, lat][]`, `color`, `width`, `opacity`, `dashArray`; does no routing                                                                                                                                   |
| Map.Arc          | data items need `id`, `from`, `to`                                                                                                                                                                                       |
| Map.ClusterLayer | GeoJSON point collection or URL                                                                                                                                                                                          |

CSS variables: `--map-control-size`, `--map-control-offset`, `--map-popup-max-width`, `--map-marker-color`, `--map-marker-ring-color`, `--map-route-color`, `--map-route-width`, `--map-route-opacity`.

Example:

```tsx
<Map center={[-122.39, 37.78]} zoom={12} styles={styles}>
  <Map.Marker latitude={37.795} longitude={-122.394}>
    <Map.MarkerContent>
      <Map.MarkerDot />
    </Map.MarkerContent>
  </Map.Marker>
  <Map.Controls>
    <Map.ZoomControl />
  </Map.Controls>
</Map>
```

Fit for Rezumi: none (applications carry a `location` string only). Skip; adding it would pull in MapLibre and a tile-provider dependency.

---

# Cross-cutting gaps and migration order

| Rezumi feature                                               | HeroUI Pro gap                                 | Workaround                                                                   |
| ------------------------------------------------------------ | ---------------------------------------------- | ---------------------------------------------------------------------------- |
| Grouped, collapsible stage list (`ApplicationList`)          | No row groups or sections in DataGrid/ListView | Flat grid with Stage column, or tree rows (selection side effects)           |
| Per-row context menu, row class, row stagger (`DocumentRow`) | No row-level props                             | Move menu to ⋯ cell (already exists), accept loss of right-click and stagger |
| Fixed bulk bar offset over mobile bottom nav                 | `className` hits inner toolbar only            | CSS override of `.action-bar`                                                |
| Stage-colored timeline markers                               | Six fixed statuses                             | Marker children or CSS variable override                                     |
| Multi-line text in ItemCard                                  | Title/Description `truncate`                   | className override                                                           |
| Animated list rows (AnimatePresence) in ItemCardGroup        | Direct-child CSS                               | Animate inside the card, not around it                                       |
| Locale-aware numbers/RAC strings                             | No RAC `I18nProvider` in app                   | Add `I18nProvider locale={lingui locale}` at root                            |
| Decreasing-is-good trend color                               | TrendChip color fixed by `trend`               | Skip chip or className                                                       |

Suggested order: EmptyState (low risk, many sites), ActionBar (2 sites), Timeline (1 site), KPIGroup/KPI + Widget (Insights, adds `recharts`), ItemCardGroup (Schedules), DataGrid (documents and trash lists first; applications list last, only after deciding on groups). Treat ListView as the phone Applications row. Skip FileTree, FloatingToc, HoloCard, Map, Carousel unless a product need appears.
