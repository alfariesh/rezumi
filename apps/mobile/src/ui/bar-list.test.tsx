import { screen } from "@testing-library/react-native";
import { BarList } from "./bar-list";
import { renderUi } from "./test-utils";

describe("BarList", () => {
	it("reads each bar as its name, count and note, with the stage dot beside the name", async () => {
		await renderUi(
			<BarList
				items={[
					{ key: "applied", label: "Applied", value: 5, stage: "applied" },
					{ key: "interview", label: "Interview", value: 2, note: "40%", stage: "interview" },
					{ key: "linkedin", label: "LinkedIn", value: 0 },
				]}
			/>,
		);
		expect(screen.getByLabelText("Applied: 5")).toBeTruthy();
		expect(screen.getByLabelText("Interview: 2, 40%")).toBeTruthy();
		expect(screen.getByLabelText("LinkedIn: 0")).toBeTruthy();
		expect(screen.getByTestId("stage-dot-interview", { includeHiddenElements: true })).toBeTruthy();
	});
});
