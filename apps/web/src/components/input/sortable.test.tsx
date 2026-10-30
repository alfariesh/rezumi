// @vitest-environment happy-dom

import type { SortableTarget } from "./sortable";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { SortableEdge, SortableHandle, SortableProvider, useSortableDropZone, useSortableItem } from "./sortable";

/** The slice of a browser DataTransfer that React Aria's drag and drop reads and writes. */
class FakeDataTransfer {
	effectAllowed = "uninitialized";
	dropEffect = "none";
	private data = new Map<string, string>();

	get types() {
		return [...this.data.keys()];
	}

	get items() {
		const entries = [...this.data.entries()].map(([type]) => ({ kind: "string", type }));
		return Object.assign(entries, {
			add: (value: string, type: string) => {
				this.data.set(type, value);
			},
		});
	}

	getData(type: string) {
		return this.data.get(type) ?? "";
	}

	clearData() {
		this.data.clear();
	}

	setDragImage() {}
}

/** Testing Library builds its own DataTransfer for drag events; React Aria needs this one, so dispatch by hand. */
function dispatchDrag(element: Element, type: string, dataTransfer: FakeDataTransfer) {
	const event = new Event(type, { bubbles: true, cancelable: true });
	Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
	act(() => {
		element.dispatchEvent(event);
	});
}

type RowProps = { id: string; list: string; index: number };

function Row({ id, list, index }: RowProps) {
	const item = useSortableItem({ id, list, index, label: id });
	return (
		<div {...item.dropTargetProps} data-testid={id} className="relative">
			<SortableEdge edge={item.edge} />
			<SortableHandle item={item} label={`Reorder ${id}`} />
		</div>
	);
}

type ZoneProps = { list: string; length: number };

function Zone({ list, length }: ZoneProps) {
	const zone = useSortableDropZone({ list, length });
	return <div {...zone.dropTargetProps} data-testid={`zone-${list}`} />;
}

function setup(onMove: (id: string, target: SortableTarget) => void) {
	const view = render(
		<>
			<SortableProvider onMove={onMove}>
				<Row id="a" list="main" index={0} />
				<Row id="b" list="main" index={1} />
				<Row id="c" list="main" index={2} />
				<Row id="x" list="side" index={0} />
				<Zone list="main" length={3} />
				<Zone list="empty" length={0} />
			</SortableProvider>
			<SortableProvider onMove={() => {}}>
				<Row id="other" list="elsewhere" index={0} />
			</SortableProvider>
		</>,
	);
	const handle = (id: string) => view.getByLabelText(`Reorder ${id}`);
	const row = (id: string) => view.getByTestId(id);
	const edge = (id: string) => row(id).querySelector("span.bg-accent")?.className ?? null;

	const drag = (from: string, to: HTMLElement) => {
		const dataTransfer = new FakeDataTransfer();
		dispatchDrag(handle(from), "dragstart", dataTransfer);
		dispatchDrag(to, "dragenter", dataTransfer);
		dispatchDrag(to, "dragover", dataTransfer);
		return {
			dataTransfer,
			leave: () => dispatchDrag(to, "dragleave", dataTransfer),
			drop: () => {
				dispatchDrag(to, "drop", dataTransfer);
				dispatchDrag(handle(from), "dragend", dataTransfer);
			},
		};
	};

	return { ...view, handle, row, edge, drag };
}

afterEach(cleanup);

describe("sortable", () => {
	it("moves an item to the index of the item it is dropped on", () => {
		const onMove = vi.fn();
		const { drag, row } = setup(onMove);

		drag("a", row("c")).drop();

		expect(onMove).toHaveBeenCalledExactlyOnceWith("a", { list: "main", index: 2, overId: "c" });
	});

	it("moves between lists with the index of the item dropped on", () => {
		const onMove = vi.fn();
		const { drag, row } = setup(onMove);

		drag("x", row("b")).drop();

		expect(onMove).toHaveBeenCalledExactlyOnceWith("x", { list: "main", index: 1, overId: "b" });
	});

	it("shows the line after the item when moving down and before it when moving up", () => {
		const { drag, row, edge } = setup(vi.fn());

		drag("a", row("c"));
		expect(edge("c")).toContain("-bottom-px");

		drag("c", row("a"));
		expect(edge("a")).toContain("-top-px");
	});

	it("shows the line before the item when the drag comes from another list", () => {
		const { drag, row, edge } = setup(vi.fn());

		drag("x", row("b"));

		expect(edge("b")).toContain("-top-px");
	});

	it("ignores a drop on the dragged item itself", () => {
		const onMove = vi.fn();
		const { drag, row, edge } = setup(onMove);

		const dragging = drag("b", row("b"));
		expect(edge("b")).toBeNull();
		dragging.drop();

		expect(onMove).not.toHaveBeenCalled();
	});

	it("ignores drags that started in another sortable provider", () => {
		const onMove = vi.fn();
		const { drag, row } = setup(onMove);

		drag("other", row("a")).drop();

		expect(onMove).not.toHaveBeenCalled();
	});

	it("clears the line when the drag leaves", () => {
		const { drag, row, edge } = setup(vi.fn());

		const dragging = drag("a", row("b"));
		expect(edge("b")).not.toBeNull();
		dragging.leave();

		expect(edge("b")).toBeNull();
	});

	it("appends to an empty list dropped on its zone", () => {
		const onMove = vi.fn();
		const { drag, getByTestId } = setup(onMove);

		drag("a", getByTestId("zone-empty")).drop();

		expect(onMove).toHaveBeenCalledExactlyOnceWith("a", { list: "empty", index: 0, overId: null });
	});

	it("moves to the end of its own list when dropped on that list's zone", () => {
		const onMove = vi.fn();
		const { drag, getByTestId } = setup(onMove);

		drag("a", getByTestId("zone-main")).drop();

		expect(onMove).toHaveBeenCalledExactlyOnceWith("a", { list: "main", index: 2, overId: null });
	});

	it("names the grip for assistive technology and makes it a button", () => {
		const { handle } = setup(vi.fn());

		expect(handle("a").getAttribute("role")).toBe("button");
		expect(handle("a").tabIndex).toBe(0);
	});
});
