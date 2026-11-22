// Profile → Details and Career (plans/mobile Phase 06) in their four states: loading, failed load, empty and filled,
// plus a save that failed offline. The API is replaced; the store, the forms and their wording are the real ones.
import type { ProfileData } from "@rezumi/schema/profile/data";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import Storage from "expo-sqlite/kv-store";
import { emptyProfileData } from "@rezumi/schema/profile/data";
import { CareerPanel } from "./career";
import { DetailsPanel } from "./details";
import { clearPendingProfile } from "./pending";
import { closeProfile, useProfileEditor } from "./store";
import { renderScreen } from "@/test/render-screen";

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true };
const mockApi = { get: jest.fn(), update: jest.fn() };

jest.mock("expo-router", () => ({ useRouter: () => mockRouter, Stack: { Screen: () => null } }));
jest.mock("@/auth/session", () => ({
	useSession: () => ({ status: "signed-in", server: "https://rezumi.app" }),
	getSession: () => ({ status: "signed-in", server: "https://rezumi.app" }),
	getServer: () => "https://rezumi.app",
	getAccountScope: () => '["https://rezumi.app","user-1"]',
	subscribeSession: () => () => undefined,
}));
jest.mock("@/api/client", () => ({
	client: {
		profile: {
			get: (...args: unknown[]) => mockApi.get(...args),
			update: (...args: unknown[]) => mockApi.update(...args),
		},
	},
	rest: jest.fn(),
	orpc: { documents: { key: () => ["documents"] } },
}));
jest.mock("@/features/onboarding/queries", () => ({
	profileQuery: (server: string) => ({ queryKey: ["profile", server], queryFn: () => mockApi.get() }),
	storeSavedProfile: jest.fn(),
}));
jest.mock("@/features/documents/queries", () => ({
	useDocuments: () => ({ data: [], isPending: false, isError: false, refetch: jest.fn() }),
}));

// A sheet that shows its content once presented, so Add section can be picked from.
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

const version = new Date("2026-11-21T08:00:00.000Z");

const profile = (fill?: (data: ProfileData) => void) => {
	const data = emptyProfileData();
	data.basics.name = "Dana Putri";
	data.basics.email = "dana@example.com";
	fill?.(data);
	return { data, updatedAt: version };
};

const withExperience = profile((data) => {
	data.sections.experience.push({
		id: "exp-1",
		hidden: false,
		company: "Nusantara Labs",
		position: "Product designer",
		location: "Bandung",
		period: "",
		dates: { start: "2022-03", end: null, present: true },
		website: { url: "", label: "", inlineLink: false },
		description: "",
		roles: [],
	} as never);
});

beforeEach(() => {
	jest.clearAllMocks();
	closeProfile();
	clearPendingProfile(Storage, '["https://rezumi.app","user-1"]');
});

describe("Profile → Details", () => {
	it("shows a skeleton while the Profile loads", async () => {
		mockApi.get.mockReturnValue(new Promise(() => undefined));
		await renderScreen(<DetailsPanel />);
		expect(screen.getByTestId("profile-loading")).toBeOnTheScreen();
	});

	it("says when the Profile couldn't load, with Try again", async () => {
		mockApi.get.mockRejectedValueOnce(new Error("offline"));
		await renderScreen(<DetailsPanel />);
		expect(await screen.findByText("Couldn't load your Profile")).toBeOnTheScreen();
		mockApi.get.mockResolvedValueOnce(profile());
		await fireEvent.press(screen.getByText("Try again"));
		expect(await screen.findByDisplayValue("Dana Putri")).toBeOnTheScreen();
	});

	it("edits the name in the Profile and saves it with the version it read", async () => {
		mockApi.get.mockResolvedValue(profile());
		mockApi.update.mockImplementation(({ data }: { data: ProfileData }) =>
			Promise.resolve({ data, updatedAt: new Date("2026-11-21T09:00:00.000Z"), updatedResumes: [] }),
		);
		await renderScreen(<DetailsPanel />);
		const name = await screen.findByTestId("basics-name");
		await fireEvent.changeText(name, "Dana Putri Ayu");
		expect(useProfileEditor.getState().data?.basics.name).toBe("Dana Putri Ayu");

		await waitFor(() => expect(mockApi.update).toHaveBeenCalled(), { timeout: 2000 });
		const [input] = mockApi.update.mock.calls[0] as [{ data: ProfileData; expectedUpdatedAt: Date }];
		expect(input.data.basics.name).toBe("Dana Putri Ayu");
		expect(input.expectedUpdatedAt).toBe(version);
		expect(await screen.findByText("Saved")).toBeOnTheScreen();
	});

	it("keeps the change on the device when saving fails offline, and offers Retry", async () => {
		mockApi.get.mockResolvedValue(profile());
		mockApi.update.mockRejectedValue(new TypeError("Network request failed"));
		await renderScreen(<DetailsPanel />);
		await fireEvent.changeText(await screen.findByTestId("basics-headline"), "Designer");
		expect(
			await screen.findByText("Not saved yet. Your changes are kept on this device.", undefined, { timeout: 2000 }),
		).toBeOnTheScreen();
		expect(screen.getByText("Retry")).toBeOnTheScreen();
		expect(useProfileEditor.getState().data?.basics.headline).toBe("Designer");
	});
});

describe("Profile → Career", () => {
	it("shows a skeleton while the Profile loads", async () => {
		mockApi.get.mockReturnValue(new Promise(() => undefined));
		await renderScreen(<CareerPanel />);
		expect(screen.getByTestId("profile-loading")).toBeOnTheScreen();
	});

	it("says when the Profile couldn't load", async () => {
		mockApi.get.mockRejectedValue(new Error("offline"));
		await renderScreen(<CareerPanel />);
		expect(await screen.findByText("Couldn't load your Profile")).toBeOnTheScreen();
	});

	it("offers Bring what you have and Fill from a resume while the career is empty", async () => {
		mockApi.get.mockResolvedValue(profile());
		await renderScreen(<CareerPanel />);
		expect(await screen.findByText("Fill your career in one go")).toBeOnTheScreen();
		await fireEvent.press(screen.getByTestId("profile-bring"));
		expect(mockRouter.push).toHaveBeenCalledWith("/profile/bring");
	});

	it("lists the entries of each section in use and opens one", async () => {
		mockApi.get.mockResolvedValue(withExperience);
		await renderScreen(<CareerPanel />);
		expect(await screen.findByText("Product designer")).toBeOnTheScreen();
		expect(screen.getByText("Experience")).toBeOnTheScreen();
		expect(screen.queryByText("Fill your career in one go")).toBeNull();
		await fireEvent.press(screen.getByText("Product designer"));
		expect(mockRouter.push).toHaveBeenCalledWith("/profile/entry/experience/exp-1");
	});

	it("adds a section by adding its first entry and opening it", async () => {
		mockApi.get.mockResolvedValue(withExperience);
		mockApi.update.mockReturnValue(new Promise(() => undefined));
		await renderScreen(<CareerPanel />);
		await fireEvent.press(await screen.findByTestId("profile-add-section"));
		await act(async () => {
			await fireEvent.press(screen.getByText("Education"));
		});
		const education = useProfileEditor.getState().data?.sections.education.items ?? [];
		expect(education).toHaveLength(1);
		expect(mockRouter.push).toHaveBeenCalledWith(`/profile/entry/education/${education[0]?.id}`);
	});
});
