import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { PORTFOLIO_CLICK_KINDS, PORTFOLIO_VISIT_SOURCES } from "@rezumi/schema/portfolio/statistics";
import { PortfolioInboxScreen } from "./inbox";
import { PortfolioScreen } from "./overview";
import { PortfolioStatisticsScreen } from "./statistics";
import { renderScreen } from "@/test/render-screen";

const mockPush = jest.fn();
const mockPublish = jest.fn();
const mockRead = jest.fn();
const mockDelete = jest.fn();
let mockPortfolio: { isPublic: boolean; suspendedAt: Date | null } | null = null;
const mockMessage = {
	id: "message-1",
	name: "Tara Hartono",
	email: "tara@example.test",
	body: "Are you available to discuss a project?",
	createdAt: "2026-11-25T03:00:00Z",
	readAt: null as string | null,
};
const counts = <T extends string>(keys: readonly T[]) => Object.fromEntries(keys.map((key) => [key, 0]));
const mockStats = {
	range: { days: 30, from: "2026-10-27", to: "2026-11-25" },
	days: [],
	totals: { views: 0, messages: 0, clicks: counts(PORTFOLIO_CLICK_KINDS) },
	sources: counts(PORTFOLIO_VISIT_SOURCES),
	works: [],
	details: { state: "locked" },
};

jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush, canGoBack: () => false }) }));
jest.mock("@/shell/tab-chrome", () => ({ TabTopBar: () => null }));
jest.mock("@/shell/use-is-tablet", () => ({ useIsTablet: () => false }));
jest.mock("@/ui/sheet", () => ({
	Sheet: ({ children, isOpen }: { children: unknown; isOpen: boolean }) => (isOpen ? children : null),
}));
jest.mock("@/auth/session", () => ({ useSession: () => ({ server: "https://example.test" }) }));
jest.mock("@/api/ai-consent", () => ({ AiConsentDeclined: class extends Error {} }));
jest.mock("expo-file-system", () => ({}));
jest.mock("expo-sharing", () => ({}));
jest.mock("expo-web-browser", () => ({}));
jest.mock("heroui-native-pro/bar-chart", () => ({ BarChart: Object.assign(() => null, { Bar: () => null }) }));
jest.mock("@/api/client", () => {
	const query = (key: string[], data: () => unknown) => ({
		key: () => key,
		queryOptions: () => ({ queryKey: key, queryFn: async () => data() }),
	});
	const messages = () => ({ items: [mockMessage], unread: mockMessage.readAt ? 0 : 1, nextCursor: null });
	return {
		orpc: {
			auth: { getProfile: query(["profile"], () => ({ username: "delia" })) },
			customDomain: { get: query(["domain"], () => null) },
			portfolio: {
				key: () => ["portfolio"],
				get: query(["portfolio", "get"], () => ({ enabled: true, portfolio: mockPortfolio })),
				statistics: query(["portfolio", "statistics"], () => mockStats),
				messages: {
					list: {
						...query(["portfolio", "messages"], messages),
						infiniteOptions: () => ({
							queryKey: ["portfolio", "messages", "infinite"],
							queryFn: async () => messages(),
							initialPageParam: null,
							getNextPageParam: () => null,
						}),
					},
				},
			},
			resume: { list: { key: () => ["resumes"] } },
		},
		client: {
			portfolio: {
				setPublic: async (input: { isPublic: boolean }) => {
					mockPublish(input);
					if (mockPortfolio) mockPortfolio = { ...mockPortfolio, isPublic: input.isPublic };
				},
				messages: {
					markRead: async (input: { id: string; read: boolean }) => {
						mockRead(input);
						mockMessage.readAt = input.read ? "2026-11-25T04:00:00Z" : null;
					},
					delete: mockDelete,
				},
			},
		},
	};
});

beforeEach(() => {
	mockPortfolio = null;
	mockMessage.readAt = null;
	jest.clearAllMocks();
});

it("starts from the empty portfolio state", async () => {
	await renderScreen(<PortfolioScreen />);
	await fireEvent.press(await screen.findByRole("button", { name: "Create portfolio" }));
	expect(mockPush).toHaveBeenCalledWith("/portfolio/create");
});

it("publishes a draft and shows the address and share actions", async () => {
	mockPortfolio = { isPublic: false, suspendedAt: null };
	await renderScreen(<PortfolioScreen />);
	expect(await screen.findByText("Draft")).toBeOnTheScreen();
	await waitFor(() => expect(screen.getByTestId("portfolio-publish")).toBeEnabled());
	await fireEvent.press(screen.getByTestId("portfolio-publish"));
	expect(mockPublish).toHaveBeenCalledWith({ isPublic: true });
	expect(await screen.findByText("Published")).toBeOnTheScreen();
	expect(screen.getByText("https://example.test/delia")).toBeOnTheScreen();
	expect(screen.getByRole("button", { name: "Share link" })).toBeEnabled();
});

it("shows empty statistics and the neutral Plus notice", async () => {
	await renderScreen(<PortfolioStatisticsScreen />);
	expect(await screen.findByText("No visits in this period.")).toBeOnTheScreen();
	expect(screen.getByText("Visitor breakdown is available with Plus.")).toBeOnTheScreen();
	expect(screen.getByText("Daily numbers")).toBeOnTheScreen();
});

it("opens a message and marks it read", async () => {
	await renderScreen(<PortfolioInboxScreen />);
	await fireEvent.press(await screen.findByTestId("portfolio-message-message-1"));
	expect(mockRead).toHaveBeenCalledWith({ id: "message-1", read: true });
	expect(await screen.findByText("tara@example.test")).toBeOnTheScreen();
	expect(await screen.findByRole("button", { name: "Mark unread" })).toBeEnabled();
});
