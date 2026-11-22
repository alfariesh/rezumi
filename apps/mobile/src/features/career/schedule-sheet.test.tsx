// The schedule sheet (plans/mobile Phase 09): a job alert starts from the Jobs screen's search, an old schedule or
// Preferences, saves its whole search, and a plan's limit reads as a neutral sentence. The reads and the API are
// replaced; the sheet's form, its validation and its wording are the real ones.
import type { Schedule } from "./hooks";
import type { ReactNode } from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { ORPCError } from "@orpc/client";
import { ScheduleSheet, scheduleTitle } from "./schedule-sheet";
import { renderScreen } from "@/test/render-screen";

const mockNow = new Date("2026-11-22T10:00:00Z");
const mockSave = jest.fn();
const mockDefaults = jest.fn();
const mockShowToast = jest.fn();
const mockAi = {
	usableProviders: [{ id: "p_1", label: "OpenAI" }],
	defaultProvider: { id: "p_1", label: "OpenAI" } as { id: string; label: string } | null,
	hasAIProvider: true,
	isLoading: false,
	error: null,
	retry: jest.fn(),
};
let mockApplications: unknown[] = [];

jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/auth/session", () => ({
	useSession: () => ({ status: "signed-in", server: "https://rezumi.app" }),
	getServer: () => "https://rezumi.app",
}));
jest.mock("@/api/client", () => {
	const read = (name: string, fn: () => unknown) => ({
		key: () => [["jobs", name]],
		queryOptions: () => ({ queryKey: [["jobs", name]], queryFn: fn }),
	});
	return {
		client: { career: { saveSchedule: (input: unknown) => mockSave(input) } },
		orpc: {
			jobs: {
				defaults: read("defaults", () => mockDefaults()),
				quota: read("quota", () => Promise.resolve({ available: true, cacheOnly: false })),
			},
			career: { key: () => ["career"] },
			applications: { key: () => ["applications"] },
			documents: { list: { key: () => ["documents"] } },
		},
	};
});
jest.mock("@/api/flags", () => ({
	useFlags: () => ({ data: { careerSchedulingEnabled: true, smtpEnabled: false }, isError: false }),
}));
jest.mock("@/features/career/hooks", () => ({
	...jest.requireActual("@/features/career/hooks"),
	useCareerQueries: () => ({ profile: { data: { targetRoles: ["Designer"] }, isError: false } }),
	useCareerTime: () => ({
		timeZone: "UTC",
		locale: "en",
		profile: { data: { email: "sam@example.com", emailVerified: true }, isError: false },
	}),
	useNow: () => mockNow,
}));
jest.mock("@/features/ai/provider-state", () => ({ useHasAIProvider: () => mockAi }));
jest.mock("@/features/applications/queries", () => ({
	useApplications: () => ({ data: mockApplications, isError: false }),
}));
type MockSheetProps = {
	isOpen: boolean;
	title?: string;
	children?: ReactNode;
	footer?: ReactNode;
	canDismiss?: boolean;
	onOpenChange: (open: boolean) => void;
	onDismissAttempt?: () => void;
};
type MockPickerProps = {
	isOpen: boolean;
	title: string;
	options: { value: string; label: string }[];
	onPick: (value: string) => void;
};
type MockConfirmProps = { isOpen: boolean; title: string; confirmLabel: string; onConfirm: () => void };
jest.mock("@/ui", () => {
	const actual = jest.requireActual("@/ui");
	const { Pressable, Text, View } = jest.requireActual("react-native");
	return {
		...actual,
		showToast: (options: unknown) => mockShowToast(options),
		Sheet: (props: MockSheetProps) =>
			props.isOpen ? (
				<View>
					<Text>{props.title}</Text>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel="Dismiss sheet"
						onPress={() => (props.canDismiss === false ? props.onDismissAttempt?.() : props.onOpenChange(false))}
					/>
					{props.children}
					{props.footer}
				</View>
			) : null,
		PickerSheet: ({ isOpen, title, options, onPick }: MockPickerProps) =>
			isOpen ? (
				<View accessibilityLabel={`${title} options`}>
					{options.map((option) => (
						<Pressable key={option.value} accessibilityRole="button" onPress={() => onPick(option.value)}>
							<Text>{`Pick ${option.label}`}</Text>
						</Pressable>
					))}
				</View>
			) : null,
		ConfirmDialog: ({ isOpen, title, confirmLabel, onConfirm }: MockConfirmProps) =>
			isOpen ? (
				<View>
					<Text>{title}</Text>
					<Pressable accessibilityRole="button" onPress={onConfirm}>
						<Text>{confirmLabel}</Text>
					</Pressable>
				</View>
			) : null,
	};
});

const search = {
	query: "Product designer",
	location: "Berlin",
	country: "DE",
	remote: "any" as const,
	postedWithinDays: 7 as const,
	seniority: "senior" as const,
	includeNoSalary: true,
};
const oldAlert: Schedule = {
	id: "s_1",
	userId: "user-1",
	locale: "en",
	kind: "discovery",
	query: "UX writer · Jakarta",
	search: null,
	enabled: true,
	intervalDays: 3,
	lastQueuedAt: null,
	nextRunAt: new Date("2026-11-20T07:00:00Z"),
	timezone: "UTC",
	createdAt: new Date("2026-11-01T00:00:00Z"),
	updatedAt: new Date("2026-11-01T00:00:00Z"),
	applicationId: null,
	interviewId: null,
	lead: null,
	email: false,
	aiProviderId: null,
};
type Props = Partial<Parameters<typeof ScheduleSheet>[0]>;
const onClose = jest.fn();
const onDelete = jest.fn();
const open = (props: Props = {}) =>
	renderScreen(<ScheduleSheet schedule={null} kind="discovery" onClose={onClose} onDelete={onDelete} {...props} />);
const save = () => fireEvent.press(screen.getByRole("button", { name: "Save schedule" }));

beforeEach(() => {
	jest.clearAllMocks();
	mockApplications = [];
	mockSave.mockResolvedValue({ id: "s_new" });
	mockDefaults.mockResolvedValue({
		query: "Data analyst",
		location: "",
		country: "ID",
		remote: "only",
		suggestions: [],
	});
});

describe("ScheduleSheet", () => {
	it("names schedules as the web does", () => {
		expect(scheduleTitle("discovery")).toBe("Job alert");
		expect(scheduleTitle("prepare")).toBe("Interview preparation");
		expect(scheduleTitle("follow-up")).toBe("Follow-up reminder");
	});

	it("prefills a new job alert from the Jobs screen's search", async () => {
		await open({ search });
		expect(await screen.findByText("New job alert")).toBeOnTheScreen();
		expect(screen.getByLabelText("Role").props.value).toBe("Product designer");
		expect(screen.getByLabelText("City (optional)").props.value).toBe("Berlin");
		expect(screen.getByText("Germany")).toBeOnTheScreen();
		expect(screen.getByText(/^Also filtered by: .*Senior/)).toBeOnTheScreen();
		expect(screen.getByText(/Each run looks for jobs that appeared since the last one/)).toBeOnTheScreen();
		expect(mockDefaults).not.toHaveBeenCalled();
	});

	it("saves a job alert's whole search with the role, city and country from the sheet", async () => {
		await open({ search });
		await screen.findByText("New job alert");
		await fireEvent.changeText(screen.getByLabelText("City (optional)"), "  ");
		await fireEvent.press(screen.getByRole("button", { name: /^Country/ }));
		await fireEvent.press(screen.getByText("Pick Anywhere"));
		await save();
		await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
		expect(mockSave.mock.calls[0][0]).toMatchObject({
			kind: "discovery",
			query: "Product designer",
			search: { query: "Product designer", remote: "any", postedWithinDays: 7, seniority: "senior" },
			intervalDays: 1,
			timezone: "UTC",
			nextRunAt: new Date("2026-11-23T08:00:00Z"),
		});
		const sent = mockSave.mock.calls[0][0].search;
		expect(sent).not.toHaveProperty("location");
		expect(sent).not.toHaveProperty("country");
		await waitFor(() => expect(onClose).toHaveBeenCalled());
		expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Schedule saved" }));
	});

	it("starts a new job alert from Preferences when no search is given", async () => {
		await open();
		await waitFor(() => expect(screen.getByLabelText("Role").props.value).toBe("Data analyst"));
		expect(screen.getByText("Indonesia")).toBeOnTheScreen();
		expect(screen.getByText("Also filtered by: Remote in this country")).toBeOnTheScreen();
	});

	it("edits an old job alert that has only a query", async () => {
		await open({ schedule: oldAlert });
		expect(await screen.findByText("Edit job alert")).toBeOnTheScreen();
		expect(screen.getByLabelText("Role").props.value).toBe("UX writer · Jakarta");
		expect(screen.getByLabelText("City (optional)").props.value).toBe("");
		expect(screen.getByText("Anywhere")).toBeOnTheScreen();
		expect(screen.queryByText(/Also filtered by/)).toBeNull();
		await save();
		await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
		expect(mockSave.mock.calls[0][0]).toMatchObject({
			id: "s_1",
			kind: "discovery",
			search: { query: "UX writer · Jakarta" },
			intervalDays: 3,
		});
		expect(mockDefaults).not.toHaveBeenCalled();
	});

	it("asks for a role before saving a job alert", async () => {
		await open({ search });
		await screen.findByText("New job alert");
		await fireEvent.changeText(screen.getByLabelText("Role"), "x");
		await save();
		expect(screen.getByText("Add a role to look for.")).toBeOnTheScreen();
		expect(mockSave).not.toHaveBeenCalled();
	});

	it("blocks a briefing until there is an interview", async () => {
		await open({ kind: "prepare" });
		expect(await screen.findByText("New schedule")).toBeOnTheScreen();
		expect(await screen.findByText("Add an interview in an application first")).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: "Save schedule" })).toBeDisabled();
		await save();
		expect(mockSave).not.toHaveBeenCalled();
	});

	it("explains a plan's job alert limit without offering to buy", async () => {
		mockSave.mockRejectedValue(
			new ORPCError("PLAN_LIMIT_REACHED", { status: 403, data: { limit: "jobAlerts", max: 2, used: 2 } }),
		);
		await open({ search });
		await screen.findByText("New job alert");
		await save();
		expect(await screen.findByText("No room for another job alert")).toBeOnTheScreen();
		expect(
			screen.getByText("You can keep up to 2 job alerts on. Pause or delete one to turn on another."),
		).toBeOnTheScreen();
		expect(screen.queryByText(/Couldn't save/)).toBeNull();
		expect(screen.queryByText(/plan|buy|upgrade/i)).toBeNull();
		expect(onClose).not.toHaveBeenCalled();
	});

	it("asks before discarding edits, and deletes through the caller", async () => {
		await open({ schedule: oldAlert });
		await screen.findByText("Edit job alert");
		await fireEvent.changeText(screen.getByLabelText("Role"), "Content designer");
		await fireEvent.press(screen.getByRole("button", { name: "Dismiss sheet" }));
		expect(screen.getByText("Discard changes?")).toBeOnTheScreen();
		expect(onClose).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByText("Discard"));
		expect(onClose).toHaveBeenCalledTimes(1);
		await fireEvent.press(screen.getByRole("button", { name: "Delete" }));
		expect(onDelete).toHaveBeenCalledWith("s_1");
	});
});
