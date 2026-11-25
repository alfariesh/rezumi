import { ORPCError } from "@orpc/client";
import { AiConsentDeclined } from "@/api/ai-consent";

/** The server's public reason, when one is available. */
export function errorText(error: unknown, fallback: string) {
	return (error instanceof ORPCError || error instanceof AiConsentDeclined) && error.message ? error.message : fallback;
}
