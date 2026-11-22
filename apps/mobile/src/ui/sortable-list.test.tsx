// The sortable list hands a drop over as the rows in their new order; the handle lifts its row on a long press.
import { act, fireEvent, screen } from "@testing-library/react-native";
import { lastList } from "./reorderable-list.mock";
import { SortableHandle, SortableList } from "./sortable-list";
import { renderUi } from "./test-utils";
import { Text } from "./text";

// The animated list needs native refs; the stand-in renders a FlatList and hands over the props, so a test can drop.
jest.mock("react-native-reorderable-list", () => require("./reorderable-list.mock"));

async function renderList(data: readonly string[]) {
	const onReorder = jest.fn();
	await renderUi(
		<SortableList
			data={data}
			keyExtractor={(item) => item}
			renderItem={({ item }) => <Text>{item}</Text>}
			onReorder={onReorder}
		/>,
	);
	const drop = (from: number, to: number) => act(() => lastList.props?.onReorder({ from, to }));
	return { onReorder, drop };
}

describe("SortableList", () => {
	it("reports a drop down the list as the new order, without touching the rows it was given", async () => {
		const data = Object.freeze(["a", "b", "c", "d"]);
		const { onReorder, drop } = await renderList(data);
		expect(screen.getByText("b")).toBeOnTheScreen();

		await drop(0, 2);
		expect(onReorder).toHaveBeenLastCalledWith(["b", "c", "a", "d"], { from: 0, to: 2 });
		expect(data).toEqual(["a", "b", "c", "d"]);
	});

	it("reports a drop up the list, and a drop in place as the same order", async () => {
		const { onReorder, drop } = await renderList(["a", "b", "c", "d"]);

		await drop(3, 1);
		expect(onReorder).toHaveBeenLastCalledWith(["a", "d", "b", "c"], { from: 3, to: 1 });
		await drop(2, 2);
		expect(onReorder).toHaveBeenLastCalledWith(["a", "b", "c", "d"], { from: 2, to: 2 });
	});
});

describe("SortableHandle", () => {
	it("lifts on a long press and is hidden from screen readers", async () => {
		const onDrag = jest.fn();
		await renderUi(<SortableHandle label="Reorder Experience" onDrag={onDrag} />);
		// Screen readers move rows with the row's Move up / Move down actions instead.
		expect(screen.queryByLabelText("Reorder Experience")).toBeNull();
		const handle = screen.getByLabelText("Reorder Experience", { includeHiddenElements: true });
		await fireEvent(handle, "longPress");
		expect(onDrag).toHaveBeenCalled();
	});

	it("does nothing while disabled", async () => {
		const onDrag = jest.fn();
		await renderUi(<SortableHandle label="Reorder Experience" onDrag={onDrag} isDisabled />);
		expect(screen.getByLabelText("Reorder Experience", { includeHiddenElements: true })).toBeDisabled();
	});
});
