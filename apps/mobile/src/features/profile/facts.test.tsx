// The Facts panel's states (plans/mobile Phase 06): loading, empty, failed with Retry, with facts (filter, search, the
// coaching switch), offline with the last list kept, adding a fact, forgetting with Undo, and the tablet split. The
// reads and the API are replaced; the panel, its rows and detail, and their wording are the real ones. Native sheets
// never present under Jest, so `Sheet` renders its content while open.
import type { ReactNode } from "react";
import { act, fireEvent, screen, within } from "@testing-library/react-native";
import { FactsPanel } from "./facts";
import { renderScreen } from "@/test/render-screen";

type Query = { data: unknown; isPending: boolean; isError: boolean; refetch: jest.Mock };
const query = (data: unknown, state: Partial<Query> = {}): Query => ({
	data,
	isPending: data === undefined && !state.isError,
	isError: false,
	refetch: jest.fn(() => Promise.resolve()),
	...state,
});

const mockReads: { facts: Query; stories: Query; profile: Query } = {
	facts: query(undefined),
	stories: query([]),
	profile: query(undefined),
};
const mockApi = { updateFact: jest.fn(), forgetFact: jest.fn(), saveFact: jest.fn() };
const mockUndo: { id: string; message: string; commit: () => Promise<unknown>; restore: () => void }[] = [];
let mockTablet = false;

jest.mock("expo-crypto", () => ({ randomUUID: () => "uuid-1" }));
jest.mock("@/auth/session", () => ({
	useSession: () => ({ status: "signed-in", server: "https://rezumi.app" }),
	getServer: () => "https://rezumi.app",
}));
jest.mock("@/api/client", () => {
	const call =
		(name: string) =>
		(...args: unknown[]) =>
			(mockApi as Record<string, jest.Mock>)[name]?.(...args);
	return {
		client: { career: { updateFact: call("updateFact"), forgetFact: call("forgetFact"), saveFact: call("saveFact") } },
		orpc: { career: { key: () => ["career"], facts: { key: () => ["career", "facts"] } } },
	};
});
jest.mock("@/features/career/hooks", () => {
	const { useState } = jest.requireActual("react");
	const { client } = jest.requireMock("@/api/client");
	return {
		client,
		useCareerQueries: () => mockReads,
		useCareerTime: () => ({ locale: "en", timeZone: "UTC", profile: { data: { id: "user-1", timezone: "UTC" } } }),
		useCareerAction: () => ({
			pending: false,
			error: undefined,
			refresh: jest.fn(),
			run: async (operation: () => Promise<unknown>, success?: (result: unknown) => void) => {
				success?.(await operation());
			},
		}),
		useUndoRows: () => {
			const [hidden, setHidden] = useState([] as string[]);
			return {
				hidden,
				remove: (id: string, message: string, commit: () => Promise<unknown>) => {
					setHidden((rows: string[]) => [...rows, id]);
					mockUndo.push({
						id,
						message,
						commit,
						restore: () => setHidden((rows: string[]) => rows.filter((row) => row !== id)),
					});
				},
			};
		},
	};
});
jest.mock("@/shell/use-is-tablet", () => ({ useIsTablet: () => mockTablet }));
type MockSheetProps = { isOpen: boolean; title?: string; children?: ReactNode; footer?: ReactNode };
jest.mock("@/ui", () => {
	const actual = jest.requireActual("@/ui");
	const { Text, View } = jest.requireActual("react-native");
	return {
		...actual,
		Sheet: ({ isOpen, title, children, footer }: MockSheetProps) =>
			isOpen ? (
				<View testID="sheet">
					<Text>{title}</Text>
					{children}
					{footer}
				</View>
			) : null,
	};
});

const fact = (id: string, text: string, values: Record<string, unknown> = {}) => ({
	id,
	text,
	category: "accomplishment",
	status: "active",
	applicationId: null,
	company: null,
	source: { kind: "manual", id: `s-${id}`, quote: text },
	usedBy: { stories: 1, savedItems: 0 },
	revisions: [],
	createdAt: "2026-11-01T10:00:00Z",
	...values,
});
const shipped = fact("f1", "Shipped the checkout redesign that lifted conversion by 12%");
const figma = fact("f2", "Expert in Figma prototyping", {
	category: "skill",
	source: { kind: "resume", id: "r1", quote: "Figma expert" },
	usedBy: { stories: 0, savedItems: 0 },
});

beforeEach(() => {
	mockTablet = false;
	mockUndo.length = 0;
	for (const mock of Object.values(mockApi)) mock.mockReset().mockResolvedValue(undefined);
	mockReads.facts = query(undefined);
});

describe("FactsPanel", () => {
	it("shows fact rows in their final shape while loading", async () => {
		await renderScreen(<FactsPanel />);
		expect(screen.getByLabelText("Loading")).toBeOnTheScreen();
		expect(screen.queryByText("No facts yet")).toBeNull();
	});

	it("offers adding the first fact to an empty Profile", async () => {
		mockReads.facts = query([]);
		await renderScreen(<FactsPanel />);
		expect(screen.getByText("No facts yet")).toBeOnTheScreen();
		// No search or type filter over nothing.
		expect(screen.queryByLabelText("Search facts")).toBeNull();
		await fireEvent.press(screen.getByText("Add a fact"));
		expect(screen.getByTestId("sheet")).toBeOnTheScreen();
		expect(screen.getByRole("radio", { name: "Accomplishment" })).toBeChecked();
	});

	it("says a failed load went wrong and retries", async () => {
		mockReads.facts = query(undefined, { isError: true });
		await renderScreen(<FactsPanel />);
		expect(screen.getByText("Couldn't load your facts")).toBeOnTheScreen();
		await fireEvent.press(screen.getByText("Retry"));
		expect(mockReads.facts.refetch).toHaveBeenCalled();
		expect(screen.queryByLabelText("Loading")).toBeNull();
	});

	it("lists facts, filters by type and words, and turns one off for coaching", async () => {
		mockReads.facts = query([shipped, figma]);
		await renderScreen(<FactsPanel />);
		expect(screen.getByText(shipped.text)).toBeOnTheScreen();
		expect(screen.getByText(figma.text)).toBeOnTheScreen();
		expect(screen.queryByText(/Knowledge/)).toBeNull();

		await fireEvent.press(screen.getByRole("button", { name: "Skill" }));
		expect(screen.queryByText(shipped.text)).toBeNull();
		expect(screen.getByText(figma.text)).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "All" }));

		await fireEvent.changeText(screen.getByLabelText("Search facts"), "nothing like this");
		expect(screen.getByText("No facts match")).toBeOnTheScreen();
		await fireEvent.press(screen.getByText("Show all facts"));
		expect(screen.getByText(shipped.text)).toBeOnTheScreen();

		await fireEvent.press(screen.getByRole("switch", { name: `Use in coaching: ${figma.text}` }));
		expect(mockApi.updateFact).toHaveBeenCalledWith({ id: "f2", status: "excluded" });
	});

	it("keeps the last list when a refresh fails offline", async () => {
		mockReads.facts = query([shipped], { isError: true });
		await renderScreen(<FactsPanel />);
		expect(screen.getByText(shipped.text)).toBeOnTheScreen();
		expect(screen.queryByText("Couldn't load your facts")).toBeNull();
	});

	it("adds a fact from the sheet", async () => {
		mockReads.facts = query([shipped]);
		mockApi.saveFact.mockResolvedValue({ id: "f3" });
		await renderScreen(<FactsPanel />);
		await fireEvent.press(screen.getByText("Add fact"));
		await fireEvent.changeText(screen.getByLabelText("Fact"), "  Led a team of four designers  ");
		await fireEvent.press(screen.getByRole("radio", { name: "Experience" }));
		await fireEvent.press(within(screen.getByTestId("sheet")).getByText("Add fact"));
		expect(mockApi.saveFact).toHaveBeenCalledWith({
			applicationId: null,
			text: "Led a team of four designers",
			category: "experience",
			source: { kind: "manual", id: "uuid-1", quote: "Led a team of four designers" },
		});
		expect(screen.queryByTestId("sheet")).toBeNull();
	});

	it("opens a fact, forgets it at once and brings it back with Undo", async () => {
		mockReads.facts = query([shipped, figma]);
		await renderScreen(<FactsPanel />);
		await fireEvent.press(screen.getByTestId("fact-f2"));
		expect(screen.getByText("From your resume · Nov 1, 2026")).toBeOnTheScreen();
		expect(screen.getByText("Figma expert")).toBeOnTheScreen();

		await fireEvent.press(screen.getByText("Forget"));
		expect(screen.queryByText(figma.text)).toBeNull();
		expect(screen.queryByTestId("sheet")).toBeNull();
		expect(mockUndo).toHaveLength(1);
		expect(mockUndo[0]?.message).toBe("Fact forgotten");

		await act(() => mockUndo[0]?.restore());
		expect(screen.getByText(figma.text)).toBeOnTheScreen();
		await mockUndo[0]?.commit();
		expect(mockApi.forgetFact).toHaveBeenCalledWith({ id: "f2" });
	});

	it("shows the picked fact beside the list on tablets, and corrects it", async () => {
		mockTablet = true;
		mockReads.facts = query([shipped, figma]);
		await renderScreen(<FactsPanel />);
		expect(screen.getByText("Pick a fact")).toBeOnTheScreen();
		await fireEvent.press(screen.getByTestId("fact-f1"));
		expect(screen.queryByTestId("sheet")).toBeNull();
		expect(screen.getByText("No corrections")).toBeOnTheScreen();

		await fireEvent.press(screen.getByText("Correct"));
		await fireEvent.changeText(screen.getByLabelText("Correct this fact"), "Shipped the checkout redesign");
		await fireEvent.press(screen.getByText("Save correction"));
		expect(mockApi.updateFact).toHaveBeenCalledWith({ id: "f1", text: "Shipped the checkout redesign" });
	});
});
