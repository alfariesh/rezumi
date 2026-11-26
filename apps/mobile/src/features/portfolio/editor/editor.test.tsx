import type { Portfolio } from "../queries";
import type { PortfolioBlock } from "@rezumi/schema/portfolio/blocks";
import { fireEvent, screen } from "@testing-library/react-native";
import { useEffect as mockUseEffect, useState } from "react";
import { newWork } from "@rezumi/portfolio/editing";
import { parsePortfolioData } from "@rezumi/schema/portfolio/data";
import { defaultResumeData } from "@rezumi/schema/resume/default";
import { Blocks } from "./blocks";
import { EditorProvider, useEditor } from "./store";
import { WorkPane } from "./work";
import { renderScreen } from "@/test/render-screen";

const mockLink = jest.fn();
const mockImportWorks = jest.fn();
const mockResume = jest.fn();
const mockPdf = jest.fn();
const mockUpload = jest.fn();
const mockPicker = jest.fn();
const mockToast = jest.fn();
const mockPicture = { key: "uploads/user/pictures/portfolio/cover.jpg", alt: "Book cover", width: 1200, height: 800 };

jest.mock("./media", () => ({
	MediaError: class extends Error {},
	blockFromLink: (...args: unknown[]) => mockLink(...args),
	pickPdf: () => mockPdf(),
	pickPictures: (...args: unknown[]) => mockPicker(...args),
	uploadPicture: (...args: unknown[]) => mockUpload(...args),
}));
jest.mock("@/api/client", () => ({
	client: {
		portfolio: {
			get: jest.fn(),
			update: jest.fn(),
			importWorks: (...args: unknown[]) => mockImportWorks(...args),
		},
		agent: { messages: { setEditStatus: jest.fn() } },
	},
	orpc: {
		portfolio: { get: { key: () => ["portfolio"], queryOptions: () => ({ queryKey: ["portfolio"] }) } },
		resume: { getById: { queryOptions: () => ({ queryKey: ["resume"], queryFn: () => mockResume() }) } },
		profile: { get: { queryOptions: () => ({ queryKey: ["profile"], queryFn: async () => null }) } },
	},
}));
jest.mock("react-native-reorderable-list", () => require("@/ui/reorderable-list.mock"));
jest.mock("expo-web-browser", () => ({}));
jest.mock("@/api/online", () => ({ useOnline: () => true }));
jest.mock("@/auth/session", () => ({
	getAccountScope: () => "test-account",
	getCredentials: () => Promise.resolve({ scope: "test-account", server: "https://example.test", accessToken: null }),
}));
jest.mock("@/features/entries/rich-text-field", () => ({ RichTextField: () => null, RichTextToolbar: () => null }));
jest.mock("expo-image", () => ({ Image: () => null }));
jest.mock("@/ui/toast", () => ({ showToast: (...args: unknown[]) => mockToast(...args) }));
jest.mock("@/ui/sheet", () => ({
	Sheet: function MockSheet({
		isOpen,
		children,
		onDidDismiss,
	}: {
		isOpen: boolean;
		children: React.ReactNode;
		onDidDismiss?: () => void;
	}) {
		mockUseEffect(() => {
			if (!isOpen) onDidDismiss?.();
		}, [isOpen, onDidDismiss]);
		return isOpen ? children : null;
	},
}));

const initial = () => {
	const data = parsePortfolioData({});
	data.works.items.push(newWork(data, "Book design"));
	return {
		id: "portfolio",
		data,
		updatedAt: new Date(1),
		createdAt: new Date(1),
		sourceResumeId: null,
		sourceResume: null,
		isPublic: false,
		showInSearchEngines: false,
		publishedAt: null,
		suspendedAt: null,
		suspendedReason: null,
		hasPassword: false,
	} satisfies Portfolio;
};

function WorkBlocks() {
	const { store } = useEditor();
	const work = store((state) => state.portfolio?.data.works.items[0]);
	return work ? <Blocks work={work} /> : null;
}

async function openBlocks() {
	await renderScreen(
		<EditorProvider portfolio={initial()} scope="test-account">
			<WorkBlocks />
		</EditorProvider>,
	);
	await fireEvent.press(await screen.findByTestId("portfolio-add-block"));
}

it("adds a text block and a metric block", async () => {
	await openBlocks();
	await fireEvent.press(screen.getByText("Text"));
	expect(screen.getByText("Text")).toBeOnTheScreen();
	await fireEvent.press(screen.getByTestId("portfolio-add-block"));
	await fireEvent.press(screen.getByText("Metrics"));
	expect(screen.getByLabelText("Metric label")).toBeOnTheScreen();
});

it.each([
	["Video", { id: "video", type: "video", provider: "youtube", videoId: "dQw4w9WgXcQ", title: "Sample video" }],
	["Embed", { id: "embed", type: "embed", provider: "figma", ref: "id", title: "Prototype" }],
	["Link", { id: "link", type: "link", url: "https://example.com", title: "Example" }],
] satisfies [string, PortfolioBlock][])("adds a %s block from a URL", async (label, block) => {
	mockLink.mockResolvedValueOnce({ block, url: "https://example.com" });
	await openBlocks();
	await fireEvent.press(screen.getByText(label));
	await fireEvent.changeText(screen.getByLabelText("URL"), "https://example.com");
	await fireEvent.press(screen.getByTestId("portfolio-submit-block-link"));
	expect(await screen.findByDisplayValue(block.title ?? "")).toBeOnTheScreen();
});

it("adds a PDF block with a first-page picture", async () => {
	mockPdf.mockResolvedValueOnce({
		id: "pdf",
		type: "pdf",
		file: "uploads/user/documents/portfolio/guide.pdf",
		pages: 3,
		title: "Project guide",
		preview: mockPicture,
	});
	await openBlocks();
	await fireEvent.press(screen.getByText("PDF"));
	expect(await screen.findByDisplayValue("Project guide")).toBeOnTheScreen();
	expect(screen.getByText("Pages: 3")).toBeOnTheScreen();
});

it("backs out of a failed upload and adds a gallery picture on retry", async () => {
	mockPicker.mockResolvedValue([{ uri: "file:///photo.jpg", width: 1200, height: 800 }]);
	mockUpload.mockRejectedValueOnce(new Error("Upload failed")).mockResolvedValueOnce(mockPicture);
	await openBlocks();
	await fireEvent.press(screen.getByText("Pictures"));
	const openPicturePicker = () => fireEvent.press(screen.getByRole("button", { name: "Add pictures to this work" }));
	await openPicturePicker();
	await fireEvent.press(screen.getByText("Choose from photo library"));
	expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Couldn't upload this picture." }));
	expect(screen.queryByDisplayValue(mockPicture.alt)).toBeNull();
	await openPicturePicker();
	await fireEvent.press(screen.getByText("Choose from photo library"));
	expect(await screen.findByDisplayValue(mockPicture.alt)).toBeOnTheScreen();
});

function WorkFixture() {
	const { store } = useEditor();
	const portfolio = store((state) => state.portfolio);
	const [id, setId] = useState<string | null>(null);
	return portfolio ? <WorkPane portfolio={portfolio} limit={4} workId={id} onOpen={setId} /> : null;
}

async function openWorkMenu(portfolio: Portfolio = initial()) {
	await renderScreen(
		<EditorProvider portfolio={portfolio} scope="test-account">
			<WorkFixture />
		</EditorProvider>,
	);
	await fireEvent.press(await screen.findByTestId("portfolio-add-work"));
}

it("opens a blank work for editing", async () => {
	await openWorkMenu();
	await fireEvent.press(screen.getByText("Start with a blank work"));
	expect(await screen.findByTestId("portfolio-work-title")).toHaveDisplayValue("");
});

it("uses a pasted link to make a titled work", async () => {
	mockLink.mockResolvedValueOnce({
		block: { id: "block", type: "link", url: "https://example.com", title: "Design notes" },
		url: "https://example.com",
	});
	await openWorkMenu();
	await fireEvent.press(screen.getByText("Paste a link"));
	await fireEvent.changeText(screen.getByLabelText("URL"), "https://example.com");
	await fireEvent.press(screen.getByText("Create work from link"));
	expect(await screen.findByTestId("portfolio-work-title")).toHaveDisplayValue("Design notes");
});

it("can open a work made from several photos", async () => {
	mockPicker.mockResolvedValueOnce([
		{ uri: "file:///a.jpg", width: 1200, height: 800 },
		{ uri: "file:///b.jpg", width: 1200, height: 800 },
	]);
	mockUpload
		.mockResolvedValueOnce(mockPicture)
		.mockResolvedValueOnce({ ...mockPicture, key: "uploads/user/pictures/portfolio/second.jpg" });
	await openWorkMenu();
	await fireEvent.press(screen.getByText("Start from pictures"));
	await fireEvent.press(screen.getByText("Choose from photo library"));
	expect(await screen.findByTestId("portfolio-work-title")).toHaveDisplayValue("New work");
	expect(screen.getAllByLabelText("Caption")).toHaveLength(2);
});

it("uses the current version when importing a resume project", async () => {
	const portfolio: Portfolio = { ...initial(), sourceResumeId: "resume" };
	const project = { id: "project", name: "Library catalogue" };
	const imported = { ...newWork(portfolio.data, project.name), fromResumeItemId: project.id };
	mockResume.mockResolvedValueOnce({
		data: { ...defaultResumeData, sections: { ...defaultResumeData.sections, projects: { items: [project] } } },
	});
	mockImportWorks.mockResolvedValueOnce({
		...portfolio,
		data: { ...portfolio.data, works: { items: [...portfolio.data.works.items, imported] } },
		updatedAt: new Date(2),
	});
	await openWorkMenu(portfolio);
	await fireEvent.press(screen.getByText("Import from projects"));
	await fireEvent.press(await screen.findByText("Library catalogue"));
	expect(mockImportWorks).toHaveBeenCalledWith(
		{ resumeItemIds: [project.id], expectedUpdatedAt: portfolio.updatedAt },
		{ context: { scope: "test-account" } },
	);
	expect(await screen.findByTestId("portfolio-work-title")).toHaveDisplayValue(project.name);
});
