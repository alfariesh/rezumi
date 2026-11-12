# Phase 13: pf-render

Scope: `packages/portfolio/**` except `themes/{sintaks,warta}/**`, and `tooling/portfolio/**` except the `raka` and `laras` personas. Nothing is committed: the principal commits.

## Built

### B2: work pages

- **Rendering.** `renderPortfolioPage({ …, page: { kind: "work", workId } })` draws a work's page. An unknown id throws.
  - `PageShell` replaces the `main` content with the shared `WorkArticle` (`shared/work-page.tsx`). `main#main` gets `aria-labelledby="<anchor>--title"`.
  - A published page's root `.pf` gets `data-pf-work=<id>`.
  - The picture viewer follows the footer when the work has a gallery.
  - Every theme gets the page without theme code. The theme's intro, sections and intro effect are not drawn: `effectAssets` is skipped for work pages.
- **`WorkArticle` markup**, inside `article.pf-workpage`:
  - `a.pf-workpage__back` ("All work" → `${homeUrl}#work`);
  - `header.pf-detail__head` with `h1.pf-detail__title` (the page's only `h1`), summary, role/year and tags;
  - the cover (`pf-cover pf-detail__hero`, eager, high priority);
  - `pf-blocks` (text, galleries, metrics, video, **embed**, PDF, link);
  - the main link;
  - `nav.pf-workpage__more[aria-label=otherWork]`, with previous/next as `a.pf-workpage__step` (label + title, `rel=prev/next`, no wrap-around).
- **Navigation on a work page.** The brand goes to `view.homeUrl` and the section links to `${homeUrl}#<anchor>`. With the default `#main` (editor preview) they stay `#<anchor>`. The helper is `homeLink`.
- **The detail dialog is gone everywhere.** Removed:
  - `WorkDetail`/`WorkDetails`;
  - the `.pf-detail` dialog CSS (`:target`, `.pf-open`, panel, bar, mobile and print rules);
  - all dialog code in `PORTFOLIO_PAGE_SCRIPT`: hash handling, focus, arrow-key stepping, tap outside, putting the player back.

  `PORTFOLIO_PAGE_SCRIPT` keeps the picture viewer, menu, local time and players, and shrinks from 3,504 B to 2,489 B (shipped size).

- **`PORTFOLIO_LIVE_SCRIPT`** (now 1,626 B, under the 1,792 B cap) no longer sends `work`. Every beacon carries `id` from the root's `data-pf-work`. The prerender `view` beacon carries `ref: document.referrer` (at most 300 characters, left out when empty).
- **Six themes:** cards use `href={work.href}`. Their old `.pf-detail…` rules moved to `.pf-workpage`, `.pf-workpage__back` and `.pf-workpage__step`; titles and covers keep their theme rules.
  - Mozaik's link and PDF cards now sit on `--pf-surface` (they were tuned for the old surface-coloured dialog).
  - Brutal's embed card gets its heavy stroke and shadow.
- **Paper's card call to action** uses `viewWork` (section 12.4).
- **Base CSS:**
  - `.pf-workpage` and its parts;
  - the work title at `clamp(2rem, …, 3.25rem)`;
  - print hides the back link and prev/next, and the page prints in the flow.

### B19, B14, B17

- **`OpenToWork`** draws `p.pf-opento`: label "Looking for:" + roles " · " + " — " + kinds. It is placed after `IntroChips` in the six themes, with base CSS only.
- **Save contact (B14).**
  - `Contact` adds a secondary **Save contact** button (`data-pf-event="vcard"`, `download`, new `user-plus` icon) after Email and WhatsApp. Alone, it is never the primary button.
  - An intro button of kind `vcard` gets the same icon and `download`.
  - `download` is left off when the address is `#…` (the editor preview's `#contact`).
- **`EmbedFacade` (B17)** in `shared/media.tsx` draws `div.pf-embed[data-provider][data-shape]` > `a.pf-embed__open`.
  - The link has `linkAttributes`, `data-embed`, `data-title`, `data-pf-event="embed"`, `data-pf-block`, and `aria-label` = `showEmbed` + title.
  - Inside it: `.pf-embed__media` (the picture, or the provider's name) and `.pf-embed__text` (title + action). The `p.pf-embed__note` note is outside it, always visible.
  - Base CSS: `wide` is 16:9 (a band of at least 120 px without a picture); `audio` and `audio-tall` are a row with a square picture.
  - After a press, the iframe is 16:9, 166 px or 380 px tall. The page script uses the same `a[data-embed]` path as videos.

### `vcard.ts` and `gate.ts`

- **`buildPortfolioVcard(view, { url })`:** vCard 3.0 with CRLF line endings.
  - Values are escaped (`\\ \, \; \n`); the Langkah 0 stub didn't escape `;`.
  - Lines fold at 75 octets, cut only between characters.
  - It holds:
    - the name and headline;
    - email, WhatsApp and phone only while Contact shows them;
    - the portfolio URL, then the website and profiles, each address once;
    - `ADR;TYPE=WORK:;;;<place>;;;` from the intro's place rule.
- **`renderPortfolioLockPage` and `renderPortfolioMissingWorkPage`:** plain pages with their own light/dark CSS, no script, `noindex, nofollow` and everything escaped.
  - The lock page has a labelled password field (6–64 characters, `current-password`).
  - The error has `role="alert"` and is tied to the field with `aria-invalid` and `aria-describedby`.
  - The Report link has `rel="nofollow"`.

### Fixtures and tooling

- **`fullPortfolioData` gains:**
  - `previousSlugs`;
  - Open to work roles (one with spaces, one empty) and kinds;
  - `saveContact`;
  - one `embed` block per provider (Figma with a picture, Loom, Spotify episode with a picture, a SoundCloud set, Google Slides).
- **`renderTestPage`** gains `page` and `links`. The default links are now the server's: home `/<username>`, works `/<username>/work/<slug>`, vCard `/api/portfolio/<username>/vcard`. `links: null` keeps the view's defaults (the editor preview).
- **`writePersonaPage`** (`tooling/portfolio/render.ts`) takes `work: <slug>` and writes the work's page as `<home>.work-<slug>.html`. Home and work pages link to each other by those names; Save contact points at `#contact`.
- **`portfolio:preview`** has `--work <slug>` and `--works` (every listed work).
- **`portfolio:matrix`:** its `details` part now photographs each theme's first work page in variants A and D (RTL), light and dark, at 390 and 1440 px, full page. The sheets get rows "first work's page · A/D".
- **Personas** Nadia, Anindya, Bayu and Citra get Open to work roles and kinds. The RTL variant keeps them. Their first work gains fictional embeds: Figma + Loom, Google Slides, Spotify + SoundCloud, Figma.

## Tests

`@rezumi/portfolio` (`vp test run`): **469 tests in 29 files, 467 passed, 2 failed.**

The two failures are pf-themes' work in progress: Sintaks and Warta don't place `OpenToWork` yet (`themes.test.ts` › "every theme says what the person is looking for" › sintaks and warta).

New or rewritten:

- **`shared.test.tsx`:** the work page (neighbours by title without wrap-around, viewer only with a gallery, `main` named by the title, rich-text levels, links back home; the preview's `#` links).
- **`page.test.tsx`:**
  - cards link to `/nadia/work/…`, and the home page has no dialog;
  - block tests run on the work page;
  - unique heading ids on every work page × theme;
  - the print block;
  - Save contact in Contact and in the intro (download, preview, alone = quiet);
  - every embed as a facade (no iframe, no outside `src`, labels, notes, shapes);
  - `readingMinutes`;
  - `portfolioIconNames(view, page)`;
  - a work page has no intro or effect, carries `data-pf-work` when live, and an unknown id throws.
- **`themes.test.ts`:**
  - every theme × LTR/RTL × every work page passes `expectSoundPage`;
  - one `h1`, and the viewer is the only dialog;
  - Open to work per theme, after the chips, absent when off, RTL;
  - no theme rule for the old dialog.
- **`script.test.ts` (happy-dom):**
  - no dialog code;
  - video and every embed load only on press;
  - the viewer: modal, steps, a modifier key leaves arrows to the browser, swipe, Escape, focus back, RTL, tap outside.
- **`live-script.test.ts`:**
  - `view` with `ref` cut to 300 characters, and without one;
  - work-page beacons carry `id`;
  - no `work` beacon;
  - listener cleanup between tests.
- **`view.test.ts`:**
  - `href` from the default and from `links.work`;
  - `homeUrl`;
  - `resolvePortfolioWork` (current, moved, an active slug beating another work's old one, hidden, untitled, Work section hidden);
  - `openTo`;
  - vCard links and the "never keeps Contact alone" rule.
- **`vcard.test.ts`:**
  - exact lines;
  - escaping and 75-octet folding with Arabic, emoji and accents (every piece is valid UTF-8);
  - privacy (hidden Contact, email off, no place);
  - the portfolio URL appears once.
- **`gate.test.ts`:** form attributes, no script, errors tied to the field, escaping of every input, RTL, the missing-work page.
- **Existing theme tests** (Kanvas, Mozaik, Prima, Paper, Brutal) now check cards against `work.href`, and blocks and the metric variant on the work page.
- **Script budgets:** the existing tests still pass (page + largest effect ≤ 6 KB, each effect ≤ 3 KB, live ≤ 1.75 KB).

Other checks:

- `pnpm --filter @rezumi/portfolio typecheck`: pass.
- `pnpm --filter @rezumi/tooling typecheck`: pass.
- `vp lint --deny-warnings` and `vp fmt --check` on my 46 changed files: clean.
- `pnpm --filter server test src/static`: 114 passed. pf-server's files; I ran it only to check that nothing broke.

**Visual check:** in Chrome, for the six themes:

- **Work pages:** own persona, full variant, at 1440 and 390 px, light, dark and RTL. No sideways scrolling anywhere.
- **Close-ups at 1440 light and 390 dark:** back link, embeds, PDF and link cards, prev/next, Open to work, Contact buttons.
- **Print:** Chrome PDF of dark Kanvas and light Brutal work pages. They print light, without the back link or prev/next.

Changes made after looking:

- Mozaik's link and PDF card colours;
- Brutal's embed stroke;
- the band for embeds without a picture.

## Differences from the contract

1. **The picture viewer is a child of `.pf` after the footer**, not inside `WorkArticle`: the page script makes the root's other children inert while it is open.
2. **Rich text on a work page** keeps H2/H3 as `h2`/`h3`, and H3 alone becomes `h2`, so nothing is skipped under the `h1`. This uses a new optional `Prose` prop, `topLevel`.
3. **The `view` beacon also carries `id` on a work page** (as clicks do), besides `ref`. pf-server can ignore it, or use it to count a prerendered work page's opening. `parsePortfolioEvent` today drops `id` for kinds other than `work`, so nothing breaks.
4. **`portfolioIconNames(view, page?)`:** with the page, only what it draws (a home page loads no work-block icons). Without it, the old behaviour.
5. **New exports** in `shared/work-page.tsx`: `homeLink(view, anchor?)` and `hasGallery(work)`. `Lightbox` and `Button` in `parts.tsx` are now exported.
6. **The vCard** leaves out `TEL;TYPE=VOICE` when the phone's digits equal the WhatsApp number. It computes the intro's place rule inline (`location.label || basics.location`), with the same result as `introLocation`.
7. **The lock page's error** sits after the field inside the form, tied by `aria-describedby`.
8. **`RenderedPage.firstWork`** in the tooling is now the slug (was the anchor). Only `matrix.ts` uses it.
9. **Paper's call to action** uses `viewWork`, per section 12.4.

## For pf-themes

- **Classes to style:**
  - the work page: `.pf[data-theme="<id>"] .pf-workpage`, `.pf-workpage__back`, `.pf-workpage__more`, `.pf-workpage__step`, `.pf-detail__title`, `.pf-detail__hero`;
  - embeds: `.pf-embed__open`, `.pf-embed__media`, `.pf-embed iframe`.

  No `.pf-detail` dialog rules exist any more.

- **Open to work:** place `<OpenToWork />` right after `<IntroChips …/>`. Two shared tests fail until Sintaks and Warta do.
- **Test fixtures:** `renderTestPage` now uses the server's links by default. Cards must use `work.href`, or `expectSoundPage` reports `#work-… lands nowhere`. Render a work page with `{ page: { kind: "work", workId } }`.
- **Matrix and preview** can show your work pages: `portfolio:matrix --themes sintaks,warta --parts details`, or `portfolio:preview --theme sintaks --persona raka --works`.

## Not done

- **The editor preview's default card links (`#work-<slug>`) lead nowhere**, because no dialog exists any more. pf-web's preview draws `page: { kind: "work" }` when a work is open (contract 3.1). Clicking a card inside the inert preview is pf-web's to handle if wanted.
- **The two Sintaks/Warta Open to work tests** belong to pf-themes. I left them failing rather than touching their files.

## Integration (render side)

### Done

- **`themes.test.ts`:** `SINTAKS_CSS` and `WARTA_CSS` are now in `THEME_CSS`, and the intro-background check loops over all eight theme CSS files.
- **Persona header comments** (`tooling/portfolio/persona.ts`, `previews.ts`): Raka (Sintaks) and Laras (Warta) are listed, and the comments say their portraits are illustrations, not photos.
- **Visual matrix:** `portfolio:matrix --personas own --parts pages,details --lang en`.
  - Eight themes × variants A/B/C/D × light/dark × 390/1440, plus each theme's first work page in A and D (RTL). That is 192 shots, and none scrolls sideways.
  - Seen with my own eyes, at a readable size: Sintaks and Warta home and work pages in A, B, C and D, phone and desktop, light and dark. The other six themes were checked in the work-page round above.
- **Fix: the metric change text keeps its own direction (`<bdi>` in `shared/metric.tsx`).** On RTL pages, "4× the site" used to read "the site ×4". This affects all eight themes.
- **Reading time (Warta cover story):** the rule is sound, since `readingMinutes` counts the work's own text on the portfolio. The contradiction came from the persona: its highlighted metric "Average reading time 11:40" was the magazine's figure. In Laras' persona, "Shares in the first week" is now the card's highlight, and the time metric is labelled "Time spent on the magazine's story".
- **Embeds:**
  - Raka gained Loom and Figma embeds; he already had Google Slides.
  - Laras already had Spotify and SoundCloud.
  - Every provider renders inside Sintaks or Warta.
- **Tooling:** `writePersonaPage` takes `background: "soft-gradient" | "pattern" | "image"` (`image` uses the first work's cover), so intro backgrounds can be drawn on demand.
- **Checks:**
  - `@rezumi/portfolio` typecheck passes, and 485/485 tests pass.
  - `@rezumi/tooling` typecheck passes.
  - Lint and format are clean on the changed files.

### Second pass (after the limit reset)

**Looked at, with my own eyes, in Chrome:**

- **Intro backgrounds on Sintaks and Warta:** soft gradient, pattern and picture, light and dark, 1440 and 390 px.
- **Embed close-ups in all eight themes:** Raka's Loom, Figma and Google Slides and Laras' Spotify, light at 1440 and dark at 390. SoundCloud, which uses the same audio-shape markup as Spotify, was seen earlier on Kanvas.
- **The lock page:** light and dark, English and Arabic, with the wrong-password message.
- **Chrome PDF prints:** Sintaks (dark) and Warta (light), home and work page.
- **Matrix crops of Lugas, Prima, Kanvas, Mozaik, Paper and Brutal:**
  - minimal at 390 light;
  - long at 390 dark and 1440 light;
  - RTL at 1440 dark and 390 light;
  - the RTL work page at 390 dark.
- **Sintaks and Warta** in all four variants, home and work page (first pass).

**Fixed:**

1. **Accent text over a picture intro was unreadable on light pictures.** Measured 1.8:1, for example Warta's kicker and "Open to …" line.
   - The default picture shade is now `rgb(8 10 14/.7)` → `.78`, as Mozaik already used.
   - Accent text over a picture is the dark accent mixed 45% with white, giving about 4.4:1 even on a white picture and 5:1 on the persona's.
   - Affects every theme that draws a picture intro; no persona uses one, so the gallery pictures don't change.
2. **"Open to work" and trend colours over a picture kept their light-mode tones.** Sintaks' chip text was almost invisible over a picture in light mode.
   - `designCss` now emits `--pf-positive-dark` and `--pf-negative-dark`.
   - `[data-bg="image"]` switches to them, as it already did for text and accent.
3. **Printed primary buttons lost their fill.** Browsers drop backgrounds on paper, which made Warta's "Commission a story" white on white.
   - Primary buttons and `.pf-chip--open` now keep their fill in print (`print-color-adjust: exact`).
   - Checked on Warta's PDF.
4. **RTL work cards: an English summary's full stop jumped to the line start** (Lugas, Brutal, Mozaik; the themes draw summaries as spans).
   - The per-block direction rule now also covers `[class$="__title"]`, `[class$="__summary"]`, `[class$="__desc"]` and `[class$="__dek"]`.
   - Checked on Lugas and Brutal RTL.
5. **Lock page on an Arabic page: untranslated English sentences put their full stop at the start.**
   - `h1`, `p` and `label` take their own direction there (`unicode-bidi: plaintext`).

New assertions sit in `themes.test.ts` (fixes 1, 2 and 4), `page.test.tsx` (fix 3) and `gate.test.ts` (fix 5).

**Tried and reverted:**

- `overflow-wrap: break-word` on metric values, to stop Paper's narrow RTL stat cell splitting "مليون".
- Arabic compact numbers join the digit and the word with a no-break space, so the value then overflowed into its neighbour, which is worse.
- Values keep `anywhere`. A mid-word break of a long Arabic unit in a three-column phone strip is the remaining cosmetic issue.

**Not regenerated:** gallery pictures. No theme's top of page changed:

- the picture shade applies only to picture intros, which no persona uses;
- the print rules apply only on paper;
- the direction rule doesn't change left-to-right pages;
- Laras' metric order sits below the fold.

**Checks:**

- `@rezumi/portfolio`: typecheck passes; 485/485 tests pass in 31 files.
- `@rezumi/tooling`: typecheck passes.
- `vp lint --deny-warnings` and `vp fmt --check`: clean on the 12 changed files.

### Still open

- **Arabic persona pages show untranslated interface strings,** for example "Pages:" and the lock page text. That is catalog work (`pnpm pdf:translations` and the Arabic `.po` file), not render code.
- **Mozaik's long variant on a phone:** Save contact sits alone in the location tile, because Mozaik places Contact's parts in separate tiles. This is by design, and the button is labelled.

### Superseded first-pass note (all items above were later done)

- **Rendered but not looked at.** A scratch script rendered these into my scratchpad, and no page scrolled sideways, but I didn't review them by eye:
  - Sintaks and Warta intro backgrounds (gradient, pattern, picture);
  - embed close-ups in both themes;
  - the lock page (light/dark, LTR/RTL);
  - Chrome PDF prints of both new themes' home and work pages.

  To redo: `writePersonaPage(..., { background })`, then `portfolio:preview --theme sintaks --persona raka --works`, and Chrome print.

- **Gallery pictures weren't regenerated.** No top-of-page look changed: the `<bdi>` fix and the persona metric order sit below the fold.
- **Arabic persona pages show the "Pages:" label in English next to Arabic digits** in the PDF card. This is a catalog translation gap, not a render bug.
