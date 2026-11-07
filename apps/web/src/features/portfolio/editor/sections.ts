import type { PortfolioViewMessages } from "@rezumi/portfolio/view";
import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type {
	PortfolioResumeSection,
	PortfolioSectionKey,
	PortfolioStandardSection,
} from "@rezumi/schema/portfolio/sections";
import type { ResumeData } from "@rezumi/schema/resume/data";
import type { Draft } from "immer";
import { t } from "@lingui/core/macro";
import { resolveSectionOrder } from "@rezumi/portfolio/view";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { PORTFOLIO_RESUME_SECTIONS, PORTFOLIO_STANDARD_SECTIONS } from "@rezumi/schema/portfolio/sections";

// The Content tab's section list, as plain functions on the data so they can be tested apart from the editor.

const RESUME_SECTIONS = new Set<string>(PORTFOLIO_RESUME_SECTIONS);
const STANDARD_SECTIONS = new Set<string>(PORTFOLIO_STANDARD_SECTIONS);

/** One of the sections every portfolio has (About, Work, Experience…), as opposed to `custom:` and `resume:` ones. */
export function isStandardSection(key: PortfolioSectionKey): key is PortfolioStandardSection {
	return STANDARD_SECTIONS.has(key);
}

/** A custom section of the source resume, shown on the portfolio as it is there. */
function isResumeCustomSection(key: PortfolioSectionKey): key is `resume:${string}` {
	return key.startsWith("resume:");
}

/** Sections whose items come from the source resume, edited there. */
export function isResumeSection(key: PortfolioSectionKey): key is PortfolioResumeSection | `resume:${string}` {
	return RESUME_SECTIONS.has(key) || isResumeCustomSection(key);
}

/** Every section in page order, shown or not: the editor lists them all, so a hidden one can come back. */
export function editorSectionOrder(data: PortfolioData, resume: ResumeData | null): PortfolioSectionKey[] {
	return resolveSectionOrder(data, data.theme, resume);
}

/**
 * Moves a section to `to` (an index in the full order, as the list shows it) and keeps the whole order, so the theme
 * no longer places any section on its own. A resume section the list doesn't show right now (the resume is still
 * loading, or another one is chosen for a while) keeps its saved place, after the section it followed.
 */
export function moveSection(
	draft: Draft<PortfolioData>,
	order: readonly PortfolioSectionKey[],
	key: PortfolioSectionKey,
	to: number,
): void {
	const next = order.filter((entry) => entry !== key);
	if (next.length === order.length) return;
	next.splice(Math.max(0, Math.min(to, next.length)), 0, key);

	const saved = [...draft.sections.order];
	saved.forEach((entry, index) => {
		if (!isResumeCustomSection(entry) || next.includes(entry) || next.length >= PORTFOLIO_LIMITS.sectionKeys) return;
		const after = saved.slice(0, index).findLast((earlier) => next.includes(earlier));
		next.splice(after === undefined ? 0 : next.indexOf(after) + 1, 0, entry);
	});
	draft.sections.order = next;
}

export function setSectionHidden(draft: Draft<PortfolioData>, key: PortfolioSectionKey, hidden: boolean): void {
	const rest = draft.sections.hidden.filter((entry) => entry !== key);
	draft.sections.hidden = hidden ? [...rest, key] : rest;
}

/** A custom section title; an empty one goes back to the default in the page's language. */
export function setSectionTitle(draft: Draft<PortfolioData>, key: PortfolioSectionKey, title: string): void {
	const trimmed = title.trim();
	if (trimmed) draft.sections.titles[key] = trimmed;
	else delete draft.sections.titles[key];
}

/** A section's name in the editor: its custom title, else the page's default in the page's language. */
export function sectionLabel(
	key: PortfolioSectionKey,
	data: PortfolioData,
	resume: ResumeData | null,
	messages: PortfolioViewMessages,
): string {
	const custom = data.sections.titles[key]?.trim();
	if (custom) return custom;
	if (key.startsWith("custom:"))
		return data.custom.find((section) => `custom:${section.id}` === key)?.title.trim() || t`Untitled section`;
	if (isStandardSection(key)) return messages.sections[key];
	return resumeCustomSectionTitle(resume, key) || t`Resume section`;
}

/** Hides one resume item on the portfolio only; the resume keeps it. */
export function setItemHidden(
	draft: Draft<PortfolioData>,
	key: PortfolioSectionKey,
	itemId: string,
	hidden: boolean,
): void {
	const rest = (draft.sections.hiddenItems[key] ?? []).filter((id) => id !== itemId);
	const next = hidden ? [...rest, itemId] : rest;
	if (next.length) draft.sections.hiddenItems[key] = next;
	else delete draft.sections.hiddenItems[key];
}

export type ResumeSectionItem = {
	id: string;
	label: string;
	/** Hidden on the resume itself: it stays off the portfolio too, and only the resume can show it again. */
	hiddenOnResume: boolean;
};

type ResumeItem =
	| ResumeData["sections"][PortfolioResumeSection]["items"][number]
	| ResumeData["customSections"][number]["items"][number];

/** One of an item's text fields, trimmed; items of different sections name different fields. */
function textOf(item: ResumeItem, field: string): string {
	const value: unknown = Reflect.get(item, field);
	return typeof value === "string" ? value.trim() : "";
}

/** A resume item's name in the list: the first of its naming fields that has text. */
function itemLabel(item: ResumeItem): string {
	const name = textOf(item, "name") || textOf(item, "title") || textOf(item, "language") || textOf(item, "network");
	const place = textOf(item, "company") || textOf(item, "school") || textOf(item, "organization");
	const role = textOf(item, "position") || textOf(item, "degree");
	if (place && role) return `${role} · ${place}`;
	return name || place || role || textOf(item, "username");
}

/** The items of a section read from the resume, for hiding them on the portfolio. */
export function resumeSectionItems(resume: ResumeData | null, key: PortfolioSectionKey): ResumeSectionItem[] {
	if (!resume || !isResumeSection(key)) return [];
	const items: readonly ResumeItem[] = isResumeCustomSection(key)
		? (resume.customSections.find((section) => section.id === key.slice("resume:".length))?.items ?? [])
		: resume.sections[key].items;
	return items
		.map((item) => ({ id: item.id, label: itemLabel(item), hiddenOnResume: item.hidden }))
		.filter((item) => item.label);
}

/** A resume custom section's title, or null when the key isn't one. */
function resumeCustomSectionTitle(resume: ResumeData | null, key: PortfolioSectionKey): string | null {
	if (!key.startsWith("resume:")) return null;
	return resume?.customSections.find((section) => section.id === key.slice("resume:".length))?.title.trim() ?? null;
}

/**
 * A portfolio-only replacement for one of the resume's basics: blank text clears it, so the page follows the resume
 * again (`00-keputusan.md` 3a).
 */
export function setBasicsText(
	draft: Draft<PortfolioData>,
	field: "name" | "headline" | "location",
	value: string,
): void {
	if (value.trim()) draft.basics[field] = value;
	else delete draft.basics[field];
}
