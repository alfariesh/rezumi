import { t } from "@lingui/core/macro";
import { ORPCError } from "@orpc/client";
import { getOrpcErrorMessage } from "@/libs/error-message";

/** Why saving a job failed, shown in the form so the details stay and the person can act on it. */
export function saveJobErrorMessage(error: unknown): string {
	const fallback = t`Couldn't save the job. Your details are still here. Try again.`;
	// A dropped connection reads "Failed to fetch"; the fallback says what happened and what to do.
	if (!(error instanceof ORPCError)) return fallback;
	return getOrpcErrorMessage(error, {
		byCode: {
			NOT_FOUND: t`The chosen resume or letter is no longer available. Choose another one, or None.`,
			SERVICE_UNAVAILABLE: t`Couldn't save the job just now. Your details are still here. Try again.`,
		},
		fallback,
	});
}
