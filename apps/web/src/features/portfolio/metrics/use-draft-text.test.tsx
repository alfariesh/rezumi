// @vitest-environment happy-dom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { usePortfolioEditorStore } from "../editor/store";
import { useDraftText } from "./use-draft-text";

/** Data swapped in from outside the fields: a load, Undo, Redo, an item moved or removed. */
const swapData = () => act(() => usePortfolioEditorStore.setState((state) => ({ revision: state.revision + 1 })));

describe("useDraftText", () => {
	beforeEach(() => usePortfolioEditorStore.getState().reset());

	it("keeps a half-typed text when data is swapped in elsewhere", () => {
		const { result } = renderHook(({ value }) => useDraftText(value), { initialProps: { value: "10" } });
		act(() => result.current[1]("12."));
		swapData();
		expect(result.current[0]).toBe("12.");
	});

	it("starts over when the swap gave this field another value", () => {
		const { result, rerender } = renderHook(({ value }) => useDraftText(value), { initialProps: { value: "10" } });
		act(() => result.current[1]("12."));
		act(() => {
			usePortfolioEditorStore.setState((state) => ({ revision: state.revision + 1 }));
			rerender({ value: "7" });
		});
		expect(result.current[0]).toBe("7");
	});

	it("keeps what's typed while its own valid values reach the data, also across a later swap", () => {
		const { result, rerender } = renderHook(({ value }) => useDraftText(value), { initialProps: { value: "" } });
		act(() => result.current[1]("example.com"));
		rerender({ value: "https://example.com" });
		expect(result.current[0]).toBe("example.com");
		swapData();
		expect(result.current[0]).toBe("example.com");
	});
});
