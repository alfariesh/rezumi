import { describe, expect, it } from "vite-plus/test";
import { ORPCError } from "@orpc/client";
import { errorKind } from "./errors";
import { OfflineError } from "./offline";

describe("errorKind", () => {
	it.each([
		[new OfflineError(), "offline"],
		[new TypeError("Failed to fetch"), "offline"],
		[new ORPCError("EXTENSION_OUTDATED", { status: 426 }), "outdated"],
		[new ORPCError("UNAUTHORIZED", { status: 401 }), "expired"],
		[new ORPCError("RATE_LIMIT_EXCEEDED", { status: 429 }), "rate-limit"],
		[new ORPCError("TOO_MANY_REQUESTS", { status: 429 }), "rate-limit"],
		[new ORPCError("INSUFFICIENT_CREDITS", { status: 402 }), "credits"],
		[new ORPCError("PLAN_FEATURE_REQUIRED", { status: 403 }), "credits"],
		[new ORPCError("BAD_REQUEST", { status: 400 }), "invalid"],
		[new ORPCError("INTERNAL_SERVER_ERROR", { status: 500 }), "server"],
		[new Error("boom"), "server"],
	])("%s → %s", (error, kind) => {
		expect(errorKind(error)).toBe(kind);
	});
});
