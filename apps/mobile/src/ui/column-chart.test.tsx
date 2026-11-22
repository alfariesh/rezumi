import { screen } from "@testing-library/react-native";
import { ColumnChart, countTicks } from "./column-chart";
import { renderUi } from "./test-utils";

// Skia is native only: the chart is replaced by its x labels, formatted the way the chart would.
jest.mock("heroui-native-pro/bar-chart", () => {
	const { Text } = jest.requireActual("react-native");
	const BarChart = (props: { xAxis: { tickValues: number[]; formatXLabel: (index: number) => string } }) =>
		props.xAxis.tickValues.map((index) => <Text key={index}>{props.xAxis.formatXLabel(index)}</Text>);
	BarChart.Bar = () => null;
	return { BarChart };
});

describe("ColumnChart", () => {
	it("is one image for screen readers, labelled with every value", async () => {
		await renderUi(
			<ColumnChart
				accessibilityLabel="Applications per week: 3/11, 2; 10/11, 0"
				data={[
					{ label: "3/11", value: 2 },
					{ label: "10/11", value: 0 },
				]}
			/>,
		);
		expect(screen.getByRole("image", { name: "Applications per week: 3/11, 2; 10/11, 0" })).toBeTruthy();
		expect(screen.getByText("10/11", { includeHiddenElements: true })).toBeTruthy();
	});

	it("ticks on whole numbers in at most four steps", () => {
		expect(countTicks(0)).toEqual([0, 1]);
		expect(countTicks(3)).toEqual([0, 1, 2, 3]);
		expect(countTicks(9)).toEqual([0, 3, 6, 9]);
		expect(countTicks(10)).toEqual([0, 3, 6, 9, 12]);
	});
});
