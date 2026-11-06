/**
 * Photographs rendered portfolio pages in the system Chrome through Playwright (`chromium.launch({ channel: "chrome"
 * })`), for `previews.ts` and `matrix.ts`. Pages open with their timers stopped at {@link PAGE_TIME}, so the local
 * time on the location card and every scripted intro effect only move when a shot asks for it; web fonts are cached
 * across pages.
 */
import type { Browser, BrowserContext, BrowserContextOptions, Page } from "@playwright/test";
import { setTimeout as sleep } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import sharp from "sharp";

/** 14.05 in Jakarta, the time the mockups show. */
const PAGE_TIME = new Date("2026-11-06T07:05:00Z");

/** Chrome draws at most about 16,000 device pixels in one picture; taller pages are taken in slices. */
const MAX_SLICE = 16_000;

type Cached = { status: number; headers: Record<string, string>; body: Buffer };

export class Camera {
	private readonly cache = new Map<string, Promise<Cached>>();

	private constructor(private readonly browser: Browser) {}

	static async start(): Promise<Camera> {
		return new Camera(await chromium.launch({ channel: "chrome" }));
	}

	async close(): Promise<void> {
		await this.browser.close();
	}

	/** A browser context whose web requests (the page's fonts) are answered from one cache. */
	private async context(options: BrowserContextOptions): Promise<BrowserContext> {
		const context = await this.browser.newContext(options);
		await context.route(/^https?:/, async (route) => {
			const url = route.request().url();
			let hit = this.cache.get(url);
			if (!hit) {
				hit = route.fetch().then(async (response) => ({
					status: response.status(),
					headers: response.headers(),
					body: await response.body(),
				}));
				this.cache.set(url, hit);
			}
			const response = await hit.catch(() => null);
			if (!response) {
				this.cache.delete(url);
				return route.abort();
			}
			if (response.status >= 400) this.cache.delete(url);
			return route.fulfill(response);
		});
		return context;
	}

	/**
	 * Opens `file` (and `hash`) in a context of its own, with the page's timers stopped at {@link PAGE_TIME} and its
	 * fonts loaded. Its CSS animations run on their own; {@link freezeAnimations} stops them. Playwright's clock belongs
	 * to the context, so pages never share one; close the page with {@link closePage}.
	 */
	async open(options: BrowserContextOptions, file: string, hash = ""): Promise<Page> {
		const context = await this.context(options);
		await context.clock.install({ time: PAGE_TIME.getTime() - 60_000 });
		await context.clock.pauseAt(PAGE_TIME);
		const page = await context.newPage();
		await page.goto(`${pathToFileURL(file).href}${hash ? `#${hash}` : ""}`, { waitUntil: "load" });
		await page.evaluate(() => document.fonts.ready.then(() => undefined));
		return page;
	}
}

/** Closes a page from {@link Camera.open} with its context. */
export async function closePage(page: Page): Promise<void> {
	await page.context().close();
}

/**
 * Scrolls `scroller` (the page, or the element it selects) to the bottom and back, then waits until every picture
 * that is shown has loaded, so lazy pictures are in the shot.
 */
export async function loadPictures(page: Page, scroller?: string): Promise<void> {
	const box = await page.evaluate((selector) => {
		const element = selector ? document.querySelector(selector) : document.scrollingElement;
		return { height: element?.scrollHeight ?? 0, step: Math.max(200, (element?.clientHeight ?? 800) * 0.8) };
	}, scroller ?? null);
	const scrollTo = (top: number) =>
		page.evaluate(
			// The page scrolls smoothly; the shot needs it there at once.
			([selector, y]) =>
				(selector ? document.querySelector(selector) : window)?.scrollTo({ top: y as number, behavior: "instant" }),
			[scroller ?? null, top] as const,
		);
	for (let top = 0; top < box.height; top += box.step) {
		await scrollTo(top);
		await sleep(30);
	}
	await scrollTo(box.height);
	const deadline = Date.now() + 15_000;
	while (Date.now() < deadline) {
		const pending = await page.evaluate(
			() => [...document.images].filter((image) => image.getClientRects().length > 0 && !image.complete).length,
		);
		if (pending === 0) break;
		await sleep(100);
	}
	await scrollTo(0);
}

/**
 * Stops every CSS animation at `time` ms after its start. The animations already running when it is first called are
 * the page's own (the intro effect); ones that start later (a hover's outline) are finished instead.
 */
export async function freezeAnimations(page: Page, time: number): Promise<void> {
	await page.evaluate((at) => {
		const state = window as unknown as { __pfFrozen?: WeakSet<Animation> };
		const own = state.__pfFrozen;
		if (!own) state.__pfFrozen = new WeakSet(document.getAnimations());
		for (const animation of document.getAnimations()) {
			if (!own || own.has(animation)) {
				animation.pause();
				animation.currentTime = at;
			} else if (Number.isFinite(animation.effect?.getComputedTiming().endTime)) animation.finish();
			else animation.pause();
		}
	}, time);
}

/** The whole page, in slices stacked together when it is taller than Chrome draws at once. */
export async function fullPageShot(page: Page, scale: number): Promise<Buffer> {
	const { width, height } = await page.evaluate(() => ({
		width: window.innerWidth,
		height: document.documentElement.scrollHeight,
	}));
	const slice = Math.floor(MAX_SLICE / scale);
	if (height <= slice) return page.screenshot({ fullPage: true, animations: "disabled" });
	const parts = [];
	for (let top = 0; top < height; top += slice) {
		const input = await page.screenshot({
			fullPage: true,
			animations: "disabled",
			clip: { x: 0, y: top, width, height: Math.min(slice, height - top) },
		});
		parts.push({ input, top: Math.round(top * scale), left: 0 });
	}
	return sharp({
		create: { width: Math.round(width * scale), height: Math.round(height * scale), channels: 3, background: "#fff" },
		limitInputPixels: false,
	})
		.composite(parts)
		.png()
		.toBuffer();
}

/**
 * How far the page (or the element `scroller` selects) scrolls sideways past its width, and up to three of the
 * innermost elements that stick out (unless something around them clips or scrolls them). Zero when nothing overflows.
 */
export function horizontalOverflow(page: Page, scroller?: string): Promise<{ px: number; culprits: string[] }> {
	return page.evaluate((selector) => {
		const root = selector ? document.querySelector(selector) : document.documentElement;
		if (!root) return { px: 0, culprits: [] };
		// The layout width, not `innerWidth`: a phone zooms out to fit a page that overflows, which widens `innerWidth`.
		const px = selector
			? root.scrollWidth - root.clientWidth
			: Math.max(root.scrollWidth - root.clientWidth, root.scrollWidth - window.innerWidth);
		if (px <= 0) return { px: 0, culprits: [] };
		const limit = selector ? root.getBoundingClientRect() : { left: 0, right: root.clientWidth };
		// No named functions in here: tsx wraps them in a `__name` helper the page doesn't have.
		const out: Element[] = [];
		for (const element of root.querySelectorAll("*")) {
			const box = element.getBoundingClientRect();
			if (box.width === 0 || (box.right <= limit.right + 1 && box.left >= limit.left - 1)) continue;
			let clipped = false;
			for (let parent = element.parentElement; parent && parent !== root && !clipped; parent = parent.parentElement)
				clipped = getComputedStyle(parent).overflowX !== "visible";
			if (!clipped) out.push(element);
		}
		// The innermost ones: a wide box usually sticks out because of one long word or picture inside it.
		const innermost = out.filter((element) => !out.some((other) => other !== element && element.contains(other)));
		return {
			px,
			culprits: innermost.slice(0, 3).map(
				(element) =>
					`${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${[...element.classList]
						.slice(0, 2)
						.map((name) => `.${name}`)
						.join("")}`,
			),
		};
	}, scroller ?? null);
}
