import type { ResumeEntry } from "./source";
import type { PortfolioSource } from "@rezumi/portfolio/view";
import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { ResumeData } from "@rezumi/schema/resume/data";
import type { LanguageModel } from "ai";
import z from "zod";
import { portfolioMetricsSystemPrompt } from "@rezumi/ai/prompts";
import { cutText } from "@rezumi/portfolio/text";
import { PORTFOLIO_AI_METRICS } from "@rezumi/schema/portfolio/ai";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { METRIC_CURRENCIES, METRIC_DURATION_UNITS, METRIC_FORMATS } from "@rezumi/schema/portfolio/metric";
import { dataBlock } from "../../ai/data-block";
import { generateJson } from "../../ai/generate-json";
import { quoteHoldsValue, quoteIsIn } from "./facts";
import { pageLanguage, resumeResultEntries } from "./source";

const { text: max } = PORTFOLIO_LIMITS;

/** A sentence longer than this isn't one sentence the person can check at a glance. */
const QUOTE_LENGTH = 500;
const ANSWER_LIMIT = PORTFOLIO_AI_METRICS * 3;

const metricOutput = z.object({
	label: z.string(),
	value: z.object({ kind: z.literal("number"), number: z.number() }),
	format: z.enum(METRIC_FORMATS),
	currency: z.enum(METRIC_CURRENCIES).optional(),
	unit: z.enum(METRIC_DURATION_UNITS).optional(),
	prefix: z.string().optional(),
	suffix: z.string().optional(),
});

export const findMetricsOutputSchema = z.object({
	candidates: z.array(
		z.object({
			metric: metricOutput.describe("The metric, without an id: the editor gives it one when it's added."),
			quote: z.string().describe("The resume's sentence the number comes from, word for word."),
			source: z.string().describe("The job or project it comes from."),
		}),
	),
});

type FoundMetrics = z.infer<typeof findMetricsOutputSchema>;

const nullable = <T extends z.ZodType>(schema: T) => schema.nullish().catch(null);

const answerSchema = z.object({
	metrics: z
		.array(
			z.object({
				label: z.string(),
				value: z.number().finite().min(-1e15).max(1e15),
				format: z.enum(METRIC_FORMATS),
				currency: nullable(z.enum(METRIC_CURRENCIES)),
				unit: nullable(z.enum(METRIC_DURATION_UNITS)),
				prefix: nullable(z.string()),
				suffix: nullable(z.string()),
				quote: z.string(),
			}),
		)
		.max(ANSWER_LIMIT),
});

type Answered = z.infer<typeof answerSchema>["metrics"][number];

/** A metric the page can draw, when the answer holds together: its unit for formats that need one, and a real label. */
function toMetric(answered: Answered): FoundMetrics["candidates"][number]["metric"] | null {
	const label = cutText(answered.label.trim(), max.metricLabel);
	const needsCurrency = answered.format === "currency";
	const needsUnit = answered.format === "duration";
	if (!label || (needsCurrency && !answered.currency) || (needsUnit && !answered.unit)) return null;
	if (answered.format === "rating" && (answered.value < 0 || answered.value > 5)) return null;
	// The format already draws its own unit, so only a sign may join it; a plain number may carry a currency symbol.
	const sign = answered.value < 0 ? "-" : (answered.prefix?.trim().match(/^[+\-−]$/)?.[0] ?? "");
	const prefix = sign || (answered.format === "plain" ? cutText(answered.prefix?.trim() ?? "", max.metricPrefix) : "");
	// The page writes a suffix right after the number: a word there would read "310.000merchant".
	const written = answered.format === "plain" || answered.format === "compact" ? (answered.suffix?.trim() ?? "") : "";
	const suffix = /^[\p{L}\p{N}]/u.test(written) ? "" : cutText(written, max.metricSuffix);
	return {
		label,
		value: { kind: "number", number: Math.abs(answered.value) },
		format: answered.format,
		...(needsCurrency && answered.currency ? { currency: answered.currency } : {}),
		...(needsUnit && answered.unit ? { unit: answered.unit } : {}),
		...(prefix ? { prefix } : {}),
		...(suffix ? { suffix } : {}),
	};
}

type FindRequest = {
	data: PortfolioData;
	/** The portfolio's source: its resume, or the Profile. */
	source: PortfolioSource;
	model: LanguageModel;
	signal?: AbortSignal | undefined;
};

/**
 * The results written in the resume's jobs and projects, each with the sentence it comes from: the person picks which
 * to use. An answer whose quote isn't in the resume, or doesn't hold its number, is left out whatever the model says.
 */
export async function findResumeMetrics(request: FindRequest, entries: readonly ResumeEntry[]): Promise<FoundMetrics> {
	const { data, source, model, signal } = request;
	const prompt = [
		`Language of the labels: ${pageLanguage(data, source)}.`,
		dataBlock("RESUME", entries.map((entry) => `${entry.source}\n${entry.text}`).join("\n\n")),
	].join("\n\n");

	const answer = await generateJson(model, { system: portfolioMetricsSystemPrompt, prompt }, answerSchema, signal);

	const seen = new Set<string>();
	const candidates: FoundMetrics["candidates"] = [];
	for (const answered of answer.metrics) {
		const quote = answered.quote.trim();
		const entry = entries.find(({ text }) => quoteIsIn(quote, text));
		const metric = toMetric(answered);
		if (!entry || !metric || quote.length > QUOTE_LENGTH) continue;
		if (!quoteHoldsValue(quote, answered.value, answered.format)) continue;
		const key = `${metric.label.toLowerCase()}|${answered.value}`;
		if (seen.has(key)) continue;
		seen.add(key);
		candidates.push({ metric, quote, source: entry.source });
		if (candidates.length === PORTFOLIO_AI_METRICS) break;
	}
	return { candidates };
}

/** The resume's jobs and projects worth asking about: those with any digit in them. */
export const entriesWithNumbers = (resume: ResumeData, data: PortfolioData) =>
	resumeResultEntries(resume, data).filter((entry) => /\p{Nd}/u.test(entry.text));
