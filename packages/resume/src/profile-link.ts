import type { ProfileComparison } from "./profile";
import type { Entry, WriteSection } from "./write/model";
import type { ProfileData, ProfilePart, ProfileSectionType } from "@rezumi/schema/profile/data";
import type { ResumeData } from "@rezumi/schema/resume/data";
import type { WritableDraft } from "immer";
import { PROFILE_SECTION_TYPES } from "@rezumi/schema/profile/data";
import { stripHtml } from "@rezumi/utils/string";
import { compareWithProfile, isBlank, takeFromProfile } from "./profile";
import { describeEntry } from "./write/model";

/**
 * The resume builder's view of the account's Profile, shared by the web and the app: which parts of an open resume
 * read like the Profile's ("linked", nothing to show), which are this resume's own version ("override", a calm marker
 * with Use Profile's and Save to Profile), and which Profile entries the resume leaves out (Add from Profile).
 *
 * A resume that shares nothing with the Profile (a sample, or one imported before the Profile was filled) is left
 * alone: its parts would all read as overrides, which says nothing useful.
 */

export type ProfileView = {
	comparison: ProfileComparison;
	/** Shares something with the Profile: a filled-in part that reads the same, or any entry taken from it. */
	connected: boolean;
};

// One comparison per version of the resume and the Profile, shared by every marker: both are immutable, so a new
// version is a new object.
const views = new WeakMap<ResumeData, { profile: ProfileData; view: ProfileView }>();

export function profileView(data: ResumeData, profile: ProfileData): ProfileView {
	const cached = views.get(data);
	if (cached?.profile === profile) return cached.view;

	const comparison = compareWithProfile(data, profile);
	const connected =
		Object.entries(comparison.basics).some(
			([field, link]) => link === "linked" && !isBlank(profile.basics[field as keyof ProfileData["basics"]]),
		) ||
		(comparison.picture === "linked" && Boolean(profile.picture.url.trim())) ||
		(comparison.summary === "linked" && !isBlank(stripHtml(profile.summary.content))) ||
		PROFILE_SECTION_TYPES.some((section) => Object.values(comparison.items[section]).some((link) => link === "linked"));

	const view = { comparison, connected };
	views.set(data, { profile, view });
	return view;
}

/** The Profile section a resume section links with: built-in sections only (custom ones belong to the document). */
export function profileSectionOf(section: Pick<WriteSection, "id" | "kind">): ProfileSectionType | null {
	if (section.kind !== "builtin") return null;
	return (PROFILE_SECTION_TYPES as readonly string[]).includes(section.id) ? (section.id as ProfileSectionType) : null;
}

/** A part's value in the resume or the Profile, for the blank checks and the preview. */
export function partValue(source: ResumeData | ProfileData, part: ProfilePart): unknown {
	if (part.kind === "basics") return source.basics[part.field];
	if (part.kind === "picture") return source.picture.url;
	if (part.kind === "summary") return stripHtml(source.summary.content);
	const items = "metadata" in source ? source.sections[part.section].items : source.sections[part.section];
	return (items as { id: string }[]).find((item) => item.id === part.id);
}

/**
 * What a part shows. `both`: it differs from the Profile's, with Use Profile's and Save to Profile. `save`: the Profile
 * has nothing there yet, so only Save to Profile. `fill`: the resume leaves blank what the Profile has (never filled
 * for it, so a shared resume doesn't start showing a phone number by itself): no marker, only a quiet Use Profile's.
 */
export type MarkerState = "both" | "save" | "fill";

/** What a part of `data` shows against `profile`; null shows nothing. */
export function markerState(data: ResumeData, profile: ProfileData, part: ProfilePart): MarkerState | null {
	const { comparison, connected } = profileView(data, profile);
	if (part.kind === "item") {
		// An entry the Profile has too always came from it (or from a copy), so a difference is worth showing.
		return comparison.items[part.section][part.id] === "override" ? "both" : null;
	}
	const link =
		part.kind === "basics"
			? comparison.basics[part.field]
			: part.kind === "picture"
				? comparison.picture
				: comparison.summary;
	if (link === "empty") return "fill";
	if (link !== "override" || !connected) return null;
	return isBlank(partValue(profile, part)) ? "save" : "both";
}

/** Writes the Profile's version of a part into the resume (from `next`, the data with it taken). */
function applyPart(draft: WritableDraft<ResumeData>, next: ResumeData, part: ProfilePart) {
	if (part.kind === "basics") (draft.basics as Record<string, unknown>)[part.field] = next.basics[part.field];
	else if (part.kind === "picture") draft.picture.url = next.picture.url;
	else if (part.kind === "summary") draft.summary.content = next.summary.content;
	else (draft.sections[part.section] as { items: unknown[] }).items = next.sections[part.section].items;
}

/**
 * Use Profile's: the edit that takes the Profile's version of parts, or adds Profile entries the resume doesn't have,
 * as one recipe (one undo step). `prepare` runs first in the same recipe (placing a section that wasn't on the page).
 * Null when there's nothing to take.
 */
export function takeProfilePartsEdit(
	data: ResumeData,
	profile: ProfileData,
	parts: readonly ProfilePart[],
	prepare?: (draft: WritableDraft<ResumeData>) => void,
): ((draft: WritableDraft<ResumeData>) => void) | null {
	if (parts.length === 0) return null;
	const next = parts.reduce((current, part) => takeFromProfile(current, profile, part), data);
	return (draft) => {
		prepare?.(draft);
		for (const part of parts) applyPart(draft, next, part);
	};
}

/** An entry the Profile doesn't have: offered "Save to Profile" in its options, without a marker. */
export function isLocalEntry(data: ResumeData, profile: ProfileData, section: ProfileSectionType, id: string): boolean {
	return profileView(data, profile).comparison.items[section]?.[id] === "local";
}

// Every entry id in a version of the resume, built-in and custom sections alike.
const entryIds = new WeakMap<ResumeData, ReadonlySet<string>>();

function entryIdsOf(data: ResumeData): ReadonlySet<string> {
	const cached = entryIds.get(data);
	if (cached) return cached;
	const ids = new Set<string>();
	for (const section of Object.values(data.sections))
		for (const item of section.items as { id: string }[]) ids.add(item.id);
	for (const section of data.customSections) for (const item of section.items as { id: string }[]) ids.add(item.id);
	entryIds.set(data, ids);
	return ids;
}

/**
 * The Profile entries a section of the resume doesn't have, in the Profile's order. An entry the resume keeps anywhere
 * else (moved into a custom section, say) still counts as had: adding it again would give two entries one id.
 */
export function missingFromProfile(data: ResumeData, profile: ProfileData, section: ProfileSectionType): string[] {
	const missing = profileView(data, profile).comparison.missing[section] ?? [];
	const ids = entryIdsOf(data);
	return missing.filter((id) => !ids.has(id));
}

/**
 * The sections Add section can fill from the Profile: those the resume doesn't use yet that the Profile has content
 * for, with how many entries come along (the summary counts as one).
 */
export function sectionsFromProfile(
	profile: ProfileData,
	unused: readonly ("summary" | ProfileSectionType)[],
): { type: "summary" | ProfileSectionType; count: number }[] {
	return unused
		.map((type) => ({
			type,
			count: type === "summary" ? (isBlank(stripHtml(profile.summary.content)) ? 0 : 1) : profile.sections[type].length,
		}))
		.filter((entry) => entry.count > 0);
}

/** The parts that bring a whole section over from the Profile. */
export function sectionParts(profile: ProfileData, type: "summary" | ProfileSectionType): ProfilePart[] {
	if (type === "summary") return [{ kind: "summary" }];
	return (profile.sections[type] as { id: string }[]).map((item) => ({ kind: "item", section: type, id: item.id }));
}

const PREVIEW_LENGTH = 160;

/** The Profile's version of a part as a short line of text (the picture has none: show its address as an image). */
export function profilePreview(profile: ProfileData, part: ProfilePart): string {
	let preview: string;
	if (part.kind === "picture") preview = "";
	else if (part.kind === "item") {
		const item = partValue(profile, part) as Entry | undefined;
		const described = item ? describeEntry(part.section, item) : null;
		preview = described ? [described.title, described.meta].filter(Boolean).join(" · ") : "";
	} else if (part.kind === "basics" && part.field === "website") preview = profile.basics.website.url;
	else if (part.kind === "basics" && part.field === "customFields")
		preview = profile.basics.customFields.map((field) => field.text).join(" · ");
	else preview = String(partValue(profile, part) ?? "");
	return preview.length > PREVIEW_LENGTH ? `${preview.slice(0, PREVIEW_LENGTH)}…` : preview;
}
