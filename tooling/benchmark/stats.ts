/**
 * The arithmetic behind the Rezumi AI benchmark: provider prices, percentiles, what 100 credits cost when spent in
 * full, and the automatic quality checks. Pure functions, so the report can be recomputed from saved results.
 */

/** Benchmark accounts' emails start with this, so the budget counts every run and nothing else. */
export const BENCH_EMAIL_PREFIX = "rezumi-ai-bench-";

/** US dollars per million tokens, from Anthropic's price list (checked 2026-11-03). */
export type ModelPrice = {
	input: number;
	output: number;
	/** Haiku 5.5 charges more for a prompt over `above` tokens, for the whole request. */
	longContext?: { above: number; input: number; output: number };
};

export const MODEL_PRICES: Record<string, ModelPrice> = {
	"claude-haiku-5-5": { input: 0.1, output: 0.5, longContext: { above: 100_000, input: 0.5, output: 2.5 } },
	"claude-sonnet-5-5": { input: 2, output: 10 },
};

/** The planning rate for the report: deliberately above the market rate, so costs in Rupiah err high. */
export const PLANNING_IDR_PER_USD = 17_000;

/**
 * Micro-dollars for one run. A run of one model call (`calls` 1) pays the long-context price when its prompt passed
 * the threshold; for an agent run of several calls the tokens are totals, so the flat price applies and the long
 * price is the upper bound (`upperBound`).
 */
export function costMicros(
	model: string,
	tokens: { input: number; output: number },
	options: { calls?: number; upperBound?: boolean } = {},
): number | null {
	const price = MODEL_PRICES[model];
	if (!price) return null;
	const long =
		price.longContext && (options.upperBound || (options.calls ?? 1) === 1) && tokens.input > price.longContext.above;
	const rate = long && price.longContext ? price.longContext : price;
	return Math.round(tokens.input * rate.input + tokens.output * rate.output);
}

export const microsToUsd = (micros: number) => micros / 1_000_000;
export const microsToIdr = (micros: number) => (micros / 1_000_000) * PLANNING_IDR_PER_USD;

/** Nearest-rank percentile of `values` (unsorted); null for none. */
export function percentile(values: number[], p: number): number | null {
	if (values.length === 0) return null;
	const sorted = values.toSorted((a, b) => a - b);
	const rank = Math.ceil((p / 100) * sorted.length);
	return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1] ?? null;
}

export type Distribution = { n: number; p50: number | null; p95: number | null; max: number | null };

export function distribution(values: number[]): Distribution {
	return {
		n: values.length,
		p50: percentile(values, 50),
		p95: percentile(values, 95),
		max: values.length ? Math.max(...values) : null,
	};
}

/**
 * A month of a typical job seeker's Rezumi AI use that spends exactly 100 credits at launch weights: one AI import,
 * reviews and tailoring for four applications, letters, Coach turns, interview practice and short edits.
 */
export const REALISTIC_MIX: Record<string, number> = {
	"import-document": 1,
	review: 4,
	"tailor-resume": 4,
	"cover-letter": 4,
	"coach-turn": 6,
	"interview-practice": 4,
	"draft-answer": 4,
	"short-text": 9,
};

export type PlanScenario = {
	name: string;
	/** Runs of each action. */
	runs: Record<string, number>;
	credits: number;
	/** Micro-dollars at each action's P50 and P95 (and max), for the whole plan. */
	p50: number;
	p95: number;
	max: number;
};

type ActionCost = { p50: number; p95: number; max: number };

/**
 * What 100 credits cost when spent in full: the realistic mix (scaled to the credits it takes under `weights`), and
 * the heaviest case, every credit on the action whose P95 cost per credit is highest.
 */
export function simulatePlan(
	costs: Record<string, ActionCost>,
	weights: Record<string, number>,
	credits = 100,
): PlanScenario[] {
	const total = (runs: Record<string, number>, key: keyof ActionCost) =>
		Object.entries(runs).reduce((sum, [action, count]) => sum + count * (costs[action]?.[key] ?? 0), 0);
	const creditsOf = (runs: Record<string, number>) =>
		Object.entries(runs).reduce((sum, [action, count]) => sum + count * (weights[action] ?? 0), 0);

	const scenarios: PlanScenario[] = [];
	const mixCredits = creditsOf(REALISTIC_MIX);
	if (mixCredits > 0) {
		// Scale the mix to spend the plan's credits; fractional runs are fine for an average month.
		const scale = credits / mixCredits;
		const runs = Object.fromEntries(Object.entries(REALISTIC_MIX).map(([action, count]) => [action, count * scale]));
		scenarios.push({
			name: "realistic",
			runs,
			credits,
			p50: total(runs, "p50"),
			p95: total(runs, "p95"),
			max: total(runs, "max"),
		});
	}

	const heaviest = Object.entries(costs)
		.filter(([action]) => (weights[action] ?? 0) > 0)
		.map(([action, cost]) => ({ action, perCredit: cost.p95 / (weights[action] ?? 1) }))
		.toSorted((a, b) => b.perCredit - a.perCredit)[0];
	if (heaviest) {
		const runs = { [heaviest.action]: Math.floor(credits / (weights[heaviest.action] ?? 1)) };
		scenarios.push({
			name: `heaviest (${heaviest.action})`,
			runs,
			credits: creditsOf(runs),
			p50: total(runs, "p50"),
			p95: total(runs, "p95"),
			max: total(runs, "max"),
		});
	}
	return scenarios;
}

const ID_WORDS = new Set(
	"yang dan di untuk dengan saya ini pada dari dalam akan ke tidak sebagai atau anda kami adalah bisa juga kerja".split(
		" ",
	),
);
const EN_WORDS = new Set("the and to of in for with my is on as a you your this that are be will i".split(" "));

/** Indonesian or English by common words; unknown when the text is too short or mixed to tell. */
export function detectLanguage(text: string): "id" | "en" | "unknown" {
	const words = text
		.replace(/<[^>]+>/g, " ")
		.toLowerCase()
		.split(/[^a-z]+/)
		.filter(Boolean);
	let id = 0;
	let en = 0;
	for (const word of words) {
		if (ID_WORDS.has(word)) id++;
		if (EN_WORDS.has(word)) en++;
	}
	if (id + en < 3) return "unknown";
	if (id >= en * 2) return "id";
	if (en >= id * 2) return "en";
	return "unknown";
}

/** Template gaps a letter or message must never ship with: "[Name]", "{{company}}", "<Nama Perusahaan>". */
export function placeholders(text: string): string[] {
	return text.match(/\[[^\]\n]{1,40}\](?!\()|\{\{[^}\n]*\}\}|<(?:nama|name|company|perusahaan)[^>\n]*>/gi) ?? [];
}

/** Numbers in `output` that `source` never states, a sign of invented results ("increased sales by 30%"). */
export function newNumbers(output: string, source: string): string[] {
	const numbers = (text: string) =>
		(text.replace(/<[^>]+>/g, " ").match(/\d+(?:[.,]\d+)*/g) ?? []).map((value) => value.replace(/[.,]/g, ""));
	const known = new Set(numbers(source));
	return [...new Set(numbers(output).filter((value) => value.length > 0 && !known.has(value)))];
}

export const wordCount = (text: string) =>
	text
		.replace(/<[^>]+>/g, " ")
		.split(/\s+/)
		.filter(Boolean).length;

/** Plain text from structured output: every string, labelled by its key, nested lists indented. */
export function readable(value: unknown, depth = 0): string {
	const pad = "  ".repeat(depth);
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	if (Array.isArray(value))
		return value
			.map((item) => `${pad}- ${readable(item, depth + 1).trimStart()}`)
			.filter((line) => line.trim() !== "-")
			.join("\n");
	if (value && typeof value === "object")
		return Object.entries(value)
			.filter(([, item]) => item !== null && item !== "" && !(Array.isArray(item) && item.length === 0))
			.map(([key, item]) => {
				const text = readable(item, depth + 1);
				return text.includes("\n") ? `${pad}${key}:\n${text}` : `${pad}${key}: ${text.trim()}`;
			})
			.join("\n");
	return "";
}
