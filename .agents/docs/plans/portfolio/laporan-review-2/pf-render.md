# Review 2: pf-render (public-page render side)

Scope: `packages/portfolio/**` and `tooling/portfolio/**`. Method: I saved a baseline render of the full matrix (6 themes × 4 personas × 2 languages × 4 variants × 2 modes = 384 HTML pages) before any change. I ran two read-only reviewers: one on themes, CSS and accessibility, one on effects, media and metrics. I reviewed the rest myself. After the fixes I re-rendered and compared the HTML, then compared screenshots of the baseline and new pages in Chrome at 390 and 1440 px.

## Findings fixed

### Security and link safety

- **URL filters let through addresses that browsers rewrite.** Browsers drop tabs and line breaks anywhere in a URL, and spaces or control characters at its start. So `/\t/evil.example` became `//evil.example` (another site), and `da\tta:` became `data:`. Both passed `linkAttributes` (`LINKABLE`) and the default `imageUrl` (`PAGE_IMAGE`). Fix: a new `isPlainUrl` refuses such addresses before either check runs (`src/shared/primitives.tsx`, `src/page.tsx`).
- **Rich-text links without an address became `href=""`.** In `renderPortfolioHtml`, such a link opened the page itself in a new tab. Two related problems:
  - `mailto:` links were matched case-sensitively, so `MAILTO:` ones got `target=_blank`.
  - In-page `#` links also got `target=_blank`.

  Fix: an empty link stays plain text, `mailto:` (any case) and `#` links open in place, and the address is trimmed (`src/rich-text.ts`).

- **The PDF card's link skipped the address policy.** Its `href` is now held to the same `imageUrl` policy as the pictures beside it, and the link is left out when the address isn't allowed (`src/shared/media.tsx`).
- **The intro's picture address was encoded twice.** `encodeURI` turned `%20` into `%2520`. Now only characters that could end the CSS string are percent-encoded: a quote, a backslash or a line break (`src/shared/intro.tsx`).

### Correctness

- **Gradien hidup was invisible on headlines in Paper and Mozaik.** `color:transparent` lost to the themes' own `color` on the headline, which has higher specificity. The effect now uses `-webkit-text-fill-color`, with a forced-colours fallback (`src/effects/css.ts`).
- **Before → after bars read backwards with negative values.** `-20 → 10` drew as a drop. The bars now measure from the lower of zero and the two values, so the larger value always draws the longer bar (`src/metric.ts`).
- **Ratings mixed two digit systems.** The `/5` was always Western, giving `٤٫٥/5`. It now uses the score's own digits (`٤٫٥/٥`). The PDF page count is also formatted in the page's digits (`src/metric.ts`, `src/shared/media.tsx`).
- **`truncateText` could cut an emoji sequence or a letter with its accent in half.** It now cuts on grapheme boundaries (`src/text.ts`). It is used for the SEO description and for drafts made from the resume (`initial.ts`).
- **The typewriter and Garis vektor split letters by code point.** Text could show half an emoji or a broken Indic conjunct. Both now split by grapheme. Garis vektor also leaves Indic, Thai, Lao, Myanmar and Khmer text whole, as it already did for Hebrew and Arabic (`src/effects/runtime.ts`).
- **A typewriter phrase list holding non-text threw.** Non-text entries are now ignored.
- **An effect that threw stopped the live script after it** (click counts, contact form). Each effect now runs inside `try{…}catch{}` (`src/effects/index.ts`).
- **The scramble layer was offset by the name's border width.** It measured from the border box but positioned against the padding box. It now subtracts `clientLeft`/`clientTop`.
- **Typewriter placeholders didn't keep repeated spaces.** The placeholder copies now use `white-space:pre-wrap` like the visible text, so the line doesn't shift while typing.
- **A resume role that isn't an object crashed the page.** `null` or text inside `roles` in old or imported data now gets skipped (`src/resume-entries.ts`).
- **File sizes just under 1 MB read "1,000 kB".** They now read "1 MB", and the fallback no longer prints "820.0 kB" (`formatFileSize`, `src/shared/media.tsx`).
- **Dark pages printed light text on white paper.** Browsers leave backgrounds out when printing. The dark tokens (`designCss`, the gradient effect's colours and Paper's texture inversion) now apply on screens only, so a printout is always light.
- **There was no print style at all.** A print block now hides the skip link, navigation links, menu, contact form, picture viewer and detail bar. It makes the sticky header static, and prints an open work's detail alone and in the flow. Kanvas work captions, otherwise hidden until hover, show in print (`src/shared/base-css.ts`, `src/themes/kanvas/css.ts`). Checked with Chrome PDF output: dark Kanvas, Prima and Paper, page and detail.

### Accessibility

- **Long unbroken words pushed the page sideways in Lugas and Mozaik** (and in parts of Prima and Kanvas). `.pf{overflow-wrap:anywhere}` is now shared, and Paper's and Brutal's own copies are gone. The phone menu button got `flex:none`: with long names, the root rule had squeezed "Menu" into one letter per line, which the screenshot comparison caught. Measured at 375 px with a 51-character word in every button, chip, tag, title and list label: page width before was 444 px in Lugas and 398 px in Mozaik; after, 375 px in all six themes.
- **Primary button text dropped below 4.5:1 on hover.** The hover background mixed towards the page's text colour, which is also the label's direction. Examples: Lugas `#EA580C` went 5.30 → 4.13, and dark `#15803D` went 5.02 → 3.98. A new token, `--pf-accent-hover`, is computed in `design.ts` and moves away from the label colour. `contrast.test.ts` now checks that hovering never lowers contrast, in every theme × accent × mode.
- **Paper's primary button was invisible on a picture intro** (white on white, about 1:1). The picture intro now sets its own dark ground (`--pf-bg:#111`), so fills drawn in the page colour stay readable. Measured after the fix: dark text on a white button.
- **A `dd` had `role="img"`, which ARIA doesn't allow on that element.** The progress bar's value is now sr-only text inside the `dd` (`src/shared/metric.tsx`).
- **The empty contact-form status used `display:none`.** That removed the live region from the accessibility tree until the first message was written, so screen readers could miss it. It now collapses visually but stays in the tree.
- **Hover zoom on pictures still moved under reduced motion** (instantly) in Kanvas, Mozaik and the video card. One shared reduced-motion rule now covers every theme; Paper's own copy was removed.

### Performance

- The shared CSS ships without its comments, about 0.9 KB less on every page (`BASE_CSS`; the comments stay in the source).
- Removed dead or repeated CSS:
  - `.pf-lightbox[hidden]` and `.pf-lightbox__btn[hidden]` (the global `[hidden]` rule covers them);
  - Prima's and Mozaik's `nowrap` on nav links (the base rule already has it);
  - Prima's `timeline{gap:0}`, and its two consecutive rules for the same selector, now merged;
  - Lugas' `grid-row:span 1`.

## Refactors

- **One shared `SectionBody`** (`src/shared/section-body.tsx`) replaces the near-identical section switch in Lugas, Prima, Kanvas, Paper and Brutal. Each theme now passes a small style object: class prefix, work list, and wrappers for Prima's and Kanvas' contact and custom sections. Mozaik's tiles still draw their own. Proven zero-diff: all 384 rendered pages are byte-identical before and after this refactor.
- The tooling docs (`previews.ts`, `persona.ts`) now name the personas of all six themes.

## Tests added

Tests went from 376 to 390, all passing.

- **page:**
  - tab, line break and space obfuscation in links and pictures;
  - dark tokens apply on screens only;
  - the print block;
  - the progress bar as text.
- **rich text (`renderPortfolioHtml`):** link attributes; links with no address or an unsafe one.
- **metric:** bars with negative values; rating digits in `ar-SA`.
- **text:** grapheme-safe truncation.
- **effects:**
  - `try` wrapper;
  - Gradien hidup fill;
  - typewriter graphemes and non-text phrases;
  - Garis vektor skipping Indic, Thai and Khmer and keeping emoji whole.
- **resume entries:** non-object roles.
- **shared:** intro picture address encoding; `formatFileSize` near 1 MB.
- **contrast:** hover contrast, every theme × accent × mode.
- **themes:**
  - root `overflow-wrap`;
  - reduced-motion hover;
  - comment-free CSS;
  - form status stays a live region;
  - dead rules stay gone.

## Checks run

- `pnpm --filter @rezumi/portfolio typecheck`: pass.
- `pnpm --filter @rezumi/portfolio test`: 390 passed (25 files).
- `pnpm --filter @rezumi/tooling typecheck`: pass.
- `pnpm exec vp lint --deny-warnings packages/portfolio tooling/portfolio`: clean.
- `pnpm exec vp fmt --check packages/portfolio tooling/portfolio`: clean.
- `pnpm --filter server test src/static/portfolio-page.test.ts`: 27 passed. It renders through this package; I ran it only to check that nothing broke.
- **Visual:** screenshots in Chrome, baseline versus new, of each theme's own persona in variants full, long, minimal and RTL, both languages, light and dark, at 390 and 1440 px.
  - Every page matched except the intended change on long names at phone width.
  - In the baseline, the phone "Menu" button was squeezed to one letter per line in Brutal and Paper (which already had `overflow-wrap:anywhere`). Now it is whole in all six themes, and the brand name beside it shows a little more before its ellipsis.
  - The long Kanvas intro rewraps by one word.
  - Two dark pairs that differed (Kanvas `id` long at 1440 px, Paper RTL at 1440 px) matched on a re-run.
  - Kanvas at 390 px: whichever page the harness opens first gets the condensed heading font (`font-display: optional`), with either version first. This is a test-harness effect, not a change in the page.
  - Dark Brutal showed only anti-aliasing noise.
- **Print:** Chrome PDF of dark Kanvas, Prima and Paper, page and open detail.
- **Long-word check:** see the accessibility section.
- **Theme gallery pictures were not regenerated.** Their area (the top of the page at 1440 px, own persona) has no visual change.

## Cross-area items

1. **Paper's work-card call to action** (`packages/portfolio/src/themes/paper/theme.tsx`, `pp-work__cta`) shows the section title "Case studies" rather than an action. It is `aria-hidden`, so only sighted readers see it.
   - Proposed: add a "View case study" string to `messages.ts`. That needs the catalog and translations, which pf-web owns (`apps/web/locales`, `pnpm lingui:extract`, then `pnpm pdf:translations`).
   - Left as is, because it may follow the owner's reference design.
2. **pf-server's note says pf-render owns `tooling/`.** It doesn't: only `tooling/portfolio/**` is mine. The resvg wasm problem in `tooling/cloudflare/build.mjs` (share cards fall back to the banner on Workers) needs an owner outside this wave's three areas.
3. **`tooling/portfolio/seed.ts` writes `portfolio` and `portfolio_file` with raw SQL**, not through `saveVersionedData`. It is dev-only and local-only, and still matches the current schema (pf-server only added indexes). If pf-server changes those tables' columns, the seed needs the same change.

## Not done

- **CSS repeated across themes** (`.pf-quote__source`, the quote carousel, `.pf-service__cta`) was left in place. Each copy differs slightly per theme, and a page ships only one theme, so visitors would gain nothing.
- **Optional parts of `BASE_CSS`** (video, picture viewer, location, link card, form, PDF; about 7.7 KB raw, about 2 KB gzipped) still ship on every page. Gating them per view would need ordering care; it is listed under feature ideas.
- **Small inconsistencies between themes were left as designed:**
  - only Paper and Brutal make work card titles `h3`;
  - Brutal's tags are `span`s;
  - Paper and Brutal draw hero stats outside the intro section.

## Feature ideas (later wave)

- Ship only the shared CSS a page uses (video, viewer, form, map, PDF and link card chunks) for about 2 KB less per page.
- Serve Paper's 29 KB inline fibre texture as one cached static file instead of inlining it in every Paper page.
- A shared quote carousel and service CTA with per-theme tokens, once a sixth or seventh theme makes the copies costly.
- A "print this portfolio" link that opens the print view with every work's detail included.
