// Onboarding's steps (plans/mobile Phase 05): a source that works, one that fails, offline, Skip, starting from
// scratch, and a run picked up after the app was closed. The API and the reads are replaced; the screens, the shared
// step and source rules, and their wording are the real ones.
import type { SourceResult } from "@rezumi/schema/profile/sources";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import Storage from "expo-sqlite/kv-store";
import { emptyProfileData } from "@rezumi/schema/profile/data";
import { OnboardingScreen } from "./onboarding-screen";
import { storeSavedOnboarding } from "./saved-run";
import { renderScreen } from "@/test/render-screen";

const SCOPE = '["https://rezumi.app","user-1"]';
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true };
const mockApi = {
	github: jest.fn(),
	linkedin: jest.fn(),
	website: jest.fn(),
	adoptPhoto: jest.fn(),
	update: jest.fn(),
	saveProfile: jest.fn(),
	create: jest.fn(),
};
type Read = { data: unknown; isError: boolean; refetch: jest.Mock };
const read = (data: unknown, isError = false): Read => ({ data, isError, refetch: jest.fn() });
const mockReads: { profile: Read; preferences: Read; status: Read } = {
	profile: read(undefined),
	preferences: read(undefined),
	status: read(undefined),
};

jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));
jest.mock("@/auth/session", () => ({
	useSession: () => ({ status: "signed-in", server: "https://rezumi.app" }),
	getAccountScope: () => SCOPE,
}));
jest.mock("@/api/client", () => {
	// Delegates, because jest.mock factories run before this file's constants exist.
	const call =
		(name: string) =>
		(...args: unknown[]) =>
			(mockApi as Record<string, jest.Mock>)[name]?.(...args);
	return {
		client: {
			profile: {
				update: call("update"),
				sources: {
					github: call("github"),
					linkedin: call("linkedin"),
					website: call("website"),
					adoptPhoto: call("adoptPhoto"),
				},
			},
			career: { saveProfile: call("saveProfile") },
			resume: { create: call("create") },
		},
		orpc: { documents: { key: () => ["documents"] } },
	};
});
jest.mock("./queries", () => ({
	useOnboardingData: () => mockReads,
	storeSavedProfile: jest.fn(),
	preferencesKey: () => ["preferences"],
	profileQuery: () => ({ queryKey: ["profile"], queryFn: () => mockReads.profile.data }),
}));
jest.mock("@/features/ai/provider-state", () => ({ useHasAIProvider: () => ({ hasAIProvider: false }) }));
jest.mock("@/features/documents/new-documents", () => ({
	useNewDocuments: { getState: () => ({ markNew: jest.fn() }) },
}));
// The gallery draws pages with the native renderer; here it is two plain choices.
jest.mock("./template-choice", () => {
	const { Pressable, Text } = jest.requireActual("react-native");
	return {
		TemplateChoice: ({ value, onChange }: { value: string; onChange: (template: string) => void }) => (
			<>
				<Text>{`Chosen: ${value}`}</Text>
				<Pressable accessibilityRole="button" onPress={() => onChange("meridian")}>
					<Text>Meridian</Text>
				</Pressable>
			</>
		),
	};
});
jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));

const profile = { data: emptyProfileData(), updatedAt: null };
const preferences = { targetRoles: [], locations: [], maxOfficeDays: null };
const status = {
	linkedin: false,
	github: true,
	website: true,
	account: { name: "Ayu Pratiwi", email: "ayu@example.test", image: null, githubUsername: null, providers: [] },
};
const found = (): SourceResult => {
	const data = emptyProfileData();
	data.basics.name = "Ayu Pratiwi";
	data.sections.projects = [
		{
			id: "p1",
			hidden: false,
			name: "ledger",
			period: "",
			website: { url: "", label: "", inlineLink: false },
			description: "",
			options: { showLinkInTitle: false },
		} as never,
	];
	return { data, photoUrl: null, notes: [] };
};

const orpcError = (code: string) => Object.assign(new Error(code), { name: "ORPCError", code });

beforeEach(() => {
	jest.clearAllMocks();
	Storage.removeItemSync(`onboarding:${SCOPE}`);
	mockReads.profile = read(profile);
	mockReads.preferences = read(preferences);
	mockReads.status = read(status);
	mockApi.update.mockImplementation(async ({ data }: { data: unknown }) => ({ data, updatedAt: new Date() }));
	mockApi.saveProfile.mockImplementation(async (value: unknown) => value);
	mockApi.create.mockResolvedValue("resume-1");
});

describe("OnboardingScreen", () => {
	it("goes from a GitHub account to a first resume: read, two questions, review, template", async () => {
		mockApi.github.mockResolvedValue(found());
		await renderScreen(<OnboardingScreen />);
		expect(screen.getByText("Bring what you have")).toBeOnTheScreen();
		expect(screen.getByText("Ayu Pratiwi")).toBeOnTheScreen();

		await fireEvent.changeText(screen.getByTestId("source-github"), "ayu-dev");
		await fireEvent.press(screen.getByTestId("onboarding-continue"));
		expect(mockApi.github).toHaveBeenCalledWith({ username: "ayu-dev" });
		expect(await screen.findByText("While we read your details")).toBeOnTheScreen();
		expect(await screen.findByText(/^Found: /)).toBeOnTheScreen();

		await fireEvent.changeText(screen.getByTestId("question-roles"), "Data analyst,");
		await fireEvent.press(await screen.findByText("Review what we found"));
		expect(mockApi.saveProfile).toHaveBeenCalledWith(expect.objectContaining({ targetRoles: ["Data analyst"] }));

		expect(await screen.findByText("Check what we found")).toBeOnTheScreen();
		expect(screen.getByText("ledger")).toBeOnTheScreen();
		await fireEvent.press(screen.getByText("Save to my Profile"));
		await waitFor(() => expect(mockApi.update).toHaveBeenCalled());
		const saved = mockApi.update.mock.calls[0]?.[0] as { data: ReturnType<typeof emptyProfileData> };
		expect(saved.data.sections.projects.map((project) => project.name)).toEqual(["ledger"]);

		expect(await screen.findByText("Pick a look for your first resume")).toBeOnTheScreen();
		await fireEvent.press(screen.getByText("Meridian"));
		await fireEvent.press(screen.getByTestId("onboarding-create"));
		await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/builder/resume-1/write"));
		expect(mockApi.create).toHaveBeenCalledWith(
			expect.objectContaining({ template: "meridian", withSampleData: false }),
		);
		// Finished: nothing is kept to pick up again.
		expect(Storage.getItemSync(`onboarding:${SCOPE}`)).toBeNull();
	});

	it("says why a source failed, offers Retry only when it can help, and still goes on", async () => {
		mockApi.github.mockRejectedValueOnce(orpcError("SOURCE_NOT_FOUND"));
		mockApi.website.mockRejectedValueOnce(new TypeError("Network request failed")).mockResolvedValue(found());
		await renderScreen(<OnboardingScreen />);
		await fireEvent.changeText(screen.getByTestId("source-github"), "nobody");
		await fireEvent.changeText(screen.getByTestId("source-website"), "ayu.design");
		await fireEvent.press(screen.getByTestId("onboarding-continue"));

		expect(await screen.findByText("There's no GitHub account with that username.")).toBeOnTheScreen();
		expect(await screen.findByText("You seem to be offline. Check your connection and try again.")).toBeOnTheScreen();
		expect(screen.queryByTestId("retry-github")).toBeNull();
		await fireEvent.press(screen.getByTestId("retry-website"));
		expect(await screen.findByText(/^Found: /)).toBeOnTheScreen();
		expect(mockApi.website).toHaveBeenCalledTimes(2);
	});

	it("points out a field that can't run before reading anything", async () => {
		await renderScreen(<OnboardingScreen />);
		await fireEvent.changeText(screen.getByTestId("source-website"), "not a site");
		await fireEvent.press(screen.getByTestId("onboarding-continue"));
		expect(screen.getByText("Enter your site's address, like yourname.com.")).toBeOnTheScreen();
		expect(mockApi.website).not.toHaveBeenCalled();
		expect(screen.getByText("Bring what you have")).toBeOnTheScreen();
	});

	it("starts from scratch: no review, the Profile saved before the first resume", async () => {
		await renderScreen(<OnboardingScreen />);
		await fireEvent.press(screen.getByTestId("onboarding-scratch"));
		expect(screen.getByText("Two quick questions")).toBeOnTheScreen();
		await fireEvent.press(screen.getByTestId("onboarding-continue"));
		expect(await screen.findByText("Pick a look for your first resume")).toBeOnTheScreen();
		expect(mockApi.update).toHaveBeenCalledWith({ data: profile.data, expectedUpdatedAt: null });
		await fireEvent.press(screen.getByTestId("onboarding-back"));
		expect(screen.getByText("Two quick questions")).toBeOnTheScreen();
	});

	it("skips by saving the Profile as it stands, so it doesn't open again", async () => {
		await renderScreen(<OnboardingScreen />);
		await fireEvent.press(screen.getByTestId("onboarding-skip"));
		await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
		expect(mockApi.update).toHaveBeenCalledWith({ data: profile.data, expectedUpdatedAt: null });
	});

	it("stays when Skip can't save, and says so", async () => {
		mockApi.update.mockRejectedValueOnce(new TypeError("Network request failed"));
		await renderScreen(<OnboardingScreen />);
		await fireEvent.press(screen.getByTestId("onboarding-skip"));
		await waitFor(() => expect(mockApi.update).toHaveBeenCalled());
		expect(mockRouter.back).not.toHaveBeenCalled();
		expect(screen.getByText("Bring what you have")).toBeOnTheScreen();
	});

	it("offers Retry when the details can't load", async () => {
		mockReads.profile = read(undefined, true);
		await renderScreen(<OnboardingScreen />);
		expect(screen.getByText("Couldn't load your details")).toBeOnTheScreen();
		await fireEvent.press(screen.getByText("Try again"));
		expect(mockReads.profile.refetch).toHaveBeenCalled();
	});

	it("still offers GitHub when the sources' status can't be read", async () => {
		mockReads.status = read(undefined, true);
		await renderScreen(<OnboardingScreen />);
		expect(screen.getByTestId("source-github")).toBeOnTheScreen();
		expect(screen.queryByTestId("source-website")).toBeNull();
	});

	it("picks up where the app was closed, with what the sources found", async () => {
		storeSavedOnboarding(Storage, SCOPE, {
			step: "review",
			inputs: { linkedin: "", linkedinOwn: false, github: "ayu-dev", website: "" },
			answers: { targetRoles: ["Data analyst"], locations: [], maxOfficeDays: null },
			runs: { github: { status: "done", key: "ayu-dev", result: found() } },
			excluded: [],
			template: "meridian",
			savedAt: null,
		});
		await renderScreen(<OnboardingScreen />);
		expect(screen.getByText("Check what we found")).toBeOnTheScreen();
		expect(screen.getByText("ledger")).toBeOnTheScreen();
		expect(mockApi.github).not.toHaveBeenCalled();
	});
});
