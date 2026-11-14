import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createRouterClient } from "@orpc/server";
import { parseWritablePortfolioData } from "@rezumi/schema/portfolio/data";
import { PORTFOLIO_LIMITS, PORTFOLIO_UPLOAD } from "@rezumi/schema/portfolio/limits";
import { aiErrors } from "../ai/procedure";

const fixture = vi.hoisted(() => ({ mode: "off" as "off" | "admins" | "on" }));

vi.mock("@rezumi/env/server", async () => {
	const actual = await vi.importActual<typeof import("@rezumi/env/server")>("@rezumi/env/server");
	return {
		...actual,
		env: {
			...actual.env,
			get PORTFOLIO_MODE() {
				return fixture.mode;
			},
		},
	};
});
vi.mock("../../context", async () => {
	const { os } = await vi.importActual<typeof import("@orpc/server")>("@orpc/server");
	return {
		protectedProcedure: os.$context<{ user: { id: string } }>(),
		publicProcedure: os.$context<Record<string, never>>(),
	};
});
// With the mode off, no procedure may touch the database; with it on, these tests are refused before they could.
vi.mock("@rezumi/db/client", () => ({
	get db(): never {
		throw new Error("The database was used.");
	},
}));

const { portfolioRouter } = await import("./router");
const { PORTFOLIO_ERRORS } = await import("./errors");
const { flagsRouter } = await import("../flags/router");

const client = () =>
	createRouterClient(portfolioRouter, { context: { user: { id: "member" }, reqHeaders: new Headers() } as never });

describe("portfolio procedures while PORTFOLIO_MODE is off", () => {
	beforeEach(() => {
		fixture.mode = "off";
	});

	it("reports the feature as unavailable without reading anything", async () => {
		await expect(client().get()).resolves.toEqual({
			enabled: false,
			portfolio: null,
			contactFormAvailable: false,
			limits: { works: 50, storageBytes: PORTFOLIO_UPLOAD.accountBytes, dataBytes: 256 * 1024 },
			usage: { works: 0, storageBytes: 0 },
		});
		await expect(client().status()).resolves.toEqual({ enabled: false, portfolio: null });
	});

	it("refuses every change, with the refusal each procedure declares", async () => {
		const disabled = { code: "PORTFOLIO_DISABLED", status: 403, defined: true };
		const data = parseWritablePortfolioData({});
		await expect(client().create({})).rejects.toMatchObject(disabled);
		await expect(client().update({ data, expectedUpdatedAt: new Date() })).rejects.toMatchObject(disabled);
		await expect(client().setPublic({ isPublic: true })).rejects.toMatchObject(disabled);
		await expect(client().updateSettings({ showInSearchEngines: false })).rejects.toMatchObject(disabled);
		await expect(client().delete()).rejects.toMatchObject(disabled);
		await expect(client().importWorks({ resumeItemIds: ["p1"], expectedUpdatedAt: new Date() })).rejects.toMatchObject(
			disabled,
		);
		await expect(
			client().uploadImage({ file: new File([new Uint8Array([0xff, 0xd8, 0xff])], "a.jpg", { type: "image/jpeg" }) }),
		).rejects.toMatchObject(disabled);
		await expect(client().deleteFile({ key: "uploads/member/pictures/portfolio/a.webp" })).rejects.toMatchObject(
			disabled,
		);
		await expect(
			client().uploadPdf({ file: new File(["%PDF-1.7"], "a.pdf", { type: "application/pdf" }), pages: 1 }),
		).rejects.toMatchObject(disabled);
		await expect(client().unfurl({ url: "https://github.com/nadia/kopi-app" })).rejects.toMatchObject(disabled);
		await expect(client().fetchRemoteImage({ url: "https://example.com/cover.png" })).rejects.toMatchObject(disabled);
		// What AI reads and writes (Phase 14).
		await expect(client().aiView()).rejects.toMatchObject(disabled);
		await expect(
			client().applyEdits({ title: "Theme", edits: [{ op: "set", path: "theme", value: "prima" }] }),
		).rejects.toMatchObject(disabled);
		await expect(client().addImage({ url: "https://example.com/cover.png" })).rejects.toMatchObject(disabled);
		await expect(
			client().addImage({ file: new File([new Uint8Array([0xff, 0xd8, 0xff])], "a.jpg", { type: "image/jpeg" }) }),
		).rejects.toMatchObject(disabled);
	});
});

describe("portfolio input", () => {
	beforeEach(() => {
		fixture.mode = "on";
	});

	it("rejects invalid data before anything else", async () => {
		await expect(
			client().update({ data: { hero: { greeting: "x".repeat(161) } }, expectedUpdatedAt: new Date() }),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			client().update({
				data: { testimonials: { items: [{ id: "t", quote: "Fake", name: "Nobody" }] } } as never,
				expectedUpdatedAt: new Date(),
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("refuses data far over the size limit from its raw size, before parsing it", async () => {
		// Every field within its own limit would still be refused by the schema here (the text is too long); the raw
		// size check answers first, without parsing.
		const content = `<p>${"x".repeat(4 * PORTFOLIO_LIMITS.dataBytes)}</p>`;
		await expect(
			client().update({ data: { about: { content } }, expectedUpdatedAt: new Date() }),
		).rejects.toMatchObject({
			code: "PORTFOLIO_TOO_LARGE",
			status: 413,
			defined: true,
			data: { bytes: expect.any(Number), max: PORTFOLIO_LIMITS.dataBytes },
		});
		// AI edits too: ten edits of a megabyte each are refused before anything parses or cleans them.
		const edits = Array.from({ length: 10 }, () => ({ op: "set" as const, path: "about.content", value: content }));
		await expect(client().applyEdits({ title: "Huge", edits })).rejects.toMatchObject({
			code: "PORTFOLIO_TOO_LARGE",
			status: 413,
			defined: true,
		});
		// Input that isn't JSON at all is left to the schema.
		await expect(
			client().update({ data: { hero: { greeting: 1n } } as never, expectedUpdatedAt: new Date() }),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("checks AI edits and added pictures before anything else", async () => {
		const bad = { code: "BAD_REQUEST" };
		await expect(
			client().applyEdits({ title: "Odd", edits: [{ op: "rename", list: "works" }] as never }),
		).rejects.toMatchObject(bad);
		await expect(
			client().applyEdits({ title: "Path", edits: [{ op: "set", path: "seo.robots", value: false }] as never }),
		).rejects.toMatchObject(bad);
		await expect(client().applyEdits({ title: "None", edits: [] })).rejects.toMatchObject(bad);
		await expect(
			client().applyEdits({
				title: "Blocks",
				edits: [{ op: "add", list: "blocks", item: { type: "text", html: "<p>Hi</p>" } }],
			}),
		).rejects.toMatchObject(bad);
		await expect(client().addImage({})).rejects.toMatchObject(bad);
		await expect(
			client().addImage({
				url: "https://example.com/a.png",
				file: new File([new Uint8Array([1])], "a.png", { type: "image/png" }),
			}),
		).rejects.toMatchObject(bad);
		await expect(
			client().addImage({ file: new File([new Uint8Array(10 * 1024 * 1024 + 1)], "a.png", { type: "image/png" }) }),
		).rejects.toMatchObject(bad);
	});

	it("refuses files over the upload limits before reading them", async () => {
		const tooBig = (bytes: number, name: string, type: string) => new File([new Uint8Array(bytes)], name, { type });
		await expect(
			client().uploadImage({ file: tooBig(PORTFOLIO_UPLOAD.imageBytes + 1, "a.webp", "image/webp") }),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			client().uploadImage({
				file: tooBig(10, "a.webp", "image/webp"),
				thumbnail: tooBig(PORTFOLIO_UPLOAD.imageBytes + 1, "b.webp", "image/webp"),
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			client().uploadPdf({ file: tooBig(PORTFOLIO_UPLOAD.pdfBytes + 1, "a.pdf", "application/pdf"), pages: 1 }),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});
});

describe("the portfolio router", () => {
	const { messages, ai, admin, ...direct } = portfolioRouter;
	const procedures = [
		...Object.entries(direct),
		...Object.entries(messages),
		...Object.entries(ai),
		...Object.entries(admin),
	];

	it("rate-limits before checking input, so a limited account costs no parsing", () => {
		for (const [name, procedure] of procedures) {
			const { inputValidationIndex, middlewares } = procedure["~orpc"];
			expect(inputValidationIndex, name).toBe(middlewares.length);
		}
		expect(portfolioRouter.update["~orpc"].middlewares.length).toBeGreaterThan(1);
	});

	it("declares each refusal from the one shared definition", () => {
		for (const [name, procedure] of procedures)
			for (const [code, definition] of Object.entries(procedure["~orpc"].errorMap))
				expect(definition, `${name} ${code}`).toBe(
					code in aiErrors
						? aiErrors[code as keyof typeof aiErrors]
						: PORTFOLIO_ERRORS[code as keyof typeof PORTFOLIO_ERRORS],
				);
	});
});

describe("the public portfolio flag", () => {
	it("is on only when portfolios are open to everyone", async () => {
		const flags = createRouterClient(flagsRouter, { context: {} as never });
		for (const [mode, expected] of [
			["off", false],
			["admins", false],
			["on", true],
		] as const) {
			fixture.mode = mode;
			expect((await flags.get()).portfolio).toBe(expected);
		}
	});
});
