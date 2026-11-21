// An onboarding picked up again: the app can be closed at any step (a call, a crash, the system freeing memory), and
// the next launch opens it where it was. Kept per account on this device only; what a source found stays here until
// the person reviews it, as the web keeps it in the page. The chosen file itself isn't kept, only what it gave.
import type { OnboardingAnswers, OnboardingStep } from "@rezumi/career/onboarding";
import type { SourceRun, SourceRuns } from "@rezumi/resume/profile-sources";
import type { Template } from "@rezumi/schema/templates";
import { isOnboardingStep } from "@rezumi/career/onboarding";
import { SOURCE_IDS } from "@rezumi/resume/profile-sources";
import { templateSchema } from "@rezumi/schema/templates";

export type SavedOnboarding = {
	step: OnboardingStep;
	inputs: { linkedin: string; linkedinOwn: boolean; github: string; website: string };
	answers: OnboardingAnswers;
	/** Only finished sources: one still loading or failed is run again from its field. */
	runs: SourceRuns;
	excluded: string[];
	/** The photo picked in review: undefined until picked, null for none. */
	photo?: string | null | undefined;
	template: Template;
	/** The Profile version onboarding saved (ISO), null until it saved: then the first resume is all that's left. */
	savedAt: string | null;
};

export type KeyValueStorage = {
	getItemSync: (key: string) => string | null;
	setItemSync: (key: string, value: string) => void;
	removeItemSync: (key: string) => void;
};

const keyOf = (scope: string) => `onboarding:${scope}`;

const strings = (value: unknown): string[] =>
	Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const text = (value: unknown) => (typeof value === "string" ? value : "");

const finished = (runs: unknown): SourceRuns => {
	if (!runs || typeof runs !== "object") return {};
	const kept: SourceRuns = {};
	for (const id of SOURCE_IDS) {
		const run = (runs as Record<string, SourceRun | undefined>)[id];
		if (run?.status === "done" && typeof run.key === "string" && run.result?.data) kept[id] = run;
	}
	return kept;
};

/** Reads a saved run back, or null when there is none or it can't be trusted (another version, damaged). */
export function parseSavedOnboarding(raw: string | null): SavedOnboarding | null {
	if (!raw) return null;
	let value: Record<string, unknown>;
	try {
		value = JSON.parse(raw) as Record<string, unknown>;
	} catch {
		return null;
	}
	if (!value || typeof value !== "object" || value.v !== 1 || !isOnboardingStep(value.step)) return null;
	const inputs = (value.inputs ?? {}) as Record<string, unknown>;
	const answers = (value.answers ?? {}) as Record<string, unknown>;
	const template = templateSchema.safeParse(value.template);
	if (!template.success) return null;
	const days = answers.maxOfficeDays;
	return {
		step: value.step,
		inputs: {
			linkedin: text(inputs.linkedin),
			linkedinOwn: inputs.linkedinOwn === true,
			github: text(inputs.github),
			website: text(inputs.website),
		},
		answers: {
			targetRoles: strings(answers.targetRoles),
			locations: strings(answers.locations),
			maxOfficeDays: typeof days === "number" && Number.isInteger(days) && days >= 0 && days <= 5 ? days : null,
		},
		runs: finished(value.runs),
		excluded: strings(value.excluded),
		...(value.photo === null || typeof value.photo === "string" ? { photo: value.photo } : {}),
		template: template.data,
		savedAt: typeof value.savedAt === "string" ? value.savedAt : null,
	};
}

export function loadSavedOnboarding(storage: KeyValueStorage, scope: string | null): SavedOnboarding | null {
	if (!scope) return null;
	try {
		return parseSavedOnboarding(storage.getItemSync(keyOf(scope)));
	} catch {
		return null;
	}
}

/** Saves the run; a full or failing store only means it can't be picked up again. */
export function storeSavedOnboarding(storage: KeyValueStorage, scope: string | null, saved: SavedOnboarding) {
	if (!scope) return;
	try {
		storage.setItemSync(keyOf(scope), JSON.stringify({ v: 1, ...saved, runs: finished(saved.runs) }));
	} catch {
		// Nothing to do: the run goes on, it just won't come back after a restart.
	}
}

export function clearSavedOnboarding(storage: KeyValueStorage, scope: string | null) {
	if (!scope) return;
	try {
		storage.removeItemSync(keyOf(scope));
	} catch {
		// Left behind: the next check drops it once the account has documents or a saved Profile.
	}
}
