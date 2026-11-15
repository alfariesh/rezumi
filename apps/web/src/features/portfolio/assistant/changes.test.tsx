// @vitest-environment happy-dom
import type { PortfolioRecord } from "../editor/store";
import type { PortfolioAssistantDocument } from "@/features/assistant/document";
import type { EditPortfolioOutput } from "@rezumi/ai/tools/agent-tool-contracts";
import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { PortfolioEdit } from "@rezumi/schema/portfolio/edits";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { applyPortfolioEdits } from "@rezumi/portfolio/edits";
import { portfolioMessages, portfolioViewMessages } from "@rezumi/portfolio/messages";
import { parsePortfolioData } from "@rezumi/schema/portfolio/data";

const mocks = vi.hoisted(() => ({ setEditStatus: vi.fn(), update: vi.fn(), invalidate: vi.fn() }));
vi.mock("@/libs/orpc/client", () => ({
	client: {
		agent: { messages: { setEditStatus: mocks.setEditStatus } },
		portfolio: { update: mocks.update, get: vi.fn() },
	},
	orpc: { agent: { threads: { list: { key: () => ["threads"] } } } },
}));
vi.mock("@/libs/auth/client", () => ({ authClient: {} }));
vi.mock("@/features/billing/plan-dialog", () => ({ openPlanDialog: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: mocks.invalidate }) }));
vi.mock("./media", () => ({ fillInMedia: vi.fn(async () => {}) }));

const { usePortfolioEditorStore } = await import("../editor/store");
const { autoApplyPart } = await import("./apply");
const { PortfolioChanges } = await import("./changes");
const { forgetPortfolioChanges } = await import("./records");

const opened = new Date("2026-11-14T01:00:00.000Z");
const record = (data: PortfolioData): PortfolioRecord => ({
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
	updatedAt: opened,
});

const store = () => usePortfolioEditorStore.getState();
const titles = () => store().portfolio?.data.works.items.map((work) => work.title);

const reveal = vi.fn();
const document: PortfolioAssistantDocument = {
	kind: "portfolio",
	id: "portfolio",
	name: "Portfolio",
	locked: false,
	posting: null,
	source: { from: "resume", resume: null, messages: portfolioViewMessages(portfolioMessages("en-US")) },
	reveal,
};

let counter = 0;

/** An edit_portfolio output as the server sends it: edits the engine resolved on the editor's data. */
function output(edits: PortfolioEdit[], status: "pending" | "accepted" = "pending"): EditPortfolioOutput {
	counter += 1;
	const data = store().portfolio?.data;
	if (!data) throw new Error("No portfolio is open.");
	const result = applyPortfolioEdits(data, edits, { mode: "strict" });
	return {
		title: "Add the Lumen redesign",
		edits: result.applied.map((entry) => ({
			id: `card-${counter}-${entry.index}`,
			edit: entry.edit,
			summary: entry.summary,
			status,
		})),
		failed: result.failed,
	};
}

function renderCard(made: EditPortfolioOutput, toolCallId: string) {
	return render(
		<I18nProvider i18n={i18n}>
			<PortfolioChanges
				threadId="thread-1"
				messageId={`message-${toolCallId}`}
				toolCallId={toolCallId}
				output={made}
				document={document}
				readOnly={false}
			/>
		</I18nProvider>,
	);
}

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
	i18n.loadAndActivate({ locale: "en-US", messages: {} });
	mocks.setEditStatus.mockReset().mockResolvedValue({ editsProposed: 1, editsAccepted: 1 });
	mocks.update.mockReset().mockImplementation(async ({ data }: { data: PortfolioData }) => record(data));
	reveal.mockReset();
	store().load(record(parsePortfolioData({ works: { items: [{ id: "work-1", slug: "first", title: "First" }] } })));
});

afterEach(() => {
	cleanup();
	forgetPortfolioChanges();
	store().reset();
	vi.clearAllTimers();
	vi.useRealTimers();
});

it("shows an applied reply's changes with Undo, then Redo", () => {
	const made = output([
		{ op: "add", list: "works", item: { title: "Lumen redesign" } },
		{ op: "set", path: "theme", value: "prima" },
	]);
	autoApplyPart("thread-1", "message-call-a", {
		type: "tool-edit_portfolio",
		state: "output-available",
		toolCallId: "call-a",
		output: made,
	});
	renderCard(made, "call-a");

	expect(screen.getByRole("heading", { name: "Add the Lumen redesign" })).toBeDefined();
	expect(screen.getByText("Added the work “Lumen redesign”")).toBeDefined();
	expect(screen.getByText("Theme: Prima")).toBeDefined();
	expect(screen.getByRole("status").textContent).toBe("Applied");

	fireEvent.click(screen.getByRole("button", { name: "Undo" }));
	expect(titles()).toEqual(["First"]);
	expect(store().portfolio?.data.theme).toBe("lugas");
	expect(screen.getByRole("status").textContent).toBe("Undone");

	fireEvent.click(screen.getByRole("button", { name: "Redo" }));
	expect(titles()).toEqual(["First", "Lumen redesign"]);
	expect(screen.getByRole("status").textContent).toBe("Applied");
});

it("offers Apply for a reply whose changes never reached the editor", () => {
	const made = output([{ op: "add", list: "works", item: { title: "From history" } }]);
	renderCard(made, "call-b");
	expect(screen.getByRole("status").textContent).toBe("Not applied yet");

	fireEvent.click(screen.getByRole("button", { name: "Apply" }));
	expect(titles()).toEqual(["First", "From history"]);
	expect(screen.getByRole("status").textContent).toBe("Applied");
	expect(mocks.setEditStatus).toHaveBeenCalledWith(
		expect.objectContaining({ toolCallId: "call-b", edits: [{ id: made.edits[0]?.id, status: "accepted" }] }),
	);
});

it("shows changes applied before this visit as applied, with nothing to undo", () => {
	const made = output([{ op: "set", path: "hero.greeting", value: "Hello" }], "accepted");
	renderCard(made, "call-c");
	expect(screen.getByRole("status").textContent).toBe("Applied");
	expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
});

it("opens a change's place in the editor when its line is pressed", () => {
	const made = output([{ op: "update", list: "works", id: "work-1", fields: { summary: "Better" } }]);
	renderCard(made, "call-d");
	fireEvent.click(screen.getByRole("button", { name: /Edited the work “First”/ }));
	expect(reveal).toHaveBeenCalledWith({ tab: "write", section: "work", workId: "work-1" });
});

it("lists what the assistant couldn't change", () => {
	const made = output([
		{ op: "set", path: "hero.greeting", value: "Hi" },
		{ op: "remove", list: "services", id: "missing" },
	]);
	renderCard(made, "call-e");
	expect(screen.getByText("1 change couldn't be made:")).toBeDefined();
	expect(screen.getByText(made.failed[0]?.error ?? "")).toBeDefined();
});
