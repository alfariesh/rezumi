import { fireEvent, screen } from "@testing-library/react-native";
import { SearchScreen } from "./search-screen";
import { renderScreen } from "@/test/render-screen";

const mockDismissTo = jest.fn();
const mockDate = new Date("2026-11-01");
jest.mock("expo-router", () => ({ useRouter: () => ({ dismissTo: mockDismissTo }) }));
jest.mock("@/shell/key-commands", () => ({ useKeyCommands: () => undefined }));
jest.mock("@/shell/account-menu", () => ({ useAccountLinks: () => [] }));
jest.mock("@/features/home/queries", () => ({ usePortfolioEnabled: () => false }));
jest.mock("@/features/documents/queries", () => ({
	useDocuments: () => ({
		data: [
			{ type: "resume", id: "resume", name: "Designer resume", slug: "design", tags: [], updatedAt: mockDate },
			{ type: "letter", id: "letter", name: "Northstar letter", slug: "letter", tags: [], updatedAt: mockDate },
		],
	}),
}));
jest.mock("@/features/applications/queries", () => ({
	useApplications: () => ({ data: [{ id: "job", company: "Northstar", role: "Engineer", updatedAt: mockDate }] }),
}));
jest.mock("@/features/assistant/chat", () => ({
	useThreads: () => ({
		data: [{ id: "thread", title: "Northstar coaching", scope: "career", lastMessageAt: mockDate }],
	}),
}));

it("finds matching documents, applications and Coach conversations from one field", async () => {
	await renderScreen(<SearchScreen />);
	const field = screen.getByTestId("global-search-input");
	await fireEvent.changeText(field, "northstar");
	expect(screen.getByText("Northstar letter")).toBeOnTheScreen();
	expect(screen.getByText("Northstar")).toBeOnTheScreen();
	await fireEvent.press(screen.getByRole("button", { name: "Northstar coaching, Coach" }));
	expect(mockDismissTo).toHaveBeenLastCalledWith("/coach?thread=thread");
	await fireEvent.changeText(field, "designer");
	await fireEvent.press(screen.getByRole("button", { name: "Designer resume" }));
	expect(mockDismissTo).toHaveBeenLastCalledWith("/builder/resume/write");
});

it("opens a draft question for Coach without running the question", async () => {
	await renderScreen(<SearchScreen />);
	await fireEvent.changeText(screen.getByTestId("global-search-input"), "What next?");
	await fireEvent.press(screen.getByRole("button", { name: "Ask Coach “What next?”" }));
	expect(mockDismissTo).toHaveBeenLastCalledWith("/coach?question=What%20next%3F");
});
