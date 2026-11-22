// The sortable list hands a drop over as the rows in their new order; the handle lifts its row on a long press.
import { fireEvent, screen } from "@testing-library/react-native";
import { lastList } from "./reorderable-list.mock";
import { SortableHandle, SortableList } from "./sortable-list";
import { renderUi } from "./test-utils";
import { Text } from "./text";

jest.mock("react-native-reorderable-list", () => require("./reorderable-list.mock"));

describe("SortableList", () => {
	it("renders the rows and reports a drop as the new order", async () => {
		const onReorder = jest.fn();
		await renderUi(
			<SortableList
				data={["a", "b", "c"]}
				keyExtractor={(item) => item}
				renderItem={({ item }) => <Text>{item}</Text>}
				onReorder={onReorder}
			/>,
		);
		expect(screen.getByText("b")).toBeOnTheScreen();
		lastList.props?.onReorder({ from: 0, to: 2 });
		expect(onReorder).toHaveBeenCalledWith(["b", "c", "a"], { from: 0, to: 2 });
	});
});

describe("SortableHandle", () => {
	it("lifts on a long press and is named for screen readers", async () => {
		const onDrag = jest.fn();
		await renderUi(<SortableHandle label="Reorder Experience" onDrag={onDrag} />);
		await fireEvent(screen.getByLabelText("Reorder Experience"), "longPress");
		expect(onDrag).toHaveBeenCalled();
	});

	it("does nothing while disabled", async () => {
		const onDrag = jest.fn();
		await renderUi(<SortableHandle label="Reorder Experience" onDrag={onDrag} isDisabled />);
		expect(screen.getByLabelText("Reorder Experience")).toBeDisabled();
	});
});
