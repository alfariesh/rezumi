// One entry full screen, pointed at the Profile (plans/mobile Phase 06): fields write through the source, moving and
// deleting work, and a deleted entry says so. The rich-text editor is a native view, replaced by a stand-in.
import type { ProfileData } from "@rezumi/schema/profile/data";
import { fireEvent, screen } from "@testing-library/react-native";
import { QueryClient } from "@tanstack/react-query";
import { emptyProfileData } from "@rezumi/schema/profile/data";
import { EntryEditor } from "./entry-editor";
import { WriteSourceProvider } from "./source";
import { profileWriteSource } from "@/features/profile/source";
import { closeProfile, openProfile, useProfileEditor } from "@/features/profile/store";
import { renderScreen } from "@/test/render-screen";

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true };

jest.mock("expo-router", () => ({ useRouter: () => mockRouter, Stack: { Screen: () => null } }));
jest.mock("react-native-enriched-html", () => {
	const { forwardRef } = require("react");
	return { EnrichedTextInput: forwardRef(() => null) };
});
jest.mock("@/auth/session", () => ({
	useSession: () => ({ status: "signed-in", server: "https://rezumi.app" }),
	getServer: () => "https://rezumi.app",
}));
jest.mock("@/api/client", () => ({
	client: { profile: { get: jest.fn(), update: () => new Promise(() => undefined) } },
	rest: jest.fn(),
	orpc: { documents: { key: () => ["documents"] } },
}));
jest.mock("@/features/onboarding/queries", () => ({
	profileQuery: (server: string) => ({ queryKey: ["profile", server] }),
	storeSavedProfile: jest.fn(),
}));

const entry = (id: string, company: string) =>
	({
		id,
		hidden: false,
		company,
		position: "",
		location: "",
		period: "",
		dates: { start: null, end: null, present: false },
		website: { url: "", label: "", inlineLink: false },
		description: "",
		roles: [],
	}) as never;

function open() {
	const data: ProfileData = emptyProfileData();
	data.sections.experience.push(entry("a", "Nusantara Labs"), entry("b", "Kopi Studio"));
	openProfile({ data, updatedAt: null }, "https://rezumi.app", new QueryClient());
}

const render = (entryId: string) =>
	renderScreen(
		<WriteSourceProvider source={profileWriteSource}>
			<EntryEditor sectionId="experience" entryId={entryId} />
		</WriteSourceProvider>,
	);

const companies = () => useProfileEditor.getState().data?.sections.experience.items.map((item) => item.company);

beforeEach(() => {
	jest.clearAllMocks();
	closeProfile();
	open();
});

describe("EntryEditor", () => {
	it("writes a field to the source", async () => {
		await render("a");
		await fireEvent.changeText(screen.getByTestId("entry-position"), "Product designer");
		expect(useProfileEditor.getState().data?.sections.experience.items[0]?.position).toBe("Product designer");
	});

	it("moves an entry down", async () => {
		await render("a");
		await fireEvent.press(screen.getByText("Move down"));
		expect(companies()).toEqual(["Kopi Studio", "Nusantara Labs"]);
	});

	it("deletes an entry and goes back", async () => {
		await render("b");
		await fireEvent.press(screen.getByTestId("entry-delete"));
		expect(mockRouter.back).toHaveBeenCalled();
		expect(companies()).toEqual(["Nusantara Labs"]);
	});

	it("says when the entry no longer exists", async () => {
		await render("gone");
		expect(screen.getByText("This entry was deleted")).toBeOnTheScreen();
	});
});
