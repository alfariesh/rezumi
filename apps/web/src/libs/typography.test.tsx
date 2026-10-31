// @vitest-environment happy-dom

import { render } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { Typography } from "@heroui/react";
import { renderAsH1, renderAsH2, renderAsH3 } from "./typography";

describe("heading render functions", () => {
	it.each([
		["h1", renderAsH1],
		["h2", renderAsH2],
		["h3", renderAsH3],
	] as const)("draws the %s element with the look of another type", (tag, renderAs) => {
		const { container } = render(
			<Typography type="h4" render={renderAs} id="title" className="extra">
				Title
			</Typography>,
		);

		const heading = container.querySelector(tag);
		expect(heading?.textContent).toBe("Title");
		expect(heading?.id).toBe("title");
		expect(heading?.classList.contains("typography--h4")).toBe(true);
		expect(heading?.classList.contains("extra")).toBe(true);
		expect(container.querySelectorAll("h1, h2, h3, h4").length).toBe(1);
	});

	it("keeps Typography's own element when no render function is given", () => {
		const { container } = render(<Typography type="h2">Title</Typography>);

		expect(container.querySelector("h2")?.classList.contains("typography--h2")).toBe(true);
	});
});
