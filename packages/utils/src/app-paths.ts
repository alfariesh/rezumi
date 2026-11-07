/** The signed-in app's sections. On the alias domain (`APP_ALIAS_URL`) they move to `APP_URL`, where sign-in lives. */
export const APP_SECTIONS = ["auth", "dashboard", "builder", "agent"] as const;

/** First path segments the app owns besides its sections: never a username, so never a resume's web page. */
export const RESERVED_SEGMENTS = [
	...APP_SECTIONS,
	"api",
	"mcp",
	".well-known",
	"uploads",
	"templates",
	"ats-checker",
	"resume-templates",
	"docs",
] as const;

/**
 * First path segments `/<username>` can never be, because the app or its server answers them itself
 * (`apps/server/src/http/app.ts`, `static/web.ts`): the segments above, a portfolio's share cards and sitemaps, and the
 * files at the site's root. No new account may take one as its username.
 */
export const RESERVED_PROFILE_SEGMENTS: ReadonlySet<string> = new Set<string>([
	...RESERVED_SEGMENTS,
	"cards",
	"sitemaps",
	"index.html",
	"robots.txt",
	"sitemap.xml",
	"llms.txt",
	"schema.json",
	"openapi.json",
	"_prerender",
	// Files at the root of `apps/web/public`, served before any username's page.
	"apple-touch-icon-180x180.png",
	"favicon.ico",
	"favicon.svg",
	"manifest.webmanifest",
	"maskable-icon-512x512.png",
	"pwa-64x64.png",
	"pwa-192x192.png",
	"pwa-512x512.png",
	"third-party-notices.txt",
]);

/** Whether `pathname` is in one of the signed-in app's sections. */
export const isAppSectionPath = (pathname: string) =>
	APP_SECTIONS.some((section) => pathname === `/${section}` || pathname.startsWith(`/${section}/`));
