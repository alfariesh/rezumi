// The push drawer: the menu is hidden from screen readers while closed and the screen while open; the dimmed screen
// closes it, as does the screen reader's escape gesture.
import { fireEvent, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { PushDrawer } from "./drawer";
import { renderScreen } from "@/test/render-screen";

function renderDrawer(open: boolean, onOpenChange = jest.fn()) {
	return renderScreen(
		<PushDrawer
			open={open}
			onOpenChange={onOpenChange}
			drawer={<Text>Menu</Text>}
			closeLabel="Close menu"
			testID="drawer"
		>
			<Text>Screen</Text>
		</PushDrawer>,
	);
}

// Screen readers skip what the drawer hides, and so do the queries unless asked.
const hidden = { includeHiddenElements: true };

describe("PushDrawer", () => {
	it("keeps the menu out of reach while closed", async () => {
		await renderDrawer(false);
		expect(screen.getByTestId("drawer-menu", hidden).props.importantForAccessibility).toBe("no-hide-descendants");
		expect(screen.getByTestId("drawer-screen", hidden).props.importantForAccessibility).toBe("auto");
		expect(screen.queryByText("Menu")).toBeNull();
		expect(screen.getByText("Screen")).toBeOnTheScreen();
		expect(screen.queryByRole("button", { name: "Close menu" })).toBeNull();
	});

	it("hides the screen while open and closes from the dimmed screen or the escape gesture", async () => {
		const onOpenChange = jest.fn();
		await renderDrawer(true, onOpenChange);
		const menu = screen.getByTestId("drawer-menu", hidden);
		expect(menu.props.accessibilityViewIsModal).toBe(true);
		expect(screen.getByTestId("drawer-screen", hidden).props.importantForAccessibility).toBe("no-hide-descendants");
		expect(screen.queryByText("Screen")).toBeNull();
		expect(screen.getByText("Menu")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Close menu" }));
		expect(onOpenChange).toHaveBeenLastCalledWith(false);
		await fireEvent(menu, "accessibilityEscape");
		expect(onOpenChange).toHaveBeenCalledTimes(2);
	});
});
