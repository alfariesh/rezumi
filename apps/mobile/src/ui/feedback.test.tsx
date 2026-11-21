import { fireEvent, screen } from "@testing-library/react-native";
import { Alert, EmptyState, ProgressBar, Skeleton, Spinner } from "./feedback";
import { renderUi } from "./test-utils";

describe("EmptyState", () => {
	it("page: a header, one sentence and side-by-side actions that each fire once", async () => {
		const onCreate = jest.fn();
		const onImport = jest.fn();
		await renderUi(
			<EmptyState
				kind="page"
				icon="file-text"
				title="No resumes yet"
				description="Start from a template or import a PDF."
				action={{ label: "New resume", onPress: onCreate }}
				secondaryAction={{ label: "Import", onPress: onImport }}
			/>,
		);
		expect(screen.getByRole("header", { name: "No resumes yet" })).toBeOnTheScreen();
		expect(screen.getByText("Start from a template or import a PDF.")).toBeOnTheScreen();
		expect(screen.getByTestId("icon-file-text", { includeHiddenElements: true })).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "New resume" }));
		await fireEvent.press(screen.getByRole("button", { name: "Import" }));
		expect(onCreate).toHaveBeenCalledTimes(1);
		expect(onImport).toHaveBeenCalledTimes(1);
	});

	it("filtered: defaults to the magnifying glass and offers to clear", async () => {
		const onClear = jest.fn();
		await renderUi(
			<EmptyState
				kind="filtered"
				title="No matches for “design”"
				action={{ label: "Clear search", onPress: onClear }}
			/>,
		);
		expect(screen.getByTestId("icon-magnifying-glass", { includeHiddenElements: true })).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Clear search" }));
		expect(onClear).toHaveBeenCalledTimes(1);
	});

	it("inline: one line with no icon and a small action", async () => {
		const onAdd = jest.fn();
		await renderUi(
			<EmptyState
				kind="inline"
				icon="briefcase"
				title="No interviews"
				description="Add one when it is booked."
				action={{ label: "Add", onPress: onAdd }}
			/>,
		);
		expect(screen.queryByTestId("icon-briefcase", { includeHiddenElements: true })).toBeNull();
		expect(screen.getByText("No interviews")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Add" }));
		expect(onAdd).toHaveBeenCalledTimes(1);
	});
});

describe("Alert", () => {
	it("renders its title and description", async () => {
		await renderUi(
			<Alert status="warning">
				<Alert.Indicator />
				<Alert.Content>
					<Alert.Title>You are offline</Alert.Title>
					<Alert.Description>Changes save when you are back online.</Alert.Description>
				</Alert.Content>
			</Alert>,
		);
		expect(screen.getByText("You are offline")).toBeOnTheScreen();
		expect(screen.getByText("Changes save when you are back online.")).toBeOnTheScreen();
	});
});

describe("ProgressBar", () => {
	it("is a progress bar with its value for screen readers", async () => {
		await renderUi(<ProgressBar value={40} accessibilityLabel="Upload" />);
		const bar = screen.getByRole("progressbar", { name: "Upload" });
		expect(bar).toHaveAccessibilityValue({ min: 0, max: 100, now: 40 });
	});

	it("reads disabled and drops the value while indeterminate", async () => {
		await renderUi(<ProgressBar isIndeterminate isDisabled accessibilityLabel="Export" />);
		const bar = screen.getByRole("progressbar", { name: "Export" });
		expect(bar).toBeDisabled();
		expect(bar.props.accessibilityValue.now).toBeUndefined();
	});
});

describe("Skeleton and Spinner", () => {
	it("show their content once loaded", async () => {
		const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
		await renderUi(
			<>
				<Skeleton isLoading={false}>
					<Text>Loaded row</Text>
				</Skeleton>
				<Spinner testID="spinner" />
			</>,
		);
		expect(screen.getByText("Loaded row")).toBeOnTheScreen();
		expect(screen.getByTestId("spinner")).toBeOnTheScreen();
	});
});
