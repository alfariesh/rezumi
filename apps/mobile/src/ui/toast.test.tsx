import { act, fireEvent, screen } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { Button } from "./button";
import { haptics } from "./motion";
import { renderUi } from "./test-utils";
import { ToastBridge, hideToast, showToast, useAppToast } from "./toast";

// motion.ts reads the haptics preference from expo-sqlite's kv-store at import, which has no Jest fallback.
jest.mock("./motion", () => ({ haptics: { success: jest.fn(), error: jest.fn(), selection: jest.fn() } }));

// Jest has no compiled theme, so HeroUI's color helpers log while parsing the missing theme colors.
const consoleError = console.error;
beforeAll(() => {
	jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
		if (typeof args[0] === "string" && args[0].startsWith("[colorKit")) return;
		consoleError(...args);
	});
});
afterAll(() => jest.restoreAllMocks());

type TriggerProps = { onUndo?: () => void };

function Trigger({ onUndo = jest.fn() }: TriggerProps) {
	const toast = useAppToast();
	return (
		<>
			<Button onPress={() => toast.show({ title: "Moved to trash", undo: { label: "Undo", onUndo } })}>Delete</Button>
			<Button onPress={() => toast.show({ title: "Saved", variant: "success" })}>Save</Button>
			<Button onPress={() => toast.show({ title: "Couldn't save", description: "Try again.", variant: "danger" })}>
				Fail
			</Button>
		</>
	);
}

describe("useAppToast", () => {
	beforeEach(() => jest.clearAllMocks());

	it("shows a toast with Undo that runs once and closes the toast", async () => {
		const onUndo = jest.fn();
		await renderUi(<Trigger onUndo={onUndo} />);
		await fireEvent.press(screen.getByRole("button", { name: "Delete" }));
		expect(screen.getByText("Moved to trash")).toBeOnTheScreen();

		await fireEvent.press(screen.getByRole("button", { name: "Undo" }));
		expect(onUndo).toHaveBeenCalledTimes(1);
		await act(async () => undefined);
		expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
	});

	it("keeps one toast visible: a new one replaces the current", async () => {
		await renderUi(<Trigger />);
		await fireEvent.press(screen.getByRole("button", { name: "Delete" }));
		await fireEvent.press(screen.getByRole("button", { name: "Save" }));
		await act(async () => undefined);
		expect(screen.getByText("Saved")).toBeOnTheScreen();
		expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
	});

	it("plays the success and error haptics and announces the text", async () => {
		const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
		await renderUi(<Trigger />);
		await fireEvent.press(screen.getByRole("button", { name: "Save" }));
		expect(haptics.success).toHaveBeenCalledTimes(1);
		expect(announce).toHaveBeenLastCalledWith("Saved");

		await fireEvent.press(screen.getByRole("button", { name: "Fail" }));
		expect(haptics.error).toHaveBeenCalledTimes(1);
		expect(announce).toHaveBeenLastCalledWith("Couldn't save. Try again.");
		expect(screen.getByText("Try again.")).toBeOnTheScreen();
	});

	it("hides after its duration", async () => {
		jest.useFakeTimers();
		try {
			await renderUi(<Trigger />);
			await fireEvent.press(screen.getByRole("button", { name: "Save" }));
			expect(screen.getByText("Saved")).toBeOnTheScreen();
			await act(async () => {
				jest.advanceTimersByTime(7000);
			});
			await act(async () => {
				jest.runOnlyPendingTimers();
			});
			expect(screen.queryByText("Saved")).toBeNull();
		} finally {
			jest.useRealTimers();
		}
	});
});

describe("showToast", () => {
	it("shows through the mounted bridge, and a toast sent before it mounts shows once it does", async () => {
		expect(showToast({ title: "Exported" })).toBeUndefined();
		await renderUi(<ToastBridge />);
		expect(screen.getByText("Exported")).toBeOnTheScreen();

		let id: string | undefined;
		await act(async () => {
			id = showToast({ title: "Copied link" });
		});
		expect(id).toEqual(expect.any(String));
		expect(screen.getByText("Copied link")).toBeOnTheScreen();
		await act(async () => hideToast(id));
		await act(async () => undefined);
		expect(screen.queryByText("Copied link")).toBeNull();
	});
});
