# HeroUI v3 OSS (`@heroui/react`) API reference, components A to L

Source: `heroui-pro` MCP `get_component_docs` (OSS docs, v3 branch). Purpose: guide migrating Rezumi web (`apps/web`, React 19 + Tailwind v4) from shadcn/Base UI (`packages/ui/src/components`) to HeroUI default style. Only props and parts that appear in the docs are listed.
Part 1: component reference. Part 2: Rezumi to HeroUI mapping table (end of file).

Index (grep `^# [0-9]+\.` for line numbers): Part 1 reference: 1 Button, 2 ButtonGroup, 3 CloseButton, 4 Dropdown, 5 AlertDialog, 6 Input, 7 InputGroup, 8 Checkbox, 9 CheckboxGroup, 10 ComboBox, 11 Autocomplete, 12 Avatar, 13 AvatarGroup, 14 Badge, 15 Chip, 16 Card, 17 Accordion, 18 Disclosure, 19 DisclosureGroup, 20 Kbd, 21 Alert, 22 Label, 23 Description, 24 FieldError, 25 ErrorMessage, 26 Fieldset, 27 TextField (support), 28 Form, 29 InputOTP, 30 Link, 31 Drawer, 32 Breadcrumbs, 33 DatePicker/DateField/DateRangePicker/Calendar, 34 ColorPicker/ColorArea/ColorSlider/ColorField/ColorSwatch/ColorSwatchPicker. Part 2 (`# Part 2`): cross-cutting API rewrites, per-file Rezumi to HeroUI mapping with call-site counts and variant tables, gaps and risks.
Format: "Props:" lines list `name: type = default`; "Part prop" prefixes mean the prop belongs to that sub-part. Classes/BEM lists were dropped; use `get_css` for those.

## v3 global conventions (apply to every component below)

- Import everything from `@heroui/react`. No Provider required. Tailwind CSS v4 required.
- Compound components use dot notation: `Card.Header`, `Dropdown.Item`, `Accordion.Trigger`. Part names listed under each component are the documented ones.
- Press events: use `onPress` (React Aria `PressEvent`), not `onClick`. Disabled: `isDisabled` (not `disabled`). Invalid: `isInvalid`. Loading: `isPending` (Button).
- Built on React Aria Components. Selection and open state follow RAC naming: `isOpen` / `defaultOpen` / `onOpenChange`, `selectedKeys` / `onSelectionChange`, `value` / `defaultValue` / `onChange`.
- Polymorphism: `render` prop (function `(props, renderProps) => JSX`) replaces the old `asChild` / Base UI `render={<El/>}` element pattern. Many components also accept `children` as a render function receiving state (for example `({isPending}) => ...`).
- Styling: BEM classes (`.button`, `.button--primary`, `.button__trigger`...) plus data attributes (`data-hovered`, `data-pressed`, `data-focus-visible`, `data-pending`, `data-disabled`). Customize via `className` or `@layer components { .button { ... } }`.
- Tailwind-variants: exports like `buttonVariants` can be extended with `tv({extend: buttonVariants, ...})`.
- Icon children are plain SVG elements; docs use `@gravity-ui/icons` but any icon works.
- Label / Description / FieldError are shared primitives; for form fields place them as direct children of the field root (TextField, Checkbox, ComboBox...) and they auto-wire `aria-labelledby` etc.

# 1. Button (deepest)

Purpose: clickable action control. Import `{Button}` (also `buttonVariants`, `ButtonProps`).
Anatomy: single element, no sub-parts. `Button` can contain `<Spinner/>`, icons, `ButtonGroup.Separator` (inside ButtonGroup).
Props:
`variant`: `'primary' | 'secondary' | 'tertiary' | 'outline' | 'ghost' | 'danger' | 'danger-soft'` = `'primary'`; `size`: `'sm' | 'md' | 'lg'` = `'md'`; `fullWidth`: `boolean` = `false`; `isDisabled`: `boolean` = `false`;
`isPending`: `boolean` = `false`; `isIconOnly`: `boolean` = `false`; `onPress`: `(e: PressEvent) => void`; `children`: `ReactNode | (values: ButtonRenderProps) => ReactNode`;
`render`: `DOMRenderFunction<keyof JSX.IntrinsicElements, ButtonRenderProps>`.
Render props (children function or `render`): `isPending`, `isPressed`, `isHovered`, `isFocused`, `isFocusVisible`, `isDisabled`.
Gotchas:

- No `onClick`. No `asChild`. No `loading` prop; use `isPending` and render a `<Spinner color="current" size="sm" />` yourself inside a children function (HeroUI does not inject the spinner for you; pending only blocks pointer events).
- Icon-only requires BOTH `isIconOnly` and `aria-label`. There is no separate IconButton component.
- Polymorphic anchor: use `render={(props) => <a {...props} href=... />}`. Docs only show a `<button {...props} data-custom=.../>` example, so verify link rendering in a spike (`Link` component exists for plain links).
- Sizes are only `sm | md | lg`. No `xs`, no `icon` / `icon-sm` size keys; icon-only is a boolean modifier combined with `size`.
- No `default`/`destructive`/`link` variants. Mapping: shadcn default -> `primary`, `secondary` -> `secondary`, `outline` -> `outline`, `ghost` -> `ghost`, `destructive` -> `danger` (or `danger-soft`).
- Pressed state includes a scale transform; inside `ButtonGroup` it is removed.
- Extending variants: `tv({extend: buttonVariants, variants: {...}})`.
  Example:

```tsx
import { Button, Spinner } from "@heroui/react";

export function SaveButton({ saving, onSave }: { saving: boolean; onSave: () => void }) {
  return (
    <Button isPending={saving} variant="primary" size="md" onPress={onSave}>
      {({ isPending }) => (
        <>
          {isPending ? <Spinner color="current" size="sm" /> : null}
          {isPending ? "Saving..." : "Save"}
        </>
      )}
    </Button>
  );
}
```

# 2. ButtonGroup

Purpose: group related Buttons with shared size/variant, auto-rounded edges, optional separators. Import `{ButtonGroup, Button}`.
Anatomy: `ButtonGroup` > `Button` (direct children) > `ButtonGroup.Separator` (placed INSIDE each Button except the first).
ButtonGroup props:
Props:
`variant`: `'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger'` (docs example also uses `'outline'`); `size`: `'sm' | 'md' | 'lg'`; `orientation`: `'horizontal' | 'vertical'` = `'horizontal'`;
`fullWidth`: `boolean` = `false`; `isDisabled`: `boolean` = `false`; `className`, `children`.
`ButtonGroup.Separator`: `className` only.
Gotchas:

- Context passes `size`, `variant`, `isDisabled` to DIRECT child Buttons only. Buttons nested inside Dropdown/Modal etc. do not inherit. A single Button can override with `isDisabled={false}`.
- Separator goes inside each Button after the first (not between). Omit separators for no dividers.
- Border radius handled automatically (first/last/middle/single). Pressed scale is disabled in groups.
- No documented `attached` / `spacing` props and no `ButtonGroupText`. Gap is customized via `.button-group` CSS.
  Example:

```tsx
<ButtonGroup variant="tertiary" size="sm">
  <Button>Left</Button>
  <Button>
    <ButtonGroup.Separator />
    Center
  </Button>
  <Button isIconOnly aria-label="More">
    <ButtonGroup.Separator />
    <Ellipsis />
  </Button>
</ButtonGroup>
```

# 3. CloseButton

Purpose: small button for dismissing dialogs/alerts/etc. Import `{CloseButton}`.
Anatomy: single element; default child is an X icon (`<CloseIcon />`).
Props:
`variant`: `"default"` = `"default"`; `children`: `ReactNode | function` = `<CloseIcon />`; `onPress`: `() => void`; `isDisabled`: `boolean` = `false`.
Extends React Aria Button props (`aria-label`, `aria-labelledby`, `aria-describedby`). Render props: `isHovered`, `isPressed`, `isFocused`, `isDisabled`. Classes: `.close-button`, `.close-button--default`.
Gotchas: pass `aria-label`. Dialog-like parts ship their own `AlertDialog.CloseTrigger` / `Drawer.CloseTrigger` (see those sections); a standalone CloseButton needs your own `onPress` (e.g. Alert dismissal).
Example:

```tsx
<CloseButton aria-label="Dismiss" onPress={() => setOpen(false)} />
```

# 4. Dropdown (deepest)

Purpose: action menu opened from a trigger (ARIA menu pattern). Wraps RAC Menu + Popover. Import `{Dropdown, Label, Description, Header, Kbd, Separator, Button}`. Use for command menus; for value pickers use Select / ComboBox / Autocomplete.
Anatomy (dot-notation):

```
Dropdown
  Dropdown.Trigger        (optional; a bare <Button> as first child also works as trigger)
  Dropdown.Popover
    Dropdown.Menu
      Dropdown.Item       (id, textValue, variant)
        Label, Description, Kbd slot="keyboard", Dropdown.ItemIndicator
      Separator            (shared component)
      Dropdown.Section    > Header + Dropdown.Item...
      Dropdown.SubmenuTrigger
        Dropdown.Item > Label + Dropdown.SubmenuIndicator
        Dropdown.Popover > Dropdown.Menu > Dropdown.Item
```

Dropdown (root):
Props:
`isOpen` / `defaultOpen`: `boolean`; `onOpenChange`: `(isOpen: boolean) => void`; `trigger`: `"press" | "longPress"` = `"press"`; `className`, `children`.
Dropdown.Trigger: `className`, `children` (ReactNode or render fn). Accepts all RAC Button props when a Button is the trigger. Use it to wrap non-Button triggers (docs: `<Dropdown.Trigger className="rounded-full"><Avatar/></Dropdown.Trigger>`).
Dropdown.Popover: `placement` (RAC placements: `bottom`, `bottom start`, `bottom end`, `top`, `left`, `right`, `start`, `end` plus `* top|bottom|left|right|start|end` combos; default `"bottom"`), `className`, `children`. All RAC Popover props supported.
Dropdown.Menu:
Props:
`selectionMode`: `"single" | "multiple" | "none"` = `"none"`; `selectedKeys` / `defaultSelectedKeys`: `Iterable<Key>`; `onSelectionChange`: `(keys: Selection) => void`; `disabledKeys`: `Iterable<Key>`;
`onAction`: `(key: Key) => void`; `className`, `children`.
Dropdown.Section: `selectionMode` (`single|multiple`), `selectedKeys`, `defaultSelectedKeys`, `onSelectionChange`, `disabledKeys`, `className`, `children`. Selection can be scoped per section.
Dropdown.Item: `id: Key`, `textValue: string` (typeahead; required when children are not a plain string), `variant: "default" | "danger"` (default `"default"`), `className`, `children` (ReactNode or render fn). Also all RAC MenuItem props (for example `isDisabled`, `onAction`, `href`).
Item render props: `isSelected`, `isFocused`, `isDisabled`, `isPressed`.
Dropdown.ItemIndicator: `type: "checkmark" | "dot"` (default `"checkmark"`), `children` (render fn gets `isSelected`, `isIndeterminate`).
Dropdown.SubmenuIndicator: `className`, `children` (custom chevron).
Dropdown.SubmenuTrigger: wraps an Item + nested Popover; all RAC SubmenuTrigger props.
Gotchas:

- Actions are handled on the MENU via `onAction(key)` (id-based dispatch) or per-Item `onAction`. There is NO `onSelect` / `onClick` on items, and no `asChild`.
- Every Item needs a stable `id`. Add `textValue` unless child is plain text.
- Item contents: wrap text in `<Label>`; extra text in `<Description>`; shortcut in `<Kbd slot="keyboard">`. Icons are plain SVG siblings before the Label.
- Destructive items: `variant="danger"` on Dropdown.Item (not a `destructive` prop).
- Checkbox/radio menu items: no `CheckboxItem` / `RadioItem`. Use `selectionMode="multiple"` / `"single"` on Menu (or Section) with `selectedKeys` + `<Dropdown.ItemIndicator />`. Radio-like indicator: `type="dot"`.
- Submenu: `Dropdown.SubmenuTrigger` > first child Item (trigger) + second child `Dropdown.Popover`. No `DropdownMenuSub*` parts.
- Group label: `<Header>` inside `Dropdown.Section` (from `@heroui/react`). Divider: `<Separator />`.
- Controlled open: `isOpen` + `onOpenChange` on Dropdown (not on Menu). Controlled selection: `selectedKeys` is a `Selection` Set (`new Set(["bold"])`).
- Trigger a11y: icon-only Button trigger must have `aria-label`. Trigger Button receives press state `data-pressed`.
- Context menu (right-click) is not part of Dropdown; `trigger="longPress"` is the only alternate. Rezumi `context-menu.tsx` has no documented HeroUI OSS equivalent in this slice.
  Example:

```tsx
import { Button, Dropdown, Label, Separator } from "@heroui/react";

export function RowMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <Dropdown>
      <Button isIconOnly aria-label="Row actions" variant="ghost">
        <Ellipsis />
      </Button>
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu onAction={(key) => (key === "edit" ? onEdit() : onDelete())}>
          <Dropdown.Item id="edit" textValue="Edit">
            <Label>Edit</Label>
          </Dropdown.Item>
          <Separator />
          <Dropdown.Item id="delete" textValue="Delete" variant="danger">
            <Label>Delete</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
```

# 5. AlertDialog (deepest)

Purpose: modal confirmation requiring an explicit action (role `alertdialog`). Import `{AlertDialog, Button, useOverlayState}`.
Anatomy:

```
AlertDialog
  Button / AlertDialog.Trigger     (trigger; bare <Button> as first child works)
  AlertDialog.Backdrop             (open state, variant, dismissal)
    AlertDialog.Container          (placement, size)
      AlertDialog.Dialog
        AlertDialog.CloseTrigger   (optional X button)
        AlertDialog.Header
          AlertDialog.Icon         (optional, status)
          AlertDialog.Heading
        AlertDialog.Body
        AlertDialog.Footer
```

Props:
Props:
AlertDialog `children`: ReactNode; Trigger `className`, `children`; Backdrop `variant`: `"opaque" | "blur" | "transparent"` = `"opaque"`; Backdrop `isDismissable`: `boolean` (click backdrop to close) = `false`;
Backdrop `isKeyboardDismissDisabled`: `boolean` (disable ESC) = `true`; Backdrop `isOpen` / `onOpenChange`: `boolean` / `(isOpen: boolean) => void`; Backdrop `className`: `string | (values) => string`;
Backdrop `UNSTABLE_portalContainer`: `HTMLElement`; Container `placement`: `"auto" | "center" | "top" | "bottom"` = `"auto"`; Container `size`: `"xs" | "sm" | "md" | "lg" | "cover"` = `"md"`;
Dialog `children`: `ReactNode | ({close}) => ReactNode`; Dialog `role`: string = `"alertdialog"`; Dialog `aria-label`, `aria-labelledby`, `aria-describedby`: string;
Icon `status`: `"default" | "accent" | "success" | "warning" | "danger"` = `"danger"`; Header/Heading/Body/Footer/CloseTrigger `className`, `children`.
`useOverlayState({defaultOpen, onOpenChange})` returns `{isOpen, open(), close(), toggle(), setOpen(v)}`. Spread-friendly: `isOpen={state.isOpen} onOpenChange={state.setOpen}`.
Gotchas:

- Close actions: put `slot="close"` on any `<Button>` inside the dialog to close it (no `AlertDialogCancel` / `AlertDialogAction` parts). For async confirm, drive state yourself (controlled `isOpen`) or use the `children` render function `({close}) => ...` on `AlertDialog.Dialog`.
- Dismiss defaults are STRICT: backdrop click does not dismiss (`isDismissable=false`) and ESC does not dismiss (`isKeyboardDismissDisabled=true`). Set both explicitly if Rezumi's current behavior dismisses.
- Controlled use needs no Trigger: render `<AlertDialog.Backdrop isOpen onOpenChange>` standalone (no parent `AlertDialog` needed in the docs example). Uncontrolled: `AlertDialog` > Button + Backdrop.
- `size`/`placement` live on `Container`, not `Dialog`. Width override: `className="sm:max-w-[400px]"` on `Dialog`.
- Confirm variant for destructive: `<Button slot="close" variant="danger">`; cancel: `variant="tertiary"` (docs convention).
- Use `AlertDialog` for confirmations only. For forms/content use `Modal` (not in this slice's scope).
- No `onClick`. Buttons use `onPress`.
  Example:

```tsx
import { AlertDialog, Button } from "@heroui/react";

export function ConfirmDelete({ onConfirm }: { onConfirm: () => void }) {
  return (
    <AlertDialog>
      <Button variant="danger">Delete</Button>
      <AlertDialog.Backdrop isDismissable>
        <AlertDialog.Container size="sm">
          <AlertDialog.Dialog>
            <AlertDialog.Header>
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Heading>Delete resume?</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>This cannot be undone.</p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button slot="close" variant="tertiary">
                Cancel
              </Button>
              <Button slot="close" variant="danger" onPress={onConfirm}>
                Delete
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
}
```

# 6. Input (deepest)

Purpose: PRIMITIVE native `<input>` (no label, no validation, no field context by itself). Import `{Input}`. For labels, descriptions, validation, `isInvalid`, `isRequired`, `isDisabled` use `TextField` (docs: "For validation, labels, and error messages, see TextField").
Anatomy: single element `<Input />`. Inside a `TextField` it is the field's input (auto-wired).
Props:
`variant`: `"primary" | "secondary"` = `"primary"`; `fullWidth`: `boolean` = `false`; `type`: `string` = `"text"`; `value` / `defaultValue`: `string`; `onChange`: `(event: React.ChangeEvent<HTMLInputElement>) => void`;
`placeholder`, `name`, `autoComplete`, `maxLength`, `minLength`, `pattern`, `min`, `max`, `step`: HTML attrs; `disabled`, `readOnly`, `required`: `boolean` (NATIVE attr names, not `isDisabled`) = `false`; `className`: `string`.
Variants: `primary` has shadow (default); `secondary` has no shadow, for use on `Surface`.
Gotchas:

- Standalone `Input`: `onChange` receives a native ChangeEvent (`e.target.value`). Inside `TextField`, the field's `onChange` receives the STRING value (`onChange={setValue}`), not an event. Do not put `onChange` on both.
- Standalone Input has NO `isInvalid` prop; invalid styling comes from the parent TextField or `aria-invalid`/`data-invalid`.
- Needs an accessible name: `aria-label` or `<Label htmlFor>` + `id`, or wrap in TextField with `<Label>`.
- No `size` prop documented; override height via `className`.
- No built-in icon/addon slots; use `InputGroup`.
- Rezumi call sites passing `aria-invalid` or shadcn `data-slot` selectors must be re-styled using `data-invalid`.
  Example (native-event style):

```tsx
<Input aria-label="Name" placeholder="Enter your name" value={name} onChange={(e) => setName(e.target.value)} />
```

# 7. InputGroup (deepest)

Purpose: container joining an input with prefix/suffix content (icons, text, buttons, Kbd, Chip, Spinner). Built on RAC `Group`. Import `{InputGroup, TextField, Label, Description, FieldError}`.
Anatomy:

```
TextField                 (provides label/description/error/disabled/invalid/required context)
  Label
  InputGroup              (variant, fullWidth)
    InputGroup.Prefix
    InputGroup.Input      (or InputGroup.TextArea for multiline)
    InputGroup.Suffix
  Description
  FieldError
```

`InputGroup.Root` is an alias of `InputGroup`.
InputGroup props: inherits RAC `Group` (`id`, `style`, `className` incl. render-prop form, `role: 'group' | 'region' | 'presentation'`, default `'group'`, aria-*) plus:
Props:
`variant`: `"primary" | "secondary"` = `"primary"`; `fullWidth`: `boolean` = `false`; `children`: `ReactNode | (values: GroupRenderProps) => ReactNode`.
InputGroup.Input: inherits RAC `Input`: `className`, `variant`, `type` (default `'text'`), `value`, `defaultValue`, `placeholder`, `disabled`, `readOnly`.
InputGroup.TextArea: inherits RAC `TextArea`: `className`, `variant`, `value`, `defaultValue`, `placeholder`, `rows`, `disabled`, `readOnly`. Container auto-switches to `items-start` and `height: auto`.
InputGroup.Prefix / InputGroup.Suffix: `className`, `children`.
Gotchas:

- InputGroup DEPENDS on a parent `TextField` for disabled/required/invalid/label wiring. Set `isDisabled`, `isRequired`, `isInvalid` on `TextField`, not on InputGroup.
- Value handling is on TextField (`value`, `defaultValue`, `onChange(value: string)`) in docs examples; the TextArea example also shows `value`/`onChange(event)` directly on `InputGroup.TextArea`. Pick one source of truth per field.
- No `InputGroupAddon align="inline-start|inline-end|block-start|block-end"`, no `InputGroupButton`, no `InputGroupText`. Use `Prefix`/`Suffix` (inline only). Block-level add-ons are achieved by layout classes (docs chat-prompt example: `className="flex flex-col"` on InputGroup and `Prefix`/`Suffix` with `w-full`).
- Interactive suffix: put `<Button isIconOnly size="sm" variant="ghost" aria-label=...>` inside `InputGroup.Suffix className="pe-0"` (removes padding so the button hugs the edge).
- Text prefixes (`$`, `https://`) are plain text in `Prefix`.
- Password reveal pattern: toggle `type` on `InputGroup.Input`, button in `Suffix` with `onPress`.
- No-label usage requires `aria-label` on TextField.
  Example:

```tsx
import { Button, FieldError, InputGroup, Label, TextField } from "@heroui/react";

export function PasswordField({ invalid }: { invalid: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <TextField isRequired isInvalid={invalid} name="password">
      <Label>Password</Label>
      <InputGroup>
        <InputGroup.Input type={show ? "text" : "password"} />
        <InputGroup.Suffix className="pe-0">
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label={show ? "Hide" : "Show"}
            onPress={() => setShow(!show)}
          >
            {show ? <EyeSlash /> : <Eye />}
          </Button>
        </InputGroup.Suffix>
      </InputGroup>
      <FieldError>Required</FieldError>
    </TextField>
  );
}
```

# 8. Checkbox (deepest)

Purpose: binary (or indeterminate) choice; form-participating. Built on RAC Checkbox field. Import `{Checkbox, Description, FieldError, Label}`.
Anatomy (v3 compound; the control is NOT auto-rendered):

```
Checkbox                       (field root: state, validation, name/value)
  Checkbox.Content             (clickable <label>: wraps control + label text)
    Checkbox.Control           (the box)
      Checkbox.Indicator       (checkmark / dash; children may be a render fn)
    plain text label
  Description                  (optional, sibling of Content)
  FieldError                   (optional, sibling of Content)
```

Checkbox props (inherits RAC CheckboxField):
Props:
`isSelected` / `defaultSelected`: `boolean` = `false`; `onChange`: `(isSelected: boolean) => void`; `isIndeterminate`: `boolean` = `false`; `isDisabled` / `isReadOnly` / `isRequired` / `isInvalid`: `boolean` = `false`;
`validate`: `(value: boolean) => ValidationError | true | null | undefined`; `validationBehavior`: `'native' | 'aria'` = `'native'`; `variant`: `"primary" | "secondary"` = `"primary"`; `name`, `value`: `string` (form submit);
`children`: `ReactNode | (values: CheckboxFieldRenderProps) => ReactNode`; `render`: `DOMRenderFunction<..., CheckboxFieldRenderProps>`.
Checkbox.Content: `children` (ReactNode or `(CheckboxButtonRenderProps) => ReactNode`), `className` (string or fn).
CheckboxFieldRenderProps: `isSelected`, `isIndeterminate`, `isDisabled`, `isReadOnly`, `isInvalid`, `isRequired`.
CheckboxButtonRenderProps (for Control / Indicator children functions): `isHovered`, `isPressed`, `isFocusVisible`, etc.
Gotchas:

- NO `checked` / `onCheckedChange` / `disabled`. Use `isSelected` + `onChange(boolean)` (v3 is not an event; value is boolean) and `isDisabled`.
- Label: plain text INSIDE `Checkbox.Content`. External label alternative: `<Label htmlFor={id}>` next to a Checkbox with `id`. No-label checkbox: omit text and give `aria-label` on `Checkbox` (docs say to pass `aria-label` on Checkbox).
- `Description` and `FieldError` are siblings of `Checkbox.Content`, direct children of `Checkbox`.
- Indeterminate: `isIndeterminate` (docs: manage `isSelected` yourself and clear indeterminate in `onChange`).
- Form integration: `name` + `value="on"` for native FormData; `validationBehavior` default is native.
- `variant="secondary"` on `Surface` backgrounds.
- Clickable card-style checkbox: put arbitrary content and a styled `Checkbox.Control` in `Checkbox.Content` with `className`; `data-[selected=true]` is available on Content.
- Boilerplate heavy: wrap into a Rezumi `Checkbox` facade that renders Content/Control/Indicator so call sites stay `<Checkbox isSelected onChange>label</Checkbox>`.
  Example:

```tsx
<Checkbox isSelected={agree} onChange={setAgree} isInvalid={!agree && submitted} name="terms">
  <Checkbox.Content>
    <Checkbox.Control>
      <Checkbox.Indicator />
    </Checkbox.Control>
    I agree to the terms
  </Checkbox.Content>
  <FieldError>You must accept the terms</FieldError>
</Checkbox>
```

# 9. CheckboxGroup

Purpose: group of Checkboxes with shared array value, validation and label. Import `{CheckboxGroup, Checkbox, Label, Description, FieldError}`.
Anatomy:

```
CheckboxGroup (name, value[])
  Label
  Description?
  Checkbox value="a" > Checkbox.Content > Control > Indicator + text ; Description?
  ...
  FieldError?
```

Props:
`value` / `defaultValue`: `string[]`; `onChange`: `(value: string[]) => void`; `isDisabled` / `isRequired` / `isReadOnly` / `isInvalid`: `boolean` = `false`; `name`: `string`;
`children`: `ReactNode | (values: CheckboxGroupRenderProps) => ReactNode`; `render`: `DOMRenderFunction<...>`.
Render props: `value`, `isDisabled`, `isReadOnly`, `isInvalid`, `isRequired`. Class: `.checkbox-group`.
Gotchas:

- Each child `Checkbox` needs `value`; the group owns selection (do not set `isSelected` on children).
- `variant="secondary"` appears on `CheckboxGroup` in the docs "In Surface" example but is NOT in the API table; treat as unverified, or set `variant` on each `Checkbox`.
- With `isRequired`, validation uses native form validation; inside `Form` the `FieldError` shows the message.
- "Select all" pattern: a standalone Checkbox with `isIndeterminate` + `isSelected` computed from group value, plus a CheckboxGroup with `value`/`onChange`.
  Example:

```tsx
<CheckboxGroup name="skills" value={skills} onChange={setSkills}>
  <Label>Skills</Label>
  <Checkbox value="ts">
    <Checkbox.Content>
      <Checkbox.Control>
        <Checkbox.Indicator />
      </Checkbox.Control>
      TypeScript
    </Checkbox.Content>
  </Checkbox>
  <Checkbox value="go">
    <Checkbox.Content>
      <Checkbox.Control>
        <Checkbox.Indicator />
      </Checkbox.Control>
      Go
    </Checkbox.Content>
  </Checkbox>
</CheckboxGroup>
```

# 10. ComboBox (deepest)

Purpose: text input with filterable listbox popup (type-to-search, optional custom values). Built on RAC ComboBox. Import `{ComboBox, Input, Label, Description, ListBox, Header, Separator, FieldError, EmptyState, Spinner}`. Rezumi `combobox.tsx` maps here.
Anatomy:

```
ComboBox
  Label
  ComboBox.InputGroup
    Input                      (the plain HeroUI <Input/>)
    ComboBox.Trigger           (chevron button)
  ComboBox.Value               (optional; shows selected values, for selectionMode="multiple")
  Description / FieldError
  ComboBox.Popover
    ListBox
      ListBox.Item id textValue > text | Label+Description , ListBox.ItemIndicator
      ListBox.Section > Header + ListBox.Item
      Separator
```

ComboBox props (single vs multiple):
Props:
`selectionMode`: `"single" | "multiple"` = `"single"`; `selectedKey` / `defaultSelectedKey`: `Key | null` (single); `onSelectionChange`: `(key: Key | null) => void` (single);
`value` / `defaultValue`: `Key | null | Key[]` (`Key[]` when multiple); `onChange`: `(value: Key | null | Key[]) => void`; `inputValue` / `defaultInputValue`: `string`; `onInputChange`: `(value: string) => void`;
`items`: `Iterable<T>`; `disabledKeys`: `Iterable<Key>`; `defaultFilter`: `(text: string, inputValue: string) => boolean`; `isDisabled` / `isReadOnly` / `isRequired` / `isInvalid`: `boolean`;
`validate`: `(value) => ValidationError | true | null | undefined`; `validationBehavior`: `"native" | "aria"` = `"native"`; `name`, `form`, `autoComplete`, `autoFocus`;
`formValue`: `"text" | "key"` = `"key"` (always text when `allowsCustomValue`); `allowsCustomValue`: `boolean`; `allowsEmptyCollection`: `boolean`; `menuTrigger`: `"focus" | "input" | "manual"` = `"focus"`;
`shouldFocusWrap`: `boolean`; `fullWidth`: `boolean` = `false`; `variant`: `"primary" | "secondary"` = `"primary"`; `className`, `children` (ReactNode or render fn), `render`.
ComboBox.InputGroup: `className`, `children`. ComboBox.Trigger: `className`, `children` (custom icon). ComboBox.Value: `placeholder`, `className` (string or fn), `children` (ReactNode or `(ComboBoxValueRenderProps) => ReactNode`). ComboBox.Popover: `placement` (RAC list, default `"bottom"`), `className`, `children`.
Render props (ComboBox children fn): `state`, `inputValue`, `selectedKey`, `selectedItem`.
Gotchas:

- Items are `ListBox.Item` (not `ComboboxItem`). Each needs `id` AND `textValue` (used for filtering/typeahead). Dynamic data: `items` on ComboBox with `{(item) => <ListBox.Item id=...>}` or `Collection items={...}` for async.
- No `Combobox.Chips` / `ComboboxChipsInput`. Multi-select: `selectionMode="multiple"` on BOTH `ComboBox` and inner `ListBox`, plus `<ComboBox.Value />` to display selection (docs: default renders a comma-separated list; use its render fn for tags).
- Selection API: single uses `selectedKey`/`onSelectionChange(key)` (and also `value/onChange`). Value is a KEY (string id), not the item object; look the object up by key. Base UI's `value={object}` + `itemToStringValue` pattern disappears.
- Free-text: `allowsCustomValue` (then form value is text). Empty results: `allowsEmptyCollection` + `ListBox renderEmptyState={() => <EmptyState/>}` (EmptyState exported from `@heroui/react`).
- Async: `useAsyncList` from `@react-stately/data` (extra dep) with `inputValue/onInputChange`, `Collection`, `ListBoxLoadMoreItem` (`isLoading`, `onLoadMore`).
- Custom filter: `defaultFilter(text, inputValue)`; built-in filtering uses `contains`.
- Label placement: `Label` is a direct child of `ComboBox`; `Description` after InputGroup (or after Popover in docs example); `FieldError` as direct child.
- The input is the standard HeroUI `<Input>` inside `ComboBox.InputGroup`, with `ComboBox.Trigger` as the chevron. No ClearButton part is documented for ComboBox (Autocomplete has `Autocomplete.ClearButton`, SearchField has `SearchField.ClearButton`).
- `validate` errors show on form submit when `validationBehavior="native"`; for real-time use `isInvalid`.
  Example:

```tsx
import { ComboBox, Input, Label, ListBox } from "@heroui/react";

export function LanguagePicker({ value, onChange }: { value: string | null; onChange: (k: string | null) => void }) {
  return (
    <ComboBox selectedKey={value} onSelectionChange={(k) => onChange(k as string | null)}>
      <Label>Language</Label>
      <ComboBox.InputGroup>
        <Input placeholder="Search..." />
        <ComboBox.Trigger />
      </ComboBox.InputGroup>
      <ComboBox.Popover>
        <ListBox>
          <ListBox.Item id="en" textValue="English">
            English
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="id" textValue="Indonesian">
            Indonesian
            <ListBox.ItemIndicator />
          </ListBox.Item>
        </ListBox>
      </ComboBox.Popover>
    </ComboBox>
  );
}
```

# 11. Autocomplete (deepest)

Purpose: SELECT-style trigger button whose popover contains a SearchField + ListBox with filtering (single or multiple). Unlike ComboBox, the text input lives INSIDE the popover. Import `{Autocomplete, useFilter, SearchField, ListBox, Label, Description, EmptyState, TagGroup, Tag}`.
Anatomy:

```
Autocomplete
  Label
  Autocomplete.Trigger
    Autocomplete.Value
    Autocomplete.ClearButton
    Autocomplete.Indicator
  Description
  Autocomplete.Popover
    Autocomplete.Filter  (filter, inputValue, onInputChange)
      SearchField > SearchField.Group > SearchField.SearchIcon + SearchField.Input (+ SearchField.ClearButton)
      ListBox > ListBox.Item > Label + ListBox.ItemIndicator
```

Autocomplete props:
Props:
`placeholder`: `string` = `'Select an item'`; `selectionMode`: `"single" | "multiple"` = `"single"`; `allowsEmptyCollection`: `boolean` = `false`;
`isOpen` / `defaultOpen` / `onOpenChange`: `boolean` / `boolean` / `(isOpen: boolean) => void`; `disabledKeys`: `Iterable<Key>`; `isDisabled` / `isRequired` / `isInvalid`: `boolean`; `value` / `defaultValue`: `Key | Key[] | null`;
`onChange`: `(value: Key | Key[] | null) => void`; `name`: `string`; `fullWidth`: `boolean` = `false`; `variant`: `"primary" | "secondary"` = `"primary"`; `className`, `children`.
Autocomplete.Filter: `filter(text, input) => boolean`, `inputValue`, `onInputChange`, `children`. `useFilter({sensitivity: "base"})` returns `contains`, `startsWith`, `endsWith`.
Autocomplete.ClearButton: `className`, `onClick(e: MouseEvent)`, `ref`. (Note: documented as `onClick`, an exception to the onPress rule.)
Autocomplete.Value render props: `defaultChildren`, `isPlaceholder`, `state`, `selectedItems`, `selectedText`.
Autocomplete.Popover `placement` as ComboBox.
Gotchas:

- Choose carefully: use `ComboBox` for "input with suggestions" (Rezumi `combobox.tsx`) and `Autocomplete` for "select with search inside the popup". They are not interchangeable.
- Multiple selection value is `Key[]`; render tags with `TagGroup`/`Tag` inside `Autocomplete.Value` render fn and remove via `onRemove`.
- No `label`/`description` props; they are child parts. No `onSelectionChange`; use `onChange`.
- Needs `useFilter` + `Autocomplete.Filter filter={contains}` for case-insensitive contains; no default shown in docs for omitted `filter`.
- Async: filter text from `Autocomplete.Filter inputValue/onInputChange` plus `useAsyncList`.
  Example:

```tsx
const { contains } = useFilter({ sensitivity: "base" });
<Autocomplete placeholder="Select state" value={state} onChange={(k) => setState(k as Key | null)}>
  <Label>State</Label>
  <Autocomplete.Trigger>
    <Autocomplete.Value />
    <Autocomplete.ClearButton />
    <Autocomplete.Indicator />
  </Autocomplete.Trigger>
  <Autocomplete.Popover>
    <Autocomplete.Filter filter={contains}>
      <SearchField autoFocus aria-label="Search" variant="secondary">
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input />
        </SearchField.Group>
      </SearchField>
      <ListBox renderEmptyState={() => <EmptyState>No results</EmptyState>}>
        <ListBox.Item id="ca" textValue="California">
          California
          <ListBox.ItemIndicator />
        </ListBox.Item>
      </ListBox>
    </Autocomplete.Filter>
  </Autocomplete.Popover>
</Autocomplete>;
```

# 12. Avatar (deepest)

Purpose: user image with fallback initials/content. Import `{Avatar}`.
Anatomy:

```
Avatar            (size, color, variant)
  Avatar.Image    (src, alt, ...)
  Avatar.Fallback (delayMs, color)
```

Props:
Avatar `size`: `'sm' | 'md' | 'lg'` = `'md'`; Avatar `color`: `'default' | 'accent' | 'success' | 'warning' | 'danger'` (fallback color) = `'default'`; Avatar `variant`: `'default' | 'soft'` = `'default'`;
Avatar `className`: string; Avatar.Image `src`, `srcSet`, `sizes`, `alt`, `crossOrigin` (`'anonymous' | 'use-credentials'`), `loading` (`'eager' | 'lazy'`), `className`;
Avatar.Image `asChild`: `boolean` (merge props onto child e.g. `next/image`) = `false`; Avatar.Image `onLoad`, `onError`: `(e: SyntheticEvent<HTMLImageElement>) => void`;
Avatar.Fallback `delayMs`: `number` (delay before fallback shows); Avatar.Fallback `color`: same union as Avatar (overrides parent).
Gotchas:

- Sizes ONLY `sm | md | lg` (32/40/48 px). No `xs`, `xl`, no numeric sizes; any other size needs `className="size-6"` etc.
- Avatar.Image is the one OSS part that documents `asChild` (for `next/image`-style swaps). Everywhere else prefer `render`.
- Fallback renders when image fails or while loading; use `delayMs` (docs example 600) to prevent flash.
- Fallback color/soft variant provide tinted initials; there is no status/badge slot; compose with `Badge.Anchor` (see Badge).
- Rezumi `avatar.tsx` probably exposes `AvatarImage`/`AvatarFallback`-style exports; those flatten to `Avatar.Image` / `Avatar.Fallback`.
  Example:

```tsx
<Avatar size="lg" color="accent" variant="soft">
  <Avatar.Image alt={user.name} src={user.image} />
  <Avatar.Fallback delayMs={600}>{initials}</Avatar.Fallback>
</Avatar>
```

# 13. AvatarGroup

Purpose: stacked (overlapping) or grid layout of Avatars with overflow count. Import `{Avatar, AvatarGroup}`.
Anatomy:

```
AvatarGroup
  Avatar (Image + Fallback) ...
  AvatarGroup.Count   (optional explicit overflow indicator)
```

Props:
`size`: `'sm' | 'md' | 'lg'` = `'md'` (applied to children that omit `size`); `color`: `'default' | 'accent' | 'success' | 'warning' | 'danger'`; `variant`: `'default' | 'soft'`;
`max`: `number` = - (show all; auto-counts the rest); `isGrid`: `boolean` = `false`; `overlap`: `'clip' | 'ring'` (ignored when `isGrid`) = `'clip'`; `className`, `children`.
AvatarGroup.Count: `children` (for example `+3`), `size`, `color`, `variant`, `className`; not truncated by `max`; suppresses the auto count.
Gotchas: context reaches DIRECT Avatar children only; no default `role="group"` (add `role="group"` plus `aria-label` for meaningful stacks); `total` prop from v2 is removed (use `AvatarGroup.Count`).
Example:

```tsx
<AvatarGroup max={3} role="group" aria-label="Collaborators">
  {users.map((u) => (
    <Avatar key={u.id}>
      <Avatar.Image alt={u.name} src={u.image} />
      <Avatar.Fallback>{u.initials}</Avatar.Fallback>
    </Avatar>
  ))}
</AvatarGroup>
```

# 14. Badge (deepest; READ THE GOTCHA)

Purpose: a small INDICATOR positioned over another element (notification count, status dot, "New"). It is NOT an inline label/pill. For labels, tags, statuses use `Chip`. Import `{Badge, Avatar}`.
Anatomy:

```
Badge.Anchor        (relative wrapper)
  <target element>   (Avatar, Button, icon...)
  Badge             (positioned; plain-text children auto-wrapped in Badge.Label)
    Badge.Label     (optional explicit)
```

Props:
Badge `color`: `"default" | "accent" | "success" | "warning" | "danger"` = `"default"`; Badge `variant`: `"primary" | "secondary" | "soft"` = `"primary"`; Badge `size`: `"sm" | "md" | "lg"` = `"md"`;
Badge `placement`: `"top-right" | "top-left" | "bottom-right" | "bottom-left"` = `"top-right"`; Badge `children`, `className`: omit children for a dot; Badge.Anchor `children`, `className`; Badge.Label `children`, `className`.
Gotchas:

- shadcn `Badge` (inline pill with `variant="default|secondary|destructive|outline"`) maps to `Chip`, NOT `Badge`. See mapping table.
- Without `Badge.Anchor` the badge has nothing to position against.
- `variant` has no `outline`/`tertiary`; Chip has `tertiary`, Badge does not.
  Example:

```tsx
<Badge.Anchor>
  <Avatar>
    <Avatar.Fallback>JD</Avatar.Fallback>
  </Avatar>
  <Badge color="danger" size="sm">
    5
  </Badge>
</Badge.Anchor>
```

# 15. Chip (deepest)

Purpose: small inline label/tag/status pill (this is the shadcn Badge replacement). Import `{Chip}`.
Anatomy: `Chip` > (optional icon) + `Chip.Label` (plain-text children are auto-wrapped in Chip.Label) + (optional trailing icon).
Props:
`color`: `"default" | "accent" | "success" | "warning" | "danger"` = `"default"`; `variant`: `"primary" | "secondary" | "tertiary" | "soft"` = `"secondary"`; `size`: `"sm" | "md" | "lg"` = `"md"`; `className`, `children`.
Chip.Label: `children`, `className`.
Gotchas:

- Static only: no `onPress`, no `onClose`, no close button in the doc for Chip. Removable tags use `Tag`/`TagGroup` (not in this slice). `CloseButton` is listed as related for composing.
- Color set has NO `info`/`primary`; "accent" is the brand color. `danger` replaces `destructive`.
- Icons are plain SVG siblings; pair with `<Chip.Label>` when icons are present, for correct spacing.
- No `outline` variant: use `secondary` (bordered) or `tertiary` (transparent).
- Default variant is `secondary` (bordered neutral), not filled.
  Example:

```tsx
<Chip color="success" variant="soft" size="sm">
  <CircleCheckFill width={12} />
  <Chip.Label>Published</Chip.Label>
</Chip>
```

# 16. Card (deepest)

Purpose: surface container with header/content/footer slots. Import `{Card}`. (Uses `Surface` styling; docs also reference `cardVariants` from `@heroui/styles` for custom interactive cards.)
Anatomy:

```
Card                   (variant)
  Card.Header
    Card.Title         (renders <h3>)
    Card.Description   (renders <p>)
  Card.Content
  Card.Footer          (row layout)
```

Props:
`Card.variant`: `"transparent" | "default" | "secondary" | "tertiary"` = `"default"`; all parts: `className`, `children`.
Gotchas:

- Variants are semantic prominence levels, not shadcn styles. Docs are internally inconsistent on which surface token each uses (prose says `default` = surface-secondary; example comment says `bg-surface`). Verify visually.
- `Card.Title` renders an `h3`; `Card.Description` renders a `p`. Do not nest headings blindly.
- NO `size` prop, no `CardAction` slot, no `border`/`ring` props. A header-right action must be built with layout classes (`Card.Header className="flex items-start justify-between"`).
- Card padding is in the `.card` base (padding + border), not on Content; content inside a form: wrap `Card.Content` and `Card.Footer` in `<Form>` as the docs example does.
- Non-card-semantic: for interactive cards use an anchor with `cardVariants().base()` class, not `Card onPress`.
  Example:

```tsx
<Card variant="secondary" className="w-96">
  <Card.Header>
    <Card.Title>Resume</Card.Title>
    <Card.Description>Last edited 2 days ago</Card.Description>
  </Card.Header>
  <Card.Content>...</Card.Content>
  <Card.Footer>
    <Button size="sm">Open</Button>
  </Card.Footer>
</Card>
```

# 17. Accordion (deepest)

Purpose: stack of expandable items; built on RAC DisclosureGroup. Import `{Accordion}`. Rezumi `accordion.tsx` maps here.
Anatomy:

```
Accordion
  Accordion.Item  (id)
    Accordion.Heading            (renders heading wrapper)
      Accordion.Trigger
        text / icon
        Accordion.Indicator      (chevron; children = custom icon)
    Accordion.Panel
      Accordion.Body
```

Accordion props:
Props:
`allowsMultipleExpanded`: `boolean` = `false`; `expandedKeys` / `defaultExpandedKeys`: `Iterable<Key>`; `onExpandedChange`: `(keys: Set<Key>) => void`; `isDisabled`: `boolean` = `false`;
`variant`: `"default" | "surface"` = `"default"`; `hideSeparator`: `boolean` = `false`; `className`, `children`, `render`.
Accordion.Item: `id: Key`, `isDisabled`, `defaultExpanded`, `isExpanded`, `onExpandedChange(isExpanded: boolean)`, `className`, `children`, `render`.
Accordion.Trigger: `className`, `children` (ReactNode or render fn), `onPress`, `isDisabled`, `render`.
Accordion.Panel: `className`, `children`, `render`. Accordion.Indicator / Accordion.Body: `className`, `children`.
Hook: `useDisclosureGroupNavigation({expandedKeys, itemIds, onExpandedChange})` returns `{isNextDisabled, isPrevDisabled, onNext, onPrevious}`.
Gotchas:

- NO `type="single" | "multiple"` and NO `collapsible` prop. Single-open is the default; multi-open needs `allowsMultipleExpanded`. Whether the open item can be collapsed again is not stated in the docs (RAC DisclosureGroup behavior), verify.
- NO `value` / `defaultValue` / `onValueChange`. Use `expandedKeys` (a `Set`) + `onExpandedChange(Set)`; items need `id`.
- Four wrapper layers required per item: `Item > Heading > Trigger` and `Item > Panel > Body`. Wrap these in a Rezumi `AccordionItem` facade to avoid call-site churn.
- Indicator: `Accordion.Indicator` renders a default chevron when no children; rotation is built in.
- Trigger is a React Aria button: use `onPress`, not `onClick`.
  Example:

```tsx
<Accordion allowsMultipleExpanded defaultExpandedKeys={["a"]}>
  <Accordion.Item id="a">
    <Accordion.Heading>
      <Accordion.Trigger>
        Question
        <Accordion.Indicator />
      </Accordion.Trigger>
    </Accordion.Heading>
    <Accordion.Panel>
      <Accordion.Body>Answer</Accordion.Body>
    </Accordion.Panel>
  </Accordion.Item>
</Accordion>
```

# 18. Disclosure (deepest; Collapsible replacement)

Purpose: single show/hide section (RAC Disclosure). Rezumi `collapsible.tsx` maps here. Import `{Disclosure, Button}`.
Anatomy:

```
Disclosure                 (isExpanded / onExpandedChange)
  Disclosure.Heading
    Disclosure.Trigger     OR  <Button slot="trigger">
      Disclosure.Indicator
  Disclosure.Content
    Disclosure.Body
```

Props:
Disclosure `isExpanded`: `boolean` = `false`; Disclosure `onExpandedChange`: `(isExpanded: boolean) => void`; Disclosure `isDisabled`: `boolean` = `false`; Disclosure `children` (ReactNode or render fn), `className`, `render`;
DisclosureTrigger `children`, `className`; DisclosureContent `children`, `className`, `render`.
Render props: `isExpanded`, `isDisabled`. Classes: `.disclosure`, `__heading|__trigger|__indicator|__content`. States: indicator `[data-expanded="true"]`, content `[aria-hidden="false"]`.
Gotchas:

- A custom trigger is ANY RAC Button with `slot="trigger"` (docs use HeroUI `<Button slot="trigger">`). This is the `asChild`-trigger replacement.
- Docs list only controlled `isExpanded`; uncontrolled `defaultExpanded` is NOT in the Disclosure API table (it appears only on `Accordion.Item`). Keep state yourself with `isExpanded`/`onExpandedChange`, or verify `defaultExpanded` in a spike.
- No `open`/`onOpenChange` naming: it is `isExpanded`/`onExpandedChange`.
- Content animates height; put padding on `Disclosure.Body`, not on `Disclosure.Content`.
  Example:

```tsx
<Disclosure isExpanded={open} onExpandedChange={setOpen}>
  <Disclosure.Heading>
    <Button slot="trigger" variant="secondary">
      Details
      <Disclosure.Indicator />
    </Button>
  </Disclosure.Heading>
  <Disclosure.Content>
    <Disclosure.Body>Hidden content</Disclosure.Body>
  </Disclosure.Content>
</Disclosure>
```

# 19. DisclosureGroup

Purpose: manages a set of `Disclosure` items (accordion-like, unstyled by default). Import `{DisclosureGroup, Disclosure, useDisclosureGroupNavigation}`.
Anatomy: `DisclosureGroup` > `Disclosure id="x"` (each with Heading/Trigger/Content as above).
Props:
`expandedKeys`: `Set<Key>`; `defaultExpandedKeys`: `Iterable<Key>`; `onExpandedChange`: `(keys: Set<Key>) => void`; `allowsMultipleExpanded`: `boolean` = `false`; `isDisabled`: `boolean` = `false`;
`children` (ReactNode or render fn), `className`.
Render props: `expandedKeys`, `isDisabled`. Class `.disclosure-group`. Each child `Disclosure` needs `id` and an `aria-label` when its trigger has no text label.
Gotcha: `Accordion` is the opinionated styled wrapper over this; prefer `Accordion` for stacked FAQ/section lists.
Example:

```tsx
<DisclosureGroup expandedKeys={keys} onExpandedChange={setKeys}>
  <Disclosure id="one">...</Disclosure>
  <Disclosure id="two">...</Disclosure>
</DisclosureGroup>
```

# 20. Kbd (deepest)

Purpose: keyboard key / shortcut hint. Import `{Kbd}`.
Anatomy:

```
Kbd                 (variant)
  Kbd.Abbr          (modifier symbol; keyValue="command" | title + children)
  Kbd.Content       (key text, e.g. "K")
```

Special/nav keys can be `Kbd` with only `<Kbd.Abbr keyValue="enter" />` (no Content). `Kbd.Key` also exists (text content).
Props:
Kbd `variant`: `"default" | "light"` = `"default"`; Kbd `className`, `children`; Kbd.Abbr `keyValue`: one of the key values below (used in all examples; the Abbr API table itself lists only `title`, `children`, `className`);
Kbd.Abbr `title`: `string` (accessibility, e.g. "Command"); Kbd.Abbr `children`: symbol text (e.g. command glyph); Kbd.Key `children`, `className`; Kbd.Content `children`, `className`.
Available `keyValue`s: modifier `command | shift | ctrl | option | alt | win`; special `enter | delete | escape | tab | space | capslock | help`; navigation `up | down | left | right | pageup | pagedown | home | end`; function `fn`.
Gotchas:

- NOT `<Kbd>Ctrl+K</Kbd>`. Compose parts; plain text children also render but lose the modifier symbol mapping. A Rezumi `Kbd`/`KbdGroup` pair (check `kbd.tsx`) needs a facade that accepts a keys array and maps to `Abbr`/`Content`.
- `keyValue="command"` maps to the command key glyph; no platform detection is documented, so choose `command` vs `ctrl` yourself (Rezumi shortcuts like "⌘Z" need a facade).
- Inside menu items: `<Kbd slot="keyboard" className="ms-auto" variant="light">` so Dropdown places it correctly.
- Inside InputGroup: `InputGroup.Suffix className="pe-2"` > `Kbd`.
- No `size` prop (compare shadcn `h-5` pill); override with `className`.
  Example:

```tsx
<Kbd variant="light">
  <Kbd.Abbr keyValue="command" />
  <Kbd.Content>K</Kbd.Content>
</Kbd>
```

# 21. Alert

Purpose: inline status message banner (info/success/warning/error). Import `{Alert, CloseButton, Button, Spinner}`. Rezumi `alert.tsx` maps here.
Anatomy:

```
Alert                (status)
  Alert.Indicator    (default status icon; children = custom icon / Spinner)
  Alert.Content
    Alert.Title
    Alert.Description
  [Button / CloseButton as siblings of Alert.Content for actions or dismiss]
```

Props:
Alert `status`: `"default" | "accent" | "success" | "warning" | "danger"` = `"default"`; all parts `className`, `children`.
Gotchas:

- Include `<Alert.Indicator />` for the status icon (docs always do; it defaults to the status icon, `children` override it).
- The Alert is not interactive on its own; there is no `onClose`/`dismissible`. Dismiss = your own `<CloseButton onPress={...}/>` placed after `Alert.Content`.
- shadcn `variant="destructive"` -> `status="danger"`; shadcn `default` -> `status="default"`; `info` -> `status="accent"`.
- Action buttons: docs render a mobile (in-content, `sm:hidden`) and desktop (sibling, `hidden sm:block`) copy; a single placement is fine if responsive duplication is not needed.
- Title/description are separate parts (no `AlertTitle` flat export).
  Example:

```tsx
<Alert status="danger">
  <Alert.Indicator />
  <Alert.Content>
    <Alert.Title>Save failed</Alert.Title>
    <Alert.Description>Check your connection and retry.</Alert.Description>
  </Alert.Content>
  <CloseButton onPress={dismiss} />
</Alert>
```

# 22. Label

Purpose: accessible `<label>`. Import `{Label}`.
Props:
`htmlFor`: `string`; `isRequired`: `boolean` (adds required asterisk) = `false`; `isDisabled`: `boolean` = `false`; `isInvalid`: `boolean` (danger color) = `false`; `className`, `children`.
Gotchas:

- Inside `TextField`/`ComboBox`/`Checkbox` parents, Label is auto-wired (no `htmlFor`) and inherits required/disabled/invalid from the field context. Standalone use needs `htmlFor` + matching `id`.
- Used as menu/listbox item text (`<Label>` inside `Dropdown.Item` / `ListBox.Item`) as well as form label.
- Rezumi `label.tsx` probably maps 1:1; shadcn `peer-disabled` styles are replaced by `isDisabled` or parent context.
  Example: `<Label htmlFor="email" isRequired>Email</Label>`

# 23. Description

Purpose: muted helper text for a field (`slot="description"` for RAC wiring). Import `{Description}`. Props: `className`, `children`. Class: `.description`.
Gotchas: inside TextField/Checkbox/ComboBox/CheckboxGroup it is auto-linked as `aria-describedby`; standalone, give it an `id` and reference it via `aria-describedby` on the input. Also used inside menu/list items (`Dropdown.Item`, `ListBox.Item`).
Example: `<Description>We never share your email.</Description>`

# 24. FieldError

Purpose: validation message for FORM fields (TextField, Select, NumberField, ComboBox, Checkbox, CheckboxGroup...). Import `{FieldError}`.
Props:
`children`: `ReactNode | ((validation: ValidationResult) => ReactNode)`; `className`: `string`.
Class `.field-error`; visible only when the `data-visible` attribute is present (parent field invalid); text is truncated with ellipsis.
Gotchas:

- Drive visibility with the parent's `isInvalid` (controlled) or native/aria validation (`validate`, `isRequired`, `validationBehavior`). It renders nothing when valid; you do not conditionally render it yourself.
- Render-function form gives `validation.validationErrors` (string[]); self-closing `<FieldError />` shows the field's built-in/validate() message (docs `Fieldset` example).
- Place as a direct child of the field root, after `Input`/`Description`.
- For non-form widgets (TagGroup, Calendar) use `ErrorMessage` instead.
  Example:

```tsx
<TextField isInvalid={!!error}>
  <Label>Username</Label>
  <Input />
  <FieldError>{error}</FieldError>
</TextField>
```

# 25. ErrorMessage

Purpose: low-level error text for NON-FORM components (TagGroup, Calendar, collections); built on RAC `Text` with `slot="errorMessage"`. Import `{ErrorMessage}`. Props: `className`, `children`. Class `.error-message` (danger color, truncated).
Gotchas: not form-integrated, you must conditionally render its children (`{!!isInvalid && <>...</>}`). For form fields prefer `FieldError`.

# 26. Fieldset

Purpose: `<fieldset>` grouping with legend, description, grouped fields, actions. Import `{Fieldset, FieldGroup, Description, Form, TextField, Label, Input, FieldError, Button}`.
Anatomy:

```
Fieldset
  Fieldset.Legend
  Description
  FieldGroup  (or Fieldset.Group)    form controls
  Fieldset.Actions                   buttons
```

Props:
Fieldset / Legend / Group / Actions: `className`, `children`, `nativeProps` (native HTML attrs for fieldset / legend / div / div).
Gotchas:

- The docs example imports a separate `FieldGroup` component AND the anatomy lists `Fieldset.Group`; both appear in docs (`FieldGroup` in Usage; `Fieldset.Group` in Anatomy/Surface). Treat them as equivalent; confirm in a spike which is exported.
- Native attributes beyond className go through `nativeProps`, not as direct props.
- Form-wrapping: put `<Form>` OUTSIDE `Fieldset`; `Fieldset.Actions` holds submit/reset buttons.
- On `Surface` backgrounds set `variant="secondary"` on Input/TextArea.
  Example:

```tsx
<Form onSubmit={onSubmit}>
  <Fieldset>
    <Fieldset.Legend>Profile</Fieldset.Legend>
    <FieldGroup>
      <TextField isRequired name="name">
        <Label>Name</Label>
        <Input />
        <FieldError />
      </TextField>
    </FieldGroup>
    <Fieldset.Actions>
      <Button type="submit">Save</Button>
    </Fieldset.Actions>
  </Fieldset>
</Form>
```

# 27. TextField (supporting; not in the requested list but required by Input, InputGroup, FieldError)

Purpose: field wrapper combining Label + Input/TextArea + Description + FieldError, with validation/state context (RAC TextField). Import `{TextField, Label, Input, TextArea, Description, FieldError}`.
Anatomy: `TextField` > `Label`, `Input` | `TextArea` | `InputGroup`, `Description`, `FieldError`.
Props:
Base: `children` (ReactNode or `(TextFieldRenderProps) => ReactNode`), `className`, `style`, `fullWidth` (`false`), `id`, `render`;
Validation: `isRequired` (`false`), `isInvalid`, `validate: (value: string) => ValidationError | true | null | undefined`, `validationBehavior: 'native' | 'aria'` (`'native'`), `validationErrors: string[]`;
Value: `value`, `defaultValue` (string), `onChange: (value: string) => void`; State: `isDisabled`, `isReadOnly`; Form: `name`, `autoFocus`; A11y: `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-details`;
Also: `type` (docs use `type="email"` on TextField), `minLength` (docs Form example).
Render props: `isDisabled`, `isInvalid`, `isReadOnly`, `isRequired`, `isFocusWithin`, `isFocusVisible` (`isFocused` deprecated).
Class `.textfield` (`flex flex-col gap-1`). States: `[data-invalid]` (hides description when invalid), `[data-disabled]`, `[data-focus-within]`, `[data-focus-visible]`.
Gotchas:

- This is the shadcn `Field` + `FieldLabel` + `FieldDescription` + `FieldError` replacement. Invalid/disabled/required go on TextField, not on Input.
- `TextField.onChange` gets a STRING; the plain `Input` child (outside TextField control) gets an event. Docs examples mix both (`value/onChange={setValue}` on TextField; `value/onChange={(e)=>...}` on child Input). Choose TextField-level control to stay consistent with react-hook-form `Controller` wrappers.
- A TextField with no visible Label needs `aria-label`.
- While invalid, Description is auto-hidden (swap description/error, as docs do).
  Example:

```tsx
<TextField isRequired isInvalid={invalid} value={v} onChange={setV} name="title">
  <Label>Title</Label>
  <Input placeholder="Resume title" />
  <Description>Shown on your dashboard.</Description>
  <FieldError>Title is required.</FieldError>
</TextField>
```

# 28. Form

Purpose: native `<form>` wrapper (RAC Form) that integrates field validation (native or ARIA) and server-side errors. Import `{Form}`. Rezumi `form.tsx` (react-hook-form-based `Form`/`FormField`/`FormItem`... most likely) does NOT map 1:1: HeroUI Form is thin, there is no field-controller abstraction.
Anatomy: `Form` > fields (`TextField`, `Checkbox`, `RadioGroup`, `Switch`, `Select`, ...) + `Button type="submit"` / `type="reset"`. Compose `Fieldset` inside for structure.
Props:
`onSubmit`: `(e: SyntheticEvent<HTMLFormElement>) => void`; `onReset`: same shape; `onInvalid`: same shape (default focuses first invalid; `preventDefault()` to customize);
`action`, `method` (`'get' | 'post'`), `encType`, `target`: native; `validationBehavior`: `'native' | 'aria'` = `'native'`;
`validationErrors`: `ValidationErrors` (server-side errors keyed by field `name`; shown immediately, cleared when user edits); `aria-label`, `aria-labelledby` (creates a form landmark); `className`, `children`, `render`.
No BEM classes; style via `className`.
Gotchas:

- `validationBehavior="native"` (default) blocks submit with browser validation UI; `"aria"` shows errors in real time and does not block submission. Can be overridden per field.
- Server errors: `<Form validationErrors={{email: "Already taken"}}>`; each field `name` must match the key; `<FieldError />` renders it.
- Fields need `name` to appear in `FormData`.
- Controlled forms (react-hook-form): Rezumi can keep RHF and wrap each HeroUI field with `Controller` mapping `value/onChange` and `isInvalid={fieldState.invalid}` + `<FieldError>{error.message}</FieldError>`; the HeroUI Form does not provide `FormField/FormItem/FormMessage`.
  Example:

```tsx
<Form
  onSubmit={(e) => {
    e.preventDefault();
    save(Object.fromEntries(new FormData(e.currentTarget)));
  }}
>
  <TextField isRequired name="email" type="email">
    <Label>Email</Label>
    <Input />
    <FieldError />
  </TextField>
  <Button type="submit">Save</Button>
</Form>
```

# 29. InputOTP (deepest for otp; Rezumi `otp-field.tsx`)

Purpose: one-time-code input, built on the `input-otp` library (not React Aria). Import `{InputOTP, REGEXP_ONLY_DIGITS, REGEXP_ONLY_CHARS, REGEXP_ONLY_DIGITS_AND_CHARS}`.
Anatomy:

```
InputOTP maxLength={6}
  InputOTP.Group
    InputOTP.Slot index={0..}
  InputOTP.Separator
  InputOTP.Group ...
```

Props:
`maxLength`: `number` (REQUIRED); `value` / `onChange(value: string)`: `string` = uncontrolled if no value; `onComplete`: `(value: string) => void`; `variant`: `"primary" | "secondary"` = `"primary"`;
`isDisabled`, `isInvalid`: `boolean` = `false`; `validationErrors`: `string[]`; `validationDetails`: `ValidityState`; `pattern`: `string` (e.g. `REGEXP_ONLY_DIGITS`); `textAlign`: `'left' | 'center' | 'right'` = `'left'`;
`inputMode`: `'numeric' | 'text' | 'decimal' | 'tel' | 'search' | 'email' | 'url'` = `'numeric'`; `placeholder`: `string`; `pasteTransformer`: `(text: string) => string`; `name`, `autoFocus`;
`className`, `containerClassName`, `children`; Slot: `index` (REQUIRED, zero-based), `className`; Group / Separator: `className`, `children` (Group).
Gotchas:

- Slots are rendered EXPLICITLY (you map `index` 0..n-1); there is no auto-generated slot list. A Rezumi `OtpField` facade can generate them from `maxLength`.
- `onChange` is a STRING (not event). `onComplete` replaces any "length === maxLength" effect.
- Validation message is not built in: no FieldError integration; render `<span className="field-error" data-visible={isInvalid}>` yourself (docs example) with `aria-describedby`.
- Pattern defaults to unrestricted; pass `pattern={REGEXP_ONLY_DIGITS}` for digit-only (it also exports the pattern constants).
- Label is the plain `Label` component placed above; not auto-wired. Give `aria-label` or link via `aria-describedby`.
  Example:

```tsx
<InputOTP maxLength={6} pattern={REGEXP_ONLY_DIGITS} value={code} onChange={setCode} onComplete={verify}>
  <InputOTP.Group>
    {[0, 1, 2].map((i) => (
      <InputOTP.Slot key={i} index={i} />
    ))}
  </InputOTP.Group>
  <InputOTP.Separator />
  <InputOTP.Group>
    {[3, 4, 5].map((i) => (
      <InputOTP.Slot key={i} index={i} />
    ))}
  </InputOTP.Group>
</InputOTP>
```

# 30. Link

Purpose: styled anchor (RAC Link). Import `{Link}` (and `linkVariants` from `@heroui/styles`).
Anatomy: `Link` > text + optional `Link.Icon` (defaults to a built-in arrow icon; `children` = custom icon).
Props:
`href`: `string`; `target`: `string` = `"_self"`; `rel`, `download` (`boolean | string`); `isDisabled`: `boolean` = `false`; `onPress`: `(e: PressEvent) => void`; `autoFocus`: `boolean`; `className`, `children`, `render`.
Gotchas:

- Router integration (TanStack Router): not covered with TanStack in the docs; documented pattern is to apply classes: `<RouterLink className={linkVariants().base()}>` with `<Link.Icon className={slots.icon()} />`, or `className="link ..."` on the router link. RAC `RouterProvider` is the other path (not in these docs; verify).
- Not a Button: no `variant`/`size`. A button-looking link needs `buttonVariants()` class on the anchor (verify exported helper) or Button `render`.
- Link.Icon is rendered by default arrow only when included; omit it for plain text links.
  Example: `<Link href="https://example.com" target="_blank" rel="noopener noreferrer">Docs<Link.Icon /></Link>`

# 31. Drawer (deepest)

Purpose: slide-out panel from any edge (built on RAC Modal; supports drag-to-dismiss). Rezumi `sheet.tsx` would map here (not in the requested file list, noted for completeness). Import `{Drawer, Button, useOverlayState}`.
Anatomy:

```
Drawer                         (state?: UseOverlayStateReturn)
  Button / Drawer.Trigger
  Drawer.Backdrop              (variant, dismiss, open state)
    Drawer.Content             (placement)
      Drawer.Dialog
        Drawer.Handle          (optional drag handle)
        Drawer.CloseTrigger    (optional X)
        Drawer.Header > Drawer.Heading
        Drawer.Body            (native scrolling)
        Drawer.Footer
```

Props:
Drawer `state`: `UseOverlayStateReturn`; Drawer `children`: ReactNode; Backdrop `variant`: `"opaque" | "blur" | "transparent"` = `"opaque"`; Backdrop `isDismissable`: `boolean` = `true`;
Backdrop `isKeyboardDismissDisabled`: `boolean` = `false`; Backdrop `isOpen` / `onOpenChange`: `boolean` / `(isOpen: boolean) => void`; Backdrop `className`: string or fn;
Content `placement`: `"top" | "bottom" | "left" | "right"` = `"bottom"`; Dialog `role`: string = `"dialog"`; Dialog `aria-label`, `aria-labelledby`, `className`, `children`;
Trigger / Header / Heading / Body / Footer / Handle / CloseTrigger `className`, `children`.
`useOverlayState({defaultOpen, onOpenChange})` -> `{isOpen, open(), close(), toggle(), setOpen(v)}`.
Gotchas:

- DEFAULT placement is `"bottom"`; the shadcn Sheet default `side="right"` must be passed explicitly: `<Drawer.Content placement="right">`.
- `Drawer.Dialog` is mandatory inside `Content`; there is no `size`/`width` prop. Set width on Dialog via `className="w-[420px] max-w-full"` (docs do not document a size prop; verify default width in a spike).
- Closing: `slot="close"` on any `<Button>` in the dialog; control state with `Backdrop isOpen/onOpenChange` (no parent `Drawer` needed) or pass `state={useOverlayState()}` to `Drawer`.
- Defaults are the OPPOSITE of AlertDialog: Drawer `isDismissable=true`, ESC dismiss on. Drag-to-dismiss on handle, header, footer (Body excluded to avoid scroll conflicts).
- `Drawer.Handle` is meaningful for bottom/top placement (docs show bottom handle before content, top handle after).
- Forms inside Body: wrap with `<Form>` / `<form>`. Footer buttons sit OUTSIDE a Body form and `slot="close"` only closes; the docs example does not wire submission, so submit from an `onPress` handler.
  Example:

```tsx
<Drawer>
  <Button variant="secondary">Open</Button>
  <Drawer.Backdrop>
    <Drawer.Content placement="right">
      <Drawer.Dialog>
        <Drawer.CloseTrigger />
        <Drawer.Header>
          <Drawer.Heading>Settings</Drawer.Heading>
        </Drawer.Header>
        <Drawer.Body>...</Drawer.Body>
        <Drawer.Footer>
          <Button slot="close" variant="secondary">
            Close
          </Button>
        </Drawer.Footer>
      </Drawer.Dialog>
    </Drawer.Content>
  </Drawer.Backdrop>
</Drawer>
```

# 32. Breadcrumbs

Purpose: location trail (RAC Breadcrumbs). Import `{Breadcrumbs}`.
Anatomy: `Breadcrumbs` > `Breadcrumbs.Item` (href for links; last item without `href` = current page, gets `aria-current="page"`).
Props:
Breadcrumbs `separator`: `ReactNode` = chevron-right icon; Breadcrumbs `isDisabled`: `boolean` = `false`; Breadcrumbs `className`, `children`, `render`; Breadcrumbs.Item `href`: `string`;
Breadcrumbs.Item `className`, `children` (ReactNode or render fn), `render`.
Gotchas: separator is a prop on the root, not a child part; no `BreadcrumbEllipsis`/`BreadcrumbPage` parts (current page = Item without `href`); `render` on Item is typed loosely (docs cast `props as any`); client-side routing needs router wiring (see Link).
Example:

```tsx
<Breadcrumbs>
  <Breadcrumbs.Item href="/">Home</Breadcrumbs.Item>
  <Breadcrumbs.Item href="/resumes">Resumes</Breadcrumbs.Item>
  <Breadcrumbs.Item>Edit</Breadcrumbs.Item>
</Breadcrumbs>
```

# 33. DatePicker (deepest) + DateField + Calendar (shared model)

All three use `@internationalized/date` types (`DateValue`: `CalendarDate`, `CalendarDateTime`, `ZonedDateTime`; helpers `today(getLocalTimeZone())`, `parseDate("2025-02-03")`, `parseZonedDateTime(...)`, `.compare()`, `.add({months: 3})`). Values are NOT JS `Date` or ISO strings. Add `@internationalized/date` as a dependency; convert at the form boundary (`parseDate(iso)` in, `value.toString()` out; DateField `name` submits ISO 8601).

## 33a. DatePicker

Purpose: date input (segmented DateField) plus calendar popover (RAC DatePicker). Composition-first, no prebuilt API. Import `{DatePicker, DateField, Calendar, Label, Description, FieldError}`.
Anatomy:

```
DatePicker  (alias DatePicker.Root)
  Label
  DateField.Group
    DateField.Input > {(segment) => <DateField.Segment segment={segment} />}
    DateField.Suffix
      DatePicker.Trigger > DatePicker.TriggerIndicator   (default calendar icon)
  Description / FieldError
  DatePicker.Popover
    Calendar aria-label
      Calendar.Header
        Calendar.YearPickerTrigger > YearPickerTriggerHeading + YearPickerTriggerIndicator
        Calendar.NavButton slot="previous" / slot="next"
      Calendar.Grid > GridHeader({(day) => <Calendar.HeaderCell>{day}</...>}) + GridBody({(date) => <Calendar.Cell date={date} />})
      Calendar.YearPickerGrid > YearPickerGridBody({({year}) => <Calendar.YearPickerCell year={year} />})
```

Props (inherit RAC DatePicker; documented):
Props:
`value` / `defaultValue`: `DateValue | null`; `onChange`: `(value: DateValue | null) => void`; `isOpen` / `defaultOpen` / `onOpenChange`: `boolean` / `boolean` (`false`) / `(isOpen: boolean) => void`;
`isDisabled`: `boolean` = `false`; `isInvalid`: `boolean`; `minValue`, `maxValue`: `DateValue`; `name`: `string` (form submit); `children`: `ReactNode | (DatePickerRenderProps) => ReactNode`; `render`: DOMRenderFunction.
Also used in docs examples: `isRequired`, `granularity`, `hourCycle`, `hideTimeZone`, `shouldForceLeadingZeros` (Format Options example), `className`.
Parts: `DatePicker.Root`, `.Trigger`, `.TriggerIndicator`, `.Popover`. Classes: `.date-picker`, `__trigger|__trigger-indicator|__popover`. States: trigger `[data-open]`, `[data-disabled]`, `[data-focus-visible]`.
Gotchas:

- ~35 lines of boilerplate per picker. Build ONE Rezumi `DatePicker` facade (props: label, value, onChange, minValue...) that renders this tree.
- Controlled: `value`/`onChange` with `DateValue | null` (`null` clears). Native JS dates need conversion (`new CalendarDate(y, m, d)` / `parseDate`).
- Validation: put `isInvalid` (+ `isRequired`, `minValue`) on DatePicker and `<FieldError>` between the DateField.Group and the Popover.
- `onChange` is NOT an event; no `onSelect`.
- Resume dates are often month/year only (partial); Calendar/DateField do not offer month-only granularity in these docs (`granularity` options shown: day, hour, minute, second). Keep a Rezumi month/year control or custom component for those.
- Locale: `I18nProvider` from `react-aria-components` (docs import it from there) switches calendar system.
  Example (minimal; ~20 lines):

```tsx
<DatePicker name="start" value={v} onChange={setV}>
  <Label>Start date</Label>
  <DateField.Group fullWidth>
    <DateField.Input>{(s) => <DateField.Segment segment={s} />}</DateField.Input>
    <DateField.Suffix>
      <DatePicker.Trigger>
        <DatePicker.TriggerIndicator />
      </DatePicker.Trigger>
    </DateField.Suffix>
  </DateField.Group>
  <DatePicker.Popover>
    <Calendar aria-label="Start date">
      <Calendar.Header>
        <Calendar.Heading />
        <Calendar.NavButton slot="previous" />
        <Calendar.NavButton slot="next" />
      </Calendar.Header>
      <Calendar.Grid>
        <Calendar.GridHeader>{(d) => <Calendar.HeaderCell>{d}</Calendar.HeaderCell>}</Calendar.GridHeader>
        <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
      </Calendar.Grid>
    </Calendar>
  </DatePicker.Popover>
</DatePicker>
```

## 33b. DateField

Purpose: keyboard-editable segmented date/time input with label/description/error (RAC DateField). Also the trigger field inside DatePicker/DateRangePicker. Import `{DateField, Label, Description, FieldError}`.
Anatomy:

```
DateField
  Label
  DateField.Group             (variant, fullWidth)
    DateField.Prefix?
    DateField.Input           (variant; render prop: (segment) => <DateField.Segment segment={segment} />)
    DateField.InputContainer? (scroll wrapper for start/end inputs)
    DateField.Suffix?
  Description / FieldError
```

DateField props (inherit RAC DateField): base (`children` or render fn, `className`, `style`, `fullWidth` (`false`), `id`, `render`); value (`value`, `defaultValue`: `DateValue | null`; `onChange: (value: DateValue | null) => void`; `placeholderValue`); validation (`isRequired`, `isInvalid`, `minValue`, `maxValue`, `isDateUnavailable`, `validate: (value: DateValue) => ValidationError | true | null | undefined`, `validationBehavior: 'native' | 'aria'` default `'native'`); format (`granularity`, `hourCycle: 12 | 24`, `hideTimeZone` (`false`), `shouldForceLeadingZeros`); state (`isDisabled`, `isReadOnly`); form (`name` submits ISO 8601, `autoFocus`, `autoComplete`); aria-*.
DateField.Group: `className`, `fullWidth` (`false`), `variant: "primary" | "secondary"` (default `"primary"`) plus RAC Group props. DateField.Input: `className`, `variant`. DateField.Segment: `segment`, `className`. Prefix / Suffix / InputContainer: `className`, `children`.
Gotchas: segments are rendered via a render-prop on `DateField.Input` (mandatory); `variant="secondary"` on `DateField.Group`/`Input` for Surface backgrounds; description auto-hides when invalid.

## 33c. DateRangePicker (+ RangeCalendar)

Purpose: start/end date range with popover `RangeCalendar` (not in the requested list; required by this picker). Import `{DateRangePicker, DateField, RangeCalendar, Label}`.
Anatomy:

```
DateRangePicker
  Label
  DateField.Group
    DateField.Input slot="start" > segments
    DateRangePicker.RangeSeparator
    DateField.Input slot="end"   > segments
    DateField.Suffix > DateRangePicker.Trigger > DateRangePicker.TriggerIndicator
  DateRangePicker.Popover
    RangeCalendar (same part names as Calendar: Header, YearPickerTrigger, NavButton, Grid, GridHeader, HeaderCell, GridBody, Cell, YearPickerGrid...)
```

Props:
`value` / `defaultValue`: `{start: DateValue; end: DateValue} | null`; `onChange`: `(value: {start: DateValue; end: DateValue} | null) => void`; `isOpen` / `defaultOpen` / `onOpenChange`;
`isDisabled`, `isInvalid`, `minValue`, `maxValue`; `startName`, `endName`: `string` (two form fields); `children`, `render`.
Parts: `.Root`, `.Trigger`, `.TriggerIndicator`, `.RangeSeparator`, `.Popover`. Classes: `.date-range-picker`, `__trigger|__trigger-indicator|__range-separator|__popover`.
Gotchas: two `DateField.Input` with `slot="start"`/`slot="end"`; form names are `startName`/`endName` (not `name`). For resume date RANGES (start/end with "present"), Rezumi will still need custom logic for open-ended ranges.

## 33d. Calendar

Purpose: month grid (RAC Calendar). Standalone or inside DatePicker popover. Import `{Calendar}`.
Props (inherit RAC Calendar):
Props:
`selectionMode`: `'single' | 'multiple'` = `'single'`; `value` / `defaultValue`: `DateValue | null` (single) or `DateValue[] | null` (multiple); `onChange`: `(value) => void`;
`focusedValue` / `onFocusChange`: `DateValue` / `(value: DateValue) => void`; `minValue` / `maxValue`: `DateValue` = `1900-01-01` / `2099-12-31`; `weeksInMonth`: `number`; `isDateUnavailable`: `(date: DateValue) => boolean`;
`firstDayOfWeek`: `'sun' | 'mon' | ... | 'sat'` = locale; `pageBehavior`: `'visible' | 'single'` = `'visible'`; `selectionAlignment`: `'start' | 'center' | 'end'` = `'center'`;
`isDisabled` / `isReadOnly` / `isInvalid`: `boolean` = `false`; `visibleDuration`: `{months?, weeks?, days?}` = `{months: 1}`; `defaultYearPickerOpen` / `isYearPickerOpen` / `onYearPickerOpenChange`.
Parts: `Header`, `Heading` (`offset`, `format`), `NavButton slot="previous|next"`, `Grid` (`offset`), `GridHeader`, `GridBody`, `HeaderCell`, `Cell` (`date`; render props `formattedDate`, `isSelected`, `isUnavailable`, `isDisabled`, `isOutsideMonth`), `CellIndicator`, `YearPickerTrigger`, `YearPickerTriggerHeading` (`format`, `offset`), `YearPickerTriggerIndicator`, `YearPickerGrid` (`format` default `{year:'numeric'}`, `visibleYears` default span or `20`), `YearPickerGridBody`, `YearPickerCell`.
Gotchas: `aria-label` required on Calendar; `GridHeader`/`GridBody`/`YearPickerGridBody` take FUNCTION children; use `Calendar.Heading` OR the YearPicker trigger as header, not both.

# 34. ColorPicker (deepest) and color family

Shared model: values are React Aria `Color` objects (or color strings for inputs): `parseColor("#ff0000")` (re-exported from `@heroui/react`; docs also show `parseColor` imported from `react-aria-components`). Methods: `toString("hex"|"rgb"|"hsl"|"hsb"|"css")`, `toFormat(fmt)`, `getChannelValue(ch)`, `withChannelValue(ch, v)`. `onChange` handlers receive a `Color` object, NOT a hex string; convert with `color.toString("hex")` at the Rezumi boundary. Channels: `hue, saturation, lightness, brightness, alpha, red, green, blue`; spaces `hsl | hsb | rgb`.

## 34a. ColorPicker

Purpose: swatch trigger plus popover containing ColorArea/ColorSlider/ColorField/ColorSwatchPicker (RAC ColorPicker). Fully composed. Import `{ColorPicker, ColorArea, ColorSlider, ColorSwatch, ColorField, ColorSwatchPicker, Label, parseColor, type Color}`.
Anatomy:

```
ColorPicker
  ColorPicker.Trigger   > ColorSwatch + Label (or any content / render prop)
  ColorPicker.Popover
    ColorArea > ColorArea.Thumb
    ColorSlider (channel="hue") > Label, ColorSlider.Output, ColorSlider.Track > ColorSlider.Thumb
    [ColorField / ColorSwatchPicker optional]
```

Props:
ColorPicker `value` / `defaultValue`: `string | Color`; ColorPicker `onChange`: `(color: Color) => void`; ColorPicker `children`, `className`; Trigger `children` (ReactNode or render fn), `className`;
Popover `placement`: `Placement` = `"bottom left"`; Popover `children`, `className`.
Gotchas:

- No built-in alpha/hex input; compose `ColorField` (hex) and an alpha `ColorSlider channel="alpha"` yourself.
- The ColorPicker context feeds children: ColorArea/ColorSlider/ColorField/ColorSwatch inside the popover need NO `value`/`onChange` of their own (they bind to the picker).
- Form submit: `ColorSlider` has `name`; ColorField has `name`; ColorPicker itself has no `name` documented. Store the hex string in your form state.
  Example:

```tsx
<ColorPicker value={color} onChange={(c) => setHex(c.toString("hex"))}>
  <ColorPicker.Trigger>
    <ColorSwatch size="lg" />
    <Label>Accent color</Label>
  </ColorPicker.Trigger>
  <ColorPicker.Popover>
    <ColorArea aria-label="Color area" colorSpace="hsb" xChannel="saturation" yChannel="brightness">
      <ColorArea.Thumb />
    </ColorArea>
    <ColorSlider channel="hue" colorSpace="hsb">
      <Label>Hue</Label>
      <ColorSlider.Output />
      <ColorSlider.Track>
        <ColorSlider.Thumb />
      </ColorSlider.Track>
    </ColorSlider>
  </ColorPicker.Popover>
</ColorPicker>
```

## 34b. ColorArea

Purpose: 2D gradient picker (two channels). Anatomy: `ColorArea` > `ColorArea.Thumb`.
Props:
`value` / `defaultValue`: `string | Color`; `onChange` / `onChangeEnd`: `(color: Color) => void` (drag / drag end); `xChannel` / `yChannel`: `ColorChannel` = `"saturation"` / `"brightness"`; `colorSpace`: `ColorSpace`;
`isDisabled`: `boolean` = `false`; `showDots`: `boolean` (dot grid overlay) = `false`; `className`, `render`.
ColorArea.Thumb: `className`, `style` (CSSProperties or fn), `render`. Classes `.color-area`, `--show-dots`, `__thumb`. States `[data-disabled]`, `[data-focus-visible]`, thumb `[data-dragging]`. Needs `aria-label` when standalone (the picker example sets it).

## 34c. ColorSlider

Purpose: single-channel slider (hue, alpha, ...). Anatomy: `ColorSlider` > `Label`?, `ColorSlider.Output`, `ColorSlider.Track` > `ColorSlider.Thumb`.
Props:
`channel`: `ColorChannel` (no default; sets the manipulated channel); `colorSpace`: `ColorSpace` (default: value's space); `value` / `defaultValue`: `string | Color`; `onChange` / `onChangeEnd`: `(value: Color) => void`;
`orientation`: `"horizontal" | "vertical"` = `"horizontal"`; `isDisabled`, `name`, `aria-label`, `className`, `children`, `render`.
Output / Track / Thumb: `className`, `style` (Track/Thumb: CSSProperties or fn), `children`. Render props: `state`, `color`, `orientation`, `isDisabled`. Classes `.color-slider`, `__output|__track|__thumb`.

## 34d. ColorField

Purpose: text input for hex (or a single channel) with label/description/error (RAC ColorField). Anatomy: `ColorField` > `Label`, `ColorField.Group` > (`ColorField.Prefix` > `ColorSwatch`) + `ColorField.Input` (+ `ColorField.Suffix`), `Description`, `FieldError`.
Props:
`value` / `defaultValue`: `Color | null`; `onChange`: `(color: Color | null) => void`; `colorSpace`, `channel`: edits a single channel when `channel` set; otherwise hex;
`isRequired`, `isInvalid`, `isDisabled`, `isReadOnly`, `isWheelDisabled`: `boolean` = `false` / -; `validate`: `(value: Color) => ValidationError | true | null | undefined`; `validationBehavior`: `'native' | 'aria'` = `'native'`;
`name`, `autoFocus`, `fullWidth` (`false`), `aria-*`, `className`, `style`, `children`, `render`.
ColorField.Group: `variant: "primary" | "secondary"` (`"primary"`), `fullWidth`, `className`, `render`. ColorField.Input: `className`, `placeholder`. Prefix / Suffix: `className`, `children`.
Gotchas: `value` is `Color | null` (empty input gives `null`); partial typing is not valid until blurred/complete; docs example holds `useState<Color | null>(parseColor("#0485F7"))` and passes `color ?? undefined` to the swatch.

## 34e. ColorSwatch

Purpose: color preview chip (checkered background shows transparency). `<ColorSwatch color="#0485F7" />`; inside ColorPicker.Trigger it reads the picker color.
Props:
`color`: `string | Color`; `colorName`: `string` (accessible name override); `shape`: `"circle" | "square"` = `"circle"`; `size`: `"xs" | "sm" | "md" | "lg" | "xl"` (16/24/32/36/40 px) = `"md"`;
`style`: `CSSProperties | (({color}) => CSSProperties)`; `aria-label`, `className`, `render`.

## 34f. ColorSwatchPicker

Purpose: selectable preset swatches (RAC ColorSwatchPicker). Anatomy: `ColorSwatchPicker` > `ColorSwatchPicker.Item color` > `ColorSwatchPicker.Swatch` + `ColorSwatchPicker.Indicator` (Indicator appears in all examples/anatomy; it is not in the API table).
Props:
ColorSwatchPicker `value` / `defaultValue`: `string | Color`; ColorSwatchPicker `onChange`: `(value: Color) => void`; ColorSwatchPicker `size`: `"xs" | "sm" | "md" | "lg" | "xl"` = `"md"`;
ColorSwatchPicker `variant`: `"circle" | "square"` (shape, not style) = `"circle"`; ColorSwatchPicker `layout`: `"grid" | "stack"` = `"grid"`; Item `color`: `string | Color` (REQUIRED); Item `isDisabled`: `boolean` = `false`;
Swatch `className`.
Gotchas: `variant` here is the SHAPE; `onChange` gives a `Color` object (compare via `toString("hex")` for presets); presets are mapped manually into `Item`s.
Example:

```tsx
<ColorSwatchPicker value={hex} onChange={(c) => setHex(c.toString("hex"))}>
  {PRESETS.map((c) => (
    <ColorSwatchPicker.Item key={c} color={c}>
      <ColorSwatchPicker.Swatch />
      <ColorSwatchPicker.Indicator />
    </ColorSwatchPicker.Item>
  ))}
</ColorSwatchPicker>
```

# Part 2: Rezumi to HeroUI mapping

Source of truth for current API: `packages/ui/src/components/*.tsx` (read in full for the files below). Call-site counts come from a Babel AST scan of 271 `.tsx` files in `apps/web/src` (tests excluded); `{expr}` means a dynamic value. "Uses" = JSX opening tags. Base UI idioms in the current code: `onClick`, `disabled`, `render={<Element/>}` (+ `nativeButton={false}`), `checked/onCheckedChange`, `open/onOpenChange`, `value/onValueChange`, `data-slot`.

## Cross-cutting API rewrites (apply everywhere)

| Concern       | Rezumi / Base UI today                                                                                           | HeroUI v3                                                                                                                                                                                                                      |
| ------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Press         | `onClick` (Button 273, IconButton 30, DropdownMenuItem 72, AlertDialogAction 2, AlertDialogCancel 1)             | `onPress(e: PressEvent)`. Menu items: `Dropdown.Menu onAction(key)` or per-item `onAction`. Not a drop-in: handler receives `PressEvent`, not `MouseEvent`.                                                                    |
| Disabled      | `disabled` (Button ~112, IconButton 12, Input 10, Checkbox 5)                                                    | `isDisabled` on Button/Checkbox/field wrappers; native `disabled` stays on plain `Input`/`InputGroup.Input`                                                                                                                    |
| Loading       | `loading` (Button 39, IconButton 1, AlertDialogAction 1)                                                         | `isPending` + spinner rendered by you in a children function (no auto-spinner)                                                                                                                                                 |
| Open state    | `open` / `onOpenChange` (Collapsible 7, AlertDialog 2, DropdownMenu 2)                                           | `isOpen`/`onOpenChange` (Dropdown, Drawer.Backdrop, AlertDialog.Backdrop, Autocomplete, DatePicker); Disclosure uses `isExpanded`/`onExpandedChange`                                                                           |
| Selection     | `checked/onCheckedChange` (Checkbox 17, CheckboxItem 8), `value/onValueChange` (RadioGroup 7, Combobox 2, OTP 2) | Checkbox `isSelected`/`onChange(boolean)`; Menu `selectedKeys`/`onSelectionChange(Set)`; ComboBox `selectedKey`/`onSelectionChange(key)` or `value`/`onChange`; InputOTP `value`/`onChange(string)`                            |
| Polymorphism  | `render={<Link .../>}` (Button 19, DropdownMenuTrigger 24, ComboboxInput 2) + `nativeButton={false}`             | `render={(props) => <Link {...props} />}` (function). For menus the trigger is simply a child `<Button>`; no `render`/`nativeButton`                                                                                           |
| Variant names | `danger`, `warn`, `error`, `destructive`, `neutral`, `outline`, `link`                                           | `danger`, `warning`, `danger`, `danger`, `default`, `secondary`/`outline`/`tertiary`, none (see rows)                                                                                                                          |
| Sizes         | `default`, `sm`, `lg`, `icon`, `icon-sm`, `icon-xs`, `icon-lg`                                                   | `sm`, `md`, `lg` + boolean `isIconOnly`                                                                                                                                                                                        |
| Labels/fields | `Label` + `FormItem/FormControl/FormMessage`                                                                     | `TextField` + `Label` + `Description` + `FieldError`; Checkbox/ComboBox/etc. own their label wiring                                                                                                                            |
| Styling hooks | `data-slot="..."`, `group-data-*`, Rezumi tokens (`ink`, `line-2`, `sunken`, `accent-soft`, ...)                 | BEM classes (`.button`, `.chip--soft`), `data-*` states; docs show theme tokens such as `bg-surface`, `bg-default`, `text-muted`, `text-foreground`, `border-border`, `bg-accent`, `text-danger`, `bg-danger-soft`, `bg-field` |

## Button family

### button.tsx -> `Button`

Rezumi: `Button({variant, size, loading, type="button", onClick, render, nativeButton})` with `buttonVariants`. Used 342 times in 101 files.

Variant call-site distribution and target (`variant` is dynamic in 4 uses; ~88 uses rely on the default `primary`):

| Rezumi `variant`    | Uses               | HeroUI `variant`          | Notes                                                                                                                                                                   |
| ------------------- | ------------------ | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `primary` (default) | ~88 (implicit)     | `primary`                 | same name and default                                                                                                                                                   |
| `secondary`         | 142                | `secondary` or `outline`  | Rezumi secondary is a bordered surface button; HeroUI `outline` is closest visually, `secondary` is the filled-neutral variant. Pick one globally (decision for design) |
| `ghost`             | 93                 | `ghost` (or `tertiary`)   | `tertiary` is the docs' "cancel" style; `ghost` for toolbar and icon buttons                                                                                            |
| `link`              | 13                 | no Button variant         | Use `Link` component or `className` on a ghost Button; HeroUI Button has no `link` variant                                                                              |
| `danger`            | 2 (+ HoldButton 1) | `danger` or `danger-soft` | same name                                                                                                                                                               |

Size call-site distribution:

| Rezumi `size`      | Uses                         | HeroUI                                                                |
| ------------------ | ---------------------------- | --------------------------------------------------------------------- |
| default (implicit) | ~153                         | `md` (default)                                                        |
| `sm`               | 161                          | `sm`                                                                  |
| `lg`               | 0                            | `lg`                                                                  |
| `icon`             | 18                           | `isIconOnly` + `aria-label` (+ `md`)                                  |
| `icon-sm`          | 6 (Button) + 26 (IconButton) | `isIconOnly` + `size="sm"`                                            |
| `icon-xs`          | 3                            | `isIconOnly` + `size="sm"` plus `className` for smaller box (no `xs`) |
| `icon-lg`          | 0                            | `isIconOnly` + `size="lg"`                                            |

Other call-site changes:

- `onClick={...}` (273) -> `onPress={...}`; event type changes to `PressEvent`.
- `disabled={...}` (~112) -> `isDisabled={...}`.
- `loading={...}` (39) -> `isPending={...}`; Rezumi renders `<Spinner decorative/>` automatically, HeroUI requires `{({isPending}) => <>{isPending && <Spinner color="current" size="sm"/>}...</>}` children. Wrap in a Rezumi `Button` facade accepting `loading` to keep 39 call sites untouched (Rezumi also sets `aria-busy` and blocks activation; HeroUI pending blocks pointer events via `data-pending`).
- `type="submit"` (29) / `type="button"` (25): unchanged (`type` passes through; docs use `type="submit"`/`"reset"`).
- `render={<Link to=... />} nativeButton={false}` (19): `render={(props) => <Link {...props} to=... />}` with TanStack `Link`; HeroUI docs only show a `<button {...props}/>` example for Button `render`, so validate link semantics (role, keyboard) in a spike or use `buttonVariants()` classes on the router link.
- `render={<Button .../>}` on DropdownMenuTrigger/PopoverTrigger (24 + 5): drop `render`; place the `<Button>` as the direct child of `Dropdown`/`Popover`.
- `buttonVariants` export: HeroUI exports `buttonVariants` (tailwind-variants) from `@heroui/react`; extend with `tv({extend: buttonVariants, ...})`.
- `touch-target` utility, `active:scale-[0.97]`: HeroUI applies its own pressed scale; re-add `touch-target` via className if needed.

### icon-button.tsx -> `Button isIconOnly` + `Tooltip`

Rezumi `IconButton({icon, label, shortcut, iconSize, tooltipSide, variant="ghost", size="icon"})`: renders Button + Tooltip + Icon + optional Kbd. 38 uses in 22 files (`onClick` 30, `size="icon-sm"` 26, `disabled` 12, `loading` 1, `variant="secondary"` 1).
HeroUI: no IconButton component. Keep a Rezumi facade:

```tsx
<Tooltip delay={0}>
  <Button isIconOnly aria-label={label} variant={variant} size="sm" onPress={...}><Icon name={icon} /></Button>
  <Tooltip.Content><p className="text-xs">{label}</p>{shortcut && <Kbd>...</Kbd>}</Tooltip.Content>
</Tooltip>
```

(`Tooltip` and `Tooltip.Content` appear in the InputGroup docs example; Tooltip's own API is outside this slice, read it before migrating.) `onClick` -> `onPress`, `disabled` -> `isDisabled`, `loading` -> `isPending`.

### button-group.tsx -> `ButtonGroup`

Rezumi: `<fieldset>` with `orientation`, CSS that squares inner corners. 4 uses in 2 files. HeroUI: `ButtonGroup` with `variant`, `size`, `orientation`, `fullWidth`, `isDisabled` and context to DIRECT child Buttons; `ButtonGroup.Separator` goes inside each Button after the first. Differences: (1) group-level `variant`/`size` replace per-button props; (2) children nested in Dropdown/Popover do not inherit; (3) `data-slot="button-group"` selectors in Rezumi CSS (select-trigger, input flex-1) do not apply; mixed input+button groups should use `InputGroup` instead.

### hold-button.tsx -> custom wrapper on `Button` (no HeroUI equivalent)

Rezumi `HoldButton({onConfirm, disabled, loading, ...ButtonProps})`: fill driven by rAF, handlers `onPointerDown/Up/Cancel`, `onLostPointerCapture`, `onKeyDown/Up`, `onBlur`, `onContextMenu`, `onClick`, forwards a `ref`. 1 use (`variant="danger"`).
HeroUI Button is a React Aria button: documented props are `onPress`, `isDisabled`, `isPending`, `render`, with children as function. The doc does NOT document DOM event passthrough (`onPointerDown`, `onKeyDown`) or `ref` forwarding. Risk: the hold logic relies on raw pointer/keyboard handlers and `setPointerCapture`; RAC Button likely forwards these but this is unverified in the docs, and Space/Enter handling is likely owned by React Aria's press system, which may conflict with the custom `onKeyDown`/`onKeyUp` hold logic. Options: (a) keep a native `<button className={buttonVariants({...})}>` using the exported `buttonVariants`; (b) rebuild with `onPressStart`/`onPressEnd` (React Aria props are not listed in the HeroUI Button docs; verify). Recommended: (a).

### close-button (no current Rezumi file) -> `CloseButton`

Replaces ad-hoc X icon buttons; `onPress`, `aria-label`; used by `Alert` dismissal and as `*.CloseTrigger` content.

## Overlays and menus

### alert-dialog.tsx -> `AlertDialog`

| Rezumi export                                                                                              | HeroUI                                                                                                          | Differences                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AlertDialog` (`open`, `onOpenChange`; 2 uses, both controlled)                                            | `AlertDialog` (uncontrolled trigger wrapper) or standalone `AlertDialog.Backdrop isOpen onOpenChange`           | Controlled: put `isOpen`/`onOpenChange` on `AlertDialog.Backdrop`, no `AlertDialog` root needed. `useOverlayState` available.                                              |
| `AlertDialogTrigger`                                                                                       | child `<Button>` or `AlertDialog.Trigger`                                                                       | no `render` prop pattern                                                                                                                                                   |
| `AlertDialogContent` (`size="default"\|"sm"`, Portal+Overlay+Popup in one)                                 | `AlertDialog.Backdrop` > `AlertDialog.Container` (`size` xs/sm/md/lg/cover, `placement`) > `AlertDialog.Dialog` | three parts replace one; Rezumi `sm` (360px) / `default` (440px) -> Container `size="sm"`/`"md"` (px values not in docs, verify); width override via `className` on Dialog |
| `AlertDialogOverlay` / `AlertDialogPortal`                                                                 | `AlertDialog.Backdrop` (`variant` opaque/blur/transparent)                                                      | portal handled internally; `UNSTABLE_portalContainer` for custom                                                                                                           |
| `AlertDialogHeader`                                                                                        | `AlertDialog.Header`                                                                                            |                                                                                                                                                                            |
| `AlertDialogMedia` (danger-soft icon box)                                                                  | `AlertDialog.Icon status="danger"` (default status)                                                             | `status`: default/accent/success/warning/danger                                                                                                                            |
| `AlertDialogTitle`                                                                                         | `AlertDialog.Heading`                                                                                           |                                                                                                                                                                            |
| `AlertDialogDescription`                                                                                   | `AlertDialog.Body` (put a `<p>`)                                                                                | Body is a general content area, not a description slot                                                                                                                     |
| `AlertDialogFooter`                                                                                        | `AlertDialog.Footer`                                                                                            |                                                                                                                                                                            |
| `AlertDialogAction` (a plain `Button`; 2 uses: `variant` danger 1, `disabled` 1, `loading` 1, `onClick` 2) | `<Button variant="danger" isPending onPress>`                                                                   | Rezumi's Action does NOT auto-close (call sites handle it). Do not add `slot="close"` to actions that do async work or can fail; close via controlled `isOpen`.            |
| `AlertDialogCancel` (`Close` primitive rendered as secondary Button; 2 uses, `onClick` 1)                  | `<Button slot="close" variant="tertiary">Cancel</Button>`                                                       | `slot="close"` closes automatically; `onPress` still fires                                                                                                                 |
| (none)                                                                                                     | `AlertDialog.CloseTrigger`                                                                                      | optional X                                                                                                                                                                 |

Behavioral defaults to set explicitly: HeroUI `isDismissable=false` and `isKeyboardDismissDisabled=true` (ESC off) by default. Base UI AlertDialog closes on ESC; set `isKeyboardDismissDisabled={false}` to keep it.

### dropdown-menu.tsx -> `Dropdown`

Rezumi call-site volume is the biggest in this migration: DropdownMenu 28 (23 files), Trigger 28, Content 26, Item 73, Separator 22, Sub/SubTrigger 13, RadioItem 11, CheckboxItem 8, RadioGroup 7, Group 5, Label 3.

| Rezumi export                                                                                                              | HeroUI                                                                                                                    | Differences                                                                                                                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DropdownMenu` (`open`/`onOpenChange` 2 uses)                                                                              | `Dropdown` (`isOpen`/`onOpenChange`)                                                                                      | renamed props                                                                                                                                                                                                                                                |
| `DropdownMenuTrigger` (`render={<Button/>}` 24, `disabled` 1)                                                              | direct child `<Button>` of `Dropdown`, or `Dropdown.Trigger` for non-Button                                               | no `render`; `disabled` -> `isDisabled` on the Button; `aria-label` for icon triggers                                                                                                                                                                        |
| `DropdownMenuContent` (`align` end 15 / start 6 / center 1; `side` top 2 + 2 dynamic; `sideOffset`, `positionerClassName`) | `Dropdown.Popover placement` > `Dropdown.Menu`                                                                            | `side`+`align` -> `placement` string: bottom+start = `"bottom start"` (Rezumi default), bottom+end = `"bottom end"`, center = `"bottom"`, top+start = `"top start"`. Two parts (Popover + Menu) instead of one. No `sideOffset`/`alignOffset` props in docs. |
| `DropdownMenuItem` (`onClick` 72, `variant="destructive"` 11, `disabled` 11, `inset`)                                      | `Dropdown.Item id textValue variant="danger"` > `<Label>`                                                                 | `onClick` -> `Menu onAction(key)` (id dispatch) or Item-level `onAction`; `destructive` -> `danger`; `disabled` -> `isDisabled` or `Menu disabledKeys`; every item needs `id`+`textValue`; text must be inside `<Label>`; no `inset`                         |
| `DropdownMenuCheckboxItem` (`checked/onCheckedChange` 8, `onSelect` 2)                                                     | `Dropdown.Item` + `<Dropdown.ItemIndicator/>` under `Menu selectionMode="multiple"` + `selectedKeys`/`onSelectionChange`  | selection is a menu-level `Set`, not per-item booleans; refactor 8 uses in 3 files into key sets                                                                                                                                                             |
| `DropdownMenuRadioGroup` (`value/onValueChange` 7) + `RadioItem` (`value=...` 11)                                          | `Dropdown.Section selectionMode="single"` (or Menu-level) with `selectedKeys` + `Dropdown.ItemIndicator type="dot"`       | radio value -> item `id`; `onValueChange(string)` -> `onSelectionChange(Set)` (take first)                                                                                                                                                                   |
| `DropdownMenuSub` / `SubTrigger` / `SubContent` (13)                                                                       | `Dropdown.SubmenuTrigger` > `Dropdown.Item` + `Dropdown.SubmenuIndicator` and nested `Dropdown.Popover` > `Dropdown.Menu` | 3 parts -> SubmenuTrigger + nested Popover                                                                                                                                                                                                                   |
| `DropdownMenuLabel` (3)                                                                                                    | `<Header>` inside `Dropdown.Section`                                                                                      | Header from `@heroui/react`                                                                                                                                                                                                                                  |
| `DropdownMenuGroup` (5)                                                                                                    | `Dropdown.Section`                                                                                                        |                                                                                                                                                                                                                                                              |
| `DropdownMenuSeparator` (22)                                                                                               | `<Separator />`                                                                                                           |                                                                                                                                                                                                                                                              |
| `DropdownMenuShortcut`                                                                                                     | `<Kbd slot="keyboard" className="ms-auto" variant="light">...`                                                            | uses Kbd parts                                                                                                                                                                                                                                               |
| `DropdownMenuPortal`                                                                                                       | n/a                                                                                                                       | handled by Popover                                                                                                                                                                                                                                           |
| `ContextMenu` (`context-menu.tsx`)                                                                                         | none in this slice (only Dropdown `trigger="longPress"`)                                                                  | needs separate decision                                                                                                                                                                                                                                      |

### combobox.tsx -> `ComboBox` (or `Autocomplete`)

2 call-site clusters (`ComboboxRoot` 2 uses: `items` 2, `value` 2, `onValueChange` 2, `multiple` 1, `disabled` 1; `ComboboxInput render` 2; `ComboboxItem value/disabled` 2; Clear 1; Trigger 2 incl. `render` 1).

| Rezumi export                                                                                                   | HeroUI                                                                                                                       | Differences                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ComboboxRoot` (Base UI: `items`, `value` (item value, may be object), `onValueChange`, `multiple`, `disabled`) | `ComboBox` (`items`, `selectedKey`/`onSelectionChange(key)` or `value`/`onChange`, `selectionMode="multiple"`, `isDisabled`) | selection is a KEY (id), not the item; convert `value` objects to ids; multiple uses `Key[]` and needs `selectionMode="multiple"` on BOTH ComboBox and ListBox plus `ComboBox.Value` |
| `ComboboxInput` (`InputGroup` + `InputGroupInput`, `render` 2)                                                  | `ComboBox.InputGroup` > `Input` + `ComboBox.Trigger`                                                                         | structure fixed; no `render`                                                                                                                                                         |
| `ComboboxTrigger`                                                                                               | `ComboBox.Trigger`                                                                                                           | chevron included                                                                                                                                                                     |
| `ComboboxClear`                                                                                                 | none on ComboBox                                                                                                             | `Autocomplete.ClearButton` / `SearchField.ClearButton` exist elsewhere; ComboBox needs a custom clear Button                                                                         |
| `ComboboxContent` (`side`, `align`, `sideOffset`, `anchor`)                                                     | `ComboBox.Popover placement`                                                                                                 | no offset props; `anchor`/chips layout (`data-chips`) has no equivalent                                                                                                              |
| `ComboboxList`                                                                                                  | `ListBox`                                                                                                                    |                                                                                                                                                                                      |
| `ComboboxItem` (`value`, `disabled`)                                                                            | `ListBox.Item id textValue` + `ListBox.ItemIndicator`                                                                        | `value` -> `id`; `disabled` -> `ComboBox disabledKeys` or item `isDisabled` (RAC); need `textValue`                                                                                  |
| `ComboboxEmpty`                                                                                                 | `ListBox renderEmptyState={() => <EmptyState/>}` + `allowsEmptyCollection`                                                   |                                                                                                                                                                                      |
| `ComboboxValue`                                                                                                 | `ComboBox.Value` (multiple mode)                                                                                             |                                                                                                                                                                                      |
| `useFilter`                                                                                                     | `useFilter` (re-exported; RAC) or `ComboBox defaultFilter`                                                                   |                                                                                                                                                                                      |

### Drawer / sheet (`sheet.tsx`, not in scope list) -> `Drawer`: noted in section 31 (default `placement="bottom"`, `isDismissable=true`).

## Fields and form controls

### input.tsx -> `Input`

83 uses in 44 files (`value` 79 controlled, `disabled` 10, `type` date 11 / password 5 / url 4 / email 2 / time 2 / text 2 / search 1, spread 9). HeroUI `Input` accepts the same HTML attributes and `onChange(event)`; add `variant="secondary"` on surfaces; no `size`. Rezumi `aria-invalid` coming from `FormControl` context must now come from `TextField isInvalid` (or `aria-invalid` passed manually). 11 `type="date"` uses can stay native or move to `DateField`/`DatePicker` (value type becomes `DateValue`).

### input-group.tsx -> `InputGroup`

12 `InputGroup`, 13 `InputGroupAddon` (`align`: inline-end 10, inline-start 1; no block-start/end uses), 9 `InputGroupText`, 4 `InputGroupInput`, 1 `InputGroupButton` (`size="icon-sm"`).

| Rezumi                                                                                                                                                       | HeroUI                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `InputGroup`                                                                                                                                                 | `InputGroup` (inside `TextField`; `variant`, `fullWidth`)                                                                        |
| `InputGroupInput` (reads `useFormControl()` for id/aria)                                                                                                     | `InputGroup.Input` (context from `TextField`); `type`, `value`, `placeholder`, `disabled`, `readOnly`                            |
| `InputGroupAddon align="inline-end"` (10)                                                                                                                    | `InputGroup.Suffix`                                                                                                              |
| `InputGroupAddon align="inline-start"` (1 explicit + 2 default)                                                                                              | `InputGroup.Prefix`                                                                                                              |
| `InputGroupAddon align="block-*"` (0 uses)                                                                                                                   | no direct part; layout via classes                                                                                               |
| `InputGroupText` (9)                                                                                                                                         | plain text/ReactNode inside `Prefix`/`Suffix`                                                                                    |
| `InputGroupButton`                                                                                                                                           | `<Button isIconOnly size="sm" variant="ghost" aria-label>` inside `<InputGroup.Suffix className="pe-0">`, `onClick` -> `onPress` |
| Gotcha: `InputGroup` is only correctly wired inside `TextField`; the current `FormControl render={<InputGroupInput/>}` pattern needs a `TextField` ancestor. |

### form.tsx -> `TextField` / `Form` / `FieldError` (largest refactor)

Rezumi exports `FormItem` (40 uses, `hasError` 35), `FormLabel` (41), `FormControl` (40, `render` 39), `FormDescription` (6), `FormMessage` (24, `errors` 22), `useFormControl`, `FormControlContext`. These are form-library-agnostic (TanStack Form style `errors` arrays, generated ids, `aria-describedby`, `aria-invalid`). HeroUI `Form` is a thin RAC `<form>`; field components (TextField, Checkbox, ComboBox, DatePicker, ...) carry their own id, label, description and error wiring.

| Rezumi                                                                                                                                                                                                                                                                                     | HeroUI                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `FormItem hasError` + `FormControl render={<Input/>}`                                                                                                                                                                                                                                      | `TextField isInvalid={hasError}` > `Label` + `Input` (+ `Description`, `FieldError`)                                |
| `FormControl render={<X/>}` for non-text controls (Select, Textarea, Switch, Checkbox...)                                                                                                                                                                                                  | that control's own root with `isInvalid`, e.g. `Checkbox isInvalid`, `ComboBox isInvalid`, `TextField` + `TextArea` |
| `FormLabel` (41)                                                                                                                                                                                                                                                                           | `Label` (auto-wired inside the field)                                                                               |
| `FormDescription` (6)                                                                                                                                                                                                                                                                      | `Description`                                                                                                       |
| `FormMessage errors={[...]}` (24)                                                                                                                                                                                                                                                          | `<FieldError>{firstMessage}</FieldError>`; only shows when the field is invalid (`isInvalid`)                       |
| `useFormControl()` (id, aria)                                                                                                                                                                                                                                                              | not needed                                                                                                          |
| Migration option: keep a Rezumi `FormField` facade that takes `errors` and renders `TextField isInvalid={errors.length > 0}` + `FieldError` so 40 call sites change shape once. `Form` props to use: `onSubmit`, `validationErrors` (server errors keyed by `name`), `validationBehavior`. |

### label.tsx -> `Label`

43 uses in 16 files. HeroUI `Label` has `htmlFor`, `isRequired`, `isDisabled`, `isInvalid`, `className`; text styling (`text-xs font-medium text-ink-2`) must be restored via className or global `.label` override. Group-disabled styling is context-driven.

### checkbox.tsx -> `Checkbox`

17 uses in 14 files, ALL controlled (`checked` 17, `onCheckedChange` 17, `disabled` 5, `indeterminate` 1).
`checked` -> `isSelected`; `onCheckedChange(checked: boolean)` -> `onChange(isSelected: boolean)`; `disabled` -> `isDisabled`; `indeterminate` -> `isIndeterminate`. Structure: replace `<Checkbox/>` + adjacent `<Label>` with `Checkbox` > `Checkbox.Content` > `Checkbox.Control` > `Checkbox.Indicator` + text. Standalone boxes (no label) need `aria-label` on `Checkbox`. A Rezumi facade keeping `<Checkbox checked onCheckedChange>` with children as label is advisable.

### otp-field.tsx -> `InputOTP`

2 uses (`length`, `value`, `onValueChange` all dynamic). Rezumi `OTPField({length, children})` auto-renders `length` `OTPFieldInput`s.
Rewrite: `length` -> `maxLength`; `onValueChange` -> `onChange(string)`; add `onComplete` if auto-submit is wanted; slots are explicit (`InputOTP.Group` + `InputOTP.Slot index`), so keep a facade that maps `Array.from({length})` to Slots (and optionally a Separator). Invalid state: `isInvalid` (group-aria-invalid styling today), error text manual (no FieldError wiring). `pattern={REGEXP_ONLY_DIGITS}` is exported.

### kbd.tsx -> `Kbd`

7 uses in 4 files; Rezumi takes plain text (`⌘Z`) and styles it inside tooltips (`in-data-[slot=tooltip-content]`). HeroUI: `Kbd` > `Kbd.Abbr keyValue` (modifiers) + `Kbd.Content` (key). `variant="light"` for popover/menu contexts. Facade should parse shortcuts like `"⌘Z"` into Abbr + Content (or keep plain `Kbd.Content`); tooltip-specific colors need className.

## Display

### accordion.tsx -> `Accordion`

Call sites: Accordion 2, AccordionItem 3 (`value="job-description"` etc.), AccordionTrigger 3, AccordionContent 3 (2 files).

| Rezumi (Base UI)                                                                                              | HeroUI                                                                                               |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `Accordion` (`value`, `defaultValue`, `onValueChange`, `multiple`)                                            | `Accordion` (`expandedKeys`/`defaultExpandedKeys`/`onExpandedChange(Set)`, `allowsMultipleExpanded`) |
| `AccordionItem value="x"`                                                                                     | `Accordion.Item id="x"`                                                                              |
| `AccordionTrigger` (Header + Trigger + built-in caret icon)                                                   | `Accordion.Heading` > `Accordion.Trigger` > text + `Accordion.Indicator`                             |
| `AccordionContent` (Panel with height animation)                                                              | `Accordion.Panel` > `Accordion.Body`                                                                 |
| Both differences are structural (extra wrapper parts) and prop renames; with 3 items total, rewrite directly. |

### collapsible.tsx -> `Disclosure`

Call sites: Collapsible 8 (8 files; `open` 7, `onOpenChange` 1), CollapsibleTrigger 2, CollapsibleContent 8.
`Collapsible open onOpenChange` -> `Disclosure isExpanded onExpandedChange`; `CollapsibleTrigger` (Base UI trigger button) -> `Disclosure.Heading` > `<Button slot="trigger">` (or `Disclosure.Trigger`); `CollapsibleContent` -> `Disclosure.Content` > `Disclosure.Body`. Uncontrolled `defaultOpen` is not in the Disclosure API table (verify). Padding goes on `Body`.

### alert.tsx -> `Alert`

Call sites: Alert 9 in 8 files (`variant` warn 2, error 1, success 1, info 1, default 4), AlertTitle 6, AlertDescription 9.

| Rezumi `variant`                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | HeroUI `status` |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| `default`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `default`       |
| `info`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `accent`        |
| `success`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `success`       |
| `warn`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `warning`       |
| `error`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `danger`        |
| Structure: Rezumi puts a direct `<svg>` child plus `AlertTitle`/`AlertDescription` in a grid; HeroUI needs `Alert` > `Alert.Indicator` (icon; status icon default) + `Alert.Content` > `Alert.Title` + `Alert.Description`. Rezumi sets `role="alert"` for errors; HeroUI docs do not mention roles, so add `role="alert"` for `danger` if announcement matters. Action slot (`data-slot=alert-action`) -> a `Button` sibling after `Alert.Content`; dismissal -> `CloseButton onPress`. |

### avatar.tsx -> `Avatar`

Call sites: Avatar 4 (3 files), Image 4, Fallback 4. `Avatar size="default"|"sm"|"lg"` -> `md`|`sm`|`lg` (HeroUI sizes: sm 32px, md 40px, lg 48px; Rezumi: sm 28, default 32, lg 40, and square `rounded-sm`). `AvatarImage` -> `Avatar.Image` (same `src`/`alt`); `AvatarFallback` -> `Avatar.Fallback` (`delayMs`, `color`). Base UI Avatar had the same image/fallback logic. Shape: HeroUI default is circular per the docs examples (shape prop not documented); keep rounded-sm via className if desired.

### badge.tsx -> `Chip` (NOT `Badge`)

Rezumi `Badge` is an inline status pill (12 uses in 6 files: `outline` 6, `neutral` 4, `accent` 1, `warn` 1). HeroUI `Chip` is the equivalent; HeroUI `Badge` is a positioned overlay indicator.

| Rezumi `variant`                                                                                                                                                                          | HeroUI `Chip`                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `neutral` (default)                                                                                                                                                                       | `color="default" variant="soft"` (or `secondary`)    |
| `accent`                                                                                                                                                                                  | `color="accent" variant="soft"`                      |
| `solid`                                                                                                                                                                                   | `color="accent" variant="primary"`                   |
| `warn`                                                                                                                                                                                    | `color="warning" variant="soft"`                     |
| `danger`                                                                                                                                                                                  | `color="danger" variant="soft"`                      |
| `info`                                                                                                                                                                                    | no `info` color: `color="accent" variant="soft"`     |
| `outline`                                                                                                                                                                                 | `variant="secondary"` (bordered, default variant)    |
| `inverse`                                                                                                                                                                                 | no direct match; `variant="primary" color="default"` |
| Other: `render` (useRender polymorphism) is not documented on Chip; text becomes `Chip.Label` automatically. No `onPress`/close; HeroUI `Badge.Anchor` only for notification dots/counts. |

## Gaps and risks (not covered by documented HeroUI OSS API)

1. `HoldButton`, `ContextMenu`, `Command`, `MessageScroller`, `Swap`, `Trace`: no HeroUI equivalent in this slice (A to L). Others (`Popover`, `Dialog`/`Modal`, `Select`, `Switch`, `Tabs`, `Tooltip`, `Textarea`, `Sheet`, `Skeleton`, `Spinner`, `Slider`, `Toast`, `RadioGroup`) are outside A to L and need the M to Z note.
2. Button `render`+link semantics, `ref`/DOM event passthrough on Button (HoldButton), `Disclosure` `defaultExpanded`, `AlertDialog` size px, `Chip` `render`, `Kbd` plain-text children, Alert `role`: undocumented; verify with a spike.
3. Month-only/partial resume dates are not served by `DateField`/`DatePicker` (granularity day/hour/minute/second shown); keep custom month-year controls.
4. Value-type shifts: Date -> `DateValue`; color string -> `Color` object; combobox item -> `Key`; checkbox/menu selection -> boolean/`Set`.
5. Docs inconsistencies noted: Card variant prose vs example surface tokens; Accordion `variant` prop (`default`/`surface`) vs CSS `.accordion--outline`; CheckboxGroup `variant` shown but not in API table; Fieldset `FieldGroup` vs `Fieldset.Group`; Kbd.Abbr `keyValue` absent from its props table; ColorSwatchPicker.Indicator absent from API table.
