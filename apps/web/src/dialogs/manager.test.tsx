// @vitest-environment happy-dom

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { DialogManager } from "./manager";
import { useDialogStore } from "./store";

const mocks = vi.hoisted(() => ({ fail: true }));

vi.mock("./renderers", () => ({
	DialogContent: () => {
		if (mocks.fail) throw new Error("The dialog broke");
		return <p>The dialog</p>;
	},
}));

i18n.loadAndActivate({ locale: "en", messages: {} });

afterEach(() => {
	useDialogStore.setState({ open: false, activeDialog: null, onBeforeClose: null });
	vi.restoreAllMocks();
});

describe("DialogManager", () => {
	// The manager renders in the root component, outside every route's error boundary.
	it("keeps a dialog that fails inside the dialog instead of taking the page down, and loads it on Try again", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		render(
			<I18nProvider i18n={i18n}>
				<p>The rest of the page</p>
				<DialogManager />
			</I18nProvider>,
		);

		// Awaited, so the lazily loaded dialog resolves inside the act scope.
		await act(async () => useDialogStore.getState().openDialog("document.new", undefined));

		expect(await screen.findByRole("alert")).toHaveTextContent("This part didn't load.");
		expect(screen.getByText("The rest of the page")).toBeTruthy();

		mocks.fail = false;
		await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }));
		expect(await screen.findByText("The dialog")).toBeTruthy();
	});
});
