import { fireEvent, screen } from "@testing-library/react-native";
import { PermissionPrimer } from "./permission-primer";
import { renderUi } from "./test-utils";

// The native sheet never presents under Jest (jest.setup.js): show its content while open.
jest.mock("./sheet", () => ({
	Sheet: ({ isOpen, children }: { isOpen: boolean; children: unknown }) => (isOpen ? children : null),
}));

describe("PermissionPrimer", () => {
	it("says why before the system asks, and goes on or not", async () => {
		const onContinue = jest.fn();
		const onNotNow = jest.fn();
		await renderUi(
			<PermissionPrimer
				isOpen
				icon="bell"
				title="Get a nudge at the right time"
				description="Reminders you set, nothing else."
				continueLabel="Continue"
				notNowLabel="Not now"
				onContinue={onContinue}
				onNotNow={onNotNow}
			/>,
		);
		expect(screen.getByText("Reminders you set, nothing else.")).toBeOnTheScreen();
		await fireEvent.press(screen.getByTestId("permission-primer-continue"));
		expect(onContinue).toHaveBeenCalledTimes(1);
		await fireEvent.press(screen.getByTestId("permission-primer-not-now"));
		expect(onNotNow).toHaveBeenCalledTimes(1);
	});
});
