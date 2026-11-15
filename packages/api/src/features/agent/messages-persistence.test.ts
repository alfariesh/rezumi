import type { UIMessage } from "ai";
import { describe, expect, it } from "vite-plus/test";
import {
	applyStepToUiMessage,
	proposedEditsOf,
	upsertAssistantUiMessage,
	withEditStatuses,
} from "./messages-persistence";

function emptyMessage(): UIMessage {
	return { id: "ui-1", role: "assistant", parts: [] };
}

describe("applyStepToUiMessage", () => {
	it("folds text, reasoning, and paired tool call/result content into UI parts", () => {
		const folded = applyStepToUiMessage(emptyMessage(), {
			content: [
				{ type: "reasoning", text: "thinking" },
				{ type: "tool-call", toolCallId: "call-1", toolName: "apply_resume_patch", input: { title: "Edit" } },
				{
					type: "tool-result",
					toolCallId: "call-1",
					toolName: "apply_resume_patch",
					output: { actionId: "action-1" },
				},
				{ type: "text", text: "Done." },
			],
		});

		expect(folded.parts).toEqual([
			{ type: "step-start" },
			{ type: "reasoning", text: "thinking" },
			{
				type: "tool-apply_resume_patch",
				toolCallId: "call-1",
				state: "output-available",
				input: { title: "Edit" },
				output: { actionId: "action-1" },
			},
			{ type: "text", text: "Done." },
		]);
	});

	it("appends to existing parts instead of replacing them", () => {
		const first = applyStepToUiMessage(emptyMessage(), { content: [{ type: "text", text: "one" }] });
		const second = applyStepToUiMessage(first, { content: [{ type: "text", text: "two" }] });

		expect(second.parts.map((part) => part.type)).toEqual(["step-start", "text", "step-start", "text"]);
	});

	it("keeps native sources and Google function signatures in a crash-recovery draft", () => {
		const folded = applyStepToUiMessage(emptyMessage(), {
			content: [
				{ type: "source", sourceType: "url", id: "src", url: "https://company.example/job", title: "Role" },
				{
					type: "tool-call",
					toolCallId: "read",
					toolName: "read_resume",
					input: {},
					providerMetadata: { google: { thoughtSignature: "opaque-signature" } },
				},
				{ type: "tool-result", toolCallId: "read", toolName: "read_resume", output: { text: "Resume" } },
			],
		});
		expect(folded.parts).toContainEqual({
			type: "source-url",
			sourceId: "src",
			url: "https://company.example/job",
			title: "Role",
		});
		expect(folded.parts).toContainEqual(
			expect.objectContaining({
				type: "tool-read_resume",
				state: "output-available",
				callProviderMetadata: { google: { thoughtSignature: "opaque-signature" } },
			}),
		);
	});
});

type ScriptedDb = {
	updates: unknown[];
};

// Minimal scripted stand-in for the drizzle client: each update() consumes the next scripted
// returning() result. No vi.mock — the database is an injected value.
function scriptedDatabase(updateResults: Array<Array<{ id: string }>>): ScriptedDb & Record<string, unknown> {
	const state: ScriptedDb = { updates: [] };
	let updateCall = 0;

	return {
		updates: state.updates,
		update: () => ({
			set: (value: unknown) => {
				state.updates.push(value);
				return {
					where: () => {
						const result = updateResults[updateCall] ?? [];
						updateCall += 1;
						return Object.assign(Promise.resolve(undefined), {
							returning: async () => result,
						});
					},
				};
			},
		}),
	};
}

describe("proposed edit statuses", () => {
	const proposing = (statuses: string[]): UIMessage =>
		({
			id: "ui-1",
			role: "assistant",
			parts: [
				{ type: "text", text: "Three edits." },
				{
					type: "tool-propose_edits",
					toolCallId: "call-1",
					state: "output-available",
					input: {},
					output: {
						title: "Tailor",
						edits: statuses.map((status, index) => ({ id: `e${index}`, status })),
						skipped: [],
					},
				},
			],
		}) as never;

	it("keeps what the user did while a run rewrites its message", async () => {
		const database = scriptedDatabase([[{ id: "row-1" }]]);
		database.select = () => ({
			from: () => ({ where: async () => [{ uiMessage: proposing(["accepted", "rejected"]) }] }),
		});

		await upsertAssistantUiMessage(
			{
				userId: "user-1",
				threadId: "thread-1",
				rowId: "row-1",
				message: proposing(["pending", "pending"]),
				status: "completed",
			},
			database as never,
		);

		const written = database.updates[0] as { uiMessage: UIMessage };
		expect(proposedEditsOf(written.uiMessage).map((edit) => edit.status)).toEqual(["accepted", "rejected"]);
	});
});

describe("portfolio change cards", () => {
	const card = (id: string, status: string) => ({
		id,
		edit: { op: "set", path: "theme", value: "prima" },
		summary: "Theme: prima",
		status,
	});
	const applying = (first: string[], second: string[]): UIMessage =>
		({
			id: "ui-2",
			role: "assistant",
			parts: [
				{
					type: "tool-edit_portfolio",
					toolCallId: "call-1",
					state: "output-available",
					input: {},
					output: { title: "Theme", edits: first.map((status, index) => card(`a${index}`, status)), failed: [] },
				},
				{
					type: "tool-edit_portfolio",
					toolCallId: "call-2",
					state: "output-available",
					input: {},
					output: { title: "Works", edits: second.map((status, index) => card(`b${index}`, status)), failed: [] },
				},
				// A call that failed outright has no cards.
				{ type: "tool-edit_portfolio", toolCallId: "call-3", state: "output-error", errorText: "Gone" },
			],
		}) as never;

	it("counts each card as an edit with its status", () => {
		expect(proposedEditsOf(applying(["accepted", "pending"], ["rejected"])).map((edit) => edit.status)).toEqual([
			"accepted",
			"pending",
			"rejected",
		]);
	});

	it("sets statuses by card id in one call only, or in every call", () => {
		const message = applying(["pending", "pending"], ["pending"]);
		const statuses = new Map([
			["a0", "accepted" as const],
			["b0", "rejected" as const],
		]);
		expect(proposedEditsOf(withEditStatuses(message, "call-1", statuses)).map((edit) => edit.status)).toEqual([
			"accepted",
			"pending",
			"pending",
		]);
		const all = withEditStatuses(message, null, statuses);
		expect(proposedEditsOf(all).map((edit) => edit.status)).toEqual(["accepted", "pending", "rejected"]);
		// The resolved edit the editor replays is kept as it was.
		expect(JSON.stringify(all)).toContain('"path":"theme"');
	});

	it("keeps cards the editor already applied while the run rewrites its message", async () => {
		const database = scriptedDatabase([[{ id: "row-2" }]]);
		database.select = () => ({
			from: () => ({ where: async () => [{ uiMessage: applying(["accepted", "rejected"], ["accepted"]) }] }),
		});
		await upsertAssistantUiMessage(
			{
				userId: "user-1",
				threadId: "thread-1",
				rowId: "row-2",
				message: applying(["pending", "pending"], ["pending"]),
				status: "streaming",
			},
			database as never,
		);
		const written = database.updates[0] as { uiMessage: UIMessage };
		expect(proposedEditsOf(written.uiMessage).map((edit) => edit.status)).toEqual(["accepted", "rejected", "accepted"]);
	});
});
