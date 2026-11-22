// Design (plans/mobile Phase 07 step 5): the pane's groups, the template gallery and the Layout screen write to the
// resume draft. The draft is a small stand-in store; native rendering (previews, glyphs, the page) is left out.
import type { ResumeData } from "@rezumi/schema/resume/data";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { produce } from "immer";
import { State } from "react-native-gesture-handler";
import { fireGestureHandler, getByGestureTestId } from "react-native-gesture-handler/jest-utils";
import { defaultResumeData } from "@rezumi/schema/resume/default";
import { ColorsScreen } from "./colors-screen";
import { DesignPane } from "./design-pane";
import { applyTemplate, usePreviewTemplate } from "./draft";
import { IconPickerSheet, iconLabel } from "./icon-picker";
import { SectionRow } from "./layout-column";
import { LayoutScreen } from "./layout-screen";
import { TemplatePreviewCaption } from "./preview-caption";
import { TemplateGallery } from "./template-gallery";
import { TypographyScreen } from "./typography-screen";
import { renderScreen } from "@/test/render-screen";

const mockRouter = { push: jest.fn(), back: jest.fn() };
const mockPlan = { os: "ios", plan: undefined as { enabled: boolean; features: Record<string, boolean> } | undefined };
const mockAlerts: unknown[] = [];
type Toast = { title: string; undo?: { label: string; onUndo: () => void } };
const mockToasts: Toast[] = [];

jest.mock("@/ui", () => ({ ...jest.requireActual("@/ui"), showToast: (toast: Toast) => void mockToasts.push(toast) }));

jest.mock("expo-router", () => ({ useRouter: () => mockRouter, Stack: { Screen: () => null } }));
jest.mock("@/auth/session", () => ({ useSession: () => ({ status: "signed-in", server: "https://rezumi.app" }) }));
jest.mock("@/api/client", () => ({ client: { resume: { setLocked: jest.fn() } }, rest: jest.fn() }));
jest.mock("@/draft/native", () => ({ nativeEnvironment: { focused: () => true, scope: () => "scope" } }));
jest.mock("@/preview/page", () => ({ ResumePage: () => null }));
jest.mock("./thumbnails", () => ({
	useThumbnailContent: (data: unknown) => ({ data, key: "key", hasContent: false }),
	useTemplateThumbnail: () => undefined,
}));
jest.mock("./resume-icon", () => {
	const { Text } = require("react-native");
	return {
		useIconGlyphs: () => ({}),
		ResumeIcon: ({ name }: { name: string }) => <Text>{`glyph:${name}`}</Text>,
	};
});
jest.mock("@/features/billing/plan", () => {
	const free = new Set(["meridian", "sterling", "tunas"]);
	const locked = (plan: typeof mockPlan.plan, id: string) => !free.has(id) && Boolean(plan?.enabled);
	return {
		usePlan: () => mockPlan.plan,
		canShowPlans: () => mockPlan.os === "android",
		hasPlanFeature: (plan: typeof mockPlan.plan, feature: string) => !plan?.enabled || plan.features[feature] === true,
		showPlanAlert: (problem: unknown) => mockAlerts.push(problem),
		isLockedTemplate: locked,
		isLabelledTemplate: (plan: typeof mockPlan.plan, id: string) =>
			mockPlan.os === "android" && Boolean(plan?.enabled) && !free.has(id),
		listedTemplates: (plan: typeof mockPlan.plan, templates: string[], current: string) =>
			mockPlan.os === "android" ? templates : templates.filter((id) => id === current || !locked(plan, id)),
	};
});
jest.mock("@/draft", () => {
	const { create } = require("zustand");
	const { produce: mockProduce } = require("immer");
	const store = create(() => ({ document: null, data: null, status: "saved", locked: false, undos: 0 }));
	store.setState({
		// Like the real draft: a locked document refuses edits.
		update: (recipe: (draft: unknown) => void) =>
			store.setState((state: { data: unknown; locked: boolean }) =>
				state.locked ? {} : { data: mockProduce(state.data, recipe) },
			),
		undo: () => store.setState((state: { undos: number }) => ({ undos: state.undos + 1 })),
		open: () => Promise.resolve(),
	});
	return { useResumeStore: store };
});
jest.mock("@lodev09/react-native-true-sheet", () => {
	const { forwardRef, useImperativeHandle, useState: useMockState } = require("react");
	const TrueSheet = forwardRef((props: { children?: unknown }, ref: unknown) => {
		const [shown, setShown] = useMockState(false);
		useImperativeHandle(ref, () => ({
			present: () => {
				setShown(true);
				return Promise.resolve();
			},
			dismiss: () => {
				setShown(false);
				return Promise.resolve();
			},
			resize: () => Promise.resolve(),
		}));
		return shown ? props.children : null;
	});
	return { TrueSheet, TrueSheetProvider: ({ children }: { children: unknown }) => children };
});

type Store = {
	setState: (state: object) => void;
	getState: () => { data: ResumeData; locked: boolean; undos: number };
};
const { useResumeStore } = jest.requireMock<{ useResumeStore: Store }>("@/draft");
const data = () => useResumeStore.getState().data;

function open(change: (draft: ResumeData) => void = () => undefined, locked = false) {
	const resume = produce(defaultResumeData, change);
	useResumeStore.setState({ document: { id: "resume-1" }, data: resume, locked, undos: 0 });
}

beforeEach(() => {
	mockPlan.os = "ios";
	mockPlan.plan = undefined;
	mockAlerts.length = 0;
	mockToasts.length = 0;
	mockRouter.push.mockClear();
});

/** Presses the Undo of the toast at `index` (the newest by default), as the toast's button does. */
const pressUndo = (index = mockToasts.length - 1) => act(() => mockToasts[index]?.undo?.onUndo());

describe("Design pane", () => {
	it("applies the template's designed style with Undo, and links to the gallery", async () => {
		open((draft) => void (draft.metadata.template = "sterling"));
		await renderScreen(<DesignPane id="resume-1" />);
		await fireEvent.press(screen.getByRole("button", { name: "Use Sterling style" }));
		expect(data().metadata.typography.heading.fontFamily).toBe("EB Garamond");
		expect(screen.getByRole("button", { name: "Style in use" })).toBeDisabled();
		expect(mockToasts.map((toast) => toast.title)).toEqual(["Sterling style applied"]);
		await pressUndo();
		expect(useResumeStore.getState().undos).toBe(1);
		await fireEvent.press(screen.getByRole("button", { name: "Browse templates" }));
		expect(mockRouter.push).toHaveBeenCalledWith("/builder/resume-1/design/templates");
	});

	it("leaves a newer change alone when an older toast's Undo is pressed", async () => {
		open((draft) => void (draft.metadata.template = "sterling"));
		await renderScreen(<DesignPane id="resume-1" />);
		await fireEvent.press(screen.getByRole("button", { name: "Use Sterling style" }));
		await fireEvent.press(screen.getByRole("tab", { name: "Sharp" }));
		await pressUndo(0);
		expect(useResumeStore.getState().undos).toBe(0);
	});

	it("warns when the accent is too light for white and offers a darker shade", async () => {
		open();
		await renderScreen(<DesignPane id="resume-1" />);
		const field = screen.getByLabelText("Custom color (hex)");
		await fireEvent.changeText(field, "#FFE066");
		expect(data().metadata.design.colors.primary).toBe("rgba(255, 224, 102, 1)");
		expect(screen.getByText("Too light for headings on white. It may be hard to read and print faintly.")).toBeTruthy();
		await fireEvent.press(screen.getByRole("button", { name: "Use a darker shade" }));
		expect(screen.queryByText("Too light for headings on white. It may be hard to read and print faintly.")).toBeNull();
	});

	it("measures the accent on a dark background and offers a lighter shade", async () => {
		open((draft) => void (draft.metadata.design.colors.background = "rgba(27, 31, 36, 1)"));
		await renderScreen(<DesignPane id="resume-1" />);
		await fireEvent.changeText(screen.getByLabelText("Custom color (hex)"), "#2F5A8A");
		expect(screen.getByText("Too dark for headings on this background color. It may be hard to read.")).toBeTruthy();
		await fireEvent.press(screen.getByRole("button", { name: "Use a lighter shade" }));
		expect(screen.queryByText(/for headings on this background color/)).toBeNull();
	});

	it("doesn't warn about a colour it can't measure", async () => {
		open((draft) => void (draft.metadata.design.colors.primary = "hsl(50, 100%, 70%)"));
		await renderScreen(<DesignPane id="resume-1" />);
		expect(screen.queryByText(/for headings on/)).toBeNull();
		expect(screen.queryByLabelText(/^Contrast/)).toBeNull();
	});

	it("draws icons in the chosen style and switches each group", async () => {
		open();
		await renderScreen(<DesignPane id="resume-1" />);
		await fireEvent.press(screen.getByRole("tab", { name: "Sharp" }));
		expect(data().metadata.design.icons?.style).toBe("sharp");
		await fireEvent(screen.getByLabelText("Section titles"), "selectedChange", false);
		expect(data().metadata.design.icons?.sections).toBe(false);
	});

	it("leaves the locked tool-logo switch out on iOS and explains it on Android", async () => {
		mockPlan.plan = { enabled: true, features: { brandLogos: false } };
		open();
		const { unmount } = await renderScreen(<DesignPane id="resume-1" />);
		expect(screen.queryByLabelText("Tool logos in skills")).toBeNull();
		await unmount();
		mockPlan.os = "android";
		await renderScreen(<DesignPane id="resume-1" />);
		expect(screen.getByText("Tool logos in skills · Plus")).toBeTruthy();
		await fireEvent(screen.getByLabelText("Tool logos in skills"), "selectedChange", true);
		expect(mockAlerts).toEqual([{ kind: "feature", feature: "brandLogos" }]);
		expect(data().metadata.design.icons?.logos).not.toBe(true);
	});

	it("shows a locked resume read-only with Unlock", async () => {
		open(() => undefined, true);
		await renderScreen(<DesignPane id="resume-1" />);
		expect(screen.getByRole("button", { name: "Unlock" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Browse templates" })).toBeDisabled();
	});
});

describe("Template gallery", () => {
	async function renderGallery() {
		await renderScreen(<TemplateGallery id="resume-1" />);
		await fireEvent(screen.getByTestId("template-gallery"), "layout", { nativeEvent: { layout: { width: 390 } } });
	}

	it("filters by field of work and layout", async () => {
		open();
		await renderGallery();
		expect(screen.getByText("36 of 36 shown")).toBeTruthy();
		await fireEvent.press(screen.getByRole("radio", { name: "Academic" }));
		await fireEvent.press(screen.getByRole("radio", { name: "Two columns" }));
		const shown = screen.getByText(/of 36 shown/).props.children as string;
		expect(Number.parseInt(shown, 10)).toBeLessThan(10);
		expect(screen.queryByRole("button", { name: /^Vector,/ })).toBeNull();
	});

	it("tries a template on the page, then applies it with Undo", async () => {
		open();
		await renderGallery();
		await fireEvent.press(screen.getByRole("button", { name: /^Sterling,/ }));
		expect(screen.getByText("Trying Sterling on the page")).toBeTruthy();
		expect(data().metadata.template).toBe("meridian");
		await fireEvent.press(screen.getByRole("button", { name: "Apply" }));
		expect(data().metadata.template).toBe("sterling");
		expect(screen.queryByText("Trying Sterling on the page")).toBeNull();
		expect(mockToasts.map((toast) => toast.title)).toEqual(["Template changed to Sterling"]);
		await pressUndo();
		expect(useResumeStore.getState().undos).toBe(1);
	});

	it("applies from the page caption too, explaining a template the plan doesn't open", async () => {
		mockPlan.os = "android";
		mockPlan.plan = { enabled: true, features: {} };
		open();
		// Jest's window is tablet-wide: the caption sits on the page beside the gallery, as the builder's page draws it.
		await renderScreen(
			<>
				<TemplateGallery id="resume-1" />
				<TemplatePreviewCaption />
			</>,
		);
		await fireEvent(screen.getByTestId("template-gallery"), "layout", { nativeEvent: { layout: { width: 390 } } });
		await fireEvent.press(screen.getByRole("button", { name: /^Vector,/ }));
		await fireEvent.press(screen.getByRole("button", { name: "Previewing Vector · tap to apply" }));
		expect(mockAlerts).toEqual([{ kind: "feature", feature: "premiumTemplates" }]);
		expect(data().metadata.template).toBe("meridian");
		await fireEvent.press(screen.getByRole("button", { name: /^Sterling,/ }));
		await fireEvent.press(screen.getByRole("button", { name: "Previewing Sterling · tap to apply" }));
		expect(data().metadata.template).toBe("sterling");
	});

	it("shows no Undo toast when the draft refuses the change", () => {
		open(() => undefined, true);
		applyTemplate("sterling");
		expect(data().metadata.template).toBe("meridian");
		expect(mockToasts).toEqual([]);
	});

	it("cancels a try and clears it when the gallery closes", async () => {
		open();
		const { unmount } = await renderScreen(<TemplateGallery id="resume-1" />);
		await fireEvent(screen.getByTestId("template-gallery"), "layout", { nativeEvent: { layout: { width: 390 } } });
		await fireEvent.press(screen.getByRole("button", { name: /^Sterling,/ }));
		await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
		expect(screen.queryByText("Trying Sterling on the page")).toBeNull();
		await fireEvent.press(screen.getByRole("button", { name: /^Sterling,/ }));
		await unmount();
		await renderScreen(<Probe />);
		expect(screen.getByText("none")).toBeTruthy();
	});

	it("explains a template the plan doesn't open instead of applying it", async () => {
		mockPlan.os = "android";
		mockPlan.plan = { enabled: true, features: {} };
		open();
		await renderGallery();
		await fireEvent.press(screen.getByRole("button", { name: /^Vector,/ }));
		await fireEvent.press(screen.getByRole("button", { name: "Apply" }));
		expect(mockAlerts).toEqual([{ kind: "feature", feature: "premiumTemplates" }]);
		expect(data().metadata.template).toBe("meridian");
	});
});

function Probe() {
	const { Text } = require("react-native");
	return <Text>{usePreviewTemplate() ?? "none"}</Text>;
}

describe("Icon picker", () => {
	it("filters by category, searches, and picks an icon or none", async () => {
		const onChange = jest.fn();
		await renderScreen(
			<IconPickerSheet isOpen onOpenChange={jest.fn()} value="" iconStyle="rounded" onChange={onChange} />,
		);
		await fireEvent.press(await screen.findByRole("radio", { name: "Education" }));
		expect(screen.getByRole("radio", { name: "Education", checked: true })).toBeTruthy();
		await fireEvent.changeText(screen.getByLabelText("Search for an icon"), "mortarboard");
		await fireEvent.press(screen.getByRole("radio", { name: "Mortarboard" }));
		expect(onChange).toHaveBeenCalledWith("mortarboard-01");
		await fireEvent.press(screen.getByRole("radio", { name: "No icon" }));
		expect(onChange).toHaveBeenLastCalledWith("");
	});

	it("names icons in words for screen readers", () => {
		expect(iconLabel("mortarboard-01")).toBe("Mortarboard");
		expect(iconLabel("mail-02")).toBe("Mail 2");
		expect(iconLabel("linkedin")).toBe("Linkedin");
		expect(iconLabel("user-account")).toBe("User account");
	});
});

describe("Colors and levels", () => {
	it("saves a typed colour when the field is left, and flags one it can't read", async () => {
		open();
		await renderScreen(<ColorsScreen id="resume-1" />);
		const field = screen.getByLabelText("Text color");
		await fireEvent.changeText(field, "#112233");
		expect(data().metadata.design.colors.text).not.toBe("rgba(17, 34, 51, 1)");
		await fireEvent(field, "blur");
		expect(data().metadata.design.colors.text).toBe("rgba(17, 34, 51, 1)");
		await fireEvent.changeText(field, "blue-ish");
		await fireEvent(field, "blur");
		expect(screen.getByText("Use a hex value like #3E6B4F or rgba(62, 107, 79, 1).")).toBeTruthy();
		expect(data().metadata.design.colors.text).toBe("rgba(17, 34, 51, 1)");
	});
});

describe("Typography", () => {
	it("shows a stored weight the font lacks so it can be taken off", async () => {
		open((draft) => {
			draft.metadata.typography.body.fontFamily = "Lora";
			draft.metadata.typography.body.fontWeights = ["400", "900"];
		});
		await renderScreen(<TypographyScreen id="resume-1" />);
		await fireEvent.press(screen.getByRole("checkbox", { name: "900, not in this font" }));
		expect(data().metadata.typography.body.fontWeights).toEqual(["400"]);
	});
});

describe("Layout screen", () => {
	it("moves a section to another column with its menu, and adds a page", async () => {
		open((draft) => {
			draft.metadata.template = "kirana";
			draft.summary.content = "<p>Designer</p>";
			draft.sections.skills.items.push({ id: "s1", hidden: false, name: "Figma" } as never);
			draft.metadata.layout.pages = [{ fullWidth: false, main: ["summary"], sidebar: ["skills"] }];
		});
		await renderScreen(<LayoutScreen id="resume-1" />);
		await fireEvent.press(screen.getByRole("button", { name: "Move Skills to another column or page" }));
		expect(screen.getByText("Move to")).toBeTruthy();
		await fireEvent.press(screen.getByRole("button", { name: /^Page 1 · Main/ }));
		expect(data().metadata.layout.pages[0]).toMatchObject({ main: ["summary", "skills"], sidebar: [] });
		await fireEvent.press(screen.getByRole("button", { name: "Add page" }));
		expect(data().metadata.layout.pages).toHaveLength(2);
		await act(async () => undefined);
		expect(screen.getByText("Page 2")).toBeTruthy();
		expect(screen.getAllByRole("button", { name: "Delete page" })).toHaveLength(2);
	});

	function openTwoSections(template: "kirana" | "meridian") {
		open((draft) => {
			draft.metadata.template = template;
			draft.summary.content = "<p>Designer</p>";
			draft.sections.skills.items.push({ id: "s1", hidden: false, name: "Figma" } as never);
			draft.metadata.layout.pages = [{ fullWidth: false, main: ["summary", "skills"], sidebar: [] }];
		});
	}

	it("lets screen readers move a section up or down within its column", async () => {
		openTwoSections("kirana");
		await renderScreen(<LayoutScreen id="resume-1" />);
		// The drag handle is hidden from screen readers; the title carries the moves that can act.
		expect(screen.queryByLabelText("Reorder Skills")).toBeNull();
		const skills = screen.getByLabelText("Skills");
		expect(skills.props.accessibilityActions).toEqual([{ name: "up", label: "Move up" }]);
		expect(screen.getByLabelText("Summary").props.accessibilityActions).toEqual([{ name: "down", label: "Move down" }]);
		await fireEvent(skills, "accessibilityAction", { nativeEvent: { actionName: "up" } });
		expect(data().metadata.layout.pages[0]?.main).toEqual(["skills", "summary"]);
		await fireEvent.press(screen.getByRole("button", { name: "Move Skills to another column or page" }));
		await fireEvent.press(screen.getByRole("button", { name: "Move down" }));
		expect(data().metadata.layout.pages[0]?.main).toEqual(["summary", "skills"]);
	});

	it("offers no Sidebar on a one-column template", async () => {
		openTwoSections("meridian");
		await renderScreen(<LayoutScreen id="resume-1" />);
		expect(screen.queryByText("Sidebar")).toBeNull();
		await fireEvent.press(screen.getByRole("button", { name: "Move Skills to another column or page" }));
		expect(screen.queryByRole("button", { name: /· Sidebar/ })).toBeNull();
	});
});

describe("Layout drag", () => {
	const row = (onDrop: (commit: boolean) => void) => (
		<SectionRow
			id="skills"
			title="Skills"
			lifted={false}
			offset={0}
			disabled={false}
			register={() => undefined}
			onLift={() => undefined}
			onMove={() => undefined}
			onDrop={onDrop}
			onMenu={() => undefined}
			moves={{ up: false, down: false }}
			onReorder={() => undefined}
		/>
	);

	it("drops a section only when the drag ends, not when it's cancelled", async () => {
		const onDrop = jest.fn();
		await renderScreen(row(onDrop));
		fireGestureHandler(getByGestureTestId("layout-drag-skills"), [
			{ state: State.BEGAN },
			{ state: State.ACTIVE, absoluteY: 120, translationY: 40 },
			{ state: State.CANCELLED },
		]);
		expect(onDrop).not.toHaveBeenCalledWith(true);
		fireGestureHandler(getByGestureTestId("layout-drag-skills"), [
			{ state: State.BEGAN },
			{ state: State.ACTIVE, absoluteY: 120, translationY: 40 },
			{ state: State.END },
		]);
		expect(onDrop).toHaveBeenCalledWith(true);
	});
});
