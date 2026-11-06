import type { CacheHint, MediaReference, SiteSettings } from "emdash";
import { getSiteSettingsWithCacheHint } from "emdash";
import { DEFAULT_TIMEZONE } from "./dates";

export type BlogSettings = {
	siteTitle: string;
	titleSeparator: string;
	timezone: string;
	/** A logo uploaded in Settings › General replaces the Rezumi logomark in the header. */
	logo: (MediaReference & { url: string }) | null;
	social: NonNullable<SiteSettings["social"]>;
	/** Whether Settings › SEO has a default social image; EmDash then uses it for pages without their own image. */
	hasDefaultSocialImage: boolean;
	cacheHint: CacheHint;
};

/** The site settings the theme reads (Settings in the admin), with the blog's defaults for unset values. */
export async function loadSettings(): Promise<BlogSettings> {
	const { data, cacheHint } = await getSiteSettingsWithCacheHint();
	return {
		siteTitle: data.title?.trim() || "Rezumi Blog",
		titleSeparator: data.seo?.titleSeparator || " | ",
		timezone: data.timezone || DEFAULT_TIMEZONE,
		logo: data.logo?.url ? { ...data.logo, url: data.logo.url } : null,
		social: data.social ?? {},
		hasDefaultSocialImage: Boolean(data.seo?.defaultOgImage?.url),
		cacheHint,
	};
}

/** "Page | Rezumi Blog", or the site title alone. */
export function documentTitle(
	pageTitle: string | undefined,
	settings: Pick<BlogSettings, "siteTitle" | "titleSeparator">,
) {
	return pageTitle ? `${pageTitle}${settings.titleSeparator}${settings.siteTitle}` : settings.siteTitle;
}
