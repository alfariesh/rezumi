import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
// @vitest-environment happy-dom
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { Working } from "./shared";

beforeEach(() => {
	vi.useFakeTimers();
	i18n.loadAndActivate({ locale: "en", messages: {} });
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

const phrases = (container: HTMLElement) =>
	[...container.querySelectorAll<HTMLElement>("span[aria-hidden='true']")].map((span) => ({
		text: span.textContent,
		hidden: span.classList.contains("invisible"),
	}));

it("keeps every phrase but the one on show invisible, so a text shimmer around it can't paint them stacked", () => {
	const { container } = render(
		<I18nProvider i18n={i18n}>
			<Working steps={["Reading the posting", "Matching your facts"]} />
		</I18nProvider>,
	);
	expect(phrases(container).filter((phrase) => !phrase.hidden)).toEqual([
		{ text: "Reading the posting…", hidden: false },
	]);

	act(() => void vi.advanceTimersByTime(2200));
	expect(phrases(container).filter((phrase) => !phrase.hidden)).toEqual([
		{ text: "Matching your facts…", hidden: false },
	]);
});
