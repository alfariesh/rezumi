# Phase 02: overlays, sheet, toast and field tests (agent report)

Scope: `src/ui/overlays.tsx`, `src/ui/sheet.tsx`, `src/ui/toast.tsx`, their tests, `src/ui/fields.test.tsx`, and the
gallery groups `src/dev/gallery/overlays.tsx` and `src/dev/gallery/fields.tsx`. Checks run: `pnpm typecheck` (clean),
`pnpm exec jest src/ui/{overlays,sheet,toast,fields}.test.tsx` (24 tests pass), `vp lint --deny-warnings` and
`vp fmt --check` on the nine files (clean). Nothing was run on a simulator.

## Add to `src/ui/index.ts`

```ts
export {
  ConfirmDialog,
  Dialog,
  Menu,
  Popover,
  SubMenu,
  useDialog,
  useMenu,
  usePopover,
  type ConfirmDialogProps,
  type DialogContentProps,
  type DialogRootProps,
  type MenuItemProps,
  type MenuKey,
  type MenuRootProps,
  type PopoverContentProps,
  type PopoverRootProps,
} from "./overlays";
export { Sheet, type SheetProps } from "./sheet";
export {
  ToastBridge,
  hideToast,
  showToast,
  useAppToast,
  type AppToast,
  type AppToastOptions,
  type AppToastVariant,
} from "./toast";
```

Mount `<ToastBridge />` once inside `HeroUINativeProvider` in `app/_layout.tsx`, for example beside the legacy
`<Toaster />`. The two can run side by side until the old screens move over. Once the bridge is in, the gallery's
"Imperative" toast button works.

## API decisions

- **ConfirmDialog** (`isOpen`, `onOpenChange`, `title`, `message?`, `confirmLabel`, `cancelLabel`, `onConfirm`,
  `destructive?`). It is built on HeroUI `Dialog` (Portal, Overlay, Content, Title, Description) with two full-width
  48 pt buttons: confirm first (`danger` when destructive, otherwise `primary`), then `tertiary` cancel. `cancelLabel`
  is required, so callers name what cancel keeps ("Keep resume"). Confirming plays `haptics.warning()` (destructive
  only), calls `onConfirm` once, then closes. Cancel, an overlay tap and a swipe close it without confirming. There is
  no hold-to-confirm (the legacy `hold`); add it later if a screen needs it.
- **Sheet** has a controlled API (`isOpen` / `onOpenChange`), not a ref. Why: it matches Dialog, Menu and Popover, the
  screen keeps the sheet's state beside its form state, and a dirty guard is just a prop. The wrapper takes over the
  imperative TrueSheet lifecycle that `scripts/sheets.test.mjs` guards:
  - presentation is deferred (a fast close waits for `present()` to resolve);
  - a reopen waits for the previous `onDidDismiss`;
  - a late native callback never closes a sheet that was reopened;
  - an interactive dismissal reports `onOpenChange(false)` once.

  Other props:
  - `title` (title row, and the `paneTitle` for screen readers);
  - `closeLabel` (shows a close `IconButton` with that label);
  - `detents` (`"auto"` or fractions, default `["auto"]`; changing detent plays `haptics.selection()`);
  - `footer`: a sticky slot for the primary action. It is an `absolute` TrueSheet footer that rises above the keyboard,
    with the safe area tucked behind the keyboard, and the scroll view gets `contentInsetAdjustment: "footer"`;
  - `scroll` (default true; a `ScrollView` wired as `scrollableRef`, `keyboardShouldPersistTaps="handled"`,
    `keyboardDismissMode="interactive"`);
  - `padded`;
  - `canDismiss` (default true) with `onDismissAttempt`.

  `canDismiss={false}` maps to TrueSheet 4.1's native `dismissible={false}`. Drag and Android back then fire the
  native `onDismissAttempt`, and the close button and accessibility escape call it too. Closing through `isOpen` still
  works, so "Discard changes?" is a `ConfirmDialog` that the owner opens from `onDismissAttempt`; the gallery has an
  example. Android back closes a dismissible sheet natively.

  Styling:
  - the background is `useThemeColor("overlay")` (the web's `bg-overlay` for sheets);
  - the corner radius is 24 (`rounded-3xl`; TrueSheet takes a number);
  - the footer has a top separator;
  - phones get a grabber, and wide screens (`useIsWide`) get `presentation="form"` at most 540 pt wide;
  - the maximum height is 90% under the status bar;
  - reduced motion presents and dismisses without animation;
  - content sits inside a `GestureHandlerRootView`, so a Slider or swipeable row works inside the native sheet on
    Android (HeroUI's BottomSheet does the same).

- **Why TrueSheet directly and not HeroUI `BottomSheet`.** In 1.1.1, HeroUI's BottomSheet is itself TrueSheet, through
  its Reanimated adapter. It is ref-only (`present` / `dismiss`) and adds themed parts and title linking. We would
  still need our own controlled lifecycle, header layout and dirty guard on top, so it is not clearly better. HeroUI
  `Menu` / `Select` / `Popover` with `presentation="bottom-sheet"` keep using it internally, and the gallery shows a
  bottom-sheet Menu.
- **Toast**: `useAppToast()` returns `{ show, hide }`. `show({ title, description?, variant?, undo?: { label, onUndo },
  duration? })` returns the id. `showToast` / `hideToast` work outside React through `ToastBridge`. A `showToast` sent
  before the bridge mounts is kept (the latest only) and shows on mount; the call returns `undefined`. Behaviour:
  - built on HeroUI's toast region (`useToast`, hosted by `HeroUINativeProvider`);
  - one visible at a time: `hide("all")` before each `show`, because HeroUI ignores a `show` with an existing id;
  - bottom placement, 6 s by default (doubled while a screen reader is on);
  - Undo is the HeroUI action button and closes the toast after `onUndo`;
  - `success` plays `haptics.success()` and `danger` plays `haptics.error()`;
  - every toast is announced through `AccessibilityInfo.announceForAccessibility`, because HeroUI's toast sets no
    live region.

  Optional at the root, though not needed because the wrapper already enforces both: `config={{ toast: { maxToasts:
  1, defaultProps: { placement: "bottom" } } }}`. When the Phase 03 tab bar arrives, set `toast.insets.bottom` so
  toasts clear it.

## HeroUI used and what was built

| Need                       | Source                                                                                                                                                |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dialog, Menu, Popover      | HeroUI as shipped (re-exported with `SubMenu` and the hooks)                                                                                          |
| ConfirmDialog              | Built: a thin layer on HeroUI `Dialog` and `Button`                                                                                                   |
| Sheet                      | Built on `@lodev09/react-native-true-sheet` 4.1.2 (HeroUI `IconButton` close, `Typography` title)                                                     |
| Toast                      | HeroUI toast region and default toast; built: the one-at-a-time policy, haptics, announcement and bridge                                              |
| Fields (tests and gallery) | HeroUI as shipped: TextField, Input, TextArea, InputGroup, SearchField, Select, Checkbox, ControlField, Switch, RadioGroup, Slider, InputOTP, Surface |

## Jest notes (changes for `jest.setup.js`, which I did not edit)

1. **`src/ui/motion.ts` cannot be imported under Jest.** Its top-level `Storage.getItemSync` (`expo-sqlite/kv-store`)
   throws `NativeDatabase is not a constructor`. My tests work around it with `jest.mock("./motion", …)`. Suggested
   setup line:

   ```js
   jest.mock("expo-sqlite/kv-store", () => {
     const store = new Map();
     return {
       __esModule: true,
       default: {
         getItemSync: (key) => store.get(key) ?? null,
         setItemSync: (key, value) => void store.set(key, value),
         removeItemSync: (key) => void store.delete(key),
       },
     };
   });
   ```

2. **HeroUI's color helpers log errors under Jest.** With no compiled theme, `console.error("[colorKit.RGB] …")` fires
   for Menu items and ghost or tertiary buttons. Each of my test files filters it. Suggested setup addition, next to
   the Uniwind warning filter:

   ```js
   const error = console.error;
   console.error = (...args) => {
     if (typeof args[0] === "string" && args[0].startsWith("[colorKit")) return;
     error(...args);
   };
   ```

3. **Popover-presented Menu, Popover and Select open only after measuring their trigger**, and Jest host views never
   call back. Workaround (in `overlays.test.tsx`): spy on `View.prototype.measure` to call back, then fire `layout` on
   `Menu.Content` (give it a `testID`), because the content ignores touches until it has laid out on screen.
4. **`Dialog.Title` has `role="heading"`.** In RN, `role` wins over `accessibilityRole`, so query `getByRole("heading")`;
   the Sheet title (`Typography.Heading`) answers to `"header"`. The same applies to `Dialog.Content` (`role="dialog"`):
   a passed `accessibilityRole` is ignored.
5. TrueSheet is mocked inside `sheet.test.tsx` with a controllable stand-in (deferred `present`, manual
   `onDidDismiss`). The package's own `@lodev09/react-native-true-sheet/mock` resolves immediately and never calls
   back, so it cannot test the lifecycle.

## Needs a visual check on the simulator (principal)

- **Sheet:**
  - title row spacing under the grabber;
  - close button alignment;
  - footer separator, padding over the home indicator, and the footer rising with the keyboard in the "Form sheet"
    sample (focus a field);
  - the `contentInsetAdjustment: "footer"` choice: does the last field scroll clear of the footer?;
  - the 24 pt corners;
  - the `overlay` background in dark mode;
  - the two-detent sample (selection haptic) and drag-down on the dirty form ("Discard changes?");
  - Android back (paused).
- **ConfirmDialog:** stacked full-width buttons versus the web's side-by-side footer; check this suits the app.
- **Toast:** bottom position against the home indicator; the Undo button colour per variant; a replaced toast's exit
  animation; with VoiceOver, the announcement and the doubled duration.
- **Menu:** `width={240}` popovers near the screen edge, and the bottom-sheet Menu.
- **Fields gallery:**
  - the "focused" sample draws the focus ring with `ios:outline-accent` / `android:border-accent` and should look like
    real focus;
  - `variant="secondary"` inputs on `Surface`;
  - the Select trigger on a surface uses `bg-default` as a stand-in, because `Select.Trigger` has no secondary variant.
    Check it matches secondary inputs;
  - Slider and InputOTP.
- Large text (1.6×) and RTL for all of the above.

## Not done

- Not visually checked on iOS. Android was not checked (paused by the owner).
- Not mounted: `ToastBridge` at the root, and the `index.ts` exports (principal's files).
- No hold-to-confirm in `ConfirmDialog`, and no `EditorSheet` equivalent: the dirty guard is composed from
  `canDismiss` + `onDismissAttempt` + `ConfirmDialog`, as in the gallery. Add a helper if screens repeat it.
- Popover and Select have no tests of their own; Menu covers the shared popover path. Select is tested only through
  its trigger, and Slider and InputOTP are not tested.
- `vp lint --fix` was once run on the whole `src/ui` and `src/dev/gallery` folders before I narrowed it to my files.
  That run could only have applied safe autofixes. Going by its modification time, it touched only `src/ui/data.test.tsx`
  (another agent's file). `data.test.tsx` currently has 2 failing SwipeableRow tests (presses and swipes not reaching
  their handlers); those failures look like that agent's work in progress, not lint output. Please check that file's
  diff.
