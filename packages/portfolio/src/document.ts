import type { PortfolioPage } from "./page";
import { escapeHtml } from "@rezumi/utils/string";

export { PORTFOLIO_PAGE_SCRIPT } from "./script";

export type PortfolioHead = {
	title: string;
	description: string;
	/** The page's one address; search engines are pointed here. */
	canonicalUrl: string;
	indexable: boolean;
	/** The link preview picture (`/cards/<username>.png`). */
	imageUrl?: string | undefined;
	structuredData?: Record<string, unknown> | undefined;
	/** The person's own profiles and website, as `rel="me"` links. */
	meLinks?: readonly string[] | undefined;
};

export type PortfolioDocumentOptions = {
	page: PortfolioPage;
	/** Absent in the editor's preview, which nothing indexes or shares. */
	head?: PortfolioHead | undefined;
};

/** Structured data for search engines, safe inside a `<script>`. */
const jsonLdScript = (data: unknown) =>
	`<script type="application/ld+json">${JSON.stringify(data).replaceAll("<", "\\u003c")}</script>`;

function headTags(head: PortfolioHead | undefined): string {
	if (!head) return "";
	const title = escapeHtml(head.title);
	const description = escapeHtml(head.description);
	const url = escapeHtml(head.canonicalUrl);
	const image = head.imageUrl ? escapeHtml(head.imageUrl) : "";
	return [
		`<title>${title}</title>`,
		`<meta name="description" content="${description}">`,
		`<link rel="canonical" href="${url}">`,
		head.indexable ? "" : `<meta name="robots" content="noindex, follow">`,
		`<meta property="og:type" content="profile">`,
		`<meta property="og:site_name" content="Rezumi">`,
		`<meta property="og:title" content="${title}">`,
		`<meta property="og:description" content="${description}">`,
		`<meta property="og:url" content="${url}">`,
		image
			? `<meta property="og:image" content="${image}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">`
			: "",
		`<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}">`,
		`<meta name="twitter:title" content="${title}">`,
		`<meta name="twitter:description" content="${description}">`,
		image ? `<meta name="twitter:image" content="${image}">` : "",
		...(head.meLinks ?? []).map((link) => `<link rel="me" href="${escapeHtml(link)}">`),
		head.structuredData ? jsonLdScript(head.structuredData) : "",
	].join("");
}

function themeColor(page: PortfolioPage): string {
	const { light, dark } = page.themeColors;
	if (page.scheme === "light") return `<meta name="theme-color" content="${light}">`;
	if (page.scheme === "dark") return `<meta name="theme-color" content="${dark}">`;
	return `<meta name="theme-color" media="(prefers-color-scheme: light)" content="${light}"><meta name="theme-color" media="(prefers-color-scheme: dark)" content="${dark}">`;
}

/** A portfolio's whole page, ready to send: the document around `renderPortfolioPage`'s output. */
export function renderPortfolioDocument({ page, head }: PortfolioDocumentOptions): string {
	const preload = page.preloadFont
		? `<link rel="preload" href="${escapeHtml(page.preloadFont)}" as="font" type="font/ttf" crossorigin>`
		: "";
	return [
		`<!doctype html><html lang="${escapeHtml(page.lang)}" dir="${page.dir}" data-pf-scheme="${page.scheme}">`,
		`<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">`,
		`<link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" href="/favicon.svg" type="image/svg+xml">`,
		headTags(head),
		themeColor(page),
		preload,
		page.head,
		`<style>${page.css}</style></head>`,
		`<body>${page.html}<script>${page.script}</script></body></html>`,
	].join("");
}
