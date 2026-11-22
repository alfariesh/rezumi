import type { ReactNode } from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Platform, Text, View } from "react-native";
import { GestureHandlerRootView, State } from "react-native-gesture-handler";
import { fireGestureHandler, getByGestureTestId } from "react-native-gesture-handler/jest-utils";
import { Avatar, Chip, DatePicker, SwipeableRow, TagGroup, formatIsoDate, parseIsoDate } from "./data";
import { haptics } from "./motion";
import { renderUi } from "./test-utils";

// The system picker is a native view: a stand-in that exposes the picked-date callback.
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

describe("ISO dates", () => {
	it("round-trips a calendar day without a time zone shift", () => {
		const date = parseIsoDate("2026-03-29");
		expect(date && formatIsoDate(date)).toBe("2026-03-29");
		expect(parseIsoDate("29/03/2026")).toBeNull();
		expect(parseIsoDate(null)).toBeNull();
	});
});

describe("DatePicker", () => {
	it("is a labelled button showing the placeholder until a date is picked (iOS inline calendar)", async () => {
		const onChange = jest.fn();
		await renderUi(
			<DatePicker label="Deadline" value={null} onChange={onChange} placeholder="Add a date" testID="deadline" />,
		);
		const button = screen.getByRole("button", { name: "Deadline, Add a date" });
		expect(screen.queryByTestId("deadline-calendar")).toBeNull();

		await fireEvent.press(button);
		expect(button).toBeExpanded();
		const calendar = screen.getByTestId("deadline-calendar");
		await fireEvent(calendar, "valueChange", {}, new Date(2026, 4, 12, 9));
		expect(onChange).toHaveBeenCalledWith("2026-05-12");
		expect(haptics.selection).toHaveBeenCalledTimes(1);
		expect(screen.queryByTestId("deadline-calendar")).toBeNull();
	});

	it("shows the date, clears it, and does nothing when disabled", async () => {
		const onChange = jest.fn();
		await renderUi(
			<DatePicker
				label="Deadline"
				value="2026-05-12"
				onChange={onChange}
				placeholder="Add a date"
				clearLabel="Clear deadline"
				locale="en-US"
			/>,
		);
		expect(screen.getByRole("button", { name: "Deadline, May 12, 2026" })).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Clear deadline" }));
		expect(onChange).toHaveBeenCalledWith(null);

		await renderUi(
			<DatePicker label="Start" value={null} onChange={onChange} placeholder="Add a date" isDisabled testID="start" />,
		);
		const disabled = screen.getByRole("button", { name: "Start, Add a date" });
		expect(disabled).toBeDisabled();
		await fireEvent.press(disabled);
		expect(screen.queryByTestId("start-calendar")).toBeNull();
	});

	it("opens the Android date dialog with the bounds", async () => {
		jest.replaceProperty(Platform, "OS", "android");
		const onChange = jest.fn();
		await renderUi(
			<DatePicker
				label="Deadline"
				value="2026-05-12"
				onChange={onChange}
				placeholder="Add a date"
				minimumDate="2026-01-01"
				locale="en-US"
			/>,
		);
		await fireEvent.press(screen.getByRole("button", { name: "Deadline, May 12, 2026" }));
		const open = jest.mocked(DateTimePickerAndroid.open);
		expect(open).toHaveBeenCalledTimes(1);
		const options = open.mock.calls[0]?.[0];
		if (!options) throw new Error("The date dialog did not open");
		expect(formatIsoDate(options.value)).toBe("2026-05-12");
		expect(options.minimumDate && formatIsoDate(options.minimumDate)).toBe("2026-01-01");
		options.onValueChange?.({ nativeEvent: { timestamp: 0, utcOffset: 0 } }, new Date(2026, 5, 1));
		expect(onChange).toHaveBeenCalledWith("2026-06-01");
	});

	it("shows the error with the remedy while invalid", async () => {
		await renderUi(
			<DatePicker
				label="Deadline"
				value={null}
				onChange={jest.fn()}
				placeholder="Add a date"
				isInvalid
				errorMessage="Pick a date after today."
			/>,
		);
		expect(screen.getByText("Pick a date after today.")).toBeOnTheScreen();
	});
});

type Node = ReturnType<typeof screen.getByText>;

/** The nearest ancestor of `node` that matches. */
function ancestor(node: Node, matches: (candidate: Node) => boolean): Node {
	let current = node.parent;
	while (current && !matches(current)) current = current.parent;
	if (!current) throw new Error("No matching ancestor");
	return current;
}

/** The swipeable card holding a row's text: it carries the screen-reader actions. */
const rowOf = (text: string) =>
	ancestor(screen.getByText(text), (node) => node.props.accessibilityActions !== undefined);

describe("SwipeableRow", () => {
	const setup = async (onDelete: () => void, onArchive: () => void, props: { isDisabled?: boolean } = {}) => {
		// The app root has a GestureHandlerRootView; the shared test wrapper does not yet.
		await renderUi(
			<GestureHandlerRootView>
				<SwipeableRow
					testID="row"
					openActionsLabel="Show actions"
					closeActionsLabel="Hide actions"
					actions={[
						{ key: "delete", label: "Delete", icon: "trash", variant: "danger", onPress: onDelete },
						{ key: "archive", label: "Archive", onPress: onArchive },
					]}
					{...props}
				>
					<View>
						<Text>Product designer · Acme</Text>
					</View>
				</SwipeableRow>
			</GestureHandlerRootView>,
		);
		await fireEvent(screen.getByTestId("row"), "layout", { nativeEvent: { layout: { width: 300, height: 64 } } });
	};

	it("screen readers uncover the labelled actions, which run once", async () => {
		const onDelete = jest.fn();
		const onArchive = jest.fn();
		await setup(onDelete, onArchive);
		expect(screen.queryByRole("button", { name: "Archive" })).toBeNull();
		// The rail measures itself before it offers the screen-reader action: lay out the rail, then its mask.
		const rail = ancestor(
			screen.getByLabelText("Archive", { includeHiddenElements: true }),
			(node) => node.props.importantForAccessibility === "no-hide-descendants",
		);
		await fireEvent(rail, "layout", { nativeEvent: { layout: { width: 160, height: 52 } } });
		const mask = ancestor(rail, (node) => node.props.pointerEvents === "box-none");
		await fireEvent(mask, "layout", { nativeEvent: { layout: { width: 168, height: 64 } } });
		const row = rowOf("Product designer · Acme");
		expect(row.props.accessibilityActions).toContainEqual(expect.objectContaining({ label: "Show actions" }));
		await fireEvent(row, "accessibilityAction", { nativeEvent: { actionName: "swipeable-row-open-end" } });

		await fireEvent.press(screen.getByRole("button", { name: "Archive" }));
		expect(onArchive).toHaveBeenCalledTimes(1);
		expect(onDelete).not.toHaveBeenCalled();
	});

	it("a full swipe performs the first action, with a haptic at the threshold", async () => {
		const onDelete = jest.fn();
		await setup(onDelete, jest.fn());
		fireGestureHandler(getByGestureTestId("swipeable-row-full-swipe"), [
			{ state: State.BEGAN, translationX: 0 },
			{ state: State.ACTIVE, translationX: -60 },
			{ state: State.ACTIVE, translationX: -200 },
			{ state: State.END, translationX: -200 },
		]);
		await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
		expect(haptics.selection).toHaveBeenCalledTimes(1);
	});

	it("a disabled row reads disabled and offers no actions", async () => {
		await setup(jest.fn(), jest.fn(), { isDisabled: true });
		const row = rowOf("Product designer · Acme");
		expect(row).toBeDisabled();
		expect(row.props.accessibilityActions).toEqual([]);
	});

	it("a short swipe performs nothing", async () => {
		const onDelete = jest.fn();
		await setup(onDelete, jest.fn());
		fireGestureHandler(getByGestureTestId("swipeable-row-full-swipe"), [
			{ state: State.BEGAN, translationX: 0 },
			{ state: State.ACTIVE, translationX: -100 },
			{ state: State.END, translationX: -100 },
		]);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(haptics.selection).not.toHaveBeenCalled();
		expect(onDelete).not.toHaveBeenCalled();
	});
});

describe("Chip, TagGroup and Avatar", () => {
	it("render their labels and report presses and removals", async () => {
		const onPress = jest.fn();
		const onRemove = jest.fn();
		await renderUi(
			<>
				<Chip onPress={onPress} accessibilityRole="button">
					<Chip.Label>Remote</Chip.Label>
				</Chip>
				<TagGroup onRemove={onRemove}>
					<TagGroup.List>
						<TagGroup.Item id="figma">
							<TagGroup.ItemLabel>Figma</TagGroup.ItemLabel>
							{/* The primitive sets aria-label "Remove", which wins over accessibilityLabel: name it with aria-label. */}
							<TagGroup.ItemRemoveButton aria-label="Remove Figma" />
						</TagGroup.Item>
					</TagGroup.List>
				</TagGroup>
				<Avatar alt="Salma Putri">
					<Avatar.Fallback>SP</Avatar.Fallback>
				</Avatar>
			</>,
		);
		await fireEvent.press(screen.getByRole("button", { name: "Remote" }));
		expect(onPress).toHaveBeenCalledTimes(1);
		await fireEvent.press(screen.getByLabelText("Remove Figma", { includeHiddenElements: true }));
		expect(onRemove).toHaveBeenCalledWith(new Set(["figma"]));
		expect(screen.getByText("SP")).toBeOnTheScreen();
	});
});
