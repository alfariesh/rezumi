// Letter Write → From (plans/mobile Phase 08): the Profile, a resume or the letter's own details. The draft store is a
// small stand-in; link changes go through `relinkLetter`, whose recipe is applied here to check what it changes.
import type { LetterDocument } from "@/draft/types";
import type { WritableDraft } from "immer";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { produce } from "immer";
import { LetterWrite } from "./write";
import { renderScreen } from "@/test/render-screen";

type Recipe = (letter: WritableDraft<LetterDocument>) => void;

const mockRelink = jest.fn<Promise<"linked">, [Recipe]>(() => Promise.resolve("linked"));
const mockResumes = { data: [{ id: "resume-1", name: "Product designer" }], isError: false, refetch: jest.fn() };

jest.mock("./save", () => ({ relinkLetter: (recipe: Recipe) => mockRelink(recipe) }));
jest.mock("./queries", () => ({ useResumes: () => mockResumes }));
jest.mock("./compose", () => ({ useLetterWords: () => undefined }));
jest.mock("@/features/entries/rich-text-field", () => ({ RichTextField: () => null, RichTextToolbar: () => null }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }));
jest.mock("@/auth/session", () => ({ useSession: () => ({ status: "signed-in", server: "https://rezumi.app" }) }));
jest.mock("@/features/applications/queries", () => ({ useApplications: () => ({ data: [] }) }));
jest.mock("@/features/ai/providers", () => ({
	useHasAIProvider: () => ({ hasAIProvider: true, isUnavailable: false, error: null, retry: jest.fn() }),
	AIProviderSetupSheet: () => null,
}));
jest.mock("@/features/ai/report-content", () => ({ ReportAiContent: () => null }));
jest.mock("@/features/onboarding/queries", () => ({
	profileQuery: () => ({ queryKey: ["profile"], queryFn: () => new Promise(() => undefined) }),
}));
jest.mock("@/draft", () => {
	const { create } = require("zustand");
	const { produce: mockProduce } = require("immer");
	const store = create(() => ({ document: null, status: "saved" }));
	store.setState({
		update: (recipe: (draft: unknown) => void) =>
			store.setState((state: { document: unknown }) => ({ document: mockProduce(state.document, recipe) })),
		open: () => Promise.resolve(),
	});
	return { useLetterStore: store, letterFieldFocus: { onFocus: () => undefined, onBlur: () => undefined } };
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

const { useLetterStore } = jest.requireMock<{
	useLetterStore: { setState: (state: object) => void; getState: () => { document: LetterDocument } };
}>("@/draft");

const letter = (overrides: Partial<LetterDocument> = {}) =>
	({
		id: "letter-1",
		name: "Letter",
		layout: "structured",
		recipient: "",
		content: "",
		greeting: null,
		signOff: null,
		recipientName: "",
		recipientCompany: "",
		letterDate: null,
		sourceResumeId: null,
		sourceApplicationId: null,
		senderLinked: true,
		designLinked: false,
		isLocked: false,
		style: {
			basics: {
				name: "Ada Lovelace",
				headline: "",
				email: "ada@example.com",
				phone: "",
				location: "",
				website: { url: "", label: "" },
			},
			metadata: {
				template: "atlas",
				page: { locale: "en-US", format: "a4", marginX: 14, marginY: 12 },
				typography: { body: { fontFamily: "Lato", fontSize: 10 }, heading: { fontFamily: "Lato", fontSize: 14 } },
				design: { colors: { primary: "rgba(62, 107, 79, 1)" } },
			},
		},
		...overrides,
	}) as unknown as LetterDocument;

/** What the last relink recipe would change. */
const applyLastRelink = (from: LetterDocument) => {
	const recipe = mockRelink.mock.calls.at(-1)?.[0];
	if (!recipe) throw new Error("No relink");
	return produce(from, recipe);
};

async function show(document: LetterDocument) {
	useLetterStore.setState({ document });
	await renderScreen(<LetterWrite id="letter-1" />);
}

beforeEach(() => mockRelink.mockClear());

describe("letter From", () => {
	it("follows the Profile when the details are linked without a resume", async () => {
		await show(letter());
		expect(screen.getByText("Your Profile")).toBeTruthy();
		expect(screen.getByText("Your name and contact details follow your Profile.")).toBeTruthy();
		expect(screen.queryByTestId("letter-sender-fields")).toBeNull();
	});

	it("names the resume the details follow", async () => {
		await show(letter({ sourceResumeId: "resume-1", designLinked: true }));
		expect(screen.getByText("Product designer")).toBeTruthy();
		expect(screen.getByText("Your name and contact details follow “Product designer”.")).toBeTruthy();
	});

	it("copies the details into the letter with “This letter only”", async () => {
		const start = letter({ sourceResumeId: "resume-1" });
		await show(start);
		await fireEvent.press(screen.getByTestId("letter-from-choice"));
		await act(async () => {
			await fireEvent.press(screen.getByTestId("letter-from-own"));
		});
		expect(applyLastRelink(start)).toMatchObject({ senderLinked: false, sourceResumeId: "resume-1" });
	});

	it("takes a resume's details and design when the letter picks one for the first time", async () => {
		const start = letter();
		await show(start);
		await fireEvent.press(screen.getByTestId("letter-from-choice"));
		await act(async () => {
			await fireEvent.press(screen.getByTestId("letter-from-resume"));
		});
		expect(applyLastRelink(start)).toMatchObject({
			sourceResumeId: "resume-1",
			senderLinked: true,
			designLinked: true,
		});
	});

	it("lets go of the resume and its design when the Profile is picked", async () => {
		const start = letter({ sourceResumeId: "resume-1", designLinked: true });
		await show(start);
		await fireEvent.press(screen.getByTestId("letter-from-choice"));
		await act(async () => {
			await fireEvent.press(screen.getByTestId("letter-from-profile"));
		});
		expect(applyLastRelink(start)).toMatchObject({ sourceResumeId: null, senderLinked: true, designLinked: false });
	});

	it("edits the letter's own details in the draft", async () => {
		await show(letter({ senderLinked: false }));
		expect(screen.getByTestId("letter-sender-fields")).toBeTruthy();
		await fireEvent.changeText(screen.getByLabelText("Name"), "Ada King");
		expect(useLetterStore.getState().document.style.basics.name).toBe("Ada King");
		expect(mockRelink).not.toHaveBeenCalled();
	});
});
