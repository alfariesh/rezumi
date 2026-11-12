// @vitest-environment happy-dom

import type { PortfolioDataInput } from "@rezumi/schema/portfolio/data";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { fullPortfolioData, renderTestPage } from "./fixtures.test-helpers";
import { PORTFOLIO_PAGE_SCRIPT } from "./script";

/** Listeners the page script added, removed after each test so the next page starts clean. */
const cleanups: (() => void)[] = [];

function trackListeners(target: EventTarget) {
	const original = target.addEventListener;
	target.addEventListener = function add(type, listener, options) {
		cleanups.push(() => target.removeEventListener(type, listener, options));
		original.call(this, type, listener, options);
	};
	cleanups.push(() => {
		target.addEventListener = original;
	});
}

afterEach(() => {
	for (const cleanup of cleanups.splice(0).reverse()) cleanup();
	history.replaceState(null, "", "/");
	document.documentElement.removeAttribute("style");
});

/** Puts a rendered page in the document (the home page, or a work's own page) and runs the page script on it. */
function load(options: { data?: PortfolioDataInput; workId?: string; locale?: string } = {}) {
	const { page } = renderTestPage(options.data ?? fullPortfolioData, {
		...(options.locale ? { locale: options.locale } : {}),
		...(options.workId ? { page: { kind: "work", workId: options.workId } } : {}),
	});
	document.documentElement.lang = page.lang;
	document.documentElement.dir = page.dir;
	document.body.innerHTML = page.html;
	trackListeners(document);
	trackListeners(window);
	// oxlint-disable-next-line no-new-func -- runs the page's inline script as the browser would.
	new Function(PORTFOLIO_PAGE_SCRIPT)();
}

const $ = <T extends Element = HTMLElement>(selector: string) => document.querySelector<T>(selector) as T;
const press = (key: string, init: KeyboardEventInit = {}, target: Element = document.activeElement ?? document.body) =>
	target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }));
const click = (element: Element) => element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

/** The page's top-level parts the script makes inert, apart from `except`. */
const inertParts = (except: Element) =>
	[...$(".pf").children].filter((child) => child !== except).every((child) => child.hasAttribute("inert"));

describe("page script: a work's page", () => {
	it("holds no detail dialog to open: the script has no code for one, and arrow keys stay the browser's", () => {
		expect(PORTFOLIO_PAGE_SCRIPT).not.toMatch(/pf-detail|pf-open|hashchange|data-close|data-next|data-previous/);
		load({ workId: "w1" });
		const step = $<HTMLAnchorElement>(".pf-workpage__step--next");
		expect(step.getAttribute("href")).toBe("/nadia/work/no-cover");
		expect(press("ArrowRight")).toBe(true);
		expect(press("Escape")).toBe(true);
	});

	it("plays a video in place: the player replaces its button, loaded only after the press", () => {
		// The test browser doesn't load frames (it logs a "loading is disabled" error for the player).
		load({ workId: "w1" });
		expect(document.querySelector("iframe")).toBeNull();
		const play = $<HTMLAnchorElement>('a[data-embed*="youtube-nocookie"]');
		click(play);
		const frame = $<HTMLIFrameElement>(".pf-video iframe");
		expect(frame.src).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1");
		expect(frame.referrerPolicy).toBe("strict-origin-when-cross-origin");
		expect(frame.title).toBe("Checkout demo");
		expect(play.isConnected).toBe(false);
		expect(document.activeElement).toBe(frame);
	});

	it("shows an embed in place at its shape, and keeps the note on where it loads from", () => {
		load({ workId: "w1" });
		for (const provider of ["figma", "loom", "spotify", "soundcloud", "google-slides"]) {
			const box = $(`.pf-embed[data-provider="${provider}"]`);
			click(box.querySelector("a[data-embed]") as Element);
			const frame = box.querySelector("iframe");
			expect(box.querySelector("a[data-embed]"), provider).toBeNull();
			expect(frame?.getAttribute("src"), provider).toMatch(/^https:\/\//);
			expect(box.querySelector(".pf-embed__note")?.textContent, provider).toMatch(/\S/);
		}
		expect($('.pf-embed[data-provider="spotify"] iframe').getAttribute("src")).toBe(
			"https://open.spotify.com/embed/episode/4rOoJ6Egrf8K2IrywzwOMk",
		);
	});
});

describe("page script: picture viewer", () => {
	it("opens a gallery picture modally, steps and swipes through the gallery, and closes back to the picture", () => {
		load({ workId: "w1" });
		const lightbox = $(".pf-lightbox");
		const [first] = document.querySelectorAll<HTMLAnchorElement>(".pf-workpage a[data-lightbox]");
		if (!first) throw new Error("The full page has a gallery.");
		click(first);
		expect(lightbox.hidden).toBe(false);
		expect($<HTMLImageElement>(".pf-lightbox img").src).toBe(first.href);
		expect($(".pf-lightbox__count").textContent).toBe("1 / 2");
		expect($(".pf-lightbox figcaption").textContent).toBe("Home screen");
		expect(document.activeElement).toBe($('[data-lb="close"]'));
		expect(document.documentElement.style.overflow).toBe("hidden");
		// Everything else is inert while it's open.
		expect(inertParts(lightbox)).toBe(true);
		press("ArrowRight");
		expect($(".pf-lightbox__count").textContent).toBe("2 / 2");
		// A modifier key leaves the arrow to the browser.
		press("ArrowRight", { altKey: true });
		expect($(".pf-lightbox__count").textContent).toBe("2 / 2");
		lightbox.dispatchEvent(new TouchEvent("touchstart", { touches: [{ clientX: 300 } as Touch] }));
		lightbox.dispatchEvent(new TouchEvent("touchend", { changedTouches: [{ clientX: 200 } as Touch] }));
		expect($(".pf-lightbox__count").textContent).toBe("1 / 2");
		press("Escape");
		expect(lightbox.hidden).toBe(true);
		expect(document.activeElement).toBe(first);
		expect(document.querySelector("[inert]")).toBeNull();
		expect(document.documentElement.style.overflow).toBe("");
	});

	it("steps the other way right to left, and closes on a tap outside the picture", () => {
		load({ workId: "w1", locale: "ar-SA" });
		const [first] = document.querySelectorAll<HTMLAnchorElement>(".pf-workpage a[data-lightbox]");
		if (!first) throw new Error("The full page has a gallery.");
		click(first);
		press("ArrowLeft");
		expect($(".pf-lightbox__count").textContent).toBe("2 / 2");
		click($(".pf-lightbox"));
		expect($(".pf-lightbox").hidden).toBe(true);
	});
});

describe("page script: small comforts", () => {
	it("shows the location's local time, labelled for screen readers by text", () => {
		load();
		const time = $("[data-tz]");
		expect(time.hidden).toBe(false);
		expect(time.lastElementChild?.textContent).toMatch(/\d/);
		expect(time.querySelector(".sr-only")?.textContent).toMatch(/\S/);
	});

	it("closes the menu after a tap on one of its links", () => {
		load({ data: { ...fullPortfolioData, about: { content: "<p>Hi</p>" } } });
		const menu = $<HTMLDetailsElement>(".pf-menu");
		menu.open = true;
		click($(".pf-menu__list a"));
		expect(menu.open).toBe(false);
	});
});
