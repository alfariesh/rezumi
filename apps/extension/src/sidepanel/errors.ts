import { ORPCError } from "@orpc/client";
import { OfflineError } from "./offline";

/**
 * The panel's error states (01-desain.md §3.7), from whatever an API call threw. The form keeps its values in every one
 * of them; each has one way forward.
 */
export type PanelErrorKind = "offline" | "expired" | "rate-limit" | "credits" | "outdated" | "invalid" | "server";

export function errorKind(error: unknown): PanelErrorKind {
	if (error instanceof OfflineError) return "offline";
	if (error instanceof TypeError || (typeof navigator !== "undefined" && navigator.onLine === false)) return "offline";
	if (!(error instanceof ORPCError)) return "server";
	const code = String(error.code);
	if (code === "EXTENSION_OUTDATED" || error.status === 426) return "outdated";
	if (code === "UNAUTHORIZED" || error.status === 401) return "expired";
	if (code === "TOO_MANY_REQUESTS" || code === "RATE_LIMIT_EXCEEDED" || error.status === 429) return "rate-limit";
	if (
		code === "INSUFFICIENT_CREDITS" ||
		code === "PLAN_FEATURE_REQUIRED" ||
		code === "PLAN_LIMIT_REACHED" ||
		code === "AI_SOURCE_REQUIRED" ||
		code === "REZUMI_AI_UNAVAILABLE" ||
		error.status === 402
	)
		return "credits";
	if (code === "BAD_REQUEST" || code === "NOT_FOUND" || error.status === 400 || error.status === 404) return "invalid";
	return "server";
}
