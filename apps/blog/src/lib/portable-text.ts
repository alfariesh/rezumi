/**
 * Plain-text helpers over Portable Text, the format of a post's `content` field. Kept structural (no EmDash types) so
 * the functions stay pure and testable.
 */
type Span = { _type?: string; text?: unknown };
type Block = { _type?: string; _key?: string; style?: string; children?: unknown };

const WORDS_PER_MINUTE = 220;

function isTextBlock(block: unknown): block is Block & { children: Span[] } {
	return (
		typeof block === "object" &&
		block !== null &&
		(block as Block)._type === "block" &&
		Array.isArray((block as Block).children)
	);
}

/** The text of one block, its spans joined. */
export function blockText(block: unknown): string {
	if (!isTextBlock(block)) return "";
	return block.children.map((span) => (typeof span.text === "string" ? span.text : "")).join("");
}

/** The text of a whole body, block by block. */
export function plainText(blocks: readonly unknown[] | null | undefined): string {
	return (blocks ?? []).map(blockText).filter(Boolean).join("\n");
}

/** Minutes to read a body at an unhurried pace; never less than one. */
export function readingMinutes(blocks: readonly unknown[] | null | undefined): number {
	const words = plainText(blocks).split(/\s+/).filter(Boolean).length;
	return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

export type HeadingAnchor = { id: string; text: string; level: 2 | 3 };

/** A URL fragment for a heading: lowercase ASCII words joined by hyphens, accents dropped. */
export function slugifyHeading(text: string): string {
	return text
		.normalize("NFKD")
		.replaceAll(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, "-")
		.replaceAll(/^-+|-+$/g, "");
}

/**
 * The body's level 2 and 3 headings with unique anchors, and a copy of the body whose heading blocks carry their
 * anchor (`anchor`), which the PostHeading component renders as the heading's id. The table of contents links to
 * the same ids, so both come from this one pass.
 */
export function anchorHeadings<T>(blocks: readonly T[]): { headings: HeadingAnchor[]; blocks: T[] } {
	const taken = new Set<string>();
	const headings: HeadingAnchor[] = [];
	const anchored = blocks.map((block) => {
		const style = isTextBlock(block) ? block.style : undefined;
		if (style !== "h2" && style !== "h3") return block;
		const text = blockText(block).trim();
		const base = slugifyHeading(text) || "section";
		let id = base;
		for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
		taken.add(id);
		headings.push({ id, text, level: style === "h2" ? 2 : 3 });
		return { ...block, anchor: id };
	});
	return { headings, blocks: anchored };
}
