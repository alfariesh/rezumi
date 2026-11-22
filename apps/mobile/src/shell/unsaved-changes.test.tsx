import { renderHook } from "@testing-library/react-native";
import { i18n } from "@lingui/core";
import { Alert } from "react-native";
import { useUnsavedChangesGuard } from "./unsaved-changes";

i18n.loadAndActivate({ locale: "en", messages: {} });

const mockDispatch = jest.fn();
let mockPrevent: { enabled: boolean; callback: (event: { data: { action: object } }) => void } | null = null;

jest.mock("expo-router", () => ({
	useNavigation: () => ({ dispatch: mockDispatch }),
	usePreventRemove: (enabled: boolean, callback: (event: { data: { action: object } }) => void) => {
		mockPrevent = { enabled, callback };
	},
}));

describe("useUnsavedChangesGuard", () => {
	it("blocks leaving only while dirty, and leaves after Discard", async () => {
		const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
		const { rerender } = await renderHook(({ dirty }: { dirty: boolean }) => useUnsavedChangesGuard({ dirty }), {
			initialProps: { dirty: false },
		});
		expect(mockPrevent?.enabled).toBe(false);
		await rerender({ dirty: true });
		expect(mockPrevent?.enabled).toBe(true);

		const action = { type: "GO_BACK" };
		mockPrevent?.callback({ data: { action } });
		const [title, , buttons] = alert.mock.calls[0] ?? [];
		expect(title).toBe("Discard your changes?");
		buttons?.find((button) => button.text === "Keep editing")?.onPress?.();
		expect(mockDispatch).not.toHaveBeenCalled();
		buttons?.find((button) => button.text === "Discard")?.onPress?.();
		expect(mockDispatch).toHaveBeenCalledWith(action);
	});
});
