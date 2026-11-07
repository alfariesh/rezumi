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
		if (!name.startsWith("#")) {
			const key = name.toLowerCase();
			// Own keys only: `&constructor;` is text, not Object's constructor.
			return Object.hasOwn(NAMED_ENTITIES, key) ? (NAMED_ENTITIES[key] as string) : entity;
		}
		const code = /^#x/i.test(name) ? Number.parseInt(name.slice(2), 16) : Number.parseInt(name.slice(1), 10);
		return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : entity;
	});
}

/**
 * Raw text kept from one value before it's cleaned: far more than a card shows (tags and entities shrink it), and a
 * page can't make cleaning slow with a megabyte-long attribute.
 */
const MAX_RAW_VALUE = 16 * 1024;

/** Text as people read it: entities decoded, tags and control characters gone, whitespace collapsed. */
function cleanText(value: string): string {
	const decoded = decodeEntities(value.slice(0, MAX_RAW_VALUE).replace(/<[^<>]*>/g, " "));
	// Control characters (a decoded &#7;, a stray byte) become spaces; whitespace then collapses.
	const printable = Array.from(decoded, (character) => {
		const code = character.codePointAt(0) ?? 0;
		return code < 0x20 || code === 0x7f ? " " : character;
	}).join("");
	return printable.replace(/\s+/g, " ").trim();
}

function absoluteHttpUrl(value: string, base: URL): string | undefined {
	// Entities can only shorten an address; one this long can't fit once decoded either.
	if (value.length > PORTFOLIO_LIMITS.text.url * 10) return undefined;
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

/**
 * How far a page is read. The head is read to its end wherever that is; after it, tags are read only this many
 * characters further (some sites stream their meta tags into the start of the body, after a head that may itself be
 * long). Past both, a page has nothing a preview needs.
 */
export const LINK_META_SCAN_CHARACTERS = 128 * 1024;

/**
 * Elements whose content is text up to their own end tag, never markup: a `<meta>` written inside a script or a
 * comment-like template isn't one. `title` is read the same way, and kept while the head lasts.
 */
const TEXT_ELEMENTS = new Set([
	"script",
	"style",
	"template",
	"noscript",
	"textarea",
	"title",
	"xmp",
	"iframe",
	"noembed",
	"noframes",
]);

const isSpace = (code: number) => code === 0x20 || code === 0x09 || code === 0x0a || code === 0x0c || code === 0x0d;
const isLetter = (code: number) => (code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a);

type Tag = { name: string; closing: boolean; attributes: Map<string, string>; end: number };

/**
 * Reads the tag that starts at `start` (`<name` or `</name`), the way browsers tokenize one: quotes only after `=`, so
 * a stray quote never swallows the rest of the page. Null when the page ends inside it. Each character is looked at
 * once, so the whole page reads in time proportional to its length, however it's written.
 */
function readTag(html: string, start: number): Tag | null {
	const { length } = html;
	let at = start + 1;
	const closing = html.charCodeAt(at) === 0x2f;
	if (closing) at++;
	const nameStart = at;
	while (at < length) {
		const code = html.charCodeAt(at);
		if (isSpace(code) || code === 0x2f || code === 0x3e) break;
		at++;
	}
	const name = html.slice(nameStart, at).toLowerCase();
	const attributes = new Map<string, string>();
	for (;;) {
		while (at < length && isSpace(html.charCodeAt(at))) at++;
		if (at >= length) return null;
		const code = html.charCodeAt(at);
		if (code === 0x3e) return { name, closing, attributes, end: at + 1 };
		if (code === 0x2f) {
			at++;
			continue;
		}
		// The name runs to a space, `/`, `>` or `=`; a leading `=` belongs to it.
		const attributeStart = at++;
		while (at < length) {
			const next = html.charCodeAt(at);
			if (isSpace(next) || next === 0x2f || next === 0x3e || next === 0x3d) break;
			at++;
		}
		const attribute = html.slice(attributeStart, at).toLowerCase();
		while (at < length && isSpace(html.charCodeAt(at))) at++;
		let value = "";
		if (html.charCodeAt(at) === 0x3d) {
			at++;
			while (at < length && isSpace(html.charCodeAt(at))) at++;
			if (at >= length) return null;
			const quote = html.charCodeAt(at);
			if (quote === 0x22 || quote === 0x27) {
				const close = html.indexOf(html[at] as string, at + 1);
				if (close < 0) return null;
				value = html.slice(at + 1, close);
				at = close + 1;
			} else {
				const valueStart = at;
				while (at < length) {
					const next = html.charCodeAt(at);
					if (isSpace(next) || next === 0x3e) break;
					at++;
				}
				value = html.slice(valueStart, at);
			}
		}
		if (!attributes.has(attribute)) attributes.set(attribute, value);
	}
}

/** Where the text of a `name` element ends: the start of `</name` followed by a space, `/` or `>`; -1 if never. */
function textEnd(html: string, name: string, from: number): number {
	for (let at = html.indexOf("</", from); at >= 0; at = html.indexOf("</", at + 2)) {
		const after = html.charCodeAt(at + 2 + name.length);
		if (
			html.slice(at + 2, at + 2 + name.length).toLowerCase() === name &&
			(isSpace(after) || after === 0x2f || after === 0x3e)
		)
			return at;
	}
	return -1;
}

/**
 * The page's meta tags (first value per key) and the head's `<title>` text, read in one pass from the start: comments,
 * doctypes and the text inside scripts, styles and templates are skipped; a tag the page never closes ends the read,
 * as it would in a browser.
 */
function scanPage(html: string): { meta: Map<string, string>; title: string | undefined } {
	const meta = new Map<string, string>();
	let title: string | undefined;
	let inHead = true;
	// Where the head ended; the body is read from there on, up to the limit.
	let bodyStart = 0;
	const { length } = html;
	let at = 0;
	while (at < length) {
		if (!inHead && at >= bodyStart + LINK_META_SCAN_CHARACTERS) break;
		const open = html.indexOf("<", at);
		if (open < 0) break;
		const next = html.charCodeAt(open + 1);
		if (next === 0x21 || next === 0x3f) {
			// `<!-- … -->` (`<!-->` and `<!--->` close at once, as in browsers), or `<!doctype …>` and `<?…>`, to `>`.
			if (html.startsWith("<!--", open)) {
				const close = html.indexOf("-->", open + 2);
				if (close < 0) break;
				at = close + 3;
			} else {
				const close = html.indexOf(">", open + 2);
				if (close < 0) break;
				at = close + 1;
			}
			continue;
		}
		const closing = next === 0x2f;
		if (!isLetter(closing ? html.charCodeAt(open + 2) : next)) {
			// A lone `<` is text.
			at = open + 1;
			continue;
		}
		const tag = readTag(html, open);
		if (!tag) break;
		at = tag.end;
		if (tag.closing) {
			if (tag.name === "head" && inHead) {
				inHead = false;
				bodyStart = at;
			}
			continue;
		}
		if (tag.name === "body") {
			if (inHead) {
				inHead = false;
				bodyStart = at;
			}
		} else if (tag.name === "meta") {
			const key = (tag.attributes.get("property") ?? tag.attributes.get("name") ?? tag.attributes.get("itemprop"))
				?.trim()
				.toLowerCase();
			const content = tag.attributes.get("content");
			if (key && content !== undefined && content.trim() && !meta.has(key)) meta.set(key, content);
		} else if (tag.name === "plaintext") break;
		else if (TEXT_ELEMENTS.has(tag.name)) {
			const end = textEnd(html, tag.name, at);
			if (end < 0) break;
			// Only the head's: a <title> in the body belongs to an SVG icon.
			if (tag.name === "title" && inHead && title === undefined) title = html.slice(at, end);
			at = end;
		}
	}
	return { meta, title };
}

/** Reads a page's title, description, site name and preview picture. `pageUrl` resolves relative addresses. */
export function parseLinkMeta(html: string, pageUrl: URL | string): LinkMeta {
	const base = new URL(pageUrl);
	const { meta, title: titleTag } = scanPage(html);
	const first = (...keys: string[]) => keys.map((key) => meta.get(key)).find((value) => value?.trim());

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
