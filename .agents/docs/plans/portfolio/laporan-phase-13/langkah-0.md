# Phase 13 — Langkah 0 (contract scaffold), 2026-11-12

Session: pf-server, with the limited cross-layer permission of contract section 2. Nothing is committed: the principal commits.

After this step the whole workspace compiles. Every shared name, type, field, list, theme registration, page string and procedure skeleton from sections 2–4 and 12 is in place. Stubs answer `NOT_IMPLEMENTED` or draw the fallback the contract names, and each wave-1 layer can be built against the final names.

## Scaffolded per layer

### Schema (`packages/schema/src/portfolio/`)

**`limits.ts`**

- `previousSlugs: 5` and `availabilityRoles: 5`.
- `text.availabilityRole: 60` and `text.embedRef: 200`.

**`data.ts`**

- `PORTFOLIO_BUTTON_KINDS` gains `"vcard"`.
- New `PORTFOLIO_JOB_TYPES` and `PortfolioJobType`.
- `work.previousSlugs`: a list of `slugSchema`, at most 5, unique. The write check refuses the work's own slug, and the lenient read drops it; bad entries are dropped one by one on read.
- `hero.availability.roles` and `hero.availability.types`, added to both hero fallbacks.
- `contact.saveContact`: default `true`; a broken stored value reads `false`, following the fail-closed rule from review 2.
- `isListedWork` and `listedWorkSlugs`.

**`embed.ts`** (new, complete)

- `EMBED_PROVIDERS`, `EMBED_PROVIDER_NAMES`, `EmbedShape`, `ParsedEmbed`.
- Functions: `parseEmbedUrl`, `isEmbedRef`, `embedPlayerUrl`, `embedPageUrl`, `embedShape`, `embedFrameOrigins`.
- Constants: `EMBED_FRAME_ORIGINS`, `EMBED_OEMBED_ENDPOINTS`.
- Tests in `embed.test.ts` (30); exported as `./portfolio/embed` in `packages/schema/package.json`.

**`blocks.ts`**

- `PORTFOLIO_BLOCK_TYPES` gains `"embed"`, placed after `video`.
- The `embed` block, whose `isEmbedRef` refine also applies when reading stored data.

**`statistics.ts`**

- `PORTFOLIO_CLICK_KINDS` gains `embed` and `vcard`.
- `PORTFOLIO_VISIT_SOURCES` gains `qr`, before `direct`.
- New: `PORTFOLIO_WORK_SOURCES` with `PortfolioWorkSource`, `PORTFOLIO_QR_UTM_SOURCE`, and `PORTFOLIO_STATISTICS_RANGES` with `PortfolioStatisticsRange`.
- `PORTFOLIO_EVENT_KINDS` is unchanged (still has `work` and `view`); removing `work` is pf-server's job.

**`themes.ts`**

- `sintaks` and `warta` metadata, exactly as in section 3.3.
- The four new font pairs.
- The schema's `describe` text now lists eight themes.

**Tests**

- `data.test.ts`: `previousSlugs` write and read, `isListedWork`, `listedWorkSlugs`, Open to work roles and types, `saveContact` default.
- `themes.test.ts`: the lineup and defaults for eight themes.

### Database

- `packages/db/src/schema/portfolio.ts` gains `password: pg.text("password")`.
- Migration `migrations/20261112064636_broken_luke_cage/migration.sql` is exactly `ALTER TABLE "portfolio" ADD COLUMN "password" text;`.

### API (`packages/api/src/features/portfolio/`)

**`router.ts`**

- `portfolioSchema` gains `hasPassword`.
- `unfurl` output has the `embed` variant. The handler never returns it yet.
- `statistics` takes `{ range?: 7 | 30 | 90 }` and returns the final shape:
  - `range { days, from, to }`;
  - every day of the range with `views`, `messages`, `workOpens`, `clicks`, `sources`;
  - unchanged `totals` and `sources`;
  - all opened works, no longer capped at 10;
  - `details` as `locked`, `not-configured`, `unavailable` or `ready`.
- New skeletons with their final input and output schemas, each throwing `NOT_IMPLEMENTED` (501):
  - `workStatistics`: `GET /portfolio/statistics/works/{workId}`;
  - `setPassword`: `PUT /portfolio/password`, rate limit `portfolioMutationRateLimit`;
  - `removePassword`: `DELETE /portfolio/password`, rate limit `portfolioMutationRateLimit`.

**`statistics.ts`**

- `portfolioStatistics` takes `range` and fills the new fields from the daily rows it already reads.
- The Analytics Engine breakdown still covers the default 30 days; giving it the range is pf-server's B9 work.

**`service.ts`**

- `hasPassword` is in `rowColumns` (`password is not null`) and in `PortfolioRow`, so it reaches every DTO.
- `statistics(userId, { range })`.

**`errors.ts`**

- New `PORTFOLIO_WORK_NOT_FOUND` (404) and `portfolioErrors.workNotFound()`, with its test.

### Render (`packages/portfolio/`)

**`view.ts`**

- `links.home`, `links.work`, `links.vcard`.
- On each work: `href` (default `#work-<slug>`), `previousSlugs`, and `readingMinutes` (words in the summary and text blocks ÷ 200, at least 1; null with no text).
- New type `PortfolioViewEmbedBlock` and the `embed` case in `buildBlock`.
- `PortfolioViewContact.vcard`. It is left out of the `empty` rule, so it never shows Contact on its own.
- `PortfolioView.homeUrl` (default `#main`) and `hero.openTo` (trimmed roles, null when off or empty).
- An intro button of kind `vcard` uses `links.vcard`.
- `buildPortfolioView` lists works with `isListedWork`.
- `resolvePortfolioWork`: the current slug wins; otherwise a previous slug returns `moved`; otherwise null.

**`page.tsx`**

- `PortfolioPageKind` and `RenderPortfolioPageInput.page`. A work page resolves its work and neighbours; an unknown `workId` throws. The stub still draws the home page.

**`shared/context.ts`**

- `RenderContext.page`, with the final union from section 4.2.

**`document.ts`**

- `PortfolioHead.type` is `"profile" | "article"` and drives `og:type` (default `profile`).

**`shared/intro.tsx`**

- `OpenToWork({ className })`, a stub returning `null`.

**`shared/parts.tsx`**

- `BUTTON_ICONS.vcard = "link"` for now.

**`messages.ts`**

- 19 new strings: the 18 in section 4.4, plus `viewWork`.
- `portfolioViewMessages` sets `buttons.vcard = messages.saveContact`.

**`gate.ts`** (new)

- `renderPortfolioLockPage` and `renderPortfolioMissingWorkPage` with their final signatures.
- Each returns a minimal escaped HTML document with no script and `noindex, nofollow`, a form with the required attributes, and an error with `role="alert"`.

**`vcard.ts`** (new)

- `buildPortfolioVcard(view, { url })`: vCard 3.0 with CRLF and escaping, but only `N`/`FN`, `TITLE` and `URL`.
- Folding, contact rows and `ADR` are pf-render's job.

**`package.json`**

- Exports `./gate` and `./vcard`.

**`files.ts`**

- The `embed` block's thumbnail counts as a file key; `files.test.ts` fixture has an `embed` block.

**Themes**

- `themes/sintaks/{index.ts,theme.tsx,css.ts,palette.ts}` and `themes/warta/…`:
  - Lugas copies with the ids replaced;
  - CSS is `LUGAS_CSS.replaceAll('data-theme="lugas"', 'data-theme="<id>"')`;
  - palettes are copies of Lugas';
  - renderers are `SINTAKS_RENDERER` and `WARTA_RENDERER`.
- Registered in `themes/index.ts` and `themes/palettes.ts`.

### Tooling

- `tooling/portfolio/personas/raka.ts` and `laras.ts` are stubs as specified.
- `tooling/portfolio/persona.ts`:
  - `PERSONA_IDS` gains `raka` and `laras`;
  - the persona files are imported and added to `DEFINITIONS`;
  - `THEME_PERSONAS.sintaks = "raka"` and `THEME_PERSONAS.warta = "laras"`.

### Web (compile lines only)

**Contract lines**

- `features/portfolio/themes.ts`: Sintaks and Warta descriptions and audiences, as in section 3.3.
- `statistics/portfolio-statistics.tsx`: click labels "Embeds opened" and "Contacts saved"; source "QR code".
- `editor/intro-form.tsx`: `buttonKindLabel.vcard` ("Save contact"), `hiddenButtonReason("vcard")` ("Shown on your published page."), and `vcard` in `ADD_ORDER` after `pdf`.
- `blocks/block-list.tsx`: an `embed` case in `blockTypeInfo` (label "Embed", description "Figma, Loom, Spotify, SoundCloud or Google Slides") and in `BlockBody` ("Embed: this block can't be edited here yet.").
- `page-text.ts`: the 19 strings and `const provider = ""`.

**Translations**

- `pnpm lingui:extract` was run once; it also runs `pdf:translations`.
- id-ID is filled for the 28 new msgids (page strings, theme copy, editor stubs), using "portofolio" and "Anda".
- `"Password"` already existed as "Kata Sandi" and is shared.
- `pnpm pdf:translations` was run again, so `packages/portfolio/src/portfolio-catalog.json` holds the new strings (id-ID plus every locale that already translates a shared msgid such as "Password" or "Contract").

## Differences from the contract (read before starting wave 1)

1. **Theme folders.** The six existing themes have no `index.ts` or `palette.ts` of their own: their palettes live in `themes/palettes.ts`, their renderers in `themes/index.ts`. The two new themes follow the contract instead:
   - `themes/<id>/index.ts` exports `<ID>_RENDERER: ThemeRenderer`;
   - `themes/<id>/palette.ts` exports `<ID>_PALETTE`;
   - `index.ts` imports the `ThemeRenderer` type from `..`.
   - pf-themes sets `headingWeights`, `nameWeight` and `headingDisplay` in its own `index.ts`.
2. **Item ID schema in the router.** `itemIdSchema` lives in `@rezumi/schema/portfolio/kit`, which isn't exported. `workStatistics` input therefore uses `z.string().regex(PORTFOLIO_ITEM_ID_PATTERN)`: the same rule.
3. **The statistics range schema.** It accepts `z.coerce.number().pipe(z.union([z.literal(7), z.literal(30), z.literal(90)]))`. Output `range.days` is the same union, without coercion.
4. **`portfolioStatistics` signature** gains `range?: PortfolioStatisticsRange` (default `PORTFOLIO_STATISTICS_DAYS`). `portfolioService.statistics(userId, { range })`.
5. **The `details` union.** Both `statistics` and `workStatistics` use `locked | not-configured | unavailable | ready`. The contract's section 3.7 shows only three states; section 12.3 adds `not-configured`.
6. **NOT_IMPLEMENTED message**: "This isn't available yet." (status 501), shared by all three skeletons through `notImplemented` in `router.ts`.
7. **`contact.saveContact`** reads `false` when the stored value is broken. A missing value is `true`, as the contract says. This follows the fail-closed defaults from review 2: every privacy-relevant boolean in `kit.field` has a third "broken" value.
8. **`readingMinutes`** is `Math.max(1, Math.round(words / 200))`, where words are the work's summary plus its text blocks' text.
9. **`resolvePage` in `page.tsx`.** The work page's previous and next works are its neighbours in `view.works` and don't wrap around. With one work, both are null.
10. **`PortfolioHead.type`** was added in Langkah 0, although section 2 doesn't list `document.ts`: section 7 marks it "L0", and the server needs the field. It drives `og:type` already.
11. **Lines outside the section 2 list, edited only to keep the workspace compiling (no behaviour beyond the stated fallback):**
    - `packages/portfolio/src/initial.ts`: `previousSlugs: []` for works copied from the resume.
    - `packages/portfolio/src/shared/shared.test.tsx`: `page: { kind: "home" }` in the test context.
    - `packages/portfolio/src/themes/mozaik/data.test.ts`: `vcard: null` in the empty contact fixture.
    - `apps/web/src/features/portfolio/works/works.ts`: `previousSlugs: []` in `newWork` and in works made from pictures.
    - `apps/web/src/features/portfolio/media/remote.ts`: `UnfurledLink` excludes the `embed` variant, and `unfurlLink` turns an `embed` answer into a link card (`url`, `title`, `thumbnailUrl` → `imageUrl`). The current callers (`add-media-block.tsx`, `link-block.tsx`, `works/add-work/from-link.tsx`) keep compiling. pf-web replaces this when it adds the Embed block and its "Embed it instead" offer.
    - `apps/web/src/features/portfolio/blocks/block-list.tsx`: new `ADDABLE_BLOCK_TYPES` (`PORTFOLIO_BLOCK_TYPES` without `embed`) feeds the Add block menu and the "/" menu. Without it, choosing Embed would have added a Metrics block. pf-web restores `PORTFOLIO_BLOCK_TYPES` there.
    - Web test fixtures that build a `PortfolioWork` or `PortfolioRecord`: `blocks.test.ts`, `metrics.test.ts`, `leave.test.ts`, `settings.test.ts`, `store.test.ts`, `map-pictures.test.ts`. They gain `previousSlugs: []` or `hasPassword: false`.
12. **`viewWork`** (section 12.4) is in `messages.ts` and `page-text.ts` but nothing uses it yet.
13. **`contact.integration.test.ts`**:
    - The 30-day test now checks the new day fields and `range`.
    - A new test covers ranges 7 and 90.
    - Its "missing binding" case already expected `not-configured` (review follow-up).
14. **Section 7 files Langkah 0 does not create.** The owners create them in wave 1:
    - `packages/portfolio/src/shared/work-page.tsx` (pf-render; section 7 doesn't mark it L0);
    - `packages/api/src/features/portfolio/visitor-access.ts` and its `packages/api/package.json` export (pf-server; section 12.1);
    - `apps/web/public/portfolio-themes/**/{sintaks,warta}.*` (pf-themes; the theme gallery shows no picture for the two new themes until then);
    - `tests/e2e/specs/portfolio-phase-13.spec.ts` (pf-web).
    - Every file section 7 marks "L0" has its starting content at its final path.
15. **Web errors.** `apps/web/src/features/portfolio/errors.ts` has no wording yet for `PORTFOLIO_WORK_NOT_FOUND`; it falls back to the generic message. That is pf-web item 7.

## Checks run

- **`pnpm typecheck`** (whole workspace): 27 of 27 tasks successful. This includes `@rezumi/tooling`, `web`, `server` and `apps/mobile`.
- **Tests** (`pnpm --filter <pkg> exec vp test run`):

| Package                                                          | Passed | Skipped | Notes                                                                                                                                          |
| ---------------------------------------------------------------- | ------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `@rezumi/schema`                                                 | 224    | 0       |                                                                                                                                                |
| `@rezumi/portfolio`                                              | 440    | 0       | Theme tests run every `PORTFOLIO_THEMES`, Sintaks and Warta stubs included                                                                     |
| `@rezumi/api` `src/features/portfolio`                           | 355    | 0       | Real database: `PORTFOLIO_TEST_DATABASE_URL` on local `rezumi_billing_test`                                                                    |
| `@rezumi/api` (whole package, before the statistics test update) | 1145   | 192     | The skips are suites needing other test databases; the one failure was the old 30-day shape, since fixed and re-run green in the portfolio run |
| `server`                                                         | 291    | 4       |                                                                                                                                                |
| `web` (whole package)                                            | 742    | 0       | After moving the stub paragraph to `text-body-sm`, as the typography test requires; `src/features/portfolio` alone is 215                      |

- **`pnpm exec turbo boundaries`**: no issues in 2230 files.
- **`pnpm lint:agent`**: clean. **`pnpm format:check`**: all 2738 files formatted.
- **`pnpm db:generate`**: one migration, a single `ADD COLUMN`.
- **`pnpm lingui:extract`** once, then id-ID filled, then **`pnpm pdf:translations`**.
- **`pnpm check:cloudflare`**: the dry run exited 0. The Worker bundle builds with the new schema, router and render code.
