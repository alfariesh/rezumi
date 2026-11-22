import { fireEvent, screen } from "@testing-library/react-native";
import { NumberStepper, clampStep } from "./number-stepper";
import { renderUi } from "./test-utils";

const labels = { decreaseLabel: "Decrease margin", increaseLabel: "Increase margin" };

describe("NumberStepper", () => {
	it("steps within the range and stops at its ends", async () => {
		const onChange = jest.fn();
		await renderUi(
			<NumberStepper label="Margin" value={0} unit="pt" min={0} max={2} step={1} onChange={onChange} {...labels} />,
		);
		expect(screen.getByRole("button", { name: "Decrease margin" })).toBeDisabled();
		await fireEvent.press(screen.getByRole("button", { name: "Increase margin" }));
		expect(onChange).toHaveBeenCalledWith(1);
	});

	it("clamps and rounds a typed value when the field is left", async () => {
		const onChange = jest.fn();
		await renderUi(
			<NumberStepper label="Line height" value={1.5} min={0.5} max={4} step={0.05} onChange={onChange} {...labels} />,
		);
		const field = screen.getByLabelText("Line height");
		await fireEvent.changeText(field, "9,123");
		await fireEvent(field, "blur");
		expect(onChange).toHaveBeenCalledWith(4);
		expect(clampStep(1.2345, 0.5, 4, 0.05)).toBe(1.23);
	});

	it("ignores text that isn't a number and an unchanged value", async () => {
		const onChange = jest.fn();
		await renderUi(<NumberStepper label="Gap" value={4} min={0} step={1} onChange={onChange} {...labels} />);
		const field = screen.getByLabelText("Gap");
		await fireEvent.changeText(field, "abc");
		await fireEvent(field, "submitEditing");
		await fireEvent.changeText(field, "4");
		await fireEvent(field, "blur");
		expect(onChange).not.toHaveBeenCalled();
	});
});
