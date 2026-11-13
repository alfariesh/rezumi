import { ORPCError } from "@orpc/server";

/**
 * Every refusal of `profile.sources.*`, defined once: the router declares them (so clients get them typed) and the
 * sources throw them through `sourceErrors`. Messages are plain English for API callers and never name a token, a
 * provider's answer or the data that was read.
 */
export const SOURCE_ERRORS = {
	SOURCE_UNAVAILABLE: { status: 409, message: "This source isn't available for this account." },
	SOURCE_NOT_FOUND: {
		status: 404,
		message: "Nothing was found there. Check the address, or that the profile is public.",
	},
	SOURCE_INVALID: { status: 400, message: "That isn't an address or username this source can read." },
	SOURCE_LIMIT: { status: 429, message: "This source was used as often as it can be today. Try again tomorrow." },
	SOURCE_FAILED: { status: 502, message: "The source couldn't be read just now. Try again in a moment." },
} as const;

type SourceErrorCode = keyof typeof SOURCE_ERRORS;

function refusal(code: SourceErrorCode, message?: string) {
	const definition = SOURCE_ERRORS[code];
	return new ORPCError(code, { status: definition.status, message: message ?? definition.message });
}

export const sourceErrors = {
	unavailable: (message?: string) => refusal("SOURCE_UNAVAILABLE", message),
	notFound: (message?: string) => refusal("SOURCE_NOT_FOUND", message),
	invalid: (message?: string) => refusal("SOURCE_INVALID", message),
	limit: (message?: string) => refusal("SOURCE_LIMIT", message),
	failed: (message?: string) => refusal("SOURCE_FAILED", message),
};
