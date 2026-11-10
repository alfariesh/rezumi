import type { Ratelimiter } from "@orpc/experimental-ratelimit";
import { createRatelimitMiddleware } from "@orpc/experimental-ratelimit";
import { ORPCError } from "@orpc/server";
import { env } from "@rezumi/env/server";
import { rateLimitConfig } from "@rezumi/utils/rate-limit";
import { createRateLimiter } from "../../redis";

const isRateLimitEnabled = process.env.NODE_ENV === "production" && !env.FLAG_DISABLE_API_RATE_LIMIT;

type ContextWithHeaders = {
	reqHeaders?: Headers;
	user?: { id: string } | null;
	trustedClient?: string;
};

export function getClientKey(trustedClient?: string): string {
	return `ip:${trustedClient?.trim() || "unknown"}`;
}

function getUserKey(context: ContextWithHeaders): string {
	return context.user?.id ?? "anon";
}

function getInputKeyPart(input: unknown): string {
	if (!input || typeof input !== "object") return "no-input";

	const inputRecord = input as Record<string, unknown>;

	const fields = ["resumeId", "threadId", "conversationId", "messageId", "fileId", "id"] as const;
	for (const field of fields) {
		const value = inputRecord[field];
		if (typeof value !== "string") continue;

		const trimmedValue = value.trim();
		if (trimmedValue) return `${field}:${trimmedValue}`;
	}

	const username = inputRecord.username;
	const slug = inputRecord.slug;

	if (typeof username === "string" && typeof slug === "string") return `${username}:${slug}`;

	return "no-id";
}

const resumePasswordLimiter = createRateLimiter("resumePasswordLimiter", rateLimitConfig.orpc.resumePassword);
const pdfLimiter = createRateLimiter("pdfLimiter", rateLimitConfig.orpc.pdfExport);
const resumeDownloadLimiter = createRateLimiter("resumeDownloadLimiter", rateLimitConfig.orpc.pdfExport);
const aiLimiter = createRateLimiter("aiLimiter", rateLimitConfig.orpc.aiRequest);
const aiVoiceLimiter = createRateLimiter("aiVoiceLimiter", rateLimitConfig.orpc.aiRequest);
const checkoutLimiter = createRateLimiter("checkoutLimiter", rateLimitConfig.orpc.checkout);
const storageUploadLimiter = createRateLimiter("storageUploadLimiter", rateLimitConfig.orpc.storageUpload);
const storageDeleteLimiter = createRateLimiter("storageDeleteLimiter", rateLimitConfig.orpc.storageDelete);
const resumeMutationLimiter = createRateLimiter("resumeMutationLimiter", rateLimitConfig.orpc.resumeMutations);
const resumeUpdatesLimiter = createRateLimiter("resumeUpdatesLimiter", rateLimitConfig.orpc.resumeUpdates);
const resumeUpdatesUserLimiter = createRateLimiter("resumeUpdatesUserLimiter", rateLimitConfig.orpc.resumeUpdatesUser);
const accountLimiter = createRateLimiter("accountLimiter", {
	maxRequests: rateLimitConfig.betterAuth.global.max,
	window: rateLimitConfig.betterAuth.global.window * 1000,
});
const disabledLimiter = {
	// oxlint-disable-next-line require-await -- The limiter contract returns a Promise even when rate limiting is disabled.
	limit: async () => ({
		success: true,
		remaining: Number.POSITIVE_INFINITY,
		reset: Date.now(),
	}),
};

const productionLimiter = (limiter: Ratelimiter) => (isRateLimitEnabled ? limiter : disabledLimiter);

export const accountRateLimit = createRatelimitMiddleware<ContextWithHeaders, unknown>({
	limiter: productionLimiter(accountLimiter),
	key: ({ context }) => `account:${getUserKey(context)}`,
});

type ResumePasswordAttempt = { resumeId: string; trustedClient?: string | undefined };

const resumePasswordKey = (input: ResumePasswordAttempt) =>
	`resume-password:${input.resumeId}:${getClientKey(input.trustedClient)}`;

/** Spends a try from the budget the API's verify call uses, so a web page's password form gets no extra guesses. */
export async function consumeResumePasswordLimit(input: ResumePasswordAttempt): Promise<boolean> {
	return (await productionLimiter(resumePasswordLimiter).limit(resumePasswordKey(input))).success;
}

export const pdfExportRateLimit = createRatelimitMiddleware<ContextWithHeaders, { id: string }>({
	limiter: productionLimiter(pdfLimiter),
	key: ({ context }, input) => `pdf-export:${getUserKey(context)}:${input.id}`,
});

// Each document has its own small budget; this one bounds an account rendering many documents.
const pdfAccountLimiter = createRateLimiter("pdfAccountLimiter", { maxRequests: 30, window: 60 * 1000 });

/** Shared by REST exports and signed download links, at the actual rendering boundary. */
export async function consumePdfExportLimit(input: { id: string; userId: string; resHeaders?: Headers }) {
	const account = await productionLimiter(pdfAccountLimiter).limit(`pdf-export-account:${input.userId}`);
	const document = await productionLimiter(pdfLimiter).limit(`pdf-export:${input.userId}:${input.id}`);
	const result = account.success ? document : account;
	const reset = result.reset ?? Date.now() + 60_000;
	input.resHeaders?.set("ratelimit-remaining", String(result.remaining));
	input.resHeaders?.set("ratelimit-reset", String(reset));
	if (!result.success) {
		input.resHeaders?.set("retry-after", String(Math.max(1, Math.ceil((reset - Date.now()) / 1000))));
		throw new ORPCError("TOO_MANY_REQUESTS", { data: { reset } });
	}
}

export const resumeDownloadRateLimit = createRatelimitMiddleware<
	ContextWithHeaders,
	{ username: string; slug: string }
>({
	limiter: productionLimiter(resumeDownloadLimiter),
	key: ({ context }, input) =>
		`resume-download:${input.username}:${input.slug}:${getUserKey(context)}:${getClientKey(context.trustedClient)}`,
});

// Per account, not per document or thread: each new ID would otherwise get a fresh budget, and server-managed AI is
// paid for by the operator.
export const aiRequestRateLimit = createRatelimitMiddleware<ContextWithHeaders, unknown>({
	limiter: productionLimiter(aiLimiter),
	key: ({ context }) => `ai-request:${getUserKey(context)}`,
});

// Each checkout or plan change calls Dodo Payments; ten in ten minutes is plenty for a person.
export const checkoutRateLimit = createRatelimitMiddleware<ContextWithHeaders, unknown>({
	limiter: productionLimiter(checkoutLimiter),
	key: ({ context }) => `checkout:${getUserKey(context)}`,
});

// Voice practice transcribes and speaks every turn, so it has its own account budget beside the chat's.
export const aiVoiceRateLimit = createRatelimitMiddleware<ContextWithHeaders, unknown>({
	limiter: productionLimiter(aiVoiceLimiter),
	key: ({ context }) => `ai-voice:${getUserKey(context)}`,
});

export const storageUploadRateLimit = createRatelimitMiddleware<ContextWithHeaders, unknown>({
	limiter: productionLimiter(storageUploadLimiter),
	key: ({ context }) => `storage-upload:${getUserKey(context)}`,
});

// Per account: spellings of one filename (`a.jpg`, `/a.jpg`, `//a.jpg`) name the same file but would each get a budget.
export const storageDeleteRateLimit = createRatelimitMiddleware<ContextWithHeaders, { filename: string }>({
	limiter: productionLimiter(storageDeleteLimiter),
	key: ({ context }) => `storage-delete:${getUserKey(context)}`,
});

export const resumeMutationRateLimit = createRatelimitMiddleware<ContextWithHeaders, unknown>({
	limiter: productionLimiter(resumeMutationLimiter),
	key: ({ context }, input) => `resume-mutation:${getUserKey(context)}:${getInputKeyPart(input)}`,
});

const pdfAnalysisLimiter = createRateLimiter("pdfAnalysisLimiter", rateLimitConfig.orpc.pdfExport);
export const pdfAnalysisRateLimit = createRatelimitMiddleware<ContextWithHeaders, unknown>({
	limiter: productionLimiter(pdfAnalysisLimiter),
	key: ({ context }) => `pdf-analysis:${getClientKey(context.trustedClient)}`,
});

export const resumeUpdatesRateLimit = createRatelimitMiddleware<ContextWithHeaders, { id: string }>({
	limiter: productionLimiter(resumeUpdatesLimiter),
	key: ({ context }, input) => `resume-updates:${getUserKey(context)}:${input.id}`,
});

export const resumeUpdatesUserRateLimit = createRatelimitMiddleware<ContextWithHeaders, unknown>({
	limiter: productionLimiter(resumeUpdatesUserLimiter),
	key: ({ context }) => `resume-updates-user:${getUserKey(context)}`,
});

const portfolioUpdateLimiter = createRateLimiter("portfolioUpdateLimiter", rateLimitConfig.orpc.portfolioUpdates);
const portfolioMutationLimiter = createRateLimiter("portfolioMutationLimiter", rateLimitConfig.orpc.portfolioMutations);
const portfolioUploadLimiter = createRateLimiter("portfolioUploadLimiter", rateLimitConfig.orpc.portfolioUploads);
const portfolioFileDeleteLimiter = createRateLimiter(
	"portfolioFileDeleteLimiter",
	rateLimitConfig.orpc.portfolioFileDeletes,
);
const portfolioUnfurlLimiter = createRateLimiter("portfolioUnfurlLimiter", rateLimitConfig.orpc.portfolioUnfurls);
const portfolioRemoteImageLimiter = createRateLimiter(
	"portfolioRemoteImageLimiter",
	rateLimitConfig.orpc.portfolioRemoteImages,
);

/** Per account: one portfolio each, saved on its own while the owner edits. */
export const portfolioUpdateRateLimit = createRatelimitMiddleware<ContextWithHeaders, unknown>({
	limiter: productionLimiter(portfolioUpdateLimiter),
	key: ({ context }) => `portfolio-update:${getUserKey(context)}`,
});

/** Per account: creating, publishing, settings and deleting. */
export const portfolioMutationRateLimit = createRatelimitMiddleware<ContextWithHeaders, unknown>({
	limiter: productionLimiter(portfolioMutationLimiter),
	key: ({ context }) => `portfolio-mutation:${getUserKey(context)}`,
});

/** Per account: pictures for the portfolio, often many in a row (a gallery, one work per picture). */
export const portfolioUploadRateLimit = createRatelimitMiddleware<ContextWithHeaders, unknown>({
	limiter: productionLimiter(portfolioUploadLimiter),
	key: ({ context }) => `portfolio-upload:${getUserKey(context)}`,
});

/** Per account: removing pictures the portfolio no longer uses. */
export const portfolioFileDeleteRateLimit = createRatelimitMiddleware<ContextWithHeaders, unknown>({
	limiter: productionLimiter(portfolioFileDeleteLimiter),
	key: ({ context }) => `portfolio-file-delete:${getUserKey(context)}`,
});

/** Per account: pasted links read from other sites (`portfolio.unfurl`). */
export const portfolioUnfurlRateLimit = createRatelimitMiddleware<ContextWithHeaders, unknown>({
	limiter: productionLimiter(portfolioUnfurlLimiter),
	key: ({ context }) => `portfolio-unfurl:${getUserKey(context)}`,
});

/** Per account: preview pictures fetched from other sites once the owner approves them. */
export const portfolioRemoteImageRateLimit = createRatelimitMiddleware<ContextWithHeaders, unknown>({
	limiter: productionLimiter(portfolioRemoteImageLimiter),
	key: ({ context }) => `portfolio-remote-image:${getUserKey(context)}`,
});
