import type { SourceRuns } from "@/features/profile/sources/model";

/** Onboarding's steps, in order: bring what you have, two questions, review, first resume. */
export const ONBOARDING_STEPS = ["bring", "questions", "review", "resume"] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

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
