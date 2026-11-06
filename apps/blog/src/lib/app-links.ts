import type { Locale } from "../i18n/config";
import { defaultLocale } from "../i18n/config";
import { APP_URL } from "./site";

/** Pages of the Rezumi app the blog links to. */
const APP_PATHS = {
	home: "/",
	register: "/auth/register",
	"ats-checker": "/ats-checker",
	templates: "/resume-templates",
	features: "/#features",
	pricing: "/#pricing",
} as const;

export type AppDestination = keyof typeof APP_PATHS;

/** Where on the blog a link sits; it becomes `utm_content`, so signups can be traced to the placement. */
export type AppLinkPlacement = "header" | "post" | "closing" | "footer" | "article";

/** The app's `?locale=` value for each blog locale (see `localizedUrl` in packages/utils/src/locale.ts). */
const APP_LOCALES: Record<Locale, string> = { en: "en-US", id: "id-ID" };

type AppLinkOptions = {
	locale: Locale;
	placement: AppLinkPlacement;
	/** The article or page that sent the reader, as `utm_campaign`. */
	campaign?: string | undefined;
};

/**
 * A link into the Rezumi app, in the reader's language and tagged for attribution: `utm_source=blog`,
 * `utm_medium=referral`, the placement as `utm_content` and the article as `utm_campaign`.
 */
export function appLink(destination: AppDestination, { locale, placement, campaign }: AppLinkOptions): string {
	const url = new URL(APP_PATHS[destination], APP_URL);
	if (locale !== defaultLocale) url.searchParams.set("locale", APP_LOCALES[locale]);
	url.searchParams.set("utm_source", "blog");
	url.searchParams.set("utm_medium", "referral");
	url.searchParams.set("utm_campaign", campaign ?? "blog");
	url.searchParams.set("utm_content", placement);
	return url.href;
}
