import { describe, expect, it } from "vite-plus/test";
import { isSameSite, pageAddress, readSiteDocument, readSitemap } from "./document";

const home = "https://www.dewi.design/";

const page = (body: string, head = "") =>
	`<!doctype html><html><head><title>Dewi Lestari — Product designer</title>${head}</head><body>${body}</body></html>`;

describe("pageAddress", () => {
	const base = new URL(home);

	it("makes links absolute https addresses without fragments, tracking or a trailing slash", () => {
		expect(pageAddress("/work/kopi/?utm_source=x&ref=nav#top", base)?.href).toBe("https://www.dewi.design/work/kopi");
		expect(pageAddress("http://dewi.design/about", base)?.href).toBe("https://dewi.design/about");
		expect(pageAddress("/", base)?.href).toBe("https://www.dewi.design/");
	});

	it("refuses what isn't a web address", () => {
		for (const href of [
			"mailto:hi@dewi.design",
			"tel:+62",
			"javascript:void(0)",
			"data:text/html,x",
			"ftp://x.y/z",
			"",
		])
			expect(pageAddress(href, base)).toBeNull();
		expect(pageAddress("https://user:pass@dewi.design/", base)).toBeNull();
	});
});

describe("isSameSite", () => {
	it("treats www., the bare host and subdomains as one site", () => {
		const site = new URL(home);
		expect(isSameSite(new URL("https://dewi.design/a"), site)).toBe(true);
		expect(isSameSite(new URL("https://blog.dewi.design/a"), site)).toBe(true);
		expect(isSameSite(new URL("https://notdewi.design/a"), site)).toBe(false);
		expect(isSameSite(new URL("https://dribbble.com/dewi"), site)).toBe(false);
	});
});

describe("readSiteDocument", () => {
	it("splits the site's own pages from other sites, without the home page, files or repeats", () => {
		const document = readSiteDocument(
			page(`
				<nav><a href="/">Home</a><a href="/work/kopi-checkout">Kopi checkout</a><a href="/about">About</a></nav>
				<a href="/work/kopi-checkout#story">Read the story</a>
				<a href="/cv.pdf">CV</a>
				<a href="https://apps.apple.com/app/kopi">App Store</a>
				<a href="mailto:hi@dewi.design">Email</a>
				<footer><a href="https://dewi.design/work/bank-app">Bank app</a></footer>
			`),
			home,
		);
		expect(document.title).toBe("Dewi Lestari — Product designer");
		expect(document.pages).toEqual([
			{ url: "https://www.dewi.design/work/kopi-checkout", text: "Kopi checkout" },
			{ url: "https://www.dewi.design/about", text: "About" },
			{ url: "https://dewi.design/work/bank-app", text: "Bank app" },
		]);
		expect(document.external).toEqual([{ url: "https://apps.apple.com/app/kopi", text: "App Store" }]);
	});

	it("resolves links against the page's base address", () => {
		const document = readSiteDocument(
			page(`<a href="kopi">Kopi</a>`, `<base href="https://www.dewi.design/work/">`),
			home,
		);
		expect(document.pages[0]?.url).toBe("https://www.dewi.design/work/kopi");
	});

	it("finds videos and embeds the portfolio can show, from links and frames", () => {
		const document = readSiteDocument(
			page(`
				<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>
				<a href="https://www.figma.com/proto/AbCdEf1234567/Kopi">Prototype</a>
				<a href="https://vimeo.com/76979871">Film</a>
			`),
			home,
		);
		expect(document.embeds).toEqual([
			"https://www.figma.com/proto/AbCdEf1234567",
			"https://vimeo.com/76979871",
			"https://www.youtube.com/watch?v=dQw4w9WgXcQ",
		]);
		// An embed is shown as an embed, not offered again as a link.
		expect(document.external).toEqual([]);
	});

	it("keeps pictures large enough to show a work, the share picture first, with their description and context", () => {
		const document = readSiteDocument(
			page(
				`
				<img src="/favicon.png" alt="">
				<img src="/img/avatar.jpg" width="48" height="48" alt="Dewi">
				<img src="/img/pixel.gif">
				<img src="data:image/png;base64,AAAA">
				<figure>
					<img src="/img/checkout-small.jpg" srcset="/img/checkout-800.jpg 800w, /img/checkout-1600.jpg 1600w, /img/checkout-4000.jpg 4000w" alt="New checkout" width="1600" height="1000">
					<figcaption>The new checkout, three steps instead of six</figcaption>
				</figure>
				<section><h2>Research</h2><picture><source srcset="/img/research.webp 1x, /img/research@2x.webp 2x"><img src="/img/research.jpg" alt="Interviews"></picture></section>
				<img src="/img/icon.svg" alt="">
			`,
				`<meta property="og:image" content="https://cdn.dewi.design/share.jpg">`,
			),
			home,
		);
		expect(document.images).toEqual([
			{
				url: "https://cdn.dewi.design/share.jpg",
				alt: "",
				width: null,
				height: null,
				context: "The page's preview picture",
			},
			{
				url: "https://www.dewi.design/img/checkout-1600.jpg",
				alt: "New checkout",
				width: 1600,
				height: 1000,
				context: "The new checkout, three steps instead of six",
			},
			{
				url: "https://www.dewi.design/img/research@2x.webp",
				alt: "Interviews",
				width: null,
				height: null,
				context: "Research",
			},
			{
				url: "https://www.dewi.design/img/research.jpg",
				alt: "Interviews",
				width: null,
				height: null,
				context: "Research",
			},
		]);
	});

	it("reads Framer's srcset without spaces, keeps commas inside addresses, and counts one picture once", () => {
		const document = readSiteDocument(
			page(`
				<img src="https://framerusercontent.com/images/run.jpg?scale-down-to=512" srcset="https://framerusercontent.com/images/run.jpg?scale-down-to=512 512w,https://framerusercontent.com/images/run.jpg?scale-down-to=1024 1024w,https://framerusercontent.com/images/run.jpg?scale-down-to=2048 2048w,https://framerusercontent.com/images/run.jpg 3520w" alt="Running">
				<img src="https://framerusercontent.com/images/run.jpg?width=3520" alt="Running again">
				<img srcset="https://res.cloudinary.com/demo/image/upload/w_800,h_600/kopi.jpg 1x, https://res.cloudinary.com/demo/image/upload/w_1600,h_1200/kopi.jpg 2x" alt="Kopi">
			`),
			home,
		);
		expect(document.images.map((image) => image.url)).toEqual([
			"https://framerusercontent.com/images/run.jpg?scale-down-to=2048",
			"https://res.cloudinary.com/demo/image/upload/w_1600,h_1200/kopi.jpg",
		]);
	});

	it("reads a page with no links or pictures as empty lists", () => {
		expect(readSiteDocument("<p>Hello</p>", home)).toEqual({
			title: "",
			pages: [],
			external: [],
			images: [],
			embeds: [],
		});
	});
});

describe("readSitemap", () => {
	it("lists the site's pages once, without the home page, files or other sites", () => {
		const xml = `<?xml version="1.0"?><urlset>
			<url><loc>https://www.dewi.design/</loc></url>
			<url><loc>https://www.dewi.design/work/kopi</loc></url>
			<url><loc> <![CDATA[https://www.dewi.design/work/bank?x=1&amp;y=2]]> </loc></url>
			<url><loc>https://www.dewi.design/work/kopi/</loc></url>
			<url><loc>https://www.dewi.design/files/cv.pdf</loc></url>
			<url><loc>https://elsewhere.test/page</loc></url>
		</urlset>`;
		expect(readSitemap(xml, new URL(home))).toEqual([
			"https://www.dewi.design/work/kopi",
			"https://www.dewi.design/work/bank?x=1&y=2",
		]);
	});

	it("stops at the most it was asked for", () => {
		const xml = Array.from({ length: 5 }, (_, index) => `<loc>https://www.dewi.design/p${index}</loc>`).join("");
		expect(readSitemap(xml, new URL(home), 2)).toHaveLength(2);
	});
});
