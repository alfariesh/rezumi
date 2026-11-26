// Offers (plans/mobile Phase 10): the pair to open with, money differences only in the same currency and pay period,
// requirements from Preferences, a date-only deadline that stays its day west of UTC, Plan what to ask, the link to
// the application, and the loading, empty, error and offline states.
import { fireEvent, screen } from "@testing-library/react-native";
import { OffersBody } from "./offers-screen";
import { renderScreen } from "@/test/render-screen";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRefetch = jest.fn(() => Promise.resolve());
let mockOffers: { offers: unknown[] | undefined; isError: boolean };
let mockOnline = true;

jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush, replace: mockReplace }) }));
jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn(() => Promise.resolve(true)) }));
jest.mock("./queries", () => ({
	useSavedOffers: () => ({ ...mockOffers, refetch: mockRefetch }),
	useCareerProfile: () => ({
		data: {
			minBase: { amount: 115_000, currency: "USD", period: "year" },
			maxOfficeDays: 3,
			locations: ["Berlin"],
			priorities: "Growth and a calm team.",
		},
		isError: false,
		refetch: mockRefetch,
	}),
}));
// 20:00 on 22 November in Los Angeles, already 23 November in UTC.
jest.mock("@/features/career/hooks", () => ({ useNow: () => new Date("2026-11-23T04:00:00Z") }));
jest.mock("@/features/account/queries", () => ({ useProfile: () => ({ data: { timezone: "America/Los_Angeles" } }) }));
jest.mock("@/api/online", () => ({ useOnline: () => mockOnline }));
jest.mock("@/shell/use-is-tablet", () => ({ useIsTablet: () => false }));

const offer = (id: string, applicationId: string, company: string, data: Record<string, unknown>) => ({
	id,
	applicationId,
	createdAt: new Date("2026-11-20T10:00:00Z"),
	outdated: false,
	application: { company, role: "Product designer" },
	data: {
		kind: "offer",
		version: "written",
		currency: "USD",
		period: "year",
		base: null,
		variable: null,
		variableConditions: "",
		equity: "",
		location: "",
		officeDays: null,
		leave: "",
		learning: null,
		other: "",
		respondBy: null,
		...data,
	},
});

const northstar = offer("o1", "app1", "Northstar", {
	base: 120_000,
	variable: 10_000,
	variableConditions: "Company targets",
	equity: "0.1%",
	location: "Berlin",
	officeDays: 2,
	leave: "28 days",
	learning: 2_000,
	respondBy: "2026-11-23",
});
const harbor = offer("o2", "app2", "Harbor", { base: 110_000, officeDays: 0, learning: 1_000 });
const kite = offer("o3", "app3", "Kite", { currency: "EUR", base: 100_000 });

beforeEach(() => {
	jest.clearAllMocks();
	mockOnline = true;
	mockOffers = { offers: [northstar, harbor, kite], isError: false };
});

describe("Offers", () => {
	it("opens with the newest offers from two jobs and compares money in the same terms", async () => {
		await renderScreen(<OffersBody />);
		expect(screen.getByText("Northstar")).toBeTruthy();
		expect(screen.getByText("Harbor")).toBeTruthy();
		expect(screen.queryByText("Kite")).toBeNull();
		expect(screen.getByLabelText("Base salary, Northstar: $120,000 a year. $10,000 more")).toBeTruthy();
		expect(screen.getByLabelText("Base salary, Harbor: $110,000 a year")).toBeTruthy();
		expect(screen.getByLabelText("Learning budget, Northstar: $2,000 a year. $1,000 more")).toBeTruthy();
		expect(screen.getByLabelText("Bonus, Harbor: Unknown. Not in the offer · ask Harbor")).toBeTruthy();
		expect(screen.getByLabelText("Where you work, Harbor: Remote")).toBeTruthy();
		expect(screen.queryByText("Different currencies or pay periods. No money difference is worked out.")).toBeNull();
		expect(screen.getByLabelText("Meets: $115,000 minimum")).toBeTruthy();
		expect(screen.getByLabelText("Misses: $115,000 minimum")).toBeTruthy();
		expect(screen.getAllByText("Ask Harbor", { exact: false }).length).toBeGreaterThan(0);
	});

	it("says money in another currency can't be compared", async () => {
		mockOffers = { offers: [northstar, kite], isError: false };
		await renderScreen(<OffersBody />);
		expect(screen.getByText("Different currencies or pay periods. No money difference is worked out.")).toBeTruthy();
		expect(
			screen.getByLabelText("Base salary, Northstar: $120,000 a year. Different currency, not compared"),
		).toBeTruthy();
		expect(screen.getByLabelText("Base salary, Kite: €100,000 a year. Different currency, not compared")).toBeTruthy();
	});

	it("keeps a deadline given as a day on that day for a time zone west of UTC", async () => {
		await renderScreen(<OffersBody />);
		expect(screen.getByLabelText("Respond by, Northstar: Nov 23, 2026. Tomorrow. No time given")).toBeTruthy();
	});

	it("swaps the columns, plans what to ask with the pair and opens an offer's application", async () => {
		await renderScreen(<OffersBody />);
		await fireEvent.press(screen.getByRole("button", { name: "Plan what to ask" }));
		expect(mockPush).toHaveBeenCalledWith("/coach?offers=o1,o2");

		await fireEvent.press(screen.getByRole("button", { name: "Swap offers" }));
		await fireEvent.press(screen.getByRole("button", { name: "Plan what to ask" }));
		expect(mockPush).toHaveBeenLastCalledWith("/coach?offers=o2,o1");

		await fireEvent.press(screen.getByRole("button", { name: "Open the Northstar application" }));
		expect(mockPush).toHaveBeenLastCalledWith("/applications?open=app1");
	});

	it("explains where offers come from when there are none", async () => {
		mockOffers = { offers: [], isError: false };
		await renderScreen(<OffersBody />);
		expect(screen.getByText("No offers to compare yet")).toBeTruthy();
		await fireEvent.press(screen.getByRole("button", { name: "Open applications" }));
		expect(mockReplace).toHaveBeenCalledWith("/applications");
	});

	it("shows loading, offline and a failed load with Retry", async () => {
		mockOffers = { offers: undefined, isError: false };
		const loading = await renderScreen(<OffersBody />);
		expect(screen.getByLabelText("Loading offers")).toBeTruthy();
		await loading.unmount();

		mockOnline = false;
		const offline = await renderScreen(<OffersBody />);
		expect(screen.getByText("You're offline")).toBeTruthy();
		await offline.unmount();

		mockOffers = { offers: undefined, isError: true };
		await renderScreen(<OffersBody />);
		await fireEvent.press(screen.getByRole("button", { name: "Retry" }));
		expect(mockRefetch).toHaveBeenCalled();
	});
});
