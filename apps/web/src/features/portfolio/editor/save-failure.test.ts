import { describe, expect, it } from "vite-plus/test";
import { ORPCError } from "@orpc/client";
import { classifySaveError, issueDataPath, saveRetryDelay } from "./save-failure";

describe("what a failed save means", () => {
	it("tries again when the connection, the server or a rate limit failed it", () => {
		expect(classifySaveError(new TypeError("Failed to fetch"))).toEqual({
			kind: "retry",
			reason: "offline",
			maybeSaved: true,
		});
		expect(classifySaveError(new ORPCError("INTERNAL_SERVER_ERROR", { status: 500 }))).toEqual({
			kind: "retry",
			reason: "server",
			maybeSaved: true,
		});
		expect(classifySaveError(new ORPCError("TOO_MANY_REQUESTS", { status: 429, data: { reset: 123 } }))).toEqual({
			kind: "retry",
			reason: "busy",
			maybeSaved: false,
			notBefore: 123,
		});
		expect(classifySaveError(new ORPCError("UNAUTHORIZED", { status: 401 }))).toMatchObject({
			kind: "retry",
			reason: "signed-out",
		});
	});

	it("stops for good when the portfolio is gone or switched off", () => {
		expect(classifySaveError(new ORPCError("NOT_FOUND", { status: 404 }))).toEqual({
			kind: "problem",
			problem: { kind: "gone", code: "NOT_FOUND" },
		});
		expect(classifySaveError(new ORPCError("PORTFOLIO_DISABLED", { status: 403 }))).toEqual({
			kind: "problem",
			problem: { kind: "gone", code: "PORTFOLIO_DISABLED" },
		});
	});

	it("keeps what the server says about a refusal", () => {
		expect(
			classifySaveError(new ORPCError("PORTFOLIO_TOO_LARGE", { status: 413, data: { bytes: 300_000, max: 262_144 } })),
		).toEqual({ kind: "problem", problem: { kind: "too-large", bytes: 300_000, max: 262_144 } });
		expect(
			classifySaveError(new ORPCError("PORTFOLIO_FILE_NOT_FOUND", { status: 400, data: { key: "uploads/u/x.webp" } })),
		).toEqual({ kind: "problem", problem: { kind: "file-missing", key: "uploads/u/x.webp" } });
		const plan = new ORPCError("PLAN_LIMIT_REACHED", { status: 403 });
		expect(classifySaveError(plan)).toEqual({ kind: "problem", problem: { kind: "refused", error: plan } });
	});

	it("reads the other version from a conflict", () => {
		expect(
			classifySaveError(
				new ORPCError("PORTFOLIO_VERSION_CONFLICT", { status: 409, data: { updatedAt: "2026-11-06T01:00:00.000Z" } }),
			),
		).toEqual({ kind: "conflict", updatedAt: new Date("2026-11-06T01:00:00.000Z") });
		expect(classifySaveError(new ORPCError("PORTFOLIO_VERSION_CONFLICT", { status: 409 }))).toEqual({
			kind: "conflict",
			updatedAt: null,
		});
	});
});

describe("where the server's schema refused the data", () => {
	it("is the first issue's path inside the data", () => {
		expect(issueDataPath({ issues: [{ path: ["data", "works", "items", 2, { key: "title" }] }] })).toEqual([
			"works",
			"items",
			2,
			"title",
		]);
		expect(issueDataPath({ issues: [{ path: ["expectedUpdatedAt"] }, { path: ["data", "seo"] }] })).toEqual(["seo"]);
		expect(issueDataPath({ issues: [] })).toBeNull();
		expect(issueDataPath(undefined)).toBeNull();
	});
});

describe("pauses between tries", () => {
	it("double from 2 seconds to a minute, and wait as long as a rate limit asks", () => {
		expect([1, 2, 3, 4, 5, 6, 7].map((attempt) => saveRetryDelay(attempt, undefined, 0))).toEqual([
			2000, 4000, 8000, 16_000, 32_000, 60_000, 60_000,
		]);
		expect(saveRetryDelay(1, 45_000, 0)).toBe(45_000);
		expect(saveRetryDelay(1, 600_000, 0)).toBe(60_000);
		expect(saveRetryDelay(3, 1000, 0)).toBe(8000);
	});
});
