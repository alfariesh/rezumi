/**
 * Summarises Rezumi AI benchmark runs (benchmark/results/*): per kind of work, the tokens, cost and wait at P50, P95
 * and max, failures and the automatic checks; what 100 credits cost spent in full; and a blind rating sheet that puts
 * two models' answers to the same tasks side by side.
 *
 *   pnpm benchmark:ai:report                  # the latest run of each model
 *   pnpm benchmark:ai:report --run <dir> ...  # chosen runs
 *
 * Writes benchmark/results/report.md, summary.json, rating-sheet.json and rating-key.json (which answer is which model).
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { CREDIT_COSTS } from "@rezumi/schema/billing";
import { loadFixtures, toPlainText } from "./fixtures";
import {
	costMicros,
	distribution,
	microsToIdr,
	microsToUsd,
	PLANNING_IDR_PER_USD,
	REALISTIC_MIX,
	simulatePlan,
} from "./stats";

type Result = {
	id: string;
	action: string;
	credits: number;
	procedure: string;
	language: string;
	fixtures: string[];
	ok: boolean;
	error: { code: string; message: string } | null;
	ms: number;
	usage: {
		status: string;
		model: string | null;
		input_tokens: number | null;
		output_tokens: number | null;
		server_ms: number | null;
	} | null;
	output: {
		input: string;
		text: string;
		checks: Record<string, boolean | number | string | null>;
	} | null;
};

const resultsDir = new URL("results/", import.meta.url);
const { values: args } = parseArgs({ options: { run: { type: "string", multiple: true } } });

/** The latest run of each model, by folder name (`<model>-<time>`). */
function latestRuns(): string[] {
	const runs = readdirSync(resultsDir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.toSorted();
	const latest = new Map<string, string>();
	for (const run of runs) latest.set(run.replace(/-\d{4}-\d{2}-\d{2}T.*$/, ""), run);
	return [...latest.values()];
}

function load(run: string): { model: string; results: Result[] } {
	const meta = JSON.parse(readFileSync(new URL(`${run}/run.json`, resultsDir), "utf8")) as { model: string };
	const results = readFileSync(new URL(`${run}/results.jsonl`, resultsDir), "utf8")
		.split("\n")
		.filter(Boolean)
		.map((line) => JSON.parse(line) as Result);
	return { model: meta.model, results };
}

const usd = (micros: number | null) => (micros === null ? "–" : `$${microsToUsd(micros).toFixed(5)}`);
const idr = (micros: number | null) =>
	micros === null ? "–" : `Rp${Math.round(microsToIdr(micros)).toLocaleString("id-ID")}`;
const int = (value: number | null) => (value === null ? "–" : Math.round(value).toLocaleString("en-US"));
const seconds = (ms: number | null) => (ms === null ? "–" : `${(ms / 1000).toFixed(1)} s`);
const table = (head: string[], rows: string[][]) =>
	[
		`| ${head.join(" | ")} |`,
		`| ${head.map(() => "---").join(" | ")} |`,
		...rows.map((row) => `| ${row.join(" | ")} |`),
	].join("\n");

type ActionSummary = {
	action: string;
	credits: number;
	runs: number;
	failed: number;
	inputTokens: ReturnType<typeof distribution>;
	outputTokens: ReturnType<typeof distribution>;
	cost: ReturnType<typeof distribution>;
	costPerCredit: ReturnType<typeof distribution>;
	ms: ReturnType<typeof distribution>;
	/** Spend on runs that failed and gave the credits back. */
	failedCost: number;
	checks: Record<string, string>;
};

function summarise(model: string, results: Result[]): ActionSummary[] {
	return Object.keys(CREDIT_COSTS).map((action) => {
		const runs = results.filter((result) => result.action === action);
		const metered = runs.filter((result) => result.usage?.input_tokens !== null && result.usage !== null);
		// An agent turn makes several model calls, so its long-context price is only an upper bound; others are exact.
		const costOf = (result: Result) =>
			costMicros(
				model,
				{ input: result.usage?.input_tokens ?? 0, output: result.usage?.output_tokens ?? 0 },
				{ calls: action === "coach-turn" ? 2 : 1 },
			) ?? 0;
		const succeeded = metered.filter((result) => result.ok && result.usage?.status === "committed");
		const credits = CREDIT_COSTS[action as keyof typeof CREDIT_COSTS];
		const checks: Record<string, string> = {};
		const keys = new Set(runs.flatMap((result) => Object.keys(result.output?.checks ?? {})));
		for (const key of keys) {
			const values = runs.map((result) => result.output?.checks[key]).filter((value) => value !== undefined);
			const booleans = values.filter((value): value is boolean => typeof value === "boolean");
			const numbers = values.filter((value): value is number => typeof value === "number");
			if (booleans.length) checks[key] = `${booleans.filter(Boolean).length}/${booleans.length}`;
			else if (numbers.length) {
				const total = numbers.reduce((sum, value) => sum + value, 0);
				checks[key] = `avg ${(total / numbers.length).toFixed(1)}, max ${Math.max(...numbers)}`;
			}
		}
		return {
			action,
			credits,
			runs: runs.length,
			failed: runs.filter((result) => !result.ok).length,
			inputTokens: distribution(succeeded.map((result) => result.usage?.input_tokens ?? 0)),
			outputTokens: distribution(succeeded.map((result) => result.usage?.output_tokens ?? 0)),
			cost: distribution(succeeded.map(costOf)),
			costPerCredit: distribution(succeeded.map((result) => costOf(result) / credits)),
			ms: distribution(succeeded.map((result) => result.ms)),
			failedCost: metered.filter((result) => !result.ok).reduce((sum, result) => sum + costOf(result), 0),
			checks,
		};
	});
}

/** Match scores should rank good fits above poor ones. */
function matchSpread(results: Result[]) {
	const scores = (fit: string) =>
		results
			.filter((result) => result.ok && result.output?.checks.fit === fit)
			.map((result) => Number(result.output?.checks.score ?? 0));
	const average = (values: number[]) =>
		values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
	return {
		good: scores("good"),
		poor: scores("poor"),
		goodAverage: average(scores("good")),
		poorAverage: average(scores("poor")),
	};
}

/** A seeded shuffle, so the sheet is the same each time the report is written. */
function shuffle<T>(items: T[], seed: number): T[] {
	let state = seed;
	const random = () => {
		state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
		return state / 2_147_483_648;
	};
	const copy = [...items];
	for (let index = copy.length - 1; index > 0; index--) {
		const other = Math.floor(random() * (index + 1));
		[copy[index], copy[other]] = [copy[other] as T, copy[index] as T];
	}
	return copy;
}

/** What the rater needs beside the answers: the resume and posting a task used, and a conversation's earlier turns. */
function contextOf(result: Result, fixtures: ReturnType<typeof loadFixtures>) {
	const context: { label: string; text: string }[] = [];
	const coach = /^coach-(\d+)-(\d+)$/.exec(result.id);
	const earlier = coach ? fixtures.tasks.coach[Number(coach[1]) - 1]?.turns.slice(0, Number(coach[2]) - 1) : [];
	if (earlier?.length)
		context.push({
			label: "Pesan pengguna sebelumnya",
			text: earlier.map((turn, index) => `${index + 1}. ${turn}`).join("\n\n"),
		});
	for (const id of result.fixtures) {
		const resume = fixtures.resumes.find((item) => item.id === id);
		if (resume) context.push({ label: `CV (${resume.name})`, text: toPlainText(resume) });
		const job = fixtures.jobs.find((item) => item.id === id);
		if (job) context.push({ label: `Lowongan (${job.role}, ${job.company})`, text: job.description });
	}
	return context;
}

/**
 * Ten tasks both models finished, at least one of each kind of work, each with both answers under neutral labels in
 * random order: twenty outputs for the owner to rate without knowing which model wrote which. AI imports are left out:
 * the automatic checks already compare every field with the source.
 */
function ratingSheet(runs: { model: string; results: Result[] }[]) {
	const [first, second] = runs;
	if (!first || !second) return null;
	const fixtures = loadFixtures();
	const both = first.results.filter(
		(result) =>
			result.ok &&
			result.action !== "import-document" &&
			second.results.some((other) => other.id === result.id && other.ok),
	);
	const byAction = new Map<string, Result[]>();
	for (const result of shuffle(both, 20_261_103))
		byAction.set(result.action, [...(byAction.get(result.action) ?? []), result]);
	const picked: Result[] = [];
	for (const results of byAction.values()) if (results[0]) picked.push(results[0]);
	// Three more, no kind of work more than twice.
	for (const result of shuffle(both, 7)) {
		if (picked.length >= 10) break;
		const sameKind = picked.filter((item) => item.action === result.action).length;
		if (!picked.includes(result) && sameKind < 2) picked.push(result);
	}
	const key: Record<string, Record<string, string>> = {};
	const sheet = picked.map((result, index) => {
		const other = second.results.find((item) => item.id === result.id);
		const answers = shuffle(
			[
				{ model: first.model, text: result.output?.text ?? "" },
				{ model: second.model, text: other?.output?.text ?? "" },
			],
			index + 1,
		);
		const id = `t${index + 1}`;
		key[id] = { A: answers[0]?.model ?? "", B: answers[1]?.model ?? "" };
		return {
			id,
			task: result.id,
			action: result.action,
			procedure: result.procedure,
			language: result.language,
			input: result.output?.input ?? "",
			context: contextOf(result, fixtures),
			answers: [
				{ label: "A", text: answers[0]?.text ?? "" },
				{ label: "B", text: answers[1]?.text ?? "" },
			],
		};
	});
	return { sheet, key };
}

const runs = (args.run?.length ? args.run : latestRuns()).map(load);
if (runs.length === 0) throw new Error("No benchmark runs in benchmark/results: run `pnpm benchmark:ai` first.");

const lines: string[] = [
	`# Rezumi AI benchmark (${new Date().toISOString().slice(0, 10)})`,
	"",
	`Rupiah at the planning rate Rp${PLANNING_IDR_PER_USD.toLocaleString("id-ID")}/US$. Cost from tokens at list price; P50/P95/max over runs that kept their credits.`,
];
const summary: Record<string, unknown> = {};
for (const { model, results } of runs) {
	const actions = summarise(model, results);
	const costs = Object.fromEntries(
		actions.map((item) => [item.action, { p50: item.cost.p50 ?? 0, p95: item.cost.p95 ?? 0, max: item.cost.max ?? 0 }]),
	);
	const plans = simulatePlan(costs, CREDIT_COSTS);
	const match = matchSpread(results);
	summary[model] = { actions, plans, match, tasks: results.length };
	lines.push(
		"",
		`## ${model} (${results.length} tasks, ${results.filter((result) => !result.ok).length} failed)`,
		"",
		table(
			[
				"Action",
				"Cr",
				"Runs",
				"Failed",
				"In tok P50/P95/max",
				"Out tok P50/P95/max",
				"Cost P50",
				"Cost P95",
				"Cost max",
				"P95 Rp",
				"Wait P50/P95/max",
			],
			actions.map((item) => [
				item.action,
				String(item.credits),
				String(item.runs),
				String(item.failed),
				`${int(item.inputTokens.p50)} / ${int(item.inputTokens.p95)} / ${int(item.inputTokens.max)}`,
				`${int(item.outputTokens.p50)} / ${int(item.outputTokens.p95)} / ${int(item.outputTokens.max)}`,
				usd(item.cost.p50),
				usd(item.cost.p95),
				usd(item.cost.max),
				idr(item.cost.p95),
				`${seconds(item.ms.p50)} / ${seconds(item.ms.p95)} / ${seconds(item.ms.max)}`,
			]),
		),
		"",
		"Cost per credit (P95) and automatic checks:",
		"",
		table(
			["Action", "P95 per credit", "Failed runs' cost", "Checks"],
			actions.map((item) => [
				item.action,
				usd(item.costPerCredit.p95),
				usd(item.failedCost),
				Object.entries(item.checks)
					.map(([key, value]) => `${key} ${value}`)
					.join("; "),
			]),
		),
		"",
		`Match scores: good fits ${match.good.join(", ")} (avg ${match.goodAverage?.toFixed(0) ?? "–"}); poor fits ${match.poor.join(", ")} (avg ${match.poorAverage?.toFixed(0) ?? "–"}).`,
		"",
		"100 credits spent in full (realistic mix: " +
			Object.entries(REALISTIC_MIX)
				.map(([action, count]) => `${count}× ${action}`)
				.join(", ") +
			"):",
		"",
		table(
			["Scenario", "Runs", "P50", "P95", "Max"],
			plans.map((plan) => [
				plan.name,
				Object.entries(plan.runs)
					.map(([action, count]) => `${Number(count.toFixed(1))}× ${action}`)
					.join(", "),
				`${usd(plan.p50)} (${idr(plan.p50)})`,
				`${usd(plan.p95)} (${idr(plan.p95)})`,
				`${usd(plan.max)} (${idr(plan.max)})`,
			]),
		),
		"",
		"Failures:",
		"",
		...results
			.filter((result) => !result.ok)
			.map((result) => `- ${result.id}: ${result.error?.code} — ${result.error?.message.slice(0, 160)}`),
	);
}

const rating = ratingSheet(runs);
if (rating) {
	writeFileSync(new URL("rating-sheet.json", resultsDir), JSON.stringify(rating.sheet, null, 2));
	writeFileSync(new URL("rating-key.json", resultsDir), JSON.stringify(rating.key, null, 2));
}
writeFileSync(new URL("summary.json", resultsDir), JSON.stringify(summary, null, 2));
writeFileSync(new URL("report.md", resultsDir), `${lines.join("\n")}\n`);
console.info(`Wrote ${new URL("report.md", resultsDir).pathname}${rating ? " and the rating sheet" : ""}.`);
