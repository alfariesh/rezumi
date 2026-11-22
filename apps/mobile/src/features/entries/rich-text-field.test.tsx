// The one rich-text field for resume text and letters: each use gets its own toolbar (resume: link, text style and
// Improve; letter: underline and lists), tells the draft about focus, and Improve replaces only the asked line.
import type { RichTextTools } from "./rich-text-field";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { RichTextField, RichTextToolbar } from "./rich-text-field";
import { renderScreen } from "@/test/render-screen";

const mockEditor = {
	props: null as Record<string, (event: unknown) => void> | null,
	html: "<html><p>Led a team</p></html>",
	commands: [] as string[],
	record: (props: Record<string, (event: unknown) => void>) => {
		mockEditor.props = props;
	},
};

jest.mock("react-native-enriched-html", () => {
	const { forwardRef, useImperativeHandle } = require("react");
	const command = (name: string) => () => mockEditor.commands.push(name);
	return {
		EnrichedTextInput: forwardRef((props: Record<string, (event: unknown) => void>, ref: unknown) => {
			mockEditor.record(props);
			useImperativeHandle(ref, () => ({
				getHTML: async () => mockEditor.html,
				setValue: (value: string) => mockEditor.commands.push(`set:${value}`),
				focus: command("focus"),
				blur: command("blur"),
				toggleBold: command("bold"),
				toggleUnderline: command("underline"),
			}));
			return null;
		}),
	};
});

const mockImprove = jest.fn();
jest.mock("@/api/client", () => ({
	orpc: { ai: { improve: { mutationOptions: () => ({ mutationFn: (input: unknown) => mockImprove(input) }) } } },
}));
jest.mock("@/features/ai/providers", () => ({
	useHasAIProvider: () => ({ hasAIProvider: true, isLoading: false, error: null, retry: () => undefined }),
	AIProviderSetupSheet: () => null,
}));

const focusMarks = { onFocus: jest.fn(), onBlur: jest.fn() };

async function renderField(tools: RichTextTools, onChange = jest.fn()) {
	await renderScreen(
		<>
			<RichTextField
				label="Description"
				value="<p>Led a team</p>"
				tools={tools}
				focus={focusMarks}
				onChange={onChange}
			/>
			<RichTextToolbar />
		</>,
	);
	return onChange;
}

async function focusOnText(text: string) {
	await act(async () => {
		mockEditor.props?.onChangeText?.({ nativeEvent: { value: text } });
		mockEditor.props?.onFocus?.({});
	});
}

beforeEach(() => {
	jest.clearAllMocks();
	mockEditor.commands = [];
});

describe("RichTextField", () => {
	it("gives resume text the full toolbar and tells the draft about focus", async () => {
		await renderField("resume");
		await focusOnText("Led a team");
		expect(focusMarks.onFocus).toHaveBeenCalled();
		expect(screen.getByLabelText("Link")).toBeOnTheScreen();
		expect(screen.getByLabelText("Text style")).toBeOnTheScreen();
		expect(screen.getByLabelText("Improve selected line")).toBeOnTheScreen();
		expect(screen.queryByLabelText("Underline")).toBeNull();
		await act(async () => mockEditor.props?.onBlur?.({}));
		expect(focusMarks.onBlur).toHaveBeenCalled();
		expect(screen.queryByLabelText("Formatting")).toBeNull();
	});

	it("keeps the letter toolbar: bold, italic, underline and lists, no link or Improve", async () => {
		await renderField("letter");
		await focusOnText("Dear team");
		expect(screen.getByLabelText("Underline")).toBeOnTheScreen();
		expect(screen.getByLabelText("Numbered list")).toBeOnTheScreen();
		expect(screen.queryByLabelText("Link")).toBeNull();
		expect(screen.queryByLabelText("Improve selected line")).toBeNull();
		await fireEvent.press(screen.getByLabelText("Underline"));
		expect(mockEditor.commands).toContain("underline");
	});

	it("improves the line at the caret and replaces only it", async () => {
		mockImprove.mockResolvedValue({ text: "Led a team of six", why: "Adds scale.", addsFacts: true });
		const onChange = await renderField("resume");
		await focusOnText("Led a team");
		await fireEvent.press(screen.getByTestId("toolbar-improve"));
		expect(screen.getByTestId("improve-panel")).toBeOnTheScreen();
		await fireEvent.press(screen.getByText("Stronger verb"));
		expect(mockImprove).toHaveBeenCalledWith(
			expect.objectContaining({ action: "verb", line: "Led a team", where: "Description" }),
		);
		await fireEvent.press(await screen.findByTestId("improve-replace"));
		expect(onChange).toHaveBeenCalledWith("<p>Led a team of six</p>");
		expect(screen.queryByTestId("improve-panel")).toBeNull();
	});

	it("doesn't replace a line that changed since Improve was asked", async () => {
		mockImprove.mockResolvedValue({ text: "Led a team of six", why: "Adds scale.", addsFacts: false });
		const onChange = await renderField("resume");
		await focusOnText("Led a team");
		await fireEvent.press(screen.getByTestId("toolbar-improve"));
		await fireEvent.press(screen.getByText("Stronger verb"));
		mockEditor.html = "<html><p>Ran the studio</p></html>";
		await fireEvent.press(await screen.findByTestId("improve-replace"));
		expect(onChange).not.toHaveBeenCalledWith(expect.stringContaining("six"));
		expect(screen.getByText("The line changed since you asked, so it wasn't replaced.")).toBeOnTheScreen();
		mockEditor.html = "<html><p>Led a team</p></html>";
	});
});
