import { fireEvent, screen, waitFor } from "@testing-library/react-native";
// Share's custom domain (plans/mobile Phase 08): each connection stage, the problem and plan notices, the portfolio's
// wording, the plan lock, offline, a failed load, and no call to buy (K6). The API is replaced; the component and its
// wording are the real ones.
import { ORPCError } from "@orpc/client";
import { CustomDomain } from "./custom-domain";
import { renderScreen } from "@/test/render-screen";

const mockData: { domain: unknown; portfolio: unknown; suggestion: unknown } = {
	domain: null,
	portfolio: { enabled: false, portfolio: null },
	suggestion: null,
};
const mockSet = jest.fn();
const mockVerify = jest.fn();
const mockRemove = jest.fn();
const mockPlanAlert = jest.fn();
const mockPlan: { features: Record<string, boolean> } = { features: { customDomain: true } };

function mockQuery(key: string, read: () => unknown) {
	return {
		// An Error in the mock data makes the query fail with it.
		queryOptions: () => ({
			queryKey: [key],
			queryFn: async () => {
				const value = read();
				if (value instanceof Error) throw value;
				return value;
			},
		}),
		queryKey: () => [key],
	};
}
/** Reads the mock when the mutation runs: the module factory runs before the mocks below are assigned. */
function mockMutation(run: () => jest.Mock) {
	return { mutationOptions: () => ({ mutationFn: (input: unknown) => run()(input) }) };
}

jest.mock("@/api/client", () => ({
	orpc: {
		customDomain: {
			get: mockQuery("domain", () => mockData.domain),
			suggestion: mockQuery("suggestion", () => mockData.suggestion),
			set: mockMutation(() => mockSet),
			verify: mockMutation(() => mockVerify),
			remove: mockMutation(() => mockRemove),
		},
		portfolio: { status: mockQuery("portfolio", () => mockData.portfolio) },
	},
}));
jest.mock("@/features/billing/plan", () => ({
	usePlan: () => mockPlan,
	hasPlanFeature: (plan: typeof mockPlan, feature: string) => plan.features[feature] === true,
	showPlanAlert: (...args: unknown[]) => mockPlanAlert(...args),
}));
jest.mock("@/features/billing/plan-alert", () => ({ showPlanAlertForError: () => false }));

type Domain = {
	hostname: string;
	verified: boolean;
	stage: "dns" | "hostname" | "certificate" | "active" | "problem";
	problem: string | null;
	plan: { state: "ok" | "grace" | "redirecting"; until: Date | null };
	managed: boolean;
};

const domain = (overrides: Partial<Domain> = {}) => ({
	hostname: "www.example.com",
	target: "domains.rezumi.app",
	txtName: "_rx-verify.www.example.com",
	txtValue: "rx-verify=token",
	records: [{ type: "CNAME", name: "www", value: "domains.rezumi.app" }],
	verified: true,
	lastCheckedAt: null,
	managed: true,
	stage: "active",
	problem: null,
	plan: { state: "ok", until: null },
	...overrides,
});

beforeEach(() => {
	mockData.domain = null;
	mockData.portfolio = { enabled: false, portfolio: null };
	mockData.suggestion = null;
	mockPlan.features = { customDomain: true };
	for (const mock of [mockSet, mockVerify, mockRemove, mockPlanAlert]) mock.mockReset();
});

describe("CustomDomain", () => {
	it("connects a domain typed in", async () => {
		mockSet.mockResolvedValue(domain({ verified: false, stage: "dns" }));
		await renderScreen(<CustomDomain offline={false} />);
		await fireEvent.changeText(await screen.findByLabelText("Your domain"), "www.example.com");
		await fireEvent.press(screen.getByText("Connect"));
		await waitFor(() => expect(mockSet).toHaveBeenCalledWith({ hostname: "www.example.com" }));
	});

	it("asks for a plan instead of connecting when portfolios need one", async () => {
		mockData.portfolio = { enabled: true, portfolio: null };
		mockPlan.features = {};
		await renderScreen(<CustomDomain offline={false} />);
		expect(await screen.findByText("Plus")).toBeOnTheScreen();
		await fireEvent.changeText(screen.getByLabelText("Your domain"), "www.example.com");
		await fireEvent.press(screen.getByText("Connect"));
		expect(mockSet).not.toHaveBeenCalled();
		expect(mockPlanAlert).toHaveBeenCalledWith({ kind: "feature", feature: "customDomain" });
	});

	it("waits for DNS with the records and a check", async () => {
		mockData.domain = domain({ verified: false, stage: "dns" });
		await renderScreen(<CustomDomain offline={false} />);
		expect(
			await screen.findByText("Not connected yet. Add its DNS records where you manage the domain, then check."),
		).toBeOnTheScreen();
		expect(screen.getByText("Show DNS records")).toBeOnTheScreen();
		expect(screen.getByTestId("domain-step-routing-waiting")).toBeOnTheScreen();
		expect(screen.getByTestId("domain-step-certificate-waiting")).toBeOnTheScreen();
	});

	it("shows the certificate being set up", async () => {
		mockData.domain = domain({ stage: "certificate" });
		await renderScreen(<CustomDomain offline={false} />);
		expect(
			await screen.findByText("Setting up HTTPS. This usually takes a few minutes, and this screen updates by itself."),
		).toBeOnTheScreen();
		expect(screen.getByTestId("domain-step-ownership-done")).toBeOnTheScreen();
		expect(screen.getByTestId("domain-step-certificate-working")).toBeOnTheScreen();
		expect(screen.getByText("Check again")).toBeOnTheScreen();
	});

	it("explains a problem", async () => {
		mockData.domain = domain({ stage: "problem", problem: "caa" });
		await renderScreen(<CustomDomain offline={false} />);
		expect(
			await screen.findByText(
				"A CAA record on this domain blocks its HTTPS certificate. Remove that record or allow the certificate authority, then check again.",
			),
		).toBeOnTheScreen();
		expect(screen.getByTestId("domain-step-certificate-failed")).toBeOnTheScreen();
	});

	it("says an active domain opens the primary resume", async () => {
		mockData.domain = domain();
		await renderScreen(<CustomDomain offline={false} />);
		expect(await screen.findByText("Connected. Your domain opens your primary resume.")).toBeOnTheScreen();
	});

	it("says an active domain opens the published portfolio", async () => {
		mockData.domain = domain();
		mockData.portfolio = { enabled: true, portfolio: { isPublic: true, suspendedAt: null } };
		await renderScreen(<CustomDomain offline={false} />);
		expect(await screen.findByText("Connected. Your domain opens your portfolio.")).toBeOnTheScreen();
	});

	it("warns during the plan's grace period without a call to buy", async () => {
		mockData.domain = domain({ plan: { state: "grace", until: new Date("2026-12-24T12:00:00Z") } });
		await renderScreen(<CustomDomain offline={false} />);
		expect(await screen.findByText(/Your domain stops working on/)).toBeOnTheScreen();
		expect(screen.getByText("Your page keeps its address on Rezumi.")).toBeOnTheScreen();
		expect(screen.queryByText("See plans")).toBeNull();
		expect(screen.queryByText(/Renew/)).toBeNull();
	});

	it("never offers a .cv domain to buy, even when the server suggests one", async () => {
		mockData.suggestion = {
			domain: "jane.cv",
			checked: true,
			price: { amount: 10, renewal: 10, currency: "USD" },
		};
		await renderScreen(<CustomDomain offline={false} />);
		expect(await screen.findByLabelText("Your domain")).toBeOnTheScreen();
		expect(screen.queryByText("jane.cv")).toBeNull();
		expect(screen.queryByText("Register at OlaCV")).toBeNull();
		expect(screen.queryByText("Copy code")).toBeNull();
	});

	it("says a failed load and retries it", async () => {
		mockData.domain = new Error("timeout");
		await renderScreen(<CustomDomain offline={false} />);
		expect(await screen.findByText("Couldn't load your custom domain.")).toBeOnTheScreen();
		mockData.domain = domain();
		await fireEvent.press(screen.getByText("Retry"));
		expect(await screen.findByText("Connected. Your domain opens your primary resume.")).toBeOnTheScreen();
	});

	it("stays away when custom domains aren't open to the account", async () => {
		mockData.domain = new ORPCError("PRECONDITION_FAILED", { status: 412 });
		const { queryClient } = await renderScreen(<CustomDomain offline={false} />);
		await waitFor(() => expect(queryClient.getQueryState(["domain"])?.status).toBe("error"));
		expect(screen.queryByLabelText("Your domain")).toBeNull();
		expect(screen.queryByText("Couldn't load your custom domain.")).toBeNull();
	});

	it("confirms before disconnecting a working domain", async () => {
		mockData.domain = domain();
		mockRemove.mockResolvedValue(undefined);
		await renderScreen(<CustomDomain offline={false} />);
		await fireEvent.press(await screen.findByText("Remove"));
		expect(mockRemove).not.toHaveBeenCalled();
		expect(screen.getByText("Disconnect www.example.com?")).toBeOnTheScreen();
	});

	it("can't connect, check or remove offline", async () => {
		await renderScreen(<CustomDomain offline />);
		// Offline the status isn't read, so nothing is shown rather than a stale form.
		expect(screen.queryByLabelText("Your domain")).toBeNull();
	});
});
