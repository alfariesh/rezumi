// @vitest-environment happy-dom
import type { ApplicationSummary } from "../types";
import type { InterviewTimelineEntry } from "@rezumi/schema/applications/data";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionGlobalConfig } from "motion/react";
import { Toaster } from "@rezumi/ui/components/toast";
import { collectInterviews } from "../interviews";
import { useRescheduleInterview } from "../use-reschedule-interview";
import { ApplicationCalendar } from "./calendar-view";

MotionGlobalConfig.skipAnimations = true;

const api = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("@/libs/orpc/client", () => ({
	orpc: {
		applications: {
			addInterview: { mutationOptions: (options: object) => ({ mutationFn: vi.fn(), ...options }) },
			updateInterview: { mutationOptions: (options: object) => ({ mutationFn: api.update, ...options }) },
			deleteTimelineEntry: { mutationOptions: (options: object) => ({ mutationFn: vi.fn(), ...options }) },
			getById: { queryKey: ({ input }: { input: { id: string } }) => ["application", input.id] },
		},
		career: { schedules: { queryOptions: () => ({ queryKey: ["schedules"], queryFn: async () => [] }) } },
	},
}));
vi.mock("../queries", () => ({
	applicationsListQueryKey: () => ["applications"],
	applicationDetailQueryKey: (id: string) => ["application", id],
}));
vi.mock("@tanstack/react-router", () => ({
	useRouteContext: () => ({ session: { user: { id: "calendar-test", timezone: "UTC" } } }),
}));

const now = new Date();
const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0);
const interview: InterviewTimelineEntry = {
	id: "round-1",
	type: "interview",
	at,
	kind: "technical",
	durationMinutes: 60,
	location: "Office",
	notes: "",
	participants: [],
	audience: "other",
	timezone: "UTC",
};
const application = {
	id: "app-1",
	company: "Globex",
	role: "Engineer",
	status: "interview",
	activity: [interview],
} as unknown as ApplicationSummary;

let client: QueryClient;
function wrapper({ children }: { children: React.ReactNode }) {
	return (
		<QueryClientProvider client={client}>
			<I18nProvider i18n={i18n}>
				<Toaster>{children}</Toaster>
			</I18nProvider>
		</QueryClientProvider>
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	api.update.mockResolvedValue(application);
	client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
	i18n.loadAndActivate({ locale: "en-US", messages: {} });
});
afterEach(() => {
	cleanup();
	client.clear();
});

it("shows interviews on the month view and opens one for editing", async () => {
	render(<ApplicationCalendar applications={[application]} allApplications={[application]} onOpen={vi.fn()} />, {
		wrapper,
	});
	const calendar = screen.getByTestId("interview-calendar");
	expect(calendar.textContent).toContain("1 interview");
	const event = within(calendar).getByRole("button", { name: /Edit interview: Technical · Engineer · Globex/ });
	fireEvent.click(event);
	expect(await screen.findByRole("heading", { name: "Edit interview" })).toBeTruthy();
});

it("switches to the week view with translated controls", () => {
	render(<ApplicationCalendar applications={[application]} allApplications={[application]} onOpen={vi.fn()} />, {
		wrapper,
	});
	fireEvent.click(screen.getByRole("radio", { name: "Week" }));
	expect(screen.getByRole("button", { name: "Previous week" })).toBeTruthy();
	expect(
		screen.getAllByRole("button", { name: /Edit interview: Technical · Engineer · Globex/ }).length,
	).toBeGreaterThan(0);
});

it("reschedules optimistically and Undo puts the old time back", async () => {
	client.setQueryData(["applications"], [application]);
	const { result } = renderHook(() => useRescheduleInterview(), { wrapper });
	const [item] = collectInterviews([application]);
	if (!item) throw new Error("no interview");
	const start = new Date(at.getTime() + 2 * 3_600_000);
	const end = new Date(start.getTime() + 30 * 60_000);

	act(() => result.current(item, start, end));

	await waitFor(() =>
		expect(client.getQueryData<ApplicationSummary[]>(["applications"])?.[0]?.activity[0]).toMatchObject({
			at: start,
			durationMinutes: 30,
		}),
	);
	await waitFor(() =>
		expect(api.update.mock.calls[0]?.[0]).toEqual({
			id: "app-1",
			entryId: "round-1",
			at: start.toISOString(),
			durationMinutes: 30,
		}),
	);
	fireEvent.click(await screen.findByRole("button", { name: "Undo" }));
	await waitFor(() =>
		expect(api.update.mock.calls[1]?.[0]).toEqual({
			id: "app-1",
			entryId: "round-1",
			at: at.toISOString(),
			durationMinutes: 60,
		}),
	);
});
