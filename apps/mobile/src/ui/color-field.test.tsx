// A color typed as text: the caller parses it when the field is left, and a rejected value says how to fix it.
import { fireEvent, screen } from "@testing-library/react-native";
import { ColorField } from "./color-field";
import { renderUi } from "./test-utils";

const field = (onChange: (text: string) => boolean) =>
	renderUi(
		<ColorField label="Border color" value="rgba(0, 0, 0, 1)" invalidLabel="Enter a color" onChange={onChange} />,
	);

describe("ColorField", () => {
	it("hands over the trimmed text when the field is left", async () => {
		const onChange = jest.fn(() => true);
		await field(onChange);
		const input = screen.getByLabelText("Border color");
		await fireEvent.changeText(input, " #1a73e8 ");
		await fireEvent(input, "blur");
		expect(onChange).toHaveBeenCalledWith("#1a73e8");
		expect(screen.queryByText("Enter a color")).toBeNull();
	});

	it("says how to fix a value the caller rejects", async () => {
		await field(() => false);
		const input = screen.getByLabelText("Border color");
		await fireEvent.changeText(input, "blue-ish");
		await fireEvent(input, "submitEditing");
		expect(screen.getByText("Enter a color")).toBeOnTheScreen();
	});
});
