import type { Locale } from "../i18n/config";
import type { APIRoute } from "astro";
import { getEmDashCollection, getSiteSettings } from "emdash";
import { translate } from "../i18n/messages";
import { absoluteUrl, feedPath, homePath, postPath } from "./paths";
import { renderRss } from "./rss";

const FEED_SIZE = 30;

/** The RSS feed of one language's newest articles, served at `/rss.xml` and `/<locale>/rss.xml`. */
export function feedEndpoint(locale: Locale): APIRoute {
	return async (context) => {
		const [settings, posts] = await Promise.all([
			getSiteSettings(),
			getEmDashCollection("posts", { locale, orderBy: { published_at: "desc" }, limit: FEED_SIZE }),
		]);
		if (posts.error) {
			context.cache?.set(false);
			return new Response("The feed is unavailable right now.", { status: 503 });
		}
		context.cache?.set(posts.cacheHint);

		const items = posts.entries.flatMap(({ data }) =>
			data.slug && data.publishedAt
				? [
						{
							title: data.title,
							url: absoluteUrl(postPath(locale, data.slug)),
							description: data.excerpt,
							publishedAt: data.publishedAt,
							categories: (data.terms?.category ?? []).map((term) => term.label),
						},
					]
				: [],
		);

		const body = renderRss({
			title: settings.title ?? "Rezumi Blog",
			description: translate(locale, "meta.homeDescription"),
			link: absoluteUrl(homePath(locale)),
			self: absoluteUrl(feedPath(locale)),
			language: locale,
			items,
		});

		return new Response(body, {
			headers: {
				"Content-Type": "application/rss+xml; charset=utf-8",
				// Readers poll; the edge cache (astro.config.ts) is purged on publish, browsers recheck after 15 minutes.
				"Cache-Control": "public, max-age=900",
			},
		});
	};
}
