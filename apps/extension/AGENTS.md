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
pnpm --filter extension build       # store build (https://rezumi.app), fails if content.js passes 50 KB
pnpm --filter extension zip         # store build + apps/extension/release/rezumi-extension-<version>.zip
pnpm --filter extension typecheck
pnpm --filter extension test        # Vitest unit tests (src/**/*.test.ts)
pnpm --filter extension test:e2e    # development build, then Playwright with the extension loaded
pnpm --filter extension lingui:extract
```

`REZUMI_URL` overrides the server at build time. `EXTENSION_KEY` overrides the Chrome Web Store public key that
development builds carry (`CHROME_STORE_PUBLIC_KEY` in `manifest.config.ts`); store builds never carry a key.

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

| Path                             | What                                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `manifest.config.ts`             | The manifest (permissions with reasons in `02-teknis.md` §12), minimum Chrome version, board matches   |
| `scripts/build.ts`               | Builds panel + worker (ES modules), content script (one IIFE), writes `dist/manifest.json`             |
| `scripts/build-config.ts`        | The two Vite configs and build-time constants (`__DEV__`, `__REZUMI_URL__`, `__EXTENSION_VERSION__`)   |
| `scripts/zip.ts`                 | Packs `dist/` for the stores                                                                           |
| `src/background/`                | Service worker: message router (sender + Zod checks), per-tab page state, alarms; tokens from Phase 02 |
| `src/content/`                   | Content script: posting key from the address, single-page navigation; no React, no Zod, no token       |
| `src/content/sites/__fixtures__` | Synthetic job board pages for tests (never real postings)                                              |
| `src/sidepanel/`                 | React 19 + HeroUI side panel, Lingui en/id, follows the browser's light/dark appearance                |
| `src/shared/`                    | Message types and schemas, storage keys, build config                                                  |
| `locales/{en,id}.po`             | Panel strings (Lingui); the root `pnpm lingui:extract` includes them                                   |
| `public/_locales/{en,id}/`       | Store name, description and toolbar title (`__MSG_…__` in the manifest)                                |
| `public/icons`, `public/icon`    | Toolbar/store PNGs (from `apps/web/public/pwa-512x512.png`) and the brand mark SVG the panel shows     |
| `tests/`                         | Playwright: the extension loaded in Chromium, job boards served from fixtures with `context.route`     |

## Rules

- No remote code, `eval`, analytics or third-party trackers. Everything ships in the package.
- The content script reads nothing but the address until the person asks; it never clicks anything on a job board and
  never holds a token. Messages are validated in the service worker (`src/background/router.ts`).
- A new permission needs its reason in `02-teknis.md` §12 and a matching change in `src/manifest.test.ts`.
- One Vite in the workspace: the build uses `vite-plus`'s `build`, no extension framework plugin.
- The panel's CSS is `@rezumi/ui/globals.css`, which scans every app for Tailwind classes, so it is large (~1 MB); fine
  for a packaged page, worth trimming if load time suffers.
