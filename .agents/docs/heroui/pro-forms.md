# HeroUI Pro v3: Forms components, API reference and Rezumi fit

Scope: the 11 "Forms" components of `@heroui-pro/react`, written to guide migrating the Rezumi web app from shadcn/Base UI components in `packages/ui/src/components` to HeroUI default style.

Sources and confidence:

- Docs: `heroui-pro` MCP `get_component_docs` (heroui.pro), fetched 2026-10-29. Every prop and part below appears in those docs unless tagged.
- `(d.ts)` = taken from the installed package types or dist (`apps/web/node_modules/@heroui-pro/react`, version `1.0.0-beta.10`), not from the docs.
- `(unverified)` = inference or React Aria behaviour not shown in the Pro docs. Check before relying on it.
- Rezumi code facts come from the files named in each "Fit" section.

## 1. Cross-cutting facts

### Packages, imports, CSS

- Installed: `@heroui-pro/react` 1.0.0-beta.10 (`pnpm-workspace.yaml` catalog), `@heroui/react` and `@heroui/styles` ^3.2.7. Peers: React 19, Tailwind v4, `react-aria-components`, `motion`.
- CSS is already imported in `packages/ui/src/styles/globals.css` (`tailwindcss`, then `@heroui/styles`, then `@heroui-pro/react/css`). Docs warn that this order matters. No HeroUI component is imported by app code yet.
- Root vs subpath. All 11 also have a per-component subpath export in `package.json` (d.ts), e.g. `@heroui-pro/react/cell-select`.

| Component           | Import                                           |
| ------------------- | ------------------------------------------------ |
| CellColorPicker     | `@heroui-pro/react` (root)                       |
| CellSelect          | root                                             |
| CellSlider          | root                                             |
| CellSwitch          | root                                             |
| CheckboxButtonGroup | root                                             |
| DropZone            | root (also `useDropZonePickerContext` from root) |
| InlineSelect        | root (type `InlineSelectPopoverProps` from root) |
| NativeSelect        | root                                             |
| NumberStepper       | `@heroui-pro/react/number-stepper` ONLY          |
| RadioButtonGroup    | root                                             |
| RichTextEditor      | `@heroui-pro/react/rich-text-editor` ONLY        |

- NumberStepper and RichTextEditor are subpath-only because they need optional peers (`@number-flow/react`, `@tiptap/*`). The root barrel does not export them (d.ts check: 0 references in `dist/index.js`).
- Optional peers are NOT installed in this repo. Resolved from the package's real path: `@number-flow/react`, `@tiptap/core`, `@tiptap/extension-link`, `@tiptap/extension-underline`, `@tiptap/extensions`, `@tiptap/suggestion` all fail to resolve. `apps/web` already has `@tiptap/{starter-kit,pm,react}` 3.32.0 (peer range is `>=3.23.6`). Add the missing ones to `apps/web/package.json` (catalog) before using either component, and expect `knip` to care.
- Other building blocks used in the examples come from `@heroui/react` (OSS): `Label`, `Description`, `FieldError`, `ListBox` (`ListBox.Item`, `ListBox.ItemIndicator`), `ColorArea`, `ColorSlider`, `ColorField`, `ColorSwatch`, `ColorSwatchPicker`, `parseColor`, `Button`, `Surface`, `Chip`. Pro-only helpers in examples: `NumberValue`, `PressableFeedback`.
- Variant naming is NOT uniform: the four `Cell*` components use `'default' | 'secondary'`; `NativeSelect` and `RichTextEditor` use `'primary' | 'secondary'`. Use `secondary` when the control sits on a Surface, Modal, Sheet or Drawer.

### React Aria naming vs Base UI naming (what changes at every call site)

| Concern         | Rezumi today (Base UI)           | HeroUI Pro (React Aria)                                     |
| --------------- | -------------------------------- | ----------------------------------------------------------- |
| Change callback | `onValueChange(value, details)`  | `onChange(value)`                                           |
| Switch value    | `checked` / `onCheckedChange`    | `isSelected` / `onChange(boolean)` / `defaultSelected`      |
| Slider bounds   | `min` / `max`, array value       | `minValue` / `maxValue`, `value` number (single thumb)      |
| Disabled        | `disabled`                       | `isDisabled` (native `disabled` only on NativeSelect)       |
| Press           | `onClick`                        | `onPress` on HeroUI/RAC buttons                             |
| Select value    | string                           | `Key \| null` (`string \| number`), `Key[]` when multiple   |
| Invalid         | `aria-invalid` / `hasError` prop | `isInvalid` (RAC) or manual `aria-invalid` + `data-invalid` |

### How forms are wired today (`packages/ui/src/components/form.tsx`)

- `apps/web/src/libs/tanstack-form.tsx`: `createFormHook` with `fieldComponents: {}` and `formComponents: {}`. No shared field components. Each form renders `form.Field name=...` with a render prop (see `features/auth/pages/login.tsx`, `routes/builder/$resumeId/-sidebar/right/sections/design.tsx`).
- Validation is schema based: `validators: { onChange: zodSchema }` or `onSubmit`. Errors arrive in `field.state.meta.errors`.
- UI primitives: `FormItem` (context `{id, hasError}`, grid gap-1.5), `FormLabel` (`htmlFor={id}-form-item`), `FormControl` (a `useRender` wrapper that injects `id`, `aria-describedby`, `aria-invalid`, publishes `FormControlContext`), `FormDescription`, `FormMessage` (prints the first error message, adds a warning icon when `hasError`).
- Call sites compute `hasError = field.state.meta.isTouched && field.state.meta.errors.length > 0` and pass it to `<FormItem hasError>`.
- Custom controls read the generated id and aria props with `useFormControl()`: `ChipInput`, `Slider` (bridges `id` onto the Base UI thumb input via `inputRef`), `InputGroup`.
- Dev-only `useFormControlWarning` warns when the `FormLabel` target is not a labelable element.

### How HeroUI fields plug in (target pattern)

HeroUI fields are self-contained: label, input, description and error are children of one RAC field root that owns ids and `aria-describedby`. So `FormItem/FormLabel/FormControl/FormDescription/FormMessage` collapse into one root plus `Label`, `Description`, `FieldError` (all from `@heroui/react`).

TextField facts (OSS docs): props `isInvalid`, `isRequired`, `validate`, `validationBehavior: 'native' | 'aria'` (default `'native'`), `validationErrors`, `value`, `defaultValue`, `onChange(value: string)`, `name`, `isDisabled`, `isReadOnly`, `fullWidth`. FieldError shows only when the root is invalid; `children` can be `ReactNode` or `(validation) => ReactNode`. The TextField stylesheet hides `[data-slot="description"]` while the field is invalid, so a Description and a FieldError never show together (Rezumi's `FormDescription` stays visible and stays in `aria-describedby`).

```tsx
import { Description, FieldError, Input, Label, TextField } from "@heroui/react";

const message = (errors: unknown[]) =>
  errors.map((e) => (typeof e === "string" ? e : (e as { message?: string })?.message)).find(Boolean);

<form.Field name="email">
  {(field) => (
    <TextField
      name={field.name}
      value={field.state.value}
      validationBehavior="aria" // keep TanStack Form as the only validator (default is "native")
      isInvalid={field.state.meta.isTouched && field.state.meta.errors.length > 0}
      onBlur={field.handleBlur} // onBlur comes from RAC TextField (unverified in the OSS prop table)
      onChange={field.handleChange}
    >
      <Label>Email</Label>
      <Input />
      <Description>We never share it.</Description>
      <FieldError>{message(field.state.meta.errors)}</FieldError>
    </TextField>
  )}
</form.Field>;
```

Non-text Pro controls follow the same idea but only some have slots for helper/error text:

| Component           | Value prop (type)           | Change callback arg   | Default prop          | Label slot               | Description / error slot in docs                 |
| ------------------- | --------------------------- | --------------------- | --------------------- | ------------------------ | ------------------------------------------------ |
| CellColorPicker     | `value` (`Color` or string) | `Color`               | `defaultValue`        | `.Label` (span)          | none                                             |
| CellSelect          | `value` (`Key \| null`)     | `Key \| null`         | via Select props      | `.Label` (span)          | none                                             |
| CellSlider          | `value` (`number`)          | `number`              | `defaultValue`        | `.Label` (span)          | none                                             |
| CellSwitch          | `isSelected`                | `boolean`             | `defaultSelected`     | `.Label` (span)          | none (compose inside Trigger by hand)            |
| CheckboxButtonGroup | `value` (`string[]`)        | `string[]`            | `defaultValue`        | `<Label>` child of group | `<Description>` child of group; error not shown  |
| RadioButtonGroup    | `value` (`string`)          | `string`              | `defaultValue`        | `<Label>` child of group | `<Description>` child of group; error not shown  |
| InlineSelect        | `value` (`Key \| null`)     | `Key` or `Key[]`      | via Select props      | none (use `aria-label`)  | none                                             |
| NativeSelect        | native `value`              | `ChangeEvent`         | native `defaultValue` | `<Label>` child of root  | `<Description>`, `<FieldError>` children of root |
| NumberStepper       | `value` (`number`)          | `number`              | `defaultValue`        | `<Label>` child of root  | `<Description>` child of root                    |
| RichTextEditor      | `value` (`JSONContent`)     | `(json, details)`     | `defaultValue`        | none                     | none; `<Footer>` for counts                      |
| DropZone            | none (stateless)            | `onSelect` / `onDrop` | none                  | `DropZone.Label`         | `DropZone.Description`                           |

Cross-cutting gotchas:

- All `Cell*` `Label` parts are plain `span`s (docs: "rendered as a span"), and every docs example also passes `aria-label` on the root. Always set `aria-label` (or `aria-labelledby`) on the root, or the control has no accessible name.
- Pro docs list no `FieldError` or `isInvalid` example for any Cell* or RadioButtonGroup/CheckboxButtonGroup. They "support all" props of the wrapped OSS component, so `isInvalid` is likely accepted (unverified). Where to render the error message is not specified. Plan an error line outside the root.
- Components that wrap RAC fields (CellSelect, CellSlider, CellSwitch, NumberStepper, groups) take `name`, `isRequired`, `isInvalid` from the wrapped component (unverified for each; the docs only say "supports all ... props").

## 2. CellColorPicker

Import: `import {CellColorPicker} from "@heroui-pro/react";`

Purpose: settings-row color picker: label on the left, hex text, swatch on the right, popover with whatever picker controls you compose. Wraps HeroUI `ColorPicker` (React Aria `ColorPicker`).

Anatomy (docs):

```
CellColorPicker
  CellColorPicker.Trigger        // row button (RAC Button)
    CellColorPicker.Label        // span
    CellColorPicker.ValueDisplay // hex text read from picker state
    CellColorPicker.Swatch       // HeroUI ColorSwatch
  CellColorPicker.Popover        // you put ColorArea / ColorSlider / ColorSwatchPicker / ColorField inside
```

Props:

| Part                         | Prop                                  | Type                                   | Default        | Notes                                                                                  |
| ---------------------------- | ------------------------------------- | -------------------------------------- | -------------- | -------------------------------------------------------------------------------------- |
| CellColorPicker              | `variant`                             | `'default' \| 'secondary'`             | `'default'`    | plus all RAC `ColorPicker` props except `children`                                     |
| CellColorPicker              | `value` / `defaultValue` / `onChange` | RAC Color or string, `onChange(Color)` | -              | docs: `defaultValue="#3B82F6"` (string), controlled uses `parseColor("#3B82F6")` state |
| CellColorPicker.Trigger      | any RAC `Button` props                | -                                      | -              | `isDisabled` goes HERE in the docs example                                             |
| CellColorPicker.Label        | `children`                            | `ReactNode`                            | -              | span attrs                                                                             |
| CellColorPicker.ValueDisplay | span attrs                            | -                                      | -              | shows hex (e.g. `#FF5733`), automatic                                                  |
| CellColorPicker.Swatch       | HeroUI `ColorSwatch` props            | -                                      | -              |                                                                                        |
| CellColorPicker.Popover      | `placement`                           | `Placement`                            | `'bottom end'` | plus all HeroUI `ColorPicker.Popover` props                                            |

State and events: `onChange` receives a RAC `Color`; read it with `color.toString("hex")` (docs example). `parseColor` is exported from `@heroui/react`; the `Color` type comes from `react-aria-components/ColorArea`.

Validation: none documented.

Gotchas:

- The popover is empty by default. You compose the controls. Docs show `ColorArea` (hsb, x=saturation, y=brightness) + `ColorSlider channel="hue"`; presets via `ColorSwatchPicker` + `ColorSwatchPicker.Item`/`.Swatch` (`size="xs"`); hex entry via `ColorField` with `ColorField.Group`, `.Prefix`, `.Input`.
- `ValueDisplay` shows hex only; nothing in the docs shows an alpha value (unverified: a `ColorSlider channel="alpha"` is a React Aria feature, not shown in the Pro docs).
- Pass a stable `aria-label` on the root (the `Label` is a span).

Example:

```tsx
import { CellColorPicker } from "@heroui-pro/react";
import { ColorArea, ColorSlider, parseColor } from "@heroui/react";

const [color, setColor] = useState(parseColor("#3B82F6"));
<CellColorPicker aria-label="Accent" value={color} onChange={setColor}>
  <CellColorPicker.Trigger>
    <CellColorPicker.Label>Accent</CellColorPicker.Label>
    <CellColorPicker.ValueDisplay />
    <CellColorPicker.Swatch />
  </CellColorPicker.Trigger>
  <CellColorPicker.Popover>
    <ColorArea aria-label="Color area" colorSpace="hsb" xChannel="saturation" yChannel="brightness">
      <ColorArea.Thumb />
    </ColorArea>
    <ColorSlider aria-label="Hue" channel="hue" colorSpace="hsb">
      <ColorSlider.Track>
        <ColorSlider.Thumb />
      </ColorSlider.Track>
    </ColorSlider>
  </CellColorPicker.Popover>
</CellColorPicker>;
```

Fit for Rezumi:

- Current: `apps/web/src/components/input/color-picker.tsx` (4 call sites: design section, entries, picture settings, stylesheet editor). Swatch-only trigger, popover with 16 `rgba(...)` presets plus `@uiw/react-color-colorful` (saturation, hue, alpha). Props `value/defaultValue/onChange(string)`, `open/onOpenChange/onOpenChangeComplete`, custom `trigger`, extra `children`. Resume data stores `rgba(r, g, b, a)` strings (`colorDesignSchema`).
- Mismatch 1: Cell is a labelled row (label + hex + swatch). Rezumi's trigger is a bare swatch next to a text `Input` and sometimes anchored to arbitrary elements (stylesheet editor controls `open` and a custom `trigger`). Cell exposes neither; for those use the OSS `color-picker` (listed in the OSS components) or a Popover.
- Mismatch 2: type. HeroUI emits a `Color` object, Rezumi stores an rgba string. Needs a conversion at the field boundary: `parseColor(rgbaString)` in, `color.toString("rgba")` out (RAC color format, unverified in the Pro docs). Round-trip of alpha must be tested; `ValueDisplay` hides it.
- Good fit: only where a labelled settings row is wanted (e.g. the Design panel color rows) and alpha is not needed in that row.
- Lacks vs current: custom trigger, controlled open state, built-in preset grid (compose `ColorSwatchPicker`), alpha display.

## 3. CellSelect

Import: `import {CellSelect} from "@heroui-pro/react";` (list items use OSS `ListBox`).

Purpose: settings-row dropdown (label left, selected value right, chevron). Wraps HeroUI `Select`.

Anatomy:

```
CellSelect
  CellSelect.Trigger
    CellSelect.Label        // span
    CellSelect.Value        // selected text; children can be a render function
    CellSelect.Indicator    // chevron; default ChevronsExpandVertical icon
  CellSelect.Popover
    ListBox > ListBox.Item(id, textValue) > text + ListBox.ItemIndicator
```

Props:

| Part                 | Prop                                            | Type                         | Default        | Notes                                                                                                     |
| -------------------- | ----------------------------------------------- | ---------------------------- | -------------- | --------------------------------------------------------------------------------------------------------- |
| CellSelect           | `variant`                                       | `'default' \| 'secondary'`   | `'default'`    | all HeroUI `Select` props except `variant`                                                                |
| CellSelect           | `value`, `onChange`, `isDisabled`, `aria-label` | `Key \| null`, `(v) => void` | -              | docs: `onChange={(v) => setTheme(v as Key \| null)}`                                                      |
| CellSelect.Trigger   | HeroUI `Select.Trigger` props                   | -                            | -              |                                                                                                           |
| CellSelect.Label     | `children`                                      | `ReactNode`                  | -              | span                                                                                                      |
| CellSelect.Value     | HeroUI `Select.Value` props                     | render fn                    | -              | render args: `{defaultChildren, isPlaceholder, state}`; docs type it `any`; `state.selectedItems[0]?.key` |
| CellSelect.Indicator | `children`                                      | `ReactNode`                  | chevron icon   | custom icon                                                                                               |
| CellSelect.Popover   | `placement`                                     | `Placement`                  | `'bottom end'` | all HeroUI `Select.Popover` props                                                                         |

State: controlled with `value`/`onChange` in every docs example; items need `id` and `textValue`. Disabled: `isDisabled` on the root. Multi-select is demonstrated only for InlineSelect (section 8); CellSelect's d.ts is generic over `"single" | "multiple"` (d.ts).

Validation: none documented.

Gotchas: `aria-label` on root needed. Popover is positioned `bottom end`. A custom value renderer is possible (icon + text, `Ag` font preview).

Example:

```tsx
import { CellSelect } from "@heroui-pro/react";
import { ListBox, type Key } from "@heroui/react";

const [theme, setTheme] = useState<Key | null>("default");
<CellSelect aria-label="Theme" value={theme} onChange={(v) => setTheme(v)}>
  <CellSelect.Trigger>
    <CellSelect.Label>Theme</CellSelect.Label>
    <CellSelect.Value />
    <CellSelect.Indicator />
  </CellSelect.Trigger>
  <CellSelect.Popover>
    <ListBox>
      <ListBox.Item id="default" textValue="Default">
        Default
        <ListBox.ItemIndicator />
      </ListBox.Item>
      <ListBox.Item id="dark" textValue="Dark">
        Dark
        <ListBox.ItemIndicator />
      </ListBox.Item>
    </ListBox>
  </CellSelect.Popover>
</CellSelect>;
```

Fit for Rezumi:

- Current: `NativeSelect` (8 files, e.g. `routes/builder/$resumeId/-components/design-panel.tsx`, `features/resume/editor/check/job-match.tsx`) and `Combobox` (12 files). No ListBox-based select exists in `packages/ui`.
- Candidate for builder side-panel settings rows (design panel) where the label-left/value-right layout matches. Not a candidate for stacked label-above forms (use NativeSelect or OSS `select`/`autocomplete`).
- Lacks vs current: native OS picker on touch devices (`NativeSelect` has `pointer-coarse:h-11`; the mobile web experience of a custom popover select differs), no description/error slot, id values are `Key` not plain string typed.

## 4. CellSlider

Import: `import {CellSlider} from "@heroui-pro/react";`

Purpose: the slider track IS the row: tinted fill shows the value, label sits at the left and value output at the right inside the track. Always horizontal. Wraps HeroUI `Slider`.

Anatomy (docs usage nests Fill/Thumb/Label/Output inside Track):

```
CellSlider
  CellSlider.Track
    CellSlider.Fill
    CellSlider.Thumb      // transparent hit area; ::after draws a 3px pill
    CellSlider.Label      // span, absolutely positioned left
    CellSlider.Output     // absolutely positioned right
```

Props:

| Part                    | Prop                              | Type                       | Default     | Notes                                                                 |
| ----------------------- | --------------------------------- | -------------------------- | ----------- | --------------------------------------------------------------------- |
| CellSlider              | `variant`                         | `'default' \| 'secondary'` | `'default'` | all HeroUI `Slider` props EXCEPT `variant` and `orientation`          |
| CellSlider              | `value`/`defaultValue`/`onChange` | `number`, `(v) => void`    | -           | docs: `onChange={(v) => setSpacing(v as number)}`                     |
| CellSlider              | `minValue`, `maxValue`, `step`    | `number`                   | -           | e.g. `0..1` step `0.01`, or `0..100` step `1`                         |
| CellSlider              | `formatOptions`                   | `Intl.NumberFormatOptions` | -           | docs only show `{maximumFractionDigits: 2, minimumFractionDigits: 2}` |
| CellSlider              | `isDisabled`, `aria-label`        | -                          | -           |                                                                       |
| Track/Fill/Thumb/Output | HeroUI `Slider.*` props           | -                          | -           |                                                                       |
| CellSlider.Label        | `children`                        | `ReactNode`                | -           | span                                                                  |

State: controlled number. Validation: none. Gotcha: single thumb only is shown; multi-thumb is not documented for Cell.

Example:

```tsx
import { CellSlider } from "@heroui-pro/react";

const [volume, setVolume] = useState(75);
<CellSlider
  aria-label="Volume"
  minValue={0}
  maxValue={100}
  step={1}
  value={volume}
  onChange={(v) => setVolume(v as number)}
>
  <CellSlider.Track>
    <CellSlider.Fill />
    <CellSlider.Thumb />
    <CellSlider.Label>Volume</CellSlider.Label>
    <CellSlider.Output />
  </CellSlider.Track>
</CellSlider>;
```

Fit for Rezumi:

- Current: `packages/ui/src/components/slider.tsx` (Base UI, 5 files: `style-groups.tsx`, `picture-settings.tsx`, `template-group.tsx`, `entries.tsx`, `layout/index.tsx`). Features: array values (range-capable), `thumbAlignment="edge"`, id/aria bridging through `useFormControl()`. Call sites render a separate label row, a custom mono readout (`{size} pt`) and a hint line under the slider.
- Migration is a layout change: label and readout move inside the track. A custom unit readout needs `Output` `formatOptions`/children (children support is not shown in docs: unverified). Hint text has no slot.
- Prop map: `min/max` -> `minValue/maxValue`, `value=[n]` -> `value={n}`, `onValueChange(arr)` -> `onChange(n)`.
- Lacks vs current: range (multi-thumb), vertical orientation, FormControl integration, description/error text.

## 5. CellSwitch

Import: `import {CellSwitch} from "@heroui-pro/react";`

Purpose: toggle styled as a settings row; the whole row is the hit target. Wraps HeroUI `Switch`.

Anatomy:

```
CellSwitch
  CellSwitch.Trigger     // HeroUI Switch.Content = a <label>; the whole row toggles
    CellSwitch.Label     // span
    CellSwitch.Control   // default HeroUI Switch.Thumb when no children
```

Props:

| Part               | Prop                                          | Type                                     | Default      | Notes                                      |
| ------------------ | --------------------------------------------- | ---------------------------------------- | ------------ | ------------------------------------------ |
| CellSwitch         | `variant`                                     | `'default' \| 'secondary'`               | `'default'`  | all HeroUI `Switch` props except `variant` |
| CellSwitch         | `isSelected` / `onChange` / `defaultSelected` | `boolean`, `(selected: boolean) => void` | -            | `onChange={setEnabled}` works directly     |
| CellSwitch         | `isDisabled`, `aria-label`                    | -                                        | -            |                                            |
| CellSwitch.Trigger | `children`                                    | `ReactNode`                              | -            | all HeroUI `Switch.Content` props          |
| CellSwitch.Label   | `children`                                    | `ReactNode`                              | -            | span                                       |
| CellSwitch.Control | `children`                                    | `ReactNode`                              | Switch.Thumb | all HeroUI `Switch.Control` props          |

Validation: none. Gotcha: the card title says "label and description" but the anatomy has NO description part. The "Feature Announcement" example puts a two-line `div` (title + muted text) inside `CellSwitch.Trigger`, overrides `className="h-auto"` on both root and trigger and adds a border. Description is hand-built and not wired to `aria-describedby`.

Example:

```tsx
import { CellSwitch } from "@heroui-pro/react";

const [enabled, setEnabled] = useState(true);
<CellSwitch aria-label="Animations" isSelected={enabled} onChange={setEnabled}>
  <CellSwitch.Trigger>
    <CellSwitch.Label>Animations</CellSwitch.Label>
    <CellSwitch.Control />
  </CellSwitch.Trigger>
</CellSwitch>;
```

Fit for Rezumi:

- Current: `SwitchRow` in `packages/ui/src/components/switch.tsx` (label + optional description on the left, track on the right, `aria-labelledby`/`aria-describedby`). 7 files: `share-panel.tsx`, `style-groups.tsx`, `schedule-sheet.tsx`, `career/workspace/prepare.tsx`, `homepage/remember.tsx`, letter `design-panel.tsx` and `write-panel.tsx`. `<Switch` appears in about 15 files.
- Map: `checked/onCheckedChange` -> `isSelected/onChange`; `label` prop -> `CellSwitch.Label`; `description` -> hand-built text inside `Trigger`; add `aria-label`.
- Visual difference: Cell is a filled/bordered "cell"; `SwitchRow` is a flat row. For flat rows with a description the OSS `Switch` is the closer base (not documented here).
- Lacks vs current: description slot with `aria-describedby`, the "checked row on accent tint" contrast tweak, `touch-target` hit area handling (row is already full width).

## 6. CheckboxButtonGroup

Import: `import {CheckboxButtonGroup} from "@heroui-pro/react";`

Purpose: multi-select as a set of selectable cards, each with an optional corner indicator, icon and title/description. Wraps HeroUI `CheckboxGroup` with card layout.

Anatomy:

```
CheckboxButtonGroup            // group; <Label> and <Description> from @heroui/react are direct children
  CheckboxButtonGroup.Item     // wraps HeroUI Checkbox; children can be a render prop ({isSelected})
    CheckboxButtonGroup.ItemIcon      // leading icon box
    CheckboxButtonGroup.ItemContent   // wraps Checkbox.Content (title + description)
    CheckboxButtonGroup.Indicator     // top-right; no children = default checkbox, children = icon shown only when selected
```

Props:

| Part                            | Prop                                                                 | Type                                       | Default  | Notes                                                                                            |
| ------------------------------- | -------------------------------------------------------------------- | ------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------ |
| CheckboxButtonGroup             | `layout`                                                             | `'flex' \| 'grid'`                         | `'flex'` | all HeroUI `CheckboxGroup` props                                                                 |
| CheckboxButtonGroup             | `value`, `defaultValue`, `onChange`, `name`, `isDisabled`, `variant` | `string[]`, `(v: string[]) => void`        | -        | `variant="secondary"` is used in most docs examples but is NOT in the Pro prop table (inherited) |
| CheckboxButtonGroup.Item        | `value`, `children`                                                  | `string`, node or `({isSelected}) => node` | -        | all HeroUI `Checkbox` props                                                                      |
| CheckboxButtonGroup.Indicator   | `children`                                                           | `ReactNode`                                | -        | span attrs                                                                                       |
| CheckboxButtonGroup.ItemContent | `children`                                                           | `ReactNode`                                | -        | div attrs                                                                                        |
| CheckboxButtonGroup.ItemIcon    | `children`                                                           | `ReactNode`                                | -        | div attrs                                                                                        |

Grid: set `layout="grid"` and a Tailwind column class (`grid-cols-3`); put `<Label className="col-span-full">` as the group title. A ripple is added with `<PressableFeedback.Ripple />` inside an Item.

CSS: variable `--checkbox-button-group-item-radius` (default `var(--radius-2xl)`); selected = `[data-selected="true"]` on `.checkbox-button-group__item`.

Validation: none shown (group `isDisabled` only).

Example:

```tsx
import { CheckboxButtonGroup } from "@heroui-pro/react";
import { Description, Label } from "@heroui/react";

<CheckboxButtonGroup name="features" value={selected} variant="secondary" onChange={setSelected}>
  <Label>Select features</Label>
  <Description>Choose all that apply</Description>
  {features.map((f) => (
    <CheckboxButtonGroup.Item key={f.value} value={f.value}>
      <CheckboxButtonGroup.Indicator />
      <CheckboxButtonGroup.ItemContent>
        <Label>{f.title}</Label>
        <Description>{f.description}</Description>
      </CheckboxButtonGroup.ItemContent>
    </CheckboxButtonGroup.Item>
  ))}
</CheckboxButtonGroup>;
```

Fit for Rezumi:

- Current: `Checkbox` (`packages/ui/src/components/checkbox.tsx`, single boxes in about 14 files). No card-style multi-select exists.
- Use only for new card-style multi-choices (for example choosing export formats or sections). It does not replace a single `Checkbox` row or a checkbox list in forms. For plain checkboxes use OSS `checkbox` / `checkbox-group`.
- Value is `string[]`, which maps cleanly to `field.state.value` / `field.handleChange`. No error slot: render the message below.

## 7. DropZone

Import: `import {DropZone} from "@heroui-pro/react";` (hook: `useDropZonePickerContext`).

Purpose: drag-and-drop file area plus a browse trigger and an animated file list. It is a UI shell. It does not hold files, validate them or upload them.

Anatomy:

```
DropZone                      // root div (render prop `render`); provides picker context
  DropZone.Area               // RAC DropZone: onDrop, getDropOperation, isDisabled ...
    DropZone.Icon             // default cloud-upload icon when empty
    DropZone.Label            // RAC Text slot="label"
    DropZone.Description
    DropZone.Trigger          // RAC Button that opens the file picker; default text "Select files"
  DropZone.Input              // hidden <input type="file">; sits OUTSIDE Area
  DropZone.FileList           // Motion AnimatePresence; may be used without Area
    DropZone.FileItem         // status: uploading | complete | failed
      DropZone.FileFormatIcon // format="PDF", color
      DropZone.FileInfo
        DropZone.FileName
        DropZone.FileMeta
      DropZone.FileProgress > FileProgressTrack > FileProgressFill   // HeroUI ProgressBar, size default 'sm'
      DropZone.FileRetryTrigger
      DropZone.FileRemoveTrigger
```

Props:

| Part                                 | Prop                                            | Type                                                           | Default  | Notes                                                                                            |
| ------------------------------------ | ----------------------------------------------- | -------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------ |
| DropZone                             | `className`, `render`, children                 | `string`, `DOMRenderFunction`                                  | -        | plus native div attrs                                                                            |
| DropZone.Area                        | `onDrop`, `getDropOperation`, `isDisabled`, ... | RAC DropZone props                                             | -        | `getDropOperation={(types) => types.has("image/png") ? "copy" : "cancel"}` filters drops by MIME |
| DropZone.Input                       | `accept`                                        | `string`                                                       | -        | e.g. `"image/*,.pdf"`, `".csv,.xlsx"`                                                            |
| DropZone.Input                       | `multiple`                                      | `boolean`                                                      | -        |                                                                                                  |
| DropZone.Input                       | `onSelect`                                      | `(files: FileList) => void`                                    | -        | called for picker selection only; d.ts omits native `onChange`, `type`                           |
| DropZone.Trigger                     | RAC Button props                                | -                                                              | -        | `isDisabled`                                                                                     |
| DropZone.FileItem                    | `status`                                        | `'uploading' \| 'complete' \| 'failed'`                        | -        | drives `[data-status]`                                                                           |
| DropZone.FileFormatIcon              | `format`, `color`                               | `string`, `'blue'\|'gray'\|'green'\|'orange'\|'purple'\|'red'` | `'gray'` | color union from d.ts                                                                            |
| DropZone.FileProgress                | `size` + ProgressBar props (`value`)            | `string`                                                       | `'sm'`   |                                                                                                  |
| FileRetryTrigger / FileRemoveTrigger | RAC Button props                                | `onPress`                                                      | -        | give `aria-label` on remove                                                                      |

State and events:

- Drop: `Area onDrop(e)` where `e.items` is an array; for each `item.kind === "file"` call `await item.getFile()` (docs pattern, cast `as any` in examples). Picker: `Input onSelect(fileList)`.
- Custom triggers: any component under `DropZone` can call `useDropZonePickerContext().openFilePicker` (docs use `Button`, `Link`).
- The input clears itself after each pick (`e.target.value = ""` in dist), so picking the same file twice works, but the input never keeps a value for native form submission.

Validation: NONE built in. The "Max Size Limit" example filters `file.size > MAX_SIZE` by hand in both handlers and shows its own error text. `accept` only filters the picker, `getDropOperation` only filters drops by MIME. There is no single-file mode: with a plain `Input`, a multi-file drop still delivers all items.

Disabled: set `isDisabled` on BOTH `DropZone.Area` and `DropZone.Trigger`.

Example:

```tsx
import { DropZone } from "@heroui-pro/react";

<DropZone className="w-[420px]">
  <DropZone.Area
    getDropOperation={(types) => (types.has("application/pdf") ? "copy" : "cancel")}
    onDrop={async (e: any) => {
      const item = e.items.find((i: any) => i.kind === "file");
      if (item?.getFile) onFile(await item.getFile());
    }}
  >
    <DropZone.Icon />
    <DropZone.Label>Drag a PDF here or click to browse</DropZone.Label>
    <DropZone.Description>PDF up to 10 MB.</DropZone.Description>
    <DropZone.Trigger>Select file</DropZone.Trigger>
  </DropZone.Area>
  <DropZone.Input accept="application/pdf" onSelect={(files) => onFile(files[0]!)} />
</DropZone>;
```

CSS states: `[data-drop-target="true"]` (accent border) and `[data-disabled="true"]` on `.drop-zone__area`; `[data-status="uploading|complete|failed"]` on `.drop-zone__file-item`.

Fit for Rezumi:

- Current: `apps/web/src/features/applications/components/file-attachment-field.tsx` (3 usages: `application-form-sheet.tsx` x2, `detail/sent-documents.tsx` x2). A dashed "Attach..." button opens a hidden `<input type="file" accept="application/pdf">`. One PDF only; it checks `file.type !== "application/pdf"` and toasts `Choose a PDF file.`; value is `FileAttachment | File | null` (saved attachment renders as a link, a local `File` as its name), `onChange(File | null)`, `disabled`.
- Gains: drag-and-drop (not present today), file-type icon and list animation.
- Must keep in a wrapper: PDF validation and toast (use `getDropOperation` + `accept` + the same `file.type` check in both handlers), single-file slicing, the saved-attachment link (FileName is a span; compose an `<a>` inside it, unverified), the remove action (`FileRemoveTrigger onPress`), the `File | FileAttachment | null` value model, `disabled` on both Area and Trigger. The page uses the label-less pattern ("the file picker has no labelable control").
- Drop is desktop-only. Touch users still use the Trigger, so the wrapper must always render it. Mobile app parity is unaffected (separate picker).

## 8. InlineSelect

Import: `import {InlineSelect} from "@heroui-pro/react";` (type `InlineSelectPopoverProps`).

Purpose: ghost dropdown that reads like text inside a sentence or toolbar, with no field chrome. Wraps HeroUI `Select`.

Anatomy:

```
InlineSelect
  InlineSelect.Trigger
    InlineSelect.Value       // truncated selected text
    InlineSelect.Indicator   // inline chevron; default ChevronsExpandVertical
  InlineSelect.Popover
    ListBox > ListBox.Item(id, textValue) > text + ListBox.ItemIndicator
```

Props:

| Part                   | Prop                                  | Type        | Default        | Notes                                                         |
| ---------------------- | ------------------------------------- | ----------- | -------------- | ------------------------------------------------------------- |
| InlineSelect           | `children`, all HeroUI `Select` props | -           | -              | `value`, `onChange`, `aria-label`, `selectionMode="multiple"` |
| InlineSelect.Trigger   | HeroUI `Select.Trigger` props         | -           | -              | may hold custom content (team switcher example)               |
| InlineSelect.Value     | HeroUI `Select.Value` props           | -           | -              |                                                               |
| InlineSelect.Indicator | `children`                            | `ReactNode` | chevron        | e.g. `ChevronRight` with `rtl:-scale-x-100`                   |
| InlineSelect.Popover   | `placement`                           | `Placement` | `'bottom end'` | all HeroUI `Select.Popover` props; set width with `className` |

Multi-select (docs): `selectionMode="multiple"` on the root, `value={keys}` (`Key[]`), `onChange={(k) => setKeys(k as Key[])}`, and `<ListBox selectionMode="multiple">`.

CSS variables: `--inline-select-value-max-width` (default `12rem`), `--inline-select-indicator-size` (default `0.75rem`). Classes: `.inline-select`, `__trigger`, `__value`, `__indicator` (`[data-open="true"]`), `__popover`. States: hover text color, focus-visible ring, disabled opacity.

Validation: none (docs: "without a full form field").

Example:

```tsx
import { InlineSelect } from "@heroui-pro/react";
import { ListBox, type Key } from "@heroui/react";

const [lang, setLang] = useState<Key | null>("en");
<InlineSelect aria-label="Language" value={lang} onChange={(v) => setLang(v)}>
  <InlineSelect.Trigger>
    <InlineSelect.Value />
    <InlineSelect.Indicator />
  </InlineSelect.Trigger>
  <InlineSelect.Popover className="w-[140px]">
    <ListBox>
      <ListBox.Item id="en" textValue="English">
        English
        <ListBox.ItemIndicator />
      </ListBox.Item>
      <ListBox.Item id="es" textValue="Spanish">
        Spanish
        <ListBox.ItemIndicator />
      </ListBox.Item>
    </ListBox>
  </InlineSelect.Popover>
</InlineSelect>;
```

Fit for Rezumi:

- No current counterpart in `packages/ui`. Possible uses: compact unit pickers next to numeric fields (the typography and page sections show units such as "pt" as an `InputGroupAddon`), sort/filter pickers in toolbars, "Letter / A4" style inline choices.
- Not a form field: needs `aria-label`, no label/description/error. Do not use for required form values.

## 9. NativeSelect

Import: `import {NativeSelect} from "@heroui-pro/react";`

Purpose: styled wrapper around the real HTML `<select>` with label, description and invalid styling. No JS popover, so the OS picker is used (best for touch).

Anatomy (docs):

```
NativeSelect                    // root div: label, trigger, description, error live here
  Label / Description / FieldError   // from @heroui/react, direct children of the root
  NativeSelect.Trigger          // wrapper div + the real <select>; children are options AND the indicator
    NativeSelect.Option         // <option>
    NativeSelect.OptGroup       // <optgroup label>
      NativeSelect.Option
    NativeSelect.Indicator      // chevron, INSIDE Trigger as the last child
```

Props:

| Part                   | Prop                  | Type                                                                                      | Default     | Notes                                                               |
| ---------------------- | --------------------- | ----------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------- |
| NativeSelect           | `variant`             | `'primary' \| 'secondary'`                                                                | `'primary'` | `secondary` = default background, no shadow                         |
| NativeSelect           | `fullWidth`           | `boolean`                                                                                 | `false`     |                                                                     |
| NativeSelect           | `children`            | `ReactNode`                                                                               | -           | plus native div attrs (`className`, `data-invalid`, `aria-invalid`) |
| NativeSelect.Trigger   | `className`           | `string`                                                                                  | -           | applied to the `<select>`                                           |
| NativeSelect.Trigger   | `wrapperClassName`    | `string`                                                                                  | -           | applied to the wrapper div                                          |
| NativeSelect.Trigger   | native select attrs   | `name`, `value`, `defaultValue`, `onChange`, `disabled`, `required`, `id`, `aria-invalid` | -           | `onChange` is the native `ChangeEvent`                              |
| NativeSelect.Option    | native option attrs   | `value`, `disabled`                                                                       | -           |                                                                     |
| NativeSelect.OptGroup  | native optgroup attrs | `label`, `disabled`                                                                       | -           |                                                                     |
| NativeSelect.Indicator | `children`            | `ReactNode`                                                                               | chevron SVG | custom icon                                                         |

State: uncontrolled by default, or `value` + `onChange={(e) => setValue(e.target.value)}`. Native `FormData` works (`name`, `required`; the docs "Form Example" reads `new FormData(form)`).

Validation: manual. The docs "Invalid State" sets `aria-invalid="true"` AND `data-invalid="true"` on the root, `aria-invalid="true"` on the Trigger, and renders `<FieldError>` as a child. There is no `isInvalid` prop and no automatic message association documented.

Gotchas:

- The docs examples render `<Label>` without `htmlFor`/`id`. Association is not documented. Pass `id` on `NativeSelect.Trigger` and `htmlFor` on `Label` to be safe (unverified that HeroUI wires it automatically).
- The `NativeSelect.Indicator` goes inside `Trigger`, unlike Rezumi's sibling icon.
- Empty first option is the placeholder pattern: `<NativeSelect.Option value="">Select status</NativeSelect.Option>`.

Example:

```tsx
import { NativeSelect } from "@heroui-pro/react";
import { Description, Label } from "@heroui/react";

<NativeSelect fullWidth>
  <Label htmlFor="status">Status</Label>
  <NativeSelect.Trigger id="status" name="status" value={value} onChange={(e) => setValue(e.target.value)}>
    <NativeSelect.Option value="">Select status</NativeSelect.Option>
    <NativeSelect.Option value="todo">Todo</NativeSelect.Option>
    <NativeSelect.Option value="done">Done</NativeSelect.Option>
    <NativeSelect.Indicator />
  </NativeSelect.Trigger>
  <Description>Choose the current task status</Description>
</NativeSelect>;
```

CSS: `[data-invalid="true"]` or `[aria-invalid="true"]` on `.native-select` drives the error look; `--secondary` and `--full-width` modifiers.

Fit for Rezumi:

- Current: `packages/ui/src/components/native-select.tsx` (28 lines): `div.relative` + `select` with `inputBaseClassName`, `h-9`, `pointer-coarse:h-11`, caret `Icon`; props spread to the `<select>`. 8 call sites (`facts.tsx`, `practise.tsx`, `schedule-sheet.tsx`, `job-match.tsx`, `import-applications-sheet.tsx`, `documents-page.tsx`, builder and letter design/write panels).
- Best match in this set. Keep the same wrapper name: re-implement `NativeSelect` in `packages/ui` on top of HeroUI so call sites keep passing `<option>` children; replace the `Icon` caret with `NativeSelect.Indicator`; map `className` to `Trigger className` (select) and `wrapperClassName`; add `pointer-coarse:h-11` yourself.
- FormControl: today `FormControl render={<NativeSelect/>}` injects `id`, `aria-describedby`, `aria-invalid` onto the `<select>`. After migration, forward those onto `NativeSelect.Trigger` and also set `data-invalid` on the root, because the Pro styling reads `[data-invalid]`/`[aria-invalid]` on `.native-select`.
- Lacks vs current: automatic error/description association, `isInvalid` prop.

## 10. NumberStepper

Import: `import {NumberStepper} from "@heroui-pro/react/number-stepper";` (SUBPATH ONLY; needs peer `@number-flow/react` >= 0.5.0, not installed in this repo).

Purpose: compact `- value +` stepper with an animated number (Number Flow). Wraps RAC `NumberField`.

Anatomy:

```
NumberStepper              // RAC NumberField; Label and Description are direct children
  Label / Description      // from @heroui/react (docs "With Label")
  NumberStepper.Group      // RAC Group; renders a hidden input for accessibility
    NumberStepper.DecrementButton   // RAC Button slot="decrement", default minus icon
    NumberStepper.Value             // Number Flow display; children may be a render function
    NumberStepper.IncrementButton   // RAC Button slot="increment", default plus icon
```

Order inside `Group` is free (docs "Reversed Layout" puts Increment first). To restyle the buttons, use your own `Button` with `slot="decrement"` / `slot="increment"` (docs, `isIconOnly size="sm" variant=...`).

Props:

| Part                      | Prop                                                                                            | Type                                                 | Default | Notes                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------- | -------------------------------------------------------------------------------- |
| NumberStepper             | `size`                                                                                          | `'sm' \| 'md' \| 'lg'`                               | `'md'`  |                                                                                  |
| NumberStepper             | `formatOptions`                                                                                 | `Format` (Number Flow)                               | -       | docs: `{currency: "USD", style: "currency"}`, `{style: "unit", unit: "percent"}` |
| NumberStepper             | `value`, `defaultValue`, `onChange`, `minValue`, `maxValue`, `step`, `isDisabled`, `aria-label` | RAC NumberField props                                | -       | `onChange(value: number)`                                                        |
| NumberStepper.Value       | `value`                                                                                         | `number`                                             | root's  | override                                                                         |
| NumberStepper.Value       | `format`                                                                                        | `Format`                                             | -       |                                                                                  |
| NumberStepper.Value       | `children`                                                                                      | `ReactNode \| ({value, formatOptions}) => ReactNode` | -       | docs: `{value} {value === 1 ? "item" : "items"}`                                 |
| Decrement/IncrementButton | RAC Button props                                                                                | -                                                    | -       |                                                                                  |

Validation: only bounds (`minValue`/`maxValue`) and `step`. No error slot. CSS exposes `[data-disabled="true"]` on the buttons (docs do not say they disable at the bounds).

Gotchas:

- There is NO typeable text input in the documented anatomy: the visible number is an animated display and the only `input` is a hidden one "for accessibility". Do not use it where users must type "11.5".
- Group has a background by default; custom buttons example uses `className="gap-3 bg-transparent"` to remove it.
- Decimal values need `step` and fraction-digit `formatOptions` so the display shows them (docs don't show decimals; unverified). React Aria `NumberField` reports `NaN` when emptied (RAC behaviour, unverified in the Pro docs).

Example:

```tsx
import { NumberStepper } from "@heroui-pro/react/number-stepper";

<NumberStepper aria-label="Columns" value={n} minValue={1} maxValue={4} onChange={setN}>
  <NumberStepper.Group>
    <NumberStepper.DecrementButton />
    <NumberStepper.Value />
    <NumberStepper.IncrementButton />
  </NumberStepper.Group>
</NumberStepper>;
```

Fit for Rezumi:

- Current: `apps/web/src/components/input/number-input.tsx` (37 lines, 5 files: typography section, page section, layout section, picture settings). Features: typed `<input type=number>` inside `InputGroupInput`, local draft text so partial values like "12" with `min=6` can be typed, clamps to `min`/`max`, supports fractional steps (`step={0.1}` font size 6-24, `step={0.05}` line height 0.5-4), unit addon (`pt`, etc.), `onBlur` for TanStack Form, `value: number` / `onValueChange`.
- DO NOT replace `NumberInput` with NumberStepper. It loses typing, fractional entry and the unit addon. Possible use: small integer counters that are only clicked (for example a column count) if the animated look is wanted.
- For a typeable HeroUI numeric field look at OSS `number-field` (listed in the OSS components; not documented here).
- Cost: extra peer `@number-flow/react` in the web bundle.

## 11. RadioButtonGroup

Import: `import {RadioButtonGroup} from "@heroui-pro/react";`

Purpose: single-select as selectable cards (radio with optional indicator, icon, title and description). Wraps HeroUI `RadioGroup`.

Anatomy: identical shape to CheckboxButtonGroup.

```
RadioButtonGroup                // <Label> and <Description> from @heroui/react are direct children
  RadioButtonGroup.Item         // wraps HeroUI Radio; children may be a render prop ({isSelected})
    RadioButtonGroup.ItemIcon
    RadioButtonGroup.ItemContent  // wraps Radio.Content
    RadioButtonGroup.Indicator    // no children = radio dot; children = custom icon shown only when selected
```

Props:

| Part                               | Prop                                                                 | Type                                       | Default  | Notes                                                                   |
| ---------------------------------- | -------------------------------------------------------------------- | ------------------------------------------ | -------- | ----------------------------------------------------------------------- |
| RadioButtonGroup                   | `layout`                                                             | `'flex' \| 'grid'`                         | `'flex'` | all HeroUI `RadioGroup` props                                           |
| RadioButtonGroup                   | `value`, `defaultValue`, `onChange`, `name`, `isDisabled`, `variant` | `string`, `(v: string) => void`            | -        | `variant="secondary"` appears in examples but not in the Pro prop table |
| RadioButtonGroup.Item              | `value`, `children`                                                  | `string`, node or `({isSelected}) => node` | -        | all HeroUI `Radio` props                                                |
| Indicator / ItemContent / ItemIcon | `children`                                                           | `ReactNode`                                | -        | span / div / div attrs                                                  |

State: controlled with `value` + `onChange={setValue}`. Validation: none shown. No-indicator variant: omit `Indicator`. Ripple: `<PressableFeedback.Ripple />` inside an Item.

CSS: variable `--radio-button-group-item-radius` (default `var(--radius-2xl)`); selected = `[data-selected="true"]` on `.radio-button-group__item`.

Example:

```tsx
import { RadioButtonGroup } from "@heroui-pro/react";
import { Description, Label } from "@heroui/react";

<RadioButtonGroup name="plan" value={plan} variant="secondary" onChange={setPlan}>
  <Label>Select a plan</Label>
  <Description>Choose the plan that suits you</Description>
  {plans.map((p) => (
    <RadioButtonGroup.Item key={p.value} value={p.value}>
      <RadioButtonGroup.Indicator />
      <RadioButtonGroup.ItemContent>
        <Label>{p.title}</Label>
        <Description>{p.description}</Description>
      </RadioButtonGroup.ItemContent>
    </RadioButtonGroup.Item>
  ))}
</RadioButtonGroup>;
```

Fit for Rezumi:

- Current: `RadioGroup` / `RadioGroupItem` (`packages/ui/src/components/radio-group.tsx`, 18px circle + separate label; used by `features/applications/components/detail/close-dialog.tsx` as a plain list) and `SegmentedControl` (`segmented-control.tsx`, 15 files, Base UI radios on a sunken track). `entries-group.tsx` and `template-group.tsx` use Base UI `RadioGroup`/`Radio.Root` directly, not the `packages/ui` wrapper.
- RadioButtonGroup is a CARD chooser. It is not a replacement for plain radio rows like `close-dialog.tsx` (use OSS `radio-group`), nor for the compact `SegmentedControl` or the pill filters in `template-group.tsx` (the Pro list has a separate `segment` component under Navigation; not reviewed here).
- Best candidate: `features/resume/editor/design/entries-group.tsx` "Header layout", a `grid-cols-3` set of bordered cards, each with a wireframe and a label, selected state = accent border. That is `layout="grid"` + `ItemContent` holding the wireframe + `Label`, with `Indicator` omitted. `value`/`onChange(string)` maps directly to TanStack Form.
- Prop map: Base UI `onValueChange(value, details)` -> `onChange(value)`; `Radio.Root` -> `RadioButtonGroup.Item`.

## 12. RichTextEditor

Import: `import {RichTextEditor} from "@heroui-pro/react/rich-text-editor";` (SUBPATH ONLY). Types/helpers from the same subpath: `RichTextEditorValueChangeDetails`, `RichTextEditorSuggestionItem`, `filterRichTextEditorSuggestionItems`, hooks `useRichTextEditor`, `useRichTextEditorState`.

Purpose: composable editor built on Tiptap with toolbar/bubble/floating/slash menus and character count.

### Engine, extensions, output

- Engine: Tiptap 3 (`@tiptap/react` `useEditor`, `EditorContent`, ProseMirror). Same major as Rezumi (3.32.0). Peers (all optional, subpath-only): `@tiptap/core`, `extension-link`, `extension-underline`, `extensions`, `pm`, `react`, `starter-kit`, `suggestion`, range `>=3.23.6`.
- Default extensions (d.ts/dist, not in the docs): `StarterKit.configure({heading: {levels: [1, 2, 3]}})`, `Underline`, `Link.configure({openOnClick: false})`, `Placeholder.configure({placeholder})`, `CharacterCount.configure({limit: maxLength})`, then your `extensions` appended. The docs only say `extensions` are "appended after defaults".
- StarterKit cannot be reconfigured or disabled through props. `editorOptions` is spread first and then `content`, `editable`, `extensions`, `immediatelyRender: false`, `shouldRerenderOnTransaction: false`, `onUpdate` override it (dist). `editorOptions.editorProps` is honoured; `editorProps.attributes` is merged (class composed), so `aria-label`, `role`, `id`, and `transformPastedHTML` can be passed there.
- Output format: JSON first. `value` / `defaultValue` are `JSONContent`. `onValueChange(json, details)`; `details` = `{editor, html, text, isEmpty, characterCount, wordCount}` (type from d.ts; docs name "JSON plus HTML, text, empty state, character count, and word count" and use `characterCount`, `isEmpty`, `wordCount`). So HTML is available only as `details.html` on change; there is no HTML `value` input.
- Controlled sync (dist): `value` is compared by `JSON.stringify` against `editor.getJSON()`; when different it calls `setContent(value, {emitUpdate: false})`. Initial content is `value ?? defaultValue ?? empty doc`.
- The editor is re-created when `extensions`, `maxLength` or `placeholder` change identity (`useMemo` deps in dist). Pass a module-level `extensions` array.
- Renders nothing editable until the editor exists (`immediatelyRender: false`); `Content` renders a loading div meanwhile.

### Anatomy

```
RichTextEditor                       // provider; owns the Tiptap instance; root div attrs
  RichTextEditor.Shell               // editor surface
    RichTextEditor.Toolbar           // HeroUI Toolbar (aria-label default "Editor toolbar")
      RichTextEditor.ToolbarGroup
        RichTextEditor.ToggleButton  // command: format toggle
        RichTextEditor.ActionButton  // action: undo/redo/clear
        RichTextEditor.CommandButton // any custom Tiptap command
        RichTextEditor.LinkPopover
          .Trigger / .Content / .Input / .Actions / .ApplyButton / .UnsetButton   (also .Root)
      RichTextEditor.ToolbarSeparator
    RichTextEditor.Content           // Tiptap EditorContent
    RichTextEditor.BubbleMenu        // selection toolbar
    RichTextEditor.FloatingMenu      // empty-line toolbar
    RichTextEditor.SuggestionMenu    // slash / mention style trigger menu
    RichTextEditor.Footer
      RichTextEditor.CharacterCount
```

### Props

| Part                                        | Prop              | Type                                                                                                                     | Default              | Notes                                                                                                                                                   |
| ------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RichTextEditor                              | `value`           | `JSONContent`                                                                                                            | -                    | controlled                                                                                                                                              |
| RichTextEditor                              | `defaultValue`    | `JSONContent`                                                                                                            | -                    | initial                                                                                                                                                 |
| RichTextEditor                              | `onValueChange`   | `(value, details) => void`                                                                                               | -                    | fires on every update                                                                                                                                   |
| RichTextEditor                              | `placeholder`     | `string`                                                                                                                 | `"Start writing..."` |                                                                                                                                                         |
| RichTextEditor                              | `maxLength`       | `number`                                                                                                                 | -                    | passed as Tiptap `CharacterCount` `limit` (dist); Tiptap normally blocks input past the limit (unverified here); `[data-over-limit]` styles the counter |
| RichTextEditor                              | `isDisabled`      | `boolean`                                                                                                                | `false`              | disables editing and toolbar controls                                                                                                                   |
| RichTextEditor                              | `isReadOnly`      | `boolean`                                                                                                                | `false`              | focusable, not editable                                                                                                                                 |
| RichTextEditor                              | `extensions`      | `Extensions`                                                                                                             | -                    | appended after defaults                                                                                                                                 |
| RichTextEditor                              | `editorOptions`   | `Partial<EditorOptions>`                                                                                                 | -                    | advanced Tiptap options                                                                                                                                 |
| RichTextEditor                              | `variant`         | `'primary' \| 'secondary'`                                                                                               | `'primary'`          | `secondary` inside Surface, Modal, Sheet, Drawer                                                                                                        |
| ToggleButton                                | `command`         | `bold\|italic\|underline\|strike\|code\|blockquote\|bulletList\|orderedList\|codeBlock\|heading-1\|heading-2\|heading-3` | -                    | active state from editor                                                                                                                                |
| ToggleButton / ActionButton / CommandButton | `tooltip`         | `ReactNode`                                                                                                              | -                    | optional                                                                                                                                                |
| ActionButton                                | `action`          | `undo \| redo \| clearFormatting \| clearContent`                                                                        | -                    | `clearFormatting` = `unsetAllMarks().clearNodes()` (dist)                                                                                               |
| CommandButton                               | `onCommand`       | `(editor) => void \| boolean`                                                                                            | -                    |                                                                                                                                                         |
| CommandButton                               | `isActive`        | `boolean \| (editor) => boolean`                                                                                         | -                    | styling and `aria-pressed`                                                                                                                              |
| CommandButton                               | `isDisabled`      | `boolean \| (editor) => boolean`                                                                                         | -                    |                                                                                                                                                         |
| BubbleMenu / FloatingMenu                   | `toolbarProps`    | `ToolbarProps`                                                                                                           | -                    | bubble shows for focused non-empty selection; floating on empty block                                                                                   |
| SuggestionMenu                              | `char`            | `string`                                                                                                                 | `"/"`                |                                                                                                                                                         |
| SuggestionMenu                              | `items`           | `({query, editor}) => Item[] \| Promise<Item[]>`                                                                         | -                    | items `{title, description, icon, keywords, command({editor, range, ...})}`; filter with `filterRichTextEditorSuggestionItems(items, query)`            |
| SuggestionMenu                              | `children`        | `(props) => ReactNode`                                                                                                   | -                    | full custom renderer                                                                                                                                    |
| SuggestionMenu                              | `onSelect`        | `(props) => void`                                                                                                        | -                    | for custom item shapes                                                                                                                                  |
| SuggestionMenu                              | `pluginKey`       | `string \| PluginKey`                                                                                                    | -                    |                                                                                                                                                         |
| SuggestionMenu                              | `allowSpaces`     | `boolean`                                                                                                                | `false`              |                                                                                                                                                         |
| SuggestionMenu                              | `allowedPrefixes` | `string[] \| null`                                                                                                       | `[" "]`              |                                                                                                                                                         |
| SuggestionMenu                              | `startOfLine`     | `boolean`                                                                                                                | `false`              |                                                                                                                                                         |
| SuggestionMenu                              | `maxHeight`       | `number`                                                                                                                 | `384`                | px                                                                                                                                                      |
| CharacterCount                              | `showWords`       | `boolean`                                                                                                                | `false`              | appends word count                                                                                                                                      |
| CharacterCount                              | `children`        | `ReactNode \| (stats) => ReactNode`                                                                                      | -                    | d.ts stats: `{characters, isEmpty, words}`                                                                                                              |

Not in the docs API reference (no prop tables): `Shell`, `Toolbar`, `ToolbarGroup`, `ToolbarSeparator`, `Footer`, `Content`, the LinkPopover parts. d.ts shows `Toolbar` takes HeroUI `ToolbarProps` (`aria-label`, `orientation`), `LinkPopover` takes HeroUI `Popover` props (`isOpen`, `onOpenChange`), `LinkPopover.Input` takes HeroUI `Input` props (default placeholder `https://example.com`).

Hooks: `useRichTextEditor()` returns `{editor, isDisabled, isReadOnly, maxLength}`; `useRichTextEditorState(selector, equalityFn)` subscribes to editor state without re-rendering on unrelated transactions.

Link behaviour (dist): LinkPopover normalises input (prepends `https://` unless it starts with `http(s):`, `mailto:`, `tel:`, `#` or `/`), validates with `new URL`, applies `extendMarkRange("link").setLink`, "Remove" unsets. Empty href unsets.

Validation: none. No `isInvalid`, `name`, `id`, label or error slots. Footer is the only text area.

### Minimal example

```tsx
import { RichTextEditor } from "@heroui-pro/react/rich-text-editor";

<RichTextEditor value={doc} onValueChange={(json, d) => save(json, d.html)} maxLength={500}>
  <RichTextEditor.Shell>
    <RichTextEditor.Toolbar>
      <RichTextEditor.ToolbarGroup aria-label="Text style">
        <RichTextEditor.ToggleButton command="bold" tooltip="Bold" />
        <RichTextEditor.ToggleButton command="italic" tooltip="Italic" />
        <RichTextEditor.ToggleButton command="bulletList" tooltip="Bulleted list" />
      </RichTextEditor.ToolbarGroup>
    </RichTextEditor.Toolbar>
    <RichTextEditor.Content />
    <RichTextEditor.Footer>
      <RichTextEditor.CharacterCount showWords />
    </RichTextEditor.Footer>
  </RichTextEditor.Shell>
</RichTextEditor>;
```

CSS states: `[data-disabled]`, `[data-readonly]`, `[data-variant]`, `[data-over-limit]` (counter), `[data-active]` (toolbar buttons), `[data-highlighted]` (suggestion item). Parts are `.rich-text-editor__*` (shell, toolbar, content, prosemirror, bubble-menu, floating-menu, suggestion-menu, footer, character-count, link-popover).

### Fit for Rezumi

Current editor (what grep `@tiptap` in `apps/web/src` found):

- `features/resume/editor/write/rich-text-editor-field.tsx` (575 lines): `useEditor` + `EditorContent` with `richTextExtensions`; wrapper `rich-text-editor.tsx` lazy-loads it and shows a read-only preview while Tiptap loads (`Suspense`, `preloadRichTextEditor`).
- `components/input/rich-text-extensions.ts`: `StarterKit.configure({heading: false, paragraph: false, codeBlock: false, link: {openOnClick: false, enableClickSelection: true, defaultProtocol: "https", protocols: ["http", "https"]}})` + `LiteralParagraph`, `LiteralHeading` (levels 1-6), `LiteralWhitespaceInput`, `TextStyle`, `Color`, `Highlight` (multicolor, dark-color text fix), `TextAlign`, `ParagraphIndent`, sanitised `Table`/`TableRow`/`TableHeader`/`TableCell` (colspan/rowspan/colwidth/style whitelists in `rich-text-markup.ts`). Also `rich-input-whitespace.ts`, `paragraph-indent.ts`.
- Value model: `value: string` HTML in, `onChange(html)` out, resume data stores HTML. Updates from undo, the page and the assistant sync with `editor.getHTML() !== editorValue` then `setContent(html, {emitUpdate: false})`.
- Toolbar: custom buttons, `aria-pressed` states, `onMouseDown` preventDefault to keep caret, shown only while the field has focus or a menu is open, docked above the keyboard on phones (`useKeyboardInset`), two `DropdownMenu`s (alignment; strike/code/highlight/color/text style/indent/outdent/rule/clear), link via `usePrompt` dialog, an AI "Improve" panel (`ImprovePanel`), read-only table fallback (`hasUnsupportedTableMarkup`), `transformPastedHTML`, character count, "Markdown shortcuts on" hint.
- Usage: 6 files contain `<RichTextEditor`.

Verdict: do NOT replace it with HeroUI `RichTextEditor`. Reasons, in order of severity:

1. Data model: HeroUI is JSON-in/JSON-out; Rezumi persists, imports and exports HTML. You would need HTML to JSON on every external update (a `@tiptap/html`-style generator is not part of the peers and not mentioned in the docs) and `details.html` on output. Round-trip fidelity for Rezumi's literal-whitespace and table nodes would have to be re-proved.
2. Schema conflict: HeroUI hard-wires `StarterKit` with `heading` levels 1-3 plus its own `Link` and `Underline`. Rezumi must disable StarterKit `heading`, `paragraph`, `codeBlock`, and restrict link protocols to http/https. Appending `LiteralParagraph`/`LiteralHeading` after HeroUI's defaults creates duplicate node names (`paragraph`, `heading`, `link`) with undefined precedence. No prop disables a default (the docs offer only additive `extensions`). HeroUI's LinkPopover also allows `mailto:` and `tel:` and prepends `https://`, which is looser than Rezumi's protocol list.
3. Possible duplicate `link`/`underline`: StarterKit 3.32.0 already bundles Link and Underline (its types expose `link` and `underline` options), and HeroUI adds both again. Tiptap normally warns on duplicate extension names. Not run; check the console if you try it (unverified).
4. Missing built-ins (all would be `CommandButton`s): text align, color, highlight, indent/outdent, horizontal rule, tables, headings 4-6 (`ToggleButton` knows only `heading-1..3`), paragraph/clear-node-only actions.
5. UX features absent: focus-gated toolbar, mobile keyboard-docked toolbar, AI Improve integration, lazy preview while loading, read-only table mode. Some can be rebuilt with `useRichTextEditor()`, `BubbleMenu` and `CommandButton`; the focus gating and mobile docking cannot come from props.
6. Field integration: no label/description/error/name/id slots. A11y label and id must go through `editorOptions.editorProps.attributes`.

Recommended path: keep Rezumi's Tiptap field. Restyle only the chrome with HeroUI OSS parts the Pro editor itself uses (`Toolbar`, `ToggleButton`, `Popover`, `Input`, `Tooltip`), or adopt the Pro `RichTextEditor` only for NEW fields that can store JSON (for example a future notes field), where its `/` slash menu, bubble menu and `CharacterCount` come for free.

## 13. Migration summary

Features Rezumi has today that HeroUI Pro lacks (details in each "Fit" section): FormControl id/`aria-describedby` injection and a visible description beside the error; color alpha, rgba strings, bare-swatch and controlled-open triggers; multi-thumb sliders; switch descriptions; typed fractional number entry with a unit addon; PDF-only single-file validation with a saved-attachment link; HTML in/out, literal-whitespace nodes, headings 4-6, align/color/highlight/indent/tables, http(s)-only links, focus-gated and keyboard-docked toolbars, AI Improve and the read-only table mode in the rich text field.

Suggested order (low risk first):

1. `NativeSelect`: re-implement `packages/ui/src/components/native-select.tsx` on HeroUI `NativeSelect`, keep the exported API. Add peers only if needed (none required).
2. `CellSwitch` / `CellSelect` / `CellSlider` for builder side-panel settings rows, after deciding whether to keep Rezumi's flat rows.
3. `RadioButtonGroup` for the card-style "Header layout" chooser in `entries-group.tsx`; `CheckboxButtonGroup` only for new card-style multi-choices.
4. `DropZone` wrapped in the existing `FileAttachmentField` contract.
5. `InlineSelect` for new compact pickers.
6. Defer: `CellColorPicker` (needs rgba/alpha decisions), `NumberStepper` (does not fit `NumberInput`), `RichTextEditor` (keep custom Tiptap).

Before any adoption, add the missing optional peers listed in section 1, run `pnpm exec turbo boundaries`, and keep mobile parity in mind: HeroUI Pro web components are web only, and the visual restyle does not change features, but any behaviour added (drag-and-drop upload, card choosers) must also exist in `apps/mobile` per the repo rule.
