import type { ApplicationRecord } from "./applications";
import { describe, expect, it } from "vite-plus/test";
import { computeInsights, computeOutcomes, computePipeline, computeTimeline, countSources } from "./insights";

const stage = (stage: string, at: string) => ({ id: `${stage}-${at}`, type: "stage", stage, at: new Date(at) });

const app = (patch: Partial<ApplicationRecord>) =>
	({
		status: "applied",
		closedReason: null,
		activity: [],
		appliedAt: "2026-11-02T09:00:00Z",
		resumeId: null,
		source: null,
		...patch,
	}) as ApplicationRecord;

describe("insights", () => {
	const items = [
		app({
			status: "interview",
			activity: [stage("applied", "2026-11-02T09:00:00Z"), stage("interview", "2026-11-06T09:00:00Z")] as never,
			resumeId: "tailored",
			source: "LinkedIn",
		}),
		app({
			status: "applied",
			activity: [stage("applied", "2026-11-10T09:00:00Z")] as never,
			resumeId: "base",
			source: "LinkedIn",
		}),
		app({
			status: "closed",
			closedReason: "not-selected",
			activity: [stage("applied", "2026-11-03T09:00:00Z"), stage("closed", "2026-11-05T09:00:00Z")] as never,
			source: "Referral",
		}),
		app({ status: "saved" }),
	];

	it("counts how far applications got and how fast they heard back", () => {
		const outcomes = computeOutcomes(items, (item) => item.resumeId === "tailored");
		expect(outcomes.sent).toBe(3);
		expect(outcomes.heardBack).toBe(2);
		expect(outcomes.medianDaysToReply).toBe(3);
		expect(outcomes.funnel).toEqual([
			{ status: "applied", reached: 3 },
			{ status: "screening", reached: 1 },
			{ status: "interview", reached: 1 },
			{ status: "offer", reached: 0 },
		]);
		expect(outcomes.tailored).toEqual({ sent: 1, replied: 1 });
		expect(outcomes.base).toEqual({ sent: 1, replied: 0 });
	});

	it("buckets sent applications by week on the user's clock", () => {
		const weeks = computeTimeline(items, {
			now: new Date("2026-11-20T12:00:00Z"),
			timeZone: "America/Los_Angeles",
			weekStartsOn: 1,
			weeks: 3,
		});
		expect(weeks).toEqual([
			{ start: "2026-11-02", count: 2 },
			{ start: "2026-11-09", count: 1 },
			{ start: "2026-11-16", count: 0 },
		]);
	});

	it("gives the pipeline, the server-count funnel and sources", () => {
		const pipeline = computePipeline(items);
		expect(pipeline.active).toBe(3);
		expect(pipeline.steps.map((step) => step.reached)).toEqual([3, 2, 1, 1, 0]);
		const funnel = computeInsights([
			{ status: "applied", count: 2 },
			{ status: "interview", count: 1 },
			{ status: "closed", count: 4 },
		]);
		expect(funnel.total).toBe(3);
		expect(funnel.closed).toBe(4);
		expect(funnel.funnel[1]).toMatchObject({ status: "applied", reached: 3, conv: "100%" });
		expect(countSources(items)).toEqual([
			{ source: "LinkedIn", count: 2 },
			{ source: "Referral", count: 1 },
		]);
	});
});
