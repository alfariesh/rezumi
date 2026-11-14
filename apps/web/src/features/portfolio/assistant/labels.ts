import type { PortfolioReveal } from "../editor/save-problem";
import type { PortfolioViewMessages } from "@rezumi/portfolio/view";
import type { PortfolioBlockType } from "@rezumi/schema/portfolio/blocks";
import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { PortfolioEdit, PortfolioEditList } from "@rezumi/schema/portfolio/edits";
import type { PortfolioSectionKey } from "@rezumi/schema/portfolio/sections";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { t } from "@lingui/core/macro";
import { isPortfolioSectionKey } from "@rezumi/schema/portfolio/sections";
import {
	PORTFOLIO_ACCENTS,
	PORTFOLIO_FONT_PAIRS,
	PORTFOLIO_HERO_EFFECTS,
	PORTFOLIO_THEME_INFO,
	PORTFOLIO_THEMES,
} from "@rezumi/schema/portfolio/themes";
import { languageName } from "../editor/context";
import { problemPlace } from "../editor/save-problem";
import { resumeSectionItems, sectionLabel } from "../editor/sections";
import { effectLabel } from "../themes";

// The changes card's lines (`phase-14-asisten-ai.md` §5): one per change the assistant made, in the app's language,
// built from the resolved edit and named from the portfolio, never from the engine's English summary.

/** One change in words, and the place in the editor it opens. */
export type ChangeLine = { text: string; reveal: PortfolioReveal | null };

export type ChangeLineContext = {
	/**
	 * The portfolio before these changes, when it's known (they were applied during this visit, or aren't applied yet):
	 * what they removed or hid is named from it.
	 */
	before: PortfolioData | null;
	/** The portfolio as the editor has it now. */
	data: PortfolioData;
	/** The source's content as resume data: its career items are named from it. */
	resume: ResumeData | null;
	from: "resume" | "profile" | null;
	/** The page's own words, for default section titles. */
	messages: PortfolioViewMessages;
	/** The app's language, for language names. */
	locale: string;
};

type Item = Record<string, unknown>;
type ItemEdit = Exclude<PortfolioEdit, { op: "set" }>;
type SetEdit = Extract<PortfolioEdit, { op: "set" }>;

/** The lines for a call's changes, in order: usually one per edit, one per section or item a list change hid or showed. */
export function portfolioChangeLines(edits: readonly PortfolioEdit[], context: ChangeLineContext): ChangeLine[] {
	const find = itemFinder(edits, context);
	return edits.flatMap((edit) => (edit.op === "set" ? setLines(edit, context) : [itemLine(edit, find, context)]));
}

/** "Label: value", as one message so a language can order and punctuate it its own way. */
const labelled = (label: string, value: string) => t`${label}: ${value}`;

const textOf = (item: Item | null, field: string): string | null => {
	const value = item?.[field];
	return typeof value === "string" && value.trim() ? value.trim() : null;
};

const idOf = (item: unknown): string | null =>
	typeof item === "object" && item !== null && typeof (item as Item).id === "string"
		? ((item as Item).id as string)
		: null;

/** The items of one list in the data, or none when its work or block isn't there. */
function listItems(data: PortfolioData, list: PortfolioEditList, workId?: string, blockId?: string): readonly Item[] {
	switch (list) {
		case "works":
			return data.works.items;
		case "services":
			return data.services.items;
		case "testimonials":
			return data.testimonials.items;
		case "clients":
			return data.clients.items;
		case "custom":
			return data.custom;
		case "highlights":
			return data.hero.highlights;
		case "blocks":
			return data.works.items.find((work) => work.id === workId)?.blocks ?? [];
		case "metrics": {
			const block = data.works.items.find((work) => work.id === workId)?.blocks.find((entry) => entry.id === blockId);
			return block?.type === "metrics" ? block.items : [];
		}
	}
}

type Finder = (list: PortfolioEditList, id: string, workId?: string, blockId?: string) => Item | null;

/**
 * Finds an item by id: among what this call adds (with its blocks and numbers), then in the portfolio before the
 * changes, then as it is now.
 */
function itemFinder(edits: readonly PortfolioEdit[], context: ChangeLineContext): Finder {
	const added = new Map<string, Item>();
	const collect = (item: unknown) => {
		const id = idOf(item);
		if (!id) return;
		added.set(id, item as Item);
		for (const nested of ["blocks", "items"]) {
			const list = (item as Item)[nested];
			if (Array.isArray(list)) for (const entry of list) collect(entry);
		}
	};
	for (const edit of edits) if (edit.op === "add") collect(edit.item);
	const sources = [context.before, context.data].filter((data): data is PortfolioData => data !== null);

	return (list, id, workId, blockId) => {
		const fromCall = added.get(id);
		if (fromCall) return fromCall;
		for (const data of sources) {
			const found = listItems(data, list, workId, blockId).find((item) => item.id === id);
			if (found) return found;
		}
		return null;
	};
}

/** A block kind's name, as the editor's block menu writes it. */
function blockTypeName(type: unknown): string {
	switch (type as PortfolioBlockType) {
		case "text":
			return t`Text`;
		case "images":
			return t`Pictures`;
		case "metrics":
			return t`Metrics`;
		case "video":
			return t`Video`;
		case "embed":
			return t`Embed`;
		case "pdf":
			return t`PDF`;
		case "link":
			return t`Link`;
		default:
			return t`Text`;
	}
}

/** Whether an update only shows or hides the item: true hides, false shows, null for any other change. */
function hidingOnly(edit: ItemEdit): boolean | null {
	if (edit.op !== "update") return null;
	if (Object.keys(edit.fields).length !== 1 || !("hidden" in edit.fields)) return null;
	// A removed `hidden` (null) shows the item, as false does.
	return edit.fields.hidden === true;
}

function itemLine(edit: ItemEdit, find: Finder, context: ChangeLineContext): ChangeLine {
	const id = edit.op === "add" ? idOf(edit.item) : edit.id;
	const item = edit.op === "add" ? edit.item : id ? find(edit.list, id, edit.workId, edit.blockId) : null;
	const work = edit.workId ? find("works", edit.workId) : null;
	const workName = textOf(work, "title") ?? t`Untitled work`;
	const reveal = itemReveal(edit, id, context);
	const op = edit.op;
	const hidden = hidingOnly(edit);
	// What a removal took is named when it's known; otherwise the line says what kind of thing it was.
	const unknown = item === null && op === "remove";

	switch (edit.list) {
		case "works": {
			const name = textOf(item, "title") ?? t`Untitled work`;
			if (unknown) return { text: t`Removed a work`, reveal };
			if (hidden !== null) return { text: hidden ? t`Hid the work “${name}”` : t`Showed the work “${name}”`, reveal };
			return {
				text: {
					add: t`Added the work “${name}”`,
					update: t`Edited the work “${name}”`,
					remove: t`Removed the work “${name}”`,
					move: t`Moved the work “${name}”`,
				}[op],
				reveal,
			};
		}
		case "services": {
			const name = textOf(item, "title") ?? t`Untitled service`;
			if (unknown) return { text: t`Removed a service`, reveal };
			return {
				text: {
					add: t`Added the service “${name}”`,
					update: t`Edited the service “${name}”`,
					remove: t`Removed the service “${name}”`,
					move: t`Moved the service “${name}”`,
				}[op],
				reveal,
			};
		}
		case "testimonials": {
			const name = textOf(item, "name") ?? t`Untitled testimonial`;
			if (unknown) return { text: t`Removed a testimonial`, reveal };
			return {
				text: {
					add: t`Added the testimonial from ${name}`,
					update: t`Edited the testimonial from ${name}`,
					remove: t`Removed the testimonial from ${name}`,
					move: t`Moved the testimonial from ${name}`,
				}[op],
				reveal,
			};
		}
		case "clients": {
			const name = textOf(item, "name") ?? t`Untitled client`;
			if (unknown) return { text: t`Removed a client`, reveal };
			return {
				text: {
					add: t`Added the client “${name}”`,
					update: t`Edited the client “${name}”`,
					remove: t`Removed the client “${name}”`,
					move: t`Moved the client “${name}”`,
				}[op],
				reveal,
			};
		}
		case "custom": {
			const name = textOf(item, "title") ?? t`Untitled section`;
			if (unknown) return { text: t`Removed a section`, reveal };
			if (hidden !== null)
				return { text: hidden ? t`Hid the section “${name}”` : t`Showed the section “${name}”`, reveal };
			return {
				text: {
					add: t`Added the section “${name}”`,
					update: t`Edited the section “${name}”`,
					remove: t`Removed the section “${name}”`,
					move: t`Moved the section “${name}”`,
				}[op],
				reveal,
			};
		}
		case "highlights": {
			const name = textOf(item, "label") ?? t`Untitled number`;
			if (unknown) return { text: t`Removed a number from the intro`, reveal };
			return {
				text: {
					add: t`Added the number “${name}” to the intro`,
					update: t`Edited the number “${name}” in the intro`,
					remove: t`Removed the number “${name}” from the intro`,
					move: t`Moved the number “${name}” in the intro`,
				}[op],
				reveal,
			};
		}
		case "blocks": {
			if (unknown) return { text: t`Removed a block from “${workName}”`, reveal };
			const type = blockTypeName(item?.type);
			return {
				text: {
					add: t`Added a ${type} block to “${workName}”`,
					update: t`Edited a ${type} block in “${workName}”`,
					remove: t`Removed a ${type} block from “${workName}”`,
					move: t`Moved a ${type} block in “${workName}”`,
				}[op],
				reveal,
			};
		}
		case "metrics": {
			const name = textOf(item, "label") ?? t`Untitled number`;
			if (unknown) return { text: t`Removed a number from “${workName}”`, reveal };
			return {
				text: {
					add: t`Added the number “${name}” to “${workName}”`,
					update: t`Edited the number “${name}” in “${workName}”`,
					remove: t`Removed the number “${name}” from “${workName}”`,
					move: t`Moved the number “${name}” in “${workName}”`,
				}[op],
				reveal,
			};
		}
	}
}

/** Where a list change shows in the editor: the work (when it's there), else its section in Content. */
function itemReveal(edit: ItemEdit, id: string | null, context: ChangeLineContext): PortfolioReveal | null {
	const { data } = context;
	/** The target when the data has it now (a removed or not yet applied item has no place to open). */
	const present = (list: readonly { id: string }[], target: string | null | undefined) =>
		target && list.some((item) => item.id === target) ? target : null;
	switch (edit.list) {
		case "works": {
			const workId = edit.op === "remove" ? null : present(data.works.items, id);
			return { tab: "write", section: "work", ...(workId ? { workId } : {}) };
		}
		case "blocks":
		case "metrics": {
			const workId = present(data.works.items, edit.workId);
			return { tab: "write", section: "work", ...(workId ? { workId } : {}) };
		}
		case "services":
		case "testimonials":
		case "clients":
			return { tab: "write", section: edit.list };
		case "custom": {
			const sectionId = edit.op === "remove" ? null : present(data.custom, id);
			return sectionId ? { tab: "write", section: `custom:${sectionId}` } : { tab: "write" };
		}
		case "highlights":
			return { tab: "write" };
	}
}

const isTheme = (value: unknown): value is keyof typeof PORTFOLIO_THEME_INFO =>
	typeof value === "string" && (PORTFOLIO_THEMES as readonly string[]).includes(value);

const recordOf = (value: unknown): Item | null =>
	typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Item) : null;

/** What a field that follows the source again says. */
const sameAsSource = (context: ChangeLineContext) =>
	context.from === "profile" ? t`Same as my Profile` : t`Same as my resume`;

function accentWords(value: unknown, context: ChangeLineContext): string | null {
	const accent = recordOf(value);
	if (accent?.source === "resume") return sameAsSource(context);
	if (accent?.source === "custom" && typeof accent.color === "string") return accent.color;
	if (accent?.source === "preset" && typeof accent.id === "string" && accent.id in PORTFOLIO_ACCENTS)
		return PORTFOLIO_ACCENTS[accent.id as keyof typeof PORTFOLIO_ACCENTS].label;
	return null;
}

function fontWords(value: unknown, context: ChangeLineContext): string | null {
	const fonts = recordOf(value);
	if (fonts?.source === "resume") return sameAsSource(context);
	if (fonts?.source === "theme") return t`Default`;
	if (fonts?.source === "pair" && typeof fonts.id === "string" && fonts.id in PORTFOLIO_FONT_PAIRS)
		return PORTFOLIO_FONT_PAIRS[fonts.id as keyof typeof PORTFOLIO_FONT_PAIRS].label;
	return null;
}

function schemeWords(value: unknown): string {
	if (value === "light") return t`Light`;
	if (value === "dark") return t`Dark`;
	return t`Device`;
}

const sectionName = (key: PortfolioSectionKey, data: PortfolioData, context: ChangeLineContext) =>
	sectionLabel(key, data, context.resume, context.messages);

const keyList = (value: unknown): string[] =>
	Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];

/** The editor place a field is in, as the save status finds it. */
function placeOf(path: string, context: ChangeLineContext): PortfolioReveal | null {
	return problemPlace(path.split("."), context)?.reveal ?? null;
}

function setLines(edit: SetEdit, context: ChangeLineContext): ChangeLine[] {
	const { path, value } = edit;
	const place = placeOf(path, context);
	const line = (text: string, reveal: PortfolioReveal | null = place): ChangeLine[] => [{ text, reveal }];
	const text = typeof value === "string" && value.trim() ? value.trim() : null;

	switch (path) {
		case "theme":
			return line(isTheme(value) ? labelled(t`Theme`, PORTFOLIO_THEME_INFO[value].name) : t`Changed the theme`);
		case "locale":
			return line(labelled(t`Page language`, text ? languageName(text, context.locale) : t`Default`));
		case "basics.name":
			return line(labelled(t`Name`, text ?? sameAsSource(context)));
		case "basics.headline":
			return line(labelled(t`Headline`, text ?? sameAsSource(context)));
		case "basics.location":
			return line(labelled(t`Location`, text ?? sameAsSource(context)));
		case "basics.picture":
			if (value === null) return line(t`Removed the photo`);
			if (value === "resume")
				return line(
					labelled(t`Photo`, context.from === "profile" ? t`The photo in my Profile` : t`The photo on my resume`),
				);
			return line(t`Changed the photo`);
		case "design.scheme":
			return line(labelled(t`Mode`, schemeWords(value)));
		case "design.accent": {
			const words = accentWords(value, context);
			return line(words ? labelled(t`Accent color`, words) : t`Changed the colors`);
		}
		case "design.fonts": {
			const words = fontWords(value, context);
			return line(words ? labelled(t`Fonts`, words) : t`Changed the fonts`);
		}
		case "hero.greeting":
			return line(t`Rewrote the greeting`);
		case "hero.showPicture":
			return line(value === false ? t`Hid the photo in the intro` : t`Showed the photo in the intro`);
		case "hero.showLocation":
			return line(value === false ? t`Hid the location in the intro` : t`Showed the location in the intro`);
		case "hero.availability":
			return line(t`Changed your availability`);
		case "hero.buttons":
			return line(t`Changed the intro's buttons`);
		case "hero.effect": {
			const id = recordOf(value)?.id;
			return line(
				typeof id === "string" && (PORTFOLIO_HERO_EFFECTS as readonly string[]).includes(id)
					? labelled(t`Intro effect`, effectLabel(id as (typeof PORTFOLIO_HERO_EFFECTS)[number]))
					: t`Changed the intro effect`,
			);
		}
		case "hero.background":
			return line(t`Changed the intro background`);
		case "about.content": {
			const about = sectionName("about", context.data, context);
			return line(t`Rewrote ${about}`);
		}
		case "sections.order":
			return line(t`Reordered the sections`);
		case "sections.hidden":
			return hiddenSectionLines(keyList(value), context);
		case "sections.titles":
			return line(t`Renamed sections`);
		case "sections.hiddenItems":
			return line(t`Changed which items show`);
		case "credit.show":
			return line(value === false ? t`Hid the Rezumi badge` : t`Showed the Rezumi badge`);
	}

	if (path.startsWith("design.variants")) return line(t`Changed the layouts`);
	if (path.startsWith("sections.titles."))
		return sectionTitleLines(path.slice("sections.titles.".length), text, context);
	if (path.startsWith("sections.hiddenItems."))
		return hiddenItemLines(path.slice("sections.hiddenItems.".length), keyList(value), context);
	if (path.startsWith("location.")) return line(t`Changed your location details`);
	if (path.startsWith("contact.")) return line(t`Changed the contact options`);
	if (path.startsWith("seo.")) return line(t`Changed how search engines show your page`);
	return line(t`Changed a setting`);
}

/** Sections the call hid or showed, one line each; without the earlier list it can only say the list changed. */
function hiddenSectionLines(next: readonly string[], context: ChangeLineContext): ChangeLine[] {
	const fallback = [{ text: t`Changed which sections show`, reveal: { tab: "write" } satisfies PortfolioReveal }];
	if (!context.before) return fallback;
	const before = context.before.sections.hidden as readonly string[];
	const names = (key: string) => (isPortfolioSectionKey(key) ? sectionName(key, context.data, context) : key);
	const reveal = (key: string): PortfolioReveal =>
		isPortfolioSectionKey(key) ? { tab: "write", section: key } : { tab: "write" };
	const lines = [
		...next
			.filter((key) => !before.includes(key))
			.map((key) => {
				const name = names(key);
				return { text: t`Hid the section “${name}”`, reveal: reveal(key) };
			}),
		...before
			.filter((key) => !next.includes(key))
			.map((key) => {
				const name = names(key);
				return { text: t`Showed the section “${name}”`, reveal: reveal(key) };
			}),
	];
	return lines.length > 0 ? lines : fallback;
}

function sectionTitleLines(key: string, title: string | null, context: ChangeLineContext): ChangeLine[] {
	if (!isPortfolioSectionKey(key)) return [{ text: t`Renamed sections`, reveal: { tab: "write" } }];
	const reveal: PortfolioReveal = { tab: "write", section: key };
	// The name it had: before the call when known, else its default (what it reads without a title of its own).
	const base = context.before ?? { ...context.data, sections: { ...context.data.sections, titles: {} } };
	const old = sectionName(key, base, context);
	if (!title) return [{ text: t`“${old}” has its default title again`, reveal }];
	return [{ text: t`Renamed “${old}” to “${title}”`, reveal }];
}

/** Career items the call hid or showed in one section, by name when the source has them. */
function hiddenItemLines(key: string, next: readonly string[], context: ChangeLineContext): ChangeLine[] {
	if (!isPortfolioSectionKey(key)) return [{ text: t`Changed which items show`, reveal: { tab: "write" } }];
	const section = sectionName(key, context.data, context);
	const reveal: PortfolioReveal = { tab: "write", section: key };
	const fallback = [{ text: t`Changed which items show in ${section}`, reveal }];
	if (!context.before) return fallback;
	const before = context.before.sections.hiddenItems[key] ?? [];
	const items = resumeSectionItems(context.resume, key);
	const label = (id: string) => items.find((item) => item.id === id)?.label;
	const lines: ChangeLine[] = [];
	for (const id of next.filter((entry) => !before.includes(entry))) {
		const item = label(id);
		lines.push({ text: item ? t`Hid “${item}” in ${section}` : t`Hid an item in ${section}`, reveal });
	}
	for (const id of before.filter((entry) => !next.includes(entry))) {
		const item = label(id);
		lines.push({ text: item ? t`Showed “${item}” in ${section}` : t`Showed an item in ${section}`, reveal });
	}
	return lines.length > 0 ? lines : fallback;
}
