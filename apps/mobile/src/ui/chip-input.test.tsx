import { fireEvent, screen } from "@testing-library/react-native";
import { useState } from "react";
import { addChips, ChipInput } from "./chip-input";
import { renderUi } from "./test-utils";

const consoleError = console.error;
beforeAll(() => {
	jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
		if (typeof args[0] === "string" && args[0].startsWith("[colorKit")) return;
		consoleError(...args);
	});
});
afterAll(() => jest.restoreAllMocks());

describe("addChips", () => {
	it("adds trimmed values once, split at commas, up to the limits", () => {
		expect(addChips(["Designer"], " UX writer , designer,")).toEqual(["Designer", "UX writer"]);
		expect(addChips([], "a,b,c", 2)).toEqual(["a", "b"]);
		expect(addChips([], "abcdef", 20, 3)).toEqual(["abc"]);
		expect(addChips(["x"], "  ")).toEqual(["x"]);
	});
});

function Roles() {
	const [values, setValues] = useState<string[]>(["Designer"]);
	return (
		<ChipInput
			label="Roles"
			values={values}
			onChange={setValues}
			removeLabel={(value) => `Remove ${value}`}
			testID="roles"
		/>
	);
}

describe("ChipInput", () => {
	it("adds a value on return, a comma or leaving the field, and removes one by its button", async () => {
		await renderUi(<Roles />);
		const input = screen.getByTestId("roles");
		await fireEvent.changeText(input, "Data analyst");
		await fireEvent(input, "submitEditing");
		expect(screen.getByText("Data analyst")).toBeOnTheScreen();
		await fireEvent.changeText(input, "PM, Re");
		expect(screen.getByText("PM")).toBeOnTheScreen();
		expect(input.props.value).toBe(" Re");
		await fireEvent(input, "blur");
		expect(screen.getByText("Re")).toBeOnTheScreen();
		await fireEvent.press(screen.getByLabelText("Remove Designer"));
		expect(screen.queryByText("Designer")).toBeNull();
	});
});
