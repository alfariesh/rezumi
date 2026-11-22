// Share's web page settings (plans/mobile Phase 08): what the short link opens (the primary resume, another resume, or
// the published portfolio), saving a switch, and everything that needs the server off while offline.
import type { ResumeDocument } from "@/draft/types";
import { fireEvent, screen } from "@testing-library/react-native";
import { WebPageSettings } from "./web-page";
import { renderScreen } from "@/test/render-screen";

const mockData: { resumes: unknown; portfolio: unknown } = {
	resumes: [],
	portfolio: { enabled: false, portfolio: null },
};

function mockQuery(key: string, read: () => unknown) {
	return {
		queryOptions: () => ({ queryKey: [key], queryFn: () => Promise.resolve(read()) }),
		queryKey: () => [key],
	};
}

jest.mock("@/api/client", () => ({
	client: { resume: {} },
	orpc: {
		resume: { list: mockQuery("resumes", () => mockData.resumes) },
		portfolio: { status: mockQuery("portfolio", () => mockData.portfolio) },
	},
}));
jest.mock("@/draft", () => ({ useResumeStore: () => jest.fn() }));
jest.mock("@/draft/runtime", () => ({ resume: { refresh: jest.fn() } }));
jest.mock("./document", () => ({ flushResume: jest.fn() }));
jest.mock("./custom-domain", () => ({
	CustomDomain: () => null,
	ShareNotice: ({ children }: { children: unknown }) => children,
}));

const resume = (overrides: Partial<ResumeDocument> = {}) =>
	({
		id: "resume-1",
		name: "Product designer",
		slug: "product-designer",
		isPublic: true,
		isPrimary: true,
		isLocked: false,
		hasPassword: false,
		hideContactDetails: false,
		showInSearchEngines: false,
		showDownloadButtons: true,
		data: { metadata: { web: { showCredit: true } } },
		...overrides,
	}) as unknown as ResumeDocument;

const operations = { busy: false, error: null, run: jest.fn(() => Promise.resolve(true)) };

const renderSettings = (document: ResumeDocument, offline = false, save = jest.fn(() => Promise.resolve(true))) =>
	renderScreen(
		<WebPageSettings
			resume={document}
			offline={offline}
			username="ada"
			origin="https://rezumi.app"
			flags={undefined}
			operations={operations as never}
			save={save}
		/>,
	);

beforeEach(() => {
	mockData.resumes = [];
	mockData.portfolio = { enabled: false, portfolio: null };
});

describe("WebPageSettings", () => {
	it("says the short link opens this resume when it's primary", async () => {
		await renderSettings(resume());
		expect(await screen.findByText("Your short link and custom domain open this resume.")).toBeOnTheScreen();
		expect(screen.getByText("rezumi.app/ada")).toBeOnTheScreen();
		expect(screen.getByText("Short link")).toBeOnTheScreen();
	});

	it("names the other primary resume", async () => {
		mockData.resumes = [{ id: "resume-2", name: "Researcher", isPrimary: true }];
		await renderSettings(resume({ isPrimary: false }));
		expect(await screen.findByText("Your short link and custom domain open “Researcher”.")).toBeOnTheScreen();
	});

	it("says the published portfolio holds the short link", async () => {
		mockData.portfolio = { enabled: true, portfolio: { isPublic: true, suspendedAt: null } };
		await renderSettings(resume({ isPrimary: false }));
		expect(
			await screen.findByText("Your published portfolio opens at your short link and custom domain."),
		).toBeOnTheScreen();
		expect(screen.getByText("Short link · opens your portfolio")).toBeOnTheScreen();
	});

	it("saves a privacy switch straight away", async () => {
		const save = jest.fn(() => Promise.resolve(true));
		await renderSettings(resume(), false, save);
		await fireEvent(screen.getByLabelText("Hide contact details"), "selectedChange", true);
		expect(save).toHaveBeenCalledWith({ hideContactDetails: true });
	});

	it("turns off what needs the server while offline", async () => {
		await renderSettings(resume(), true);
		// A row without its own press reads as disabled to the matchers, so the switch's own state is checked.
		const disabled = (label: string) => screen.getByLabelText(label).props.accessibilityState?.disabled;
		for (const label of [
			"Primary resume",
			"Require a password",
			"Hide contact details",
			"Visitors can download the PDF",
		])
			expect(disabled(label)).toBe(true);
		// The footer credit is part of the resume's data, so it still works offline and syncs later.
		expect(disabled("Show “Made with Rezumi”")).toBe(false);
		expect(screen.getByRole("button", { name: /Preview web page/ })).toBeDisabled();
	});
});
