# Phase 02: feedback, navigation, data and stage components (agent report)

Scope: `apps/mobile/src/ui/{feedback,navigation,data,stage}.tsx`, their tests, and the gallery groups
`src/dev/gallery/{feedback,navigation,data}.tsx`. Checks run: `pnpm typecheck` (clean for these files), `pnpm exec jest
src/ui` (11 suites, 60 tests pass), `vp lint --deny-warnings` and `vp fmt --check` on the 11 files (clean). Nothing ran
on a simulator, and nothing was committed.

## Exports to add to `src/ui/index.ts`

```ts
export {
  Avatar,
  Chip,
  DatePicker,
  SwipeableRow,
  TagGroup,
  formatIsoDate,
  parseIsoDate,
  type DatePickerProps,
  type SwipeAction,
  type SwipeableRowProps,
} from "./data";
export {
  Alert,
  EmptyState,
  ProgressBar,
  Skeleton,
  SkeletonGroup,
  Spinner,
  type EmptyStateAction,
  type EmptyStateKind,
  type EmptyStateProps,
  type ProgressBarProps,
} from "./feedback";
export {
  Fab,
  Segment,
  Stepper,
  Tabs,
  type FabAction,
  type FabProps,
  type SegmentOption,
  type SegmentProps,
  type StepperProps,
  type StepperStep,
} from "./navigation";
export { StageDot, StageLabel, type Stage, type StageDotProps, type StageLabelProps } from "./stage";
```

After that the gallery files can import from `@/ui` instead of the module paths.

## Pro components: used and rejected (for `apps/mobile/DESIGN.md`)

All Pro imports go through subpaths (`heroui-native-pro/<name>`).

| Component                  | Decision         | Why                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `empty-state`              | Used             | Under `EmptyState` (`page`, `filtered`); the `inline` kind is a plain dashed row, as on the web.                                                                                                                                                                                                                                                                                                                                    |
| `progress-bar`             | Used, wrapped    | As shipped it is not one screen-reader element (no `accessible`), and with no children it draws nothing. The wrapper adds `accessible`, a required `accessibilityLabel` and a default track and fill. Compound parts are still there.                                                                                                                                                                                               |
| `segment`                  | Used, wrapped    | Items are tabs with `selected` state (from HeroUI's Tabs primitive). The wrapper adds the selection haptic, ignores a press on the selected item, and adds 4 pt (md) or 8 pt (sm) vertical hit slop so items reach 44 pt (md items are 36 pt, plus the 3 pt group padding).                                                                                                                                                         |
| `stepper`                  | Used, wrapped    | Steps are plain Pressables with no accessibility. The wrapper adds the label (`stepLabel(n, total)`, title, description), `selected` on the current step, and the button role only on finished steps when going back is allowed. `Stepper.Step` has to be a direct child of `Stepper` (Pro checks `child.type`).                                                                                                                    |
| `fab`                      | Used, wrapped    | Pro's FAB is a speed dial: its trigger always toggles an open state and turns 45°. For one action, the wrapper controls it closed, drops `aria-expanded` (otherwise VoiceOver says "collapsed"), turns off the rotation and widens the trigger for icon + label. With `actions`, it is the Pro speed dial as shipped.                                                                                                               |
| `swipeable-row`            | Used, wrapped    | There is no full swipe and no edge handling. The wrapper adds both (see API decisions). Its screen-reader custom actions (show and hide actions) work; their labels are required props.                                                                                                                                                                                                                                             |
| `date-picker` (+ calendar) | Rejected for now | It opens a JS calendar in a portal (popover, dialog, or bottom sheet). 01-desain §1.2 asks for the system picker, a portal can stack wrongly over TrueSheet sheets, and its default strings are English (`'Choose a date'`). We use `@react-native-community/datetimepicker` instead. Keep Pro `range-calendar`, `date-range-picker` and `calendar` for range and calendar views (interview calendar, Agenda phase): try them then. |

Installation finding (the principal has since fixed it with `packageExtensions`): almost every Pro component imports
`helpers/internal/components/index.js`. That barrel re-exports the Skia chart bases, which need `its-fine` and `d3-*`.
So a single `EmptyState` loads the chart code; subpath imports do not avoid it. Metro tree-shaking cannot help here.
Expect the chart primitives (and `react-native-skia`, through Pro's optional wrapper) in the bundle as soon as any Pro
component is used.

## API decisions

- **EmptyState** `kind: "page" | "filtered" | "inline"` mirrors the web's `EmptyBlock`. Props: `title`, `description`
  (one sentence), `action`, `secondaryAction` (`{ label, onPress }`), and `icon` (`filtered` defaults to
  `magnifying-glass`; `inline` never shows an icon). `page` shows primary + secondary buttons, `filtered` secondary +
  ghost, `inline` one small tertiary button. A failed load is `kind="page"` with `icon="warning-circle"` and Retry, so
  there is no separate error component.
- **Alert, Skeleton, SkeletonGroup, Spinner, Tabs, Chip, TagGroup, Avatar** are re-exported as shipped.
- **Segment<T>** takes `options` (`{ value, label, icon?, isDisabled? }`, 2–4 of them), `value`, `onValueChange(T)`, a
  required `accessibilityLabel` (names the group), `size`, `hideLabel` (icon-only; labels are still read aloud) and
  `isDisabled`. Items share the width (`flex-1`). Separators sit between neighbours. The selected icon is duotone.
- **Stepper** takes `steps` (`{ title, description? }`), `currentStep` (0-based), and an optional `onStepChange`. Only
  finished steps call it (going back). Steps ahead are never pressable, because the screen's Continue moves forward.
  Without a handler no step is a control, and none reads "dimmed".
- **Fab** takes `icon`, `label` (required; shown unless `extended={false}`), `onPress`, or `actions` (speed dial). It
  floats at `end-4`, 16 pt above the bottom safe area (`useWindowSafeAreaInsets`). Inside a tab screen whose frame
  already ends above the tab bar, pass `safeArea={false}`. `floating={false}` lays it out in place.
- **SwipeableRow** takes trailing `actions` only (1–3), and `actions[0]` sits at the outer edge. Letting go after 50% of
  the row width performs `actions[0]` (`fullSwipe`, on by default). A selection haptic plays when the swipe crosses
  that point, then the row closes.
  - Full swipe is a second RNGH Pan, simultaneous with Pro's pan. It activates only toward the leading edge
    (`activeOffsetX(-10)`, mirrored in RTL).
  - iOS back swipe: an RNGH `Manual` gesture fails at once for touches more than 24 pt from the screen edge. For
    touches inside that zone it stays undecided until the finger lifts, and Pro's pan requires it to fail
    (`requireExternalGestureToFail`). So a swipe that starts at the edge never reaches the row. Only trailing actions:
    that swipe already runs opposite to the back gesture.
  - Open state is controlled internally (`openSide`) instead of through a ref. The React Compiler lint forbids a ref
    inside the gesture builder.
  - The gesture objects are rebuilt when `actions[0].onPress` changes identity. Memoize the handler on long lists.
- **DatePicker** uses the system picker. Values go in and out as ISO `YYYY-MM-DD` strings (`value: string | null`,
  `onChange`). Props: `label`, `placeholder`, `description`, `errorMessage` + `isInvalid`, `isRequired`, `isDisabled`,
  `minimumDate` / `maximumDate` (ISO), `clearLabel` (adds a clear button), `locale`, `variant` (`secondary` on white
  surfaces).
  - Android opens `DateTimePickerAndroid.open` (the system dialog).
  - iOS unfolds `display="inline"` under the field, as the Calendar app does. It folds again once a day is picked,
    and the button carries `expanded`.
  - Dates are local days at noon, so no time zone or daylight-saving shift changes the day (`parseIsoDate`,
    `formatIsoDate`).
  - The label is formatted with `Intl.DateTimeFormat(locale, { year, month: "short", day })`.
  - Accent and theme come from `useThemeColor("accent")` and `useColorSchemeValue()`.
- **StageDot / StageLabel** take `stage: ApplicationStatus` (type import from `@rezumi/schema/applications/data`).
  `StageLabel` is the dot + the translated `label`, read as the label. `StageDot` is hidden from screen readers; use it
  only beside text that names the stage. Class names are written out in full (`bg-stage-*`).

## Jest and setup notes (for `jest.setup.js`, `jest.config.js` and `test-utils.tsx`, which are yours)

1. **d3 ESM.** Pro's chart barrel loads `d3-scale`, `d3-shape` and `d3-zoom`, which ship ESM that the current
   `transformIgnorePatterns` does not transform. Add `|d3-.*|internmap|its-fine` to the allow-list group in
   `jest.config.js`. I checked this with the CLI flag `--transformIgnorePatterns`: all three suites pass on the real
   modules, with no mock. Until then, `feedback`, `navigation` and `data.test.tsx` each mock Pro's two internal
   `base-cartesian-chart.js` and `base-polar-chart.js` helpers (resolved from `heroui-native-pro/package.json`).
   Delete those two `jest.mock` blocks after the config change.
2. **expo-sqlite kv-store.** `motion.ts` calls `Storage.getItemSync` when it loads, and Jest has no SQLite
   (`NativeDatabase is not a constructor`). Add to `jest.setup.js`:
   `jest.mock("expo-sqlite/kv-store", () => ({ __esModule: true, default: { getItemSync: () => null, setItemSync: () => undefined, removeItemSync: () => undefined } }));`
   Then drop the copies in `navigation.test.tsx` and `data.test.tsx`.
3. **GestureHandlerRootView.** RNGH 3's `GestureDetector` throws outside a `GestureHandlerRootView`, and `renderUi`
   does not wrap one. Add it to `Providers` in `test-utils.tsx`, outside `SafeAreaProvider`. Then remove the local
   wrapper in `data.test.tsx`.
4. **datetimepicker** is mocked locally in `data.test.tsx`: a stand-in View, plus `DateTimePickerAndroid.open` as
   `jest.fn()`. Keep it local.
5. **Async scheduling.** The worklets mock runs `scheduleOnRN` through `queueMicrotask`, so gesture effects need a
   `waitFor` in tests.

## Other findings

- **TagGroup remove button:** the primitive sets `aria-label="Remove"`, which wins over `accessibilityLabel`, so name
  it with `aria-label` ("Remove Figma"). Also, the item is an `accessible` Pressable, so VoiceOver cannot focus the
  nested remove button. Screens with removable tags should add an `accessibilityActions` delete action on
  `TagGroup.Item`, or HeroUI should fix it upstream.
- **Alert** sets `role="alert"` for every status. The web announces only danger. This is left as shipped and noted.
- **Skeleton:** the web keeps placeholders invisible for their first 150 ms and still. HeroUI's default is shimmer
  with no delay. Pick a default (`variant="none"` or `"pulse"`) in DESIGN.md; the gallery shows all three.

## Needs a visual check on the simulator (principal)

- **Feedback group:**
  - Skeleton rows inside ListSection (toggle loading).
  - The three EmptyState kinds plus the failed-load one. Check the gap between header and actions (`gap-6`) and the
    side-by-side buttons.
  - The five Alert statuses, and an Alert with a button.
  - ProgressBar sizes and indeterminate sweep.
- **Navigation group:**
  - Segment: label colours, duotone selected icon, separators hiding beside the selection, `flex-1` widths, the sm
    44 pt slop, and the disabled look.
  - Stepper vertical and horizontal: check marks, accent current step, back press on a finished step.
  - Fab: extended width, icon-only, disabled. The speed dial opening (portal, overlay, item placement).
  - The floating FAB in the framed box. Any shadow? Pro draws none.
- **Data group:**
  - Chips, removable and selectable tags, avatars (bundled placeholder image), stage labels and dots.
  - SwipeableRow inline in a surface: rubber band, the full-swipe haptic and delete, the standalone card, the
    disabled row.
  - **Back swipe from the left edge over a row on a pushed screen** (the gallery is a pushed route): it must pop, not
    move the row.
  - DatePicker: the iOS inline calendar unfolding under the field (accent colour, dark mode via `themeVariant`),
    clear button, min date, invalid border and error, disabled, the secondary variant on white.
- Large text and Indonesian (labels truncate to one line in Segment items).
- Android: not checked, paused by owner. It still needs its date dialog and the ripple on actions.

## Not done

- Nothing was run on a simulator or emulator, by instruction.
- `src/ui/index.ts` was not changed (yours; list above). The galleries import from `@/ui/feedback`, `@/ui/navigation`,
  `@/ui/data` and `@/ui/stage`.
- No wrapper over `Avatar` for name-to-initials or `Chip` for stage chips. Screens compose them; add one if Phase 03+
  repeats the pattern.
- Pro `date-range-picker` / `calendar` / `wheel-date-time-picker` and `swipeable-tabs` were not tried (not in this
  scope).
- The `jest.mock` workarounds above stay until the setup changes land.
