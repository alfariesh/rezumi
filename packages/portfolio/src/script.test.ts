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

/** Puts a rendered page in the document, at `hash`, and runs the page script on it. */
function load(options: { data?: PortfolioDataInput; hash?: string; locale?: string } = {}) {
	const { page } = renderTestPage(options.data ?? fullPortfolioData, options.locale ? { locale: options.locale } : {});
	document.documentElement.lang = page.lang;
	document.documentElement.dir = page.dir;
	document.body.innerHTML = page.html;
	history.replaceState(null, "", `/${options.hash ?? ""}`);
	trackListeners(document);
	trackListeners(window);
	// oxlint-disable-next-line no-new-func -- runs the page's inline script as the browser would.
	new Function(PORTFOLIO_PAGE_SCRIPT)();
}

/** Lets the browser deliver `hashchange` after a change of address. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

async function go(hash: string) {
	location.hash = hash;
	await settle();
}

const $ = <T extends Element = HTMLElement>(selector: string) => document.querySelector<T>(selector) as T;
const press = (key: string, init: KeyboardEventInit = {}, target: Element = document.activeElement ?? document.body) =>
	target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }));
const click = (element: Element) => element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

/** The page's top-level parts the script makes inert, apart from `except`. */
const inertParts = (except: Element) =>
	[...$(".pf").children].filter((child) => child !== except).every((child) => child.hasAttribute("inert"));

describe("page script: work details", () => {
	it("opens a detail at once on a direct visit: shown, modal, the page locked, its title focused", async () => {
		load({ hash: "#work-kopi-app" });
		const detail = $("#work-kopi-app");
		expect(detail.classList.contains("pf-open")).toBe(true);
		expect(document.documentElement.style.overflow).toBe("hidden");
		expect(inertParts(detail)).toBe(true);
		expect(detail.hasAttribute("inert")).toBe(false);
		// Focus moves on the next frame, after the browser's own jump to the anchor.
		await settle();
		expect(document.activeElement).toBe(detail.querySelector("h2"));
		expect(document.activeElement?.getAttribute("tabindex")).toBe("-1");
	});

	it("opens on a link, closes with Escape and gives focus back to the work's card", async () => {
		load();
		expect(document.querySelector(".pf-open")).toBeNull();
		await go("#work-kopi-app");
		expect($("#work-kopi-app").classList.contains("pf-open")).toBe(true);
		press("Escape");
		await settle();
		expect(location.hash).toBe("#work");
		expect(document.querySelector(".pf-open")).toBeNull();
		expect(document.documentElement.style.overflow).toBe("");
		expect(document.querySelector("[inert]")).toBeNull();
		expect(document.activeElement).toBe($('main a[href="#work-kopi-app"]'));
	});

	it("steps with the arrow keys, mirrored right to left, but not with a modifier key or inside a gallery", async () => {
		load({ hash: "#work-kopi-app" });
		press("ArrowRight", { altKey: true });
		await settle();
		expect(location.hash).toBe("#work-kopi-app");
		press("ArrowRight", {}, $("#work-kopi-app .pf-gallery a"));
		await settle();
		expect(location.hash).toBe("#work-kopi-app");
		press("ArrowRight");
		await settle();
		expect(location.hash).toBe("#work-no-cover");
		expect($("#work-no-cover").classList.contains("pf-open")).toBe(true);
		expect($("#work-kopi-app").classList.contains("pf-open")).toBe(false);
		cleanups
			.splice(0)
			.reverse()
			.forEach((cleanup) => cleanup());

		load({ hash: "#work-kopi-app", locale: "ar-SA" });
		press("ArrowLeft");
		await settle();
		expect(location.hash).toBe("#work-no-cover");
	});

	it("closes on a tap outside the panel", async () => {
		load({ hash: "#work-kopi-app" });
		click($("#work-kopi-app"));
		await settle();
		expect(location.hash).toBe("#work");
	});

	it("plays a video in place and puts the play button back when the detail closes", async () => {
		// The test browser doesn't load frames (it logs a "loading is disabled" error for the player).
		load({ hash: "#work-kopi-app" });
		const play = $<HTMLAnchorElement>('a[data-embed*="youtube-nocookie"]');
		click(play);
		const frame = $<HTMLIFrameElement>("#work-kopi-app iframe");
		expect(frame.src).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1");
		expect(frame.referrerPolicy).toBe("strict-origin-when-cross-origin");
		expect(play.isConnected).toBe(false);
		await go("#work");
		expect(document.querySelector("iframe")).toBeNull();
		expect(play.isConnected).toBe(true);
	});
});

describe("page script: picture viewer", () => {
	it("opens a gallery picture modally, steps and swipes through the gallery, and closes back to the picture", () => {
		load({ hash: "#work-kopi-app" });
		const lightbox = $(".pf-lightbox");
		const [first] = document.querySelectorAll<HTMLAnchorElement>("#work-kopi-app a[data-lightbox]");
		if (!first) throw new Error("The full page has a gallery.");
		click(first);
		expect(lightbox.hidden).toBe(false);
		expect($<HTMLImageElement>(".pf-lightbox img").src).toBe(first.href);
		expect($(".pf-lightbox__count").textContent).toBe("1 / 2");
		expect($(".pf-lightbox figcaption").textContent).toBe("Home screen");
		expect(document.activeElement).toBe($('[data-lb="close"]'));
		// Everything else is inert while it's open, the detail behind it too.
		expect(inertParts(lightbox)).toBe(true);
		press("ArrowRight");
		expect($(".pf-lightbox__count").textContent).toBe("2 / 2");
		lightbox.dispatchEvent(new TouchEvent("touchstart", { touches: [{ clientX: 300 } as Touch] }));
		lightbox.dispatchEvent(new TouchEvent("touchend", { changedTouches: [{ clientX: 200 } as Touch] }));
		expect($(".pf-lightbox__count").textContent).toBe("1 / 2");
		press("Escape");
		expect(lightbox.hidden).toBe(true);
		expect(document.activeElement).toBe(first);
		expect($("#work-kopi-app").hasAttribute("inert")).toBe(false);
		expect($("main").hasAttribute("inert")).toBe(true);
	});

	it("closes when the address changes, so it never shows over a closed detail", async () => {
		load({ hash: "#work-kopi-app" });
		const first = $<HTMLAnchorElement>("#work-kopi-app a[data-lightbox]");
		click(first);
		await go("#work");
		expect($(".pf-lightbox").hidden).toBe(true);
		expect(document.querySelector("[inert]")).toBeNull();
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
