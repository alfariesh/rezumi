import type { SourceRuns } from "@rezumi/resume/profile-sources";
import type { Template } from "@rezumi/schema/templates";
import { describe, expect, it } from "vite-plus/test";
import { FREE_TEMPLATES } from "@rezumi/schema/billing";
import { templateLineup } from "@rezumi/schema/templates";
import {
	answersOf,
	FIRST_TEMPLATES,
	isOnboardingStep,
	needsOnboarding,
	nextStep,
	offeredTemplates,
	previousStep,
	sameAnswers,
	skipSaves,
} from "./onboarding";

const someSource: SourceRuns = { github: { status: "loading", key: "dewi-dev" } };

describe("steps", () => {
	it("goes through review when a source ran", () => {
		expect(nextStep("bring", someSource)).toBe("questions");
		expect(nextStep("questions", someSource)).toBe("review");
		expect(nextStep("review", someSource)).toBe("resume");
		expect(nextStep("resume", someSource)).toBeNull();
		expect(previousStep("resume", someSource)).toBe("review");
		expect(previousStep("bring", someSource)).toBeNull();
	});

	it("skips review when starting from scratch, both ways", () => {
		expect(nextStep("questions", {})).toBe("resume");
		expect(previousStep("resume", {})).toBe("questions");
	});

	it("saves the Profile on Skip only until onboarding saved it", () => {
		expect(skipSaves(false)).toBe(true);
		expect(skipSaves(true)).toBe(false);
	});

	it("knows its own steps, for a run picked up again", () => {
		expect(isOnboardingStep("review")).toBe(true);
		expect(isOnboardingStep("done")).toBe(false);
		expect(isOnboardingStep(2)).toBe(false);
	});
});

describe("when onboarding opens", () => {
	it("opens for a signed-up account with a Profile never saved and no documents", () => {
		expect(needsOnboarding({ isGuest: false, profileUpdatedAt: null, documentCount: 0 })).toBe(true);
	});

	it("stays closed for guests, saved Profiles and accounts with documents", () => {
		expect(needsOnboarding({ isGuest: true, profileUpdatedAt: null, documentCount: 0 })).toBe(false);
		expect(needsOnboarding({ isGuest: false, profileUpdatedAt: new Date(), documentCount: 0 })).toBe(false);
		expect(needsOnboarding({ isGuest: false, profileUpdatedAt: null, documentCount: 2 })).toBe(false);
	});
});

describe("questions", () => {
	it("compares only what the two questions ask", () => {
		const preferences = { targetRoles: ["Designer"], locations: [], maxOfficeDays: null } as never;
		const answers = answersOf(preferences);
		expect(sameAnswers(answers, { ...answers })).toBe(true);
		expect(sameAnswers(answers, { ...answers, maxOfficeDays: 0 })).toBe(false);
		expect(sameAnswers(answers, { ...answers, locations: ["Bandung"] })).toBe(false);
	});
});

describe("first resume templates", () => {
	const lockedUnlessFree = (template: Template) => !(FREE_TEMPLATES as readonly Template[]).includes(template);

	it("offers the first templates the plan opens, then the whole lineup on request", () => {
		const first = offeredTemplates(lockedUnlessFree, false, "meridian");
		expect(first.length).toBeLessThanOrEqual(FIRST_TEMPLATES);
		expect(first.every((template) => !lockedUnlessFree(template))).toBe(true);
		expect(offeredTemplates(lockedUnlessFree, true, "meridian")).toEqual([...templateLineup]);
	});

	it("keeps the chosen template in view", () => {
		const chosen = templateLineup.at(-1) as Template;
		expect(offeredTemplates(() => false, false, chosen)).toContain(chosen);
	});
});
