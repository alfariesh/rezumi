import { screen } from "@testing-library/react-native";
import { Platform } from "react-native";
import { MonthPicker } from "./month-picker";
import { renderUi } from "./test-utils";

type AndroidOpen = {
	value: Date;
	onValueChange: (event: unknown, date: Date) => void;
	onDismiss: () => void;
};

const mockOpen = jest.fn<void, [AndroidOpen]>();

jest.mock("@react-native-community/datetimepicker", () => {
	const { Text } = require("react-native");
	return {
		__esModule: true,
		default: (props: { value: Date; display?: string }) => (
			<Text testID="system-picker">{`${props.display ?? "dialog"} ${props.value.toISOString().slice(0, 7)}`}</Text>
		),
		DateTimePickerAndroid: { open: (args: AndroidOpen) => mockOpen(args) },
	};
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
	beforeEach(() => jest.clearAllMocks());

	it("opens Android's own date dialog only when it opens, and reports a pick or a dismissal", async () => {
		const os = Platform.OS;
		Platform.OS = "android";
		try {
			const { rerender } = await renderUi(<MonthPicker {...props} isOpen={false} />);
			expect(mockOpen).not.toHaveBeenCalled();
			await rerender(<MonthPicker {...props} isOpen />);
			expect(screen.queryByTestId("system-picker")).toBeNull();
			expect(mockOpen).toHaveBeenCalledTimes(1);
			const dialog = mockOpen.mock.calls[0]?.[0];
			if (!dialog) throw new Error("the dialog did not open");
			expect(dialog.value.toISOString().slice(0, 7)).toBe("2022-03");

			const picked = new Date("2023-07-01T00:00:00.000Z");
			dialog.onValueChange({}, picked);
			expect(props.onOpenChange).toHaveBeenCalledWith(false);
			expect(props.onPick).toHaveBeenCalledWith(picked);

			dialog.onDismiss();
			expect(props.onOpenChange).toHaveBeenCalledTimes(2);
			expect(props.onPick).toHaveBeenCalledTimes(1);
		} finally {
			Platform.OS = os;
		}
	});
});
