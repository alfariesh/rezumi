import { fireEvent, render, screen } from "@testing-library/react-native";
import { useState } from "react";
import { Pressable, Text } from "react-native";
import { ErrorBoundary } from "./error-boundary";

let broken = true;

function Flaky() {
	const [count] = useState(1);
	if (broken) throw new Error("render failed");
	return <Text>Loaded {count}</Text>;
}

function Fallback({ resetError }: { resetError: () => void }) {
	return (
		<Pressable accessibilityRole="button" onPress={resetError}>
			<Text>Try again</Text>
		</Pressable>
	);
}

describe("ErrorBoundary", () => {
	beforeEach(() => {
		broken = true;
		jest.spyOn(console, "error").mockImplementation(() => undefined);
	});
	afterEach(() => jest.restoreAllMocks());

	it("shows the fallback when a child throws, then renders the child again after a retry", async () => {
		await render(
			<ErrorBoundary fallback={Fallback}>
				<Flaky />
			</ErrorBoundary>,
		);

		expect(screen.getByRole("button", { name: "Try again" })).toBeOnTheScreen();
		expect(screen.queryByText(/Loaded/)).not.toBeOnTheScreen();

		broken = false;
		await fireEvent.press(screen.getByRole("button", { name: "Try again" }));

		expect(await screen.findByText("Loaded 1")).toBeOnTheScreen();
	});
});
