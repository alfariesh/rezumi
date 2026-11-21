import { fireEvent, screen } from "@testing-library/react-native";
import { useState } from "react";
import { View } from "react-native";
import {
	Checkbox,
	ControlField,
	Description,
	FieldError,
	Input,
	Label,
	RadioGroup,
	Select,
	Switch,
	TextField,
} from "./fields";
import { renderUi } from "./test-utils";

// Jest has no compiled theme, so HeroUI's color helpers log while parsing the missing theme colors.
const consoleError = console.error;
beforeAll(() => {
	jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
		if (typeof args[0] === "string" && args[0].startsWith("[colorKit")) return;
		consoleError(...args);
	});
});
afterAll(() => jest.restoreAllMocks());

describe("TextField", () => {
	it("labels its input, shows the description, and swaps it for the error when invalid", async () => {
		const onChangeText = jest.fn();
		await renderUi(
			<TextField>
				<Label>Email</Label>
				<Input placeholder="name@example.com" onChangeText={onChangeText} accessibilityLabel="Email" />
				<Description>We send the sign-in link here.</Description>
			</TextField>,
		);
		expect(screen.getByText("Email")).toBeOnTheScreen();
		expect(screen.getByText("We send the sign-in link here.")).toBeOnTheScreen();
		await fireEvent.changeText(screen.getByLabelText("Email"), "ana@example.com");
		expect(onChangeText).toHaveBeenCalledWith("ana@example.com");

		await renderUi(
			<TextField isInvalid>
				<Label>Email</Label>
				<Input value="ana@" accessibilityLabel="Email" />
				<FieldError>Enter an email like name@example.com.</FieldError>
			</TextField>,
		);
		expect(screen.getByText("Enter an email like name@example.com.")).toBeOnTheScreen();
	});

	it("does not edit when disabled", async () => {
		await renderUi(
			<TextField isDisabled>
				<Label>Username</Label>
				<Input value="ana" accessibilityLabel="Username" />
			</TextField>,
		);
		expect(screen.getByLabelText("Username")).toHaveProp("editable", false);
	});
});

type ToggleProps = { isDisabled?: boolean };

function CheckboxHarness({ isDisabled = false }: ToggleProps) {
	const [selected, setSelected] = useState(false);
	return (
		<Checkbox
			isSelected={selected}
			onSelectedChange={setSelected}
			isDisabled={isDisabled}
			accessibilityLabel="Accept the terms"
		/>
	);
}

function SwitchHarness({ isDisabled = false }: ToggleProps) {
	const [selected, setSelected] = useState(false);
	return (
		<Switch
			isSelected={selected}
			onSelectedChange={setSelected}
			isDisabled={isDisabled}
			accessibilityLabel="Haptic feedback"
		/>
	);
}

describe("Checkbox", () => {
	it("toggles with a press and reads as a labelled checkbox", async () => {
		await renderUi(<CheckboxHarness />);
		const checkbox = screen.getByRole("checkbox", { name: "Accept the terms" });
		expect(checkbox).not.toBeChecked();
		await fireEvent.press(checkbox);
		expect(screen.getByRole("checkbox", { name: "Accept the terms" })).toBeChecked();
	});

	it("ignores presses when disabled", async () => {
		await renderUi(<CheckboxHarness isDisabled />);
		const checkbox = screen.getByRole("checkbox", { name: "Accept the terms" });
		expect(checkbox).toBeDisabled();
		await fireEvent.press(checkbox);
		expect(screen.getByRole("checkbox", { name: "Accept the terms" })).not.toBeChecked();
	});

	it("toggles from its whole row inside a ControlField", async () => {
		function Row() {
			const [selected, setSelected] = useState(false);
			return (
				<ControlField isSelected={selected} onSelectedChange={setSelected} accessibilityLabel="Weekly digest">
					<View className="flex-1">
						<Label>Weekly digest</Label>
					</View>
					<ControlField.Indicator>
						<Checkbox />
					</ControlField.Indicator>
				</ControlField>
			);
		}
		await renderUi(<Row />);
		await fireEvent.press(screen.getByText("Weekly digest"));
		expect(screen.getAllByRole("checkbox", { checked: true }).length).toBeGreaterThan(0);
	});
});

describe("Switch", () => {
	it("toggles with a press and reads as a labelled switch", async () => {
		await renderUi(<SwitchHarness />);
		const control = screen.getByRole("switch", { name: "Haptic feedback" });
		expect(control).not.toBeChecked();
		await fireEvent.press(control);
		expect(screen.getByRole("switch", { name: "Haptic feedback" })).toBeChecked();
	});

	it("ignores presses when disabled", async () => {
		await renderUi(<SwitchHarness isDisabled />);
		const control = screen.getByRole("switch", { name: "Haptic feedback" });
		expect(control).toBeDisabled();
		await fireEvent.press(control);
		expect(screen.getByRole("switch", { name: "Haptic feedback" })).not.toBeChecked();
	});
});

describe("RadioGroup", () => {
	function Harness() {
		const [value, setValue] = useState("a4");
		return (
			<RadioGroup value={value} onValueChange={setValue}>
				<RadioGroup.Item value="a4">A4</RadioGroup.Item>
				<RadioGroup.Item value="letter">Letter</RadioGroup.Item>
				<RadioGroup.Item value="legal" isDisabled>
					Legal
				</RadioGroup.Item>
			</RadioGroup>
		);
	}

	it("selects one labelled option at a time and skips a disabled one", async () => {
		await renderUi(<Harness />);
		expect(screen.getByRole("radio", { name: "A4" })).toBeChecked();
		await fireEvent.press(screen.getByRole("radio", { name: "Letter" }));
		expect(screen.getByRole("radio", { name: "Letter" })).toBeChecked();
		expect(screen.getByRole("radio", { name: "A4" })).not.toBeChecked();
		await fireEvent.press(screen.getByRole("radio", { name: "Legal" }));
		expect(screen.getByRole("radio", { name: "Legal" })).not.toBeChecked();
	});
});

describe("Select", () => {
	it("shows its placeholder on a labelled trigger, and a disabled trigger stays disabled", async () => {
		await renderUi(
			<Select>
				<Select.Trigger accessibilityLabel="Language">
					<Select.Value placeholder="Choose a language" />
					<Select.TriggerIndicator />
				</Select.Trigger>
			</Select>,
		);
		expect(screen.getByText("Choose a language")).toBeOnTheScreen();
		expect(screen.getByLabelText("Language")).toBeOnTheScreen();

		await renderUi(
			<Select isDisabled>
				<Select.Trigger accessibilityLabel="Country">
					<Select.Value placeholder="Choose a country" />
				</Select.Trigger>
			</Select>,
		);
		expect(screen.getByLabelText("Country")).toBeDisabled();
	});
});
