// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { Suspense } from "react";
import { ChunkBoundary, retryableLazy } from "./chunk-boundary";

i18n.loadAndActivate({ locale: "en", messages: {} });

function Loaded() {
	return <p>The part</p>;
}

describe("a lazily loaded part of the editor", () => {
	it("says it didn't load instead of taking the editor down, and loads on Try again", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		const load = vi
			.fn<() => Promise<{ default: typeof Loaded }>>()
			.mockRejectedValueOnce(new TypeError("Failed to fetch dynamically imported module"))
			.mockResolvedValue({ default: Loaded });
		const part = retryableLazy(load);
		render(
			<I18nProvider i18n={i18n}>
				<p>The rest of the editor</p>
				<ChunkBoundary>
					{(attempt) => {
						const Part = part(attempt);
						return (
							<Suspense fallback={<p>Loading</p>}>
								<Part />
							</Suspense>
						);
					}}
				</ChunkBoundary>
			</I18nProvider>,
		);

		expect(await screen.findByRole("alert")).toHaveTextContent("This part didn't load.");
		expect(screen.getByText("The rest of the editor")).toBeTruthy();
		await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }));
		expect(await screen.findByText("The part")).toBeTruthy();
		expect(load).toHaveBeenCalledTimes(2);
	});
});
