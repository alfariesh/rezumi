// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { RENDERED_PORTFOLIO_THEMES } from "@rezumi/portfolio/editor";
import { PORTFOLIO_THEME_INFO } from "@rezumi/schema/portfolio/themes";
import { ThemeGallery } from "./theme-gallery";

i18n.loadAndActivate({ locale: "en", messages: {} });

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
});
