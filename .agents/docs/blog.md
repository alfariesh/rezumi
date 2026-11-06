# Blog runbook (blog.rezumi.app)

How the marketing blog in `apps/blog` is deployed and run. Code conventions and the editorial routine for agents are in `apps/blog/AGENTS.md`.

## Why a subdomain

The blog is served from `blog.rezumi.app`, not `rezumi.app/blog`:

- EmDash owns the root of its origin: the admin and APIs under `/_emdash/`, `/robots.txt`, `/sitemap.xml` and `/sitemap-{collection}.xml`, redirects and the 404 log. It has no base-path option, so a `/blog` mount would mean proxying through the app Worker and merging two robots files and sitemaps.
- A separate origin keeps the CMS (editor sessions, passkeys, plugins, rich content) away from the app's session cookies and user data.
- The blog deploys, caches and fails independently of the app; `docs.rezumi.app` already follows the same pattern.

Search engines treat a subdomain as its own site, so verify it in Search Console (a Domain property for `rezumi.app` covers it), submit its sitemap, and link it from the app.

## Resources

| Resource      | Name                                    | Created by                                   |
| ------------- | --------------------------------------- | -------------------------------------------- |
| Worker        | `rezumi-blog`                           | first deploy                                 |
| D1 database   | `rezumi-blog`                           | first deploy (Wrangler provisions by name)   |
| R2 bucket     | `rezumi-blog-media`                     | first deploy                                 |
| KV namespace  | `SESSION` binding (Astro sessions)      | first deploy                                 |
| Custom domain | `blog.rezumi.app`                       | Cloudflare dashboard, after the first deploy |
| Cron Trigger  | every minute (scheduled posts, upkeep)  | `apps/blog/wrangler.jsonc`                   |
| Workers Cache | enabled by the Astro Cloudflare adapter | build (`cache` in `astro.config.ts`)         |

The Worker has `workers_dev` and preview URLs off, so it answers only on the custom domain: an unfinished setup wizard is never exposed on another address.

## First deploy

1. **Deploy the Worker.** Either run **Actions → Deploy blog → Run workflow** on `main`, or from a machine: `pnpm --filter blog exec wrangler login`, then `pnpm deploy:blog`. For the workflow, the `CLOUDFLARE_API_TOKEN` secret needs account-level **Workers Scripts: Edit**, **D1: Edit**, **Workers R2 Storage: Edit** and **Workers KV Storage: Edit**; the app's deploy may not have needed the last three.
2. **Attach the domain.** Cloudflare dashboard → **Workers & Pages → rezumi-blog → Settings → Domains & Routes → Add → Custom domain** → `blog.rezumi.app`.
3. **Finish setup straight away**, because the first person to complete the wizard becomes the administrator: open `https://blog.rezumi.app/_emdash/admin`, keep **Include sample content** selected (it creates the topics, tags, the Rezumi Team byline and two starter articles in English and Indonesian; without it there are no topics), and register a passkey. Add a second passkey on another device from your account page. Passkeys only work on the domain they were created on. Then open **Bylines → Rezumi Team** and add its Indonesian version (for example "Tim Rezumi"): a byline shows only in the languages it has a version in, so until then Indonesian articles borrow the English credit.
4. **Settings.** General: the Site URL reads `https://blog.rezumi.app` (setup records it; sitemaps and `robots.txt` use it). SEO: Google and Bing verification, optionally a default social image (otherwise the blog's own card in `public/og/` is used) and **Disallow AI training** if wanted. Social: the handles shown in the footer.
5. **Search Console.** Submit `https://blog.rezumi.app/sitemap.xml`.
6. **Automatic deploys.** Repository **Settings → Secrets and variables → Actions → Variables**: `BLOG_AUTO_DEPLOY` = `true`. Pushes to `main` that touch the blog then deploy it.
7. **Link it from the app** (landing footer and docs) once it is live.

## Secrets and email

- `EMDASH_ENCRYPTION_KEY` encrypts plugin settings marked secret. Nothing needs it until a plugin stores a secret; set it before that: `pnpm --filter blog exec emdash secrets generate`, then `pnpm --filter blog exec wrangler secret put EMDASH_ENCRYPTION_KEY`. Keep a copy in the password manager: without it, stored plugin secrets cannot be read.
- No email provider is configured, so sign-in is by passkey and invite links are copied by hand from **Users**. Magic links and emailed invites need the Cloudflare email plugin and a verified sender ([EmDash: Email](https://docs.emdashcms.com/guides/email/)).

## Connect an AI client to the content (MCP)

The site's MCP server, `https://blog.rezumi.app/_emdash/api/mcp`, lets an assistant list, draft, translate, schedule and publish articles, manage topics, tags and media, and read settings. It accepts OAuth (the client registers itself and you approve scopes in the browser) or a personal access token (`ec_pat_…`, created in the admin). A token is limited by both its scopes and the user's role.

- **Claude (web or desktop):** Settings → Connectors → Add custom connector → the URL above, then sign in with your passkey.
- **Claude Code:** `claude mcp add --transport http rezumi-blog https://blog.rezumi.app/_emdash/api/mcp`, then `/mcp` to sign in.
- **Codex:** `codex mcp add rezumi-blog --url https://blog.rezumi.app/_emdash/api/mcp`, then `codex mcp login rezumi-blog`.
- **Local site:** the same with `http://localhost:4321/_emdash/api/mcp` while `pnpm dev:blog` runs.

For routine writing, approve `content:read`, `content:write`, `media:read`, `media:write` and `taxonomies:manage`, and leave `schema:write`, `settings:manage` and `admin` unchecked. For unattended automation, create a separate Author or Editor user and give its token only what the job needs. The editorial routine agents follow is in `apps/blog/AGENTS.md`.

Agents changing the blog's code can also use EmDash's read-only docs server (`claude mcp add --transport http emdash-docs https://docs.emdashcms.com/mcp`) and its skills (`npx skills add emdash-cms/skills`).

## Operations

- **Caching.** Public pages are cached at the edge for up to an hour (`astro.config.ts`). Publishing, unpublishing, deleting and settings or taxonomy edits purge the affected pages within seconds. Purges are rate-limited (5 per minute per account), so during bulk edits a page can lag until its hour runs out. A deploy starts with an empty cache.
- **Scheduled posts** go live from the Cron Trigger. `pnpm --filter blog exec emdash doctor` checks the wiring; `pnpm --filter blog exec wrangler tail` shows each run.
- **Slugs and redirects.** Changing a published slug adds a 301 from the old URL. **Redirects** in the admin manages rules and shows the 404 log.
- **Backups.** Before a risky change, note a D1 Time Travel bookmark (`pnpm --filter blog exec wrangler d1 time-travel info rezumi-blog`) or export SQL (`pnpm --filter blog exec wrangler d1 export rezumi-blog --remote --output blog.sql`), and copy the R2 bucket for media. EmDash's JSON backups (under `backups/` in R2) are for inspection only; they cannot restore a site. See [Backups and recovery](https://docs.emdashcms.com/guides/backups/).
- **Updating EmDash.** `emdash` and `@emdash-cms/cloudflare` share one version; update them together with `npx upgrade-emdash@latest` from `apps/blog` and read the work order it writes to `.emdash/UPGRADE.md`. Core migrations apply on the first request after the deploy.
- **Costs.** Workers Paid (shared with the app). D1, R2 and KV stay within free allowances at blog scale. Image resizing counts as Cloudflare Images transformations: 5,000 unique per month are free.

## Troubleshooting

- **The deploy rejects `cache`.** Workers Cache is not available on the account: remove `cache` and `routeRules` from `astro.config.ts`; pages then render on every request.
- **Passkey sign-in fails.** It was created on another host (for example `localhost`). Sign in where it was made, or add a passkey on this domain.
- **Setup reports `SITE_URL_REQUIRED`.** Only when the build runs outside Workers routing (for example `wrangler dev` on a public address): set `EMDASH_SITE_URL`.
- **A new article does not show.** Check its status is **Published** and its locale matches the URL (`/id/…` for Indonesian). An Indonesian URL whose article has no Indonesian version redirects to the English one.
