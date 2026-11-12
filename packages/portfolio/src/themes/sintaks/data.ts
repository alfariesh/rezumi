/** Sintaks' pure helpers: the decoration it derives from the person's own text. */

/** 32-bit FNV-1a of text: the same text always gives the same number. */
function fnv1a(text: string): number {
	let hash = 0x81_1c_9d_c5;
	for (let index = 0; index < text.length; index++) {
		hash ^= text.charCodeAt(index);
		hash = Math.imul(hash, 0x01_00_01_93);
	}
	return hash >>> 0;
}

/** A commit's short hash for a resume entry: seven hex digits of its id's FNV-1a, stable across renders. */
export function shortHash(id: string): string {
	return fnv1a(id).toString(16).padStart(8, "0").slice(0, 7);
}

/**
 * A language dot's colour for a tag, picked by the tag's hash from colours that read as code languages. Decoration
 * beside the tag's name, so it carries no meaning of its own and needs no contrast with its text.
 */
const LANGUAGE_COLORS = [
	"#3178C6",
	"#F1E05A",
	"#00ADD8",
	"#DEA584",
	"#3572A5",
	"#E34C26",
	"#8957E5",
	"#89E051",
	"#F34B7D",
	"#2BBC8A",
] as const;

export function languageColor(tag: string): string {
	return LANGUAGE_COLORS[fnv1a(tag.trim().toLowerCase()) % LANGUAGE_COLORS.length] as string;
}

/** The user in the terminal's title (`raka@portfolio`): the name's first word in lower case, letters and digits only. */
export function terminalUser(name: string): string {
	const first = name.trim().split(/\s+/)[0] ?? "";
	const user = [...first.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")].slice(0, 16).join("");
	return user || "guest";
}
