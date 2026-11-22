import { fireEvent, screen } from "@testing-library/react-native";
import { Text as NativeText } from "react-native";
import { appIcons } from "@rezumi/icons";
import { Icon } from "./icon";
import { Screen } from "./screen";
import { renderUi } from "./test-utils";
import { TopBar } from "./top-bar";

describe("Icon", () => {
	it("draws every app icon in both variants and hides it from screen readers", async () => {
		for (const name of Object.keys(appIcons) as (keyof typeof appIcons)[]) {
			await renderUi(<Icon name={name} variant="duotone" />);
			expect(screen.getByTestId(`icon-${name}`, { includeHiddenElements: true })).toBeOnTheScreen();
		}
		await renderUi(<Icon name="x" />);
		expect(screen.getByTestId("icon-x", { includeHiddenElements: true }).props.accessibilityElementsHidden).toBe(true);
	});
});

describe("Screen", () => {
	it("renders its content, scrolling or not", async () => {
		await renderUi(
			<Screen testID="screen">
				<NativeText>Body</NativeText>
			</Screen>,
		);
		expect(screen.getByText("Body")).toBeOnTheScreen();
		await renderUi(
			<Screen scroll={false} bare>
				<NativeText>Fixed</NativeText>
			</Screen>,
		);
		expect(screen.getByText("Fixed")).toBeOnTheScreen();
	});
});

describe("TopBar", () => {
	it("shows the title as a header and a labelled back button", async () => {
		const onPress = jest.fn();
		await renderUi(<TopBar title="Settings" large back={{ label: "Back", onPress }} />);
		expect(screen.getByRole("header", { name: "Settings" })).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Back" }));
		expect(onPress).toHaveBeenCalledTimes(1);
	});
});
