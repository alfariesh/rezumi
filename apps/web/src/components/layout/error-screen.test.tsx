// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import { i18n } from "@lingui/core";
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { ErrorScreen } from "./error-screen";

i18n.loadAndActivate({ locale: "en", messages: {} });

describe("ErrorScreen", () => {
	// The root route's error view replaces the root component, and with it the app's I18nProvider.
	it("shows the error page when the root route fails, outside any I18nProvider", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
		const rootRoute = createRootRoute({
			component: () => {
				throw new Error("A dialog broke");
			},
			errorComponent: ErrorScreen,
		});
		const router = createRouter({ routeTree: rootRoute, history: createMemoryHistory({ initialEntries: ["/"] }) });

		render(<RouterProvider router={router} />);

		expect(await screen.findByText("This page didn't load")).toBeTruthy();
		expect(screen.queryByText("Something went wrong!")).toBeNull();
	});
});
