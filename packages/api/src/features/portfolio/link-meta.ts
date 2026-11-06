import { truncateText } from "@rezumi/portfolio/text";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";

/**
 * What a page says about itself, read from its HTML without a DOM (`02-teknis.md` section 20): Open Graph and Twitter
 * card tags, `<title>`, and the description meta tag. Pure: the same HTML always gives the same result.
 */
export type LinkMeta = {
	title?: string;
	description?: string;
	siteName?: string;
	/** An absolute http(s) address of the page's preview picture. Only ever shown to the owner as a suggestion. */
	image?: string;
};

const NAMED_ENTITIES: Record<string, string> = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
	nbsp: " ",
	ndash: "–",
	mdash: "—",
	hellip: "…",
	lsquo: "‘",
	rsquo: "’",
	ldquo: "“",
	rdquo: "”",
	laquo: "«",
	raquo: "»",
	middot: "·",
	bull: "•",
	copy: "©",
	reg: "®",
	trade: "™",
};

function decodeEntities(text: string): string {
	return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);?/gi, (entity, name: string) => {
		if (!name.startsWith("#")) return NAMED_ENTITIES[name.toLowerCase()] ?? entity;
		const code = /^#x/i.test(name) ? Number.parseInt(name.slice(2), 16) : Number.parseInt(name.slice(1), 10);
		return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : entity;
	});
}

/** Text as people read it: entities decoded, tags and control characters gone, whitespace collapsed. */
function cleanText(value: string): string {
	const decoded = decodeEntities(value.replace(/<[^<>]*>/g, " "));
	// Control characters (a decoded &#7;, a stray byte) become spaces; whitespace then collapses.
	const printable = Array.from(decoded, (character) => {
		const code = character.codePointAt(0) ?? 0;
		return code < 0x20 || code === 0x7f ? " " : character;
	}).join("");
	return printable.replace(/\s+/g, " ").trim();
}

const ATTRIBUTE = /([^\s"'/=>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<=>`]+)))?/g;

function attributes(source: string): Map<string, string> {
	const result = new Map<string, string>();
	for (const match of source.matchAll(ATTRIBUTE)) {
		const name = match[1]?.toLowerCase();
		if (name && !result.has(name)) result.set(name, match[2] ?? match[3] ?? match[4] ?? "");
	}
	return result;
}

function absoluteHttpUrl(value: string, base: URL): string | undefined {
	const text = decodeEntities(value).trim();
	if (!text || text.length > PORTFOLIO_LIMITS.text.url) return undefined;
	try {
		const url = new URL(text, base);
		if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
		return url.href.length > PORTFOLIO_LIMITS.text.url ? undefined : url.href;
	} catch {
		return undefined;
	}
}

const limited = (value: string | undefined, max: number) => {
	const text = value ? cleanText(value) : "";
	return text ? truncateText(text, max) : undefined;
};

/** Reads a page's title, description, site name and preview picture. `pageUrl` resolves relative addresses. */
export function parseLinkMeta(html: string, pageUrl: URL | string): LinkMeta {
	const base = new URL(pageUrl);
	// Scripts, styles and comments can hold text that looks like tags; templates aren't shown.
	const source = html.replace(
		/<!--[\s\S]*?(?:-->|$)|<(script|style|template|noscript)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi,
		" ",
	);
	const headEnd = source.search(/<\/head\s*>|<body\b/i);
	const head = headEnd >= 0 ? source.slice(0, headEnd) : source;

	const meta = new Map<string, string>();
	for (const match of source.matchAll(/<meta\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi)) {
		const tag = attributes(match[1] ?? "");
		const key = (tag.get("property") ?? tag.get("name") ?? tag.get("itemprop"))?.trim().toLowerCase();
		const content = tag.get("content");
		if (key && content !== undefined && content.trim() && !meta.has(key)) meta.set(key, content);
	}
	const first = (...keys: string[]) => keys.map((key) => meta.get(key)).find((value) => value?.trim());

	// Only the head's: a <title> in the body belongs to an SVG icon.
	const titleTag = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(head)?.[1];

	const { text: max } = PORTFOLIO_LIMITS;
	const result: LinkMeta = {};
	const title = limited(first("og:title", "twitter:title") ?? titleTag, max.linkTitle);
	const description = limited(first("og:description", "twitter:description", "description"), max.linkDescription);
	const siteName = limited(first("og:site_name", "application-name"), max.siteName);
	const imageValue = ["og:image", "og:image:url", "og:image:secure_url", "twitter:image", "twitter:image:src"]
		.map((key) => meta.get(key))
		.map((value) => (value ? absoluteHttpUrl(value, base) : undefined))
		.find(Boolean);
	if (title) result.title = title;
	if (description) result.description = description;
	if (siteName) result.siteName = siteName;
	if (imageValue) result.image = imageValue;
	return result;
}

/** The character set a page declares in its first bytes (`<meta charset>` or the http-equiv form), if any. */
function declaredCharset(bytes: Uint8Array): string | undefined {
	// Byte by byte: every runtime decodes it, and the tag itself is ASCII whatever the page's encoding.
	const start = String.fromCharCode(...bytes.subarray(0, 4096));
	return /<meta\b[^>]*charset\s*=\s*["']?\s*([\w:.-]+)/i.exec(start)?.[1]?.toLowerCase();
}

/** Page bytes as text, in the declared character set when this runtime knows it, else UTF-8. */
export function decodePage(bytes: Uint8Array, contentTypeHeader: string | null): string {
	const fromHeader = /charset\s*=\s*["']?([\w:.-]+)/i.exec(contentTypeHeader ?? "")?.[1];
	const label = (fromHeader ?? declaredCharset(bytes) ?? "utf-8").toLowerCase();
	try {
		return new TextDecoder(label).decode(bytes);
	} catch {
		return new TextDecoder("utf-8").decode(bytes);
	}
}
