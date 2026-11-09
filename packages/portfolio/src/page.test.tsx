import type { PortfolioDataInput } from "@rezumi/schema/portfolio/data";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { describe, expect, it } from "vite-plus/test";
import { PORTFOLIO_THEMES } from "@rezumi/schema/portfolio/themes";
import { renderPortfolioDocument } from "./document";
import {
	count,
	expectSoundPage,
	fullPortfolioData,
	fullTestResume,
	renderTestPage,
	testImage as image,
	testResume,
} from "./fixtures.test-helpers";
import { fillPortfolioMessage } from "./messages";
import { portfolioIconNames, renderPortfolioPage } from "./page";
import { linkAttributes } from "./shared/primitives";

const fullData: PortfolioDataInput = fullPortfolioData;

function render(data: PortfolioDataInput, resume: ResumeData | null = testResume(), locale?: string) {
	return renderTestPage(data, { resume, ...(locale ? { locale } : {}) });
}

describe("renderPortfolioPage (Lugas)", () => {
	const { view, page, html } = render(fullData);

	it("draws every section with its anchor and heading, and no undefined or NaN", () => {
		expectSoundPage(html, "lugas");
		for (const anchor of ["about", "work", "services", "testimonials", "clients", "experience", "contact", "custom-x1"])
			expect(html).toContain(`id="${anchor}"`);
		expect(html).toContain('id="custom-x1--title"');
		expect(page.css).not.toMatch(/undefined|NaN/);
		expect(page.lang).toBe("id-ID");
	});

	it("leaves out hidden works and resume items, and references", () => {
		expect(html).not.toContain("Hidden work");
		expect(html).not.toContain("Hidden Co");
		expect(html).not.toContain("Someone Else");
	});

	it("opens each shown work's detail by its anchor, as a modal dialog, with previous and next", () => {
		expect(html).toContain('href="#work-kopi-app"');
		expect(html).toContain('id="work-kopi-app" role="dialog" aria-modal="true" aria-labelledby="work-kopi-app--title"');
		expect(html).toContain('href="#work-no-cover" aria-label="Berikutnya: Work without pictures"');
		expect(count(html, /class="pf-detail"/g)).toBe(view.works.length);
	});

	it("draws metrics as definition lists with every part as text", () => {
		expect(html).toMatch(/<dl class="pf-metrics lg-stats" data-variant="big">/);
		expect(html).toMatch(/4\sjt/);
		expect(html).toContain("97,5%");
		expect(html).toContain("Top 3");
		// The block's metrics: value, change for screen readers, before and after, sparkline, progress, context.
		expect(html).toContain("2,8%");
		expect(html).toContain("Naik, perubahan baik:");
		expect(html).toMatch(/Sebelum 2,1%/);
		expect(html).toContain('class="pf-metric__chart"');
		expect(html).toMatch(/role="img" aria-label="Progres: 80%"/);
		expect(html).toContain("3 months after launch");
		// The work card's highlighted metric.
		expect(html).toMatch(/<span class="pf-work-metric"><b>2,8%<\/b><span>Checkout conversion<\/span><\/span>/);
	});

	it("opens gallery pictures full size, in one viewer the page script fills (a new tab without it)", () => {
		expect(html).toContain(
			'<a class="pf-zoom" href="https://rezumi.example/uploads/user-1/pictures/portfolio/shot-1.webp" target="_blank" rel="noopener" data-lightbox="" data-caption="Home screen">',
		);
		expect(html).toContain(
			'<a class="pf-zoom" href="https://rezumi.example/uploads/user-1/pictures/portfolio/shot-2.webp" target="_blank" rel="noopener" data-lightbox="">',
		);
		expect(count(html, /class="pf-lightbox"/g)).toBe(1);
		expect(html).toMatch(/<div class="pf-lightbox" role="dialog" aria-modal="true" aria-label="[^"]+" hidden="">/);
		expect(count(html, /data-lb="(?:close|prev|next)"/g)).toBe(3);
	});

	it("moves the first picture's preload into the head", () => {
		expect(page.head).toMatch(/^<link rel="preload" as="image"/);
		expect(html.startsWith("<div")).toBe(true);
	});

	it("gives images their size, text alternatives, lazy loading and focus point", () => {
		expect(html).toMatch(
			/<img class="lg-photo" src="https:\/\/rezumi.example\/uploads\/user-1\/pictures\/formal.webp"[^>]*loading="eager"/,
		);
		expect(html).toContain('alt="shot-1 picture" width="1600" height="1200" loading="lazy" decoding="async"');
		expect(html).toContain("object-position:30% 60%");
		expect(html).toContain('srcSet="https://rezumi.example/uploads/user-1/pictures/portfolio/shot-1-small.webp 800w');
	});

	it("cleans rich text and marks outgoing links as user content", () => {
		expect(html).not.toContain("<script>alert");
		expect(html).toContain(
			'<a href="https://example.test" rel="ugc nofollow noopener noreferrer" target="_blank">there</a>',
		);
		expect(html).toContain(
			'href="https://dribbble.example.test/nadia" target="_blank" rel="ugc nofollow noopener noreferrer"',
		);
		expect(html).toContain(
			'href="https://linkedin.example.test/in/nadia" target="_blank" rel="me ugc nofollow noopener noreferrer"',
		);
	});

	it("draws videos as a thumbnail and play button that load nothing from YouTube or Vimeo", () => {
		// The player only arrives through the page script after a click.
		expect(html).not.toContain("<iframe");
		expect(html).not.toMatch(/ytimg|vimeocdn/);
		expect(html).toContain('data-embed="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1"');
		expect(html).toContain(
			'data-embed="https://player.vimeo.com/video/76979871?dnt=1&amp;autoplay=1&amp;h=9f2c1a7b3d"',
		);
		// Without JavaScript the link opens the video on its own site.
		expect(html).toContain('href="https://www.youtube.com/watch?v=dQw4w9WgXcQ" target="_blank"');
		expect(html).toContain("uploads/user-1/pictures/portfolio/video-thumb.webp");
		expect(html).toContain('aria-label="Putar video: Checkout demo"');
		expect(html).toContain('aria-label="Putar video (Vimeo)"');
		expect(count(html, /data-pf-event="video"/g)).toBe(2);
	});

	it("draws a PDF card with its first page, page count, size and an Open PDF button", () => {
		const { messages } = render(fullData);
		expect(html).toContain("uploads/user-1/pictures/portfolio/case-study-page.webp");
		expect(html).toContain(`PDF · ${fillPortfolioMessage(messages.pages, { count: 12 })} · 2,4 MB`);
		expect(html).toMatch(
			/<a class="pf-btn pf-btn--secondary" href="https:\/\/rezumi\.example\/uploads\/user-1\/documents\/portfolio\/case-study\.pdf" target="_blank" rel="noopener" data-pf-event="document"/,
		);
		expect(html).toContain("Buka PDF");
	});

	it("draws link cards with the site and an outgoing user-content link", () => {
		expect(html).toContain(
			'class="pf-link" href="https://medium.example.test/@nadia/fewer-failed-payments" target="_blank" rel="ugc nofollow noopener noreferrer"',
		);
		expect(html).toContain("Medium · medium.example.test");
		expect(html).toContain("Three experiments that mattered most.");
		expect(html).toContain("uploads/user-1/pictures/portfolio/repo-card.webp");
		expect(count(html, /class="pf-link"[^>]*data-pf-event="link"/g)).toBe(2);
		expect(portfolioIconNames(view)).toContain("medium");
	});

	it("shows the saved map picture with a pin, attribution and an OpenStreetMap link, never map tiles", () => {
		// A light page shows the light picture only; auto mode lets the device choose.
		expect(html).toContain("uploads/user-1/pictures/portfolio/map-light.webp");
		expect(html).not.toContain("map-dark.webp");
		const auto = render({ ...fullData, design: { scheme: "auto" } }).html;
		expect(auto).toContain(
			'<picture><source media="(prefers-color-scheme: dark)" srcSet="https://rezumi.example/uploads/user-1/pictures/portfolio/map-dark.webp"/>',
		);
		const dark = render({ ...fullData, design: { scheme: "dark" } }).html;
		expect(dark).toContain("map-dark.webp");
		expect(dark).not.toContain("map-light.webp");
		expect(html).toContain('alt="Peta sekitar Jakarta, Indonesia"');
		expect(html).toContain('class="pf-loc__pin"');
		expect(html).toContain("© OpenMapTiles © OpenStreetMap contributors");
		// The point is rounded to its precision: about a kilometre for a city.
		expect(html).toContain('href="https://www.openstreetmap.org/?mlat=-6.21&amp;mlon=106.85#map=10/-6.21/106.85"');
		expect(html).not.toMatch(/openfreemap|maplibre|tiles\./i);
		// A province or country is an area: no pin, no marker on the map link.
		const region = render({
			...fullData,
			location: { ...fullData.location, point: { lat: -6.88, lng: 107.56, precision: "region" } },
		}).html;
		expect(region).not.toContain('class="pf-loc__pin"');
		expect(region).toContain('href="https://www.openstreetmap.org/#map=7/-7/108"');
		expect(region).not.toMatch(/-6\.88|107\.56/);
	});

	it("shows contact, location and the credit", () => {
		expect(html).toContain("https://wa.me/6281255501824");
		expect(html).toContain(">+62 812 5550 1824</a>");
		expect(html).toContain('data-tz="Asia/Jakarta"');
		expect(html).toContain("Hybrid");
		expect(html).toContain("Bersedia relokasi");
		expect(html).toContain("© 2026 Nadia Rahmawati");
		expect(html).toContain('class="pf-badge" href="https://rezumi.example"');
	});

	it("computes contrast-safe accent tokens for light and dark", () => {
		expect(page.css).toMatch(/:root\{color-scheme:light;[^}]*--pf-accent:#0F766E/);
		expect(page.css).toMatch(/:root\[data-pf-scheme="dark"\]\{color-scheme:dark;/);
		expect(page.css).toContain("@font-face");
	});

	it("lists the resume icons it needs", () => {
		// The link card's brand logo.
		expect(portfolioIconNames(view)).toEqual(["medium"]);
	});

	it("wraps the page in a document with its head", () => {
		const document = renderPortfolioDocument({
			page,
			head: {
				title: "Nadia",
				description: "Designer <b>",
				canonicalUrl: "https://rezumi.example/nadia",
				indexable: false,
				imageUrl: "https://rezumi.example/cards/nadia.png",
				meLinks: ["https://linkedin.example.test/in/nadia"],
				structuredData: { name: "</script><script>alert(1)</script>" },
			},
		});
		expect(document).toMatch(/^<!doctype html><html lang="id-ID" dir="ltr" data-pf-scheme="light">/);
		expect(document).toContain('<meta name="robots" content="noindex, follow">');
		expect(document).toContain("Designer &lt;b&gt;");
		expect(document).toContain('<link rel="me" href="https://linkedin.example.test/in/nadia">');
		expect(document).not.toContain("</script><script>alert");
		expect(document).toContain('<meta name="theme-color" content="#FFFFFF">');
	});
});

describe("renderPortfolioPage edge cases", () => {
	it("draws an almost empty portfolio without empty headings", () => {
		const resume = testResume();
		resume.sections.experience.items = [];
		resume.sections.profiles.items = [];
		resume.basics.email = "";
		resume.basics.website = { url: "", label: "" };
		resume.basics.location = "";
		resume.picture.url = "";
		const { html } = render({ about: { content: "" }, works: { items: [] } }, resume);
		expect(html).toContain("Nadia Rahmawati");
		expect(html).not.toContain('<section class="pf-section');
		expect(html).not.toContain("pf-nav__links");
		expect(html).not.toMatch(/undefined|NaN/);
	});

	it("leaves out metrics still being filled in, and the viewer when there's no gallery", () => {
		const { html } = render({
			hero: {
				highlights: [
					{ id: "h1", label: "", value: { kind: "number", number: 12 }, format: "plain" },
					{ id: "h2", label: "Years", value: { kind: "number", number: 8 }, format: "plain" },
				],
			},
			works: {
				items: [
					{
						id: "w1",
						slug: "w1",
						title: "Draft work",
						highlightMetricId: "m0",
						blocks: [
							{
								id: "b1",
								type: "metrics",
								items: [
									{ id: "m0", label: "", value: { kind: "number", number: 99 }, format: "percent" },
									{ id: "m1", label: "Faster checkout", value: { kind: "text", text: "" }, format: "plain" },
								],
							},
						],
					},
				],
			},
		});
		expect(html).toContain("Years");
		expect(html).not.toMatch(/>12</);
		expect(html).not.toContain("99%");
		expect(html).not.toContain("Faster checkout");
		expect(html).not.toContain("pf-work-metric");
		expect(html).not.toContain("pf-lightbox");
	});

	it("draws without a resume", () => {
		const { html } = render({ basics: { name: "Citra", headline: "Illustrator" } }, null);
		expect(html).toContain("Citra");
		expect(html).toContain("Illustrator");
	});

	it("sizes a very long name by its longest word", () => {
		const { html } = render({ basics: { name: "Muhammad Abdurrahmanwijayakusuma Putra" } });
		expect(html).toContain('style="--name-word:23"');
	});

	it("writes right-to-left pages", () => {
		const { html, page } = render(fullData, testResume(), "ar-SA");
		expect(page.dir).toBe("rtl");
		expect(page.lang).toBe("ar-SA");
		expect(html).toContain('class="pf-icon pf-flip"');
		expect(html).not.toMatch(/undefined|NaN/);
	});

	it("draws every Lugas variant", () => {
		const resume = testResume();
		resume.sections.skills.items = [
			{
				id: "sk1",
				hidden: false,
				icon: "",
				iconColor: "",
				name: "Design",
				proficiency: "",
				level: 0,
				keywords: ["Figma"],
			},
		] as ResumeData["sections"]["skills"]["items"];
		for (const [key, values] of Object.entries({
			hero: ["photo-top", "photo-left"],
			work: ["list", "grid-2", "featured-grid"],
			services: ["list", "cards"],
			testimonials: ["cards", "carousel"],
			clients: ["grayscale", "color"],
			experience: ["compact", "timeline"],
			skills: ["groups", "chips"],
			metric: ["big", "kpi", "ba"],
		}))
			for (const value of values) {
				const { html } = render({ ...fullData, design: { variants: { [key]: value } } }, resume);
				expect(html).toContain(`data-variant="${value}"`);
				expect(html).not.toMatch(/undefined|NaN/);
			}
	});

	it("draws every release theme as itself", () => {
		for (const theme of PORTFOLIO_THEMES)
			expect(render({ ...fullData, theme }).html).toContain(`data-theme="${theme}"`);
	});

	it("draws dark and device-following modes", () => {
		expect(render({ design: { scheme: "dark" } }).page.scheme).toBe("dark");
		expect(render({ design: { scheme: "auto" } }).page.css).toContain(
			'@media (prefers-color-scheme:dark){:root[data-pf-scheme="auto"]',
		);
	});
});

describe("renderPortfolioPage hardening", () => {
	it("publishes no work, detail or picture viewer while the Work section is hidden, in every theme", () => {
		for (const theme of PORTFOLIO_THEMES) {
			const { html, view } = render({ ...fullData, theme, sections: { hidden: ["work"] } });
			expectSoundPage(html, theme);
			expect(view.works).toEqual([]);
			expect(html).not.toContain("pf-detail");
			expect(html).not.toContain("pf-lightbox");
			expect(html).not.toContain("Coffee ordering app");
			expect(html).not.toContain("Orders took too long");
		}
	});

	it("names heading ids apart from every work anchor, in every theme", () => {
		const works = {
			items: [
				{ id: "w1", slug: "title", title: "Title" },
				{ id: "w2", slug: "brand", title: "Brand" },
				{ id: "w3", slug: "brand-title", title: "Brand Title" },
			],
		};
		for (const theme of PORTFOLIO_THEMES) {
			const { html } = render({ ...fullData, theme, works });
			expectSoundPage(html, theme);
			expect(html).toContain('id="work-brand-title"');
			expect(html).toContain('id="work-brand--title"');
			expect(html).toContain('id="work--title"');
		}
	});

	it("draws a resume custom section like the standard section of its type, keywords included, in every theme", () => {
		for (const theme of PORTFOLIO_THEMES) {
			const { html } = render({ ...fullData, theme, design: { variants: { skills: "groups" } } }, fullTestResume());
			expectSoundPage(html, theme);
			const tools = /<section[^>]* id="resume-tools"[\s\S]*?<\/section>/.exec(html)?.[0] ?? "";
			expect(tools, theme).toContain('<div class="pf-skillgroups" data-variant="groups">');
			expect(tools, theme).toContain("<li>Figma</li><li>Sketch</li>");
			// The section whose ID a link can't hold as it is gets a safe anchor of its own.
			expect(html).toMatch(/id="resume-x[\da-z]+"/);
			expect(html).toContain("Sundanese");
		}
	});

	it("styles a lone profiles list like the other short lists", () => {
		const { html } = render({ ...fullData, sections: { hidden: [], order: ["profiles", "contact"] } });
		expect(html).toMatch(/<section class="pf-section lg-sec" id="profiles"[^>]*>[\s\S]*?<ul class="pf-extralist">/);
	});

	it("puts headings in rich text under the section's or the work's own", () => {
		const { html } = render(fullData);
		expect(html).toContain("<h3>Problem</h3><h4>Why</h4>");
		expect(render({ ...fullData, about: { content: "<h2>Hi</h2><p>There</p>" } }).html).toContain("<h3>Hi</h3>");
		expect(render(fullData).page.css).toContain(".pf-prose h3,.pf-prose h4{");
		// A text that starts at H3 keeps it: nothing to make room for.
		expect(render({ ...fullData, about: { content: "<h3>Only</h3><p>x</p>" } }).html).toContain("<h3>Only</h3>");
	});

	it("names every gallery picture's link, even a picture without its own text", () => {
		const { html } = render({
			...fullData,
			works: {
				items: [
					{
						id: "w1",
						slug: "a",
						title: "Coffee app",
						blocks: [
							{
								id: "b1",
								type: "images",
								layout: "grid",
								images: [
									{ ...image("one"), alt: "" },
									{ ...image("two"), alt: "", caption: "Checkout" },
								],
							},
						],
					},
				],
			},
		});
		expect(html).toMatch(/<a class="pf-zoom"[^>]*><img [^>]*alt="Coffee app \(1\/2\)"/);
		expect(html).toMatch(/<a class="pf-zoom"[^>]*data-caption="Checkout"><img [^>]*alt="Checkout"/);
	});

	it("names client logos once, names a brand icon without a name, and leaves out a client with nothing to draw", () => {
		const { html } = renderTestPage(
			{
				clients: {
					items: [
						{ id: "c1", name: "Kilau Pay", logo: image("logo", 600, 200) },
						{ id: "c2", name: "", logo: { brandIcon: "medium" }, url: "https://medium.example.test" },
						{ id: "c3", name: "", logo: { brandIcon: "unknown-brand" } },
					],
				},
			},
			{ icons: { medium: "<path d='M1 1h2'/>" } },
		);
		const logos = /<ul class="pf-logos"[\s\S]*?<\/ul>/.exec(html)?.[0] ?? "";
		expect(logos).toContain('alt="Kilau Pay"');
		expect(logos).not.toContain("sr-only");
		expect(logos).toMatch(
			/<a class="pf-logo"[^>]*><svg class="pf-icon" viewBox="0 0 24 24" role="img" aria-label="medium.example.test"/,
		);
		expect(count(logos, /<li>/g)).toBe(2);
	});

	it("never draws an icon from outside the map it was given", () => {
		const { html } = renderTestPage(
			{ clients: { items: [{ id: "c1", name: "", logo: { brandIcon: "constructor" } }] } },
			{ icons: {} },
		);
		expect(html).not.toContain("[native code]");
		expect(html).not.toContain("function");
	});

	it("declares the small copy's real width in srcset, narrower for a portrait picture", () => {
		const { html } = render({
			...fullData,
			works: { items: [{ id: "w1", slug: "a", title: "Tall", cover: image("tall", 900, 1350) }] },
		});
		expect(html).toContain(
			"tall-small.webp 533w, https://rezumi.example/uploads/user-1/pictures/portfolio/tall.webp 900w",
		);
	});

	it("tells screen readers the local time and the sparkline's numbers without naming a plain element", () => {
		const { html } = render(fullData);
		expect(html).toMatch(
			/<span class="pf-loc__time" data-tz="Asia\/Jakarta" data-lang="id-ID" hidden=""><span class="sr-only">[^<]+: <\/span><span><\/span><\/span>/,
		);
		expect(html).toMatch(/<dd class="pf-metric__chart"><span class="sr-only">1,9%\W+2,1%\W+2,4%\W+2,8%<\/span><svg/);
	});

	it("fills text in a person's words as written, never as a replacement pattern", () => {
		const { html } = render({ ...fullData, location: { ...fullData.location, label: "Rock $& Roll $$" } });
		expect(html).toContain("Rock $&amp; Roll $$");
		expect(html).not.toContain("Rock Map around");
	});

	it("draws a link or picture only from an address that is safe to use", () => {
		expect(linkAttributes("javascript:alert(1)")).toEqual({});
		expect(linkAttributes("//evil.example.test")).toEqual({});
		// Browsers read a backslash like a slash, so these lead to another site too.
		expect(linkAttributes("/\\evil.example.test")).toEqual({});
		expect(linkAttributes("\\\\evil.example.test")).toEqual({});
		expect(linkAttributes("data:text/html,hi")).toEqual({});
		expect(linkAttributes("#contact")).toEqual({ href: "#contact" });
		expect(linkAttributes("mailto:nadia@example.test")).toEqual({ href: "mailto:nadia@example.test" });
		expect(linkAttributes("https://example.test")).toMatchObject({ target: "_blank" });
		// Without an `imageUrl`, only http(s) addresses and the page's own paths load.
		const resume = testResume();
		resume.picture.url = "data:image/svg+xml,<svg onload=alert(1)>";
		const { view, messages } = renderTestPage({}, { resume });
		const page = renderPortfolioPage({ view, messages, year: 2026, creditUrl: "https://rezumi.example" });
		expect(page.html).not.toContain("data:image");
		// A path on the page's own site loads (the preview tools serve pictures beside the page); `//host` doesn't.
		const withPicture = (src: string) =>
			renderPortfolioPage({
				view: { ...view, hero: { ...view.hero, picture: { src, alt: "Me" } } },
				messages,
				year: 2026,
				creditUrl: "https://rezumi.example",
			}).html;
		expect(withPicture("img/me.png")).toContain('src="img/me.png"');
		expect(withPicture("/uploads/me.webp")).toContain('src="/uploads/me.webp"');
		expect(withPicture("//evil.example.test/me.png")).not.toContain("evil.example.test");
		expect(withPicture("/\\evil.example.test/me.png")).not.toContain("evil.example.test");
		expect(withPicture("\\\\evil.example.test/me.png")).not.toContain("evil.example.test");
		expect(withPicture("javascript:alert(1)")).not.toContain("javascript:");
	});

	it("keeps a Mozaik Contact whose only content is the place's name, so its buttons land", () => {
		const resume = testResume();
		resume.basics.email = "";
		resume.basics.website = { url: "", label: "" };
		resume.sections.profiles.items = [];
		const { html } = render(
			{
				theme: "mozaik",
				hero: { buttons: [{ kind: "contact" }] },
				contact: { whatsapp: { show: false, number: "" }, note: "" },
				location: { label: "Bandung", showMap: false, workModes: [], relocate: false, showLocalTime: false },
			},
			resume,
		);
		expectSoundPage(html, "mozaik");
		expect(html).toContain('href="#contact"');
		expect(html).toContain('<section class="mz-tile mz-loc pf-section" id="contact"');
		expect(html).not.toMatch(/<li class="pf-chip"><svg[^]*?<\/svg>Bandung<\/li>/);
	});

	it("draws the featured work in the large first place of the layouts that have one", () => {
		const works = {
			items: [
				{ id: "w1", slug: "first", title: "First" },
				{ id: "w2", slug: "chosen", title: "Chosen", featured: true },
			],
		};
		for (const theme of ["kanvas", "mozaik"] as const) {
			const { html } = render({ ...fullData, theme, works });
			expect(html.indexOf('href="#work-chosen"'), theme).toBeLessThan(html.indexOf('href="#work-first"'));
		}
	});
});

describe("links leaving the page", () => {
	const OWN_SITE = /^https:\/\/rezumi\.example\//;

	it("all carry ugc, nofollow, noopener and noreferrer", () => {
		const { html } = renderTestPage(fullPortfolioData);
		const anchors = [...html.matchAll(/<a\b[^>]*>/g)].map(([tag]) => tag);
		const leaving = anchors.filter((tag) => {
			const href = /href="([^"]*)"/.exec(tag)?.[1] ?? "";
			return /^https?:/i.test(href) && !OWN_SITE.test(href);
		});
		expect(leaving.length).toBeGreaterThan(3);
		for (const tag of leaving) {
			if (tag.includes('class="pf-badge"')) continue;
			const rel = /rel="([^"]*)"/.exec(tag)?.[1] ?? "";
			expect(rel.split(" "), tag).toEqual(expect.arrayContaining(["ugc", "nofollow", "noopener", "noreferrer"]));
		}
	});
});
