import { fireEvent, screen } from "@testing-library/react-native";
import { useState } from "react";
import { View } from "react-native";
import { Button } from "./button";
import { haptics } from "./motion";
import { ConfirmDialog, Menu } from "./overlays";
import { renderUi } from "./test-utils";

// motion.ts reads the haptics preference from expo-sqlite's kv-store at import, which has no Jest fallback.
jest.mock("./motion", () => ({ haptics: { warning: jest.fn(), selection: jest.fn() } }));

// Jest has no compiled theme, so HeroUI's color helpers log while parsing the missing theme colors.
const consoleError = console.error;
beforeAll(() => {
	jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
		if (typeof args[0] === "string" && args[0].startsWith("[colorKit")) return;
		consoleError(...args);
	});
});
afterAll(() => jest.restoreAllMocks());

type HarnessProps = { destructive?: boolean; onConfirm: () => void };

function Harness({ destructive = false, onConfirm }: HarnessProps) {
	const [isOpen, setIsOpen] = useState(false);
	return (
		<>
			<Button onPress={() => setIsOpen(true)}>Delete resume</Button>
			<ConfirmDialog
				isOpen={isOpen}
				onOpenChange={setIsOpen}
				title="Delete “Product designer”?"
				message="The resume and its versions are gone for good."
				confirmLabel="Delete forever"
				cancelLabel="Keep resume"
				destructive={destructive}
				onConfirm={onConfirm}
			/>
		</>
	);
}

describe("ConfirmDialog", () => {
	beforeEach(() => jest.clearAllMocks());

	it("stays closed until opened, then shows the title, message and both labelled buttons", async () => {
		await renderUi(<Harness onConfirm={jest.fn()} />);
		expect(screen.queryByText("Delete “Product designer”?")).toBeNull();

		await fireEvent.press(screen.getByRole("button", { name: "Delete resume" }));
		expect(screen.getByRole("heading", { name: "Delete “Product designer”?" })).toBeOnTheScreen();
		expect(screen.getByText("The resume and its versions are gone for good.")).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: "Delete forever" })).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: "Keep resume" })).toBeOnTheScreen();
	});

	it("confirms once with the warning haptic when destructive, then closes", async () => {
		const onConfirm = jest.fn();
		await renderUi(<Harness destructive onConfirm={onConfirm} />);
		await fireEvent.press(screen.getByRole("button", { name: "Delete resume" }));
		await fireEvent.press(screen.getByRole("button", { name: "Delete forever" }));
		expect(onConfirm).toHaveBeenCalledTimes(1);
		expect(haptics.warning).toHaveBeenCalledTimes(1);
		expect(screen.queryByRole("button", { name: "Delete forever" })).toBeNull();
	});

	it("cancels without confirming or a haptic, and a non-destructive confirm plays none", async () => {
		const onConfirm = jest.fn();
		await renderUi(<Harness onConfirm={onConfirm} />);
		await fireEvent.press(screen.getByRole("button", { name: "Delete resume" }));
		await fireEvent.press(screen.getByRole("button", { name: "Keep resume" }));
		expect(onConfirm).not.toHaveBeenCalled();
		expect(screen.queryByRole("button", { name: "Keep resume" })).toBeNull();

		await fireEvent.press(screen.getByRole("button", { name: "Delete resume" }));
		await fireEvent.press(screen.getByRole("button", { name: "Delete forever" }));
		expect(onConfirm).toHaveBeenCalledTimes(1);
		expect(haptics.warning).not.toHaveBeenCalled();
	});
});

type MeasureCallback = (x: number, y: number, width: number, height: number, pageX: number, pageY: number) => void;

describe("Menu", () => {
	// A popover menu opens once it has measured its trigger; Jest's host views never call back on their own.
	let measure: jest.SpyInstance | undefined;
	beforeEach(() => {
		measure = jest
			.spyOn(View.prototype, "measure")
			.mockImplementation((...args: unknown[]) => (args[0] as MeasureCallback)(0, 0, 120, 48, 16, 120));
	});
	afterEach(() => measure?.mockRestore());

	it("opens from its trigger, runs an item and skips a disabled one", async () => {
		const onRename = jest.fn();
		const onDelete = jest.fn();
		await renderUi(
			<Menu>
				<Menu.Trigger asChild>
					<Button>Options</Button>
				</Menu.Trigger>
				<Menu.Portal>
					<Menu.Overlay />
					<Menu.Content presentation="popover" width={220} testID="menu">
						<Menu.Item onPress={onRename}>
							<Menu.ItemTitle>Rename</Menu.ItemTitle>
						</Menu.Item>
						<Menu.Item variant="danger" isDisabled onPress={onDelete}>
							<Menu.ItemTitle>Delete</Menu.ItemTitle>
						</Menu.Item>
					</Menu.Content>
				</Menu.Portal>
			</Menu>,
		);
		expect(screen.queryByText("Rename")).toBeNull();
		await fireEvent.press(screen.getByRole("button", { name: "Options" }));
		// The content takes touches once it has laid out on screen.
		await fireEvent(screen.getByTestId("menu"), "layout", {
			nativeEvent: { layout: { x: 16, y: 180, width: 220, height: 96 } },
		});
		await fireEvent.press(screen.getByRole("menuitem", { name: "Delete" }));
		expect(onDelete).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByRole("menuitem", { name: "Rename" }));
		expect(onRename).toHaveBeenCalledTimes(1);
	});
});
