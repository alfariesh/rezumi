# pf-server: second review of the Portfolio server side (2026-11-12)

Scope: `packages/schema/src/portfolio/**`, `packages/api/src/features/portfolio/**` (with `ai/`), portfolio parts of account export/delete, `packages/db/src/schema/portfolio.ts` plus a new migration, the portfolio email files, and the portfolio server routes and static handlers. Method: I reviewed `service.ts`, `router.ts`, `file-store.ts`, `jobs.ts`, `plan.ts`, `statistics.ts` and the DB schema myself. Four read-only reviewers covered the rest: outbound fetches; contact, report and moderation; public serving and statistics; schema, plan, AI and account data. I checked every finding in the source before fixing it. Nothing is committed.

## Findings fixed

### Plan enforcement

- **A downgraded account could replace works while over its works limit.** Before, only a growing count counted as "adding", so swapping all 20 works for 20 new ones in one save passed. Now a work whose id isn't stored yet counts as added. Over the limit, works can be edited or removed, never replaced (rule #2). `packages/api/src/features/portfolio/plan.ts`

### Privacy and data correctness

- **Cleanup no longer stops when portfolios are switched off.** Files of deleted portfolios, and files unused for more than 24 h, were kept forever while `PORTFOLIO_MODE=off`. They are now deleted in every mode, like contact messages already were. Emails and the weekly storage check still wait until the mode is back on. `jobs.ts`
- **A broken stored privacy setting now hides instead of showing.** This covers `hidden` on works and custom sections, `hero.showPicture`/`showLocation`, and `contact.email`/`website`/`profiles`; a whole broken `hero`/`contact`/`sections` object; and data that isn't a portfolio at all, which now reads with every standard section hidden and no photo, location or contact details. Missing fields keep their old defaults. `kit.field` takes a third "broken" fallback for this. `packages/schema/src/portfolio/{kit,data}.ts`
- **A stored Images or Metrics block left with no items is dropped on read.** Before, the lenient read kept it with an empty list, which the strict write then refused, so every later save and `importWorks` failed on a block the owner couldn't see. `kit.ts` (`list` with `min`)
- **The account export lost data.**
  - It sent `data` through the lenient read, which drops unknown blocks and items. It now exports the stored JSON as is.
  - It now also includes the daily statistics, and the takedowns and bans of the account with their reasons. Report handling stays out, since it would show who reported what.
  - `packages/api/src/features/portfolio/export.ts`; `docs/spec.json` regenerated.
- **Deleting a reported portfolio wiped the open reports.** The reports go with the portfolio (FK cascade), so deleting and recreating erased the moderation queue. The owner's delete now first writes a `deleted` moderation-log entry for the account, listing the open reports' ids, reasons and dates (not the reporter's words or address). That entry outlives the portfolio. `service.ts`
- **Account deletion could leave files in storage forever.** An upload already recorded could be written after the first storage purge. The rows then cascade away and no job looks for the file again. Storage is now purged a second time after the account row is gone. `packages/api/src/features/auth/service.ts`

### Security and abuse

- **IPv6 per-address limits counted full addresses.** One host can rotate through its /64, so it passed every per-IP limit and could use up a portfolio's 30-a-day contact allowance alone.
  - Limits now count an IPv6 address by its /64. An IPv4 address written as IPv6 counts as that IPv4 address.
  - This applies to the public flood limit, contact and report.
  - New `client-address.ts` (`rateLimitAddress`, `isIpAddress`); `contact.ts`, `report.ts`, `public-limit.ts`.
- **Turnstile:**
  - Cloudflare's test secrets no longer skip the hostname check in production. A test secret deployed by mistake now refuses messages instead of letting every bot through.
  - `remoteip` is sent only when it is a real IP address; it used to send `unknown` behind a proxy.
  - `turnstile.ts`
- **The share-card GIF size check missed frames.** Only the logical screen was measured, so a 1×1 screen holding a 30000×30000 frame passed the 50 MP check and could crash the owner's tab. Every frame's extent is now measured. `unfurl.ts` (`gifSize`)

### Errors users see and robustness

- **An oEmbed answer of `null` or a list caused a 500.** It now gives a video without a title. `unfurl.ts`
- **Redirects can end at an address longer than 2048 characters.** The pasted URL is now returned instead, so the cache, which validates at 2048, can still hold the result. `unfurl.ts`
- **On Workers, a site answering with an odd status (LinkedIn's 999) read as "unreachable".** It now reads as "blocked", as it already did on Node. `remote.ts`
- **A page declaring `<meta charset="utf-16">` decoded as garbage.** It is now read as UTF-8, as browsers do. `link-meta.ts`
- **The contact and report form routes answered a hit on the flood limit with a bare "Too Many Requests" page.** They now answer in the form's own shape: JSON `rate_limited` for the page script, or a 303 back to the page. `apps/server/src/http/portfolio.ts`
- **Moderation:**
  - Setting a report to the status it already has used to overwrite who handled it first and when, and restart the 90-day clock for the reporter's address. It is now `PORTFOLIO_MODERATION_CONFLICT`; an unknown report is `NOT_FOUND`. Both are declared on the procedure.
  - A ban past its `banExpires` now counts as no ban, matching `ownerIsNotBanned`.
  - `moderation.ts`, `admin-router.ts`

### Search engines and caching

- **`PORTFOLIO_MODE=admins` (today's production setting) let admin test portfolios be indexed.** They got no noindex, got JSON-LD, and were listed in the sitemap after 7 days. `portfolioIsIndexable` is now false unless the mode is `on`. `public.ts`
- **Share card:**
  - It was `public, max-age=3600`, so it kept showing for up to an hour after the portfolio was unpublished or taken down. It is now `public, no-cache` with the existing ETag, so every use revalidates (304 while unchanged).
  - The banner redirect is now `no-store`.
  - HEAD answers with headers only instead of drawing the PNG.
  - `apps/server/src/static/portfolio-card.ts`

### Statistics

- **Totals could include days after "today".** Daily rows were read with no upper bound, so after an owner moved their time zone west, the totals counted rows the day chart didn't show. `statistics.ts`
- **The detailed breakdown and the daily counts covered different spans.** Analytics Engine started at `now − 30 days`; it now starts at the beginning of the oldest of the 30 days in the owner's zone (`startOfDayInTimeZone`, DST-safe).
- **The breakdown cache ignored the time zone.** A zone change showed old day buckets for up to 5 minutes; the zone is now part of the cache key. `analytics.ts`, `traffic.ts`

### Performance

- **New indexes for queries the minute job runs on every run** (migration `20261112061017_mighty_norrin_radd`, indexes only; SQL reviewed):
  - Partial `portfolio_message (portfolio_id, created_at) WHERE notified_at IS NULL`: the merged-email job read every message kept for 90 days.
  - Partial `portfolio_report (handled_at) WHERE reporter_email IS NOT NULL`: the reporter-address cleanup scanned every report.
  - `portfolio (files_checked_at NULLS FIRST)`: the weekly-check picker sorted every portfolio.

## Refactors

- `service.ts` was 687 lines and is now 448.
  - New `media.ts` (`portfolioMedia`, spread into `portfolioService`) holds uploads, pasted links, remote pictures and file deletion.
  - New `access.ts` holds `enabledAccount`, `requireEnabled` and `requirePortfolio`.
  - `portfolioService`'s shape is unchanged, so no caller changed.
  - `router.ts` was left as it is: it is mostly declarative and a split wouldn't make it clearer.
- Comments now say what Workers really does about private addresses. `global_fetch_strictly_public` isn't an address filter; the DoH pre-check is the guard. `remote.ts`
- The message email is now documented as at-least-once delivery. `contact.ts`

## Tests added

- `plan.integration.test.ts`: swapping a work while over the limit is refused; swapping while within the limit is allowed.
- `data.test.ts`:
  - broken privacy settings hide what they controlled, and missing ones keep their defaults;
  - data that isn't a portfolio shows nothing private;
  - an empty Images or Metrics block is dropped and the result saves.
- `moderation.integration.test.ts`:
  - the export carries raw data, statistics and moderation history;
  - setting a report's status again is a conflict, and an unknown report is `NOT_FOUND`;
  - an expired ban counts as no ban;
  - deleting a reported portfolio leaves a log trace without the reporter's details.
- `portfolio.integration.test.ts`: a deleted portfolio's files are still deleted while off; while off, unused files are deleted and the weekly check is skipped. This replaces "leaves files alone while off".
- `client-address.test.ts` (new): /64 grouping, IPv4-mapped addresses, and invalid input.
- `turnstile.test.ts`: test secrets refused in production; no `remoteip` for `unknown`.
- `unfurl.test.ts`: a GIF with a huge frame; an oEmbed answer of `null`.
- `link-meta.test.ts`: a meta-declared UTF-16 page.
- `remote.test.ts`: the odd-status mapping on Node and on Workers.
- `public.integration.test.ts`: admins mode is never indexed.
- `analytics.test.ts`: the start of the window in the owner's zone. `traffic.test.ts`: `startOfDayInTimeZone` across DST.
- `apps/server/src/http/portfolio.test.ts`: the flood-limit answer shape.
- `apps/server/src/static/portfolio-card.test.ts`: revalidation headers, the `no-store` banner, HEAD.

## Checks run

- Typecheck (`pnpm --filter <pkg> typecheck`): `@rezumi/schema`, `@rezumi/api`, `@rezumi/db`, `@rezumi/email`, `server` — all clean.
- Tests, with `PORTFOLIO_TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rezumi_billing_test` (`pnpm --filter <pkg> exec vp test run`):
  - `@rezumi/schema`: 188 passed.
  - `@rezumi/api`: 1145 passed, 192 skipped. The skips are suites needing other databases (`COVER_LETTER_TEST_DATABASE_URL`, `OAUTH_TEST_DATABASE_URL`); every portfolio real-DB suite ran.
  - `@rezumi/db`: 1 passed, 3 skipped.
  - `@rezumi/email`: 10 passed.
  - `server`: 289 passed, 4 skipped.
- `pnpm exec vp lint --fix`, `pnpm exec vp fmt`, then `pnpm exec vp lint --deny-warnings --format=agent` on my changed paths: clean.
- `pnpm exec turbo boundaries`: no issues in 2207 files.
- `pnpm db:generate`: one index-only migration, SQL reviewed.
- `pnpm docs:gen`: `docs/spec.json` gained the export's `statistics` and `moderation`. It also picked up an unrelated billing rename (`orderId` → `providerPaymentId`), so the spec had been stale.
- `pnpm check:cloudflare`: dry run exit 0.
- Not mine: `@rezumi/portfolio` `effects.test.ts` fails the 6 KB budget test while pf-render is mid-edit. I ran it only to confirm my schema change didn't break the render package; the other 379 tests pass.

## Cross-area

1. **High: share cards never render on Workers (portfolio and resume).**
   - Where: `apps/server/src/static/portfolio-card.ts:15-18` and `resume-card.ts:13`, plus `tooling/cloudflare/build.mjs:36-39, 68`.
   - Problem: the cards load `@resvg/resvg-wasm/index_bg.wasm` through `import.meta.resolve` + `readFile`. The bundle keeps `import.meta.resolve("@resvg/resvg-wasm/index_bg.wasm")` (confirmed in `apps/server/dist-cloudflare/index.js`), and the build maps every `.wasm` import to `forme.wasm` and ships only that file. In production every card fails and falls back to the banner.
   - Fix (owner: whoever owns `tooling/`): copy resvg's wasm into the bundle as `resvg.wasm`, give it its own `onResolve` rule, and on Workers hand the imported module to `initWasm`. I can add a `configureCardWasm(read)` hook on the server side if wanted. Add a smoke assertion that `/cards/<user>.png` returns `image/png`.
2. **Custom-domain liveness rule differs.**
   - Where: `packages/api/src/features/custom-domain/service.ts`. `customDomainDestination` (≈325-340) needs only `verifiedAt`; `domainIsLive` (≈298-308, canonical and sitemap) also needs the SaaS hostname and SSL to be active.
   - Problem: while a hostname is pending, the custom domain serves a self-canonical page while the app page points to the app address.
   - Fix: one liveness rule for both.
3. **Long resume item ids can't be hidden on the portfolio.**
   - Where: `packages/schema/src/resume/data.ts` (`id` fields unbounded).
   - Problem: an id over 64 characters (or empty) makes a save fail when it is put in `hiddenItems`/`sections.hidden`, so that item stays public. `importWorks` can't dedupe or import such projects either.
   - Fix: cap resume item ids at write, or hash long ids into portfolio references.
4. **`packages/utils/src/url-security.node.ts`:**
   - Workers builds a `Response` for odd statuses and throws `RangeError`. I map that in `remote.ts` now; mapping it at the source would be cleaner.
   - Not verified at runtime: that workerd's `node:net` exports `BlockList`, which this module builds at load. `check:cloudflare` builds and bundles, but doesn't run it.
5. **Web (pf-web):**
   - Swapping a work while over the plan's works limit is now `PLAN_LIMIT_REACHED` `portfolioWorks`. The editor's add-work flow should already block this; worth checking that a "replace" path doesn't exist.
   - `portfolio.admin.setReportStatus` can now return `PORTFOLIO_MODERATION_CONFLICT` and `NOT_FOUND`: word them on the reports page.
   - The moderation log now holds a `deleted` action keyed only to the account (its `portfolio_id` is null), so no portfolio page shows it.
6. **pf-render:**
   - Visits that arrive as a prefetch or prerender are never counted: the page skips speculative requests and there is no `view` beacon when the page is shown later. A `view` beacon on `prerenderingchange` would fix it (server side: accept `view` in `PORTFOLIO_EVENT_KINDS` and dedupe on the same key).
7. **Plan docs (principal):**
   - `02-teknis.md` §29/§32.2 say the file job does nothing while `off`; it now deletes unused and deleted-portfolio files in every mode.
   - §36 (the Turnstile test secret) and §39 (moderation log actions) need the notes above.

## Not done

- **Retrying a failed report email to the operator.** It would need a `notified_at` column on `portfolio_report` and a job with backoff. The admin page is the record of truth and the email is best effort, so I left it rather than add a half-built queue.
- **A cancelled unfurl still logs as an internal error.** `signal.reason` is rethrown. Harmless (the client is gone), only log noise.
- **A broken stored `basics.picture` reads as missing, so the resume's photo shows.** Failing closed needs a separate "broken" marker, because missing is legitimately "use the resume's". Reachable only through schema drift.
- **`create` reads entitlements before its transaction.** `assertPortfolioPlan` re-checks under the billing lock, so a plan change in between gives a refusal instead of a trimmed list: a UX edge, not a bypass.
- **No unit test for the second storage purge in `deleteAccount`.** That service has no test harness for its database, storage and auth together; the change is a single best-effort call.
- **Owner visits on a custom domain still count** (Phase 09 decision, no session cookie there).

## Feature ideas

- A `view` beacon for prerendered or prefetched pages (cross-area 6).
- A one-URL sitemap and a `Sitemap:` line in `robots.txt` on custom domains.
- An account-level moderation history on the admin page, showing `deleted`, `banned` and other entries whose portfolio is gone.
- Durable report notifications with retry, and a small "notification health" counter on the admin page.
