import { fireEvent, screen } from "@testing-library/react-native";
import { Switch } from "./fields";
import { ListRow, ListSection } from "./lists";
import { renderUi } from "./test-utils";

describe("ListRow", () => {
	it("reads a pressable row as one button with its value and fires on press", async () => {
		const onPress = jest.fn();
		await renderUi(
			<ListSection title="Account">
				<ListRow icon="globe" title="Language" value="English" onPress={onPress} />
			</ListSection>,
		);
		await fireEvent.press(screen.getByRole("button", { name: "Language, English" }));
		expect(onPress).toHaveBeenCalledTimes(1);
		expect(screen.getByRole("header", { name: "Account" })).toBeOnTheScreen();
	});

	it("keeps a trailing control reachable and does not press a disabled row", async () => {
		const onPress = jest.fn();
		await renderUi(
			<ListSection>
				<ListRow title="Notifications" trailing={<Switch isSelected={false} onSelectedChange={jest.fn()} />} />
				<ListRow title="Sync" isDisabled onPress={onPress} />
			</ListSection>,
		);
		expect(screen.getByText("Notifications")).toBeOnTheScreen();
		expect(screen.getByRole("switch")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Sync" }));
		expect(onPress).not.toHaveBeenCalled();
	});

	it("tells screen readers which choice is current", async () => {
		await renderUi(
			<ListSection>
				<ListRow title="PDF" isSelected chevron={false} onPress={jest.fn()} />
				<ListRow title="Word" isSelected={false} chevron={false} onPress={jest.fn()} />
				<ListRow title="Language" onPress={jest.fn()} />
			</ListSection>,
		);
		expect(screen.getByRole("button", { name: "PDF" })).toBeSelected();
		expect(screen.getByRole("button", { name: "Word" })).not.toBeSelected();
		expect(screen.getByRole("button", { name: "Language" })).not.toBeSelected();
		// The current choice carries a check; the others don't.
		expect(screen.getAllByTestId("icon-check", { includeHiddenElements: true })).toHaveLength(1);
	});
});
