// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { EFFECT_RUNNERS } from "./runtime";

type Stoppable = HTMLElement & { pfxStop?: () => void };

const originalMatchMedia = window.matchMedia;

/** A desktop with a mouse that doesn't ask for less motion. */
function pointerDesktop() {
	window.matchMedia = ((query: string) => ({ matches: !query.includes("reduce") })) as typeof window.matchMedia;
}

afterEach(() => {
	for (const element of document.querySelectorAll<Stoppable>("[data-pfx]")) element.pfxStop?.();
	window.matchMedia = originalMatchMedia;
	vi.restoreAllMocks();
	document.body.innerHTML = "";
});

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("intro effect scripts in a page", () => {
	it("scrambles letters as readers see them: an accent or an emoji sequence is one letter", async () => {
		pointerDesktop();
		document.body.innerHTML = '<h1 data-pfx="scramble">Zé 👩‍💻</h1>';
		EFFECT_RUNNERS.scramble?.(document);
		await tick();
		const layer = document.querySelector(".pfx-layer");
		expect(layer?.getAttribute("aria-hidden")).toBe("true");
		expect(layer?.children.length).toBe(3);
	});

	it("stops a scramble still running when it plays again, so the text never shows under the new one", async () => {
		pointerDesktop();
		document.body.innerHTML = '<h1 data-pfx="scramble">Nadia</h1>';
		const cleared = vi.spyOn(window, "clearInterval");
		EFFECT_RUNNERS.scramble?.(document);
		await tick();
		EFFECT_RUNNERS.scramble?.(document);
		await tick();
		expect(cleared).toHaveBeenCalledTimes(1);
		expect(document.querySelectorAll(".pfx-layer")).toHaveLength(1);
		expect(document.querySelector("h1")?.classList.contains("pfx-hide")).toBe(true);
	});

	it("keeps the vector outline's text for screen readers as text, not as a label on a paragraph", () => {
		pointerDesktop();
		document.body.innerHTML =
			'<p data-pfx="vector-hover"><span dir="auto"><span class="pfx-w">Product</span> <span class="pfx-w">Designer</span></span></p>';
		EFFECT_RUNNERS["vector-hover"]?.(document);
		const paragraph = document.querySelector("p") as HTMLElement;
		expect(paragraph.hasAttribute("aria-label")).toBe(false);
		expect(paragraph.querySelector(".sr-only")?.textContent).toBe("Product Designer");
		const shown = paragraph.querySelector('[aria-hidden="true"]');
		expect(shown?.querySelectorAll(".pfx-c")).toHaveLength("ProductDesigner".length);
		expect(shown?.querySelectorAll(".pfx-w")).toHaveLength(2);
		// Running again (the editor's Replay) wraps nothing twice.
		EFFECT_RUNNERS["vector-hover"]?.(document);
		expect(paragraph.querySelectorAll(".sr-only")).toHaveLength(1);
		// The letter under the pointer gets its outline and a selection box with four handles, hidden from readers.
		const letter = shown?.querySelector(".pfx-c") as HTMLElement;
		letter.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
		const box = letter.querySelector(".pfx-vx");
		expect(box?.getAttribute("aria-hidden")).toBe("true");
		expect(box?.querySelectorAll("b")).toHaveLength(4);
		expect(box?.querySelector("text")?.textContent).toBe("P");
	});

	it("leaves Arabic and Hebrew text whole for the vector outline: their letters join", () => {
		pointerDesktop();
		document.body.innerHTML = '<p data-pfx="vector-hover"><span class="pfx-w">مصممة</span></p>';
		EFFECT_RUNNERS["vector-hover"]?.(document);
		EFFECT_RUNNERS["vector-hover"]?.(document);
		const paragraph = document.querySelector("p") as HTMLElement;
		expect(paragraph.outerHTML).toBe('<p data-pfx="vector-hover"><span class="pfx-w">مصممة</span></p>');
	});

	it("does nothing for visitors who ask for less motion", async () => {
		window.matchMedia = ((query: string) => ({ matches: query.includes("reduce") })) as typeof window.matchMedia;
		document.body.innerHTML =
			'<h1 data-pfx="scramble">Nadia</h1><p data-pfx="vector-hover">Designer</p><p data-pfx="typewriter" data-pfx-phrases="[&quot;A&quot;,&quot;B&quot;]"><span class="pfx-type__out">A</span></p>';
		for (const runner of Object.values(EFFECT_RUNNERS)) runner?.(document);
		await tick();
		expect(document.querySelector(".pfx-layer, .pfx-c, .pfx-on")).toBeNull();
	});
});
