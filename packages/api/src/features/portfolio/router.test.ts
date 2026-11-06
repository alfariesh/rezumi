import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createRouterClient } from "@orpc/server";
import { parseWritablePortfolioData } from "@rezumi/schema/portfolio/data";

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
// With the mode off, no procedure may touch the database.
vi.mock("@rezumi/db/client", () => ({
	get db(): never {
		throw new Error("The database was used while portfolios are off.");
	},
}));

const { portfolioRouter } = await import("./router");
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
			limits: { works: 50, storageBytes: null, dataBytes: 256 * 1024 },
			usage: { works: 0, storageBytes: 0 },
		});
	});

	it("refuses every change", async () => {
		const disabled = { code: "PORTFOLIO_DISABLED", status: 403 };
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
	});

	it("rejects invalid data before anything else", async () => {
		fixture.mode = "on";
		await expect(
			client().update({ data: { hero: { greeting: "x".repeat(161) } }, expectedUpdatedAt: new Date() }),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
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
