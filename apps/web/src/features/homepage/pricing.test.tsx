import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
// @vitest-environment happy-dom
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { createMemoryHistory, createRootRoute, createRouter, RouterContextProvider } from "@tanstack/react-router";
import { Pricing } from "./pricing";

beforeEach(() => i18n.loadAndActivate({ locale: "en-US", messages: {} }));
afterEach(cleanup);

function renderPricing(billingEnabled?: boolean, portfolioEnabled = false) {
	const router = createRouter({ routeTree: createRootRoute(), history: createMemoryHistory() });
	return render(
		<RouterContextProvider router={router}>
			<I18nProvider i18n={i18n}>
				<Pricing {...(billingEnabled === undefined ? {} : { billingEnabled })} portfolioEnabled={portfolioEnabled} />
			</I18nProvider>
		</RouterContextProvider>,
	);
}

describe("public pricing availability", () => {
	it("shows dollar prices but disables paid offers when billing is off or unavailable", () => {
		renderPricing();
		expect(screen.getAllByRole("button", { name: "Coming soon" })).toHaveLength(2);
		for (const button of screen.getAllByRole("button", { name: "Coming soon" })) {
			expect(button.hasAttribute("disabled")).toBe(true);
		}
		expect(screen.queryByRole("link", { name: "Try Plus free" })).toBeNull();
		expect(screen.queryByRole("link", { name: "Choose Pro AI" })).toBeNull();
		expect(screen.getByRole("link", { name: "Start free" }).getAttribute("href")).toBe("/auth/register");
		expect(screen.getByText("4.99")).toBeTruthy();
		expect(screen.getByText("9.99")).toBeTruthy();
		expect(screen.getByText("per month, or $39 a year")).toBeTruthy();
		expect(screen.getByText("per month, or $79 a year")).toBeTruthy();
		expect(screen.getByText(/Paid plan limits are not active yet/)).toBeTruthy();
	});

	it("sells portfolio features only once portfolios are open to everyone", () => {
		renderPricing(true);
		expect(screen.queryByText(/portfolio/i)).toBeNull();
		cleanup();
		renderPricing(true, true);
		expect(screen.getByText("A web portfolio with 6 works and 2 themes")).toBeTruthy();
		expect(screen.getAllByText("Every portfolio theme, your own domain, no Rezumi badge").length).toBeGreaterThan(0);
	});

	it("shows Rupiah on the Indonesian page", () => {
		i18n.loadAndActivate({ locale: "id-ID", messages: {} });
		renderPricing();
		expect(screen.getByText("59.000")).toBeTruthy();
		expect(screen.getByText("129.000")).toBeTruthy();
	});

	it("sends paid plans through sign-up to the Plan page with the plan marked, only when billing is enabled", () => {
		renderPricing(true);
		expect(screen.queryByRole("button", { name: "Coming soon" })).toBeNull();
		const callbackOf = (name: string) => {
			const url = new URL(screen.getByRole("link", { name }).getAttribute("href") ?? "", "https://rezumi.test");
			return [url.pathname, url.searchParams.get("callbackURL")];
		};
		expect(callbackOf("Try Plus free")).toEqual(["/auth/register", "/dashboard/settings/billing?plan=plus"]);
		expect(callbackOf("Choose Pro AI")).toEqual(["/auth/register", "/dashboard/settings/billing?plan=pro-ai"]);
		expect(screen.getByRole("link", { name: "Start free" }).getAttribute("href")).toBe("/auth/register");
		expect(screen.queryByText(/Paid plan limits are not active yet/)).toBeNull();
	});
});
