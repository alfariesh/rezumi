import type { AiSource } from "@rezumi/schema/billing";
import z from "zod";
import { aiSourceSchema } from "@rezumi/schema/billing";

/** The fields an AI procedure takes to say which AI runs it. Both optional, so apps from before Rezumi AI still work. */
export const aiSourceInput = {
	aiSource: aiSourceSchema
		.optional()
		.describe(
			'Which AI runs this: "rezumi" for Rezumi AI, paid with the account\'s credits (the cost is shown before running), or "own" for the account\'s own AI connection. Left out, the account\'s own connection runs it.',
		),
	idempotencyKey: z
		.string()
		.trim()
		.min(1)
		.max(100)
		.optional()
		.describe(
			"A new random ID per action, reused when retrying it, so Rezumi AI takes its credits once. Only Rezumi AI reads it.",
		),
};

export type AiSourceRequest = { aiSource?: AiSource | undefined; idempotencyKey?: string | undefined };
