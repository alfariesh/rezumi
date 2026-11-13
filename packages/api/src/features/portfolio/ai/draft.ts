import type { PortfolioSource } from "@rezumi/portfolio/view";
import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { LanguageModel } from "ai";
import z from "zod";
import { portfolioDraftSystemPrompt } from "@rezumi/ai/prompts";
import { escapeHtmlText } from "@rezumi/portfolio/text";
import { portfolioPageLocale, portfolioSourceResume } from "@rezumi/portfolio/view";
import {
	PORTFOLIO_AI_DRAFT_WORKS,
	PORTFOLIO_AI_NOTE_LENGTH,
	PORTFOLIO_AI_PLACEHOLDER,
} from "@rezumi/schema/portfolio/ai";
import { fitsRichText, PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { dataBlock } from "../../ai/data-block";
import { generateJson } from "../../ai/generate-json";
import { portfolioErrors } from "../errors";
import { fitSentences, knownFacts, supportedSentences } from "./facts";
import { pageLanguage, resumeForDraft, withoutContact, workForDraft } from "./source";

const { text: max } = PORTFOLIO_LIMITS;

export const draftInputSchema = z.object({
	note: z
		.string()
		.trim()
		.max(PORTFOLIO_AI_NOTE_LENGTH)
		.optional()
		.describe("What to stress or leave out, in the person's words."),
	workIds: z
		.array(z.string().min(1).max(max.id))
		.max(PORTFOLIO_AI_DRAFT_WORKS)
		.optional()
		.describe("The works to write; missing means the first ones not hidden."),
});

export const draftOutputSchema = z.object({
	greeting: z.string().describe("Empty when nothing usable came back; leave the field as it is."),
	about: z.string().describe("HTML. Empty when nothing usable came back; leave the field as it is."),
	works: z.array(
		z.object({
			id: z.string(),
			summary: z.string().describe("Empty when nothing usable came back."),
			html: z.string().describe("The work's story as HTML. Empty when nothing usable came back."),
		}),
	),
});

type PortfolioDraft = z.infer<typeof draftOutputSchema>;

const paragraphs = z.array(z.string()).max(8).catch([]);

const answerSchema = z.object({
	greeting: z.string().catch(""),
	about: paragraphs,
	works: z
		.array(z.object({ id: z.coerce.string(), summary: z.string().catch(""), story: paragraphs }))
		.max(PORTFOLIO_AI_DRAFT_WORKS * 2)
		.catch([]),
});

/** One clean run of text: no markdown emphasis or list markers, which the page would show as they are. */
const plain = (text: string) =>
	text
		.replace(/\*\*|__/g, "")
		.replace(/^\s*[-*•]\s+/, "")
		.replace(/\s+/g, " ")
		.trim();

/** Paragraphs as the Rich Text Editor saves them, as many as fit the field. */
function paragraphsHtml(texts: string[], limit: number): string {
	let html = "";
	for (const text of texts) {
		const next = `${html}<p>${escapeHtmlText(text)}</p>`;
		if (!fitsRichText(next, limit)) break;
		html = next;
	}
	return html;
}

type DraftRequest = z.infer<typeof draftInputSchema> & {
	data: PortfolioData;
	/** The portfolio's source: its resume, or the Profile. */
	source: PortfolioSource;
	model: LanguageModel;
	signal?: AbortSignal | undefined;
};

/** The works to write: those asked for in the page's order, else the first ones visitors can see. */
function chosenWorks(data: PortfolioData, workIds: readonly string[] | undefined) {
	const wanted = workIds && new Set(workIds);
	return data.works.items
		.filter((work) => (wanted ? wanted.has(work.id) : !work.hidden))
		.slice(0, PORTFOLIO_AI_DRAFT_WORKS);
}

/**
 * Writes the greeting, About me and each chosen work's summary and story from the resume. Nothing is saved: the editor
 * applies the answer as one edit the person can undo. An answer with nothing usable fails, so its credits come back.
 */
export async function draftPortfolio(request: DraftRequest): Promise<PortfolioDraft> {
	const { data, source: from, note, model, signal } = request;
	const resume = from.data;
	const works = chosenWorks(data, request.workIds);
	const source = resumeForDraft(resume, data);
	const written = works.map(workForDraft);
	const numbered = written.map((text, index) => `### Work id="${index + 1}"\n${text}`);
	const safeNote = withoutContact(note ?? "");

	const prompt = [
		`Language of the page: ${pageLanguage(data, from)}.`,
		`Works to write: ${works.length}.`,
		`## The resume\n\n${dataBlock("RESUME", source)}`,
		written.length ? `## The works\n\n${dataBlock("WORKS", numbered.join("\n\n"))}` : "",
		safeNote ? `## A note from the person\n\n${dataBlock("NOTE", safeNote)}` : "",
	]
		.filter(Boolean)
		.join("\n\n");

	const answer = await generateJson(model, { system: portfolioDraftSystemPrompt, prompt }, answerSchema, signal);

	// From the works' text, not their numbered headings: those numbers are ours and back up nothing.
	const facts = knownFacts(source, written.join("\n"), safeNote);
	// The Profile has no language of its own: it may not be the page's, where every translated word looks like a new name.
	const sourceResume = portfolioSourceResume(from);
	const names = sourceResume !== null && sourceResume.metadata.page.locale === portfolioPageLocale(data, sourceResume);
	const checked = (text: string) => supportedSentences(plain(text), facts, { names });
	const paragraphsOf = (texts: string[]) => texts.map(checked).filter(Boolean);
	// The greeting and a card are read at a glance: a place to fill in belongs in the story.
	const short = (text: string, limit: number) =>
		fitSentences(
			checked(text)
				.replace(PORTFOLIO_AI_PLACEHOLDER, "")
				.replace(/\s+([.,!?])/g, "$1")
				.replace(/\s+/g, " ")
				.trim(),
			limit,
		);

	const greeting = short(answer.greeting, max.greeting);
	const about = paragraphsHtml(paragraphsOf(answer.about), max.about);
	const seen = new Set<string>();
	const results = answer.works.flatMap((entry) => {
		const work = works[Number(entry.id) - 1];
		if (!work || seen.has(work.id)) return [];
		seen.add(work.id);
		return [
			{
				id: work.id,
				summary: short(entry.summary, max.workSummary),
				html: paragraphsHtml(paragraphsOf(entry.story), max.blockText),
			},
		];
	});

	if (!greeting && !about && !results.some((entry) => entry.summary || entry.html)) throw portfolioErrors.aiUnusable();
	return { greeting, about, works: results };
}
