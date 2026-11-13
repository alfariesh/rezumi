import type { ProfileBasicsField, ProfileData, ProfileSectionType } from "@rezumi/schema/profile/data";
import type { SourceResult } from "@rezumi/schema/profile/sources";
import { ORPCError } from "@orpc/client";
import { isBlank, mergeProfileData, sameContent } from "@rezumi/resume/profile";
import { PROFILE_BASICS_FIELDS, PROFILE_SECTION_TYPES } from "@rezumi/schema/profile/data";
import { gitHubLogin, linkedInProfileId } from "@rezumi/schema/profile/sources";
import { stripHtml } from "@rezumi/utils/string";

/**
 * Filling the Profile from what a person already has: a resume file, a LinkedIn profile, a GitHub account, a personal
 * website. Each source runs on its own and may fail on its own; what they find is merged over the Profile in this
 * order (an earlier source's version of an entry wins) and shown for review before anything is saved.
 */
export const SOURCE_IDS = ["file", "linkedin", "github", "website"] as const;

export type SourceId = (typeof SOURCE_IDS)[number];

/** What the person entered. Empty text means the source isn't used. */
export type SourceInputs = {
	file: File | null;
	linkedin: string;
	/** "This is my own profile": LinkedIn runs only with it. */
	linkedinOwn: boolean;
	github: string;
	website: string;
};

export const emptySourceInputs = (github = ""): SourceInputs => ({
	file: null,
	linkedin: "",
	linkedinOwn: false,
	github,
	website: "",
});

/** The sources this account and server offer (`profile.sources.status`); a file is always offered. */
export type SourceAvailability = { linkedin: boolean; github: boolean; website: boolean };

export type SourceRequest =
	| { id: "file"; key: string; file: File }
	| { id: "linkedin"; key: string; url: string }
	| { id: "github"; key: string; username: string }
	| { id: "website"; key: string; url: string };

/** Why a filled-in source can't run as entered. */
export type SourceInputProblem = "invalid" | "unconfirmed";

/** A personal website's address from what was typed (`yourname.com`, with or without https://), or null. */
export function websiteAddress(input: string): string | null {
	const text = input.trim();
	if (!text || text.length > 2000 || /\s/.test(text)) return null;
	let url: URL;
	try {
		url = new URL(/^[a-z][\d+.a-z-]*:\/\//i.test(text) ? text : `https://${text}`);
	} catch {
		return null;
	}
	if (!/^https?:$/.test(url.protocol) || url.username || url.password) return null;
	// A public site has a name with a dot in it: "localhost" or a bare word is a typo, not a website.
	if (!/^[^.]+(\.[^.]+)+$/.test(url.hostname)) return null;
	return url.toString();
}

const fileKey = (file: File) => `${file.name}:${file.size}:${file.lastModified}`;

/** The sources to run for what was entered, in merge order, with the problems of those that can't run yet. */
export function readSourceInputs(inputs: SourceInputs, availability: SourceAvailability) {
	const requests: SourceRequest[] = [];
	const problems: Partial<Record<SourceId, SourceInputProblem>> = {};

	if (inputs.file) requests.push({ id: "file", key: fileKey(inputs.file), file: inputs.file });

	if (availability.linkedin && inputs.linkedin.trim()) {
		const id = linkedInProfileId(inputs.linkedin);
		if (!id) problems.linkedin = "invalid";
		else if (!inputs.linkedinOwn) problems.linkedin = "unconfirmed";
		else requests.push({ id: "linkedin", key: id.toLowerCase(), url: inputs.linkedin.trim() });
	}

	if (availability.github && inputs.github.trim()) {
		const login = gitHubLogin(inputs.github);
		if (login) requests.push({ id: "github", key: login.toLowerCase(), username: login });
		else problems.github = "invalid";
	}

	if (availability.website && inputs.website.trim()) {
		const url = websiteAddress(inputs.website);
		if (url) requests.push({ id: "website", key: url, url });
		else problems.website = "invalid";
	}

	return { requests, problems };
}

/** Whether anything was entered at all, valid or not. */
export const hasSourceInput = (inputs: SourceInputs, availability: SourceAvailability) =>
	Boolean(
		inputs.file ||
		(availability.linkedin && inputs.linkedin.trim()) ||
		(availability.github && inputs.github.trim()) ||
		(availability.website && inputs.website.trim()),
	);

export type SourceRun =
	| { status: "loading"; key: string }
	| { status: "done"; key: string; result: SourceResult }
	| { status: "failed"; key: string; error: unknown };

export type SourceRuns = Partial<Record<SourceId, SourceRun>>;

/** What has to run (again): sources that are new, whose input changed, or that failed. Running or found ones stay. */
export const requestsToRun = (requests: SourceRequest[], runs: SourceRuns) =>
	requests.filter((request) => {
		const run = runs[request.id];
		return !run || run.key !== request.key || run.status === "failed";
	});

/** The runs still wanted: a source cleared since it ran is dropped, so its result isn't merged. */
export const keepRequested = (runs: SourceRuns, requests: SourceRequest[]): SourceRuns =>
	Object.fromEntries(
		requests.flatMap((request) => {
			const run = runs[request.id];
			return run && run.key === request.key ? [[request.id, run]] : [];
		}),
	);

export const isFetching = (runs: SourceRuns) => Object.values(runs).some((run) => run?.status === "loading");

/** What every finished source found, merged over `base` in source order. */
export const mergeSourceResults = (base: ProfileData, runs: SourceRuns): ProfileData =>
	SOURCE_IDS.reduce((data, id) => {
		const run = runs[id];
		return run?.status === "done" ? mergeProfileData(data, run.result.data) : data;
	}, base);

/** What one source found, to say it in a line: filled details, a summary, and entries by section. */
export function sourceFindings(data: ProfileData) {
	return {
		details: PROFILE_BASICS_FIELDS.filter((field) => !isBlank(data.basics[field])).length,
		summary: Boolean(stripHtml(data.summary.content).trim()),
		sections: PROFILE_SECTION_TYPES.map((type) => ({ type, count: data.sections[type].length })).filter(
			(section) => section.count > 0,
		),
	};
}

export type PhotoSource = "account" | SourceId;

export type PhotoCandidate = { source: PhotoSource; url: string };

/**
 * The photos the Profile could take, while it has none: the LinkedIn photo, the account's own (from signing in), then
 * what the other sources found. The same picture is offered once.
 */
export function photoCandidates(base: ProfileData, runs: SourceRuns, accountImage: string | null): PhotoCandidate[] {
	if (base.picture.url.trim()) return [];
	const found = (id: SourceId) => {
		const run = runs[id];
		if (run?.status !== "done") return [];
		return [run.result.photoUrl, run.result.data.picture.url].flatMap((url) =>
			url?.trim() ? [{ source: id, url: url.trim() }] : [],
		);
	};
	const candidates: PhotoCandidate[] = [
		...found("linkedin"),
		...(accountImage?.trim() ? [{ source: "account" as const, url: accountImage.trim() }] : []),
		...found("file"),
		...found("github"),
		...found("website"),
	];
	return candidates.filter((candidate, index) => candidates.findIndex((item) => item.url === candidate.url) === index);
}

type ReviewGroupId = "details" | "summary" | ProfileSectionType;

export type ReviewEntry =
	| { key: `basics:${ProfileBasicsField}`; kind: "basics"; field: ProfileBasicsField }
	| { key: "summary"; kind: "summary" }
	| { key: `item:${string}`; kind: "item"; section: ProfileSectionType; id: string };

export type ReviewGroup = { id: ReviewGroupId; entries: ReviewEntry[] };

/**
 * What the sources add to the Profile, by part: changed details, the summary, then each section's new entries. What
 * the Profile already had isn't listed; it stays as it is.
 */
export function reviewGroups(base: ProfileData, merged: ProfileData): ReviewGroup[] {
	const details: ReviewEntry[] = PROFILE_BASICS_FIELDS.filter(
		(field) => !sameContent(base.basics[field], merged.basics[field]),
	).map((field) => ({ key: `basics:${field}`, kind: "basics", field }));
	const summary: ReviewEntry[] =
		base.summary.content === merged.summary.content ? [] : [{ key: "summary", kind: "summary" }];
	const sections = PROFILE_SECTION_TYPES.map((section): ReviewGroup => {
		const had = new Set(base.sections[section].map((item) => item.id));
		return {
			id: section,
			entries: merged.sections[section]
				.filter((item) => !had.has(item.id))
				.map((item) => ({ key: `item:${item.id}`, kind: "item", section, id: item.id })),
		};
	});
	return [
		{ id: "details" as const, entries: details },
		{ id: "summary" as const, entries: summary },
		...sections,
	].filter((group) => group.entries.length > 0);
}

export const countReviewEntries = (groups: ReviewGroup[], excluded: ReadonlySet<string> = new Set()) =>
	groups.reduce((total, group) => total + group.entries.filter((entry) => !excluded.has(entry.key)).length, 0);

/**
 * The Profile to save: what the sources added, without the entries the person unticked. The photo stays as it was;
 * a chosen one is copied and set separately (`profile.sources.adoptPhoto`).
 */
export function applyReview(base: ProfileData, merged: ProfileData, excluded: ReadonlySet<string>): ProfileData {
	const next = structuredClone(merged);
	next.picture = structuredClone(base.picture);
	for (const field of PROFILE_BASICS_FIELDS) {
		if (excluded.has(`basics:${field}`))
			(next.basics as Record<string, unknown>)[field] = structuredClone(base.basics[field]);
	}
	if (excluded.has("summary")) next.summary = structuredClone(base.summary);
	for (const section of PROFILE_SECTION_TYPES) {
		const items = next.sections[section] as { id: string }[];
		(next.sections as Record<string, unknown>)[section] = items.filter((item) => !excluded.has(`item:${item.id}`));
	}
	return next;
}

// Codes where trying the same input again can't help: the input, the account or the plan has to change first.
const FINAL_CODES = new Set([
	"SOURCE_INVALID",
	"SOURCE_NOT_FOUND",
	"SOURCE_LIMIT",
	"SOURCE_UNAVAILABLE",
	"INSUFFICIENT_CREDITS",
	"AI_SOURCE_REQUIRED",
	"REZUMI_AI_UNAVAILABLE",
	"BAD_REQUEST",
	"FORBIDDEN",
	"PAYMENT_REQUIRED",
]);

/** Whether Retry is worth offering: a provider or the network failed, not the input or the account. */
export function canRetrySource(error: unknown): boolean {
	if (error instanceof ORPCError) return !FINAL_CODES.has(error.code);
	// A request that never reached the server (offline, a dropped connection).
	return error instanceof TypeError;
}
