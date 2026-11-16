# Rezumi browser extension: agent notes

Chrome and Edge extension (Manifest V3) that saves job postings to the Rezumi application tracker. The plan, owner
decisions and technical design live in `.agents/docs/plans/plugin-browser/` (`02-teknis.md` is the design); read them
before changing behaviour, permissions or the build. Shared posting logic (job keys, canonical URLs, JSON-LD, the
capture schema) belongs in `@rezumi/job-sites`, not here.

## Commands

Run from the repository root:

```sh
pnpm --filter extension build:dev   # development build into apps/extension/dist (server http://localhost:3000)
pnpm --filter extension dev         # the same, rebuilding on change
pnpm --filter extension build:candidate # release candidate for hand testing: store build + the store key, signs in to rezumi.app (never upload)
pnpm --filter extension build       # store build (https://rezumi.app), fails if content.js passes 50 KB
pnpm --filter extension zip         # store build + apps/extension/release/rezumi-extension-<version>.zip
pnpm --filter extension typecheck
pnpm --filter extension test        # Vitest unit tests (src/**/*.test.ts)
pnpm --filter extension test:e2e    # development build, then Playwright with the extension loaded
pnpm --filter extension lingui:extract
```

`REZUMI_URL` overrides the server at build time. `EXTENSION_KEY` overrides the Chrome Web Store public key that
development builds carry (`CHROME_STORE_PUBLIC_KEY` in `manifest.config.ts`); store builds never carry a key.

`tests/connect.spec.ts` signs in for real against a local server at `http://localhost:3000` (the development build's
server) and is skipped when none answers. Start one for this checkout with its own database, for example
`PORT=3000 SERVER_PORT=3001 APP_URL=http://localhost:3000 DATABASE_URL=…/rezumi_extension_dev BILLING_MODE=on pnpm dev`;
the spec signs up fictional `extension-…@example.test` accounts there.

`tests/reading-connected.spec.ts` (save form filled from a posting, "Report this page") and `tests/save.spec.ts`
(saving from the four boards, "Saved" marks, status, notes, offline drafts, similar jobs, contacts, the context menu,
the on-page button setting) use the same server. The on-page button's shadow root is closed, so development builds copy
its label to `data-rezumi-state` on the `<rezumi-save-button>` host for tests, and expose the context menu handler as
`globalThis.rezumiContextMenu` in the service worker (Playwright cannot open the browser's context menu). Playwright's
`setOffline` does not reach extension pages: break the API with `context.route(…, (route) => route.abort())` instead.
`tests/reading.spec.ts` needs none: development builds open `sidepanel.html?tab=<tab id>&reading`, which shows only the
page reading for that tab, signed in or not, with a development-only list of every field and where it came from
(`?clean` hides that list for screenshots).

`tests/prepare.spec.ts` (Phase 05: match, AI, preparation, reminders) uses the same server started with its own AI
pointed at the scripted stub in `tests/ai-stub.ts`, so nothing real runs or is paid: add `AI_PROVIDER=openai-compatible
AI_MODEL=stub AI_API_KEY=stub-key AI_BASE_URL=http://127.0.0.1:4319/v1 FLAG_ALLOW_UNSAFE_AI_BASE_URL=true` before
`pnpm dev` (process variables win over `.env.local`). The spec starts the stub on port 4319 itself. A new Free account
has no Rezumi AI credits, so "out of credits" comes from the real server; the AI runs on an own AI connection to the
stub. Development builds expose `globalThis.rezumiReminders(<ISO time>)` in the service worker to run the desktop
reminders with a chosen clock (Playwright cannot answer the browser's permission prompt, so it checks that none show
without the permission).

`tests/store-images.spec.ts` (only with `EXTENSION_STORE_IMAGES=<dir>` and the local server) makes the store listing and
guide pictures: a fictional person saves a fictional posting from `__fixtures__/linkedin/store-demo.html`, a styled,
board-neutral stand-in page; the real panel crops go to `<dir>/raw/<lang>/` and five composed 1280×800 screenshots
(written at 2×, so 2560×1600: shrink before uploading) per language to `<dir>/<lang>/`. The `pixelRatio` fixture option
sets the browser's device pixel ratio.

`test:e2e` needs Playwright's Chromium (`pnpm exec playwright install chromium`): branded Chrome and Edge no longer load
unpacked extensions from the command line. `EXTENSION_SCREENSHOTS=<dir>` makes the side panel spec save a picture of
each width (360, 420), appearance and language.

## Loading it by hand

1. `pnpm --filter extension build:dev` (or `dev`).
2. Chrome: `chrome://extensions` → Developer mode → Load unpacked → `apps/extension/dist`. Edge: `edge://extensions` →
   Developer mode → Load unpacked → the same folder.
3. After a rebuild, press the reload icon on the extension's card, then reload the job board tab.
4. The service worker's console (the card's "service worker" link) and the job board tab's console show the posting key
   in development builds (`[Rezumi] …`).

## Structure

| Path                             | What                                                                                                                                                                                                           |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `manifest.config.ts`             | The manifest (permissions with reasons in `02-teknis.md` §12), minimum Chrome version, board matches                                                                                                           |
| `scripts/build.ts`               | Builds panel + worker (ES modules), content script (one IIFE), writes `dist/manifest.json`                                                                                                                     |
| `scripts/build-config.ts`        | The two Vite configs and build-time constants (`__DEV__`, `__REZUMI_URL__`, `__EXTENSION_VERSION__`)                                                                                                           |
| `scripts/zip.ts`                 | Packs `dist/` for the stores                                                                                                                                                                                   |
| `src/background/`                | Service worker: message router (sender + Zod checks), sign-in and tokens (`auth.ts`), saved keys and button state (`saved.ts`), badge (`badge.ts`), due follow-ups and desktop reminders, context menu, alarms |
| `src/content/`                   | Content script: posting key from the address, single-page navigation, `read.ts` on request, the on-page button (`button.ts`, closed shadow root); no React/Zod                                                 |
| `src/content/sites/`             | One reader per board (`linkedin.ts`, …); hooks checked on real pages are listed in `02-teknis.md` §18                                                                                                          |
| `src/content/sites/__fixtures__` | Synthetic job board pages for tests, `<board>/<state>.html` (never real postings)                                                                                                                              |
| `src/sidepanel/`                 | React 19 + HeroUI panel, oRPC client with the worker's token (`api.ts`), save form (`posting-screen.tsx`, `draft.ts`), errors (`errors.ts`), Lingui en/id, light/dark                                          |
| `src/shared/`                    | Message types and schemas, storage keys, build config, follow-up dates and reminder rules (`follow-ups.ts`), the removal page address (`uninstall.ts`)                                                         |
| `locales/{en,id}.po`             | Panel strings (Lingui); the root `pnpm lingui:extract` includes them                                                                                                                                           |
| `public/_locales/{en,id}/`       | Store name, description and toolbar title (`__MSG_…__` in the manifest)                                                                                                                                        |
| `public/icons`, `public/icon`    | Toolbar/store PNGs (from `apps/web/public/pwa-512x512.png`) and the brand mark SVG the panel shows                                                                                                             |
| `tests/`                         | Playwright: the extension loaded in Chromium, job boards served from fixtures with `context.route`                                                                                                             |

## Rules

- No remote code, `eval`, analytics or third-party trackers. Everything ships in the package.
- A board changed its markup? Check the real page, update the reader and a fixture under `__fixtures__/<board>/`, and
  note the date and hooks in `02-teknis.md` §18. Prefer `data-*`, `aria-label`, `componentkey` and the tab title over
  class names.
- The content script reads nothing but the address until the person asks; it never clicks anything on a job board and
  never holds a token. Messages are validated in the service worker (`src/background/router.ts`).
- A new permission needs its reason in `02-teknis.md` §12 and a matching change in `src/manifest.test.ts`.
- One Vite in the workspace: the build uses `vite-plus`'s `build`, no extension framework plugin.
- The panel's CSS is `@rezumi/ui/globals.css`, which scans every app for Tailwind classes, so it is large (~1 MB); fine
  for a packaged page, worth trimming if load time suffers.
