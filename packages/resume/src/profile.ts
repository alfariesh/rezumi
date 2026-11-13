import type { ProfileBasicsField, ProfileData, ProfilePart, ProfileSectionType } from "@rezumi/schema/profile/data";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { emptyProfileData, PROFILE_BASICS_FIELDS, PROFILE_SECTION_TYPES } from "@rezumi/schema/profile/data";
import { defaultResumeData } from "@rezumi/schema/resume/default";

/**
 * How a resume and the account's Profile stay in step.
 *
 * A resume always holds its own complete data, so everything that reads one (pages, PDFs, exports, versions) works
 * without the Profile. What links the two is content, not a flag: a part of a resume that reads exactly like the
 * Profile's is "linked" and follows the Profile when it changes; a part that reads differently is that resume's own
 * version (an "override") and is left alone. Items are matched by `id`, which a resume keeps when it takes an item
 * from the Profile, and a copy of a resume keeps too.
 *
 * Parts are: each basics field, the photo, the summary, and each item of a built-in section. Custom sections, section
 * settings and design always belong to the document.
 */

/** "linked": reads like the Profile's. "override": the document's own version. */
export type ProfileLink = "linked" | "override";
/** As `ProfileLink`, plus "empty": the document leaves blank what the Profile has, which is never filled for it. */
export type ProfileFieldLink = ProfileLink | "empty";
/** As `ProfileLink`, plus "local": an item the Profile doesn't have. */
export type ProfileItemLink = ProfileLink | "local";

export type ProfileComparison = {
	basics: Record<ProfileBasicsField, ProfileFieldLink>;
	picture: ProfileFieldLink;
	summary: ProfileFieldLink;
	/** The document's items by section and id. */
	items: Record<ProfileSectionType, Record<string, ProfileItemLink>>;
	/** Profile items the document doesn't have, by section, in the Profile's order. */
	missing: Record<ProfileSectionType, string[]>;
};

type Item = { id: string; hidden: boolean } & Record<string, unknown>;

// The text a resume writes from an entry's structured dates, in its own language and date format.
const DATE_TEXT_FIELD: Partial<Record<ProfileSectionType, "period" | "date">> = {
	experience: "period",
	education: "period",
	projects: "period",
	volunteer: "period",
	awards: "date",
	certifications: "date",
	publications: "date",
};

function withoutDateText<Entry extends Record<string, unknown>>(entry: Entry, field: "period" | "date"): Entry {
	if (entry.dates === undefined) return entry;
	const { [field]: _text, ...rest } = entry;
	return rest as Entry;
}

/**
 * An item's content: everything but what belongs to one document. `hidden` is the document's choice, and the date
 * text is written by each resume from the structured dates, so two resumes in different languages still match.
 */
function itemContent(section: ProfileSectionType, item: Item): Record<string, unknown> {
	const { hidden: _hidden, ...rest } = item;
	const field = DATE_TEXT_FIELD[section];
	if (!field) return rest;
	const content = withoutDateText(rest, field);
	if (section !== "experience" || !Array.isArray(content.roles)) return content;
	return {
		...content,
		roles: (content.roles as Record<string, unknown>[]).map((role) => withoutDateText(role, "period")),
	};
}

/** Deep equality for JSON values, where a missing key equals an undefined one. */
export function sameContent(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
	if (Array.isArray(a) || Array.isArray(b)) {
		if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
		return a.every((value, index) => sameContent(value, b[index]));
	}
	const left = a as Record<string, unknown>;
	const right = b as Record<string, unknown>;
	for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
		if (!sameContent(left[key], right[key])) return false;
	}
	return true;
}

const itemsOf = (data: ResumeData, section: ProfileSectionType) => data.sections[section].items as unknown as Item[];
const profileItemsOf = (profile: ProfileData, section: ProfileSectionType) =>
	profile.sections[section] as unknown as Item[];
const byId = (items: Item[]) => new Map(items.map((item) => [item.id, item]));
const sameItem = (section: ProfileSectionType, a: Item, b: Item) =>
	sameContent(itemContent(section, a), itemContent(section, b));

/** Nothing filled in: an empty text, list, or an object of only such values (a website without a URL or label). */
export const isBlank = (value: unknown): boolean =>
	typeof value === "string"
		? !value.trim()
		: Array.isArray(value)
			? value.length === 0
			: typeof value === "object" && value !== null
				? Object.values(value).every(isBlank)
				: value === undefined || value === null;

/** Which parts of a resume read like the Profile's, which are its own, and which Profile items it leaves out. */
export function compareWithProfile(data: ResumeData, profile: ProfileData): ProfileComparison {
	const link = (same: boolean): ProfileLink => (same ? "linked" : "override");
	const fieldLink = (own: unknown, source: unknown): ProfileFieldLink =>
		sameContent(own, source) ? "linked" : isBlank(own) ? "empty" : "override";
	const basics = Object.fromEntries(
		PROFILE_BASICS_FIELDS.map((field) => [field, fieldLink(data.basics[field], profile.basics[field])]),
	) as ProfileComparison["basics"];

	const items = {} as ProfileComparison["items"];
	const missing = {} as ProfileComparison["missing"];
	for (const section of PROFILE_SECTION_TYPES) {
		const inProfile = byId(profileItemsOf(profile, section));
		const inDocument = new Set<string>();
		items[section] = {};
		for (const item of itemsOf(data, section)) {
			inDocument.add(item.id);
			const source = inProfile.get(item.id);
			items[section][item.id] = source ? link(sameItem(section, item, source)) : "local";
		}
		missing[section] = profileItemsOf(profile, section)
			.filter((item) => !inDocument.has(item.id))
			.map((item) => item.id);
	}

	return {
		basics,
		picture: fieldLink(data.picture.url, profile.picture.url),
		summary: fieldLink(data.summary.content, profile.summary.content),
		items,
		missing,
	};
}

/**
 * Carries a Profile change into a resume: every part that read like the Profile before the change takes the new
 * value, and every part the resume had made its own is left as it is. Items removed from the Profile stay in the
 * resume, and items added to the Profile are not added to it (the resume lists them under `missing`).
 *
 * Nothing appears where a resume had nothing: a blank field, photo or summary stays blank when the Profile gains
 * one, so a shared resume never starts showing a phone number or a photo by itself. The resume reports those parts
 * as "empty" and takes them only when asked (`takeFromProfile`).
 *
 * Returns the changed copy, or null when the change doesn't touch this resume.
 */
export function followProfile(data: ResumeData, before: ProfileData, after: ProfileData): ResumeData | null {
	let next: ResumeData | undefined;
	const draft = () => (next ??= structuredClone(data));
	const follows = (own: unknown, was: unknown, now: unknown) =>
		!isBlank(was) && !sameContent(was, now) && sameContent(own, was);

	for (const field of PROFILE_BASICS_FIELDS) {
		if (!follows(data.basics[field], before.basics[field], after.basics[field])) continue;
		(draft().basics as Record<string, unknown>)[field] = structuredClone(after.basics[field]);
	}
	if (follows(data.picture.url, before.picture.url, after.picture.url)) draft().picture.url = after.picture.url;
	if (follows(data.summary.content, before.summary.content, after.summary.content))
		draft().summary.content = after.summary.content;

	for (const section of PROFILE_SECTION_TYPES) {
		const was = byId(profileItemsOf(before, section));
		const now = byId(profileItemsOf(after, section));
		itemsOf(data, section).forEach((item, index) => {
			const old = was.get(item.id);
			const current = now.get(item.id);
			if (!old || !current || sameItem(section, old, current) || !sameItem(section, item, old)) return;
			itemsOf(draft(), section)[index] = { ...structuredClone(current), hidden: item.hidden };
		});
	}

	return next ?? null;
}

// Where an item goes in `target` so it keeps the order it has in `source`: after the nearest earlier neighbour that
// `target` also has, or first.
function insertInOrder(target: Item[], source: Item[], item: Item) {
	const position = source.findIndex((candidate) => candidate.id === item.id);
	for (let index = position - 1; index >= 0; index--) {
		const neighbour = target.findIndex((candidate) => candidate.id === source[index]?.id);
		if (neighbour !== -1) return void target.splice(neighbour + 1, 0, item);
	}
	target.unshift(item);
}

/**
 * Gives a part of the resume the Profile's version ("Use the Profile's"). An item the resume doesn't have yet is
 * added where the Profile's order puts it; an item the Profile doesn't have is left alone.
 */
export function takeFromProfile(data: ResumeData, profile: ProfileData, part: ProfilePart): ResumeData {
	const next = structuredClone(data);
	if (part.kind === "basics")
		(next.basics as Record<string, unknown>)[part.field] = structuredClone(profile.basics[part.field]);
	else if (part.kind === "picture") next.picture.url = profile.picture.url;
	else if (part.kind === "summary") next.summary.content = profile.summary.content;
	else {
		const source = profileItemsOf(profile, part.section).find((item) => item.id === part.id);
		if (!source) return next;
		const items = itemsOf(next, part.section);
		const index = items.findIndex((item) => item.id === part.id);
		if (index === -1) insertInOrder(items, profileItemsOf(profile, part.section), structuredClone(source));
		else items[index] = { ...structuredClone(source), hidden: items[index]?.hidden ?? false };
	}
	return next;
}

/**
 * Makes the resume's version of a part the Profile's ("Save to Profile"). A new item is added where the resume's
 * order puts it. Every other resume still linked to that part then follows through `followProfile`.
 */
export function saveToProfile(profile: ProfileData, data: ResumeData, part: ProfilePart): ProfileData {
	const next = structuredClone(profile);
	if (part.kind === "basics")
		(next.basics as Record<string, unknown>)[part.field] = structuredClone(data.basics[part.field]);
	else if (part.kind === "picture") next.picture.url = data.picture.url;
	else if (part.kind === "summary") next.summary.content = data.summary.content;
	else {
		const source = itemsOf(data, part.section).find((item) => item.id === part.id);
		if (!source) return next;
		const item = { ...structuredClone(source), hidden: false };
		const items = profileItemsOf(next, part.section);
		const index = items.findIndex((candidate) => candidate.id === part.id);
		if (index === -1) insertInOrder(items, itemsOf(data, part.section), item);
		else items[index] = item;
	}
	return next;
}

/** A resume filled from the Profile: its basics, photo, summary and every item, on `base`'s design and settings. */
export function resumeDataFromProfile(profile: ProfileData, base: ResumeData = defaultResumeData): ResumeData {
	const data = structuredClone(base);
	data.basics = structuredClone(profile.basics);
	data.picture.url = profile.picture.url;
	data.summary.content = profile.summary.content;
	for (const section of PROFILE_SECTION_TYPES)
		(data.sections[section] as { items: unknown[] }).items = structuredClone(profileItemsOf(profile, section));
	return data;
}

/** A resume's content as Profile data: basics, photo, summary and every built-in section's items, none hidden. */
export function profileFromResume(data: ResumeData): ProfileData {
	const profile = emptyProfileData();
	profile.basics = structuredClone(
		Object.fromEntries(PROFILE_BASICS_FIELDS.map((field) => [field, data.basics[field]])),
	) as ProfileData["basics"];
	profile.picture.url = data.picture.url;
	profile.summary.content = data.summary.content;
	for (const section of PROFILE_SECTION_TYPES)
		(profile.sections as Record<string, unknown>)[section] = itemsOf(data, section).map((item) => ({
			...structuredClone(item),
			hidden: false,
		}));
	return profile;
}

/**
 * Fills what the Profile still lacks from a resume: blank basics, a missing photo or summary, and sections with no
 * items. Nothing already in the Profile changes. Returns null when there was nothing to add.
 */
export function completeProfile(profile: ProfileData, data: ResumeData): ProfileData | null {
	const source = profileFromResume(data);
	let next: ProfileData | undefined;
	const draft = () => (next ??= structuredClone(profile));

	for (const field of PROFILE_BASICS_FIELDS) {
		if (!isBlank(profile.basics[field]) || isBlank(source.basics[field])) continue;
		(draft().basics as Record<string, unknown>)[field] = source.basics[field];
	}
	if (!profile.picture.url.trim() && source.picture.url.trim()) draft().picture.url = source.picture.url;
	if (!profile.summary.content.trim() && source.summary.content.trim())
		draft().summary.content = source.summary.content;
	for (const section of PROFILE_SECTION_TYPES) {
		if (profile.sections[section].length > 0 || source.sections[section].length === 0) continue;
		(draft().sections as Record<string, unknown>)[section] = source.sections[section];
	}

	return next ?? null;
}
