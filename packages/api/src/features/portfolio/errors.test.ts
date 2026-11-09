import { describe, expect, it } from "vite-plus/test";
import { validateORPCError } from "@orpc/server";
import { PORTFOLIO_ERRORS, portfolioErrorMap, portfolioErrors } from "./errors";

describe("portfolio refusals", () => {
	it("keep the codes and statuses the apps map", () => {
		expect(Object.fromEntries(Object.entries(PORTFOLIO_ERRORS).map(([code, { status }]) => [code, status]))).toEqual({
			PORTFOLIO_DISABLED: 403,
			PORTFOLIO_EXISTS: 409,
			NOT_FOUND: 404,
			PORTFOLIO_SOURCE_INVALID: 400,
			PORTFOLIO_VERSION_CONFLICT: 409,
			PORTFOLIO_TOO_LARGE: 413,
			PORTFOLIO_FILE_NOT_FOUND: 400,
			PORTFOLIO_EMAIL_NOT_VERIFIED: 403,
			PORTFOLIO_SUSPENDED: 403,
			PORTFOLIO_MODERATION_CONFLICT: 409,
			PORTFOLIO_CANNOT_BAN_ADMIN: 403,
			PORTFOLIO_FILE_TOO_LARGE: 413,
			PORTFOLIO_PDF_INVALID: 400,
			PORTFOLIO_LINK_UNREADABLE: 400,
			PORTFOLIO_IMAGE_INVALID: 400,
			PORTFOLIO_FILE_IN_USE: 409,
			PORTFOLIO_WORKS_LIMIT: 400,
			PORTFOLIO_AI_UNUSABLE: 502,
			PORTFOLIO_STORAGE_FULL: 413,
		});
	});

	it("are thrown just as they're declared, data included", async () => {
		const thrown = [
			portfolioErrors.disabled(),
			portfolioErrors.exists(),
			portfolioErrors.notFound(),
			portfolioErrors.sourceInvalid(),
			portfolioErrors.sourceInvalid("unreadable", new Error("Stored resume data does not match")),
			portfolioErrors.conflict(new Date("2026-11-07T08:00:00Z")),
			portfolioErrors.tooLarge(300 * 1024),
			portfolioErrors.fileNotFound("uploads/u/pictures/portfolio/a.webp"),
			portfolioErrors.emailNotVerified(),
			portfolioErrors.suspended(),
			portfolioErrors.moderationConflict(),
			portfolioErrors.cannotBanAdmin(),
			portfolioErrors.fileTooLarge(3 * 1024 * 1024),
			portfolioErrors.fileTooLarge(11 * 1024 * 1024, "pdf"),
			portfolioErrors.fileTooLarge(11 * 1024 * 1024, "remote-picture"),
			portfolioErrors.pdfInvalid("type"),
			portfolioErrors.linkUnreadable("timeout"),
			...(["type", "animated", "dimensions", "unreadable"] as const).map((reason) =>
				portfolioErrors.imageInvalid(reason),
			),
			portfolioErrors.fileInUse("uploads/u/pictures/portfolio/a.webp"),
			portfolioErrors.worksLimit(),
			portfolioErrors.aiUnusable(),
			portfolioErrors.storageFull({ bytes: 1024, files: 3 }),
		];
		expect(new Set(thrown.map((error) => error.code))).toEqual(new Set(Object.keys(PORTFOLIO_ERRORS)));
		for (const error of thrown) {
			const definition = PORTFOLIO_ERRORS[error.code as keyof typeof PORTFOLIO_ERRORS];
			expect(error.status, error.code).toBe(definition.status);
			// What oRPC does with a refusal a procedure declares: valid data makes it `defined` (typed for clients).
			expect((await validateORPCError(PORTFOLIO_ERRORS, error)).defined, error.code).toBe(true);
		}
	});

	it("say what was refused", () => {
		expect(portfolioErrors.conflict(new Date("2026-11-07T08:00:00Z")).data).toEqual({
			updatedAt: "2026-11-07T08:00:00.000Z",
		});
		expect(portfolioErrors.tooLarge(300 * 1024)).toMatchObject({
			message: expect.stringContaining("300 KB of 256 KB"),
			data: { bytes: 300 * 1024, max: 256 * 1024 },
		});
		expect(portfolioErrors.sourceInvalid().data).toEqual({ reason: "unavailable" });
		expect(portfolioErrors.sourceInvalid("unreadable").message).toContain("can't be read");
		expect(portfolioErrors.storageFull({ bytes: 1024 ** 3, files: 12 })).toMatchObject({
			message: expect.stringContaining("12 of 3000 files"),
			data: { bytes: 1024 ** 3, maxBytes: 1024 ** 3, files: 12, maxFiles: 3000 },
		});
	});

	it("are picked for a procedure from the same definitions", () => {
		expect(portfolioErrorMap("NOT_FOUND", "PORTFOLIO_STORAGE_FULL")).toEqual({
			NOT_FOUND: PORTFOLIO_ERRORS.NOT_FOUND,
			PORTFOLIO_STORAGE_FULL: PORTFOLIO_ERRORS.PORTFOLIO_STORAGE_FULL,
		});
	});
});
