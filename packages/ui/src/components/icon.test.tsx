import { render } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { Icon } from "./icon";

const glyph = (container: HTMLElement) => container.querySelector("svg") as SVGSVGElement;

describe("Icon", () => {
	it("draws the standard stroke glyph at the requested size", () => {
		const { container } = render(<Icon name="house" size={24} />);
		expect(container.firstElementChild).toHaveStyle({ fontSize: "24px" });
		expect(glyph(container)).toHaveAttribute("viewBox", "0 0 24 24");
		const path = glyph(container).querySelector("path");
		expect(path).toHaveAttribute("stroke", "currentColor");
		expect(path).toHaveAttribute("stroke-linecap", "round");
		expect(glyph(container).querySelector("[opacity]")).toBeNull();
	});

	it("adds the soft fill of the duotone glyph", () => {
		const { container } = render(<Icon name="house" variant="duotone" />);
		expect(glyph(container).querySelector('[opacity="0.4"]')).toHaveAttribute("fill", "currentColor");
	});

	it("is decorative", () => {
		const { container } = render(<Icon name="x" />);
		expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
	});
});
