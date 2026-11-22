import type { ReactNode } from "react";
import { fireEvent, screen } from "@testing-library/react-native";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Platform } from "react-native";
import { haptics } from "./motion";
import { renderUi } from "./test-utils";
import { TimeField, formatTime, parseTime } from "./time-field";

// The system picker is a native view: a stand-in that exposes the value callback.
jest.mock("@react-native-community/datetimepicker", () => {
	const { View: MockView } = jest.requireActual<typeof import("react-native")>("react-native");
	type MockPickerProps = { testID?: string; onValueChange: (event: unknown, date: Date) => void; children?: ReactNode };
	const Picker = (props: MockPickerProps) => (
		<MockView testID={props.testID} {...{ onValueChange: props.onValueChange }} />
	);
	return { __esModule: true, default: Picker, DateTimePickerAndroid: { open: jest.fn() } };
});

beforeEach(() => jest.spyOn(haptics, "selection").mockImplementation(() => undefined));
afterEach(() => jest.restoreAllMocks());

describe("times", () => {
	it("round-trips a wall-clock time and refuses anything else", () => {
		const date = parseTime("09:30");
		expect(date && formatTime(date)).toBe("09:30");
		expect(parseTime("24:00")).toBeNull();
		expect(parseTime("9:30")).toBeNull();
		expect(parseTime(null)).toBeNull();
	});
});

describe("TimeField", () => {
	it("unfolds the iOS wheel and keeps the time only on Done", async () => {
		const onChange = jest.fn();
		await renderUi(
			<TimeField
				label="Time"
				value="09:00"
				onChange={onChange}
				placeholder="Choose a time"
				doneLabel="Done"
				locale="en-GB"
				testID="time"
			/>,
		);
		const button = screen.getByRole("button", { name: "Time, 09:00" });
		await fireEvent.press(button);
		expect(button).toBeExpanded();
		await fireEvent(screen.getByTestId("time-wheel"), "valueChange", {}, new Date(2000, 0, 1, 14, 30));
		expect(onChange).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByRole("button", { name: "Done" }));
		expect(onChange).toHaveBeenCalledWith("14:30");
		expect(haptics.selection).toHaveBeenCalledTimes(1);
		expect(screen.queryByTestId("time-wheel")).toBeNull();
	});

	it("opens the Android time dialog", async () => {
		jest.replaceProperty(Platform, "OS", "android");
		const onChange = jest.fn();
		await renderUi(
			<TimeField label="Time" value={null} onChange={onChange} placeholder="Choose a time" doneLabel="Done" />,
		);
		await fireEvent.press(screen.getByRole("button", { name: "Time, Choose a time" }));
		const options = jest.mocked(DateTimePickerAndroid.open).mock.calls[0]?.[0];
		if (!options) throw new Error("The time dialog did not open");
		expect(options.mode).toBe("time");
		options.onValueChange?.({ nativeEvent: { timestamp: 0, utcOffset: 0 } }, new Date(2000, 0, 1, 8, 15));
		expect(onChange).toHaveBeenCalledWith("08:15");
	});

	it("shows the error while invalid and does nothing when disabled", async () => {
		await renderUi(
			<TimeField
				label="Time"
				value="02:30"
				onChange={jest.fn()}
				placeholder="Choose a time"
				doneLabel="Done"
				isInvalid
				isDisabled
				errorMessage="This time doesn't exist in that time zone."
				testID="gap"
			/>,
		);
		expect(screen.getByText("This time doesn't exist in that time zone.")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: /^Time,/ }));
		expect(screen.queryByTestId("gap-wheel")).toBeNull();
	});
});
