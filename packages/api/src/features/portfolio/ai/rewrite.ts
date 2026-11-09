import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { ResumeData } from "@rezumi/schema/resume/data";
import type { LanguageModel } from "ai";
import z from "zod";
import { portfolioRewriteSystemPrompt } from "@rezumi/ai/prompts";
import { sanitizePortfolioHtml } from "@rezumi/portfolio/rich-text";
import { htmlToText } from "@rezumi/portfolio/text";
import { PORTFOLIO_AI_FIELD_KEYS, PORTFOLIO_AI_FIELDS, PORTFOLIO_AI_REWRITES } from "@rezumi/schema/portfolio/ai";
import { fitsRichText, RICH_TEXT_MARKUP_FACTOR } from "@rezumi/schema/portfolio/limits";
import { dataBlock } from "../../ai/data-block";
import { generateJson } from "../../ai/generate-json";
import { portfolioErrors } from "../errors";
import { knownFacts, newNames, newNumbers } from "./facts";
import { maskContacts, pageLanguage } from "./source";

const LONGEST_FIELD = Math.max(...Object.values(PORTFOLIO_AI_FIELDS).map((field) => field.max));

export const rewriteInputSchema = z
	.object({
		field: z.enum(PORTFOLIO_AI_FIELD_KEYS).describe("Which field this is: it decides the format and the length."),
		text: z
			.string()
			.trim()
			.min(1)
			.max(LONGEST_FIELD * RICH_TEXT_MARKUP_FACTOR)
			.describe("The field as it is now: HTML for a rich field, plain text otherwise."),
		instruction: z.enum(PORTFOLIO_AI_REWRITES),
	})
	.superRefine((input, ctx) => {
		const field = PORTFOLIO_AI_FIELDS[input.field];
		if (field.rich ? fitsRichText(input.text, field.max) : input.text.length <= field.max) return;
		ctx.addIssue({ code: "custom", path: ["text"], message: "This is longer than the field holds." });
	});

export const rewriteOutputSchema = z.object({
	text: z.string().describe("The rewritten field, in the field's format. Nothing is saved."),
});

const answerSchema = z.object({ text: z.string() });

const REQUESTS: Record<z.infer<typeof rewriteInputSchema>["instruction"], (language: string) => string> = {
	shorter: () => "Shorter.",
	professional: () => "More professional.",
	translate: (language) => `Translate to ${language}.`,
};

/** The addresses of a piece of rich text's links. */
const linksOf = (html: string) => [...html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/gi)].map((match) => match[1] ?? "");

type RewriteRequest = z.infer<typeof rewriteInputSchema> & {
	data: PortfolioData;
	resume: ResumeData | null;
	model: LanguageModel;
	signal?: AbortSignal | undefined;
};

/**
 * Rewrites one field and returns it for the editor to apply. It can't carry a number, name or link the field didn't
 * have, or run past the field: cutting a sentence out would change what the person wrote, so such an answer fails and
 * its credit comes back.
 */
export async function rewriteField(request: RewriteRequest): Promise<z.infer<typeof rewriteOutputSchema>> {
	const { field: key, instruction, data, resume, model, signal } = request;
	const field = PORTFOLIO_AI_FIELDS[key];
	const text = field.rich ? sanitizePortfolioHtml(request.text) : request.text;
	const { masked, restore } = maskContacts(text);

	const prompt = [
		`Request: ${REQUESTS[instruction](pageLanguage(data, resume))}`,
		field.rich ? "The text is HTML." : `The text is plain. At most ${field.max} characters.`,
		dataBlock("TEXT", masked),
	].join("\n\n");

	const answer = await generateJson(model, { system: portfolioRewriteSystemPrompt, prompt }, answerSchema, signal);

	const original = field.rich ? htmlToText(text) : text;
	const facts = knownFacts(original);
	const reads = (visible: string) =>
		Boolean(visible) &&
		!newNumbers(visible, facts).length &&
		// A translation renames places and months; anything else has no reason to bring a new name.
		(instruction === "translate" || !newNames(visible, facts).length) &&
		// "Shorter" that came back as long as it went in isn't what was asked for.
		(instruction !== "shorter" || visible.length < original.length);

	if (field.rich) {
		const html = sanitizePortfolioHtml(restore(answer.text)).trim();
		const links = new Set(linksOf(text));
		const usable =
			reads(htmlToText(html)) && fitsRichText(html, field.max) && linksOf(html).every((link) => links.has(link));
		if (!usable) throw portfolioErrors.aiUnusable();
		return { text: html };
	}

	const plain = restore(answer.text).replace(/\s+/g, " ").trim();
	if (!reads(plain) || plain.length > field.max) throw portfolioErrors.aiUnusable();
	return { text: plain };
}
