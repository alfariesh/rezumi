import type { TrueSheetProps } from "@lodev09/react-native-true-sheet";
// Write over the resume draft (plans/mobile Phase 07 step 4): the outline lists sections in print order, moves them
// with the screen reader's actions, hides and shows them, renames one, adds a custom section, and offers the Profile's
// version of a part that differs (Use Profile's with Undo, Save to Profile through `profile.savePart`).
import type { ResumeData } from "@rezumi/schema/resume/data";
import { act, fireEvent, screen, within } from "@testing-library/react-native";
import { ORPCError } from "@orpc/client";
import { emptyProfileData } from "@rezumi/schema/profile/data";
import { saveToProfileError } from "./profile-link";
import { sampleResume } from "./test-store";
import { WritePane } from "./write-pane";
import { useResumeStore } from "@/draft";
import { renderScreen } from "@/test/render-screen";

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), setParams: jest.fn() };
const mockApi = { savePart: jest.fn(), profile: emptyProfileData() };

jest.mock("expo-router", () => ({ useRouter: () => mockRouter, Stack: { Screen: () => null } }));
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
	client: { resume: { setLocked: jest.fn() }, storage: { deleteFile: jest.fn() } },
	rest: jest.fn(),
	orpc: {
		documents: { key: () => ["documents"] },
		profile: { savePart: { mutationOptions: () => ({ mutationFn: (input: unknown) => mockApi.savePart(input) }) } },
	},
}));
jest.mock("@/features/onboarding/queries", () => ({
	profileQuery: (server: string) => ({
		queryKey: ["profile", server],
		queryFn: async () => ({ data: mockApi.profile, updatedAt: null }),
	}),
	storeSavedProfile: jest.fn(),
}));
jest.mock("react-native-reorderable-list", () => require("@/ui/reorderable-list.mock"));
// The native sheet: shows its header and content while presented.
jest.mock("@lodev09/react-native-true-sheet", () => {
	const { Fragment, createElement, forwardRef, useImperativeHandle, useState } = require("react");
	const TrueSheet = forwardRef((props: TrueSheetProps, ref: unknown) => {
		const [shown, setShown] = useState(false);
		useImperativeHandle(ref, () => ({
			present: async () => setShown(true),
			dismiss: async () => {
				setShown(false);
				props.onDidDismiss?.({} as never);
			},
		}));
		return shown ? createElement(Fragment, null, props.header, props.children, props.footer) : null;
	});
	return { TrueSheet, TrueSheetProvider: ({ children }: { children: unknown }) => children };
});

const data = () => useResumeStore.getState().data as ResumeData;
const sidebar = () => data().metadata.layout.pages[0]?.sidebar ?? [];
const main = () => data().metadata.layout.pages[0]?.main ?? [];

function load(resume: ResumeData = sampleResume()) {
	useResumeStore.setState({
		document: { id: "r1", name: "CV" },
		data: resume,
		locked: false,
		past: [],
		last: null,
	} as never);
}

beforeEach(() => {
	jest.clearAllMocks();
	mockApi.profile = emptyProfileData();
	load();
});

describe("Write outline", () => {
	it("lists the sections in use in print order, with the sidebar label", async () => {
		await renderScreen(<WritePane id="r1" />);
		expect(screen.getByTestId("section-experience")).toBeOnTheScreen();
		expect(screen.getByTestId("section-skills")).toBeOnTheScreen();
		expect(screen.getByText("Sidebar")).toBeOnTheScreen();
		expect(screen.queryByTestId("section-education")).toBeNull();
	});

	it("waits for the draft instead of showing an empty resume", async () => {
		useResumeStore.setState({ document: null, data: null });
		await renderScreen(<WritePane id="r1" />);
		expect(screen.getByTestId("write-loading")).toBeOnTheScreen();
	});

	it("moves a section with the screen reader's Move down and up, across into the sidebar", async () => {
		await renderScreen(<WritePane id="r1" />);
		// The actions sit on the focusable title (the one a screen reader lands on), not on the row around it.
		const title = () => screen.getByLabelText("Experience, 2 entries");
		const actions = () => (title().props.accessibilityActions as { name: string }[]).map((action) => action.name);
		// Experience is the main column's only section in use and comes first: it can only move down.
		expect(actions()).toEqual(["down"]);
		// Below it comes Skills, first in the sidebar.
		await fireEvent(title(), "accessibilityAction", { nativeEvent: { actionName: "down" } });
		expect(main()).not.toContain("experience");
		expect(sidebar().slice(0, 2)).toEqual(["skills", "experience"]);
		// Now last of the two sections in use: it can only move back up.
		expect(actions()).toEqual(["up"]);
		await fireEvent(title(), "accessibilityAction", { nativeEvent: { actionName: "up" } });
		expect(sidebar().slice(0, 2)).toEqual(["experience", "skills"]);
	});

	it("offers Move up and Move down only where they act, and none for a hidden section", async () => {
		await renderScreen(<WritePane id="r1" />);
		await fireEvent.press(screen.getByLabelText("Options for Experience"));
		const sheet = screen.getByTestId("section-sheet");
		expect(within(sheet).queryByText("Move up")).toBeNull();
		expect(within(sheet).getByText("Move down")).toBeOnTheScreen();
		await fireEvent.press(screen.getByLabelText("Close"));

		await fireEvent.press(screen.getByLabelText("Hide Experience from the page"));
		expect(screen.getByLabelText("Experience, 2 entries").props.accessibilityActions).toEqual([]);
	});

	it("leaves a section where it is when Move to… picks its own place", async () => {
		await renderScreen(<WritePane id="r1" />);
		// Experience moves into the sidebar below Skills; placed there again, it would jump to the top.
		await fireEvent(screen.getByLabelText("Experience, 2 entries"), "accessibilityAction", {
			nativeEvent: { actionName: "down" },
		});
		const moved = sidebar();
		expect(moved.slice(0, 2)).toEqual(["skills", "experience"]);
		await fireEvent.press(screen.getByLabelText("Options for Experience"));
		await fireEvent.press(within(screen.getByTestId("section-sheet")).getByText("Move to…"));
		await fireEvent.press(screen.getByText("Page 1 · Sidebar"));
		expect(sidebar()).toEqual(moved);
	});

	it("opens a section's entries and moves an entry down", async () => {
		await renderScreen(<WritePane id="r1" />);
		await fireEvent.press(screen.getByLabelText("Experience, 2 entries"));
		expect(screen.getByTestId("entry-job-a")).toBeOnTheScreen();
		expect(screen.getByTestId("entry-job-a-title").props.accessibilityActions).toEqual([
			{ name: "down", label: "Move down" },
		]);
		await fireEvent(screen.getByTestId("entry-job-a-title"), "accessibilityAction", {
			nativeEvent: { actionName: "down" },
		});
		expect(data().sections.experience.items.map((item) => item.id)).toEqual(["job-b", "job-a"]);
		await fireEvent.press(screen.getByLabelText("Designer, entry 1 of 2"));
		expect(mockRouter.push).toHaveBeenCalledWith("/builder/r1/entry/experience/job-b");
	});

	it("hides a section from the page and shows it again", async () => {
		await renderScreen(<WritePane id="r1" />);
		await fireEvent.press(screen.getByLabelText("Hide Experience from the page"));
		expect(data().sections.experience.hidden).toBe(true);
		expect(screen.getByText("Hidden sections")).toBeOnTheScreen();
		await fireEvent.press(screen.getByLabelText("Show Experience on the page"));
		expect(data().sections.experience.hidden).toBe(false);
	});

	it("renames a section from its options", async () => {
		await renderScreen(<WritePane id="r1" />);
		await fireEvent.press(screen.getByLabelText("Options for Experience"));
		const sheet = screen.getByTestId("section-sheet");
		await fireEvent.press(within(sheet).getByTestId("section-rename"));
		await fireEvent.changeText(screen.getByTestId("section-title-input"), "Work");
		await fireEvent.press(screen.getByTestId("section-title-save"));
		expect(data().sections.experience.title).toBe("Work");
	});

	it("adds a custom section with its first entry open, and deletes it with Undo", async () => {
		await renderScreen(<WritePane id="r1" />);
		await fireEvent.press(screen.getByTestId("write-add-section"));
		await fireEvent.press(screen.getByTestId("add-custom-section"));
		await fireEvent.press(screen.getByText("Projects"));
		const [custom] = data().customSections;
		expect(custom?.type).toBe("projects");
		expect(main()).toContain(custom?.id);
		expect(mockRouter.push).toHaveBeenCalledWith(`/builder/r1/entry/${custom?.id}/${custom?.items[0]?.id}`);

		await fireEvent.press(screen.getByLabelText("Options for Projects"));
		await fireEvent.press(screen.getByTestId("section-delete"));
		expect(data().customSections).toHaveLength(0);
		await act(async () => useResumeStore.getState().undo());
		expect(data().customSections).toHaveLength(1);
	});

	it("is read-only while the resume is locked, and says so", async () => {
		useResumeStore.setState({ locked: true });
		await renderScreen(<WritePane id="r1" />);
		expect(screen.getByText("Locked. Unlock to edit.")).toBeOnTheScreen();
		expect(screen.queryByTestId("write-add-section")).toBeNull();
		expect(screen.queryByLabelText("Options for Experience")).toBeNull();
	});
});

describe("Profile markers", () => {
	const linkedResume = () => {
		const resume = sampleResume();
		const profile = emptyProfileData();
		profile.basics.name = "Dana Putri";
		profile.sections.experience = structuredClone(resume.sections.experience.items) as never;
		const [first] = profile.sections.experience;
		if (first) first.position = "Lead designer";
		mockApi.profile = profile;
		load(resume);
	};

	it("marks an entry that differs and takes the Profile's version with Undo", async () => {
		linkedResume();
		await renderScreen(<WritePane id="r1" />);
		await fireEvent.press(screen.getByLabelText("Experience, 2 entries"));
		await fireEvent.press(await screen.findByLabelText("Differs from your Profile"));
		await fireEvent.press(within(screen.getByTestId("profile-marker-sheet")).getByText("Use Profile's"));
		expect(data().sections.experience.items[0]?.position).toBe("Lead designer");
		await act(async () => useResumeStore.getState().undo());
		expect(data().sections.experience.items[0]?.position).toBe("Designer");
	});

	it("saves this resume's version to the Profile", async () => {
		linkedResume();
		mockApi.savePart.mockResolvedValue({ data: mockApi.profile, updatedAt: "now", updatedResumes: [] });
		await renderScreen(<WritePane id="r1" />);
		await fireEvent.press(screen.getByLabelText("Experience, 2 entries"));
		await fireEvent.press(await screen.findByLabelText("Differs from your Profile"));
		await fireEvent.press(within(screen.getByTestId("profile-marker-sheet")).getByText("Save to Profile"));
		expect(mockApi.savePart).toHaveBeenCalledWith({
			resumeId: "r1",
			part: { kind: "item", section: "experience", id: "job-a" },
		});
	});

	it("says why Save to Profile failed instead of only asking to try again", () => {
		expect(saveToProfileError(new ORPCError("NOT_FOUND"))).toBe(
			"This resume couldn't be found. It may have been deleted.",
		);
		expect(saveToProfileError(new ORPCError("PROFILE_VERSION_CONFLICT"))).toBe(
			"Your Profile changed somewhere else. Try again.",
		);
		expect(saveToProfileError(new ORPCError("FORBIDDEN", { message: "Ask your admin." }))).toBe("Ask your admin.");
		expect(saveToProfileError(new ORPCError("INTERNAL_SERVER_ERROR", { message: "stack" }))).toBe(
			"Couldn't save to your Profile. Try again.",
		);
		expect(saveToProfileError(new Error("offline"))).toBe("Couldn't save to your Profile. Try again.");
	});

	it("adds a section from the Profile with its entries", async () => {
		const profile = emptyProfileData();
		profile.basics.name = "Dana Putri";
		profile.sections.education = [{ id: "school-1", school: "ITB", hidden: false } as never];
		mockApi.profile = profile;
		await renderScreen(<WritePane id="r1" />);
		await fireEvent.press(screen.getByTestId("write-add-section"));
		await fireEvent.press(await screen.findByTestId("add-from-profile-education"));
		expect(data().sections.education.items.map((item) => item.id)).toEqual(["school-1"]);
		expect(main()).toContain("education");
	});
});
