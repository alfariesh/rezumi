// @vitest-environment happy-dom

import { render } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { EffectDemo } from "./effect-demo";

beforeAll(() => {
	// A desktop with a mouse that doesn't ask for less motion: the vector outline wraps every letter.
	vi.stubGlobal(
		"matchMedia",
		vi.fn((query: string) => ({
			matches: !query.includes("reduce"),
			media: query,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		})),
	);
});

describe("an effect's sample", () => {
	it("survives a new name after the vector outline rewrote its letters", () => {
		const onError = vi.fn();
		window.addEventListener("error", onError);
		const { container, rerender } = render(
			<EffectDemo effect="vector-hover" name="Nadia Putri" phrases={[]} play={0} />,
		);
		rerender(<EffectDemo effect="vector-hover" name="Nadia Putri" phrases={[]} play={1} />);
		expect(container.querySelectorAll(".pfx-c").length).toBeGreaterThan(0);

		// Undo, redo or a refetched resume changes the name while Design is open.
		rerender(<EffectDemo effect="vector-hover" name="Nadia" phrases={[]} play={1} />);
		expect(container.textContent).toBe("Nadia");
		expect(container.querySelectorAll(".pfx-c")).toHaveLength(0); // a fresh, still sample
		expect(onError).not.toHaveBeenCalled();
		window.removeEventListener("error", onError);
	});

	it("plays again from a fresh sample each time it's asked", () => {
		const { container, rerender } = render(<EffectDemo effect="vector-hover" name="Nadia" phrases={[]} play={1} />);
		const first = container.querySelector("[data-pfx]");
		rerender(<EffectDemo effect="vector-hover" name="Nadia" phrases={[]} play={2} />);
		const second = container.querySelector("[data-pfx]");
		expect(second).not.toBe(first);
		expect(second?.querySelectorAll(".pfx-c")).toHaveLength(5);
	});

	it("draws the typewriter's phrases as the page does, the first one shown", () => {
		const { container } = render(
			<EffectDemo effect="typewriter" name="Nadia" phrases={["Product designer", "UX researcher"]} play={0} />,
		);
		const root = container.querySelector<HTMLElement>('[data-pfx="typewriter"]');
		expect(root?.dataset.pfxPhrases).toBe(JSON.stringify(["Product designer", "UX researcher"]));
		expect([...container.querySelectorAll(".pfx-type__ghost")].map((ghost) => ghost.textContent)).toEqual([
			"Product designer",
			"UX researcher",
		]);
		expect(container.querySelector(".pfx-type__out")?.textContent).toBe("Product designer");
	});

	it("wraps each word for the word effects, and shows the name as it is for the others", () => {
		const { container, rerender } = render(<EffectDemo effect="fade-up" name="Nadia  Putri" phrases={[]} play={0} />);
		expect([...container.querySelectorAll(".pfx-w")].map((word) => word.textContent)).toEqual(["Nadia", "Putri"]);
		rerender(<EffectDemo effect="shimmer" name="Nadia Putri" phrases={[]} play={0} />);
		expect(container.querySelector('[data-pfx="shimmer"]')?.textContent).toBe("Nadia Putri");
		rerender(<EffectDemo effect="none" name="Nadia" phrases={[]} play={0} />);
		expect(container.querySelector("[data-pfx]")).toBeNull();
	});
});
