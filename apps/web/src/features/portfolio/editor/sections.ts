import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { PortfolioResumeSection, PortfolioSectionKey } from "@rezumi/schema/portfolio/sections";
import type { ResumeData } from "@rezumi/schema/resume/data";
import type { Draft } from "immer";
import { resolveSectionOrder } from "@rezumi/portfolio/view";
import { PORTFOLIO_RESUME_SECTIONS } from "@rezumi/schema/portfolio/sections";

// The Content tab's section list, as plain functions on the data so they can be tested apart from the editor.

const RESUME_SECTIONS = new Set<string>(PORTFOLIO_RESUME_SECTIONS);

/** Sections whose items come from the source resume, edited there. */
export function isResumeSection(key: PortfolioSectionKey): key is PortfolioResumeSection | `resume:${string}` {
	return RESUME_SECTIONS.has(key) || key.startsWith("resume:");
}

/** Every section in page order, shown or not: the editor lists them all, so a hidden one can come back. */
export function editorSectionOrder(data: PortfolioData, resume: ResumeData | null): PortfolioSectionKey[] {
	return resolveSectionOrder(data, data.theme, resume);
}

/**
 * Moves a section to `to` (an index in the full order, as the list shows it) and keeps the whole order, so the theme
 * no longer places any section on its own.
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

type LooseItem = Record<string, unknown> & { id: string; hidden?: boolean };

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** A resume item's name in the list: the first of its naming fields that has text. */
function itemLabel(item: LooseItem): string {
	const name = text(item.name) || text(item.title) || text(item.language) || text(item.network);
	const place = text(item.company) || text(item.school) || text(item.organization);
	const role = text(item.position) || text(item.degree);
	if (place && role) return `${role} · ${place}`;
	return name || place || role || text(item.username);
}

/** The items of a section read from the resume, for hiding them on the portfolio. */
export function resumeSectionItems(resume: ResumeData | null, key: PortfolioSectionKey): ResumeSectionItem[] {
	if (!resume || !isResumeSection(key)) return [];
	const items: readonly LooseItem[] = key.startsWith("resume:")
		? ((resume.customSections.find((section) => section.id === key.slice("resume:".length))?.items ??
				[]) as unknown as LooseItem[])
		: (resume.sections[key as PortfolioResumeSection].items as unknown as LooseItem[]);
	return items
		.map((item) => ({ id: item.id, label: itemLabel(item), hiddenOnResume: item.hidden === true }))
		.filter((item) => item.label);
}

/** A resume custom section's title, or null when the key isn't one. */
export function resumeCustomSectionTitle(resume: ResumeData | null, key: PortfolioSectionKey): string | null {
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
