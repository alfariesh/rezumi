import type { ReadPageOutput } from "@rezumi/ai/tools/agent-tool-contracts";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { PORTFOLIO_EDIT_GUIDE } from "@rezumi/portfolio/edits";
import { buildAgentInstructions, buildAgentTools, buildPortfolioAgentInstructions, MAX_AGENT_WEB_CALLS } from "./tools";

const page: ReadPageOutput = {
	requestedUrl: "https://example.com/job",
	content: "Job description",
	format: "text",
	retrievedAt: "2026-09-30T12:00:00Z",
	method: "builtin",
	truncated: false,
	completeness: "unknown",
};
type ToolConfig = Parameters<typeof buildAgentTools>[0];

function build(externalSearch = false, signal = new AbortController().signal) {
	const handlers = {
		readDocument: vi.fn(async () => ({ text: "Resume" })),
		readAttachment: vi.fn(async () => ({})),
		proposeEdits: vi.fn(async () => ({})),
		searchWeb: vi.fn<ToolConfig["handlers"]["searchWeb"]>(async () => [
			{ url: "https://example.com/job", title: "Job" },
		]),
		readPage: vi.fn<ToolConfig["handlers"]["readPage"]>(async () => page),
	};
	return {
		handlers,
		tools: buildAgentTools({
			document: "resume",
			externalSearch,
			signal,
			handlers,
		}),
	};
}

afterEach(() => {
	vi.restoreAllMocks();
});
const options = { toolCallId: "call", messages: [] };
function execute(tools: ReturnType<typeof buildAgentTools>, name: string, input: unknown) {
	const run = tools[name]?.execute;
	if (!run) throw new Error(`Missing executable tool ${name}`);
	return (run as unknown as (input: unknown, executionOptions: typeof options) => unknown)(input, options);
}

describe("assistant Profile tool", () => {
	it("reads the Profile only when the caller offers it", async () => {
		expect(build().tools.read_profile).toBeUndefined();
		const readProfile = vi.fn(async () => ({ profile: "# Dana Reyes" }));
		const tools = buildAgentTools({
			document: null,
			externalSearch: false,
			signal: new AbortController().signal,
			handlers: { ...build().handlers, readProfile },
		});
		expect(await execute(tools, "read_profile", {})).toEqual({ profile: "# Dana Reyes" });
	});

	it("lets the prompt count the Profile as a source of facts", () => {
		const instructions = buildAgentInstructions({
			document: { kind: "resume", name: "CV" },
			posting: null,
			searchTool: null,
			canReadPage: false,
		});
		expect(instructions).toContain("`read_profile`");
		expect(instructions).toMatch(/the document, the user's Profile or the conversation/);
	});
});

describe("assistant web tools", () => {
	it("respects an explicit connection while keeping reading available without search credentials", async () => {
		const fallback = build();
		expect(fallback.tools.web_search).toBeUndefined();
		expect(fallback.tools.google_search).toBeUndefined();
		expect(fallback.tools.search_web).toBeUndefined();
		expect(await execute(fallback.tools, "read_page", { url: page.requestedUrl })).toEqual(page);
		const external = build(true);
		expect(external.tools.web_search).toBeUndefined();
		expect(await execute(external.tools, "search_web", { query: "Example company" })).toEqual([
			{ url: "https://example.com/job", title: "Job" },
		]);
		expect(external.handlers.searchWeb).toHaveBeenCalledWith("Example company", expect.any(AbortSignal));
	});

	it("shares one allowance across reading and search", async () => {
		const calls = MAX_AGENT_WEB_CALLS;
		const { tools, handlers } = build(true);
		for (let i = 0; i < calls - 1; i++) await execute(tools, "read_page", { url: page.requestedUrl });
		await execute(tools, "search_web", { query: "Company" });
		await expect(async () => execute(tools, "read_page", { url: page.requestedUrl })).rejects.toThrow(
			"Web access limit",
		);
		await expect(async () => execute(tools, "search_web", { query: "Company follow-up" })).rejects.toThrow(
			"Web access limit",
		);
		expect(handlers.readPage).toHaveBeenCalledTimes(calls - 1);
		expect(handlers.searchWeb).toHaveBeenCalledTimes(1);
	});

	it("never starts an aborted request", async () => {
		const controller = new AbortController();
		const pending = build(true, controller.signal);
		controller.abort(new DOMException("Stopped", "AbortError"));
		await expect(async () => execute(pending.tools, "search_web", { query: "Company" })).rejects.toThrow("Stopped");
		expect(pending.handlers.searchWeb).not.toHaveBeenCalled();
	});

	it("describes reader-only capabilities truthfully and names the selected search tool", () => {
		const reader = buildAgentInstructions({
			document: null,
			posting: null,
			searchTool: null,
			canReadPage: true,
		});
		expect(reader).toContain("Web search is unavailable");
		expect(reader).toContain("Use `read_page`");
		expect(reader).not.toContain("can't browse");
		expect(
			buildAgentInstructions({
				document: null,
				posting: null,
				searchTool: "search_web",
				canReadPage: true,
			}),
		).toContain("Use `search_web`");
	});
});

describe("portfolio assistant tools", () => {
	function buildPortfolio() {
		const handlers = {
			...build().handlers,
			readDocument: vi.fn(async () => ({ name: "Portfolio", updatedAt: "2026-11-14T08:00:00.000Z", data: {} })),
			editPortfolio: vi.fn(async () => ({
				title: "Add Lumen",
				edits: [
					{
						id: "card-1",
						edit: { op: "add" as const, list: "works" as const, item: { id: "w1", title: "Lumen" } },
						summary: 'Added work "Lumen"',
						status: "pending" as const,
						itemId: "w1",
					},
				],
				failed: [],
			})),
			saveAttachmentImage: vi.fn(async () => ({
				image: { key: "uploads/u/pictures/portfolio/a.webp", width: 10, height: 10, alt: "" },
			})),
		};
		const tools = buildAgentTools({
			document: "portfolio",
			externalSearch: false,
			signal: new AbortController().signal,
			handlers: { ...handlers, readProfile: vi.fn(async () => ({ profile: null })) },
		});
		return { tools, handlers };
	}

	it("offers reading, editing and saving attached pictures instead of proposals", () => {
		const { tools } = buildPortfolio();
		expect(Object.keys(tools).sort()).toEqual(
			[
				"ask_user_question",
				"edit_portfolio",
				"read_attachment",
				"read_page",
				"read_portfolio",
				"read_profile",
				"save_attachment_image",
			].sort(),
		);
		expect(tools.propose_edits).toBeUndefined();
		expect(tools.read_resume).toBeUndefined();
	});

	it("returns the resolved edits for the editor and only their outcome to the model", async () => {
		const { tools, handlers } = buildPortfolio();
		const input = { title: "Add Lumen", edits: [{ op: "add", list: "works", item: { title: "Lumen" } }] };
		const output = await execute(tools, "edit_portfolio", input);
		expect(handlers.editPortfolio).toHaveBeenCalledWith(input);
		expect(output).toMatchObject({ edits: [{ id: "card-1", status: "pending", itemId: "w1" }] });
		const modelOutput = await tools.edit_portfolio?.toModelOutput?.({ toolCallId: "call", input, output });
		expect(modelOutput).toEqual({
			type: "json",
			value: {
				title: "Add Lumen",
				applied: [{ summary: 'Added work "Lumen"', id: "w1" }],
				failed: [],
				note: expect.any(String),
			},
		});
		await execute(tools, "save_attachment_image", { attachmentId: "a1", alt: "Screens" });
		expect(handlers.saveAttachmentImage).toHaveBeenCalledWith({ attachmentId: "a1", alt: "Screens" });
		expect(await execute(tools, "read_portfolio", {})).toMatchObject({ name: "Portfolio" });
	});

	it("puts the portfolio rules and the edit language in the instructions", () => {
		const instructions = buildPortfolioAgentInstructions({ shared: true, searchTool: null, canReadPage: true });
		expect(instructions).toContain("`edit_portfolio`");
		expect(instructions).toContain("`save_attachment_image`");
		expect(instructions).toMatch(/Never invent/);
		expect(instructions).toMatch(/Never publish/);
		expect(instructions.endsWith(`${PORTFOLIO_EDIT_GUIDE}\n`)).toBe(true);
		expect(instructions).toContain("Web search is unavailable");
		expect(instructions).not.toContain("{{");
		const withheld = buildPortfolioAgentInstructions({ shared: false, searchTool: "search_web", canReadPage: false });
		expect(withheld).toContain("chose not to share the portfolio");
		expect(withheld).not.toContain(PORTFOLIO_EDIT_GUIDE);
		expect(withheld).toContain("Use `search_web`");
	});
});
