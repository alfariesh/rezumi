const NAMED_ENTITIES: Record<string, string> = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
	nbsp: " ",
};

function decodeEntities(text: string): string {
	return text.replace(/&(#\d+|#x[\da-f]+|[a-z]+);/gi, (entity, name: string) => {
		if (name.startsWith("#")) {
			const code = name[1] === "x" || name[1] === "X" ? Number.parseInt(name.slice(2), 16) : Number(name.slice(1));
			return Number.isInteger(code) && code > 0 && code <= 0x10_ff_ff ? String.fromCodePoint(code) : entity;
		}
		return NAMED_ENTITIES[name.toLowerCase()] ?? entity;
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

/** Cuts text to `max` characters at a word boundary when one is near, ending with "…". */
export function truncateText(text: string, max: number): string {
	if (text.length <= max) return text;
	const cut = text.slice(0, Math.max(0, max - 1));
	const space = cut.lastIndexOf(" ");
	return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** Escapes text for use inside HTML. */
export function escapeHtmlText(text: string): string {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
