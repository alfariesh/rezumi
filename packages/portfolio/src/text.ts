const NAMED_ENTITIES = new Map([
	["amp", "&"],
	["lt", "<"],
	["gt", ">"],
	["quot", '"'],
	["apos", "'"],
	["nbsp", " "],
]);

function decodeEntities(text: string): string {
	return text.replace(/&(#\d+|#x[\da-f]+|[a-z]+);/gi, (entity, name: string) => {
		if (name.startsWith("#")) {
			const code = name[1] === "x" || name[1] === "X" ? Number.parseInt(name.slice(2), 16) : Number(name.slice(1));
			if (!Number.isInteger(code) || code <= 0 || code > 0x10_ff_ff) return entity;
			// Half of a UTF-16 pair isn't a character: HTML reads one as the replacement character (U+FFFD).
			return String.fromCodePoint(code >= 0xd8_00 && code <= 0xdf_ff ? 0xff_fd : code);
		}
		return NAMED_ENTITIES.get(name.toLowerCase()) ?? entity;
	});
}

/** The readable text of an HTML fragment: blocks and line breaks become spaces, entities are decoded. */
export function htmlToText(html: string): string {
	return decodeEntities(
		html
			.replace(/<(?:br|\/p|\/li|\/h[1-6]|\/blockquote|\/div)\b[^>]*>/gi, " ")
			.replace(/<[^<>]*>/g, "")
			.replace(/[<>]/g, ""),
	)
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * The first `max` UTF-16 units of `text`, without splitting a character that takes two of them (most emoji): half of
 * one isn't valid text, and the database refuses JSON that holds it.
 */
export function cutText(text: string, max: number): string {
	const cut = text.slice(0, Math.max(0, max));
	const last = cut.charCodeAt(cut.length - 1);
	return last >= 0xd8_00 && last <= 0xdb_ff ? cut.slice(0, -1) : cut;
}

const graphemes =
	typeof Intl.Segmenter === "function" ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;

/**
 * The longest start of `text` within `max` UTF-16 units that ends between two letters as readers see them (graphemes):
 * an emoji sequence, a letter with its accents or an Indic conjunct is kept whole or left out whole.
 */
function cutGraphemes(text: string, max: number): string {
	if (!graphemes) return cutText(text, max);
	let end = 0;
	for (const { segment } of graphemes.segment(text)) {
		if (end + segment.length > max) break;
		end += segment.length;
	}
	return text.slice(0, end);
}

/** Cuts text to `max` characters at a word boundary when one is near, ending with "…". Letters stay whole. */
export function truncateText(text: string, max: number): string {
	if (text.length <= max) return text;
	const cut = cutGraphemes(text, max - 1);
	const space = cut.lastIndexOf(" ");
	return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** Escapes text for use inside HTML. */
export function escapeHtmlText(text: string): string {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
