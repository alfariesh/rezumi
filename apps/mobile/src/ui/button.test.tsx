import { fireEvent, screen } from "@testing-library/react-native";
import { IconButton } from "./button";
import { renderUi } from "./test-utils";
import { Text } from "./text";

describe("IconButton", () => {
	it("is a labelled button that fires once per press and not when disabled", async () => {
		const onPress = jest.fn();
		await renderUi(<IconButton icon="magnifying-glass" label="Search" onPress={onPress} />);
		await fireEvent.press(screen.getByRole("button", { name: "Search" }));
		expect(onPress).toHaveBeenCalledTimes(1);

		await renderUi(<IconButton icon="x" label="Close" isDisabled onPress={onPress} />);
		await fireEvent.press(screen.getByRole("button", { name: "Close" }));
		expect(onPress).toHaveBeenCalledTimes(1);
	});
});

describe("Text", () => {
	it("renders its children", async () => {
		await renderUi(<Text weight="medium">Saved</Text>);
		expect(screen.getByText("Saved")).toBeOnTheScreen();
	});
});
