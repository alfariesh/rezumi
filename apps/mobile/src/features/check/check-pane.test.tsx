// Check pane (plans/mobile Phase 07 step 7): loading, no issues, issues, a one-step fix with Undo, and a fix that
// opens Write. The draft store is a small real zustand store; the checks are the real `@rezumi/resume/check`.
import type { ResumeData } from "@rezumi/schema/resume/data";
import { act, fireEvent, screen, within } from "@testing-library/react-native";
import { produce } from "immer";
import { defaultResumeData } from "@rezumi/schema/resume/default";
import { CheckPane } from "./check-pane";
import { routes } from "@/routes";
import { renderScreen } from "@/test/render-screen";

const mock = {
	push: jest.fn(),
	toast: jest.fn<string, [{ title: string; undo?: { label: string; onUndo: () => void } }]>(() => "toast"),
	/** The rendered page: no result while `pageCount` is 0, else that many pages with `nodes` as the page map. */
	preview: { pageCount: 0, nodes: [] as object[] },
	ats: jest.fn(),
	pdf: new Uint8Array([37, 80, 68, 70]),
};

jest.mock("expo-router", () => ({ useRouter: () => ({ push: (...args: unknown[]) => mock.push(...args) }) }));
jest.mock("expo-network", () => ({ useNetworkState: () => ({ isConnected: true, isInternetReachable: true }) }));
jest.mock("@/preview/usePreview", () => ({
	usePreview: (data: unknown, _template: unknown, options: { pages?: number[] }) => ({
		result:
			data && mock.preview.pageCount > 0
				? {
						pageCount: mock.preview.pageCount,
						pageMap: { pages: [], nodes: mock.preview.nodes },
						pages: (options.pages ?? []).map((index) => ({
							index,
							uri: `file:///p${index}.png`,
							width: 595,
							height: 842,
						})),
						pdf: mock.pdf,
					}
				: null,
		rendering: false,
		error: false,
		retry: jest.fn(),
		displayScale: 1,
	}),
}));
jest.mock("expo-file-system", () => ({
	File: jest.fn(() => ({ uri: "file:///cache/check.pdf", exists: false, write: jest.fn(), delete: jest.fn() })),
	Paths: { cache: "cache" },
}));
jest.mock("@/features/ats-checker/check", () => ({
	AtsCheckError: class extends Error {},
	runAtsCheck: (...args: unknown[]) => mock.ats(...args),
}));
jest.mock("@/api/client", () => ({
	client: {},
	orpc: { applications: { update: { mutationOptions: () => ({ mutationFn: jest.fn() }) } } },
}));
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
jest.mock("@/ui", () => {
	const { createElement } = require("react");
	const { View } = require("react-native");
	return {
		...jest.requireActual<object>("@/ui"),
		showToast: (options: { title: string }) => mock.toast(options),
		hideToast: jest.fn(),
		// The native sheet never presents under Jest; this one shows its content while open.
		Sheet: (props: { isOpen: boolean; testID?: string; children?: unknown; footer?: unknown }) =>
			props.isOpen ? createElement(View, { testID: props.testID }, props.children, props.footer) : null,
	};
});
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
	mock.ats.mockReset();
	mock.preview = { pageCount: 0, nodes: [] };
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
	});

	it("lists the open issues as numbered cards", async () => {
		open(resume((data) => (data.basics.email = "")));
		await renderScreen(<CheckPane id="r1" />);
		expect(screen.getByText("No email address")).toBeTruthy();
		expect(screen.getByText("Add an email")).toBeTruthy();
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
		const [toast] = mock.toast.mock.calls.at(-1) ?? [];
		expect(toast?.title).toBe("Issue ignored");
		await act(async () => toast?.undo?.onUndo());
		expect(screen.getByText("No email address")).toBeTruthy();
		expect(useResumeStore.getState().data.metadata.check?.ignored ?? []).toEqual([]);
	});

	it("opens a section issue's fix in Write with that section open", async () => {
		open(
			resume((data) => {
				data.sections.experience.items = [];
			}),
		);
		await renderScreen(<CheckPane id="r1" />);
		const fix = screen
			.getAllByTestId(/^issue-fix-/)
			.find((button) => button.props.testID.includes("NO_VISIBLE_EXPERIENCE"));
		if (!fix) throw new Error("No experience issue");
		await act(async () => {
			await fireEvent.press(fix);
		});
		expect(mock.push).toHaveBeenCalledWith({
			pathname: routes.builder("r1", "write"),
			params: expect.objectContaining({ section: "experience" }),
		});
	});
});

describe("Check page sheet", () => {
	const header = { kind: "header", key: "header", x: 40, y: 40, width: 400, height: 60 };

	it("opens on the page holding the issue picked with Show on page", async () => {
		mock.preview = { pageCount: 2, nodes: [{ ...header, page: 1 }] };
		open(resume((data) => (data.basics.email = "")));
		await renderScreen(<CheckPane id="r1" />);
		await act(async () => {
			await fireEvent.press(screen.getByText("Show on page"));
		});
		expect(screen.getByText("Page 2 of 2")).toBeTruthy();
	});

	it("opens on the page that mentions a covered posting term", async () => {
		mock.preview = {
			pageCount: 2,
			nodes: [
				{
					kind: "item",
					sectionId: "experience",
					itemId: "kettle",
					key: "kettle",
					page: 1,
					x: 40,
					y: 40,
					width: 400,
					height: 80,
				},
			],
		};
		open(resume());
		await renderScreen(<CheckPane id="r1" />);
		await act(async () => {
			await fireEvent.press(screen.getByText("Job match"));
		});
		await act(async () => {
			await fireEvent.changeText(
				screen.getByTestId("posting-field"),
				"Junior Designer for brand identities in Lisbon.",
			);
		});
		await act(async () => {
			await fireEvent.press(screen.getByTestId("posting-match"));
		});
		const covered = screen.getByLabelText("Already covered · pick one to find it on the page");
		await act(async () => {
			await fireEvent.press(within(covered).getByText("Junior Designer"));
		});
		expect(screen.getByText("Page 2 of 2")).toBeTruthy();
	});

	it("goes back to the last page when the resume gets shorter", async () => {
		mock.preview = { pageCount: 2, nodes: [{ ...header, page: 1 }] };
		open(resume((data) => (data.basics.email = "")));
		await renderScreen(<CheckPane id="r1" />);
		await act(async () => {
			await fireEvent.press(screen.getByText("Show on page"));
		});
		expect(screen.getByText("Page 2 of 2")).toBeTruthy();
		mock.preview = { pageCount: 1, nodes: [{ ...header, page: 0 }] };
		await act(async () =>
			useResumeStore.setState({ data: resume((data) => ((data.basics.email = ""), (data.basics.location = "Bonn"))) }),
		);
		expect(screen.getByText("Page 1 of 1")).toBeTruthy();
	});

	it("keeps the parser's consent and result when switching views", async () => {
		mock.preview = { pageCount: 1, nodes: [] };
		mock.ats.mockResolvedValue({
			report: { applicableChecks: 3, passedChecks: 3, findings: [], document: { truncated: false, pageCount: 1 } },
			fullText: "Jordan Reyes\nStudio Kettle",
		});
		open(resume((data) => (data.basics.email = "")));
		await renderScreen(<CheckPane id="r1" />);
		await act(async () => {
			await fireEvent.press(screen.getByTestId("check-pdf"));
		});
		await act(async () => {
			await fireEvent.press(screen.getByTestId("parser-opt-in"));
		});
		expect(await screen.findByTestId("parser-result")).toBeTruthy();
		await act(async () => {
			await fireEvent.press(screen.getByText("What a person sees"));
		});
		expect(screen.queryByTestId("parser-result")).toBeNull();
		await act(async () => {
			await fireEvent.press(screen.getByText("What a parser reads"));
		});
		expect(screen.getByTestId("parser-result")).toBeTruthy();
		expect(screen.queryByTestId("parser-opt-in")).toBeNull();
		expect(mock.ats).toHaveBeenCalledTimes(1);
	});

	it("says in plain words when the PDF check fails for an unknown reason", async () => {
		mock.preview = { pageCount: 1, nodes: [] };
		mock.ats.mockRejectedValue(new Error("socket hang up"));
		open(resume((data) => (data.basics.email = "")));
		await renderScreen(<CheckPane id="r1" />);
		await act(async () => {
			await fireEvent.press(screen.getByTestId("check-pdf"));
		});
		await act(async () => {
			await fireEvent.press(screen.getByTestId("parser-opt-in"));
		});
		expect(await screen.findByText("Couldn't read the exported PDF.")).toBeTruthy();
		expect(screen.queryByText("socket hang up")).toBeNull();
	});
});
