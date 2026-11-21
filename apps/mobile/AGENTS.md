# Rezumi mobile app: agent notes

Expo SDK 58 / React Native 0.88 app for iOS and Android (Expo Router, TanStack Query, oRPC, Lingui, HeroUI Native +
Uniwind, the native Forme PDF engine from `packages/forme-native`). The app is being rebuilt: read
`.agents/docs/plans/mobile/README.md` (rules for every session), `00-keputusan.md` (decisions), `01-desain.md` (design)
and `02-teknis.md` (architecture, tests, two-platform checklist) before changing it. Visual rules will live in
`apps/mobile/DESIGN.md` (Phase 02).

## Owner's Mac: one heavy job at a time

**Android builds and the Android emulator are paused on the owner's Mac** (owner, 2026-11-21: running an iOS build,
a Gradle build and the emulator together froze the Mac, load average ±180, with ±10 GB disk free). Until the owner
lifts this:

- Do not boot an Android emulator or run `expo run:android` / Gradle locally. Android checks wait (plan README rule 4
  is suspended for Android; record "Android: not checked, paused by owner" in the phase report).
- Run **one** native build at a time, with nothing else heavy beside it (no second build, no emulator, no Forme Rust
  build). Prefix it with `nice -n 10`.
- Check `df -h /` first: stop and tell the owner when less than ±15 GB is free. Clear only rebuildable caches you
  created (`~/Library/Developer/Xcode/DerivedData/Rezumi-*`, `packages/forme-native/rust/target`), never the owner's
  simulators, AVDs or other projects.
- Shut the simulator down when the session's checks are done.

## Commands

Run from the repository root unless stated otherwise:

```sh
pnpm --filter mobile typecheck
pnpm --filter mobile test         # node:test checks in scripts/ + Jest component tests (src/**/*.test.ts(x))
pnpm --filter mobile test:ci      # the same with jest --ci; CI's unit job runs it
pnpm --filter mobile lingui:extract
```

## Run it locally

Prerequisites: Xcode with an iOS simulator runtime, CocoaPods, Docker (Postgres), and for a Forme rebuild Rust via
`rustup` (`/opt/homebrew/opt/rustup/bin` is not on `PATH` by default), `cbindgen 0.29.4` and `cargo-ndk 4.1.2`
(`cargo install … --locked`). An iOS build takes ±4 GB of DerivedData.

1. **Server.** `docker compose -f compose.dev.yml up -d postgres redis`, then a dev server that accepts the app's
   development OAuth redirect (`app.rezumi:/auth/native-callback`):

   ```sh
   PORT=3400 SERVER_PORT=3401 APP_URL=http://localhost:3400 FLAG_ALLOW_UNSAFE_OAUTH_REDIRECT_URI=true \
     FLAG_DISABLE_API_RATE_LIMIT=true pnpm exec dotenvx run -f .env.local -- turbo run dev --filter=web --filter=server
   ```

   (`.claude/launch.json` → `rezumi-mobile`). Never set that flag on a public deployment.

2. **Forme native binaries.** `node packages/forme-native/scripts/fetch-prebuilt.mjs --platform ios` installs the
   binaries pinned in `packages/forme-native/scripts/prebuilt.json` when the pin matches the Rust sources. When it says
   no pin matches, build locally (alone, see above):
   `PATH="/opt/homebrew/opt/rustup/bin:$HOME/.cargo/bin:$PATH" bash packages/forme-native/rust/build.sh` (±2 min).
   After changing anything under `packages/forme-native/rust`, run **Mobile Forme build**
   (`.github/workflows/mobile-forme-build.yml`, `publish=true`; GitHub runners unless `USE_BLACKSMITH=true`) and commit
   the `prebuilt.json` it publishes; never edit hashes by hand.

3. **iOS.** Boot a simulator, then from `apps/mobile`:

   ```sh
   LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 nice -n 10 pnpm exec expo run:ios --device <simulator UDID> --no-bundler
   ```

4. **Android (paused on the owner's Mac).** For reference once allowed again: `JAVA_HOME` = Android Studio's JBR
   (`/Applications/Android Studio.app/Contents/jbr/Contents/Home`), `ANDROID_HOME=$HOME/Library/Android/sdk`, then
   `pnpm exec expo run:android --device emulator-5554 --no-bundler` and `adb reverse tcp:3400 tcp:3400` so the emulator
   reaches the dev server as `localhost` (with `10.0.2.2` OAuth fails: the server's issuer is `localhost`). Development
   builds accept `http://` only for `localhost`, `127.0.0.1` and `10.0.2.2` (`src/auth/oauth.ts`).

5. **Metro.** `pnpm exec expo start` from `apps/mobile` (port 8081), then open the app. Sign in: **Another server** →
   `http://localhost:3400` → **Continue in browser**. Test accounts: sign up through `/api/auth/sign-up/email` (needs
   `username` and `displayUsername`), then mark the email verified in the local database. Keep passwords out of the
   repository, logs and chat.

## Code rules (summary; full list in `02-teknis.md` 2)

- Route files in `app/` stay thin; screens, components and hooks live in `src/features/<area>`. The core engine
  (`src/api`, `src/auth`, `src/draft`, `src/linking`, `src/i18n`, `src/preview`) is kept: change it carefully and with
  tests.
- No business rules in the app: shared logic goes to workspace packages (`02-teknis.md` 5). Never copy from `apps/web`.
- Styling through `src/ui` components and tokens (HeroUI Native from Phase 02); `Platform.OS` only in `src/ui` and
  `src/shell` (and permission prompts).
- Data through `useQuery` with oRPC query options. The `QueryClient` (`src/api/query-client.ts`) refetches on
  foreground (`focusManager` ↔ `AppState`), pauses offline (`onlineManager` ↔ `expo-network`), retries network and 5xx
  failures twice and never retries 4xx, account switches or mutations.
- User-facing strings through Lingui macros; translate `id-ID` too.
- New native modules only with a reason recorded in `02-teknis.md` 3.4: each one changes the fingerprint and needs a
  rebuild.

## Tests

- **Jest + React Native Testing Library** (`jest.config.js`, preset `jest-expo`): component and hook tests next to the
  source as `*.test.ts(x)`. `@/` maps to `src/`; `.mjs` dependencies (oRPC) go through `babel-jest`. RNTL 14's
  `render`/`fireEvent` are async: `await` them.
- **`scripts/*.test.mjs`** (`node:test` with hand-made React Native fixtures): legacy; kept only until their logic moves
  to packages (Vitest there), then deleted.
- **Maestro** flows in `e2e/` (see `e2e/README.md`); installed with `brew install mobile-dev-inc/tap/maestro`, run with
  `JAVA_HOME` set to Android Studio's JBR. Supply credentials through `-e`, never in YAML.
- **Screens by eye:** Argent (`mcp__argent__*`) on an iPhone simulator (Android paused, see above), light/dark, English
  and Indonesian; screenshots for each phase go to `.agents/docs/plans/mobile/laporan/phase-NN/`.

## Gotchas found

- CocoaPods 1.17 on Ruby 4 crashes with `Unicode Normalization not appropriate for ASCII-8BIT` unless the shell locale
  is UTF-8: export `LANG`/`LC_ALL=en_US.UTF-8` before `expo run:ios`.
- `malformed or corrupted precompiled file … could not find file …/node_modules/.pnpm/expo@…` after a dependency
  change: the pnpm path of a package changed under Xcode's module cache. Delete
  `~/Library/Developer/Xcode/DerivedData/Rezumi-*` and build again.
- `react-native-skia` (unscoped, v3) is the package HeroUI Native Pro loads for charts, not `@shopify/react-native-skia`.
- cargo-ndk also copied the vendored forme-pdf cdylib (`libforme.so`) into `jniLibs`; `build.sh` now clears the folder
  and keeps only `libforme_native.so` (16 KB aligned).
- OTA (EAS Update) and EAS Observe are off: `app.config.ts` has `updates.enabled: false` and no Expo `owner` or project
  id until the owner creates an Expo account (plan Phase 16). Crash traces go to the device log through
  `src/shell/error-boundary.tsx`.
- The Apple team is the owner's `ZAVWN3Z2YX`; simulator builds need no signing. Store identities still to re-check are
  listed in `.agents/docs/mobile-release-handoff.md`.
- `.github/workflows/mobile-release.yml` still names Blacksmith runners directly; without Blacksmith on the repository
  its jobs never leave the queue (fix before Phase 16, like `mobile-forme-build.yml`).
