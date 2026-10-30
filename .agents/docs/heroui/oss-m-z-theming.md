# HeroUI v3 OSS (`@heroui/react`) — M–Z component API, theming and Rezumi mapping

Date: 2026-10-29. Scope: web migration of `apps/web` + `packages/ui` from shadcn/Base UI to HeroUI DEFAULT style. A–L components are covered elsewhere (not in this file). Installed: `@heroui/react` 3.2.7, `@heroui/styles` 3.2.7, `@heroui-pro/react` 1.0.0-beta.10.

Evidence labels: **docs** = `get_component_docs`/`get_docs` MCP text; **source** = `get_component_source_code` or installed `apps/web/node_modules/@heroui/react/dist`; **repo** = measured in this repository. Anything not shown by those is not asserted. Code samples are minimal and assembled from documented anatomy/props.

## 0. Cross-cutting rules (docs)

- Tailwind v4 + React 19, React Aria Components under the hood, **no Provider**; import everything from `@heroui/react` (`Key`, `Selection`, `TimeValue`, `useOverlayState`, `toast`, `ToastQueue` are exported there). Compound components with dot notation (`Modal.Backdrop`); `Comp.Root` and named exports (`ModalBackdrop`) also valid.
- Event/prop naming (React Aria style): `onPress` (not `onClick`), `isDisabled`, `isSelected`, `isOpen`/`defaultOpen`/`onOpenChange`, `isRequired`, `isInvalid`, `isReadOnly`, `isIndeterminate`; value handlers get the VALUE (`onChange(value)`), not a DOM event, except raw `Input`/`TextArea` which use native `onChange(event)`.
- Field composition: `TextField|NumberField|SearchField|TimeField|Select|RadioGroup|TagGroup` + `Label` + `Description` + `FieldError` (invalid state hides Description). `variant="primary|secondary"` exists on Input/TextArea/Select/SearchField/NumberField/RadioGroup/TimeField.Group/Table; use `secondary` inside `Surface`.
- Closing overlays: `slot="close"` on a `Button` inside the overlay; controlled state via `isOpen`/`onOpenChange` on the **Backdrop** (Modal, Drawer) or root (Sheet, Popover, Select).
- Styling: BEM classes (`.modal__dialog`), data attributes (`data-hovered|pressed|focus-visible|disabled|selected|entering|exiting|placement`), `className` string or `(renderProps) => string`, `render` prop to swap the DOM element.
- Quick prop renames from Rezumi's Base UI wrappers: `open`->`isOpen`, `disabled`->`isDisabled`, `checked/onCheckedChange`->`isSelected/onChange`, `onValueChange`->`onChange`/`onSelectionChange`, `Tabs value`->`selectedKey` + `id`, `side`/`align`->`placement`, `sideOffset`->`offset`, `asChild`/`render={<X/>}`->children or `render` fn, `min/max`->`minValue/maxValue`, `onClick`->`onPress`.

## Contents

Part 1 components (alphabetical): list-box, meter, modal, number-field, pagination, popover, progress-bar, progress-circle, radio-group, range-calendar, scroll-shadow, search-field, select, separator, sheet (+ drawer + Pro sheet), skeleton, slider, spinner, surface, switch, table, tabs, tag-group, text-area, text-field, time-field, toast, toggle-button, toggle-button-group, toolbar, tooltip, typography. Part 2 theming/setup. Part 3 Rezumi tokens vs HeroUI. Part 4 `packages/ui` mapping + toast call shapes. Part 5 risks.

---

## Part 1 — Components (M–Z set)

### ListBox (`ListBox`, with `Label`, `Description`, `Header`)

Purpose: selectable option list; also the content of `Select.Popover`.
Anatomy: `ListBox` > [`ListBox.Item` > (`Label`, `Description`, `ListBox.ItemIndicator`), `ListBox.Section` > (`Header`, `ListBox.Item`)].
Props `ListBox`: `aria-label`/`aria-labelledby`, `selectionMode` `"none"|"single"|"multiple"` (single), `selectedKeys: Selection`, `defaultSelectedKeys`, `onSelectionChange(keys: Selection)`, `disabledKeys`, `onAction(key)`, `variant` `"default"|"danger"`, `className`, `render`. `ListBox.Item`: `id: Key`, `textValue`, `isDisabled`, `variant` `"default"|"danger"`, `className`, `children` (node or render fn with `isSelected,isFocused,isDisabled,isPressed`), `render` (link rendering via `href`). `ListBox.ItemIndicator`: `className`, `children` (render fn allowed). `ListBox.Section`: `className`.
Events: `onSelectionChange(keys: Selection)`, `onAction(key: Key)`.
Gotchas: `Selection` type is exported (`import type {Selection} from "@heroui/react"`); it is a `Set` (docs: `useState<Selection>(new Set(["1"]))`). Items need `textValue` when children are not plain text. Virtualization via React Aria `Virtualizer` + `ListLayout` (rowHeight 48 default). Classes `.list-box`, `.list-box-item`, `.list-box-item__indicator`, `.list-box-section`, `--default|--danger`; states `[data-selected]`, `[data-focus-visible]`, `[data-disabled]`.

```tsx
<ListBox aria-label="Users" selectionMode="multiple" selectedKeys={sel} onSelectionChange={setSel}>
  <ListBox.Item id="1" textValue="Bob">
    <Label>Bob</Label>
    <ListBox.ItemIndicator />
  </ListBox.Item>
</ListBox>
```

### Meter (`Meter`, with `Label`)

Purpose: quantity within known range (not task progress).
Anatomy: `Meter` (value) > [`Label`, `Meter.Output`, `Meter.Track` > `Meter.Fill`].
Props: `value` (0), `minValue` (0), `maxValue` (100), `size` `"sm"|"md"|"lg"` (md), `color` `"default"|"accent"|"success"|"warning"|"danger"` (accent), `formatOptions: Intl.NumberFormatOptions` (`{style:"percent"}`), `valueLabel`, `children` (node or render props `percentage`, `valueText`), `aria-label` when no `Label`.
Events: none (display only).
Gotchas: classes `.meter`, `__output|__track|__fill`, `--sm|md|lg`, `--default|accent|success|warning|danger`.

```tsx
<Meter value={60} color="success">
  <Label>Storage</Label>
  <Meter.Output />
  <Meter.Track>
    <Meter.Fill />
  </Meter.Track>
</Meter>
```

### Modal (`Modal`, `useOverlayState`)

Purpose: dialog overlay. Replaces `dialog.tsx`/`alert-dialog.tsx`-style modal use.
Anatomy: `Modal` > trigger (any `Button` child, or `Modal.Trigger`) + `Modal.Backdrop` > `Modal.Container` > `Modal.Dialog` > [`Modal.CloseTrigger`, `Modal.Header` (`Modal.Icon`, `Modal.Heading`), `Modal.Body`, `Modal.Footer`].
Props (state lives on **Backdrop**, not root):

- `Modal`: only `children` (trigger + container).
- `Modal.Backdrop`: `variant` `"opaque"|"blur"|"transparent"` (opaque), `isDismissable` bool (true), `isKeyboardDismissDisabled` bool (false), `isOpen`, `onOpenChange(isOpen)`, `className` (string or fn), `UNSTABLE_portalContainer: HTMLElement`.
- `Modal.Container`: `placement` `"auto"|"center"|"top"|"bottom"` (auto), `scroll` `"inside"|"outside"` (inside), `size` `"xs"|"sm"|"md"|"lg"|"cover"|"full"` (md).
- `Modal.Dialog`: `children` ReactNode or `({close}) => ReactNode`; `role` (dialog), `aria-label`, `aria-labelledby`, `aria-describedby`, `className`.
- `Modal.Header|Body|Footer|CloseTrigger|Trigger`: `children`, `className`.
- `useOverlayState({defaultOpen, onOpenChange})` -> `{isOpen, open(), close(), toggle(), setOpen()}`.
  Controlled: `<Modal.Backdrop isOpen={state.isOpen} onOpenChange={state.setOpen}>` used standalone (docs example has no `<Modal>` root when controlled). Also plain `useState` + `isOpen/onOpenChange`.
  Close: `slot="close"` on any `Button` inside the dialog closes it; or Dialog render prop `close`; `Modal.CloseTrigger` is the X button.
  Events: `Modal.Backdrop onOpenChange(isOpen)`; `useOverlayState({onOpenChange})`; `close()` in the `Modal.Dialog` render function; `slot="close"` buttons.
  Gotchas: use `onPress` not `onClick`. Overlay events: `[data-entering]`/`[data-exiting]`, `[data-placement]`. Classes: `.modal__backdrop`, `.modal__container`, `.modal__dialog`, `.modal__header/body/footer`, `.modal__close-trigger`; backdrop `--opaque|--blur|--transparent`; scroll `.modal__dialog--scroll-inside`, `.modal__container--scroll-outside`. Body scroll locked, focus trapped, ESC closes (unless `isKeyboardDismissDisabled`). Sizing example uses `className="sm:max-w-[360px]"` on Dialog.

```tsx
const state = useOverlayState();
<Button onPress={state.open}>Open</Button>
<Modal.Backdrop isOpen={state.isOpen} onOpenChange={state.setOpen}>
  <Modal.Container>
    <Modal.Dialog className="sm:max-w-[360px]">
      <Modal.CloseTrigger />
      <Modal.Header><Modal.Heading>Title</Modal.Heading></Modal.Header>
      <Modal.Body><p>Body</p></Modal.Body>
      <Modal.Footer><Button slot="close" variant="secondary">Cancel</Button><Button slot="close">OK</Button></Modal.Footer>
    </Modal.Dialog>
  </Modal.Container>
</Modal.Backdrop>
```

### NumberField (`NumberField`)

Purpose: numeric input with stepper buttons, Intl formatting (React Aria NumberField).
Anatomy: `NumberField` > [`Label`, `NumberField.Group` > (`NumberField.DecrementButton`, `NumberField.Input`, `NumberField.IncrementButton`), `Description`, `FieldError`].
Props: `variant` `"primary"|"secondary"` (primary; set on the field), `fullWidth`, `value: number`, `defaultValue`, `onChange(value: number | undefined)`, `minValue`, `maxValue`, `step` (1), `formatOptions` (currency/percent/unit), `locale`, `isRequired`, `isInvalid`, `validate(value:number)`, `validationBehavior`, `validationErrors`, `isDisabled`, `isReadOnly`, `name`, `autoFocus`, aria props. `IncrementButton`/`DecrementButton`: `children` (default `IconPlus`/`IconMinus`), `className`, `slot` auto. `NumberField.Input`: `className`, `variant`.
Events: `onChange(value: number | undefined)`.
Gotchas: `onChange` can emit `undefined` (cleared field). Percent format uses fractions (`minValue={0} maxValue={1} step={0.1}`). Width is set on `NumberField.Input` (docs use `className="w-[120px]"`). Classes `.number-field`, `__group|__input|__increment-button|__decrement-button`, `--primary|--secondary`.

```tsx
<NumberField minValue={0} name="width" value={w} onChange={setW}>
  <Label>Width</Label>
  <NumberField.Group>
    <NumberField.DecrementButton />
    <NumberField.Input className="w-[120px]" />
    <NumberField.IncrementButton />
  </NumberField.Group>
</NumberField>
```

### Pagination (`Pagination`)

Purpose: composable page nav (presentational; you compute pages/ellipsis).
Anatomy: `Pagination` > [`Pagination.Summary`, `Pagination.Content` > `Pagination.Item` > (`Pagination.Link` | `Pagination.Previous` (+`PreviousIcon`) | `Pagination.Next` (+`NextIcon`) | `Pagination.Ellipsis`)].
Props: `Pagination`: `size` `"sm"|"md"|"lg"` (md), `className`. `Pagination.Link`: `isActive`, `isDisabled`, `onPress`, `className`. `Previous`/`Next`: `isDisabled`, `onPress`. `PreviousIcon`/`NextIcon`: `children` to replace chevron. `Summary`, `Content`, `Item`, `Ellipsis`: `className`.
Events: `Pagination.Link|Previous|Next onPress(e: PressEvent)`.
Gotchas: **no `page`/`total` props** — controlled demo hand-builds page numbers with `useState`; handlers are `onPress` not `onClick`. Renders `<nav aria-label="pagination">`; active page `aria-current="page"`. Classes `.pagination`, `__summary|__content|__item|__link|__link--nav|__ellipsis`, `--sm|md|lg`.

```tsx
<Pagination>
  <Pagination.Content>
    <Pagination.Item>
      <Pagination.Previous isDisabled={page === 1} onPress={() => setPage(page - 1)}>
        <Pagination.PreviousIcon />
      </Pagination.Previous>
    </Pagination.Item>
    <Pagination.Item>
      <Pagination.Link isActive onPress={() => setPage(1)}>
        1
      </Pagination.Link>
    </Pagination.Item>
  </Pagination.Content>
</Pagination>
```

### Popover (`Popover`)

Purpose: rich content in portal anchored to a trigger.
Anatomy: `Popover` > `Popover.Trigger` (or a bare `Button` child, as in the basic demo) + `Popover.Content` > [`Popover.Arrow`, `Popover.Dialog` > [`Popover.Heading`, content]].
Props:

- `Popover`: `isOpen`, `defaultOpen` (false), `onOpenChange(isOpen)`, `children`.
- `Popover.Content`: `placement` `"top"|"bottom"|"left"|"right"` and variants (bottom), `offset` number (8), `shouldFlip` bool (true), `className`, `render`.
- `Popover.Dialog`: `children`, `className`. `Popover.Trigger`: `children`, `className` (example passes `aria-label`). `Popover.Arrow`: `children`, `className`, `render`.
  Events: `Popover onOpenChange(isOpen)`.
  Docs: a `Button` is the direct trigger child in the basic demo; `Popover.Trigger aria-label` wraps non-button content (avatar + text card).
  Gotchas: content must be wrapped in `Popover.Dialog` (focus/aria); `Popover.Heading` gives the dialog title. Classes `.popover`, `.popover__dialog`, `.popover__heading`, `.popover__trigger`. States `[data-entering]`, `[data-exiting]`, `[data-placement]`.

```tsx
<Popover>
  <Button>Click me</Button>
  <Popover.Content className="max-w-64">
    <Popover.Dialog>
      <Popover.Heading>Title</Popover.Heading>
      <p className="mt-2 text-sm text-muted">Body</p>
    </Popover.Dialog>
  </Popover.Content>
</Popover>
```

### ProgressBar (`ProgressBar`, with `Label`)

Purpose: determinate/indeterminate linear progress.
Anatomy: `ProgressBar` > [`Label`, `ProgressBar.Output`, `ProgressBar.Track` > `ProgressBar.Fill`].
Props: `value` (0), `minValue` (0), `maxValue` (100), `isIndeterminate` (false), `size` `"sm"|"md"|"lg"` (md), `color` `"default"|"accent"|"success"|"warning"|"danger"` (accent), `formatOptions` (`{style:'percent'}`), `valueLabel`, `children` (node or render props `percentage,valueText,isIndeterminate`), `aria-label` if no `Label`.
Events: none (display only).
Gotchas: `Output` and `Label` are optional; track/fill required. Classes `.progress-bar`, `__output|__track|__fill`, `--sm|md|lg`, `--default|accent|success|warning|danger`.

```tsx
<ProgressBar aria-label="Upload" value={60} size="sm">
  <ProgressBar.Track>
    <ProgressBar.Fill />
  </ProgressBar.Track>
</ProgressBar>
```

### ProgressCircle (`ProgressCircle`)

Purpose: circular progress.
Anatomy: `ProgressCircle` (needs `aria-label`) > `ProgressCircle.Track` > [`ProgressCircle.TrackCircle`, `ProgressCircle.FillCircle`]. Each part is an SVG element; `strokeWidth`, `r`, `cx`, `cy`, `viewBox` can be overridden directly.
Props: `value` (0), `minValue`, `maxValue` (100), `isIndeterminate`, `size` `"sm"|"md"|"lg"` (md), `color` same as bar (accent), `formatOptions`, `children` (node or render props).
Events: none (display only).
Gotchas: classes `.progress-circle`, `__track|__track-circle|__fill-circle`, `--sm|md|lg`, color classes.

```tsx
<ProgressCircle aria-label="Loading" isIndeterminate size="sm">
  <ProgressCircle.Track>
    <ProgressCircle.TrackCircle />
    <ProgressCircle.FillCircle />
  </ProgressCircle.Track>
</ProgressCircle>
```

### RadioGroup (`RadioGroup`, `Radio`)

Purpose: single choice list.
Anatomy: `RadioGroup` > [`Label`, `Description`, `Radio value="…"` > (`Radio.Content` > (`Radio.Control` > `Radio.Indicator`, label text), `Description`, `FieldError`), `FieldError`]. `Radio.Content` is the clickable `<label>`; per-radio `Description` is a SIBLING of `Radio.Content`.
Props `RadioGroup`: `value: string`, `defaultValue`, `onChange(value: string)`, `isDisabled`, `isRequired`, `isReadOnly`, `isInvalid`, `variant` `"primary"|"secondary"` (primary), `name`, `orientation` `'horizontal'|'vertical'` (vertical), `children`/`render` (render props). `Radio`: `value`, `isDisabled`, `name`, `children` (node or `RadioFieldRenderProps`: `isSelected,isDisabled,isReadOnly,isInvalid,isRequired`). `Radio.Control`/`Radio.Indicator`: span props, `children` (render props `isHovered,isPressed,isFocusVisible…`). `Radio.Content`: `children` (node or render fn), `className` accepts fn.
Events: `RadioGroup onChange(value: string)`.
Gotchas: `onChange` receives the string (not event). Verbose composition: a plain radio requires `Radio > Radio.Content > Radio.Control > Radio.Indicator` + text. For HTML form, set `name` on the group. Disabled has no `.radio--disabled` class; use `[data-disabled]`. Classes `.radio-group`, `.radio`, `.radio__content|control|indicator`.

```tsx
<RadioGroup name="plan" value={plan} onChange={setPlan}>
  <Label>Plan</Label>
  <Radio value="starter">
    <Radio.Content>
      <Radio.Control>
        <Radio.Indicator />
      </Radio.Control>
      Starter
    </Radio.Content>
  </Radio>
  <Radio value="pro">
    <Radio.Content>
      <Radio.Control>
        <Radio.Indicator />
      </Radio.Control>
      Pro
    </Radio.Content>
  </Radio>
</RadioGroup>
```

### RangeCalendar (`RangeCalendar`)

Purpose: date-range month grid (React Aria RangeCalendar); uses `@internationalized/date` types (`DateValue`, `CalendarDate`, `parseDate`, `today`, `getLocalTimeZone`).
Anatomy: `RangeCalendar` (aria-label) > [`RangeCalendar.Header` > (`Heading`, `NavButton slot="previous"`, `NavButton slot="next"`), `RangeCalendar.Grid` > (`GridHeader` with `(day) => <HeaderCell>`, `GridBody` with `(date) => <Cell date={date}/>`)]. Extras: `CellIndicator`, `YearPickerTrigger/…Heading/…Indicator`, `YearPickerGrid` (`format`, `visibleYears`), `YearPickerGridBody`, `YearPickerCell`.
Props: `value: RangeValue<DateValue>|null`, `defaultValue`, `onChange(range)`, `focusedValue`, `onFocusChange`, `minValue` (1900-01-01), `maxValue` (2099-12-31), `weeksInMonth`, `isDateUnavailable(date, anchorDate)`, `firstDayOfWeek` `'sun'..'sat'`, `pageBehavior` `'visible'|'single'`, `selectionAlignment`, `allowsNonContiguousRanges`, `isDisabled`, `isReadOnly`, `isInvalid`, `visibleDuration` `{months|weeks|days}` (`{months:1}`), `defaultYearPickerOpen`, `isYearPickerOpen`, `onYearPickerOpenChange`. `Heading`/`Grid`: `offset` for multi-month.
Events: `onChange(range)`, `onFocusChange(date)`, `onYearPickerOpenChange(isOpen)`.
Gotchas: requires `@internationalized/date`; `onChange` returns dates in the calendar system of `value` (Gregorian default); use `I18nProvider` to change calendar. States `[data-selection-start|end|in-range|today|unavailable|outside-month]`. Classes `.range-calendar*`, `.calendar-year-picker__*`.

```tsx
<RangeCalendar aria-label="Trip" value={range} onChange={setRange}>
  <RangeCalendar.Header>
    <RangeCalendar.Heading />
    <RangeCalendar.NavButton slot="previous" />
    <RangeCalendar.NavButton slot="next" />
  </RangeCalendar.Header>
  <RangeCalendar.Grid>
    <RangeCalendar.GridHeader>
      {(d) => <RangeCalendar.HeaderCell>{d}</RangeCalendar.HeaderCell>}
    </RangeCalendar.GridHeader>
    <RangeCalendar.GridBody>{(date) => <RangeCalendar.Cell date={date} />}</RangeCalendar.GridBody>
  </RangeCalendar.Grid>
</RangeCalendar>
```

### ScrollShadow (`ScrollShadow`)

Purpose: scroll container with edge fade (mask) that auto-detects scroll position. Single element.
Props: `orientation` `"vertical"|"horizontal"` (vertical), `variant` `"fade"`, `size` px (40), `offset` px (0), `hideScrollBar` (false), `isEnabled` (true), `visibility` `"auto"|"both"|"top"|"bottom"|"left"|"right"|"none"` (auto; controlled), `onVisibilityChange(v)`, `className`, `children`.
Events: `onVisibilityChange(visibility)`.
Gotchas: give it a bounded size via className (`max-h-[240px]`). In `auto` mode the root always has `mask-image` (creates stacking context/containing block for `position: fixed` descendants; set `visibility` explicitly to opt out). Uses CSS `animation` on root: do NOT put `animate-*` utilities on it, animate a wrapper. Vars `--scroll-shadow-size` (40px), `--scroll-shadow-offset` (0px), `--scroll-shadow-scrollbar-size` (10px; 0 with `hideScrollBar`). Data attrs `[data-top-scroll]` etc, `[data-orientation]`. Classes `.scroll-shadow`, `--vertical|--horizontal`, `--hide-scrollbar`.

```tsx
<ScrollShadow className="max-h-[240px] p-4" size={80} hideScrollBar>
  {long}
</ScrollShadow>
```

### SearchField (`SearchField`)

Purpose: search input with icon + clear button (React Aria SearchField).
Anatomy: `SearchField` > [`Label`, `SearchField.Group` > (`SearchField.SearchIcon`, `SearchField.Input`, `SearchField.ClearButton`), `Description`, `FieldError`].
Props: `variant` `"primary"|"secondary"` (primary), `fullWidth` (false), `value`/`defaultValue`/`onChange(value:string)`, `isRequired`, `isInvalid`, `validate`, `validationBehavior`, `validationErrors`, `isDisabled`, `isReadOnly`, `name`, `autoFocus`, `onSubmit(value)` (Enter), `onClear()`, a11y aria props, `children`/`className`/`style` (render-prop capable). `SearchField.Input`: `variant`, `placeholder`, `type` ("search"), `className`. `SearchField.SearchIcon`: `children` (default `<IconSearch/>`), `className`. `SearchField.ClearButton`: `children`, `className`, `slot="clear"` (auto). Render props add `value`, `isEmpty`.
Events: `onChange(value)`, `onSubmit(value)` (Enter key), `onClear()`.
Gotchas: clear button hidden when empty (`[data-empty]`); description hidden when invalid. Classes `.search-field`, `__group|__input|__search-icon|__clear-button`, `--primary|--secondary`.

```tsx
<SearchField name="q" value={q} onChange={setQ} onClear={() => setQ("")}>
  <Label>Search</Label>
  <SearchField.Group>
    <SearchField.SearchIcon />
    <SearchField.Input placeholder="Search…" />
    <SearchField.ClearButton />
  </SearchField.Group>
</SearchField>
```

### Select (`Select`, with `Label`, `Description`, `ListBox`)

Purpose: collapsible option list; single or multiple. Items are `ListBox.Item` (see List Box).
Anatomy: `Select` > [`Label`, `Select.Trigger` > [`Select.Value`, `Select.ClearButton`, `Select.Indicator`], `Description`, `Select.Popover` > `ListBox` > [`ListBox.Item` > (`Label`, `Description`, `ListBox.ItemIndicator`), `ListBox.Section` > (`Header`, `ListBox.Item`)]]. `Separator` also importable.
Props `Select`: `placeholder` string ("Select an item"), `selectionMode` `"single"|"multiple"` (single), `isOpen`/`defaultOpen`/`onOpenChange`, `disabledKeys: Iterable<Key>`, `isDisabled`, `value: Key|Key[]|null`, `defaultValue`, `onChange(value: Key|Key[]|null)`, `onClear()`, `isRequired`, `isInvalid`, `name`, `autoComplete`, `fullWidth` (false), `variant` `"primary"|"secondary"` (primary; secondary = no shadow, for Surface), `className`, `children` (node or render fn), `render`.
`Select.Popover`: `placement` (bottom, many variants), `className`. `Select.Value` render props: `defaultChildren`, `isPlaceholder`, `state`, `selectedItems`. `Select.ClearButton`: renders a `span` (not focusable, `aria-hidden`); `onClick`; Backspace/Delete on trigger also clears; both call `onClear`.
Events: `onChange(value: Key | Key[] | null)`, `onOpenChange(isOpen)`, `onClear()`, `Select.ClearButton onClick`.
Docs patterns: `ListBox.Section` > `Header` + items with a `Separator` between sections; `disabledKeys={["cat","kangaroo"]}`; async loading via `useAsyncList` + `<Collection items={list.items}>{(item) => <ListBox.Item id textValue>…}</Collection>`; `Select.Value` accepts a render function (`defaultChildren`, `isPlaceholder`, `state`, `selectedItems`) for custom value display (avatar + name demo); `Select.Indicator` accepts children for a custom icon; `isOpen/onOpenChange` for controlled open.
Gotchas: **No native `<option>`**; items need `id` and `textValue` (`<ListBox.Item id="x" textValue="X">X<ListBox.ItemIndicator/></ListBox.Item>`). Multiple mode needs `selectionMode="multiple"` on BOTH `Select` and the inner `ListBox`; `value` is `Key[]` (`onChange={(keys)=>set(keys as Key[])}`). `Key` type is exported from `@heroui/react`. Form: `name` posts to HTML form. Classes `.select`, `.select__trigger`, `.select__value`, `.select__indicator`, `.select__popover`, `.select--primary|--secondary`; states `[data-invalid]`, `[data-open]` on indicator, `[data-placeholder]` on value.

```tsx
<Select className="w-64" placeholder="Pick" value={v} onChange={(k) => setV(k as Key | null)}>
  <Label>State</Label>
  <Select.Trigger>
    <Select.Value />
    <Select.Indicator />
  </Select.Trigger>
  <Select.Popover>
    <ListBox>
      <ListBox.Item id="ca" textValue="California">
        California
        <ListBox.ItemIndicator />
      </ListBox.Item>
    </ListBox>
  </Select.Popover>
</Select>
```

### Separator (`Separator`)

Purpose: visual divider. Single element, no sub-parts.
Props: `orientation` `'horizontal'|'vertical'` (horizontal), `variant` `'default'|'secondary'|'tertiary'` (default; contrast levels), `isDecorative` (false; renders `aria-hidden` div, drops separator semantics), `className`, `render`.
Events: none.
Gotchas: vertical needs a parent with height (flex row). Classes `.separator`, `--horizontal|--vertical`, `--default|--secondary|--tertiary`. Replaces shadcn `Separator` almost 1:1 (`orientation` same; `decorative` -> `isDecorative`).

```tsx
<Separator className="my-4" />
<div className="flex h-5 items-center gap-3">A<Separator orientation="vertical" />B</div>
```

### Sheet vs Drawer vs Pro Sheet

Three overlay-panel components exist. `get_component_docs("sheet")` returns the **Pro** page (`import {Sheet} from "@heroui-pro/react"`), `get_docs("/docs/react/components/sheet")` is refused, so the OSS `Sheet` below is documented from `get_component_source_code("sheet")` (v3 source) and confirmed present in installed `@heroui/react@3.2.7` (`dist/components/sheet`, exported via `components/index.d.ts`). Treat OSS Sheet prop list as source-derived, not docs-derived.

**OSS `Sheet` (`@heroui/react`, source-verified)** — built on `react-aria-components/Sheet`; swipe-to-dismiss, snap points, nested sheets.

- Anatomy: `Sheet` > [`Sheet.Trigger` (single pressable child; if present it controls open via React Aria trigger), `Sheet.Backdrop` > `Sheet.Content` > `Sheet.Dialog` > [`Sheet.Handle` (optional grabber; renders default bar), `Sheet.CloseTrigger` (CloseButton, closes sheet), `Sheet.Header` > `Sheet.Heading`, `Sheet.Body`, `Sheet.Footer` > `Sheet.Close` (single pressable child, closes)]]. Also `Sheet.NestedRoot` (must be inside another Sheet, else throws).
- `Sheet` props (`SheetRootProps`): `isOpen`, `defaultOpen` (false), `onOpenChange(open)`, `onClose()`, `onAnimationEnd(open)`, `isDismissable` (true; click outside or swipe), `placement` (`SheetPlacement`, default `"bottom"`; **set on root, not on Content**), `snapPoints: Array<number|string>` (px numbers or CSS lengths; opens at first; trailing `1`/`"100%"` ignored), `isDetached` (false), `isNested` (internal).
- `Sheet.Backdrop`: `variant` (default `"opaque"`; docs variants opaque|blur|transparent), `isExiting` (keep mounted while closed), `className`, plus RAC ModalOverlay props except open/position/snapPoints/preventDismissal. `Sheet.Content`/`Dialog`/`Header`/`Body`/`Footer`: `className`, plain div or RAC props. `Sheet.Heading`: RAC Heading, default `slot="title"`. `Sheet.CloseTrigger`: CloseButton props.
- Events: OSS `onOpenChange(open)`, `onClose()`, `onAnimationEnd(open)`; Drawer `Drawer.Backdrop onOpenChange(isOpen)`; Pro also `onDrag`, `onRelease`, `onActiveSnapPointChange`.
- Not in OSS source (Pro-only): `isHandleOnly`, `fadeFromIndex`, `closeThreshold`, `shouldScaleBackground`, `onDrag`, `onRelease`, `shouldAutoFocus`, `isModal`, `activeSnapPoint/onActiveSnapPointChange`, `Handle.preventCycle`.
- Wraps dialog in `SurfaceContext variant="default"`; Dialog has `data-placement`.

**OSS `Drawer` (`@heroui/react`, docs-verified)** — RAC-Modal-based slide-out panel.

- Anatomy: `Drawer` > trigger (Button child or `Drawer.Trigger`) + `Drawer.Backdrop` > `Drawer.Content` > `Drawer.Dialog` > [`Drawer.Handle`, `Drawer.CloseTrigger`, `Drawer.Header` > `Drawer.Heading`, `Drawer.Body`, `Drawer.Footer`].
- Props: `Drawer`: `children`, `state: UseOverlayStateReturn`. `Drawer.Backdrop`: `variant`, `isDismissable` (true; false blocks backdrop click and drag), `isKeyboardDismissDisabled`, `isOpen`, `onOpenChange`, `className`. **`Drawer.Content`: `placement` `"top"|"bottom"|"left"|"right"` default `"bottom"`**, `className`. `Drawer.Dialog`: `role`, `aria-label`, `aria-labelledby`. `slot="close"` on a `Button` closes. Body scrolls natively; drag-to-dismiss on handle, header, footer only.
- Classes `.drawer__backdrop|content|dialog|header|heading|body|footer|handle|close-trigger`, `.drawer__content--bottom|top|left|right`.

**Pro `Sheet` (`@heroui-pro/react`, docs-verified)** — OSS Sheet anatomy plus: root `isModal`, `isHandleOnly` (false), `activeSnapPoint`, `onActiveSnapPointChange`, `fadeFromIndex` (last snap index), `closeThreshold` (0.25), `shouldScaleBackground` (false), `onDrag(event, pct)`, `onRelease(event, open)`, `shouldAutoFocus` (false); `Sheet.Handle preventCycle`. Classes `.sheet__*`; vars `--sheet-backdrop-opacity`, `--initial-transform`, `--snap-point-height`. Pro import: `@heroui-pro/react`.

Choice for Rezumi (derived from the three APIs above): OSS `Sheet` covers side + bottom sheets with swipe and `Sheet.Handle`; it replaces `sheet.tsx` (Base UI Drawer) without needing Pro. `Drawer` is the simpler, docs-complete alternative but its swipe is limited to handle/header/footer and `placement` lives on `Content`.

```tsx
<Sheet isOpen={open} onOpenChange={setOpen} placement="right">
  <Sheet.Backdrop>
    <Sheet.Content>
      <Sheet.Dialog>
        <Sheet.CloseTrigger />
        <Sheet.Header>
          <Sheet.Heading>Share</Sheet.Heading>
        </Sheet.Header>
        <Sheet.Body>…</Sheet.Body>
        <Sheet.Footer>
          <Sheet.Close>
            <Button>Done</Button>
          </Sheet.Close>
        </Sheet.Footer>
      </Sheet.Dialog>
    </Sheet.Content>
  </Sheet.Backdrop>
</Sheet>
```

### Skeleton (`Skeleton`)

Purpose: loading placeholder block; size/shape entirely by `className`.
Props: `animationType` `"shimmer"|"pulse"|"none"` (shimmer, or global `--skeleton-animation` CSS var: `:root{--skeleton-animation:pulse}`; also per `.light/.dark`), `className`.
Events: none.
Gotchas: no width/height props; use Tailwind (`h-3 w-3/5 rounded-lg`). "Single shimmer" pattern: parent gets class `skeleton--shimmer relative overflow-hidden`, children get `animationType="none"`. Classes `.skeleton`, `--shimmer|--pulse|--none`. Shimmer uses theme `--animate-skeleton: skeleton 2s linear infinite` and `via-surface-3`.

```tsx
<div className="flex flex-col gap-2">
  <Skeleton className="h-4 w-full rounded" />
  <Skeleton className="h-4 w-5/6 rounded" animationType="pulse" />
</div>
```

### Slider (`Slider`, with `Label`)

Purpose: single or range value slider (React Aria Slider).
Anatomy: `Slider` > [`Label`, `Slider.Output`, `Slider.Track` > (`Slider.Fill`, `Slider.Steps` optional, `Slider.Thumb` (one per value)), `Slider.Marks` > `Slider.Mark value={n}` (optional, sibling after Track)].
Props `Slider`: `value: number|number[]`, `defaultValue`, `onChange(value: number|number[])`, `onChangeEnd(value)`, `minValue` (0), `maxValue` (100), `step` (1), `formatOptions`, `orientation` `"horizontal"|"vertical"`, `isDisabled`, `aria-label`, `aria-labelledby`, `className`, `children`/`render`. `Slider.Thumb`: `index` (0), `isDisabled`, `name`, `className`. `Slider.Mark`: `value` (required), `children`. `Slider.Output`/`Track`: `className`, `children` (render props `state,values,getThumbValueLabel,orientation,isDisabled`).
Events: `onChange(value)` (continuous), `onChangeEnd(value)` (drag end).
Gotchas: **`onChange` type is `number | number[]`** — narrow with `typeof v === "number"` (docs pattern); not `number[]` like Radix/shadcn. Range slider = array `value` + two `Slider.Thumb index={0|1}` (shown in "Range Slider Anatomy"; markup not in filtered docs). Vertical sliders need a container with defined height. `Slider.Output` shows formatted value; omit it to hide. Classes `.slider`, `__output|__track|__fill|__thumb|__steps|__step|__marks|__mark`.

```tsx
<Slider
  className="w-full max-w-xs"
  minValue={0}
  maxValue={100}
  value={v}
  onChange={(n) => typeof n === "number" && setV(n)}
>
  <Label>Volume</Label>
  <Slider.Output />
  <Slider.Track>
    <Slider.Fill />
    <Slider.Thumb />
  </Slider.Track>
</Slider>
```

### Spinner (`Spinner`)

Purpose: pending indicator.
Props: `size` `"sm"|"md"|"lg"|"xl"` (md), `color` `"current"|"accent"|"success"|"warning"|"danger"` (accent), `className`.
Events: none.
Gotchas: no `aria-label` prop listed; speed via Tailwind animation utility (`motion-reduce:animate-none` recommended). `color="current"` inherits text colour (use inside buttons). Classes `.spinner`, `--sm|md|lg|xl`, `--current|accent|danger|success|warning`.

```tsx
<Spinner size="sm" color="current" />
```

### Surface (`Surface`)

Purpose: background container that gives children (inputs, selects, etc.) context so they pick the "secondary" look; also the HeroUI "card-like panel" primitive.
Props: `variant` `"transparent"|"default"|"secondary"|"tertiary"` (default -> `bg-surface`, `bg-surface-secondary`, `bg-surface-tertiary`), `className`, `children`. Exposes `SurfaceContext` to read the current variant.
Events: none.
Gotchas: inside a Surface, set `variant="secondary"` on `Input`/`TextArea`/`Select`/`SearchField`/`NumberField`/`RadioGroup` (they otherwise render `primary` with shadow). Corner radius is NOT set by Surface (docs examples add `rounded-3xl p-6`). Classes `.surface`, `--default|--secondary|--tertiary`.

```tsx
<Surface className="flex flex-col gap-4 rounded-3xl p-6" variant="default">
  <Input variant="secondary" />
</Surface>
```

### Switch (`Switch`, `SwitchGroup`)

Purpose: boolean toggle (React Aria Switch).
Anatomy: `Switch` > [`Switch.Control` > `Switch.Thumb` > `Switch.Icon` (optional), `Switch.Content` > (`Label`, `Description`)]. Docs also show `<Switch><Switch.Control><Switch.Thumb/></Switch.Control><Label/></Switch>` inside `SwitchGroup`; Controlled/Form demos nest `Switch.Control` inside `Switch.Content` with label text. Follow Anatomy; both render.
Props `Switch`: `size` `'sm'|'md'|'lg'` (md), `isSelected` (false), `defaultSelected`, `isDisabled`, `isInvalid`, `isReadOnly`, `isRequired`, `validate(value:boolean)`, `validationBehavior` `'native'|'aria'` (native), `name`, `value` (string), `onChange(isSelected: boolean)`, `onPress(e)`, `children` (node or render fn with `isSelected,isHovered,isPressed,isFocused,isFocusVisible,isDisabled,isReadOnly,isInvalid,isRequired,state`), `render`.
`SwitchGroup`: `orientation` `'horizontal'|'vertical'` (vertical), `children`, `className`.
Events: `onChange(isSelected: boolean)`, `onPress(e: PressEvent)`.
Docs demos (Controlled, Form, Label Position, Group) all put the label as plain text INSIDE `Switch.Content`, next to `Switch.Control`: `<Switch><Switch.Content><Switch.Control><Switch.Thumb/></Switch.Control>Label after</Switch.Content></Switch>`; label before the control = put text before `Switch.Control`. `SwitchGroup` horizontal: `<SwitchGroup orientation="horizontal" className="overflow-x-auto">`.
Gotchas: handler is `onChange(boolean)` (not `onCheckedChange`); `isSelected` not `checked`. Classes `.switch`, `.switch__content|control|thumb|icon`, `.switch--sm|md|lg`, `.switch-group`; state `[data-selected="true"]`.

```tsx
<Switch isSelected={on} onChange={setOn} name="notify">
  <Switch.Control>
    <Switch.Thumb />
  </Switch.Control>
  <Switch.Content>
    <Label>Enable notifications</Label>
  </Switch.Content>
</Switch>
```

### Table (`Table`)

Purpose: React Aria table with sorting, selection, resizing, expandable rows, virtualization, load-more; can be a rendering layer for TanStack Table.
Anatomy: `Table` > [`Table.ScrollContainer` > `Table.Content` (aria-label) > (`Table.Header` > `Table.Column`; `Table.Body` > `Table.Row` > `Table.Cell`), `Table.Footer`]. Extras: `Table.ResizableContainer` + `Table.ColumnResizer`, `Table.LoadMore` + `Table.LoadMoreContent`, `Table.Collection`, `Table.SortableColumnHeader`, `TableLayout` (virtualizer layout: rowHeight 48, headingHeight 48, loaderHeight 48, gap 0, padding 0).
Props: `Table`: `variant` `"primary"|"secondary"` (primary = gray container with card-style body; secondary = flat), `className`. `Table.Content`: `aria-label`, `selectionMode` `"none"|"single"|"multiple"` (none), `selectedKeys: Selection`, `onSelectionChange(keys)`, `sortDescriptor`, `onSortChange(descriptor)`; docs also mention `treeColumn`, `expandedKeys` (expandable rows). `Table.Header`: `columns`, `children` (static or `(column)=>node`). `Table.Column`: `id`, `allowsSorting` (false), `isRowHeader`, `defaultWidth`, `minWidth`, `children` (node or render props with `sortDirection`). `Table.Body`: `items`, `renderEmptyState()`, `children`. `Table.Row`: `id`, `className`. `Table.Cell`: `className`. `Table.SortableColumnHeader`: `sortDirection`, `showIndicator` (true), `indicator`, `className`. `Table.LoadMore`: `isLoading`, `onLoadMore`. `Table.Footer`: slot for pagination.
Events: `Table.Content onSelectionChange(keys: Selection)`, `onSortChange(descriptor: SortDescriptor)`, `Table.LoadMore onLoadMore()`; expanded rows are controlled with `expandedKeys` (change handler not shown in the filtered docs).
Docs demos: row selection = `Table.Content selectionMode="multiple" selectedKeys onSelectionChange` + first column with `<Checkbox slot="selection" aria-label="Select all"><Checkbox.Content><Checkbox.Control><Checkbox.Indicator/></Checkbox.Control></Checkbox.Content></Checkbox>` in header and each row; rows use `Table.Row id={number}`; sorting = `useState<SortDescriptor>({column, direction: "ascending"})` + sorted data (sort is YOURS) + `sortDescriptor`/`onSortChange` on `Table.Content` + `allowsSorting` on `Table.Column`; empty state = `<Table.Body renderEmptyState={() => <EmptyState …/>}>{[]}</Table.Body>`; `className="min-w-[600px]"` on `Table.Content`; TanStack Table works as the data layer.
Gotchas: root class is `.table-root` (not `.table`, to avoid Tailwind `table` utility). Selection checkboxes: `Checkbox slot="selection"`; expand chevron: `Button slot="chevron"`. Selection state attr `[data-selected]`; `[data-allows-sorting]`. Footer sits outside `<table>` (use for `Pagination`). No `Table.Head/Th/Td` names; it is `Header/Column/Row/Cell`.

```tsx
<Table>
  <Table.ScrollContainer>
    <Table.Content aria-label="Resumes">
      <Table.Header>
        <Table.Column isRowHeader>Name</Table.Column>
        <Table.Column>Role</Table.Column>
      </Table.Header>
      <Table.Body renderEmptyState={() => "No data"}>
        <Table.Row id="1">
          <Table.Cell>Kate</Table.Cell>
          <Table.Cell>CEO</Table.Cell>
        </Table.Row>
      </Table.Body>
    </Table.Content>
  </Table.ScrollContainer>
</Table>
```

### Tabs (`Tabs`)

Purpose: tabbed navigation (React Aria Tabs).
Anatomy: `Tabs` > [`Tabs.ListContainer` > `Tabs.List` (needs `aria-label`) > `Tabs.Tab` > (`Tabs.Separator` optional, `Tabs.Indicator`)], then `Tabs.Panel` per tab (siblings of ListContainer).
Props `Tabs`: `variant` `"primary"|"secondary"` (primary = filled indicator; secondary = underline), `orientation` `"horizontal"|"vertical"`, `align` `"start"|"center"|"end"` (center), `selectedKey: string`, `defaultSelectedKey`, `onSelectionChange(key: Key)`, `className`, `render`. `Tabs.List`: `aria-label`, `className`, `render`. `Tabs.Tab`: `id`, `isDisabled`, `className`. `Tabs.Panel`: `id` (matches tab id), `className`. `Tabs.Separator`: `className` (place inside each Tab except first).
Events: `Tabs onSelectionChange(key: Key)`.
Link tabs (docs "Render Function"): `<Tabs.Tab id="x" href="/path" render={(domProps) => <Link {...domProps} />}>…<Tabs.Indicator /></Tabs.Tab>` — the client-router integration point for TanStack Router `Link`; `Tabs` itself also takes `render`.
Gotchas: `Tabs.ListContainer` auto-renders scroll chevrons + fading edges on overflow. Parts are `Tab`/`Panel` (not Trigger/Content). Classes `.tabs`, `.tabs__list-container`, `.tabs__list`, `.tabs__tab`, `.tabs__indicator`, `.tabs__panel`, `.tabs--secondary`, `.tabs--align-start|end`; state `[aria-selected="true"]`.

```tsx
<Tabs selectedKey={tab} onSelectionChange={(k) => setTab(String(k))}>
  <Tabs.ListContainer>
    <Tabs.List aria-label="Sections">
      <Tabs.Tab id="a">
        Alpha
        <Tabs.Indicator />
      </Tabs.Tab>
      <Tabs.Tab id="b">
        Beta
        <Tabs.Separator />
        <Tabs.Indicator />
      </Tabs.Tab>
    </Tabs.List>
  </Tabs.ListContainer>
  <Tabs.Panel id="a">A</Tabs.Panel>
  <Tabs.Panel id="b">B</Tabs.Panel>
</Tabs>
```

### TagGroup (`TagGroup`, `Tag`)

Purpose: focusable list of tags with selection and removal.
Anatomy: `TagGroup` > [`Label`, `TagGroup.List` > `Tag` (`id`) > `Tag.RemoveButton`, `Description`, `ErrorMessage`] (anatomy lists `ErrorMessage`).
Props `TagGroup`: `selectionMode` `"none"|"single"|"multiple"` (none), `selectedKeys: Selection`, `defaultSelectedKeys`, `onSelectionChange(keys)`, `disabledKeys`, `isDisabled`, `onRemove(keys: Set<Key>)`, `size` `"sm"|"md"|"lg"` (md), `variant` `"default"|"surface"`, `className`, `children`, `render`. `TagGroup.List`: `items`, `renderEmptyState()`, `className`, `children` (fn). `Tag`: `id: Key`, `textValue`, `isDisabled`, `className`, `children` (node or render props; `allowsRemoving` exposed). `Tag.RemoveButton`: `className`, `children` (default close icon).
Events: `onSelectionChange(keys: Selection)`, `onRemove(keys: Set<Key>)`.
Gotchas: `size`/`variant` are set on the group, not on `Tag`. Providing `onRemove` auto-renders a remove button on each tag; a custom `Tag.RemoveButton` child overrides it. `selectedKeys` is `Iterable<Key>`/`Selection` (Set). Classes `.tag-group`, `__list`, `.tag`, `.tag__remove-button`, `.tag--sm|md|lg`, `.tag--default|surface`.

```tsx
<TagGroup onRemove={(keys) => remove(keys)} size="sm">
  <TagGroup.List>
    {tags.map((t) => (
      <Tag key={t} id={t}>
        {t}
      </Tag>
    ))}
  </TagGroup.List>
</TagGroup>
```

### TextArea (`TextArea`)

Purpose: primitive multiline `<textarea>`; accepts standard HTML attrs. Validation/label via `TextField`.
Props: `className`, `rows` (3), `cols`, `value`, `defaultValue`, `onChange(event: ChangeEvent<HTMLTextAreaElement>)` (native event), `placeholder`, `disabled` (false), `readOnly`, `required`, `name`, `autoComplete`, `maxLength`, `minLength`, `wrap` `'soft'|'hard'`, `fullWidth` (false), `variant` `"primary"|"secondary"` (primary; secondary no shadow, for Surface).
Events: native `onChange(event: ChangeEvent<HTMLTextAreaElement>)` plus all HTML textarea events.
Gotchas: uses HTML attrs `disabled/readOnly/required` (NOT `isDisabled`/`isRequired`); for `isInvalid`/`isRequired`/errors wrap in `TextField` (`isInvalid` etc. live there). Controlled demo: `aria-label` + `aria-describedby` pointing at a `Description id`. Class `.textarea`; states `[data-hovered]`, `[data-focus-visible]`, `[data-invalid]`, `[aria-disabled]`. No auto-resize prop documented (section "Rows and Resizing" only).

```tsx
<TextField name="bio" value={bio} onChange={setBio}>
  <Label>Bio</Label>
  <TextArea rows={4} placeholder="About you" variant="secondary" />
  <Description>{bio.length} / 200</Description>
</TextField>
```

### TextField (`TextField`, with `Label`, `Input`, `TextArea`, `Description`, `FieldError`)

Purpose: label + input + description + error composite (React Aria TextField). Standalone: use `Input`/`TextArea`.
Anatomy: `TextField` > [`Label`, `Input` | `TextArea`, `Description`, `FieldError`].
Props: `children` (node or `(TextFieldRenderProps)=>node`), `className`/`style` (static or render-prop fn), `fullWidth` (false), `id`, `render`; validation `isRequired` (false), `isInvalid`, `validate(value:string)=>ValidationError|true|null|undefined`, `validationBehavior` `'native'|'aria'` (native), `validationErrors: string[]`; value `value`, `defaultValue`, `onChange(value: string)` (string, NOT event); state `isDisabled`, `isReadOnly`; form `name`, `autoFocus`; a11y `aria-label|labelledby|describedby|details`.
Render props: `isDisabled,isInvalid,isReadOnly,isRequired,isFocused (deprecated),isFocusWithin,isFocusVisible`.
Events: `onChange(value: string)` (inherits other React Aria TextField handlers, not listed in the table).
Docs patterns: controlled `value`/`onChange(string)` with `Description` showing a counter; validation = `isInvalid` computed in your component, `<FieldError>` swapped with `<Description>`; server errors via `validationErrors: string[]`; `type="email"` etc. set on `TextField` or `Input` (Form demo: `<TextField name type="email" variant="secondary">`; in Modal/Drawer forms `variant="secondary"` is passed to `Input` or `TextField` inside a `Surface`).
Gotchas: `variant` `"primary"|"secondary"` is set on `Input`/`TextArea` (docs: "use `variant="secondary"` on Input or TextArea" inside Surface), not on TextField. Invalid state auto-hides the Description slot; render `<FieldError>` (typically conditional, docs swap `FieldError`/`Description` on `isInvalid`). `Input` itself uses native `onChange(event)`; `TextField.onChange` gets the string. Class `.textfield` (`flex flex-col gap-1`); attrs `[data-invalid]`, `[data-disabled]`, `[data-focus-within]`, `[data-focus-visible]`.

```tsx
<TextField isRequired isInvalid={bad} name="username" value={v} onChange={setV}>
  <Label>Username</Label>
  <Input placeholder="jane_doe" />
  {bad ? <FieldError>At least 3 characters.</FieldError> : <Description>Pick a unique name.</Description>}
</TextField>
```

### TimeField (`TimeField`)

Purpose: segmented time input (React Aria TimeField); values use `@internationalized/date` (`Time`, `parseTime`, `CalendarDateTime`, `ZonedDateTime`); `TimeValue` type exported from `@heroui/react`.
Anatomy: `TimeField` > [`Label`, `TimeField.Group` > (`TimeField.Prefix`, `TimeField.Input` with child fn `(segment) => <TimeField.Segment segment={segment} />`, `TimeField.Suffix`), `Description`, `FieldError`].
Props: `value: TimeValue|null`, `defaultValue`, `onChange(value: TimeValue|null)`, `placeholderValue`, `minValue`, `maxValue`, `isRequired`, `isInvalid`, `validate`, `validationBehavior`, `granularity` `'hour'|'minute'|'second'` (minute), `hourCycle` `12|24`, `hideTimeZone`, `shouldForceLeadingZeros`, `isDisabled`, `isReadOnly`, `name` (submits ISO 8601), `autoFocus`, `fullWidth`, aria props. `TimeField.Group`/`TimeField.Input`: `variant` `"primary"|"secondary"` (set `variant="secondary"` on the Group inside Surface). `TimeField.Segment`: `segment`, `className`.
Events: `onChange(value: TimeValue | null)`.
Gotchas: **Group styles use `.date-input-group*` classes** (shared with DatePicker/DateField), root `.time-field`. Value is a Time object, not a string; convert with `.toString()`.

```tsx
<TimeField className="w-[256px]" name="time" value={t} onChange={setT}>
  <Label>Time</Label>
  <TimeField.Group>
    <TimeField.Input>{(s) => <TimeField.Segment segment={s} />}</TimeField.Input>
  </TimeField.Group>
</TimeField>
```

### Toast (`Toast`, `toast`, `ToastQueue`)

Purpose: temporary notifications. **Imperative API exists**, but `<Toast.Provider />` must be rendered once at app root.
Setup (docs): `<Toast.Provider />` in root; then `import {toast} from "@heroui/react"; toast("Simple message")` anywhere (state is stored outside React in a `ToastQueue`).
Anatomy (custom render): `Toast.Provider` > `Toast` (prop `toast`) > [`Toast.Indicator`, `Toast.Content` > (`Toast.Title`, `Toast.Description`), `Toast.ActionButton`, `Toast.CloseButton`]. Named exports also `ToastContent`, `ToastDescription`, `ToastIndicator`, `ToastTitle`, `ToastQueue`, type `ToastContentValue`.
`toast` function:

- `toast(title, options?)` -> returns key `string`. Variant helpers: `toast.success(title, opts?)`, `toast.info(...)`, `toast.warning(...)`, `toast.danger(...)`. (Docs list **`danger`, not `error`**; no `toast.error`/`toast.loading`/`toast.message` in docs.)
- `toast.update(id, title, {variant?, timeout?, onClose?})`; `toast.promise(promise, {loading, success: node|(data)=>node, error: node|(err)=>node})`; `toast.close(key)`, `toast.clear()`, `toast.pauseAll()`, `toast.resumeAll()`.
- Options: `title`, `description` (ReactNode), `variant` `"default"|"accent"|"success"|"warning"|"danger"`, `indicator` (ReactNode, `null` hides), `actionProps: ButtonProps` (e.g. `{children:"View", onPress}`), `isLoading` (false), `timeout` ms (**4000**; `0` = persistent), `onClose()`.
- Installed types (`HeroUIToastOptions`) have no `title` key: the FIRST ARGUMENT is the title; `description` is optional.
  `Toast.Provider` props: `placement` `"top start"|"top"|"top end"|"bottom start"|"bottom"|"bottom end"` (bottom), `gap` 12, `isExpanded` false, `maxVisibleToasts` 3, `hotkey` `string[]` (`["altKey","KeyT"]`, `[]` disables), `scaleFactor` 0.05, `width` 460, `queue: ToastQueue`, `children` (node or `({toast}) => node`), `className`.
  `ToastQueue`: ctor `{exitDuration=300, maxVisibleToasts=3, wrapUpdate}`; methods `add(content, options?)->key`, `update`, `close`, `pauseAll`, `resumeAll`, `clear`, `subscribe`. `queue.add({title, description, variant})` for custom queues; custom queue requires `<Toast.Provider queue={q} />`.
  Events: per toast `onClose()` (fires as exit animation starts), `actionProps.onPress`; `ToastQueue.subscribe(fn) => unsubscribe`.
  Docs demos: `actionProps: {children: "Dismiss", onPress: () => toast.close(id), variant: "tertiary"}` (ButtonProps incl. `variant`); `indicator: <Icon/>` replaces the variant icon; `toast.info` maps to variant `accent` (source: comment in installed `toast-queue.js`, not in docs text). **Placement is per `Toast.Provider`, not per toast**: docs "Placements" create one `new ToastQueue({maxVisibleToasts: 3})` and one `<Toast.Provider placement={p} queue={q}/>` per placement and call `queue.add({title, description, variant})`. Default content shape for `ToastQueue.add`: `{title, description, variant, indicator, actionProps, isLoading}`.
  Gotchas: timers pause on hover/focus/background tab; `F6`/`Alt+T` focuses region; each toast `role="alertdialog"`. Classes `.toast`, `.toast-region`, `.toast__content|indicator|title|description|action|close-button`, `.toast--default|accent|success|warning|danger`; states `[data-frontmost]`, `[data-index]`, `[data-expanded]`, `[data-hidden]`, `[data-entering]`, `[data-exiting]`.

```tsx
// root
<Toast.Provider placement="bottom end" />;
// anywhere
toast.success("Saved", { description: "Resume updated", timeout: 5000 });
toast.promise(save(), { loading: "Saving…", success: "Saved", error: "Failed" });
```

### ToggleButton (`ToggleButton`)

Purpose: on/off pressable button (React Aria ToggleButton).
Props: `variant` `'default'|'ghost'` (default), `size` `'sm'|'md'|'lg'`, `isIconOnly` (false), `isSelected`, `defaultSelected`, `isDisabled`, `onChange(isSelected: boolean)`, `onPress`, `children` (node or render props `isSelected,isPressed,isHovered,isFocused,isFocusVisible,isDisabled`).
Events: `onChange(isSelected: boolean)`, `onPress(e: PressEvent)`.
Gotchas: selected look = accent bg/foreground via `[data-selected="true"]`. Classes `.toggle-button`, `--sm|md|lg`, `--default|ghost`, `--icon-only`. `id` required when inside a group.

```tsx
<ToggleButton isSelected={on} onChange={setOn} isIconOnly aria-label="Bold">
  <Bold />
</ToggleButton>
```

### ToggleButtonGroup (`ToggleButtonGroup`)

Purpose: segmented group of `ToggleButton`s; single or multiple (candidate for `segmented-control`).
Anatomy: `ToggleButtonGroup` > `ToggleButton id="…"` > [`ToggleButtonGroup.Separator` (inside every button except the first), content].
Props: `selectionMode` `"single"|"multiple"` (single), `selectedKeys: Iterable<Key>` (controlled, a `Set<Key>`), `defaultSelectedKeys`, `onSelectionChange(keys: Set<Key>)`, `disallowEmptySelection` (false), `orientation` `"horizontal"|"vertical"` (horizontal), `size` `"sm"|"md"|"lg"` (propagated to children), `isDetached` (false; gaps instead of joined), `fullWidth` (false), `isDisabled`, `className`.
Events: `onSelectionChange(keys: Set<Key>)`.
Gotchas: **selection is a `Set<Key>` even in single mode** (`onSelectionChange(new Set(["a"]))`); each ToggleButton needs unique `id`; for a radio-like segmented control use `selectionMode="single"` + `disallowEmptySelection`. Omit Separator to drop dividers. Group `isDisabled` can be overridden per button with `isDisabled={false}`. Classes `.toggle-button-group`, `--horizontal|vertical|full-width|detached`, `__separator`.

```tsx
<ToggleButtonGroup
  selectionMode="single"
  disallowEmptySelection
  selectedKeys={new Set([view])}
  onSelectionChange={(k) => setView([...k][0] as string)}
>
  <ToggleButton id="grid">Grid</ToggleButton>
  <ToggleButton id="list">
    <ToggleButtonGroup.Separator />
    List
  </ToggleButton>
</ToggleButtonGroup>
```

### Toolbar (`Toolbar`)

Purpose: arrow-key-navigable group of controls (React Aria Toolbar). Children are normal buttons/ToggleButtonGroup/ButtonGroup.
Props: `isAttached` (false; surface background + full rounding), `orientation` `"horizontal"|"vertical"` (horizontal), `aria-label`, `aria-labelledby`, `children` (node or render props `orientation`), `className` (fn allowed).
Events: none.
Gotchas: give `aria-label`. Classes `.toolbar`, `--horizontal|--vertical|--attached`.

```tsx
<Toolbar aria-label="Text formatting" isAttached>
  <Button size="sm">Bold</Button>
  <Button size="sm">Italic</Button>
</Toolbar>
```

### Tooltip (`Tooltip`)

Purpose: hover/focus hint.
Anatomy: `Tooltip` > `Tooltip.Trigger` (wraps trigger element) + `Tooltip.Content` > [`Tooltip.Arrow`, text].
Props `Tooltip`: `delay` ms (default **1500**, global `--tooltip-delay`), `closeDelay` ms (**500**, `--tooltip-close-delay`), `trigger` `"hover"|"focus"` (hover), `isDisabled`, `shouldSkipAnimation`. `Tooltip.Content`: `showArrow` (false), `offset` (3, 7 with arrow), `placement` (top), `className`, `render`. `Tooltip.Trigger`: `children`, `className`. `Tooltip.Arrow`: `children`, `className`.
Events: none documented (no open-change prop in the API table).
A `Button` may be the direct child of `Tooltip` (docs demos: `<Tooltip delay={0}><Button>…</Button><Tooltip.Content showArrow><Tooltip.Arrow/>text</Tooltip.Content></Tooltip>`); use `Tooltip.Trigger` (with `aria-label`) only for non-button elements such as `Avatar`.
Gotchas: **No provider.** Default 1500 ms open delay is long; override globally with `:root{--tooltip-delay:…;--tooltip-close-delay:…}` (also per-theme `.light/.dark`) or per-tooltip `delay`/`closeDelay`. Per-instance props beat CSS vars. Classes `.tooltip`, `.tooltip__trigger`.

```tsx
<Tooltip delay={300}>
  <Tooltip.Trigger>
    <Button aria-label="Help">
      <HelpIcon />
    </Button>
  </Tooltip.Trigger>
  <Tooltip.Content showArrow>Helpful text</Tooltip.Content>
</Tooltip>
```

### Typography (`Typography`)

Purpose: semantic text primitive (type scale).
Props: `type` `'h1'..'h6'|'body'|'body-sm'|'body-xs'|'code'` (body), `align` `'start'|'center'|'end'|'justify'` (start), `color` `'default'|'muted'` (default), `weight` `'normal'|'medium'|'semibold'|'bold'`, `truncate`, `render`, `children`, `className`. Sub-primitives: `Typography.Heading level={1..6}`, `Typography.Paragraph size="base"|"sm"|"xs"` (+`color="muted"`), `Typography.Code`, `Typography.Prose` (styles raw HTML children).
Events: none.
Gotchas: `type` maps to semantic element (h1->`<h1>` etc.; `render` overrides the element). Classes `.typography`, `.typography-prose`, `.typography--h1..h6|body|body-sm|body-xs|code`, `--align-*`, `--color-default|muted`, `--truncate`, `--weight-*`. Rezumi's `font-display` h1 rule and Instrument Serif headings are custom and not provided by this component.

```tsx
<Typography type="h2">Section</Typography>
<Typography type="body-sm" color="muted">Helper copy</Typography>
```

---

## Part 2 — HeroUI theming and setup (docs-verified unless marked)

### 2.1 What was fetched, what does not exist

- Fetched via `get_docs`: `/docs/react/getting-started/{theming,colors,dark-mode,styling,composition,animation,quick-start}`, `/docs/react/getting-started/` (intro), `/pro/docs/react/getting-started/{installation,theming}`. Also `get_theme_variables(default)` and OSS `get_component_source_code` (sheet, toast).
- **No routing page and no icons page exist** in the docs MCP: `/docs/react/getting-started/{routing,client-side-routing,router,icons}` and `/docs/react/handbook/routing` all return "Unknown documentation path". Getting-started pages seen (listed in the error message or linked from fetched pages): agent-skills, agents-md, animation, cli, colors, composition, dark-mode, mcp-server, llms-txt, quick-start, styling, theming.
- Installed in repo (not docs): `@heroui/react` 3.2.7 + `@heroui/styles` 3.2.7 (`apps/web/node_modules/@heroui/react`, catalog `^3.2.7`), `@heroui-pro/react` `1.0.0-beta.10` (`pnpm-workspace.yaml`). `packages/ui/src/styles/globals.css` ALREADY imports `@heroui/styles` and `@heroui-pro/react/css` (lines 2-3) but nothing uses them yet.

### 2.2 Requirements, import order, import strategies

- React 19+, Tailwind CSS v4. **No Provider** needed. `pnpm add @heroui/styles @heroui/react`.
- Required order (OSS): `@import "tailwindcss";` then `@import "@heroui/styles";` ("Import order matters. Always import tailwindcss first"). With Pro: `tailwindcss` -> `@heroui/styles` -> `@heroui-pro/react/css` (reversing breaks Pro styles). Pro themes (`@heroui-pro/react/themes/{brutalism,glass,mouve}`) import AFTER `@heroui-pro/react/css`. Rezumi's current order (`@import "tailwindcss" source(none); @import "@heroui/styles"; @import "@heroui-pro/react/css";`) already matches.
- Full import (recommended): the two lines above. Selective import (needs `@layer theme, base, components, utilities;` first): `@heroui/styles/base` layer(base); `@heroui/styles/themes/shared/theme.css` + `@heroui/styles/themes/default` layer(theme); `@heroui/styles/components` (or `components/<name>.css`) layer(components); optional `@heroui/styles/utilities` layer(utilities), `@heroui/styles/variants` layer(utilities). Headless: `@import "@heroui/styles/base/base.css";` only.
- Pro CLI (`npx heroui-pro@latest login|install`, `HEROUI_AUTH_TOKEN` in CI) — only relevant to Pro; Pro subpath-only imports: map, markdown, rich-text-editor, charts/KPI (recharts), carousel, code-block, chat-tool, number-stepper, resizable.
- HeroUI component styling is BEM CSS shipped in `@heroui/styles` (e.g. `.modal__dialog`), not utility strings scanned from JS. Docs use plain `@import "tailwindcss"`; Rezumi uses `@import "tailwindcss" source(none)` plus explicit `@source` globs (see Part 5 item 7).

### 2.3 Dark mode (CSS-driven)

- Components read theme variables from the root element. Dark theme applies when `<html>` has class `dark` OR `data-theme="dark"` (light: `light` class / `data-theme="light"`, which is also the `:root` default). Both forms are recognized; if you set both keep them in sync. Dark selector in `variables.css`: `.dark, [data-theme="dark"]`.
- Keep `bg-background text-foreground` on the app shell/body so the canvas changes with the theme.
- Two supported controllers: `next-themes` (Next.js; `attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`; `attribute="data-theme"` + `themes={[…]}` for custom themes) or, for plain React/Vite, `useTheme` exported from `@heroui/react`: `const {theme, resolvedTheme, setTheme} = useTheme("system")`. Docs: it stores selection in `localStorage`, resolves `"system"`, applies class AND `data-theme` to `<html>`. (Installed source: storage key `heroui-theme`; `setTheme` accepts any theme name; `resolvedTheme` undefined during SSR.) Docs warning: **use one theme controller per app**.
- `dark:` Tailwind variant works for one-off tweaks (`dark:border-default`).
- Theme-aware utilities: `bg-background text-foreground`, `bg-surface text-surface-foreground shadow-surface`.
- Motion: `data-reduce-motion="true"` on `<html>`/`<body>` disables all HeroUI animations; `prefers-reduced-motion` handled automatically via Tailwind `motion-reduce:` (HeroUI extends that variant to also match `[data-reduce-motion="true"]`).

### 2.4 Naming convention

Color without suffix = background (`--accent`); `-foreground` = text on it (`--accent-foreground`). Calculated variants: `-hover`, `-soft`, `-soft-hover`, `-soft-foreground`. Three variable classes in `variables.css`: base (non-changing: `--white`, spacing...), theme (change light/dark + scrollbar tokens), calculated (`color-mix()`).

### 2.5 Default theme, light (`:root`)

- Primitives (mode-agnostic): `--white oklch(100% 0 0)`, `--black oklch(0% 0 0)`, `--snow oklch(0.9911 0 0)`, `--eclipse oklch(0.2103 0.0059 285.89)`.
- Layout/base: `--spacing 0.25rem`, `--border-width 1px`, `--field-border-width 0px`, `--disabled-opacity 0.5`, `--ring-offset-width 2px`, `--cursor-interactive pointer`, `--cursor-disabled not-allowed`, `--radius 0.5rem`, `--field-radius calc(var(--radius) * 1.5)`.
- Canvas: `--background oklch(0.9702 0 0)`, `--foreground var(--eclipse)`.
- Surface (cards, accordions): `--surface var(--white)`, `--surface-foreground var(--foreground)`, `--surface-secondary oklch(0.9524 0.0013 286.37)`, `--surface-tertiary oklch(0.9373 0.0013 286.37)`.
- Overlay (tooltips, popovers, modals, menus): `--overlay var(--white)`, `--overlay-foreground var(--foreground)`.
- Text: `--muted oklch(0.5517 0.0138 285.94)` (the only secondary-text token), `--link var(--foreground)`.
- Neutral: `--default oklch(94% 0.001 286.375)`, `--default-foreground var(--eclipse)`.
- Brand/status: `--accent oklch(0.6204 0.195 253.83)` (blue) / `--accent-foreground var(--snow)`; `--success oklch(0.7329 0.1935 150.81)` / `var(--eclipse)`; `--warning oklch(0.7819 0.1585 72.33)` / `var(--eclipse)`; `--danger oklch(0.6532 0.2328 25.74)` / `var(--snow)`.
- Fields: `--field-background var(--white)`, `--field-foreground oklch(0.2103 0.0059 285.89)`, `--field-placeholder var(--muted)`, `--field-border transparent` (**fields have no border by default**).
- Misc: `--segment var(--white)` / `--segment-foreground var(--eclipse)`, `--border oklch(92% 0.004 286.32)` (Colors-page code block; its swatch tooltip says 90%), `--separator oklch(92% 0.004 286.32)`, `--focus var(--accent)`, `--backdrop rgba(0,0,0,0.5)`.
- Shadows: `--surface-shadow: 0 2px 4px 0 rgba(0,0,0,.04), 0 1px 2px 0 rgba(0,0,0,.06), 0 0 1px 0 rgba(0,0,0,.06)`; `--field-shadow` identical; `--overlay-shadow: 0 4px 16px 0 rgba(24,24,27,.08), 0 8px 24px 0 rgba(24,24,27,.09)`.
- Component knobs: `--skeleton-animation shimmer`, `--tooltip-delay 1500ms`, `--tooltip-close-delay 500ms`; scrollbar `--scrollbar-thumb` (15% foreground), `--scrollbar-track transparent`, `--scrollbar-gutter auto`, `--scrollbar-width thin`, `--scrollbar-color`, legacy `--scrollbar`.

### 2.6 Default theme, dark (`.dark, [data-theme="dark"]`) and calculated colors

- `--background oklch(12% 0.005 285.823)`, `--foreground var(--snow)`.
- `--surface oklch(0.2103 0.0059 285.89)`, `--surface-secondary oklch(0.257 0.0037 286.14)`, `--surface-tertiary oklch(0.2721 0.0024 247.91)`.
- `--overlay oklch(0.2103 0.0059 285.89)` (Colors-page code block shows 0.22).
- `--muted oklch(70.5% 0.015 286.067)`, `--default oklch(27.4% 0.006 286.033)`, `--default-foreground var(--snow)`.
- `--field-background`: `get_theme_variables` says `oklch(0.2103 0.0059 285.89)`, Colors-page code says `var(--default)`; `--field-foreground var(--foreground)`.
- `--warning oklch(0.8203 0.1388 76.34)`, `--danger oklch(0.594 0.1967 24.63)`; `--segment oklch(0.3964 0.01 285.93)`.
- `--border oklch(28% 0.006 286.033)`, `--separator oklch(25% 0.006 286.033)` (Colors-page code block says 22%/22%: docs disagree; the tool and swatch tooltips say 28%/25%).
- `--backdrop rgba(0,0,0,0.6)`; `--surface-shadow` and `--field-shadow: 0 0 0 0 transparent inset` (**no shadows in dark**); `--overlay-shadow: 0 0 1px 0 rgba(255,255,255,.3) inset`.
- `--accent` and `--success` are NOT redefined in dark (same oklch as light).
- Calculated (`color-mix(in oklab, …)`): `*-hover` = color 90% + its foreground 10% (accent/success/warning/danger; `default-hover` 96/4); `*-soft` = color 15% + transparent; `*-soft-hover` = 20%; `*-soft-foreground` = accessible mix (color 70-80% + foreground 30-40%) by default, 92/8 with `<html data-vibrant-palette="true">` (docs warn it may fail WCAG); `--background-secondary` = 96% background + 4% foreground, `--background-tertiary` 92/8, `--background-inverse` = foreground; `--separator-secondary` = surface 85% + surface-foreground 15%, `--separator-tertiary` 81/19; field hover/focus/border-hover derive from `--field-*`.
- Pro adds `--chart-1..5` derived from `--accent` (lightness -0.24 … +0.24 around `--chart-3`).

### 2.7 Tailwind bridge (`themes/shared/theme.css`, `@theme inline`): utility names

- Colors: `background`, `foreground`, `surface` (`-foreground`, `-hover`), `surface-secondary` / `surface-tertiary` (`-foreground`), `overlay` (`-foreground`), `muted`, `accent` (`-foreground`, `-hover`, `-soft`, `-soft-foreground`, `-soft-hover`), `segment` (`-foreground`), `border` (`-secondary`, `-tertiary`), `separator` (`-secondary`, `-tertiary`), `focus`, `link`, `default` (`-foreground`, `-hover`, `-soft`, `-soft-foreground`, `-soft-hover`), `success|warning|danger` (same suffix set), `backdrop`, `background-secondary|tertiary|inverse`, `field` (`-hover`, `-focus`, `-foreground`, `-placeholder`, `-border`, `-border-hover`, `-border-focus`).
- Examples: `bg-background`, `text-muted`, `border-border`, `bg-overlay`, `bg-field`, `text-field-placeholder`, `bg-accent-soft`, `text-accent-soft-foreground`, `bg-backdrop`.
- Shadows: `shadow-surface`, `shadow-overlay`, `shadow-field`. Field sizing: `rounded-field` (`--radius-field`), `--border-width-field`.
- Radius (all derive from `--radius`, default 0.5rem): xs `*0.25` (2px), sm `*0.5` (4px), md `*0.75` (6px), lg `*1` (8px), xl `*1.5` (12px), 2xl `*2` (16px), 3xl `*3` (24px), 4xl `*4` (32px); fields use `--field-radius = radius*1.5`.
- Easing (`ease-*`): `smooth: ease`; `in-quad`, `in-cubic`, `in-quart`, `in-quint`, `in-expo`, `in-circ`; `out-quad (.25,.46,.45,.94)`, `out-cubic (.215,.61,.355,1)`, `out-quart (.165,.84,.44,1)`, `out-quint (.23,1,.32,1)`, `out-expo (.19,1,.22,1)`, `out-circ (.075,.82,.165,1)`, `out-fluid (.32,.72,0,1)` ("Apple style"); `in-out-quad`, `in-out-cubic`, `in-out-quart (.77,0,.175,1)`, `in-out-quint`, `in-out-expo`, `in-out-circ`; `linear`.
- Animations: `--animate-spin-fast: spin .75s linear infinite`, `--animate-skeleton: skeleton 2s linear infinite`, `--animate-caret-blink: caret-blink 1.2s ease-out infinite`.
- **Not in the default theme**: duration tokens, font-family tokens, spacing beyond `--spacing: .25rem` (fonts appear only in Pro themes such as Brutalism).

### 2.8 Customising

- Override accent: set `--accent` (and `--accent-foreground`) in `:root` AND the dark block (`.dark, [data-theme="dark"]`), because dark does not redefine accent. Docs example: `:root { --accent: oklch(0.7 0.25 260); --success: oklch(0.65 0.15 155); }` and `[data-theme="dark"] { --accent: oklch(0.8 0.12 250); … }`.
- Add colors (docs example `--info`): define `--info`, `--info-foreground` under `:root,[data-theme="light"]` and `.dark,[data-theme="dark"]`, then `@theme inline { --color-info: var(--info); --color-info-foreground: var(--info-foreground); }` -> `bg-info text-info-foreground`.
- Custom theme: `[data-theme="ocean"]` / `[data-theme="ocean-dark"]` blocks in `@layer base`, imported `@import "./src/themes/ocean.css" layer(theme);` after `@layer theme, base, components, utilities;`; activate with `<html data-theme="ocean">`. With next-themes use `attribute="data-theme"`.
- Component overrides: BEM in `@layer components { .button { @apply …; } .button--primary { … } }`; data-attribute states (`[data-hovered="true"]`, `[data-pressed="true"]`, `[data-focus-visible="true"]`, `[data-disabled="true"]`, `[data-entering]`, `[data-exiting]`, `[aria-expanded="true"]`). `className` also accepts render functions `({isPressed}) => …`. `tailwind-variants`: `tv({extend: buttonVariants, …})` with `buttonVariants`/`linkVariants`/`chipVariants`/`spinnerVariants` exported from `@heroui/styles` (re-exported by `@heroui/react`).
- Theme Builder (heroui.com/themes) exports CSS; Pro "Design Systems" dashboard exports tokens that apply to OSS+Pro.
- Scrollbars: HeroUI scroll areas use `@apply scrollbar`. `data-scrollbar="default|thin|none"` on `<html>`/subtree; utilities `scrollbar`, `scrollbar-thin`, `scrollbar-default`, `scrollbar-none` for own overflow containers.
- Pro themes: `data-theme="brutalism-light|brutalism-dark|glass-light|glass-dark|mouve-light|mouve-dark"` (activating requires switching theme values from `light/dark`).

### 2.9 Composition, client-side links, `render`

- Compound components: `Alert`, `Alert.Root`, or named exports (`AlertRoot`, `AlertTitle`) are all valid; `Button.RootProps` namespace typing removed — use `ButtonRootProps` or `Button["RootProps"]`.
- Link as button: `import {buttonVariants} from "@heroui/styles"` -> `<RouterLink className={buttonVariants({variant:"primary"})} to="…">`, or BEM classes directly (`className="button button--primary"`, variants `--primary|--secondary|--tertiary|--danger|--ghost`, sizes `--sm|--md|--lg`, `--icon-only`). The docs show Next.js `Link` and React Router `Link` this way (pass `to=`). `Link` component: `<Link href render={(domProps) => <Custom {...domProps}/>}>`; docs example `render={({ref, ...domProps}) => <NextLink {...domProps} ref={ref as React.Ref<HTMLAnchorElement>} href="…" />}`. `render` rules: same element type as expected, one root element, forward all props (merge with `mergeProps`).
- `Link` props: `href`, `target`, `rel`, `download`, `isDisabled`, `onPress`, `render`; `Link.Icon`. When using a custom root, compound children lose context: pass `linkVariants()` slots manually (`slots.base()`, `slots.icon()`).
- **RouterProvider (React Aria) is not in the fetched docs.** Verified in installed package only: `@heroui/react` re-exports `RouterProvider`, `I18nProvider`, `useLocale`, `isRTL`, `useFilter`, `Collection`, `Pressable`, `Focusable`, `Virtualizer`, `ListLayout`, `TableLayout`, `parseColor` from `react-aria-components` (`dist/index.js`). Its `navigate`/`useHref` props are React Aria's API (not verified here); check RAC docs before wiring TanStack Router. The docs do not describe how HeroUI `Link`/`ListBox.Item href` behave without it; test client-side navigation after wiring (ListBox.Item `render` prop is typed for anchor links).
- `I18nProvider`/`useLocale` (React Aria) controls date/number locale for TimeField, RangeCalendar, NumberField; docs show wrapping in `I18nProvider` with a Unicode calendar locale.

### 2.10 Icons

No icon recommendation page. Docs examples import from `@gravity-ui/icons` (`import {Rocket} from "@gravity-ui/icons"`, `<Rocket className="size-5" />`) and one styling example uses `<Icon icon="gravity-ui:heart" />` (Iconify). HeroUI ships built-in default icons (toast variant icons, SearchField search/clear, NumberField plus/minus, Pagination chevrons, CloseButton) and these slots accept `children` to replace the icon (`Toast.Indicator`, `Select.Indicator`, `Pagination.PreviousIcon`, `SearchField.SearchIcon`, `Tag.RemoveButton`, `NumberField.IncrementButton`, `Link.Icon`, `Switch.Icon`, `Modal.Icon`). Nothing requires Gravity icons; Rezumi's Phosphor `Icon` component can fill those slots.

## Part 3 — Rezumi today vs HeroUI default (facts from repo)

### 3.1 How Rezumi applies dark mode (no change needed for HeroUI)

- Single mechanism: class `dark` on `<html>`; Tailwind `@custom-variant dark (&:is(.dark *))` (globals.css line 18). No `data-theme` attribute anywhere.
- Pre-paint: inline script in `apps/web/index.html` reads cookie `theme` (`light|dark|system`) and toggles `html.dark`; `<meta name="theme-color">` is static per scheme (`#F8F7F3` / `#100F0C`) and would need updating if the desk color changes.
- Runtime: `apps/web/src/features/theme/provider.tsx` (`ThemeProvider theme={…}` from router context in `routes/__root.tsx`). `applyThemeClass` toggles `.dark` after injecting a one-frame `*{transition:none!important}` style; `setTheme` writes the cookie (`libs/theme.ts`, `js-cookie`, key `theme`), calls `router.invalidate()`, plays switch sounds; `useSyncExternalStore` follows `prefers-color-scheme`. `useTheme()` -> `{theme, resolvedTheme, setTheme, toggleTheme}`. Consumers: `features/theme/toggle-button.tsx`, settings preferences, command-palette theme page, user dropdown, homepage header/footer, resume stylesheet editor (CodeMirror `dark`).
- HeroUI reads `.dark` OR `[data-theme="dark"]`, so the current mechanism already switches HeroUI components. Keep Rezumi's provider; do NOT also use HeroUI `useTheme` (docs: one theme controller per app, and its `localStorage` key `heroui-theme` would fight the cookie). Optional: also set `data-theme` (docs: keep in sync) only if you adopt `[data-theme]`-scoped themes (Pro `*-light|*-dark`).

### 3.2 Collisions that exist TODAY (HeroUI CSS is already imported)

Rezumi's `:root`/`.dark` blocks are unlayered; HeroUI's default theme sits in `@layer base` (Colors page shows `@layer base { :root {…} }`). By CSS cascade, unlayered wins, so these names already shadow HeroUI's values: `--surface`, `--accent`, `--danger` (+ Tailwind aliases `--color-surface|accent|accent-hover|accent-soft|danger|danger-soft`, and `@theme` `--radius`, `--radius-xs…4xl`). Effects: HeroUI components already render with Rezumi's green accent and near-white surface, but still get HeroUI's `--accent-foreground: var(--snow)` (low contrast on Rezumi's light-green dark-mode accent `oklch(0.74 0.12 150)`; Rezumi uses `--on-accent` dark ink there), `--danger-foreground`, `--success*`, `--default*`, `--field-*`, `--overlay*`, `--muted`, `--border`, `--separator`, `--focus`, `--backdrop`. Rezumi's 2-4px radius scale overrides HeroUI's `--radius-*` names (HeroUI components use `rounded-*` derived from `--radius`), and its `*{ border-color: line }` base rule sets all borders to `--line`. Consequence for "HeroUI DEFAULT style": delete the Rezumi `:root`/`.dark` color blocks and `@theme` radius block, then re-add only what HeroUI lacks (section 3.4).

### 3.3 Token mapping (Rezumi `globals.css` -> HeroUI default)

| Rezumi token                                                                                                                                                                                                  | HeroUI equivalent                                                                                                                                                                                                                                                    | Notes                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `--bg` (desk, `bg-bg`)                                                                                                                                                                                        | `--background` (`bg-background`)                                                                                                                                                                                                                                     | light `oklch(0.9702 0 0)` vs Rezumi `0.975 0.005 95` (warm); dark `oklch(12% 0.005 285.823)`                                                 |
| `--surface` (`bg-surface`)                                                                                                                                                                                    | `--surface` (`bg-surface`) + `--surface-foreground`, `-secondary`, `-tertiary`                                                                                                                                                                                       | same name; HeroUI light = white, dark `oklch(0.2103 …)`                                                                                      |
| `--raised` (menus, dialogs, inputs; `bg-raised`)                                                                                                                                                              | menus/popovers/modals: `--overlay` (`bg-overlay`); inputs: `--field-background` (`bg-field`)                                                                                                                                                                         | split into two roles                                                                                                                         |
| `--sunken` (wells, tracks, page canvas; `bg-sunken`)                                                                                                                                                          | closest: `--default` (`bg-default`, neutral fills, tab/segment tracks) or `--surface-secondary` / `--background-secondary`                                                                                                                                           | no 1:1; pick per use                                                                                                                         |
| `--line` (`border-line`, `divide-line`)                                                                                                                                                                       | `--border` (`border-border`) for outlines, `--separator` (`border-separator`, `divide-separator`) for dividers                                                                                                                                                       | HeroUI `--field-border` is transparent                                                                                                       |
| `--line-2` (input borders)                                                                                                                                                                                    | `--border-secondary` / `--border-tertiary` (levels) or `--field-border-hover/-focus`                                                                                                                                                                                 | default fields have NO border (shadow instead)                                                                                               |
| `--ink` (`text-ink`)                                                                                                                                                                                          | `--foreground` (`text-foreground`); on cards `--surface-foreground`                                                                                                                                                                                                  |                                                                                                                                              |
| `--ink-2`, `--ink-3` (`text-ink-2`, `text-ink-3`)                                                                                                                                                             | single `--muted` (`text-muted`)                                                                                                                                                                                                                                      | HeroUI has ONE secondary-text tier; ink-2 would collapse into muted or stay a custom token. `--field-placeholder` (= muted) for placeholders |
| `--accent` / `--accent-hover` / `--accent-soft`                                                                                                                                                               | `--accent` / `--accent-hover` / `--accent-soft` (`bg-accent`, `bg-accent-hover`, `bg-accent-soft`)                                                                                                                                                                   | same names; hover is derived (90/10 mix), soft = 15% alpha of accent                                                                         |
| `--on-accent` (`text-on-accent`)                                                                                                                                                                              | `--accent-foreground` (`text-accent-foreground`)                                                                                                                                                                                                                     |                                                                                                                                              |
| `--accent-text` (`text-accent-text`)                                                                                                                                                                          | `--accent-soft-foreground` (`text-accent-soft-foreground`) or `text-accent`                                                                                                                                                                                          |                                                                                                                                              |
| `--danger` / `--danger-soft` / `--danger-text`                                                                                                                                                                | `--danger` / `--danger-soft` / `--danger-soft-foreground`; text-on-danger = `--danger-foreground`                                                                                                                                                                    |                                                                                                                                              |
| `--warn` / `--warn-soft` / `--warn-text`                                                                                                                                                                      | `--warning` / `--warning-soft` / `--warning-soft-foreground` (`bg-warning`, …)                                                                                                                                                                                       | renamed (`warn` -> `warning`)                                                                                                                |
| (none; Rezumi uses accent for success)                                                                                                                                                                        | `--success` family                                                                                                                                                                                                                                                   | new                                                                                                                                          |
| `--info-soft`, `--info-text`                                                                                                                                                                                  | no info role                                                                                                                                                                                                                                                         | keep custom or add via the docs' "Adding Custom Colors" recipe (`--info`)                                                                    |
| `--hover`, `--press` (alpha overlays; `bg-hover` 72, `hover:bg-hover` 68)                                                                                                                                     | closest `--default-hover`, `--surface-hover`, `--field-hover`; no alpha-overlay token                                                                                                                                                                                | keep custom or map per component                                                                                                             |
| `--scrim`, `--scrim-sheet`                                                                                                                                                                                    | `--backdrop` (`bg-backdrop`; `Modal/Sheet/Drawer.Backdrop` use it)                                                                                                                                                                                                   | `Backdrop variant="blur"` available                                                                                                          |
| `--shadow-1/2/3` (`shadow-e1/e2/e3`)                                                                                                                                                                          | `--surface-shadow` (`shadow-surface`), `--overlay-shadow` (`shadow-overlay`), `--field-shadow` (`shadow-field`)                                                                                                                                                      | semantic not elevation-based; dark shadows are none/inset-only                                                                               |
| `--shadow-page`                                                                                                                                                                                               | none                                                                                                                                                                                                                                                                 | keep custom                                                                                                                                  |
| `--d1/--d2/--d3` (`duration-quick\|standard\|emphasized`), `--ease` (`ease-enter`)                                                                                                                            | none (no duration tokens). Easing: HeroUI `ease-out-quint` = `(.23,1,.32,1)` = Rezumi `--ease-out-strong`; `ease-in-out-quart` = `(.77,0,.175,1)` = `--ease-in-out-strong`; `ease-out-fluid` = `(.32,.72,0,1)` = `--ease-drawer`. `--ease (.2,.8,.2,1)` has no match | keep durations + `--ease` custom                                                                                                             |
| `--font-ui`, `--font-display`, `--font-mono`, `--font-sans`                                                                                                                                                   | none (default theme sets no fonts)                                                                                                                                                                                                                                   | keep custom in `@theme`                                                                                                                      |
| `--radius: 4px` + `--radius-xs…4xl`                                                                                                                                                                           | `--radius: 0.5rem` (xs 2px … 4xl 32px derived), `--field-radius = 1.5×radius`                                                                                                                                                                                        | HeroUI default = 8px base; if `--radius` were set to Rezumi's 4px: xs 1, sm 2, md 3, lg 4, xl 6, 2xl 8, field 6 px                           |
| `--paper` (`bg-paper`, 10 uses/6 files)                                                                                                                                                                       | none (`--white` primitive exists but `--paper` must stay fixed #fff in both themes)                                                                                                                                                                                  | **must stay custom**                                                                                                                         |
| `--stage-saved/applied/screening/interview/offer/closed` (29 lines across career shell, homepage, applications insights)                                                                                      | none                                                                                                                                                                                                                                                                 | **must stay custom**                                                                                                                         |
| `--aspect-page`, `--editor-bar`, `--editor-panel`, `--app-sidebar`, `--sheet-share`, `--sheet-detail`, `--assistant`                                                                                          | none                                                                                                                                                                                                                                                                 | **layout constants, stay custom** (`editor-bar` 5, `editor-panel` 3, others 1 use each)                                                      |
| `touch-target` `@utility` (20 lines/14 files), `toast-fuse` keyframes, `typeset.css` (386 lines; reads `--ink`, `--ink-3`, `--sunken`, `--accent`, `--font-*`, `--radius`)                                    | none                                                                                                                                                                                                                                                                 | stay custom; `typeset.css` needs token renames                                                                                               |
| focus ring `:focus-visible {outline: 2px solid var(--accent); outline-offset: 2px}`                                                                                                                           | `--focus` (= accent), `--ring-offset-width: 2px`                                                                                                                                                                                                                     | HeroUI focus ring comes from component CSS; the global rule can stay                                                                         |
| `--on-*`, `color-scheme` per mode                                                                                                                                                                             | HeroUI sets `color-scheme: light\|dark` itself                                                                                                                                                                                                                       |                                                                                                                                              |
| HeroUI tokens Rezumi lacks: `--default`, `--muted`, `--segment`, `--link`, `--field-*`, `--disabled-opacity: .5`, `--cursor-*`, `--border-width`, scrollbar tokens, `--skeleton-animation`, `--tooltip-delay` | —                                                                                                                                                                                                                                                                    | `--tooltip-delay: 400ms` matches Rezumi's `TooltipProvider delay=400`                                                                        |

### 3.4 Tailwind utility renames and sizing (apps/web/src; `total uses / files`; counts via word-boundary grep of ts/tsx/css, lower bound for dynamically composed classes)

Files containing any custom token utility (`bg-bg|bg-surface|bg-raised|bg-sunken|border-line|text-ink|bg-hover|text-accent-text|bg-accent|text-on-accent`) across `apps/web/src` + `packages/ui/src`: **193 files** (apps/web has 315 `.tsx`). `packages/ui/src/components` alone: 14 files with `bg-raised`, 11 `bg-sunken`, 15 `text-ink-3`.

| Current utility                                                                                                                                                                            | Uses / files                     | HeroUI utility                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- | -------------------------------------------------------------------------------------- |
| `bg-bg`                                                                                                                                                                                    | 40 / 27                          | `bg-background`                                                                        |
| `text-bg`                                                                                                                                                                                  | 17 / 12                          | `text-background` (text on inverse surface; pairs with `bg-foreground`)                |
| `bg-surface`                                                                                                                                                                               | 88 / 44                          | `bg-surface` (same)                                                                    |
| `bg-raised`                                                                                                                                                                                | 44 / 34                          | `bg-overlay` (menus/dialogs) or `bg-field` (inputs)                                    |
| `bg-sunken`                                                                                                                                                                                | 107 / 56                         | `bg-default` or `bg-surface-secondary` / `bg-background-secondary`                     |
| `border-line`                                                                                                                                                                              | 251 / 93                         | `border-border` (or `border-separator`)                                                |
| `border-line-2`                                                                                                                                                                            | 65 / 40                          | `border-border-secondary` (or field border tokens)                                     |
| `divide-line` / `ring-line`                                                                                                                                                                | 10 / 9, 1 / 1                    | `divide-separator` / `ring-border`                                                     |
| `text-ink`                                                                                                                                                                                 | 137 / 56                         | `text-foreground`                                                                      |
| `text-ink-2`                                                                                                                                                                               | 351 / 94                         | `text-muted` (lossy) or keep custom                                                    |
| `text-ink-3`                                                                                                                                                                               | 475 / 126                        | `text-muted`                                                                           |
| `placeholder:text-ink-3`                                                                                                                                                                   | 5 / 4                            | `placeholder:text-field-placeholder`                                                   |
| `bg-ink`                                                                                                                                                                                   | 18 / 13                          | `bg-foreground` (inverse: `bg-background-inverse`)                                     |
| `bg-accent`                                                                                                                                                                                | 33 / 29                          | `bg-accent` (same)                                                                     |
| `bg-accent-hover`                                                                                                                                                                          | 2 / 2                            | `bg-accent-hover` (same)                                                               |
| `text-on-accent`                                                                                                                                                                           | 15 / 12                          | `text-accent-foreground`                                                               |
| `bg-accent-soft`                                                                                                                                                                           | 62 / 38                          | `bg-accent-soft` (same)                                                                |
| `text-accent-text`                                                                                                                                                                         | 148 / 70                         | `text-accent-soft-foreground`                                                          |
| `text-accent` / `border-accent`                                                                                                                                                            | 10 / 8, 53 / 32                  | same names                                                                             |
| `bg-hover` / `hover:bg-hover`                                                                                                                                                              | 72 / 50, 68 / 49                 | no equivalent (`bg-default-hover`, `hover:bg-surface-hover`) or keep custom            |
| `bg-press`                                                                                                                                                                                 | 4 / 3                            | none (keep custom)                                                                     |
| `bg-danger` / `bg-danger-soft` / `text-danger-text` / `border-danger`                                                                                                                      | 4 / 4, 18 / 15, 61 / 43, 4 / 2   | `bg-danger`, `bg-danger-soft`, `text-danger-soft-foreground`, `border-danger`          |
| `bg-warn` / `bg-warn-soft` / `text-warn-text`                                                                                                                                              | 6 / 6, 26 / 20, 66 / 41          | `bg-warning`, `bg-warning-soft`, `text-warning-soft-foreground`                        |
| `bg-info-soft` / `text-info-text`                                                                                                                                                          | 8 / 7, 9 / 8                     | keep custom                                                                            |
| `shadow-e1` / `shadow-e2` / `shadow-e3` / `shadow-page`                                                                                                                                    | 19 / 17, 18 / 17, 12 / 11, 2 / 2 | `shadow-surface\|field` / `shadow-overlay` / `shadow-overlay`; `shadow-page` custom    |
| `bg-scrim`                                                                                                                                                                                 | 0 (2 in packages/ui)             | `bg-backdrop`                                                                          |
| `bg-paper`                                                                                                                                                                                 | 10 / 6                           | keep                                                                                   |
| `duration-quick\|standard\|emphasized`                                                                                                                                                     | 113/60, 51/38, 12/10             | keep custom                                                                            |
| `ease-enter` / `ease-in-out-strong` / `ease-out-strong`                                                                                                                                    | 87/50, 1/1, 3/3                  | keep, or `ease-out-quint` / `ease-in-out-quart` (exact curve matches for the last two) |
| `font-display` / `font-ui` / `font-mono`                                                                                                                                                   | 75/32, 29/13, 70/44              | keep custom                                                                            |
| Direct `var(--token)` references to the old names: 55 lines in apps/web/src (+ `typeset.css`); `dark:` variant used 35 times (`@custom-variant dark` stays).                               |
| Base-layer rules to revisit: `* { border-line }` -> `border-border`; `body { bg-bg text-ink … selection:bg-accent-soft }` -> `bg-background text-foreground`; `h1 { font-display }` stays. |

---

## Part 4 — `packages/ui/src/components` -> HeroUI mapping and call-site API changes

All components below are Base UI (`@base-ui/react`) or plain-DOM wrappers with `data-slot`, `cn()` and house tokens. File counts = files importing `@rezumi/ui/components/<name>` (apps + packages); tag counts are JSX occurrences in `apps/web/src`.

| Rezumi file (exports)                                                                                                                                                                                                                                                   | Usage                                                                                                                                                                      | HeroUI target                                                                                                                                                                                         | Call-site changes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dialog.tsx`: `Dialog, DialogTrigger, DialogPortal, DialogClose, DialogOverlay, DialogContent{showCloseButton, closeLabel, instant}, DialogHeader, DialogFooter{showCloseButton, closeLabel}, DialogTitle, DialogDescription` (Base UI Dialog; 16px radius, fade+scale) | 28 files; `<Dialog` 27, `<DialogContent` 27 (0 triggers/close: always controlled)                                                                                          | `Modal`                                                                                                                                                                                               | `open`/`onOpenChange` -> `isOpen`/`onOpenChange` on **`Modal.Backdrop`** (or `useOverlayState`). `DialogContent` -> `Modal.Container` (`size` xs..full, `placement`, `scroll`) > `Modal.Dialog`; `showCloseButton` -> add/omit `<Modal.CloseTrigger/>` (documented props: `children`, `className`; the translated `closeLabel` has no documented prop); `DialogOverlay` -> `Modal.Backdrop variant`; `Header/Title` -> `Modal.Header/Modal.Heading` (+ optional `Modal.Icon`); `DialogDescription` -> no part (plain `<p>`, use `aria-describedby` on Dialog); `DialogFooter` -> `Modal.Footer`; `DialogClose` -> `slot="close"` on `Button`; `instant` -> no equivalent (animation by `[data-entering]/[data-exiting]` CSS). Dialog children can be `({close}) => …`. `onClick` -> `onPress` on HeroUI buttons. Dialog title uses Rezumi display serif (`font-display text-[22px]`): re-apply on `Modal.Heading` |
| `alert-dialog.tsx`: `AlertDialog, AlertDialogTrigger, AlertDialogContent{size}, Header/Footer/Media/Title/Description/Action/Cancel`                                                                                                                                    | 2 files, 2 roots                                                                                                                                                           | OSS `AlertDialog` (exists in `list_components` and installed `dist/components/alert-dialog`; API NOT fetched here)                                                                                    | confirm via `get_component_docs(["alert-dialog"])`; fallback `Modal` with `Modal.Backdrop isDismissable={false}` + `slot="close"` buttons                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `popover.tsx`: `Popover, PopoverTrigger, PopoverContent{align, alignOffset, side, sideOffset}, PopoverHeader, PopoverTitle`                                                                                                                                             | 11 files; `<Popover` 10, `<PopoverTrigger` 12 (one uses `render=`)                                                                                                         | `Popover`                                                                                                                                                                                             | `Popover.Content placement="bottom start"` etc. replaces `side`+`align` pair; `sideOffset` -> `offset` (default 8 vs Rezumi 4); `alignOffset` no equivalent in docs; wrap content in `Popover.Dialog` (+ `Popover.Heading` for `PopoverTitle`); `PopoverTrigger render={<Button/>}` -> plain `<Button>` child or `Popover.Trigger`; `open`/`onOpenChange` -> `isOpen`/`defaultOpen`/`onOpenChange` on root.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `native-select.tsx`: `NativeSelect` (styled `<select>` + caret)                                                                                                                                                                                                         | 8 files, 11 usages                                                                                                                                                         | No OSS native select. Options: (a) keep wrapper restyled with `bg-field`/`rounded-field` classes; (b) OSS `Select`; (c) Pro `NativeSelect` (`@heroui-pro/react`, listed under Forms; API not fetched) | (b) changes `<select onChange={e => e.target.value}>`+`<option>` to `Select value/onChange(key)` + `ListBox.Item id textValue`; single/multiple via `selectionMode`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `radio-group.tsx`: `RadioGroup, RadioGroupItem` (18px circle)                                                                                                                                                                                                           | 1 file, 6 `<RadioGroup`, 1 `<RadioGroupItem`                                                                                                                               | `RadioGroup` + `Radio`                                                                                                                                                                                | `onValueChange(value)` -> `onChange(value: string)`; `disabled` -> `isDisabled`; each item becomes `Radio > Radio.Content > Radio.Control > Radio.Indicator` + label text; `Description` sits beside `Radio.Content`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `segmented-control.tsx`: `SegmentedControl, SegmentedControlItem` (radio group on a sunken track)                                                                                                                                                                       | 15 files; 17 roots, 30 items                                                                                                                                               | `ToggleButtonGroup selectionMode="single" disallowEmptySelection` + `ToggleButton id` (or `RadioGroup`; Pro has `segment` — not fetched)                                                              | `value/onValueChange(v)` -> `selectedKeys={new Set([v])}` / `onSelectionChange(keys: Set)`; items need `id` (not `value`); `ToggleButtonGroup.Separator` inside all but first; `size`, `fullWidth`, `orientation`. Semantics differ from a radio group (button toggles); verify roles/keyboard behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `separator.tsx`: `Separator` (`data-horizontal/vertical` utilities)                                                                                                                                                                                                     | 4 files, 9 usages                                                                                                                                                          | `Separator`                                                                                                                                                                                           | props `orientation` same; `decorative` -> `isDecorative`; new `variant` default/secondary/tertiary; drop `data-horizontal:*` classes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `sheet.tsx`: `Sheet, SheetTrigger, SheetClose, SheetContent{side, showCloseButton, closeLabel}, SheetHeader, SheetFooter, SheetTitle, SheetDescription` (Base UI Drawer, swipe-dismiss, bottom grabber)                                                                 | 9 files; `<Sheet` 14, `<SheetContent` 9, 1 `<SheetClose`                                                                                                                   | OSS `Sheet` (source-verified) or `Drawer` (docs-verified); Pro `Sheet` only if Pro extras needed                                                                                                      | `side` (on Content) -> `placement` on **`Sheet` root** (`Drawer`: on `Drawer.Content`); `open/onOpenChange` same names on root (`isOpen`); `SheetContent` -> `Sheet.Backdrop > Sheet.Content > Sheet.Dialog`; `showCloseButton` -> `Sheet.CloseTrigger`; grabber -> `Sheet.Handle`; Title -> `Sheet.Heading`; no Description part; `SheetClose render=` -> `Sheet.Close` wrapping one pressable child; `SheetTrigger` -> `Sheet.Trigger` wrapping one child; hand-written swipe CSS (`--drawer-swipe-*`, `ease-drawer`) can be deleted; widths (`sm:max-w-[440px]`) must be re-added via className                                                                                                                                                                                                                                                                                                                |
| `skeleton.tsx`: `Skeleton` (`rounded-md bg-sunken`)                                                                                                                                                                                                                     | 17 files, 35 usages                                                                                                                                                        | `Skeleton`                                                                                                                                                                                            | className-only API unchanged; adds `animationType`; global `--skeleton-animation`; remove `bg-sunken rounded-md` defaults (HeroUI provides)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `slider.tsx`: `Slider` (single component, FormControl id/aria bridge, `thumbAlignment="edge"`)                                                                                                                                                                          | 5 files, 5 usages                                                                                                                                                          | `Slider` (Output/Track/Fill/Thumb)                                                                                                                                                                    | `value/defaultValue` `number[]` -> `number \| number[]`; `onValueChange(values)` -> `onChange(value: number \| number[])` (+ `onChangeEnd`); `min/max` -> `minValue/maxValue`; `disabled` -> `isDisabled`; one `Slider.Thumb index` per value; label via `Label` child or `aria-label`/`aria-labelledby`; the `useFormControl` id/aria-invalid bridging in `slider.tsx` must be redone (HeroUI Slider documents no `id`/`isInvalid`; thumbs take `name`)                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `spinner.tsx`: `Spinner{decorative}` (Phosphor `circle-notch`, role=status)                                                                                                                                                                                             | 27 files, 33 usages                                                                                                                                                        | `Spinner`                                                                                                                                                                                             | `size-*` classes -> `size` sm/md/lg/xl; text color -> `color="current"`; `decorative` / `role="status" aria-label="Loading"` not in HeroUI API (docs list only size/color/className): keep a thin wrapper or pass aria props yourself; the globals.css reduced-motion exemption targets `[data-slot="spinner"]`, which the docs do not say HeroUI's Spinner sets                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `switch.tsx`: `Switch, SwitchRow{label, description}`                                                                                                                                                                                                                   | 15 files; `<Switch` 8, `<SwitchRow` 15                                                                                                                                     | `Switch` (+ `Switch.Control/Thumb/Content`, `Label`, `Description`)                                                                                                                                   | `checked/onCheckedChange` -> `isSelected/onChange(boolean)`; `disabled` -> `isDisabled`; `SwitchRow` -> `Switch` with `Switch.Content` containing `Label` + `Description` (HeroUI anatomy) — row layout/justify-between via className; `size` sm/md/lg; `touch-target` remains custom                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `tabs.tsx`: `Tabs, TabsList{variant default\|line}, TabsTrigger, TabsContent, TabsIndicator, TabsCount, tabsListVariants`                                                                                                                                               | 13 files; `<Tabs` 10, `<TabsTrigger` 19, `<TabsContent` 9                                                                                                                  | `Tabs`                                                                                                                                                                                                | `value/defaultValue/onValueChange(value)` -> `selectedKey/defaultSelectedKey/onSelectionChange(key: Key)`; `TabsTrigger value` -> `Tabs.Tab id`; `TabsContent value` -> `Tabs.Panel id`; `TabsList` -> `Tabs.ListContainer > Tabs.List aria-label`; `TabsIndicator` -> `Tabs.Indicator` inside each `Tabs.Tab`; `variant default` -> `primary`, `line` -> `secondary` (underline); `data-instant` list hack has no documented equivalent; `TabsCount` stays custom                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `textarea.tsx`: `Textarea` (`field-sizing-content min-h-16`)                                                                                                                                                                                                            | 17 files, 25 usages                                                                                                                                                        | `TextArea`                                                                                                                                                                                            | rename `Textarea` -> `TextArea`; native attrs (`disabled`, `required`, `onChange(event)`) unchanged; validation/label via `TextField` (`isInvalid`, `isRequired`); `variant` primary/secondary; `rows` default 3; keep `field-sizing-content` class for auto-grow                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `toast.tsx`: `toast` (Base UI `createToastManager`), `Toaster{closeLabel, limit=1, timeout=6000}`                                                                                                                                                                       | **101 files import `toast`; 176 `toast.add(`, 18 `toast.close(`**; `<Toaster>` mounted once in `routes/__root.tsx` (`LocalizedToaster`) and in `interview-dialog.test.tsx` | `Toast.Provider` + `toast`                                                                                                                                                                            | see 4.1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `tooltip.tsx`: `TooltipProvider{delay=400}, Tooltip, TooltipTrigger, TooltipContent{side, sideOffset, align, alignOffset}`                                                                                                                                              | 13 files; 12 `<Tooltip`, 12 triggers/contents, 1 `TooltipProvider` (`__root.tsx`)                                                                                          | `Tooltip`                                                                                                                                                                                             | delete `TooltipProvider` (no provider); delay is per-tooltip `delay`/`closeDelay` or global `--tooltip-delay: 400ms; --tooltip-close-delay` (HeroUI defaults 1500/500); `TooltipTrigger render={…}` -> `Tooltip.Trigger` wrapping the element; `TooltipContent side` -> `placement` (`"top"` default), `sideOffset` -> `offset`; arrow via `showArrow`; Rezumi inverted ink tooltip (`bg-ink text-bg`) vs HeroUI overlay styling is a visual change                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

### 4.1 `toast` call shapes in Rezumi (apps/web/src) vs HeroUI

Rezumi API is Base UI's `createToastManager()`: `toast.add({title?, description, type?, timeout?, actionProps?, onClose?, id?, priority?, data?}): string` and `toast.close(id)`. Measured (script over `toast.add({…})` objects, 175 parsed of 176 textual `toast.add(` calls): keys `description` 178 (some calls build two objects via ternary), `type` 113, **`id` 34**, `actionProps` 15, `onClose` 2, `timeout` 1, `title` 0. `type` values: `error` 69, `loading` 18, `success` 16, `info` 6, `warning` 3 (one extra `resume` hit is an unrelated mutation payload); untyped plain messages ~63. **18 `toast.close(id)`**; no `toast.promise/update/success/error` calls and no `toast(…)` function-form calls. `actionProps` are always `{children: <Undo label>, onClick}`. A shared helper `toastError(error, fallback, {allowServerMessage})` lives in `apps/web/src/libs/error-message.ts` and wraps the error shape.
Representative shapes found (`t` = Lingui macro):

```tsx
toast.add({ description: t`Transcript copied` }); // plain
toast.add({ type: "error", description: getReadableErrorMessage(error, fallback) }); // error (69)
toast.add(error ? { type: "error", description } : { type: "success", description }); // conditional object
toast.add({ description, actionProps: { children: t`Undo`, onClick: () => undo() } }); // Undo action (15)
const toastId = toast.add({ type: "loading", description: t`Signing in...` }); // loading (18)
toast.add({ type: "error", description, id: toastId }); // replace the loading toast by id (34 calls use id)
toast.close(toastId); // 18 calls
toast.add({ type: "info", description, id: "auto-save" }); // static id: dedupe/replace
```

Static ids seen: `"auto-save"` (info; builder hotkeys + letter shell), `"pdf-lost-characters"` (warning), `"resume-preview-render-error"` (error), `"webmcp-resume-edit"` / `"webmcp-letter-edit"` (with Undo), `lockedToastId` (draft.ts). Loading-then-replace users: login, register, forgot/reset password, social auth, account link/unlink, picture upload, sign-out, change/enable/disable 2FA.

- Provider config: `limit=1` (only one visible; new replaces old), default `timeout=6000`, undo toasts burn a CSS "fuse"; a close button is shown only when `timeout === 0`; viewport bottom-center.
  HeroUI (verified in docs + installed `dist/components/toast/toast-queue.d.ts`):
- `toast(message: ReactNode, options?: HeroUIToastOptions): string` where `message` is the **title**; options = `{description, indicator, variant: "default"|"accent"|"success"|"warning"|"danger", actionProps: ButtonProps, isLoading, timeout (default 4000, 0 = persistent), onClose}`. Helpers: `toast.success|danger|info|warning(message, opts)`, `toast.update(id, message, opts)`, `toast.promise(promise | () => promise, {loading, success, error})`, `toast.close(key)`, `toast.clear()`, `toast.pauseAll()`, `toast.resumeAll()`, `toast.getQueue()`.
- Rewrite rules: `toast.add({description: X})` -> `toast(X)` (X becomes title text) or `toast("", {description: X})`/`toast(title, {description})` if title/description styling matters (default renderer shows title and description only when truthy); `type:"error"` -> `toast.danger(X)`; `type:"success"|"warning"|"info"` -> `toast.success|warning|info`; `type:"loading"` -> `toast(X, {isLoading: true, timeout: 0})` then `toast.update(id, doneMessage, {variant, timeout: 4000})` or `toast.close(id)`; `actionProps.onClick` -> `actionProps.onPress` (ButtonProps); `toast.close(id)` unchanged; `timeout` 6000 default -> pass `timeout: 6000` or accept 4000; one-at-a-time (`limit=1`) -> `Toast.Provider maxVisibleToasts={1}` (visual-only limit per docs) — HeroUI stacks/expands toasts by default; the undo "fuse" needs a custom `Toast.Provider` children render function (docs "Custom Toast Rendering").
- **Gaps**: HeroUI has **no `id`, `priority`, `data` or `type` options** (key is only returned). The 34 `id:`-bearing calls need rewriting: loading -> result becomes `toast.update(id, message, {variant, timeout})`; static-id dedupe ("auto-save", "pdf-lost-characters", "resume-preview-render-error") has no built-in equivalent (queue always makes a new key; keep a module-level `Map<string,string>` of live keys and `toast.update`/`toast.close` them). `toast.info` maps to variant `accent` (installed `toast-queue.js` comment). Default layout always renders `Toast.CloseButton` (source), while Rezumi shows close only for `timeout === 0` — hide via a custom `Toast.Provider` children render function or CSS. `Toast.Provider` must be rendered once (replaces `Toaster`; `LocalizedToaster` keeps the translated label by passing it to `Toast.CloseButton` in a custom renderer). `limit=1` replace-on-new behaviour is not replicated by `maxVisibleToasts={1}` (visual only; older toasts still queue).
- Test impact: `interview-dialog.test.tsx` mounts `<Toaster>`; HeroUI tests mount `<Toast.Provider/>`.

---

## Part 5 — Open items and risks

1. Routing: `RouterProvider` wiring for TanStack Router is not documented in the MCP docs; verify against React Aria docs and test `Link`, `Tabs`, `ListBox.Item href`, `Table.Row href` client-side navigation.
2. OSS `Sheet` has no docs page via the MCP (only source + installed types); confirm prop details in the installed `.d.ts` before relying on `Sheet.Handle`/`snapPoints`.
3. Docs inconsistencies: dark `--border`/`--separator`/`--overlay`/`--field-background` differ between the Colors-page code block and `get_theme_variables`/swatch tooltips; the Switch anatomy vs Controlled demo nest `Switch.Control` differently (Anatomy: `Switch > Switch.Control + Switch.Content`; demo: `Switch.Content > Switch.Control`). Verify in a browser.
4. Field look: HeroUI default fields have `--field-border: transparent`, `--field-border-width: 0px`, light-mode shadow, dark-mode no shadow; Rezumi's inputs are bordered (`border-line-2`). "Default style" migration changes input appearance globally.
5. HeroUI `Tooltip` default delay 1500 ms vs Rezumi 400 ms; `Toast` default timeout 4 s vs 6 s; `Modal` `Backdrop` is dismissable by default (Base UI dialog also) — verify per dialog.
6. Tailwind source detection: Rezumi's `@import "tailwindcss" source(none)` + two `@source` globs (`packages/ui/src`, `apps/**`) differ from the docs' plain `@import "tailwindcss"`. The docs do not say whether any utility classes live inside `@heroui/react` JS; check rendered HeroUI components for missing utilities (e.g. `animate-in`/`zoom-in-90` used in the Animation docs come from `tw-animate-css`, already imported).
7. Mobile (`apps/mobile`, HeroUI Native) is out of scope here; CLAUDE.md requires web/mobile feature parity, so confirm with the owner that a web-only restyle is acceptable.
