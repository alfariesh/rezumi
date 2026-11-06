import type { AstroUserConfig } from "astro";
import cloudflare from "@astrojs/cloudflare";
import { cacheCloudflare } from "@astrojs/cloudflare/cache";
import react from "@astrojs/react";
import { d1, r2 } from "@emdash-cms/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import emdash from "emdash/astro";
import { defaultLocale, locales } from "./src/i18n/config";
import { SITE_URL } from "./src/lib/site";

/**
 * Public routes are cached at the edge. EmDash purges the collection and entry tags when content is published, so a
 * publish shows within seconds; `maxAge` only bounds how stale a page can get if a purge is rate-limited. `all` is
 * never purged by EmDash: it is the switch for clearing everything at once.
 */
const page = (...tags: string[]) => ({ maxAge: 3600, swr: 86_400, tags: [...tags, "all"] });

type RouteRules = NonNullable<AstroUserConfig["routeRules"]>;

const localizedRules = (prefix: string): RouteRules => ({
	[prefix || "/"]: page("posts"),
	[`${prefix}/[slug]`]: page("posts"),
	[`${prefix}/category/[slug]`]: page("posts"),
	[`${prefix}/tag/[slug]`]: page("posts"),
	[`${prefix}/search`]: page("posts"),
	[`${prefix}/rss.xml`]: page("posts"),
});

export default defineConfig({
	site: SITE_URL,
	output: "server",
	adapter: cloudflare(),
	cache: { provider: cacheCloudflare() },
	routeRules: {
		...Object.assign({}, ...locales.map((locale) => localizedRules(locale === defaultLocale ? "" : `/${locale}`))),
		"/sitemap.xml": page("posts"),
		"/sitemap-[collection].xml": page("posts"),
		"/robots.txt": page("emdash:settings"),
	},
	i18n: { defaultLocale, locales: [...locales] },
	image: { layout: "constrained", responsiveStyles: true },
	integrations: [
		// The EmDash admin is a React app; the public pages ship no React.
		react(),
		emdash({
			database: d1({ binding: "DB", session: "auto", coalesce: true }),
			storage: r2({ binding: "MEDIA" }),
			// Cached pages are the same for everyone; signed-in editors get an Edit pill from a small script instead.
			toolbar: "client",
			admin: {
				siteName: "Rezumi Blog",
				logo: "/icon/light.svg",
				favicon: "/favicon.svg",
				locales: ["en", "id"],
				// The theme renders no comments, menus (the bar lists the topics), widget areas or reusable sections.
				hiddenNavItems: ["comments", "menus", "widgets", "sections"],
			},
		}),
	],
	vite: { plugins: [tailwindcss()] },
	devToolbar: { enabled: false },
});
