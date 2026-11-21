import { fireEvent, screen } from "@testing-library/react-native";
import { haptics } from "./motion";
import { Fab, Segment, Stepper, Tabs } from "./navigation";
import { renderUi } from "./test-utils";

const views = [
	{ value: "list", label: "List" },
	{ value: "board", label: "Board" },
	{ value: "calendar", label: "Calendar", isDisabled: true },
] as const;

describe("Segment", () => {
	beforeEach(() => jest.spyOn(haptics, "selection").mockImplementation(() => undefined));
	afterEach(() => jest.restoreAllMocks());

	it("reads the selected item as selected and reports a change with a selection haptic", async () => {
		const onValueChange = jest.fn();
		await renderUi(<Segment options={views} value="list" onValueChange={onValueChange} accessibilityLabel="View" />);
		expect(screen.getByRole("tab", { name: "List" })).toBeSelected();
		expect(screen.getByRole("tab", { name: "Board" })).not.toBeSelected();

		await fireEvent.press(screen.getByRole("tab", { name: "Board" }));
		expect(onValueChange).toHaveBeenCalledWith("board");
		expect(haptics.selection).toHaveBeenCalledTimes(1);
	});

	it("ignores the selected item and disabled items", async () => {
		const onValueChange = jest.fn();
		await renderUi(<Segment options={views} value="list" onValueChange={onValueChange} accessibilityLabel="View" />);
		await fireEvent.press(screen.getByRole("tab", { name: "List" }));
		await fireEvent.press(screen.getByRole("tab", { name: "Calendar" }));
		expect(screen.getByRole("tab", { name: "Calendar" })).toBeDisabled();
		expect(onValueChange).not.toHaveBeenCalled();
		expect(haptics.selection).not.toHaveBeenCalled();
	});

	it("keeps labels for screen readers when icon-only", async () => {
		await renderUi(
			<Segment
				options={[
					{ value: "light", label: "Light", icon: "sun" },
					{ value: "dark", label: "Dark", icon: "moon" },
				]}
				value="dark"
				onValueChange={jest.fn()}
				accessibilityLabel="Theme"
				hideLabel
			/>,
		);
		expect(screen.queryByText("Light")).toBeNull();
		expect(screen.getByRole("tab", { name: "Dark" })).toBeSelected();
	});
});

describe("Tabs", () => {
	it("switches panels", async () => {
		const onValueChange = jest.fn();
		await renderUi(
			<Tabs value="one" onValueChange={onValueChange}>
				<Tabs.List>
					<Tabs.Trigger value="one">
						<Tabs.Label>One</Tabs.Label>
					</Tabs.Trigger>
					<Tabs.Trigger value="two">
						<Tabs.Label>Two</Tabs.Label>
					</Tabs.Trigger>
				</Tabs.List>
			</Tabs>,
		);
		await fireEvent.press(screen.getByRole("tab", { name: "Two" }));
		expect(onValueChange).toHaveBeenCalledWith("two");
	});
});

const steps = [{ title: "Account", description: "Sign in" }, { title: "Profile" }, { title: "First resume" }];

describe("Stepper", () => {
	it("labels each step, marks the current one and lets only finished steps go back", async () => {
		const onStepChange = jest.fn();
		await renderUi(
			<Stepper
				steps={steps}
				currentStep={1}
				onStepChange={onStepChange}
				stepLabel={(step, total) => `Step ${step} of ${total}`}
			/>,
		);
		const first = screen.getByRole("button", { name: "Step 1 of 3, Account, Sign in" });
		expect(screen.getByLabelText("Step 2 of 3, Profile")).toBeSelected();
		expect(screen.getByLabelText("Step 3 of 3, First resume")).toBeDisabled();

		await fireEvent.press(screen.getByLabelText("Step 3 of 3, First resume"));
		expect(onStepChange).not.toHaveBeenCalled();
		await fireEvent.press(first);
		expect(onStepChange).toHaveBeenCalledWith(0);
	});

	it("has no pressable step without a handler", async () => {
		await renderUi(<Stepper steps={steps} currentStep={2} />);
		expect(screen.queryByRole("button")).toBeNull();
		// Nothing here is a control, so no step reads "dimmed".
		expect(screen.getByLabelText("Account, Sign in")).not.toBeDisabled();
	});
});

describe("Fab", () => {
	it("is a labelled button with its label shown, firing once per press", async () => {
		const onPress = jest.fn();
		await renderUi(<Fab icon="plus" label="New application" onPress={onPress} floating={false} />);
		const button = screen.getByRole("button", { name: "New application" });
		expect(button).not.toBeCollapsed();
		expect(button).not.toBeExpanded();
		expect(screen.getByText("New application")).toBeOnTheScreen();
		await fireEvent.press(button);
		expect(onPress).toHaveBeenCalledTimes(1);
	});

	it("keeps the label for screen readers when icon-only, and does nothing when disabled", async () => {
		const onPress = jest.fn();
		await renderUi(<Fab icon="plus" label="New" extended={false} isDisabled onPress={onPress} floating={false} />);
		expect(screen.queryByText("New")).toBeNull();
		const button = screen.getByRole("button", { name: "New" });
		expect(button).toBeDisabled();
		await fireEvent.press(button);
		expect(onPress).not.toHaveBeenCalled();
	});

	it("floats above the bottom safe area", async () => {
		await renderUi(<Fab icon="plus" label="New" onPress={jest.fn()} testID="fab" />);
		expect(screen.getByTestId("fab")).toHaveStyle({ bottom: 34 + 16 });
	});

	it("as a speed dial, the trigger announces whether it is open", async () => {
		await renderUi(
			<Fab
				icon="plus"
				label="New"
				floating={false}
				actions={[{ key: "resume", label: "Resume", icon: "file-text", onPress: jest.fn() }]}
			/>,
		);
		expect(screen.getByRole("button", { name: "New" })).toBeCollapsed();
	});
});
