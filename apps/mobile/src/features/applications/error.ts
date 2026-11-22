import { t } from "@lingui/core/macro";
import { ORPCError } from "@orpc/client";

export function applicationError(error: unknown) {
	if (error instanceof ORPCError) {
		if (error.code === "POSTING_UNREADABLE") return t`That link couldn't be read. Paste the posting text instead.`;
		if (error.code === "SEARCH_FAILED") return t`Job search couldn't be reached. Try again or paste a posting link.`;
		if (error.code === "SEARCH_UNAVAILABLE")
			return t`Job search isn't configured on this server. Paste a posting link instead.`;
		if (error.code === "UNAUTHORIZED") return t`Your session expired. Sign in again.`;
		if (error.code === "TOO_MANY_REQUESTS" || error.code === "RATE_LIMIT_EXCEEDED")
			return t`Too many requests. Try again later.`;
		if (error.code === "BAD_GATEWAY")
			return t`The service couldn't be reached. Try again or fill the details manually.`;
		if (error.code === "BAD_REQUEST")
			return t`Check the fields and try again. For unreadable links, paste the posting text instead.`;
	}
	return t`Couldn't complete the request. Check your connection and try again.`;
}

/** Why saving a job failed; the form keeps the details so the person can try again. */
export function saveJobError(error: unknown) {
	if (error instanceof ORPCError && error.code === "NOT_FOUND")
		return t`The chosen resume or letter is no longer available. Choose another one, or None.`;
	if (error instanceof ORPCError && error.code !== "SERVICE_UNAVAILABLE") return applicationError(error);
	return t`Couldn't save the job. Your details are still here. Try again.`;
}
