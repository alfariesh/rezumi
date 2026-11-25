import type { ResumeData } from "@rezumi/schema/resume/data";
import { produce } from "immer";
import { escapeHtml, fnv1a } from "@rezumi/utils/string";

/**
 * Suggested edits to a document's text, shared by Check, the assistant and Improve. A proposal replaces one passage
 * (a whole `<p>` or `<li>` block) of a rich-text field and is never applied until accepted.
 */

/** A field that holds rich text: the summary's content, an entry's description, or a letter's body. */
export type ProposalTarget = { sectionId: string; itemId?: string; roleId?: string; field: string };

type ProposalSource = "check" | "assistant" | "improve";

export type Proposal = {
	id: string;
	target: ProposalTarget;
	/** Where it lands, for people: "Experience · Studio Kettle · bullet 1". */
	location: string;
	/** The passage as it is now: a whole `<p>` or `<li>` block, exactly as stored in the field. */
	before: string;
	/** The block to put in its place. An addition keeps `before` and adds the new block after it. */
	after: string;
	/** One line on why. */
	why: string;
	status: "pending" | "accepted" | "rejected";
	source: ProposalSource;
};

/** Out of date is not stored: it's whenever the passage is no longer in the field. */
export type ProposalState = Proposal["status"] | "stale";

/** The section id a letter's body goes by, so letters share the proposal shape. */
export const LETTER_SECTION_ID = "letter";

type Entry = { id: string } & Record<string, unknown>;

function findEntry(data: ResumeData, { sectionId, itemId, roleId }: ProposalTarget): Entry | undefined {
	const builtin = (data.sections as Record<string, { items: Entry[] } | undefined>)[sectionId];
	const items = builtin?.items ?? data.customSections.find((section) => section.id === sectionId)?.items;
	const entry = (items as Entry[] | undefined)?.find((entry) => entry.id === itemId);
	return roleId
		? Array.isArray(entry?.roles)
			? (entry.roles as Entry[]).find((role) => role.id === roleId)
			: undefined
		: entry;
}

export function readTarget(data: ResumeData, target: ProposalTarget): string | undefined {
	if (!target.itemId)
		return target.sectionId === "summary" && target.field === "content" ? data.summary.content : undefined;

	const value = findEntry(data, target)?.[target.field];
	return typeof value === "string" ? value : undefined;
}

export function writeTarget(draft: ResumeData, target: ProposalTarget, value: string) {
	if (!target.itemId) {
		if (target.sectionId === "summary" && target.field === "content") draft.summary.content = value;
		return;
	}

	const entry = findEntry(draft, target);
	if (entry) entry[target.field] = value;
}

// A tag, or a run of text up to the next one. A stray "<" that opens no tag is text.
const HTML_TOKEN = /<[^<>]*>|[^<]+|</g;
const TAG_PARTS = /^<\s*(\/?)\s*([a-z][\w-]*)([\s\S]*?)\/?\s*>$/i;
const ATTRIBUTE = /([^\s=/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

const escapeText = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/** Text as one spelling: entities decoded (bar `&`, `<` and `>`), whitespace (no-break spaces too) collapsed. */
const canonicalText = (text: string) => {
	const spelled = escapeText(decodeEntities(text)).replace(/\s+/g, " ");
	// Whitespace between tags (`</p>\n<p>`) is layout, not words.
	return spelled === " " ? "" : spelled;
};

const canonicalStyle = (style: string) =>
	style
		.split(";")
		.map((rule) => rule.replace(/\s*:\s*/, ":").trim())
		.filter(Boolean)
		.join(";");

function canonicalTag(tag: string) {
	const parts = TAG_PARTS.exec(tag);
	if (!parts) return tag;
	const name = (parts[2] ?? "").toLowerCase();
	if (parts[1]) return `</${name}>`;

	const attributes = [...(parts[3] ?? "").matchAll(ATTRIBUTE)].map((match) => {
		const attribute = (match[1] ?? "").toLowerCase();
		const raw = match[2] ?? match[3] ?? match[4];
		if (raw === undefined) return attribute;
		const value = decodeEntities(raw);
		return `${attribute}="${escapeText(attribute === "style" ? canonicalStyle(value) : value.trim())}"`;
	});
	return `<${[name, ...attributes].join(" ")}>`;
}

/**
 * HTML in one spelling, with where each tag starts and ends in the original. The server's sanitizer and the browser's
 * editor write the same passage differently (`&#39;` or `'`, `&nbsp;` or a no-break space, `<br>` or `<br />`,
 * `text-align: center;` or `text-align:center`); words and tags still count, so changed text or formatting differs.
 */
function canonicalize(html: string) {
	let text = "";
	// Canonical offset → original offset, at the start and end of each tag (a match starts and ends on a tag).
	const starts = new Map<number, number>();
	const ends = new Map<number, number>();

	for (const match of html.matchAll(HTML_TOKEN)) {
		const token = match[0];
		const tag = token.length > 1 && token.startsWith("<");
		const spelled = tag ? canonicalTag(token) : canonicalText(token);
		if (!spelled) continue;
		if (tag) starts.set(text.length, match.index);
		text += spelled;
		if (tag) ends.set(text.length, match.index + token.length);
	}

	return { text, starts, ends };
}

/** HTML in one spelling, for comparing passages however they were written. */
export const canonicalHtml = (html: string) => canonicalize(html).text;

/**
 * Where a passage (whole blocks of HTML) sits in a field: once, word for word or spelled differently. `undefined`
 * when it's gone or appears more than once.
 */
function findPassage(value: string, html: string): { start: number; end: number } | undefined {
	const index = value.indexOf(html);
	if (index >= 0 && value.indexOf(html, index + 1) >= 0) return undefined;

	// Once, however it's spelled: the same paragraph written two ways is still a repeat.
	const passage = canonicalHtml(html);
	if (!passage) return undefined;
	const field = canonicalize(value);
	const at = field.text.indexOf(passage);
	if (at < 0 || field.text.indexOf(passage, at + 1) >= 0) return undefined;
	if (index >= 0) return { start: index, end: index + html.length };

	const start = field.starts.get(at);
	const end = field.ends.get(at + passage.length);
	return start === undefined || end === undefined ? undefined : { start, end };
}

/** Whether the field holds this HTML, however it's spelled. */
const holds = (value: string, html: string) =>
	value.includes(html) || canonicalHtml(value).includes(canonicalHtml(html));

/**
 * A pending proposal can be applied only while its passage is still in the text, word for word. Spelling isn't
 * wording: the letter the editor holds and the one the server sanitized and stored may write it differently.
 */
export function canApplyTo(value: string | undefined, { before }: Pick<Proposal, "before">) {
	if (value === undefined) return false;
	if (!before) return value === "";
	return findPassage(value, before) !== undefined;
}

export const canApply = (data: ResumeData, proposal: Proposal) =>
	canApplyTo(readTarget(data, proposal.target), proposal);

/**
 * What a proposal shows as, given the text it targets. Pending ones whose passage has changed are out of date;
 * accepted ones whose edit was undone (the passage is back, the new text gone) are pending again.
 */
export function getStateIn(value: string, proposal: Proposal): ProposalState {
	if (proposal.status === "rejected") return "rejected";
	if (proposal.status === "accepted")
		return canApplyTo(value, proposal) && !holds(value, proposal.after) ? "pending" : "accepted";
	return canApplyTo(value, proposal) ? "pending" : "stale";
}

export const getProposalState = (data: ResumeData, proposal: Proposal): ProposalState =>
	getStateIn(readTarget(data, proposal.target) ?? "", proposal);

/** The text with `after` in place of `before`, or `undefined` when the proposal is out of date. */
export function applyTo(value: string | undefined, proposal: Pick<Proposal, "before" | "after">) {
	if (value === undefined) return undefined;
	if (!proposal.before) return value === "" ? proposal.after : undefined;
	const found = findPassage(value, proposal.before);
	if (!found) return undefined;
	// Replaces the passage as this field spells it.
	return `${value.slice(0, found.start)}${proposal.after}${value.slice(found.end)}`;
}

/** Puts `after` in place of `before`. Returns false (changing nothing) when the proposal is out of date. */
export function applyProposal(draft: ResumeData, proposal: Proposal): boolean {
	const next = applyTo(readTarget(draft, proposal.target), proposal);
	if (next === undefined) return false;
	writeTarget(draft, proposal.target, next);
	return true;
}

const BLOCK = /^(<(p|li)(?:\s[^>]*)?>)([\s\S]*)(<\/\2>)$/i;

/** A block's opening tag, contents and closing tag; `undefined` for anything else. */
export function splitBlock(html: string) {
	const match = BLOCK.exec(html);
	return match ? { open: match[1] ?? "", inner: match[3] ?? "", close: match[4] ?? "" } : undefined;
}

/**
 * The block with its text replaced by plain text (a model's rewrite), keeping the tag and its attributes. An empty
 * field's "block" becomes a paragraph.
 */
export function replaceBlockText(block: string, text: string): string {
	const html = escapeHtml(text.trim().replace(/\s+/g, " "));
	const parts = splitBlock(block);
	if (parts) return `${parts.open}${html}${parts.close}`;
	return block === "" ? `<p>${html}</p>` : html;
}

/**
 * An addition after a passage, as a replacement: the passage (with its list item's end, for a bullet) stays, and a
 * new block of the same kind follows it, so a new bullet lands as its own list item.
 */
export function additionAfter(value: string, passageHtml: string, text: string) {
	const found = passageHtml ? findPassage(value, passageHtml) : value === "" ? { start: 0, end: 0 } : undefined;
	if (!found) return undefined;
	// The passage as this field spells it.
	const passage = value.slice(found.start, found.end);

	const block = replaceBlockText(passage, text);
	const closing = /^\s*<\/li>/i.exec(value.slice(found.end));
	if (!closing) return { before: passage, after: `${passage}${block}` };

	const before = `${passage}${closing[0]}`;
	return { before, after: `${before}<li>${block}</li>` };
}

// A paragraph or list item with no paragraph or list item inside it: `<li><p>…</p></li>` yields the `<p>`.
const LEAF_BLOCK = /<(p|li)(?:\s[^>]*)?>((?:(?!<\/?(?:p|li)[\s>])[\s\S])*?)<\/\1>/gi;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

const decodeEntities = (text: string) =>
	text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
		if (name.startsWith("#")) {
			const code = /^#x/i.test(name) ? Number.parseInt(name.slice(2), 16) : Number.parseInt(name.slice(1), 10);
			// Out of range (`&#99999999;`) stays as written instead of throwing.
			return code <= 0x10ffff ? String.fromCodePoint(code) : entity;
		}
		return ENTITIES[name.toLowerCase()] ?? entity;
	});

/** The visible text of some HTML, on one line. */
export const blockText = (html: string) =>
	// `[^<>]` stops a run of unclosed `<` from rescanning to the end once per bracket.
	decodeEntities(html.replace(/<[^<>]*>/g, ""))
		.replace(/\s+/g, " ")
		.trim();

export type Block = { html: string; text: string; bullet: boolean };

/** The leaf paragraphs and list items of rich text, in order, skipping empty ones. */
export function splitBlocks(html: string): Block[] {
	const blocks: Block[] = [];
	let scannedTo = 0;
	let listDepth = 0;

	for (const match of html.matchAll(LEAF_BLOCK)) {
		const text = blockText(match[2] ?? "");
		if (!text) continue;

		// Inside a list when more <li> have opened than closed before this block.
		const preceding = html.slice(scannedTo, match.index);
		const opened = preceding.match(/<li[\s>]/gi)?.length ?? 0;
		const closed = preceding.match(/<\/li>/gi)?.length ?? 0;
		listDepth += opened - closed;
		scannedTo = match.index;
		blocks.push({ html: match[0], text, bullet: match[1]?.toLowerCase() === "li" || listDepth > 0 });
	}

	return blocks;
}

/** A bullet or paragraph an edit can target, with where it sits. */
export type Passage = {
	/** Derived from where the passage is and what it says, so an edit made against older text can't land. */
	id: string;
	target: ProposalTarget;
	/** "Experience · Studio Kettle · bullet 1". */
	location: string;
	/** The whole block (`<p>…</p>` or `<li>…</li>`) exactly as stored, so a proposal can find it again. */
	html: string;
	text: string;
};

export type PassageLabels = {
	/** Also list an empty (visible) summary or letter body, so something can be written into it. */
	includeEmpty?: boolean;
	summary: string;
	sectionTitle: (sectionId: string) => string;
	/** The entry as people know it: its company, school or name. */
	entryTitle: (sectionType: string, entry: Record<string, unknown>) => string;
	bullet: (n: number) => string;
	paragraph: (n: number) => string;
};

// FNV-1a: short and stable. The text is part of the key, so ids never outlive the words they name.
const hash = (value: string) => fnv1a(value).toString(36);

function passagesOf(
	html: string,
	target: ProposalTarget,
	where: string[],
	labels: Pick<PassageLabels, "bullet" | "paragraph" | "includeEmpty">,
	seen: Map<string, number>,
): Passage[] {
	let bullets = 0;
	let paragraphs = 0;
	const blocks = splitBlocks(html);

	// An empty field is one empty passage, written into by replacing "".
	if (blocks.length === 0 && labels.includeEmpty && !html.trim()) {
		return [
			{
				id: `p_${hash(`${target.sectionId}|${target.itemId ?? ""}|${target.roleId ?? ""}|${target.field}|`)}`,
				target,
				location: where.join(" · "),
				html: "",
				text: "",
			},
		];
	}

	return blocks.map((block) => {
		const place = block.bullet ? labels.bullet(++bullets) : labels.paragraph(++paragraphs);
		const base = `p_${hash(`${target.sectionId}|${target.itemId ?? ""}|${target.roleId ?? ""}|${target.field}|${block.text}`)}`;
		const count = (seen.get(base) ?? 0) + 1;
		seen.set(base, count);
		return {
			id: count === 1 ? base : `${base}_${count}`,
			target,
			location: [...where, place].join(" · "),
			html: block.html,
			text: block.text,
		};
	});
}

/**
 * Every passage an edit can target, in page order: the summary's paragraphs, then each visible entry's description,
 * section by section. Hidden sections and entries don't print, so they're left out.
 */
export function collectPassages(data: ResumeData, labels: PassageLabels): Passage[] {
	const seen = new Map<string, number>();
	const passages: Passage[] = [];

	if (!data.summary.hidden)
		passages.push(
			...passagesOf(data.summary.content, { sectionId: "summary", field: "content" }, [labels.summary], labels, seen),
		);

	type Section = { id: string; type: string; hidden: boolean; items: Entry[] };
	const sections: Section[] = [
		...Object.entries(data.sections).map(([id, section]) => ({
			id,
			type: id,
			hidden: section.hidden,
			items: section.items as unknown as Entry[],
		})),
		...data.customSections.map((section) => ({
			id: section.id,
			type: section.type as string,
			hidden: section.hidden,
			items: section.items as unknown as Entry[],
		})),
	];

	for (const section of sections) {
		if (section.hidden || section.type === "cover-letter") continue;

		for (const entry of section.items) {
			if (entry.hidden) continue;
			const title = labels.entryTitle(section.type, entry);
			const where = [labels.sectionTitle(section.id), ...(title ? [title] : [])];
			const field = section.type === "summary" ? "content" : "description";
			if (typeof entry[field] === "string")
				passages.push(
					...passagesOf(entry[field], { sectionId: section.id, itemId: entry.id, field }, where, labels, seen),
				);
			if (Array.isArray(entry.roles))
				for (const role of entry.roles as Entry[]) {
					if (typeof role.description !== "string") continue;
					passages.push(
						...passagesOf(
							role.description,
							{ sectionId: section.id, itemId: entry.id, roleId: role.id, field: "description" },
							[...where, ...(typeof role.position === "string" && role.position ? [role.position] : [])],
							labels,
							seen,
						),
					);
				}
		}
	}

	return passages;
}

/** A letter's body, passage by passage. */
export const collectLetterPassages = (
	content: string,
	labels: Pick<PassageLabels, "bullet" | "paragraph" | "includeEmpty"> & { body: string },
) => passagesOf(content, { sectionId: LETTER_SECTION_ID, field: "content" }, [labels.body], labels, new Map());

// Colours of the page marks (README §5.9), as the PDF needs them: old text struck through in grey, new text on
// a pale accent highlight.
const OLD_TEXT_COLOR = "#7d7b73";
const NEW_TEXT_BACKGROUND = "#d4efd9";

const struck = (html: string) => `<s style="color: ${OLD_TEXT_COLOR}">${html}</s>`;
const highlighted = (html: string) => `<mark data-color="${NEW_TEXT_BACKGROUND}">${html}</mark>`;

/** The old text struck through, then the new text highlighted, inside the passage's own block. */
export function markChange(before: string, after: string) {
	// An addition keeps the passage and adds a block after it: only the new block is marked.
	if (after.startsWith(before) && after.length > before.length) {
		const added = after.slice(before.length);
		const marked = splitBlocks(added).reduce((html, block) => {
			const parts = splitBlock(block.html);
			return parts ? html.replace(block.html, () => `${parts.open}${highlighted(parts.inner)}${parts.close}`) : html;
		}, added);
		return `${before}${marked === added ? highlighted(added) : marked}`;
	}

	const old = splitBlock(before);
	const next = splitBlock(after);
	if (!old || !next) return `${struck(before)} ${highlighted(after)}`;
	return `${old.open}${struck(old.inner)} ${highlighted(next.inner)}${old.close}`;
}

/** The proposals still waiting on the user (not accepted, rejected or out of date), optionally in one section. */
export const pendingProposals = (data: ResumeData, proposals: readonly Proposal[], sectionId?: string) =>
	proposals.filter(
		(proposal) =>
			(sectionId === undefined || proposal.target.sectionId === sectionId) &&
			getProposalState(data, proposal) === "pending",
	);

/**
 * The page as it would read with the proposals: each passage struck through, followed by its replacement,
 * highlighted. For the preview only; it's never saved.
 */
export function markProposals(data: ResumeData, proposals: readonly Proposal[]): ResumeData {
	const pending = pendingProposals(data, proposals);
	if (pending.length === 0) return data;

	return produce(data, (draft) => {
		for (const proposal of pending) {
			const value = readTarget(draft, proposal.target);
			const marked = markChange(proposal.before, proposal.after);
			const next = applyTo(value, { before: proposal.before, after: marked });
			if (next !== undefined) writeTarget(draft, proposal.target, next);
		}
	});
}
