import { fireEvent, screen } from "@testing-library/react-native";
import { ZoomBar } from "./page-parts";
import { renderScreen } from "@/test/render-screen";

const bar = { onStep: jest.fn(), currentPage: 1, pageCount: 2 };

describe("ZoomBar", () => {
	it("reads the current zoom on the reset button", async () => {
		const onReset = jest.fn();
		const { rerender } = await renderScreen(<ZoomBar {...bar} zoom={null} onReset={onReset} />);
		expect(screen.getByTestId("page-zoom-reset")).toHaveAccessibleName("Zoom: fit to width");

		await rerender(<ZoomBar {...bar} zoom={1.2} onReset={onReset} />);
		expect(screen.getByText("120%")).toBeTruthy();
		await fireEvent.press(screen.getByRole("button", { name: "Zoom: 120%" }));
		expect(onReset).toHaveBeenCalled();
	});
});
