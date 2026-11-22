import type { ComponentProps } from "react";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { renderUi } from "./test-utils";
import { ValueSlider } from "./value-slider";

type SliderProps = { value: number; onChange: (value: number) => void; onChangeEnd: (value: number) => void };

// HeroUI's real slider renders (thumb, accessibility); a drag is a pan gesture Jest can't perform, so the root's
// callbacks are read from the spy's calls to stand in for the finger moving and lifting.
jest.mock("./fields", () => {
	const actual = jest.requireActual<typeof import("./fields")>("./fields");
	const Real = actual.Slider;
	const Slider = jest.fn((props: ComponentProps<typeof Real>) => <Real {...props} />);
	return { ...actual, Slider: Object.assign(Slider, { Track: Real.Track, Fill: Real.Fill, Thumb: Real.Thumb }) };
});
const { Slider: mockSlider } = jest.requireMock<{ Slider: jest.Mock<unknown, [SliderProps]> }>("./fields");

const props = {
	label: "Text size",
	valueLabel: (value: number) => `${value} pt`,
	minValue: 9,
	maxValue: 12.5,
	step: 0.5,
};

function slider(): SliderProps {
	const props = mockSlider.mock.calls.at(-1)?.[0];
	if (!props) throw new Error("The slider didn't render");
	return props;
}

const thumb = () => screen.getByRole("slider", { name: "Text size" });
const act11y = (actionName: string) => fireEvent(thumb(), "accessibilityAction", { nativeEvent: { actionName } });

describe("ValueSlider", () => {
	it("follows the drag in its label and commits once on release", async () => {
		const onCommit = jest.fn();
		await renderUi(<ValueSlider {...props} value={10} onCommit={onCommit} />);
		expect(screen.getByText("10 pt")).toBeTruthy();
		await act(() => slider().onChange(11));
		expect(screen.getByText("11 pt")).toBeTruthy();
		expect(onCommit).not.toHaveBeenCalled();
		await act(() => slider().onChangeEnd(11.5));
		expect(onCommit).toHaveBeenCalledTimes(1);
		expect(onCommit).toHaveBeenCalledWith(11.5);
	});

	it("shows a stored value outside the range, with the thumb at the end, and ignores a release in place", async () => {
		const onCommit = jest.fn();
		await renderUi(<ValueSlider {...props} value={14} onCommit={onCommit} />);
		expect(screen.getByText("14 pt")).toBeTruthy();
		expect(slider().value).toBe(12.5);
		await act(() => slider().onChangeEnd(14));
		expect(onCommit).not.toHaveBeenCalled();
	});

	it("reads the value label and adjusts by one step with screen reader actions", async () => {
		const onCommit = jest.fn();
		await renderUi(<ValueSlider {...props} value={10} onCommit={onCommit} />);
		expect(thumb().props.accessibilityValue).toEqual({ min: 0, max: 100, now: 29, text: "10 pt" });
		expect(thumb().props.accessibilityActions).toEqual([{ name: "increment" }, { name: "decrement" }]);

		await act11y("increment");
		expect(onCommit).toHaveBeenLastCalledWith(10.5);
		await act11y("decrement");
		expect(onCommit).toHaveBeenLastCalledWith(9.5);
	});

	it("stops at the ends, and moves a value stored past an end back to it", async () => {
		const onCommit = jest.fn();
		const { rerender } = await renderUi(<ValueSlider {...props} value={12.5} onCommit={onCommit} />);
		await act11y("increment");
		expect(onCommit).not.toHaveBeenCalled();

		await rerender(<ValueSlider {...props} value={14} onCommit={onCommit} />);
		await act11y("increment");
		expect(onCommit).not.toHaveBeenCalled();
		await act11y("decrement");
		expect(onCommit).toHaveBeenLastCalledWith(12.5);
	});

	it("offers no actions while disabled", async () => {
		await renderUi(<ValueSlider {...props} value={10} onCommit={jest.fn()} isDisabled />);
		expect(thumb().props.accessibilityActions).toEqual([]);
	});
});
