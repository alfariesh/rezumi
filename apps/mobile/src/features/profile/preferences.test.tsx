// The Preferences panel's states (plans/mobile Phase 06): loading, a new profile with nothing filled in, failed with
// Retry, saved preferences, saving a change, and a failed save that keeps the draft. The reads and the API are
// replaced; the panel, its fields, the save queue and their wording are the real ones.
import type { QueryClient } from "@tanstack/react-query";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { PreferencesPanel } from "./preferences";
import { renderScreen } from "@/test/render-screen";

type Query = { data: unknown; isPending: boolean; isError: boolean; refetch: jest.Mock };
const query = (data: unknown, state: Partial<Query> = {}): Query => ({
	data,
	isPending: data === undefined && !state.isError,
	isError: false,
	refetch: jest.fn(() => Promise.resolve()),
	...state,
});

const SERVER = "https://rezumi.app";
const mockReads: { facts: Query; stories: Query; profile: Query } = {
	facts: query([]),
	stories: query([]),
	profile: query(undefined),
};
const mockSaveProfile = jest.fn();
const mockPush = jest.fn();

jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("@/features/reminders/schedule", () => ({ deviceTimeZone: () => "UTC" }));
jest.mock("@/auth/session", () => ({
	useSession: () => ({ status: "signed-in", server: "https://rezumi.app" }),
	getServer: () => "https://rezumi.app",
}));
jest.mock("@/api/client", () => ({
	client: { career: { saveProfile: (...args: unknown[]) => mockSaveProfile(...args) } },
	orpc: {
		auth: { getProfile: { key: () => ["auth", "getProfile"] } },
		career: { profile: { key: () => ["career", "profile"] } },
	},
}));
jest.mock("@/features/career/hooks", () => ({
	useCareerQueries: () => mockReads,
	useCareerTime: () => ({ locale: "en", timeZone: "UTC", profile: { data: { id: "user-1", timezone: "UTC" } } }),
}));

const preferences = (values: Record<string, unknown> = {}) => ({
	targetRoles: [],
	locations: [],
	priorities: "",
	minBase: { amount: null, currency: "USD", period: "year" },
	maxOfficeDays: null,
	noticeWeeks: null,
	memoryMode: "ask",
	...values,
});

/** The save queue only writes for the signed-in account it started with. */
const signIn = (queryClient: QueryClient) => queryClient.setQueryData(["auth", "getProfile", SERVER], { id: "user-1" });

beforeEach(() => {
	mockSaveProfile.mockReset().mockResolvedValue(undefined);
	mockPush.mockReset();
	mockReads.profile = query(undefined);
});

describe("PreferencesPanel", () => {
	it("shows the form's shape while loading", async () => {
		await renderScreen(<PreferencesPanel />);
		expect(screen.getByLabelText("Loading")).toBeOnTheScreen();
		expect(screen.queryByText("Target roles")).toBeNull();
	});

	it("shows an empty form for a new profile, searching anywhere", async () => {
		mockReads.profile = query(preferences());
		await renderScreen(<PreferencesPanel />);
		expect(screen.getByText("What you're looking for")).toBeOnTheScreen();
		expect(screen.getByText("Anywhere")).toBeOnTheScreen();
		expect(screen.getByText("Saved")).toBeOnTheScreen();
		expect(
			screen.getByText("The coach proposes each fact in the chat. Nothing is saved until you agree."),
		).toBeOnTheScreen();
		expect(screen.queryByText(/Knowledge/)).toBeNull();
	});

	it("says a failed load went wrong and retries", async () => {
		mockReads.profile = query(undefined, { isError: true });
		await renderScreen(<PreferencesPanel />);
		expect(screen.getByText("Couldn't load your preferences")).toBeOnTheScreen();
		await fireEvent.press(screen.getByText("Retry"));
		expect(mockReads.profile.refetch).toHaveBeenCalled();
	});

	it("shows saved preferences", async () => {
		mockReads.profile = query(
			preferences({
				targetRoles: ["Product designer"],
				searchRegions: ["ID"],
				minBase: { amount: 95000, currency: "EUR", period: "month" },
				noticeWeeks: 4,
				memoryMode: "off",
			}),
		);
		await renderScreen(<PreferencesPanel />);
		expect(screen.getByText("Product designer")).toBeOnTheScreen();
		expect(screen.getByText("Indonesia")).toBeOnTheScreen();
		expect(screen.getByDisplayValue("95,000")).toBeOnTheScreen();
		expect(screen.getByDisplayValue("EUR")).toBeOnTheScreen();
		expect(screen.getByDisplayValue("4")).toBeOnTheScreen();
		expect(screen.getByText("The coach doesn't remember anything from your messages.")).toBeOnTheScreen();
		await fireEvent.press(screen.getByText("Change timezone"));
		expect(mockPush).toHaveBeenCalledWith("/account/preferences");
	});

	it("saves a change on leaving a field", async () => {
		mockReads.profile = query(preferences());
		const { queryClient } = await renderScreen(<PreferencesPanel />);
		signIn(queryClient);
		const roles = screen.getByLabelText("Target roles");
		await fireEvent.changeText(roles, "Designer");
		await fireEvent(roles, "submitEditing");
		await fireEvent.press(screen.getByRole("tab", { name: "Never" }));
		await fireEvent(screen.getByLabelText("What matters to you"), "blur");
		await waitFor(() =>
			expect(mockSaveProfile).toHaveBeenCalledWith(
				expect.objectContaining({ targetRoles: ["Designer"], memoryMode: "off" }),
			),
		);
		await waitFor(() => expect(screen.getByText("Saved")).toBeOnTheScreen());
	});

	it("keeps the draft when a save fails, refuses an invalid amount, and retries", async () => {
		mockReads.profile = query(preferences());
		mockSaveProfile.mockRejectedValueOnce(new Error("offline"));
		const { queryClient } = await renderScreen(<PreferencesPanel />);
		signIn(queryClient);
		await fireEvent.changeText(screen.getByLabelText("What matters to you"), "A small team");
		await fireEvent(screen.getByLabelText("What matters to you"), "blur");
		await waitFor(() =>
			expect(screen.getByText("Couldn't save your preferences. Your draft is still here.")).toBeOnTheScreen(),
		);
		expect(screen.getByDisplayValue("A small team")).toBeOnTheScreen();

		await fireEvent.press(screen.getByText("Retry"));
		await waitFor(() => expect(mockSaveProfile).toHaveBeenCalledTimes(2));
		expect(mockSaveProfile).toHaveBeenLastCalledWith(expect.objectContaining({ priorities: "A small team" }));

		await fireEvent.changeText(screen.getByLabelText("Minimum base salary"), "95,00,0");
		expect(
			screen.getByText("Enter a full amount, such as 95000. Your previous amount is unchanged."),
		).toBeOnTheScreen();
		expect(screen.getByText("Check your preferences. Invalid changes are not saved.")).toBeOnTheScreen();
	});
});
