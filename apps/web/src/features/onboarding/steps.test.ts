import type { SourceRuns } from "@/features/profile/sources/model";
import type { Template } from "@rezumi/schema/templates";
import { describe, expect, it, vi } from "vite-plus/test";
import { FREE_TEMPLATES } from "@rezumi/schema/billing";
import { templateLineup } from "@rezumi/schema/templates";
import { answersOf, sameAnswers } from "./questions";
import { needsOnboarding, shouldStartOnboarding } from "./redirect";
import { nextStep, previousStep, skipSaves } from "./steps";
import { FIRST_TEMPLATES, offeredTemplates } from "./template-choice";

vi.mock("@/libs/orpc/client", () => ({
	orpc: {
		profile: { get: { queryOptions: () => ({ queryKey: ["profile"] }) } },
		documents: { list: { queryOptions: () => ({ queryKey: ["documents"] }) } },
	},
}));
vi.mock("@/features/profile/queries", () => ({ profileQueryOptions: () => ({ queryKey: ["profile"] }) }));

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

	const session = (isAnonymous: boolean) => ({ user: { isAnonymous } }) as never;
	const client = (profile: unknown, documents: unknown[] | Error) =>
		({
			ensureQueryData: vi.fn(async ({ queryKey }: { queryKey: string[] }) => {
				if (queryKey[0] === "profile") return profile;
				if (documents instanceof Error) throw documents;
				return documents;
			}),
		}) as never;

	it("reads the documents only for a Profile never saved", async () => {
		const saved = client({ updatedAt: new Date() }, []);
		expect(await shouldStartOnboarding(saved, session(false))).toBe(false);
		expect((saved as { ensureQueryData: ReturnType<typeof vi.fn> }).ensureQueryData).toHaveBeenCalledTimes(1);
		expect(await shouldStartOnboarding(client({ updatedAt: null }, []), session(false))).toBe(true);
		expect(await shouldStartOnboarding(client({ updatedAt: null }, [{ id: "r1" }]), session(false))).toBe(false);
	});

	it("never sends guests or signed-out visitors, and lets Home open when a read fails", async () => {
		expect(await shouldStartOnboarding(client({ updatedAt: null }, []), session(true))).toBe(false);
		expect(await shouldStartOnboarding(client({ updatedAt: null }, []), null)).toBe(false);
		expect(await shouldStartOnboarding(client({ updatedAt: null }, new Error("offline")), session(false))).toBe(false);
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
