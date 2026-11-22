// A resume entry full screen through `resumeWriteSource`: fields write to the draft, the entry's options act on it,
// Basics keeps custom field labels, and a locked resume reads but doesn't edit.
import type { ResumeData } from "@rezumi/schema/resume/data";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { Basics } from "./basics-screen";
import { EntryScreen, ResumeScreen } from "./entry-screen";
import { sampleResume } from "./test-store";
import { useResumeStore } from "@/draft";
import { renderScreen } from "@/test/render-screen";

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };

jest.mock("expo-router", () => ({ useRouter: () => mockRouter, Stack: { Screen: () => null } }));
jest.mock("react-native-enriched-html", () => {
	const { forwardRef } = require("react");
	return { EnrichedTextInput: forwardRef(() => null) };
});
jest.mock("@/draft", () => ({
	useResumeStore: require("./test-store").createTestDraftStore(),
	resumeFieldFocus: { onFocus: () => undefined, onBlur: () => undefined },
}));
jest.mock("@/draft/runtime", () => ({ resume: { refresh: jest.fn() } }));
jest.mock("@/auth/session", () => ({
	useSession: () => ({ status: "signed-in", server: "https://rezumi.app" }),
	getServer: () => "https://rezumi.app",
}));
jest.mock("@/api/client", () => ({
	client: { storage: { deleteFile: jest.fn() } },
	rest: jest.fn(),
	orpc: {
		documents: { key: () => ["documents"] },
		profile: { savePart: { mutationOptions: () => ({ mutationFn: jest.fn() }) } },
	},
}));
jest.mock("@/features/onboarding/queries", () => ({
	profileQuery: (server: string) => ({
		queryKey: ["profile", server],
		queryFn: async () => ({ data: require("@rezumi/schema/profile/data").emptyProfileData(), updatedAt: null }),
	}),
	storeSavedProfile: jest.fn(),
}));

const data = () => useResumeStore.getState().data as ResumeData;

beforeEach(() => {
	jest.clearAllMocks();
	useResumeStore.setState({
		document: { id: "r1", name: "CV" },
		data: sampleResume(),
		locked: false,
		past: [],
		last: null,
	} as never);
});

describe("Resume entry screen", () => {
	it("writes a field of the entry to the resume", async () => {
		await renderScreen(<EntryScreen id="r1" sectionId="experience" entryId="job-a" />);
		await fireEvent.changeText(screen.getByTestId("entry-company"), "Northwind");
		expect(data().sections.experience.items[0]?.company).toBe("Northwind");
	});

	it("hides the entry from the page and deletes it with Undo", async () => {
		await renderScreen(<EntryScreen id="r1" sectionId="experience" entryId="job-a" />);
		await fireEvent.press(screen.getByTestId("entry-toggle-hidden"));
		expect(data().sections.experience.items[0]?.hidden).toBe(true);
		await fireEvent.press(screen.getByTestId("entry-delete"));
		expect(mockRouter.back).toHaveBeenCalled();
		expect(data().sections.experience.items.map((item) => item.id)).toEqual(["job-b"]);
		useResumeStore.getState().undo();
		expect(data().sections.experience.items.map((item) => item.id)).toEqual(["job-a", "job-b"]);
	});

	it("reads but doesn't edit a locked resume", async () => {
		useResumeStore.setState({ locked: true });
		await renderScreen(<EntryScreen id="r1" sectionId="experience" entryId="job-a" />);
		expect(screen.getByText("Locked. Unlock to edit.")).toBeOnTheScreen();
		expect(screen.queryByTestId("entry-delete")).toBeNull();
		expect(screen.queryByTestId("entry-toggle-hidden")).toBeNull();
		const company = screen.getByTestId("entry-company");
		expect(company.props.editable).toBe(false);
		// Typing into a field that can't be edited changes nothing.
		await fireEvent.changeText(company, "Northwind");
		expect(data().sections.experience.items[0]?.company).not.toBe("Northwind");
	});

	it("waits for the draft rather than saying the entry is gone", async () => {
		useResumeStore.setState({ document: null, data: null });
		await renderScreen(<EntryScreen id="r1" sectionId="experience" entryId="job-a" />);
		expect(screen.getByTestId("write-loading")).toBeOnTheScreen();
		expect(screen.queryByText("This entry was deleted")).toBeNull();
	});
});

describe("Basics", () => {
	it("gives a custom detail a label that prints before its text", async () => {
		const resume = sampleResume();
		resume.basics.customFields = [{ id: "f1", icon: "flag", text: "Indonesian", link: "" }];
		useResumeStore.setState({ data: resume });
		await renderScreen(
			<ResumeScreen id="r1">
				<Basics id="r1" />
			</ResumeScreen>,
		);
		await fireEvent.press(screen.getByLabelText("Add a label"));
		await fireEvent.changeText(screen.getByLabelText("Label for detail 1"), "Nationality");
		expect(data().basics.customFields[0]?.label).toBe("Nationality");
		await fireEvent.press(screen.getByLabelText("Remove label"));
		expect(data().basics.customFields[0]?.label).toBe("");
		// Removing the label is its own step: Undo brings the label back, not an empty one.
		await act(async () => useResumeStore.getState().undo());
		expect(data().basics.customFields[0]?.label).toBe("Nationality");
	});

	it("moves and removes details by id, each its own undo step, and shows the icon instead of its name", async () => {
		const resume = sampleResume();
		resume.basics.customFields = [
			{ id: "f1", icon: "flag-01", text: "Indonesian", link: "" },
			{ id: "f2", icon: "flag-01", text: "Driving licence", link: "" },
			{ id: "f3", icon: "flag-01", text: "Portfolio", link: "" },
		];
		useResumeStore.setState({ data: resume });
		await renderScreen(
			<ResumeScreen id="r1">
				<Basics id="r1" />
			</ResumeScreen>,
		);
		const ids = () => data().basics.customFields.map((field) => field.id);
		const moveUp = async (index: number) => {
			const button = screen.getAllByLabelText("Move detail up")[index];
			if (!button) throw new Error(`No Move up for detail ${index + 1}`);
			await fireEvent.press(button);
		};
		expect(screen.queryByText(/Icon: /)).toBeNull();
		expect(screen.getAllByLabelText("Change icon")).toHaveLength(3);

		await fireEvent.changeText(screen.getByLabelText("Detail 3"), "Portfolio site");
		// Portfolio moves up twice: two undo steps, neither folded into the typing before them.
		await moveUp(2);
		await moveUp(1);
		expect(ids()).toEqual(["f3", "f1", "f2"]);
		await act(async () => useResumeStore.getState().undo());
		expect(ids()).toEqual(["f1", "f3", "f2"]);
		await act(async () => useResumeStore.getState().undo());
		expect(ids()).toEqual(["f1", "f2", "f3"]);
		expect(data().basics.customFields[2]?.text).toBe("Portfolio site");

		await fireEvent.press(screen.getByLabelText("Remove detail 1"));
		expect(ids()).toEqual(["f2", "f3"]);
	});
});
