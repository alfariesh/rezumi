import type { ProfileBasicsField, ProfileData, ProfileSectionType } from "@rezumi/schema/profile/data";
import type { SourceResult } from "@rezumi/schema/profile/sources";
import { PROFILE_BASICS_FIELDS, PROFILE_SECTION_TYPES } from "@rezumi/schema/profile/data";
import { gitHubLogin, linkedInProfileId } from "@rezumi/schema/profile/sources";
import { stripHtml } from "@rezumi/utils/string";
import { isBlank, mergeProfileData, sameContent } from "./profile";

/**
 * Filling the Profile from what a person already has: a resume file, a LinkedIn profile, a GitHub account, a personal
 * website. Each source runs on its own and may fail on its own; what they find is merged over the Profile in this
 * order (an earlier source's version of an entry wins) and shown for review before anything is saved. Shared by the
 * web's onboarding and Profile, and the app's onboarding: the file is the platform's own (a browser `File`, a picked
 * document), so the types take it as a parameter.
 */
export const SOURCE_IDS = ["file", "linkedin", "github", "website"] as const;

export type SourceId = (typeof SOURCE_IDS)[number];

/** A chosen resume file as far as these rules need it: a browser `File` or an app's picked document both fit. */
export type SourceFile = { name: string; size?: number | null; lastModified?: number | null; uri?: string };

/** What the person entered. Empty text means the source isn't used. */
export type SourceInputs<F extends SourceFile = SourceFile> = {
	file: F | null;
	linkedin: string;
	/** "This is my own profile": LinkedIn runs only with it. */
	linkedinOwn: boolean;
	github: string;
	website: string;
};

export const emptySourceInputs = <F extends SourceFile = SourceFile>(github = ""): SourceInputs<F> => ({
	file: null,
	linkedin: "",
	linkedinOwn: false,
	github,
	website: "",
});

/** The sources this account and server offer (`profile.sources.status`); a file is always offered. */
export type SourceAvailability = { linkedin: boolean; github: boolean; website: boolean };

export type SourceRequest<F extends SourceFile = SourceFile> =
	| { id: "file"; key: string; file: F }
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

// The same file chosen again keeps its key, so a found result isn't read twice.
const fileKey = (file: SourceFile) => `${file.name}:${file.size ?? ""}:${file.lastModified ?? file.uri ?? ""}`;

/** The sources to run for what was entered, in merge order, with the problems of those that can't run yet. */
export function readSourceInputs<F extends SourceFile>(inputs: SourceInputs<F>, availability: SourceAvailability) {
	const requests: SourceRequest<F>[] = [];
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
export const hasSourceInput = (inputs: SourceInputs<SourceFile>, availability: SourceAvailability) =>
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
export const requestsToRun = <R extends SourceRequest<SourceFile>>(requests: R[], runs: SourceRuns) =>
	requests.filter((request) => {
		const run = runs[request.id];
		return !run || run.key !== request.key || run.status === "failed";
	});

/** The runs still wanted: a source cleared since it ran is dropped, so its result isn't merged. */
export const keepRequested = (runs: SourceRuns, requests: SourceRequest<SourceFile>[]): SourceRuns =>
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

/** The code of a server error (oRPC's `ORPCError`, read by shape so this stays free of the client), else null. */
export function sourceErrorCode(error: unknown): string | null {
	if (!(error instanceof Error) || error.name === "AbortError") return null;
	const code = (error as { code?: unknown }).code;
	return typeof code === "string" ? code : null;
}

/** Whether Retry is worth offering: a provider or the network failed, not the input or the account. */
export function canRetrySource(error: unknown): boolean {
	const code = sourceErrorCode(error);
	if (code !== null) return !FINAL_CODES.has(code);
	// A request that never reached the server (offline, a dropped connection).
	return error instanceof TypeError;
}

/** The photo kept: the one picked while it's still offered, else the first one offered (null: none). */
export function keptPhoto(photos: PhotoCandidate[], choice: string | null | undefined): string | null {
	if (choice === undefined || (choice !== null && !photos.some((candidate) => candidate.url === choice)))
		return photos[0]?.url ?? null;
	return choice;
}

/** A field's problem goes as soon as it's edited; the rest wait for the next try. */
export function clearEditedProblems(
	problems: Partial<Record<SourceId, SourceInputProblem>>,
	patch: Partial<SourceInputs<SourceFile>>,
): Partial<Record<SourceId, SourceInputProblem>> {
	const next = { ...problems };
	if ("linkedin" in patch || "linkedinOwn" in patch) delete next.linkedin;
	if ("github" in patch) delete next.github;
	if ("website" in patch) delete next.website;
	return next;
}

/**
 * The reviewed Profile with the kept photo in: a file's own picture as it is, anything else copied into the account's
 * uploads first (`copy`, which is `profile.sources.adoptPhoto`), so the Profile never points at someone else's server.
 * `copied` remembers copies, so saving again doesn't copy twice. A photo that can't be copied is left out
 * (`photoFailed`), and the rest still goes in.
 */
export async function withKeptPhoto(
	data: ProfileData,
	candidate: PhotoCandidate | null,
	copied: Map<string, string>,
	copy: (url: string) => Promise<string>,
): Promise<{ data: ProfileData; photoFailed: boolean }> {
	if (!candidate) return { data, photoFailed: false };
	try {
		const url = copied.get(candidate.url) ?? (candidate.source === "file" ? candidate.url : await copy(candidate.url));
		copied.set(candidate.url, url);
		return { data: { ...data, picture: { ...data.picture, url } }, photoFailed: false };
	} catch {
		return { data, photoFailed: true };
	}
}

/** Reads one source; passed with each run, so it is always the caller's latest (its AI choice, its file reader). */
export type SourceFetch<F extends SourceFile> = (request: SourceRequest<F>) => Promise<SourceResult>;

type SourceRunnerOptions<F extends SourceFile> = {
	/** Every change to the runs, in order. */
	onChange: (runs: SourceRuns) => void;
	/** A run of the latest attempt failed (to explain plan or credit refusals the platform's way). */
	onError?: (error: unknown, request: SourceRequest<F>) => void;
	/** Runs kept from before (an onboarding picked up again): finished ones stay, nothing restarts. */
	initial?: SourceRuns;
};

/**
 * Runs the chosen sources side by side. Each has its own state (loading, done or failed) and its own Retry; a newer
 * run of a source drops what an older one brings back, and so does clearing the source meanwhile. Nothing is saved:
 * results wait for review. The web and the app wrap it in their own hook.
 */
export function createSourceRunner<F extends SourceFile>(options: SourceRunnerOptions<F>) {
	const attempts = new Map<SourceId, number>();
	const requests = new Map<SourceId, SourceRequest<F>>();
	let read: SourceFetch<F> | null = null;
	let latest: SourceRuns = options.initial ?? {};
	const update = (change: (previous: SourceRuns) => SourceRuns) => {
		latest = change(latest);
		options.onChange(latest);
	};

	const settle = (id: SourceId, attempt: number, run: SourceRun) => {
		if (attempts.get(id) !== attempt) return;
		update((previous) => ({ ...previous, [id]: run }));
	};

	const start = (request: SourceRequest<F>, fetch: SourceFetch<F>) => {
		const attempt = (attempts.get(request.id) ?? 0) + 1;
		attempts.set(request.id, attempt);
		requests.set(request.id, request);
		update((previous) => ({ ...previous, [request.id]: { status: "loading", key: request.key } }));
		// A fetch that throws before its promise still settles as a failed run.
		Promise.resolve()
			.then(() => fetch(request))
			.then(
				(result) => settle(request.id, attempt, { status: "done", key: request.key, result }),
				(error: unknown) => {
					if (attempts.get(request.id) !== attempt) return;
					options.onError?.(error, request);
					settle(request.id, attempt, { status: "failed", key: request.key, error });
				},
			);
	};

	return {
		runs: () => latest,
		/** Starts what's new, changed or failed in `wanted`, and forgets sources no longer wanted. */
		run: (wanted: SourceRequest<F>[], fetch: SourceFetch<F>) => {
			read = fetch;
			const pending = requestsToRun(wanted, latest);
			const kept = new Set(wanted.map((request) => request.id));
			// A source cleared while it runs: its answer no longer matches the latest attempt, so it's dropped.
			for (const [id, attempt] of attempts) if (!kept.has(id)) attempts.set(id, attempt + 1);
			update((previous) => keepRequested(previous, wanted));
			for (const request of pending) start(request, fetch);
		},
		/** Runs a source again with what it was last run with; a source never run here does nothing. */
		retry: (id: SourceId, fetch: SourceFetch<F> | null = read) => {
			const request = requests.get(id);
			if (request && fetch) start(request, fetch);
		},
	};
}

export type SourceRunner<F extends SourceFile = SourceFile> = ReturnType<typeof createSourceRunner<F>>;
