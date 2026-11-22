import { fireEvent, screen } from "@testing-library/react-native";
import { PickerSheet, filterPickerOptions } from "./picker-sheet";
import { renderUi } from "./test-utils";

jest.mock("@lodev09/react-native-true-sheet", () => {
	const { forwardRef, useImperativeHandle, useState: useMockState } = require("react");
	const TrueSheet = forwardRef((props: { children?: unknown }, ref: unknown) => {
		const [shown, setShown] = useMockState(false);
		useImperativeHandle(ref, () => ({
			present: () => {
				setShown(true);
				return Promise.resolve();
			},
			dismiss: () => {
				setShown(false);
				return Promise.resolve();
			},
			resize: () => Promise.resolve(),
		}));
		return shown ? props.children : null;
	});
	return { TrueSheet, TrueSheetProvider: ({ children }: { children: unknown }) => children };
});

const options = [
	{ value: "en-US", label: "English (United States)", detail: "en-US" },
	{ value: "id-ID", label: "Indonesian", detail: "id-ID" },
];

describe("PickerSheet", () => {
	it("searches labels and details", () => {
		expect(filterPickerOptions(options, " indo ").map((option) => option.value)).toEqual(["id-ID"]);
		expect(filterPickerOptions(options, "en-us").map((option) => option.value)).toEqual(["en-US"]);
		expect(filterPickerOptions(options, "")).toHaveLength(2);
	});

	it("marks the current option, picks one and closes", async () => {
		const onPick = jest.fn();
		const onOpenChange = jest.fn();
		await renderUi(
			<PickerSheet
				isOpen
				onOpenChange={onOpenChange}
				title="Language"
				closeLabel="Close"
				searchLabel="Search languages"
				emptyLabel={(query) => `No language matches “${query}”.`}
				options={options}
				value="en-US"
				onPick={onPick}
			/>,
		);
		expect(await screen.findByRole("button", { name: "English (United States), en-US", selected: true })).toBeTruthy();
		await fireEvent.press(screen.getByRole("button", { name: "Indonesian, id-ID" }));
		expect(onPick).toHaveBeenCalledWith("id-ID");
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it("says when the search matches nothing", async () => {
		await renderUi(
			<PickerSheet
				isOpen
				onOpenChange={jest.fn()}
				title="Language"
				closeLabel="Close"
				searchLabel="Search languages"
				emptyLabel={(query) => `No language matches “${query}”.`}
				options={options}
				value={null}
				onPick={jest.fn()}
			/>,
		);
		await fireEvent.changeText(await screen.findByLabelText("Search languages"), "xyz");
		expect(screen.getByText("No language matches “xyz”.")).toBeTruthy();
	});
});
