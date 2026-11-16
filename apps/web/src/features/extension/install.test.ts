import { describe, expect, it } from "vite-plus/test";
import { browserStore, extensionInstall } from "./install";

const chrome =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const edge = `${chrome} Edg/131.0.0.0`;
const firefox = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:132.0) Gecko/20100101 Firefox/132.0";
const safari =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15";
const android =
	"Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
const opera = `${chrome} OPR/116.0.0.0`;

const published = {
	chrome: "https://chromewebstore.google.com/detail/rezumi",
	edge: "https://microsoftedge.microsoft.com/addons/detail/rezumi",
};
const empty = { chrome: "", edge: "" };

describe("browserStore", () => {
	it("sends Edge to Edge Add-ons and the other Chromium desktop browsers to the Chrome Web Store", () => {
		expect(browserStore(edge)).toBe("edge");
		expect(browserStore(chrome)).toBe("chrome");
	});

	it("offers nothing to browsers and devices that can't install it", () => {
		for (const agent of [firefox, safari, android, opera, ""]) expect(browserStore(agent), agent).toBeNull();
	});
});

describe("extensionInstall", () => {
	it("stays hidden while the store addresses are empty", () => {
		expect(extensionInstall(chrome, empty)).toEqual({ url: null, store: null, published: false });
		expect(extensionInstall(edge, { chrome: "  ", edge: "" })).toEqual({ url: null, store: null, published: false });
	});

	it("gives each browser its own store button once published", () => {
		expect(extensionInstall(chrome, published)).toEqual({ url: published.chrome, store: "chrome", published: true });
		expect(extensionInstall(edge, published)).toEqual({ url: published.edge, store: "edge", published: true });
	});

	it("is published but offers no button to a browser without a store", () => {
		expect(extensionInstall(firefox, published)).toEqual({ url: null, store: null, published: true });
	});

	it("needs the visitor's own store: a published Chrome page alone doesn't open Edge's button", () => {
		expect(extensionInstall(edge, { chrome: published.chrome, edge: "" }).url).toBeNull();
	});
});
