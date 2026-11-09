import type { AiSourceRequest } from "../../billing/ai-source";
import type { AiRun } from "../../billing/metered-ai";
import type { CreditAction } from "@rezumi/schema/billing";
import { ORPCError } from "@orpc/client";
import z from "zod";
import { protectedProcedure } from "../../../context";
import { aiRequestRateLimit } from "../../../middleware/rate-limit";
import { aiErrors, rethrowAiError } from "../../ai/procedure";
import { aiSourceInput } from "../../billing/ai-source";
import { runWithAiSource } from "../../billing/metered-ai";
import { portfolioErrorMap, portfolioErrors } from "../errors";
import { portfolioService } from "../service";
import { draftInputSchema, draftOutputSchema, draftPortfolio } from "./draft";
import { entriesWithNumbers, findMetricsOutputSchema, findResumeMetrics } from "./metrics";
import { rewriteField, rewriteInputSchema, rewriteOutputSchema } from "./rewrite";

// Kept out of the public API and its OpenAPI spec until portfolios launch (portfolio plan Phase 12).
const route = { tags: ["Internal"] };

const errors = {
	...aiErrors,
	...portfolioErrorMap("PORTFOLIO_DISABLED", "NOT_FOUND", "PORTFOLIO_SOURCE_INVALID", "PORTFOLIO_AI_UNUSABLE"),
};

/**
 * Runs AI work on the request's source. Rezumi AI takes the action's credits once per idempotency key and gives them
 * back when the work fails, is cancelled or leaves nothing usable; the user's own connection never spends credits.
 */
async function run<T>(
	userId: string,
	request: AiSourceRequest,
	action: CreditAction,
	signal: AbortSignal | undefined,
	work: (ai: AiRun) => Promise<T>,
) {
	try {
		return await runWithAiSource(
			{
				userId,
				action,
				aiSource: request.aiSource,
				idempotencyKey: request.idempotencyKey,
				missing: () =>
					new ORPCError("BAD_REQUEST", {
						message: "Test and turn on an AI provider in Settings → AI & developer first.",
					}),
			},
			async (ai) => {
				const result = await work(ai);
				// Stopped once the answer was in: nobody will see it, so nobody pays for it.
				signal?.throwIfAborted();
				return result;
			},
		);
	} catch (error) {
		// JSON that doesn't parse is an answer that can't be used, like one that parses into nothing.
		if (error instanceof SyntaxError) throw portfolioErrors.aiUnusable();
		rethrowAiError(error, "The AI's answer wasn't in the expected format. Try again, or choose another model.");
	}
}

/** The saved portfolio and the resume it needs; without one, the work can't start and no credits are at stake. */
async function resumeContext(userId: string) {
	const { data, resume } = await portfolioService.aiContext(userId);
	if (!resume) throw portfolioErrors.sourceInvalid();
	return { data, resume };
}

export const portfolioAiRouter = {
	draft: protectedProcedure
		.route({
			...route,
			method: "POST",
			path: "/portfolio/ai/draft",
			operationId: "draftPortfolioWithAi",
			summary: "Write the portfolio's greeting, About me and work stories from its resume",
			description: "Writes nothing: the editor applies the answer as one edit. (3 credits on Rezumi AI)",
		})
		.use(aiRequestRateLimit)
		.input(draftInputSchema.extend(aiSourceInput))
		.errors(errors)
		.output(draftOutputSchema)
		.handler(async ({ context, input, signal }) => {
			const source = await resumeContext(context.user.id);
			return run(context.user.id, input, "portfolio-draft", signal, (ai) =>
				draftPortfolio({ ...input, ...source, model: ai.model, signal }),
			);
		}),

	rewrite: protectedProcedure
		.route({
			...route,
			method: "POST",
			path: "/portfolio/ai/rewrite",
			operationId: "rewritePortfolioField",
			summary: "Rewrite one field of the portfolio",
			description:
				"Shorter, more professional, or in the page's language. Writes nothing: the editor applies the answer. (1 credit on Rezumi AI)",
		})
		.use(aiRequestRateLimit)
		.input(rewriteInputSchema.safeExtend(aiSourceInput))
		.errors(errors)
		.output(rewriteOutputSchema)
		.handler(async ({ context, input, signal }) => {
			const source = await portfolioService.aiContext(context.user.id);
			return run(context.user.id, input, "portfolio-rewrite", signal, (ai) =>
				rewriteField({ ...input, ...source, model: ai.model, signal }),
			);
		}),

	findMetrics: protectedProcedure
		.route({
			...route,
			method: "POST",
			path: "/portfolio/ai/find-metrics",
			operationId: "findPortfolioMetrics",
			summary: "Find the results written in the resume, as metrics to pick from",
			description:
				"Only numbers the resume states, each with the sentence it comes from. A resume with no numbers costs nothing. (1 credit on Rezumi AI)",
		})
		.use(aiRequestRateLimit)
		.input(z.object(aiSourceInput))
		.errors(errors)
		.output(findMetricsOutputSchema)
		.handler(async ({ context, input, signal }) => {
			const source = await resumeContext(context.user.id);
			const entries = entriesWithNumbers(source.resume, source.data);
			if (!entries.length) return { candidates: [] };
			return run(context.user.id, input, "portfolio-metrics", signal, async (ai) => {
				const found = await findResumeMetrics({ ...source, model: ai.model, signal }, entries);
				// Nothing survived the checks, so the answer is worth nothing: the credit comes back and the search still ends.
				if (!found.candidates.length) await ai.fail("nothing_found");
				return found;
			});
		}),
};
