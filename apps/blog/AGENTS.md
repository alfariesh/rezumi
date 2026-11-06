# Rezumi Blog: agent instructions

`apps/blog` is the marketing blog at **blog.rezumi.app**: an Astro 7 site with the [EmDash](https://docs.emdashcms.com/) CMS, server-rendered on its own Cloudflare Worker with a D1 database and an R2 media bucket. It is separate from the app (`apps/web` + `apps/server`): no shared code path, database, cookies or deploy. Articles are content, not code; they live in D1 and are edited in the admin (`/_emdash/admin`) or through the site's MCP server. The root `AGENTS.md` still applies; this file adds what is specific to the blog. Deploy and operations runbook: `.agents/docs/blog.md`.

## Commands

Run from the repository root:

```sh
pnpm dev:blog                       # http://localhost:4321, admin at /_emdash/admin
pnpm --filter blog typecheck        # astro check (TypeScript 6; TS 7 has no language-service API yet)
pnpm --filter blog test             # unit tests for src/lib and src/i18n
pnpm --filter blog build            # production build into apps/blog/dist
pnpm deploy:blog                    # build + wrangler deploy (needs Wrangler auth; see the runbook)
```

`pnpm dev` leaves the blog out. Local D1 and R2 live in `apps/blog/.wrangler/state`; delete that folder to start over from the setup wizard. On a fresh local database, `/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin` applies the seed (with its sample content) and signs you in as a dev admin without a passkey; it exists only under `astro dev`.

After `pnpm dev:blog` has started once, EmDash regenerates `emdash-env.d.ts` from the database's content model. Commit it when the schema changes: CI typechecks against it.

## Layout

| Path                           | Role                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------ |
| `astro.config.ts`              | Astro + EmDash: D1/R2 bindings, i18n, route cache rules, admin branding                          |
| `wrangler.jsonc`               | The `rezumi-blog` Worker: D1 `rezumi-blog`, R2 `rezumi-blog-media`, Images, the Cron Trigger     |
| `seed/seed.json`               | The content model and starter content, applied once by the setup wizard                          |
| `emdash-env.d.ts`              | Generated collection types; never edit by hand                                                   |
| `src/pages/`                   | Thin routes. Each calls a loader and renders a view; `src/pages/id/` repeats them for Indonesian |
| `src/lib/loaders.ts`           | What each page shows, read from EmDash, with cache hints, 404s and redirects                     |
| `src/views/`                   | Page bodies shared by every language: home, article, topic/tag archive, search, 404              |
| `src/components/`              | The bar, footer, cards, call-to-action panel, table of contents, icons                           |
| `src/layouts/BaseLayout.astro` | The document: `<EmDashHead>` (SEO), theme script, hreflang for non-entry pages                   |
| `src/lib/`                     | Pure helpers (paths, app links, dates, Portable Text, RSS), unit-tested beside them              |
| `src/i18n/`                    | Locales and the interface copy in English and Indonesian                                         |
| `src/styles/`                  | Tailwind + the HeroUI theme the app uses (`global.css`), article typography (`prose.css`)        |

## Content model

- **`posts`** (URL `/{slug}`, Indonesian `/id/{slug}`): `title`, `excerpt` (required, max 300; the card text and the fallback meta description), `featured_image`, `content` (Portable Text) and `cta` (`build-resume`, `ats-checker`, `templates` or `none`; shared across translations). Supports drafts, revisions, preview, scheduling, search and the SEO panel.
- **`category`** (hierarchical; the bar lists them, so they are the blog's topics) and **`tag`** (flat; tag pages are `noindex`). Each term has an English and an Indonesian row linked as translations; slugs may differ per language (`resume-tips` / `tips-cv`).
- **Bylines**: "Rezumi Team" ships in the seed, in English only (seed files cannot translate bylines). A byline renders only in languages it has a version in; an article whose bylines have no version in its language shows the default-language article's credits (`loadAuthors` in `src/lib/loaders.ts`). Add the Indonesian version in the admin or with `byline_create` (`locale`, `translationOf`).
- **Settings** the theme reads: title, logo (replaces the logomark), timezone, SEO (title separator, default social image, verification tags, robots.txt), social handles (footer). The tagline and menus are not used: the interface copy is in `src/i18n/messages.ts` for both languages, and the bar lists topics.

The seed is applied once, at setup. On a live site, change the model in the admin (**Content Types**) or with the MCP schema tools, then mirror the change in `seed/seed.json` and regenerate `emdash-env.d.ts` so new environments and CI match. Read [Evolving a deployed site](https://docs.emdashcms.com/deployment/schema-evolution/) before removing or retyping a field: it can delete stored data.

## Rules

- Every page is server-rendered. Do not add `getStaticPaths()` or prerender CMS pages: published edits must show without a deploy.
- `entry.data.slug` is the slug; `entry.id` carries a locale prefix for Indonesian entries. Use `entrySlug()` and the helpers in `src/lib/paths.ts` for every URL.
- Pass every query's `cacheHint` to the route cache (the loaders do). EmDash purges those tags on publish; a route without them can serve stale content for up to an hour. New public routes need a rule in `astro.config.ts`.
- Pages that can 404 or redirect do so in the route file (only pages can return a response); views only render.
- Slugs `category`, `tag`, `search`, `rss.xml` and `id` are taken by routes; an article with one of them is unreachable.
- SEO tags come from `<EmDashHead>` (description, canonical, Open Graph, Twitter card, BlogPosting/WebSite JSON-LD, hreflang for entries, verification tags). Do not hand-write those tags; extra structured data goes through `JsonLd.astro`. EmDash serves `/sitemap.xml`, `/sitemap-posts.xml` and `/robots.txt`.
- Design follows `apps/web/DESIGN.md`: HeroUI tokens and its BEM classes (`button button--primary`, `chip`), Google Sans, sentence case, no all-caps labels, the accent only for actions and the current item, icons only from `@rezumi/icons` through `Icon.astro`. Public pages ship no React; the admin is the only React on the site.
- Interface copy goes in both catalogs of `src/i18n/messages.ts`; the test fails on a missing translation or a changed placeholder. Reuse the app's Indonesian wording (`apps/web/locales/id-ID.po`) where the same phrase exists.
- Links into the app go through `appLink()`, which adds the reader's language and UTM attribution.
- Oxfmt does not format `.astro` files: keep tabs, 120 columns and the repo's import order (type imports, packages, `@rezumi/*`, relative) by hand.

## Adding a language

Add the code to `src/i18n/config.ts` (Astro and EmDash read it), a catalog to `src/i18n/messages.ts`, the app's `?locale=` value and a date locale in `src/lib/app-links.ts` and `src/lib/dates.ts`, a copy of `src/pages/id/` as `src/pages/<code>/`, `public/og/<code>.png`, and the admin locale in `astro.config.ts`. Then translate the topics and tags in the admin.

## Managing content with an agent (EmDash MCP)

The site's MCP server is `https://blog.rezumi.app/_emdash/api/mcp` (locally `http://localhost:4321/_emdash/api/mcp`). It is the owner's content tool, unrelated to Rezumi's user-facing MCP in `packages/mcp`. Connecting a client is in the runbook. Call `schema_get_collection` for `posts` before writing, and follow this routine:

1. **Draft first.** `content_create` with `status: "draft"` (the default). Give every field: `title`, `excerpt`, `content`, `cta`, and the slug.
2. **English is the source.** Write the English article, then create the Indonesian one with `locale: "id"` and `translationOf` set to the English entry's ID, with its own Indonesian slug. Topics and tags carry over to the translation.
3. **Taxonomy and credit.** One topic (`category`), a few existing tags, and the Rezumi Team byline unless the owner names an author.
4. **Search fields.** Excerpt 120–160 characters (it is the meta description unless the SEO panel sets one); a title that says what the reader gets; a short, lowercase, hyphenated slug in the article's language.
5. **Review, then publish.** Ask the owner to review the draft (Preview in the admin, or `content_compare` for edits to a live article) and publish only when asked: `content_get` for the `_rev`, then `content_publish`, or `content_schedule` for a date.
6. **Truthful marketing.** Describe Rezumi features as they exist in the app (check `apps/web/src/features` when in doubt). No invented statistics, testimonials, customer counts or hiring outcomes, and no claim that an ATS score predicts getting hired (`apps/web/PRODUCT.md`). Link app features with plain `https://rezumi.app/...` URLs; the article's call to action adds tracked links on its own.
7. **Headings.** Use `h2` for sections and `h3` below them; they build "On this page". Rich text is Portable Text; keep complex layout for the admin editor.
