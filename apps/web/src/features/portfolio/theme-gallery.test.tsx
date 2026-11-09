// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { RENDERED_PORTFOLIO_THEMES } from "@rezumi/portfolio/editor";
import { PORTFOLIO_THEME_INFO } from "@rezumi/schema/portfolio/themes";
import { ThemeGallery } from "./theme-gallery";

const mocks = vi.hoisted(() => ({
	plan: undefined as unknown,
	openPlanDialog: vi.fn(),
}));
vi.mock("@/features/billing/plan", async () => {
	const actual = await vi.importActual<typeof import("@/features/billing/plan")>("@/features/billing/plan");
	return { ...actual, usePlan: () => mocks.plan };
});
vi.mock("@/features/billing/plan-dialog", () => ({ openPlanDialog: mocks.openPlanDialog }));

i18n.loadAndActivate({ locale: "en", messages: {} });

const planWith = (premiumPortfolioThemes: boolean) => ({ enabled: true, features: { premiumPortfolioThemes } });

describe("the theme gallery", () => {
	it("is one radio group: each theme named with its plan, described, and reached with the arrow keys", async () => {
		const onChange = vi.fn();
		const [first, second] = RENDERED_PORTFOLIO_THEMES;
		if (!first || !second) throw new Error("Expected at least two themes.");
		render(
			<I18nProvider i18n={i18n}>
				<ThemeGallery value={first} onChange={onChange} />
			</I18nProvider>,
		);

		const radios = screen.getAllByRole("radio");
		expect(radios).toHaveLength(RENDERED_PORTFOLIO_THEMES.length);
		const chosen = screen.getByRole("radio", { checked: true });
		expect(chosen).toHaveAccessibleName(expect.stringContaining(PORTFOLIO_THEME_INFO[first].name));
		expect(chosen).toHaveAccessibleDescription(expect.stringContaining("."));

		const user = userEvent.setup();
		await user.tab();
		expect(chosen).toHaveFocus();
		await user.keyboard("{ArrowDown}");
		expect(onChange).toHaveBeenLastCalledWith(second);
		// One Tab stop: the next Tab leaves the group.
		await user.tab();
		expect(document.activeElement?.getAttribute("type")).not.toBe("radio");
	});

	const open = (value: "lugas" | "kanvas", onChange: (theme: unknown) => void) =>
		render(
			<I18nProvider i18n={i18n}>
				<ThemeGallery value={value} onChange={onChange} />
			</I18nProvider>,
		);

	it("explains the plan instead of choosing a Plus theme the account can't use", async () => {
		mocks.plan = planWith(false);
		mocks.openPlanDialog.mockClear();
		const onChange = vi.fn();
		open("lugas", onChange);
		const kanvas = screen.getByRole("radio", { name: /Kanvas/ });
		expect(kanvas).toHaveAccessibleName(expect.stringContaining("Plus"));
		await userEvent.setup().click(kanvas);
		expect(onChange).not.toHaveBeenCalled();
		expect(mocks.openPlanDialog).toHaveBeenCalledWith({ kind: "feature", feature: "premiumPortfolioThemes" });
	});

	it("keeps the Plus theme a portfolio already uses, and takes any on Plus", async () => {
		mocks.plan = planWith(false);
		mocks.openPlanDialog.mockClear();
		const kept = vi.fn();
		const view = open("kanvas", kept);
		expect(screen.getByRole("radio", { checked: true })).toHaveAccessibleName(expect.stringContaining("Kanvas"));
		await userEvent.setup().click(screen.getByRole("radio", { name: /Lugas/ }));
		expect(kept).toHaveBeenCalledWith("lugas");
		view.unmount();

		mocks.plan = planWith(true);
		const onChange = vi.fn();
		open("lugas", onChange);
		await userEvent.setup().click(screen.getByRole("radio", { name: /Kanvas/ }));
		expect(onChange).toHaveBeenCalledWith("kanvas");
		expect(mocks.openPlanDialog).not.toHaveBeenCalled();
	});

	it("shows no plan labels while plans don't apply to the account", () => {
		mocks.plan = undefined;
		open("lugas", vi.fn());
		expect(screen.queryByText("Plus")).toBeNull();
	});
});
