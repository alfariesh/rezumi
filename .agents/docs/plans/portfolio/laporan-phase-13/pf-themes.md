# Phase 13 — pf-themes (Sintaks and Warta), 2026-11-12

Scope:

- `packages/portfolio/src/themes/{sintaks,warta}/**`;
- `tooling/portfolio/personas/{raka,laras}.ts`;
- new pictures in `.agents/docs/plans/portfolio/mockups/img/`;
- gallery pictures `apps/web/public/portfolio-themes/**/{sintaks,warta}.*`;
- screenshots in `laporan-phase-13/shots/`.

Nothing is committed: the principal commits. No shared file was edited.

## Summary

The Langkah 0 stubs (Lugas copies) are replaced by two complete themes. Both are built from the shared parts:

- `PageShell` and `Navigation`;
- `HeroName` and `HeroHeadline`;
- `IntroChips` and `OpenToWork`;
- `MetricGroup` and `WorkMetric`;
- `SectionBody`, `ResumeSectionBody`, `ServiceList`, `TestimonialList`, `Clients` and `Contact`;
- `WorkArticle` and `EmbedFacade`, through `PageShell`.

Each theme draws every section kind, every variant it declares, all intro effects it declares, and the work page.

Neither adds a script, a dependency, a CSP origin, a page string or a request to another site.

## Design decisions

### Sintaks: a developer's workspace

The look of a code editor at night, built so the person's own content stays readable text.

**Page**

- Ink-blue night by default (`#0B0F14`). A faint 44 px grid and a soft glow in the accent sit behind the top of the page, masked out below about 800 px.
- Type: the name in the heading face, bold with tight tracking (Geist 700 by default). Everything that labels, paths or counts uses the theme's mono face (JetBrains Mono 400/700, `monoFont`): navigation, section titles, prompts, headline, chips, metadata, figures, dates, footer.

**Intro**

- A terminal window. Its title bar (three dots, `raka@portfolio: ~`) is `aria-hidden`.
- Inside, in order:
  - `$ whoami`, then the name (`h1`);
  - `$ cat role.txt`, then the headline in mono and the accent;
  - the greeting as a `# comment`;
  - the chips, then Open to work;
  - the buttons;
  - a `$` line with a block caret.
- The caret blinks six times, then stays still. It doesn't move at all under reduced motion.
- Every prompt is `<p aria-hidden="true">` with `dir="ltr"`, so screen readers read only the real text and RTL pages keep `$ whoami` readable.
- **photo-right** / **photo-left**: the photo sits in a second window, `avatar.jpg`, beside the terminal.
- **big-name**: the terminal alone, with a larger name (as the contract says, no photo).
- Over a soft gradient, pattern or picture background, the windows turn into frosted glass (`var(--pf-bg)` at 84% + blur), so text stays readable over a photo.

**Highlights**

- A status strip of cells under the terminal: value in mono and the accent, label underneath.
- On phones the strip becomes `key ........ value` rows.

**Sections**

- Each `h2` reads like a Markdown heading: `## About me` with a rule running to the edge. `##` is generated content with empty alternative text (`content:"##"/""`).
- Navigation links read `./About me`.

**Work as repositories**

- Each card shows, in order:
  - the cover (16:10);
  - a book icon and the title in mono and the accent; the title is the card's link to `work.href`, stretched over the card;
  - role · year in mono, then the summary;
  - the highlighted metric as a small stat;
  - the tags as languages, each with a coloured dot. The colour comes from an FNV hash of the tag, picked from ten language-like colours, and is decoration only.
- The work's main link is a separate "code" button (`</>` + label) layered above the stretched link, so the two links are never nested. It carries `data-pf-event="link"`.
- Focus draws the ring on the whole card (`:has(:focus-visible)`).
- **grid-2** (default), **grid-3**, and **list**: one bordered table, cover thumbnail on the end side.

**Career as `git log`**

- Experience, education, volunteering and projects, including the resume's own custom sections of those types, render as a commit log drawn by the theme from `entries`.
- Each row reads: a 7-digit hash (FNV-1a of the entry id, `aria-hidden`), `HEAD` on the latest experience entry (`aria-hidden`), `Title @ Company · Place`, and the dates.
- Description and a job's roles follow as nested commits.
- **timeline** draws the commit graph: a rail and nodes, the first one filled.
- **compact** is one line per commit with dashed dividers.

**Skills as a tech stack**

- **chips** (default): every keyword once, a skill without keywords by its own name, in mono chips. Each chip carries the same colour dot its tag has on the repositories, so "Python" matches across the page.
- **groups**: the shared groups, titled `// Backend`.

**Other sections**

- Short lists (languages, certifications, awards, publications, interests) that follow each other become a row of panels; a single one stays a full section.
- Services: a bordered table (list) or cards; price in mono and the accent.
- Testimonials: cards with an accent bar beside the quote.
- Clients: a sponsor-style grid. In dark mode the grayscale variant inverts logos to light silhouettes, so dark logos stay visible.
- Contact: a second terminal window, `contact.sh`, holding the shared `Contact` (note, buttons including Save contact, links, location card).

**Work page**

- Reads like a README: `← All work` in mono.
- Big bold title, summary, `My role` / `Year` in mono, tags as chips, cover framed.
- Subheads become `## Problem` / `### Why` in mono.
- Metrics in KPI cards; embeds and videos in rounded frames.
- Previous / next as cards with the title in mono and the accent.

**Palette:** the contract's proposal unchanged; it passes the contrast tests.

**Renderer options:** `headingWeights: ["700"]`, `nameWeight: "700"`. Only one heading file is needed, because titles and labels use the mono face.

### Warta: a magazine

Ink rules instead of boxes.

**Type**

- A serif for everything people read slowly: Newsreader 500/600 by default.
- Small capitals in the body face for every label: kickers, rubrics, bylines, folios, navigation, buttons.
- Light by default (newsprint `#FBFAF7`). The accent (fallback `#B42318`) marks rubrics, kickers, folios and the drop caps.

**Masthead**

- The navigation's hairline, then a 3 px rule.
- The headline as a small-capital kicker in the accent, then the name huge and centred (`h1`, sized by its longest word).
- A dateline between hairlines (location · Open to work), then Looking for, the greeting as a standfirst in the serif, and centred buttons.

**Masthead variants**

- **big-name** (default): the photo appears as a small greyscale byline portrait inside the dateline. The person chose to show it, so it stays, small.
- **photo-top**: a round portrait above the kicker.
- **photo-left**: a 4:5 portrait beside a left-aligned masthead, like a profile spread.
- An empty dateline isn't drawn.

**Highlights:** "By the numbers": big serif figures with small-capital labels, separated by vertical hairlines, between two ink rules. A 2 × 2 grid on phones.

**Sections:** a hairline in ink above each, the title in the serif (500), and a two-digit folio in the accent on the end side (`aria-hidden`).

**About:** a larger serif lead with a drop cap (`::first-letter`, 4.5 em, the accent). The drop cap is scoped to `:root:not([dir="rtl"])`, so it is off on right-to-left pages.

**Work**

- **featured-grid** (default): the first work is the cover story, a 7:5 picture and text with a 3.5 rem serif headline and the summary as a serif dek. The rest go in a 3-column grid of articles, each with a hairline above it.
- Each article shows its picture (3:2), then:
  - a rubric: the first tag, in small capitals;
  - the serif headline (`h3`);
  - the dek;
  - the highlighted metric as a serif figure;
  - a byline: role · year · reading time (`work.readingMinutes` → `messages.readingTime`, digits in the page's locale).
- A cover story without a picture centres its text.
- **list**: a table of contents with thumbnails on the end side.
- **grid-2**: two columns of larger articles.

**Other sections**

- Testimonials: pull quotes in the serif with a large accent quotation mark. A single testimonial becomes one large centred quote; the carousel scrolls with column rules.
- Publications stay a full section high on the page: serif titles, publisher · date in small capitals.
- Languages, certifications, awards and interests that follow each other are gathered "in brief": columns under a double rule. Publications are left out of that group on purpose.
- Experience and education (**compact**): the date in a small-capital start column, then the role in the serif, the place in italics, and the description. On phones the date goes above the role. **timeline** keeps the shared rail with Warta's type.
- Skills (**groups**): small-capital group names, with the keywords as a serif comma list; **chips** are small-capital tags.
- Services: a classified-style list or cards with a 3 px top rule.
- Clients: serif names and logos between two rules.
- Contact: the note as a large serif line, then the shared Contact.

**Work page:** a feature article.

- `← All work` in small capitals.
- Centred title (up to 4.75 rem), standfirst, small-capital meta, and tags.
- A wide cover.
- Text in a 720 px serif column with a drop cap on the first paragraph.
- Galleries, videos and wide embeds break out to the full 1040 px.
- Subheads become small-capital accent crossheads; `blockquote` becomes a centred pull quote between two rules.
- Previous / next under a double rule.

**Palette:** the contract's proposal unchanged; it passes the contrast tests.

**Renderer options:** `headingWeights: ["500", "600"]`, `nameWeight: "500"`.

### Shared rules both themes follow

- **Selectors:**
  - every rule sits under `.pf[data-theme="<id>"]`, or under `:root:not([dir="rtl"])` for the drop cap;
  - prefixes are `sk-` and `wt-`;
  - the intro background is written only as `[data-bg]:not([data-bg="plain"]){…background:var(--pf-hero-bg)}`;
  - there is no `[data-bg="soft-gradient|pattern"]`, no `--pf-text:#fff`, and no descendant timeline selector.
- **Text and direction:**
  - all generated text uses empty alternative text (`content:"x";content:"x"/""`);
  - spans holding user text (story deks, bylines, commit titles, language chips) get `unicode-bidi:plaintext` for mixed-direction pages.
- **Rendering:**
  - footer and navigation rules span the content width, not the gutter;
  - print hides the decoration and shadows (dark tokens are screen-only already).
- **Motion:** card zooms and lifts are switched off under reduced motion.

## What was built

| File                                  | Contents                                                                                                                                                                                            |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `themes/sintaks/theme.tsx`            | `SintaksPage`: the terminal intro, the photo window, the status strip, `RepoList`, `CommitLog`/`Commit`, `TechStack`, the contact terminal, extras panels, and the theme's own book and code icons. |
| `themes/sintaks/css.ts`               | `SINTAKS_CSS` (≈30 KB source).                                                                                                                                                                      |
| `themes/sintaks/data.ts`              | Pure helpers: `shortHash` (FNV-1a, 7 hex), `languageColor` (10 colours), `terminalUser` (first word of the name, letters and digits, ≤16, `guest` fallback).                                        |
| `themes/sintaks/data.test.ts`         | Tests for the helpers.                                                                                                                                                                              |
| `themes/sintaks/{index,palette}.ts`   | Renderer options and the palette.                                                                                                                                                                   |
| `themes/sintaks/theme.test.tsx`       | Theme tests.                                                                                                                                                                                        |
| `themes/warta/theme.tsx`              | `WartaPage`: masthead, stats, `Stories`/`Story` (lead, rubric, byline with reading time), brief groups, folios, the contact wrapper.                                                                |
| `themes/warta/css.ts`                 | `WARTA_CSS` (≈26 KB source).                                                                                                                                                                        |
| `themes/warta/{index,palette}.ts`     | Renderer options and the palette.                                                                                                                                                                   |
| `themes/warta/theme.test.tsx`         | Theme tests.                                                                                                                                                                                        |
| `tooling/portfolio/personas/raka.ts`  | Raka Mahendra (resume persona Horizon), en/id, minimal/long/RTL fields.                                                                                                                             |
| `tooling/portfolio/personas/laras.ts` | Laras Kusumawardhani (resume persona Aksara), en/id, minimal/long/RTL fields.                                                                                                                       |
| `mockups/img/` (new files)            | 12 `sintaks-*.svg`, 12 `warta-*.svg`, and the illustrated portraits `raka.jpg` and `laras.jpg` (flat vector drawings rendered to JPEG).                                                             |
| `apps/web/public/portfolio-themes/`   | `jpg/{,id/}{sintaks,warta}.jpg` (49–52 KB) and `thumb/{,id/}{sintaks,warta}.webp` (13–14 KB), from `portfolio:previews sintaks warta`.                                                              |

**Raka's content**

- Six works as repositories, with tags as tools:
  - a dbt metrics layer;
  - an experimentation platform;
  - an uplift model;
  - seller forecasts;
  - a delivery-time model;
  - an SQL academy.
- The first work carries every block type: text, gallery, metrics with change/series/progress, YouTube, a Google Slides embed, PDF and link. Two works carry a main "Source" link.
- Open to work with roles and kinds; services, testimonials, clients, a "Now" free section, a Jakarta location card.

**Laras' content**

- Six works as articles, with first tags as rubrics:
  - a long-form feature;
  - a food story;
  - a podcast with a SoundCloud set embed;
  - a newsletter;
  - an editorial calendar;
  - a headline test guide.
- The cover story carries text with crossheads and a pull quote, a gallery with captions, a big-number metrics block, a Spotify episode embed (audio shape), YouTube, PDF, link and a main link.
- Services, pull-quote testimonials, clients, a "Teaching" free section, a Yogyakarta location card.

All 16 persona combinations (2 personas × en/id × full/minimal/long/rtl) parse under the strict write schema, with every work page rendered (`portfolio:preview --works`).

## Tests and checks (exact results)

**`pnpm --filter @rezumi/portfolio typecheck`:** passed (`tsrs --noEmit`).

**`pnpm --filter @rezumi/portfolio test`:** 31 files, **485 passed**, 0 failed. This includes:

- the shared theme tests for all eight themes:
  - `themes.test.ts`: every variant × LTR/RTL × full/empty; every work page × LTR/RTL; Open to work after the chips;
  - `contrast.test.ts`: 14 accents × 2 modes per theme, plus the muted-text check;
  - `page.test.tsx` and the effects tests;
- the 19 new tests below.

New tests:

- **`themes/sintaks/theme.test.tsx`** (8):
  - order and titles;
  - repository card links to `/nadia/work/kopi-app`, language dots, the main link not nested in the card link, hidden work absent;
  - the work page with all block kinds, 5 embed facades, the Figma player URL and no `iframe`;
  - terminal decoration `aria-hidden`; prompt count with and without a headline; Open to work after the chips;
  - hero variants, with no photo for big-name;
  - privacy of a hidden photo and hidden work;
  - git log (timeline and compact, hashes, `HEAD` per log, role commits) and tech stack vs groups;
  - defaults: `#22C55E`, dark, scramble, Geist/JetBrains Mono, preload Geist 700, theme colours; a chosen accent is kept;
  - CSS scoping, generated text with empty alternative text, the reduced-motion caret, and the same page script as Lugas.
- **`themes/sintaks/data.test.ts`** (3): hash, colour, terminal user.
- **`themes/warta/theme.test.tsx`** (8):
  - order and titles; story link, rubric, byline `Lead designer · 2024 · 1 min read`, no reading time without text;
  - featured-grid lead vs list/grid-2;
  - the work page with all block kinds, 5 embeds and `audio-tall`;
  - masthead order (kicker before `h1`, dateline after), byline photo, no empty dateline;
  - photo-top/photo-left portraits and hidden-photo privacy;
  - folios, the brief group (certifications + languages), publications as a full section before experience;
  - defaults: `#B42318`, light, fade-up, Newsreader/Libre Franklin 500+600, preload 500; a chosen accent is kept;
  - CSS scoping, the drop cap only under `:root:not([dir="rtl"])`, no own script.

**`pnpm --filter @rezumi/tooling typecheck`:** passed.

**Lint and format** (per file, on all 14 owned source files): `vp lint --fix`, `vp fmt`, then `vp lint --deny-warnings` and `vp fmt --check` all exited 0.

- Passing the folders, or several files with tests among them, to one `vp lint` call printed "No files found to lint", so I ran it file by file.

**Visual matrix:** `portfolio:matrix --themes sintaks,warta --personas own --lang en --parts pages,details`

- 32 pages and 16 work pages: variants A–D × light/dark × 1440/390, plus work pages A and D.
- "No shot scrolls sideways".
- Every page was looked at in tiles, and in the Browser pane at 1440, 390 and 320.

**Effects:** `--parts effects` gave 28 frames: Sintaks scramble/fade-up/shimmer/typewriter, Warta fade-up/shimmer/typewriter, each with start, middle, end and reduced motion. All read well; the typewriter types the mono headline in Sintaks and the kicker in Warta.

**Spot checks in Chrome:**

- intro over the soft gradient, pattern and picture backgrounds;
- the JetBrains Mono + Hanken pair;
- RTL desktop and phone;
- 320 px with the very long names (no overflow).

**Problems found by eye and fixed**

| Problem                                                          | Fix                                                                                      |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Warta CV on phones was squeezed into a narrow column             | A specificity bug; the mobile rules now use the same full selectors as the desktop ones. |
| Warta's name split "Kusumawardhan/i" on phones                   | Width factor 0.5 → 0.56.                                                                 |
| The dateline separator started a wrapped line on phones          | Phones stack the dateline without separators.                                            |
| English deks on Arabic pages put the full stop on the wrong side | `unicode-bidi:plaintext` on those spans.                                                 |
| Sintaks showed `_<` in RTL                                       | The prompt mark is now `dir="ltr"`.                                                      |
| Repo covers at 2:1 cut drawings                                  | Now 16:10.                                                                               |
| The picture background showed through the terminal text          | The windows are glass over any intro background.                                         |
| Duplicate "−46% / −46%" in Raka's metric                         | Persona data fixed.                                                                      |
| An Indonesian change text over 12 characters failed the schema   | Persona data fixed.                                                                      |
| Footer and navigation rules wider than the content               | They now span the content width.                                                         |

## Changes wanted in shared files (for the integration step)

None is required: both themes work and pass every test without them.

1. **`packages/portfolio/src/themes.test.ts`**, "shared and theme rules":
   - add `SINTAKS_CSS` and `WARTA_CSS` to `THEME_CSS` (the timeline-selector check);
   - add them to the list in "draws the intro's backgrounds from one set of rules" (the `[data-bg]:not([data-bg="plain"])` rule, no `soft-gradient`/`pattern` selectors, no `--pf-text:#fff`).

   Both themes already satisfy these, and their own tests assert the same, so this only moves the check to one place.

2. **`tooling/portfolio/persona.ts`** header comment: add "Raka Mahendra (Sintaks) and Laras Kusumawardhani (Warta)" to the list of personas, and note that `raka.jpg` and `laras.jpg` are illustrated portraits, not photos.
3. **`tooling/portfolio/previews.ts`** header comment: add "Sintaks Raka, Warta Laras" to the persona list.
4. **Docs (contract section 10):** `01-desain.md` needs a section per theme and `02-teknis.md` a theme note (§41). The "Design decisions" above can be lifted as they are.

No change is wanted in `PORTFOLIO_THEME_INFO`: the variants, effects, font pairs and section order in section 3.3 all fit the designs as built.

## Differences from the contract

1. **Persona cities and Raka's job.** A persona's name and career come from its gallery resume persona (`PersonaDefinition.resume`); the definition can't rename the person without breaking the "long" variant.
   - The only resume personas named Raka and Laras are Horizon and Aksara.
   - **Raka Mahendra** is a data-analytics and analytics-engineering lead in **Jakarta**, not a backend engineer in Yogyakarta. He still fits Sintaks' "developers, data and IT", and his portfolio headline is "Analytics engineering lead · SQL, Python, dbt".
   - **Laras Kusumawardhani** is a features editor and content strategist in **Yogyakarta**, not Jakarta.
2. **Pictures in `mockups/img/`.** Contract section 5 gives pf-themes "gambar baru di `.agents/docs/plans/portfolio/mockups/img/`"; the session brief didn't list that folder.
   - I added only new files there: 24 SVG drawings and 2 JPEG portraits, all drawn for this, not photos of anyone.
   - The location maps reuse the existing abstract map drawings: `map-prima-*` for Jakarta, `map-lugas-*` for Yogyakarta.
3. **Warta big-name keeps the photo**, as a small greyscale byline picture in the dateline. Sintaks big-name drops it, as the contract describes for Sintaks.
4. **Sintaks Skills → chips** shows every keyword, as a tech stack, instead of the skill names the shared chips show. Groups keeps the shared drawing.
5. **Warta groups only languages, certifications, awards and interests "in brief"**: publications stay a full section, since they move up for writers.
6. **Decorative code text is not translated**: `$ whoami`, `cat role.txt`, `avatar.jpg`, `contact.sh`, `HEAD`, `./`, `##`, `//`.
   - It is `aria-hidden` or CSS content with empty alternative text, and reads as code in every language.
   - The only visible, read separator is `@` between a role and its company in the git log.

## Not done

- **Safari, Firefox and real phones were not tested.** Chrome only: the matrix (Playwright with system Chrome) and the Browser pane.
- **Print** rules were added (decoration hidden, shadows off) but no printout was looked at.
- **Intro background variants** (soft gradient, pattern, picture) were checked by switching `data-bg` in the browser on the rendered persona page. No persona variant or matrix row draws them.
- **Raka's portfolio headline** overrides the resume's "Head of Data Analytics · E-commerce". The minimal variant shows the resume's headline, because it drops the portfolio basics by design.
- **Docs and catalog work** (section 10) is left to the integration step.

## Screenshots

In `.agents/docs/plans/portfolio/laporan-phase-13/shots/`, cut from the full-page matrix shots (variant A, English):

- `sintaks-1440-light.jpg`
- `sintaks-1440-dark.jpg`
- `sintaks-390-light.jpg`
- `sintaks-390-dark.jpg`
- `warta-1440-light.jpg`
- `warta-1440-dark.jpg`
- `warta-390-light.jpg`
- `warta-390-dark.jpg`

Extra: `sintaks-work-1440-dark.jpg` and `warta-work-1440-light.jpg`, the first work's page.
