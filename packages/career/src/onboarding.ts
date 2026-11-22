import type { SourceRuns } from "@rezumi/resume/profile-sources";
import type { CareerProfileData } from "@rezumi/schema/career";
import type { Template } from "@rezumi/schema/templates";
import { templateLineup } from "@rezumi/schema/templates";

/**
 * The first run after signing up, shared by the web (`/onboarding`) and the app: bring what you have, two questions,
 * review what the sources found, then a template for the first resume. Skip is always there.
 */
export const ONBOARDING_STEPS = ["bring", "questions", "review", "resume"] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const isOnboardingStep = (value: unknown): value is OnboardingStep =>
	typeof value === "string" && (ONBOARDING_STEPS as readonly string[]).includes(value);

const usedSources = (runs: SourceRuns) => Object.keys(runs).length > 0;

/** Starting from scratch has nothing to review: the questions lead straight to the first resume. */
export const nextStep = (step: OnboardingStep, runs: SourceRuns): OnboardingStep | null => {
	if (step === "questions" && !usedSources(runs)) return "resume";
	return ONBOARDING_STEPS[ONBOARDING_STEPS.indexOf(step) + 1] ?? null;
};

export const previousStep = (step: OnboardingStep, runs: SourceRuns): OnboardingStep | null => {
	if (step === "resume" && !usedSources(runs)) return "questions";
	return ONBOARDING_STEPS[ONBOARDING_STEPS.indexOf(step) - 1] ?? null;
};

/**
 * What Skip does: until the Profile was saved in this onboarding it saves the Profile as it stands, so onboarding
 * doesn't open again; after that it just leaves for Home.
 */
export const skipSaves = (savedHere: boolean) => !savedHere;

type OnboardingState = {
	/** Guests are never sent to onboarding: most sources need an account. */
	isGuest: boolean;
	/** The Profile's version: null until it was saved once (onboarding, Skip, or any edit). */
	profileUpdatedAt: Date | null;
	/** Resumes and cover letters not in Trash. */
	documentCount: number;
};

/** A new account opens onboarding instead of Home: signed in for real, Profile never saved, no documents yet. */
export const needsOnboarding = ({ isGuest, profileUpdatedAt, documentCount }: OnboardingState) =>
	!isGuest && profileUpdatedAt === null && documentCount === 0;

/** The two questions onboarding asks while sources load, kept in Preferences (`career.saveProfile`). */
export type OnboardingAnswers = Pick<CareerProfileData, "targetRoles" | "locations" | "maxOfficeDays">;

export const answersOf = (preferences: CareerProfileData): OnboardingAnswers => ({
	targetRoles: preferences.targetRoles,
	locations: preferences.locations,
	maxOfficeDays: preferences.maxOfficeDays,
});

export const sameAnswers = (a: OnboardingAnswers, b: OnboardingAnswers) =>
	a.maxOfficeDays === b.maxOfficeDays &&
	a.targetRoles.join("\n") === b.targetRoles.join("\n") &&
	a.locations.join("\n") === b.locations.join("\n");

/** How many templates show before "More templates": the first ones in gallery order the plan opens. */
export const FIRST_TEMPLATES = 6;

/** The templates offered first, then the rest of the lineup once asked for. The chosen one always shows. */
export function offeredTemplates(locked: (template: Template) => boolean, all: boolean, chosen: Template): Template[] {
	if (all) return [...templateLineup];
	const first = templateLineup.filter((template) => !locked(template)).slice(0, FIRST_TEMPLATES);
	return first.includes(chosen) ? first : [...first, chosen];
}
