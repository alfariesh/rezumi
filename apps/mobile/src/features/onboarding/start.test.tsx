// When onboarding opens, what the intro does, and how a picked file is told apart. Reads and storage are replaced.
import type { KeyValueStorage } from "./saved-run";
import { fireEvent, screen } from "@testing-library/react-native";
import { emptyProfileData } from "@rezumi/schema/profile/data";
import { IntroScreen } from "./intro-screen";
import { introSeen } from "./intro-seen";
import { shouldStartOnboarding } from "./queries";
import { fileKind } from "./read-file";
import { storeSavedOnboarding } from "./saved-run";
import { renderScreen } from "@/test/render-screen";

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock("@/auth/session", () => ({ useSession: () => ({ status: "signed-in", server: "https://rezumi.app" }) }));
jest.mock("@/api/client", () => {
	const key = (name: string) => ({ key: () => [name], queryOptions: () => ({ queryKey: [name] }) });
	return {
		client: {},
		rest: jest.fn(),
		orpc: {
			profile: { get: key("profile"), sources: { status: key("status") } },
			career: { profile: key("preferences") },
			documents: { list: key("documents") },
		},
	};
});
jest.mock("expo-file-system", () => ({ File: jest.fn() }));

const memory = (): KeyValueStorage => {
	const map = new Map<string, string>();
	return {
		getItemSync: (key) => map.get(key) ?? null,
		setItemSync: (key, value) => void map.set(key, value),
		removeItemSync: (key) => void map.delete(key),
	};
};

type Reads = { profile: unknown; documents: unknown; status?: unknown };
const clientWith = (reads: Reads) =>
	({
		ensureQueryData: jest.fn(async ({ queryKey }: { queryKey: string[] }) => {
			const value = reads[queryKey[0] as keyof Reads];
			if (value instanceof Error) throw value;
			return value;
		}),
	}) as never;

const account = { website: true };
const guest = { website: false };

describe("when Home hands over to onboarding", () => {
	it("opens for a new account, never for a guest, a saved Profile or an account with documents", async () => {
		const start = (reads: Reads) => shouldStartOnboarding(clientWith(reads), "s", "scope", memory());
		expect(await start({ profile: { updatedAt: null }, documents: [], status: account })).toBe(true);
		expect(await start({ profile: { updatedAt: null }, documents: [], status: guest })).toBe(false);
		expect(await start({ profile: { updatedAt: new Date() }, documents: [] })).toBe(false);
		expect(await start({ profile: { updatedAt: null }, documents: [{ id: "r1" }] })).toBe(false);
		expect(await start({ profile: new Error("offline"), documents: [] })).toBe(false);
		expect(await shouldStartOnboarding(clientWith({ profile: null, documents: [] }), "s", null, memory())).toBe(false);
	});

	it("picks up an onboarding left at the first resume, and drops it once a document exists", async () => {
		const storage = memory();
		storeSavedOnboarding(storage, "scope", {
			step: "resume",
			inputs: { linkedin: "", linkedinOwn: false, github: "", website: "" },
			answers: { targetRoles: [], locations: [], maxOfficeDays: null },
			runs: {},
			excluded: [],
			template: "meridian",
			savedAt: new Date().toISOString(),
		});
		const saved = { profile: { updatedAt: new Date(), data: emptyProfileData() }, documents: [] };
		expect(await shouldStartOnboarding(clientWith(saved), "s", "scope", storage)).toBe(true);
		expect(
			await shouldStartOnboarding(clientWith({ ...saved, documents: [{ id: "r1" }] }), "s", "scope", storage),
		).toBe(false);
		expect(await shouldStartOnboarding(clientWith(saved), "s", "scope", storage)).toBe(false);
	});
});

describe("IntroScreen", () => {
	beforeEach(() => mockReplace.mockClear());

	it("walks three pages to Get started, then Welcome, once per install", async () => {
		await renderScreen(<IntroScreen />);
		expect(screen.getByText("A resume in minutes")).toBeOnTheScreen();
		expect(screen.getByLabelText("Page 1 of 3: A resume in minutes")).toBeSelected();
		await fireEvent.press(screen.getByTestId("intro-next"));
		await fireEvent.press(screen.getByTestId("intro-next"));
		expect(screen.getByLabelText("Page 3 of 3: A portfolio and a coach")).toBeSelected();
		expect(screen.getByText("Get started")).toBeOnTheScreen();
		await fireEvent.press(screen.getByTestId("intro-next"));
		expect(mockReplace).toHaveBeenCalledWith("/sign-in");
		expect(introSeen()).toBe(true);
	});

	it("skips from any page", async () => {
		await renderScreen(<IntroScreen />);
		await fireEvent.press(screen.getByTestId("intro-skip"));
		expect(mockReplace).toHaveBeenCalledWith("/sign-in");
	});
});

describe("picked files", () => {
	it("tells PDF, Word, old Word, LinkedIn exports and JSON apart by name or type", () => {
		expect(fileKind({ name: "CV.PDF" })).toBe("pdf");
		expect(fileKind({ name: "cv", mimeType: "application/pdf" })).toBe("pdf");
		expect(fileKind({ name: "cv.docx" })).toBe("docx");
		expect(fileKind({ name: "cv.doc" })).toBe("doc");
		expect(fileKind({ name: "Basic_LinkedInDataExport.zip" })).toBe("zip");
		expect(fileKind({ name: "resume.json" })).toBe("json");
	});
});
