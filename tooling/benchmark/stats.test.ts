import { describe, expect, it } from "vite-plus/test";
import {
	costMicros,
	detectLanguage,
	newNumbers,
	percentile,
	placeholders,
	readable,
	REALISTIC_MIX,
	simulatePlan,
} from "./stats";

const LAUNCH_WEIGHTS = {
	"short-text": 1,
	"draft-answer": 2,
	"cover-letter": 3,
	"interview-practice": 3,
	"coach-turn": 3,
	review: 4,
	"tailor-resume": 5,
	"import-document": 5,
};

describe("percentile", () => {
	it("takes the nearest rank", () => {
		const values = [5, 1, 4, 2, 3, 6, 7, 8, 9, 10];
		expect(percentile(values, 50)).toBe(5);
		expect(percentile(values, 95)).toBe(10);
		expect(percentile([3], 95)).toBe(3);
		expect(percentile([], 50)).toBeNull();
	});
});

describe("costMicros", () => {
	it("prices tokens per million", () => {
		expect(costMicros("claude-haiku-5-5", { input: 10_000, output: 2_000 })).toBe(2_000);
		expect(costMicros("claude-sonnet-5-5", { input: 10_000, output: 2_000 })).toBe(40_000);
		expect(costMicros("unknown-model", { input: 1, output: 1 })).toBeNull();
	});

	it("charges Haiku's long-context price for one call over the threshold, and as an upper bound for agent runs", () => {
		expect(costMicros("claude-haiku-5-5", { input: 120_000, output: 1_000 })).toBe(62_500);
		expect(costMicros("claude-haiku-5-5", { input: 120_000, output: 1_000 }, { calls: 3 })).toBe(12_500);
		expect(costMicros("claude-haiku-5-5", { input: 120_000, output: 1_000 }, { calls: 3, upperBound: true })).toBe(
			62_500,
		);
	});
});

describe("simulatePlan", () => {
	const costs = Object.fromEntries(
		Object.keys(LAUNCH_WEIGHTS).map((action) => [action, { p50: 1_000, p95: 2_000, max: 3_000 }]),
	);

	it("spends exactly the plan's credits in the realistic mix at launch weights", () => {
		const total = Object.entries(REALISTIC_MIX).reduce(
			(sum, [action, count]) => sum + count * (LAUNCH_WEIGHTS[action as keyof typeof LAUNCH_WEIGHTS] ?? 0),
			0,
		);
		expect(total).toBe(100);
		const [realistic] = simulatePlan(costs, LAUNCH_WEIGHTS);
		expect(realistic?.credits).toBe(100);
		expect(realistic?.p95).toBe(36 * 2_000);
	});

	it("puts every credit on the action that costs most per credit at P95", () => {
		const heavy = { ...costs, "draft-answer": { p50: 5_000, p95: 9_000, max: 9_500 } };
		const [, heaviest] = simulatePlan(heavy, LAUNCH_WEIGHTS);
		expect(heaviest?.name).toBe("heaviest (draft-answer)");
		expect(heaviest?.runs).toEqual({ "draft-answer": 50 });
		expect(heaviest?.p95).toBe(450_000);
	});
});

describe("quality checks", () => {
	it("tells Indonesian from English", () => {
		expect(detectLanguage("Saya bertanggung jawab untuk laporan keuangan dan pajak di perusahaan ini.")).toBe("id");
		expect(detectLanguage("I was responsible for the monthly reports and the tax filings.")).toBe("en");
		expect(detectLanguage("OK")).toBe("unknown");
	});

	it("finds template gaps but not markdown links", () => {
		expect(placeholders("Dear [Hiring Manager], at {{company}} and <Nama Perusahaan>")).toHaveLength(3);
		expect(placeholders("See [the guide](https://example.test)")).toHaveLength(0);
	});

	it("finds numbers the source never stated", () => {
		expect(newNumbers("Raised sales 30% across 12 stores", "Managed 12 stores")).toEqual(["30"]);
		expect(newNumbers("Rp1.500.000 per bulan", "Gaji Rp1.500.000")).toEqual([]);
	});

	it("flattens structured output into readable lines", () => {
		expect(readable({ summary: "Good", gaps: ["SQL", "Excel"], empty: [] })).toBe(
			"summary: Good\ngaps:\n  - SQL\n  - Excel",
		);
	});
});
