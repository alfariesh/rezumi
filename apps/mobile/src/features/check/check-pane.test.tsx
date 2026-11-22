// Check pane (plans/mobile Phase 07 step 7): loading, no issues, issues, a one-step fix with Undo, and a fix that
// opens Write. The draft store is a small real zustand store; the checks are the real `@rezumi/resume/check`.
import type { ResumeData } from "@rezumi/schema/resume/data";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { produce } from "immer";
import { defaultResumeData } from "@rezumi/schema/resume/default";
import { CheckPane } from "./check-pane";
import { routes } from "@/routes";
import { renderScreen } from "@/test/render-screen";

const mock = {
	push: jest.fn(),
	chrome: jest.fn(),
	toast: jest.fn<string, [{ title: string; undo?: { label: string; onUndo: () => void } }]>(() => "toast"),
};

jest.mock("expo-router", () => ({ useRouter: () => ({ push: (...args: unknown[]) => mock.push(...args) }) }));
jest.mock("expo-network", () => ({ useNetworkState: () => ({ isConnected: true, isInternetReachable: true }) }));
jest.mock("@/shell/builder-chrome", () => ({ useBuilderChrome: (values: unknown) => mock.chrome(values) }));
jest.mock("@/preview/usePreview", () => ({
	usePreview: () => ({ result: null, rendering: false, error: false, retry: jest.fn(), displayScale: 1 }),
}));
jest.mock("@/api/client", () => ({ client: {}, orpc: {} }));
jest.mock("@/draft/runtime", () => ({ resume: {} }));
jest.mock("@/features/applications/queries", () => ({
	useApplication: () => ({ data: undefined, isPending: false, isError: false }),
	useApplications: () => ({ data: [], isPending: false, isError: false }),
	useInvalidateApplications: () => jest.fn(),
	useApplicationMutations: () => ({ create: { mutateAsync: jest.fn(), isPending: false } }),
}));
jest.mock("@/features/ai/providers", () => ({
	useHasAIProvider: () => ({ usableProviders: [], defaultProvider: null, hasAIProvider: false, isLoading: false }),
}));
jest.mock("@/features/ai/report-content", () => ({ ReportAiContent: () => null }));
jest.mock("@/ui", () => ({
	...jest.requireActual<object>("@/ui"),
	showToast: (options: { title: string }) => mock.toast(options),
	hideToast: jest.fn(),
}));
jest.mock("@/draft", () => {
	const { create } = require("zustand");
	const { produce: change } = require("immer");
	type MockState = { document: { id: string } | null; data: unknown; past: unknown[]; status: string; locked: boolean };
	const store = create((set: (next: Partial<MockState>) => void, get: () => MockState) => ({
		document: null,
		data: null,
		past: [],
		status: "idle",
		locked: false,
		update: (recipe: (draft: unknown) => void) =>
			set({ data: change(get().data, recipe), past: [...get().past, get().data] }),
		undo: () => {
			const past = get().past;
			set({ data: past.at(-1), past: past.slice(0, -1) });
		},
		open: jest.fn(() => Promise.resolve()),
	}));
	return { useResumeStore: store };
});

const { useResumeStore } = jest.requireMock<{
	useResumeStore: { setState: (next: object) => void; getState: () => { data: ResumeData } };
}>("@/draft");

function resume(mutate: (data: ResumeData) => void = () => undefined): ResumeData {
	return produce(defaultResumeData, (data) => {
		data.basics.name = "Jordan Reyes";
		data.basics.email = "jordan@reyes.design";
		data.basics.phone = "+49 151 2345 6789";
		data.basics.location = "Berlin";
		data.sections.experience.items = [
			{
				id: "kettle",
				hidden: false,
				company: "Studio Kettle",
				position: "Junior Designer",
				location: "Lisbon",
				period: "2016 - 2019",
				website: { url: "", label: "", inlineLink: false },
				description: "<p>Designed identities for small businesses.</p>",
				roles: [],
			} as ResumeData["sections"]["experience"]["items"][number],
		];
		data.metadata.template = "meridian";
		data.metadata.layout.pages = [{ fullWidth: false, main: ["experience"], sidebar: [] }];
		mutate(data);
	});
}

const open = (data: ResumeData | null) =>
	useResumeStore.setState({ document: data ? { id: "r1", applicationId: null } : null, data, past: [], locked: false });

beforeEach(() => {
	jest.clearAllMocks();
	open(null);
});

describe("Check pane", () => {
	it("shows the loading shape until the builder's draft is open", async () => {
		await renderScreen(<CheckPane id="r1" />);
		expect(screen.getByTestId("check-loading")).toBeTruthy();
	});

	it("says nothing needs fixing when every check passes", async () => {
		open(resume());
		await renderScreen(<CheckPane id="r1" />);
		expect(screen.getByText("Nothing to fix.")).toBeTruthy();
		expect(screen.getByText("Reads cleanly")).toBeTruthy();
		expect(mock.chrome).toHaveBeenLastCalledWith({ badges: { check: 0 } });
	});

	it("lists the open issues as numbered cards and puts the count on the Check mode", async () => {
		open(resume((data) => (data.basics.email = "")));
		await renderScreen(<CheckPane id="r1" />);
		expect(screen.getByText("No email address")).toBeTruthy();
		expect(screen.getByText("Add an email")).toBeTruthy();
		expect(mock.chrome).toHaveBeenLastCalledWith({ badges: { check: 1 } });
	});

	it("applies a one-step fix at once, with an Undo that takes it back", async () => {
		open(resume((data) => (data.basics.website.url = "reyes.design")));
		await renderScreen(<CheckPane id="r1" />);
		const issue = screen.getByText("Use https://reyes.design");
		await act(async () => {
			await fireEvent.press(issue);
		});
		expect(useResumeStore.getState().data.basics.website.url).toBe("https://reyes.design");
		const [toast] = mock.toast.mock.calls.at(-1) ?? [];
		expect(toast?.title).toBe("Link updated. Issue resolved.");
		expect(toast?.undo?.label).toBe("Undo");
		await act(async () => toast?.undo?.onUndo());
		expect(useResumeStore.getState().data.basics.website.url).toBe("reyes.design");
	});

	it("opens the field in Write when the fix needs the person", async () => {
		open(resume((data) => (data.basics.email = "")));
		await renderScreen(<CheckPane id="r1" />);
		await act(async () => {
			await fireEvent.press(screen.getByText("Add an email"));
		});
		expect(mock.push).toHaveBeenCalledWith({
			pathname: routes.entry("r1", "basics", "basics"),
			params: { field: "email" },
		});
		expect(mock.toast).not.toHaveBeenCalled();
	});

	it("sets an issue aside with Ignore, also undoable", async () => {
		open(resume((data) => (data.basics.email = "")));
		await renderScreen(<CheckPane id="r1" />);
		await act(async () => {
			await fireEvent.press(screen.getByText("Ignore"));
		});
		expect(screen.getByText("Nothing to fix.")).toBeTruthy();
		expect(mock.toast.mock.calls.at(-1)?.[0].title).toBe("Issue ignored");
	});
});
