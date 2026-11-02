// @vitest-environment happy-dom
import type { ReactNode } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { RotatingText } from "./rotating-text";

const preferences = vi.hoisted(() => ({ reducedMotion: false, inView: true }));
vi.mock("motion/react", async (importOriginal) => {
	const original = await importOriginal<typeof import("motion/react")>();
	const { createElement, forwardRef } = await import("react");
	type StaticSpanProps = { children?: ReactNode; className?: string };
	return {
		...original,
		// Test timer/visibility behavior independently of Happy DOM's incomplete Web Animations implementation.
		motion: {
			span: forwardRef<HTMLSpanElement, StaticSpanProps>(({ children, className }, ref) =>
				createElement("span", { ref, className }, children),
			),
		},
		AnimatePresence: ({ children }: { children: ReactNode }) => children,
		useReducedMotion: () => preferences.reducedMotion,
		useInView: () => preferences.inView,
	};
});

beforeEach(() => {
	vi.useFakeTimers();
	preferences.reducedMotion = false;
	preferences.inView = true;
	vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe("rotating headline", () => {
	it("rotates while visible, pauses in a hidden tab, then resumes without skipping words", () => {
		const visibility = vi.spyOn(document, "visibilityState", "get");
		const view = render(<RotatingText texts={["experience", "education", "skills"]} />);
		expect(view.container.textContent).toBe("experience");
		act(() => vi.advanceTimersByTime(2500));
		expect(view.container.textContent).toBe("education");

		visibility.mockReturnValue("hidden");
		act(() => document.dispatchEvent(new Event("visibilitychange")));
		act(() => vi.advanceTimersByTime(10_000));
		expect(view.container.textContent).toBe("education");

		visibility.mockReturnValue("visible");
		act(() => document.dispatchEvent(new Event("visibilitychange")));
		act(() => vi.advanceTimersByTime(2500));
		expect(view.container.textContent).toBe("skills");
	});

	it("stays static with reduced motion and stops rotating outside the viewport", () => {
		preferences.reducedMotion = true;
		const view = render(<RotatingText texts={["experience", "skills"]} />);
		act(() => vi.advanceTimersByTime(10_000));
		expect(view.container.textContent).toBe("experience");

		preferences.reducedMotion = false;
		view.rerender(<RotatingText texts={["experience", "skills"]} />);
		act(() => vi.advanceTimersByTime(2500));
		expect(view.container.textContent).toBe("skills");

		preferences.inView = false;
		view.rerender(<RotatingText texts={["experience", "skills"]} />);
		act(() => vi.advanceTimersByTime(10_000));
		expect(view.container.textContent).toBe("skills");
	});

	it("preserves joining scripts as one text run and accepts an empty list", () => {
		const view = render(<RotatingText texts={["خبراتك"]} />);
		expect(view.getByText("خبراتك").childElementCount).toBe(0);
		view.rerender(<RotatingText texts={[]} />);
		expect(view.container.textContent).toBe("");
	});
});
