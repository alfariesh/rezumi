import type { PortfolioTheme } from "@rezumi/schema/portfolio/themes";
import { PORTFOLIO_QR_UTM_SOURCE } from "@rezumi/schema/portfolio/statistics";

/**
 * Where the business card's QR code leads, and the address printed beside it. The code adds `utm_source=qr`, so the
 * portfolio's statistics show visits from it (`02-teknis.md`, Phase 13 3.2); the printed address has no scheme, no
 * parameter and no trailing slash.
 */
export function businessCardAddress(pageUrl: string): { qr: string; shown: string } {
	const url = new URL(pageUrl);
	url.hash = "";
	url.search = "";
	const shown = `${url.host}${url.pathname}`.replace(/\/+$/, "");
	url.searchParams.set("utm_source", PORTFOLIO_QR_UTM_SOURCE);
	return { qr: url.toString(), shown };
}

/** A file name from a username: letters, digits and dashes only. */
export function cardFileName(username: string, extension: string): string {
	const base =
		username
			.toLowerCase()
			.replace(/[^\da-z-]+/g, "-")
			.replace(/^-+|-+$/g, "") || "portfolio";
	return `${base}-qr.${extension}`;
}

/** The custom domain replaces the short link only while it opens the active portfolio. */
export function portfolioPageUrl(
	origin: string,
	username: string,
	live: boolean,
	domain?: {
		hostname: string;
		stage: string;
		plan: { state: string };
	} | null,
): string {
	return live && domain?.stage === "active" && domain.plan.state !== "redirecting"
		? `https://${domain.hostname}`
		: `${origin}/${encodeURIComponent(username)}`;
}

export function portfolioThemePicture(theme: PortfolioTheme, locale: string) {
	const file = `${locale.split("-")[0] === "id" ? "id/" : ""}${theme}.webp`;
	return { thumb: `/portfolio-themes/thumb/${file}?v=2`, full: `/portfolio-themes/webp/${file}` };
}
