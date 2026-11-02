import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
// @vitest-environment happy-dom
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { createMemoryHistory, createRootRoute, createRouter, RouterContextProvider } from "@tanstack/react-router";
import { Pricing } from "./pricing";

beforeEach(() => i18n.loadAndActivate({ locale: "en-US", messages: {} }));
afterEach(cleanup);

function renderPricing(billingEnabled?: boolean) {
	const router = createRouter({ routeTree: createRootRoute(), history: createMemoryHistory() });
	return render(
		<RouterContextProvider router={router}>
			<I18nProvider i18n={i18n}>
				<Pricing {...(billingEnabled === undefined ? {} : { billingEnabled })} />
			</I18nProvider>
		</RouterContextProvider>,
	);
}

describe("public pricing availability", () => {
	it("shows Rupiah prices but disables paid offers when billing is off or unavailable", () => {
		renderPricing();
		expect(screen.getAllByRole("button", { name: "Coming soon" })).toHaveLength(2);
		for (const button of screen.getAllByRole("button", { name: "Coming soon" })) {
			expect(button.hasAttribute("disabled")).toBe(true);
		}
		expect(screen.queryByRole("link", { name: "Choose Plus" })).toBeNull();
		expect(screen.queryByRole("link", { name: "Choose Pro AI" })).toBeNull();
		expect(screen.getByRole("link", { name: "Start free" }).getAttribute("href")).toBe("/auth/register");
		expect(screen.getByText("29,000")).toBeTruthy();
		expect(screen.getByText("79,000")).toBeTruthy();
		expect(screen.getByText(/Paid plan limits are not active yet/)).toBeTruthy();
	});

	it("offers registration with plan intent only when billing is enabled", () => {
		renderPricing(true);
		expect(screen.queryByRole("button", { name: "Coming soon" })).toBeNull();
		expect(screen.getByRole("link", { name: "Choose Plus" }).getAttribute("href")).toContain("plan=plus");
		expect(screen.getByRole("link", { name: "Choose Pro AI" }).getAttribute("href")).toContain("plan=pro-ai");
		expect(screen.queryByText(/Paid plan limits are not active yet/)).toBeNull();
	});
});
