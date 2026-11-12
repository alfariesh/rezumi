import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
// @vitest-environment happy-dom
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRootRoute, createRouter, RouterContextProvider } from "@tanstack/react-router";
import { Homepage } from "./page";
import { ThemeProvider } from "@/features/theme/provider";

beforeEach(() => {
	vi.stubGlobal("__APP_VERSION__", "test");
	i18n.loadAndActivate({ locale: "en-US", messages: {} });
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

function renderHomepage(portfolioEnabled: boolean) {
	const router = createRouter({ routeTree: createRootRoute(), history: createMemoryHistory() });
	return render(
		<RouterContextProvider router={router}>
			<QueryClientProvider client={new QueryClient()}>
				<I18nProvider i18n={i18n}>
					<ThemeProvider theme="system">
						<Homepage portfolioEnabled={portfolioEnabled} />
					</ThemeProvider>
				</I18nProvider>
			</QueryClientProvider>
		</RouterContextProvider>,
	);
}

describe("the portfolio on the landing page", () => {
	it("isn't mentioned until portfolios are open", () => {
		renderHomepage(false);
		expect(screen.queryByRole("heading", { name: "Portfolio" })).toBeNull();
		expect(document.querySelector('a[href="/docs/guides/creating-a-portfolio"]')).toBeNull();
	});

	it("shows every theme with its plan and links to the guide once they are", () => {
		renderHomepage(true);
		expect(screen.getByRole("heading", { name: "Portfolio" })).toBeTruthy();
		for (const theme of ["Lugas", "Prima", "Kanvas", "Mozaik", "Paper", "Brutal"]) {
			expect(screen.getByRole("img", { name: `${theme} portfolio theme preview` })).toBeTruthy();
		}
		expect(document.querySelector('a[href="/docs/guides/creating-a-portfolio"]')).toBeTruthy();
	});
});
