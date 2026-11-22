import type { TrueSheetProps } from "@lodev09/react-native-true-sheet";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { useState } from "react";
import { Button } from "./button";
import { haptics } from "./motion";
import { Sheet } from "./sheet";
import { renderUi } from "./test-utils";
import { Text } from "./text";

jest.mock("./motion", () => ({
	haptics: { selection: jest.fn() },
	useIsWide: () => false,
	useReducedMotion: () => false,
}));

// A stand-in for the native sheet: it renders its header, content and footer while presented and lets each test
// decide when the native presentation finishes and when the dismissal callback arrives.
const mockNative = {
	props: undefined as TrueSheetProps | undefined,
	presents: 0,
	dismisses: 0,
	finishPresent: () => undefined as void,
};

jest.mock("@lodev09/react-native-true-sheet", () => {
	const {
		createElement,
		forwardRef,
		isValidElement,
		useEffect,
		useImperativeHandle,
		useState: useMockState,
	} = require("react");
	const { View } = require("react-native");
	const TrueSheet = forwardRef((props: TrueSheetProps, ref: unknown) => {
		const [shown, setShown] = useMockState(false);
		useEffect(() => {
			mockNative.props = props;
		});
		useImperativeHandle(ref, () => ({
			present: () => {
				mockNative.presents++;
				setShown(true);
				return new Promise<void>((resolve) => {
					mockNative.finishPresent = resolve;
				});
			},
			dismiss: () => {
				mockNative.dismisses++;
				setShown(false);
				return Promise.resolve();
			},
		}));
		if (!shown) return null;
		const slot = (node: unknown) => (isValidElement(node) ? node : null);
		return createElement(View, null, slot(props.header), props.children, slot(props.footer));
	});
	return { TrueSheet };
});

// Jest has no compiled theme, so HeroUI's color helpers log while parsing the missing theme colors.
const consoleError = console.error;
beforeAll(() => {
	jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
		if (typeof args[0] === "string" && args[0].startsWith("[colorKit")) return;
		consoleError(...args);
	});
});
afterAll(() => jest.restoreAllMocks());

const settle = () => act(async () => undefined);

type HarnessProps = { canDismiss?: boolean; onDismissAttempt?: () => void; onOpenChange?: (open: boolean) => void };

function Harness({ canDismiss, onDismissAttempt, onOpenChange }: HarnessProps) {
	const [isOpen, setIsOpen] = useState(false);
	const change = (open: boolean) => {
		onOpenChange?.(open);
		setIsOpen(open);
	};
	return (
		<>
			<Button onPress={() => change(true)}>Open</Button>
			<Button onPress={() => change(false)}>Close from outside</Button>
			<Sheet
				isOpen={isOpen}
				onOpenChange={change}
				title="Resume settings"
				closeLabel="Close"
				detents={["auto", 0.9]}
				canDismiss={canDismiss}
				onDismissAttempt={onDismissAttempt}
				footer={<Button onPress={() => change(false)}>Save</Button>}
			>
				<Text>Page size</Text>
			</Sheet>
		</>
	);
}

describe("Sheet", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockNative.props = undefined;
		mockNative.presents = 0;
		mockNative.dismisses = 0;
	});

	it("presents on open with its title row, labelled close button, body and footer", async () => {
		await renderUi(<Harness />);
		expect(mockNative.presents).toBe(0);
		expect(screen.queryByText("Page size")).toBeNull();

		await fireEvent.press(screen.getByRole("button", { name: "Open" }));
		expect(mockNative.presents).toBe(1);
		expect(screen.getByRole("header", { name: "Resume settings" })).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: "Close" })).toBeOnTheScreen();
		expect(screen.getByText("Page size")).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: "Save" })).toBeOnTheScreen();
		expect(mockNative.props?.accessibilityOptions?.paneTitle).toBe("Resume settings");
		expect(mockNative.props?.detents).toEqual(["auto", 0.9]);
		expect(mockNative.props?.dismissible).toBe(true);
	});

	it("closes through the close button and reports an interactive dismissal once", async () => {
		const onOpenChange = jest.fn();
		await renderUi(<Harness onOpenChange={onOpenChange} />);
		await fireEvent.press(screen.getByRole("button", { name: "Open" }));
		mockNative.finishPresent();
		await settle();

		await fireEvent.press(screen.getByRole("button", { name: "Close" }));
		expect(onOpenChange).toHaveBeenLastCalledWith(false);
		await settle();
		expect(mockNative.dismisses).toBe(1);
		await act(async () => mockNative.props?.onDidDismiss?.({} as never));
		// The parent already closed it: the late native callback does not report a second close.
		expect(onOpenChange).toHaveBeenCalledTimes(2);

		await fireEvent.press(screen.getByRole("button", { name: "Open" }));
		mockNative.finishPresent();
		await settle();
		// A drag or Android back dismisses natively; the sheet tells its owner.
		await act(async () => mockNative.props?.onDidDismiss?.({} as never));
		expect(onOpenChange).toHaveBeenLastCalledWith(false);
	});

	it("waits for the native presentation before a fast close dismisses it", async () => {
		await renderUi(<Harness />);
		await fireEvent.press(screen.getByRole("button", { name: "Open" }));
		await fireEvent.press(screen.getByRole("button", { name: "Close from outside" }));
		await settle();
		expect(mockNative.dismisses).toBe(0);
		mockNative.finishPresent();
		await settle();
		expect(mockNative.dismisses).toBe(1);
	});

	it("reopens only after the previous dismissal finished", async () => {
		await renderUi(<Harness />);
		await fireEvent.press(screen.getByRole("button", { name: "Open" }));
		mockNative.finishPresent();
		await settle();
		await fireEvent.press(screen.getByRole("button", { name: "Close from outside" }));
		await settle();
		await fireEvent.press(screen.getByRole("button", { name: "Open" }));
		expect(mockNative.presents).toBe(1);
		await act(async () => mockNative.props?.onDidDismiss?.({} as never));
		expect(mockNative.presents).toBe(2);
	});

	it("blocks dismissal while it cannot be dismissed and asks its owner instead", async () => {
		const onDismissAttempt = jest.fn();
		const onOpenChange = jest.fn();
		await renderUi(<Harness canDismiss={false} onDismissAttempt={onDismissAttempt} onOpenChange={onOpenChange} />);
		await fireEvent.press(screen.getByRole("button", { name: "Open" }));
		expect(mockNative.props?.dismissible).toBe(false);

		await fireEvent.press(screen.getByRole("button", { name: "Close" }));
		expect(onDismissAttempt).toHaveBeenCalledTimes(1);
		await act(async () => mockNative.props?.onDismissAttempt?.({} as never));
		expect(onDismissAttempt).toHaveBeenCalledTimes(2);
		expect(onOpenChange).toHaveBeenCalledTimes(1);
		expect(screen.getByText("Page size")).toBeOnTheScreen();
	});

	it("plays the selection haptic when it settles at another detent", async () => {
		await renderUi(<Harness />);
		await fireEvent.press(screen.getByRole("button", { name: "Open" }));
		const detent = (index: number) =>
			act(async () => mockNative.props?.onDetentChange?.({ nativeEvent: { index, position: 0, detent: 0 } } as never));
		await detent(0);
		expect(haptics.selection).not.toHaveBeenCalled();
		await detent(1);
		expect(haptics.selection).toHaveBeenCalledTimes(1);
	});
});
