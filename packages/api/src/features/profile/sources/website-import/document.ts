import type { HTMLElement } from "node-html-parser";
import { parse } from "node-html-parser";
import { embedPageUrl, parseEmbedUrl } from "@rezumi/schema/portfolio/embed";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { parseVideoUrl } from "@rezumi/schema/portfolio/video";

/**
 * What one page of a person's site offers an import (`02-teknis.md` section 3): its links, its pictures and the
 * videos or embeds it shows, read from the HTML the page reader returned. Pure: the same HTML always gives the same
 * result. Nothing here is fetched; pictures are only addresses until a work is saved.
 */

export type SiteLink = { url: string; text: string };

type SiteImage = {
	url: string;
	alt: string;
	width: number | null;
	height: number | null;
	/** A few words near the picture (its caption or the closest heading), to help tell a screenshot from a logo. */
	context: string;
};

export type SiteDocument = {
	title: string;
	/** Links to other pages of the same site, absolute, without fragments, home page and files left out. */
	pages: SiteLink[];
	/** Links to other sites (a live product, a store, a repository). */
	external: SiteLink[];
	images: SiteImage[];
	/** Video and embed pages the portfolio can show, as their canonical page addresses. */
	embeds: string[];
};

const MAX_LINKS = 300;
const MAX_IMAGES = 60;
const MAX_EMBEDS = 8;
const MAX_LINK_TEXT = 120;
const MAX_CONTEXT = 120;
/** Pictures this small are icons, avatars in a footer or tracking pixels, never a work's picture. */
const MIN_IMAGE_SIDE = 200;

/** Files a link can point to that are never a page about a work. */
const FILE_EXTENSION =
	/\.(?:pdf|zip|rar|7z|gz|dmg|exe|apk|png|jpe?g|gif|webp|avif|svg|ico|mp4|mov|webm|mp3|wav|css|js|json|xml|txt|rss|atom)$/i;

const clean = (text: string, max: number) => text.replace(/\s+/g, " ").trim().slice(0, max);

const bareHost = (host: string) => host.toLowerCase().replace(/^www\./, "");

/** Whether `url` is on the same site as `home`: the same host, with or without www., or one of its subdomains. */
export function isSameSite(url: URL, home: URL): boolean {
	const host = bareHost(url.hostname);
	const site = bareHost(home.hostname);
	return host === site || host.endsWith(`.${site}`);
}

/**
 * The address an import reads for a link: https (personal sites that answer on http almost always answer on https),
 * no fragment, no tracking query, no trailing slash past the root. Null for anything that isn't a web address.
 */
export function pageAddress(href: string, base: URL): URL | null {
	const value = href.trim();
	if (!value || value.length > PORTFOLIO_LIMITS.text.url || /^(?:mailto|tel|javascript|data|sms):/i.test(value))
		return null;
	let url: URL;
	try {
		url = new URL(value, base);
	} catch {
		return null;
	}
	if (url.protocol !== "https:" && url.protocol !== "http:") return null;
	if (url.username || url.password) return null;
	url.protocol = "https:";
	url.hash = "";
	// A copy of the keys: deleting from the live list while walking it would skip some.
	for (const key of Array.from(url.searchParams.keys()))
		if (/^(?:utm_|fbclid$|gclid$|ref$|mc_)/i.test(key)) url.searchParams.delete(key);
	if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "") || "/";
	return url;
}

const isHome = (url: URL) => url.pathname === "/" && !url.search;

const numberAttribute = (value: string | undefined) => {
	const number = Number.parseInt(value ?? "", 10);
	return Number.isFinite(number) && number > 0 && number < 100_000 ? number : null;
};

/**
 * The candidates of a `srcset` as the HTML spec splits them: an address runs to the next whitespace (so a comma inside
 * it stays), its descriptor to the next comma. Framer writes them without a space after the comma.
 */
function srcsetCandidates(srcset: string): { url: string; descriptor: string }[] {
	const candidates: { url: string; descriptor: string }[] = [];
	let at = 0;
	while (at < srcset.length && candidates.length < 20) {
		while (at < srcset.length && /[\s,]/.test(srcset[at] ?? "")) at++;
		let start = at;
		while (at < srcset.length && !/\s/.test(srcset[at] ?? "")) at++;
		let url = srcset.slice(start, at);
		let descriptor = "";
		if (url.endsWith(",")) url = url.replace(/,+$/, "");
		else {
			start = at;
			while (at < srcset.length && srcset[at] !== ",") at++;
			descriptor = srcset.slice(start, at).trim();
		}
		if (url) candidates.push({ url, descriptor });
	}
	return candidates;
}

/** The largest candidate of a `srcset` (by width or density) the portfolio keeps whole, as the page wrote it. */
function largestFromSrcset(srcset: string | undefined): string | null {
	if (!srcset) return null;
	let best: { url: string; size: number } | null = null;
	for (const { url, descriptor } of srcsetCandidates(srcset)) {
		const size = Number.parseFloat(descriptor || "1") || 1;
		// Widths past what the portfolio keeps add bytes, not quality: they rank below every smaller one.
		const rank = descriptor.endsWith("w") && size > 2400 ? 1 / size : size;
		if (!best || rank > best.size) best = { url, size: rank };
	}
	return best?.url ?? null;
}

/** A caption or the closest heading before a picture: what the page says it shows. */
function contextOf(element: HTMLElement): string {
	const figure = element.closest("figure");
	const caption = figure?.querySelector("figcaption")?.text;
	if (caption?.trim()) return clean(caption, MAX_CONTEXT);
	let node: HTMLElement | null = element;
	for (let depth = 0; node && depth < 4; depth++, node = node.parentNode as HTMLElement | null) {
		const heading = node.querySelector?.("h1, h2, h3, h4");
		if (heading?.text.trim()) return clean(heading.text, MAX_CONTEXT);
	}
	return "";
}

function canonicalEmbed(href: string): string | null {
	const video = parseVideoUrl(href);
	if (video?.provider === "youtube") return `https://www.youtube.com/watch?v=${video.videoId}`;
	if (video?.provider === "vimeo") return `https://vimeo.com/${video.videoId}${video.hash ? `/${video.hash}` : ""}`;
	const embed = parseEmbedUrl(href);
	return embed ? embedPageUrl(embed) : null;
}

/** The address relative links resolve against: the page's `<base href>` when it is a web address, else the page. */
function baseOf(href: string | undefined, page: URL): URL {
	if (!href) return page;
	try {
		const url = new URL(href, page);
		return url.protocol === "https:" || url.protocol === "http:" ? url : page;
	} catch {
		return page;
	}
}

/** Reads a page's links, pictures and embeds; `pageUrl` is the page's own address after redirects. */
export function readSiteDocument(html: string, pageUrl: string): SiteDocument {
	const base = new URL(pageUrl);
	const root = parse(html, { comment: false, blockTextElements: { script: false, style: false, noscript: false } });
	const linkBase = baseOf(root.querySelector("base[href]")?.getAttribute("href"), base);

	const title = clean(
		root.querySelector('meta[property="og:title"]')?.getAttribute("content") ?? root.querySelector("title")?.text ?? "",
		PORTFOLIO_LIMITS.text.workTitle,
	);

	const pages: SiteLink[] = [];
	const external: SiteLink[] = [];
	const embeds = new Set<string>();
	const seenLinks = new Set<string>([pageAddress(pageUrl, base)?.href ?? pageUrl]);
	for (const anchor of root.querySelectorAll("a[href]")) {
		if (pages.length + external.length >= MAX_LINKS) break;
		const href = anchor.getAttribute("href") ?? "";
		const embed = canonicalEmbed(href);
		if (embed && embeds.size < MAX_EMBEDS) embeds.add(embed);
		const url = pageAddress(href, linkBase);
		if (!url || seenLinks.has(url.href)) continue;
		seenLinks.add(url.href);
		const text = clean(
			anchor.text || anchor.getAttribute("aria-label") || anchor.getAttribute("title") || "",
			MAX_LINK_TEXT,
		);
		if (isSameSite(url, base)) {
			if (!isHome(url) && !FILE_EXTENSION.test(url.pathname)) pages.push({ url: url.href, text });
		} else if (!embed) external.push({ url: url.href, text });
	}
	for (const frame of root.querySelectorAll("iframe[src]")) {
		const embed = canonicalEmbed(frame.getAttribute("src") ?? "");
		if (embed && embeds.size < MAX_EMBEDS) embeds.add(embed);
	}

	const images: SiteImage[] = [];
	const seenImages = new Set<string>();
	const addImage = (src: string | null | undefined, details: Omit<SiteImage, "url">) => {
		if (!src || images.length >= MAX_IMAGES) return;
		if (/^data:/i.test(src.trim())) return;
		const url = pageAddress(src, linkBase);
		// The same picture at another size (`?width=`, `?scale-down-to=`) is the same picture.
		const key = url ? `${url.host}${url.pathname}` : "";
		if (!url || seenImages.has(key)) return;
		if (/\.(?:svg|ico|gif)$/i.test(url.pathname) || /(?:favicon|sprite|pixel|spacer)/i.test(url.pathname)) return;
		const { width, height } = details;
		if ((width !== null && width < MIN_IMAGE_SIDE) || (height !== null && height < MIN_IMAGE_SIDE)) return;
		seenImages.add(key);
		images.push({ url: url.href, ...details });
	};
	const shareImage = root
		.querySelectorAll('meta[property="og:image"], meta[property="og:image:url"], meta[name="twitter:image"]')
		.map((meta) => meta.getAttribute("content"))
		.find(Boolean);
	addImage(shareImage, { alt: "", width: null, height: null, context: "The page's preview picture" });
	for (const picture of root.querySelectorAll("img, picture source")) {
		const isSource = picture.tagName === "SOURCE";
		const src =
			largestFromSrcset(picture.getAttribute("srcset") ?? picture.getAttribute("data-srcset")) ??
			(isSource ? null : (picture.getAttribute("src") ?? picture.getAttribute("data-src")));
		const owner = isSource ? (picture.closest("picture")?.querySelector("img") ?? picture) : picture;
		addImage(src, {
			alt: clean(owner.getAttribute("alt") ?? "", PORTFOLIO_LIMITS.text.alt),
			width: numberAttribute(owner.getAttribute("width")),
			height: numberAttribute(owner.getAttribute("height")),
			context: contextOf(owner),
		});
	}

	return { title, pages, external, images, embeds: [...embeds] };
}

/** Page addresses a sitemap lists on the same site as `home`, at most `max`. Sitemap indexes aren't followed. */
export function readSitemap(xml: string, home: URL, max = 200): string[] {
	const pages: string[] = [];
	const seen = new Set<string>();
	for (const match of xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?([^<\]]+)(?:\]\]>)?\s*<\/loc>/gi)) {
		if (pages.length >= max) break;
		const url = pageAddress(match[1]?.replaceAll("&amp;", "&") ?? "", home);
		if (!url || !isSameSite(url, home) || isHome(url) || FILE_EXTENSION.test(url.pathname) || seen.has(url.href))
			continue;
		seen.add(url.href);
		pages.push(url.href);
	}
	return pages;
}
