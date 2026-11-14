// @vitest-environment happy-dom
import type { AssistantDocument } from "./document";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";

const mocks = vi.hoisted(() => ({
	selected: null as string | null,
	threads: [] as unknown[],
	start: vi.fn(),
	attach: vi.fn(),
	setState: vi.fn(),
	invalidate: vi.fn(),
	toast: vi.fn(),
}));
// Plans don't apply in these tests: AI runs on the user's own connection, with no credits shown.
vi.mock("@/features/billing/ai-source", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/features/billing/ai-source")>()),
	useAiSource: () => ({ choice: false, source: "own", balance: 0, managed: undefined, own: [] }),
}));
vi.mock("@tanstack/react-query", async (importOriginal) => ({
	...(await importOriginal<typeof import("@tanstack/react-query")>()),
	useQuery: (options: { queryKey: string[] }) =>
		options.queryKey[0] === "threads" ? { data: mocks.threads, isPending: false } : {},
	useQueryClient: () => ({ invalidateQueries: mocks.invalidate }),
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn(), Link: () => null }));
vi.mock("@/features/resume/editor/store", () => ({
	useEditorStore: Object.assign(
		(select: (state: unknown) => unknown) => select({ assistantThread: mocks.selected, assistantPrompt: null }),
		{ setState: mocks.setState },
	),
}));
vi.mock("@/features/settings/integrations/hooks/use-has-usable-ai-provider", () => ({
	useHasUsableAiProvider: () => ({ usableProviders: [{ id: "provider-1", label: "Local" }], hasUsableProvider: true }),
}));
vi.mock("@/libs/orpc/client", () => ({
	client: { agent: { threads: { start: mocks.start }, attachments: { create: mocks.attach } } },
	orpc: {
		agent: {
			threads: {
				list: { key: () => ["threads"], queryOptions: () => ({ queryKey: ["threads"] }) },
				get: { queryOptions: () => ({ queryKey: ["thread"] }) },
			},
		},
	},
}));
vi.mock("@rezumi/ui/components/toast", () => ({ toast: { add: mocks.toast } }));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => vi.fn() }));
vi.mock("./chat", () => ({ fileToBase64: async () => "Zm9v", useConversationConnection: () => undefined }));

import { AssistantPanel } from "./assistant-panel";

const document: AssistantDocument = {
	kind: "resume",
	id: "resume-1",
	name: "Resume",
	locked: false,
	posting: null,
	stateOf: () => "pending",
	accept: () => {},
	locationOf: () => undefined,
};
beforeEach(() => {
	vi.clearAllMocks();
	mocks.selected = null;
	mocks.threads = [];
	mocks.setState.mockImplementation((partial: { assistantThread?: string }) => {
		if (partial.assistantThread !== undefined) mocks.selected = partial.assistantThread;
	});
	mocks.start.mockResolvedValue({ id: "draft-thread" });
	mocks.attach.mockResolvedValue({ id: "file-1", filename: "posting.txt", mediaType: "text/plain" });
	i18n.loadAndActivate({ locale: "en-US", messages: {} });
});
afterEach(cleanup);

it("keeps first-message text and attachments when the draft appears in a background thread-list refetch", async () => {
	const panel = (
		<I18nProvider i18n={i18n}>
			<AssistantPanel document={document} onClose={() => {}} />
		</I18nProvider>
	);
	const { container, rerender } = render(panel);
	fireEvent.change(screen.getByRole("textbox"), { target: { value: "Keep my first message" } });
	const input = container.querySelector('input[type="file"]');
	if (!input) throw new Error("First-message attachment picker missing");
	fireEvent.change(input, { target: { files: [new File(["foo"], "posting.txt", { type: "text/plain" })] } });
	await waitFor(() => expect(screen.getByText("posting.txt")).toBeDefined());
	mocks.threads = [
		{ id: "draft-thread", workingResumeId: "resume-1", coverLetterId: null, aiProviderId: "provider-1" },
	];
	rerender(
		<I18nProvider i18n={i18n}>
			<AssistantPanel document={document} onClose={() => {}} />
		</I18nProvider>,
	);
	expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Keep my first message");
	expect(screen.getByText("posting.txt")).toBeDefined();
	expect(mocks.setState).toHaveBeenCalledWith({ assistantThread: "new" });
});

const portfolio: AssistantDocument = {
	kind: "portfolio",
	id: "portfolio-1",
	name: "Portfolio",
	locked: false,
	posting: null,
	source: { from: "resume", resume: null, messages: {} as never },
	reveal: () => {},
};

const panelFor = (doc: AssistantDocument) => (
	<I18nProvider i18n={i18n}>
		<AssistantPanel document={doc} onClose={() => {}} />
	</I18nProvider>
);

it("starts a portfolio conversation about the portfolio, after saving it", async () => {
	const beforeSend = vi.fn(async () => null);
	render(panelFor({ ...portfolio, beforeSend }));
	expect(screen.getByText("Turn my resume projects into works")).toBeDefined();
	fireEvent.change(screen.getByRole("textbox"), { target: { value: "Write a stronger intro" } });
	fireEvent.click(screen.getByRole("button", { name: "Send" }));

	await waitFor(() =>
		expect(mocks.start).toHaveBeenCalledWith({ portfolioId: "portfolio-1", aiProviderId: "provider-1" }),
	);
	expect(beforeSend).toHaveBeenCalledTimes(1);
});

it("doesn't start a portfolio conversation while the portfolio can't be saved, and keeps the message", async () => {
	const beforeSend = vi.fn(async () => "Not sent: your portfolio changed somewhere else.");
	render(panelFor({ ...portfolio, beforeSend }));
	fireEvent.change(screen.getByRole("textbox"), { target: { value: "Pick a theme" } });
	fireEvent.click(screen.getByRole("button", { name: "Send" }));

	await waitFor(() =>
		expect(mocks.toast).toHaveBeenCalledWith({
			type: "error",
			description: "Not sent: your portfolio changed somewhere else.",
		}),
	);
	expect(mocks.start).not.toHaveBeenCalled();
	await waitFor(() => expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Pick a theme"));
});

it("opens the portfolio's own conversation, not a resume's", () => {
	const thread = { coverLetterId: null, aiProviderId: "provider-1", editsProposed: 0, lastMessageAt: new Date() };
	mocks.threads = [
		{ ...thread, id: "resume-thread", title: "Resume chat", workingResumeId: "resume-1", portfolioId: null },
		{ ...thread, id: "portfolio-thread", title: "Portfolio chat", workingResumeId: null, portfolioId: "portfolio-1" },
	];
	render(panelFor(portfolio));
	// The latest conversation about the portfolio opens (loading here), not the empty start.
	expect(screen.queryByText("Turn my resume projects into works")).toBeNull();
	fireEvent.click(screen.getByRole("button", { name: "Past conversations" }));
	const mine = screen.getByRole("region", { name: "This document" }).textContent ?? "";
	expect(mine).toContain("Portfolio chat");
	expect(mine).not.toContain("Resume chat");
	expect(screen.getByRole("region", { name: "Other documents · 1" }).textContent).toContain("Resume chat");
});
