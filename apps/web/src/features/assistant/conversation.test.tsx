// @vitest-environment happy-dom
import type { AssistantDocument } from "./document";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";

const mocks = vi.hoisted(() => ({
	chat: vi.fn(),
	send: vi.fn(),
	attach: vi.fn(),
	publish: vi.fn(),
	toast: vi.fn(),
	autoApply: vi.fn(),
}));
// Plans don't apply in these tests: AI runs on the user's own connection, with no credits shown.
vi.mock("@/features/billing/ai-source", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/features/billing/ai-source")>()),
	useAiSource: () => ({ choice: false, source: "own", balance: 0, managed: undefined, own: [] }),
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));
vi.mock("@/features/resume/editor/store", () => ({
	useEditorStore: { setState: mocks.publish },
}));
vi.mock("@/libs/orpc/client", () => ({
	client: { agent: { attachments: { create: mocks.attach } } },
	orpc: { agent: { threads: { list: { key: () => ["threads"] } } } },
}));
vi.mock("@rezumi/ui/components/toast", () => ({ toast: { add: mocks.toast } }));
vi.mock("./use-assistant-chat", () => ({ useAssistantChat: mocks.chat }));
// The portfolio's card and replay have their own tests (`features/portfolio/assistant`); here, where they show.
vi.mock("@/features/portfolio/assistant/changes", () => ({
	PortfolioChanges: (props: { toolCallId: string }) => <p>Changes card {props.toolCallId}</p>,
}));
vi.mock("@/features/portfolio/assistant/apply", () => ({ autoApplyMessages: mocks.autoApply }));
vi.mock("./chat", () => ({
	fileToBase64: async () => "Zm9v",
	attachmentPart: (file: { id: string; filename: string; mediaType: string }) => ({
		type: "file",
		url: `agent-attachment:${file.id}`,
		filename: file.filename,
		mediaType: file.mediaType,
	}),
	transcriptOf: () => "",
}));

import { Composer, Conversation } from "./conversation";

const document: AssistantDocument = {
	kind: "resume",
	id: "resume-1",
	name: "Resume",
	locked: false,
	posting: { id: "application-2", company: "Selected Company", role: "Engineer" },
	stateOf: () => "pending",
	accept: () => {},
	locationOf: () => undefined,
};
beforeEach(() => {
	vi.clearAllMocks();
	i18n.loadAndActivate({ locale: "en-US", messages: {} });
	mocks.chat.mockReturnValue({ messages: [], sendMessage: mocks.send, status: "ready", clearError: vi.fn() });
	mocks.attach.mockResolvedValue({ id: "file-1", filename: "posting.txt", mediaType: "text/plain" });
});
afterEach(cleanup);

it("uploads a file in the initial composer before sending its first message", async () => {
	const ensureThread = vi.fn(async () => "draft-thread");
	const send = vi.fn();
	const { container } = render(
		<I18nProvider i18n={i18n}>
			<Composer
				document={document}
				context={{ document: false, posting: false }}
				onContextChange={() => {}}
				streaming={false}
				disabled={false}
				threadId={null}
				ensureThread={ensureThread}
				onSend={send}
				onStop={() => {}}
			/>
		</I18nProvider>,
	);
	expect(screen.getByRole("button", { name: "Attach a file" })).toBeDefined();
	const input = container.querySelector('input[type="file"]');
	if (!input) throw new Error("File picker missing");
	fireEvent.change(input, { target: { files: [new File(["foo"], "posting.txt", { type: "text/plain" })] } });
	await waitFor(() => expect(screen.getByText("posting.txt")).toBeDefined());
	expect(mocks.attach).toHaveBeenCalledWith({
		threadId: "draft-thread",
		filename: "posting.txt",
		mediaType: "text/plain",
		data: "Zm9v",
	});
	fireEvent.change(screen.getByRole("textbox"), { target: { value: "Review this posting" } });
	fireEvent.click(screen.getByRole("button", { name: "Send" }));
	expect(send).toHaveBeenCalledWith("Review this posting", [
		{ id: "file-1", filename: "posting.txt", mediaType: "text/plain" },
	]);
});

it("preserves first-message context exclusions, selected application and attachment IDs", async () => {
	const context = { document: false, posting: true, applicationId: "application-2" };
	render(
		<I18nProvider i18n={i18n}>
			<Conversation
				providerLabel="Local"
				document={document}
				threadId="thread-1"
				initialMessages={[]}
				activeRun={false}
				readOnly={false}
				initialContext={context}
				prompt="Prepare"
				promptAttachments={[{ id: "file-1", filename: "posting.txt", mediaType: "text/plain" }]}
				onPromptSent={() => {}}
				onSwitchModel={() => {}}
			/>
		</I18nProvider>,
	);
	await waitFor(() =>
		expect(mocks.send).toHaveBeenCalledWith(
			{ text: "Prepare", files: [expect.objectContaining({ url: "agent-attachment:file-1" })] },
			{ body: { attachmentIds: ["file-1"] } },
		),
	);
	expect(mocks.chat.mock.calls[0]?.[0].context).toEqual(context);
});

it("reopens native and custom web results with sources, clipping and failed or unfinished tool status", () => {
	const messages = [
		{
			id: "web-history",
			role: "assistant",
			parts: [
				{ type: "tool-web_search", toolCallId: "old-native", state: "output-available", input: {}, output: {} },
				{ type: "source-url", sourceId: "native", url: "https://company.example/job", title: "Company role" },
				{
					type: "tool-search_web",
					toolCallId: "failed",
					state: "output-error",
					input: {},
					errorText: "Enhanced access quota exhausted",
				},
				{ type: "tool-google_search", toolCallId: "stopped", state: "input-available", input: {} },
				{
					type: "tool-read_page",
					toolCallId: "read",
					state: "output-available",
					input: { url: "https://careers.example/role" },
					output: {
						requestedUrl: "https://careers.example/role",
						content: "Description",
						format: "text",
						method: "builtin",
						retrievedAt: "2026-09-30T12:00:00Z",
						truncated: true,
						completeness: "incomplete",
					},
				},
			],
		},
	];
	mocks.chat.mockReturnValue({ messages, status: "ready", clearError: vi.fn() });
	render(
		<I18nProvider i18n={i18n}>
			<Conversation
				providerLabel="Local"
				document={document}
				threadId="thread-1"
				initialMessages={[]}
				activeRun={false}
				readOnly={false}
				initialContext={{ document: true, posting: true }}
				prompt={null}
				promptAttachments={[]}
				onPromptSent={() => {}}
				onSwitchModel={() => {}}
			/>
		</I18nProvider>,
	);
	expect(screen.getAllByText("Searched the web")).toHaveLength(1);
	expect(screen.getByRole("alert").textContent).toContain("Enhanced access quota exhausted");
	expect(screen.getByText("Web search didn't finish.")).toBeDefined();
	expect(screen.getByText("This page is clipped or incomplete. Check the original before using it.")).toBeDefined();
	expect(screen.getByRole("link", { name: "Company role" }).getAttribute("href")).toBe("https://company.example/job");
	expect(screen.getByRole("link", { name: "https://careers.example/role" }).getAttribute("href")).toBe(
		"https://careers.example/role",
	);
});

const portfolio: AssistantDocument = {
	kind: "portfolio",
	id: "portfolio-1",
	name: "Portfolio",
	locked: false,
	posting: null,
	source: { from: "resume", resume: null, messages: {} as never },
	reveal: () => {},
	beforeSend: async () => null,
};

function conversation(doc: AssistantDocument, initialMessages: unknown[] = []) {
	return (
		<I18nProvider i18n={i18n}>
			<Conversation
				providerLabel="Local"
				document={doc}
				threadId="thread-1"
				initialMessages={initialMessages as never}
				activeRun={false}
				readOnly={false}
				initialContext={{ document: true, posting: true }}
				prompt={null}
				promptAttachments={[]}
				onPromptSent={() => {}}
				onSwitchModel={() => {}}
			/>
		</I18nProvider>
	);
}

const renderConversation = (doc: AssistantDocument, initialMessages: unknown[] = []) =>
	render(conversation(doc, initialMessages));

it("shows a portfolio reply's changes card and steps, and hands new replies to the replay", async () => {
	const history = {
		id: "history",
		role: "assistant",
		parts: [
			{ type: "tool-read_portfolio", toolCallId: "read", state: "output-available", input: {}, output: {} },
			{ type: "tool-edit_portfolio", toolCallId: "call-1", state: "output-available", input: {}, output: {} },
		],
	};
	const latest = {
		id: "latest",
		role: "assistant",
		parts: [
			{ type: "tool-save_attachment_image", toolCallId: "save", state: "output-available", input: {}, output: {} },
			{
				type: "tool-save_attachment_image",
				toolCallId: "save-2",
				state: "output-error",
				input: {},
				errorText: "The picture is over 2.5 MB.",
			},
			{ type: "tool-edit_portfolio", toolCallId: "call-2", state: "output-available", input: {}, output: {} },
		],
	};
	mocks.chat.mockReturnValue({
		messages: [history, latest],
		sendMessage: mocks.send,
		status: "ready",
		clearError: vi.fn(),
	});
	renderConversation(portfolio, [history]);

	expect(await screen.findByText("Changes card call-1")).toBeDefined();
	expect(screen.getByText("Changes card call-2")).toBeDefined();
	expect(screen.getByText("Read the portfolio")).toBeDefined();
	expect(screen.getByText("Saved a picture")).toBeDefined();
	expect(screen.getByText("Couldn't save the picture: The picture is over 2.5 MB.")).toBeDefined();
	// Only the reply that came in during this visit is replayed.
	await waitFor(() => expect(mocks.autoApply).toHaveBeenCalled());
	expect(mocks.autoApply.mock.lastCall?.slice(0, 2)).toEqual(["thread-1", [latest]]);
	// The chat checks the portfolio before every request it makes, answers and retries included.
	expect(mocks.chat.mock.calls[0]?.[0].beforeSend).toBe(portfolio.beforeSend);
});

it("keeps a portfolio message in the box when the portfolio can't be saved first", async () => {
	const beforeSend = vi.fn(async () => "Not sent: save first.");
	renderConversation({ ...portfolio, beforeSend });
	fireEvent.change(screen.getByRole("textbox"), { target: { value: "Change the theme" } });
	fireEvent.click(screen.getByRole("button", { name: "Send" }));

	await waitFor(() =>
		expect(mocks.toast).toHaveBeenCalledWith({ type: "error", description: "Not sent: save first." }),
	);
	expect(mocks.send).not.toHaveBeenCalled();
	await waitFor(() => expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Change the theme"));
});

it("prepares pictures attached in a portfolio conversation before uploading them", async () => {
	const prepareUploads = vi.fn(async () => [new File(["small"], "photo.webp", { type: "image/webp" })]);
	mocks.attach.mockResolvedValue({ id: "file-2", filename: "photo.webp", mediaType: "image/webp" });
	const { container } = render(
		<I18nProvider i18n={i18n}>
			<Composer
				document={{ ...portfolio, prepareUploads }}
				context={{ document: true, posting: true }}
				onContextChange={() => {}}
				streaming={false}
				disabled={false}
				threadId="thread-1"
				onSend={() => {}}
				onStop={() => {}}
			/>
		</I18nProvider>,
	);
	const input = container.querySelector('input[type="file"]');
	if (!input) throw new Error("File picker missing");
	fireEvent.change(input, { target: { files: [new File(["big"], "photo.jpg", { type: "image/jpeg" })] } });
	await waitFor(() => expect(screen.getByText("photo.webp")).toBeDefined());
	expect(prepareUploads).toHaveBeenCalledWith([expect.objectContaining({ name: "photo.jpg" })]);
	expect(mocks.attach).toHaveBeenCalledWith({
		threadId: "thread-1",
		filename: "photo.webp",
		mediaType: "image/webp",
		data: "Zm9v",
	});
});

it("leaves out a refused portfolio change or picture save the reply then made again successfully", async () => {
	const reply = {
		id: "retried",
		role: "assistant",
		parts: [
			{
				type: "tool-edit_portfolio",
				toolCallId: "refused",
				state: "output-error",
				input: {},
				errorText: "Agent run failed.",
			},
			{ type: "tool-edit_portfolio", toolCallId: "worked", state: "output-available", input: {}, output: {} },
			{
				type: "tool-save_attachment_image",
				toolCallId: "save-refused",
				state: "output-error",
				input: { attachmentId: "photo-1" },
				errorText: "Alt text is too long.",
			},
			{
				type: "tool-save_attachment_image",
				toolCallId: "save-worked",
				state: "output-available",
				input: { attachmentId: "photo-1" },
				output: {},
			},
			{
				type: "tool-save_attachment_image",
				toolCallId: "save-other",
				state: "output-error",
				input: { attachmentId: "photo-2" },
				errorText: "The picture is over 2.5 MB.",
			},
		],
	};
	mocks.chat.mockReturnValue({ messages: [reply], sendMessage: mocks.send, status: "ready", clearError: vi.fn() });
	renderConversation(portfolio, [reply]);

	expect(await screen.findByText("Changes card worked")).toBeDefined();
	expect(screen.queryByText(/Couldn't change the portfolio/)).toBeNull();
	expect(screen.queryByText(/Alt text is too long/)).toBeNull();
	// Another picture's refusal still shows: nothing saved it later.
	expect(screen.getByText("Couldn't save the picture: The picture is over 2.5 MB.")).toBeDefined();
});

it("still shows a refused portfolio change that nothing in the reply made up for", () => {
	const reply = {
		id: "refused-only",
		role: "assistant",
		parts: [
			{
				type: "tool-edit_portfolio",
				toolCallId: "refused",
				state: "output-error",
				input: {},
				errorText: "Agent run failed.",
			},
		],
	};
	mocks.chat.mockReturnValue({ messages: [reply], sendMessage: mocks.send, status: "ready", clearError: vi.fn() });
	renderConversation(portfolio, [reply]);
	expect(screen.getByText("Couldn't change the portfolio: Agent run failed.")).toBeDefined();
});

it("keeps what follows the last message in its row, so a reply starting or ending adds no row of its own", () => {
	const messages = [
		{ id: "asked", role: "user", parts: [{ type: "text", text: "Pick a theme" }] },
		{ id: "answered", role: "assistant", parts: [{ type: "text", text: "Done." }] },
	];
	mocks.chat.mockReturnValue({
		messages,
		sendMessage: mocks.send,
		status: "ready",
		clearError: vi.fn(),
		error: new Error("Provider down"),
	});
	const { container } = renderConversation(portfolio, messages);

	const rows = container.querySelectorAll('[data-slot="message-scroller-item"]');
	expect([...rows].map((row) => row.getAttribute("data-message-id"))).toEqual(["asked", "answered"]);
	const last = rows[1];
	expect(last?.contains(screen.getByRole("button", { name: "Copy transcript" }))).toBe(true);
	expect(last?.contains(screen.getByRole("alert"))).toBe(true);
});
