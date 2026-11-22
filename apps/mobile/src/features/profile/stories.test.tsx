// The Stories panel's states (plans/mobile Phase 06): loading, empty, failed with Retry, with stories (progress, the
// changed-fact notice, reading one), writing a new story, deleting with Undo, and the tablet split. The reads and the
// API are replaced; the panel, reader, editor and their wording are the real ones. Native sheets never present under
// Jest, so `Sheet` renders its content while open.
import type { ReactNode } from "react";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { StoriesPanel } from "./stories";
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
	facts: query([]),
	stories: query(undefined),
	profile: query(undefined),
};
const mockApi = { saveStory: jest.fn(), deleteStory: jest.fn() };
const mockUndo: { id: string; message: string; commit: () => Promise<unknown>; restore: () => void }[] = [];
let mockTablet = false;

jest.mock("@/auth/session", () => ({
	useSession: () => ({ status: "signed-in", server: "https://rezumi.app" }),
	getSession: () => ({ status: "signed-in", server: "https://rezumi.app" }),
	getServer: () => "https://rezumi.app",
	getAccountScope: () => '["https://rezumi.app","user-1"]',
	subscribeSession: () => () => undefined,
}));
jest.mock("@/api/client", () => {
	const call =
		(name: string) =>
		(...args: unknown[]) =>
			(mockApi as Record<string, jest.Mock>)[name]?.(...args);
	return {
		client: { career: { saveStory: call("saveStory"), deleteStory: call("deleteStory") } },
		orpc: { career: { key: () => ["career"] } },
	};
});
jest.mock("@/features/career/hooks", () => {
	const { useState } = jest.requireActual("react");
	const { client } = jest.requireMock("@/api/client");
	return {
		client,
		useCareerQueries: () => mockReads,
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
const checkout = fact("f1", "Shipped the checkout redesign");
const corrected = fact("f2", "Mentored two associate designers", {
	revisions: [{ text: "Mentored three designers", at: "2026-11-10T00:00:00Z" }],
});
const story = (id: string, title: string, values: Record<string, unknown> = {}) => ({
	id,
	updatedAt: "2026-11-05T00:00:00Z",
	data: {
		applicationId: null,
		title,
		situation: "Checkout dropped users on mobile.",
		task: "Own the redesign.",
		action: "Ran five usability rounds.",
		result: "",
		reflection: "",
		factIds: ["f1"],
		tags: ["Design"],
		...values,
	},
});
const redesign = story("s1", "Checkout redesign");
const mentoring = story("s2", "Mentoring juniors", { factIds: ["f2"], tags: [], result: "Both were promoted." });

beforeEach(() => {
	mockTablet = false;
	mockUndo.length = 0;
	for (const mock of Object.values(mockApi)) mock.mockReset().mockResolvedValue(undefined);
	mockReads.stories = query(undefined);
	mockReads.facts = query([checkout, corrected]);
});

describe("StoriesPanel", () => {
	it("shows story rows in their final shape while loading", async () => {
		await renderScreen(<StoriesPanel />);
		expect(screen.getByLabelText("Loading")).toBeOnTheScreen();
		expect(screen.queryByText("No stories yet")).toBeNull();
	});

	it("offers writing the first story, and asks for the required parts before saving", async () => {
		mockReads.stories = query([]);
		await renderScreen(<StoriesPanel />);
		expect(screen.getByText("No stories yet")).toBeOnTheScreen();
		await fireEvent.press(screen.getByText("New story"));
		expect(screen.getByTestId("sheet")).toBeOnTheScreen();
		await fireEvent.press(screen.getByText("Save story"));
		expect(mockApi.saveStory).not.toHaveBeenCalled();
		expect(screen.getAllByText("Add what happened before you can save.").length).toBeGreaterThan(0);
	});

	it("says a failed load went wrong and retries", async () => {
		mockReads.stories = query(undefined, { isError: true });
		await renderScreen(<StoriesPanel />);
		expect(screen.getByText("Couldn't load your stories")).toBeOnTheScreen();
		await fireEvent.press(screen.getByText("Retry"));
		expect(mockReads.stories.refetch).toHaveBeenCalled();
	});

	it("lists stories with their progress, flags a changed fact and opens one to read", async () => {
		mockReads.stories = query([redesign, mentoring]);
		await renderScreen(<StoriesPanel />);
		expect(screen.getByText("Checkout redesign")).toBeOnTheScreen();
		expect(screen.getByText("3 of 5 parts · 1 fact")).toBeOnTheScreen();
		expect(screen.getByText("4 of 5 parts · 1 fact")).toBeOnTheScreen();
		// The mentoring story's fact was corrected after it was saved.
		expect(screen.getAllByText("A fact changed. Review this story.")).toHaveLength(1);

		await fireEvent.press(screen.getByTestId("story-s1"));
		expect(screen.getByText("Ran five usability rounds.")).toBeOnTheScreen();
		expect(screen.getByText(checkout.text)).toBeOnTheScreen();
		expect(screen.getAllByText("Not recorded yet. Leave it blank until you can support it.")).toHaveLength(2);
	});

	it("keeps the last list when a refresh fails offline", async () => {
		mockReads.stories = query([redesign], { isError: true });
		await renderScreen(<StoriesPanel />);
		expect(screen.getByText("Checkout redesign")).toBeOnTheScreen();
		expect(screen.queryByText("Couldn't load your stories")).toBeNull();
	});

	it("writes a new story backed by a fact", async () => {
		mockReads.stories = query([redesign]);
		mockApi.saveStory.mockResolvedValue({ id: "s3" });
		await renderScreen(<StoriesPanel />);
		await fireEvent.press(screen.getByText("New story"));
		await fireEvent.changeText(screen.getByLabelText("Title"), " Launch week ");
		await fireEvent.changeText(screen.getByLabelText("Situation"), "A launch slipped.");
		await fireEvent.changeText(screen.getByLabelText("Task"), "Get it out.");
		await fireEvent.changeText(screen.getByLabelText("Action"), "Cut scope with the team.");
		await fireEvent.press(screen.getByRole("checkbox", { name: checkout.text }));
		await fireEvent.press(screen.getByText("Save story"));
		expect(mockApi.saveStory).toHaveBeenCalledWith({
			applicationId: null,
			title: "Launch week",
			situation: "A launch slipped.",
			task: "Get it out.",
			action: "Cut scope with the team.",
			result: "",
			reflection: "",
			factIds: ["f1"],
			tags: [],
		});
		expect(screen.queryByTestId("sheet")).toBeNull();
	});

	it("deletes a story at once and brings it back with Undo", async () => {
		mockReads.stories = query([redesign, mentoring]);
		await renderScreen(<StoriesPanel />);
		await fireEvent.press(screen.getByTestId("story-s2"));
		await fireEvent.press(screen.getByText("Delete story"));
		expect(screen.queryByText("Mentoring juniors")).toBeNull();
		expect(screen.queryByTestId("sheet")).toBeNull();
		expect(mockUndo[0]?.message).toBe("Story deleted");

		await act(() => mockUndo[0]?.restore());
		expect(screen.getByText("Mentoring juniors")).toBeOnTheScreen();
		await mockUndo[0]?.commit();
		expect(mockApi.deleteStory).toHaveBeenCalledWith({ id: "s2" });
	});

	it("shows the first story beside the list on tablets and edits it in place", async () => {
		mockTablet = true;
		mockReads.stories = query([redesign, mentoring]);
		mockApi.saveStory.mockResolvedValue({ id: "s1" });
		await renderScreen(<StoriesPanel />);
		expect(screen.queryByTestId("sheet")).toBeNull();
		expect(screen.getByText("Ran five usability rounds.")).toBeOnTheScreen();

		await fireEvent.press(screen.getByText("Edit"));
		await fireEvent.changeText(screen.getByLabelText("Result"), "Conversion rose 12%.");
		await fireEvent.press(screen.getByText("Save story"));
		expect(mockApi.saveStory).toHaveBeenCalledWith(
			expect.objectContaining({ id: "s1", result: "Conversion rose 12%.", tags: ["Design"] }),
		);
		expect(screen.getByText("Edit")).toBeOnTheScreen();
	});
});
