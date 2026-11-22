import { fireEvent, screen } from "@testing-library/react-native";
import { EditableTitle } from "./editable-title";
import { ModeBar } from "./mode-bar";
import { renderUi } from "./test-utils";

const items = [
	{ value: "write", label: "Write", icon: "pencil-simple" },
	{ value: "page", label: "Page", icon: "file-text" },
	{ value: "check", label: "Check", icon: "list-checks", badge: 3 },
] as const;

describe("ModeBar", () => {
	it("marks the picked mode, reads counts with the label and switches", async () => {
		const onValueChange = jest.fn();
		await renderUi(
			<ModeBar items={items} value="write" onValueChange={onValueChange} accessibilityLabel="Editor mode" />,
		);

		expect(screen.getByRole("tab", { name: "Write" }).props.accessibilityState).toEqual({ selected: true });
		expect(screen.getByRole("tab", { name: "Check, 3" })).toBeTruthy();

		await fireEvent.press(screen.getByRole("tab", { name: "Page" }));
		expect(onValueChange).toHaveBeenCalledWith("page");

		onValueChange.mockClear();
		await fireEvent.press(screen.getByRole("tab", { name: "Write" }));
		expect(onValueChange).not.toHaveBeenCalled();
	});

	it("reads the caller's translated count label, and no count at zero", async () => {
		await renderUi(
			<ModeBar
				items={[
					{ value: "check", label: "Periksa", icon: "list-checks", badge: 2, badgeLabel: "Periksa, 2 masalah" },
					{ value: "share", label: "Bagikan", icon: "globe", badge: 0, badgeLabel: "Bagikan, 0" },
				]}
				value="check"
				onValueChange={jest.fn()}
				accessibilityLabel="Mode editor"
			/>,
		);

		expect(screen.getByRole("tab", { name: "Periksa, 2 masalah" })).toBeTruthy();
		expect(screen.getByRole("tab", { name: "Bagikan" })).toBeTruthy();
	});
});

describe("EditableTitle", () => {
	it("renames in place and ignores empty or unchanged names", async () => {
		const onSubmit = jest.fn();
		await renderUi(<EditableTitle value="My resume" onSubmit={onSubmit} accessibilityLabel="Document name" />);

		await fireEvent.press(screen.getByRole("button", { name: "Document name: My resume" }));
		const input = screen.getByTestId("editable-title-input");
		await fireEvent.changeText(input, "  ");
		await fireEvent(input, "submitEditing");
		expect(onSubmit).not.toHaveBeenCalled();

		await fireEvent.press(screen.getByRole("button", { name: "Document name: My resume" }));
		await fireEvent.changeText(screen.getByTestId("editable-title-input"), " Designer CV ");
		await fireEvent(screen.getByTestId("editable-title-input"), "submitEditing");
		expect(onSubmit).toHaveBeenCalledWith("Designer CV");
	});

	it("shows a locked name without the button", async () => {
		await renderUi(<EditableTitle value="Locked" onSubmit={jest.fn()} accessibilityLabel="Document name" isDisabled />);
		expect(screen.queryByRole("button")).toBeNull();
	});
});
