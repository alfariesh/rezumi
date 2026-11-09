import { ORPCError } from "@orpc/client";
import { AISDKError } from "ai";
import { flattenError, ZodError } from "zod";

/**
 * Every AI procedure fails the same ways: no ENCRYPTION_SECRET, a bad base URL, the provider erroring (its cause kept
 * for upstream error reporters), or the model returning a shape that can't be used, named per procedure.
 */
export function rethrowAiError(error: unknown, invalidStructure: string): never {
	if (error instanceof Error && error.message === "AI_CREDENTIAL_ENCRYPTION_UNAVAILABLE")
		throw new ORPCError("PRECONDITION_FAILED", {
			message: "AI providers aren't available on this server. Ask the server administrator to set ENCRYPTION_SECRET.",
		});
	if (error instanceof Error && error.message === "INVALID_AI_BASE_URL")
		throw new ORPCError("BAD_REQUEST", {
			message: "That provider setup isn't valid. Check the base URL and try again.",
		});
	if (error instanceof AISDKError)
		throw new ORPCError("BAD_GATEWAY", {
			message: "Couldn't reach the AI provider. Check its settings and try again.",
			cause: error,
		});
	if (error instanceof ZodError)
		throw new ORPCError("BAD_REQUEST", { message: invalidStructure, cause: flattenError(error) });
	throw error;
}

export const aiErrors = {
	BAD_GATEWAY: {
		message: "The AI provider returned an error or couldn't be reached. Try again, or check its settings.",
		status: 502,
	},
	BAD_REQUEST: {
		message: "The AI response wasn't in the expected format. Try again, or choose another model.",
		status: 400,
	},
} as const;
