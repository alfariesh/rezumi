import { screen } from "@testing-library/react-native";
import { StageDot, StageLabel } from "./stage";
import { renderUi } from "./test-utils";

describe("StageLabel", () => {
	it("shows the stage name beside its color and reads as the name", async () => {
		await renderUi(<StageLabel stage="interview" label="Interview" />);
		expect(screen.getByLabelText("Interview")).toBeOnTheScreen();
		expect(screen.getByText("Interview")).toBeOnTheScreen();
		const dot = screen.getByTestId("stage-dot-interview", { includeHiddenElements: true });
		expect(dot.props.className).toContain("bg-stage-interview");
	});
});

describe("StageDot", () => {
	it("is hidden from screen readers", async () => {
		await renderUi(<StageDot stage="closed" />);
		expect(screen.queryByTestId("stage-dot-closed")).toBeNull();
		expect(screen.getByTestId("stage-dot-closed", { includeHiddenElements: true })).toBeOnTheScreen();
	});
});
