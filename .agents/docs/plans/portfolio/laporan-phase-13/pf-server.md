# Phase 13 — pf-server (2026-11-12)

This session built the server layer of Phase 13: B16 password gate, B2 work pages, B9 statistics, B14 vCard route, B17 unfurl/oEmbed/CSP. The contract is `phase-13-fitur-lanjutan.md` (section 12 wins) plus `laporan-phase-13/langkah-0.md`. Nothing is committed. Other sessions edited `packages/portfolio`, `apps/web` and `tooling/portfolio` at the same time; I didn't touch those files.

## Built

### B16 — portfolio with a password

**Procedures** (`packages/api/src/features/portfolio/service.ts`, `router.ts`)

- `portfolio.setPassword` stores a bcrypt hash (cost 10) with one `UPDATE … RETURNING`. `updated_at` doesn't move.
- `portfolio.removePassword` clears it the same way.
- Both work while the portfolio is unpublished or taken down. They answer `PORTFOLIO_DISABLED` or `NOT_FOUND`.
- `hasPassword` comes from `rowColumns`; the hash never leaves the server.

**`visitor-access.ts`** (new, exported as `@rezumi/api/features/portfolio/visitor-access`, section 12.1)

- `PORTFOLIO_ACCESS_TTL_SECONDS` (12 h).
- `hasPortfolioAccess` and `grantPortfolioAccess`:
  - cookie `portfolio_access_<id>` = `<expires>.<hmac>`;
  - the HMAC key is derived from `AUTH_SECRET` with purpose `rezumi:portfolio-access:v1`, over `[portfolioId, passwordHash, expires]`;
  - `safeEquals` is reused from `resume/access.ts`;
  - attributes `Path=/; Max-Age=43200; SameSite=Lax; HttpOnly`, plus `Secure` over https, and no `Domain`.
- `portfolioAccess`: open without a password, for the signed-in owner (`isPortfolioOwner`, now exported from `public.ts`), or with a valid cookie.
- `verifyPortfolioPassword` → `ok`, `wrong` or `limited`:
  - its own limiter, `portfolioPasswordAttempts` with `rateLimitConfig.orpc.resumePassword` (5 per 10 minutes);
  - the key is `portfolio-password:<id|missing>:ip:<client>`, where the client is an IPv6 address by its /64 (`rateLimitAddress`);
  - a bcrypt compare against a stand-in hash when there is no portfolio or no password, so timing tells nothing;
  - `FLAG_DISABLE_API_RATE_LIMIT` is honoured.

**Gate at every entry point**

| Entry point                                    | Behaviour when locked                                                                                                                     | Where                 |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Home `/<username>` (and a custom domain's `/`) | 401 password page: `@rezumi/portfolio/gate`, `private, no-store`, `X-Robots-Tag: noindex, nofollow`, CSP with no script, no visit counted | `portfolio-page.ts`   |
| Work page                                      | 401 password page, before the work is looked up (a real and a missing work answer the same)                                               | `portfolio-page.ts`   |
| `?report`                                      | Not gated; the form names `@<username>` instead of the person                                                                             | `portfolio-page.ts`   |
| Portfolio card and work card                   | Banner                                                                                                                                    | `portfolio-card.ts`   |
| vCard                                          | 404                                                                                                                                       | `http/portfolio.ts`   |
| Beacon                                         | 204, nothing counted                                                                                                                      | `http/portfolio.ts`   |
| Contact message                                | `unavailable`; `submitPortfolioMessage` takes `requestHeaders`                                                                            | `contact.ts`          |
| Sitemap                                        | Excluded: `portfolioIsIndexable()` adds `password is null`                                                                                | `public.ts`           |
| Files                                          | `protected`: served, but `private, max-age=3600`, `noindex` (from `portfolioFileAccess`; `isPublicPortfolioFile` wraps it)                | `uploads.ts`          |
| Worker picture reader                          | Draws only `public` files                                                                                                                 | `cloudflare/index.ts` |
| Custom domains                                 | Cookie per host; the unlock form posts to the relative `/api/portfolio/…`, which the domain passes through                                | —                     |

**Unlock route**

- `POST /api/portfolio/:username/unlock` (`limitBody(16 KB)`) → `handlePortfolioUnlock`.
- `next` must be `home`, `report` or `work:<slug>` with a slug matching the pattern; anything else becomes `home`.
- The target is built by the server (`unlockTarget`). On the app host: `/<username>`, `/<username>?report`, `/<username>/work/<slug>`; on any other host: `/`, `/?report`, `/work/<slug>`.
- Answers:
  - right → 303 with `Set-Cookie`;
  - wrong → 303 with `unlock=wrong`;
  - limited → 303 with `unlock=limited`;
  - no portfolio → 404;
  - always `no-store`.
- The password never reaches a log.

**Account export**: `portfolio.hasPassword`, never the hash.

### B2 — work pages

**Paths and routes**

- `isPortfolioWorkPath` and `customDomainWorkSlug` in `portfolio-page.ts`: exactly three segments, the first not in `RESERVED_PROFILE_SEGMENTS`, then `work`, then a slug matching `PORTFOLIO_SLUG_PATTERN` of at most 64 characters.
- `app.get("/:username/work/:slug")` sits after the static middleware and before `/:username/:slug`. `handleCustomDomain` handles `/work/<slug>` before its "other paths go to the app" redirect.

**`servePortfolioWork(request, username, slug, trustedClient, options)`**, in this order: public rate limit → `findPublicPortfolio` → password gate → `publicPortfolioView(portfolio, { customDomain })` → `resolvePortfolioWork`.

**Answers**

| Case                                | Answer                                                       |
| ----------------------------------- | ------------------------------------------------------------ |
| Work found                          | 200                                                          |
| A previous address                  | 301 to the current path, without the query                   |
| Portfolio exists, work isn't listed | 404 with `renderPortfolioMissingWorkPage`, `noindex, follow` |
| No portfolio                        | `unavailableResponse` (now exported from `resume-page.ts`)   |

**Page details**

- **Canonical**: the live custom domain `https://<domain>/work/<slug>`, else `${APP_URL}/<username>/work/<slug>`.
- **Robots**: the same as the home page (`indexable`).
- **Head**: title `"<work> — <name>"`; description from the summary, else the first text block cut to 160, else the SEO description; `og:type` `article`; `og:image` is the work's card.
- **JSON-LD** (only when indexable): a `CreativeWork` with `author` and `isPartOf` pointing to the home page's canonical address. The home page's `hasPart` now uses the work pages' URLs.
- **CSP**: `frame-src` is the video players plus `embedFrameOrigins(this work's providers)`; no Turnstile.
- **Counting**: `recordPortfolioVisit({ …, workId })`, on GET and not speculative.

**`publicPortfolioView(portfolio, options)`**

- `links.home`: `/<username>`, or `/` on a custom domain.
- `links.work`: `/<username>/work/<slug>`, or `/work/<slug>` on a custom domain.
- `links.vcard`: `/api/portfolio/<username>/vcard`.

**Work card**

- `app.get("/cards/:username/work/:file{[^/]+\\.png}")`, registered before the resume card's route, → `handlePortfolioWorkCard`.
- It draws the work's title, the person (plus " · role"), the work's address and the person's photo.
- A work the page doesn't list, a moved address, or a locked portfolio gets the banner (302, `no-store`).
- The drawing is shared with the portfolio card through `drawCard`.

**Sitemap**

- `listIndexablePortfolios` returns `{ username, updatedAt, workSlugs }`.
- `workSlugs` is SQL over the stored JSON (`jsonb_array_elements … with ordinality`), the same rule as `listedWorkSlugs`. A title is blank when `btrim` with JavaScript's whitespace set leaves nothing.
- `PORTFOLIO_SITEMAP_PAGE_SIZE` = 980.
- `handlePortfoliosSitemap` writes each home, then its work pages, with the same `lastmod`.

### B9 — statistics

**Events and sources**

- `PORTFOLIO_EVENT_KINDS` = the click kinds + `view`; `work` is gone.
- `parsePortfolioEvent` keeps a click's `id` when it matches the item pattern (otherwise drops just the id). It keeps a `view`'s `ref`, up to 300 characters (section 12.10).
- `traffic.ts`: `utm_source=qr` → `qr` (`sourceOfName` is now exported).

**Counting** (`public.ts`)

- `recordPortfolioVisit({ …, workId? })` shares one visitor check (crawler, limit, owner) with the `view` beacon.
- It counts the portfolio visit (`…:view:<visitor>`, so arriving from the home page doesn't count twice) and the work opening (`…:work:<workId>:<visitor>`).
- The work opening goes to the daily `works` and to an Analytics Engine `work` data point. Its source is `portfolio` when the `Referer` is one of our own hosts.
- A click carries the work's id to Analytics Engine `blob2` when the work exists; Postgres `clicks` stays per portfolio.

**Analytics Engine** (`analytics.ts`)

- `portfolioDetailQueries(…, days)`.
- New `portfolioWorkDetailQueries(portfolioId, workId, now, timeZone, days)`: sources, referrers, countries, devices, and clicks with `blob2 = $work`.
- `readPortfolioDetails(…, days)` and `readPortfolioWorkDetails`.
- Cache key `portfolio-details:v3:<id>:<zone>:<days>:<workId|all>`, 5 minutes.

**Procedures** (`statistics.ts`)

- `portfolio.statistics` passes its range to the breakdown too.
- `portfolio.workStatistics` is fully implemented (`portfolioWorkStatistics`):
  - Postgres day by day for every plan;
  - the breakdown for plans with `detailedPortfolioStats`;
  - `PORTFOLIO_WORK_NOT_FOUND` for a work the portfolio doesn't have;
  - another account's work is never read.

### B14 — Save contact

- `GET /api/portfolio/:username/vcard` → `handlePortfolioVcard`, which calls `buildPortfolioVcard(publicPortfolioView(portfolio), { url })`. The URL is the live custom domain, else `${APP_URL}/<username>`.
- Headers: `text/vcard; charset=utf-8`, `attachment; filename="<username>.vcf"`, `private, no-store`, `X-Robots-Tag: noindex`.
- `robots.txt` gains `Disallow: /api/portfolio/`.

### B17 — embeds

- `unfurl.ts`:
  - a provider's address (`parseEmbedUrl`) becomes `kind: "embed"` without reading the page;
  - any other link is fetched, and if the final address after redirects is a provider's (a short `on.soundcloud.com` link, for example), it becomes an embed;
  - title and thumbnail come from the provider's oEmbed, through the same safe fetch (5 s, private addresses refused, 64 KB);
  - an oEmbed failure still gives the embed; Google Slides asks nobody;
  - suggested thumbnails must be http(s), at most 2048 characters, and pass `remoteUrl`.
- The unfurl cache is now `portfolio-unfurl:v3`; a cached embed must pass `isEmbedRef` to be read.
- A work page's CSP opens only the frame origins of that work's providers (see B2).

### Off-mode and checks behaviour

- While `PORTFOLIO_MODE=off`, the new routes fall through to the app: the work page, unlock, vCard and the work card (`portfolioRoutesEnabled()`), and a custom domain's `/work/<slug>`.
- `apps/server/src/http/app.test.ts` proves the work page and vCard addresses reach the web app.

### Smoke test (`tooling/cloudflare/smoke.mjs`)

- After the portfolio card, it opens a work's page (200 and canonical), asserts `/cards/workersmoke/work/<slug>.png` is a real PNG, and sets a password.
- Locked: the home and the work page answer 401 without content, and the work card is the banner.
- It then unlocks through the form (303 to the work, `Set-Cookie`), opens the work page with the cookie (200), and removes the password.

## Tests (one per gate entry point included)

**API, real database** (`PORTFOLIO_TEST_DATABASE_URL` = local `rezumi_billing_test`)

`public.integration.test.ts`

- `workSlugs` SQL = `listedWorkSlugs` for a portfolio with: hidden, untitled, NBSP/ideographic-space/tab titles, padded and `hidden: false` works; a hidden Work section; no works; empty data.
- Page size 980.
- Locked portfolio: not indexable, out of the sitemap count, file `protected` (`none` while off).
- Password right, wrong and limited; the cookie's form; a new password revokes access; the owner opens it.
- A work page visit counts once with its home, and work openings dedupe; owner and bots are never counted.
- Clicks with a work id; the `view` beacon's `ref` source.

`portfolio.integration.test.ts`

- set/removePassword keep `updatedAt`, `hasPassword` in the DTO, the hash never in it, `NOT_FOUND`/`PORTFOLIO_DISABLED`.
- `workStatistics`: one's own work only, `PORTFOLIO_WORK_NOT_FOUND` for another account's id, `NOT_FOUND` without a portfolio.

`contact.integration.test.ts`

- A locked portfolio takes no message without access, and does with the cookie.
- `portfolioWorkStatistics`: days, totals, range, a missing work.

**API, unit**

- `visitor-access.test.ts`: cookie attributes, binding to portfolio and hash, expiry, forged or broken values.
- `unfurl.test.ts`: Loom with oEmbed (no page read); Spotify oEmbed failure; Google Slides with no requests; SoundCloud short link through a redirect, with an unsafe thumbnail dropped; embed cache round trip; cache key v3.
- `analytics.test.ts`: 7/90-day starts; work queries always scoped to `index1` and `blob2 = $work`, with the id as a parameter.
- `traffic.test.ts`: the `qr` source.

**Server**

`portfolio-page.test.ts`

- Paths, the work page (canonical, `og:type`, card, description fallback, JSON-LD, `frame-src` exactly, counting with `workId`), 301 without the query, both kinds of 404, custom domain canonical and 301, `hasPart` URLs.
- Locked home: 401, no leak, no script, no-store, noindex, no count. Locked work page answers the same for a real and a missing work.
- `?report` names `@nadia`; open with access.
- The video players' CSP is now checked on the work page (the home page no longer holds blocks).

`http/portfolio.test.ts`

- Events: id, ref, `work` refused, a locked beacon not counted.
- Unlock: target building against hostile `next` values, 303 ok/wrong/limited on the app host and a custom domain, 404 with no password check.
- vCard: headers, body, 404 for unshown and locked.
- The message route passes the request headers.

Other server tests

- `portfolio-card.test.ts`: work card lines and address; banner for hidden, missing and moved works; banner for both cards when locked, with nothing drawn.
- `uploads-portfolio.test.ts`: protected files are `private, max-age=3600`, `noindex`, cross-origin, and 304 keeps them private.
- `custom-domain.test.ts`: `/work/<slug>` is served; a bad slug and off mode redirect to the app.
- `cloudflare/index.test.ts`: the picture reader refuses `protected` and `none`.
- `seo.test.ts`: work URLs in the sitemap; `Disallow: /api/portfolio/`.
- `app.test.ts`: off-mode fall-through.

## Checks run (exact results)

| Check                                                                                                 | Result                                                                  |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `pnpm --filter @rezumi/schema exec vp test run`                                                       | 224 passed                                                              |
| `pnpm --filter @rezumi/api exec vp test run src/features/portfolio` (real database)                   | 373 passed                                                              |
| `pnpm --filter @rezumi/api exec vp test run` (whole package)                                          | 1165 passed, 192 skipped (other databases' suites)                      |
| `pnpm --filter server exec vp test run`                                                               | 313 passed, 4 skipped                                                   |
| `pnpm --filter <pkg> typecheck` for `@rezumi/schema`, `@rezumi/api`, `server`                         | clean                                                                   |
| `pnpm exec turbo boundaries`                                                                          | no issues, 2255 files                                                   |
| `pnpm exec vp lint --fix`, `vp fmt`, `lint --deny-warnings --format=agent`, `fmt --check` on my paths | clean                                                                   |
| `pnpm docs:gen`                                                                                       | `docs/spec.json` gains `portfolio.hasPassword` in the account export    |
| `pnpm check:cloudflare`                                                                               | dry run exit 0                                                          |
| `pnpm test:cloudflare` (local workerd, disposable database)                                           | passed, including the work page, work card and password gate assertions |

## Differences from the contract

1. **Work card cache** is `public, no-cache` with an ETag, not `public, max-age=3600`. The contract says "like the portfolio card", and since review 2 the portfolio card revalidates on every use so it stops showing right after an unpublish or lock.
2. **`recordPortfolioEvent` takes `ref`** (section 12.10). `parsePortfolioEvent` returns `{ kind, id?, ref? }`. A click's id that doesn't match the item pattern is dropped, and the click still counts (it no longer fails the whole beacon).
3. **One switch helper `portfolioRoutesEnabled()`** (`portfolio-page.ts`) gates every new route (work page, custom-domain `/work/<slug>`, unlock, vCard, work card). `getPortfolioMode` is newly exported as `@rezumi/api/features/portfolio/mode`.
4. **`portfolioWorkDetailQueries`** is a separate export, not `portfolioDetailQueries(…, { days, workId })`. `portfolioDetailQueries` takes `days` as a plain 4th argument; one function with two return shapes didn't typecheck cleanly.
5. **Analytics cache key** is `portfolio-details:v3:<id>:<zone>:<days>:<workId|all>`. The contract has v2 without the zone; review 2 already put the zone in the key.
6. **Worker picture reader** draws only `public` files, not `protected` ones (stricter than "file served"), so no server-drawn card or resume can show a locked portfolio's picture.
7. **Unlock route**: a rejected rate check answers the shared 429 page, since the route sits behind `publicPortfolioRequestAllowed` like the other form posts. Its own password limiter answers `unlock=limited`.
8. **`showReportForm`** takes a `locked` flag (names `@<username>`). The lock page's `reportUrl` is the app domain's `?report`, also on a custom domain, where `?report` would redirect there anyway.
9. **vCard URL** is the portfolio's live custom domain when it has one, whichever host served the request, so the card always holds the canonical address.
10. **`isPortfolioOwner`** is now exported from `public.ts`, for `visitor-access.ts`.

## Not done (with reasons)

- **A custom domain's own `robots.txt` still has no `Sitemap:` line, and custom-domain portfolios stay out of the app's sitemap.** That is the contract's rule ("Portfolio di domain sendiri tetap tidak masuk sitemap aplikasi"); a per-domain sitemap is a later idea.
- **The `view` beacon's `ref` needs pf-render's live script to send it.** Until then, prerendered visits count as `direct` unless the page address has `utm_source`.
- **pf-web words `PORTFOLIO_WORK_NOT_FOUND`** in `apps/web/src/features/portfolio/errors.ts` (their list, item 7).

## Integration (2026-11-12)

### 1. A guest opening a work page on the dev app

**The server counts it.**

- New real-database test `apps/server/src/static/portfolio-work.integration.test.ts`, on Node with Postgres only and no Analytics Engine.
- A guest GET of `/<username>/work/kopi` goes through `servePortfolioWork` → `recordPortfolioVisit({ workId })` → the daily row.
- `portfolio.workStatistics` (through the real router) then reads `totals.opens = 1`, the last day `opens: 1` and `details: not-configured`.
- `portfolio.statistics` reads `works: [{ id: "w1", title: "Coffee app", opens: 1 }]`, `views: 1`, and on the last day `workOpens: 1`.
- A second opening within the hour adds nothing.
- `apps/server/turbo.json` now passes `PORTFOLIO_TEST_DATABASE_URL` to the server's test tasks, so CI runs it.

**Why the dev app showed nothing.** In order of likelihood:

1. **The Vite dev server never forwards a work page to the server.** `publicResumeProxyPattern` in `apps/web/src/libs/dev-server-proxy.ts` matches only one- or two-segment addresses (`/<username>`, `/<username>/<slug>`). `/<username>/work/<slug>` has three, so on `http://127.0.0.1:3260` Vite answers with the web app itself and Hono never sees the request: nothing is rendered by the server and nothing is counted. (`/cards/…` and `/api/portfolio/…` are forwarded by their prefixes.)
   - Fix, in a file outside my ownership (pf-web or principal): let the pattern take an optional `/work/<slug>`, e.g. `[^/.?]+(?:/work/[^/.?]+|/[^/.?]+)?`, with a case in `dev-server-proxy.test.ts`.
   - Until then, test on the server port (`http://127.0.0.1:3261/<username>/work/<slug>` for `rezumi-portfolio-12`), or on a built server (`pnpm start`) or `pnpm dev:cloudflare`.
2. **The owner's session.** The visit is skipped for the portfolio's owner. Cookies aren't separated by port, so a browser signed in on `127.0.0.1:3260` is still the owner on `127.0.0.1:3261`. Use a private window or another browser profile.
3. **Bot filter.** A user agent containing `HeadlessChrome` (Playwright's default headless Chromium) is a crawler to `isbot`, as is an empty user agent. Set a normal `userAgent` on the Playwright context. The app's built-in browser (Electron) counts normally.
4. **Once an hour.** The same visitor (address + user agent + `Accept-Language`) counts once per hour per portfolio, and once per hour per work. With `REDIS_URL` from `.env.local` the memory survives a dev-server restart. Change the user agent or the language, or wait an hour.
5. **Prefetch/prerender.** Speculative requests are skipped (they report through the `view` beacon once shown; see item 2). The visit limiter is off in that launch config (`FLAG_DISABLE_API_RATE_LIMIT=true`).

### 2. The `view` beacon on a work page

- `parsePortfolioEvent` keeps a valid item `id` on any kind, `view` included, and `ref` only on `view` (up to 300 characters).
- `recordPortfolioEvent` for `view` counts the visit with the same visitor check and key as the page (`…:view:<visitor>`). With a `workId` the portfolio has (`target.hasWork`), it also counts the work as opened through the same `countWorkVisit` as the page, with key `…:work:<workId>:<visitor>`.
- So a prerendered work page is counted once, whether the server or the beacon gets there first, and the visitor's later normal load adds nothing.
- `ref` is the visit's referrer: the source (for example `linkedin`) and the referring domain come from it. The beacon's own `Referer` gives the page address (its `utm_source`); a `ref` that isn't an http(s) address is ignored.
- Tests:
  - `public.integration.test.ts`: beacon twice, then a normal load gives `views: 1, works: { w1: 1 }, sources: { linkedin: 1 }`; a beacon for a work the portfolio doesn't have counts as a visit only.
  - `http/portfolio.test.ts`: `{"kind":"view","id":"w1","ref":…}` is parsed whole; `ref` on a click is dropped.

### Checks (re-run)

| Check                                                                              | Result                   |
| ---------------------------------------------------------------------------------- | ------------------------ |
| `@rezumi/schema` tests                                                             | 224 passed               |
| `@rezumi/api` `src/features/portfolio` (real database)                             | 374 passed               |
| `@rezumi/api` whole package                                                        | 1166 passed, 192 skipped |
| `server` tests (with `PORTFOLIO_TEST_DATABASE_URL`, so the new work-page test ran) | 314 passed, 4 skipped    |
| Typechecks for `@rezumi/schema`, `@rezumi/api`, `server`                           | clean                    |
| `turbo boundaries`                                                                 | no issues                |
| Lint and format on the changed paths                                               | clean                    |
| `pnpm check:cloudflare`                                                            | dry run passed           |

The contact test "takes no message for a portfolio behind a password…" now has a 30-second timeout. Its first owner check imports the session code, which took 5.5 s once while every suite ran in parallel; it passes in 3 s alone.
