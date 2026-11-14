import type { PortfolioRecord } from "../editor/store";
import type { EditPortfolioOutput } from "@rezumi/ai/tools/agent-tool-contracts";
import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { PortfolioEdit } from "@rezumi/schema/portfolio/edits";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { applyPortfolioEdits } from "@rezumi/portfolio/edits";
import { parsePortfolioData } from "@rezumi/schema/portfolio/data";

const mocks = vi.hoisted(() => ({ setEditStatus: vi.fn(), update: vi.fn(), fillInMedia: vi.fn() }));
vi.mock("@/libs/orpc/client", () => ({
	client: {
		agent: { messages: { setEditStatus: mocks.setEditStatus } },
		portfolio: { update: mocks.update, get: vi.fn() },
	},
	orpc: {},
}));
vi.mock("@/features/billing/plan-dialog", () => ({ openPlanDialog: vi.fn() }));
vi.mock("./media", () => ({ fillInMedia: mocks.fillInMedia }));

const { usePortfolioEditorStore } = await import("../editor/store");
const { applyCall, autoApplyPart, callStatus, undoCall } = await import("./apply");
const { callKey, forgetPortfolioChanges, usePortfolioChanges } = await import("./records");

const opened = new Date("2026-11-14T01:00:00.000Z");

function record(data: PortfolioData): PortfolioRecord {
	return {
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
	};
}

const store = () => usePortfolioEditorStore.getState();
const data = () => {
	const current = store().portfolio?.data;
	if (!current) throw new Error("No portfolio is open.");
	return current;
};
const titles = () => data().works.items.map((work) => work.title);

let counter = 0;

/** An edit_portfolio part as the server sends it: the edits resolved by the engine on the same data, pending. */
function part(edits: PortfolioEdit[], status: "pending" | "accepted" | "rejected" = "pending") {
	counter += 1;
	const result = applyPortfolioEdits(data(), edits, { mode: "strict" });
	const output: EditPortfolioOutput = {
		title: "Changes",
		edits: result.applied.map((entry) => ({
			id: `card-${counter}-${entry.index}`,
			edit: entry.edit,
			summary: entry.summary,
			status,
		})),
		failed: result.failed,
	};
	return {
		messageId: `message-${counter}`,
		part: { type: "tool-edit_portfolio", state: "output-available", toolCallId: `call-${counter}`, output },
		output,
	};
}

const call = (made: ReturnType<typeof part>) => ({
	threadId: "thread-1",
	messageId: made.messageId,
	toolCallId: made.part.toolCallId,
});
const recordOf = (made: ReturnType<typeof part>) => usePortfolioChanges.getState().calls[callKey(call(made))];

beforeEach(() => {
	vi.useFakeTimers();
	mocks.setEditStatus.mockReset().mockResolvedValue({ editsProposed: 1, editsAccepted: 1 });
	mocks.update.mockReset().mockImplementation(async ({ data: saved }: { data: PortfolioData }) => ({
		...record(saved),
		updatedAt: new Date(),
	}));
	mocks.fillInMedia.mockReset().mockResolvedValue(undefined);
	store().load(record(parsePortfolioData({ works: { items: [{ id: "work-1", slug: "first", title: "First" }] } })));
});

afterEach(() => {
	forgetPortfolioChanges();
	store().reset();
	vi.clearAllTimers();
	vi.useRealTimers();
});

describe("applying the assistant's changes", () => {
	it("applies a call that streams in once, as one undo step, and records it as accepted", () => {
		const made = part([
			{ op: "add", list: "works", item: { title: "Lumen redesign" } },
			{ op: "set", path: "theme", value: "prima" },
		]);
		autoApplyPart("thread-1", made.messageId, made.part);
		autoApplyPart("thread-1", made.messageId, made.part);

		expect(titles()).toEqual(["First", "Lumen redesign"]);
		expect(data().theme).toBe("prima");
		expect(store().undoStack).toHaveLength(1);
		expect(mocks.setEditStatus).toHaveBeenCalledTimes(1);
		expect(mocks.setEditStatus).toHaveBeenCalledWith({
			threadId: "thread-1",
			messageId: made.messageId,
			toolCallId: made.part.toolCallId,
			edits: made.output.edits.map((card) => ({ id: card.id, status: "accepted" })),
		});
		expect(mocks.fillInMedia).toHaveBeenCalledTimes(1);
		expect(callStatus(recordOf(made), made.output.edits)).toEqual({ kind: "applied", canUndo: true });
	});

	it("keeps the untouched parts of the data as they were", () => {
		const first = data().works.items[0];
		const made = part([{ op: "set", path: "theme", value: "kanvas" }]);
		autoApplyPart("thread-1", made.messageId, made.part);
		expect(data().works.items[0]).toBe(first);
	});

	it("never applies a card twice, even when it arrives again under another message", () => {
		const made = part([{ op: "add", list: "works", item: { title: "Once" } }]);
		autoApplyPart("thread-1", made.messageId, made.part);
		autoApplyPart("thread-1", "another-message", made.part);
		expect(titles()).toEqual(["First", "Once"]);
	});

	it("leaves a call alone whose edits were already dealt with", () => {
		const made = part([{ op: "add", list: "works", item: { title: "Elsewhere" } }], "accepted");
		autoApplyPart("thread-1", made.messageId, made.part);
		expect(titles()).toEqual(["First"]);
		expect(mocks.setEditStatus).not.toHaveBeenCalled();
		expect(callStatus(undefined, made.output.edits)).toEqual({ kind: "applied", canUndo: false });
	});

	it("undoes with the editor's own Undo while nothing changed since, and redoes with its Redo", () => {
		const made = part([{ op: "add", list: "works", item: { title: "Undo me" } }]);
		autoApplyPart("thread-1", made.messageId, made.part);
		mocks.setEditStatus.mockClear();

		undoCall(call(made));
		expect(titles()).toEqual(["First"]);
		expect(store().redoStack).toHaveLength(1);
		expect(callStatus(recordOf(made), made.output.edits)).toEqual({ kind: "undone" });
		expect(mocks.setEditStatus).toHaveBeenLastCalledWith(
			expect.objectContaining({ edits: [{ id: made.output.edits[0]?.id, status: "rejected" }] }),
		);

		applyCall(call(made), made.output.edits);
		expect(titles()).toEqual(["First", "Undo me"]);
		expect(store().redoStack).toHaveLength(0);
		expect(mocks.setEditStatus).toHaveBeenLastCalledWith(
			expect.objectContaining({ edits: [{ id: made.output.edits[0]?.id, status: "accepted" }] }),
		);
	});

	it("undoes with the inverse edits after other changes, keeping those changes", () => {
		const made = part([{ op: "add", list: "works", item: { title: "Added" } }]);
		autoApplyPart("thread-1", made.messageId, made.part);
		store().edit((draft) => {
			draft.hero.greeting = "Hello";
		});

		undoCall(call(made));
		expect(titles()).toEqual(["First"]);
		expect(data().hero.greeting).toBe("Hello");

		// Redo replays the call's edits again.
		applyCall(call(made), made.output.edits);
		expect(titles()).toEqual(["First", "Added"]);
		expect(data().hero.greeting).toBe("Hello");
	});

	it("reports changes whose target is gone, and records them as not applied", () => {
		const made = part([
			{ op: "update", list: "works", id: "work-1", fields: { summary: "Gone soon" } },
			{ op: "set", path: "hero.greeting", value: "Hi there" },
		]);
		store().edit((draft) => {
			draft.works.items = [];
		});
		autoApplyPart("thread-1", made.messageId, made.part);

		expect(data().hero.greeting).toBe("Hi there");
		const recorded = recordOf(made);
		expect(recorded?.failed).toHaveLength(1);
		expect(mocks.setEditStatus).toHaveBeenCalledWith(
			expect.objectContaining({
				edits: [
					{ id: made.output.edits[0]?.id, status: "rejected" },
					{ id: made.output.edits[1]?.id, status: "accepted" },
				],
			}),
		);
	});

	it("says a call where nothing applied is not applied", () => {
		const made = part([{ op: "update", list: "works", id: "work-1", fields: { summary: "Nope" } }]);
		store().edit((draft) => {
			draft.works.items = [];
		});
		autoApplyPart("thread-1", made.messageId, made.part);
		expect(callStatus(recordOf(made), made.output.edits)).toEqual({ kind: "failed" });
	});

	it("applies a pending call from before this visit when asked", () => {
		const made = part([{ op: "add", list: "works", item: { title: "From history" } }]);
		expect(callStatus(undefined, made.output.edits)).toEqual({ kind: "pending" });
		applyCall(call(made), made.output.edits);
		expect(titles()).toEqual(["First", "From history"]);
		expect(callStatus(recordOf(made), made.output.edits)).toEqual({ kind: "applied", canUndo: true });
	});

	it("forgets what it did when the editor is left", () => {
		const made = part([{ op: "set", path: "theme", value: "mozaik" }]);
		autoApplyPart("thread-1", made.messageId, made.part);
		forgetPortfolioChanges();
		expect(recordOf(made)).toBeUndefined();
		// Its card falls back to the statuses it came with.
		expect(callStatus(undefined, made.output.edits)).toEqual({ kind: "pending" });
	});
});
