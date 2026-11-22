import { screen } from "@testing-library/react-native";
import { ProgressCircle } from "./progress-circle";
import { renderUi } from "./test-utils";

describe("ProgressCircle", () => {
	it("is one progress element with its label, value and the middle text", async () => {
		await renderUi(
			<ProgressCircle accessibilityLabel="Readability score" value={76} size="lg" color="accent">
				76
			</ProgressCircle>,
		);
		const ring = screen.getByRole("progressbar", { name: "Readability score" });
		expect(ring.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 76 });
		expect(screen.getByText("76", { includeHiddenElements: true })).toBeTruthy();
	});
});
