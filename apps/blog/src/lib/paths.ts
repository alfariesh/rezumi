import type { Locale } from "../i18n/config";
import { defaultLocale, isLocale } from "../i18n/config";
import { SITE_URL } from "./site";

/**
 * Public URLs. The default locale is unprefixed and every other locale lives under `/<locale>`, matching Astro's
 * routing and the `/{slug}` URL pattern of the posts collection (seed/seed.json), which EmDash's sitemaps and hreflang
 * links are built from. Paths carry no trailing slash, except the root.
 */
function localized(locale: Locale, path: string): string {
	if (locale === defaultLocale) return path;
	return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

export const homePath = (locale: Locale) => localized(locale, "/");
export const postPath = (locale: Locale, slug: string) => localized(locale, `/${encodeURIComponent(slug)}`);
export const categoryPath = (locale: Locale, slug: string) =>
	localized(locale, `/category/${encodeURIComponent(slug)}`);
export const tagPath = (locale: Locale, slug: string) => localized(locale, `/tag/${encodeURIComponent(slug)}`);
export const searchPath = (locale: Locale) => localized(locale, "/search");
export const feedPath = (locale: Locale) => localized(locale, "/rss.xml");

/** An absolute URL on the blog's public origin, for canonical links, feeds and structured data. */
export function absoluteUrl(path: string): string {
	return new URL(path, SITE_URL).href;
}

/** The locale a request path belongs to, from its first segment. */
export function localeFromPath(pathname: string): Locale {
	const segment = pathname.split("/")[1];
	return isLocale(segment) ? segment : defaultLocale;
}
