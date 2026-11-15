// oxlint-disable typescript/no-non-null-assertion -- These tests assert registered tool names before exercising handlers.

import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { ORPCError } from "@orpc/server";
import { TOOL_META } from "./tool-meta";

vi.mock("@rezumi/api/context", () => ({
	resolveUserFromRequestHeaders: vi.fn(),
}));

vi.mock("./files", () => ({ readMcpFile: vi.fn() }));

vi.mock("@rezumi/api/features/resume/export", () => ({
	createResumePdfDownloadUrl: vi.fn(),
}));

vi.mock("@rezumi/env/server", () => ({
	env: {
		APP_URL: "https://example.com",
	},
}));

const { MCP_TOOL_NAME } = await import("./mcp-tool-names");
const { registerTools } = await import("./tools");

type ToolHandler = (input: Record<string, unknown>) => Promise<{
	content: Array<{ type: "text"; text: string }>;
	isError?: boolean;
	structuredContent?: Record<string, unknown>;
}>;

type Registration = {
	name: string;
	config: {
		title?: string;
		description?: string;
		inputSchema?: unknown;
	};
	handler: ToolHandler;
};

const makeFakeServer = () => {
	const registered: Registration[] = [];
	const server = {
		registerTool: vi.fn((name: string, config: Registration["config"], handler: ToolHandler) => {
			registered.push({ name, config, handler });
		}),
	};
	return { server, registered };
};

const clientMock = {
	resume: {
		getById: vi.fn(),
		list: vi.fn(),
		tags: { list: vi.fn() },
		create: vi.fn(),
		import: vi.fn(),
		duplicate: vi.fn(),
		patch: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
		setLocked: vi.fn(),
		statistics: { getById: vi.fn() },
	},
	coverLetters: {
		list: vi.fn(),
		getById: vi.fn(),
		create: vi.fn(),
		update: vi.fn(),
		refreshStyle: vi.fn(),
		duplicate: vi.fn(),
		delete: vi.fn(),
		copyEmbedded: vi.fn(),
		export: vi.fn(),
		import: vi.fn(),
	},
	portfolio: {
		status: vi.fn(),
		aiView: vi.fn(),
		create: vi.fn(),
		applyEdits: vi.fn(),
		addImage: vi.fn(),
		setPublic: vi.fn(),
		statistics: vi.fn(),
	},
	applications: {
		list: vi.fn(),
		getById: vi.fn(),
		tags: vi.fn(),
		stats: vi.fn(),
		create: vi.fn(),
		update: vi.fn(),
		addNote: vi.fn(),
		addInterview: vi.fn(),
		updateInterview: vi.fn(),
		updateTimelineEntry: vi.fn(),
		deleteTimelineEntry: vi.fn(),
		delete: vi.fn(),
		bulkUpdate: vi.fn(),
		bulkDelete: vi.fn(),
		import: vi.fn(),
		attachDocument: vi.fn(),
		removeDocument: vi.fn(),
		ai: {
			autofill: vi.fn(),
			matchScore: vi.fn(),
			tailorResume: vi.fn(),
			draftMessage: vi.fn(),
		},
	},
};

describe("registerTools", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("creates and duplicates with an automatically generated address", async () => {
		const { server, registered } = makeFakeServer();
		registerTools(server as never, clientMock as never, new Headers());
		clientMock.resume.create.mockResolvedValueOnce("created");
		clientMock.resume.duplicate.mockResolvedValueOnce("copied");
		const create = registered.find((tool) => tool.name === MCP_TOOL_NAME.createResume)!;
		const duplicate = registered.find((tool) => tool.name === MCP_TOOL_NAME.duplicateResume)!;
		await create.handler(TOOL_META[MCP_TOOL_NAME.createResume].inputSchema.parse({ name: "Resume" }));
		await duplicate.handler(TOOL_META[MCP_TOOL_NAME.duplicateResume].inputSchema.parse({ id: "r1" }));
		expect(clientMock.resume.create).toHaveBeenCalledWith({ name: "Resume", tags: [], withSampleData: false });
		expect(clientMock.resume.duplicate).toHaveBeenCalledWith({ id: "r1" });
	});

	it("imports applications with followUpAt coerced to Date and null preserved", async () => {
		clientMock.applications.import.mockResolvedValueOnce({ imported: 2 });
		const { server, registered } = makeFakeServer();
		registerTools(server as never, clientMock as never, new Headers());

		const tool = registered.find((item) => item.name === "import_applications")!;
		const result = await tool.handler({
			items: [
				{ company: "Acme", role: "Engineer", followUpAt: "2026-07-12T12:00:00.000Z" },
				{ company: "Beta", role: "Designer", followUpAt: null },
			],
		});

		expect(clientMock.applications.import).toHaveBeenCalledWith({
			items: [
				{ company: "Acme", role: "Engineer", followUpAt: new Date("2026-07-12T12:00:00.000Z") },
				{ company: "Beta", role: "Designer", followUpAt: null },
			],
		});
		expect(JSON.parse(result.content[0]!.text)).toEqual({ imported: 2 });
	});

	it("returns resume revision metadata and forwards the timestamp when patching", async () => {
		const updatedAt = new Date("2026-10-01T10:00:00.000Z");
		const resume = { id: "r1", name: "Resume", updatedAt, data: { basics: { name: "Before" } } };
		clientMock.resume.getById.mockResolvedValueOnce(resume);
		clientMock.resume.patch.mockResolvedValueOnce(resume);
		const { server, registered } = makeFakeServer();
		registerTools(server as never, clientMock as never, new Headers());
		const read = registered.find((tool) => tool.name === MCP_TOOL_NAME.getResume)!;
		const patch = registered.find((tool) => tool.name === MCP_TOOL_NAME.patchResume)!;
		const result = await read.handler({ id: "r1" });
		expect(result.structuredContent?.updatedAt).toBe("2026-10-01T10:00:00.000Z");
		expect(JSON.parse(result.content[0]!.text)).toEqual(resume.data);
		await patch.handler(
			TOOL_META[MCP_TOOL_NAME.patchResume].inputSchema.parse({
				id: "r1",
				expectedUpdatedAt: result.structuredContent?.updatedAt,
				operations: [{ op: "replace", path: "/basics/name", value: "After" }],
			}),
		);
		expect(clientMock.resume.patch.mock.calls[0]?.[0].expectedUpdatedAt).toEqual(updatedAt);
	});

	describe("portfolio", () => {
		const tool = (name: string) => {
			const { server, registered } = makeFakeServer();
			registerTools(server as never, clientMock as never, new Headers(), {
				user: { id: "owner", username: "dana" },
			} as never);
			return registered.find((item) => item.name === name)!;
		};

		it("reads the portfolio with the edit language, or says how to start one", async () => {
			const updatedAt = new Date("2026-11-14T08:00:00.000Z");
			clientMock.portfolio.status.mockResolvedValueOnce({
				enabled: true,
				portfolio: { isPublic: true, suspendedAt: null },
			});
			clientMock.portfolio.aiView.mockResolvedValueOnce({
				view: { works: [{ id: "w1", title: "Lumen" }] },
				updatedAt,
				published: true,
				url: "https://example.com/dana",
				uploads: [],
				plan: null,
			});
			const read = await tool(MCP_TOOL_NAME.getPortfolio).handler({});
			expect(read.isError).toBeUndefined();
			expect(read.structuredContent).toMatchObject({
				exists: true,
				enabled: true,
				updatedAt: "2026-11-14T08:00:00.000Z",
				published: true,
				url: "https://example.com/dana",
				view: { works: [{ id: "w1", title: "Lumen" }] },
				guide: expect.any(String),
			});
			expect(TOOL_META[MCP_TOOL_NAME.getPortfolio].outputSchema.safeParse(read.structuredContent).success).toBe(true);

			clientMock.portfolio.status.mockResolvedValueOnce({ enabled: true, portfolio: null });
			const none = await tool(MCP_TOOL_NAME.getPortfolio).handler({});
			expect(none.structuredContent).toMatchObject({ exists: false, enabled: true, view: null });
			expect(none.content[0]!.text).toContain(MCP_TOOL_NAME.createPortfolio);
			expect(clientMock.portfolio.aiView).toHaveBeenCalledTimes(1);

			clientMock.portfolio.status.mockResolvedValueOnce({ enabled: false, portfolio: null });
			expect((await tool(MCP_TOOL_NAME.getPortfolio).handler({})).structuredContent).toMatchObject({
				exists: false,
				enabled: false,
			});
		});

		it("applies edits and returns failures as part of the result, not as an error", async () => {
			clientMock.portfolio.applyEdits.mockResolvedValueOnce({
				title: "Add Lumen",
				applied: [{ index: 0, summary: 'Added work "Lumen"', id: "w9" }],
				failed: [{ index: 1, error: "No works item has the id nope." }],
				updatedAt: new Date("2026-11-14T09:00:00.000Z"),
			});
			const input = TOOL_META[MCP_TOOL_NAME.editPortfolio].inputSchema.parse({
				title: "Add Lumen",
				edits: [
					{ op: "add", list: "works", item: { title: "Lumen" } },
					{ op: "remove", list: "works", id: "nope" },
				],
				expectedUpdatedAt: "2026-11-14T08:00:00.000Z",
			});
			const result = await tool(MCP_TOOL_NAME.editPortfolio).handler(input);
			expect(clientMock.portfolio.applyEdits).toHaveBeenCalledWith({
				title: "Add Lumen",
				edits: input.edits,
				expectedUpdatedAt: new Date("2026-11-14T08:00:00.000Z"),
			});
			expect(result.isError).toBeUndefined();
			expect(result.content[0]!.text).toContain("#1 failed: No works item has the id nope.");
			expect(result.content[0]!.text).toContain("(id: w9)");
			expect(result.structuredContent).toMatchObject({ updatedAt: "2026-11-14T09:00:00.000Z", failed: [{ index: 1 }] });
			expect(TOOL_META[MCP_TOOL_NAME.editPortfolio].outputSchema.safeParse(result.structuredContent).success).toBe(
				true,
			);
		});

		it("adds a picture from a link or a file", async () => {
			const image = { key: "uploads/owner/pictures/portfolio/a.webp", width: 10, height: 10, alt: "Cover" };
			clientMock.portfolio.addImage.mockResolvedValue(image);
			const add = tool(MCP_TOOL_NAME.addPortfolioImage);
			const linked = await add.handler({ url: "https://example.com/a.webp", alt: "Cover" });
			expect(clientMock.portfolio.addImage).toHaveBeenLastCalledWith({
				url: "https://example.com/a.webp",
				alt: "Cover",
			});
			expect(linked.structuredContent).toMatchObject({ image });
			const { readMcpFile } = await import("./files");
			const file = new File([new Uint8Array([1])], "a.webp", { type: "image/webp" });
			vi.mocked(readMcpFile).mockResolvedValueOnce(file);
			const upload = { name: "a.webp", contentType: "image/webp", dataBase64: "AQ==" };
			await add.handler({ file: upload });
			expect(readMcpFile).toHaveBeenCalledWith(upload, "owner", 10 * 1024 * 1024);
			expect(clientMock.portfolio.addImage).toHaveBeenLastCalledWith({ file });
		});

		it("publishes at the account's address", async () => {
			clientMock.portfolio.setPublic.mockResolvedValueOnce({ isPublic: true });
			const result = await tool(MCP_TOOL_NAME.publishPortfolio).handler({ published: true });
			expect(clientMock.portfolio.setPublic).toHaveBeenCalledWith({ isPublic: true });
			expect(result.structuredContent).toMatchObject({ published: true, url: "https://example.com/dana" });
		});

		it.each([
			["NOT_FOUND", 404, `Create one with \`${MCP_TOOL_NAME.createPortfolio}\``],
			["PORTFOLIO_DISABLED", 403, "Portfolios aren't available for this account yet."],
			["PORTFOLIO_EMAIL_NOT_VERIFIED", 403, "verify their email address"],
			["PORTFOLIO_VERSION_CONFLICT", 409, `Call \`${MCP_TOOL_NAME.getPortfolio}\` again`],
			["PLAN_FEATURE_REQUIRED", 403, "The account's plan doesn't allow this."],
			["PLAN_LIMIT_REACHED", 403, "The account's plan doesn't allow this."],
			["PORTFOLIO_FILE_TOO_LARGE", 413, "the server can't resize pictures"],
			["PORTFOLIO_IMAGE_UNREACHABLE", 400, "Ask the user for the picture as a file instead"],
		])("hints on %s from a portfolio tool", async (code, status, expected) => {
			clientMock.portfolio.setPublic.mockRejectedValueOnce(new ORPCError(code, { status }));
			const result = await tool(MCP_TOOL_NAME.publishPortfolio).handler({ published: true });
			expect(result.isError).toBe(true);
			expect(result.content[0]!.text).toContain(expected);
		});
	});

	describe("error hints", () => {
		const readResume = (error: unknown) => {
			clientMock.resume.getById.mockRejectedValueOnce(error);

			const { server, registered } = makeFakeServer();
			registerTools(server as never, clientMock as never, new Headers());

			const tool = registered.find((item) => item.name === MCP_TOOL_NAME.getResume)!;
			return tool.handler({ id: "resume-1" });
		};

		it("hides unexpected internal failure details", async () => {
			const result = await readResume(new Error("postgresql://private-credentials/internal"));
			expect(result.isError).toBe(true);
			expect(result.content[0]!.text).toContain("Unexpected failure");
			expect(result.content[0]!.text).not.toContain("private-credentials");
		});

		// Procedures throw these without a message, so the message is the code itself
		// (or oRPC's default, "Not Found") and the status never appears in it.
		it.each([
			["RESUME_LOCKED", undefined, `Ask the user before unlocking with \`${MCP_TOOL_NAME.unlockResume}\`.`],
			[
				"NOT_FOUND",
				undefined,
				`\`${MCP_TOOL_NAME.listResumes}\`, \`${MCP_TOOL_NAME.listCoverLetters}\`, and \`${MCP_TOOL_NAME.listApplications}\` return valid ones.`,
			],
			["RESUME_SLUG_ALREADY_EXISTS", 400, "The slug is already in use."],
			["FORBIDDEN", undefined, "Permission denied."],
			["BAD_REQUEST", undefined, "Check the input parameters against the tool's schema."],
		])("hints on %s", async (code, status, expected) => {
			const result = await readResume(new ORPCError(code, status ? { status } : undefined));

			expect(result.isError).toBe(true);
			expect(result.content[0]!.text).toContain(expected);
		});
	});
});
