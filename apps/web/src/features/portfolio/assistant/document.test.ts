import type { PortfolioRecord } from "../editor/store";
import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { i18n } from "@lingui/core";
import { ORPCError } from "@orpc/client";
import { portfolioMessages, portfolioViewMessages } from "@rezumi/portfolio/messages";
import { parsePortfolioData } from "@rezumi/schema/portfolio/data";

const mocks = vi.hoisted(() => ({ update: vi.fn(), get: vi.fn(), compress: vi.fn() }));
vi.mock("@/libs/orpc/client", () => ({ client: { portfolio: { update: mocks.update, get: mocks.get } }, orpc: {} }));
vi.mock("@/libs/auth/client", () => ({ authClient: {} }));
vi.mock("@/features/billing/plan-dialog", () => ({ openPlanDialog: vi.fn() }));
vi.mock("../images/compress", async (importOriginal) => ({
	...(await importOriginal<typeof import("../images/compress")>()),
	compressImage: mocks.compress,
}));

const { usePortfolioEditorStore } = await import("../editor/store");
const { portfolioSendProblem, preparePortfolioUploads } = await import("./document");

const opened = new Date("2026-11-14T01:00:00.000Z");
const record = (data: PortfolioData, updatedAt = opened): PortfolioRecord => ({
	id: "portfolio",
	sourceResumeId: null,
	sourceResume: null,
	isPublic: false,
	showInSearchEngines: true,
	publishedAt: null,
	suspendedAt: null,
	suspendedReason: null,
	hasPassword: false,
	data,
	createdAt: opened,
	updatedAt,
});

const store = () => usePortfolioEditorStore.getState();
const context = { resume: null, messages: portfolioViewMessages(portfolioMessages("en-US")) };

beforeEach(() => {
	i18n.loadAndActivate({ locale: "en-US", messages: {} });
	mocks.update.mockReset();
	mocks.get.mockReset();
	mocks.compress.mockReset();
	store().load(record(parsePortfolioData({})));
});

afterEach(() => store().reset());

describe("before a portfolio message goes out", () => {
	it("saves what's waiting, then lets it go", async () => {
		mocks.update.mockImplementation(async ({ data }: { data: PortfolioData }) => record(data, new Date()));
		store().edit((draft) => {
			draft.hero.greeting = "Hello";
		});
		expect(await portfolioSendProblem(context)).toBeNull();
		expect(mocks.update).toHaveBeenCalledTimes(1);
		expect(store().status).toBe("saved");
	});

	it("holds it while the portfolio changed somewhere else", async () => {
		const other = record(parsePortfolioData({ hero: { greeting: "From the other tab" } }), new Date());
		mocks.update.mockRejectedValue(
			new ORPCError("PORTFOLIO_VERSION_CONFLICT", { data: { updatedAt: other.updatedAt } }),
		);
		mocks.get.mockResolvedValue({ enabled: true, portfolio: other });
		store().edit((draft) => {
			draft.hero.greeting = "Mine";
		});
		const problem = await portfolioSendProblem(context);
		expect(store().status).toBe("conflict");
		expect(problem).toBe(
			"Not sent: the assistant needs your latest changes saved first. Your portfolio changed somewhere else. Choose the version to keep.",
		);
	});
});

describe("pictures attached in a portfolio conversation", () => {
	it("are shrunk like the editor's uploads; other files and unreadable pictures go as they are", async () => {
		mocks.compress.mockImplementation(async (file: File) => {
			if (file.name === "broken.png") throw new Error("unreadable");
			return { file: new Blob(["small"], { type: "image/webp" }), thumbnail: null, width: 2000, height: 1500 };
		});
		const photo = new File(["big"], "Screen Shot.PNG", { type: "image/png" });
		const notes = new File(["notes"], "brief.pdf", { type: "application/pdf" });
		const broken = new File(["?"], "broken.png", { type: "image/png" });

		const prepared = await preparePortfolioUploads([photo, notes, broken]);

		expect(prepared.map((file) => [file.name, file.type])).toEqual([
			["Screen Shot.webp", "image/webp"],
			["brief.pdf", "application/pdf"],
			["broken.png", "image/png"],
		]);
		expect(mocks.compress).toHaveBeenCalledTimes(2);
	});
});
