import { act, screen } from "@testing-library/react-native";
import { renderUi } from "./test-utils";
import { ValueSlider } from "./value-slider";

type SliderProps = { value: number; onChange: (value: number) => void; onChangeEnd: (value: number) => void };

// HeroUI's slider is driven by gestures; the stand-in keeps its props so a test can drag and release it.
const mockSlider = { props: undefined as SliderProps | undefined };
jest.mock("./fields", () => {
	const Slider = (props: SliderProps & { children?: unknown }) => {
		mockSlider.props = props;
		return props.children;
	};
	const Pass = ({ children }: { children?: unknown }) => children ?? null;
	return { Slider: Object.assign(Slider, { Track: Pass, Fill: Pass, Thumb: Pass }) };
});

const props = {
	label: "Text size",
	valueLabel: (value: number) => `${value} pt`,
	minValue: 9,
	maxValue: 12.5,
	step: 0.5,
};

function slider(): SliderProps {
	if (!mockSlider.props) throw new Error("The slider didn't render");
	return mockSlider.props;
}

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
});
