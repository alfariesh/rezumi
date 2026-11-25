import type { ConversationProps } from "./use-conversation";
import type { UIMessage } from "ai";
import { fireEvent, screen } from "@testing-library/react-native";
import { Conversation } from "./conversation";
import { AiReportForm } from "@/features/ai/report-content";
import { renderScreen } from "@/test/render-screen";

type ConversationState = ReturnType<typeof import("./use-conversation").useConversation>;
type LegendProps = {
	data: UIMessage[];
	renderItem: (row: { item: UIMessage; index: number }) => React.ReactNode;
	ListFooterComponent: React.ReactNode;
};

let mockConversation: ConversationState;
jest.mock("./use-conversation", () => ({ useConversation: () => mockConversation }));
jest.mock("@legendapp/list/react-native", () => {
	const { View } = jest.requireActual<typeof import("react-native")>("react-native");
	return {
		LegendList: ({ data, renderItem, ListFooterComponent }: LegendProps) => (
			<View>
				{data.map((item, index) => (
					<View key={item.id}>{renderItem({ item, index })}</View>
				))}
				{ListFooterComponent}
			</View>
		),
	};
});
jest.mock("./chat", () => ({
	textOf: (message: UIMessage) => message.parts.find((part) => part.type === "text")?.text ?? "",
	transcriptOf: () => "",
}));
jest.mock("@/api/client", () => ({ client: {}, orpc: {} }));
jest.mock("@/api/ai-consent", () => ({ AiConsentDeclined: class extends Error {} }));

const props: ConversationProps = {
	assistantName: "Coach",
	sourceNote: "Your AI connection · Fixture",
	context: { document: true, posting: true },
	createThread: async () => "thread",
	document: null,
	initialMessages: [],
	activeRun: false,
	readOnly: false,
	onPromptDelivered: jest.fn(),
	onThreadCreated: jest.fn(),
	placeholder: "Ask about your next step…",
	privacy: "Confirm before sending.",
	prompt: null,
	scope: "account",
	threadId: "thread",
};

const reply: UIMessage = {
	id: "reply",
	role: "assistant",
	parts: [{ type: "text", text: "**Start** with one role." }],
};

beforeEach(() => {
	mockConversation = {
		messages: [reply],
		status: "streaming",
		streaming: true,
		readOnly: false,
		error: undefined,
		stopped: false,
		continuationBlocked: false,
		handlers: null,
		answer: null,
		send: jest.fn(),
		stopReply: jest.fn(),
		retry: jest.fn(),
		decide: jest.fn(),
	};
});

it("streams Markdown, and keeps the portion received when the reply is interrupted", async () => {
	const rendered = await renderScreen(<Conversation {...props} />);
	expect(screen.getByRole("button", { name: "Stop" })).toBeTruthy();
	expect(screen.getByText("Start with one role.")).toBeTruthy();

	mockConversation = {
		...mockConversation,
		status: "error",
		streaming: false,
		error: new Error("Network disconnected"),
	};
	await rendered.rerender(<Conversation {...props} />);
	expect(screen.getByText("Start with one role.")).toBeTruthy();
	expect(screen.getByText("The reply was interrupted.")).toBeTruthy();
	await fireEvent.press(screen.getByRole("button", { name: "Retry" }));
	expect(mockConversation.retry).toHaveBeenCalledTimes(1);
});

it("routes a suggested edit through Accept or Reject and exposes the undo for the accepted step", async () => {
	const undo = jest.fn();
	const accept = jest.fn();
	const reject = jest.fn();
	const tool = {
		type: "tool-propose_edits",
		input: {},
		toolCallId: "tool",
		state: "output-available",
		output: {
			edits: [
				{
					id: "edit",
					target: { sectionId: "summary", field: "content" },
					status: "pending",
					location: "Summary",
					before: "<p>Old summary</p>",
					after: "<p>New summary</p>",
				},
			],
		},
	} satisfies UIMessage["parts"][number];
	const handlers = {
		locked: false,
		statuses: new Map(),
		stateOf: () => "pending" as const,
		onAccept: accept,
		onReject: reject,
		undo: null,
	};
	mockConversation = {
		...mockConversation,
		status: "ready",
		streaming: false,
		messages: [{ ...reply, parts: [tool] }],
		handlers,
	};
	const rendered = await renderScreen(<Conversation {...props} />);
	await fireEvent.press(screen.getByTestId("assistant-reject"));
	await fireEvent.press(screen.getByTestId("assistant-accept"));
	expect(accept).toHaveBeenCalledWith(expect.anything(), tool, [expect.objectContaining({ id: "edit" })]);
	expect(reject).toHaveBeenCalledWith(expect.anything(), tool, [expect.objectContaining({ id: "edit" })]);

	mockConversation = {
		...mockConversation,
		handlers: { ...handlers, stateOf: () => "accepted", undo: { id: "edit", canUndo: () => true, run: undo } },
	};
	await rendered.rerender(<Conversation {...props} />);
	await fireEvent.press(screen.getByTestId("assistant-undo"));
	expect(undo).toHaveBeenCalledTimes(1);
});

it("prefills the report form with only the selected reply", async () => {
	await renderScreen(<AiReportForm source="assistant" initialContent="A reply to review" onSent={jest.fn()} />);
	expect(screen.getByLabelText("Content to report").props.value).toBe("A reply to review");
	expect(screen.getByRole("button", { name: "Other concern" })).toBeTruthy();
});
