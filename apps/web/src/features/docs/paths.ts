/**
 * Addresses of the public documentation. The pages are the MDX files in the repository's `docs/` folder, the same ones
 * the hosted docs site publishes; their links are written for that site (`/guides/editor-overview`), so the build
 * rewrites them to these addresses (see `resolveDocsHref`, used by `./build.ts`). This module runs in the browser and
 * in the build, so it stays free of both.
 */

/** Where the docs live in the app. */
export const DOCS_BASE = "/docs";

/** The page `/docs` shows: the introduction. */
export const DOCS_HOME = "getting-started";

/** The hosted docs site the content is written for. Pages it has that the app does not (the API reference) stay there. */
const DOCS_SITE = "https://docs.rezumi.app";

/** The hosted app the content links to; in the app those links stay on the instance serving the docs. */
const APP_SITE = "https://rezumi.app";

/** The address of a docs page in the app. */
export const docsPath = (slug: string) => (slug === DOCS_HOME ? DOCS_BASE : `${DOCS_BASE}/${slug}`);

type DocsRoutes = {
	/** Every published page's slug, such as `guides/editor-overview`. */
	slugs: ReadonlySet<string>;
	/** Old slugs and the page each moved to. */
	redirects: Readonly<Record<string, string>>;
};

/** A link resolved for the app, and whether its target exists (an unknown docs page is reported by the build). */
type ResolvedHref = { href: string; known: boolean };

const splitHash = (href: string) => {
	const index = href.search(/[?#]/);
	return index === -1 ? [href, ""] : [href.slice(0, index), href.slice(index)];
};

/** The page a slug names, following a redirect, or undefined. */
export function resolveDocsSlug(slug: string, routes: DocsRoutes) {
	const normalized = slug.replace(/^\/+|\/+$/g, "");
	if (normalized === "") return DOCS_HOME;
	if (routes.slugs.has(normalized)) return normalized;
	const target = routes.redirects[normalized];
	return target !== undefined && routes.slugs.has(target) ? target : undefined;
}

/**
 * Rewrites a link written for the hosted docs site for the app: a page of the docs (`/guides/x#step`, or the same on
 * `docs.rezumi.app`) moves under `/docs`, a link to `rezumi.app` becomes a path on the current instance, and anything
 * else stays as written. Returns undefined for links that need no change.
 */
export function resolveDocsHref(href: string, routes: DocsRoutes): ResolvedHref | undefined {
	if (href.startsWith(`${DOCS_SITE}/`) || href === DOCS_SITE)
		return resolveDocsHref(href.slice(DOCS_SITE.length) || "/", routes);
	if (href.startsWith(`${APP_SITE}/`) || href === APP_SITE)
		return { href: href.slice(APP_SITE.length) || "/", known: true };
	if (!href.startsWith("/") || href.startsWith("//")) return undefined;

	const [path = "", suffix = ""] = splitHash(href);
	const slug = resolveDocsSlug(path, routes);
	if (slug !== undefined) return { href: `${docsPath(slug)}${suffix}`, known: true };
	// The API reference is generated from the OpenAPI document by the hosted docs site.
	if (path === "/api-reference" || path.startsWith("/api-reference/"))
		return { href: `${DOCS_SITE}${href}`, known: true };
	return { href: `${DOCS_SITE}${href}`, known: false };
}
