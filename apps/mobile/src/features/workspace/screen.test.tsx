// The workspace chrome (plans/mobile Phase 10): the bar with Back, Application details and Ask coach, the seven parts
// as a tab row with badges, the part that fits the stage when none is named, the read-only saved version, the
// loading and failure states, and the tablet context column. The parts themselves are stand-ins here.
import type { WorkspacePartProps } from "./part";
import { fireEvent, screen } from "@testing-library/react-native";
import { defaultPart } from "./part";
import { WorkspaceScreen } from "./screen";
import { testApplication, testInterview, testNow, testSaved } from "./test-fixtures";
import { renderScreen } from "@/test/render-screen";

const mockRouter = {
	back: jest.fn(),
	replace: jest.fn(),
	push: jest.fn(),
	navigate: jest.fn(),
	canGoBack: jest.fn(() => true),
};
let mockParams: Record<string, string> = {};
let mockApplication: Record<string, unknown> = {};
let mockSaved: Record<string, unknown> = {};
let mockTablet = false;

jest.mock("expo-router", () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams }));
jest.mock("@/features/applications/queries", () => ({
	useApplication: () => mockApplication,
	useInvalidateApplications: () => () => Promise.resolve(),
}));
jest.mock("./queries", () => ({
	useSavedItems: () => mockSaved,
	useWorkspace: () => ({ isPending: false, query: { isError: false, data: {}, refetch: jest.fn() } }),
}));
jest.mock("@/features/career/hooks", () => ({ useNow: () => new Date("2026-11-22T09:00:00Z") }));
jest.mock("@/features/settings/queries", () => ({ useProfile: () => ({ data: { timezone: "UTC" } }) }));
jest.mock("@/shell/use-is-tablet", () => ({ useIsTablet: () => mockTablet }));
jest.mock("@/api/online", () => ({ useOnline: () => true }));
jest.mock("@/features/applications/interview-sheet", () => ({ InterviewSheet: () => null }));
jest.mock("./coach-sheet", () => ({ CoachSheet: () => null }));
jest.mock("./share", () => ({ shareText: jest.fn() }));
function mockPart(name: string) {
	const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
	return function Part(props: WorkspacePartProps) {
		return <Text testID={`part-${name}`}>{props.version ? `${name} read-only` : `${name} live`}</Text>;
	};
}
jest.mock("./fit/fit-part", () => ({ FitPart: mockPart("fit") }));
jest.mock("./apply/apply-part", () => ({ ApplyPart: mockPart("apply") }));
jest.mock("./prepare/prepare-part", () => ({ PreparePart: mockPart("prepare") }));
jest.mock("./practice/practice-part", () => ({ PracticePart: mockPart("practise") }));
jest.mock("./debrief/debrief-part", () => ({ DebriefPart: mockPart("debrief") }));
jest.mock("./messages/messages-part", () => ({ MessagesPart: mockPart("messages") }));
jest.mock("./saved/saved-part", () => ({ SavedPart: mockPart("saved") }));

const fit = testSaved({ kind: "fit", headline: "Strong match", summary: "", requirements: [], checks: [], ask: null });

beforeEach(() => {
	jest.clearAllMocks();
	mockParams = {};
	mockTablet = false;
	mockApplication = { data: testApplication({ status: "applied" }), isPending: false, refetch: jest.fn() };
	mockSaved = { data: [fit], isPending: false, isError: false, refetch: jest.fn() };
});

describe("WorkspaceScreen", () => {
	it("shows the bar, the seven parts and the next step", async () => {
		await renderScreen(<WorkspaceScreen id="app-1" tab="fit" />);
		expect(screen.getByText("Northwind Studio")).toBeTruthy();
		expect(screen.getByText("Product designer")).toBeTruthy();
		expect(screen.getByLabelText("Applied")).toBeTruthy();
		for (const label of ["Fit", "Apply", "Prepare", "Practice", "Debrief", "Messages"])
			expect(
				screen.getByTestId(`workspace-part-${{ Practice: "practise" }[label] ?? label.toLowerCase()}`),
			).toBeTruthy();
		expect(screen.getByLabelText("Saved, 1 item")).toBeTruthy();
		expect(screen.getByTestId("workspace-next-step")).toBeTruthy();
		expect(screen.getByTestId("part-fit")).toHaveTextContent("fit live");
	});

	it("goes back where it came from, else to Applications", async () => {
		await renderScreen(<WorkspaceScreen id="app-1" tab="fit" />);
		await fireEvent.press(screen.getByRole("button", { name: "Back" }));
		expect(mockRouter.back).toHaveBeenCalled();
		mockRouter.canGoBack.mockReturnValueOnce(false);
		await fireEvent.press(screen.getByRole("button", { name: "Back" }));
		expect(mockRouter.replace).toHaveBeenCalledWith("/applications");
	});

	it("opens the application detail and switches parts in place", async () => {
		await renderScreen(<WorkspaceScreen id="app-1" tab="fit" />);
		await fireEvent.press(screen.getByRole("button", { name: "Application details" }));
		expect(mockRouter.navigate).toHaveBeenCalledWith("/applications?open=app-1");
		expect(screen.getByRole("button", { name: "Ask coach" })).toBeTruthy();
		await fireEvent.press(screen.getByTestId("workspace-part-prepare"));
		expect(mockRouter.replace).toHaveBeenCalledWith("/applications/app-1/prepare");
	});

	it("opens the part that fits the stage when none is named", async () => {
		await renderScreen(<WorkspaceScreen id="app-1" tab={null} />);
		expect(screen.getByTestId("part-apply")).toBeTruthy();
	});

	it("shows a saved version read-only with Back to current", async () => {
		mockParams = { version: fit.id };
		await renderScreen(<WorkspaceScreen id="app-1" tab="fit" />);
		expect(screen.getByTestId("workspace-saved-version")).toBeTruthy();
		expect(screen.getByText("You're looking at a saved version. It can't be edited.")).toBeTruthy();
		expect(screen.getByTestId("part-fit")).toHaveTextContent("fit read-only");
		await fireEvent.press(screen.getByText("Back to current"));
		expect(mockRouter.replace).toHaveBeenCalledWith("/applications/app-1/fit");
	});

	it("says when a saved version belongs to another part", async () => {
		mockParams = { version: fit.id };
		await renderScreen(<WorkspaceScreen id="app-1" tab="apply" />);
		expect(screen.getByText("This saved version belongs to a different part. Open it from Saved.")).toBeTruthy();
		expect(screen.queryByTestId("part-apply")).toBeNull();
	});

	it("shows a skeleton while loading and Try again when the application can't be opened", async () => {
		mockApplication = { data: undefined, isPending: true, refetch: jest.fn() };
		const view = await renderScreen(<WorkspaceScreen id="app-1" tab="fit" />);
		expect(screen.getByTestId("workspace-loading")).toBeTruthy();
		const refetch = jest.fn();
		mockApplication = { data: undefined, isPending: false, error: new Error("offline"), refetch };
		await view.rerender(<WorkspaceScreen id="app-1" tab="fit" />);
		await fireEvent.press(screen.getByText("Try again"));
		expect(refetch).toHaveBeenCalled();
	});

	it("puts the job's context beside the part on tablets", async () => {
		mockTablet = true;
		mockApplication = {
			data: testApplication({ status: "interview", activity: [testInterview()] }),
			isPending: false,
			refetch: jest.fn(),
		};
		await renderScreen(<WorkspaceScreen id="app-1" tab="prepare" />);
		expect(screen.getByTestId("workspace-context")).toBeTruthy();
		expect(screen.getByText("Technical interview")).toBeTruthy();
		expect(screen.getByText("Rina Halim")).toBeTruthy();
		expect(screen.queryByTestId("workspace-next-step")).toBeNull();
		expect(screen.getByLabelText(/^Prepare, Starts in \d+ hours$/)).toBeTruthy();
	});
});

describe("defaultPart", () => {
	const at = (status: string, activity: unknown[] = []) => defaultPart(testApplication({ status, activity }), testNow);
	it("follows the stage", () => {
		expect(at("saved")).toBe("fit");
		expect(at("applied")).toBe("apply");
		expect(at("interview", [testInterview()])).toBe("prepare");
		expect(at("screening", [testInterview({ at: new Date("2026-11-22T07:00:00.000Z"), durationMinutes: 60 })])).toBe(
			"debrief",
		);
		expect(at("offer")).toBe("messages");
		expect(at("closed")).toBe("saved");
	});
});
