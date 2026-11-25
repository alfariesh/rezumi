import type { AgentMessagesApi } from "./chat-transport";
import type { UIMessage } from "ai";
import { describe, expect, it, vi } from "vite-plus/test";
import { resumeAgentStream, sendAgentMessage } from "./chat-transport";

const frame = (value: unknown) => `data: ${JSON.stringify(value)}\n\n`;
const iterator = async function* (...items: unknown[]) {
	for (const item of items) yield frame(item);
};
const read = async (stream: ReadableStream<unknown>) => {
	const output: unknown[] = [];
	for await (const chunk of stream) output.push(chunk);
	return output;
};
const user: UIMessage = { id: "prompt", role: "user", parts: [{ type: "text", text: "Hello" }] };

describe("assistant transport", () => {
	it("sends only the latest message with the selected context, attachments and AI source", async () => {
		const send = vi.fn<AgentMessagesApi["send"]>(async () => iterator({ type: "start", messageId: "reply" }));
		const stream = await sendAgentMessage(
			{ send, resume: vi.fn() },
			"thread",
			{ document: false, posting: false, web: true },
			{
				messages: [{ ...user, id: "previous" }, user],
				body: { attachmentIds: ["file", null] },
				abortSignal: undefined,
			},
			{ aiSource: "rezumi", idempotencyKey: "turn" },
		);
		expect(send).toHaveBeenCalledWith(
			{
				threadId: "thread",
				message: user,
				context: { document: false, posting: false, web: true },
				attachmentIds: ["file"],
				aiSource: "rezumi",
				idempotencyKey: "turn",
			},
			{},
		);
		expect(await read(stream)).toEqual([{ type: "start", messageId: "reply" }]);
	});

	it("rebuilds the saved turn before replaying the interrupted step", async () => {
		const saved: UIMessage = {
			id: "reply",
			role: "assistant",
			parts: [
				{ type: "step-start" },
				{ type: "text", text: "Earlier response" },
				{ type: "tool-ask_user_question", toolCallId: "question", input: {}, state: "output-available", output: "Yes" },
				{ type: "step-start" },
				{ type: "text", text: "Partial response" },
			],
		};
		const start = { type: "start", messageId: "reply" };
		const delta = { type: "text-delta", id: "response", delta: "Full response" };
		const stream = await resumeAgentStream(
			{
				send: vi.fn(),
				resume: async () => iterator(start, { type: "start-step" }, delta),
			},
			"thread",
			{ messageById: () => saved },
		);
		const chunks = await read(stream);
		expect(chunks[0]).toEqual(start);
		expect(chunks).toContainEqual(expect.objectContaining({ type: "text-delta", delta: "Earlier response" }));
		expect(chunks).toContainEqual(expect.objectContaining({ type: "tool-output-available", output: "Yes" }));
		expect(chunks).not.toContainEqual(expect.objectContaining({ delta: "Partial response" }));
		expect(chunks.at(-1)).toEqual(delta);
	});
});
