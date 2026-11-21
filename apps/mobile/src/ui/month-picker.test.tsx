import { screen } from "@testing-library/react-native";
import { Platform } from "react-native";
import { MonthPicker } from "./month-picker";
import { renderUi } from "./test-utils";

jest.mock("@react-native-community/datetimepicker", () => {
	const { Text } = require("react-native");
	return (props: { value: Date; display?: string }) => (
		<Text testID="system-picker">{`${props.display ?? "dialog"} ${props.value.toISOString().slice(0, 7)}`}</Text>
	);
});

const props = {
	title: "Start",
	value: new Date("2022-03-01T00:00:00.000Z"),
	onPick: jest.fn(),
	onClear: jest.fn(),
	onOpenChange: jest.fn(),
	clearLabel: "Clear",
	doneLabel: "Done",
	closeLabel: "Close",
};

describe("MonthPicker", () => {
	it("opens Android's own date dialog only while open", async () => {
		const os = Platform.OS;
		Platform.OS = "android";
		try {
			const { rerender } = await renderUi(<MonthPicker {...props} isOpen={false} />);
			expect(screen.queryByTestId("system-picker")).toBeNull();
			await rerender(<MonthPicker {...props} isOpen />);
			expect(screen.getByTestId("system-picker")).toHaveTextContent("dialog 2022-03");
		} finally {
			Platform.OS = os;
		}
	});
});
